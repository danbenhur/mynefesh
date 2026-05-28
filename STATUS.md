# myNefesh — STATUS

*Strategic briefing. Pair with CLAUDE.md (technical reference). Attach both to any brainstorming chat to get instantly up to speed.*

---

## One-line state

A personal life-management web app for Dan: nightly SMS check-in → in-app interview → data → visualizations. Live in production. Real users (him). Hardened security pass just shipped.

---

## Architecture in a paragraph

React + Vite + TypeScript client on **Vercel** (`mynefesh.vercel.app` / `mynefesh-danbenhurs-projects.vercel.app`). Express + TypeScript + Drizzle ORM server on **Render** (`mynefesh.onrender.com`). Postgres on **Neon**. Auth via **Google OAuth** (gated to Dan's Gmail). Nightly **SMS** via paid **Twilio** number `+19129147770` (no more sandbox). All Hebrew + RTL. Repo at `github.com/danbenhur/mynefesh`, single branch `master`, no `main`.

For schema/routes/file layout see CLAUDE.md.

---

## Current focus

Stability and polish. The major feature stack is built: persistence, auth, SMS, dynamic daily interview, recursive umbrellas, resolutions, analytics. Recent work has been closing security/correctness gaps from a formal code review.

---

## Recently shipped (last ~2 weeks)

- **Auth:** GitHub OAuth → replaced with Google OAuth; sessions on Postgres so logins survive redeploys.
- **SMS:** swapped Twilio WhatsApp sandbox (constant 72h expiration headaches) for a paid SMS number; webhook now signature-verified so check-ins can't be faked.
- **Interview engine:** dynamic daily composer pulls today's questions from all umbrellas (daily/weekly/monthly/annual cadences); answers stored with normalized values; in-app sequential question UI; after-midnight grace window so a 00:30 check-in counts for yesterday.
- **Resolutions:** time-bound commitments tied to a question (e.g. "brush teeth nightly for 3 months"). Auto-completes at deadline. Track progress %, streak. Active + past visible per umbrella.
- **Umbrellas:** recursive hierarchy (any umbrella can have children, drilldown). Archive + restore. Delete with confirmation. Header kebab menu (⋮) for rename / change icon / move under parent / archive / delete.
- **UX cleanup:** all hardcoded prototype data stripped; full Hebrew + RTL; mobile color-scheme fixed.
- **Branch consolidation:** one branch (`master`), one push, no more drift between main/master.
- **Migration workflow hardened:** every migration idempotent; build-time check fails the build if `_journal.json` and `.sql` files ever desync. The recurring nightmare is closed.
- **AI chat:** Nefesh now sees real computed health scores derived from actual interview answers (was reading legacy placeholder column).
- **Compute fix #1 (scheduler):** `user_settings` cached in process memory (1-hour TTL) + each tick short-circuits on in-memory time checks before touching Neon. Reduces idle DB hits from ~250k/month to near-zero. `invalidateSettingsCache()` called on PATCH /settings so changes take effect immediately.
- **Compute fix #2 (indexes):** Migration 0013 adds 12 indexes on all FK columns (`umbrella_id`, `question_id`, `parent_id`) and frequently-filtered columns (`status`, `end_date`, `interview_date`, `archived_at`). Eliminates sequential scans on every join/filter query. Schema.ts updated with matching Drizzle `index()` definitions.
- **Compute fix #3 (analytics batch):** `getAllUmbrellaHealthScores` rewritten to run 2 parallel queries (umbrella ID list + single GROUP BY aggregation) instead of N+1 per-umbrella queries. Zero-answer umbrellas now return explicit `null` rather than a missing map entry.

---

## Pending / partial

- **UmbrellaDetail.tsx refactor (#6 of code review):** 1,856-line component split into focused subcomponents under `client/src/components/umbrella/`. Code written, builds clean, but stuck uncommitted in a git worktree due to bridge flakiness. Pure refactor — zero behavior change.
- **Minor debt (#7-8):** stray `console.log`s, `TODO/FIXME` comments to sweep. Optional.

---

## Open decisions / things to think about

- **AI chat depth.** Nefesh currently has read-only context. The original master plan included Phase 2 — letting Nefesh actually *edit* data via tool use ("create a task", "add a question", "update a score"). Worth scoping that next.
- **Streaks / habits visualization.** Resolutions have progress bars and streak counts, but no chart yet. Heatmap or per-day grid would make it feel alive.
- **Notification model.** Right now: one SMS per night. No morning brief, no proactive nudges (those UI toggles exist but aren't wired). Worth deciding which to implement next.
- **Multi-user, ever?** Currently single-user, hardcoded allowlist by Gmail. App is structurally single-user. If anyone else might use it, that's a non-trivial rebuild — better to decide now than later.
- **Mobile polish.** Layout is functional but not pixel-tuned for small phones (the prototype was designed at 390×844; the live app uses those exact values inline). A responsive pass would help.

---

## Likely next steps (in priority order, my opinion)

1. Finish committing the UmbrellaDetail split (#6) once the bridge cooperates.
2. **Chat tool use** — Phase 2 of the chat plan. Nefesh becomes able to actually *do* things, not just discuss. Biggest behavior upgrade still on the table.
3. **Resolution visualization** — heatmap/streak grid. Makes the habit-tracking feel real.
4. **Mobile responsive pass** — fix the fixed-pixel layout.

---

## Known caveats / gotchas

- **Render free tier sleeps after 15 min idle** — cron-job.org ping every 10 min keeps it warm so the scheduler actually fires.
- **Twilio SMS** — paid (~$3/mo). Real number, no more sandbox. Webhook signature-verified.
- **Single user** — schema has no userId column; auth is allowlist-by-email. Adding users later = real refactor.
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
