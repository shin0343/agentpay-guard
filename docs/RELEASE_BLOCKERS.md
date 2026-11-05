# Release blockers

2026-11-04 · **Verdict: NOT READY** for a public payment demonstration or release.

No unresolved confirmed P0/P1 code defect remains in the reviewed/tested scope
after the accompanying fixes. This verdict is nevertheless blocked by missing
external acceptance evidence, not upgraded to READY because mocked captures pass.
A controlled, explicitly labelled fixture/mock demonstration remains usable.

## Required before payment release

| Priority | Gate / owner | Exact blocker and acceptance condition |
|---|---|---|
| P1 release gate | Genuine Sandbox lifecycle · payment/release owner | No real app client ID/secret, business merchant configuration, authenticated payer access or genuine payment ID supplied. Complete actual order → payer approval → capture → independent GET verification with matching request, merchant, USD amount and capture ID. Run `pnpm sandbox:verify pay_<id>` and retain redacted provider evidence. Establish duplicate click/reconcile behavior without authorizing another capture. |
| P1 release gate, if webhooks enabled | Genuine signature/delivery · payment/release owner | No webhook ID/subscription/public HTTPS listener supplied. Deliver an actual event from the same Sandbox REST app, verify postback success and GET settlement, then resend the same event and show no duplicate side effect. Confirm the raw-event correction against PayPal itself. The simulator/local RSA double is insufficient for this gate. If webhooks are deliberately disabled, disclose that recovery requires authenticated reconciliation and verify that path with real Sandbox. |
| P1 conditional gate | Historical financial truth · backend/payment owner | No deployed database was supplied. If any deployment used the baseline capture code, inspect terminal FAILED/EXPIRED outcomes following unknown attempts, and COMPLETED records with missing/malformed capture evidence. Compare each to genuine PayPal before retrying or resubmitting. Correct records through a reviewed, auditable recovery process. No blanket reset, terminal-state rewrite or automatic resubmission was implemented. A fresh deployment can document that no such history exists. |
| P1 product acceptance gate | Genuine AI claim · AI/release owner | No OPENAI_API_KEY/account access supplied. Verify the pinned model/account, timeout/failure fallback and representative injection cases with real inference using `pnpm risk:verify preq_<id>`. Record returned provider diagnostics without secrets. Until then advertise only simulated AI or human-review fallback; do not claim genuine AI validation. A release explicitly scoped to unavailable/fixture AI must disclose that limitation. |

The first two gates are evidence requirements, not assertions that a new remote
authorization exploit was found. The fixed P1 defect S-01 and all confirmed
lower-priority corrections are described in [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

## Remaining issues in priority order

| Category | Priority | Remaining issue / next action |
|---|---|---|
| Integration | P1 | Complete the real Sandbox and genuine-AI gates above; no real payment, live SDK funding recovery, webhook delivery or model inference is claimed. |
| Backend | P1 conditional | Review historical ambiguous terminal payments before allowing old deployments to resubmit; new code does not automatically repair prior financial records. |
| Release/build | P2 | Standard `pnpm build` failed locally on a Turbopack worker/port restriction even after escalation. Webpack production build passed. Run the standard target and full suite in deployment/CI; no tracked CI configuration was supplied to verify parity. |
| Tooling | P2 | Development-only minimatch advisory GHSA-g3hv-75wg-m249 remains. Upgrade through a compatible dependency graph and rerun lint/build/audit; production audit was clear at execution time. |
| Backend/operations | P2 | Shared demo passcodes, eight-hour stateless sessions without individual server revocation, single global DB lock and caller/webhook-driven reconciliation limit public production use. For a controlled demo keep privileged credentials private, use HTTPS and retain a reconciliation owner. No production IAM/scaling feature was added. |
| Design | P2 acceptance | Confirm real PayPal hosted/SDK return, decline and funding-recovery UX on desktop/mobile with actual accounts. Controlled browser screens passed; no visual redesign or confirmed design P0/P1 was identified in this audit. |

Before exposing the demo, configure private distinct operator/reviewer passcodes,
a strong server-only session secret and Sandbox-only credentials. Confirm HTTPS
cookie behavior and ingress configuration. Enable `TRUST_PROXY` only behind an
ingress that overwrites forwarded headers. Publishing reviewer credentials gives
visitors reviewer/operator authority by design. Keep anonymous demonstrations in
clearly identified mock mode. These are deployment conditions already reflected
in the configuration contract, not claims that the supplied local configuration
contains a leaked credential.

## Exit evidence

The release owner should attach the deployed commit/build result, redacted real
order/capture/merchant/amount comparison, payer/return screenshots, verified event
and replay results when applicable, AI acceptance or explicit simulation scope,
and the historical-record disposition. Rerun the full PostgreSQL-enabled suite
and browser flows if acceptance changes code. Never resolve an unknown capture
by treating an HTTP error, approval or order creation as proof of failure/success.

See [TEST_EVIDENCE.md](TEST_EVIDENCE.md) for the commands already executed and the
exact external-access blockers. READY must not be issued while a P0/P1 defect or
an applicable P1 release gate remains unresolved.
