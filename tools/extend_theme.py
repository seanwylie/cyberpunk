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
# Meter: theme_main is exactly 84 bpm (beat fit: eighth 0.35714 s, first downbeat 0.064 s), bar = 2.857 s. Every join goes from an
# end e to a start s with e - s a whole number of bars, so 4/4 never breaks. The climax chain (45.51 -> 102.56, its loudest phrase
# again, the fall to 112) is kept exactly as shipped; all other cut points share its bar phase (true downbeat - 0.27 s).
BAR = 4*60/84; TP = lambda k: 0.064 + 4*BAR*k          # true phrase downbeats
q = lambda k: TP(k) - 0.27                               # cut points at the climax chain's bar phase
PLAN = [(0.0,  q(4), .80),                               # intro + A
        (q(3), q(4), .60, 2, -9),                        # dip 1 (4 bars); swells up from the intro's level over 2 bars
        (q(4), q(6), .50, 4, -9),                        # build 1 (8 bars); swells in over 4 bars
        (q(2), q(3), .55),                               # dip 2 (4 bars)
        (q(4), 91.13, .70, 4, -11),                      # build 2 swells in over 4 bars (16 bars, ends one phrase before the fall)
        (102.56, 102.56 + BAR*25 - 71.43 + 2.95, .50),   # the fall (ends 25 bars after the lone-piano start)
        (q(3), 45.51, .16),                              # HARD dip: lone piano phrase (4 bars) into the climax
        (45.51, 102.56, 1.0), (91.14, 102.56, 1.0),      # final build + its loudest phrase again (unchanged)
        (102.56, 112.0, .80),                            # the fall (unchanged)
        (112.0 - 35*BAR, 112.0 - 31*BAR, .55)]           # outro lone piano, phase-locked to the fall's end (35 bars back)
XF = 0.72  # two beats at 84 bpm... one beat each side of the downbeat
def seg(a, b, pre, post): return x[max(0,int((a-pre)*SR)):min(len(x),int((b+post)*SR))]
out = None
# Swells (Sean: a section must fade louder, never jump): (bars, start dB) ramps the incoming section from start dB to its gain,
# linear in dB, starting at the join downbeat; sized so the join itself is level-matched (no >4 dB step within 0.5 s).
for i, (a, b, gn, *sw) in enumerate(PLAN):
    pre = XF/2 if i else 0
    s = seg(a, b, pre, XF/2 if i < len(PLAN)-1 else 0).copy()*gn
    if sw:
        n = int(sw[0]*BAR*SR); r = 10**(np.linspace(sw[1], 0, n)/20); m = int(pre*SR)
        s[:m] *= r[0]; s[m:m+n] *= r[:len(s)-m][:, None]
    if out is None: out = s; continue
    n = int(XF*SR); t = np.linspace(0, np.pi/2, n)[:, None]
    out[-n:] = out[-n:]*np.cos(t) + s[:n]*np.sin(t); out = np.concatenate([out, s[n:]])
# long ending: the last (lone piano) span fades to silence over its final 16 s, then 0.5 s of silence
F = int(16*SR); g = np.cos(np.linspace(0, np.pi/2, F))**3; out[-F:] *= g[:, None]; out = np.concatenate([out, np.zeros((SR//2, 2))])
ref = np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',str(OUT/'theme_main.mp3'),'-ac','2','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout, np.float32)
def peak_rms(z, w=3*SR): z = z.reshape(-1); c = np.concatenate([[0], np.cumsum(z**2)]); return np.sqrt(((c[w:]-c[:-w])/w).max())
gain = peak_rms(ref.astype(np.float64)[::2].copy())*1.12/peak_rms(out[:,0].copy())  # final climax ~1 dB above theme_main's loudest moment
out *= gain; pk = np.abs(out).max()
if pk > 0.98: out *= 0.98/pk
dst = OUT/'theme_main_long.mp3'
subprocess.run(['ffmpeg','-y','-v','error','-f','f64le','-ar',str(SR),'-ac','2','-i','-','-b:a','80k',str(dst)], input=out.astype(np.float64).tobytes(), check=True)
print(dst, f'{len(out)/SR:.1f}s', dst.stat().st_size//1024, 'KB')
