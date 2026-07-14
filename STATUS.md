# myNefesh — STATUS

*Strategic briefing. Pair with CLAUDE.md (technical reference). Attach both to any brainstorming chat to get instantly up to speed.*

---

## One-line state

A personal life-management web app for Dan: nightly SMS check-in → in-app interview → data → visualizations. Live in production. Multi-tenancy v2 just shipped — seeder killed, idempotent catch-all migration, clean master.

---

## Architecture in a paragraph

React + Vite + TypeScript client on **Vercel** (`mynefesh.vercel.app` / `mynefesh-danbenhurs-projects.vercel.app`). Express + TypeScript + Drizzle ORM server on **Render** (`mynefesh.onrender.com`). Postgres on **Neon**. Auth via **Google OAuth** (multi-tenant allowlist via `allowed_emails` table). Nightly **SMS** via paid **Twilio** number `+19129147770`. All Hebrew + RTL. Repo at `github.com/danbenhur/mynefesh`, single branch `master`, no `main`.

Schema is now fully multi-tenant: `users` table, `allowed_emails` table, `user_id` FK on all 10 data tables. Dan seeded as `00000000-0000-0000-0000-000000000001`.

For schema/routes/file layout see CLAUDE.md.

---

## Current focus

**SMS outage resolved + hardening (2026-07-14).** Nightly check-ins were silently down Jul 5–14: the cron-job.org keep-alive died June 30 and auto-deactivated, so Render's free tier slept through every 22:00 tick (full post-mortem: `docs/specs/001-sms-outage.md`). Keep-alive re-enabled and verified. Hardening PR adds a `system_health` heartbeat table + startup `[KEEPALIVE WARNING]`, phone normalization at send time + E.164 backfill (migration 0019), a cross-tenant snooze-reset fix, and honest scheduler diagnostics. Verify the warning does NOT appear on next Render deploy (means the ping is being recorded).

---

## Recently shipped (last ~2 weeks)

- **SMS-outage fix + hardening (2026-07-14):** Root-caused the 9-day silent check-in outage (dead keep-alive → Render asleep at tick time; masked by the Jun 28–Jul 4 migration crash-loop that pinned prod to the old build). Shipped: keep-alive watchdog (`system_health` table, health-ping recording, loud startup warning), `normalizePhone()` + channel matching in `sendSMS`, migration 0019 E.164 backfill, user-scoped snooze reset in settings PATCH, scheduler diag line now prints both `shabbatMode` and `inShabbatWindow`. Incident spec: `docs/specs/001-sms-outage.md`.

- **Migration 0017 constraint fix (2026-07-04, commit 756f8ff):** Umbrella uniqueness loosened to `(user_id, parent_id, name)` — unblocked the multi-tenancy migration that had been rolling back since Jun 28.

- **Multi-tenancy v2 (2026-06-28, commit e812ec7):** Killed migration-seeder.ts (root cause of seeder footgun incidents). Added migrations 0017 (multi-tenancy DDL) and 0018 (catch-all re-run, no TRUNCATE). All routes scoped to req.user.id. New /api/admin and /api/onboarding routes. OnboardingScreen + AdminScreen added to client. New scheduler per-user Map cache. Vitest integration tests + GitHub Actions CI. Startup self-heal probe logs schema mismatch immediately. Single clean commit; force-pushed to clean master first.

- **Spend protection (migration 0014):** Hard ceilings on all billable surfaces before opening app to invited users. Per-user sliding-window chat rate limit (5 msg/hr, in-memory). Daily Anthropic API budget cap (`DAILY_API_BUDGET_USD`, default $5). Daily SMS cap (`DAILY_SMS_LIMIT`, default 50). New `api_usage` table logs both surfaces with `day_utc` index. `pricing.ts` codifies claude-sonnet-4-6 rates. Both caps return Hebrew 429 errors. Limits are env-var tunable without code changes.

- **Dashboard Phase 5 (InterviewScreen / ProfileScreen / ArchivedScreen redesign):** All three screens ported to the `C.*` dashboard token set and `.mn-interview-*`, `.mn-profile-*`, `.mn-archived-*` CSS class library. ProfileScreen inert controls (personality/language chips, morning-brief/AI-nudges toggles) commented out with TODO notes — not wired, not shown. AI Nudges slot in HomeScreen marked as TODO (absent from render tree intentionally). Build verified clean.

- **Dashboard Phase 4 (UmbrellaDetail drill-down redesign):** Color-wash header (umbrella icon + name + computed score ring), hero 6-week trend card, sub-areas elevated cards, integrated sparklines + kebab menus on questions, bottom-sheet resolution creation (existing or new question, scale/boolean/boolean_partial, duration chips, auto-focus + improved placeholder in new-question mode), resolution detail sheet (progress ring, streak/longest/total stat tiles, abandon flow). Server error surfacing + payload logging added for diagnostics. All aligned to the new design system CSS class library.

