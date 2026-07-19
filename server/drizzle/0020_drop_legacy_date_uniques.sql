-- Multi-user unblock (docs/specs/003-date-unique-constraint.md).
-- Migrations 0017/0018 meant to replace the single-column date uniques with
-- composite (user_id, date) uniques, but dropped the wrong constraint names
-- ("*_date_key" instead of Drizzle's actual "*_date_unique") — a silent no-op.
-- The legacy UNIQUE(date) constraints survived, limiting whatsapp_session and
-- interview_session to ONE user per calendar day. Drop them by their real names.
-- Idempotent: IF EXISTS makes re-runs safe.

ALTER TABLE whatsapp_session DROP CONSTRAINT IF EXISTS whatsapp_session_date_unique;
ALTER TABLE interview_session DROP CONSTRAINT IF EXISTS interview_session_date_unique;
