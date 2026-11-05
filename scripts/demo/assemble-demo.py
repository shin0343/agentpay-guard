"""Assemble the demo: each recorded segment + its narration, padded so narration never gets cut,
then concatenated with loudness-normalized audio. Also writes an SRT caption file."""
import json, re, subprocess, sys
from pathlib import Path

# Usage: python3 scripts/demo/assemble-demo.py <work-dir> [final.mp4]
# <work-dir>/seg holds the recorded segment .mp4 files, <work-dir>/narr holds 01-intro.wav … 09-close.wav.
# Narration text comes from scripts/demo/narration.tsv (TTS: say -v Samantha -r 172).
ROOT = Path(sys.argv[1])
SEG, NARR, OUT = ROOT / "seg", ROOT / "narr", ROOT / "out"
TSV = Path(__file__).parent / "narration.tsv"
OUT.mkdir(exist_ok=True)
ORDER = ["01-intro", "02-product", "03-allow", "04-review", "05-approve", "06-block", "07-paid", "08-ledger", "09-close"]
LEAD, TAIL = 0.5, 0.9  # narration starts LEAD s in; at least TAIL s of picture after it ends

def dur(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(p)], capture_output=True, text=True, check=True).stdout
    return float(json.loads(out)["format"]["duration"])

lines = dict(l.split("\t", 1) for l in TSV.read_text().splitlines() if l)
parts, cues, t = [], [], 0.0
for k in ORDER:
    v, n = dur(SEG / f"{k}.mp4"), dur(NARR / f"{k}.wav")
    length = max(v, LEAD + n + TAIL)
    pad = max(0.0, length - v)
    part = OUT / f"part-{k}.mp4"
    vf = f"tpad=stop_mode=clone:stop_duration={pad:.3f}" if pad > 0.01 else "null"
    if k == ORDER[0]: vf += ",fade=t=in:st=0:d=0.6"
    if k == ORDER[-1]: vf += f",fade=t=out:st={length - 0.8:.3f}:d=0.8"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(SEG / f"{k}.mp4"), "-i", str(NARR / f"{k}.wav"),
        "-filter_complex", f"[0:v]{vf},fps=30,format=yuv420p[v];[1:a]adelay={int(LEAD*1000)}|{int(LEAD*1000)},apad[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{length:.3f}", "-c:v", "libx264", "-crf", "17", "-preset", "medium",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", str(part)], check=True)
    # Captions: split narration into sentences, timed by character share.
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", lines[k]) if s.strip()]
    total = sum(len(s) for s in sentences)
    st = t + LEAD
    for s in sentences:
        d = n * len(s) / total
        cues.append((st, st + d, s.replace("I D's", "IDs")))
        st += d
    print(f"{k:12s} video {v:5.1f}s narration {n:5.1f}s -> {length:5.1f}s")
    parts.append(part); t += length

(OUT / "concat.txt").write_text("".join(f"file '{p.name}'\n" for p in parts))
raw = OUT / "raw.mp4"
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(OUT / "concat.txt"), "-c", "copy", str(raw)], check=True)
final = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT / "agentpay-guard-demo.mp4"
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw), "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(final)], check=True)

def ts(x):
    h, r = divmod(x, 3600); m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}"
srt = final.with_suffix(".srt")
srt.write_text("".join(f"{i}\n{ts(a)} --> {ts(b)}\n{txt}\n\n" for i, (a, b, txt) in enumerate(cues, 1)))
print(f"total {t:.1f}s -> {final}")
