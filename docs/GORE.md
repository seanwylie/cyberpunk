# Blood & gore

Settings > **Content** > Blood & gore: **Off** (default) / **Mild** / **Bloody**. Saved in `settings.gore` (`off|mild|bloody`; the old `standard` default migrates to Off). Per client: in a party every player uses their own setting; nothing is synced.
Note shown with the setting: intended for players 16+, dungeons only, never affects players or NPCs.

| | Off | Mild | Bloody |
|---|---|---|---|
| Hit | nothing | 2 droplets, 15% chance of a stain | wet burst (5-9 droplets, sparks for robots), 50-90% chance of a floor splatter, wet sfx |
| Kill | nothing | one pool + 6 droplets | 2-5 pools, 18-36 droplets, gibs; heavy kills (ability power >= 0.75, a hit >= 12% max HP, overkill, bosses) dismember: limbs + head fly off, subtle screen-edge spray when close |
| Boss | nothing | pool | limb severing at 75 / 50 / 25 % HP (big limb + lump chunks, fountain, `Limb severed` toast) |

Bodies: enemies not listed otherwise are augmented humans (hybrid) = blood + dark oil; organic = blood / ichor (sac, jelly, squid) / sap (fungus); robots = coolant (cyan) or oil (dark) + sparks; hybrids = both; spectral/hologram/glitch = nothing. `bodyOf()` / `fluidsOf()` in `src/gore.ts`.
Rules: floor decals fade over 34-52 s and are cleared on leaving the run / entering town / new instance; caps per quality tier (`CAPS`: high 160 decals / 72 chunks / 170 droplets, medium 70 / 28 / 60, low 32 / 12 / 24; `GIB_MUL` spawns 100 / 55 / 30 % of the pieces per tier); spawn budget per 0.12 s; Reduced FX = no airborne particles, no spray, half the decals; screen spray alpha <= 0.16 and gated by the flash guard; no full-screen flashes. Sfx are synthesised (`gore_wet`, `gore_gib`, `gore_pop`, `gore_spark` in `audio.ts`).
Tests: `tests/gore.mjs`, `tests/settings.mjs`. Snapshots: `shots/gore/`.

## Walls
Gibs are step-simulated at spawn (30 Hz, `simChunk`): ballistic arc, per-axis bounce off wall faces, floor bounce + slide, then settle on the nearest walkable cell (`nearestFloor`), kept 0.2 tiles clear of wall faces. Gibs are drawn through the renderer's isometric depth sort (`GORE.items`, depth = x + y of the ground point), so walls in front cover them. Decals are rejected on non-walkable cells and clipped to the floor cells they cover; droplets vanish on wall contact. Lifetimes (gibs 26-42 s, decals 34-52 s, fade-out) and per-tier caps unchanged.
Test: `tests/gore_walls.mjs` (kills at wall edges and inside corners; every gib path sample, resting gib and decal on a walkable tile) — snapshot `shots/gore/walls.png`.

## Doom-style gibs
Bloody only. Augmented humans burst into flesh (lump, rib, limb, head) AND their augment hardware coloured by manufacturer (`MFR_PAL`: Heavy Industrial oxide red, Precision Surgical dirty ivory ceramic with slate marks, Mass-Market olive polymer): plates, servos, cables, shards. Organic beasts drop flesh only.
- Ordinary kill: a few chunks knocked off, the corpse stays.
- Heavy / overkill kill (power >= 0.75, hit >= 12% max HP, or damage >= 90% max HP): radial burst, limbs + head, spray streak, **no corpse** (`e._gibAt`, render skips the body). Elites: bigger pieces, more of them, a small camera kick.
- Boss: signature death. Three ruptures (0 / 0.38 / 0.72 s) while it staggers, then a final radial explosion at 1.1 s (body gone, big limbs + head, splat ring, camera kick, edge spray).
- Metal pieces bounce twice, flesh once; each lands with a splat. Lifetimes / fade as above.
Perf: gib and droplet objects are pooled (path buffers reused, in-place compaction, no per-frame array allocation); each gib is painted once per (kind, fluid/manufacturer, pixel size) into a small cached canvas and blitted rotated (1 drawImage + 1 shadow blit per gib). Snapshots: `shots/gibs/` (`node tools/gib_shots.mjs`).
