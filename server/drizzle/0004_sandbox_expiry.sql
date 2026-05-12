ALTER TABLE "user_settings" ADD COLUMN "last_sandbox_join_at" timestamp with time zone;
ALTER TABLE "user_settings" ADD COLUMN "sandbox_status" text NOT NULL DEFAULT 'unknown';
ALTER TABLE "user_settings" ADD COLUMN "last_delivery_failure_at" timestamp with time zone;
ALTER TABLE "user_settings" ADD COLUMN "last_60h_reminder_at" timestamp with time zone;
