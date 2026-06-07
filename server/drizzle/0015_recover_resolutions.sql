-- Recovery migration: ensure the resolutions table exists.
-- Root cause: migration 0012 may have been recorded as applied by the seeder
-- (which marks all journal entries as applied on a DB that has no migration-tracking
-- table) without the DDL ever running. Migration 0014 also includes an idempotent
-- CREATE TABLE IF NOT EXISTS resolutions, but it too may have been seeded away.
-- This migration re-creates the table and its constraints/indexes unconditionally.
-- All statements are idempotent — safe to run on a DB where the table already exists.

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

CREATE INDEX IF NOT EXISTS "idx_resolutions_umbrella_id" ON "resolutions" ("umbrella_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resolutions_question_id" ON "resolutions" ("question_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resolutions_active_due" ON "resolutions" ("status", "end_date");
