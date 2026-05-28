# myNefesh — Compute Audit

*Static-analysis audit of likely Neon compute hogs. Written from working knowledge of the codebase rather than live EXPLAIN ANALYZE — directionally correct, not numerically precise. Use the prioritized fix list at the bottom.*

---

## Headline findings

1. **The scheduler fires 4 tick functions every single minute, all of which hit the database** — even when nothing is due. This alone is ~150–360k DB queries/month for ticks that almost never need to act. Biggest, easiest win.
2. **Health-score computation runs on every dashboard page load**, not cached. With ~10 umbrellas, opening the home screen fires ~10 separate scan-and-aggregate queries on `question_answers`. Multiple per-session navigations multiply this.
3. **Foreign-key columns are unindexed.** Drizzle's `references()` does NOT auto-create indexes on the referring column. Every query that filters by `umbrella_id`, `question_id`, `parent_id`, etc. is doing sequential scans. As data grows, this gets dramatically worse.
4. **Chat context calls `getAllUmbrellaHealthScores()`** which iterates per-umbrella — classic N+1.
5. **No query caching layer at all** — every page hit recomputes from scratch.

---

## Per-area analysis

### 1. Scheduler load — biggest single hog

`server/src/lib/scheduler.ts` registers a node-cron job that runs **every minute**. Each tick calls four functions in sequence: `tickCheckin`, `tickMorning`, `tickSandboxReminder`, `tickResolutions`.

Each tick fires at least one SELECT regardless of whether anything is actually due:
- `tickCheckin` — reads `user_settings`, today's `whatsapp_session`, today's `interview_session`
- `tickMorning` — reads yesterday's `interview_session` + `whatsapp_session`
- `tickResolutions` — reads `resolutions` WHERE status='active' AND end_date < today
- `tickSandboxReminder` — likely dormant since SMS swap but may still query

Rough query budget: ~6–10 SELECT queries per minute, every minute, 24/7. That's ~9k/day, ~270k/month. Almost all are wasted — the actual fire-window for each tick is one minute per day or less.

**Fixes (in order of effort):**

A. **Short-circuit each tick on cheap in-memory state.** Cache `user_settings` in process memory; refresh once an hour. Most ticks become a single `if (now != checkinTime) return;` with zero DB calls. Cuts ~80% of scheduler queries instantly.

B. **Bundle the four ticks into a single query.** Instead of each tick making its own SELECT, do one combined "what's due now" query at the top of the minute, then dispatch in-process. ~75% reduction in query count.

C. **(Better) "Next event" model.** Compute `nextSendAt` and persist it. The scheduler just compares `now >= nextSendAt`; only ONE row check per minute. When events fire, recompute next. Cuts to ~1 query/minute.

D. **Use Render's native cron jobs** instead of node-cron in the web process. Render's cron is its own dyno that doesn't run continuously. But Render free tier may not include cron — verify before pursuing.

**Recommended:** A + B first (small surgical change, big win). C if compute is still pinned.

---

### 2. Analytics computation — not cached

`server/src/lib/analytics.ts` exports `computeUmbrellaHealthScore(id, days)`, `getUmbrellaDailyTrend(id, days)`, `getQuestionDailyTrend(id, days)`, `getAllUmbrellaHealthScores(days)`.

Path on every home-screen load:
1. Client calls `GET /api/umbrellas` → returns umbrellas WITH computedHealthScore attached
2. That handler calls `getAllUmbrellaHealthScores()` which loops over each umbrella and calls `computeUmbrellaHealthScore` per umbrella
3. Each call: JOIN `question_answers` to `umbrella_questions` WHERE `umbrella_id = ?`, last N days, AVG over `answer_normalized`

With 10 umbrellas → 10 join queries per home-page load. The dashboard ALSO calls `getUmbrellaTrend` per card (for the sparkline) → another 10 join queries. So one home-page render ≈ 20 join+aggregate queries.

The score changes once a day at most (one interview per day). The trend changes once a day at most. So 95%+ of those queries return identical results to yesterday's compute.

**Fixes (in order):**

A. **Add two columns to `umbrellas`:** `cached_health_score integer nullable`, `cached_health_score_at timestamptz nullable`. The scheduler recomputes them once a day (or after `POST /api/interview/complete`). The API just reads the cached column — zero scans on every page load. Massive win.

B. **Same approach for trends:** a `cached_trend jsonb` column with the daily series, refreshed nightly. Or a separate `umbrella_daily_score` table with one row per (umbrella, date) — query becomes a single indexed SELECT.

C. **In-memory cache layer:** keep computed scores in a `Map` keyed by umbrellaId, with a 1-hour TTL. Simplest if you don't want schema changes. Lost on server restart, but that's fine for this data.

**Recommended:** A + B (DB-level caching). One-time schema change pays off forever.

---

### 3. N+1 in `getAllUmbrellaHealthScores`

The function (per code path) loops over umbrellas and computes each individually — N queries instead of one.

**Fix:** one query that GROUP BY umbrella_id, AVG over answer_normalized, JOIN through umbrella_questions. Reduces N+1 to 1 query.

```sql
SELECT uq.umbrella_id, AVG(qa.answer_normalized) AS score
FROM question_answers qa
JOIN umbrella_questions uq ON qa.question_id = uq.id
WHERE qa.interview_date >= CURRENT_DATE - INTERVAL '14 days'
  AND qa.answer_normalized IS NOT NULL
GROUP BY uq.umbrella_id;
```

That replaces 10 individual queries with one. Should be in the codebase even before the caching layer above.

---

