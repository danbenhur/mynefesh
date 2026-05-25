DO $$ BEGIN CREATE TYPE "public"."answer_type" AS ENUM('text', 'scale'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."cadence" AS ENUM('daily', 'weekly', 'monthly', 'annual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "question_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"interview_date" date NOT NULL,
	"answer_text" text,
	"answer_scale" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "umbrella_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"umbrella_id" uuid NOT NULL,
	"text" text NOT NULL,
	"cadence" "cadence" NOT NULL,
	"day_of_week" integer,
	"day_of_month" integer,
	"month_of_year" integer,
	"answer_type" "answer_type" DEFAULT 'text' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_question_id_umbrella_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."umbrella_questions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "umbrella_questions" ADD CONSTRAINT "umbrella_questions_umbrella_id_umbrellas_id_fk" FOREIGN KEY ("umbrella_id") REFERENCES "public"."umbrellas"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
