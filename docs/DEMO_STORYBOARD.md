# Demo storyboard

**Final:** `qa/step7-video/agentpay-guard-demo-final.mp4` · 1920×1080 · 30 fps · **2:38.9** · captions
`agentpay-guard-demo-final.srt`. The earlier draft (`…-draft.mp4`, 2:35) is kept unchanged for comparison.
Both files are git-ignored. QA record: [VIDEO_FINAL_QA.md](VIDEO_FINAL_QA.md).

Style: developer documentary. Real application footage only, two typographic cards, no music, no stock
footage. A small ink caption in the lower-left says what the viewer is seeing and, for historical
evidence, when it was recorded. A thin blue outline marks the element the narration is describing.

All app footage is the production build connected to `apg_step7_final`, a fresh clone of the verified
evidence database. New requests in scenes 3–6 and 8 were made during the recording session (2026-11-05,
18:37–18:51 UTC) through the real agent API or the demo runner, with genuine Meta `muse-spark-1.3` inference.
The payment in scene 7 and the webhook in scene 8 are the verified Sandbox records from 17:06–17:13 UTC the
same day, and are captioned as such.

| # | Time | Beat | Picture | On-screen label |
|---|---|---|---|---|
| 1 | 0:00 | **Hook.** Agents can spend; who sets limits, approves, proves? | Card: "AI agents can spend money now. / Who is accountable when they do?" | `[Sandbox demonstration]` |
| 2 | 0:10 | **Product.** Rules decide, AI advises, PayPal holds key 2 | Landing hero: $2,400 gift cards → Run decision → *Blocked.*; "AI can raise caution, never lower it" outlined; recorded Sandbox ledger with the approval webhook and capture rows outlined | Hero: "Runs locally on fictional data"; ledger: "PayPal Sandbox transaction… No real money moved." |
| 3 | 0:25 | **Low-risk request.** | Policies (eight rules) → agent API call → new row → *Evaluating* → *Allowed.*; keys outlined; model line outlined → official PayPal Sandbox button | "Eight deterministic rules", "Agent → POST /api/v1/purchase-requests", "Live Meta inference · advisory only", "No order is created until the payer clicks" |
| 4 | 0:52 | **Human review boundary.** | Opens on the new $640 request while it is *Evaluating* → *Needs review.*; P-01 and P-04 outlined → review screen as operator: "Only reviewers can decide." | "Scenario B · sent as research-assistant · live Meta inference", "Signed in as operator · cannot grant policy approval" |
| 5 | 1:09 | **Reviewer approves.** | Reviewer sign-in (masked) → note → Approve purchase → request: key 1 "by M. Okafor", key 2 waiting | "Separate reviewer sign-in", "Policy approval · granted by M. Okafor" |
| 6 | 1:26 | **Prompt injection blocked.** | Opens on the C request → agent's quote → injection signal → P-03 and P-01 rows → `PayPal calls 0` → request ledger, each on its sentence | "Scenario C · evaluated at 18:37 UTC in this session · Meta score 95 · rules decide" |
| 7 | 1:47 | **Verified Sandbox payment (historical).** | Paid request → keys → payment page: one capture attempt, order and capture IDs | "Earlier Sandbox run · captured 2026-11-05 17:07 UTC · USD 18.00" |
| 8 | 2:09 | **Retries, webhooks, ledger.** | Policies with scenario sheet → Network retry → "Retry replayed" + duplicate block → Ledger → expanded `webhook.received` → "Chain verified" | "Same Idempotency-Key → original response replayed", "Signed webhook from the 2026-11-05 Sandbox run · verified with PayPal" |
| 9 | 2:32 | **Close.** | Card: "Give AI agents spending power. Keep humans in control." + three rows | `[Sandbox] No real money moved · not a production deployment` |

## Honesty rules applied

- Narration says outright that none of the newly recorded requests was paid, and that the paid one is from
  an earlier Sandbox run on November 5. Captions repeat the date and UTC time.
- Scene 6 shows a request evaluated 12 minutes before it was filmed, because three later live attempts hit
  Meta's 8-second deadline (they were still blocked by rules). The caption gives the evaluation time.
- Scenario E (decline and recovery) is not shown: it uses PayPal negative testing, not a natural decline.
- No KPI claims, accuracy numbers or production wording.