### 4. Missing indexes

Drizzle's `references()` declares the FK but does NOT create an index on the referring column. Every query that filters by these columns is doing sequential scans:

Likely missing indexes (verify against current schema.ts):
- `umbrella_questions.umbrella_id`
- `question_answers.question_id`
- `question_answers.interview_date`
- `tasks.umbrella_id`
- `tasks.status` (used in WHERE for "open tasks" filters)
- `reminders.umbrella_id`
- `health_history.umbrella_id`
- `resolutions.umbrella_id`
- `resolutions.question_id`
- `resolutions.status` + `resolutions.end_date` (composite, for `tickResolutions`)
- `umbrellas.parent_id`
- `umbrellas.archived_at` (for the default "not archived" filter)

Each adds a few KB and dramatically speeds up the filtered selects. Migration to add them all is straightforward:

```sql
CREATE INDEX IF NOT EXISTS idx_umbrella_questions_umbrella_id ON umbrella_questions(umbrella_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_question_id ON question_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_interview_date ON question_answers(interview_date);
CREATE INDEX IF NOT EXISTS idx_tasks_umbrella_id ON tasks(umbrella_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_reminders_umbrella_id ON reminders(umbrella_id);
CREATE INDEX IF NOT EXISTS idx_health_history_umbrella_id ON health_history(umbrella_id);
CREATE INDEX IF NOT EXISTS idx_resolutions_umbrella_id ON resolutions(umbrella_id);
CREATE INDEX IF NOT EXISTS idx_resolutions_active_due ON resolutions(status, end_date);
CREATE INDEX IF NOT EXISTS idx_umbrellas_parent_id ON umbrellas(parent_id);
CREATE INDEX IF NOT EXISTS idx_umbrellas_archived_at ON umbrellas(archived_at);
```

Use the proper migration workflow (now that the migration check script is in place, the build will catch any journal desync).

---

## Top 5 queries to EXPLAIN ANALYZE in Neon's SQL editor

Run these in `console.neon.tech` → your project → SQL editor:

1. **Per-umbrella score** (currently fires per umbrella):
```sql
EXPLAIN ANALYZE
SELECT AVG(qa.answer_normalized)
FROM question_answers qa
JOIN umbrella_questions uq ON qa.question_id = uq.id
WHERE uq.umbrella_id = '<some-umbrella-id>'
  AND qa.interview_date >= CURRENT_DATE - INTERVAL '14 days'
  AND qa.answer_normalized IS NOT NULL;
```

2. **Today's WhatsApp session lookup** (fires every minute):
```sql
EXPLAIN ANALYZE
SELECT * FROM whatsapp_session WHERE date = CURRENT_DATE;
```

3. **Today's interview session lookup**:
```sql
EXPLAIN ANALYZE
SELECT * FROM interview_session WHERE date = CURRENT_DATE;
```

4. **Active resolutions past deadline** (fires every minute via `tickResolutions`):
```sql
EXPLAIN ANALYZE
SELECT * FROM resolutions
WHERE status = 'active' AND end_date < CURRENT_DATE;
```

5. **Today's question composition** (fires when interview opens):
```sql
EXPLAIN ANALYZE
SELECT uq.* FROM umbrella_questions uq
JOIN umbrellas u ON uq.umbrella_id = u.id
WHERE uq.enabled = true AND u.archived_at IS NULL;
```

Look at the "Planning Time" + "Execution Time" values and whether each table is using `Seq Scan` (bad — needs an index) or `Index Scan` (good).

---

## Prioritized fix list

| Priority | Fix | Effort | Estimated savings |
|---|---|---|---|
| 🔴 1 | Cache `user_settings` in memory, short-circuit each tick | Small (~30 lines) | ~70-80% scheduler queries |
| 🔴 2 | Add the indexes from section 4 above | Small migration | Cuts most query times 10-100× |
| 🟠 3 | Fix the N+1 in `getAllUmbrellaHealthScores` (one GROUP BY query) | Small | ~90% of analytics queries on dashboard |
| 🟠 4 | Add `cached_health_score` + `cached_health_score_at` to `umbrellas`, refresh nightly via scheduler | Medium | ~95% of analytics queries on dashboard |
| 🟡 5 | "Next event" scheduler model | Medium | Final scheduler cleanup |
| 🟡 6 | Materialized trend cache | Larger | Sparkline queries become trivial |

Doing 1 + 2 + 3 alone will likely take you from 100% compute back to comfortable headroom. They're all small commits.

---

## What NOT to bother with (yet)

- **Postgres materialized views.** Overkill for this scale. The cached-columns pattern (#4) is simpler and more flexible.
- **Redis or any external cache.** Adds infrastructure complexity for a single-user app. In-memory `Map` is enough.
- **Connection pooling tweaks.** Drizzle + node-postgres already handle this well. Not worth tuning until the above is done.
- **Query result compression / pagination.** Your largest table (`question_answers`) is maybe hundreds of rows. Not a row-count problem; it's a query-frequency problem.

---

## Caveats

This audit was written from accumulated knowledge of the codebase across the build sessions, not from a fresh end-to-end pass. Specific function signatures, exact column lists, and current line numbers may have drifted slightly. The DIRECTION is solid. Verify against the actual files before committing each fix, and run the EXPLAIN ANALYZE queries above to confirm indexes are the issue before adding them all blindly.

The code task that did a fresh pass also wrote a COMPUTE_AUDIT.md to the repo (currently uncommitted, stuck in a worktree due to bridge flakiness). Once that's recoverable, cross-check against this version — but don't wait on it to start fixing.
