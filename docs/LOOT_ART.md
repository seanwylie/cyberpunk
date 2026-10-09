# Loot drop art

Code: `src/lootart.ts` (all drawing), hooks in `src/render.ts` (`drawDrop`, `flushLoot`), `src/sim.ts` (`Drop.born`, `pickFx`), settings in `state.ts`/`ui.ts`.

- **Silhouettes** (96px cells, pre-rendered offscreen, cached per kind/slot/mfr/rarity): face, brain, torso, arm L/R, hand L/R (weapon hands show a barrel or blade), leg, foot L/R, chip (circuit tablet), stim (injector), credits (stacked hex salvage plates, 1-3 by amount). Tinted oxide red (HI), slate blue (PS), olive (MM); chips/stims/credits neutral. Rarity trim = outline colour + baked band (green notch, blue band, purple double band, orange etched chevrons).
- **Idle by rarity** (art style guide: prefer moving machinery over particle volume): grey static + rare soft sheen; green faint ring pulse + occasional glint; blue ring + faint light column + glint; purple tilting gimbal rings with orbiting plates + light sweep + slight float; orange hovering item, opening/closing plated housing, two counter-rotating gears (third on signature items), rotating tick ring, narrow warm ground beam, controlled warm light, faint heat shimmer.
- **Spawn**: analytic arc toss from an offset, two bounces, dust puffs (+ sparks blue and above). Time comes from `Drop.born`.
- **Pickup**: fly-in with arc, shrink and trail, flash ring (rarity sparks purple+); `pickup_blue/purple/orange` chime hooks in `audio.ts`.
- **Labels**: Settings -> Loot labels (Off / Near-hover / All) and "Show loot from" minimum rarity. Below the minimum, drops stay pickable but draw as small dim icons with no label/fx. Labels are de-overlapped and capped at 8.
- **Performance / Reduced FX**: icons and sheen frames are cached canvases; per-frame is a few drawImage + arcs. Fully animated: nearest drops only (<=14 non-grey, hard cap 22, none beyond 9 tiles). Reduced FX: static trims, no dust, trail, shimmer, sweep or glint.
- Previews: `docs/art/loot/*.gif` (`node tests/loot_gifs.mjs && python3 tools/loot/make_gifs.py`).
- Not done: Blender-rendered rotating 3D item sprites (no `bpy` on this box); the procedural look is the fallback that ships. A future pass can add `public/loot/<key>.webp` atlases and have `iconCanvas` prefer them.
