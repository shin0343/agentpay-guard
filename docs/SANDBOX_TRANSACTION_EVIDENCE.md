# Genuine Sandbox transaction evidence

2026-11-05 UTC. **VERIFIED: real Meta → policy → payer approval → completed capture
→ signed approval/completion webhooks → genuine redelivery → persisted/UI truth.**
Release verdict: READY WITH DISCLOSED LIMITATIONS, scoped to this local Sandbox
hackathon workflow. This is not production-payment certification.

## Actual transaction

| Field | Verified value |
|---|---|
| Purchase request | preq_01M6PAT02AJK7SF54JHJ7W5CQ8 |
| Payment | pay_01M6PAT2X22DG00DS19BWZBPZA |
| PayPal order | 2UE55412FX0764120 |
| PayPal capture | 32E66103YN1557633 |
| Amount/currency | USD 18.00, matches trusted stored quote/order/capture |
| Receiver | Authenticated create recipient persisted and matched on independent GET; private merchant identity not published |
| Actual AI | Meta Standard muse-spark-1.3, score 5, 2803 ms, prompt r-3-meta-1, assessed 2026-11-05T17:06:24.192Z |
| Deterministic policy | All eight checks pass; original approval deadline 2026-11-05T17:36:24.208Z |
| Actual payer approval | PayPal GET APPROVED at 17:07:38.889Z; no capture yet at that read |
| Guarded capture | Existing operator-authenticated/CSRF/idempotent route; capture attempt 17:07:51Z, stored completion by 17:07:53.795Z, within approval window |
| Independent verifier | pnpm sandbox:verify exited 0 at 17:08:04.345Z; actual provider GET COMPLETED, capture COMPLETED, request PAID/payment COMPLETED |
| Duplicate-capture check | Repeated terminal app capture returned same capture ID; one persisted attempt, one provider capture, one payment.completed event |
| Audit | 106 events, chain valid; head d09d9e319cfd9e06fd1fdc9b1fc033f3efeb872c41676b50132500ba66253274 |
| Genuine webhook originals | Approval 17:07:29.208Z; completion 17:08:13.194Z; both accepted HTTP 200 with trace-linked audit |
| Genuine provider resends | Completion 17:09:49.213Z; earlier approval after capture 17:10:48.948Z; both HTTP 200, original event IDs deduped |
| Actual UI | Four real desktop/mobile request/payment checks pass: Paid, matching capture ID/amount, both keys granted; no API interception |

The final independent check at 2026-11-05T17:12:07.256Z still found one COMPLETED capture and
one attempt. Each of the two distinct event IDs has exactly one dedupe row and
one webhook.received audit event, even after four genuine deliveries. Payment
record unchanged after re-delivery/signature probes; completed state not downgraded.

## Commands actually executed

```sh
PAYPAL_LIVE_VERIFY=true pnpm exec tsx --env-file=.env.local scripts/verify-live-paypal.ts inspect
PAYPAL_LIVE_VERIFY=true pnpm exec tsx --env-file=.env.local scripts/verify-live-paypal.ts capture
pnpm sandbox:verify pay_01M6PAT2X22DG00DS19BWZBPZA
pnpm typecheck
pnpm lint
APG_POSTGRES_TEST=true TEST_DATABASE_URL='<disposable-regression-DB>' pnpm test
pnpm build:webpack
```

The acceptance capture script first GETs its stored order, calls the existing
protected capture route only for APPROVED/COMPLETED, repeats the terminal operation,
then independently GETs and compares provider/DB evidence. No direct unguarded
provider capture, expiry extension or synthetic approval was used.

## Real versus controlled results

- Genuine: actual Meta inference; actual Sandbox create/APPROVED/capture/GET;
  original signed transaction events and supported PayPal resends; postback
  SUCCESS for each of four original-body/header receipts; real PostgreSQL state;
  actual Paid UI with no interception.
- Real verifier with controlled tampering: altered signature, altered signed event
  ID and missing headers each return 400 through the public callback; no state
  changes or extra capture. These are negative probes, not new genuine events.
- Automated: **193 passed**, zero failed/skipped, 17 files, six actual PostgreSQL
  checks. Payment/provider stubs and local RSA tests remain controlled evidence.
  Typecheck, lint and Webpack production build passed in this completion run.
- Browser: actual Paid verification captured four screenshots; desktop-payment and
  mobile-request screenshots visually inspected, no runtime errors/overflow.
  Earlier same-code full desktop/mobile E2E passed 37 screenshots with fixture AI
  and intercepted payment boundaries; it is not provider acceptance evidence.

## Historical attempts and user-facing clarification

Five preceding proposals/orders never reached verified capture. Four older
provider resources eventually returned RESOURCE_NOT_FOUND; the last pre-success
order was independently unapproved/zero captures. Original deadlines/audit prefixes
were preserved and normal expiry applied (local VOIDED does not assert provider
void). No failed attempt was relabelled paid and no historical state was rewritten.
Old NOT READY reports/deadlines are superseded; retained in Git history.

The buyer first used an account PayPal identified as linked to the seller. A
separate Sandbox Personal buyer and generated test card resolved that barrier.
Real card details are not required. After Pay Now, the direct return reached the
app's operator sign-in: this is separate app authorization, not PayPal rejection.
The agent used configured private operator credentials and normal backend guards;
no passcode/security check was removed or exposed. For a smooth demo sign into
the app as an operator before launching its PayPal checkout flow.

Temporary public callback https://magnificent-sword-adjustable-exchanges.trycloudflare.com/api/v1/webhooks/paypal was verified, then tunnel/proxy were shut
down at 2026-11-05T17:13:14.404Z as requested. It is **not active now**. Restarting Quick
Tunnel produces a new URL and requires updating the same registered Webhook ID.
Private receipts (raw payer payloads/signature headers, mode 0600), sanitized
summaries, verifier/build/test logs and screenshots remain under ignored
qa/card-ready and qa/tunnel-live. Never commit raw receipts or buyer PII.
See WEBHOOK_VERIFICATION.md, RELEASE_READINESS_UPDATE.md and STEP7_HANDOFF.md.
