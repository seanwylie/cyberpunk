#!/usr/bin/env python3
"""Rework theme_main_long's opening while keeping its ending sample-for-sample: everything from the hard dip on (the fall,
the near-silent lone piano, the huge final build, the climax and the fade) is cut from the shipped file and reused unchanged.
Candidate A: theme_main's own audio, with a 4 s fade-in, 2-beat crossfades into and out of the dips, and build 2 running on to the
exact phrase where theme_main itself falls, so the hand-off into the hard dip is the original's own transition.
Candidate B: the music_v2_5 Audio-Reference take (tools/gen_theme_long_v25.py) for the opening, level-matched under the ending.
Usage: python3 tools/rework_theme_long.py  -> tools/.music_raw/theme_long_candA.mp3 / candB.mp3 (+ prints the splice point)"""
import subprocess, pathlib, numpy as np
ROOT = pathlib.Path(__file__).resolve().parent.parent; RAW = ROOT/'tools'/'.music_raw'; OUT = ROOT/'public'/'audio'/'music'; SR = 44100
def load(p): return np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',str(p),'-ac','2','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout, np.float32).reshape(-1,2).astype(np.float64)
P = [0.07, 11.49, 22.92, 34.37, 45.51, 56.82, 68.29, 79.71, 91.14, 102.56]
HD = (P[4]-P[0]) + (P[4]-P[3]) + (P[6]-P[4]) + (P[3]-P[2]) + (P[8]-P[4])  # hard-dip start in the shipped long file (s)
SRC_LONG = ROOT/'tools'/'.music_raw'/'theme_main_long_prev.mp3'
if not SRC_LONG.exists(): SRC_LONG.write_bytes((OUT/'theme_main_long.mp3').read_bytes())
long = load(SRC_LONG); X2 = 1.43  # two beats at 84 bpm
END = long[int((HD - X2/2)*SR):]   # kept ending, starts half a crossfade early
def xjoin(a, b, xf):
    n = int(xf*SR); t = np.linspace(0, np.pi/2, n)[:, None]; a = a.copy(); a[-n:] = a[-n:]*np.cos(t) + b[:n]*np.sin(t); return np.concatenate([a, b[n:]])
def fadein(z, s=4.0): z = z.copy(); n = int(s*SR); z[:n] *= (np.sin(np.linspace(0, np.pi/2, n))**2)[:, None]; return z
def pk(z, w=2*SR): c = np.concatenate([[0], np.cumsum(z[:,0]**2)]); m = (c[w:]-c[:-w])[::SR//10]/w; return 10*np.log10(m.max()+1e-12)
def write(z, name):
    pk_ = np.abs(z).max(); z = z*(0.98/pk_) if pk_ > 0.98 else z
    dst = RAW/name; subprocess.run(['ffmpeg','-y','-v','error','-f','f64le','-ar',str(SR),'-ac','2','-i','-','-b:a','80k',str(dst)], input=z.tobytes(), check=True); print(dst, f'{len(z)/SR:.1f}s')
# --- A: same source and gains as the shipped arrangement, with smoother joins
th = load(RAW/'theme_main.mp3'); g_ref = None
def seg(a, b, gn, pre, post): return th[max(0,int((a-pre)*SR)):int((b+post)*SR)]*gn
import json
gain = json.loads((RAW/'theme_long_gain.json').read_text())['gain'] if (RAW/'theme_long_gain.json').exists() else None
A_PLAN = [(P[0], P[4], .80, X2), (P[3], P[4], .60, X2), (P[4], P[6], .50, X2), (P[2], P[3], .55, X2), (P[4], P[9], .70, X2)]
a = None
for i, (s0, s1, gn, xf) in enumerate(A_PLAN):
    z = seg(s0, s1, gn, xf/2 if i else 0, xf/2)
    a = z if a is None else xjoin(a, z, xf)
# match A's level to the shipped file: the shared intro phrase must sit at the same loudness
ref_intro = long[int(1*SR):int(40*SR)]; my_intro = a[int(1*SR):int(40*SR)]
a *= np.sqrt(np.mean(ref_intro**2)/np.mean(my_intro**2)); a = fadein(a)
write(xjoin(a, END, X2), 'theme_long_candA.mp3')
# --- B: v2.5 opening (first five chunks: 40+16+30+16+40 s), level-matched so its build 2 peaks 1.5 dB under the kept ending's final peak... and below it
v = load(RAW/'theme_main_long_v25.mp3')[:int((142 + X2/2)*SR)]
target = pk(END) - 3.0; v *= 10**((target - pk(v))/20); v = fadein(v)
write(xjoin(v, END, X2), 'theme_long_candB.mp3')
print('kept ending from', round(HD, 2), 's of the shipped file:', round(len(END)/SR, 1), 's')
