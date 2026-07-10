"use server";

import { redirect } from "next/navigation";
import { placeOrder } from "@/lib/orders";

export interface CheckoutFormState {
  error: string | null;
}

export async function checkoutAction(
  planId: string,
  tenantId: string | null,
  _prev: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!name) return { error: "צריך שם — כדי שנדע למי שייך ה־eSIM." };
  if (!/^0\d{8,9}$/.test(phone.replace(/[-\s]/g, "")))
    return { error: "מספר הטלפון לא נראה תקין (למשל: 0501234567)." };
  if (!/^\S+@\S+\.\S+$/.test(email))
    return { error: "כתובת המייל לא נראית תקינה." };

  let orderId: string;
  try {
    orderId = await placeOrder({
      planId,
      tenantId,
      customerName: name,
      customerPhone: phone.replace(/[-\s]/g, ""),
      customerEmail: email,
    });
  } catch {
    return { error: "משהו השתבש בהזמנה. נסו שוב עוד רגע." };
  }
  redirect(`/order/${orderId}`);
}
