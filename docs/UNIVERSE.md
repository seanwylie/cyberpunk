# UNIVERSE: lore bible, dungeon pack, MMO roadmap and decision log

Status: prototype content. All numbers are PLACEHOLDER (the specs say numerical examples are not approved balance). Everything here is grounded in
Primary Requirements v3, Dungeon & Builds, Adaptive Story, Progression & Seasons, Monetization & Inventory, the Art & Audio Style Guide and the Technical
Selection brief (solo creator, small personal budget, scope control, no fabricated infrastructure). Anything the specs leave open is logged in section 9.

## 1. Setting: the Verge Basin

The Verge Basin is a drained industrial valley sprawl under permanent haze. Three manufacturers own its hardware supply chain and, through contracts,
most of its law. Nobody is "evil": every facility operates under constant scarcity, every body is a repair job, and corporate control shows up as
paperwork, audits and reclaim sweeps rather than villains. The tone is bleak industrial, stylized realism, **no neon**; accents are restrained per
manufacturer (style guide). Humanity is never a gameplay penalty: replacing anatomy changes how you look and play, not what you are.

Tagline from the art sheets: *Reclaim. Refurbish. Redeploy.*

### 1.1 The three manufacturers

| | Harrow-Brandt Heavy Works (HI) | Aldane Surgical (PS) | Kestrel Value Systems (MM) |
|---|---|---|---|
| Identity | Heavy industrial. Visible fasteners, hydraulics, oxide red on gunmetal. | Precision surgical. Flush ivory ceramic, slate-blue accents. | Economical mass market. Refurbished olive plastics and stamped steel. |
| Hardware | Rippers, rams, presses, cooling torsos, loadbearer legs. Force, bracing, venting. | Blades, cloak weaves, strider legs, hacking cortexes. Precision and stealth. | Neural control, defib racks, slug and nail tools, refurbished everything. Cheap, swappable, sustainable. |
| Culture | Salvage and reclaim. "Reclaim is not theft; it is theft with a form." | Audit and compliance. "All conversations are audits." | Volume and resale. "Everything is secondhand. Some of it is secondhand twice." |
| Hard conflict | Ripper/ram vibration defeats Aldane Veil and Theatre weaves (data-driven, unchanged by reputation). | | |

### 1.2 Districts and world map

```
                    [Aldane Terrace]  (precision surgical, larger manufacturer hub, later)
                           |
 [Harrow Reach] ---- [RUSTLINE MARKET] ---- [Kestrel Row]
 (heavy industrial,    (small starting hub,    (mass market, larger
  larger hub, later)    repair market)          hub, later)
        |                                          |
 Reclamation Annex, Foundry Line 7           Distribution Hub 9
                  Ward 9 Clinic (Aldane Terrace)
```

* **Rustline Market (hub, level 1+).** The starting repair market: tarp stalls, a cramped plaza, Fixer and Vendor booths, an Outfitter. Neutral ground where all three manufacturers sell through independents. Matches the town art direction.
* **Harrow Reach (hub, fixed level unlock TBD).** Foundry district. Home of the Reclamation Annex (Lv 10-20) and Foundry Line 7 (Lv 18-30). Contacts: Ten Hallowell (fixer), Rhea Dunmore (reclaim liaison).
* **Aldane Terrace (hub, fixed level unlock TBD).** Clean, quiet, ceramic. Home of Ward 9 Clinic (Lv 22-34). Contacts: Noor Abiodun (fixer), Ilya Sen (technician), Dr. Mireille Costa (compliance liaison).
* **Kestrel Row (hub, fixed level unlock TBD).** Outlet strip and distribution. Home of Distribution Hub 9 (Lv 8-18). Contact: Cole (asset recovery handler).
* Hubs are level-locked, **dungeons admit any level** (spec). In the prototype only Rustline Market exists; the other districts are lore and contact bases, and every dungeon is selectable from the Rustline gate. See section 8 for how districts become real hubs.

## 2. Recurring cast

Contacts are the home of persuasion, barter and brain-oriented social play (spec). Portraits are NOT drawn yet (text and stencil monogram only).

