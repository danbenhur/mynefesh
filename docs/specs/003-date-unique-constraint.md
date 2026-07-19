# Spec 003 — Legacy UNIQUE(date) constraints blocked multi-user (post-mortem)

**Status:** Fixed (migration 0020, July 2026). Never shipped to a second user — caught before trial invites.

## The bug

`whatsapp_session` and `interview_session` each carried **two** unique constraints:

- `uq_*_user_date` — `UNIQUE (user_id, date)` — the intended multi-tenant constraint, added by migration 0017.
- `*_date_unique` — `UNIQUE (date)` — the legacy single-user constraint from migrations 0001/0005, **still present**.

Migration 0017 (and its 0018 catch-all) tried to drop the legacy constraints — but under the wrong name:

```sql
ALTER TABLE whatsapp_session DROP CONSTRAINT IF EXISTS whatsapp_session_date_key;   -- no-op
-- actual name: whatsapp_session_date_unique (Drizzle's generated naming)
```

`IF EXISTS` — added everywhere for idempotency — turned the wrong name into a **silent** no-op instead of an error. The idempotency guard that protects migrations from re-runs also masked a typo'd constraint name.

## Impact (never reached users)

With `UNIQUE (date)` alive, only **one user per calendar day** could have a `whatsapp_session` or `interview_session` row:

- Second user's nightly `getOrCreateSession` INSERT → `23505` every minute, no SMS state tracking, no check-in.
- Second user's `GET /api/interview/today` → 500 on session creation. The interview screen would simply not load.

Dan being the only active user made it invisible in production. It would have broken the **first trial user on day one**.

## How it was caught

The integration test `webhook-routing.test.ts › inbound "בוצע" from user A marks only user A session as processed` had been failing "inexplicably" — user B's session row vanished. It was initially triaged as a broken test (pre-existing, failing at HEAD on a clean DB). Root-causing it revealed the insert of two same-day sessions was silently dropping B's row via `onConflictDoNothing()` against the legacy constraint.

**Lesson: a consistently failing test that "makes no sense" is evidence, not noise.** It was the only signal of a production-blocking schema bug, visible months before production could exhibit it.

## Fix

Migration `0020_drop_legacy_date_uniques.sql`: drop both constraints by their real names (idempotent). Verified on a clean DB: the full migration chain 0000→0020 leaves only the composite uniques, and the previously failing test passes.

## Prevention principles

- **After a migration that drops/renames constraints, assert the end state** — a query against `pg_constraint` in a test or startup probe, not faith in `DROP ... IF EXISTS`.
- **`IF EXISTS` hides typos.** When dropping something that MUST exist, verify it existed (query first or check the command tag) — idempotency and verification are separate concerns.
- **Constraint names come from the ORM's naming scheme, not intuition.** Check `pg_constraint` for actual names before writing a drop.
