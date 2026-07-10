# DECISIONS (append-only, dated)

## 2026-07-10
- **D1. Business model**: eSIM reseller for the Israeli market, competing with esimnow.co.il. Wholesale API + own storefront. No network ownership.
- **D2. Roles**: Dan = decisions only. Claude = product/spec/architecture/implementation (via Claude Code). No hands-on coding or support by Dan.
- **D3. Distribution**: travel-agent friends as affiliates.
- **D4. Agent branding**: each agent gets a co-branded storefront ("Joe eSIM") on a subdomain — tier-2 implementation (subdomain skin, shared backend). Full white-label domains deferred.
- **D5. Support model**: automated WhatsApp bot as tier-1 (Claude API + KB + order tools), paid human as tier-2 escalation. Auto-refund for unactivated eSIMs under threshold.
- **D6. WhatsApp integration**: direct Meta WhatsApp Business Cloud API (no BSP middleman) — revisit if verification friction is high.
- **D7. Workflow**: repo is the single source of truth; all brainstorm + execution happens in Claude Code sessions (incl. from mobile); this doc structure is the memory.
- **D8. Working economic model**: $18 AOV, ~50% wholesale, 15% commission, ~30% net margin — all assumptions pending real quotes.

## 2026-07-10 (session: B0 scaffold)
- **D9. Stack for B0** (Claude, per D2 mandate): Next.js 15 + TypeScript, Postgres via Drizzle ORM. Local dev uses an embedded Postgres (PGlite) with zero setup; production will use a managed Postgres via `DATABASE_URL`. Wholesale side is a provider-agnostic adapter (`src/lib/wholesale/`) with a mock implementation, so Q1's winner plugs in as one file.
- **D10. Pricing mechanics**: retail ₪ = wholesale $ × per-region markup (DB table) × USD→ILS rate × FX buffer, rounded to X.90. All knobs live in the database (`markup_rules`, `app_settings`) so they're tunable without a deploy. Seeded placeholder values (×~2 markup, rate 3.70, 3% buffer) pending real quotes (Q1).
- **D11. Repo location (temporary)**: the project currently lives on a standalone branch (`claude/kickoff-md-i2j6um`) pushed to Dan's existing `mynefesh` GitHub repository, because this session could only push there. It shares no history or files with MyNefesh. When Dan creates a dedicated repository, the branch moves over in one step — nothing else changes.

## Open (Decision Queue — see BACKLOG.md)
- Q1. Wholesale provider (BLOCKER — need quotes: Yesim, eSIM Access, Airalo Partners)
- Q2. Brand name + domain (should compose with agent names: "Joe + BRAND")
- Q3. Payment provider (Meshulam / Grow / Tranzila vs Stripe; ₪ + Bit support)
- Q4. Commission model: flat 15% vs tiered 10/20 (Claude recommends tiered)
