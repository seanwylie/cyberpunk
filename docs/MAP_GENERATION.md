# Seeded dungeon map generation

The four original dungeons (annex, foundry, clinic, warehouse) are built by `build(seed)` in `src/content/dungeons.ts` using `src/content/mapgen.ts`. A level is a pure function of `(dungeon, seed)`; no `Math.random` is used inside generators.

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

## Why the dungeons felt identical (and the fix)
After the 20-level batch, every generated level used the same macro layout: four rooms in a row joined left to right by 3-wide corridors (`chain()` in `mapgen_batch1.ts`). Seeds, room shapes and props changed, but the room graph, the door placement, the boss-door-on-the-left entry and the run direction never did, and the four originals had the same chain. The seed itself was fine (`startRun` rolls a new `inst.seed` for every instance).

`src/content/mapgen_arch.ts` replaces the chain for the 20 batch levels (`genBatch1` now delegates to `genArch`; the old chain is kept as `genBatch1Chain`).

## Archetypes (`mapgen_arch.ts`)
Each level declares a primary and an alternate macro archetype (`ARCH_OF`); the alternate appears on about 30% of runs, so a dungeon keeps its identity without being one fixed map.

| Archetype | Room graph / geometry | Used by (primary) |
|---|---|---|
| `gauntlet` | linear E-E-E, long narrow corridors, flat staggered rooms, optional side wing | Slag Ovens, Freight Depot, Quiet Shift Tunnels |
| `ell` | two legs then a 90 degree turn to the boss, mid-length corridors | Scrap Gantry, Liquidation Floor, Recall Yard |
| `zig` | staircase / Z (E-S-E) with large perpendicular offsets and dogleg corridors | Tailings Pit, Breaker Yard |
| `uturn` | U shape (E-S-W): control room below the lock, boss back under the entry | Cold Archive, Anechoic Lab, Drained Reservoir |
| `hub` | oversized processing hub with 3 spokes (2 dead-end or loop wings + entry), control room off a short corridor | Substation 12, Aesthetic Ward, Outlet Mall |
| `vault` | line with a large boss vault; the control room has two loop wings (rooms joined by two corridors), the hall has a third | Bell Foundry, Reagent Vault, Warranty Vault |
| `floors` | wide flat storeys stacked top to bottom, doors alternate between the left and right ends (switchback, multi-floor feel with chokepoints) | Audit Tower, Parcel Tower, Radio Mast |

Per run seed the generator also varies: room sizes (+-2 on the spec dims), corridor lengths and offsets, straight or dogleg corridors, wing count and loops, which of the 8 rotations/mirrors of the square is applied (`symRect`), the manufacturer cover theme (HI heavy machinery + conveyors, PS partition stubs + cabinets, MM shelving blocks + pallets), hazard placement (along the room's long axis, so it follows the rotation), where the relay and controller sit (near the exit, tucked in a far corner, or mid-room), and the boss arena shape (`ring`, `dais`, `hall`, `lanes`, `octagon`, `cross4`, `split`, `islands`, picked from the spec's boss-room shape).

Everything is built in an abstract rectangle graph first (rooms + wings + links with door side), rotated, normalised to a 3-tile margin and only then carved, so doors, corridors, minimap bounds and fog work unchanged. Corridors are always 3 wide with a straight cross-section right outside each room edge where the door sits (so a dogleg cannot bypass a door), and each corridor is rejected if it touches a non-endpoint room.

The four hand-structured dungeons (annex, foundry, clinic, warehouse) keep their bespoke generators but are now also rotated or mirrored per seed with `symLevel` (one of 8 symmetries).

### Boss reveal
`Level.reveal={x,y,r}` (set by every archetype level and by `symLevel`) replaces the old `px>=revealX` test, which assumed the boss room was to the east. The boss spawns when the controller is done and the player is in the boss zone within `r` of the point just inside the boss door. `revealX` stays for old saves/tests.

### Guarantees added (`archCheck()`, also run by the generator with a seed perturbation retry)
- Staged reachability with real door tiles: the relay is unreachable with `gate1` closed and reachable once it opens; the controller and control checkpoint are unreachable until `lock2` opens; the boss spawn is unreachable until `boss` opens.
- Relay, controller, cache, 2 checkpoints, 3 doors present; every enemy spawn reachable at its own clearance class (`validate`).
- Boss arena: at least 300 floor tiles, at least 55% of it walkable at boss clearance (class 2, r=1.1), boss spawn at least 9 tiles from the door and with boss clearance.

## Layout-difference metric (`tests/mapvary2.mjs`)
`diff(a,b)` in 0..1 = 0.65 x (1 - weighted Jaccard of the 40x40 normalised walkable maps, aspect ratio preserved, doors open) + 0.35 x structural distance (aspect, wall density, corridor share, wing/passage share, direction from entry to boss, size). Thresholds: mean across all 24 dungeons >= 0.50 and no pair below 0.20; every generated dungeon averages >= 0.35 between its seeds, with no two seeds closer than 0.15. The test also checks every dungeon x 6 seeds for solvability, the door chain, boss arena fit and determinism, and writes the contact sheet.

Contact sheet: `node tools/mapsheet.mjs` writes `shots/mapvary/contact_all_dungeons.png` (all 24, one seed), `contact_seeds_batch.png` and per-dungeon seed strips. Colours: zones, grey props, red dots enemies, orange rings hazards, yellow/orange/red door tiles (gate1/lock2/boss), cyan interactables, green spawn, gold boss spawn.

`LAYOUT_V` is now 3: old saved instances are discarded on next entry.
