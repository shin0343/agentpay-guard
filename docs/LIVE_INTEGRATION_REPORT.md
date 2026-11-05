# Live integration verification report

Latest verification: 2026-11-05 UTC / 2026-11-04 America/Los_Angeles.
Baseline: `19cd3a79a12327c679afb1ea6242086d671a396f`.

**Verdict: NOT READY. Meta inference is now genuinely verified.** PayPal Sandbox
OAuth returned `401 invalid_client`; merchant configuration and signed webhook
delivery remain unavailable. No real order, payer approval or capture is claimed.

## Current Meta verification

The existing fetch-based Responses client now supports explicit Meta selection,
MODEL_API_KEY and Standard `muse-spark-1.3`. No SDK/dependency or frontend change was
needed. Four final actual Meta evaluations completed through GuardService and
PostgreSQL: normal 5/ALLOW, unusual 65/REVIEW, hard-policy blocked 95/BLOCK, and
description injection 82/REVIEW. The provider-reported model, validated response
IDs and `r-3-meta-1` are recorded; the 21-event ledger verified, with no payment rows.
An additional real `risk:verify` exited 0 without changing the persisted decision.

Two actual integration problems were diagnosed: low reasoning exceeded the existing
eight-second budget on complex inputs; and model evidence paths included the
`untrusted_purchase` wrapper, which the server correctly rejected. Meta now uses
official minimal reasoning and a canonical-path/paired-null schema. The shared
grounding validator and all payment protections remain unchanged. Earlier failures
are retained and are not passing acceptance results.

Detailed sanitized references, timestamps, commands and scope are in
[META_MODEL_API_INTEGRATION.md](META_MODEL_API_INTEGRATION.md).

## Current environment and PayPal boundary

The supplied `.env.local` is ignored, untracked and owner-readable only. MODEL_API_KEY
works. The supplied PayPal ID/secret were sent only to Sandbox OAuth at
`2026-11-05T04:39:56.562Z`; HTTP 401 / invalid_client was returned. No access token
was logged or saved. The pair was preserved, not replaced by a claimed working key.
PAYPAL_MERCHANT_ID and PAYPAL_WEBHOOK_ID are missing; no public HTTPS listener exists.
The account owner was asked to correct the Sandbox app pair and supply merchant ID.

Missing nonfinancial settings were completed locally: explicit Meta/model selection,
loopback APP_URL, isolated local PostgreSQL, private session secret and distinct demo
passcodes/agent key. Only the probe-created local research-agent disabled key was
provisioned with a hash. No historical financial state or authorization logic changed.
Application configuration remains strict: missing merchant prevents API
initialization. No merchant ID was invented. No public listener, tunnel or deployment was made.

## Current regression and display checks

Typecheck, lint, **166 tests** (zero failed/skipped, including 20 Meta and five actual
PostgreSQL tests) and production Webpack build passed. Payment service, policy,
authorization, state transitions, PayPal client, migrations and frontend source
remain identical to `19cd3a7`; the ambiguous-capture fix is preserved.

Existing desktop/mobile E2E passed against a separate explicit regression environment:
actual local Next/PostgreSQL routes, fixture AI and intercepted payment/SDK boundaries.
Those results are not genuine PayPal or Meta acceptance. Recorded genuine Meta
evaluations were also checked through the unchanged frontend with intercepted GET
display responses; that boundary is labelled on screenshots. It verifies rendering
of real model/score/explanation data, not the incomplete production-runtime path.
The final recorded-data run passed 8 desktop/mobile checks with 12 screenshots and
zero runtime errors/overflow. Initial exact-text selectors were corrected to match
the existing model metadata line and combined `score / 100`. Screenshot inspection
also caught a missing `object:list` in the display driver's list envelopes; that
driver was corrected and now asserts ledger loading and no inline contract errors.
No application contract or UI was altered.

Final suite command (private connection replaced by placeholder):

```sh
pnpm typecheck
pnpm lint
APG_POSTGRES_TEST=true TEST_DATABASE_URL='<disposable-regression-DB>' \
  pnpm exec vitest run --reporter=json --outputFile=qa/meta-live/regression-tests.json
pnpm build:webpack
```

Ignored `qa/meta-live/` retains actual provider diagnostics, initial/final risk
evidence, CLI output, regression JSON/build logs and browser results. No provider
key, OAuth token, raw provider body or hidden reasoning is included in committed
evidence. See [AI verification](AI_INFERENCE_VERIFICATION.md),
[Sandbox evidence](SANDBOX_TRANSACTION_EVIDENCE.md) and
[readiness](RELEASE_READINESS_UPDATE.md). Genuine payment/webhook gates remain open.

