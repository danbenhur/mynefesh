import type {
  EsimStatus,
  ProvisionedEsim,
  WholesalePlan,
  WholesaleProvider,
} from "./types";

/**
 * Mock wholesale provider — stands in until Q1 (real provider) is decided.
 * Catalog covers the featured destinations for the IL market (SPEC §3).
 * Wholesale prices are PLACEHOLDERS in a realistic range, not real quotes.
 */

const EUROPE_CODES = ["FR", "DE", "IT", "ES", "NL", "GR", "PT", "AT", "CH", "GB", "CZ", "HU"];

const CATALOG: WholesalePlan[] = [
  // Europe (regional)
  { providerPlanId: "mock-eu-1gb-7d", destination: "Europe", destinationHe: "אירופה", region: "europe", countryCodes: EUROPE_CODES, dataAmountMb: 1024, validityDays: 7, wholesaleUsd: 2.4 },
  { providerPlanId: "mock-eu-3gb-15d", destination: "Europe", destinationHe: "אירופה", region: "europe", countryCodes: EUROPE_CODES, dataAmountMb: 3072, validityDays: 15, wholesaleUsd: 5.1 },
  { providerPlanId: "mock-eu-5gb-30d", destination: "Europe", destinationHe: "אירופה", region: "europe", countryCodes: EUROPE_CODES, dataAmountMb: 5120, validityDays: 30, wholesaleUsd: 7.9 },
  { providerPlanId: "mock-eu-10gb-30d", destination: "Europe", destinationHe: "אירופה", region: "europe", countryCodes: EUROPE_CODES, dataAmountMb: 10240, validityDays: 30, wholesaleUsd: 12.5 },
  // USA
  { providerPlanId: "mock-us-3gb-15d", destination: "USA", destinationHe: "ארצות הברית", region: "usa", countryCodes: ["US"], dataAmountMb: 3072, validityDays: 15, wholesaleUsd: 6.2 },
  { providerPlanId: "mock-us-5gb-30d", destination: "USA", destinationHe: "ארצות הברית", region: "usa", countryCodes: ["US"], dataAmountMb: 5120, validityDays: 30, wholesaleUsd: 9.4 },
  { providerPlanId: "mock-us-10gb-30d", destination: "USA", destinationHe: "ארצות הברית", region: "usa", countryCodes: ["US"], dataAmountMb: 10240, validityDays: 30, wholesaleUsd: 15.0 },
  // Thailand
  { providerPlanId: "mock-th-5gb-15d", destination: "Thailand", destinationHe: "תאילנד", region: "asia", countryCodes: ["TH"], dataAmountMb: 5120, validityDays: 15, wholesaleUsd: 4.3 },
  { providerPlanId: "mock-th-unl-15d", destination: "Thailand", destinationHe: "תאילנד", region: "asia", countryCodes: ["TH"], dataAmountMb: null, validityDays: 15, wholesaleUsd: 11.8 },
  // UAE
  { providerPlanId: "mock-ae-3gb-15d", destination: "UAE", destinationHe: "איחוד האמירויות", region: "middle_east", countryCodes: ["AE"], dataAmountMb: 3072, validityDays: 15, wholesaleUsd: 7.1 },
  // Greece
  { providerPlanId: "mock-gr-3gb-15d", destination: "Greece", destinationHe: "יוון", region: "europe", countryCodes: ["GR"], dataAmountMb: 3072, validityDays: 15, wholesaleUsd: 3.8 },
  // Cyprus
  { providerPlanId: "mock-cy-3gb-15d", destination: "Cyprus", destinationHe: "קפריסין", region: "europe", countryCodes: ["CY"], dataAmountMb: 3072, validityDays: 15, wholesaleUsd: 3.6 },
];

export class MockWholesaleProvider implements WholesaleProvider {
  readonly id = "mock";

  async listPlans(): Promise<WholesalePlan[]> {
    return CATALOG;
  }

  async provisionEsim(providerPlanId: string): Promise<ProvisionedEsim> {
    const plan = CATALOG.find((p) => p.providerPlanId === providerPlanId);
    if (!plan) throw new Error(`Unknown plan: ${providerPlanId}`);
    const suffix = Math.random().toString(36).slice(2, 10).toUpperCase();
    return {
      providerEsimId: `mock-esim-${suffix}`,
      activationCode: `LPA:1$mock-smdp.example.com$${suffix}`,
      smdpAddress: "mock-smdp.example.com",
      matchingId: suffix,
    };
  }

  async getEsimStatus(): Promise<EsimStatus> {
    return "not_installed";
  }
}
