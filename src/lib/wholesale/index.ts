import { MockWholesaleProvider } from "./mock-provider";
import type { WholesaleProvider } from "./types";

export * from "./types";

/**
 * Single place that decides which wholesale provider the app uses.
 * When Q1 is decided, add the real adapter here and switch on
 * WHOLESALE_PROVIDER env var. Everything else stays untouched.
 */
export function getWholesaleProvider(): WholesaleProvider {
  return new MockWholesaleProvider();
}
