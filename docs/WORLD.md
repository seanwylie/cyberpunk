# World: towns and districts

Warranty Void's megacity is 11 safe-hub towns linked by the **Reach Line** (the transit station in every town opens the world map).
Rustline Market and Harrow Reach are hand-built (`src/level.ts`, `src/town2.ts`); the other nine districts are generated from data in
`src/world.ts` by `src/towngen.ts`. `src/worldtowns.ts` maps any town id to its level builder, stations and art.

Towns never have combat: no enemies, spawns, hazards or ability casts. Level bands are aspirational, not locks: once a transit line is open,
any level can walk around, see elite gear and look at sealed gates.

## Towns

| Town | Level band | Faction | Theme | Stations | Dungeon gates | Transit unlock |
|---|---|---|---|---|---|---|
| Rustline Market (`rustline`) | 1–24 | Rustline Compact | Tarp market, neutral ground | jobs, implants, gate, repair, locker, store, bank, transit | all Tier I–II + Annex, Foundry, Clinic, Warehouse | Starter (open) |
| Neon Mile (`neon_mile`) | 1–18 | Kestrel Value | Entertainment strip | transit, jobs, vendor, store, locker, gate | warehouse, annex, scrap_gantry, pharmacy_vault | Starter (open) |
| The Stacks (`the_stacks`) | 6–22 | Rustline Compact | Container slums | transit, jobs, vendor, repair, locker, gate | substation_12, tailings_pit, scrap_gantry, coke_ovens | Starter (open) |
| Saltwater Harbor (`salt_harbor`) | 14–30 | Rustline Compact | Flooded harbor | transit, jobs, vendor, bank, locker, gate | drained_reservoir, coke_ovens, freight_depot, foundry | Clear **coke_ovens** from the_stacks |
| Dustline Salvage (`dust_yard`) | 16–32 | Harrow-Brandt | Desert salvage yard | transit, jobs, vendor, repair, gate | bell_foundry, tailings_pit, breaker_yard | Clear **foundry** from salt_harbor |
| Harrow Reach (`harrow`) | 20–50 | Harrow-Brandt | Foundry terraces | transit, jobs, bank, parts, gate, forge repair, locker, guild | all (only Tier III–IV host besides districts) | Clear **bell_foundry** from rustline |
| The Underbazaar (`under_bazaar`) | 20–34 | Quiet Shift | Underground market | transit, jobs, vendor, store, bank, locker, gate | pharmacy_vault, outlet_mall, night_tunnels, clinic | Clear **pharmacy_vault** from neon_mile |
| Aldane Spire (`aldane_spire`) | 26–40 | Aldane Surgical | Corporate arcology | transit, jobs, vendor, store, bank, repair, gate | clinic, cold_archive, audit_tower, aesthetic_ward, anechoic_lab, liquidation_floor | Clear **clinic** from under_bazaar |
| Signal Heights (`signal_heights`) | 28–44 | Rustline Compact | Antenna rooftops | transit, jobs, vendor, locker, repair, gate | radio_mast, breaker_yard, night_tunnels | Clear **radio_mast** from harrow |
| Kestrel Plaza (`kestrel_plaza`) | 30–46 | Kestrel Value | Corp HQ plaza | transit, jobs, vendor, store, bank, locker, gate | liquidation_floor, parcel_tower, warranty_vault, freight_depot, recall_yard | Clear **liquidation_floor** from aldane_spire |
| Tether Base (`tether_base`) | 38–50 | Recall Authority | Orbital elevator base | transit, jobs, vendor, bank, repair, locker, gate | recall_yard, warranty_vault | Clear **recall_yard** from kestrel_plaza |

## Town graph and epic gateway dungeons

The starter towns, **Rustline Market, Neon Mile and The Stacks**, are open from the start. Every other town is reached over one link, and that link has an **epic gateway dungeon**. The gateway is hosted at the source town's gate (marked `GATEWAY → TOWN` in yellow) and tuned to the destination's entry level, so players arrive at the right level for the new vendors.
Clearing the gateway once opens the Reach Line to that town **permanently for that character**. The unlock is stored in `save.world.unlocked` and is also derived from `save.cleared`.
Party rewards are individual, because each member runs `grantClear` on their own save. That means every party member who clears the gateway together unlocks the town.
The clear toasts a set-piece arrival line (`GATEWAY CLEARED: <title>. <vista>`), and the transit map opens with the new town selected. The first visit to the town replays the arrival line.
Data lives in `GATEWAYS` in `src/world.ts`; edit that to retune.

