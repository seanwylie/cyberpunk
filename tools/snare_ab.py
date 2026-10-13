#!/usr/bin/env python3
"""Snare A/B proxy: onset density (onsets/s) and onset strength in the snare body (150-250 Hz) and crack (2-6 kHz) bands,
plus the crack band's share of spectral energy. Usage: python tools/snare_ab.py OLD_DIR NEW_DIR name ... (needs librosa)"""
import sys, numpy as np, librosa
def bands(path):
    y, sr = librosa.load(path, sr=22050, mono=True, duration=60); S = np.abs(librosa.stft(y, n_fft=2048, hop_length=256)); f = librosa.fft_frequencies(sr=sr, n_fft=2048)
    out = {}
    for name, lo, hi in (('body', 150, 250), ('crack', 2000, 6000)):
        b = S[(f >= lo) & (f < hi)]; flux = np.maximum(0, np.diff(np.log1p(b), axis=1)).sum(axis=0)
        on = librosa.onset.onset_detect(onset_envelope=flux, sr=sr, hop_length=256, units='time')
        out[name] = (len(on)/(len(y)/sr), float(np.mean(flux)))
    out['crack_share'] = float((S[(f >= 2000) & (f < 6000)]**2).sum()/(S**2).sum())
    return out
old, new = sys.argv[1], sys.argv[2]; up = 0
for n in sys.argv[3:]:
    a, b = bands(f'{old}/{n}.mp3'), bands(f'{new}/{n}.mp3')
    better = b['crack'][0] > a['crack'][0] and b['crack'][1] > a['crack'][1]; up += better
    print(f"{n:18s} crack onsets/s {a['crack'][0]:.2f}->{b['crack'][0]:.2f}  crack flux {a['crack'][1]:.1f}->{b['crack'][1]:.1f}  body onsets/s {a['body'][0]:.2f}->{b['body'][0]:.2f}  crack share {a['crack_share']*100:.1f}%->{b['crack_share']*100:.1f}%  {'MORE SNARE' if better else 'not more'}")
print(f'{up}/{len(sys.argv)-3} tracks with more snare activity')
