# Final video QA

2026-11-05 · Claude Opus 5.5 · from Step 7 commit `0f3af1d` on `feat/frontend`

**Technical/visual verdict: PASS — review-ready. Publication BLOCKED by narration licensing.** `qa/step7-video/agentpay-guard-demo-final.mp4` (git-ignored, 16,421,764 bytes),
captions `qa/step7-video/agentpay-guard-demo-final.srt`. The draft (`…-draft.mp4`/`.srt`) is unchanged
(checksum verified before and after).

## 1. Continuity defect: found and fixed

Frames of the draft were extracted around each scene start. The defect affected **three** scenes, not two:

| Scene | Draft time | What appeared | Cause |
|---|---|---|---|
| Human review | 0:52.2 – 0:55.5 | Unrelated *Blocked* $18 duplicate request: full view ~1 s, then dimmed behind the scenario sheet | Scene began on `/requests`, which auto-selects the newest request |
| Prompt-injection block | 1:27.0 – 1:30.0 | Unrelated *Allowed* $640 request, same pattern | Same |
| Ledger | 2:07.0 – 2:10.5 | Unrelated *Blocked* $2,400 request, same pattern | Same |

**Fix (recording, not overlay):**
- Human review: the recorder sends scenario B through the same demo-runner endpoint as the sheet (operator
  session + CSRF), then opens Requests client-side. The scene's first frame is the new $640 request while it is
  still *Evaluating*; it resolves live to *Needs review*.
- Block: the scene opens directly on the C request it narrates.
- Ledger: the scene opens on Policies with the scenario sheet already open; the next view is the replayed request.

**Verified in the final render** (first frames at 0:51.73, 1:25.70, 2:09.00, plus +0.2 s and +0.8 s): each
shows only the intended request or the neutral Policies page. A full-film sheet at 2 s intervals shows no
other unrelated request at any scene start.

## 2. Evidence separation

| Evidence type | How the video shows it |
|---|---|
| Real Meta inference | Scenes 3 and 4 run live in the recording session (A: score 8 in 2.9 s; B: score 72). Captions say "live Meta inference" |
| Deterministic policy | Eight rules on the Policies page; P-01/P-04 (review) and P-01/P-03 (block) outlined in the trace |
| Human review | Operator blocked by "Only reviewers can decide"; separate reviewer sign-in; key 1 "by M. Okafor" |
| Prompt injection | C request evaluated at 18:37 UTC in the session (Meta score 95, injection quoted); caption gives that time |
| Historical capture | Narration: "None of the requests you just saw has been paid… completed earlier in PayPal Sandbox, on November fifth." Caption: "Earlier Sandbox run · captured 2026-11-05 17:07 UTC · USD 18.00" |
| Signed webhook / audit | Expanded `webhook.received` (event ID, `PAYMENT.CAPTURE.COMPLETED`, `verified_order_and_capture`) captioned "from the 2026-11-05 Sandbox run"; chain verified |

**Live-capture disclosure.** Meta inference for scenario C takes about 7 s against an 8 s deadline. In this
Step 7 work, 3 of 6 live C attempts timed out; every one was still **blocked by rules** with the AI marked
unavailable (fail-safe confirmed). The final scene therefore films the session's completed C evaluation rather
than a timed-out one, and labels its time.

## 3. Rendered output checks (`scripts/demo/check-video.py`)

| Check | Result |
|---|---|
| Duration | **158.87 s (2:38.9)**, under 3:00 |
| Video | H.264, **1920×1080**, 30 fps, 4,766 frames, consistent with duration × 30; this does not prove each frame is unique |
| Audio | AAC 48 kHz stereo, one continuous track, integrated **−16.1 LUFS** |
| Black frames | None |
| Silence > 1.5 s | 50.7–52.2 (scene change), 71.5–74.5 (reviewer typing), 83.6–86.2 (scene change), 157.3–end (fade) |
| Captions | 45 cues, ordered, non-overlapping, ≤ 2 lines; **45/45 matched to speech**, mean offset −0.20 s (caption leads voice slightly), max 0.59 s |
| Transcript | Whisper large-v3-turbo transcript of the final mix matches the script; differences are only number and compound formatting |
| Static holds ≥ 4 s | Intro card (8.8 s), landing before Run decision, Policies hold, PayPal button, live B evaluation (Meta latency), Paid request, expanded webhook payload, closing card. All are intended holds under narration; none is an encoding freeze or held-frame padding (the assembler reported no padding) |

Visual inspection: contact sheets of the whole film at 2 s intervals, the first second of every repaired
scene, and full-resolution frames of the dated captions in scenes 7 and 8.

## 4. Polish changes from the draft

- **Hook:** opening line is now three concrete questions (limits, approval, proof) in the first 9 s.
- **Narration:** synthesized per sentence with fixed pauses and light processing; "Meta's Muse Spark" (heard as
  "Meta S-Muse") became "The Meta Muse Spark model"; "IDs" became "identifiers"; the payment scene now states
  that nothing recorded in the session was paid; the reviewer scene gained a line and timed pauses so each
  sentence lands on its action.
- **Pacing:** landing and block scenes are choreographed to sentence timings; no segment is padded with a frozen
  frame; total 2:38.9.
- **Captions:** exact sentence timing, Whisper-timed splits inside long sentences, no split inside a number.
- **Audio/video sync:** one continuous narration track instead of per-part audio (with per-part audio, the
  first final assembly's audio ran 0.17 s longer than its picture).

## 5. Narration quality

The macOS "Samantha" voice is intelligible and even (Whisper recovers every word), with clear pronunciation
of product terms. It is recognizably synthetic. All installed English voices are the same default quality;
no premium voice is installed, and no paid service or cloned voice was used. Intelligibility does not establish redistribution rights. The current Samantha narration is not cleared
for public sharing; replace it with your own recording or demonstrably permitted audio. See
[AUDIO_REPLACEMENT.md](AUDIO_REPLACEMENT.md).

## 6. Secrets and misleading content

- Passcode fields are masked; the agent key and `.env.local` never appear. Captions and on-screen IDs are
  request, payment, PayPal Sandbox order/capture, webhook event and correlation IDs only (already public in docs).
- No payer email or name, no PayPal account pages.
- No fabricated success: the only *Paid* state is the verified 2026-11-05 capture, labelled as such.

## 7. Chapters (for YouTube/Devpost)

0:00 Problem · 0:10 Product · 0:25 Low-risk request · 0:52 Human review · 1:09 Reviewer approval ·
1:26 Prompt-injection block · 1:47 Verified Sandbox payment (Nov 5) · 2:09 Retries, signed webhooks, ledger · 2:32 Close

## 8. Remaining limitations and manual review

- Watch the final once end to end with sound; judge the synthetic voice yourself.
- Parallel Step 8 documents are reconciled with this final artifact and current chapter times.
- Scenario E (decline and recovery) is intentionally not in the video.
- Not uploaded to YouTube; not submitted.

Independent Codex rerun: 158.867 s, 45 cues, no black runs, −16.1 LUFS; cached offline Whisper
matched 45/45 cue onsets (mean −0.20 s, max 0.59 s). All three repaired scene starts were visually
confirmed. Public audio rights remain unresolved.