## Historical Step 6.5 record (03:41–04:02 UTC)

The following is the earlier `a4311c9` → `19cd3a7` verification, retained for history.
Its missing-key/zero-inference observations are superseded by the Meta evidence above.

### Environment diagnosis

Initial check: `2026-11-05T03:41:33Z`. The working tree was clean at `a4311c9`.
Read the security audit, threat model, test evidence, release blockers, PayPal,
AI and state-machine documentation and inspected runtime, configuration, adapter,
capture/reconciliation, shared schemas and verification scripts before any build.

| Requirement | Observed availability | Smallest remaining action |
|---|---|---|
| Sandbox client ID | Missing from process/project configuration | Set PAYPAL_CLIENT_ID privately |
| Sandbox client secret | Missing | Set PAYPAL_CLIENT_SECRET privately |
| Sandbox business merchant | PAYPAL_MERCHANT_ID missing; account access not supplied | Use a business account and its Sandbox REST app; configure its merchant ID |
| Personal Sandbox payer | No authenticated payer access supplied or verified | Account owner signs in to checkout as a separate personal buyer |
| Webhook | No WEBHOOK_ID, public HTTPS APP_URL or registered listener available | Register the same app's HTTPS listener, set PAYPAL_WEBHOOK_ID and verify genuine delivery |
| AI provider | OPENAI_API_KEY and RISK_PROVIDER missing | Configure RISK_PROVIDER=openai and an account-authorized key/model |
| Database | No supplied DATABASE_URL; existing local PostgreSQL accepts connections | Local isolated verification DB created/migrated successfully; configure the acceptance DB separately |
| Running app | No AgentPay Guard listener initially; port 3000 belonged to another project | Ran this app on loopback port 3100 using the existing build first; unrelated app left untouched |

Only `.env.example` existed, including at the final `04:01:55Z` recheck. No private
configuration values were printed. The account owner was asked to configure
gitignored `.env.local` and perform the payer login; no configuration was available
during the recorded verification. Do not send API secrets or passwords in chat.

Unauthenticated official endpoint probes at `03:44:38Z` returned HTTP 401 from
Sandbox OAuth and OpenAI `/v1/models`. They establish TLS/HTTP reachability only;
no credentials, payment operation or inference were sent. No attempt was made to
extract credentials from unrelated projects, browser profiles or a keychain.

### Executed verification

Created a separate disposable local database, applied the existing migration and
used generated local-only session/agent credentials in ignored files. PayPal
configuration was explicitly nonfunctional; it was never acceptance credentials.
First ran `RISK_PROVIDER=openai` without a key, then explicitly labelled fixture
mode for the existing browser regression suite. No payment was initiated at PayPal.

| Check | Result / evidence boundary |
|---|---|
| Typecheck and lint, final source | Passed |
| Full unit/integration suite | 146 passed, zero failed/skipped, 13 files; five actual PostgreSQL checks |
| Payment state-machine/recovery checks | Passed within that suite, including real 15-second adapter timers with controlled transport and fresh-client PostgreSQL recovery |
| Webpack production builds | Passed for live and explicit mock modes; final build restored live mode |
| Actual Next/PostgreSQL desktop/mobile E2E | Passed; fixture AI and explicitly intercepted payment/SDK boundaries; 37 screenshots |
| Required mock visual A–E walkthrough | Passed, `errors: none`; 24 desktop and 23 mobile screenshots |
| Final accessibility checks | Passed; 12 desktop/mobile axe scans, zero reported WCAG A/AA violations |
| Missing-key application/browser checks | Policy passes → IN_REVIEW; pre-review checkout 409; missing CSRF/agent checkout 403; blocked/semantic duplicate denied; zero public payment rows |
| Human approval separation | After actual reviewer route approval, ALLOWED with no payment; UI explicitly Not paid and payer key waiting |
| Genuine PayPal order / capture / signed delivery | **Not executed** |
| Genuine OpenAI inference | **Not executed**; missing-key diagnostics recorded attempts=0 |

Final unit/integration run began at `2026-11-05T03:53:03.955Z`. Commands executed:

```sh
pnpm typecheck
pnpm lint
APG_POSTGRES_TEST=true TEST_DATABASE_URL='<isolated-local-DB>' \
  pnpm exec vitest run --reporter=json --outputFile=qa/live-integration/regression-tests.json
NEXT_PUBLIC_API_MODE=mock pnpm build:webpack
NEXT_PUBLIC_API_MODE=live pnpm build:webpack
```

The connection value above is redacted; the actual run used the newly migrated
local verification DB. Private runtime settings are deliberately omitted.

`scripts/frontend-qa.cjs`, `scripts/visual-qa.cjs` in both desktop/mobile modes,
and `scripts/frontend-accessibility.cjs` ran with scratch Playwright/axe modules,
loopback BASE and private generated passcodes. The separate `/tmp` browser driver
checked the actual missing-key path; its final evidence timestamp is
`2026-11-05T03:58:40.112Z`. No test dependency was added to the project.

The initial temporary browser driver confused scenario A's fixed-key replay with
a new-key semantic duplicate. It was corrected to use `d_duplicate`; application
policy was unchanged. A temporary CJS driver inside ignored `qa/` also caused one
lint failure; it was moved to `/tmp`, after which final lint and tests passed.
These harness failures are not provider or application success results.

Turbopack's established worker/port restriction was not retried in this step;
the requested acceptable Webpack build path was used. No dependencies were added.
Local artifacts live under ignored `qa/live-integration/`: final test JSON, build
logs, browser results/screenshots, read-only history summaries and reachability
results. They are not guaranteed to exist in a fresh clone.
The verification server was stopped after checks, and generated local-only
credentials were removed. Existing PostgreSQL and the unrelated application were
left running. No supplied project configuration was overwritten.

### Targeted correction

Observed a P2 explanation error: an unavailable assessment correctly required
review, but the trace and focused review said the AI had raised a concern. Both
now say **“Rules passed. AI analysis is unavailable, so a person decides.”** for
noncompleted assessments. Completed assessments retain the existing concern copy.
Strings and the shared selector live in `src/lib/copy.ts`. No layout, styling,
decision computation, authorization or server/payment state transition changed.

The final missing-key browser check asserts this explanation on request/review
screens, checks mobile overflow, and confirms human approval still cannot imply
Paid. Representative screenshots are linked in
[AI verification](AI_INFERENCE_VERIFICATION.md). The entire `src/server/`,
`migrations/`, dependency graph and automated test source remain identical to
`a4311c9`, including the ambiguous-capture correction.

### Historical-state investigation

At `03:43:14Z`, before new tests, inspected the four known project-local databases
in explicit read-only transactions. Provenance was cross-checked at `03:44Z`.

| Database | Schemas inspected | Public payment rows | Test payment rows | FAILED/EXPIRED | CAPTURING/PENDING |
|---|---:|---:|---:|---:|---:|
| apg_frontend_qa | 3 | 0 | 4 | 0 | 0 |
| apg_guard_smoke | 1 | 0 | 0 | 0 | 0 |
| apg_guard_test | 11 | 0 | 20 | 0 | 0 |
| apg_security_audit_20261104 | 6 | 0 | 8 | 0 | 0 |

All 32 payment rows were in generated test schemas and matched `ORDER<n>`,
`CAPTURE<n>`, `DIFFERENTORDER` or `PGRECOVEREDCAPTURE` from the existing tests.
Seventeen were simulated COMPLETED records. There were zero terminal-after-unknown
candidates or malformed completed references. Ten events labelled provider=openai
all used the stub response ID `resp_test001`; they are not live inference evidence.

**Historical P1: NOT APPLICABLE to the inspected local data.** No relevant real
financial history was found. Git had zero remotes and no tracked deployment/CI/IaC
or project deployment metadata was present. That does not prove no deployment
exists elsewhere: no external deployment inventory or financial DB was supplied.
If an earlier deployment is later identified, its history remains unassessed.

For that case: obtain a read-only DB snapshot; select terminal failures/expiries
following unknown attempts/events and malformed completed references; group by
stored order/request/attempt ID; GET each order using its original Sandbox app;
compare merchant, amount, currency and captures; then propose an auditable,
case-specific repair for review. Do not clear claims, resubmit purchases or run
capture automatically. `POST /reconcile` is **not** a read-only historical probe:
it may resend an eligible original capture. No historical states were rewritten.

Next steps and exact acceptance criteria:
[Sandbox evidence/runbook](SANDBOX_TRANSACTION_EVIDENCE.md),
[AI verification/runbook](AI_INFERENCE_VERIFICATION.md),
[readiness update](RELEASE_READINESS_UPDATE.md).
