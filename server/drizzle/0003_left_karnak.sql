DO $$ BEGIN CREATE TYPE "public"."answer_boolean_value" AS ENUM('yes', 'no', 'partial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
ALTER TYPE "public"."answer_type" ADD VALUE IF NOT EXISTS 'boolean';--> statement-breakpoint
ALTER TYPE "public"."answer_type" ADD VALUE IF NOT EXISTS 'boolean_partial';--> statement-breakpoint
ALTER TABLE "question_answers" ADD COLUMN IF NOT EXISTS "answer_boolean" "answer_boolean_value";--> statement-breakpoint
ALTER TABLE "question_answers" ADD COLUMN IF NOT EXISTS "answer_normalized" double precision;--> statement-breakpoint
ALTER TABLE "umbrella_questions" ADD COLUMN IF NOT EXISTS "scale_min" integer;--> statement-breakpoint
ALTER TABLE "umbrella_questions" ADD COLUMN IF NOT EXISTS "scale_max" integer;
