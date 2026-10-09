# Shared animation spec for the Blender renderer (poses.py / build_char.py) and the packer (pack.py).
# n = frames, fps = game playback rate, loop, hit = frame index where damage/impact lands (attack/cast), blend = loader cross-fades neighbouring frames
SPEC = {
    'idle':   dict(n=12, fps=7,  loop=True,  hit=None, blend=True),
    'run':    dict(n=16, fps=34, loop=True,  hit=None, blend=True),
    'dodge':  dict(n=10, fps=45, loop=False, hit=None, blend=False),
    'attack': dict(n=12, fps=30, loop=False, hit=5,    blend=True),
    'cast':   dict(n=12, fps=20, loop=False, hit=5,    blend=True),
    'hit':    dict(n=6,  fps=24, loop=False, hit=None, blend=True),
    'down':   dict(n=12, fps=14, loop=False, hit=None, blend=True),
}
def duration(a):
    s = SPEC[a]; return s['n'] / s['fps'] if s['loop'] else (s['n'] - 1) / s['fps']
