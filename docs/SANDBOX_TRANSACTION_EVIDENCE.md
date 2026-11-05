# Sandbox transaction evidence

Latest: 2026-11-05 UTC / 2026-11-04 local · **BLOCKED — no genuine Sandbox transaction.**

## Current credential-backed check

The supplied private client ID/secret were tested against Sandbox OAuth at
`2026-11-05T04:39:56.562Z`: **HTTP 401, invalid_client, authenticated=false**.
No token was logged/stored. This is a genuine Sandbox API call, but no authenticated
order, payer approval or capture was possible. The endpoint was never changed to live.
The probe used the documented Basic-auth client-credentials exchange.
[Official authentication reference](https://developer.paypal.com/api/rest/authentication/).
PAYPAL_MERCHANT_ID and PAYPAL_WEBHOOK_ID remain missing; no public HTTPS listener
is configured. The buyer account has not been authenticated or verified.

The original pair was preserved. Missing nonfinancial local settings were privately
completed and Meta inference genuinely passed four final cases. Application startup
still requires the actual merchant configuration; no merchant was fabricated.

**Next owner action:** in [Sandbox Apps & Credentials](https://developer.paypal.com/dashboard/applications/sandbox),
verify the client ID/secret belong to the same Sandbox REST app and save them in
`.env.local`; add that Sandbox business account's PAYPAL_MERCHANT_ID. Do not paste
the values into chat. Then repeat OAuth and existing checkout. There is **no actual
payer approval URL yet** because no order exists. A Sandbox personal buyer login
is needed only after authentication/order creation succeed.

For genuine webhooks, supply an approved nonproduction HTTPS origin and same-app
subscription ID. No tunnel, public listener or deployment was started; explicit
authorization is required before exposing a local service. The procedure below
remains pending and simulator events do not close this gate.

Current totals: one credential-backed OAuth attempt rejected; **zero orders,
zero approvals/captures and zero genuine signed events**. Meta assessment completion
or ALLOWED does not change any of those payment facts.

## Historical Step 6.5 evidence

The following evidence table records the earlier run before `.env.local` was
supplied. Its unauthenticated reachability probe is separate from the current
credential-backed rejection above. The manual transaction/webhook procedures
remain unexecuted; use Meta configuration from the current integration guide.

### Historical evidence record

| Field | Actual result |
|---|---|
| Historical baseline | `a4311c9`, security fixes preserved |
| Network probe | `2026-11-05T03:44:38.173Z`, unauthenticated Sandbox OAuth HTTP 401 |
| Genuine order ID | None |
| Genuine payer approval | None |
| Genuine capture ID/status | None |
| Verified captured amount/currency/payee | Not established |
| Genuine webhook event/signature | None |
| Actual Paid frontend result | Not established |
| Genuine transaction count | **0** |

No account-backed API call was possible: client ID/secret and business merchant
ID were missing, and no personal payer session was provided. The webhook ID,
subscription and public HTTPS listener were also absent. Existing fixtures and
intercepted “Paid” screenshots must not fill any field above.

### Step 6.5 security-sensitive scenarios

| Scenario | Current observed evidence | Remaining real-provider check |
|---|---|---|
| Human review gate | Actual local route denies checkout before review; authorized review grants policy key only | Repeat with configured real AI and actual order afterwards |
| Blocked purchase | Actual local checkout denied; no payment row; automated zero-provider-call assertions pass | Confirm no order appears in the Sandbox app after blocked proposal |
| Duplicate purchase | New-key semantic duplicate blocks; fixed-key replay returns existing request | Confirm only the original approved request reaches actual checkout |
| Repeated/concurrent capture | Actual service/HTTP with doubles and PostgreSQL claims: one capture side effect | Repeat protected application capture for a real completed payment; compare actual capture ID/history |
| Capture timeout | Controlled adapter transport uses actual 15-second timeout, same-ID replay, unknown/backoff and later GET/webhook recovery | Not induced against PayPal; do not count controlled timing as real provider behavior |
| Payer cancel/funding decline | Browser API/SDK interception and FakePayPal paths pass | Actual buyer cancellation and same-order funding recovery still unverified |
| Network/auth retry | Missing CSRF/agent checkout denied in actual app; automated transient/failed-replay cases pass | Real network interruption recovery remains unverified |

PayPal documents same-ID retry semantics and that a simultaneous second request
can fail. The application preserves `ord_<payment_id>` and
`cap_<payment_id>_<attempt>` across retries; an unsuccessful replay cannot resolve
an earlier ambiguous capture as failed.
[Official idempotency guidance](https://developer.paypal.com/api/rest/reference/idempotency/).

## Reproducible real transaction procedure — not executed

1. Account owner: open PayPal Developer Dashboard, select Sandbox and use a
   business seller plus a separate personal buyer. Obtain the business account's
   merchant ID and the Sandbox REST app's client ID/secret. Do not use the
   personal payer ID/email as the merchant ID.
   [Official account setup](https://developer.paypal.com/sandbox-testing/accounts).
2. Privately create/edit `.env.local` from the existing configuration template,
   without overwriting any existing values blindly. Configure DATABASE_URL for
   an isolated acceptance DB, a strong SESSION_SECRET, private distinct reviewer
   and operator passcodes, DEMO_MODE=true, a valid DEMO_AGENT_KEY, the three PayPal
   variables, and real AI configuration. Keep PAYPAL_API_BASE pinned to Sandbox.
   Never use the ignored QA placeholder configuration for provider acceptance.
3. Use the exact same origin in APP_URL and the browser. HTTP loopback is supported
   for local payer checkout; genuine webhooks additionally require the HTTPS setup
   below. Run `pnpm db:migrate` only for the intended acceptance DB. Then:

   ```sh
   NEXT_PUBLIC_API_MODE=live pnpm build:webpack
   pnpm start -H 127.0.0.1 -p 3100
   ```

4. Sign in with the private reviewer passcode. Send A on a fresh acceptance DB.
   Inspect all eight policy results and actual AI status/model. A normal low-risk
   completed assessment should allow; record unexpected review as an observed
   result, rather than changing policy/AI output to force a pass. Any review must
   be decided by an authorized independent reviewer before checkout.
5. Select Continue to PayPal. Record the stored payment and real order reference
   from the application. At this point the request is not Paid. Confirm the
   actual order amount is USD 18.00 and the payee is the configured Sandbox
   business. Fictional catalog merchant “Larkspur Data” is purchase context;
   this app does not pay that third-party company.
6. The account owner signs in to the official PayPal checkout using the personal
   Sandbox buyer and approves. Allow the application's existing callback/return
   path to capture. Do not independently POST capture to PayPal or allocate a new
   operation ID. If the response is ambiguous, use the existing stored payment's
   status/recovery path; do not reset or submit a replacement purchase.
7. Run the existing independent read-only provider verifier with that stored ID:

   ```sh
   pnpm sandbox:verify pay_<actual_stored_payment_id>
   ```

   Require exit 0 and matching stored PAID/COMPLETED state, real capture COMPLETED,
   order/capture IDs, request reference/custom/invoice IDs, amount, USD currency
   and configured payee. A provider read alone cannot stand in for persisted state.
8. Reload the payment page on desktop/mobile. Confirm Paid appears only now, both
   resources/reference evidence agree, and the ledger chain verifies. Compare
   the seller's Sandbox transaction history. Retain sanitized capture/order ID
   suffixes or hashes, amount/status, merchant match boolean, UTC timestamps and
   verification exit result. Exclude cookies, OAuth tokens, payer PII and raw bodies.
9. Repeat the completed payment's protected application capture request in the
   same authenticated session (new API Idempotency-Key; same payment). Require
   identical capture ID/status, unchanged attempts and exactly one charge in
   Sandbox history. Also replay its original API key and verify no new effect.
   Repeat B/C/duplicate and actual payer-cancel flows; document each result.

For failure recovery, use the existing E flow only after enabling Sandbox negative
testing for the test account. It sends PayPal-Mock-Response for a controlled
INSTRUMENT_DECLINED case; label that evidence as **PayPal-served negative testing**,
not a natural funding decline. Verify same-order payer recovery and the final
capture independently. No such request was executed in this run. See
[the existing integration guide](PAYPAL_INTEGRATION.md) for the negative-test path.

For the repeat check, this browser-console snippet on the application's own
origin uses the signed-in session without printing credentials. Replace only the
payment ID after independent completion verification:

```js
const paymentId = "pay_<actual_stored_payment_id>";
const csrf = document.cookie.split("; ").find(x => x.startsWith("apg_csrf="))?.slice(9);
const response = await fetch(`/api/v1/payments/${encodeURIComponent(paymentId)}/capture`, {
  method: "POST", credentials: "same-origin",
  headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf ?? "",
    "Idempotency-Key": crypto.randomUUID() },
  body: "{}",
});
const result = await response.json();
console.log({ http: response.status, payment: result.payment?.status,
  request: result.purchase_request?.status,
  captureSuffix: result.payment?.paypal.capture_id?.slice(-6),
  attempts: result.payment?.attempts.length });
```

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
