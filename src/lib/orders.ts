import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { commissionLedger, orders, plans, tenants } from "@/db/schema";
import { getWholesaleProvider } from "./wholesale";

/**
 * Commission rates by tenant tier. Q4 (flat 15% vs tiered 10/20) is
 * undecided — PROVISIONAL: every tier accrues flat 15% for now. The
 * ledger stores the rate per row, so a later change never rewrites history.
 */
const COMMISSION_RATES: Record<string, number> = {
  standard: 0.15,
};

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
      const rate =
        COMMISSION_RATES[tenant.commissionTier] ?? COMMISSION_RATES.standard;
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
