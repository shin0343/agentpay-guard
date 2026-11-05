# Sandbox transaction evidence

Latest: 2026-11-05 UTC / 2026-11-04 local.
**Genuine order VERIFIED; payer approval and capture PENDING. Overall NOT READY.**

## Genuine evidence

| Item | Observed result |
|---|---|
| Corrected credentials | Actual Sandbox OAuth HTTP 200 at 05:37:21.034Z; token stayed in memory |
| Merchant setting | Absent; optional for single-merchant Orders v2. No payee supplied; authenticated response recipient durably bound and checked |
| Actual AI | Meta Standard muse-spark-1.3, score 5/low, completed 05:43:16.194Z, 1,918 ms, prompt r-3-meta-1 |
| Policy | All eight rules pass; actual request ALLOWED before checkout |
| Purchase reference | preq_…STDSJ2 |
| Payment reference | pay_…4XRWYS |
| Actual order | …37130M, created 05:43:17Z; authenticated GET verified |
| Amount/currency | USD 18.00, matches persisted quote/order |
| Recipient/request ownership | Bound merchant, reference_id/custom_id/invoice_id and stored order ID match |
| Provider order status | PAYER_ACTION_REQUIRED at last read 05:45:58.182Z |
| Persisted state | Request CHECKOUT_PENDING; payment AWAITING_PAYER |
| Capture ID/status | None; zero capture attempts; successful capture NOT verified |
| Duplicates/retries | Original create key replay same request; separate duplicate BLOCKED; checkout key replay same payment/order |
| Persistence | Exactly one payment for this request; initial audit chain valid, 34 events |
| Actual UI | Desktop/mobile request and payment screens correctly waiting/not-paid, no API interception; four screenshots inspected |
| Genuine signed webhook | None; no subscription ID or public HTTPS listener |

The recipient comes from the Sandbox account owning the REST credentials. Fictional
catalog merchant Larkspur Data is purchase context, not a third-party payout target.
No payer PII, cookies, access token, raw response or private merchant ID is committed.

## Immediate manual action

The actual approval link was supplied privately in the conversation. Open it,
sign in as a separate **Sandbox Personal** buyer, verify USD 18.00 and approve.
Do not send the buyer password in chat. Then tell the verification lead that
approval completed. Policy approval expires **2026-11-05T06:13:16.207Z**,
22:13 PST on Nov 4. An expired approval must not be extended by rewriting records.
No capture will start unless the real PayPal order reports APPROVED. A redirect
or internal approval alone does not prove that status.

The loopback application remains available on port 3100 for this payer return.
If the return shows app login, approval can still be independently checked through
PayPal. The acceptance command captures only through the authorized app route:

```sh
# Already executed: create once and inspect; local evidence prevents a second create.
PAYPAL_LIVE_VERIFY=true pnpm exec tsx --env-file=.env.local scripts/verify-live-paypal.ts create
PAYPAL_LIVE_VERIFY=true pnpm exec tsx --env-file=.env.local scripts/verify-live-paypal.ts inspect
# Pending actual buyer approval:
PAYPAL_LIVE_VERIFY=true pnpm exec tsx --env-file=.env.local scripts/verify-live-paypal.ts capture
pnpm sandbox:verify pay_<actual_saved_payment_id>
```

The existing read-only sandbox:verify must exit 0 with provider COMPLETED capture,
matching stored PAID/COMPLETED, amounts/IDs/recipient and capture ID. Capture mode
also repeats the terminal protected app operation with a new API key and requires
the same capture. These capture steps have NOT passed yet. After completion,
reload actual desktop/mobile payment screens and inspect Sandbox seller history.

## Security-sensitive verification boundaries

| Scenario | Evidence |
|---|---|
| Review/blocked checkout | Real configured application HTTP 409, no new payment/capture |
| Unauthorized capture / no CSRF | Real application HTTP 403 before PayPal operations |
| Client-selected order | Real application HTTP 422 |
| Same create and checkout key | Genuine app+Sandbox order, same persisted resources |
| New-key duplicate purchase | Genuine app policy BLOCKED, links original |
| Recipient substitution / explicit config / missing binding | Regression doubles and real PostgreSQL binding persistence; no real provider tampering |
| Concurrent/repeated capture, ambiguous timeout/replay | Automated controlled transport and PostgreSQL tests pass; real completed-order repeat still pending |
| Actual buyer cancel/decline/network interruption | Not executed against PayPal; existing browser/transport tests are labelled simulations |

