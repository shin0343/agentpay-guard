"""Assemble the demo from recorded segments and narration.

Usage: python3 scripts/demo/assemble-demo.py <work-dir> [final.mp4]
<work-dir>/seg holds the recorded segment .mp4 files; <work-dir>/narr holds 01-intro.wav … 09-close.wav
and timing.json from narrate.py. Writes final.mp4 and a matching .srt next to it.

Video parts are cut to an exact frame count and joined without re-timing. Narration is placed on one
continuous audio track at absolute offsets, so audio cannot drift against the picture. A segment is
padded with a held frame only if its recording is shorter than its narration (reported as a warning).
"""
import json, subprocess, sys
from pathlib import Path

ROOT = Path(sys.argv[1])
SEG, NARR, OUT = ROOT / "seg", ROOT / "narr", ROOT / "out"
OUT.mkdir(exist_ok=True)
ORDER = ["01-intro", "02-product", "03-allow", "04-review", "05-approve", "06-block", "07-paid", "08-ledger", "09-close"]
LEAD, TAIL, FPS = 0.5, 0.9, 30  # narration starts LEAD s into a segment; at least TAIL s of picture after it

def run(*a): subprocess.run(a, check=True)
def dur(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(p)],
                         capture_output=True, text=True, check=True).stdout
    return float(json.loads(out)["format"]["duration"])

timing = json.loads((NARR / "timing.json").read_text())
parts, cues, starts, t = [], [], [], 0.0
for k in ORDER:
    v, n = dur(SEG / f"{k}.mp4"), timing[k]["duration"]
    frames = round(max(v, LEAD + n + TAIL) * FPS)
    length = frames / FPS
    pad = max(0.0, length - v)
    if pad > 0.05: print(f"  warning: {k} padded {pad:.2f}s with a held frame")
    vf = f"tpad=stop_mode=clone:stop_duration={pad + 0.1:.3f}," if pad > 0 else ""
    vf += f"fps={FPS},format=yuv420p"
    if k == ORDER[0]: vf += ",fade=t=in:st=0:d=0.6"
    if k == ORDER[-1]: vf += f",fade=t=out:st={length - 0.8:.3f}:d=0.8"
    part = OUT / f"part-{k}.mp4"
    run("ffmpeg", "-loglevel", "error", "-y", "-i", str(SEG / f"{k}.mp4"), "-vf", vf, "-frames:v", str(frames),
        "-an", "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-r", str(FPS), str(part))
    for c in timing[k]["cues"]:
        cues.append((t + LEAD + c["start"], t + LEAD + c["end"], c["text"]))
    print(f"{k:12s} video {v:5.1f}s narration {n:5.1f}s -> {length:5.2f}s at {t:6.2f}s")
    parts.append(part); starts.append(t); t += length

(OUT / "concat.txt").write_text("".join(f"file '{p.name}'\n" for p in parts))
video = OUT / "video.mp4"
run("ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(OUT / "concat.txt"), "-c", "copy", str(video))

inputs, chains = [], []
for i, (k, s0) in enumerate(zip(ORDER, starts)):
    inputs += ["-i", str(NARR / f"{k}.wav")]
    ms = round((s0 + LEAD) * 1000)
    chains.append(f"[{i + 1}:a]adelay={ms}|{ms}[a{i}]")
mix = ";".join(chains) + ";" + "".join(f"[a{i}]" for i in range(len(ORDER))) + \
      f"amix=inputs={len(ORDER)}:normalize=0,apad,atrim=0:{t:.3f},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]"
final = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT / "agentpay-guard-demo.mp4"
run("ffmpeg", "-loglevel", "error", "-y", "-i", str(video), *inputs, "-filter_complex", mix,
    "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{t:.3f}",
    "-movflags", "+faststart", str(final))

def ts(x):
    h, r = divmod(x, 3600); m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}"
final.with_suffix(".srt").write_text("".join(f"{i}\n{ts(a)} --> {ts(b)}\n{txt}\n\n" for i, (a, b, txt) in enumerate(cues, 1)))
(OUT / "chapters.json").write_text(json.dumps({k: round(s, 2) for k, s in zip(ORDER, starts)}, indent=1))
print(f"total {t:.2f}s -> {final}")
