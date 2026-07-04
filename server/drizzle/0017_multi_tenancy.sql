-- Multi-tenancy migration: add users table, backfill user_id on all data tables.
-- Drizzle wraps this file in its own transaction via migrate() — no explicit BEGIN/COMMIT.
-- All statements are idempotent: safe to re-run if migration state is lost.
-- Dan's UUID '00000000-0000-0000-0000-000000000001' is hardcoded and stable forever.

-- =====================================================================
-- 1. NEW TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id               text        UNIQUE,
  email                   text        UNIQUE NOT NULL,
  name                    text        NOT NULL DEFAULT '',
  picture                 text,
  onboarding_completed_at timestamptz,
  is_sandbox_user         boolean     NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS allowed_emails (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        UNIQUE NOT NULL,
  invited_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  notes       text,
  invited_at  timestamptz NOT NULL DEFAULT NOW(),
  revoked_at  timestamptz
);

-- =====================================================================
-- 2. SEED DAN'S DATA
-- =====================================================================

-- Dan's UUID is hardcoded so subsequent migrations and diagnostics can reference it.
-- google_id is NULL here; updated to real value on his first login post-migration.
-- is_sandbox_user = true because Dan uses Twilio sandbox; invitees use the paid number.
INSERT INTO users (id, google_id, email, name, picture, is_sandbox_user)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'dbh770@gmail.com',
  'Dan Ben Hur',
  NULL,
  true
) ON CONFLICT (email) DO UPDATE SET google_id = EXCLUDED.google_id;

INSERT INTO allowed_emails (email, invited_by, notes)
VALUES ('dbh770@gmail.com', NULL, 'Bootstrap admin')
ON CONFLICT (email) DO NOTHING;

-- =====================================================================
-- 3. ADD user_id TO ALL DATA TABLES (nullable → backfill → NOT NULL → FK)
-- =====================================================================

-- umbrellas
ALTER TABLE umbrellas ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE umbrellas SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
ALTER TABLE umbrellas ALTER COLUMN user_id SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_umbrellas_user_id') THEN
    ALTER TABLE umbrellas ADD CONSTRAINT fk_umbrellas_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_umbrellas_user_name') THEN
    ALTER TABLE umbrellas ADD CONSTRAINT uq_umbrellas_user_name UNIQUE (user_id, parent_id, name);
  END IF;
END $$;

-- tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE tasks SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_user_id') THEN
    ALTER TABLE tasks ADD CONSTRAINT fk_tasks_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- reminders
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE reminders SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
ALTER TABLE reminders ALTER COLUMN user_id SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_reminders_user_id') THEN
    ALTER TABLE reminders ADD CONSTRAINT fk_reminders_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- health_history
ALTER TABLE health_history ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE health_history SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
ALTER TABLE health_history ALTER COLUMN user_id SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_health_history_user_id') THEN
    ALTER TABLE health_history ADD CONSTRAINT fk_health_history_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- umbrella_questions
ALTER TABLE umbrella_questions ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE umbrella_questions SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
ALTER TABLE umbrella_questions ALTER COLUMN user_id SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_umbrella_questions_user_id') THEN
    ALTER TABLE umbrella_questions ADD CONSTRAINT fk_umbrella_questions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- question_answers
ALTER TABLE question_answers ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE question_answers SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
ALTER TABLE question_answers ALTER COLUMN user_id SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_question_answers_user_id') THEN
    ALTER TABLE question_answers ADD CONSTRAINT fk_question_answers_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- interview_session (composite unique replaces single-column unique)
ALTER TABLE interview_session ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE interview_session SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
ALTER TABLE interview_session ALTER COLUMN user_id SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_interview_session_user_id') THEN
    ALTER TABLE interview_session ADD CONSTRAINT fk_interview_session_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
ALTER TABLE interview_session DROP CONSTRAINT IF EXISTS interview_session_date_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_interview_session_user_date') THEN
    ALTER TABLE interview_session ADD CONSTRAINT uq_interview_session_user_date UNIQUE (user_id, date);
  END IF;
END $$;

