#!/usr/bin/env python3
"""Ear-proxy analysis for theme variations: tempo, key (Krumhansl profile on mean chroma), and the dominant melodic
contour (pyin on the first N seconds, quantized to semitones, run-length collapsed). Optional: compare to a reference
(chroma-profile correlation after transposing to the same tonic, plus a tempo ratio allowing half/double time).
Usage: python tools/motif_analyze.py file.mp3 [--ref theme_main.mp3] [--json]   (needs librosa; use a venv)"""
import sys, json, numpy as np, librosa
MAJ = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]); MIN = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
NAMES = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']
def analyze(path, mel_secs=40):
    y, sr = librosa.load(path, sr=22050, mono=True)
    tempo = float(np.atleast_1d(librosa.beat.beat_track(y=y, sr=sr)[0])[0])
    ch = librosa.feature.chroma_cqt(y=y, sr=sr).mean(axis=1); ch = ch/ch.sum()
    best = max(((np.corrcoef(np.roll(p, k), ch)[0,1], k, m) for p, m in ((MAJ,'major'),(MIN,'minor')) for k in range(12)))
    yh = librosa.effects.harmonic(y[:sr*mel_secs])
    f0, vf, _ = librosa.pyin(yh, fmin=110, fmax=1200, sr=sr, frame_length=2048)
    midi = np.round(librosa.hz_to_midi(f0[vf & ~np.isnan(f0)])).astype(int) if np.any(vf) else np.array([], int)
    notes = [int(m) for i, m in enumerate(midi) if i == 0 or m != midi[i-1]]
    return {'tempo': round(tempo,1), 'key': f'{NAMES[best[1]]} {best[2]}', 'tonic': best[1], 'mode': best[2], 'key_conf': round(float(best[0]),3), 'chroma': ch.tolist(), 'notes': notes[:48], 'intervals': [b-a for a, b in zip(notes, notes[1:])][:47]}
def compare(a, r):
    sh = (r['tonic'] - a['tonic']) % 12
    chroma_corr = float(np.corrcoef(np.roll(a['chroma'], sh), r['chroma'])[0,1]) if a['mode'] == r['mode'] else float(np.corrcoef(a['chroma'], r['chroma'])[0,1])
    ratio = a['tempo']/r['tempo']; tr = min(abs(ratio-x)/x for x in (0.5, 2/3, 1, 4/3, 1.5, 2))  # half, triplet-grouped and double-time readings of the same pulse
    return {'same_key': a['tonic'] == r['tonic'] and a['mode'] == r['mode'], 'chroma_corr_raw': round(float(np.corrcoef(a['chroma'], r['chroma'])[0,1]),3), 'tempo_ratio': round(ratio,3), 'tempo_off': round(tr,3)}
if __name__ == '__main__':
    a = analyze(sys.argv[1]); out = {'file': sys.argv[1], **{k: v for k, v in a.items() if k != 'chroma'}}
    if '--ref' in sys.argv: out['vs_ref'] = compare(a, analyze(sys.argv[sys.argv.index('--ref')+1]))
    print(json.dumps(out))
