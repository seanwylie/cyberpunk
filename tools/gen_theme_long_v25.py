#!/usr/bin/env python3
"""theme_main_long via ElevenLabs music_v2_5: theme_main (raw) is uploaded once for Audio Reference, then a composition plan with
strictly enforced chunk durations follows Sean's shape (intro/A, dip, build, dip, bigger build, hard dip, biggest build, long outro),
every chunk conditioned on the matching part of theme_main (references are capped at 30 s by the API). Writes tools/.music_raw/theme_main_long_v25.mp3 (candidate; tools/extend_theme.py
is the ffmpeg re-arrangement alternative). Usage: ELEVENLABS_API_KEY=... python3 tools/gen_theme_long_v25.py [song_id]"""
import os, sys, json, subprocess, pathlib, urllib.request
ROOT = pathlib.Path(__file__).resolve().parent.parent; RAW = ROOT/'tools'/'.music_raw'; KEY = os.environ['ELEVENLABS_API_KEY']
song = sys.argv[1] if len(sys.argv) > 1 else json.loads(subprocess.run(['curl','-s','-X','POST','https://api.elevenlabs.io/v1/music/upload','-H',f'xi-api-key: {KEY}','-F',f"file=@{RAW/'theme_main.mp3'}"],capture_output=True,text=True).stdout)['song_id']
BASE = ["instrumental", "cinematic dark ambient post-rock", "D minor", "84 bpm", "lonely repeating felt piano motif", "soft electronic pulse", "tremolo guitars", "low strings", "great production quality"]
def ch(name, sec, a, b, styles, strength='high'):
    return {"text": f"[{name}]", "duration_ms": int(sec*1000), "positive_styles": BASE + styles, "negative_styles": ["vocals", "singing", "major key", "upbeat"],
            "context_adherence": "high", "conditioning_ref": {"song_id": song, "range": {"start_ms": int(a*1000), "end_ms": int(min(b, a+30)*1000)}}, "condition_strength": strength}
plan = {"chunks": [
    ch("Intro and theme", 40, 0, 40, ["the lone piano states the motif", "quiet, mournful"], 'xhigh'),
    ch("Dip one", 16, 34, 45, ["sparse", "piano and pulse only", "quiet"]),
    ch("Build one", 30, 45, 75, ["drums enter", "guitars swell", "moderate climax"]),
    ch("Dip two", 16, 22, 34, ["sparse", "soft piano", "quiet"]),
    ch("Build two", 40, 45, 90, ["bigger build", "driving drums", "walls of tremolo guitar", "loud climax"]),
    ch("Hard dip", 18, 0, 11, ["near silence", "a lone soft piano note and faint pulse", "very quiet"]),
    ch("Final build", 60, 56, 103, ["massive final build", "biggest climax of the piece", "roaring wall of guitars and strings", "pounding drums", "maximum intensity"], 'xhigh'),
    ch("Outro", 30, 100, 116, ["long slow fade out", "falls back to the lone piano", "ends in silence"]),
]}
body = json.dumps({"composition_plan": plan, "model_id": os.environ.get('MUSIC_MODEL', 'music_v2_5')}).encode()
req = urllib.request.Request("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", body, {"xi-api-key": KEY, "Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=900) as r: (RAW/'theme_main_long_v25.mp3').write_bytes(r.read())
except urllib.error.HTTPError as e: sys.exit(f'{e.code} {e.read()[:400]}')
print('song_id', song, 'saved', RAW/'theme_main_long_v25.mp3')
