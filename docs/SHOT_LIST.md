# Shot list

How draft 1 was produced, and how to reproduce or re-shoot any segment.

## Capture setup

| Setting | Value |
|---|---|
| App | `pnpm build:webpack && pnpm start -p 3200`, `DATABASE_URL` → `apg_step7_video` (fresh clone of the evidence DB), `APP_URL=http://127.0.0.1:3200` |
| Browser | Playwright 1.64.1 Chromium, `--force-device-scale-factor=1.3333333 --window-size=1440,810` |
| Capture | Chrome DevTools `Page.startScreencast` JPEG q90 → 1920×1080 frames with real timestamps → ffmpeg concat → H.264 CRF 16, 30 fps |
| Overlay | Injected only during recording: arrow cursor, click ring, lower-left caption, blue outline. Never part of the product |
| Narration | `say -v Samantha -r 172` → 48 kHz WAV; assembled with 0.5 s lead, loudness-normalized to −16 LUFS |
| Scripts | `scripts/demo/record-demo.cjs`, `scripts/demo/assemble-demo.py`, `scripts/demo/cards.html`, `scripts/demo/narration.tsv` |

Passcodes and the agent key are read from `.env.local` inside the recorder and never printed or shown.
Passcode fields are masked on screen.

## Segments

| ID | Length | Starts on | Actions | Live calls made |
|---|---|---|---|---|
| 01-intro | 11.5 s | `cards.html#intro` | Hold | None |
| 02-product | 14.6 s | `/` | Tab "$2,400 gift cards" → Run decision → scroll to `#ledger` | None (hero is local) |
| 03-allow | 26.1 s | `/policies` (operator) | Hold on the eight rules → agent API POST (exact catalog quote, fresh key) → open new row → outline keys → outline model line → Continue to PayPal → wait for SDK | Meta inference ×1, PayPal SDK load (no order) |
| 04-review | 17.9 s | `/requests` (operator) | Send B → outline P-01, P-04 → `/review/<id>` → outline "Only reviewers can decide." | Meta inference ×1 |
| 05-approve | 16.9 s | `/login?next=/review/<id>` | Type reviewer passcode (masked) → note → Approve purchase → View request → outline keys | None |
| 06-block | 21.5 s | `/requests` (operator) | Send C → outline injection signal → outline `PayPal calls 0` | Meta inference ×1 |
| 07-paid | 18.5 s | `/requests/preq_01M6PAT02AJK7SF54JHJ7W5CQ8` | Outline keys → View payment → outline order and capture IDs → outline capture attempts | None (read only) |
| 08-ledger | 21.0 s | `/requests` (operator) | Send D "Network retry" → outline replay notice → Ledger → expand latest `webhook.received` → outline payload → outline "Chain verified" | None |
| 09-close | 7.5 s | `cards.html#close` | Hold, fade out | None |

## Constraints met while shooting

- Scenario B can only be re-sent 10 minutes after the last B, because duplicate guard P-07 blocks it. Wait or use a fresh clone.
- Items outside the trusted catalog go to review (P-04) by design. Use the exact scenario A quote for an Allowed request.
- Daily budget P-02 counts every allowed request today. After several takes a new $18 request goes to review; use a fresh clone.
- Meta inference has an 8-second deadline. One take of C timed out (still blocked by rules, AI marked unavailable); it was re-shot so the narration about the model flagging the injection stays true.
- Scenario A's sheet entry uses a fixed idempotency key, so on a database that already ran A it replays the earlier request.

## Re-shooting with a human voice

1. Record each line of `docs/DEMO_NARRATION.md` as `01-intro.wav` … `09-close.wav` (48 kHz).
2. Replace the files in the narration folder and re-run `assemble-demo.py`. Segment lengths stretch to fit the voice.