-- whatsapp_session (composite unique replaces single-column unique)
ALTER TABLE whatsapp_session ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE whatsapp_session SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
ALTER TABLE whatsapp_session ALTER COLUMN user_id SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_whatsapp_session_user_id') THEN
    ALTER TABLE whatsapp_session ADD CONSTRAINT fk_whatsapp_session_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
ALTER TABLE whatsapp_session DROP CONSTRAINT IF EXISTS whatsapp_session_date_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_whatsapp_session_user_date') THEN
    ALTER TABLE whatsapp_session ADD CONSTRAINT uq_whatsapp_session_user_date UNIQUE (user_id, date);
  END IF;
END $$;

-- resolutions
ALTER TABLE resolutions ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE resolutions SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
ALTER TABLE resolutions ALTER COLUMN user_id SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_resolutions_user_id') THEN
    ALTER TABLE resolutions ADD CONSTRAINT fk_resolutions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE chat_messages SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
ALTER TABLE chat_messages ALTER COLUMN user_id SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_messages_user_id') THEN
    ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =====================================================================
-- 4. user_settings PK SWAP (most complex single operation — 6 steps)
-- =====================================================================

-- Step 4a: add user_id nullable
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS user_id uuid;
-- Step 4b: backfill (single existing row → Dan's UUID)
UPDATE user_settings SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
-- Step 4c: enforce NOT NULL
ALTER TABLE user_settings ALTER COLUMN user_id SET NOT NULL;
-- Step 4d: swap primary key (drop old, add new)
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_pkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_pkey') THEN
    ALTER TABLE user_settings ADD PRIMARY KEY (user_id);
  END IF;
END $$;
-- Step 4e: drop old id column
ALTER TABLE user_settings DROP COLUMN IF EXISTS id;
-- Step 4f: add FK to users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_settings_user_id') THEN
    ALTER TABLE user_settings ADD CONSTRAINT fk_user_settings_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =====================================================================
-- 5. api_usage: TRUNCATE + RETYPE user_id column
-- =====================================================================

-- Existing spend-log rows reference Google profile IDs (text), not our UUIDs.
-- Data is a few days old and has no business value — truncate rather than map.
TRUNCATE TABLE api_usage;
ALTER TABLE api_usage DROP COLUMN IF EXISTS user_id;
ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS user_id uuid;
-- ON DELETE SET NULL: preserve spend logs for accounting even if user is deleted
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_usage_user_id') THEN
    ALTER TABLE api_usage ADD CONSTRAINT fk_api_usage_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================================
-- 6. INDEXES (all guarded: seeder may skip DDL on existing DBs)
-- =====================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='users') THEN
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='allowed_emails') THEN
    CREATE INDEX IF NOT EXISTS idx_allowed_emails_email ON allowed_emails(email);
    CREATE INDEX IF NOT EXISTS idx_allowed_emails_revoked ON allowed_emails(revoked_at);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='umbrellas') THEN
    CREATE INDEX IF NOT EXISTS idx_umbrellas_user_id ON umbrellas(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='tasks') THEN
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='reminders') THEN
    CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='health_history') THEN
    CREATE INDEX IF NOT EXISTS idx_health_history_user_id ON health_history(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='umbrella_questions') THEN
    CREATE INDEX IF NOT EXISTS idx_umbrella_questions_user_id ON umbrella_questions(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='question_answers') THEN
    CREATE INDEX IF NOT EXISTS idx_question_answers_user_id ON question_answers(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='interview_session') THEN
    CREATE INDEX IF NOT EXISTS idx_interview_session_user_id ON interview_session(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='whatsapp_session') THEN
    CREATE INDEX IF NOT EXISTS idx_whatsapp_session_user_id ON whatsapp_session(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='resolutions') THEN
    CREATE INDEX IF NOT EXISTS idx_resolutions_user_id ON resolutions(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='chat_messages') THEN
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='api_usage') THEN
    CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='user_settings') THEN
    CREATE INDEX IF NOT EXISTS idx_user_settings_phone ON user_settings(phone_number);
  END IF;
END $$;

