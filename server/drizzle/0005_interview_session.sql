CREATE TABLE IF NOT EXISTS "interview_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"current_index" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "interview_session_date_unique" UNIQUE("date")
);
