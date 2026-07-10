import { cookies } from "next/headers";

/**
 * Dev-grade gate: single shared password (ADMIN_PASSWORD env; local
 * fallback for dev). Proper auth is scheduled with B7 hardening —
 * do not expose an internet deployment without setting ADMIN_PASSWORD.
 */
export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "simkal-dev";
}

export const ADMIN_COOKIE = "simkal_admin";

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === adminPassword();
}
