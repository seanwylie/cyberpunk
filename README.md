# Annex Runner — isometric cyberpunk loot-ARPG prototype

First playable web prototype built from the spec set (Primary Requirements v3 as authority; handoff, UX/controls, dungeon & builds, technical brief, art, audio, inventory, progression, story docs). It is a **vertical slice for the "small first playable"**: responsive landscape-mobile + desktop combat, the **Reclamation Annex** run (yard → processing floor → junction/objective → boss), personal loot with a minimal mission inventory, and a small town with the body/locker workspace. Everything is local: **no paid services, no keys, no backend**.

## Run it

```bash
npm install
npm start            # dev server (http://localhost:5173), single command
# or
npm run build && npm run preview     # static build in dist/ (relative base: host from any folder/static host)
npm run typecheck
npm test             # headless-Chrome e2e/gate test (needs dev server running on :5173, uses system google-chrome)
npm run shots        # regenerates screenshots into shots/ (desktop + 844x390 touch)
node tests/bot.mjs A 900   # naive bot playthrough with build kit A/B/C (pacing sanity check only)
```
`tests/lib.mjs` uses `playwright-core` with `/usr/bin/google-chrome` (override with `CHROME=/path`; `URL=` to test a preview build). Open on a phone via the `--host` LAN URL; rotate to landscape. It is installable/“add to home screen” (manifest only, no service worker yet).

