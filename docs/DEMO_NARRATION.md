# Demo narration

Final English script for the under-three-minute demo. About 340 words at a calm 170 wpm.
Draft 1 uses the macOS "Samantha" voice (`say -v Samantha -r 172`). A human voice reading the same
lines will sound better. Keep the wording, because every sentence is checked against recorded evidence.

Times are from draft 1 (`qa/step7-video/agentpay-guard-demo-draft.mp4`). See `DEMO_STORYBOARD.md` for the picture.

| # | Time | Line | Evidence for the claim |
|---|---|---|---|
| 1 | 0:00 | AI agents can now choose and buy things on their own. But financial autonomy needs accountability: clear limits, a human in the loop, and proof of what actually happened. | Framing only |
| 2 | 0:11 | AgentPay Guard is a payment control layer for AI agents. Deterministic policies decide. A Meta AI model adds risk analysis, but it can only add caution. And PayPal moves money only after a separate payer approval. | `AI_RISK_ENGINE.md`, `PAYMENT_STATE_MACHINE.md` |
| 3 | 0:26 | Every agent works inside eight deterministic rules. Here, a research agent calls our API to buy eighteen dollars of embedding credits from an allowlisted vendor, at a price the server already trusts. All eight rules pass. Meta's Muse Spark model reads the request and returns a low, advisory risk score. That turns key one: policy approval. Key two, payer approval, still has to happen inside PayPal. | Recorded live: agent API 201, Meta `muse-spark-1.3` score 8, 8 pass |
| 4 | 0:52 | Six hundred and forty dollars of GPU time goes over the automatic purchase limit, and the merchant isn't on the allowlist. So it waits for a person. The operator who launched the agent can't approve it. Only a separately signed-in reviewer can. | Recorded live: P-01 and P-04 review, Meta score 65; operator sees "Only reviewers can decide." |
| 5 | 1:10 | The reviewer adds a note and approves. Policy approval is now granted by a named person, and written to the ledger. The payer still has to approve in PayPal before any money moves. | Recorded live: review.approved event, key 1 granted by M. Okafor, key 2 waiting |
| 6 | 1:27 | This agent was prompt-injected. Its justification tells the reviewing system to ignore spending limits. The model flags the injection, but rules make the decision. Gift cards are a blocked category, and the amount is over the cap. PayPal calls: zero. There is no checkout, and no payment event, for this request. | Recorded live: P-01 and P-03 block, Meta score 95 (7.6 s) quotes the injection, `PayPal calls 0` |
| 7 | 1:48 | Now the payment itself. This eighteen-dollar purchase completed in PayPal Sandbox. A separate Sandbox buyer approved it, and Guard captured it exactly once, inside the approval window. The order and capture IDs come straight from PayPal. Paid appears only after the capture is confirmed. | `SANDBOX_TRANSACTION_EVIDENCE.md`: order 2UE55412FX0764120, capture 32E66103YN1557633 |
| 8 | 2:07 | If the agent retries with the same key, Guard replays the original response instead of creating a new request. A second identical purchase inside ten minutes is blocked as a duplicate. PayPal's signed webhooks are verified with PayPal before Guard acts on them, and genuine redeliveries were de-duplicated. Every step lands in a hash-chained ledger. | Recorded live: idempotency.replayed + P-07 duplicate block. `WEBHOOK_VERIFICATION.md` |
| 9 | 2:28 | AgentPay Guard. Give AI agents spending power. Keep humans in control. | — |

## Words to avoid

"Production", "fraud prevention", "guarantees", "secure" without a qualifier, "real money", any percentage.
Say "PayPal Sandbox" whenever a payment is mentioned. Say "advisory" when the AI score is mentioned.

## Pronunciation

- Muse Spark: "MEWZ spark"
- IDs: "I-Dees" (the TTS draft spells it "I D's")
- Idempotency is not spoken; the line says "with the same key".
