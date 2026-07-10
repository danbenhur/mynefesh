import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { plans } from "@/db/schema";
import { formatData, formatPrice } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";
import { checkoutAction } from "./actions";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getDb();
  const [plan] = await db.select().from(plans).where(eq(plans.id, id));
  if (!plan || !plan.active) notFound();

  // Attribution: orders placed on an agent storefront credit that agent.
  const tenant = await getCurrentTenant();
  const action = checkoutAction.bind(null, plan.id, tenant?.id ?? null);

  return (
    <main>
      <nav className="breadcrumb">
        <Link href={`/plan/${plan.id}`}>← חזרה לחבילה</Link>
      </nav>

      <h1 className="page-title">פרטים אחרונים ומקבלים QR</h1>

      <section className="order-summary">
        <div>
          <strong>
            eSIM {plan.destinationHe} — {formatData(plan.dataAmountMb)}
          </strong>
          <div className="muted">בתוקף ל־{plan.validityDays} ימים</div>
        </div>
        <div className="price">{formatPrice(plan.retailIls)}</div>
      </section>

      <CheckoutForm action={action} priceLabel={formatPrice(plan.retailIls)} />
    </main>
  );
}
