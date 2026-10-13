#!/usr/bin/env python3
"""Audit the opening of a theme_main_long render (or theme_main itself): low-end hits (onsets under 150 Hz) against the 84 bpm
beat grid, and out-of-key pitch content (chroma energy outside D natural/harmonic minor: D E F G A Bb C C#).
Usage: python tools/opening_audit.py file.mp3 [start:end seconds, default 0:80] [plot.png] [title]  -> prints flagged times; optional plot."""
import sys, numpy as np, librosa
f = sys.argv[1]; rng = (sys.argv[2] if len(sys.argv) > 2 else '0:80').split(':'); T0 = float(rng[0]); dur = float(rng[1]) - T0
y, sr = librosa.load(f, sr=22050, offset=T0, duration=dur)
_, beats = librosa.beat.beat_track(y=y, sr=sr, start_bpm=84, units='time', tightness=400)
if len(beats) > 4 and np.median(np.diff(beats)) < 0.5: beats = beats[::2]   # count quarter notes at 84, not eighths
S = np.abs(librosa.stft(y, n_fft=4096, hop_length=256)); fr = librosa.fft_frequencies(sr=sr, n_fft=4096)
low = S[fr < 150]; flux = np.maximum(0, np.diff(np.log1p(low), axis=1)).sum(axis=0); flux = np.concatenate([[0], flux])
on = librosa.onset.onset_detect(onset_envelope=flux, sr=sr, hop_length=256, units='time', delta=np.percentile(flux, 97)*0.5)
strength = np.interp(on, librosa.frames_to_time(np.arange(len(flux)), sr=sr, hop_length=256), flux)
big = on[strength > np.percentile(strength, 50)] if len(on) else on
off = [t for t in big if np.min(np.abs(beats - t)) > 0.09]
dbl = [b for a, b in zip(big, big[1:]) if b - a < 0.5 and np.min(np.abs(beats - b)) > 0.06]
ch = librosa.feature.chroma_cqt(y=librosa.effects.harmonic(y), sr=sr, hop_length=1024); ct = librosa.frames_to_time(np.arange(ch.shape[1]), sr=sr, hop_length=1024)
IN = [2, 4, 5, 7, 9, 10, 0, 1]; out_share = 1 - ch[IN].sum(axis=0)/ (ch.sum(axis=0) + 1e-9)
sm = np.convolve(out_share, np.ones(11)/11, 'same'); bad_key = ct[sm > 0.32]
segs = []
for t in bad_key:
    if segs and t - segs[-1][1] < 0.6: segs[-1][1] = t
    else: segs.append([t, t])
print('beats', len(beats), 'tempo', round(60/np.median(np.diff(beats)), 1))
print('off-grid booms', [round(t+T0, 2) for t in off]); print('doubled booms', [round(t+T0, 2) for t in dbl])
print('out-of-key passages', [(round(a+T0, 1), round(b+T0, 1)) for a, b in segs if b - a >= 0.4])
if len(sys.argv) > 3:
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    fig, ax = plt.subplots(2, 1, figsize=(13, 5), sharex=True)
    ax[0].vlines(beats, 0, 1, color='#bbb', lw=.5); ax[0].vlines(beats[::4], 0, 1, color='#888', lw=1)
    ax[0].vlines(big, 0, .8, color='#2a6f97', lw=1.5, label='low-end hits (<150 Hz)'); ax[0].vlines(off, 0, 1, color='#c8553d', lw=2.5, label=f'off-grid ({len(off)})')
    ax[0].vlines(dbl, 0, 1, color='#e0a800', lw=2.5, label=f'doubled ({len(dbl)})'); ax[0].legend(loc='upper right', fontsize=7); ax[0].set_yticks([])
    ax[1].plot(ct, sm, color='#555'); ax[1].axhline(.32, color='#c8553d', ls='--', lw=1); ax[1].set_ylabel('out-of-key share'); ax[1].set_xlabel('time (s)')
    fig.suptitle(sys.argv[4] if len(sys.argv) > 4 else f); plt.tight_layout(); plt.savefig(sys.argv[3], dpi=100)
