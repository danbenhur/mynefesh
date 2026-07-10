import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tenants, type Tenant } from "@/db/schema";

/**
 * The middleware (src/middleware.ts) resolves which storefront is being
 * visited — agent subdomain (joe.simkal.co.il) or ?tenant= dev override —
 * and stamps it on the request as x-tenant-slug. No header → main site.
 * Only `active` tenants get a skin; pending/suspended fall back to main.
 */
export async function getCurrentTenant(): Promise<Tenant | null> {
  const h = await headers();
  const slug = h.get("x-tenant-slug");
  if (!slug) return null;

  const db = await getDb();
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.slug, slug), eq(tenants.status, "active")));
  return tenant ?? null;
}
