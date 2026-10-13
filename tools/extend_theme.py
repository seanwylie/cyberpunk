#!/usr/bin/env python3
"""Build theme_main_long.mp3 by re-arranging theme_main's own audio (literally the same music) at its phrase boundaries.
Phrase starts (4 bars at 84 bpm, ~11.43 s) come from the raw generation's beat grid (tools/.music_raw/theme_main.mp3, or the shipped
mp3 as a fallback). Joins are equal-power crossfades centred on the phrase downbeat. The ending is a long fade to silence (strict tail rule).
Usage: python3 tools/extend_theme.py"""
import subprocess, pathlib, numpy as np
ROOT = pathlib.Path(__file__).resolve().parent.parent; OUT = ROOT/'public'/'audio'/'music'
SRC = ROOT/'tools'/'.music_raw'/'theme_main.mp3'
if not SRC.exists(): SRC = OUT/'theme_main.mp3'
SR = 44100
x = np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',str(SRC),'-ac','2','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout, np.float32).reshape(-1,2).astype(np.float64)
P = [0.07, 11.49, 22.92, 34.37, 45.51, 56.82, 68.29, 79.71, 91.14, 102.56]  # phrase downbeats (s)
END = len(x)/SR
# Shape (Sean): intro/A, dip 1, build 1, dip 2, build 2 (bigger), HARD dip (lone piano, near silence), massive final build, long fade.
# (start, end, gain) spans of the original in play order; builds use the original build + climax phrases at rising gains.
PLAN = [(P[0], P[4], .80),               # intro + A: the lonely piano statement
        (P[3], P[4], .60),               # dip 1: sparse phrase, softer
        (P[4], P[6], .50),               # build 1: build phrase into the first climax phrase (lowest peak)
        (P[2], P[3], .55),               # dip 2: sparse piano
        (P[4], P[8], .70),               # build 2: build + two climax phrases (higher peak)
        (P[9], 106.0, .50), (P[3], P[4], .16),  # HARD dip: the fall, then a lone piano phrase near silence
        (P[4], P[9], 1.0), (P[8], P[9], 1.0),   # final build: full build + whole climax, its loudest phrase twice (highest peak)
        (P[9], 112.0, .80), (P[1], P[2], .55)]  # outro: the fall into a last lone-piano phrase, long fade
XF = 0.72  # two beats at 84 bpm... one beat each side of the downbeat
def seg(a, b, pre, post): return x[max(0,int((a-pre)*SR)):min(len(x),int((b+post)*SR))]
out = None
for i, (a, b, gn) in enumerate(PLAN):
    s = seg(a, b, XF/2 if i else 0, XF/2 if i < len(PLAN)-1 else 0).copy()*gn
    if out is None: out = s; continue
    n = int(XF*SR); t = np.linspace(0, np.pi/2, n)[:, None]
    out[-n:] = out[-n:]*np.cos(t) + s[:n]*np.sin(t); out = np.concatenate([out, s[n:]])
# long ending: the last (lone piano) span fades to silence over its final 16 s, then 0.5 s of silence
F = int(16*SR); g = np.cos(np.linspace(0, np.pi/2, F))**2; out[-F:] *= g[:, None]; out = np.concatenate([out, np.zeros((SR//2, 2))])
ref = np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',str(OUT/'theme_main.mp3'),'-ac','2','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout, np.float32)
def peak_rms(z, w=3*SR): z = z.reshape(-1); m = np.convolve(z**2, np.ones(w)/w, 'valid'); return np.sqrt(m.max())
gain = peak_rms(ref.astype(np.float64)[::2].copy())*1.12/peak_rms(out[:,0].copy())  # final climax ~1 dB above theme_main's loudest moment
out *= gain; pk = np.abs(out).max()
if pk > 0.98: out *= 0.98/pk
dst = OUT/'theme_main_long.mp3'
subprocess.run(['ffmpeg','-y','-v','error','-f','f64le','-ar',str(SR),'-ac','2','-i','-','-b:a','80k',str(dst)], input=out.astype(np.float64).tobytes(), check=True)
print(dst, f'{len(out)/SR:.1f}s', dst.stat().st_size//1024, 'KB')
