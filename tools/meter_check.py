#!/usr/bin/env python3
"""4/4 continuity check: beat-track the file (eighth-note pulse at the theme's 168/min), group into bars of 8 eighths, and require
(1) every bar within +-2% of the median bar length and (2) the beats to stay on ONE straight grid from start to end (median residual of every
2-bar window vs a global fit <= 40 ms; single beats at fade edges may wander): a partial bar at a splice shows up as a jump in that residual. Sparse stretches (< -30 dBFS: the hard dip and the fade, where a lone piano gives the tracker nothing to lock to) are skipped; their joins are whole bars by construction (tools/extend_theme.py).
Usage: python tools/meter_check.py [--until=s] file.mp3 [plot.png] [label] [file2.mp3 label2]  -> exit 1 on a break."""
import sys, numpy as np, librosa
UNTIL = float(next((a.split('=')[1] for a in sys.argv if a.startswith('--until=')), 1e9)); sys.argv = [a for a in sys.argv if not a.startswith('--until=')]
def meter(f):
    y, sr = librosa.load(f, sr=22050); oenv = librosa.onset.onset_strength(y=y, sr=sr)
    _, b = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, units='time', start_bpm=168, tightness=800)
    rms = librosa.feature.rms(y=y, hop_length=512)[0]; rt = librosa.times_like(rms, sr=sr, hop_length=512)
    loud = lambda t: 20*np.log10(np.interp(t, rt, rms)+1e-9) > -30
    b = b[[loud(t) and t <= UNTIL for t in b]]; i = np.round((b - b[0])/(60/168)).astype(int)  # the theme is exactly 168 eighths/min (beat fit on theme_main)
    p, t0 = np.polyfit(i, b, 1); res = b - (t0 + i*p)
    bars = np.array([b[k+8]-b[k] for k in range(0, len(b)-8, 8) if i[k+8]-i[k] == 8]); med = np.median(bars)
    badbar = [(round(b[k],1), round(b[k+8]-b[k],3)) for k in range(0, len(b)-8, 8) if i[k+8]-i[k] == 8 and abs(b[k+8]-b[k]-med) > 0.02*med]
    return b, res, bars, med, badbar
runs = [(sys.argv[1], sys.argv[3] if len(sys.argv) > 3 else 'file')] + ([(sys.argv[4], sys.argv[5])] if len(sys.argv) > 5 else [])
out = []; ok_all = True
for f, lab in runs:
    b, res, bars, med, badbar = meter(f); win = [np.median(res[k:k+16]) for k in range(0, max(1, len(res)-15), 8)]; jump = np.abs(win).max(); ok = not badbar and jump <= 0.04; ok_all &= ok if lab == runs[0][1] else True
    print(f'{lab}: bar median {med:.3f}s ({4*60/(med/2)/2:.1f} bpm), bars off >2%: {badbar[:8]}, max grid offset (median per 2 bars) {jump*1000:.0f} ms -> {"4/4 OK" if ok else "METER BREAK"}')
    out.append((lab, b, res, ok))
if len(sys.argv) > 2:
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    fig, ax = plt.subplots(len(out), 1, figsize=(13, 2.6*len(out)), sharex=True); ax = np.atleast_1d(ax)
    for a, (lab, b, res, ok) in zip(ax, out):
        a.plot(b, res*1000, '.', ms=3, color='#2a6f97' if ok else '#c8553d'); a.axhline(60, color='#c8553d', ls='--', lw=.8); a.axhline(-60, color='#c8553d', ls='--', lw=.8)
        a.set_ylabel('beat vs one 4/4 grid (ms)'); a.set_title(f'{lab}: {"continuous 4/4" if ok else "meter breaks (grid jumps)"}', fontsize=9); a.set_ylim(-400, 400)
    ax[-1].set_xlabel('time (s)'); plt.tight_layout(); plt.savefig(sys.argv[2], dpi=100)
sys.exit(0 if ok_all else 1)
