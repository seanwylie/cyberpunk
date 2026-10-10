# Content Batch 1: 20 new bosses and 20 new levels

Sean: "We duplicate bosses a lot, let's generate say 20 of them and 20 more levels."
Status: prototype content, PLACEHOLDER balance like the rest of docs/UNIVERSE.md. The tables in sections 3 and 4 are generated from the data
(`node tools/content/gen_doc.mjs` from `src/content/batch1_bosses.ts` and `batch1_levels.ts`), so this document and the game cannot drift.

## 1. Goals and constraints
- 20 **new** bosses: distinct names, lore ties to the factions (Harrow-Brandt, Aldane Surgical, Kestrel Value, plus the Rustline Compact, the Quiet Shift and the Recall Authority from UNIVERSE.md), distinct mechanics, phases, attack patterns and arena gimmicks, distinct music mapping (`BOSS_MAP`), distinct silhouettes (`tools/enemies3d/specs_batch1.py`).
- 20 **new** levels, one boss each: distinct theme (palette, motif, light), room shapes and sizes, hazards, enemy roster, objective, zone names, rewards and unlock path.
- Content is **data-driven**. 20 bosses are combinations of a small toolkit, not 20 code forks. UI is touched minimally (dungeon select tag + lock line).

## 2. The mechanics toolkit (`src/content/mechanics.ts`)
All telegraphed ground patterns reuse the existing zone system (windup, lingering, damage tick); projectiles reuse `projs`. Existing melee (slam, cleave, rsweep, chainsweep, charge, blink, summon) stays as is.

| Kind | What it does | Params |
|---|---|---|
| `marks` | Telegraphed circles on and around the player's position | n, r, spread |
| `ring` | Ring of pools around the boss with a safe gap | n, gaps, rad, r |
| `spokes` | **Beam sweep**: lines of zones whose windup staggers so the beam rotates across an arc | n (slices), len, sweep (deg) |
| `cross` | Static spokes radiating from the boss all at once | n, len, r |
| `lanes` | Parallel striped lanes toward / across the arena with one safe gap | n, gap, len, space |
| `spiral` | Marker spiral expanding from the boss, staggered windup | n, turns, rad |
| `rain` | Random circles over the arena near the player | n, area, r |
| `fan` | Projectile fan | n, spread, speed |
| `nova` | Projectile ring with a safe arc (**hide behind pillars**; projectiles stop at walls and pillars) | n, speed, gap |
| `adds` | Summon wave (capped by live adds) | type, n, cap |

Phase actions (at HP thresholds): `shield` (absorb pool; breaking it staggers = 1.5x damage for 4 s), `pylons` (**tether**: 90% less damage while any node lives; killing all staggers), `enrage` (speed and cooldown multipliers), `adds` (one-off wave), `gimmick` (switch arena gimmick).
Arena gimmicks (always on while the boss is alive): `rain` (floor strikes), `spokes` (centre beam sweeps), `pillarfire` (**pillars fire novas**), `edge` (arena rim turns hazardous, shrinking safe ground), `trickle` (periodic adds), `lanes` (periodic lane volleys).

Boss state: phase index is persisted on the enemy (`phase`), tether/summon children carry `bossAdd` so Reset/checkpoint restart/death cleans them up. Shields and gimmick timers are runtime-only (a page reload during a fight resets the shield, not the phase).

### 2.1 Uniqueness rule (enforced by `tests/content1.mjs`)
- Every boss has a unique full signature (moves with params + phase list + gimmick).
- No two bosses share the same (move kinds + gimmick kind + phase action kinds) triple.
- Every level has a unique (room shapes + palette motif/light + hazard mode + roster) fingerprint.

## 2.2 Level generator (`src/content/mapgen_batch1.ts`)
Same run chain as every dungeon (entry, gate1, hall, lock2, control with controller, boss door, boss arena with `revealX`, salvage room, checkpoints) so objective, boss reveal, checkpoint and daily-lockout logic apply unchanged. Per level, the four main rooms get a **shape** from 12 obstacle generators (`open pillars rings diag cave river maze islands colonnade pit zigzag cross`), sizes from the recipe, seeded jitter, hazards in one of four modes (`channels scatter ring lanes`), seeded packs from the roster. `validate()` plus deterministic seed retry guarantees connectivity, objective reachability and a boss-radius-reachable boss spawn.

