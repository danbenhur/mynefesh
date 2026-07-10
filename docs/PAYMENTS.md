# Q3 — Payment Provider Comparison (prepared 2026-07-10)

For Dan: read the summary + recommendation; the table is backup detail.
All fees are from public sources on 2026-07-10 and **must be verified at
signup** — providers quote per-merchant.

## Summary

- **Stripe is out.** Not officially available in Israel — requires opening
  a US company (LLC + US bank account). Wrong fit for us.
- The real choice is between three Israeli processors, all supporting
  Israeli cards in ₪ and Bit:

| | Grow (by Meshulam) | Cardcom | Tranzila |
|---|---|---|---|
| Bit support | ✔ native | ✔ | ✔ |
| Apple/Google Pay | ✔ | ✔ | ✔ (verify) |
| Indicative fees* | 1.7% + ₪1/tx, or ₪59/mo + 1.5% | ~1.2–1.4% + monthly plans from ~₪59 | ~1.5–3%, no-monthly-fee tier exists |
| Signup speed | fastest (self-signup) | medium | medium |
| Checkout style | hosted page (customer redirected) — least compliance burden | modern REST API + webhooks, good recurring billing | iframe / hosted fields / full API |
| Developer docs | decent | good (API v11) | mature, widely integrated |

\* not including VAT; volume discounts exist.

## Recommendation: **Grow (by Meshulam)** for launch

1. **Fastest to live** — self-signup, no sales call needed. Fits zero-Dan.
2. **Hosted payment page** = the customer pays on Grow's secure page and
   returns to us. We never touch card numbers → minimal compliance work,
   faster B3.
3. **Bit is native** — critical for Israeli buyers.
4. At our expected order size (~₪60–110), 1.7% + ₪1 ≈ 2.6–3.4% total —
   in line with the 3% assumption in the economic model.

Cardcom is the strongest runner-up (better API, likely cheaper %) — worth
switching to at volume if fees matter more than the ₪59/mo. Because B3 is
built behind an adapter (like the wholesale provider), switching later is
contained work.

**What Dan needs to do when convenient:** say "approved: Grow" (or pick
another) → then sign up at grow.co.il with business details (עוסק) + bank
account. Claude does everything after the API keys exist.

Sources: [Grow pricing/features](https://apps.duda.co/apps/grow-payments),
[Israeli gateway comparison](https://danielmashkov.com/insights/israeli-payment-gateways-comparison),
[Tranzila docs](https://docs.tranzila.com/),
[Stripe availability](https://stripe.com/global),
[Route 38 overview](https://blog.route38.co.il/2024/09/03/accepting-payment-for-your-israeli-business/).
