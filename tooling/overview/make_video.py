"""Explainer video from the deck: each slide (1920x1080) held for the length
of its narration (the slide's speaker notes, read by the Kokoro text-to-
speech model, voice af_bella by default), with soft subtitles. Writes
<out>.mp4 and <out>.vtt.

Env: KOKORO_VOICE (default af_bella). TTS=say uses macOS `say` instead.
Kokoro runs locally (pip install kokoro soundfile; the model downloads
from Hugging Face, hexgrad/Kokoro-82M, on first use)."""
import os
import re
import subprocess
import sys
from pathlib import Path

from pptx import Presentation

deck, pdf, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
work = Path("video-work")
work.mkdir(exist_ok=True)
TTS = os.environ.get("TTS", "kokoro")
VOICE = os.environ.get("KOKORO_VOICE", "af_bella")
SAY_VOICE, SAY_RATE = "Samantha", "172"
# Spoken forms only -- captions keep the written text.
PRONOUNCE = {"GenAI": "Gen A I", "OWASP": "Oh-wasp", "PDF": "P D F", "PRs": "P Rs", "PR": "P R"}

if TTS == "kokoro":
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline
    _pipe = KPipeline(lang_code=VOICE[0], repo_id="hexgrad/Kokoro-82M")


def speak(text, wav):
    spoken = text
    for word, said in PRONOUNCE.items():
        spoken = re.sub(rf"\b{re.escape(word)}\b", said, spoken)
    if TTS == "kokoro":
        audio = np.concatenate([a for _, _, a in _pipe(spoken, voice=VOICE, speed=1.0)])
        sf.write(str(wav), audio, 24000)
    else:
        subprocess.run(["say", "-v", SAY_VOICE, "-r", SAY_RATE, "-o", str(wav), spoken], check=True)
LEAD, TAIL = 0.6, 0.9  # seconds of silence before/after each slide's narration

notes = [s.notes_slide.notes_text_frame.text.strip() if s.has_notes_slide else "" for s in Presentation(deck).slides]

for f in work.glob("s-*.png"):
    f.unlink()
subprocess.run(["pdftoppm", "-png", "-scale-to-x", "1920", "-scale-to-y", "1080", str(pdf), str(work / "s")], check=True)
images = sorted(work.glob("s-*.png"))
assert len(images) == len(notes), (len(images), len(notes))


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def ts(t, sep="."):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}".replace(".", sep)


segments, cues, clock = [], [], 0.0
for i, (img, text) in enumerate(zip(images, notes), 1):
    aiff = work / f"n{i:02d}.wav"
    speak(text, aiff)
    speech = duration(aiff)
    total = LEAD + speech + TAIL
    seg = work / f"seg{i:02d}.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-loop", "1", "-framerate", "30", "-i", str(img),
        "-i", str(aiff),
        "-filter_complex", f"[1:a]adelay={int(LEAD * 1000)}:all=1,apad,aresample=48000[a]",
        "-map", "0:v", "-map", "[a]",
        "-t", f"{total:.3f}",
        "-c:v", "libx264", "-tune", "stillimage", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30",
        "-c:a", "aac", "-b:a", "128k", "-ac", "1",
        str(seg)], check=True)
    segments.append(seg)

    # Subtitles: split into sentences, timed in proportion to their length.
    sentences = []
    for sent in (x.strip() for x in re.split(r"(?<=[.!?])\s+", text) if x.strip()):
        # Long sentences become several captions, broken after commas/semicolons.
        chunk = ""
        for part in re.split(r"(?<=[,;:])\s+", sent):
            if chunk and len(chunk) + len(part) > 90:
                sentences.append(chunk)
                chunk = part
            else:
                chunk = f"{chunk} {part}".strip()
        if chunk:
            sentences.append(chunk)
    chars = sum(len(x) for x in sentences) or 1
    t = clock + LEAD
    for sentence in sentences:
        d = speech * len(sentence) / chars
        cues.append((t, t + d, sentence))
        t += d
    clock += total
    print(f"slide {i}: {total:5.1f}s")

listing = work / "list.txt"
listing.write_text("".join(f"file '{s.resolve()}'\n" for s in segments))
vtt = out.with_suffix(".vtt")
srt = work / "subs.srt"
vtt.write_text("WEBVTT\n\n" + "\n".join(f"{ts(a)} --> {ts(b)}\n{c}\n" for a, b, c in cues))
srt.write_text("\n".join(f"{n}\n{ts(a, ',')} --> {ts(b, ',')}\n{c}\n" for n, (a, b, c) in enumerate(cues, 1)))

subprocess.run([
    "ffmpeg", "-y", "-loglevel", "error",
    "-f", "concat", "-safe", "0", "-i", str(listing),
    "-i", str(srt),
    "-map", "0", "-map", "1",
    "-c:v", "copy", "-c:s", "mov_text",
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
    "-metadata:s:s:0", "language=eng",
    "-metadata", "title=How the GenAI translation pipeline works",
    "-movflags", "+faststart",
    str(out.with_suffix(".mp4"))], check=True)
print(f"total {clock / 60:.1f} min ->", out.with_suffix(".mp4"), vtt)
