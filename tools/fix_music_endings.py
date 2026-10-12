#!/usr/bin/env python3
"""Repair tracks that tools/check_music_tails.py flags, working from the shipped mp3 (raw generations are not kept in git).
Hard loops are cut to their steady body and re-blended so the seam never dips. Calm tracks and stingers get a musical fade-out
(4.5 s for tracks, 30% of the length up to 1.5 s for stingers). Usage: python3 tools/fix_music_endings.py name [...]"""
import subprocess, sys, shutil, pathlib, importlib.util, json
ROOT = pathlib.Path(__file__).resolve().parent.parent; OUT = ROOT/'public'/'audio'/'music'
spec = importlib.util.spec_from_file_location('g', ROOT/'tools'/'gen_music.py'); sys_argv = sys.argv; sys.argv = ['x']
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g); sys.argv = sys_argv
def br(f): return str(int(json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=bit_rate','-of','json',str(f)]))['format']['bit_rate'])//1000//16*16)+'k'
for n in sys.argv[1:]:
    f = OUT/f'{n}.mp3'; src = pathlib.Path('/tmp')/f'fixsrc_{n}.mp3'; shutil.copy(f, src); B = br(src); L = g.dur(src)
    if g.HARD_LOOP(n):
        S, E = g.body_start(src), g.body_end(src, L); XF = g.XF
        fc = (f"[0:a]atrim={S}:{E},asetpts=PTS-STARTPTS,asplit=3[a][b][c];[a]atrim={XF}:{E-S-XF},asetpts=PTS-STARTPTS[mid];"
              f"[b]atrim={E-S-XF}:{E-S},asetpts=PTS-STARTPTS[tail];[c]atrim=0:{XF},asetpts=PTS-STARTPTS[head];"
              f"[tail][head]acrossfade=d={XF-0.01}:c1=qsin:c2=qsin[x];[mid][x]concat=n=2:v=0:a=1[o]")
        best = None
        for k in range(10):  # nudge the cut by up to 45 ms and keep the render whose seam step is smallest
            e = E - k*0.005; tmp = pathlib.Path('/tmp')/f'fixtry_{n}_{k}.mp3'
            fck = fc.replace(f'atrim={S}:{E},', f'atrim={S}:{e},').replace(f'{E-S-XF}', f'{e-S-XF}').replace(f':{E-S},', f':{e-S},')
            subprocess.check_call(['ffmpeg','-y','-v','error','-i',str(src),'-filter_complex',fck,'-map','[o]','-ac','2','-ar','44100','-b:a',B,str(tmp)])
            x = subprocess.run(['ffmpeg','-v','error','-i',str(tmp),'-ac','1','-f','s16le','-'], capture_output=True).stdout
            j = abs(int.from_bytes(x[-2:], 'little', signed=True) - int.from_bytes(x[:2], 'little', signed=True))
            if best is None or j < best[0]:
                if best: best[1].unlink()
                best = (j, tmp)
            else: tmp.unlink()
        shutil.move(best[1], f)
    else:
        d = min(1.5, L*0.3) if n.startswith('stinger_') else 4.5
        subprocess.check_call(['ffmpeg','-y','-v','error','-i',str(src),'-af',f'afade=t=out:st={L-d}:d={d}','-ac','2','-ar','44100','-b:a',B,str(f)])
    src.unlink(); print(n, f'{g.dur(f):.1f}s', f.stat().st_size//1024, 'KB', B)
