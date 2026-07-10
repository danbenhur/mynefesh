CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"rate" numeric(5, 4) NOT NULL,
	"amount_ils" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'accrued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markup_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region" text NOT NULL,
	"multiplier" numeric(5, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"plan_id" uuid NOT NULL,
	"customer_name" text,
	"customer_email" text,
	"customer_phone" text NOT NULL,
	"amount_ils" numeric(10, 2) NOT NULL,
	"wholesale_usd" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provision_attempts" integer DEFAULT 0 NOT NULL,
	"esim" jsonb,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"provider_plan_id" text NOT NULL,
	"destination" text NOT NULL,
	"destination_he" text NOT NULL,
	"region" text NOT NULL,
	"country_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data_amount_mb" integer,
	"validity_days" integer NOT NULL,
	"wholesale_usd" numeric(10, 2) NOT NULL,
	"retail_ils" numeric(10, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"photo_url" text,
	"accent_color" text DEFAULT '#0EA5E9' NOT NULL,
	"agent_whatsapp" text,
	"commission_tier" text DEFAULT 'standard' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commission_tenant_idx" ON "commission_ledger" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_order_idx" ON "commission_ledger" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "markup_region_idx" ON "markup_rules" USING btree ("region");--> statement-breakpoint
CREATE INDEX "orders_tenant_idx" ON "orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "orders_plan_idx" ON "orders" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "orders_phone_idx" ON "orders" USING btree ("customer_phone");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_provider_plan_idx" ON "plans" USING btree ("provider_id","provider_plan_id");--> statement-breakpoint
CREATE INDEX "plans_region_idx" ON "plans" USING btree ("region");--> statement-breakpoint
CREATE INDEX "plans_active_idx" ON "plans" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");