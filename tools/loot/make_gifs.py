"""Assemble docs/art/loot/frames/<name>/NNN.png into docs/art/loot/<name>.gif (24 fps), plus a still contact sheet of the last frames."""
import os, glob
from PIL import Image
root = os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'art', 'loot'); fr = os.path.join(root, 'frames')
for d in sorted(os.listdir(fr)):
    files = sorted(glob.glob(os.path.join(fr, d, '*.png')))
    if not files: continue
    ims = [Image.open(f).convert('RGB') for f in files]
    ims[0].save(os.path.join(root, d + '.gif'), save_all=True, append_images=ims[1:], duration=42, loop=0, optimize=False)
    ims[len(ims) // 2].save(os.path.join(root, d + '_still.png'))
    print(d, len(ims))
