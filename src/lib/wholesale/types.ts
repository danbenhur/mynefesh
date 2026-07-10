/**
 * Provider-agnostic wholesale adapter interface.
 *
 * Q1 (which wholesale provider: Yesim / eSIM Access / Airalo Partners) is
 * still open. Everything upstream of this interface — catalog sync,
 * pricing, checkout, provisioning, delivery — is written against it, so
 * the real provider plugs in as one new file implementing WholesaleProvider.
 */

export interface WholesalePlan {
  /** Plan id in the provider's own system */
  providerPlanId: string;
  /** English destination label, e.g. "Europe", "Thailand" */
  destination: string;
  /** Hebrew destination label, e.g. "אירופה" */
  destinationHe: string;
  /** Markup-rule key: europe | usa | asia | middle_east */
  region: string;
  /** ISO country codes covered by the plan */
  countryCodes: string[];
  /** Data allowance in MB; null = unlimited */
  dataAmountMb: number | null;
  validityDays: number;
  /** Our wholesale cost in USD */
  wholesaleUsd: number;
}

export interface ProvisionedEsim {
  /** Provider's id for this eSIM instance (for status checks / top-ups) */
  providerEsimId: string;
  /** LPA activation string, e.g. "LPA:1$smdp.example.com$CODE" */
  activationCode: string;
  smdpAddress: string;
  matchingId: string;
  /** Optional ready-made QR image URL if the provider supplies one */
  qrUrl?: string;
}

export type EsimStatus = "installed" | "not_installed" | "active" | "expired";

export interface WholesaleProvider {
  /** Stable id stored on plans.provider_id, e.g. 'mock', 'yesim' */
  readonly id: string;
  /** Fetch the current sellable catalog */
  listPlans(): Promise<WholesalePlan[]>;
  /** Buy one eSIM for the given plan. Throws on failure (caller retries). */
  provisionEsim(providerPlanId: string): Promise<ProvisionedEsim>;
  /** Check activation status (drives the auto-refund "unactivated" rule) */
  getEsimStatus(providerEsimId: string): Promise<EsimStatus>;
}
