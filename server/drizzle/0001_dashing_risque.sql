DO $$ BEGIN CREATE TYPE "public"."whatsapp_state" AS ENUM('pending', 'snoozed', 'completed', 'final_sent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checkin_time" text DEFAULT '21:00' NOT NULL,
	"phone_number" text,
	"timezone" text DEFAULT 'Asia/Jerusalem' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"state" "whatsapp_state" DEFAULT 'pending' NOT NULL,
	"snooze_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"next_send_at" timestamp with time zone,
	CONSTRAINT "whatsapp_session_date_unique" UNIQUE("date")
);
