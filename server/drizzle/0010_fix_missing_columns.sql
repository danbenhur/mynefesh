-- Re-apply ADD COLUMN statements from 0009 that never landed.
-- ALTER TYPE ADD VALUE for 'multi_select' is handled separately in 0011
-- (outside a transaction) to avoid PG version compatibility issues.
-- All statements use IF NOT EXISTS so this is idempotent.

ALTER TABLE "umbrella_questions" ADD COLUMN IF NOT EXISTS "options" jsonb;

ALTER TABLE "question_answers" ADD COLUMN IF NOT EXISTS "answer_options" text[];
ALTER TABLE "question_answers" ADD COLUMN IF NOT EXISTS "comment" text;
