# Compute Audit Followup

**Date:** 2026-05-29  
**Auditor:** Claude (re-audit pass)  
**Original fixes:** compute fix 1 (scheduler cache), compute fix 2 (indexes), compute fix 3 (getAllUmbrellaHealthScores N+1)

---

## 1. Verification: are the three fixes actually in the live code?

### Fix 1 — Settings cache in `server/src/lib/scheduler.ts`

**VERIFIED. All cache machinery is present and correct.**

- `cachedSettings: SettingsRow | null` — module-level cache variable (line 84)
- `SETTINGS_TTL_MS = 60 * 60 * 1000` — 1-hour TTL (line 86)
- `getSettings()` — checks `Date.now() - cachedAt < SETTINGS_TTL_MS` before calling Neon (lines 96–103)
- `invalidateSettingsCache()` — exported, zeroes both `cachedSettings` and `cachedAt` (lines 105–108)

**Short-circuit analysis per tick:**

| Tick | DB avoided when not due? | How |
|---|---|---|
| `tickCheckin` | ✅ Yes | `getSettings()` (cache-first) → `jerusalemNow()` (in-memory) → `if (hhmm < effectiveCheckinTime) return` — no DB query on idle minutes |
| `tickMorning` | ✅ Yes | First two lines are `const { hhmm } = jerusalemNow(); if (hhmm !== '09:00') return` — pure in-memory, no I/O at all before the guard |
| `tickSandboxReminder` | ✅ Yes | `getSettings()` (cache-first) → all subsequent checks are in-memory arithmetic on timestamps |
| `tickResolutions` | ✅ Yes (with nuance) | `const db = getDb()` at line 221 is called before the `'00:01'` check, but `getDb()` only returns the already-initialized Drizzle singleton — no network call. The comment at line 220 confirms: *"getDb() returns the already-initialized client, no network call."* |

**One subtle point:** On the very first tick after a cold start (or after the 1-hour TTL expires), `getSettings()` will hit Neon once to refresh the cache. This is expected and correct — it's a single query amortized over ~60 ticks.

---

### Fix 2 — Migration 0013 indexes in `server/drizzle/0013_compute_indexes.sql`

**VERIFIED. File exists, journal references it.**

Journal entry at `idx: 13`, tag: `"0013_compute_indexes"` — sequential from 0–13, no gaps.

**All 12 indexes:**

| Index name | Table | Column(s) |
|---|---|---|
| `idx_umbrella_questions_umbrella_id` | `umbrella_questions` | `umbrella_id` |
| `idx_question_answers_question_id` | `question_answers` | `question_id` |
| `idx_question_answers_interview_date` | `question_answers` | `interview_date` |
| `idx_tasks_umbrella_id` | `tasks` | `umbrella_id` |
| `idx_tasks_status` | `tasks` | `status` |
| `idx_reminders_umbrella_id` | `reminders` | `umbrella_id` |
| `idx_health_history_umbrella_id` | `health_history` | `umbrella_id` |
| `idx_resolutions_umbrella_id` | `resolutions` | `umbrella_id` |
| `idx_resolutions_question_id` | `resolutions` | `question_id` |
| `idx_resolutions_active_due` | `resolutions` | `(status, end_date)` — composite |
| `idx_umbrellas_parent_id` | `umbrellas` | `parent_id` |
| `idx_umbrellas_archived_at` | `umbrellas` | `archived_at` |

All statements use `CREATE INDEX IF NOT EXISTS` (idempotent). ✅

**Gap flagged here:** A composite index on `question_answers(question_id, interview_date)` is missing. The two separate single-column indexes exist, but Postgres typically uses at most one index per table per query (or does a bitmap AND of two). The analytics queries always filter on BOTH columns simultaneously:

```sql
WHERE question_id = ... AND interview_date >= ... AND answer_normalized IS NOT NULL
```

A composite `(question_id, interview_date)` would be dramatically faster for this pattern — the most-hit query in the whole system. See Section 3 for EXPLAIN ANALYZE queries to confirm.

---

### Fix 3 — `getAllUmbrellaHealthScores` rewrite in `server/src/lib/analytics.ts`

**VERIFIED. The N+1 is gone.**

The function (lines 86–112) now issues exactly **2 parallel queries** via `Promise.all`:
1. `SELECT id FROM umbrellas` — flat ID list, no joins
2. `SELECT umbrella_questions.umbrella_id, AVG(answer_normalized) FROM question_answers INNER JOIN umbrella_questions ... WHERE interview_date >= ... AND answer_normalized IS NOT NULL GROUP BY umbrella_questions.umbrella_id` — single aggregation

The merge loop initializes every umbrella ID to `null` first, then overwrites only those with answer data. Umbrellas with no answers correctly return `null`. ✅

The old pattern (calling `computeUmbrellaHealthScore(id)` per umbrella = N queries) is completely replaced.

---

