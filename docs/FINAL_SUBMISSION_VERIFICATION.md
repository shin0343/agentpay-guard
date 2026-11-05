# Final submission verification — Step 8

2026-11-05. Validated parent: `1fad062fbf847a25af22894dbe53595825fdcffc` on
`feat/frontend`. Overall status: **NOT READY**; Samantha narration rights remain unresolved; final continuity fixes pass.
[Final report](FINAL_RELEASE_REPORT.md) is the authoritative findings record.

## Reproduction actually performed

Audit workspace: `/tmp/apg-final-audit`. Fresh `git clone --no-hardlinks` copies, `clean` and
`clean-live`, contained tracked source only. No original environment files, build artifacts,
database contents or dependencies were copied. They share only the package store downloaded
fresh for this audit. Browser tooling was an existing external Playwright installation; it
was not part of application installation and supplied no application state or credentials.

Environment: macOS 26.7, Node.js 22.15.1, pnpm 10.32.1, PostgreSQL 15, Chromium via Playwright.
Two new databases: `apg_step8_test_20261105` (regressions) and
`apg_step8_fresh_20261105` (fresh migration/live browser). Neither original evidence database
nor existing payment history was reset, dropped or overwritten.

Commands below are repeatable equivalents; choose your own PostgreSQL role and empty DBs.

```sh
git clone <published-repository-url> agentpay-guard
cd agentpay-guard
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
```

Results: install/typecheck/lint exit 0. Tests: 192 passed, six PG tests intentionally skipped.
For the complete regression suite, use a separate database:

```sh
createdb agentpay_guard_test
APG_POSTGRES_TEST=true \
  TEST_DATABASE_URL='postgresql://<db-user>@localhost:5432/agentpay_guard_test' pnpm test
```

Result: **198 passed, zero failed/skipped, 18 files**. Includes both `postgres.test.ts` and
`security-postgres.test.ts`; the shorter `test:postgres` script alone does not include both.
These test files create their own isolated schemas. Unit PayPal/AI transports are controlled doubles;
their success is not evidence of new genuine provider transactions or inference.

## Runnable mock application

```sh
NEXT_PUBLIC_API_MODE=mock pnpm build:webpack
NEXT_PUBLIC_API_MODE=mock pnpm start
```

Both commands succeeded from the clean clone, with no `.env.local` or provider credentials.
Visit `/login`, enter `operator` or `reviewer`; these are browser-only mock identities. Run A–E
from **Send test request**. The UI labels simulated AI, checkout and payment state.
Desktop and mobile full walkthroughs passed with zero reported console/runtime/overflow errors.
Simulated decline then retry recovered to simulated Paid. These are functioning application
screens and state transitions; they are not evidence that the real providers were called.

## Fresh real backend without personal provider accounts

Use another clean checkout built with `NEXT_PUBLIC_API_MODE=live`, a new DB, randomly generated
session secret/private distinct operator/reviewer passcodes and a random valid demo agent key.
Set `DEMO_MODE=true`, `RISK_PROVIDER=fixture` and nonempty dummy Sandbox credentials for this
specific **nonpayment** test. Follow the README for actual credentials before opening real checkout.

```sh
pnpm db:migrate
pnpm build:webpack
pnpm start
```

Result: migration applied `001_foundation.sql`; build/start succeeded. Exact DB username must be in
the URL if the environment omits `USER`. The app rendered **Simulated AI assessment**, made real
requests to Next.js and persisted them in PostgreSQL. Browser E2E passed on desktop and mobile:
login, allow/review/block, authorized approval/rejection, replay/duplicate/cancel, reload, ledger,
filter, CSV and policy display. A blocked request had no checkout/payment/payer audit events.

The second phase of `frontend-qa.cjs` **intercepts** API responses and PayPal JS SDK to exercise:
stable SDK rendering, funding-decline restart, unavailable SDK/reload, waiting/approved/unknown/
pending/paid evidence, return sign-in recovery, expired decisions, resource-change loading,
stale last-confirmed state and refresh. It passed at 375/768/1280 widths and dark/reduced motion.
It made no genuine PayPal calls and is not presented as real payment evidence.

### Browser verification commands

Playwright is not an application dependency. Install QA tooling outside the repository, for example:

```sh
npm install --prefix /tmp/agentpay-browser --no-save playwright@1.64.1
/tmp/agentpay-browser/node_modules/.bin/playwright install chromium

# Against the mock production build; BASE may point to any local test port.
NODE_PATH=/tmp/agentpay-browser/node_modules BASE=http://localhost:3000 \
  MODE=desktop node scripts/visual-qa.cjs qa/step8-mock-desktop
NODE_PATH=/tmp/agentpay-browser/node_modules BASE=http://localhost:3000 \
  MODE=mobile node scripts/visual-qa.cjs qa/step8-mock-mobile

# Against a live build and a disposable fixture-AI DB with private reviewer passcode.
# Export QA_PASSCODE privately in the shell first; do not put it in documentation or history.
NODE_PATH=/tmp/agentpay-browser/node_modules BASE=http://localhost:3000 \
  node scripts/frontend-qa.cjs qa/step8-live-browser
```

The live test resets **unpaid/no-payment demo proposals in its target database**.
Only run it against a disposable test DB. Preserve the original financial evidence database.

## Real integrations and obtaining access

