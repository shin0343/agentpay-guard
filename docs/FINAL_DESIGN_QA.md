# Final design QA — Step 7

2026-11-05 · Claude Opus 5.5 · baseline `cd4030e`

**Verdict: PASS.** The Ledger Instrument design held up under real data. Nine concrete defects were
fixed. No backend, payment, AI or webhook logic changed. The constitution (`DESIGN_SYSTEM.md`) needed no amendment.

## Method

- Production Webpack build served by `next start`, connected to `apg_step7_demo`, a clone of the
  verified evidence database. The evidence database itself was not written to.
- Real Chromium (Playwright 1.64.1) at 1440×900 desktop and 390×844 mobile (2×), signed in as operator
  and reviewer. Every screen was screenshotted and inspected, before and after the fixes.
- Unit coverage for every new presentation helper: `tests/copy-presentation.test.ts`.
- Live flows exercised during demo recording: a new request through the agent API with genuine Meta
  inference (Allowed), scenario B with reviewer approval, scenario C injection block, retry replay
  and duplicate block, the official PayPal Sandbox button, the ledger with an expanded signed webhook.
- Console: no runtime errors. The only console error is the expected 404 on the not-found check.
  No horizontal overflow at either width.

## Screens reviewed

| Screen | Primary purpose obvious? | Notes |
|---|---|---|
| Landing | Yes | Hero trace runs locally on labelled fictional data. Ledger excerpt now shows the real Sandbox run |
| Workspace / queue | Yes | Status dot + word on every row. Historical blocked/expired rows are real records, shown honestly |
| AI evaluation (trace) | Yes | Model, prompt version and latency shown; "Advisory score, not a fraud probability." |
| Human review | Yes | Operator sees "Only reviewers can decide." with a sign-in path; reviewer gets one primary action |
| Blocked request | Yes | Named rules, injected quote, `PayPal calls 0`, payer key "No payment can start" |
| Checkout | Yes | Official PayPal JS SDK button, unstyled; policy key granted, payer key waiting |
| Verified Paid | Yes | Paid only when request, payment and capture agree (`isVerifiedPaid`) |
| Payment detail | Yes | Order, capture, payment and request IDs in full; one capture attempt |
| Ledger | Yes | Chain verified, newest first, expandable payload with hashes |
| Failure / recovery | Yes (regression) | Not paid, Confirming, Payment pending, Expired copy unchanged and still distinct |

## Defects fixed

| # | Problem (observed on real data) | Fix | Files |
|---|---|---|---|
| 1 | Payer key read "Not applicable · PayPal approval required" on blocked and in-review requests, which contradicts itself | Key detail now follows request state: blocked → "Not applicable · No payment can start"; in review → "Not yet · Opens after policy approval"; rejected → "Rejected before checkout". Key state itself is unchanged | `lib/copy.ts` `payerKeyNote`, `guard/verdict.tsx` |
| 2 | Blocked verdict said "Blocked by deterministic spending policy." without naming a rule | That generic backend reason now falls through to the returned rule outcomes: "Blocked item category and over the policy cap. Nothing reached PayPal." / "Duplicate of a recent purchase request. Nothing reached PayPal." No policy is recomputed | `lib/copy.ts` `decisionReason` |
| 3 | Backend evidence showed `$2400.00`, `$3058.00` | Display-only grouping: `$2,400.00` | `lib/copy.ts` `groupDollars`, `trace.tsx`, `review-focus.tsx` |
| 4 | Ledger table on desktop: event column took the free width; request IDs and states wrapped to two lines | Fixed column widths, single-line states, cells aligned to the event baseline | `ledger/page.tsx` |
| 5 | Ledger called a `payer.approved` event "Waiting for payer" | `ledgerState` labels it "Payer approved" (review tone). The stored `state_after` is unchanged | `lib/copy.ts`, `ledger/page.tsx` |
| 6 | Mobile ledger: a row without a summary rendered "Paidpreq_…5CQ8" on one line | Request link is a block-level line | `ledger/page.tsx` |
| 7 | Landing ledger excerpt was fictional ("Illustrative ledger") while real evidence existed. Footer said "Fictional data" | Excerpt now lists the six recorded events of the verified Sandbox payment (UTC), captioned "PayPal Sandbox transaction, USD 18.00. Signed webhooks verified by PayPal. No real money moved." Footer: "Fictional merchants and agents" | `app/page.tsx`, `lib/copy.ts` |
| 8 | After a reviewer approved, live key 1 read "Granted · rule set v3", hiding that a person granted it (mock mode said "by M. Okafor") | `policyKeyNote` shows "by <reviewer>" from the `by` field the API already returns; automatic grants keep "rule set v3" | `lib/copy.ts`, `guard/verdict.tsx` |
| 9 | While a request was evaluating, live key 1 read "Waiting for reviewer" before any decision existed | Shows "Waiting · Evaluating" during RECEIVED/EVALUATING (matches mock mode) | `lib/copy.ts` |

## Status vocabulary

| Concept requested | What the UI shows | Where |
|---|---|---|
| Policy allowed | **Allowed.** · "Within limits; trusted merchant; low risk." · Key 1 Granted · rule set v3 | verdict, key 1 |
| Human approved | **Allowed.** · "Allowed by M. Okafor. Payer approval is next." · Key 1 Granted · by M. Okafor | verdict, key 1 |
| Awaiting payer | **Waiting for payer.** · Key 2 Waiting · PayPal approval required | verdict, key 2, queue |
| Payer approved, not captured | **Payer approved.** `[NOT PAID]` | verdict, ledger |
| Payment captured | **Paid.** · "PayPal confirmed the capture." · Key 2 Granted · Verified with PayPal | only when `isVerifiedPaid` |
| Payment failed | **Not paid.** · "No payment was taken." | verdict, payment page |
| Unresolved | **Confirming.** / **Payment pending.** — never Paid | verdict, payment page |

"Paid" never appears unless status is `PAID` and the PayPal capture matches. Both keys appear on the
request, review, checkout and payment screens.

## DESIGN_SYSTEM.md Part 6 checklist

- [x] Exactly one primary button in each view (verified on request, review, checkout, payment, landing hero)
- [x] No hex values outside `globals.css` (`grep -rnE '#[0-9A-Fa-f]{6}' src | grep -v globals.css` → none)
- [x] Color only on verdict or payment state, always paired with a word
- [x] Copy within §0.3 budgets; new reason lines are 9–12 words; canonical vocabulary
- [x] TwoKey shown wherever payment readiness appears
- [x] Nothing says "Paid" unless status is `PAID`
- [x] Motion limited to the three signature motions; no new motion added
- [x] Keyboard path and visible focus unchanged; new text uses existing tokens with checked contrast
- [x] Verified at 390 and 1440 with no horizontal scroll (768/1280 breakpoints unchanged by these edits)
- [x] None of the §0.2 forbidden patterns present

## Not changed, deliberately

- Historical blocked and expired $18 requests stay visible in the queue. They are real records of
  earlier attempts; hiding them would misrepresent the ledger.
- Landing scenario E still reads "Not paid, then recovered". It runs via PayPal negative testing and is
  documented as not verified as a natural decline.
- Dark mode, mock mode and reduced-motion behavior were not touched.

## Screenshots

Final desktop/mobile captures from this pass are in `docs/screenshots/step7-*.png` (see
`docs/screenshots/README.md` for what each one proves).
