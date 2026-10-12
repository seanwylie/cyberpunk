# Nemesis bosses

When a boss or elite kills you, it can become **your** nemesis: it gets a name and title, keeps a trophy taken from you (one of your installed augments), taunts you about how it killed you, and comes back in later runs, stronger in fixed steps and adapted to how you play. Kill it and it is gone for good. You keep a unique trophy that other players can see.

Code: `src/nemesis.ts` (pure save logic and every number), `src/nemesis_sim.ts` (sim hooks), `src/nemesis_ui.ts` (card), `src/nemesis_voice.ts` (voice), `src/nemesis_ai.ts` + `server/nemesis_words.mjs` (AI words). Tests: `tests/nemesis.mjs`, `tests/nemesis_balance.mjs`.

## Rules (all in `NEM_CFG`)
| Rule | Value |
|---|---|
| Boss kill makes a nemesis | always (seeded roll, `chanceBoss` 1) |
| Elite (or affixed mob) kill makes a nemesis | 50% (`chanceElite`) |
| Plain mob kill | never |
| Fleeing (leave/abandon a run while an alerted boss or elite is within 9 tiles and you are in combat) | can mark a **new** nemesis with the same rolls and caps; never ranks up an existing one, so avoiding is always safe |
| Active nemeses per character | 3 (`maxActive`) |
| Chance an active nemesis joins a run | 60%, at most one per run, weighted toward higher rank |
| Rank | 1 to 5, +1 each time it kills you again |
| Tier (title) | Stalker (1 kill), Captain (3), Warlord (5) |
| HP | +10% per rank, max x1.5 of its body |
| Damage | +5% per rank, max x1.25 |
| Counter-modules active | rank 1-2: 1, rank 3-4: 2, rank 5: 3 |

**Body.** A boss's death completes the dungeon, so a boss never respawns mid-run. A boss-born nemesis returns in the body of the weakest eligible elite from the same maker. That body is never a boss, and never the dungeon's gate guard or lock elite, so a nemesis can't block progression. It uses its own spawn group (97).

## Adaptation (tested counter-modules)
The game builds a profile from your recent trait signals (`traitstate.scores`) and the damage you dealt this run (`g.dealt`). The nemesis then takes the modules that profile calls for, strongest signal first:

| You | Module | Effect | Cap |
|---|---|---|---|
| Hack (hack share >= 20%) | **Counter-ICE** | hacks, stuns and control last half as long on it | x0.5 duration |
| Burst (ability damage >= 35%) | **Burst Plating** | starts behind a shield | 20% hp +2%/rank, max 30% |
| Kite (ranged weapon, ghost and gun signals) | **Gap Closer** | dashes up to 5 tiles toward you when you are over 6 tiles away | every 7 s |
| Always | **Adapted Hide** | less damage from your main damage type (kinetic / blade / arc / tech) | 6% per rank, max 30% |

## Hierarchy
* **Promotion:** every kill ranks it up and re-adapts it. Reaching a new tier changes its title and plays a promotion taunt.
* **Recruit:** if you already have 3 active nemeses and another killer qualifies, your strongest nemesis recruits it instead of a 4th spawning. Each recruit adds one escort when that nemesis appears, up to 2.
* **Killed for good:** killing it sets `status:'dead'`. It never spawns again, and further deaths can't rank it (tested over 300 seeds and 119 live runs).

## Trophy and provenance
Killing a nemesis gives you `<Name>'s Mark` with the line **"Killed <Name>, who killed you N times"** (stored in `save.nemesis.trophies`).
Other players can see it: the build export (`WVB1` code, JSON, link) carries up to 3 trophies (`trophies:[{n,l,t}]`, strictly validated on import), and the text summary lists them.
The nemesis also carries the augment it took from you (`trophy: {def, name, rarity, slot}`), shown on its card as "Wears your <augment>".

## Per character and in a party
State lives in `save.nemesis`, which is per character (`src/chars.ts` treats everything outside the account fields as per character).
A nemesis's nameplate shows its name plus **"Your nemesis"**, or **"<Runner>'s nemesis"** when it belongs to someone else. The party snapshot (`core/party.ts`) carries `nem:{n,o}`.
Known limit: party instances are built from the level roster (`net/session.ts`), so nemeses only spawn in solo runs for now. Syncing one player's nemesis into a shared party instance is follow-up work.

## Fairness caps (balance)
`tests/nemesis_balance.mjs` checks every dungeon. For the worst case (rank 5, every module, max escorts), the nemesis's **effective HP** (hp x (1 + shield) / (1 - resist)) has to stay at or under the dungeon boss's HP. `nemStats` targets 60% of boss HP (`hpVsBossCap`). It goes over that only when the bare body is already bigger, and it never goes below that body's own HP. Damage stays at or under x1.25, and every rank step is monotonic and bounded. The worst ratio today is 0.95 (Annex, quench priest body). The full table is in `docs/balance/nemesis_caps.csv`. Saves that were tampered with (rank 99, unknown modules, 50 recruits) still clamp.

## AI boundaries
The AI writes **only the words**, meaning the name and the taunt. The client sends ids and labels with `kind:"nemesis_words"` to the story endpoint (same Lambda, same `story_limits` caps and daily budget). The server validates the reply: a name of at most 28 letters, a taunt of at most 140 characters, no digits, no markup, and the story `cleanOutput` filter. The client validates it again (`applyWords`, all or nothing). Any failure, a limit hit, or Story AI switched off keeps the canned words. Rank, modules, HP and spawns never touch the model.

## Voice
* Taunts are voiced, variable-free lines (`TAUNTS` in `src/nemesis.ts`) covering each kill method (melee, ranged, charge, slam, zone) plus promote, recruit, return and death lines.
* `ELEVENLABS_API_KEY=... node tools/gen_nemesis_voice.mjs` voices them with ElevenLabs TTS (2 low, restrained premade voices, mp3 64 kbps) and caches them in `public/audio/nemesis/` with a `manifest.json` of text hashes. Only changed lines are regenerated. The script checks that the key has the **text_to_speech** permission first and never prints it. As of 2026-10-12, `ELEVENLABS_API_KEY` has TTS and `ELEVENLABS_API_KEY_SFX` does **not** (it is missing `text_to_speech`).
* Playback is off the frame path: one lazily created `<audio>` element, started from a macrotask, streamed and never decoded into WebAudio. It falls back to subtitle-only text when the flag is off, the volume is muted, the manifest or clip is missing, there is a network or play error, or the AI wrote a custom taunt. The subtitle always shows. 22 clips, about 0.5 MB on disk, loaded only on demand.

## Flags
`src/features.ts`: `nemesis` (default on) and `nemesisVoice` (default on, Settings > Display > Nemesis voice). Overrides: `window.__WV_FEATURES`, `localStorage wv_feat_<key>`.

## Performance
`nemTick` walks only the cached `g._nems` list (0 to 3 enemies). There's no per-frame allocation, and nothing runs when no nemesis is present.