## 2. Remaining hot paths the audit missed

### 2a. Dashboard sparklines — confirmed client-side N+1

**`client/src/store/useStore.ts` lines 72–76:**

```typescript
const trendResults = await Promise.allSettled(
  flat.map(u => api.getUmbrellaTrend(u.id, 42))
)
```

This fires **N parallel HTTP requests** to `/api/analytics/umbrellas/:id/trend` on every dashboard load. With 5 umbrellas that is 5 concurrent connections to Neon; with 10 it is 10. Each individual server query (`getUmbrellaDailyTrend`) is a clean single GROUP BY, but multiplied by N they add up.

This was **not addressed** by any of the three fixes. It is the next most impactful thing to tackle.

**Suggested fix:** Add `GET /api/analytics/umbrellas/trends?days=42` returning `{ [umbrellaId]: [{date, score}][] }` with a single query: `GROUP BY umbrella_questions.umbrella_id, question_answers.interview_date`. Replace the `Promise.allSettled` fan-out in `useStore.loadUmbrellas()` with a single call to the bulk endpoint.

---

### 2b. `GET /api/umbrellas` — 6 parallel queries per page load

**`server/src/routes/umbrellas.ts` lines 76–84:**

```typescript
const [allUmbrellas, allTasks, allReminders, allHistory, healthScores] = await Promise.all([
  db.select().from(umbrellas)...,
  db.select().from(tasks),           // ALL tasks, unfiltered
  db.select().from(reminders),       // ALL reminders, unfiltered
  db.select().from(healthHistory),   // ALL history, unfiltered
  getAllUmbrellaHealthScores(14),     // = 2 queries internally
])
```

Total: **6 parallel queries** on every umbrella list load (which `loadUmbrellas()` calls on auth, and after every umbrella create/delete/restore).

Filtering happens in JS: `allTasks.filter(t => t.umbrellaId === u.id)`. This is fine while data is small, but `tasks`, `reminders`, and `health_history` are all fetched in full with no WHERE clause. For Dan's current scale this is not a problem, but it is worth noting if those tables grow.

---

### 2c. Chat route — 6 queries per chat message

**`server/src/routes/chat.ts` lines 40–45 (`buildContextBlock`):**

```typescript
const [allUmbrellas, openTasks, allReminders, computedScores] = await Promise.all([
  db.select().from(umbrellas)...,
  db.select().from(tasks).where(ne(tasks.status, 'done')),
  db.select().from(reminders),     // ALL reminders, no WHERE
  getAllUmbrellaHealthScores(14),  // = 2 queries
])
```

Total: **6 parallel queries** per chat message sent. All parallel, so no latency stack, but each chat turn does 6 Neon round-trips. This is acceptable given how infrequently chat is used vs. scheduler ticks.

The `allReminders.filter(r => r.umbrellaId === u.id)` JS loop (line 49) is the same full-fetch-then-filter pattern as the umbrellas route.

---

### 2d. Interview composer — single clean query ✅

`composeTodaysQuestions()` issues one query with an `innerJoin` on `umbrella_questions JOIN umbrellas`. Cadence filtering is done in JS post-fetch. No N+1. ✅

---

### 2e. `tickMorning` at 09:00 — 4 DB queries, once per day

At exactly 09:00 Jerusalem time, `tickMorning` issues 4 queries:
1. `SELECT FROM interview_session WHERE date = yesterday`
2. `composeTodaysQuestions(yesterday)` — 1 query
3. `SELECT FROM question_answers WHERE interview_date = yesterday`
4. `SELECT FROM whatsapp_session WHERE date = yesterday`

This fires once per day at a specific time. Not a hot path concern.

---

### 2f. `tickResolutions` at 00:01 — 2N+1 queries for expired resolutions

For each expired resolution: 1 query for answer type + 1 query in `computeResolutionProgress`. In practice, 0–2 resolutions expire per day. Not a concern at current scale.

---

## 3. EXPLAIN ANALYZE queries to run in Neon's SQL editor

Replace `<placeholder>` values with any real UUID from your tables (use `SELECT id FROM question_answers LIMIT 1` to get one).