| Id | Name | Role | Faction | Where | Notes |
|---|---|---|---|---|---|
| `odalys_vane` | Odalys Vane | Fixer | independent | Rustline | Existing. Annex contracts; hosts the story board. |
| `tech_marr` | Marr | Technician | independent | Rustline | Existing. Reads replacement-part markings. |
| `handler_cole` | Cole | Corporate handler | Kestrel | Kestrel Row | Existing. Tracks missing controllers/refurbishments. Hub 9 contracts. |
| `ten_hallowell` | Teodor "Ten" Hallowell | Fixer | Harrow-Brandt | Harrow Reach | Retired Line 7 shift lead; hears the horn that will not stop. Foundry contracts. |
| `noor_abiodun` | Noor Abiodun | Fixer | independent | Aldane Terrace | Street clinician who sells Ward 9 leads. Clinic contracts. |
| `pell_okafor` | Pell Okafor | Trader | independent | Rustline | Resells everything twice. Haul contract. Future barter vendor. |
| `ilya_sen` | Ilya Sen | Technician | Aldane | Aldane Terrace | Ceramics technician; reads weave patterns by touch. |
| `liaison_costa` | Dr. Mireille Costa | Corporate handler | Aldane | Aldane Terrace | Writes the audit commands the terminals obey; denies it. Hack-route contract. |
| `liaison_dunmore` | Rhea Dunmore | Corporate handler | Harrow-Brandt | Harrow Reach | Counts everything that leaves a Harrow facility. Force-route contract. |

### 2.1 Bosses (named, recurring, one default and two replacements per dungeon)

Replacement bosses follow the Adaptive Story rules: hardware-enabled, repeatable conditions, an ordinary-chance orange signature item, never guaranteed, never LLM-generated. The first confirmed condition wins; the other selector locks. Every boss gets the full damage-free reveal.

| Dungeon | Default (no condition) | Condition A | Condition B |
|---|---|---|---|
| Reclamation Annex (existing) | Annex Overseer (MM) | Audit terminal, hack: **Neural Warden** (sig: Audit Core) | Sealed armory fuse, force: **Reclamation Enforcer** (sig: Reclaimer Ripper) |
| Foundry Line 7 | **Crucible Foreman Aldric Teague** (slam, slag pools, summons haulers) | Casting-line interlock, **force**: **Ladle-Tyrant Brannoch** (ram sweep, charge, ring of slag pools with one safe gap). Sig: Brannoch Anvil-Arm | Pour-schedule console, **hack**: **Governor ORE-9** (ranged volleys, slag rings, cinder drones). Sig: Governor Core |
| Ward 9 Clinic | **Chief Surgeon Aurelio Vance** (blink + riposte, scalpel fan, chain sweep) | Theatre scheduling terminal, **hack**: **Theatre Autosurgeon GEMINI** (saw lanes with a gap, scalpel fans). Ranged, so brain builds are not locked out. Sig: GEMINI Autosurgeon Rig | Quarantine ward seal, **cloak weave**: **The Recovered (Patient Eleven)** (blink, sweeps, charge, recovery windows). Sig: Recovered Veil |
| Distribution Hub 9 | **Regional Stock Manager Wendell Rusk** (slam, crate drops, summons pickers) | Order-queue console, **hack**: **Retrieval Unit R-0**, the repurposed mech from the sheet (ring sweep, chain sweep, crate drops). Sig: R-0 Lifter Legs | Dormant returns cradle, **defib rack**: **Returns Reclaimer LAZARUS-LITE** (slams, charge, crate drops, fork-bot summons). Sig: Lazarus Rack (authored Easter egg) |

### 2.2 Named elites (each gates a lock; killing it is the combat route past the lock)

* Foundry: **Brakeman Orsolya Kade** (cleave + charge, releases the press lock), **Quench-Priest Dov Aleksandrov** (slag pools + volley, guards the control gantry).
* Clinic: **Matron Ilse Verhoeven** (cleave + blink, releases the theatre lock), **Dr. Quill the Anesthetist** (gas vents + volley, guards the fabrication lab).
* Hub 9: **Shift Lead Dagny Pruitt** (cleave + summons pickers, releases the sorting shutter), **Pallet-Jack Hobbs** (charge + slam, guards the sorting line).
* The Annex keeps its Sawhand Reclaimer and Salvage Foreman. Foundry's tool crib also has a Sawhand.

### 2.3 Ordinary enemy types (placeholder procedural art)

