# Frontend UX changelog

2026-11-04 · Ledger Instrument refinement and backend connection.

## Design direction, reviewed before refinement

Keep the established financial instrument: paper `#F4F2EC`, raised `#FBFAF7`, ink
`#16150F`, allow `#1D6B45`, review `#8F5600`, block `#B42A18`. These are existing
CSS tokens, not component colors. Newsreader carries headlines/verdicts; Geist
carries controls; Geist Mono carries financial evidence, time and IDs.

The initial desktop walkthrough confirmed that the split queue, restrained verdict
band, two approval keys and ruled trace are effective. No redesign or new dashboard
cards is justified. The hierarchy remains:

```text
Purchase + amount
Decision + concise reason
Policy key | Payer key
Next action
Policy → advisory AI → original verdict
Agent text → persisted ledger
```

Spend the visual emphasis on the verdict and next action. Preserve alignment and
content measures; improve payment truth, recovery, mobile reachability and ledger
legibility. Review against the brief: keep the distinctive existing type/layout,
remove misleading certainty and repeated technical text, avoid added decoration.
No design constitution amendment is required.

## Changes

- Live HTTP is the default; an explicit `NEXT_PUBLIC_API_MODE=mock` build retains
  the offline demonstration, banner, simulated payer panel and simulated result.
- Landing headline now explains agent proposals and human control in seven words.
  The subline names policy, advisory AI, human review and separate payer approval.
  The illustrative ledger and demonstration scenarios no longer imply live proof.
- Allowed requests explicitly say payment has not occurred. Checkout describes
  approval of a payment; fictional product merchants are not presented as payees.
- PayPal-approved orders have a distinct Payer approved state and Confirm payment action; callbacks can be recovered through the existing protected capture API.
- A paid payment result requires request PAID, payment COMPLETED, capture COMPLETED
  and matching stored payment/capture references. Pending, unknown and approved
  states have distinct copy. Capture attempts alone never label the request paid.
- Review reasons now pair the actual observed amount/merchant with returned policy thresholds. Generic server messages no longer obscure why a request needs review; the frontend never recomputes outcomes.
- Reviews display actual approval keys, including after a decision. Confirmation
  stays visible; the interface no longer auto-navigates away after 1.5 seconds.
  The `a` keyboard shortcut opens confirmation. Operator users receive a sign-in
  path to a reviewer account. Unavailable AI remains visible and explanatory.
- Fixture AI assessments are explicitly labelled simulated; the advisory score is
  described as a triage index rather than a fraud probability.
- PayPal keeps its official button. SDK failures expose reload and full-page
  checkout. Request polling never tears down an active payer popup. Known funding
  declines use the SDK's `actions.restart()` on the same order.
- Redirect return/cancel preserve the stored payment reference across sign-in.
  Return URLs do not assert payer approval. Popup/redirect closure is recorded by
  the existing payer-cancel API without inferring settlement.
- In-flight and pending payments offer status refresh and stable reconciliation.
  Errors retain the last confirmed state, explain uncertainty and offer recovery.
- Ledger uses the API's 100-row limit and cursor pagination. Mobile rows lead with
  readable event labels and a request link; full types/payloads remain available.
  Expanded evidence stacks on small screens instead of squeezing long keys.
- Mobile request actions stay reachable above the safe area. Touch controls meet
  the 44px target height; keyboard focus and reduced motion remain supported.

## Validation and evidence

See [FRONTEND_QA.md](FRONTEND_QA.md) for commands, observed outcomes, screenshots,
evidence categories, remaining issues and the design constitution checklist.

## Integration verification follow-up · 2026-11-04

An actual backend run with OpenAI selected but no API key correctly required human
review, while two explanation lines incorrectly said AI had raised caution. The
request trace and focused review now select unavailable-AI copy from the returned
risk status: “Rules passed. AI analysis is unavailable, so a person decides.”
Completed assessments retain the concern explanation. Typography, layout, tokens,
actions, two-key state and server decisions remain unchanged.

The actual missing-key flow was checked on desktop/mobile, including reviewer
approval followed by an explicit Not paid state. Live/mock production builds,
existing desktop/mobile visual and integration scripts, and 12 axe scans passed.
No real provider inference or payment was available. See
[LIVE_INTEGRATION_REPORT.md](LIVE_INTEGRATION_REPORT.md) for evidence and blockers.
