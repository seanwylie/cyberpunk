# Contracts written for you

Odalys (job board and Fixer window, under **For you**) offers 3 personal jobs a day. You can ask for **Other jobs** twice a day. Each job is assembled from tested pieces. The rules build and validate every combination; the AI only picks among the valid ones and writes the title and briefing.

## Pieces (`src/pcontracts.ts`)
| piece | source | constraint |
|---|---|---|
| dungeon template | `DUNGEON_LIST` | `templateOk`: unlock chain cleared, a host town unlocked, not sealed (level ≥ min-4), not over-leveled (≤ max+8), not locked out today |
| boss kit | dungeon default boss plus condition bosses whose augment cap you **have** | the kit id must match the boss in `KITS` |
| objective | `clear`, `boss`, `cull` (12/18/24 kills of anyone in that dungeon), `salvage` (3/4/5 pickups), `condition` (wake the hidden boss; **only offered if you have its cap**, so never a hard block) | goal shape is checked exactly |
| modifiers (≤3, each with a checked precondition) | Premium (trusted giver), Rival (nemesis boss), Clean/Loud (humanity band), Grudge (that faction's guards are wary/hostile), Wired (hack trait + hack condition), Known (cleared before), Second shot (you went down there or dropped a job there, from NPC memory) | reward-only, never restrictive |
| giver | the dungeon's fixer (else Odalys) | must not be hostile (NPC memory) |
| rewards | `rewardFor()`: `(200 + level*28) * creditMul * objMul * (1 + mods ≤ 0.5)`, capped at 2400c, plus faction rep ≤ 10 | always recomputed; tampered or AI-supplied rewards are rejected |

Personalization weights candidates using:
- nemesis bosses (strong)
- trait families: hack → condition, brute/gun → cull, tech → salvage, ghost → boss
- level fit
- top-rep faction
- memory with the giver
- modifier count

A variety pass makes sure the 3 offers use different dungeons and objectives.

**Nemesis input**: `nemesesOf(save)` reads `save.nemesis.list` or `save.nemeses` items shaped `{boss, dungeon?, name?}`. Unknown boss types are ignored. This is the contract with the nemesis workstream (`wv-nemesis`, not on main yet).

## Validation
- **Client**: `validateContract(save, c, caps)` runs at generation, on AI pick and on accept. It checks the template, objective, boss and condition cap, goal, modifiers, giver, recomputed reward, and title/brief lengths.
- **Server** (`server/contract_pick.mjs`, `kind:'contract_pick'`): rechecks every candidate's pieces against `server/npc_catalog.json`, which `npm run catalog` generates from game data. The model gets place and boss names, job type, tags and player facts as enums. It **never sees rewards**.
- **Model output**: strict JSON schema `{picks:[{id,title,brief}]}` with at most 3 picks, ids only from the set, title ≤ 32 characters, brief cleaned with the story filters (≤ 200 characters, no house-rule banned terms, numbers-as-rewards, links, etc.).
- **Fallback**: anything off returns `src:'canned'`, and the client keeps the rules offers with canned briefs. Shares the `story_limits` caps.
- **Shared machinery**: accepted personal contracts live in `save.pcon.defs`. Sim progress (`contractEvent`) and claim use `contractDefOf()`. You can have up to 2 personal jobs at once, within the global 4. Claiming makes the giver remember you (`contract_done` and `helped`).

## Completability (`tests/contracts_personal.mjs`)
- Contracts are generated for 6 characters (fresh, mid, hacker, brute/low humanity, nemesis, endgame) × 3 cap sets. Every one must validate.
- Each tamper case must be rejected.
- Server and AI rejection paths are tested.
- The progression sweep must be clean on every template used.
- The balance bot plays real `clear`, `cull`, `boss` and `salvage` contracts with no god mode, and each contract must reach its goal. Run `--full` for one job per template.