Foundry (HI): Slag Hauler (melee), Ladle Crew (ranged slag shot), Cinder Hound (fast bite), Slag Cannon (static gate guard).
Clinic (PS): Ward Orderly (melee), Intake Nurse-Bot (ranged dart), Gurney Runner (charger), Intake Sentry (static gate guard).
Hub 9 (MM): Contract Picker (weak melee), Dock Loader (heavy melee), Fork-Lift Bot (charger), Inventory Scanner (ranged), Dock Cam-Gun (static gate guard).
Spectrum follows the spec: workers with modest replacements, radically rebuilt elites, bosses with visible signature hardware.

## 3. Season 1 framing

Season 1 ("The Audit Year") is the first yearly season. Fresh characters at the same power ceiling, levels and reputation restart, purchases persist, older characters stay in a permanent world (spec). The framing:

* **Premise.** Aldane Surgical has opened a basin-wide compliance audit. Harrow-Brandt answers with an accelerated reclaim sweep. Kestrel quietly sells the confusion. Every contract and boss selection pushes one of these three arcs (`audit_pressure`, `reclaim_push`, `quiet_trade`, plus the dungeon arcs `foundry_unrest`, `ward_secrets`, `stock_shrinkage`).
* **Seasonal mechanic (design placeholder, NOT implemented).** "Audit slot": one rotating dungeon modifier per week (a fixed difficulty ceiling, new hazards or map modifiers, per spec "harder content combines stronger enemies, behaviors, hazards and map modifiers") with a seasonal-only reward track made of cosmetics and authored non-power rewards. New seasonal mechanics must give reasons to farm without power inflation (spec risk: inherited oranges at the same ceiling).
* **Returning nemesis content.** Defeated bosses can return as targets in familiar places with a new operative name and the same asset/kit (spec). Season 1 reserves Teague, Vance and Rusk as returning targets.
* The Annex, Foundry, Clinic and Hub 9 form the first rotation: four dungeons, four dailies, enough for the "daily dungeons encourage rotation" cadence the progression spec asks for.

## 4. The dungeon pack (what is implemented)

All three new dungeons reuse the Annex run structure (entry area, gated hall, lock, control point, boss door, boss) so the proven logic (guard gate, elite-or-hack lock, objective, damage-free reveal, checkpoints, hardware breakage, 24-hour instance retention, per-dungeon daily lockout) applies unchanged. Each has an optional side room with a chip cache and two replacement-boss interactions that need different augment capabilities. The combat route to objective and boss always works with no special hardware.

| | Foundry Line 7 | Ward 9 Clinic | Distribution Hub 9 |
|---|---|---|---|
| Manufacturer | Harrow-Brandt (HI) | Aldane (PS) | Kestrel (MM) |
| Recommended level / item cap | 18-30 / 30 | 22-34 / 34 | 8-18 / 26 |
| Run length (estimate) | 7-10 min | 7-10 min | 5-8 min |
| Areas (concept sheet names) | Slag yard, Casting hall, Quench & press control gantry, Furnace ring | Reception & intake ward, Surgical theatre bays, Ceramic implant fabrication lab, Operating amphitheatre | Loading dock, Storage aisles, Sorting line, Retrieval hall |
| Hazards | Slag troughs, press plates, furnace heat ring around the boss | Spilled fluids, saw rigs in the amphitheatre | Pallet-jack lanes, collapsed shelving, stamping press, gantry cranes |
| Conditions | A: force lever. B: hack console | A: hack terminal. B: cloak-weave seal (the sterile corridor with sensors is also a cloak shortcut to the lab) | A: hack console. B: defib rack |
| Spawns | 51 | 48 | 55 |

Environment hazards are persistent damaging zones that also add heat (they reuse the telegraphed-zone system, drawn as grey-blue circles until art exists). New boss/elite attacks (all telegraphed): slag pools, ring pools with a gap, gas vents, saw lanes with a gap, crate fall, blink + riposte, scalpel fan, chain sweep, bite, slag shot, dart.

### 4.1 Loot and the orange rules

