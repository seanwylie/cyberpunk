# The city remembers you

Headline system. It ties three existing pieces into one loop that players see in their first session:
nemesis bosses (`docs/NEMESIS.md`), NPC memory (`docs/NPC_MEMORY.md`) and the living city news (`docs/LIVING_CITY.md`).

## The loop
1. **An elite or boss kills you, or you run from one.** The first time this happens, it always becomes a nemesis (`NEM_CFG.firstAlways`). After that, the normal odds apply.
2. **It remembers.** `src/nemesis.ts`
   - **Scars:** if you took at least 25% of its hp, it carries a scar from your main damage type (Bullet-pocked, Stitched, Arc-burned, Scorched port). Scars show on its nameplate and card, max 3, and change looks and words only.
   - **Reading your build:** `readKey()` notes your hacks, burst, kiting or damage type. Lost limbs take priority: any limb system can fill `save.limbs.lost = ['armL', …]`. Its next taunt references what it noticed.
   - **Adapting:** it gains counter-modules as before (`adapt()`), with all numbers capped.
3. **It comes back.** A brand-new nemesis is guaranteed to appear in your next run, so you meet it again within the first 30 minutes. The return line references whether you ran, your limb loss, or your build.
4. **The street talks.** `src/deeds.ts` is a per-character deed log (capped at 30): nemesis made, fled, promoted, slain, and dungeon clears.
   - The **City news** panel opens with **Your file**: who is hunting you, and your latest deeds as headlines.
   - The **town banner** adds a short **Hunted** label; its tooltip names the nemesis.
   - **Street barks** favour your own deeds.
   - **NPCs** (fixer, vendors, guards) open with your latest deed for 3 days (`deedNpcLine` via `memLine`, kind `deed`).
5. **Server-wide.** When you're online and kill a nemesis, the client sends a `cev` claim of kind `nem`. The claim is rate-limited and counts once per run, at claim weight. It credits the named, opted-in player for the week, and the weekly news adds a "settles a score" headline (`server/city_news.mjs`, which still runs through the fact validator).

## Rules
All words come from canned, deterministic lines; AI only writes the existing nemesis name/taunt, within the story caps. Gameplay is deterministic, and nothing new runs per frame. Net/party runs (`net-*`) skip nemesis creation as before.

Tests: `tests/city_memory.mjs`. Screenshots: `shots/memory/`.
