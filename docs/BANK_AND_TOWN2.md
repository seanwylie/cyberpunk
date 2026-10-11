# Bank and Town 2 (Harrow Reach) — design

Status: Phase 1 design (this doc), Phase 2 Bank (implemented in `src/bank.ts`, `src/bankui.ts`, `tests/bank.mjs`), Phase 3 Town 2 (see section B; status at the bottom).

Why: the locker is a *workspace* (equipped body, chip sockets, staging) but it is also the only storage (60 slots + 20 per purchase), so loot clutters it, the pack overflows after a run, and "should I keep this?" pressure sits on top of the upgrade UI. A bank takes long-term storage out of the workspace. A second town gives progression a place to go, not just a number.

---------------------------------------------------------------------------------------------------

## A. The Bank

### A.1 Role split
| Place | Holds | Rules |
|---|---|---|
| Pack (instance carry) | what you picked up this run | lost with the instance (existing rule); auto-banked on return |
| **Locker** | equipped loadout, chip sockets, the *staging* set you are about to try (default 60 slots, +20/purchase) | unchanged UI; no longer the overflow sink |
| **Bank** | long-term items and chips, credits vault | town only, large, tabbed, searchable, safe from run loss |

The locker keeps working exactly as before (tutorial and recommendations are unaffected). The bank is an additional station.

### A.2 Station (follows the town-layout rules, `src/stations.ts`)
* Name **Bank** ("Rustline Mutual Deposit"), prompt `Bank: store gear and credits`, interact id `bank`, opens modal `bank`.
* Distinct landmark: a squat riveted vault door with a ticker sign, brass/gold accent (`#e8c45a`) which is not used by any other station (amber `#ffb02e` is the job board, so the bank uses a paler brass-yellow and a vault-door icon with a keyhole ring). Icon `bank` = vault door circle with spokes.
* Placed at least `MIN_STATION_DIST` (11 tiles) from every other station interact point; a minimap marker and the offscreen station arrow come for free from the station registry.
* Ambient: slow rotating status light. Cheap (no particles).

### A.3 Storage model (`Save.bank`)
```
Bank { v:1; tabs:number (unlocked, 2..6); credits:number; entries:BankEntry[]; }
BankEntry { id; tab:0..5; item?:Inst  |  chip?:ChipId, n?:number }
```
* **6 tabs x 60 slots**, 2 tabs open at the start (120 slots). Tabs 3..6 are bought with credits: 400 / 800 / 1,400 / 2,200 (total 4,800c). "Expandable with credits" = more tabs, not a pay-wall (credits only).
* An item takes 1 slot. A chip *type* takes 1 slot per tab and stacks without limit (chips are fungible).
* Entries live in the player's save, not the instance, so the whole bank survives instance expiry, abandon, death, and checkpoint restarts.
* Tabs are free-form but have a sort/auto-tab helper: "Auto-sort tab" orders by slot, rarity, name.

### A.4 UI (`src/bankui.ts`, hooks in `ui.ts` through one `bk-` action prefix)
* Layout: left = bank grid (tab strip, search, filters, sort), right = your locker contents (what you can deposit) and the credits vault panel. Same `.slot.tile` icon tiles with rarity colour, `data-tip` tooltips, `fit` text, and the responsive/scrolling rules of the locker.
* Click a locker tile = deposit; click a bank tile = withdraw (withdraw needs a free locker slot; if the locker is full the tile explains why). Shift-click or "x5" for chip stacks.
* Search (name / slot / manufacturer), rarity filter, type filter (items/chips), sort (slot / rarity / name / newest).
* Bulk rules (buttons, not hidden automation): **Deposit grey** (unequipped grey hardware), **Deposit spare chips** (keep 2 of each in the locker), **Deposit all stored items**, **Withdraw tab matches** (everything matching the current filter that fits the locker).
* **Credits vault**: deposit/withdraw 100 / 1,000 / all. No interest (by design: safekeeping, not an economy lever).
* Mobile: bottom-sheet panel, 44px targets, grids collapse to 5 columns.

### A.5 Protection rules
* Bank contents and vault credits are never touched by: dying/downed, abandoning or expiring an instance, checkpoint restart, repair bill collection (repairs use the wallet only), and daily lockout resets. A test performs those flows and compares the bank byte-for-byte.
* Wallet credits are already outside the instance (only the *pack* is at risk); vault credits are additionally exempt from any future death tax or repair auto-debit, so the intended future mechanic ("lose a % of wallet credits on death") has a safe place to hide them.
* **MMO note**: `Save.bank` is deliberately one self-contained block with `v`. In the MMO roadmap (UNIVERSE.md section 8) it becomes the **account-level shared bank** (all characters on an account), with the locker staying per-character. Entries use opaque `Inst` records with unique uids, so merging into an account store is a copy. Trade/mail/guild bank layers would sit above the same entry type. Cheat-flagged saves must not merge into an account bank.

### A.6 Integrations
* **Clutter fix**: returning to town (`bankCarried`) puts overflow that does not fit the locker into the bank instead of leaving it stranded in the instance. Vendor purchases that would overflow the locker are not blocked when a bank exists: they offer "Send to bank".
* **Save migration**: on load, a save without `bank` gets an empty bank; if the locker is over capacity (legacy overflow), the lowest-value surplus (grey, then green; never equipped) moves to the bank. Idempotent.
* **Recommendations**: the engine also evaluates bank items and chips; an upgrade found only in the bank appears as a "Bank hint: <item> would give +x% DMG, withdraw at the bank" line (never auto-applied, because it needs a withdraw first). Existing recommendation behaviour is unchanged.
* **Vendor sell**: unchanged; the vendor sells only from the locker. Bank items are sold after withdrawing (prevents accidental sales from long-term storage).
* **Tutorial**: optional, skippable, non-gating "Bank" aside after step 10 (a tip card). Existing 10 steps and the reward stay identical.
* **Settings/idkfa**: idkfa old-gear dump continues to the locker, overflow lands in the bank.

