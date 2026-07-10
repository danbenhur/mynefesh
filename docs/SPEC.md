# SPEC v0

Status: pre-implementation. Blocked items marked ⛔ (see Decision Queue in BACKLOG.md).

## 1. System overview
- **Storefront**: Next.js, Hebrew-first (RTL) + English. Multi-tenant via wildcard subdomain (`{agent}.BRAND.co.il`) + main site.
- **Backend**: single shared backend. Postgres. Order flow: checkout → payment webhook → provision eSIM via wholesale API → deliver QR (email + WhatsApp).
- **Wholesale provider**: ⛔ pending quotes (Yesim / eSIM Access / Airalo Partners).
- **Payments**: ⛔ pending decision (Meshulam / Grow / Tranzila vs Stripe; must support Israeli cards ₪ + Bit).
- **Support**: WhatsApp Business Cloud API (direct Meta, no BSP markup). Tier-1 bot = Claude API over SUPPORT-KB.md + order lookup tools. Tier-2 = human handoff.

## 2. Multi-tenancy (agent storefronts)
`tenants` table: `id, slug, display_name, photo_url, accent_color, agent_whatsapp, commission_tier, status, created_at`.
- v1 = **subdomain skin** (tier 2): agent name in header lockup ("Joe eSIM ⚡ powered by BRAND"), photo, accent color, curated "Joe's picks".
- Attribution: any order placed on `joe.*` credits Joe. No cookies/ref params needed.
- Legal footer, T&Cs, seller-of-record = ours on every tenant. Agents are marketing partners, not resellers.
- Onboarding: agent fills a form → row created in `pending` status → Dan approves with one tap (admin panel or WhatsApp message to admin bot).

## 3. Catalog & pricing
- Plans synced from wholesale API. Retail price = wholesale × markup rule per region (configurable table, not hardcoded).
- Featured destinations for IL market: Europe (regional), USA, Thailand, UAE, Greece/Cyprus.
- Currency: display ₪ (convert from USD wholesale at configurable rate + buffer).

## 4. Checkout & provisioning
1. Customer picks plan → pays (₪, local card/Bit) → order row `paid`.
2. Webhook triggers provisioning call to wholesale API → receives eSIM (QR/activation code).
3. Delivery: email + WhatsApp message with QR, install guide link (per-device: iPhone/Android), and support bot number.
4. Failure path: provisioning fails → auto-retry ×3 → auto-refund + apology message + alert to admin channel.

## 5. Affiliate commissions
- Ledger table: per-order commission rows per tenant.
- Rate: ⛔ flat 15% vs tiered (10% base / 20% ≥30 orders/mo). Recommendation: tiered.
- Monthly statement auto-generated per agent (WhatsApp + email). Payout manual by Dan at first (Bit/bank transfer), automate later.

## 6. Support (zero-Dan)
- WhatsApp bot (Claude API): Hebrew+English. Capabilities: install/activation troubleshooting from KB, order lookup by phone number, resend QR, coverage questions, refund initiation.
- Auto-refund rule: unactivated eSIM, <30 days, ≤ threshold (default $30) → approve without human.
- Escalation to tier-2 human on: refund above threshold, detected frustration, 2 failed resolution attempts. Human = paid freelancer; Dan sees weekly summary only.
- Tenant-aware greeting: bot greets with the storefront brand of the order ("Joe eSIM support") — one bot, one number.

## 7. Admin
- Minimal admin panel: orders, tenants, refunds, commission ledger, markup rules. Dan-friendly (plain language, no jargon).
- Weekly digest to Dan via WhatsApp: orders, revenue, profit, top agent, support stats.

## 8. Out of scope for v1
Custom domains per agent (tier 3), automated payouts, iOS/Android app, loyalty program, non-IL markets.
