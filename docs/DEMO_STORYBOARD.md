# Demo storyboard

Draft 1 · 1920×1080 · 2:35 · `qa/step7-video/agentpay-guard-demo-draft.mp4` (git-ignored, see SUBMISSION_CHECKLIST.md)

Style: developer documentary. Real application footage only, two typographic cards, no music,
no stock footage. One small ink caption in the lower-left names what the viewer is seeing. A thin
blue outline briefly marks the element being discussed. The cursor is a plain arrow.

All footage is the production build connected to `apg_step7_video`, a fresh clone of the verified evidence
database. Fresh requests were made through the real agent API and scenario runner, with genuine Meta
`muse-spark-1.3` inference. The payment shown is the genuine Sandbox capture from 2026-11-05.

| # | Time | Beat | Picture | Truth label on screen |
|---|---|---|---|---|
| 1 | 0:00 | **Problem.** Agents can spend; who is accountable? | Card: "AI agents can spend money now. / Who is accountable when they do?" | `[Sandbox demonstration]` |
| 2 | 0:11 | **Product.** Rules decide, AI advises, PayPal holds key 2 | Landing hero. Pick "$2,400 gift cards", Run decision → *Blocked.* Scroll to the recorded Sandbox ledger | Hero labelled fictional; ledger "PayPal Sandbox transaction… No real money moved." |
| 3 | 0:26 | **Low-risk request.** Agent API → 8 pass → Meta advisory score → key 1 | Policies page (the eight rules), then the workspace queue. New row appears from the agent API call, *Evaluating* → *Allowed.* Two keys outlined. Model line outlined. Continue to PayPal → official SDK button | "Eight deterministic rules · rule set v3", "Agent → POST /api/v1/purchase-requests", "Live Meta inference · advisory only", "No order is created until the payer clicks" |
| 4 | 0:52 | **Human review boundary.** | Send scenario B → *Needs review.* P-01 and P-04 rows outlined. Review screen as operator: "Only reviewers can decide." | "Signed in as operator · cannot grant policy approval" |
| 5 | 1:10 | **Reviewer approves.** | Reviewer signs in (masked passcode), types note, Approve purchase → *Allowed.* → request: key 1 "by M. Okafor", key 2 waiting | "Separate reviewer sign-in", "Policy approval · granted by M. Okafor" |
| 6 | 1:27 | **Prompt injection blocked.** | Send scenario C → *Blocked.* Injection signal outlined with the quoted text. `PayPal calls 0` outlined | "Live Meta inference · rules decide" |
| 7 | 1:48 | **Verified Sandbox payment.** | Recorded Paid request → both keys granted → payment page: order and capture IDs outlined, one capture attempt | "PayPal Sandbox · recorded 2026-11-05 · USD 18.00" |
| 8 | 2:07 | **Retries, webhooks, ledger.** | Scenario D retry → "Retry replayed" notice and duplicate block. Ledger → expand `webhook.received` (event ID, `PAYMENT.CAPTURE.COMPLETED`, `verified_order_and_capture`) → "Chain verified" | "Same Idempotency-Key → original response replayed", "Signed webhook · verified with PayPal before processing" |
| 9 | 2:28 | **Close.** | Card: "Give AI agents spending power. Keep humans in control." + three rows (policy, two keys, proof) | `[Sandbox] No real money moved · not a production deployment` |

## Why this order

Judges score presentation on "end-to-end, who it's for, why it matters". The story moves from the safe
path (A) to human judgment (B) to an attack (C), then proves the money part with the real capture and
ends on the evidence trail. Each beat answers one question from the landing page.

## Honesty rules applied

- The live low-risk request stops at the PayPal button. The video does not imply that request was paid.
  The paid request is introduced as "this eighteen-dollar purchase completed in PayPal Sandbox" with the
  recorded date on screen.
- Scenario E (decline and recovery) is not shown, because it uses PayPal negative testing and was not
  verified as a natural decline.
- No KPI claims, no accuracy numbers, no production wording.
