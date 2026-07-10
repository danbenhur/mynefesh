import Link from "next/link";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "פתחו חנות eSIM משלכם — SimKal לסוכנים",
};

export default function AgentJoinPage() {
  return (
    <main>
      <nav className="breadcrumb">
        <Link href="/">← לחנות</Link>
      </nav>

      <h1 className="page-title">חנות eSIM על השם שלך</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        סוכני נסיעות: קבלו חנות משלכם — השם שלכם, הצבע שלכם, כתובת משלכם —
        ואנחנו מטפלים בכל השאר: תשלומים, הנפקה, תמיכה. אתם רק משתפים את
        הקישור ומרוויחים עמלה על כל מכירה.
      </p>

      <section className="plan-how">
        <h2>איך זה עובד?</h2>
        <ol>
          <li>ממלאים את הטופס (דקה).</li>
          <li>אנחנו מאשרים — והחנות שלכם באוויר.</li>
          <li>משתפים את הקישור עם לקוחות — ורואים עמלות בדוח חודשי.</li>
        </ol>
      </section>

      <JoinForm />
    </main>
  );
}
