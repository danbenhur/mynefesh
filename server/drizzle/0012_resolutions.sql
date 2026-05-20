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
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "resolutions_umbrella_id_fk" FOREIGN KEY ("umbrella_id") REFERENCES "umbrellas"("id") ON DELETE CASCADE,
  CONSTRAINT "resolutions_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "umbrella_questions"("id") ON DELETE CASCADE
);