```
            Rustline ──(Bell Foundry)──> Harrow Reach ──(Radio Mast)──> Signal Heights
Neon Mile ──(Reagent Vault)──> Underbazaar ──(Ward 9 Clinic)──> Aldane Spire ──(Liquidation Floor)──> Kestrel Plaza ──(Recall Yard)──> Tether Base
The Stacks ──(Slag Ovens)──> Saltwater Harbor ──(Foundry Line 7)──> Dustline Salvage
```

| Link | Gateway dungeon | Title | Destination floor | Arrival vista |
|---|---|---|---|---|
| the_stacks → **salt_harbor** | `coke_ovens` | Through the Slag Ovens | 14 | The ovens open onto the old sea wall. Below, the harbor lights float on black water. |
| salt_harbor → **dust_yard** | `foundry` | Line 7 Breakout | 16 | Past the last casting hall the roof is gone and the sand starts. Salvage fires flicker on the horizon. |
| rustline → **harrow** | `bell_foundry` | The Bell Road | 20 | The bell tolls behind you. Ahead, Harrow Reach glows on its slag terraces under the dead stack. |
| neon_mile → **under_bazaar** | `pharmacy_vault` | Down the Vault Stairs | 20 | The vault's service stair drops into the metro concourse. Lanterns, a thousand stalls, nobody looks up. |
| under_bazaar → **aldane_spire** | `clinic` | Ward 9 Ascent | 26 | The patient lift climbs out of Ward 9 and opens on the Spire podium. The air tastes filtered. |
| harrow → **signal_heights** | `radio_mast` | Climb the Mast | 28 | At the top of the mast the Heights spread out: dishes, shanties and the Spire far across the haze. |
| aldane_spire → **kestrel_plaza** | `liquidation_floor` | Final Markdown | 30 | The liquidation floor's loading doors roll up onto Kestrel Plaza and its gold arch. |
| kestrel_plaza → **tether_base** | `recall_yard` | Recall Run | 38 | Beyond the yard fence the Tether rises out of sight, climber cars crawling toward orbit. |

Locked towns appear on the world map as dashed silhouettes. The tooltip shows the name, level band and "Clear <Gateway> to unlock". The ride button is disabled and `travelCheck` refuses travel.
Old saves keep any town they already visited, along with Harrow if its legacy unlock flag was set.

**Not done yet:** the gateways reuse existing dungeons with their own signature bosses. They are not yet longer than a normal run or retuned for gateway duty, and there is no look-only visit from the end vista.

## Aspirational hooks and discovery (`src/discovery.ts`)

- **First visit:** bonus XP (`40 + 6 × band floor`) plus +5 standing with the town's manufacturer faction (Harrow-Brandt → HI, Aldane Surgical → PS, Kestrel Value → MM).
- **Landmarks:** each district has a landmark vista. Walking within 5 tiles logs it in the atlas (shown on the transit screen) for `20 + 3 × band floor` XP.
- **Fixer:** when you are under the band, Odalys says you are out of your depth, both as a toast on arrival and on the job board.
- **Sealed gates:** outside Rustline, dungeons more than 4 levels above you show as sealed teasers with their level, tier, boss and blurb. Entry is refused.
- **Vendors:** district vendors stock their band (floor − 6 to ceiling), and towns with a floor of 20 or more also sell purple. Items above your level show 🔒 Lv N with a tooltip and a disabled buy button.
- **Elite NPCs:** guards in heavier kit stand at every district gate with a cool aura light.
- Discovery state lives in `save.world` (per character).

## Generator (`src/towngen.ts`)

