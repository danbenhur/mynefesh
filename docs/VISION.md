# VISION

## What
A branded eSIM store for the Israeli market, competing with esimnow.co.il. We resell wholesale eSIM data packages (via a wholesale API provider) under our own brand, at our own retail prices.

## The differentiator: agent-branded storefronts
Distribution runs through travel agents as affiliates — but instead of referral links, **each agent gets their own co-branded storefront** (e.g. "Joe eSIM", "David eSIM") on a subdomain of our platform. Same backend, checkout, provisioning, and support; the agent's name, photo, and accent color on the front. Agents promote *their own store*, not someone else's link. No competitor in the Israeli market offers this.

## Operating principles
1. **Zero-Dan operations.** Dan does no coding and no support. Support is an automated WhatsApp bot (tier-1, Claude-powered) with an optional paid human tier-2 for escalations. Refunds under a threshold are auto-approved.
2. **Everything self-serve.** Agent onboarding = a form → a tenant row. Customer purchase → auto-provision → QR by email/WhatsApp. 
3. **Repo is the brain.** All decisions and specs live in /docs; any Claude session can pick up from there.

## Economics (working model — verify with real quotes)
- AOV ~$18. Wholesale ~50% of retail. Agent commission ~15%. Payment fees ~3%.
- Net to us ~30%/order (~$5.45). Break-even ~30–45 orders/mo against ~$150–250/mo fixed costs.
- Scenarios: 50 orders/mo ≈ $100 profit; 250 ≈ $1,150; 1,000 ≈ $5,200.
- Biggest levers: wholesale cost > AOV > commission rate. Repeat purchases (2–4×/yr per traveler, no commission on direct repeats) are the compounding asset.

## Target customer
Israeli travelers (Europe/US/Thailand heavy), buying through travel agents they already trust. Hebrew-first UX, payment in ₪ (local cards + Bit), WhatsApp as the support channel because that's the norm in Israel.
