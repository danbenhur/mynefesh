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

**Dashboard redesign — Phase 4 shipped.** UmbrellaDetail drill-down fully redesigned: color-wash header, hero 6-week trend card, integrated question sparklines, bottom-sheet resolution creation/detail flow. Phase 5+ (InterviewScreen, ProfileScreen visual alignment) is next.

---

## Recently shipped (last ~2 weeks)

- **Spend protection (migration 0014):** Hard ceilings on all billable surfaces before opening app to invited users. Per-user sliding-window chat rate limit (5 msg/hr, in-memory). Daily Anthropic API budget cap (`DAILY_API_BUDGET_USD`, default $5). Daily SMS cap (`DAILY_SMS_LIMIT`, default 50). New `api_usage` table logs both surfaces with `day_utc` index. `pricing.ts` codifies claude-sonnet-4-6 rates. Both caps return Hebrew 429 errors. Limits are env-var tunable without code changes.

- **Dashboard Phase 4 (UmbrellaDetail drill-down redesign):** Color-wash header (umbrella icon + name + computed score ring), hero 6-week trend card, sub-areas elevated cards, integrated sparklines + kebab menus on questions, bottom-sheet resolution creation (existing or new question, scale/boolean/boolean_partial, duration chips, auto-focus + improved placeholder in new-question mode), resolution detail sheet (progress ring, streak/longest/total stat tiles, abandon flow). Server error surfacing + payload logging added for diagnostics. All aligned to the new design system CSS class library.

- **Dashboard Phase 3 (chat panel redesign):** ChatScreen visually aligned to new design system. Warm cream bg, sage bubbles, textarea auto-grow, streaming cursor dot, empty state in Hebrew. Double-render bug fixed.

- **Dashboard Phases 1–2B (HomeScreen shell + real data):** HeroChart wired to real `/api/analytics/timeseries` endpoint (20 view combos). Gallery cards show real umbrellas with live scores + sparklines. MockData removed from HomeScreen.

- **Compute fixes #1–3:** Scheduler settings cached (1-hr TTL), 12 FK/filter indexes in migration 0013, analytics batch rewritten to 2-query pattern (eliminates N+1).

- **Migration workflow hardened:** every migration idempotent; build-time journal/SQL sync check added.

- **AI chat:** Nefesh sees real computed health scores (not legacy placeholder column).

---

## Pending / partial

- **Dashboard Phases 5–6:** InterviewScreen, ProfileScreen visual alignment with the new design system.
- **Minor debt:** stray `TODO/FIXME` comments to sweep. Optional.

---

## Open decisions / things to think about

- **AI chat depth.** Nefesh currently has read-only context. The original master plan included Phase 2 — letting Nefesh actually *edit* data via tool use ("create a task", "add a question", "update a score"). Worth scoping that next.
- **Streaks / habits visualization.** Resolutions have progress bars and streak counts, but no chart yet. Heatmap or per-day grid would make it feel alive.
- **Notification model.** Right now: one SMS per night. No morning brief, no proactive nudges (those UI toggles exist but aren't wired). Worth deciding which to implement next.
- **Multi-user, ever?** Currently single-user, hardcoded allowlist by Gmail. App is structurally single-user. If anyone else might use it, that's a non-trivial rebuild — better to decide now than later.
- **Mobile polish.** Layout is functional but not pixel-tuned for small phones (the prototype was designed at 390×844; the live app uses those exact values inline). A responsive pass would help.

---

## Likely next steps (in priority order, my opinion)

1. **Dashboard Phases 5–6** — InterviewScreen + ProfileScreen visual alignment with the new design system. Logical next in the series.
2. **Chat tool use** — let Nefesh actually create tasks / update answers during chat. Biggest behavior upgrade still on the table.
3. **Resolution visualization** — heatmap/streak grid. Makes habit-tracking feel real.
4. **Raise spend caps once traffic warrants** — defaults are conservative ($5/day API, 50 SMS/day); tune via env vars when invited users are active.

---

## Known caveats / gotchas

- **Spend caps are conservative by design** — `DAILY_API_BUDGET_USD=5` and `DAILY_SMS_LIMIT=50` are intentionally low. Raise via env vars on Render when traffic warrants. Chat rate limit (5 msg/hr) is an in-memory constant in `chat.ts`.
- **Token pricing must be maintained manually** — `server/src/lib/pricing.ts` hardcodes claude-sonnet-4-6 rates. If the model or pricing changes, update that file.
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