## 2.3 Progression, tiering and rewards
- Tiers: I = Lv 12-24, II = 20-32, III = 28-42, IV = 38-50 (capstone). Existing four dungeons stay as they were.
- **Unlock path**: each level lists `unlock.after` (all must have been cleared at least once; persisted as `save.cleared[id]`). Entry, resume and daily lockout rules are the existing ones; the dungeon select shows tier and a "Requires clearing ..." line instead of the Start button.
- **Rewards**: credit multiplier and clear XP scale by tier; loot pool by faction (reusing the Foundry / Clinic / Warehouse tables, `mix` blends all three); each level has a themed chip cache. Boss damage scale 1.4 / 1.55 / 1.7 / 1.9 per tier.
- **Instance / reset rules**: unchanged. `LAYOUT_V` bumped so stale instances are discarded; Reset instance rolls a new seed.
- **Minimap / objectives**: unchanged (read `Level`); objective labels, relay labels and zone names are per level. Objective type for all 20 is the existing controller-then-boss-door chain with a themed device (the run-state machine is not forked).
- **Music**: each boss maps to one of the existing boss tracks in `BOSS_MAP`; pairs are chosen so neighbours in the same faction do not share a track.

## 3. Bosses (20)

| # | id | Name | Faction | Tier | Level | HP | Melee (existing) | Toolkit moves | Phases | Arena gimmick | Signature |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `voss` | Coke-Tender Marguerite Voss | Harrow-Brandt | I | `coke_ovens` | 2800 | slam, charge | marks(n5,r1.6,spread3.6); spokes(n7,len8,sweep150) | <45%: enrage x1.25 speed, x0.75 cooldowns + gimmick rain | rain every 11s. Coke battery floor: ember rain falls in the open. | Rotating coke-door beam sweep + ember rain |
| 2 | `lineman` | Lineman Tomasz Brandt | Harrow-Brandt | I | `substation_12` | 3000 | cleave | nova(n16,speed7.5,gap50); fan(n5,spread50,speed11) | <70%: 3x camgun tether | pillarfire every 9s. Pylon tether: three relay nodes shield him; pillars shield you from the arc nova. | Tether pylons + arc nova you hide from behind pillars |
| 3 | `gantrymother` | Gantry-Mother Ngozi Adeyemi | Rustline Compact | I | `scrap_gantry` | 2900 | slam | lanes(n5,gap2,len12,space2.4); adds(typepicker,n3,cap7) | <50%: 2x forkbot wave + gimmick lanes | trickle every 14s. Crane lanes: striped drop lanes with one safe gap each cast. | Crane-drop lane volleys with a safe gap + scrap-crew trickle |
| 4 | `pitboss` | Pit Boss Karl Ossendrecht | Harrow-Brandt | I | `tailings_pit` | 3300 | charge, slam, rsweep | ring(n12,gaps2,rad6,r1.6) | <60%: gimmick edge | edge every 9s. Collapsing rim: ground along the arena edge turns toxic, shrinking the safe area. | Shrinking arena + charge/slam brawler |
| 5 | `bellfounder` | Bell-Founder Vesper Calloway | Harrow-Brandt | II | `bell_foundry` | 3800 | slam | ring(n14,gaps1,rad4.5,r1.5); ring(n18,gaps3,rad8,r1.5); cross(n4,len9) | <50%: shield 12%/12s | spokes every 12s. Tolling rings: a tight ring and a wide ring, with rotating floor spokes. | Double concentric ring tolls + bronze shield break |
| 6 | `cryo` | Cryo-Archivist Linnea Frost | Aldane Surgical | II | `cold_archive` | 3600 | blink | lanes(n7,gap1,len13,space1.9); fan(n7,spread80,speed10) | <65%: shield 14%/14s; <30%: enrage x1.2 speed, x0.7 cooldowns | lanes every 10s. Frost lanes sweep the vault, narrowing the safe gaps. | Narrow frost lanes + ice shield, then deep-freeze enrage |
| 7 | `auditor` | Compliance Officer Hale Thornquist | Aldane Surgical | II | `audit_tower` | 3500 | cleave, blink | spiral(n20,turns1.7,rad9,r1.3); adds(typenursebot,n2,cap6) | <50%: enrage x1.3 speed, x0.65 cooldowns | rain every 12s. Audit spiral: markers spiral out from him; step between the arms. | Outward audit spiral + blink strikes + timed enrage |
| 8 | `mirrorpt` | The Mirror Patient | Aldane Surgical | II | `aesthetic_ward` | 3400 | blink, cleave | fan(n9,spread100,speed12); marks(n6,r1.5,spread4.4) | <66%: 2x orderly wave; <33%: 1x matron wave + enrage x1.15 speed, x0.8 cooldowns | trickle every 16s. Hall of mirrors: reflections (adds) join at 66% and 33%. | Wide mirror fans + summoned reflections at two phases |
| 9 | `apothecary` | Apothecary Dessa Quill | Aldane Surgical | II | `pharmacy_vault` | 3700 | cleave | cross(n6,len10,r1.4); rain(n9,area7,r1.7) | <55%: 2x sentry tether | spokes every 14s. Vent cross: six gas spokes burst from her, with extra sentry dispensers at 55%. | Six-arm gas cross + dispenser tether |
| 10 | `resonance` | Resonance Engineer Obi Lindqvist | Aldane Surgical | III | `anechoic_lab` | 5000 | blink | spokes(n9,len10,sweep210); nova(n20,speed8,gap40) | <50%: enrage x1.2 speed, x0.7 cooldowns + gimmick spokes | pillarfire every 10s. Anechoic cell: wide beam sweeps and pillar echoes; pillars both shield and reflect. | 210-degree beam sweep + pillar echo novas |
| 11 | `clearance` | Clearance Manager Bryce Tolliver | Kestrel Value | II | `outlet_mall` | 3700 | charge, slam | rain(n12,area8,r1.6); adds(typepicker,n4,cap9) | <50%: enrage x1.3 speed, x0.7 cooldowns | trickle every 9s. Sale floor: constant markdown rain and trickling shoppers. | Heavy markdown rain + endless add trickle |
| 12 | `liquidator` | Liquidator Prime | Kestrel Value | III | `liquidation_floor` | 5200 | slam, rsweep | marks(n8,r1.5,spread5); ring(n10,gaps2,rad5,r1.5) | <70%: shield 10%/10s; <40%: shield 12%/10s + enrage x1.15 speed, x0.8 cooldowns | rain every 13s. Receivership floor: stacked mark barrages and two shield cycles. | Eight-mark barrage + twin shield cycles |
| 13 | `courier` | Courier-Queen Marisol Pike | Kestrel Value | III | `parcel_tower` | 4800 | charge, blink | lanes(n6,gap1,len14,space2.1); fan(n11,spread120,speed13) | <55%: enrage x1.3 speed, x0.6 cooldowns | lanes every 7s. Conveyor tower: fast parcel lanes cross the floor constantly. | Fast repeating lanes + double charge/blink mobility |
| 14 | `dispatcher` | Fleet Dispatcher AUTO-7 | Kestrel Value | III | `freight_depot` | 5000 | - | fan(n7,spread60,speed12); nova(n12,speed9,gap60); adds(typeforkbot,n3,cap7) | <60%: 2x camgun tether | pillarfire every 8s. Rail yard: signal pylons feed the dispatcher, forkbots stream in. | Ranged hover dispatcher: pylon feed + forkbot waves |
| 15 | `warrantor` | Warrantor Edda Marsh | Kestrel Value | III | `warranty_vault` | 5400 | slam, rsweep | ring(n12,gaps1,rad6.5,r1.6); marks(n6,r1.8,spread4) | <66%: 3x sentry tether; <30%: shield 12%/10s + enrage x1.2 speed, x0.7 cooldowns | edge every 10s. Vault: seal-pylons make her near invulnerable until destroyed, then edge fills in. | Seal-pylon tether then late shield+enrage with creeping edge |
| 16 | `tidewarden` | Pump-Warden Alva Strand | Rustline Compact | II | `drained_reservoir` | 3800 | rsweep | lanes(n5,gap1,len12,space2.6); spiral(n16,turns1.2,rad8,r1.5) | <50%: gimmick edge | rain every 10s. Flood basin: wave lanes and rising edge water. | Tidal lanes + rising edge water |
| 17 | `rattle` | Quiet Shift Foreman 'Rattle' | Quiet Shift | III | `night_tunnels` | 5000 | blink, cleave, charge | marks(n7,r1.4,spread4.6); adds(typeworker,n4,cap9) | <50%: 3x shooter wave; <25%: enrage x1.3 speed, x0.65 cooldowns | trickle every 11s. Dark tunnels: night shift crews keep coming, and he blinks between them. | Blink-melee foreman with constant crew adds |
| 18 | `breaker` | Breaker-King Joss Kellan | Rustline Compact | III | `breaker_yard` | 5600 | chainsweep, charge, slam | spiral(n24,turns2.2,rad9,r1.4); ring(n9,gaps2,rad4.8,r1.4) | <50%: enrage x1.25 speed, x0.7 cooldowns + gimmick rain | edge every 12s. Breaker pit: heavy melee chains with spirals and a rubble edge. | Chain-sweep brawler with double-spiral scrap |
| 19 | `widow` | Signal Widow Perpetua | Rustline Compact | III | `radio_mast` | 5100 | - | spokes(n10,len13,sweep240); fan(n5,spread40,speed14); nova(n10,speed10,gap70) | <60%: 4x camgun tether | pillarfire every 11s. Mast platform: long 240-degree beam sweeps, four antenna tethers. | Extra-long beam sweeps + four antenna tethers |
| 20 | `recall` | Recall Engine R-ALL | Recall Authority | IV | `recall_yard` | 8200 | slam, charge, chainsweep | spokes(n9,len11,sweep200); ring(n14,gaps2,rad7,r1.6); marks(n7,r1.6,spread5); adds(typescanner,n4,cap10) | <75%: shield 10%/12s; <50%: 3x turret tether; <25%: enrage x1.3 speed, x0.6 cooldowns + gimmick rain | pillarfire every 10s. Recall yard: three escalating phases (shield, tether, enrage) on the toughest arena. | Capstone: shield, tether and enrage phases combined |

