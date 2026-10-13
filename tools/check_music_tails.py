#!/usr/bin/env python3
"""Strict ending rule for EVERY file in public/audio/music (loops included):
  1. the final 0.5 s is below -45 dBFS RMS, and
  2. the 4 s before it are a smooth fade: 250 ms RMS windows never rise more than 3 dB over the previous window,
     and the level drops at least 15 dB from the start of that 4 s to its end.
Hard loops are looped in game between 0 and their loop point (src/music_loops.ts), so their faded tail is never heard in game.
Every hard loop (combat_/boss_/elite_, except boss_reveal) must have a loop point that ends at least 4.5 s before the file ends.
Usage: python3 tools/check_music_tails.py [name ...]   (default: every mp3) -> exit 1 on any violation."""
import subprocess, sys, pathlib, re, math, array
ROOT = pathlib.Path(__file__).resolve().parent.parent; OUT = ROOT/'public'/'audio'/'music'
HARD = lambda n: bool(re.match(r'^(combat_|boss_|elite_)', n)) and n != 'boss_reveal'
def pcm(f):
    b = subprocess.run(['ffmpeg','-v','error','-i',str(f),'-ac','1','-ar','44100','-f','s16le','-'], capture_output=True).stdout
    x = array.array('h'); x.frombytes(b); return x
def rms(x, a, b):
    s = x[a:b]; return 20*math.log10(math.sqrt(sum(v*v for v in s)/max(1,len(s)))/32768+1e-9)
def loops():
    t = (ROOT/'src'/'music_loops.ts').read_text() if (ROOT/'src'/'music_loops.ts').exists() else ''
    return {m[0]: float(m[1]) for m in re.findall(r"'?([a-z0-9_]+)'?:\s*([0-9.]+)", t.split('{',1)[-1])}
def check(n, LP): return check_file(OUT/f'{n}.mp3', n, LP)
def check_file(path, n, LP):
    x = pcm(path); N = len(x); sr = 44100; dur = N/sr; probs = []
    end = rms(x, N-sr//2, N)
    if end >= -45: probs.append(f'last 0.5 s {end:.1f} dBFS (>= -45)')
    w = sr//4; a = N-sr//2-4*sr; lv = [rms(x, a+i*w, a+(i+1)*w) for i in range(16)]
    rise = max(lv[i+1]-lv[i] for i in range(15)); drop = lv[0]-lv[-1]
    if rise > 3: probs.append(f'fade not smooth (+{rise:.1f} dB step)')
    if drop < 15: probs.append(f'fade too shallow ({drop:.1f} dB over 4 s)')
    if HARD(n):
        lp = LP.get(n)
        if lp is None: probs.append('hard loop without a loop point in src/music_loops.ts')
        elif lp > dur-4.5: probs.append(f'loop point {lp:.2f}s not >= 4.5 s before the end ({dur:.2f}s)')
    return probs, f'end {end:.1f} dBFS, fade drop {drop:.1f} dB, max step {rise:+.1f} dB'
if __name__ == '__main__':
    LP = loops(); names = sys.argv[1:] or sorted(p.stem for p in OUT.glob('*.mp3')); bad = []
    for n in names:
        p, info = check(n, LP)
        print(('FAIL ' if p else 'PASS ')+n+': '+info+('  <- '+'; '.join(p) if p else ''))
        if p: bad.append(n)
    print(f'{len(bad)} of {len(names)} failing'); sys.exit(1 if bad else 0)
