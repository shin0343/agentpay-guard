# PayPal Sandbox integration

Latest 2026-11-05 UTC: **genuine Sandbox OAuth/order creation verified; capture and signed webhook delivery unverified**. Webhook 12968018AN5251707 is configured and its handler path corrected, but the registered host is offline. See [webhook verification](WEBHOOK_VERIFICATION.md). See [transaction evidence](SANDBOX_TRANSACTION_EVIDENCE.md). HTTP adapter tests use a stub transport. Lifecycle tests use `FakePayPal` from `tests/backend-helpers.ts`; the production runtime always constructs `SandboxPayPal` and has no fake-provider switch.

## Setup

1. Start PostgreSQL 15+ and create an empty database owned by the app's development user. Set `DATABASE_URL` in `.env.local` (copy `.env.example`). Use TLS according to your database provider's instructions; the client does not disable certificate verification.
2. Generate `SESSION_SECRET` with `openssl rand -hex 32`. Set `APP_URL` to the exact application origin (HTTPS except localhost). No query/path/userinfo is accepted.
3. In PayPal Developer Dashboard create/use a **Sandbox business account**, a Sandbox REST app belonging to it, and a separate **Sandbox personal payer**. Copy the Sandbox app's client ID and secret to server variables. `PAYPAL_MERCHANT_ID` is optional for this single-merchant workflow: omit it to use the OAuth merchant, or set the business account's merchant ID as an additional enforced recipient constraint. OAuth requires only client ID/secret. Do not use live credentials. The app rejects any API base other than `https://api-m.sandbox.paypal.com`; credential strings themselves cannot establish account provenance.
4. Set `DEMO_MODE=true`, `DEMO_PASSCODES=operator:<private passcode>,reviewer:<different private passcode>` and `DEMO_AGENT_KEY=agk_test_<32 random ASCII letters/digits>`. Keys are SHA-256 hashed in the database. The research agent is bootstrapped on first authenticated access; the other two scenario agents are provisioned with disabled external credentials. The demo runner acts as those agents through the same validation and policy service. For non-demo agent provisioning, use deployment-controlled inserts into `agents` with a hashed key, owner and category scopes; there is no public provisioning endpoint. Do not reuse example/mock passcodes on a public host.
5. Set `RISK_PROVIDER=fixture` for explicitly labelled, deterministic A–E demos. Missing/unavailable providers require human review. For verified genuine inference use `RISK_PROVIDER=meta`, server-only `MODEL_API_KEY` and Standard `META_RISK_MODEL=muse-spark-1.3`; the OpenAI adapter remains available. See `AI_RISK_ENGINE.md`.
6. Set `NEXT_PUBLIC_API_MODE=live`, run `pnpm db:migrate`, then `pnpm dev`. Client mode is compiled at build time; rebuild after changing it. Sign in on `/login` using the configured passcode.

Migration scripts load `.env.local`; the Next runtime loads it using Next's normal environment handling. Test DB commands take `TEST_DATABASE_URL` explicitly. All credentials stay on the server; only the public client ID is returned by `/api/v1/checkout/config`.

## Supported payment path

The agent sends a proposed purchase to `POST /api/v1/purchase-requests` with its bearer key and `Idempotency-Key`. Input is strict, USD amounts are decimal strings, and totals are checked in integer cents. Known catalog names/SKUs resolve to deployment-controlled merchant identities and prices. Altered merchant/category/domain/prices fail validation. Unknown items can be proposed and reviewed but cannot reach checkout without a trusted catalog entry. Extend `src/server/policy/catalog.ts` for new supported products.

All eight policy rules run under the same short PostgreSQL lock as request reservations. A policy block never reaches the PayPal client. Reviewers cannot approve their own agent's requests. Operators and reviewers alone may start checkout or capture; an agent cannot hold the payer key. Cookie mutations require the signed-session-bound CSRF cookie/header token. Review mutations additionally require `If-Match`.

