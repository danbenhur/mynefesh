# Incident 001 — Nightly SMS check-ins silently stopped (July 5–14, 2026)

**Status:** Resolved. Keep-alive re-enabled 2026-07-14; hardening shipped in this PR.
**Impact:** Zero nightly SMS check-ins sent for ~9 days. No interview prompts, no morning-skip reminders, no data collected. No error was ever logged, because the process wasn't running when it should have fired.

---

## Summary

The nightly check-in flow depends on an external keep-alive ping (cron-job.org → `GET /api/health` every 10 minutes) because Render's free tier spins the process down after ~15 minutes without inbound HTTP — internal `node-cron` timers do not keep it awake. On **June 30** the keep-alive job failed and auto-deactivated. From then on, the server was asleep at check-in time (22:00 Jerusalem) every night, so the scheduler tick never fired. Nothing crashed, nothing errored, nothing was logged — the failure mode was *absence of execution*.

The outage surfaced as "SMS stopped" around July 5 rather than July 1 because a separate problem masked the boundary: migration 0017 (multi-tenancy) had been failing since June 28, so Render kept serving the **old June 7 build** until the constraint fix (`756f8ff`, July 4) let the new code deploy. The investigation therefore initially focused on the multi-tenancy scheduler rewrite — which did contain real latent bugs (see below), but none of them was the trigger.

## Timeline

| Date | Event |
|---|---|
| Jun 28 | Multi-tenancy v2 (`e812ec7`) merged. Migration 0017 fails in prod (`UNIQUE (user_id, name)` rejected legit duplicate umbrella names); `process.exit(1)` on migration failure → every deploy fails → Render keeps the June 7 build live. SMS still works (old env-var-based send path). |
| Jun 30 | cron-job.org keep-alive job fails and **auto-deactivates**. Server now sleeps whenever HTTP traffic stops. Check-ins become dependent on Dan happening to have the app open at 22:00. |
| Jul 4 | `756f8ff` loosens the constraint to `(user_id, parent_id, name)`; migration applies; v2 code goes live. |
| Jul 5–13 | Zero `whatsapp_session` rows created. Server asleep at 22:00 nightly. No logs, no errors. |
| Jul 14 | Investigation. Neon query shows no session rows since Jul 5; cron-job.org dashboard shows the job deactivated since Jun 30. Keep-alive re-enabled and verified (200 OK). |

## Root cause

**Primary:** the scheduler's liveness silently depended on an unmonitored third-party cron ping. When that ping died, the failure was invisible from inside the system — the process that would have logged an error was the process that wasn't running.

**Why diagnosis was hard:**

1. **A masking failure shifted the apparent start date.** The migration crash-loop (Jun 28–Jul 4) pinned prod to the old build, so the outage began exactly when a large scheduler rewrite deployed — pointing every heuristic at the new code.
2. **A misleading diagnostic log.** `[scheduler-diag] … shabbat=true` printed the user's stored `shabbat_mode` *preference*, not the computed `inShabbatWindow()` state, which briefly suggested a "stuck Shabbat flag" on a Tuesday. (The window computation was verified correct: it hard-returns `false` on non-Fri/Sat days.)
3. **Real latent bugs in the new code** were plausible culprits: the send path switched from env-var destination to `user_settings.phone_number` with no format normalization (legacy `whatsapp:+972…` and local `05x…` values were historically accepted), and failures in `sendSMS` are swallowed (returns `null`, retries next minute).

**The decisive discriminator:** `SELECT date, state FROM whatsapp_session WHERE date >= '2026-07-05'` returned **zero rows**. Stuck `pending` rows would have meant Twilio rejections; `snoozed` rows would have meant accepted-but-undelivered sends; no rows at all meant the tick never ran — the server was asleep.

## Fix (this PR)

1. **Keep-alive watchdog** — new single-row `system_health` table (migration 0019). `GET /api/health` upserts `last_ping_at` (throttled to 1 write/min). On startup, `warnIfKeepaliveStale()` logs a loud `[KEEPALIVE WARNING]` if the last ping is missing or older than 1 hour — so the very first log line after any wake-up says the keep-alive is dead, instead of the system staying silent.
2. **Phone normalization at send time** — `normalizePhone()` in `lib/whatsapp.ts` strips the legacy `whatsapp:` prefix, converts Israeli local format (`05xxxxxxxx` → `+9725xxxxxxxx`), strips separators, and validates E.164. `sendSMS` then forces the destination channel to match the `from` channel (a `whatsapp:` sender gets a `whatsapp:` recipient; an SMS sender gets bare E.164). Invalid destinations are logged loudly and skipped instead of silently failing in Twilio.
3. **One-time data backfill** — migration 0019 normalizes existing `user_settings.phone_number` values to bare E.164 (idempotent `UPDATE`s).
4. **Honest diagnostics** — the tick log line now prints both `shabbatMode=` (stored preference) and `inShabbatWindow=` (live computed state) so they can never be conflated again.
5. **Cross-tenant fix** — the snoozed-session reset in `PATCH /api/settings` was missing a `user_id` filter and reset *every* user's session when any user changed their check-in time. Now scoped.
6. **Docs corrected** — CLAUDE.md env-var table now lists `TWILIO_SMS_FROM` / `USER_SMS_NUMBER` (the pair the code prefers); the onboarding section no longer claims `POST /api/onboarding/complete` creates the settings row (it's created at first login in the OAuth callback).

## Operational fix (already done, outside the repo)

- cron-job.org job re-enabled, pinging `https://mynefesh.onrender.com/api/health` every 10 minutes, verified 200 OK (2026-07-14).
- Recommended: enable cron-job.org's own failure notifications, and treat the job's "auto-deactivate on repeated failure" setting with suspicion — it's what turned one bad night into nine.

## Prevention principles

- **Every external dependency that gates a scheduled action needs an in-system freshness check.** The scheduler can't log its own absence; something that *does* run (startup, or any inbound request) must check the heartbeat.
- **Diagnostic logs must distinguish stored settings from computed state.** `shabbat=true` cost a full diagnostic round-trip.
- **When a send path changes its source of truth (env var → DB column), migrate and validate the data in the same change.** The phone-format bugs didn't cause this outage, but they were live ammunition waiting for the next one.
- **The permanent fix is off the free tier.** A paid Render instance (no spin-down) removes the keep-alive dependency entirely; the watchdog stays as defense in depth.
