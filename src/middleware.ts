import { NextRequest, NextResponse } from "next/server";

/**
 * Storefront resolution (SPEC §2): joe.simkal.co.il → tenant slug "joe".
 * Dev override: ?tenant=joe on any URL (persisted via cookie so the
 * whole funnel — including form posts — stays attributed).
 * The result is stamped on the request as x-tenant-slug; pages read it
 * through getCurrentTenant(). Main site (www / apex / localhost) → none.
 */

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "simkal.co.il";
const RESERVED_SUBDOMAINS = new Set(["www", "app", "admin", "api"]);
const TENANT_COOKIE = "dev_tenant";

function slugFromHost(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  if (!hostname.endsWith(`.${BASE_DOMAIN}`)) return null;
  const sub = hostname.slice(0, -(BASE_DOMAIN.length + 1));
  if (!sub || sub.includes(".") || RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const queryTenant = url.searchParams.get("tenant");
  const cookieTenant = request.cookies.get(TENANT_COOKIE)?.value ?? null;
  const hostTenant = slugFromHost(request.headers.get("host"));

  // precedence: explicit ?tenant= (incl. ?tenant= empty to clear) > subdomain > dev cookie
  let slug: string | null;
  if (queryTenant !== null) slug = queryTenant || null;
  else slug = hostTenant ?? cookieTenant;

  const requestHeaders = new Headers(request.headers);
  if (slug) requestHeaders.set("x-tenant-slug", slug);
  else requestHeaders.delete("x-tenant-slug");

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // keep the dev override sticky across navigation/POSTs
  if (queryTenant !== null) {
    if (queryTenant) response.cookies.set(TENANT_COOKIE, queryTenant, { path: "/" });
    else response.cookies.delete(TENANT_COOKIE);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:png|jpg|svg|ico|css|js)$).*)"],
};
