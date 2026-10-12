# Bestiary: beyond robots

The player can graft cyberware limbs, so the world is full of things that crossed the same line from the other side. Robots stay (the Annex is a factory), but every dungeon theme now fields bodies that are **not** a humanoid or hover bot: swarms, worms, spiders, sacs, jellies, dolls, ghosts, growths, tentacled chassis, glitches.
Art comes from the Blender 8-direction pipeline (`tools/enemies3d/arch_bestiary.py`: 8 new archetypes, organic materials flesh / chitin / wire / gel / holo; specs in `specs_bestiary.py`). Data: `src/content/bestiary_mobs.ts`. Silhouette = what you read in 0.3 s; the **tell** is how its mechanic shows on the body.

## Families (14 shipped + 14 planned for batch 2 = 28 concepts, 13 non-robot families)
| Family | Archetype / gait | Shipped (batch 1) | Planned (batch 2) |
|---|---|---|---|
| Swarm of small things | `swarm`: nine critters that scatter / regroup | Gutterling Swarm (T1 swarmer) | Bolt Beetles (T2, chitin + exposed cyberware), Rust Moths (T3 flying swarm, debuff) |
| Lamprey / slither | `worm`: travelling-wave slither, ring-of-teeth mouth | Slag Leech (T1 bruiser, lifesteal) | Drain Maw (T3, latches, big lifesteal), Cable Eel (T2 ranged arc) |
| Gas sac | `sac`: inflate / lurch / burst | Soot Sac (T1 exploder) | Spore Bladder (T2 poison cloud), Pack Sac (T4 big exploder) |
| Insectoid / arachnid | `arach`: tripod skitter | Stitch Spider (T2 charger) | Widow Weaver (T3 web zones), Scuttle Crawler (T4) |
| Parasite host | `arach` tick + lamprey rig | Hang Tick (T2 acid-spit ranged) | Brood Host (T3 summoner of ticks) |
| Jellyfish drifter | `jelly`: pulse + trailing tentacles | Drape Jelly (T2 debuffer) | Storm Jelly (T4 chain arcs) |
| Rogue medical drone with flesh | `jelly` + organs + syringes | Flesh Drone (T3 summoner) | Triage Maw (T4 healer) |
| Mannequin / doll stalker | `doll`: stop-motion stiff gait | Fitting-Room Doll (T2 charger) | Display Choir (T3, group freezes when watched) |
| Fused corpse-mech pile | `many` pile + limbs | Meat Carrier (T2 bruiser) | Reclaim Heap (T4 shielded bruiser) |
| Ghost / hologram | `phantom`: float + flicker | Hollow Ghost (T3 caster) | Echo Clerk (T4 decoy caster) |
| Fungal / biotech growth | `sac` fungal stalks | Root Cluster (T3 healer) | Bloom Mother (T4 support/ward) |
| Tentacled / many-limbed chassis | `many`: ripple walk | Squidwalker (T3 bruiser) | Rope Hauler (T4) |
| Glitch entity | `phantom` shards | Glitch Shard (T3 blinker) | Static Choir (T4) |
| Vehicle / turret-crab | `arach` crab + turret | Crab Gun (T3 mortar caster) | Tow-Crab (T4 shield) |

## Dungeon assignment (batch 1; merged into the level rosters, `BESTIARY_ROSTER`)
Slag Ovens: Slag Leech, Soot Sac · Substation 12: Gutterling · Scrap Gantry: Gutterling, Soot Sac · Tailings Pit: Gutterling, Slag Leech, Soot Sac · Bell Foundry: Meat Carrier · Cold Archive: Drape Jelly, Fitting-Room Doll · Audit Tower: Hang Tick, Doll · Aesthetic Ward: Jelly, Doll · Reagent Vault: Jelly, Hang Tick · Outlet Mall: Doll, Stitch Spider · Drained Reservoir: Stitch Spider, Jelly, Meat Carrier · Anechoic Lab: Hollow Ghost, Flesh Drone · Liquidation Floor: Squidwalker · Parcel Tower: Stitch Spider, Crab Gun · Freight Depot: Squidwalker, Crab Gun, Stitch Spider · Warranty Vault: Hollow Ghost, Glitch Shard · Night Tunnels: Hang Tick, Ghost, Glitch, Root Cluster · Breaker Yard: Meat Carrier, Crab Gun, Squidwalker · Radio Mast: Glitch, Ghost, Root Cluster · Recall Yard: Squidwalker, Glitch, Flesh Drone, Ghost, Meat Carrier.

