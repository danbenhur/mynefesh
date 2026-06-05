-- Adds api_usage table for spend tracking (Anthropic + SMS).
-- All statements are idempotent; safe to re-run on existing databases.

DO $$ BEGIN
  ALTER TYPE "public"."answer_type" ADD VALUE 'multi_select';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "api_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "user_id" text,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "day_utc" date NOT NULL,
  "input_tokens" integer,
  "output_tokens" integer,
  "cost_usd" numeric(10, 4)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "interview_session" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "date" date NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "current_index" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "interview_session_date_unique" UNIQUE("date")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "resolutions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "umbrella_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "title" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "success_threshold" integer,
  "status" text DEFAULT 'active' NOT NULL,
  "final_score" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "question_answers" ADD COLUMN IF NOT EXISTS "answer_options" text[];
--> statement-breakpoint
ALTER TABLE "question_answers" ADD COLUMN IF NOT EXISTS "comment" text;
--> statement-breakpoint
ALTER TABLE "umbrella_questions" ADD COLUMN IF NOT EXISTS "options" jsonb;
--> statement-breakpoint
ALTER TABLE "umbrellas" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "shabbat_mode" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "saturday_checkin_time" text;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "last_sandbox_join_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "sandbox_status" text DEFAULT 'unknown' NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "last_delivery_failure_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "last_60h_reminder_at" timestamp with time zone;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_umbrella_id_umbrellas_id_fk"
    FOREIGN KEY ("umbrella_id") REFERENCES "public"."umbrellas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_question_id_umbrella_questions_id_fk"
    FOREIGN KEY ("question_id") REFERENCES "public"."umbrella_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_api_usage_day_utc" ON "api_usage" USING btree ("day_utc");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_usage_kind_day" ON "api_usage" USING btree ("kind","day_utc");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resolutions_umbrella_id" ON "resolutions" USING btree ("umbrella_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resolutions_question_id" ON "resolutions" USING btree ("question_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resolutions_active_due" ON "resolutions" USING btree ("status","end_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_health_history_umbrella_id" ON "health_history" USING btree ("umbrella_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_question_answers_question_id" ON "question_answers" USING btree ("question_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_question_answers_interview_date" ON "question_answers" USING btree ("interview_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reminders_umbrella_id" ON "reminders" USING btree ("umbrella_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_umbrella_id" ON "tasks" USING btree ("umbrella_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_umbrella_questions_umbrella_id" ON "umbrella_questions" USING btree ("umbrella_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_umbrellas_parent_id" ON "umbrellas" USING btree ("parent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_umbrellas_archived_at" ON "umbrellas" USING btree ("archived_at");
