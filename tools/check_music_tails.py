#!/usr/bin/env python3
"""Ending check for public/audio/music. Hard loops (combat_/boss_/elite_, looped in game) must loop cleanly: the seam step
(last sample -> first sample) must stay within 1.5x the track's own 99.99th-percentile sample step, with no level dip
(100 ms RMS on both sides of the seam within 12 dB). Everything else (calm tracks rotate and never loop, plus stingers and one-shots)
must not end abruptly: the RMS of the final 0.5 s must be at least 12 dB below the RMS of the preceding 10 s, or under -45 dB.
Usage: python3 tools/check_music_tails.py [name ...]   (default: every track in TRACKS) -> exit 1 on any failure."""
import subprocess, sys, pathlib, re, math, array
OUT = pathlib.Path(__file__).resolve().parent.parent/'public'/'audio'/'music'
HARD = re.compile(r'^(combat_|boss_|elite_)')
def pcm(f):
    b = subprocess.run(['ffmpeg','-v','error','-i',str(f),'-ac','1','-ar','44100','-f','s16le','-'], capture_output=True).stdout
    x = array.array('h'); x.frombytes(b); return [v/32768 for v in x]
def rms(s): return 20*math.log10(math.sqrt(sum(v*v for v in s)/max(1,len(s)))+1e-9)
def check(n):
    f = OUT/f'{n}.mp3'
    if not f.exists(): return None
    x = pcm(f)
    if HARD.match(n) and not n.startswith('boss_reveal'):
        d = sorted(abs(x[i+1]-x[i]) for i in range(0, len(x)-1, 7)); q = d[int(len(d)*0.9999)]
        j = abs(x[-1]-x[0]); lv = rms(x[-4410:]) - rms(x[:4410]); ok = j <= 1.5*q and abs(lv) <= 12
        return ok, f'loop seam {j:.3f} (limit {1.5*q:.3f}), level step {lv:+.1f} dB'
    end, body = rms(x[-22050:]), rms(x[-22050-441000:-22050]); ok = end <= body-12 or end < -45
    return ok, f'tail {end:.1f} dB vs body {body:.1f} dB'
if __name__ == '__main__':
    names = sys.argv[1:] or sorted(p.stem for p in OUT.glob('*.mp3'))
    bad = []
    for n in names:
        r = check(n)
        if r is None: continue
        print(('PASS ' if r[0] else 'FAIL ')+n+': '+r[1])
        if not r[0]: bad.append(n)
    print(f'{len(bad)} failing'); sys.exit(1 if bad else 0)
