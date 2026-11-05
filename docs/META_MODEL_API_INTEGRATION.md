# Meta Model API integration

2026-11-05 UTC / 2026-11-04 America/Los_Angeles. Baseline: `19cd3a7`.

**Integrated and genuinely verified:** Muse Spark Standard completed all four final
risk scenarios through the actual risk adapter, policy service and PostgreSQL.
**Current overall release: READY WITH DISCLOSED LIMITATIONS.** Genuine Sandbox capture and signed webhooks/redeliveries verified 2026-11-05T17:07–17:12Z; see RELEASE_READINESS_UPDATE.md. Initial credential failures described below are historical, resolved; merchant configuration is optional with persisted recipient binding.

## Implementation

The application used native `fetch`, not an OpenAI SDK. It now reuses its bounded
Responses protocol client for two explicitly selected providers. `MetaRiskAssessor`
and `createRiskAssessor` pass MODEL_API_KEY explicitly and call only
`https://api.meta.ai/v1/responses`. No SDK/dependency, frontend redesign or alternate
payment path was introduced. The shared client remains in the existing `openai.ts`
module to avoid moving/reimplementing verified parsing, timeout and retry logic.

| Setting | Behavior |
|---|---|
| RISK_PROVIDER=meta | Explicit actual Meta provider; no fallback to fixtures/OpenAI |
| MODEL_API_KEY | Server-only bearer credential, passed to the adapter constructor |
| META_RISK_MODEL=muse-spark-1.3 | Default Standard model; Contributor/alternate IDs rejected |
| Base URL | Fixed HTTPS Meta host; not selectable through purchase input or a custom base variable |
| Reasoning | `minimal`, within the existing eight-second deadline; this is separate from Standard/Contributor mode |
| Output | Strict `text.format` JSON Schema; same shared public RiskAssessment |
| Privacy | `store:false`, bounded/redacted purchase projection, no tools; no raw bodies/hidden reasoning logged |

