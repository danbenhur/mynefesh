# SUPPORT-KB (expanded 2026-07-10 — Hebrew versions to be authored at B5)

This file becomes the tier-1 WhatsApp bot's knowledge base. Written as
answer material, one section per intent. Keep answers short, steps
numbered, no jargon.

## Install: iPhone
- Requirements: eSIM-compatible iPhone (XS/XR and later), carrier-unlocked, iOS updated, Wi-Fi connection.
- Steps: Settings → Cellular → Add eSIM → Use QR Code → scan. Label it "Travel". Keep the line OFF until landing.
- Newer iOS: can also install from the email — long-press the QR image → "Add eSIM".
- Verify installed: Settings → Cellular shows a second line.

## Install: Android
- Requirements: eSIM-compatible phone (quick check: dialing `*#06#` shows an EID → eSIM likely supported), unlocked, Wi-Fi.
- **Samsung**: Settings → Connections → SIM manager → Add eSIM → Scan QR code.
- **Google Pixel**: Settings → Network & internet → SIMs → Add eSIM → Use QR code.
- **Xiaomi/Redmi** (region-dependent — many IL imports lack eSIM): Settings → Mobile networks → eSIM → Add. If no eSIM menu exists, the device doesn't support it → refund per policy.
- **OnePlus/Oppo**: Settings → Mobile network → eSIM → Add eSIM.

## At destination (activation)
- Turn the eSIM line ON, enable Data Roaming **on the eSIM line only**, primary SIM data OFF (avoids home-carrier roaming charges).
- Set the eSIM as the data line: iPhone: Settings → Cellular → Cellular Data → select Travel line. Android: SIM settings → Data → travel eSIM.
- Not working: (1) airplane mode 10 seconds, (2) restart phone, (3) manual network selection → pick a listed local carrier, (4) verify APN matches the delivery email (per provider), (5) check the plan's start time — some plans start on first attach, some at purchase.

## Common issues
- **"Scanned but no service"**: usually activated too early or data roaming off on the eSIM line. Walk through the activation checklist above. If validity ran out before travel due to start-at-purchase → escalate (goodwill reissue decision).
- **"QR won't scan"**: offer manual entry — give SM-DP+ address + activation code from the order (bot fetches by phone number). iPhone: Add eSIM → Enter Details Manually. Android: Add eSIM → enter manually.
- **"Used my data too fast"**: explain usage (video ≈ 1GB/hr; maps/messages are light). Offer a top-up plan for the same destination. Tips: disable video auto-play and photo backup while traveling.
- **"Phone is carrier-locked"**: eSIM won't work on locked phones. If unactivated → refund per policy. Suggest checking lock status with the home carrier before the next purchase.
- **"Deleted the eSIM by mistake"**: a consumed QR usually can't be re-installed; check provider reissue policy — if possible, resend; otherwise escalate for goodwill decision.
- **"Does it include a phone number / calls?"**: data-only. WhatsApp calls work over data; the regular IL number stays reachable for SMS (keep primary SIM on, its data off).
- **Hotspot**: allowed unless the specific plan says otherwise (check plan notes).

## Policies
- Refunds: unactivated + <30 days from purchase + ≤$30 → automatic, no questions.
- Above threshold or edge cases → tier-2 human.
- No refunds after activation except a provisioning fault on our side.
- Reissue (deleted eSIM, wrong device): goodwill, tier-2 decision until a rule emerges.

## Escalation triggers (bot logic)
- Refund above threshold; anger/frustration signals; 2 failed resolution attempts on the same issue; anything legal or payment-dispute; journalist/regulator/lawyer keywords.
- Escalation message sets expectations: human replies within X hours (define at B5), order details already attached.

## Order lookup (bot tools, to be built at B5)
- Lookup by customer phone number → latest order(s): status, destination.
- Actions: resend QR (email/WhatsApp), check activation status via provider adapter, initiate refund (auto-rule or escalate).
