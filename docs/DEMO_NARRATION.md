# Demo narration

Final English script for `qa/step7-video/agentpay-guard-demo-final.mp4` (2:38.9). Source of truth:
`scripts/demo/narration.tsv` (a `[+n]` marker adds n seconds of pause before the next sentence).

**Voice.** macOS "Samantha" (`say -v Samantha -r 172`). It is the clearest English voice installed here;
no paid service, voice clone or imitation of a real person is used. Each sentence is synthesized on its own,
edge silence is trimmed and sentences are joined with a 0.34 s pause, then a light high-pass and 2:1
compression are applied. Intelligibility was checked by transcribing the final mix with Whisper
large-v3-turbo: every scripted word is recovered (differences are only number and compound formatting,
e.g. "$640", "allow list"). A human voice would still sound warmer; the script is ready for that.

| # | Time | Line | Evidence for the claim |
|---|---|---|---|
| 1 | 0:00 | AI agents can now spend money on their own. So who sets their limits, who approves a risky purchase, and who can prove what was actually paid? | Framing |
| 2 | 0:10 | AgentPay Guard is a payment control layer for AI agents. Deterministic policies decide. A Meta AI model adds risk analysis, but it can only add caution. And PayPal moves money only after a separate payer approval. | `AI_RISK_ENGINE.md`, `PAYMENT_STATE_MACHINE.md` |
| 3 | 0:25 | Every agent works inside eight deterministic rules. Here, a research agent calls our API to buy eighteen dollars of embedding credits from an allowlisted vendor, at a price the server already trusts. All eight rules pass. The Meta Muse Spark model reads the request and returns a low, advisory risk score. That turns key one: policy approval. Key two, payer approval, still has to happen inside PayPal. | Recorded live: agent API 201, `preq_01M6PG0GF2JX28QE4K24MTJ2WC`, Meta `muse-spark-1.3` score 8 in 2.9 s, 8 pass |
| 4 | 0:52 | Next, six hundred and forty dollars of GPU time. It goes over the automatic purchase limit, and the merchant isn't on the allowlist. So it waits for a person. The operator who launched the agent can't approve it. Only a separately signed-in reviewer can. | Recorded live: `preq_01M6PGR4ZCMW5GZVVAR1XC20TB`, Meta score 72, P-01 and P-04 review; operator sees "Only reviewers can decide." |
| 5 | 1:09 | A second person signs in as the reviewer. They add a note and approve. Policy approval is now granted by a named person, and written to the ledger. The payer still approves in PayPal. | Recorded live: review approved by M. Okafor; key 1 "by M. Okafor", key 2 waiting |
| 6 | 1:26 | This agent was prompt-injected. Its justification tells the reviewing system to ignore spending limits. The model flags the injection, but rules make the decision. Gift cards are a blocked category, and the amount is over the cap. PayPal calls: zero. There is no checkout, and no payment event, for this request. | `preq_01M6PG1D53V0J76NDN2RT22B4Y`, evaluated live at 18:37 UTC in the recording session: Meta score 95 (7.1 s) quoting the injection, P-01 and P-03 block, `PayPal calls 0`. Shown with that time on screen |
| 7 | 1:47 | None of the requests you just saw has been paid. This one has. It's an eighteen-dollar purchase, completed earlier in PayPal Sandbox, on November fifth. A separate Sandbox buyer approved it, and Guard captured it exactly once. The order and capture identifiers come straight from PayPal, and Paid appears only after the capture is confirmed. | `SANDBOX_TRANSACTION_EVIDENCE.md`: order 2UE55412FX0764120, capture 32E66103YN1557633, captured 2026-11-05 17:07 UTC |
| 8 | 2:09 | If the agent retries with the same key, Guard replays the original response instead of creating a new request. A second identical purchase inside ten minutes is blocked as a duplicate. In the Sandbox run, PayPal's signed webhooks were verified with PayPal before Guard acted on them, and genuine redeliveries were de-duplicated. Every step lands in a hash-chained ledger. | Recorded live: idempotency replay + P-07 block (`preq_01M6PG256G1HQZW1NEJGF7344S`). Webhook evidence from 2026-11-05: `WEBHOOK_VERIFICATION.md` |
| 9 | 2:32 | AgentPay Guard. Give AI agents spending power. Keep humans in control. | — |

## Words to avoid

"Production", "fraud prevention", "guarantees", "secure" without a qualifier, "real money", any percentage.
Say "PayPal Sandbox" whenever a payment is mentioned. Say "advisory" when the AI score is mentioned.
Never describe the November 5 capture as happening during the recorded session.

## Re-recording with a human voice

Record each line as `01-intro.wav` … `09-close.wav` (48 kHz) into the work directory's `narr/` folder, update
`timing.json` sentence starts (or run `narrate.py` once and replace the WAVs with takes of similar length),
then run `assemble-demo.py` and `check-video.py`.