| Integration | Reproducible configuration | Step 8 evidence |
|---|---|---|
| PayPal Sandbox | Own Sandbox REST app/business merchant, separate personal Sandbox payer; private client ID/secret in `.env.local`; exact APP_URL | Existing USD 18 capture verified again through provider GET; no new payment |
| Meta Standard Muse Spark | Own Meta Model API access/key, `RISK_PROVIDER=meta`, `MODEL_API_KEY`, `META_RISK_MODEL=muse-spark-1.3`; [quickstart](https://dev.meta.ai/docs/quickstart) | Genuine original persisted Meta assessment and diagnostic verified; no new inference |
| AI failure recovery | Missing/unavailable provider requires review when deterministic policy allows; never grants checkout automatically | Unit/security regressions pass; browser fixture outage recovery passes |
| Signed webhooks | Own public HTTPS callback restricted to webhook route, own app subscription and `PAYPAL_WEBHOOK_ID`; [setup](PAYPAL_INTEGRATION.md#webhooks) | Four original signed receipts reverified by actual PayPal postback; no resend |
| Without webhook hosting | Protected order reconciliation reads PayPal state; no public callback required | Controlled regression coverage and original completed provider GET |

A judge may need to obtain Meta model/account access; eligibility for a new account was not tested.
Do not describe fixture mode as real AI. If that access is unavailable, arrange a usage-limited,
isolated disposable judge instance and provide its access privately; no such instance is claimed here.
The historical Cloudflare callback is offline and is not a hosted demo link.

## Submission compliance matrix

The [official rules](https://paypalaihackathon.devpost.com/rules) were read on 2026-11-05.
This is a project-specific checklist, not a blanket eligibility certification.

| Gate | Status |
|---|---|
| Public source URL | PENDING publication authorization; no remote/public URL configured |
| Open-source license | Local PASS: standard MIT file/package metadata; verify GitHub About after publication |
| Runnable build / complete instructions | PASS locally with clean mock and real backend; own-account provider setup documented |
| Genuine AI + PayPal integration | PASS existing evidence/source; independent judge account access remains account-dependent |
| Public YouTube link | PENDING; no upload authorized or performed |
| Video under three minutes | PASS final: 158.867 seconds, 1080p/30 fps; remeasure any audio replacement |
| Rights, final scene continuity, A/V/caption review | Continuity RESOLVED; technical A/V timing PASS; narration rights OPEN |
| English README/submission/instructions | PASS; 45 English SRT cues/script present; see final independent speech check |
| Accurate scope | Sandbox only, fixture/real distinction, shared demo IAM, single merchant and unmeasured AI accuracy disclosed |
| Award fit | Agentic Commerce / PayPal + AI relevant; sponsor-specific tools not claimed |
| Entrant eligibility / ownership | OWNER ATTESTATION required; not inferable from code |
| Deadline | November 12, 2026, noon PST (20:00 UTC); submit before it |

Complete instructions are an allowed alternative to hosting; screenshots alone are not a demo.
No optional sponsor integration was added merely to claim a prize. Keep access available through
the end of judging, December 15, 2026, 08:00 PST.

## Five judging criteria and evidence to present

| Criterion | Concrete material |
|---|---|
| Technological implementation | Actual Orders v2 capture, signed webhooks, real Meta structured output, SQL uniqueness, concurrency/restart regressions |
| Design | Coherent request/review/checkout/ledger journey, distinct policy/payer keys and explicit simulated/unconfirmed states; responsive recovery verified |
| Potential impact | Bounded developer API-credit/GPU purchasing workflow with finance review; no adoption, savings or fraud-reduction metric asserted |
| Innovation | Deterministic authority outside model output, immutable quote, one-way AI escalation, version-bound review and evidence-linked settlement; no claim of being first |
| Presentation | Show proposed request, rule trace, reviewer, blocked attack and separately dated historical capture; final continuity passes; narration rights remain open |

## Evidence locations

Raw logs, clean clones, private transient test configuration, browser output, ffprobe/ffmpeg data,
OCR text and security/license scanner results remain locally under `/tmp/apg-final-audit`.
That folder is **not a public release attachment**. Original provider evidence remains under ignored
`qa/card-ready`, `qa/tunnel-live` and the original DB. Sanitized facts are in this report and
[SANDBOX_TRANSACTION_EVIDENCE.md](SANDBOX_TRANSACTION_EVIDENCE.md).

## Parallel-work reconciliation

Claude parent `1fad062fbf847a25af22894dbe53595825fdcffc` contains no application/dependency/migration
change from the prior tested baseline. After reconciliation, the full suite again passed **198/198**,
lint and Webpack production build passed, and typecheck passed sequentially after build. The first
concurrent typecheck collided with `.next/types` regeneration (TS6053); it was rerun after build,
not treated as a source defect. The existing clean clone was fast-forwarded and mock browser A–E
was rechecked. Prior fresh-install/migration/live-backend evidence remains valid for identical app source.

Final video: `qa/step7-video/agentpay-guard-demo-final.mp4` and matching `.srt`; hashes, chapters,
scene samples and speech-check evidence are in the final report. All three continuity issues are closed.
Only demonstrated narration redistribution permission/audio replacement is a substantive publication blocker.
The current final remains preserved. Use [AUDIO_REPLACEMENT.md](AUDIO_REPLACEMENT.md) for a human recording.

Independent final speech-check rerun with cached offline Whisper: 45/45 cue-onset matches,
mean −0.20 s, max 0.59 s; zero checker failures. This corroborates Claude’s report using the final
MP4/SRT. Technical A/V starts match and durations differ by less than 1 ms.