Balance: every new mob is a re-bodied copy of a tuned role at the same tier (same attack ids, HP/damage within +-10% of its siblings, see `docs/BALANCE.md`), so clear-rate targets are unchanged.

## Boss silhouettes (32; each distinct from the robot frame and from each other; the kit mechanic must be readable on the body)
"Status": **kit** = mechanic exists (docs/BOSSES.md), **art** = silhouette to build as a multi-part Blender rig (limbs/weak points as separate sprites), **overlay** = interim: existing sprite + animated overlay.
| Boss | Silhouette / theme | How the body telegraphs the kit |
|---|---|---|
| Teague (slag line) | Furnace-belly bulk with a conveyor belt for a spine | belt chevrons run along the back before the Conveyor floor |
| Brannoch (ladle toll) | Bell-headed giant, ladle arms | head swings, ring toll |
| ORE-9 | Floating crystalline cube, laser lattice | grid lines drawn from cube faces |
| The Surgeon | Tall, six scalpel arms on a spine | afterimages = extra arms fan out |
| Autosurgeon | Twin ceiling-rail arms (hanging) | arms rotate for the beam |
| Patient Eleven (recovered) | Bed-bound flesh mass with IV limbs | IV stands are the Buff nodes |
| Stock Manager | Pallet-stack golem | ricochet roller = a barrel rolling out of the stack |
| Retrieval | Magnet-crane spider | claw drops + vortex |
| Reclaimer | Returns-desk mouth with conveyor tongue | safe zones = open slots |
| Annex Overseer | Tower of monitors on stilts | pylons = antennae tethers |
| Neural Warden | Brain-in-jar with cable roots | gaze from the eye lens |
| Reclamation Enforcer | Armoured hound-truck hybrid | roller + scythe |
| Voss (oven battery) | Oven-door torso, ember vents | vents glow during Heat overload |
| Lineman | Pylon-tall hanging figure on live cables | cable pylons |
| Gantry-Mother | Crane body, dangling brood sacs | sacs drop as Crane Drop |
| Pit Boss | Tailings leviathan half-sunk in sludge | vortex = mouth whirlpool |
| Bell-Founder | Cast-bronze bell-body, many tongues | toll rings |
| Cryo-Archivist | Frozen glacier-statue shedding ice | shield = ice shell |
| Compliance Officer | Floating form-stack with stamp arms | tiles = stamped squares |
| Mirror Patient | Doll-shard figure, mirrored limbs | afterimage = mirror copies |
| Formulator | Bottle-chimera, vial tentacles | chain bombs = vials |
| Resonance Engineer | Tuning-fork ribcage, hollow face | beam + gap ring |
| Clearance Manager | Price-tag mannequin-swarm | tiles = tags |
| Liquidator Prime | Many-armed auction crab | conveyor + roller |
| Courier-Queen | Insectoid parcel-wasp | lines = flight lanes |
| Fleet Dispatcher | Truck-cab torso on spider legs | tether lines |
| Warrantor | Vault-door jaws, ledger wings | shield = ledger pages |
| Pump-Warden | Reservoir leech-eel, giant lamprey | wave rings |
| Rattle | Boneyard-wire mannequin pile | cone sweeps |
| Breaker-King | Fused corpse-mech throne | sparks + tiles |
| Signal Widow | Antenna-spider, thread lines | grid = web |
| Recall Engine R-ALL | Parade-float of fused recalled machines, weak-point engines | each engine is a destroyable weak point |

Multi-part support is **feasible within the current atlas format only as layered overlays** (weak-point / limb sprites drawn over a body atlas, hidden when destroyed). Phase plan: (1) batch 1 mobs + gore (this commit); (2) batch 2 mobs; (3) boss body rigs rendered per-part (`part` anims) with a `parts[]` array in the atlas JSON and a sever hook already used by the Bloody-mode limb break (`GORE` big chunks at 75/50/25 % HP). The gore limb break is live now for every boss.

## Verification
`tests/bestiary.mjs`: 14 mobs defined, unique names, bodies mapped, rosters, tiers, atlas files for each (8 rows, frames, half-res twin), `enemy_dirs` on the new ids, memory budget of the added atlases, snapshot sheet `shots/bestiary/`.
