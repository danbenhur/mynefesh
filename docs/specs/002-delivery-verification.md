# Spec 002 — SMS delivery verification & retry

**Status:** Implemented (July 2026).
**Motivation:** On July 15, 2026 the nightly check-in was accepted by Twilio and then lost in transit (error 30008, carrier-side). The sample since May shows ~7% of SMS sends to Israel from the US long code end `undelivered`. A missed check-in silently costs a day of data — and for a future trial user, their first impression.

## Problem

Two independent gaps:

1. **No retry.** `sendSMS` treats Twilio's acceptance (a SID) as success. Delivery failures after acceptance were invisible to the scheduler; the session sat in `snoozed` and nothing resent.
2. **Status callbacks are unreliable.** Twilio's `statusCallback` for the July 15 failure never reached the server (no `webhook` log lines in the window; cause undetermined — Render logs showed no inbound request at all). A retry mechanism gated on callbacks would inherit that unreliability.

## Design: poll, don't wait

Every successful check-in send enqueues an **in-memory delivery check** `{ sid, userId, sessionId, phone, text, sentAt, attempt }`. A scheduler tick (`processDeliveryChecks`, runs every minute, no-ops when the queue is empty) handles entries older than 5 minutes:

| Twilio status | Action |
|---|---|
| `delivered` / `read` | Drop the check — done. |
| `undelivered` / `failed` | If `attempt < 2` **and** the session is still `snoozed` (user hasn't completed via the app): resend the same text, update `last_message_at`, re-enqueue as attempt 2. Otherwise log give-up. |
| `queued` / `sending` / `sent` (non-final) | Keep polling until the check is 45 minutes old, then drop. |
| fetch error / no Twilio client | Keep until 45 minutes old, then drop. |

Properties:

- **Max 2 sends per night per user** — a persistent carrier failure costs one extra SMS, not a loop.
- **Completion-aware** — if the user completed the check-in between send and verification, no resend.
- **Restart trade-off** — the queue is process memory; a Render restart in the 5-minute window loses the pending check and that night has no retry. Accepted: restarts are rare, the morning-skip message remains the backstop, and this avoids a schema change.
- **Cost** — one Twilio `messages(sid).fetch()` per send per poll; free API call.

## Callback handling (kept as secondary signal)

`POST /webhook/sms-status` improvements shipped alongside:

- **Every callback receipt is logged** (`[webhook] delivery status callback: <status> for ...<last4>`), so "are callbacks arriving at all?" is answerable from logs — during the July incident it wasn't.
- **Plain-SMS failures no longer mark the sandbox expired.** `sandbox_status = 'expired'` is a WhatsApp-sandbox concept; a carrier 30008 on SMS was about to light the misleading sandbox-renewal banner. SMS failures now record `last_delivery_failure_at` only.
- Callback-triggered retry was considered and rejected: one retry mechanism (polling) is enough, and polling works whether or not callbacks do.

## Verification

`tests/delivery-verification.test.ts` drives `processDeliveryChecks` with injected fakes: undelivered → exactly one resend with correct text/phone; attempt cap enforced; queue drained after final states; `delivered` → no send; completed session → no send.

## Open questions

- Why did the July 15 callback never arrive? The new receipt logging will answer this passively — if callbacks show up for delivered messages but not failures (or not at all), we escalate to Twilio support with SIDs.
- If the ~7% undelivered rate persists across retries, the fix is a different sender (Israeli number or alphanumeric sender ID), not more retries. Revisit after two weeks of data.