```sql
-- Should show Index Scan on idx_question_answers_question_id.
-- If it shows Seq Scan, the index was not applied by the migration.
EXPLAIN ANALYZE
SELECT * FROM question_answers
WHERE question_id = '<any-question-id>';

-- Should show Index Scan on idx_question_answers_interview_date.
EXPLAIN ANALYZE
SELECT * FROM question_answers
WHERE interview_date >= (CURRENT_DATE - INTERVAL '14 days');

-- The critical analytics query — this is the innermost loop of getAllUmbrellaHealthScores.
-- Look for: "Index Scan" on question_answers. If you see Seq Scan here, that's where
-- compute time is going. Ideally you want a composite (question_id, interview_date) index.
EXPLAIN ANALYZE
SELECT uq.umbrella_id, AVG(qa.answer_normalized)
FROM question_answers qa
INNER JOIN umbrella_questions uq ON qa.question_id = uq.id
WHERE qa.interview_date >= (CURRENT_DATE - INTERVAL '14 days')
  AND qa.answer_normalized IS NOT NULL
GROUP BY uq.umbrella_id;

-- Sparkline trend query — one per umbrella on dashboard load.
-- Should use idx_umbrella_questions_umbrella_id and idx_question_answers_question_id.
EXPLAIN ANALYZE
SELECT qa.interview_date, AVG(qa.answer_normalized)
FROM question_answers qa
INNER JOIN umbrella_questions uq ON qa.question_id = uq.id
WHERE uq.umbrella_id = '<any-umbrella-id>'
  AND qa.interview_date >= (CURRENT_DATE - INTERVAL '42 days')
  AND qa.answer_normalized IS NOT NULL
GROUP BY qa.interview_date
ORDER BY qa.interview_date;

-- Scheduler: active resolutions due today or earlier.
-- Should use idx_resolutions_active_due (composite status + end_date).
EXPLAIN ANALYZE
SELECT * FROM resolutions
WHERE status = 'active'
  AND end_date < CURRENT_DATE;

-- Tasks for an umbrella — should use idx_tasks_umbrella_id.
EXPLAIN ANALYZE
SELECT * FROM tasks
WHERE umbrella_id = '<any-umbrella-id>';
```

**What to look for:**
- `Index Scan` = index is being used ✅
- `Bitmap Heap Scan using X AND Y` = two single-column indexes being ANDed — functional but slower than a composite
- `Seq Scan` = index not applied (check migration ran, or table too small for planner to bother)

---

## 4. Honest Assessment

**Did the fixes address the root causes?**

| Finding | Root cause addressed? | Notes |
|---|---|---|
| ~270k idle Neon SELECTs/month from scheduler | ✅ Yes | `getSettings()` cache eliminates the select-on-every-tick pattern. tickMorning's pure-in-memory guard before any I/O is especially clean. |
| N+1 health score queries (one per umbrella) | ✅ Yes | `getAllUmbrellaHealthScores` is now 2 parallel queries regardless of umbrella count. |
| Missing FK indexes | ✅ Yes | 12 indexes added. The composite `idx_resolutions_active_due` is particularly good for the scheduler query. |
| Dashboard sparkline N+1 | ❌ Not addressed | `useStore.loadUmbrellas()` still fires N HTTP requests for trends. This is the biggest remaining hot path. |
| Missing composite index on `question_answers(question_id, interview_date)` | ❌ Not addressed | Two separate indexes exist but the planner can't use both simultaneously as efficiently as a composite. For the analytics GROUP BY, this is the most impactful missing piece. |
| Full-table fetches in umbrellas route | Not critical yet | `db.select().from(tasks)` / `reminders` / `healthHistory` with no WHERE clause. Fine at current scale but will not age well. |

**Surprises:**
- `tickResolutions` calls `getDb()` before its time check — but this turned out to be a non-issue since `getDb()` is a singleton return, not a DB call. The code comment at line 220 is correct.
- The `getAllUmbrellaHealthScores` call is made TWICE per `loadUmbrellas()` in effect: once inside `GET /api/umbrellas` (for `computedHealthScore` in the umbrella shape), and then the client fires N additional requests for sparkline trends. The health scores are batched, but the trends are not.

---

## 5. What to monitor over the next 2–3 days

In the **Neon console** → your project → **Monitoring** tab:

1. **Compute hours / active time** — The primary metric. Before fixes: close to continuous. After fixes: should show clear idle gaps between 09:00 and the configured check-in time. If you see sustained activity outside those windows, the cache invalidation is not working.

2. **Connections** — Peak should drop. The N trend requests on dashboard load create a short burst of N parallel connections. If you see daily spikes of 10+ concurrent connections in the morning when Dan opens the app, that confirms the sparkline N+1 is still firing.

3. **Query count per hour** — Neon's "Queries" graph. Should drop from ~4/minute during idle hours to near-zero, spiking only at 09:00 and at the check-in time.

4. **Top queries by time** — Look for any `Seq Scan` on `question_answers`. If the analytics GROUP BY appears there with Seq Scan, the composite index on `(question_id, interview_date)` is the next migration to write.

**Success signal:** idle hours (10pm–8am) show near-zero compute; the only daily bumps are at the configured check-in time, 09:00, and 00:01.

---

## Summary

The three fixes are implemented correctly and address their stated goals. The most impactful remaining gap is the **dashboard sparkline N+1**: on every app open, N parallel HTTP requests fan out for trend data. Adding a single bulk-trend endpoint would reduce that to 1 request and 1 DB query regardless of umbrella count. Second priority is a **composite index on `question_answers(question_id, interview_date)`** to replace the two single-column indexes for the core analytics query pattern.
