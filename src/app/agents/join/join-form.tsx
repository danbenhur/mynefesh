"use client";

import { useActionState } from "react";
import { joinAction, type JoinFormState } from "./actions";

const initial: JoinFormState = { ok: false, error: null };

export function JoinForm() {
  const [state, formAction, pending] = useActionState(joinAction, initial);

  if (state.ok) {
    return (
      <div className="join-success">
        <h2>🎉 הבקשה התקבלה!</h2>
        <p>
          החנות שלך —{" "}
          <strong dir="ltr">{state.slug}.simkal.co.il</strong> — תאושר בקרוב.
          נעדכן אותך בוואטסאפ ברגע שהיא באוויר.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="checkout-form">
      <label>
        שם החנות שלך
        <input
          name="displayName"
          type="text"
          placeholder="למשל: יוסי eSIM"
          required
        />
      </label>
      <label>
        כתובת החנות (באנגלית)
        <div className="slug-row" dir="ltr">
          <input
            name="slug"
            type="text"
            placeholder="yossi"
            pattern="[a-zA-Z0-9-]{3,30}"
            required
          />
          <span className="slug-suffix">.simkal.co.il</span>
        </div>
      </label>
      <label>
        וואטסאפ (לעדכונים ודוחות עמלה)
        <input
          name="whatsapp"
          type="tel"
          inputMode="tel"
          placeholder="0501234567"
          dir="ltr"
          required
        />
      </label>
      <label>
        צבע החנות
        <input name="accentColor" type="color" defaultValue="#0EA5E9" />
      </label>

      {state.error && <p className="form-error">{state.error}</p>}

      <button className="buy-button" type="submit" disabled={pending}>
        {pending ? "שולח…" : "פתחו לי חנות 🚀"}
      </button>
      <p className="fine-print">
        ללא עלות. על כל מכירה בחנות שלך — עמלה. אישור תוך יום עסקים.
      </p>
    </form>
  );
}
