# eSIM Store (brand name pending — Q2)

Branded eSIM store for the Israeli market with agent co-branded storefronts.
**Read `/docs` first** — `VISION.md`, `SPEC.md`, `DECISIONS.md`, `BACKLOG.md`
are the single source of truth. Standing instructions in `CLAUDE.md`.

## Status

B0 (scaffold) done: Next.js app, Postgres schema, mock wholesale provider,
seeded Hebrew-RTL catalog page. See `docs/BACKLOG.md` for build order.

## Stack

- **Next.js 15** (App Router, TypeScript) — storefront + API
- **Postgres** via **Drizzle ORM** — set `DATABASE_URL` for a real database;
  with no `DATABASE_URL`, an embedded Postgres (PGlite) runs from `./.data`
  so local dev needs zero setup
- **Wholesale adapter** — `src/lib/wholesale/` defines a provider-agnostic
  interface; `mock-provider.ts` stands in until Q1 (real provider) is decided

## Run locally

```bash
npm install
npm run db:seed   # migrations + pricing config + mock catalog (idempotent)
npm run dev       # http://localhost:3000
```

## Key paths

| Path | What |
|---|---|
| `src/db/schema.ts` | tenants, plans, orders, commission_ledger, markup_rules, app_settings |
| `src/lib/wholesale/` | provider adapter interface + mock implementation |
| `src/lib/pricing.ts` | retail ₪ = wholesale $ × region markup × FX × buffer |
| `src/lib/catalog.ts` | provider catalog → priced `plans` rows (sync) |
| `scripts/seed.ts` | seed everything (`npm run db:seed`) |
| `drizzle/` | generated SQL migrations (`npm run db:generate`) |
