# AI risk engine

AgentPay Guard uses an advisory model to interpret purchase context. The deterministic
policy engine remains the only source of enforceable purchase decisions. Payer approval
is a separate PayPal action. A model receives no tools, payment credentials, database
connection, reviewer credential or capture capability.

## Runtime and configuration

```dotenv
RISK_PROVIDER=meta
MODEL_API_KEY=<server-only credential>
META_RISK_MODEL=muse-spark-1.3
```

Meta Model API is the preferred actual provider. `MetaRiskAssessor` explicitly
passes MODEL_API_KEY to the shared Responses client, pins `https://api.meta.ai/v1`,
and accepts only Standard `muse-spark-1.3`. It uses minimal reasoning within the
same eight-second budget and strict `text.format` schema. Canonical text evidence
paths are enumerated; context evidence/source must both be null. Returned model
identity is checked and recorded with prompt `r-3-meta-1`. No payment policy changes.
See [META_MODEL_API_INTEGRATION.md](META_MODEL_API_INTEGRATION.md) for genuine results.

OpenAI remains available with RISK_PROVIDER=openai, OPENAI_API_KEY and
OPENAI_RISK_MODEL (default gpt-4o-mini-2024-07-18). Its original prompt is `r-3`.

OpenAI's model is configurable; choose a structured-output-capable model available to the
account. Its pinned default is a compatibility baseline, not a claim about current
model quality or optimal pricing. Empty/missing API credentials produce unavailable
risk and human review. Unknown provider names fail configuration validation.
`RISK_PROVIDER=fixture` requires `DEMO_MODE=true`; it never silently replaces a failed
real provider. `unavailable` deliberately disables inference.

`OpenAIRiskAssessor` makes actual HTTPS requests to the fixed
`https://api.openai.com/v1/responses` endpoint. It sends `store: false`, an output token
budget, versioned system instructions (`r-3`), and `text.format` with strict JSON Schema.
There are no tools or user-selectable API hosts. Redirects are rejected.

