# Traits

Permanent, playstyle-driven specialization at **level 10** and **level 20** (Sean's spec, Oct 2026). Code: `src/traits.ts` (data, bounds, validation, ability families), `src/traitstate.ts` (recording, rules, offers, picks, effects), `src/traitui.ts` (selection modal + hints), `server/trait_rank.mjs` (AI ranking).

## Rules that never bend

- **Recent play decides, not gear.** Options come from the character's recorded actions. Installed equipment is only a weak prior when history is sparse (`priorWeight`), and a real history always outweighs it (tested).
- **Delay is allowed.** The offer is provisional: it refreshes at checkpoints (town return, dungeon clear) and keeps following your play until you pick.
- **Picking is permanent.** There is no respec, unpick or reset function anywhere (a test greps the module exports). Changing specialization = a new character (free, up to 10).
- **Level 20 requires a confirmed level 10 trait**, and level 20 options are the follow-ups of *that* trait, ranked by recent play within the path.
- **Families, not augments.** A trait modifies a family of abilities (hacking, direct combat, ranged, stealth/evasion, drones/tech) or a general stat. No trait names an item or a specific ability, so replacement-loot progression stays intact.
- **Bounded, validated effects.** Effect types are whitelisted with numeric bounds (`EFFECT_BOUNDS`), stacking across both traits is capped (`STACK_CAP`), and `traitEffects()` clamps/ignores tampered save data (unknown ids, off-path level 20).
- **AI ranks and describes, never decides.** Deterministic rules choose the candidate set. The AI may only reorder ids inside it and write a one-line flavour description; anything outside the set is rejected (server and client both check), with a canned fallback.
- **No meter.** Before selection the player only gets dialogue/contextual recognition (Odalys lines, barks). At selection the mechanical effects and permanence are spelled out.

## Families and signals

Ability family weights are derived from catalog data (`abilityFamilies()`): role `tech`/`summon` -> tech; type `hacking` -> hack; role `stealth`/`mobility` -> ghost; attacks split by shape/range into brute (cone/self/<=3.5 tiles) and gun (line, long lock-on, long ground). Built-in starter abilities use their type.

Recorded per character (`save.traits`), weights in parentheses:

| Signal | Weight |
|---|---|
| Ability cast | 3 x family weights |
| Basic attack | 0.25 (melee weapon -> brute, ranged -> gun, chain-arc -> gun/hack) |
| Dodge | 0.6 ghost |
| Hacking a relay / terminal (channel) | 4 hack |

## Tunable constants (`TRAIT_CFG`)

| Constant | Default | Meaning |
|---|---|---|
| `unlock1` / `unlock2` | 10 / 20 | Levels that unlock each pick |
| `windowRuns` | 15 | Recent-action window: last 15 dungeon runs ... |
| `windowHours` / `windowMs` | 3 h | ... and nothing older than ~3 hours of play |
| `sparseMin` | 40 | Below this many signal points the history is sparse |
| `priorWeight` | 0.25 | Weight of the equipped abilities' families when sparse |
| `leanMin` | 0.34 | Share needed for a clear lean |
| `hybridMin` / `hybridGap` | 0.25 / 0.12 | Second family this strong and this close -> hybrid offer |
| `offerN` | 3 | Options shown |

## Candidate rules

- **Lean** (one family dominant): that family's trait, then its hybrids, then Freelancer. A hacker sees Netrunner / Glitch / Breacher.
- **Hybrid** (two close families): the matching hybrid first, then both singles.
- **Sparse / balanced**: Freelancer first, then the top family (by prior) and a hybrid.
- **Level 20**: every level 20 trait whose `parent` contains the chosen level 10 trait, sorted by recent-play share of its families.

## Defaults for the open questions

| Question | Default chosen | Where |
|---|---|---|
| Recent-action window | last 15 runs, max 3 h old | `TRAIT_CFG.windowRuns/windowMs` |
| Option refresh timing | on town return and on dungeon clear (checkpoints); also when the panel is opened with no offer yet | `refreshOffer()` calls in `src/sim.ts` |
| Sparse history | balanced set (Freelancer first) + equipped abilities as a weak prior | `TRAIT_CFG.sparseMin/priorWeight` |
| Seasons | traits persist with the character; **seasonal characters are an open question (TBD)** | - |
| Character count | 10 | `CHAR_LIMIT` in `src/chars.ts` |
| New characters start at level 12 (`PROGRESSION.startLevel`) | so the level 10 pick is available immediately, but with sparse history; the recognition hints nudge players to play a few runs first | - |

## Effects in the sim

- `famDmg` / `famDur`: applied to data-driven augment abilities at cast time (temporary `abMods`); `famDmg` also multiplies built-in ability damage. Ongoing summon ticks use base mods.
- `famCdr` / `famHeat`: added to cooldown reduction / heat reduction for abilities of that family (global if no family).
- `autoDmg`, `meleeDmg`, `rangedDmg`: basic-attack multipliers. `maxHp`, `moveSpd`: build stats. `dodgeCd`: dodge recovery.

The trait list is generated into `docs/CATALOG.md` and the catalog snapshot (`npm run catalog`), so build links made before a trait change report it under "What changed".

## AI ranking (server)

`POST <story endpoint>` with `{"kind":"trait_rank", session, player, tier, candidates:[ids], l10?, shares:{hack,brute,gun,ghost,tech}}` (ids and numbers only). Handled by `server/trait_rank.mjs` inside the existing story service, so the WvStory Lambda, the dev middleware and `WV_STORY=1` all serve it, and it spends from the **same limits** (`server/story_limits.mjs` per-player/IP/global daily caps + the service daily cap). The server rejects unknown ids, tier mismatches and off-path level 20 candidates (400). The model must return `{"order":[...],"lines":{...}}`; any id outside the set, duplicates, empty or non-JSON output returns the canned fallback (rules order + authored blurbs). Lines with numbers or banned words (same filter as story lines) are dropped one by one. Results are cached per player + offer. The client (`src/traitrank.ts`) asks once per new offer, and `applyRanking()` re-checks the set before using anything. `server/trait_catalog.json` is generated by `npm run catalog` and staged into the Lambda by `infra/lib/story-stack.ts`.

**Deploy:** `cd infra && npm run deploy-story` (new files in the Lambda bundle). Until then, the live Lambda answers trait requests with `bad_request` and the game keeps the rules order and authored lines.
