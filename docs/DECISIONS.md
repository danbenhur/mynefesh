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

## Open (Decision Queue — see BACKLOG.md)
- Q1. Wholesale provider (BLOCKER — need quotes: Yesim, eSIM Access, Airalo Partners)
- Q2. Brand name + domain (should compose with agent names: "Joe + BRAND")
- Q3. Payment provider (Meshulam / Grow / Tranzila vs Stripe; ₪ + Bit support)
- Q4. Commission model: flat 15% vs tiered 10/20 (Claude recommends tiered)
