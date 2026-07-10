import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { plans, type Plan } from "@/db/schema";

export const dynamic = "force-dynamic";

function formatData(mb: number | null): string {
  if (mb === null) return "ללא הגבלה";
  return mb >= 1024 ? `${Math.round(mb / 1024)}GB` : `${mb}MB`;
}

function formatPrice(ils: string): string {
  return `₪${Number(ils).toFixed(2).replace(/\.00$/, "")}`;
}

export default async function HomePage() {
  const db = await getDb();
  const activePlans = await db
    .select()
    .from(plans)
    .where(eq(plans.active, true))
    .orderBy(asc(plans.destinationHe), asc(plans.retailIls));

  const byDestination = new Map<string, Plan[]>();
  for (const p of activePlans) {
    const group = byDestination.get(p.destinationHe) ?? [];
    group.push(p);
    byDestination.set(p.destinationHe, group);
  }

  return (
    <main>
      <header className="site-header">
        <h1>סימקל SimKal 🌍</h1>
        <p>eSIM לחו״ל בקלות — סורקים QR ומתחברים.</p>
      </header>

      <div className="dev-banner">
        גרסת פיתוח — המחירים והחבילות הם נתוני דמה (ספק סיטונאי טרם נבחר).
      </div>

      {byDestination.size === 0 ? (
        <div className="empty-state">
          <p>הקטלוג ריק.</p>
          <p>
            להזנת נתוני דמה: <code>npm run db:seed</code>
          </p>
        </div>
      ) : (
        [...byDestination.entries()].map(([destination, group]) => (
          <section className="destination" key={destination}>
            <h2>{destination}</h2>
            {group.map((plan) => (
              <div className="plan-card" key={plan.id}>
                <div className="details">
                  <div className="data">{formatData(plan.dataAmountMb)}</div>
                  <div className="validity">
                    בתוקף ל־{plan.validityDays} ימים
                  </div>
                </div>
                <div className="price">{formatPrice(plan.retailIls)}</div>
              </div>
            ))}
          </section>
        ))
      )}
    </main>
  );
}
