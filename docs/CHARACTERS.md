# Multiple characters

Sean's decision: **10 characters per account, selectable on load.** Character creation is free.

## Where things live

| Data | Scope | Stored in |
|---|---|---|
| Level, XP, credits, traits + trait action log, equipment, inventory, locker chips, bank, reputation/faction, story + journal, contracts, lockouts, IDKFA snapshot, instance | **Per character** | `wv_char_<id>` (full `Save` JSON) |
| Cosmetic unlocks (owned/seen, saved outfits), purchased locker capacity (`purchases.lockerBlocks`), premium skins owned, store receipts/tiers, settings | **Account-wide** (persist across seasons) | `wv_roster_v1.account` |
| Roster: id, name, level, trait ids, created/last played, active id | Account | `wv_roster_v1` |

`arpg-proto-save-v1` (the old single-save key) is kept as a **mirror of the active character**, so every system that already reads/writes the save keeps working unchanged. `persist()` writes the character key, the mirror and the roster's account block in one go; `load()` overlays the account block onto the character save (purchases merge as max/union so nothing bought is ever lost). Equipped cosmetics are per character; ownership is shared.

Code: `src/chars.ts` (storage, pure), `src/charselui.ts` (modal `chars`), hooks in `src/state.ts`.

## Migration

First boot after the update: no roster exists, so the existing save JSON is copied **verbatim** into character 1 ("Runner 1"), and its purchases/cosmetics/settings are lifted into the account block. Nothing is rewritten or dropped. A legacy custom party name (`wv_name`) becomes character 1's party name.

## Selector

- **Shown on every boot** (in town), before the tutorial (the tutorial card stays hidden while the selector or naming screen is up).
- **Naming gate:** a character must have a real name before entering the world. A first-time player, or any existing character still named "Runner N" / empty, gets the naming screen: no Close/Escape, other windows refuse to open, Start only accepts 2-16 letters/numbers/spaces (placeholders like "Runner 2" or "Guest" rejected), **Random** suggests a cyberpunk name.
- **Multiplayer:** placeholder names never reach other players. The server (`cleanName`) turns "Runner N"/"Guest" into an empty name, and remote views draw no nameplate for an empty name; system lines say "A player".
- Each card: live model preview (own body + worn cosmetics, idle, slowly turning, one rAF at ~15 fps), name, level, last town; details in the tooltip.
- `+ New` asks for a name (16 chars max) and starts a fresh character at **level 1** (`PROGRESSION.startLevel`) with the Standard Issue stock kit. Hidden at the 10-character cap.
- Delete asks you to **type the character's name**, then click the red **Delete** (Keep cancels). Deleting the active character switches to the next one; deleting the last one leaves a fresh character (naming again). Account purchases are never deleted.
- In-game menu (Settings) has **Switch character** under the tabs: town only (disabled with a tooltip in a run; the selector also refuses to open in a run). Also Settings > Gameplay > Characters.
- Switching persists the current character and reloads the page.
- Tests: `tests/charsel.mjs` (boot, first-time naming, create/switch/typed delete, cap, menu). Every other test opts out of the boot selector via `wv_nocharsel` (tests/lib.mjs).
- Existing saves are not touched: the migrated character keeps its stored level, gear and traits.

## Multiplayer identity

Party display name is per character: a custom name typed in the party panel is remembered for that character (`wv_name_<id>`), otherwise the character name is used. Level/look sent to the server come from the active character's save. The story proxy player id (`wv_story_pid`) stays **account-wide** on purpose so AI rate limits cannot be multiplied by making characters.

## Tunables / open items

- `CHAR_LIMIT = 10` (`src/chars.ts`).
- Seasonal characters: **open** (TBD). Characters and their traits persist; account-wide unlocks persist across seasons.
- Characters are local to the browser profile until accounts exist.

## Item transfers (account mailbox)

There was no mail system, so transfers use a minimal **account mailbox** (`src/mail.ts`, modal `mail`, opened from the **Bank > Mail** button):

- Only **unequipped locker items owned by the sending character**. Equipped items, IDKFA cheat gear and anything that is not an item are refused.
- **Traits are never transferable**; they are not items and stay with their character.
- Socketed chips are **not** sent: they return to the sender's locker stock (chips are a per-character resource).
- The receiver claims into their locker. Claiming needs the item's **level requirement** and free locker space; until then the mail waits (shown as Locked with the reason in the tooltip).
- Mailbox cap: 50 (`MAIL_MAX`). Mail to a deleted character goes back to its sender.

## IDKFA

The IDKFA snapshot lives in each character's save, so the cheat is **per character**: turning it on for one character never touches another, and the `cheated` flag is per character too.

## Build export

Exports (JSON, code, link, text) include the character's confirmed traits (`traits: [L10, L20]`). The inspector shows them as short chips with the effects in the tooltip. Trait definitions are part of the catalog snapshot, so an old build link reports trait changes ("What changed"): changed effects, renames, removed traits (Incompatible) and level 20 traits that no longer build on the level 10 one.

## Early game (levels 1–10)

New characters start at level 1, so the level 1–10 band is real content (Oct 2026 pass):

| Level | Where | What |
|---|---|---|
| 1–10 | Reclamation Annex (tutorial dungeon) | Calm start, ramped first encounter; general pool drops from Lv 1 (grey/green Lv 1–5, common ability augments from Lv 1) |
| 3–14 | Kestrel Distribution Hub 9 (Neon Mile) | Ordinary drops re-levelled to Lv 2–7 so it pays out early |
| 8–24 | Tier I batch dungeons (Scrap Gantry, Substation 12, Tailings Pit, Slag Ovens) | Sealed teaser until Lv 4, enterable from Lv 8 |

Vendors filter by `lvl <= level`, so a level 1 character sees the Lv 1–5 stock. Common ability augments start at Lv 1 (`LVL.grey` in `src/abilities/hw.ts`), so the tutorial's guaranteed ability augment exists at level 1.

**Early-band scaling** (`Game.earlyMul()` in `src/sim.ts`): in level 1–10 dungeons (`minLevel < 8`: the Annex and Hub 9), enemy HP and damage dealt to the player scale from 0.5x at Lv 1 linearly to 1x at Lv 12. Bosses take an extra square-root factor (about 0.35x at Lv 1), because the stock kit has no burst. Before this pass, even a level 12 stock kit lost to the Annex Overseer. The scale is never above 1x and never applies outside those dungeons, so every level 12+ fight is unchanged. `tests/level1_start.mjs` checks the band coverage, early gear per slot, and headless clears (stock kit Lv 1/3 Annex, mid kit Lv 8 Hub 9).

