"""Build the demo narration from scripts/demo/narration.tsv with the local macOS voice.

Usage: python3 scripts/demo/narrate.py <work-dir>
Writes <work-dir>/narr/<segment>.wav and <work-dir>/narr/timing.json.

Each sentence is synthesized separately (natural sentence prosody), edge silence is trimmed,
and sentences are joined with a fixed pause, so caption start times are exact per sentence.
A marker such as `[+2.5]` after a sentence adds that many seconds of extra pause, to land the next
sentence on the action it describes.
Long sentences are split into caption chunks at clause or preposition boundaries. When the optional
`mlx_whisper` package and a cached model are present, chunk start times come from word timestamps;
otherwise they are estimated by character share. No paid service, cloned voice or network call is used.
"""
import json, re, subprocess, sys, tempfile
from pathlib import Path

VOICE, RATE, GAP, SR = "Samantha", "172", 0.34, 48000
LINE, CUE = 42, 84  # caption characters per line / per cue
TSV = Path(__file__).parent / "narration.tsv"

def run(*a): subprocess.run(a, check=True, capture_output=True)
def dur(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                         capture_output=True, text=True, check=True).stdout
    return float(out)

def split_cue(s):
    """Split a sentence into chunks of at most CUE characters at natural breaks near the middle."""
    if len(s) <= CUE: return [s]
    mid, best = len(s) / 2, None
    # Clause punctuation first; otherwise before a conjunction or preposition. Never inside "eighteen dollars".
    for pattern in (r"(, |: |; )", r" (and|to|from|at|for|with|before|after|inside|by|in) "):
        for m in re.finditer(pattern, s):
            cut = m.end() if m.group(0).strip() in (",", ":", ";") else m.start() + 1
            if 15 <= cut <= len(s) - 15 and max(cut, len(s) - cut) <= CUE + 10 and (best is None or abs(cut - mid) < abs(best - mid)):
                best = cut
        if best is not None: break
    if best is None: best = s.rfind(" ", 0, int(mid)) + 1
    return split_cue(s[:best].strip()) + split_cue(s[best:].strip())

try:
    import mlx_whisper
except Exception:
    mlx_whisper = None

def norm(w): return re.sub(r"[^a-z0-9]", "", w.lower())

def chunk_starts(wav, chunks, d):
    """Start time of each chunk inside one sentence: whisper word timestamps, else character share."""
    total = sum(len(c) for c in chunks)
    est = [d * sum(len(c) for c in chunks[:i]) / total for i in range(len(chunks))]
    if mlx_whisper is None or len(chunks) == 1: return est
    try:
        r = mlx_whisper.transcribe(str(wav), path_or_hf_repo="mlx-community/whisper-large-v3-turbo", language="en", word_timestamps=True)
        words = [(w["start"], norm(w["word"])) for seg in r["segments"] for w in seg["words"]]
    except Exception:
        return est
    out = [0.0]
    for i, c in enumerate(chunks[1:], 1):
        first = norm(c.split()[0])
        near = [t for t, w in words if w and (w == first or w[:4] == first[:4]) and abs(t - est[i]) < 1.5]
        out.append(min(near, key=lambda t: abs(t - est[i])) - 0.05 if near else est[i])
    return out

def wrap(t):
    if len(t) <= LINE: return t
    cut = min((i for i, c in enumerate(t) if c == " "), key=lambda i: abs(i - len(t) / 2))
    return t[:cut] + "\n" + t[cut + 1:]

work = Path(sys.argv[1]); narr = work / "narr"; narr.mkdir(parents=True, exist_ok=True)
rows = [l.split("\t", 1) for l in TSV.read_text().splitlines() if l.strip()]
timing = {}
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    for key, text in rows:
        extra = {}
        sentences = []
        for piece in re.split(r"(\[\+[\d.]+\])", text):
            m = re.fullmatch(r"\[\+([\d.]+)\]", piece.strip())
            if m: extra[len(sentences) - 1] = float(m.group(1)); continue
            sentences += [x.strip() for x in re.split(r"(?<=[.!?])\s+", piece) if x.strip()]
        parts, cues, t = [], [], 0.0
        for i, s in enumerate(sentences):
            aiff, wav = tmp / f"{key}-{i}.aiff", tmp / f"{key}-{i}.wav"
            spoken = s.replace("de-duplicated", "dee-duplicated")
            run("say", "-v", VOICE, "-r", RATE, "-o", str(aiff), spoken)
            run("ffmpeg", "-y", "-i", str(aiff), "-af",
                "silenceremove=start_periods=1:start_silence=0.03:start_threshold=-55dB,areverse,"
                "silenceremove=start_periods=1:start_silence=0.08:start_threshold=-55dB,areverse",
                "-ar", str(SR), "-ac", "1", str(wav))
            d = dur(wav)
            chunks = split_cue(s)
            starts = chunk_starts(wav, chunks, d) + [d]
            for j, c in enumerate(chunks):
                cues.append({"start": round(t + max(0.0, starts[j]), 3), "end": round(t + starts[j + 1], 3), "text": wrap(c)})
            parts.append(wav); t += d
            if i < len(sentences) - 1:
                gap = tmp / f"{key}-{i}-gap.wav"
                g = GAP + extra.get(i, 0.0)
                run("ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", str(g), str(gap))
                parts.append(gap); t += g
        lst = tmp / f"{key}.txt"; lst.write_text("".join(f"file '{p}'\n" for p in parts))
        run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-af",
            "highpass=f=80,acompressor=threshold=-20dB:ratio=2:attack=5:release=90:makeup=2",
            "-ar", str(SR), "-ac", "2", str(narr / f"{key}.wav"))
        timing[key] = {"duration": round(dur(narr / f"{key}.wav"), 3), "cues": cues}
        print(f"{key:12s} {timing[key]['duration']:5.1f}s {len(sentences)} sentences {len(cues)} cues")
(narr / "timing.json").write_text(json.dumps(timing, indent=1))
print("total narration", round(sum(v["duration"] for v in timing.values()), 1), "s")