The official [overview](https://dev.meta.ai/docs/overview) and
[quickstart](https://dev.meta.ai/docs/quickstart) identify the Standard model, base
URL and explicit key. Meta's [structured-output guide](https://dev.meta.ai/docs/structured-output)
supports Responses `text.format`; the [reasoning guide](https://dev.meta.ai/docs/reasoning)
documents the shorter reasoning setting. API/schema support does not establish
semantic accuracy or fraud-detection performance.

The original OpenAI provider remains available. Runtime and `risk:verify` use the
same factory; the latter now reads provider-only configuration so unavailable
payment credentials cannot prevent independent AI verification. Application
API initialization still requires valid payment configuration. No payment guard was relaxed.

## Confirmed integration issues and corrections

1. **Evidence-path incompatibility (P2, fixed).** Actual responses used
   `untrusted_purchase.merchant.name` and `untrusted_purchase.amount.value`.
   These are not canonical evidence paths; the existing server correctly rejected
   them as INVALID_EVIDENCE. Meta's schema now enumerates the actual allowed text
   paths and pairs context-only signals with null evidence/source. Instructions
   explicitly prohibit the wrapper prefix. Shared grounding validation remains
   unchanged; prefixed/unpaired evidence is still rejected in regression tests.
2. **Latency compatibility.** The initial `low` reasoning run completed normal A
   but hit the original deadline on three complex cases. The official `minimal`
   setting and corrected schema completed the final four cases in 2.46–6.73 seconds.
   No deadline/evaluation lease was extended. Earlier timeouts remained REVIEW or
   BLOCK, never payment authorization.
3. **Observable safe errors.** Validation failures retain allowlisted categories
   such as INVALID_EVIDENCE, without exposing provider bodies/headers. Meta audit
   diagnostics are accepted by the service boundary instead of being discarded
   as an unknown provider. Returned model identity is checked and stored.

Meta prompt version is `r-3-meta-1`; OpenAI retains `r-3`. The public contract,
deterministic combination, auth/reviewer checks, capture idempotency, ambiguity
reconciliation, database migration and entire frontend source remain unchanged.

## Genuine final acceptance evidence

Recorded `2026-11-05T04:52:12Z`–`04:52:28Z`. Model returned in each case:
`muse-spark-1.3`. Each used one actual provider attempt and a validated response ID.

| Case | Request suffix | Score / band | Persisted decision | Response suffix | Latency |
|---|---|---|---|---|---:|
| Normal $18 catalog purchase | M5GB1F | 5 / low | ALLOWED | 474f26 | 2,457 ms |
| Unusual $640 compute purchase | MQZW7C | 65 / medium | IN_REVIEW | e749d3 | 4,758 ms |
| $2,400 gift cards / hard policy block | VAB1SD | 95 / high | BLOCKED | dd4aa6 | 6,734 ms |
| Instruction in $36 item description | XAC2JX | 82 / high | IN_REVIEW | f843e1 | 4,257 ms |

The unusual case cited the auto limit, observed prior spend and non-allowlisted
merchant. The blocked case returned grounded gift-card/urgency/instruction signals;
**policy**, not AI, enforced BLOCK. The description-injection case independently
returned a model injection signal; the supplemental screen also remained active.
The original provider assessment and supplemental signals are separate in audit
diagnostics. A one-request observed median is not a calibrated behavioral baseline.

A second distinct request for the same canonical purchase was also blocked as a
semantic duplicate; API idempotency is tested separately. The probe produced zero
PayPal calls and zero payment rows; its 21-event
hash chain verified. These are genuine AI/service/database results, not a complete
authenticated browser-to-payment runtime acceptance.

An additional `pnpm risk:verify` at `04:54:40Z` exited 0 with completed genuine
Meta inference, score 5, response suffix `2646a7`, and unchanged persisted decision.
Earlier diagnostic runs are retained: one incomplete small-token connectivity
probe; three real eight-second timeouts; and rejected application evidence. They
are not counted as passing acceptance cases.

## Reproduce without payment side effects

Keep the existing private `.env.local` ignored and owner-readable only. Set the
provider/key/model as above. Create and migrate a **new disposable** PostgreSQL DB;
the proposal probe refuses to reset a nonempty request/payment store.

```sh
DATABASE_URL='<new-disposable-database>' pnpm db:migrate
RISK_PROVIDER=meta META_VERIFY_WRITE=true DATABASE_URL='<same-database>' \
  pnpm exec tsx --env-file=.env.local scripts/verify-meta.ts
DATABASE_URL='<same-database>' pnpm risk:verify preq_<stored_request_id>
# Recorded-data display verification against a live-mode build on loopback port 3100:
NODE_PATH='<scratch-playwright-node_modules>' node scripts/verify-meta-ui.cjs
```

Connection values are redacted. The probe uses the existing fictional purchase
inputs with **actual** Meta inference. PayPal is explicitly excluded by a deny-only
boundary, never simulated as successful. It writes sanitized evidence to ignored
`qa/meta-live/risk-evidence.json`, persists genuine evaluations and exits nonzero
if a required completion/safety check fails. Do not run it on a financial database.

## Regression and browser boundaries

Meta implementation suite: **166 passed, zero failed/skipped**, including 20 Meta cases and five
actual PostgreSQL checks. Typecheck, lint and production Webpack build passed.
New cases cover explicit key/host/model selection, schema path/pairing, returned
model identity, malicious instructions, malformed/incomplete/tool/refusal output,
auth/network failures, streaming deadline and bounded transient retry.

Existing desktop/mobile E2E uses explicitly labelled fixture AI and intercepted
payment/SDK responses; it passed. A separate display test renders the actual saved
Meta records through the unchanged GuardApi contract, checking model, score,
summary, review/block and absence of Paid. Its GET responses are intercepted and
screenshots label that boundary. This proves rendering of genuine records, not
full runtime acceptance with the incomplete PayPal environment.

See [live report](LIVE_INTEGRATION_REPORT.md), [AI evidence](AI_INFERENCE_VERIFICATION.md),
[Sandbox blockers](SANDBOX_TRANSACTION_EVIDENCE.md) and
[readiness](RELEASE_READINESS_UPDATE.md). No real capture or signed event is claimed.
