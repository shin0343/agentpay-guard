"""QA for a rendered demo: streams, duration, frame count, frozen/black runs, loudness, caption sync.

Usage: python3 scripts/demo/check-video.py <video.mp4> <captions.srt>
Caption sync needs the optional `mlx_whisper` package and a cached whisper model; without it that
check is skipped. Prints a JSON report and exits nonzero on a hard failure.
"""
import json, re, subprocess, sys

video, srt = sys.argv[1], sys.argv[2]
def ff(*a): return subprocess.run(a, capture_output=True, text=True)
report, fail = {}, []

probe = json.loads(ff("ffprobe", "-v", "error", "-show_entries",
    "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels:format=duration",
    "-of", "json", video).stdout)
v = next(s for s in probe["streams"] if s["codec_type"] == "video")
a = [s for s in probe["streams"] if s["codec_type"] == "audio"]
dur = float(probe["format"]["duration"])
report.update(duration=round(dur, 2), video=f'{v["codec_name"]} {v["width"]}x{v["height"]} {v["r_frame_rate"]}',
              frames=int(v.get("nb_frames", 0)), expected_frames=round(dur * 30),
              audio=[f'{s["codec_name"]} {s["sample_rate"]}Hz {s["channels"]}ch' for s in a])
if dur >= 180: fail.append("duration >= 3:00")
if (v["width"], v["height"]) != (1920, 1080): fail.append("not 1920x1080")
if not a: fail.append("no audio stream")
if abs(report["frames"] - report["expected_frames"]) > 2: fail.append("frame count does not match duration")

err = ff("ffmpeg", "-nostats", "-i", video, "-vf", "freezedetect=n=0.0008:d=3,blackdetect=d=0.3:pix_th=0.05",
         "-af", "ebur128=framelog=quiet", "-f", "null", "-").stderr
report["freezes_over_3s"] = [(round(float(s), 1), round(float(d), 1)) for s, d in
    zip(re.findall(r"freeze_start: ([\d.]+)", err), re.findall(r"freeze_duration: ([\d.]+)", err))]
report["black_runs"] = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", err)
m = re.search(r"I:\s+(-?[\d.]+) LUFS", err); report["integrated_lufs"] = float(m.group(1)) if m else None
m = re.search(r"Peak:\s+(-?[\d.]+) dBFS", err); report["true_peak_dbfs"] = float(m.group(1)) if m else None

def secs(t): h, m_, rest = t.split(":"); s, ms = rest.split(","); return int(h) * 3600 + int(m_) * 60 + int(s) + int(ms) / 1000
cues = [(secs(a_), secs(b_), " ".join(txt.split("\n")).strip()) for a_, b_, txt in
        re.findall(r"\d+\n([\d:,]+) --> ([\d:,]+)\n(.*?)(?:\n\n|\Z)", open(srt).read(), re.S)]
report["captions"] = len(cues)
if any(b <= a_ for a_, b, _ in cues) or any(cues[i][1] > cues[i + 1][0] + 0.001 for i in range(len(cues) - 1)):
    fail.append("caption timing invalid or overlapping")
if cues and cues[-1][1] > dur: fail.append("caption after end of video")

try:
    import mlx_whisper
    r = mlx_whisper.transcribe(video, path_or_hf_repo="mlx-community/whisper-large-v3-turbo", language="en", word_timestamps=True)
    words = [(w["start"], re.sub(r"[^a-z0-9]", "", w["word"].lower())) for seg in r["segments"] for w in seg["words"]]
    offsets = []
    for a_, b_, txt in cues:
        first = re.sub(r"[^a-z0-9]", "", txt.split()[0].lower())
        near = [ws for ws, w in words if abs(ws - a_) < 2.5 and (w == first or w.startswith(first[:4]) or first.startswith(w[:4] or "#"))]
        offsets.append(round(min(near, key=lambda x: abs(x - a_)) - a_, 2) if near else None)
    found = [o for o in offsets if o is not None]
    report["caption_sync"] = {"matched": f"{len(found)}/{len(cues)}", "max_abs_offset_s": max(map(abs, found)) if found else None,
                              "mean_offset_s": round(sum(found) / len(found), 2) if found else None,
                              "unmatched": [cues[i][2] for i, o in enumerate(offsets) if o is None]}
    report["transcript"] = r["text"].strip()
    if found and max(map(abs, found)) > 0.6: fail.append("caption more than 0.6 s from speech")
except ImportError:
    report["caption_sync"] = "skipped (mlx_whisper not installed)"

report["failures"] = fail
print(json.dumps(report, indent=1))
sys.exit(1 if fail else 0)