### 3.1 Lore tie-ins

- **Coke-Tender Marguerite Voss** (Harrow-Brandt): Last tender of the Basin coke batteries. Harrow-Brandt kept her on the books for forty years after the ovens were condemned; she keeps feeding them.
- **Lineman Tomasz Brandt** (Harrow-Brandt): A Brandt cousin who kept Substation 12 live through the strikes. Believes the grid is a promise.
- **Gantry-Mother Ngozi Adeyemi** (Rustline Compact): Runs the scrapyard cranes for the Rustline independents and has never dropped a load she did not mean to.
- **Pit Boss Karl Ossendrecht** (Harrow-Brandt): Ran the tailings pit until the contract lapsed. His shift whistle still sets the pace of the machines.
- **Bell-Founder Vesper Calloway** (Harrow-Brandt): Cast the shift-bells for every Harrow plant. Each bell she rings is a tolling shockwave, and she rings them all.
- **Cryo-Archivist Linnea Frost** (Aldane Surgical): Aldane keeps its oldest case files frozen. Frost keeps the files, and everything that tries to read them.
- **Compliance Officer Hale Thornquist** (Aldane Surgical): Aldane compliance liaison for Aldane Terrace. Every conversation is an audit; his final audit is yours.
- **The Mirror Patient** (Aldane Surgical): Elective-procedure ward 3 never discharged her. Every revision left another reflection.
- **Apothecary Dessa Quill** (Aldane Surgical): Quill dispensed the Ward 9 sedatives. The vault filled with her mistakes a long time ago.
- **Resonance Engineer Obi Lindqvist** (Aldane Surgical): Built the quietest room in the Basin, then lost the habit of leaving it. Sound is his weapon now.
- **Clearance Manager Bryce Tolliver** (Kestrel Value): Everything must go. He has been on the final day of the sale for nine years.
- **Liquidator Prime** (Kestrel Value): A Kestrel receivership routine that never closed an account. It values everything at salvage.
- **Courier-Queen Marisol Pike** (Kestrel Value): Her couriers run the Basin on a bonus system. She is never late, and neither are her packages.
- **Fleet Dispatcher AUTO-7** (Kestrel Value): A routing intelligence that outlived its fleet. It now routes everything, including you.
- **Warrantor Edda Marsh** (Kestrel Value): Kestrel claims adjuster for the unit "Retrieval R-0" and every other void warranty. She denies by default.
- **Pump-Warden Alva Strand** (Rustline Compact): Kept the Basin reservoir pumps running after the water left. She still believes the tide is coming back.
- **Quiet Shift Foreman 'Rattle'** (Quiet Shift): The Quiet Shift are the workers who kept working after the plants closed. Rattle is the one who counts them each night.
- **Breaker-King Joss Kellan** (Rustline Compact): Strips decommissioned hardware for the Rustline market and keeps the best parts for himself.
- **Signal Widow Perpetua** (Rustline Compact): Kept the Basin broadcast mast alive for a husband who stopped answering. She relays only what she chooses.
- **Recall Engine R-ALL** (Recall Authority): The Basin Recall Authority was meant to retire dangerous hardware. R-ALL decided the people carrying it count as hardware.