Checkout persists `CREATING` and a lease before calling `POST /v2/checkout/orders`. The body comes from the validated stored quote with CAPTURE intent, reference/custom/invoice IDs equal to the internal request ID, and application return/cancel URLs containing the payment ID. A configured merchant is sent as explicit payee and enforced. Otherwise payee is omitted and the nonempty recipient returned by the authenticated create response is verified and durably bound as internal `paypal_merchant_id`. Later GETs cannot create/replace this binding. Legacy records without a binding require the configured merchant ID; missing both fails closed. `Prefer: return=representation` requests the full representation. The approval link must point to a sandbox PayPal host. The existing official JS SDK button remains unchanged; a saved redirect link is the fallback.

Before capture, the server GETs its stored PayPal order ID. It checks order ID, intent, payee merchant ID, reference/custom/invoice IDs, amount and currency against the database. Only actual PayPal `APPROVED` can initiate capture. An internal ALLOWED state, reviewer approval, callback, return URL, client-supplied state or token cannot prove payer approval. The redirect page calls the same protected capture API; the query token does not select an order. The authenticated stored payment ID does.

A short transaction commits the capture claim, attempt and audit before network I/O. `COMPLETED` capture alone yields PAID. `PENDING` remains PAYMENT_PENDING. Funding declines produce PAYMENT_FAILED and a recoverable decline. A timeout, 5xx, authentication ambiguity, malformed or mismatched capture response remains CAPTURING with an unknown attempt. It never becomes a fresh retryable payment or claims that no money moved.

Cancellation abandons an uncaptured order locally; there is no invented Orders v2 “void order” call. The optional `POST /payments/{id}/payer-cancel` records closing a popup without cancelling the request. The frontend records this signal on popup and redirect closure, then reads the stored payment without asserting settlement. Unknown/in-flight and pending captures cannot be cancelled. Lazy reads and mutations expire approvals; in-flight settlement is never overwritten by policy expiry.

## Idempotency, interruptions and recovery

- API keys scope to principal, method and concrete path; payload and If-Match are hashed. Stored successful response/status replay for 24 hours. Processing conflicts return 409. Business effects and their API result snapshots commit together. A crashed processing lease can be reclaimed after 60 seconds.
- Create uses `ord_<payment_id>`. Capture uses `cap_<payment_id>_<attempt_number>`. Network retries reuse the same IDs. PayPal invoice uniqueness is additional protection; keep the Sandbox account's duplicate-invoice protection enabled.
- The database enforces one open payment per request and unique PayPal order/capture ownership. Short advisory-locked transactions serialize policy reservations and capture claims across processes. Network calls happen outside that lock.
- `/payments/{id}/reconcile` reads the order again, verifies ownership and amounts, and records a known result. If an interrupted capture still has an approved order with no capture, it may re-send the **original attempt** after its 60-second claim lease (or immediately after a known timeout). It cannot allocate a new attempt for an unknown result.
- Automatic replay of an ambiguous create/capture is limited to five hours, and a capture resend also requires a valid policy approval. Older ambiguity stays unresolved for manual investigation. Do not clear its state, retry as a new purchase or disable invoice uniqueness to force payment.
- An expired/unusable order can be replaced after a known failure, preserving the old record. A declined funding source reuses its existing order. Maximum three capture attempts per order are enforced. The first retry for a reviewer-approved request extends approval once by 15 minutes, provided the original approval has not expired.

The current persistence layer intentionally loads the single demo organization's records per short transaction. This is a conservative foundation, tested across PostgreSQL connections. High-volume/multi-tenant use needs indexed repository queries, narrower locks, expiry cleanup and externally anchored audit heads. Do not claim this baseline has been load tested.

## Webhooks

