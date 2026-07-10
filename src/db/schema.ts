import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Agent storefronts. Each row is one co-branded subdomain skin
 * ("Joe eSIM" at joe.BRAND.co.il). The main site is NOT a tenant row —
 * orders placed on the main site have tenant_id = null.
 */
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(), // subdomain: joe.BRAND.co.il
    displayName: text("display_name").notNull(), // "Joe eSIM"
    photoUrl: text("photo_url"),
    accentColor: text("accent_color").notNull().default("#0EA5E9"),
    agentWhatsapp: text("agent_whatsapp"),
    // Q4 pending (flat 15% vs tiered 10/20). Tier is stored per tenant so
    // either outcome plugs in without a schema change.
    commissionTier: text("commission_tier").notNull().default("standard"),
    status: text("status").notNull().default("pending"), // pending | active | suspended
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("tenants_slug_idx").on(t.slug)],
);

/**
 * Catalog synced from the wholesale provider (mock provider until Q1 is
 * decided). Retail prices are computed on sync from markup_rules + FX
 * settings and stored here so the storefront never does pricing math.
 */
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: text("provider_id").notNull(), // 'mock' for now; 'yesim' / 'esimaccess' / ... later
    providerPlanId: text("provider_plan_id").notNull(), // plan id in the provider's system
    destination: text("destination").notNull(), // English, e.g. "Europe"
    destinationHe: text("destination_he").notNull(), // Hebrew, e.g. "אירופה"
    region: text("region").notNull(), // markup-rule key: europe | usa | asia | middle_east
    countryCodes: jsonb("country_codes").$type<string[]>().notNull().default([]),
    dataAmountMb: integer("data_amount_mb"), // null = unlimited
    validityDays: integer("validity_days").notNull(),
    wholesaleUsd: numeric("wholesale_usd", { precision: 10, scale: 2 }).notNull(),
    retailIls: numeric("retail_ils", { precision: 10, scale: 2 }).notNull(),
    active: boolean("active").notNull().default(true),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("plans_provider_plan_idx").on(t.providerId, t.providerPlanId),
    index("plans_region_idx").on(t.region),
    index("plans_active_idx").on(t.active),
  ],
);

/**
 * Orders. Lifecycle: pending → paid → provisioning → delivered,
 * with failed / refunded as terminal failure states.
 * Attribution: tenant_id is set from the subdomain the order was placed on.
 */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "set null",
    }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone").notNull(), // primary key for support lookup
    amountIls: numeric("amount_ils", { precision: 10, scale: 2 }).notNull(),
    wholesaleUsd: numeric("wholesale_usd", { precision: 10, scale: 2 }).notNull(),
    status: text("status").notNull().default("pending"),
    // pending | paid | provisioning | delivered | failed | refunded
    provisionAttempts: integer("provision_attempts").notNull().default(0),
    // Whatever the wholesale provider returns for the eSIM:
    // activation code, SM-DP+ address, QR payload/url — provider-shaped.
    esim: jsonb("esim").$type<Record<string, unknown>>(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("orders_tenant_idx").on(t.tenantId),
    index("orders_plan_idx").on(t.planId),
    index("orders_phone_idx").on(t.customerPhone),
    index("orders_status_idx").on(t.status),
  ],
);

/**
 * Commission ledger — one row per attributed order. Statements aggregate
 * this monthly per tenant. Payout is manual at first (Dan, Bit/bank).
 */
export const commissionLedger = pgTable(
  "commission_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    rate: numeric("rate", { precision: 5, scale: 4 }).notNull(), // e.g. 0.1500
    amountIls: numeric("amount_ils", { precision: 10, scale: 2 }).notNull(),
    status: text("status").notNull().default("accrued"), // accrued | paid | reversed
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("commission_tenant_idx").on(t.tenantId),
    uniqueIndex("commission_order_idx").on(t.orderId),
  ],
);

/**
 * Retail price = wholesale USD × multiplier (per region) × USD→ILS rate
 * × (1 + fx buffer). Configurable table, not hardcoded (SPEC §3).
 */
export const markupRules = pgTable(
  "markup_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    region: text("region").notNull(), // europe | usa | asia | middle_east | default
    multiplier: numeric("multiplier", { precision: 5, scale: 2 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("markup_region_idx").on(t.region)],
);

/**
 * Small key-value config: USD→ILS rate, fx buffer, auto-refund threshold…
 * Anything Dan may tune without a deploy.
 */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type CommissionRow = typeof commissionLedger.$inferSelect;
export type MarkupRule = typeof markupRules.$inferSelect;
