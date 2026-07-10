"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tenants } from "@/db/schema";
import { ADMIN_COOKIE, adminPassword, isAdmin } from "@/lib/admin-auth";

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  if (password !== adminPassword()) redirect("/admin?err=1");
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, password, {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
  });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/admin");
}

export async function setTenantStatus(
  tenantId: string,
  status: "active" | "suspended",
): Promise<void> {
  if (!(await isAdmin())) redirect("/admin");
  const db = await getDb();
  await db.update(tenants).set({ status }).where(eq(tenants.id, tenantId));
  revalidatePath("/admin");
}