* Every new dungeon has its own loot pools (new hardware by manufacturer and level, plus five new chips: Ablative, Fine-Edge, Quench Coil, Overdrive, Grid-Link).
* **Level gating.** A drop whose level requirement exceeds the recipient is filtered, not rerolled downward (spec). A dungeon also has an item-level cap (`tierCap`); anything above the cap cannot drop there even for a high-level character.
* **Orange.** Six orange signatures, one per replacement boss, ordinary 8-10% chance, never guaranteed: Brannoch Anvil-Arm (Lv 28), Governor Core (28), GEMINI Autosurgeon Rig (32), Recovered Veil (32), R-0 Lifter Legs (24), and **Lazarus Rack (Lv 14, `authoredException`)**, the single new Easter egg orange outside the high-level band (spec: "small authored exceptions"). Everything else orange is Lv 20+ (tested).
* Orange cosmetics: animation-led, not particle-led (style guide). Not built; needs art.

### 4.2 Dungeon select, lockouts and contracts

* **Dungeon select** (Rustline gate): cards for each dungeon with level band, run length, areas, daily status, and live-instance info. A "show all" toggle controls the level-appropriate filter (default: only dungeons whose band contains your level, plus the one you have a live instance in). Entry is never level-gated (spec); under-level entry shows a warning that above-level gear will not drop.
* **Daily lockout is per dungeon.** Boss completion consumes that dungeon's clear; entry does not. One live instance at a time; re-entry, retention (24 h), expiry warning and loot retrieval all work as for the Annex.
* **Contacts & contracts** (press `C` in town or use the fixer): 14 contracts across nine contacts. Fixed goals and fixed credit/reputation rewards, 4 active at once, daily or once-only. Contracts never grant items and are never generated by the story model.

## 5. How content feeds the adaptive story system

* New event keys: dungeon events are recorded as `foundry:force`, `clinic:A`, etc. (Annex keys stay unprefixed for compatibility). New event kind `contract_done`.
* The bounded context lists the new approved contacts, nodes, arcs, facts and dungeon ids. The proposal's clue may carry a `dungeon` id; the validator rejects unknown dungeons.
* The offline mock provider reads the dungeon events and returns the clue for the augment route you actually used there (force → Foundry A, hack → Foundry B, cloak → Clinic B, and so on), names the contact, and offers up to three town options that boost approved arcs.
* Clues are stored per dungeon (`dclues`) and shown on the dungeon's terminals/levers and in the fixer board. Bosses, drops and access never depend on any generated text.

## 6. Assets that need art (everything is procedural placeholder)

See `docs/DUNGEON_ART_PROMPTS.md` for the full request list. Summary: per-dungeon floor/wall textures and set pieces (concept sheets in `public/dungeons/source`), all new enemy and boss sprites, hazard rendering (currently a generic circle), orange item animations and icons, contact portraits, and a hub-level noticeboard interaction for contacts. Also needs music identity per dungeon (spec: reuse manufacturer foundation plus a boss motif layer).

## 7. What is NOT in the prototype

Multiplayer/parties, real accounts, trading and mail, seasons, level-locked hubs other than Rustline, the 100+ hour curve, real LLM tuning, balance, and a persistent shared world. These are the roadmap below.

## 8. MMO roadmap (consistent with the technical brief: solo dev, small budget, no fabricated infrastructure)

Principle: **an MMO here means a persistent shared hub world plus private instanced 4+1 dungeons**, not an open-world server. That matches the specs (instances private by default, standard party of four plus one QR/code guest, no class or role requirements, any level may enter, host-based daily lockouts) and keeps cost near zero at zero players ("zero players is the planning baseline, not a requirement to support none").