### 3.2 Phase lines (spoken on transition)

- Coke-Tender Marguerite Voss: "The ovens remember the schedule."
- Lineman Tomasz Brandt: "Phase to ground. Lines are live."
- Gantry-Mother Ngozi Adeyemi: "Hook down!"
- Pit Boss Karl Ossendrecht: "The pit is getting smaller."
- Bell-Founder Vesper Calloway: "Toll for the line!"
- Cryo-Archivist Linnea Frost: "Closed to the public." / "Deep freeze."
- Compliance Officer Hale Thornquist: "Finding: non-compliant."
- The Mirror Patient: "Look. Look at me." / "Look closer."
- Apothecary Dessa Quill: "Take one every four hours."
- Resonance Engineer Obi Lindqvist: "Silence."
- Clearance Manager Bryce Tolliver: "Final markdown!"
- Liquidator Prime: "Appraising." / "Assets frozen."
- Courier-Queen Marisol Pike: "Express delivery."
- Fleet Dispatcher AUTO-7: "Recalculating route."
- Warrantor Edda Marsh: "Claim denied." / "Void where prohibited."
- Pump-Warden Alva Strand: "Tide is in."
- Quiet Shift Foreman 'Rattle': "Roll call." / "Last shift."
- Breaker-King Joss Kellan: "Rip it down!"
- Signal Widow Perpetua: "Antenna array online."
- Recall Engine R-ALL: "Recall initiated." / "Recall: all units." / "Recall: self."

