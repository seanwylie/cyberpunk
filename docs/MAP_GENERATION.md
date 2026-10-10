# Seeded dungeon map generation

All four dungeons are built by `build(seed)` in `src/content/dungeons.ts` using `src/content/mapgen.ts`. A level is a pure function of `(dungeon, seed)`; no `Math.random` is used inside generators.

## Seed rules (with docs/INSTANCE_RESET_AND_WEAPONS.md)
- `startRun` rolls `inst.seed`; the layout, hazards, objective/relay/condition/cache locations and enemy packs all derive from it. Enemy state is persisted per instance as before.
- Re-entering an instance, "Restart from checkpoint" and reloading the page rebuild the **same** level from `inst.seed`.
- "Reset instance" (and Quick re-run) already means *abandon and start a fresh instance*, so it rolls a **new** seed and a new layout. The existing rule is unchanged: it is not a reset-in-place.
- Old saved instances (no `layoutV`) are discarded on next entry because their enemy positions no longer fit the new layouts. `LAYOUT_V` in `state.ts` must be bumped whenever generator output changes.
- `build()` with no seed uses a fixed per-dungeon default seed (tests, docs).

## Per-dungeon structure
| Dungeon | Character |
|---|---|
| Reclamation Annex | The current five hand-made rooms (yard, processing floor, control junction, boss chamber, salvage) re-dressed per seed: new prop/conveyor/machine layout, boss pillars (symmetric, random count), roaming relay / terminal / controller / cache positions, re-clustered enemy packs, and a vertical mirror half the time. |
| Heavy Industrial Foundry | Big open yards and halls. Casting hall has 1-2 N-S slag channels (hazard lines) with 1-3 catwalk bridges (passage floor, no hazard). Furnace ring boss room with a seeded ring of heat nodes (with a gap) and pillars. Condition alcoves above and below the gantry swap sides by seed. |
| Precision Surgical Clinic | Intake ward and theatre bays are grids of 6x6 rooms on an 8-tile pitch joined by a random spanning tree plus loops, 3-wide choke openings, and some rooms merged. Cloak passage over the top with a sensor strip. Spilled fluids in random rooms, saw rigs on a seeded ring in the amphitheatre. |
| Mass-Market Warehouse | Loading dock with trailers, crates and pallet-jack lanes. Storage hall is long 2-high shelving rows with 3-wide aisles and seeded cross-aisle gaps, collapsed-shelving hazards. Sorting line conveyors and a stamping press, gantry-leg retrieval hall with cranes, returns bay alcove. |

All keep the run chain the game logic relies on: entry, `gate1`, hall, `lock2`, control, `boss` door, boss arena (zone `boss`, `revealX`), plus salvage room, checkpoints and conditions.

## Guarantees (enforced by `validate()` and retried with a deterministic seed perturbation if broken)
- Every walkable tile is connected to the entry with doors open (unreachable pockets are walled off).
- Relay, controller, conditions, cache, checkpoints and the boss spawn are reachable.
- Boss spawn is reachable on the **boss-radius (class 2, r=1.1)** flow field: all door corridors on the critical route are 3 wide.
- Every enemy spawn sits on a tile whose clearance class (0 / 0.7 / 1.1, same as `Game.flowCls`) can reach the player entry, so pathing never starts an enemy in a pocket it cannot leave.
- Hazards are per level (`Level.hazards`), never inside walls, and enemy packs are kept off them.

Minimap/fog read `Level.w/h/solid`, so they work unchanged. Generation costs about 5 ms per level.

Tests: `npm run test:mapvary` (`tests/mapvary.mjs`). Contact sheet: `shots/mapvary/`.
