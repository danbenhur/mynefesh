CREATE TYPE "public"."answer_boolean_value" AS ENUM('yes', 'no', 'partial');--> statement-breakpoint
ALTER TYPE "public"."answer_type" ADD VALUE 'boolean';--> statement-breakpoint
ALTER TYPE "public"."answer_type" ADD VALUE 'boolean_partial';--> statement-breakpoint
ALTER TABLE "question_answers" ADD COLUMN "answer_boolean" "answer_boolean_value";--> statement-breakpoint
ALTER TABLE "question_answers" ADD COLUMN "answer_normalized" double precision;--> statement-breakpoint
ALTER TABLE "umbrella_questions" ADD COLUMN "scale_min" integer;--> statement-breakpoint
ALTER TABLE "umbrella_questions" ADD COLUMN "scale_max" integer;