---------------------------------------------------------------------------------------------------

## B. Town 2: Harrow Reach

### B.1 Lore fit
UNIVERSE.md section 1.2 already names Harrow Reach as the *larger foundry-district hub, unlock TBD*, west of Rustline Market, home of Foundry Line 7 and contacts Ten Hallowell (fixer) and Rhea Dunmore (Harrow reclaim liaison). Town 2 is that district, made real:

* **Harrow Reach — "the Cinderworks"**: terraced foundry town built into cooled slag banks under a dead stack. Colour language: oxide red and gunmetal, banked furnace orange as the light source, steam. Different from Rustline (tarp, cobble, wet teal/amber): bigger industrial forms, riveted plate ground, slag glass, chain gantries, hazard stripes, rust and forge glow. Still **no neon**; accents restrained per the style guide (Harrow oxide red `#8f3b2e`).
* Factions: **Harrow-Brandt Heavy Works** (owner/landlord, reclaim counting), the **Line 7 Retirees' Guild** (independent shift veterans, the "horn that will not stop" subplot), **Pell's Second-Hand Dock** (Rustline independents with a stall here).
* Stations (all in the station registry, 11+ tiles apart): Job Board (Ten Hallowell), **Heavy Works Parts** (higher-tier hardware: blue/purple HI stock, level 18+), Reach Savings **Bank branch** (same shared bank), **Forge Repair** (cheaper repairs for HI gear), Locker access, a unique faction vendor (**Guild Reclaim Counter**: sells chips and the rare reclaimed-chip bundle for Harrow reputation), and the **Transit Platform** back to Rustline.
* NPCs: Ten Hallowell, Rhea Dunmore, a guild retiree, foundry porters, two guards.

### B.2 Unlock and travel
* **Unlock**: clear any Tier II dungeon *or* reach level 20. Saved as `Save.towns.harrow.unlocked`. (Backfilled for saves that already satisfy it.) A one-time toast and a dialog line from Odalys announce it.
* **Travel**: a new Rustline station, the **Transit Gate** ("Reach Line tram"), opens the **Travel** screen listing towns (Rustline Market, Harrow Reach) with lock state and the unlock condition. Harrow has a matching Transit Platform. Travel is free, instant, blocked while a live non-finished instance is active? No: instances are separate from towns and travel is allowed; the instance stays resumable at either gate.
* `Save.town` stores the current town; `enterTown` builds that town; death/return puts you in the town you started from.
* Fast travel between towns is always possible once both are unlocked (the Travel screen is also reachable from each town's transit station only; no remote travel from dungeons).

### B.3 Content gating
* Rustline gate: tier I and II dungeons plus the original four. Harrow Reach gate: all tiers, and **Tier III and IV dungeons are only selectable from Harrow Reach** (the gate card in Rustline shows "Take the Reach Line to Harrow Reach to access Tier III-IV"). Harrow vendor stock and Guild rewards are level-gated 18+.

### B.4 Art and music
* Distinct ground set (slag plate, riveted deck, ember cracks, gantry grating), props (furnace tower, slag cart, chain gantry, hazard barrier, bank vault building, tram platform), signage per station colour using the station registry, baked static ground and cached sprites (same pipeline as Rustline: `tools/town/`, scaled cache, one baked ground canvas, a handful of animated emitters), minimap markers from the registry.
* Music: 3 new calm tracks (`town_harrow_a/b/c`), mapped through `music.ts` to the Harrow town state; Rustline tracks unchanged.
* Budgets: same as Rustline (`tests/townperf.mjs`), mobile tiers unchanged (Low/Medium skip emitters).

### B.5 Implementation plan
1. Bank first (this doc's section A), pushed on its own.
2. Town data model: `src/towns.ts` (town defs, unlock rule, travel), `src/town2.ts` (level builder + station list + art manifest), `public/town2/*` art, `tools/town/*` scripts, `src/travelui.ts`.
3. Hooks: `Save.town/towns`, `enterTown(townId)`, gate filter by tier, music state, renderer art base.
4. Tests: `tests/bank.mjs`, `tests/town2.mjs` (unlock flow, reachability, min distances, travel, gating, perf), plus existing suite.

---------------------------------------------------------------------------------------------------

## Status log
(appended as phases land)

### Phase 2 (Bank) status: implemented
`src/bank.ts` (pure logic), `src/bankui.ts` (modal), hooks in `ui.ts`/`sim.ts`/`state.ts`/`recommend.ts`, `tests/bank.mjs` (in `npm test`), `tests/bank_shots.mjs` (shots in `shots/bank/`).
Done: 6x60 tabs (2 open, 4 buyable), item/chip deposit+withdraw, search/type/rarity/sort, bulk deposit grey / spare chips / all, withdraw matches, auto-sort, credits vault, overflow-to-bank on return, migration, bank hints in recommendations, persistence, death/abandon protection test.
Not yet: the world station (landmark/sign/icon) is added once the town-layout station registry lands on main; tutorial tip card (optional) not implemented; vendor "send to bank" purchase flow not implemented.
