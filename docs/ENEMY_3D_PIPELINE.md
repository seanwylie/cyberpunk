# Enemy / boss 3D sprite pipeline (tools/enemies3d)

Replaces the flat concept-cut sprites (+ procedural squash) with real 8-direction, animated, screen-aligned sprites rendered from Blender (`bpy`), same camera / light rig / direction convention / outline treatment as the player (tools/sprites).

## Pieces
- `tools/enemies3d/specs.py`: `ANIM_SPEC` (idle 8f@6, walk 8f@12, attack 10f@14 with impact on frame 4, hit 4f@16, death 10f@10) and `SPECS` (one entry per enemy: archetype, palette, weapons, scale, accessories).
- `tools/enemies3d/build_enemy.py`: reusable **archetypes** built from bevelled primitives on an empty-joint rig: `humanoid`, `bruiser` (heavy humanoid), `turret`, `hover`; **weapon parts** (drill, rifle, circular saw, claws, slab fists, scythe, fist); stamped-panel + grit + edge-wear procedural materials from a 4-colour palette; procedural poses per archetype (idle breathe, walk cycle with knee bend / counter-swing, attack anticipation -> lunge/strike -> recovery, hit recoil, death collapse). Renders 8 directions x all frames. Env: `IDS=a,b ANIMS=idle,walk DIRS=S,SE FRAMES=0,2 RES=320 SAMPLES=16`.
- `tools/enemies3d/pack_enemy.py RAW public/dungeons/enemies3d`: premultiplied 2x downsample to 160 px cells, thin soft outline, WebP sheets (rows S,SW,W,NW,N,NE,E,SE; cols frames), `<id>.json` (frame, anchor, `hpx` = idle sprite height in px used to scale to the enemy's world height, anims) and `index.json`.
- `src/enemyart.ts`: lazily loads an enemy's atlas the first time that type is drawn (LRU, soft cap 8 atlases (never evicts one drawn in the last 4 s) decoded at once, so memory stays bounded), picks the row from the 8-notch facing state (`src/facing.ts`: hysteresis, one notch at a time, >= 0.1 s per notch, aim locked through windup/recovery), picks the clip from sim state (attack playback is scaled so the impact frame lands exactly when the telegraph completes, recovery continues at real speed; hit; walk phase is driven by ground speed; death plays over the existing collapse time) and cross-fades neighbouring frames for sub-frame smoothness. In atlas mode NO squash, lean or skew is applied. Enemies without an atlas keep the flat front/back sprites (still no squash).

## Adding / converting an enemy
1. Add a `SPECS` entry (pick an archetype, palette from the concept sheet, weapons). New parts go in `weapon()` or as an archetype option.
2. `IDS=<id> /workspace/bv/bin/python tools/enemies3d/build_enemy.py /tmp/raw` then `python tools/enemies3d/pack_enemy.py /tmp/raw public/dungeons/enemies3d`.
3. The loader picks it up from `index.json`; the enemy's `ART[type].h` still sets its world height.

## Cost
~0.6 s / frame at 320 px, 16 spp + denoise on 8 cores; one enemy = 8 dirs x 40 frames = 320 renders (~3-4 min). About 33 MB decoded per atlas at 160 px cells (hence the LRU).
