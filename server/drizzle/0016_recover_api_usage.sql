-- Recovery migration: ensure the api_usage table exists.
-- api_usage was introduced in migration 0014 and has no earlier fallback.
-- If 0014 was seeded (marked as applied without running), this table is absent
-- and spend-protection budget checks silently fail open.
-- All statements are idempotent.

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

CREATE INDEX IF NOT EXISTS "idx_api_usage_day_utc" ON "api_usage" ("day_utc");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_usage_kind_day" ON "api_usage" ("kind", "day_utc");
