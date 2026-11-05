# Shot list and production pipeline

How the final video was produced, and how to reproduce or re-shoot any part. Story and timings:
[DEMO_STORYBOARD.md](DEMO_STORYBOARD.md). QA results: [VIDEO_FINAL_QA.md](VIDEO_FINAL_QA.md).

## Pipeline

```bash
W=/tmp/apg-video                                   # any scratch directory
python3 scripts/demo/narrate.py $W                 # narr/*.wav + narr/timing.json (macOS say; whisper optional)
python3 -c "import json;t=json.load(open('$W/narr/timing.json'));json.dump({k:max(1.4+v['duration'],7.0 if k=='09-close' else 0) for k,v in t.items()},open('$W/targets.json','w'))"
# App: production build on a disposable clone of your database, port 3200
DATABASE_URL=postgresql://…/clone APP_URL=http://127.0.0.1:3200 pnpm start -p 3200 -H 127.0.0.1
TIMING_FILE=$W/narr/timing.json TARGETS_FILE=$W/targets.json NODE_PATH=<playwright> \
  node scripts/demo/record-demo.cjs $W/seg          # optionally: a comma-separated segment list
python3 scripts/demo/assemble-demo.py $W qa/step7-video/agentpay-guard-demo-final.mp4
python3 scripts/demo/check-video.py qa/step7-video/agentpay-guard-demo-final.mp4 qa/step7-video/agentpay-guard-demo-final.srt
```

| Stage | What it guarantees |
|---|---|
| `narrate.py` | One TTS call per sentence; exact sentence start times; captions ≤ 2 × 42 characters, split at clauses or prepositions; split times from Whisper word timestamps when `mlx_whisper` is available |
| `record-demo.cjs` | Chrome DevTools screencast at 1920×1080 (1440×810 CSS at 4/3 scale), re-timed to constant 30 fps from capture timestamps; each segment runs at least as long as its narration (`TARGETS_FILE`), and scenes 2 and 6 act on the sentence that describes them (`TIMING_FILE`) |
| `assemble-demo.py` | Frame-exact parts joined without re-timing; one continuous narration track placed at absolute offsets (no drift); −16 LUFS; warns if any segment would need a held frame |
| `check-video.py` | Duration < 3:00, 1920×1080, audio present, frame count = duration × 30, no black runs, caption order, caption-to-speech offset ≤ 0.6 s (Whisper) |

Passcodes and the agent key are read from `.env.local` inside the recorder, never printed, and the
passcode field is masked on screen. The overlay (cursor, click ring, caption, outline) exists only
during recording; it is not product UI.

## Segments

| ID | Final length | Opens on | Actions | Live calls |
|---|---|---|---|---|
| 01-intro | 9.9 s | `cards.html#intro` | Hold | None |
| 02-product | 15.0 s | `/` | $2,400 tab → Run decision → outline AI boundary → scroll to recorded ledger, outline two rows | None (hero is local) |
| 03-allow | 26.8 s | `/policies` | Hold on rules → agent API POST → Requests → open new row → outline keys, model line → Continue to PayPal | Meta ×1, PayPal SDK load (no order) |
| 04-review | 17.0 s | the new B request, *Evaluating* | Recorder sends B through the demo runner with the operator session, then opens Requests client-side so the newest row is this request → *Needs review* → outline P-01, P-04 → review screen as operator | Meta ×1 |
| 05-approve | 16.9 s | `/login?next=/review/<id>` | Reviewer passcode (masked) → note → Approve → View request → outline keys | None |
| 06-block | 21.0 s | the C request | Quote → injection → P-03, P-01 → `PayPal calls 0` → request ledger, timed to narration | None in the final take (`C_ID` mode; see below) |
| 07-paid | 22.3 s | `/requests/preq_01M6PAT02AJK7SF54JHJ7W5CQ8` | Keys → View payment → capture attempts → order and capture IDs | None (read only) |
| 08-ledger | 22.9 s | `/policies` with the scenario sheet open | Network retry → replay notice → Ledger → expand `webhook.received` → "Chain verified" | None (duplicate is blocked before AI) |
| 09-close | 7.0 s | `cards.html#close` | Hold, fade out | None |

## Constraints met while shooting

- `/requests` shows the newest request automatically. Scenes therefore open on the request they are about, or
  on Policies; never on `/requests` before the scene's own request exists. This fixed the draft's continuity bug.
- Duplicate guard P-07 blocks an identical request for 10 minutes; re-shooting B or C requires waiting.
- Daily budget P-02 counts every allowed request today; use a fresh clone for each full take.
- Items outside the trusted catalog go to review (P-04). Use the exact scenario A quote for an Allowed request.
- Meta inference has an 8-second deadline. Scenario C takes about 7 s and timed out in 3 of 6 live attempts
  (each still blocked by rules, AI marked unavailable). `C_ID=<request>` and `C_NOTE="…"` film a C request that
  was evaluated earlier in the same session, with the evaluation time in the caption.
