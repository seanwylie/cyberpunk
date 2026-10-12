# Calm start: safe entry zone, grace period, intro beat

Complaint: instances started violently (packs, elites and ranged enemies on top of or in sight of the entrance). The audit (`tests/calm_start.mjs`, part A) found on average **5.3 offending packs per level** (enemy inside 14 tiles of the entry, or a ranged/elite/static spawn with line of sight, or any enemy whose aggro range reaches the entry) across all 24 dungeons.

## 1. Safe entry zone (layout, `src/content/safestart.ts`)
Applied to every dungeon build as the last step (`dungeons.ts` wraps `build`), so it sees the final rotated/mirrored level and is a pure function of level + seed (resume, party clients and the hub all rebuild the same result; enemy id = spawn index still holds).
- `SAFE_R = 14` tiles: no enemy spawn and no hazard inside it.
- No **ranged / elite / static** spawn with tile line of sight to the entry within `max(aggro+6, 20)`; no enemy with LOS to the entry inside `aggro+3`.
- Violating packs are **relocated whole** (same zone first, then the nearest zone that is far enough) onto tiles that are reachable at the enemy's clearance class, clear of hazards, interacts and checkpoints. Nothing is deleted: enemy counts are unchanged (`>= 40` in every level).
- **Ramp:** the first three packs by walking distance are capped at 3 / 4 / 5 members (surplus joins later packs, re-ranked until stable) and the first two carry no elite affixes. Elites/gate guards are never part of the opening.
- Difficulty targets are unchanged (same HP, damage, enemy totals; the same enemies, only further in). Hard modes only scale stats, they do not change spawns, so they inherit the same layout.

## 2. Grace period (`Game.grace`, `GRACE` in `src/sim.ts`)
- Starts on every fresh run, every **re-entry** of a saved instance, and every **party** instance start. 5 s.
- While it is on: non-boss enemies are dormant (cannot wake, wake groups do not propagate) and `hurtPlayer` ignores all damage (enemies, projectiles, zones, hazards). Boss reveal rules are untouched.
- Ends early on the **first attack / ability / dodge / hit on an enemy**, or after moving more than 8 tiles from the start; otherwise after 5 s. It covers only the entry: the first pack is 14+ tiles away.
- Re-entry also puts any enemy that wandered within 12 tiles of the entry back at its home and clears every alert.
- **Party:** the hub sends `graceMs` (5000) in `instance_start`; each client starts the same grace on that event and builds the same level from the server seed. `PartyWorld` (headless/tests) has the authoritative variant: `opts.grace`, one shared timer, any member's first action ends it for everyone.
- **Bots / tests skip it:** `localStorage.wv_nograce=1` (set by `tests/lib.mjs launch()` unless `grace:true`), `Game.dbg.noGrace`, or `globalThis.__WV_NOGRACE`. Node sims (no `window`) only get it when asked (`beginGrace`, `PartyWorld {grace}`).

## 3. Intro beat
`introBeat()` emits `intro`: the UI shows the dungeon title with the objective card (about 5 s) and a short fade-in from black (camera settle). Music stays on the calm `traversal` state; combat music cannot start inside the grace since nothing engages. Screens: `shots/starts/start_*.png`; layout map sheet with the safe radius: `shots/starts/safe_entry_maps.png` (`node tools/startsheet.mjs`).

## 4. Staggered wake-up
During the first 3 minutes of an instance, when a pack is alerted only the trigger wakes at once; the others follow nearest-first at 0.25 s + 0.3 s each (max 1.5 s) with a white flash tell and the alert sound as each wakes.

## 5. Tests
`tests/calm_start.mjs` (in `npm test`): (A) 24 dungeons x 16 seeds: safe radius, LOS, hazards, ramp caps, no affixes in first packs, count kept, validate; (B) live: dormant enemies, no damage for 4.5 s even with an alerted enemy adjacent, ends on time / dodge / move / hit / cast, intro card, all 24 dungeons idle 4.8 s unharmed, re-entry, staggered wake; (C) party shared grace, ends for all on any action, timer end.
