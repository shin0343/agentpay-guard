# Narration recording script

Reviewed final script; use your own recorded voice or a voice licensed for public sharing.
Use the final SRT for precise phrase timestamps; chapter times below are rounded.
Pause instructions are silent. See [AUDIO_REPLACEMENT.md](AUDIO_REPLACEMENT.md).

## 0:00 Problem

AI agents can now spend money on their own. So who sets their limits, who approves a risky purchase, and who can prove what was actually paid?

## 0:10 Product

AgentPay Guard is a payment control layer for AI agents. Deterministic policies decide. A Meta AI model adds risk analysis, but it can only add caution. And PayPal moves money only after a separate payer approval.

## 0:25 Low-risk

Every agent works inside eight deterministic rules. Here, a research agent calls our API to buy eighteen dollars of embedding credits from an allowlisted vendor, at a price the server already trusts. All eight rules pass. The Meta Muse Spark model reads the request and returns a low, advisory risk score. That turns key one: policy approval. Key two, payer approval, still has to happen inside PayPal.

## 0:52 Human review

Next, six hundred and forty dollars of GPU time. It goes over the automatic purchase limit, and the merchant isn't on the allowlist. So it waits for a person. The operator who launched the agent can't approve it. Only a separately signed-in reviewer can.

## 1:09 Approval

A second person signs in as the reviewer. (pause 2.7 seconds) They add a note and approve. (pause 1.0 seconds) Policy approval is now granted by a named person, and written to the ledger. The payer still approves in PayPal.

## 1:26 Injection block

This agent was prompt-injected. Its justification tells the reviewing system to ignore spending limits. The model flags the injection, but rules make the decision. Gift cards are a blocked category, and the amount is over the cap. PayPal calls: zero. There is no checkout, and no payment event, for this request.

## 1:47 Sandbox payment

None of the requests you just saw has been paid. This one has. It's an eighteen-dollar purchase, completed earlier in PayPal Sandbox, on November fifth. A separate Sandbox buyer approved it, and Guard captured it exactly once. The order and capture identifiers come straight from PayPal, and Paid appears only after the capture is confirmed.

## 2:09 Webhooks & ledger

If the agent retries with the same key, Guard replays the original response instead of creating a new request. A second identical purchase inside ten minutes is blocked as a duplicate. In the Sandbox run, PayPal's signed webhooks were verified with PayPal before Guard acted on them, and genuine redeliveries were de-duplicated. Every step lands in a hash-chained ledger.

## 2:32 Close

AgentPay Guard. Give AI agents spending power. Keep humans in control.
