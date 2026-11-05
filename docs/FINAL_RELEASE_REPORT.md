# Final release report — Step 8

Audit date: 2026-11-05 UTC. **Verdict: NOT READY for the combined public GitHub / YouTube /
Devpost release.** Engineering, clean-install and final video continuity gates pass. The remaining publication blocker is Samantha narration licensing.
This report supersedes earlier readiness verdicts and test totals for publication decisions.

## Exact scope and reconciliation

- Validated parent: `1fad062fbf847a25af22894dbe53595825fdcffc`, on `feat/frontend`.
- Claude's nine committed video/documentation files are preserved. All uncommitted Step 8 findings,
  README edits, ignore rules and license notices were reviewed and retained in the reconciliation commit.
- The application source, dependency lockfile and migrations are identical to Step 7 baseline
  `0f3af1d2c345ba40765996d6308f06abac1a77ac`; only video tooling and documentation changed in Claude's commit.
- `main` is an ancestor, 18 commits behind the validated parent; the audit commit adds one more.
  No remote is configured. No push, deployment, upload, submission, identity change or history rewrite occurred.
- The integrated documentation commit is reported in the completion response; its parent is the exact
  validated hash above. Tests below were rerun after Claude's commit. No conflicting source edits were found.

## Engineering verification

| Check actually executed | Result |
|---|---|
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0 |
| `pnpm test` with local socket permission | PASS, 192 passed / 6 PostgreSQL tests skipped, 16 files passed / 2 skipped |
| Full suite with `APG_POSTGRES_TEST=true` and a new dedicated PostgreSQL DB | PASS, **198/198**, 18/18 files, zero skipped, exit 0 |
| Payment/webhook/security regressions | PASS as part of that full suite: capture replay/ownership, unknown settlement, transitions, authorization, AI freshness, duplicate requests, signed webhook validation/reliability and restricted proxy |
| `pnpm build:webpack`, existing checkout | PASS, exit 0 |
| Clean-clone frozen dependency installation, empty package store | PASS, exit 0; pnpm reports an ignored esbuild install script, but migration/build/tests work |
| Clean mock Webpack build and production startup | PASS, exit 0 / ready on loopback |
| Clean live Webpack build, migration and production startup | PASS, exit 0 / ready on loopback |
| Clean mock browser A–E, desktop/mobile | PASS, 24 desktop + 23 mobile screenshots, both `errors: none` |
| Clean real backend browser flows | PASS, desktop/mobile login, create, policy, review approval/rejection, block, replay, duplicate, cancel, reload, ledger/filter/CSV |
| Browser controlled payment/SDK boundaries | PASS, 37 screenshots across real backend + boundary checks; decline/restart, SDK failure/reload, unknown/pending/paid evidence, expired approval, sign-in return, stale-state recovery, 375/768/1280 widths, reduced motion/dark mode |
| Dependency audit | Runtime: **0 advisories**. Full tree: **1 moderate**, 0 high/critical; see below |

Reconciliation rerun: **198/198 tests**, lint and Webpack build pass. Typecheck passes after build.
An initial concurrent typecheck encountered TS6053 while Webpack regenerated `.next/types`; rerunning
sequentially resolved this verification race. It was not a source change or waived failure.

Initial sandboxed `pnpm test` was **188 passed / 4 failed / 6 skipped**, with four `listen EPERM`
errors from `webhook-tunnel-proxy.test.ts`. Re-running with loopback permission passed all non-PG tests;
the PG-enabled run then passed all 198. This was an execution permission issue, not a silently waived test.
The first clean migration under `env -i` omitted a database username and failed; explicitly setting the
local DB role in the connection URL fixed it. README now calls for an explicit DB user.
Detailed commands and evidence boundaries: [FINAL_SUBMISSION_VERIFICATION.md](FINAL_SUBMISSION_VERIFICATION.md).

## Existing genuine provider evidence rechecked

No new PayPal order, payment or capture was created. No new AI inference was requested.

- At **2026-11-05T18:38:44.806Z**, `pnpm sandbox:verify pay_01M6PAT2X22DG00DS19BWZBPZA`
  exited 0 using an actual PayPal GET. Order `2UE55412FX0764120`, capture `32E66103YN1557633`,
  **USD 18.00 COMPLETED** matched the request, recipient binding, stored amount and payment.
- A separate **read-only SQL transaction** confirmed request `PAID`, payment `COMPLETED`, exactly one
  capture attempt and one `payment.completed` audit event.
- Persisted risk was completed **Meta `muse-spark-1.3`**, score 5, prompt `r-3-meta-1`; the linked
  `risk.assessed` diagnostics identify provider `meta`. Adapter source pins the actual Meta endpoint,
  strict schema and `store:false`; advisory output can only escalate deterministic ALLOW to REVIEW.
  This rechecks the original evidence; it does not measure fresh provider latency or risk accuracy.
