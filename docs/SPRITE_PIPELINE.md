# Player sprite-sheet pipeline

## Current rendering
`Renderer.drawPlayer()` (src/render.ts) draws the hero procedurally with canvas rects/arcs: legs, torso, arms, head, per-slot colours from installed hardware (manufacturer colour/accent, broken = grey), a 2-direction flip, a sine bob when moving, rotation when downed, alpha for cloak/dodge. No real animation states, no 8-way facing. Skins/hardware tint is baked into those colours.

## Integration (implemented: src/sprites.ts)
- On start `loadAtlas('sprites/player.json')` runs. Missing, HTML fallback, invalid, or too-small PNGs -> returns null -> procedural character is used unchanged.
- `PlayerAnimator` picks the animation from game state with no sim changes: down > dodge > cast > hit (hp drop) > attack (atkCd rising) > run > idle; direction from move/dodge vector or `face`, projected to 8 screen directions (S,SW,W,NW,N,NE,E,SE).
- Cloak / dodge alpha and shadow still applied by the renderer. Test: `npm run test:sprites` (synthetic atlas, then fallback check).
- Not yet done: enemy sprites, equipment/hardware visuals on sheets (base body only; layered skin/hardware sheets later = same format, extra atlases drawn in order), reading `hitFrame` for effect sync.

## Atlas format (`public/sprites/player.json`)
```json
{ "version":1, "frame":{"w":128,"h":128}, "anchor":{"x":64,"y":116}, "scale":1,
  "anims":{ "idle":{"image":"idle.png","frames":6,"fps":8,"loop":true,"dirs":8}, ... } }
```
One PNG per animation: rows = directions, columns = frames, uniform cells. `dirs:8` rows = S,SW,W,NW,N,NE,E,SE. `dirs:5` rows = S,SW,W,NW,N; E side is mirrored at draw time. All 7 anims (idle, run, dodge, attack, cast, hit, down) are required. Anchor = foot pivot in the cell. Character should occupy ~60% of the cell height (the loader normalises to the procedural height); `scale` tweaks.

## Recommendation
- Cell 128x128 (character ~80 px tall, 2x-ready for DPR 2 phones); transparent PNG, premultiplied-safe edges; sheets <= 1024x1024 each (run 8x8 cells = 1024x1024).
- Directions: author 5 and mirror (halves cost) if the gear is symmetric; use full 8 if the weapon hand must stay on one side (spec has asymmetric arm weapons, so I recommend 8 for run/attack/cast and 5-mirrored for idle/hit/down to save budget).
- Frames (match sim timings; dodge is 0.22 s, i-frames 0.34 s):

| Anim | Dirs | Frames | FPS | Loop | Notes |
|---|---|---|---|---|---|
| idle | 8 | 6 | 8 | yes | breathing, heat vents |
| run | 8 | 8 | 14 | yes | contact frames at 1 and 5 |
| dodge | 8 | 5 | 22 | no | roll/dash, 0.22 s |
| attack | 8 | 6 | 18 | no | impact on frame 3 (hitFrame:2) |
| cast | 8 | 8 | 16 | no | 3 windup, release frame 4 (hitFrame:3), recovery |
| hit | 5 | 3 | 12 | no | flinch |
| down | 5 | 8 | 10 | no | holds last frame |

Total 8x(6+8+5+6+8)=264 + 5x(3+8)=55 = 319 frames at 128x128 (~21 MB raw RGBA, a few MB as PNG; use palette/quantise or WebP later).
- Later: split into body layers (base, torso, arm L/R, weapon, head) as extra atlases in the same format for skins/hardware, drawn back to front.

## Implemented: Blender layered-sprite pipeline (tools/sprites/)
Everything is code, runs headless on Linux (`pip install bpy pillow numpy`, Python 3.13 -> bpy 5.2).
1. `textures.py OUT` paints the material maps (jacket, pants, olive stamped panels, ivory+slate marks, skin, boot, canvas, metal, cloth, glass) with numpy; muted palette only.
2. `build_char.py RAWDIR` builds the scavenger-mechanic from primitives, **one object group per body slot** (face, torso, armL, handL, armR, handR, legL, footL, legR, footR) on an empty-joint rig, poses it procedurally (idle, run), and renders with Cycles (CPU, ortho 2:1 iso camera, transparent film). Each slot is rendered separately with the other slots set invisible-to-camera so they still cast shadow/bounce light (consistent shading across layers). Also writes `order.json`: per anim/direction/frame the far->near draw order of the layers (depth along the view vector).
3. `pack.py RAW OUT`: dark per-layer outline, 2x supersample -> 128 px cells, packs one sheet per layer per anim (rows = 8 dirs, cols = frames), a pre-composited sheet, `player.json`, and contact sheets.
Render cost: ~7 min for idle+run (1120 layer renders, 256 px, 32 spp) on 8 cores.
Atlas extension (backwards compatible): an anim may carry `layers:[{name,image}]` + `order[dir][frame]=[layer idx far->near]`; the loader draws the layers in that order, else the flat `image`. Anims not yet authored fall back (dodge->run, attack/cast/hit/down->idle); only idle and run are required.
Swapping a limb = bake a replacement mesh on the same joints into the same slot name (e.g. `armL`) and replace that layer's PNG; the depth `order` is per body, so re-run step 2 for the new loadout (or bake per-limb variants with the same pose/order).


## v2 character (mesh/texture upgrade)
- `textures.py OUT` now writes tileable 1024px **colour + roughness + height** maps per material (jacket, pants, olive, ivory, skin, boot, canvas, metal, cloth, glass, amber, rubber). Height maps drive a Bump node.
- `build_char.py` v2: lofted/sculpted-look meshes (hood shell with face opening and thickness, goggles with lens/frame/strap, gaiter, hooded faded jacket with folds, open V front, solidify, belt, vial pouches, shoulder straps, back patch, knee pads, cargo pocket, ceramic ivory arm with segment plates/hinge discs/bolts/hose, fingered hands, olive stamped-plate leg with bolts, hinge caps, greaves, lugged boots). Shader adds ambient-occlusion multiply (AO node, not baked), low-body grime, and bevel-driven edge wear. Per-slot joined meshes, ~57k polys.
- Each slot layer renders with shadows cast only by its own slot (the layers stay independent and swap-safe; contact shading comes from the AO node). Render uses a border crop per slot (~0.2 s/layer) and 64 spp + denoise.
- Env: `ANIMS=idle,run,...  DIRS=S,SE  FRAMES=0,3  SLOTS=armL  SAMPLES  RES  MERGE=1` for partial re-renders. Cell size = RES/2 (RES 320 => 160 px cells).
- `pack.py RAW OUT`: premultiplied-alpha downsample (no dark fringes), silhouette outline on the composite, thin per-layer outlines, light unsharp. `SCALE=` sets the atlas draw scale.
- All 7 anims, all 8 directions (hit/down too, since the character is asymmetric: ivory L arm / olive R leg). `hitFrame` is written for attack (2) and cast (3) and exposed as `PlayerAnimator.frame / hitFrame / atHitFrame`.
- Loader: the flat composite sheet is used by default; the per-slot layer sheets are only loaded with `?layers=1` (they would cost ~10x decoded memory on phones). Limb-swap tooling should enable that mode.
