import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { commissionLedger, orders, plans, tenants, type Tenant } from "@/db/schema";
import { getWholesaleProvider } from "./wholesale";
import type { Db } from "@/db";

/**
 * Commission model (Q4, decided 2026-07-10 — DECISIONS D15):
 * - founding tier: permanent 20% (grandfathered pilot agents)
 * - standard tier: tiered 10/20 — 10% normally, 20% once the tenant hits
 *   30 delivered orders in the calendar month (from that order onward;
 *   the retroactive top-up for the month's earlier orders runs with the
 *   monthly statement job, still to be built).
 * The ledger stores the rate per row, so rule changes never rewrite history.
 */
const TIER_THRESHOLD_ORDERS = 30;

async function commissionRate(db: Db, tenant: Tenant): Promise<number> {
  if (tenant.commissionTier === "founding") return 0.2;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenant.id),
        eq(orders.status, "delivered"),
        gte(orders.createdAt, monthStart),
      ),
    );
  return Number(count) >= TIER_THRESHOLD_ORDERS ? 0.2 : 0.1;
}

export interface PlaceOrderInput {
  planId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  tenantId: string | null;
}

const PROVISION_MAX_ATTEMPTS = 3;

/**
 * Mock-payment order flow (B1): the order is created as already-paid —
 * a real payment provider (B3, post-Q3) will move creation to a webhook.
 * Provisioning runs inline with retries; failure marks the order
 * `failed` (auto-refund messaging lands in B4).
 */
export async function placeOrder(input: PlaceOrderInput): Promise<string> {
  const db = await getDb();

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, input.planId));
  if (!plan || !plan.active) throw new Error("Plan not found or inactive");

  const [order] = await db
    .insert(orders)
    .values({
      tenantId: input.tenantId,
      planId: plan.id,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      amountIls: plan.retailIls,
      wholesaleUsd: plan.wholesaleUsd,
      status: "paid",
    })
    .returning();

  const provider = getWholesaleProvider();
  let provisioned = false;
  for (let attempt = 1; attempt <= PROVISION_MAX_ATTEMPTS; attempt++) {
    try {
      await db
        .update(orders)
        .set({ status: "provisioning", provisionAttempts: attempt, updatedAt: new Date() })
        .where(eq(orders.id, order.id));
      const esim = await provider.provisionEsim(plan.providerPlanId);
      await db
        .update(orders)
        .set({
          status: "delivered",
          esim: esim as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));
      provisioned = true;
      break;
    } catch {
      // retry; final failure handled below
    }
  }

  if (!provisioned) {
    await db
      .update(orders)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(orders.id, order.id));
    return order.id;
  }

  if (input.tenantId) {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, input.tenantId));
    if (tenant && tenant.status === "active") {
      const rate = await commissionRate(db, tenant);
      await db
        .insert(commissionLedger)
        .values({
          tenantId: tenant.id,
          orderId: order.id,
          rate: rate.toFixed(4),
          amountIls: (Number(plan.retailIls) * rate).toFixed(2),
        })
        .onConflictDoNothing();
    }
  }

  return order.id;
}