- At **2026-11-05T18:40:57.933Z**, all **four preserved original-body signed webhook receipts**
  passed a fresh real PayPal `verify-webhook-signature` postback. Each saved body SHA-256 matched;
  each original event ID had one dedupe row and one linked webhook audit entry. No delivery was resent.
- The original **106-event hash chain** remained valid with head
  `d09d9e319cfd9e06fd1fdc9b1fc033f3efeb872c41676b50132500ba66253274`.
- Human review checks reviewer role, nonownership and `If-Match`; payer approval is checked independently
  against the owned PayPal order before capture. Database order/capture uniqueness, deterministic request
  IDs, capture claims and conservative unknown-state recovery remain intact in source and regressions.

Original transaction date is **November 5, 2026 UTC**. The video shows this historical payment, not a
newly paid proposal. Raw receipts and the original financial DB were preserved, with no financial reset.

## Public security and privacy

The history scan covered **19 reachable commits, 540 reachable objects and 355 unique blobs** (before the documentation commit).
It compared configured private environment values without printing them and checked patterns for API
tokens, private keys, JWTs, credentialed DB URLs, emails, secret assignments and sensitive artifact paths.
All candidates were reviewed: validation code, explicitly fake test credentials, fictional redaction
fixtures and a documented webhook registration identifier. A webhook ID is not an authorization secret.
**No configured API secret, session secret, private passcode, agent bearer key or client secret was found
in reachable history.** This is a scoped pattern/known-value audit, not a proof that every possible unknown
secret can be detected.

The current public file set was also checked against those configured values, and **54 compiled
browser asset files** contained no matches. The only current source matches were the same nonsecret
webhook registration ID. No session/OAuth token candidate was found in the reachable-history scan.

No tracked private environment file, raw signed receipt, local DB, recording or sensitive log was found.
`.env*` except `.env.example`, `qa/`, dependencies and build output were already ignored. Step 8 also
ignores generated audio/video, local database/dump files, logs, private key containers and QA output.
Useful media and databases remain on disk. Public screenshots remain tracked intentionally.

The original audit inspected 27 tracked PNGs and 78 draft frames. The reconciliation sampled the
current final video at two-second intervals (79 frames, zero OCR errors/candidates) and checked all three repaired scene starts.
No secret/email candidate was identified in the reviewed final material; see final-video evidence below.
The original screenshot/privacy findings remain valid. No personal buyer profile/card information was
identified in inspected public material. Raw provider
receipts contain buyer PII and remain ignored/private; never attach them to a GitHub release.

`pnpm audit` reports **GHSA-g3hv-75wg-m249**, minimatch 10.2.6 via ESLint, moderate glob amplification DoS.
`pnpm audit --prod` reports zero advisories. This dev-tool issue was already disclosed; no major dependency
upgrade was introduced during release audit. Keep lint inputs trusted and plan a compatible patched
ESLint/minimatch update separately. [Advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).

The root `LICENSE` contains standard MIT text and `package.json` declares MIT. This is compatible with
GitHub detection; actual About-panel detection remains pending creation of the public repository.
Dependency licenses and font notices are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
No licensing clearance is claimed for the final system voice.

## Git identity and release safety

