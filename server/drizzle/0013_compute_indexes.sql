-- Compute fix 2: add indexes on FK and frequently-filtered columns
-- All statements are idempotent (CREATE INDEX IF NOT EXISTS)
-- The resolutions indexes are guarded by a table-existence check: on a DB where
-- migration 0012 was seeded-without-running, the table doesn't exist yet and
-- will be created (with its indexes) by the later recovery migration 0014/0015.

CREATE INDEX IF NOT EXISTS "idx_umbrella_questions_umbrella_id" ON "umbrella_questions" ("umbrella_id");
CREATE INDEX IF NOT EXISTS "idx_question_answers_question_id" ON "question_answers" ("question_id");
CREATE INDEX IF NOT EXISTS "idx_question_answers_interview_date" ON "question_answers" ("interview_date");
CREATE INDEX IF NOT EXISTS "idx_tasks_umbrella_id" ON "tasks" ("umbrella_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks" ("status");
CREATE INDEX IF NOT EXISTS "idx_reminders_umbrella_id" ON "reminders" ("umbrella_id");
CREATE INDEX IF NOT EXISTS "idx_health_history_umbrella_id" ON "health_history" ("umbrella_id");
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'resolutions') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_resolutions_umbrella_id" ON "resolutions" ("umbrella_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_resolutions_question_id" ON "resolutions" ("question_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_resolutions_active_due" ON "resolutions" ("status", "end_date")';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "idx_umbrellas_parent_id" ON "umbrellas" ("parent_id");
CREATE INDEX IF NOT EXISTS "idx_umbrellas_archived_at" ON "umbrellas" ("archived_at");