The implementation follows the official [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)
and [Responses create reference](https://developers.openai.com/api/reference/resources/responses/methods/create).
Structured output constrains format; it does not prove truthfulness or prevent all injection.

## Context supplied to the model

| Context | Source and limitations |
|---|---|
| Amount and limits | Integer cents/decimal money; server policy rules and configured policy parameters |
| Agent identity and purpose | Authenticated agent registry; authorized categories and optional server-defined purpose |
| Merchant | Request name/domain/category, server allowlist membership and trusted catalog match; no invented reputation lookup |
| Description and justification | Redacted purchase fields, explicitly untrusted |
| Behavior | Same-agent prior attempted amounts, median, ten-minute attempt/denial counts and reserved daily spend |
| Repetition | Duplicate policy result, same-merchant attempt counts, bounded recent status/amount facts |
| Instructions | Model analysis plus a separately identified conservative instruction-pattern screen |

History aggregates describe observed attempts, including denied attempts; the median is
not a population baseline. Missing history stays null. At most ten recent factual rows
are sent, without other requests' descriptions, owner IDs, key hashes or payer identities.
A category/purpose mismatch is explainable from supplied facts; the model cannot update
the registry. Limits still come from the deterministic policy implementation.

## Validated output and interpretation

The model may produce only `score`, `recommendation`, `signals`, and `summary`. The
schema derives from shared `RiskSignal` and uses strict objects, bounded strings/arrays,
known enums and an integer score in 0–100. Unknown properties, including `authorize`,
`amount`, tools or payment commands, invalidate the result. Local Zod validation runs
both at the HTTP adapter and service trust boundary.

The server derives the band: low <35, medium 35–69, high ≥70. A warn/high signal or
medium/high score must recommend review. Quotes must exist in the referenced purchase
field; context-only signals use null evidence/source. Empty explanations, forged field
paths, inconsistent values and selected unsafe output claims are rejected. Refusals,
truncation, extra messages, tool output, invalid JSON and responses over 64 KiB fail safe.

The public `RiskAssessment` contract is unchanged. It returns status, score/band,
specific signals, explanation, recommendation, provider-reported model, prompt version,
latency and assessment time. `recommendation=none` means no additional model concern;
it grants no financial authority. Scores are **subjective triage indexes**, not calibrated
fraud probabilities, accuracy claims or validated confidence estimates.

The supplemental pattern screen checks all free-text fields, including item descriptions,
merchant fields, references, SKU and metadata. It normalizes common zero-width/Unicode
variants. A detected instruction pattern, or a model-reported injection signal, imposes
a conservative score floor of 70 and review recommendation for completed assessments.
On model failure, deterministic signals remain visible with a null score. This screen is
an incomplete heuristic and may produce false positives. It is not validated fraud
detection. It cannot permit a request or bypass policy.

Audit diagnostics retain the original validated `provider_assessment` and separate
`deterministic_signals`, so a model score of 12 raised to 70 by the screen is explainable.
No raw model payload or hidden reasoning is persisted. The public score is the final
advisory assessment after these conservative checks.

## Enforcement and recovery

```text
policy BLOCK  → BLOCK, regardless of risk; no PayPal call
policy REVIEW → REVIEW, regardless of risk; reviewer required
policy ALLOW  + completed low risk without concern → ALLOW
policy ALLOW  + concern, invalid output or unavailable AI → REVIEW
```

An approved review grants only the policy key. Checkout and capture still require an
operator session, trusted persisted quote, unexpired approval, owned PayPal order,
matching amount/currency/payee/request IDs and verified payer approval. Agents cannot
review, start checkout or capture. AI never changes the amount, recipient or payment state.

A P-07 duplicate skips inference and blocks deterministically. Identical API idempotency
replays never evaluate again. Nonduplicate blocked requests are evaluated for explanatory
purposes; their policy result cannot change.

The model adapter has one eight-second wall-clock budget, including response body reads
and retry delay. It aborts transport on timeout. A transient HTTP 429/5xx gets at most one
retry after 150 ms within that same budget; auth errors, invalid output and refusals are
not retried. Network failures fall directly to review. Successful retries retain failure
codes, attempt counts and timestamps in audit diagnostics.

Evaluation uses two short database transactions around external I/O. The first persists
EVALUATING, the policy snapshot and a ten-second evaluation lease. In-flight proposals
reserve budget and participate in duplicate detection. No network call holds the global
PostgreSQL advisory lock. The final transaction validates the claim/state, saves risk,
combines policy, transitions and checkpoints the idempotent response atomically.

A lazy read or mutation after the lease expires settles an abandoned evaluation with
unavailable risk and its saved deterministic policy. Late model answers cannot overwrite
the resulting decision. The idempotency row retains its resource ID across retry-lease
recovery, so a crash after initial persistence cannot create another request. No detached
serverless background task is required. Recovery occurs when the request is next accessed.

PayPal creation retries reuse `ord_<payment_id>`; ambiguous captures retain CAPTURING
and the original `cap_<payment_id>_<attempt>`. Reconciliation verifies the owned order
before replaying the same attempt. A confirmed funding decline may use a fresh capture
attempt after the existing checkout recovery flow. No new attempt is allocated for an
unknown result. Capture recovery does not initiate payment after policy approval expires.

## Persistence, privacy and observability

Existing PostgreSQL JSONB request/payment rows persist the policy version, evaluation,
decision and review; the existing append-only, hash-chained audit table persists transitions.
No migration is needed for additional document fields. Audit records include request
versions, current and original correlation IDs, safe failure/retry data, risk diagnostics,
reviewer action and redacted note, PayPal order/capture IDs and verified statuses. Captured
status is recorded only after the existing order/payee/amount verification succeeds.

Three additive audit types describe checkout uncertainty, unknown capture outcome and
retry requests. They do not imply payment completion. Both application retries and
runtime adapter create retries are observed. Failed evaluations emit `risk.unavailable`.

Free text is redacted before persistence/model submission, as are model explanations and
reviewer notes. Common bearer/API tokens, credential-labelled values, emails and card-like
numbers are removed. Model input is assembled from an allowlisted projection. Upstream
error bodies, authorization headers, cookies, OAuth tokens and payer objects are excluded.
The raw request is used only for validation/idempotency digest/fingerprint computation;
these hashes do not retain raw text. This is best-effort minimization, not comprehensive
DLP: do not submit credentials or personal financial data in purchase descriptions.
`store: false` does not make a claim about all provider-side retention policies.

The hash chain detects later edits relative to a trusted head; it is not externally
anchored and does not protect against a database administrator rewriting the entire chain.
The current database adapter remains a single-organization baseline with a serialized
ledger and full document loading; large-scale/multitenant operation needs further work.

## Audit table integration decision

AG Grid was evaluated against the existing ledger requirements. The ledger already
supports search, event/state/date filters, expanded evidence, CSV and hash verification.
Adding a grid provides no necessary capability for this scope and risks changing the
established mobile/table design. No sponsor dependency was added. This is an architectural
fit assessment, not an AG Grid implementation or performance benchmark.

## Verification boundaries

See [DEMO_VERIFICATION.md](DEMO_VERIFICATION.md) for repeatable scenarios and live checks.
Automated AI tests exercise the actual adapter with stub HTTP responses. They validate
control flow and schemas, not the semantic quality of a live model. A separately configured
`pnpm risk:verify preq_<id>` performs genuine inference against a stored, nonduplicate
request, prints sanitized evidence and never changes its persisted decision or calls PayPal.
Neither fixture scores nor stub-transport tests establish fraud-detection accuracy.
