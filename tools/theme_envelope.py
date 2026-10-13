#!/usr/bin/env python3
"""Loudness envelope of theme_main_long (2 s RMS, dBFS) with the planned section boundaries; checks the shape:
three rising peaks (build 1 < build 2 < final) and three troughs (dip 1, dip 2, hard dip) with the hard dip deepest.
Usage: python tools/theme_envelope.py out.png   (needs matplotlib)"""
import sys, subprocess, pathlib, numpy as np
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
ROOT = pathlib.Path(__file__).resolve().parent.parent; f = ROOT/'public'/'audio'/'music'/'theme_main_long.mp3'; SR = 22050
x = np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',str(f),'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout, np.float32).astype(float)
hop = SR//4; w = 2*SR; t = np.arange(0, len(x)-w, hop)/SR + 1
env = np.array([20*np.log10(np.sqrt(np.mean(x[i:i+w]**2))+1e-9) for i in range(0, len(x)-w, hop)])
# section boundaries from the plan (durations in the long file)
import importlib.util
P = [0.07, 11.49, 22.92, 34.37, 45.51, 56.82, 68.29, 79.71, 91.14, 102.56]
plan = [('intro/A',P[4]-P[0]),('dip 1',P[4]-P[3]),('build 1',P[6]-P[4]),('dip 2',P[3]-P[2]),('build 2',P[8]-P[4]),('hard dip',106-P[9]+P[4]-P[3]),('final build',P[9]-P[4]+P[9]-P[8]),('outro',112-P[9]+P[2]-P[1])]
edges = np.cumsum([0]+[d for _, d in plan]); sec = {n: (edges[i], edges[i+1]) for i, (n, _) in enumerate(plan)}
def pk(n): a, b = sec[n]; m = (t >= a) & (t < b); return env[m].max()
def tr(n): a, b = sec[n]; m = (t >= a+1) & (t < b-1); return env[m].min()
peaks = [pk('build 1'), pk('build 2'), pk('final build')]; troughs = [tr('dip 1'), tr('dip 2'), tr('hard dip')]
ok = peaks[0] < peaks[1] < peaks[2] and troughs[2] < min(troughs[:2]) and all(p > q + 6 for p, q in zip(peaks, troughs))
plt.figure(figsize=(12, 4)); plt.plot(t, env, lw=1.2, color='#c8553d')
for n, (a, b) in sec.items(): plt.axvspan(a, b, alpha=.08 if 'dip' in n else .0, color='#2a6f97'); plt.text((a+b)/2, -62, n, ha='center', fontsize=8)
for n, v in zip(['build 1','build 2','final build'], peaks): plt.plot([(sec[n][0]+sec[n][1])/2], [v], 'v', color='k'); plt.text((sec[n][0]+sec[n][1])/2, v+1.5, f'{v:.1f}', ha='center', fontsize=8)
for n, v in zip(['dip 1','dip 2','hard dip'], troughs): plt.plot([(sec[n][0]+sec[n][1])/2], [v], '^', color='#2a6f97'); plt.text((sec[n][0]+sec[n][1])/2, v-4, f'{v:.1f}', ha='center', fontsize=8)
plt.ylim(-66, 0); plt.xlabel('time (s)'); plt.ylabel('RMS, 2 s window (dBFS)'); plt.title(f'theme_main_long: peaks {peaks[0]:.1f} < {peaks[1]:.1f} < {peaks[2]:.1f} dB, troughs {troughs[0]:.1f} / {troughs[1]:.1f} / {troughs[2]:.1f} dB ({"OK" if ok else "SHAPE FAIL"})')
plt.tight_layout(); plt.savefig(sys.argv[1], dpi=110)
print('peaks', [round(p,1) for p in peaks], 'troughs', [round(v,1) for v in troughs], 'OK' if ok else 'FAIL'); sys.exit(0 if ok else 1)