The real-order capture probe refused before calling capture while PayPal reported
PAYER_ACTION_REQUIRED (exit 1). Independent sandbox:verify also exited 1 with
“Sandbox payment is NOT verified completed.” These are expected unpaid-state
rejections, not passing capture acceptance. No capture was sent.

Current regression: **176 passed**, six real PostgreSQL checks, 20 Meta tests;
typecheck/lint/Webpack build and existing browser E2E passed. Prior 04:39:56Z
OAuth 401 invalid_client was a real failure with the earlier secret, now resolved.
Prior zero-order evidence is historical, not the current state.

## Merchant requirement and references

OAuth uses client ID/secret, without merchant ID. Orders create documents optional
payee; the single-merchant request may omit it. Application ownership checks remain
mandatory: creation pins a trusted recipient, later GET/capture/settlement compare
it. Configured merchant ID continues to constrain both creation and settlement.
Unbound legacy records without a configured recipient fail closed; reconcile
manually rather than learning ownership from an arbitrary later read.

- [Official OAuth](https://developer.paypal.com/reference/get-an-access-token/)
- [Orders v2 create](https://developer.paypal.com/api/orders/v2/orders-create)
- [Order payee definition](https://developer.paypal.com/sdk/orders/v2/definitions/order/)
- [Idempotency](https://developer.paypal.com/api/rest/reference/idempotency/)

Preserved ord_<payment_id> / cap_<payment_id>_<attempt>, unique order/capture
ownership, server authorization/CSRF, quote verification and policy expiry. An
ambiguous capture remains CAPTURING/unknown and cannot become a new charge attempt
until authoritatively reconciled. No production endpoint, tunnel or deployment.

## Genuine webhook delivery procedure — not executed

1. Provide an externally reachable HTTPS verification origin/listener, without
   deploying to production. Set APP_URL to that exact origin. If a tunnel is used,
   point it to this app's local port; keep credentials private and do not expose
   another project. No tunnel or public deployment was started in this run.
2. On the **same Sandbox REST app** used to create the order, register
   `https://<verification-origin>/api/v1/webhooks/paypal`. Subscribe to
   CHECKOUT.ORDER.APPROVED and PAYMENT.CAPTURE.COMPLETED/PENDING/DENIED. Put the
   returned subscription ID in PAYPAL_WEBHOOK_ID and restart the app. Confirm
   the registered listener URL, environment and event selection match. Events
   created by another REST app do not validate this subscription.
   [PayPal webhook configuration](https://developer.paypal.com/api/rest/webhooks/).
3. Generate a genuine transaction using this app. Check the genuine event's
   delivery result in the Webhook Events dashboard and a 2xx listener response.
   Acceptance requires the app's PayPal signature postback to succeed; it passes
   the original event JSON and transmission headers with the configured ID to
   `/v1/notifications/verify-webhook-signature`. Then the app GETs its owned order;
   payload status alone cannot set Paid.
4. Match the event's related order to the stored payment/request and actual
   capture. Inspect `webhook.received`, payment evidence and chain verification.
   Save only a redacted event reference, UTC delivery time, verification outcome,
   correct payment mapping and event/attempt counts.
5. Resend the **same genuine event** from PayPal's Webhook Events dashboard.
   Require 2xx, one stored dedupe ID, unchanged capture ID/attempts, and no additional
   charge. Delivery may arrive after synchronous capture; terminal deduplication
   is expected, not another payment transition.

The public URL, subscription ID, signature postback and genuine event delivery
are all currently unverified. PayPal's simulator does not support postback
verification and cannot close this gate. The existing RSA/CRC32 tests are local
doubles only. [Official signature/simulator guidance](https://developer.paypal.com/api/rest/webhooks/rest/).