## 4. Levels (20)

| # | id | Name | Host boss | Mfr | Tier | Lv band | Theme / motif | Room shapes (yard, hall, junction, arena) | Hazards | Objective | Gate guard / lock elite | Roster | Unlock |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `coke_ovens` | Basin Coke Ovens | `voss` | HI | I | 12-24 | cracks, red light | open / colonnade / islands / pit | Ember bed (channels x2) | Battery charging controller | slagcannon / brakeman | slaghauler, cinderhound, ladlecrew | annex |
| 2 | `substation_12` | Substation 12 | `lineman` | HI | I | 12-24 | stripes, cool light | pillars / rings / zigzag / colonnade | Live bus bar (lanes x3) | Grid interlock | turret / sawhand | worker, shooter | warehouse |
| 3 | `scrap_gantry` | Rustline Scrap Gantry | `gantrymother` | MM | I | 12-24 | crates, warm light | islands / maze / islands / open | Crane drop zone (scatter x6) | Crane master console | camgun / hobbs | picker, loader, forkbot, scanner | warehouse |
| 4 | `tailings_pit` | Tailings Pit 3 | `pitboss` | HI | I | 12-24 | plates, warm light | diag / cave / diag / pit | Sludge pool (scatter x7) | Haul-road relay | slagcannon / sawhand | slaghauler, loader, cinderhound, ladlecrew | annex |
| 5 | `bell_foundry` | Calloway Bell Foundry | `bellfounder` | HI | II | 20-32 | plates, warm light | colonnade / rings / pillars / rings | Bronze melt (ring x8) | Great bell mechanism | slagcannon / quenchpriest | slaghauler, ladlecrew, cinderhound | foundry |
| 6 | `cold_archive` | Aldane Cold Archive | `cryo` | PS | II | 20-32 | tiles, pale light | maze / zigzag / maze / open | Frost vent (scatter x6) | Stack index terminal | sentry / matron | orderly, nursebot, gurneyrunner | clinic |
| 7 | `audit_tower` | Aldane Audit Tower | `auditor` | PS | II | 20-32 | grid, pale light | pillars / cross / colonnade / cross | Audit laser (lanes x3) | Findings ledger | sentry / anesthetist | orderly, nursebot, gurneyrunner | cold_archive |
| 8 | `aesthetic_ward` | Ward 3 Aesthetics | `mirrorpt` | PS | II | 20-32 | tiles, pale light | rings / maze / islands / zigzag | Spilled sedative (scatter x6) | Revision schedule board | sentry / matron | nursebot, orderly, gurneyrunner | clinic |
| 9 | `pharmacy_vault` | Quill Pharmacy Vault | `apothecary` | PS | II | 20-32 | hex, pale light | maze / islands / cross / pillars | Gas leak (scatter x8) | Dispensary controller | sentry / anesthetist | orderly, nursebot, gurneyrunner | aesthetic_ward |
| 10 | `anechoic_lab` | Lindqvist Anechoic Lab | `resonance` | PS | III | 28-42 | foam, cool light | pillars / diag / colonnade / rings | Resonance field (ring x7) | Calibration rig | sentry / anesthetist | nursebot, orderly, gurneyrunner | audit_tower |
| 11 | `outlet_mall` | Kestrel Outlet Mall | `clearance` | MM | II | 20-32 | tiles, warm light | islands / colonnade / islands / rings | Sale spill (scatter x6) | Doorbuster register | camgun / shiftlead | picker, scanner, loader, forkbot | scrap_gantry |
| 12 | `liquidation_floor` | Kestrel Liquidation Floor | `liquidator` | MM | III | 28-42 | stripes, red light | zigzag / islands / zigzag / pit | Tagged pallet fire (scatter x7) | Receivership ledger | camgun / hobbs | loader, picker, forkbot, scanner | outlet_mall |
| 13 | `parcel_tower` | Kestrel Parcel Tower | `courier` | MM | III | 28-42 | crates, warm light | colonnade / diag / river / open | Chute drop (lanes x4) | Master dispatch belt | camgun / shiftlead | picker, forkbot, scanner, loader | liquidation_floor |
| 14 | `freight_depot` | Basin Freight Depot | `dispatcher` | MM | III | 28-42 | stripes, cool light | river / islands / maze / colonnade | Live rail (channels x2) | Signal tower relay | camgun / hobbs | forkbot, picker, scanner, loader | substation_12 + scrap_gantry |
| 15 | `warranty_vault` | Kestrel Warranty Vault | `warrantor` | MM | III | 28-42 | plates, warm light | pillars / cross / rings / cross | Seal field (ring x8) | Claims terminal | camgun / shiftlead | loader, scanner, picker, forkbot | liquidation_floor |
| 16 | `drained_reservoir` | Drained Reservoir | `tidewarden` | MM | II | 20-32 | water, cool light | river / cave / river / pit | Standing water (channels x2) | Sluice controller | camgun / hobbs | slaghauler, picker, cinderhound, loader, ladlecrew, scanner | tailings_pit |
| 17 | `night_tunnels` | Quiet Shift Tunnels | `rattle` | MM | III | 28-42 | grid, cool light | cave / maze / cave / zigzag | Sump water (scatter x6) | Shift-bell box | turret / foreman | worker, shooter, picker | drained_reservoir |
| 18 | `breaker_yard` | Kellan Breaker Yard | `breaker` | HI | III | 28-42 | cracks, red light | islands / diag / zigzag / pit | Scrap fire (scatter x8) | Crusher controller | slagcannon / sawhand | slaghauler, worker, ladlecrew, cinderhound | bell_foundry |
| 19 | `radio_mast` | Basin Radio Mast | `widow` | PS | III | 28-42 | hex, cool light | diag / pillars / river / colonnade | RF burn (lanes x3) | Transmitter core | sentry / matron | nursebot, shooter, orderly, gurneyrunner | pharmacy_vault |
| 20 | `recall_yard` | Recall Authority Yard | `recall` | HI | IV | 38-50 | hex, red light | maze / rings / pillars / rings | Recall beacon (ring x9) | Recall registry | turret / brakeman | worker, picker, orderly, shooter, nursebot, ladlecrew, forkbot, slaghauler, scanner, cinderhound, gurneyrunner | breaker_yard + radio_mast + warranty_vault |

