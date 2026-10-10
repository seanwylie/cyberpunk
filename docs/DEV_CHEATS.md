# Dev cheats (dev only)

## `idkfa`
Type the letters **i d k f a** in sequence (desktop keyboard; works in town and in runs; ignored while typing in text inputs).
Runs `Game.cheatIdkfa()`:
- Equips orange hardware in all 11 body slots (signature items where they exist: Reclaimer Ripper, Autosurgeon Rig, Recovered Veil, Governor Core, R-0 Lifter Legs; `idkfa_*` Apex items from `src/content/idkfa.ts` for hands, feet, left leg and face). The set has no hard conflicts.
- Fully sockets every slot with the best chips (`IDKFA_CHIPS`).
- Previously equipped items stay in storage; nothing is lost.
- Raises level to at least 30, credits to 99,999, stims to 20 (10 carried in a run), clears the repair bill and broken slots, fully heals.
- Toast "IDKFA: best gear equipped".
- Sets `save.cheated = true` and appends to `save.cheatLog`. **Leaderboards / MMO / seasonal systems must ignore saves with `cheated`.** The flag is never cleared.

Note: the typed "i" also toggles the inventory panel, and "f" is the interact key.
Test: `node tests/idkfa.mjs`.
