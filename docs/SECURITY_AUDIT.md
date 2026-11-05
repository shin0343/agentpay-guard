# Security audit

Current integration update (2026-11-05T17:12Z): genuine Meta, USD 18.00 completed capture, original signed approval/completion webhooks, supported provider resends and actual desktop/mobile Paid UI are VERIFIED. Verdict READY WITH DISCLOSED LIMITATIONS for the controlled local Sandbox workflow; see RELEASE_READINESS_UPDATE.md and SANDBOX_TRANSACTION_EVIDENCE.md. The original audit/QA findings and historical NOT READY verdict below retain their original dated scope.

2026-11-04 · Baseline: `5838bd1` · Scope: the tracked repository, including
contracts, route handlers, services, payment adapter, policy/risk engines,
PostgreSQL migration, authentication, frontend boundary and tests.

**Release verdict: NOT READY.** The confirmed P1 code defect is fixed and its
regressions pass. Genuine PayPal Sandbox payment/webhook acceptance has not been
performed because no application credentials, merchant account configuration or
payer access were supplied. Live AI acceptance is also unverified. See
[release gates](RELEASE_BLOCKERS.md) and [executed evidence](TEST_EVIDENCE.md).
This verdict concerns a public payment demonstration/release, not permission to
run the clearly labelled local fixture demonstration.

## Method and evidence limits

Reviewed the documented contracts against actual handlers and state transitions;
ran adversarial HTTP/service/adapter tests, actual PostgreSQL concurrency and
restart tests, and desktop/mobile browser flows. Candidate duplicate, settlement
and AI findings received separate skeptical verification. Confirmed behavior was
distinguished from an attacker-reachable exploit and from provider-only corruption.
No production database, deployed ingress, cloud account or real payment was
available for inspection. All payment provider responses in executed tests were
controlled doubles; genuine provider behavior is not inferred from them.

Final checks: **146/146 tests passed**, including five actual PostgreSQL tests;
typecheck, lint and Webpack production build passed. Standard Turbopack build
failed on the environment's worker/port restriction, including an escalated retry.
Browser assertions passed and 12 axe scans reported zero violations. These are
bounded observations, not proof that every possible attack is prevented.

## Findings

P0 means direct critical compromise; P1 means material payment correctness or
authorization failure; P2 means a bounded reliability/control weakness; P3 means
lower-impact consistency debt. Confidence describes the reproduced application
behavior, not the likelihood of a particular PayPal response in the wild.

| ID | Severity | Finding | Status | Confidence |
|---|---|---|---|---|
| S-01 | P1 | A failed replay terminalized an earlier unknown capture | Fixed | High |
| S-02 | P2 | Empty/whitespace capture IDs could become terminal payment evidence | Fixed | High |
| S-03 | P2 | Contradictory VOIDED order/completed capture asserted an unpaid expiry | Fixed | High |
| S-04 | P2 | Equivalent money/item representations bypassed duplicate rule P-07 | Fixed | High |
| S-05 | P2 | Webhook reserialization changed the signed event representation | Fixed; real provider acceptance pending | High locally |
| S-06 | P3 | A delayed GET could overwrite completed payment metadata | Fixed | High |
| D-01 | P2 maintenance | Moderate advisory in development-only minimatch | Disclosed; open | High dependency presence; no runtime exploit demonstrated |

### S-01 — An unsuccessful replay is not evidence that the original capture failed

**Reproduction:** Create an allowed request and payer-approved order. The first
capture is accepted by the controlled transport but its response exceeds the
actual `SandboxPayPal` 15-second timeout. GET still returns APPROVED. Reconciliation
replays the same `PayPal-Request-Id`; the transport returns HTTP 409 while the
original operation remains in progress. Baseline code changed the attempt to
failed, payment to FAILED and request to PAYMENT_FAILED. When the original capture
subsequently completed, reconciliation skipped the terminal payment; a completion
webhook also could not recover it. No clock, lease or database mutation was needed
to trigger the original failure.

**Impact:** The financial ledger and frontend could permanently assert an unpaid
failure after money was captured. This is P1 payment correctness even though the
test did not demonstrate a second debit or a direct authorization bypass. Generic
409 was not a retryable fresh-checkout failure; no such path is claimed here.

**Remediation:** In `src/server/service.ts`, preserve CAPTURING/unknown after any
failed replay of an unknown attempt and after HTTP 409. Keep the original attempt
and provider request ID, apply a 60-second retry lease, and allow verified reads
to settle it. Do not allow cancellation or a replacement attempt while ambiguous.

