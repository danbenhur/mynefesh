"use client";

import { useActionState } from "react";
import type { CheckoutFormState } from "./actions";

export function CheckoutForm({
  action,
  priceLabel,
}: {
  action: (
    prev: CheckoutFormState,
    formData: FormData,
  ) => Promise<CheckoutFormState>;
  priceLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
  });

  return (
    <form action={formAction} className="checkout-form">
      <label>
        שם מלא
        <input name="name" type="text" autoComplete="name" required />
      </label>
      <label>
        טלפון נייד
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="0501234567"
          autoComplete="tel"
          dir="ltr"
          required
        />
      </label>
      <label>
        אימייל (לקבלת ה־QR)
        <input
          name="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          required
        />
      </label>

      {state.error && <p className="form-error">{state.error}</p>}

      <button className="buy-button" type="submit" disabled={pending}>
        {pending ? "מבצע הזמנה…" : `תשלום דמה — ${priceLabel}`}
      </button>
      <p className="fine-print">
        גרסת פיתוח: אין חיוב אמיתי. תשלום אמיתי (כרטיס / Bit) יחובר בהמשך.
      </p>
    </form>
  );
}
