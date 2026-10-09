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