## First 2 minutes
1. Town: walk to the **Outfitter/Locker** (F). Press `` ` `` (backtick) or Menu ➜ DEV tools ➜ **“Grant + equip (free)”** for build A/B/C (the three example builds: ripper+cooling, cloak+blade, neural-control+refurbished). *These are test shortcuts that grant items, not saved presets.*
2. Walk to the **Annex gate** ➜ Start fresh run.
3. Fight through the yard (kill both gate turrets to open the gate), the processing floor (Sawhand elite), reach the junction, press F at the controller, enter the boss chamber.

### Controls
| | Desktop | Landscape mobile |
|---|---|---|
| Move | WASD / arrows (screen-relative) | floating joystick on left 46% (fixed option in Settings) |
| Basic attack | automatic on the closest eligible enemy in range | same |
| Manual target | click enemy (X / right-click clears) | tap enemy |
| 3 abilities | **hold** Q/E/R (or 1/2/3) to aim at the cursor, **release** to cast | press & drag from the ability button, release to cast; drag far away to cancel |
| Dodge | Space (one button, no direction) | big button |
| Interact | F (explicit press, never hold) | Interact button appears near things |
| Town return | T (5 s channel, interrupted by movement/damage) | “Town” button |
| Live pack/compare | I / Tab | “Pack” |
| Stim | H | “Stim” |

## What is implemented
- **Combat**: auto-attack with closest-enemy targeting + manual override (kept until target dies/invalid/cleared); three aimed abilities with validity by aim type (self / direction / ground / target / ally) – invalid release cancels with **no heat or cooldown**; valid cast commits heat+cooldown at effect start; one-button dodge (short cooldown, i-frames) that **always cancels aiming and in-progress casts, even on cooldown**; shared **heat** with overheat (abilities offline, slowed, weapons weaker) and cooling; stationary heavy weapon (Slug Driver); only elites/bosses have health bars; damage numbers off by default; enemy telegraphs (cone/circle/line/aim/fan, ground zones) drawn with highest visual priority.
- **Body/build**: all 11 slots from the start, fixed chip capacity per slot, 30 hardware items across Heavy Industrial / Precision Surgical / Mass Market, 10 chips with stat and ability-behaviour effects (e.g. Speed chips raise ripper damage), manufacturer mixing penalty (reduced by reputation rank) and hard conflicts (ripper vs Veil torso), capability gating (force / hack / cloak / defib), level-gated installation.
- **Town workspace**: body diagram + searchable storage, **staged chip draft with live preview** (stats, heat/cooling, abilities, manufacturer penalty, conflicts) and explicit **Apply**; hardware replacement is a separate **cost-confirmed** action (shows cost, lost/gained abilities, compatibility change; cost depends on removed item rarity, small rep discount); free storage sort/search and explicit grey-item sale; vendor (repair bill, sell, stims); simulated purchases (locker capacity + skin entitlements only); Fixer (story).
- **Reclamation Annex**: handcrafted rooms assembled in code (`src/level.ts`), objective + boss, optional salvage room (foreman elite + chip cache), checkpoints (entry + junction). **Three ways through**: brute force (kill turrets → gate; kill Sawhand → lock), hack (relay reroutes the junction lock; terminal), cloak (maintenance passage with sensors – uncloaked triggers an alarm wave; cloaked reaches the junction flank), force (ripper opens the armory shutter, fuse). Combat route always exists.
- **Boss selection**: first confirmed condition wins, conflicting selector is disabled and says so. Terminal “audit command” (hack) ➜ **Neural Warden** (disruption zones, volley). Armory fuse (force) ➜ **Reclamation Enforcer** (ripper sweep, charge, recovery “OPENING” window). Otherwise **Annex Overseer** (slam, charge, summons). Signature drops (Audit Core / Reclaimer Ripper) are ordinary 12 % chances. **Boss reveal**: ~9 s every attempt (never shortened), movement and camera free, player and boss both invulnerable and projectiles cleared; boss rises from the floor; music enters a drum-free reveal state then releases into boss combat.
- **Personal loot**: per-recipient drop rolls, **level filter without downward reroll** (ineligible items simply do not drop), 16-slot mission pack (one slot per item, chips/stims stack), proximity auto-pickup radius increased by Magnet chips, higher-rarity priority when space is scarce, full pack leaves loot on the ground with a marker and never evicts, rarity-scaled drop animation (grey none → orange rotating machinery), credits.
- **Failure/sustain**: downs break one random (non-stock) hardware piece and add to the repair bill; broken hardware loses its abilities/chips/benefits; basic attack and dodge always remain; **Return to checkpoint** restores hardware (bill kept; restored hardware protected from re-breaking for the rest of that run); touching a checkpoint pad also restores; **Self-defib** (Defib Rack) revives in place but hardware stays broken (90 s limit); stims.
- **Town return & retention**: channel interrupted by movement/damage (no invulnerability); unload into locker; re-enter the **same instance** at its entry – dead boss, surviving enemies, uncollected loot, doors/objective flags persist; **24 h instance timer** with HUD countdown, 30-minute warning, expiry deletes leftover loot; daily lockout consumed once at boss kill (re-entry is separate from fresh runs); completion rewards guarded so re-triggering cannot duplicate them.
- **Solo interruption/suspend**: autosave every 4 s, on tab hide and `pagehide` (localStorage). Reload restores instance, loot, pack, flags.
- **Adaptive story (stubbed LLM)**: `src/story.ts` — game-owned relationship graph and recorded events ➜ bounded context ➜ `StoryProvider.propose()` ➜ strict **validator** (ids from an approved registry, no reward/mechanic promises, bounded sizes) ➜ persisted accepted proposal ➜ clues surfaced at the terminal/armory and Fixer dialogue + occasional town choice that boosts an arc. Runs outside combat; rejection/outage keeps the previous story. Default provider is the offline **MockProvider**; an optional OpenAI-compatible HTTP provider can be enabled in Settings (URL/key/model stored only in localStorage). It was **not** exercised against a real model (no keys available), and no unauthenticated real provider exists, so the brief's “real LLM early” gate is *open*.
- **Audio** (procedural WebAudio, original synthesis): traversal lo-fi trance/techno, drum-and-bass combat with punctuated transition (dropout + accent) and hysteresis, boss reveal breather + motif, boss combat variant, resolution; distinct per-manufacturer death cues, telegraph warnings (elites double-pulse), ability/weapon sounds, restrained purple/orange loot cues; concurrency capped.
- **Presentation**: procedural Canvas2D isometric renderer, bleak industrial palette (concrete, soot, bone, oxidised metal; manufacturer accents oxide-red / slate-blue on ivory / olive), no neon. Hardware visibly replaces body parts by manufacturer colour. Walls fade when covering the player. Gore Off / Standard / Bloody Mess affect presentation only. “Reduce incidental effects” toggle.

## Stubbed / not implemented (explicit)
- **Multiplayer**: no networking, party, fifth-guest QR/code, trading, mail, disconnect/rejoin. The conditional **support panel** exists (shows 4 party slots + guest, “no teammates (solo)”) and the Team Revival ability is correctly inert when solo. Spec gates for 5-player load, latency, reconnect are **untested**.
- **Real LLM**: interface + validator + mock only (see above).
- **Seasons, reputation sources beyond kills, 100+ h XP curve, hubs/milestones, cosmetics rendering, real checkout**: placeholders (`config.ts`): level cap 60, `xp = 60·l^1.45`, rep ranks at 10/30/60 points. Purchases are entitlement records (locker +20 slots, skin ids).
- **Pickup filters, presets, crafting**: intentionally absent (spec exclusions).
- **Real devices**: not run on physical phones; 60 FPS verified only in headless Chrome (software GL) at 1280×720 (≈60 fps reported by `window.__fps`). Treat as unproven for the mobile gate.
- Art is procedural placeholder (no 3D, no PlayCanvas); animation is minimal; no pause/gamepad/rebinding UI.

## Decisions I made (and why)
| Topic | Decision |
|---|---|
| Engine | **TypeScript + Canvas2D isometric projection + Vite** instead of PlayCanvas/3D. Fast to build overnight, zero cost, runs everywhere. Simulation (`sim.ts`, `build.ts`, `config.ts`) is renderer-independent so it can move to PlayCanvas/Unity later. The brief says engine choice is provisional and a PlayCanvas spike is only the first *evaluation*, so this is a documented deviation. |
| Mobile aiming | Direction/ground abilities need a drag > 16 px (a quick tap on a directional/ground/target ability cancels – the spec says not to assume tap auto-casts). Self abilities (brace, cloak…) cast on release. Dragging >170 px away from the button cancels. |
| Dodge | 1.1 s cooldown, 0.22 s dash, 0.34 s i-frames, direction = current move input else facing. Pressing dodge on cooldown still cancels aiming/cast but doesn't dash. Cancel before the effect point is free; after it, heat/cooldown stay spent. Commit point = effect start (end of windup). |
| Casting | Movement continues at 60 % speed during windup; casting grants no protection. |
| Heat | Max 100; overheat at 100 → abilities blocked, move ×0.8, weapon ×0.5 damage/rate until heat < 35. Passive cooling 9/s × cooling stat. Ability heat is committed at effect start; casting can push you into overheat but cannot be started while overheated. Forced Cooling vents 70 heat and takes weapons offline 2 s. |
| Ability binding | First three abilities by slot priority (arm R, arm L, hand R, hand L, torso, brain, …). Extra abilities are shown as “unbound” in the preview. Defib is a passive. |
| Elites & control | Elites/bosses resist Enemy Control (1.5 s stun). Controlled mobs fight for you 8 s (+chips). |
| Cloak | 5 s; enemies lose you unless within ~1.7 tiles; first attack deals 2× and breaks it. Detect radius is ×0.18 while cloaked. |
| Hack/force interactions | Explicit press, then a 1.5 s vulnerable channel (hack only) – damage/dodge/movement interrupts. Force actions are instant presses. Without the capability the prompt explains why; combat route still works. |
| Terminal/armory arbitration | First confirmed condition locks the boss; both selectors then display the lock. Selection locks in at confirmation (not only at boss entry). |
| Boss reset | Living boss is reset (removed, flag cleared) when you re-enter the instance, return to a checkpoint after a down, or stay out of the boss room > 6 s – so **every attempt replays the full reveal**. |
| Hardware swap & chips | Chips on replaced hardware return to locker stock (not auto-transferred). Install cost = cost for *removed* rarity (grey 0 → orange 2500) with ≤15 % reputation discount. |
| Daily lockout | Local calendar day; consumed once at boss kill. Existing instances can be re-entered until the 24 h timer (anchored at instance creation) ends, including after completion. Dev button resets it. |
| Re-entry point | Always the entry, so loot retrieval means running back through surviving enemies. Boss resets on re-entry. |
| Starting state | Level 12, 600c, every slot has grey “Standard Issue” (baseline, not empty). Dungeon item tier cap = 20; Audit Core / Reclaimer Ripper are orange but level 12 – flagged `authoredException` (spec allows small authored Easter-egg exceptions). Level-5 characters get 0 purple/orange. |
| Consumables | Up to 2 stims move from locker to the mission pack at run start (1 slot). |
| Balance | All numbers are placeholders in `src/config.ts` (units: tiles, seconds, HP). A perfectly efficient bot clears the main path in ≈90 s (builds A/B); a human with exploring/optional rooms should land nearer the 5–10 min target but this is **not measured**. Build C (stationary slug driver) is not solved by the naive bot – needs real playtest tuning. Boss HP/telegraphs are first-pass. |

## Spec ambiguities / contradictions noticed
1. Supporting docs still reference Primary Requirements **v2**; used v3 as instructed. UX doc says ability bindings, dodge-on-cooldown, tap behaviour are open – decided above.
2. “Hardware lock before entering” vs “Pack inspect/compare” – compare allowed live, installs only in town.
3. Purple/orange “only high level” vs signature boss augments (orange) in a mid-tier dungeon – handled with `authoredException` items at level 12.
4. Arm vs hand slots: ripper arm gives the sweep ability while the **cutting head (hand R)** provides the basic attack (attachment convention test from the builds doc). Blade-ended arm vs scalpel hands handled the same way. Needs art/rig validation.
5. “Sustain from hardware, chips, consumables” – hardware regen/Stims/Sustain chips; no field repair (spec leaves it open).
6. Tech brief demands a *real* LLM early; without credentials this prototype cannot satisfy it. The provider interface is the seam.
7. Brief says 3D world (PlayCanvas candidate); delivered 2D iso renderer (see decisions).
8. Handoff says don’t invent balance values; numeric values here are scaffolding, clearly isolated in `config.ts` (version `0.1.0-proto`). No schema validation / version history yet.
9. “Reputation attainable through specified kills/areas” – only kills (+8 for elites, +25 bosses) implemented.
10. Boss reveal “player damage to boss during reveal” is open – decided: boss untargetable and invulnerable during reveal.

## Code map
`src/config.ts` data (items, chips, abilities, enemies, loot, progression) · `src/build.ts` stat/ability/penalty derivation (also used by the locker preview) · `src/sim.ts` game state machine, combat, AI, loot, instance lifecycle · `src/level.ts` Annex + town layouts · `src/render.ts` iso Canvas renderer · `src/input.ts` keyboard/mouse/touch · `src/ui.ts` HUD, dialogs, locker/vendor/gate/fixer/store/settings/dev panels · `src/audio.ts` procedural music/SFX · `src/story.ts` story graph, providers, validator · `src/state.ts` save model (localStorage, key `arpg-proto-save-v1`).
Debug hooks: `window.__game`, `__ui`, `__rend`; `game.dbg.god/oneShot` for tests.

## Test evidence (`npm test`)
~50 assertions on the real objects in headless Chrome, including: gates/locks, force/hack routes and boss arbitration, boss reveal damage-free + full length + music state, completion consumed once, loot/pickup, town channel interruption, instance persistence across town trip and **page reload**, invalid-aim cancel costs nothing, dodge cancels windup, heat/overheat, level-filter, full-pack behaviour, down/checkpoint/repair-bill rules, staged-draft/Apply, mock story, validator rejection, provider outage. Screenshots in `shots/`.


## Universe & dungeon pack (v0.2)

Lore bible, factions, recurring cast, districts, season-1 framing, MMO roadmap and the decision log: **`docs/UNIVERSE.md`**. Art requests: `docs/DUNGEON_ART_PROMPTS.md`. Concept sheets: `public/dungeons/source/`.

**Dungeons** (all from the town gate, `Dungeon gates`; the select screen filters to your level band by default, tick "Show all" for every dungeon; entry is never level-gated):

| Dungeon | Level band | Replacement bosses |
|---|---|---|
| Reclamation Annex | 10-20 | hack terminal -> Neural Warden; force armory fuse -> Reclamation Enforcer |
| Kestrel Distribution Hub 9 | 8-18 | hack order console -> Retrieval Unit R-0; defib cradle -> Returns Reclaimer |
| Harrow-Brandt Foundry Line 7 | 18-30 | force interlock -> Ladle-Tyrant Brannoch; hack console -> Governor ORE-9 |
| Aldane Ward 9 Clinic | 22-34 | hack terminal -> GEMINI Autosurgeon; cloak seal -> The Recovered |

* Each dungeon has its own daily lockout (boss completion consumes it), its own loot pools and item-level cap, hazards, named elites, and orange signatures (level-gated; one authored Easter egg, Lazarus Rack).
* **Contacts & contracts:** press `C` in town (or talk to the fixer). Nine contacts, 14 deterministic contracts (credits and reputation only). Contract progress and dungeon events feed the story mock.
* **Dev tools** (backtick): "Grant all dungeon-pack hardware", level presets (12/20/26/30/34), reset lockouts. To see the orange rules in action set level 34, then farm or call `__game.dropEntry({item:'sig_anvil_arm',w:1},__game.px,__game.py)`.
* Data lives in `src/content/` (`dungeons.ts`, `enemies.ts`, `items.ts`, `npcs.ts`); adding a dungeon is a layout builder plus a registry entry.
* Tests: `npm test` runs `tests/smoke.mjs` and `tests/dungeons.mjs`. `node tests/dungeon_shots.mjs` captures screenshots into `shots/dungeons/`.


## Credits

With Big Viking Games. The Big Viking Games logo (`public/brand/`, original from bigvikinggames.com plus an unaltered light-tint version for dark UI) is a mark of its owner and appears as a neutral credit only; it implies no endorsement.