| Phase | Goal | Notes (cost/scope discipline) |
|---|---|---|
| 0 (now) | Solo prototype, 4 dungeons, contracts, offline story mock | Local only. This repo. |
| 1 | Networking spike: 5-player instance on one hosted process | One container, started on demand, billing alerts, bounded LLM budgets. Pass/fail budgets first (60 FPS on a named phone, five-player load). Session authority chosen only after the spike (spec). |
| 2 | Persistent accounts, locker, character and lockout in a database | Authoritative, retry-safe transactions for XP, rep, currency, loot, lockout consumption (idempotency keys). Save format already separates config from saves. |
| 3 | Hub shards | Hubs are lightweight rooms (movement, chat bubbles, contacts, vendors) with a soft cap (e.g. 30-50). Shard auto-created when a hub is full; a party leader invites across shards. Ordinary farming areas are separate shards. Level-locked hubs gate hubs only, never dungeons. |
| 4 | Parties and invites | 4 players + 1 guest via QR/short code with explicit approval, scoped expiring tokens (spec). Personal loot, per-recipient level filtering (already implemented), full XP for carries. Host's lockout governs fresh runs; instance retention (24 h) on the host's record. |
| 5 | Economy | Currency pays installation (cost depends on the removed item), repair liability and cross-season mail only. No crafting or salvage materials (spec). Vendor discounts by manufacturer reputation rank (done in prototype). |
| 6 | Trading and mail | QR/code trades with both-sided confirmation, BoP account-bound / BoE tradeable until equipped, seasonal mail for earned currency subject to recipient level requirements. Duplication-proof ledger. |
| 7 | Seasons | Yearly. Fresh characters at the same ceiling, seasonal-only mechanics and the Audit slot rotation; purchases persist; migration policy decided with data (open). |
| 8 | More hubs and dungeons | Harrow Reach, Aldane Terrace, Kestrel Row as real hubs at fixed levels. Always-available ordinary farming areas; returning nemesis targets. Content is data-first (`src/content`) so a solo creator adds dungeons by writing layouts and tables. |

Explicitly out of scope per the specs: new classes, mandatory roles (tank/healer), pay-to-win, crafting, an open-world server.

## 9. Decision and ambiguity log

1. **Daily lockout scope.** Spec says "the host's daily dungeon clear" and "daily dungeons encourage rotation". Decision: one lockout *per dungeon*, so a day can include several clears across the rotation. Alternative (one global clear) is a one-line change. Open spec item: reset time/timezone (prototype uses local midnight).
2. **One live instance at a time.** The spec allows multiple retained instances nowhere explicitly. Prototype keeps a single instance slot; starting another dungeon requires abandoning or waiting for expiry.
3. **Level is not an entry gate** (spec) but the select screen filters to level-appropriate dungeons by default. Under-level entry is allowed with a warning.
4. **Item-level cap per dungeon** generalises the old global `DUNGEON_TIER_MAX_ITEM_LEVEL`. Hub 9 (rec. Lv 8-18) has cap 26 only so its high-level replacement boss can offer a high-level orange.
5. **Orange outside high levels.** One authored Easter egg only (Lazarus Rack, Lv 14). The Audit Core and Reclaimer Ripper (Annex, Lv 12) remain the older authored exceptions.
6. **Conditions are capability-gated** (hack/force/cloak/defib) and checked against installed hardware, not active effects, matching the Annex. "Cloak" does not require the cloak to be running.
7. **Replacement bosses stay in tier and keep reveals**, brain builds are never locked out (GEMINI is ranged, Warden precedent), melee gets recovery windows (Patient Eleven, Brannoch).
8. **Hazards are zones** (no new render code); the zone color is a placeholder. Environment hazards are cleared on boss death.
9. **Contracts** are deterministic, game-owned, credits/reputation only; the story system may only pick which contact speaks (spec: narrative cannot grant rewards).
10. **Zone slot names reuse the Annex set** (yard, proc, junction, boss, ...) so existing textures render; real names live in `zoneLabels`. New zone types arrive with their textures.
11. **Contacts UI location.** The town art has a noticeboard prop but the hub layout has no contact interactions yet; contacts open via `C`, the fixer, or any interact id `npc_<contactId>` / `contacts` (handled in `ui.ts`) once the hub places them.
12. **Boss HP and damage scale by dungeon tier** with per-enemy `dmgMul`. No balance is claimed; the 100+ hour curve is untouched.
13. **Story event recency.** Merged events now take a fresh id so "latest dungeon" selection is correct on repeat farming.
14. **Open from the specs, untouched:** daily timer anchor, reconnect windows, host departure, failed-run handling, guest reward reductions, seasonal migration, cross-world parties, mail limits.

## 10. What is next

1. Art pass per `DUNGEON_ART_PROMPTS.md`; hub placement of contact NPCs and a noticeboard.
2. Playtest balance for all three dungeons with builds A/B/C; confirm 5-10 minute runs and boss readability under reduced FX.
3. Per-dungeon music: reuse manufacturer foundations plus boss motif layers.
4. Networking spike (phase 1) and a persistent-account design review.
5. Level-locked hub unlocks and the fixed-level milestone table (needs the 100+ hour curve).
