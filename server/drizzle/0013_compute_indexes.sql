-- Compute fix 2: add indexes on FK and frequently-filtered columns
-- All statements are idempotent (CREATE INDEX IF NOT EXISTS)

CREATE INDEX IF NOT EXISTS "idx_umbrella_questions_umbrella_id" ON "umbrella_questions" ("umbrella_id");
CREATE INDEX IF NOT EXISTS "idx_question_answers_question_id" ON "question_answers" ("question_id");
CREATE INDEX IF NOT EXISTS "idx_question_answers_interview_date" ON "question_answers" ("interview_date");
CREATE INDEX IF NOT EXISTS "idx_tasks_umbrella_id" ON "tasks" ("umbrella_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks" ("status");
CREATE INDEX IF NOT EXISTS "idx_reminders_umbrella_id" ON "reminders" ("umbrella_id");
CREATE INDEX IF NOT EXISTS "idx_health_history_umbrella_id" ON "health_history" ("umbrella_id");
CREATE INDEX IF NOT EXISTS "idx_resolutions_umbrella_id" ON "resolutions" ("umbrella_id");
CREATE INDEX IF NOT EXISTS "idx_resolutions_question_id" ON "resolutions" ("question_id");
CREATE INDEX IF NOT EXISTS "idx_resolutions_active_due" ON "resolutions" ("status", "end_date");
CREATE INDEX IF NOT EXISTS "idx_umbrellas_parent_id" ON "umbrellas" ("parent_id");
CREATE INDEX IF NOT EXISTS "idx_umbrellas_archived_at" ON "umbrellas" ("archived_at");
