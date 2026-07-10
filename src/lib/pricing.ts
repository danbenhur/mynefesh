import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { appSettings, markupRules } from "@/db/schema";

/**
 * Retail price formula (SPEC §3):
 *   retail ₪ = wholesale $ × region multiplier × USD→ILS rate × (1 + buffer)
 * rounded down to X.90 for a clean price tag.
 * Multipliers and FX live in the DB so Dan can tune them without a deploy.
 */

export interface PricingConfig {
  /** region → multiplier, must include a "default" entry */
  multipliers: Record<string, number>;
  usdIlsRate: number;
  fxBuffer: number; // e.g. 0.03 = 3% cushion on the FX rate
}

export async function loadPricingConfig(db: Db): Promise<PricingConfig> {
  const rules = await db.select().from(markupRules);
  const multipliers: Record<string, number> = {};
  for (const r of rules) multipliers[r.region] = Number(r.multiplier);

  const [rate] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "usd_ils_rate"));
  const [buffer] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "fx_buffer"));

  if (!multipliers.default || !rate) {
    throw new Error("Pricing config missing — run `npm run db:seed` first");
  }
  return {
    multipliers,
    usdIlsRate: Number(rate.value),
    fxBuffer: buffer ? Number(buffer.value) : 0,
  };
}

export function computeRetailIls(
  wholesaleUsd: number,
  region: string,
  config: PricingConfig,
): number {
  const multiplier = config.multipliers[region] ?? config.multipliers.default;
  const raw =
    wholesaleUsd * multiplier * config.usdIlsRate * (1 + config.fxBuffer);
  // price tag rounding: at least X.90, e.g. 33.17 → 33.90
  return Math.floor(raw) + 0.9;
}
