-- July 2026 SMS-outage hardening (docs/specs/001-sms-outage.md).
-- 1. system_health: single-row table recording the last external keep-alive ping,
--    so startup can warn when the cron-job.org job dies again.
-- 2. Normalize legacy phone formats in user_settings to bare E.164 — the
--    scheduler now sends to this column, and only +E164 values are trusted.
-- All statements idempotent: safe to re-run if migration state is lost.

CREATE TABLE IF NOT EXISTS system_health (
  id           integer     PRIMARY KEY DEFAULT 1,
  last_ping_at timestamptz NOT NULL DEFAULT NOW()
);

-- Strip the legacy 'whatsapp:' channel prefix (old settings validation allowed it)
UPDATE user_settings
SET phone_number = regexp_replace(phone_number, '^whatsapp:', '', 'i')
WHERE phone_number ILIKE 'whatsapp:%';

-- Drop spaces, dashes, and parentheses
-- (POSIX class, not \s — Postgres does not support \s inside bracket expressions)
UPDATE user_settings
SET phone_number = regexp_replace(phone_number, '[[:space:]()-]', '', 'g')
WHERE phone_number ~ '[[:space:]()-]';

-- Convert Israeli local format (05xxxxxxxx) to E.164
UPDATE user_settings
SET phone_number = '+972' || substring(phone_number from 2)
WHERE phone_number ~ '^05[0-9]{8}$';
