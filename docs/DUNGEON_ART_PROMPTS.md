# Dungeon art requests (dungeon pack)

Everything below is currently procedural placeholder. Visual target: `public/dungeons/source/foundry.jpg`, `clinic.jpg`, `warehouse.jpg`; palette per style guide (concrete grey, soot black, dirty bone, oxidized metal, faded textile; accents muted oxide red / slate-blue / muted olive; NO neon). Isometric ~45 degrees, stylized realism. Gameplay readability first: floor values (cover, hazard, interact, elevation) must read at mobile scale; telegraphs must stay readable.

Zone slot names in code (yard, proc, junction, boss, salvage, passage) map to concept panels via `DungeonDef.zoneLabels` in `src/content/dungeons.ts`.

## A. Environment (per dungeon: floor tiles, wall faces, props)
| Dungeon | Slot | Panel | Needed |
|---|---|---|---|
| Foundry | yard | Slag yard | Cracked slab floor; two large slag troughs with raised rims and a dull red molten surface (hazard, 8 circles of radius 1.1 along each trough in code); low concrete and crates; gantry frames |
| Foundry | proc | Casting hall | Tread plate, conveyor belts (walkable lane + blocked belts), ladle cranes, press plates (2 hazard circles), platform edges |
| Foundry | junction | Quench & press control gantry | Raised steel gantry floor, consoles as cover, terminal glow (muted), pour controller (objective prop) |
| Foundry | boss | Furnace ring | Central ring furnace 5x5 tiles with orange-red glow, eight heat zones at radius 4.4, pillars, scorched plate floor |
| Clinic | yard | Reception & intake ward | Dirty ivory tile, queue rails, gurneys (blocking low props), spilled-fluid decals (hazard) |
| Clinic | proc | Surgical theatre bays | Glass/steel partitions (tall blocking), ceiling surgical rigs, bay platforms |
| Clinic | junction | Ceramic implant fabrication lab | Console blocks, cable trunks, low platform, fabricator core (objective prop) |
| Clinic | boss | Operating amphitheatre | Tiered ring seating, central dais 5x5, hanging lamp rig, 4 saw-rig hazard emitters |
| Clinic | passage | Sterile corridor | Narrow sensor-lined corridor (sensor strips visible), quarantine seal door |
| Warehouse | yard | Loading dock | Concrete dock, shutters, CAUTION / STAND CLEAR decal, pallet jacks (hazard lanes), crates |
| Warehouse | proc | Storage aisles | Tall racks forming aisles (blocking, 2.2 height), collapsed-shelving hazard patches |
| Warehouse | junction | Sorting line | Conveyors, stamping press (hazard), machinery cover |
| Warehouse | boss | Retrieval hall | Gantry legs, ring platform, crate piles, crane drop zones (2 hazard circles r=1.8) |
| Warehouse | passage | Returns bay | Cradle prop for the dormant Returns Reclaimer |

## B. Hazard rendering (all dungeons)
Replace the generic grey-blue circle with per-hazard art: slag/furnace heat (dull red, animated), spilled fluid (ivory sheen), saw rig (spinning blade), pallet-jack lane, collapsed shelving, stamping press, crane hook. Must keep the existing readable warning state (red during windup).

## C. Enemies (sprites or Blender renders, 8 directions at the existing 160px character scale; idle, run, attack, hit, down)
Ordinary: slaghauler, ladlecrew, cinderhound, slagcannon (static), orderly, nursebot, gurneyrunner, sentry (static), picker, loader, forkbot, scanner, camgun (static).
Named elites (larger, visible rebuilt hardware): brakeman (Orsolya Kade), quenchpriest (Dov Aleksandrov), matron (Ilse Verhoeven), anesthetist (Dr. Quill), shiftlead (Dagny Pruitt), hobbs (Pallet-Jack Hobbs).
Silhouette goals: Harrow-Brandt = hydraulic, oxide red; Aldane = flush ivory ceramic, slate-blue; Kestrel = refurbished olive plastic, stamped steel.

## D. Bosses (large, reveal-ready, signature hardware visible)
teague (Crucible Foreman), brannoch (Ladle-Tyrant, huge ram arm), ore9 (Governor, furnace-mounted drone cluster), surgeon (Chief Surgeon Aurelio Vance), autosurgeon (GEMINI, ceiling-mounted twin rig), recovered (Patient Eleven, ceramic-plated and wrong), stockmgr (Regional Stock Manager), retrieval (R-0, the repurposed mech from the warehouse sheet), reclaimer (LAZARUS-LITE, refurbished once too often).

## E. Hardware (icons + slot sprites + rarity animation)
Orange (complex mechanical animation, controlled effects): Brannoch Anvil-Arm, Governor Core, GEMINI Autosurgeon Rig, Recovered Veil, R-0 Lifter Legs, Lazarus Rack. Purple (subtle spectacle): Gantry Legs L/R, Fan-Blade Arm, Ceramic Striders L/R, Nerve-Lace Cortex. Blue/green/grey: remaining items in `src/content/items.ts` (about 30).

## F. Contacts (portraits, 3/4 bust, same palette)
ten_hallowell, noor_abiodun, pell_okafor, ilya_sen, liaison_costa, liaison_dunmore (plus existing odalys_vane, tech_marr, handler_cole which also lack portraits). Optional: stall/booth props for the hub in Harrow-Brandt / Aldane / Kestrel identity.

## G. Audio (later)
Per-dungeon music foundation by manufacturer plus a boss motif layer for each boss; distinct signature sounds for the six orange items and the new telegraphs (blink, saw lanes, slag pools).
