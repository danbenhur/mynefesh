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

## 2026-07-10 (continued)
- **D12. Brand name (Q2 decided): SimKal / סימקל** — Dan's pick from vetted shortlist. Composes as "Joe ⚡ powered by SimKal". No eSIM-brand collision found; simkal.com belongs to a Turkish calibration lab (unrelated industry, no conflict). Domains simkal.co.il / simkal.io / simkal.co showed no DNS records at decision time. **Dan action: buy simkal.co.il (+ .co/.io if cheap) ASAP — availability not guaranteed until purchased.** Also rejected en route: "Magic eSIM" (existing app), "MySim" (domains taken, generic).

## 2026-07-10 (later)
- **D13. Payment provider (Q3 decided): Grow (by Meshulam)** — Dan approved ("take grow"). Reasons: fastest self-signup, hosted secure checkout (minimal compliance), native Bit support, fees in line with the 3% model assumption. Prerequisite: Dan registers עוסק. B3 will be built against Grow's hosted-page API behind a payments adapter (switchable later).

- **D15. Commission model (Q4 decided): tiered + founding** — standard agents: 10%, upgraded to 20% from the 30th delivered order in a calendar month (retroactive top-up for that month's earlier orders will run with the monthly statement job); founding agents (first 2–3 pilot friends): permanent 20%. Implemented and verified same day; supersedes PD2.
- **D14. Domain purchased**: Dan bought **simkal.co.il** (2026-07-10, registrar: Box.co.il, confirmation received). Brand + domain now fully secured; unblocks hosting hookup and Meta/WhatsApp business verification.

## PROVISIONAL — Dan to confirm (made autonomously during Shabbat run, 2026-07-10)
- **PD1. Mock payment**: until Q3 is decided, checkout "charges" nothing — orders are created as already-paid so the full flow can be tested. Real payment provider replaces this in B3.
- ~~**PD2. Commission rate**: flat 15% until Q4 decided.~~ *Resolved by D15 (tiered + founding).*
- **PD3. Storefront resolution**: agent subdomain (joe.simkal.co.il) in production; `?tenant=slug` override for dev/preview (kept via cookie through checkout). Reserved subdomains: www, app, admin, api.
- **PD4. QR delivery v1**: on-screen on the order page only. Email delivery = B4, WhatsApp = B5.
- **PD5. Unknown/suspended agent subdomain** shows the main SimKal store (graceful fallback, no error page).

## Open (Decision Queue — see BACKLOG.md)
- Q1. Wholesale provider (BLOCKER — need quotes: Yesim, eSIM Access, Airalo Partners; Dan doing sign-ups)
- Q3. Payment provider (Meshulam / Grow / Tranzila vs Stripe; ₪ + Bit support)
- Q4. Commission model: flat 15% vs tiered 10/20 (Claude recommends tiered)
