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

- Shown on load when the account has **2+ characters** (with one character there is nothing to choose, so the game loads straight in), or with `?chars` in the URL.
- Always reachable from **Settings > Gameplay > Characters**.
- 10 slots; `+ New` asks for a name (16 chars max) and starts a fresh character (stock gear, start level from `PROGRESSION.startLevel`).
- Delete needs a second click on a red **Delete** (Keep cancels). Deleting the active character switches to the next one; deleting the last one leaves a fresh character 1. Account purchases are never deleted.
- Switching persists the current character and reloads the page (all systems boot cleanly on the new save).

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
