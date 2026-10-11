#!/usr/bin/env python3
"""Writes half-resolution WebP copies (<anim>_h.webp) of every enemy atlas sheet for the Low/Medium quality tiers.
Frame grid is unchanged (cols = frames, rows = 8 dirs); each frame is simply frame/2 px, so the loader needs no new metadata."""
import glob, os, sys
from PIL import Image
d = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'dungeons', 'enemies3d')
n = 0
for p in sorted(glob.glob(os.path.join(d, '*_*.webp'))):
    if p.endswith('_h.webp'): continue
    q = p[:-5] + '_h.webp'
    im = Image.open(p); w, h = im.size
    im.resize((w // 2, h // 2), Image.LANCZOS).save(q, 'WEBP', quality=80, method=6); n += 1
print('wrote', n, 'half-res sheets')