- **Dashboard Phase 3 (chat panel redesign):** ChatScreen visually aligned to new design system. Warm cream bg, sage bubbles, textarea auto-grow, streaming cursor dot, empty state in Hebrew. Double-render bug fixed.

- **Dashboard Phases 1–2B (HomeScreen shell + real data):** HeroChart wired to real `/api/analytics/timeseries` endpoint (20 view combos). Gallery cards show real umbrellas with live scores + sparklines. MockData removed from HomeScreen.

- **Compute fixes #1–3:** Scheduler settings cached (1-hr TTL), 12 FK/filter indexes in migration 0013, analytics batch rewritten to 2-query pattern (eliminates N+1).

- **Migration workflow hardened:** every migration idempotent; build-time journal/SQL sync check added.

- **AI chat:** Nefesh sees real computed health scores (not legacy placeholder column).

---

## Pending / partial

- **Post-deploy verification (SMS hardening):** after Render redeploys, check startup logs — expect `[keepalive] last health ping Xm ago — keep-alive OK` (not `[KEEPALIVE WARNING]`), and confirm tonight's 22:00 check-in actually arrives.
- **Pre-existing broken test:** `webhook-routing.test.ts` › "inbound בוצע from user A marks only user A session as processed" fails on a clean DB at HEAD (user B's session row missing at assert time) — unrelated to the hardening changes, needs its own look.
- **Inert ProfileScreen controls:** personality/language chips + morning-brief/AI-nudges toggles still not wired (pending per-user settings work now that user_id exists in schema).
- **Minor debt:** stray `TODO/FIXME` comments to sweep. Optional.

---

## Open decisions / things to think about

- **First invited user.** Schema now supports multiple users. The flow (admin sends invite → invitee lands → onboarding) is built. Who's the first non-Dan user? Test the flow before inviting.
- **AI chat depth.** Nefesh currently has read-only context. The original master plan included Phase 2 — letting Nefesh actually *edit* data via tool use ("create a task", "add a question", "update a score"). Worth scoping that next.
- **Streaks / habits visualization.** Resolutions have progress bars and streak counts, but no chart yet. Heatmap or per-day grid would make it feel alive.
- **Notification model.** Right now: one SMS per night per user. Per-user phone numbers + settings are in schema. Worth wiring per-user scheduler correctly for multiple users.
- **Mobile polish.** Layout is functional but not pixel-tuned for small phones (the prototype was designed at 390×844; the live app uses those exact values inline). A responsive pass would help.

---

## Likely next steps (in priority order, my opinion)

1. **Chat tool use** — let Nefesh actually create tasks / update answers during chat. Biggest behavior upgrade still on the table.
3. **Resolution visualization** — heatmap/streak grid. Makes habit-tracking feel real.
4. **Raise spend caps once traffic warrants** — defaults are conservative ($5/day API, 50 SMS/day); tune via env vars when invited users are active.

---

## Known caveats / gotchas

- **Spend caps are conservative by design** — `DAILY_API_BUDGET_USD=5` and `DAILY_SMS_LIMIT=50` are intentionally low. Raise via env vars on Render when traffic warrants. Chat rate limit (5 msg/hr) is an in-memory constant in `chat.ts`.
- **Token pricing must be maintained manually** — `server/src/lib/pricing.ts` hardcodes claude-sonnet-4-6 rates. If the model or pricing changes, update that file.
- **Render free tier sleeps after 15 min idle** — cron-job.org ping every 10 min keeps it warm so the scheduler actually fires. This dependency caused the Jul 5–14 silent SMS outage when the job auto-deactivated; the `system_health` watchdog now shouts at startup if the ping goes stale. Permanent fix would be a paid Render instance. Enable cron-job.org failure notifications.
- **Twilio SMS** — paid (~$3/mo). Real number, no more sandbox. Webhook signature-verified.
- **Multi-tenant** — schema has userId on all tables. Auth via `allowed_emails` table (admin-managed). Dan is always `00000000-0000-0000-0000-000000000001`.
- **Hebrew + RTL** — all UI strings are Hebrew, layout direction RTL. English fallback would need an i18n library if ever needed.
- **The dispatch ↔ desktop bridge** intermittently hangs shell commands, breaking automated commit/push from code tasks. Manual git via PowerShell always works as a fallback.

---

## Live URLs

- App: https://mynefesh-danbenhurs-projects.vercel.app
- Backend: https://mynefesh.onrender.com
- Health: https://mynefesh.onrender.com/api/health
- Repo: https://github.com/danbenhur/mynefesh

---

## How to use this doc

Attach this file (and CLAUDE.md for technical depth) to any new Claude conversation when you want strategic brainstorming about myNefesh. The conversation will be fully briefed from the first message.

**Maintenance rule:** Update this doc whenever the Current Focus or Pending changes — same standing-rule cadence as CLAUDE.md. Stale STATUS.md is worse than no STATUS.md.
