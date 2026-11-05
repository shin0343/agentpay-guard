# Step 7 handoff — Claude Opus 5.5

**READY WITH DISCLOSED LIMITATIONS. Recommend proceeding to Step 7.**
Step 7 has not been started. Verified product implementation commit:
**9ddace48c0b055934426063c86b75dc3cc5602ef**; later commits update evidence only. Final evidence-commit hash is
reported in the agent's completion response. Never change payment/security logic
merely to improve presentation. Read AGENTS.md, DESIGN_SYSTEM.md, UX_BLUEPRINT.md
and FRONTEND_HANDOFF.md; preserve Ledger Instrument and GuardApi boundaries.

## Genuine acceptance now complete

- Actual Meta Model API Standard muse-spark-1.3, score 5, all eight deterministic
  rules pass for USD 18.00. Earlier real unusual/review, policy block and injection
  assessments remain in AI_INFERENCE_VERIFICATION.md. AI cannot loosen policy.
- Actual separate Sandbox Personal buyer/test-card approval. Order
  2UE55412FX0764120; capture 32E66103YN1557633, USD 18.00 COMPLETED.
  Request preq_01M6PAT02AJK7SF54JHJ7W5CQ8; payment pay_01M6PAT2X22DG00DS19BWZBPZA.
- Existing authorized backend captured within policy TTL; independent provider/DB
  verifier exit 0. Terminal repeated capture returns same ID, one attempt/capture.
- Genuine CHECKOUT.ORDER.APPROVED event WH-3L457725DB258725S-9D926970GM508220C and
  PAYMENT.CAPTURE.COMPLETED event WH-4FB93280BR311460T-8A339730AG632664K; originals + PayPal-supported
  resends HTTP 200. Independent real postback SUCCESS for all four signed receipts.
  Correct order/capture/dedupe/audit mapping, no downgrade/additional capture.
- Actual desktop/mobile request/payment screens Paid, capture reference and both
  keys granted. Four screenshots; representative desktop-payment/mobile-request
  visually inspected. 106-event audit chain valid, one completion event.
- 193 tests pass, six real PG checks, typecheck/lint/Webpack build pass. Controlled
  tests and earlier fixture E2E are not mislabelled as genuine provider failures.

## Demonstration flow and account separation

Sign into AgentPay Guard at /login with the private operator passcode **before**
checkout. Use real Meta mode for provider claims. Agent proposes trusted catalog
purchase → policy/model trace → reviewer if required → checkout → Sandbox Personal
buyer (separate from seller) → test funding source → Pay Now → guarded capture →
Paid → ledger. A direct approval URL in a browser without app session may return
to operator sign-in; that is normal app authorization, not another PayPal password.
Never publish passcodes or ask for real card information.

A is the genuinely paid low-risk flow. B requires reviewer (independent owner,
If-Match); C deterministically blocks. D demonstrates replay/duplicate guard.
E decline/recovery is supported controlled fixture/provider-negative-test behavior;
**not** verified as a natural real funding decline. Demo modes must remain labelled.
No invented paid history, reset of financial records or automatic fixture fallback.

## Useful routes

- /requests and /requests/{id}: immutable proposal, policy/model explanation, two keys.
- /review and /review/{id}: authorized human decision.
- /requests/{id}/checkout: official PayPal button/redirect fallback.
- /checkout/return and /checkout/cancel: protected capture/recovery or abandonment.
- /payments/{id}: actual capture, attempts, references/reconciliation.
- /ledger and /policies: persisted audit and deterministic controls.
- API prefix /api/v1; capture/reconcile use stored payment IDs, not browser order tokens.
- Public POST /api/v1/webhooks/paypal; no public operator/session/admin route.

## Restarting development webhooks

Existing registration ID **12968018AN5251707**, wildcard subscriptions preserved.
Last successful callback **https://magnificent-sword-adjustable-exchanges.trycloudflare.com/api/v1/webhooks/paypal** was deliberately shut down after proof
at 2026-11-05T17:13:14.404Z. Start scripts/webhook-tunnel-proxy.ts (loopback3102) and a new
cloudflared Quick Tunnel to it; obtain the actual new URL, PATCH only /url on this
same Sandbox registration, GET verify and test public unsigned 400/admin 404.
Do not reuse the offline recorded hostname or create duplicate registrations.
ngrok is installed but lacks auth; account-free Cloudflare works without user setup.
Original signed receipts contain payer PII: ignored private qa files only, never Git.

Retain all disclosed limits in RELEASE_READINESS_UPDATE.md: temporary hosting,
demo IAM/global-lock scaling, real rare-failure acceptance limits, ignored-event
audit detail, dev dependency advisory and Webpack-only local validation. Do not
push, deploy, publish or submit without separate explicit authorization.