Each district template sets its size, shape (`oval`, `long`, `cross`, `terrace` with stair-gapped ledges), seed and station subset. It also sets the ground textures, a CSS recolour filter baked once over the shared Rustline and Harrow prop families (so each district reads as distinct), the colour grade, lamp colour, perimeter and hub prop pools, landmark, neon signage and crowd density.
Stations sit on a ring around the plaza, with each pad in front of its focal prop (the same geometry `station_trigger_align` checks). Lanes three tiles wide are carved from the plaza to every pad, and a final flood fill seals any pocket the player could not reach. Lights use slow `lightPulse` breathing (3–5 s) and never flicker.

| District | Landmark | Shape | Signage | Recolour | Music |
|---|---|---|---|---|---|
| Neon Mile | The Billboard Canyon | long | KARAOKE · NOODLES 24H · PACHINKO · KESTREL | `hue-rotate(285deg) saturate(1.35) brightness(1.05)` | neon_mile_a … neon_mile_f |
| The Stacks | The Twelve-High | terrace | STACK 7 · NO TRESPASS · WATER 2C | `sepia(.35) hue-rotate(-12deg) saturate(1.1) brightness(.92)` | the_stacks_a … the_stacks_f |
| Saltwater Harbor | The Drowned Crane | cross | FISH · BOATS · TIDE 3M | `hue-rotate(160deg) saturate(.8) brightness(.95)` | salt_harbor_a … salt_harbor_f |
| Dustline Salvage | The Hauler Graveyard | oval | SALVAGE · WATER · NO FLY | `sepia(.55) saturate(1.3) hue-rotate(-8deg) brightness(1.08)` | dust_yard_a … dust_yard_f |
| The Underbazaar | Platform Zero | cross | NO CAMERAS · CASH ONLY · PLATFORM 0 | `hue-rotate(95deg) saturate(1.1) brightness(.88)` | under_bazaar_a … under_bazaar_f |
| Aldane Spire | The Clean Air Column | oval | ALDANE · APPOINTMENTS · QUIET ZONE | `grayscale(.6) brightness(1.35) contrast(.9)` | aldane_spire_a … aldane_spire_f |
| Signal Heights | Mast Nine | terrace | ON AIR · 88.1 · DISHES | `hue-rotate(220deg) saturate(.9) brightness(.95)` | signal_heights_a … signal_heights_f |
| Kestrel Plaza | The Value Arch | oval | KESTREL VALUE · SALE · NO LOITERING | `hue-rotate(20deg) saturate(1.5) brightness(1.15)` | kestrel_plaza_a … kestrel_plaza_f |
| Tether Base | The Tether | cross | CUSTOMS · RECALL AUTH · LIFT 1 | `hue-rotate(175deg) saturate(1.2) brightness(1.1)` | tether_base_a … tether_base_f |

## Performance and loading

The art for a town (props, grounds, recolour bake, neon signs) is created on first visit or while the tram screen preloads it. At most two generated art sets stay alive. Music for each district is lazy-loaded (`WORLD6` in `src/music.ts`, generated by `tools/gen_music.py`, 6 × ~90 s loops per district).

## Tests

- `tests/world.mjs`: every town via the transit UI at level 1 (locked lines refuse travel first, then are force-opened), safe hub, full walkable connectivity, reachable pads, station spacing.
- `tests/world_unlocks.mjs`: starter towns open; every other town is locked and travel is refused; each gateway is enterable from its source town and within ±6 levels of the destination floor; a real `startRun` + `grantClear` of every gateway unlocks its town; checks the silhouette tooltip, persistence across reload, and that a second character starts locked.
- `tests/world_discovery.mjs`: first-visit XP and standing once, fixer line, landmark log, sealed gates, elite vendor stock, persistence.
- `tests/station_trigger_align.mjs`: every station in every town, desktop and phone.
- `tests/world_music.mjs`: ≥ 6 own tracks per district, files present, pool switch, no repeats in a bag cycle.
- `tests/world_perf.mjs`: townperf in every district, plus a memory tour (≤ 2 art sets, heap budget).
- `tests/ui_overflow.mjs` (travel panel): world map at desktop and phone sizes.
- Screenshots: `npm run shots:world` → `shots/world/<town>.png`.
