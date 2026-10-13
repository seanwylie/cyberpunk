#!/usr/bin/env python3
"""Snare-forward variants of boss tracks WITHOUT regenerating them: the original recording (key, melody, loop point,
faded tail all unchanged) gets a rolling snare layer locked to its own tracked beat grid: backbeats on 2 and 4, 16th
ghost notes, and a 16th -> 32nd rush crescendo into every 8-bar phrase (Blackmill-style rolling snare). The layer stops
before the loop point (LOOP_END in src/music_loops.ts), so the sample-exact loop and the faded tail stay the original's.
Usage: python3 tools/snare_layer.py boss_theme_siege boss_theme_storm   (samples in tools/snare_samples/, ElevenLabs SFX)"""
import sys, re, pathlib, subprocess, numpy as np, librosa, soundfile as sf
ROOT = pathlib.Path(__file__).resolve().parent.parent; MUS = ROOT/'public/audio/music'; SMP = ROOT/'tools/snare_samples'; SR = 44100
CFG = {  # bpm hint, 32nd rush allowed (too fast above ~120 bpm), layer gain
 'boss_theme_siege': dict(bpm=84, rush32=True, gain=1.4),
 'boss_theme_storm': dict(bpm=168, rush32=False, gain=1.3),
}
def loop_end(name):
    m = re.search(rf"\b{name}:\s*([\d.]+)", (ROOT/'src/music_loops.ts').read_text()); return float(m.group(1))
def smp(f, dur, hp=None):
    y, _ = librosa.load(SMP/f, sr=SR, mono=True); a = np.argmax(np.abs(y) > np.abs(y).max()*.2); y = y[max(0, a-20):][:int(dur*SR)]
    y = y * np.minimum(1, np.linspace(1, 0, len(y))*4)  # short fade-out
    if hp: y = y - np.convolve(y, np.ones(hp)/hp, 'same')  # crude high-pass for thin ghost notes
    return y/np.abs(y).max()
def build(name):
    c = CFG[name]; src = MUS/f'{name}.mp3'; y, _ = librosa.load(src, sr=SR, mono=False); y = np.atleast_2d(y); n = y.shape[1]; mono = y.mean(0)
    _, beats = librosa.beat.beat_track(y=librosa.resample(mono, orig_sr=SR, target_sr=22050), sr=22050, start_bpm=c['bpm'], units='time', tightness=400)
    ibi = float(np.median(np.diff(beats)))
    while beats[0] - ibi > 0: beats = np.insert(beats, 0, beats[0]-ibi)  # extend grid back to the start
    while beats[-1] + ibi < n/SR: beats = np.append(beats, beats[-1]+ibi)
    # bar phase: the beat class (mod 4) with the strongest low-end (kick) onsets is the downbeat
    lo = librosa.onset.onset_strength(y=librosa.effects.preemphasis(mono, coef=-.95), sr=SR, hop_length=512); fr = librosa.time_to_frames(beats, sr=SR, hop_length=512).clip(0, len(lo)-1)
    ph = int(np.argmax([lo[fr[k::4]].mean() for k in range(4)]))
    main, acc, ghost = smp('snare_main.mp3', .32), smp('snare_accent.mp3', .45), smp('snare_main.mp3', .12, hp=6)
    L = loop_end(name); env = librosa.feature.rms(y=mono, frame_length=4096, hop_length=1024)[0]; ref = np.percentile(env, 90)
    lay = np.zeros(n); hits = 0
    def put(t, s, g):
        nonlocal hits; i = int(t*SR); 
        if t < 0 or t + len(s)/SR > L - .02: return  # never across the loop point
        loc = env[min(len(env)-1, i//1024)]; g *= float(np.clip(loc/ref, .35, 1))  # follow the arrangement: quieter sections get a quieter snare
        lay[i:i+len(s)] += s[:n-i]*g; hits += 1
    for k in range(len(beats)-1):
        b = k - ph; t0, t1 = beats[k], beats[k+1]; d = t1 - t0
        if b < 0: continue
        bar, bt = divmod(b, 4); last = bar % 8 == 7  # last bar of an 8-bar phrase
        if last and bt >= 2:  # rush into the next phrase: 16ths, then 32nds on the final beat (if tempo allows), crescendo
            sub = 8 if (bt == 3 and c['rush32']) else 4
            for j in range(sub): f = (bt-2 + j/sub)/2; put(t0 + d*j/sub, main, .35 + .55*f)
            continue
        if bt in (1, 3): put(t0, main, 1.0); 
        if bar % 8 == 0 and bt == 0 and bar: put(t0, acc, .8)  # accent on the phrase downbeat after the rush
        for j, gg in ((1, .0), (2, .22), (3, .16)):  # ghost notes on the off-16ths
            if gg and not (bt in (1, 3) and j == 0): put(t0 + d*j/4, ghost, gg)
    pk = np.abs(y).max(); lay *= c['gain'] * pk / max(1e-9, np.abs(lay).max()) * .75
    out = y + lay[None, :]; tmp = ROOT/f'tools/.snare/{name}_snare.wav'; sf.write(tmp, out.T, SR, subtype='FLOAT')
    dst = MUS/f'{name}_snare.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(tmp), '-af', f'alimiter=limit={min(.98, pk):.3f}:attack=2:release=60:level=disabled:latency=1', '-c:a', 'libmp3lame', '-b:a', '192k', str(dst)], check=True)
    print(f'{name}_snare: ibi {ibi:.4f}s ({60/ibi:.1f} bpm), downbeat class {ph}, {hits} hits, loop {L}s -> {dst.name}')
for a in sys.argv[1:] or CFG: build(a)
