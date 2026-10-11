# Graphics variety pass

Goal: fewer visibly repeating assets without touching the art style, atlas sizes or memory tiers. Everything new is either baked once into an existing canvas (no new texture sizes), cached in an already-bounded LRU, or a lazily loaded WebP atlas rendered with the existing Blender pipeline.

## 1. Dungeon environments (`src/variety_env.ts`, wired in `src/dungeon_env.ts`)
- **23 kits** (the 3 original themes + 20 batch-1 levels), one per theme: floor wear x2 (`KITS[theme].floor` / `floor2`, 15 painters: cinder, chevrons, cables, rubble, rustflake, silt, frost, oil, tile wear, moss, glass, paper, bays, wet, drains), wall dressing (9: pipes, vents, stencil, drips, panels, conduit, posters, shutters, ribs), prop livery (7: drums, tape, hazmat, tarp, plate, lightbar, rust), 3 floor decals per theme (14 decal painters baked into the organic floor overlay), and an ambient particle (10 kinds). `tests/variety.mjs` asserts every kit is pairwise distinct (signature + grade).
- Layers are painted onto the *same* offscreen canvases the themed textures already use (S = 192 floor, existing wall/prop sizes): zero extra texture memory, built once per (theme, zone, variant) and cached by `envtex.ts`.
- **Colour grade / lighting per zone**: `applyGrade()` = one multiply fill + optional vignette, cross-faded as the player walks between zones (yard / proc / junction / salvage / passage / boss). Boss arenas use the theme's boss tint. Tint is clamped (>= 190) so it stays a grade, not a filter.
- **Ambient particles**: <= 22 tiny rects/arcs per frame, skipped with Reduced FX or quality `fx >= 1`.

## 2. Mobs and bosses (`src/variety.ts`, `tools/enemies3d/specs_variety.py`)
- **Alternate silhouettes**: 11 of the most repeated mobs get a second body (`<id>_b`: different weapon, headgear, pack, palette, scale) rendered with the same Blender 8-direction pipeline (`specs_variety.py`, `/workspace/variety_blender.sh` style loop: `IDS=<id>_b build_enemy.py` then `pack_enemy.py`). `drawType()` picks `_b` for ~50% of spawns by enemy id (deterministic), same stats and hitbox. The atlas LRU (`atlasMax`) is unchanged, so memory stays bounded.
- **Elite affix tells**: affixed pack leaders get a coloured ground aura (hasted cyan, volatile orange, shielded blue, regenerating green, vampiric crimson, frenzied red, warded white, molten amber, brooding violet, stormcalled pale blue) with a dashed rotating rim and orbiting motes; innate elites get a gold aura. Reduced FX / `fx >= 1` = static rim only.

## 3. Towns (`src/town_variety.ts`)
- **Per-town grade**: Rustline keeps the cool dusk; Harrow Reach gets a smoky ember grade and heavier vignette (`TOWN_GRADE`).
- **Ground dressing baked into the existing ground canvas**: Rustline = crosswalks, stall numbers, lane arrows, flyers/litter, graffiti tags, grease; Harrow Reach = safety arrows, Line-7 bay numbers, ember cracks with glow, soot scorch, yellow safety paint.
- **NPC outfit variants**: 7 outfits (hi-vis vest, scarf, cap/wrap, work trousers, apron, two-tone, hood+collar) painted on the cached tinted walker frame; frame cache stays bounded at 360.

## 4. Loot (`src/lootart.ts`)
- Non-orange items get one of 4 liveries by item id (`lootVariant`): stock, hazard-stripe band, serial plate + polish, worn/grimy. Applied to the raw sprite before the rarity outline/band, so rarity reads exactly as before. Icon cache grows by <= 4x of ~100 small canvases.

## Budgets and tests
- `tests/variety.mjs`: kits distinct + every theme has a kit, every theme renders hall + boss without errors, env texture memory <= 80 MB; writes `shots/variety/env_<theme>_{hall,boss}.png`.
- `tests/variety2.mjs`: loot variants visually distinct, mob variant picker deterministic and ~50/50, all `_b` atlases listed and their sheets load, both towns build and show >= 3 outfits, heap <= 900 MB; writes `shots/variety/town_*.png`.
- Existing `tests/memory.mjs`, `tests/envperf.mjs`, `tests/mobile.mjs` still cover the quality tiers.
