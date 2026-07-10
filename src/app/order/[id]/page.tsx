import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { getDb } from "@/db";
import { orders, plans } from "@/db/schema";
import { formatData, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) notFound();
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, order.planId));

  const activationCode =
    order.esim && typeof order.esim.activationCode === "string"
      ? order.esim.activationCode
      : null;
  const qrSvg = activationCode
    ? await QRCode.toString(activationCode, {
        type: "svg",
        margin: 1,
        width: 220,
      })
    : null;

  return (
    <main>
      {order.status === "delivered" && qrSvg ? (
        <>
          <h1 className="page-title">🎉 ה־eSIM שלך מוכן!</h1>
          <p className="muted">
            {plan
              ? `eSIM ${plan.destinationHe} — ${formatData(plan.dataAmountMb)}, בתוקף ל־${plan.validityDays} ימים.`
              : null}{" "}
            שולם: {formatPrice(order.amountIls)}
          </p>

          <section className="qr-card">
            <div
              className="qr-svg"
              // QR generated server-side by the `qrcode` package from the
              // activation code — no external services involved.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="qr-code-text" dir="ltr">
              {activationCode}
            </p>
          </section>

          <section className="plan-how">
            <h2>מה עכשיו?</h2>
            <ol>
              <li>
                <strong>אייפון:</strong> הגדרות ← סלולרי ← הוספת eSIM ← סריקת
                הקוד למעלה.
              </li>
              <li>
                <strong>אנדרואיד:</strong> הגדרות ← רשת ואינטרנט ← SIM ← הוספת
                eSIM.
              </li>
              <li>משאירים את הקו כבוי עד הנחיתה — ואז מדליקים ומחוברים.</li>
            </ol>
          </section>

          <p className="fine-print">
            גרסת פיתוח: זהו QR הדגמה — הוא לא יתחבר לרשת אמיתית. שליחת הקוד
            למייל ולוואטסאפ תחובר בשלב הבא.
          </p>
        </>
      ) : order.status === "failed" ? (
        <>
          <h1 className="page-title">משהו השתבש בהנפקה 😕</h1>
          <p>
            לא הצלחנו להנפיק את ה־eSIM. לא נחייב אותך — ההזמנה סומנה לזיכוי
            מלא.
          </p>
        </>
      ) : (
        <>
          <h1 className="page-title">ההזמנה בטיפול…</h1>
          <p className="muted">סטטוס: {order.status}</p>
        </>
      )}

      <nav className="breadcrumb" style={{ marginTop: 24 }}>
        <Link href="/">← חזרה לחנות</Link>
      </nav>
    </main>
  );
}
