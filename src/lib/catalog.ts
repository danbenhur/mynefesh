import { and, eq, notInArray } from "drizzle-orm";
import type { Db } from "@/db";
import { plans } from "@/db/schema";
import type { WholesaleProvider } from "./wholesale";
import { computeRetailIls, loadPricingConfig } from "./pricing";

/**
 * Pull the provider's catalog, price it in ₪, and upsert into `plans`.
 * Plans that disappeared from the provider are deactivated, not deleted
 * (orders reference them).
 */
export async function syncCatalog(
  db: Db,
  provider: WholesaleProvider,
): Promise<{ upserted: number; deactivated: number }> {
  const [wholesalePlans, pricing] = await Promise.all([
    provider.listPlans(),
    loadPricingConfig(db),
  ]);

  const seenIds: string[] = [];
  for (const wp of wholesalePlans) {
    seenIds.push(wp.providerPlanId);
    const retailIls = computeRetailIls(wp.wholesaleUsd, wp.region, pricing);
    await db
      .insert(plans)
      .values({
        providerId: provider.id,
        providerPlanId: wp.providerPlanId,
        destination: wp.destination,
        destinationHe: wp.destinationHe,
        region: wp.region,
        countryCodes: wp.countryCodes,
        dataAmountMb: wp.dataAmountMb,
        validityDays: wp.validityDays,
        wholesaleUsd: wp.wholesaleUsd.toFixed(2),
        retailIls: retailIls.toFixed(2),
        active: true,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [plans.providerId, plans.providerPlanId],
        set: {
          destination: wp.destination,
          destinationHe: wp.destinationHe,
          region: wp.region,
          countryCodes: wp.countryCodes,
          dataAmountMb: wp.dataAmountMb,
          validityDays: wp.validityDays,
          wholesaleUsd: wp.wholesaleUsd.toFixed(2),
          retailIls: retailIls.toFixed(2),
          active: true,
          syncedAt: new Date(),
        },
      });
  }

  const deactivated = await db
    .update(plans)
    .set({ active: false })
    .where(
      and(
        eq(plans.providerId, provider.id),
        notInArray(plans.providerPlanId, seenIds),
      ),
    )
    .returning({ id: plans.id });

  return { upserted: seenIds.length, deactivated: deactivated.length };
}
