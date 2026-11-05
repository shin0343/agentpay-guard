# Rights-cleared narration replacement

The current final video passes technical/continuity QA, but uses Apple's Samantha voice and is **not
cleared for public distribution**. Preserve it. Do not upload it as the submission until narration is
replaced with your own recording or a voice whose applicable terms demonstrably allow public sharing.
Keep provider/model/voice license and permission evidence if using another synthesis tool. Local synthesis
alone, or another installed Apple voice, does not resolve this issue.

## Preserve and prepare

Current files: `qa/step7-video/agentpay-guard-demo-final.mp4` and matching `.srt`.
Hashes are recorded in `FINAL_RELEASE_REPORT.md`. Both original draft and final must remain unchanged.
Create a new working directory; do not run `narrate.py`, which generates Samantha audio.

```sh
mkdir -p qa/step7-video/rights-cleared
cp -n qa/step7-video/agentpay-guard-demo-final.mp4 qa/step7-video/rights-cleared/reference.mp4
cp -n qa/step7-video/agentpay-guard-demo-final.srt qa/step7-video/rights-cleared/reference.srt
```

Read [NARRATION_RECORDING_SCRIPT.md](NARRATION_RECORDING_SCRIPT.md), generated from the reviewed
`scripts/demo/narration.tsv`. Bracketed `[+n]` values in the TSV mean pauses, not spoken words. Preserve
the two-key distinction and the sentence identifying the earlier November 5 Sandbox payment.

## Record against the existing picture

1. Import `reference.mp4` and `reference.srt` into your audio/video editor. Mute the original audio.
   Record your own English voice on a separate track; headphones prevent reference-audio bleed.
2. Use the 45 caption intervals as sentence/phrase timing guides. Record each scene separately if easier;
   align the words with the demonstrated action, not just each scene's start. Allow the reviewer typing pause.
3. Keep picture timing at **158.866667 seconds**. The scene guide is 0:00, 0:10, 0:25, 0:52, 1:09,
   1:26, 1:47, 2:09, 2:32; those displayed chapter times are rounded, not precise audio edit points.
   Use actual subtitle timestamps and the picture for precise placement.
4. Export a complete **48 kHz PCM WAV**, including silence from 0 through the end, as
   `qa/step7-video/rights-cleared/narration.wav`. Make sure all lines finish before the closing fade.
   Avoid aggressive time compression to force a long take into the available window; re-record it.
5. If preserving picture timing is impractical, edit a new video copy and retime captions/chapters.
   The segment assembler needs new measured sentence times in `timing.json`; merely replacing WAVs
   of "similar length" does **not** preserve subtitle accuracy.

With a fully aligned replacement WAV, the following writes a **new** MP4, keeping the original picture:

```sh
ffmpeg -n -i qa/step7-video/rights-cleared/reference.mp4 \
  -i qa/step7-video/rights-cleared/narration.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy \
  -af 'loudnorm=I=-16:TP=-1.5:LRA=11,apad,atrim=duration=158.866667,aresample=48000' \
  -c:a aac -b:a 192k -ac 2 -t 158.866667 -movflags +faststart \
  qa/step7-video/rights-cleared/agentpay-guard-demo-licensed.mp4
```

`-n` refuses to overwrite an existing output. Padding/trimming sets stream length; it cannot establish
that no spoken words were cut. Listen to the last line and every scene transition.

## Revalidate before publication

- Export a new matching English SRT as `agentpay-guard-demo-licensed.srt`. Reuse the old timestamps only
  if every recorded phrase was actually aligned; otherwise retime all affected cues.
- Run `scripts/demo/check-video.py` on the new pair. If Whisper is absent, the script skips speech sync;
  that skip is **not** a caption-sync pass. Inspect its JSON, not just the process exit code.
- Watch/listen end to end, including approval actions, the dated historical capture and the closing line.
  Confirm clear English, no reference-voice bleed, music, clipping, secret/account data or misleading claims.
- Check under 180 seconds, technical stream alignment and actual cue-to-speech timing. Record both new
  SHA-256 hashes and update the selected artifact/chapters in the final report and publication checklist.
- Retain the current MP4/SRT, your recording/source takes, and any third-party voice permission evidence.
  No PayPal payment or new model inference is needed for this audio replacement.