All 19 inspected reachable commits use the same academic email (`mail.hongik.ac.kr`) for both author and committer.
The address becomes public with the history. For future privacy, copy the **actual address assigned to
this account** from [GitHub email settings](https://github.com/settings/emails) and configure it locally.
No noreply address was guessed, no author/committer metadata was changed and no history was rewritten.
Changing future configuration does not hide the existing address. Rewriting it needs separate explicit
authorization; this audit does not prescribe a destructive rewrite command.

`git merge-base --is-ancestor main feat/frontend` exits 0. A local `--ff-only` promotion is structurally safe
after final review and a clean committed worktree. No force-push is needed. The controlled procedure in
[PUBLICATION_CHECKLIST.md](PUBLICATION_CHECKLIST.md) aborts on divergence, unexpected remotes or dirty files.

## Video QA — final artifact, superseding the draft

- MP4: `qa/step7-video/agentpay-guard-demo-final.mp4`.
  SHA-256: `f95c6af66ff39c8a167a6b3acbcbdbe932e1c98244318abc3e8d1344806535fe`.
- SRT: `qa/step7-video/agentpay-guard-demo-final.srt`.
  SHA-256: `35d73f6c045a911a7f70c2e2fc112929c5c39c8582109ac59bd7167785285c6c`.
- Independently measured: **158.867 seconds (2:38.9), 1920×1080, H.264 30 fps, 4,766 frames**;
  AAC 48 kHz stereo; both streams start at zero, end times differ by less than 1 ms.
- `check-video.py`: exit 0, 45 ordered non-overlapping English cues, no black runs, −16.1 LUFS.
  Intended static UI/title holds are present; frame count alone is not proof of perceptually unique frames.
- Independently viewed the final contact sheet and first-second samples at **51.73, 85.70 and 129.00 s**.
  They show the intended evaluating $640 request, blocked gift-card request and neutral Policies page.
  **All three prior continuity findings are RESOLVED**, including the injection scene noted by Claude.
- Historical payment is explicitly separated from new unpaid proposals, dated November 5, 17:07 UTC.
  The completed injection assessment is labelled as evaluated earlier in the recording session at 18:37 UTC.
  Original PayPal/Meta evidence and controlled-test limitations remain unchanged.
- Claude's [VIDEO_FINAL_QA.md](VIDEO_FINAL_QA.md) reports 45/45 speech-matched captions, mean offset
  −0.20 s and maximum 0.59 s. Independent offline Whisper rerun reproduced **45/45 cue-onset matches, mean −0.20 s, max 0.59 s**,
  with no checker failures. Its recovered English transcript matches the reviewed narration (number/compound
  formatting differs). Matching uses nearby first-word onsets, not a phoneme-level forced alignment.
- **P1 publication blocker remains:** the final narration uses `say -v Samantha`. No separate permission
  for public distribution is supplied. Replace with the entrant's own recording or a demonstrably licensed
  alternative; preserve this final MP4/SRT and recheck the replacement. [Apple §2.F](https://www.apple.com/legal/sla/docs/macOSTahoe.pdf).
- No music source is present in the assembly. Final footage is genuine application UI with title cards
  and explanatory overlays; sampled frames show no exposed secrets. A full human watch/listen of the
  eventual rights-cleared output remains the final publication check.

Chapters: **0:00 Problem · 0:10 Product · 0:25 Low-risk · 0:52 Human review · 1:09 Approval ·
1:26 Injection block · 1:47 Sandbox payment · 2:09 Webhooks & ledger · 2:32 Close**.

The former draft's findings are retained as resolved audit history, not current blockers. The original
155.527-second draft and this final artifact are both preserved locally; neither was overwritten.

## Reproducibility and Devpost

The repository is a functioning application: both simulated browser flows and real Next.js/PostgreSQL
flows ran from independent clean clones without `.env.local`, `.next`, original node_modules or the
developer's credentials. Fixture AI is labelled simulated; controlled PayPal boundaries are labelled QA.
Actual PayPal/Meta service access is a separate requirement, documented using a judge's own accounts.
New-account Meta eligibility was not tested. No developer account is a hardcoded runtime dependency.

The [official rules](https://paypalaihackathon.devpost.com/rules), checked 2026-11-05, allow complete
setup instructions instead of hosted deployment. Public repository and YouTube URLs are still absent.
MIT, English setup, genuine Sandbox/AI evidence and clearly stated limitations are prepared.
Relevant categories: Agentic Commerce and PayPal + AI; no sponsor-specific tool prize is asserted.
Entrant age/residence, original ownership and conflict eligibility require owner attestation.

Deadline: **2026-11-12 12:00 PST = 20:00 UTC = 2026-11-13 05:00 KST**.
Keep judging access available through **2026-12-15 08:00 PST**. The five equally weighted criteria map
to the real policy/payment implementation, two-key UI, bounded developer-spend use case, independent
authorization/evidence controls and honest video narrative. See the verification matrix for specifics.

## Remaining gates and verdict

1. **P1:** replace Samantha with the entrant's recorded voice or a voice with demonstrated public-sharing
   permission. Follow [AUDIO_REPLACEMENT.md](AUDIO_REPLACEMENT.md); preserve the current final first.
2. Revalidate replacement audio, captions, privacy and duration; record new hashes/chapter timings if changed.
3. Decide whether to publish the existing academic Git identity. Actual GitHub noreply setup is documented;
   existing history remains untouched without separate authorization.
4. After explicit publication authorization, fast-forward `main`, publish the public GitHub repository,
   verify MIT detection, upload the cleared YouTube output with captions, and submit actual URLs to Devpost.

**NOT READY for public video/submission solely because narration rights are unresolved.** No obsolete scene
transition defect is used to justify this verdict. Engineering and final visual continuity are ready with
previously disclosed prototype limitations. No new Sandbox payment is needed or was created.

Reconciliation browser rerun: desktop 24 screenshots, mobile 23 screenshots; both complete A–E
walkthroughs returned `errors: none` from the clean verification clone at the validated parent.
Raw reconciliation logs remain under ignored `qa/step8-final-audit/reconcile`.