### 4.1 Level blurbs and rewards

| id | Blurb | Credit x | Clear XP | Cache chips | Loot pool |
|---|---|---|---|---|---|
| `coke_ovens` | Condemned coke batteries that never stopped firing. Ember beds, charging rails and a battery floor for Marguerite Voss. | 1.5 | 450 | ablative, quench | HI |
| `substation_12` | A live grid substation with breaker halls and transformer yards. Lineman Brandt keeps the lines hot. | 1.5 | 460 | power, coolant | HI |
| `scrap_gantry` | A cluttered scrap yard under travelling cranes. Mounds of salvage make maze-like lanes for the Gantry-Mother. | 1.4 | 430 | magnet, speed | MM |
| `tailings_pit` | An open pit with switchback ramps and sludge pools. Karl Ossendrecht still runs the shift. | 1.5 | 450 | plating, ablative | HI |
| `bell_foundry` | A cathedral-height foundry of cast bells and hanging moulds. Vesper Calloway rings them all. | 2.4 | 700 | quench, overdrive | HI |
| `cold_archive` | Frozen records vaults, rime-covered stacks and cold lanes. Frost keeps the files. | 2.3 | 690 | cloakdur, gridlink | PS |
| `audit_tower` | A glass-and-ceramic compliance tower of open-plan floors. Thornquist audits everything. | 2.3 | 690 | gridlink, fineedge | PS |
| `aesthetic_ward` | Elective-revision suites lined with mirrors. Every room has the same woman in it. | 2.3 | 680 | cloakdur, sustain | PS |
| `pharmacy_vault` | A sealed dispensary vault of cabinets and gas lines. Dessa Quill still fills prescriptions. | 2.4 | 700 | sustain, quench | PS |
| `anechoic_lab` | Foam-wedge chambers built to swallow sound. The corridors hum. Obi Lindqvist hears everything. | 3.3 | 1000 | gridlink, overdrive | PS |
| `outlet_mall` | A dead mall with the lights still on. Faded markdown banners, shuttered storefronts, a central atrium sale. | 2 | 640 | ablative, speed | MM |
| `liquidation_floor` | A receivership floor of tagged pallets and red-ticket stacks. Everything is priced to move; so are you. | 3.2 | 980 | fineedge, quench | MM |
| `parcel_tower` | Sorting floors stacked in a tower, chutes and belts everywhere. Marisol Pike keeps the line moving. | 3.3 | 990 | speed, magnet | MM |
| `freight_depot` | Rail sidings, container stacks and a dead dispatch tower. AUTO-7 still routes the trains. | 3.3 | 1000 | gridlink, magnet | MM |
| `warranty_vault` | A bonded vault of void-warranty files and returned units. Edda Marsh denies by default. | 3.4 | 1020 | ablative, fineedge | MM |
| `drained_reservoir` | The Basin reservoir, empty and tide-stained. Pump halls and spillways, with Alva Strand still on watch. | 2.2 | 660 | coolant, sustain | mix |
| `night_tunnels` | Service tunnels where the Quiet Shift still clock in. Low light, tight bends and a foreman who counts heads. | 3 | 960 | cloakdur, speed | mix |
| `breaker_yard` | Where decommissioned hardware is stripped for parts. Gutted frames, hanging chains and a rubble pit. | 3.2 | 980 | plating, overdrive | HI |
| `radio_mast` | A broadcast mast on a gantry platform, antenna arrays and cable trays. Perpetua relays what she chooses. | 3.2 | 980 | gridlink, cloakdur | PS |
| `recall_yard` | The Basin graveyard of recalled hardware from all three manufacturers. R-ALL is still issuing recalls. | 5 | 1800 | overdrive, quench | mix |
