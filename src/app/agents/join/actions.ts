"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tenants } from "@/db/schema";

export interface JoinFormState {
  ok: boolean;
  error: string | null;
  slug?: string;
}

const RESERVED = new Set(["www", "app", "admin", "api", "simkal", "esim"]);
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export async function joinAction(
  _prev: JoinFormState,
  formData: FormData,
): Promise<JoinFormState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const accentColor = String(formData.get("accentColor") ?? "#0EA5E9");

  if (!displayName || displayName.length < 2)
    return { ok: false, error: "צריך שם לחנות — למשל: יוסי eSIM." };
  if (!SLUG_RE.test(slug) || RESERVED.has(slug))
    return {
      ok: false,
      error:
        "הכתובת יכולה להכיל רק אותיות באנגלית, מספרים ומקפים (3–30 תווים).",
    };
  if (!/^0\d{8,9}$/.test(whatsapp.replace(/[-\s]/g, "")))
    return { ok: false, error: "מספר הוואטסאפ לא נראה תקין (למשל: 0501234567)." };
  if (!/^#[0-9a-fA-F]{6}$/.test(accentColor))
    return { ok: false, error: "צבע לא תקין." };

  const db = await getDb();
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug));
  if (existing)
    return { ok: false, error: "הכתובת הזאת כבר תפוסה — נסו שם אחר." };

  await db.insert(tenants).values({
    slug,
    displayName,
    agentWhatsapp: whatsapp.replace(/[-\s]/g, ""),
    accentColor,
    status: "pending",
  });

  return { ok: true, error: null, slug };
}
