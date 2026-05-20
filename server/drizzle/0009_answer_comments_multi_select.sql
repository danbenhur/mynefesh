ALTER TYPE "answer_type" ADD VALUE IF NOT EXISTS 'multi_select';

ALTER TABLE "umbrella_questions" ADD COLUMN IF NOT EXISTS "options" jsonb;

ALTER TABLE "question_answers" ADD COLUMN IF NOT EXISTS "answer_options" text[];
ALTER TABLE "question_answers" ADD COLUMN IF NOT EXISTS "comment" text;