**Verification:** `security-settlement.test.ts` uses the real adapter timeout with
a controlled HTTP transport, tests generic 409 and an issue-bearing variant,
checks replay backoff, and recovers through GET or a verified-webhook double.
HTTP 400/403/422/429 on unknown replays also remain unknown. The new actual
PostgreSQL test proves recovery across fresh clients without another capture.
All pass. PayPal documents that simultaneous requests sharing an ID can cause
the second to fail; Orders capture lists HTTP 409. The issue string
`PREVIOUS_REQUEST_IN_PROGRESS` in a test is an extra defensive variant, not a
claim that Orders guarantees that issue.
[PayPal idempotency](https://developer.paypal.com/api/rest/reference/idempotency/),
[Orders capture](https://developer.paypal.com/api/orders/v2/orders-capture).

### S-02 — Malformed capture identifiers became final evidence

**Reproduction:** A controlled completed-order response with correct ownership,
amount and currency but capture ID `""` or `" "` passed the old capture schema.
The backend persisted PAID/COMPLETED; whitespace could also satisfy the frontend's
truthy capture-reference check. Terminal reconciliation then skipped repair.

**Impact:** False or unusable final payment evidence under a malformed provider
response. Ordinary clients cannot supply this field, so this is P2 provider-boundary
integrity, not a demonstrated malicious-agent payment bypass.

**Remediation:** Validate capture IDs at both adapter parsing and settlement
validation with the application's existing uppercase alphanumeric provider-ID
convention, length 1–36. This is an application acceptance restriction, not a
claim that PayPal's generic schema mandates that exact pattern.

**Verification:** Both malformed-ID regressions remain CAPTURING with no capture
reference and render Confirming; a later valid owned-order read recovers PAID.
`security-settlement.test.ts` passes. Real Sandbox ID compatibility remains an
acceptance gate.

### S-03 — Incompatible order/capture states produced false unpaid expiry

**Reproduction:** Reconcile an unknown capture against a controlled order marked
VOIDED containing a COMPLETED capture. Baseline verification accepted the pair;
the VOIDED branch marked EXPIRED/PAYMENT_FAILED and offered expiry recovery.

**Impact:** A contradictory provider response could assert that no payment was
taken and permit retry. The response was deliberately malformed; no evidence
establishes that genuine PayPal emits this pair. Severity P2, not a demonstrated
external attacker exploit.

**Remediation:** Reject captures on VOIDED orders and COMPLETED captures unless
the order is COMPLETED before settlement or expiry handling.

**Verification:** The contradictory-response regression returns 502 while the
stored request/payment remain CAPTURING, without a definitive failure or fresh
checkout. Existing amount, currency, merchant and order/request binding tests
remain passing.

### S-04 — Semantic duplicates depended on representation

**Reproduction:** Submit the same known $18 item with amount `"18.00"` and
`"018.00"`, or split two units into two otherwise identical one-unit rows.
Baseline fingerprints differed although both quotes validated, and P-07 passed.

**Impact:** A malicious agent could evade the ten-minute duplicate control.
Separate operator/payer approvals were still necessary; the verifier's controlled
payments did not demonstrate agent-only capture. Severity P2.

**Remediation:** Fingerprint canonical cents and aggregate quantities by normalized
item name. Recompute canonical fingerprints of historical requests during lookup
so legacy stored fingerprints remain protected without rewriting audit history.

**Verification:** `security-duplicate.test.ts` blocks both forms, including a
legacy fingerprint case; no PayPal creation/capture occurs. Actual PostgreSQL
concurrent duplicate/reservation tests pass.

### S-05 — Webhook postback did not retain the original signed JSON

**Reproduction:** Sign compact, indented and Unicode-escaped equivalent JSON with
a local RSA/CRC32 verifier following the documented signature input. Baseline
parsed and reserialized the event before postback: compact passed, while the
other validly signed representations failed.

**Impact:** Authentic-event rejection and delayed reconciliation. No forged
signature acceptance was reproduced; this is P2 reliability, not an authenticity
bypass. PayPal explicitly requires the received event representation to remain
unchanged for postback verification.
[Webhook verification guidance](https://developer.paypal.com/api/rest/webhooks/rest/).

**Remediation:** Preserve bounded, valid UTF-8 JSON in `GuardHttp` and embed that
original event JSON as the verification envelope's `webhook_event` object. Keep
verification at PayPal's fixed endpoint and the certificate URL allowlist. Do not
persist the raw body or log payer data.

**Verification:** Four `security-webhook.test.ts` cases pass: compact, whitespace,
Unicode escape and signed-order-ID tampering. The first three retain exact event
bytes; tampering is rejected without state changes. The verifier is local, not
PayPal. Genuine Sandbox event/postback acceptance is outstanding; PayPal's webhook
simulator does not establish postback verification support.
[Webhook simulator limitations](https://developer.paypal.com/api/rest/webhooks/rest/).

### S-06 — Delayed provider reads overwrote fresher terminal metadata

**Reproduction:** Pause a GET returning CREATED, allow a different operation to
complete capture, then release the old GET. Baseline retained PAID but overwrote
order status/failure metadata with the old payer-action result.

**Impact:** Contradictory UI/audit metadata; no second capture or reversal from
PAID was reproduced. Severity P3.

**Remediation:** Check the payment version and eligible state before applying
unapproved-read metadata; also version-check the final reconciliation write.

**Verification:** The delayed-read regression preserves COMPLETED capture/order
metadata, null failure and exactly one capture. All concurrency tests pass.

### D-01 — Development dependency advisory

**Reproduction/evidence:** `pnpm audit --json` reports one moderate advisory,
`minimatch@10.2.6`, GHSA-g3hv-75wg-m249. `pnpm why minimatch` identifies the ESLint
development graph; `pnpm why minimatch --prod` is empty and `pnpm audit --prod
--json` reports zero vulnerabilities. No application input path to the affected
glob preprocessing was found or exploited.

**Impact/remediation:** Development-tool resource exhaustion if attacker-controlled
patterns reach affected preprocessing; no confirmed payment-runtime exposure.
Upgrade compatible ESLint/minimatch dependencies when a supported graph is
available, then rerun lint/build/audit. Do not force an untested major transitive
override into this payment correction. Open P2 maintenance item, not an unresolved
P1. [Maintainer advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249).

## Authorization and trust-boundary review

All payment-changing routes go through `GuardHttp` and service checks. Cookie
mutations require signed-session-bound CSRF; authenticated POST operations require
idempotency except the documented session/webhook exceptions.

| Route under `/api/v1` | Required authority / financial constraint |
|---|---|
| POST `purchase-requests` | Agent key; strict immutable proposal, server quote and evaluation |
| POST `purchase-requests/:id/reviews` | Reviewer only, not agent owner; If-Match and IN_REVIEW required |
| POST `purchase-requests/:id/checkout` | Operator/reviewer; valid policy decision, trusted quote, eligible state |
| POST `payments/:id/capture` | Operator/reviewer; stored owned order, payer approval, valid decision/claim |
| POST `payments/:id/reconcile` | Operator/reviewer; owned-order GET verification, original attempt on replay |
| POST `payments/:id/payer-cancel` | Operator/reviewer; open payment; audit only, no settlement claim |
| POST `purchase-requests/:id/cancel` | Operator/reviewer or own agent before checkout; valid cancellation transition |
| POST `demo/scenarios/:key/run`, `demo/reset` | Operator/reviewer plus DEMO_MODE; same evaluation path; financial history retained |
| POST `webhooks/paypal` | Verified provider signature; event deduplication; owned-order GET, never payload-only Paid |

GET resources are authenticated and scoped; reads may expire an eligible policy
window but never initiate capture. Reviewer sessions intentionally include
operator abilities. A public reviewer passcode grants real Sandbox operator
authority and must not be published as an anonymous visitor credential.

No direct blocked/review capture, unauthorized/self-review, rejected-request
approval, amount mutation, cross-request order reuse, forged webhook settlement
or duplicate capture succeeded in executed adversarial tests. Concurrent claims
and database uniqueness prevent duplicate side effects within the tested model.

LLM output is schema-validated, grounded, bounded and advisory. Missing/invalid
output and deadlines require review; client-supplied assessments cannot replace
the configured provider. Injection examples cannot relax deterministic BLOCK or
create PayPal calls. The pattern screen is not exhaustive semantic protection.
Returning old metadata from a replaced trusted server assessor is not an
agent-reachable stale-output exploit; the live adapter stamps its own prompt/time
metadata. Compromised provider/server configuration remains a trust assumption,
and live-model injection accuracy was not verified without credentials.

## Repository and operational observations

- Production dependency audit: zero known advisories at run time. Full dependency
  audit: D-01 only. Lockfile is tracked. No tracked CI, deployment or IaC configuration
  was available to verify deployed secrets, ingress, permissions or build parity.
- A redacted pattern scan of 177 unique historical tracked text blobs found zero
  candidates for the tested private-key/cloud/GitHub/OpenAI/Slack token patterns.
  Gitleaks/TruffleHog were unavailable. Arbitrary PayPal secrets cannot be ruled out
  by these patterns; no secret values were printed or published.
- Parameterized SQL, serialized transactions, unique order/capture ownership,
  one-open-payment constraint, append-only audit trigger and hash chain were
  reviewed and exercised. A database superuser can still rewrite data and hashes;
  no external audit anchor is implemented.
- Demo credentials, eight-hour stateless sessions, rate-limit proxy assumptions,
  provider acceptance and historical-record review are detailed in the
  [threat model](THREAT_MODEL.md) and [release gates](RELEASE_BLOCKERS.md).
- No visual-system, frontend-source, credential, authorization-role or database
  migration changes were needed for these corrections.

This AI-assisted repository audit is bounded by the tested environment and does
not replace an independent assessment of the deployed service.
