import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { plans } from "@/db/schema";
import { formatData, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getDb();
  const [plan] = await db.select().from(plans).where(eq(plans.id, id));
  if (!plan || !plan.active) notFound();

  return (
    <main>
      <nav className="breadcrumb">
        <Link href="/">← כל היעדים</Link>
      </nav>

      <section className="plan-hero">
        <h1>
          eSIM {plan.destinationHe} — {formatData(plan.dataAmountMb)}
        </h1>
        <div className="plan-hero-price">{formatPrice(plan.retailIls)}</div>
      </section>

      <section className="plan-facts">
        <div className="fact">
          <span className="fact-label">נפח גלישה</span>
          <span className="fact-value">{formatData(plan.dataAmountMb)}</span>
        </div>
        <div className="fact">
          <span className="fact-label">תוקף</span>
          <span className="fact-value">{plan.validityDays} ימים</span>
        </div>
        <div className="fact">
          <span className="fact-label">מדינות</span>
          <span className="fact-value">
            {plan.countryCodes.length > 1
              ? `${plan.countryCodes.length} מדינות`
              : plan.destinationHe}
          </span>
        </div>
      </section>

      <section className="plan-how">
        <h2>איך זה עובד?</h2>
        <ol>
          <li>קונים — התשלום מאובטח ולוקח דקה.</li>
          <li>מקבלים קוד QR מיד למסך, למייל ולוואטסאפ.</li>
          <li>סורקים את הקוד בהגדרות הטלפון — וזהו, יש אינטרנט בחו״ל.</li>
        </ol>
      </section>

      <Link className="buy-button" href={`/checkout/${plan.id}`}>
        לקנייה — {formatPrice(plan.retailIls)}
      </Link>
      <p className="fine-print">
        ההפעלה מתחילה רק כשמגיעים ליעד. ניתן להתקין מראש בבית.
      </p>
    </main>
  );
}
