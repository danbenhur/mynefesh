ALTER TYPE "answer_type" ADD VALUE IF NOT EXISTS 'multi_select';

ALTER TABLE "umbrella_questions" ADD COLUMN "options" jsonb;

ALTER TABLE "question_answers" ADD COLUMN "answer_options" text[];
ALTER TABLE "question_answers" ADD COLUMN "comment" text;
