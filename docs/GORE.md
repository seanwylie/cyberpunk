# Blood & gore

Settings > **Content** > Blood & gore: **Off** (default) / **Mild** / **Bloody**. Saved in `settings.gore` (`off|mild|bloody`; the old `standard` default migrates to Off). Per client: in a party every player uses their own setting; nothing is synced.
Note shown with the setting: intended for players 16+, dungeons only, never affects players or NPCs.

| | Off | Mild | Bloody |
|---|---|---|---|
| Hit | nothing | 2 droplets, 15% chance of a stain | wet burst (5-9 droplets, sparks for robots), 50-90% chance of a floor splatter, wet sfx |
| Kill | nothing | one pool + 6 droplets | 2-5 pools, 18-36 droplets, gibs; heavy kills (ability power >= 0.75, a hit >= 12% max HP, overkill, bosses) dismember: limbs + head fly off, subtle screen-edge spray when close |
| Boss | nothing | pool | limb severing at 75 / 50 / 25 % HP (big limb + lump chunks, fountain, `Limb severed` toast) |

Bodies: organic = blood / ichor (sac, jelly, squid) / sap (fungus); robots = coolant (cyan) or oil (dark) + sparks; hybrids = both; spectral/hologram/glitch = nothing. `bodyOf()` / `fluidsOf()` in `src/gore.ts`.
Rules: floor decals fade over 34-52 s and are cleared on leaving the run / entering town / new instance; caps per quality tier (`CAPS`: high 160 decals / 48 chunks / 150 droplets, medium 70 / 22 / 60, low 32 / 10 / 24); spawn budget per 0.12 s; Reduced FX = no airborne particles, no spray, half the decals; screen spray alpha <= 0.16 and gated by the flash guard; no full-screen flashes. Sfx are synthesised (`gore_wet`, `gore_gib`, `gore_pop`, `gore_spark` in `audio.ts`).
Tests: `tests/gore.mjs`, `tests/settings.mjs`. Snapshots: `shots/gore/`.

## Walls
Gibs are step-simulated at spawn (30 Hz, `simChunk`): ballistic arc, per-axis bounce off wall faces, floor bounce + slide, then settle on the nearest walkable cell (`nearestFloor`), kept 0.2 tiles clear of wall faces. Gibs are drawn through the renderer's isometric depth sort (`GORE.items`, depth = x + y of the ground point), so walls in front cover them. Decals are rejected on non-walkable cells and clipped to the floor cells they cover; droplets vanish on wall contact. Lifetimes (gibs 26-42 s, decals 34-52 s, fade-out) and per-tier caps unchanged.
Test: `tests/gore_walls.mjs` (kills at wall edges and inside corners; every gib path sample, resting gib and decal on a walkable tile) — snapshot `shots/gore/walls.png`.
