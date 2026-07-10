# BACKLOG

## Decision Queue (Dan)
1. ⛔ **Q1 — Wholesale provider** (BLOCKER for catalog/margins): sign up at Yesim Partner, eSIM Access, Airalo Partners → paste price sheets for Europe/US/Thailand into a session.
2. ✅ **Q2 — DECIDED 2026-07-10: SimKal / סימקל** (see DECISIONS D12). Remaining Dan action: **buy simkal.co.il** (+ .co/.io optionally).
3. **Q3 — Payment provider** (₪ + Bit): ask Claude for a comparison when ready.
4. **Q4 — Commission model**: flat 15% vs tiered 10/20.

## Build order (Claude Code)
1. ✅ **B0 — Scaffold** *(done 2026-07-10)*: Next.js app, Postgres schema (tenants, plans, orders, commission ledger, markup rules, settings), zero-setup local dev DB (embedded Postgres), mock wholesale provider behind a provider-agnostic adapter, seed script, Hebrew-RTL catalog homepage with computed ₪ prices.
2. ✅ **B1 — Storefront v1** *(done 2026-07-10)*: plan pages, Hebrew RTL mobile-first funnel, mock checkout (validated form → paid order → provisioning with retries → on-screen QR + install steps). Verified end-to-end in a real browser.
3. ✅ **B2 — Multi-tenant skins** *(done 2026-07-10)*: wildcard subdomain routing (+ `?tenant=` dev override), tenant lockup/photo/accent theming, order attribution + 15% commission ledger rows. Verified: attributed purchase credited the agent; www/unknown subdomains fall back to main store.
4. **B3 — Payments**: real provider integration (post-Q3), ₪ pricing, webhooks.
5. **B4 — Provisioning**: wholesale adapter (post-Q1), QR delivery email, retry/auto-refund path.
6. **B5 — WhatsApp**: Meta Cloud API setup, delivery messages, tier-1 support bot + KB, escalation flow.
7. **B6 — Affiliate ops**: commission ledger, agent onboarding form, monthly statements.
8. **B7 — Admin panel + weekly digest.**

## Non-code (Dan, whenever)
- Register עוסק / business entity; accountant chat re: VAT on eSIM sales + telecom-license question (expected: no license needed, verify).
- Meta Business account (needs brand name first).
- Recruit first 2–3 agent friends as pilot ("founding agents" — consider grandfathered 20% rate).
