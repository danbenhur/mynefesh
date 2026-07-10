import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { commissionLedger, orders, plans, tenants } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { loginAction, logoutAction, setTenantStatus } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "SimKal — Admin" };

function ils(n: number | string): string {
  return `₪${Number(n).toFixed(2)}`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;

  if (!(await isAdmin())) {
    return (
      <main dir="ltr" className="admin">
        <h1 className="page-title">Admin login</h1>
        <form action={loginAction} className="checkout-form">
          <label>
            Password
            <input name="password" type="password" required />
          </label>
          {err ? <p className="form-error">Wrong password.</p> : null}
          <button className="buy-button" type="submit">
            Sign in
          </button>
        </form>
      </main>
    );
  }

  const db = await getDb();
  const [allTenants, recentOrders, [stats], commissions] = await Promise.all([
    db.select().from(tenants).orderBy(desc(tenants.createdAt)),
    db
      .select({
        id: orders.id,
        status: orders.status,
        amountIls: orders.amountIls,
        customerPhone: orders.customerPhone,
        createdAt: orders.createdAt,
        destination: plans.destination,
        tenantId: orders.tenantId,
      })
      .from(orders)
      .leftJoin(plans, eq(orders.planId, plans.id))
      .orderBy(desc(orders.createdAt))
      .limit(25),
    db
      .select({
        count: sql<number>`count(*)`,
        revenue: sql<string>`coalesce(sum(${orders.amountIls}), 0)`,
      })
      .from(orders)
      .where(eq(orders.status, "delivered")),
    db
      .select({
        tenantId: commissionLedger.tenantId,
        total: sql<string>`coalesce(sum(${commissionLedger.amountIls}), 0)`,
      })
      .from(commissionLedger)
      .where(eq(commissionLedger.status, "accrued"))
      .groupBy(commissionLedger.tenantId),
  ]);

  const commissionByTenant = new Map(
    commissions.map((c) => [c.tenantId, c.total]),
  );
  const tenantName = new Map(allTenants.map((t) => [t.id, t.displayName]));

  return (
    <main dir="ltr" className="admin">
      <div className="admin-head">
        <h1 className="page-title">SimKal admin</h1>
        <form action={logoutAction}>
          <button className="link-button" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <section className="stat-row">
        <div className="stat">
          <span className="stat-value">{stats.count}</span>
          <span className="stat-label">delivered orders</span>
        </div>
        <div className="stat">
          <span className="stat-value">{ils(stats.revenue)}</span>
          <span className="stat-label">revenue</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {allTenants.filter((t) => t.status === "active").length}
          </span>
          <span className="stat-label">active agents</span>
        </div>
      </section>

      <h2 className="admin-h2">Agents</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Store</th>
              <th>Address</th>
              <th>Status</th>
              <th>Commission owed</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {allTenants.map((t) => (
              <tr key={t.id}>
                <td>{t.displayName}</td>
                <td dir="ltr">{t.slug}.simkal.co.il</td>
                <td>
                  <span className={`status-pill status-${t.status}`}>
                    {t.status}
                  </span>
                </td>
                <td>{ils(commissionByTenant.get(t.id) ?? 0)}</td>
                <td>
                  {t.status !== "active" ? (
                    <form
                      action={setTenantStatus.bind(null, t.id, "active")}
                      style={{ display: "inline" }}
                    >
                      <button className="mini-button approve" type="submit">
                        Approve
                      </button>
                    </form>
                  ) : (
                    <form
                      action={setTenantStatus.bind(null, t.id, "suspended")}
                      style={{ display: "inline" }}
                    >
                      <button className="mini-button suspend" type="submit">
                        Suspend
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="admin-h2">Recent orders</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Destination</th>
              <th>Amount</th>
              <th>Store</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((o) => (
              <tr key={o.id}>
                <td>{o.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td>{o.destination ?? "—"}</td>
                <td>{ils(o.amountIls)}</td>
                <td>{o.tenantId ? (tenantName.get(o.tenantId) ?? "?") : "Main site"}</td>
                <td>
                  <span className={`status-pill status-${o.status}`}>
                    {o.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