Register a public HTTPS URL `/api/v1/webhooks/paypal` for the Sandbox REST app and set its `PAYPAL_WEBHOOK_ID`. Subscribe to CHECKOUT.ORDER.APPROVED and PAYMENT.CAPTURE.COMPLETED/PENDING/DENIED (DECLINED is also handled). The server calls PayPal's official `/v1/notifications/verify-webhook-signature` with transmission headers and the configured webhook ID. Certificate URLs are restricted to the documented Sandbox certificate host/path. Signature verification fails closed.

Verified event IDs are deduplicated. The event payload only identifies a stored order; it cannot set a payment's amount or status. Reconciliation fetches the owned order from PayPal and uses the same transition functions as capture. Terminal/out-of-order events are ignored. A transient verifier/order-read outage returns a retryable error so PayPal can redeliver. Local demos work without webhooks via the protected reconciliation endpoint.

## Manual real Sandbox acceptance and evidence

1. Use Send test request → A, or POST its fixture through the agent API. Confirm ALLOWED while payer approval is waiting. For B, approve as a reviewer first. C must remain BLOCKED with zero order/capture calls.
2. Continue to PayPal and log in as the **Sandbox personal payer**. Approve in PayPal; let the server capture. Confirm both the actual capture COMPLETED response and stored request PAID. Save the order ID and capture ID.
3. Run `pnpm sandbox:verify pay_<id>` against the same database and environment. This command performs a **real read-only PayPal GET**, verifies merchant, request correlation, amounts, currency and capture ID against stored PAID/COMPLETED state, and prints only sanitized evidence. A failure exits nonzero; it never fabricates a success or initiates a payment.
4. Check the Sandbox business account transaction history. Verify the audit chain in the ledger.
5. Enable negative testing on the Sandbox business account before scenario E. Only DEMO_MODE accepts `simulate: instrument_declined`; it sends PayPal-Mock-Response. Retry via the existing same-order approval flow. PayPal's documented v5 immediate recovery uses `actions.restart()`; our result-page/redirect recovery and negative-testing recapturability still require a real Sandbox acceptance run. Do not claim E passed against PayPal until observed.
6. Exercise redirect/cancel, payment PENDING if available, webhook delivery/retry, expired approval and an interrupted capture in a controlled Sandbox session.

The latest continuation verified real OAuth, creation, order GET, persisted recipient and duplicate/replay behavior. Buyer approval/capture and genuine signed events remain pending; earlier implementation-time lack of credentials is historical. Automated HTTP stubs and fake lifecycle tests remain separate from real provider evidence.

## Account limitations

All fictional merchants are purchase labels. This app receives payments into its one configured Sandbox business account. It does not buy goods from those third-party merchants or forward funds to them. Arbitrary third-party payouts, marketplace onboarding, partner auth assertions, vaulting, unattended agent spending, production payments, refunds and disputes are outside this standard merchant integration. Supported alternative: demonstrate controlled purchase approval and payer-present checkout into the app's own Sandbox merchant.

Demo reset removes only unpaid requests without any payment records. It preserves payment history, webhook dedupe and the append-only ledger, and clears cached demo responses for removed requests so fixed demo keys can be reused. It never seeds invented successful PayPal transactions.

## Official references checked 2026-11-03

- [PayPal checkout integration](https://developer.paypal.com/checkout/integrate): client/server split and Sandbox negative-testing setup.
- [Orders v2](https://developer.paypal.com/docs/api/orders/v2/), [create](https://developer.paypal.com/api/orders/v2/orders-create), [capture](https://developer.paypal.com/api/orders/v2/orders-capture): supported operations, representation responses, ownership fields and statuses.
- [Orders integration use cases](https://developer.paypal.com/api/rest/integration/orders-api/api-use-cases/advanced/): idempotency usage and retention. The implementation deliberately caps automatic ambiguous replay at five hours and does not assume indefinite provider retention.
- [Funding failure recovery](https://developer.paypal.com/v5/checkout/handle-funding-failure/): restart payer approval after INSTRUMENT_DECLINED.
- [Webhook verification](https://developer.paypal.com/api/rest/webhooks/rest/): verification endpoint and Sandbox certificate URL.
