# STATUS — Shabbat autonomous run, Friday 2026-07-10

Written for Dan, plain language. All work is saved and verified.

## Afternoon batch (added after Dan said "keep going")

4. **Agents can now join by themselves**: a Hebrew signup page — store
   name, web address, WhatsApp, color — creates a "waiting for approval"
   store. Tested: a fake agent ("דנה eSIM") signed up.
5. **Your admin panel exists**: see orders, revenue, how much commission
   each agent is owed — and approve a new agent with one tap. Tested:
   approved דנה, her store went live instantly. (Password-protected;
   proper hardening before going public.)
6. **Payment decision (Q3) is prepped**: full comparison in
   docs/PAYMENTS.md. Bottom line: Stripe impossible in Israel;
   **recommended: Grow (by Meshulam)** — fastest to set up, supports Bit.
   You only need to reply "approved: Grow".
7. **Support bot's knowledge base written** (docs/SUPPORT-KB.md):
   per-device install guides, troubleshooting, refund rules — ready for
   the WhatsApp bot build (B5).

## What's built and working

The whole first version of the store now exists and was tested like a real
customer would use it — on a phone-sized screen, in a real browser:

1. **The SimKal store**: catalog of 12 demo packages (Europe, USA, Thailand,
   UAE, Greece, Cyprus), Hebrew, prices in ₪.
2. **A full purchase**: pick a destination → package page → checkout form
   (name, phone, email — with friendly Hebrew error messages) → "payment"
   → a screen with a scannable QR code and install instructions for
   iPhone/Android. Takes under a minute.
3. **Agent stores**: yossi.simkal.co.il shows "יוסי eSIM ⚡ powered by
   SimKal" with Yossi's green color — same store, his brand. A test
   purchase on Yossi's store automatically credited him ₪8.23 commission
   (15%) in the ledger. Misspelled or suspended agent addresses safely show
   the main store.

**How to see it from your phone:** the visual report I sent you in the chat
(link + screenshots) shows every screen. The store itself is not on the
internet yet — that needs a hosting account, a 5-minute step for Saturday
night (see below).

## Provisional decisions needing your confirmation (details in DECISIONS.md)

- Checkout currently charges nothing (test mode) until you pick a payment
  provider (Q3).
- Agent commission accrues at flat 15% until you decide Q4 (nothing is
  lost if you switch to tiered later).
- The QR appears on-screen only for now; email comes in B4, WhatsApp in B5.

## Blocked / not possible this run

- **Putting the store on the internet** — needs a hosting account (e.g.
  Vercel, free tier is fine) that only you can create/authorize.
- **Real prices, real eSIMs, real payments** — waiting on Q1 (your three
  wholesale sign-ups) and Q3.
- **Buying simkal.co.il** — only you can pay for it. Still urgent.

## Recommended next batch (Saturday night)

1. **Together, 10 minutes**: create a free Vercel hosting account + buy
   simkal.co.il → the store gets a real address you can open and share.
2. **You**: finish the three wholesale sign-ups (Q1) and paste price sheets
   into a session → I replace demo prices with real ones and calculate real
   margins.
3. **Me, autonomous**: B6 groundwork (agent onboarding form) — doesn't
   depend on any open decision.
