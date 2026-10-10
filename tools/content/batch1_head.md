# Content Batch 1: 20 new bosses and 20 new levels

Sean: "We duplicate bosses a lot, let's generate say 20 of them and 20 more levels."
Status: prototype content, PLACEHOLDER balance like the rest of docs/UNIVERSE.md. The tables in sections 3 and 4 are generated from the data
(`node tools/content/gen_doc.mjs` from `src/content/batch1_bosses.ts` and `batch1_levels.ts`), so this document and the game cannot drift.

## 1. Goals and constraints
- 20 **new** bosses: distinct names, lore ties to the factions (Harrow-Brandt, Aldane Surgical, Kestrel Value, plus the Rustline Compact, the Quiet Shift and the Recall Authority from UNIVERSE.md), distinct mechanics, phases, attack patterns and arena gimmicks, distinct music mapping (`BOSS_MAP`), distinct silhouettes (`tools/enemies3d/specs_batch1.py`).
- 20 **new** levels, one boss each: distinct theme (palette, motif, light), room shapes and sizes, hazards, enemy roster, objective, zone names, rewards and unlock path.
- Content is **data-driven**. 20 bosses are combinations of a small toolkit, not 20 code forks. UI is touched minimally (dungeon select tag + lock line).

## 2. The mechanics toolkit (`src/content/mechanics.ts`)
All telegraphed ground patterns reuse the existing zone system (windup, lingering, damage tick); projectiles reuse `projs`. Existing melee (slam, cleave, rsweep, chainsweep, charge, blink, summon) stays as is.

| Kind | What it does | Params |
|---|---|---|
| `marks` | Telegraphed circles on and around the player's position | n, r, spread |
| `ring` | Ring of pools around the boss with a safe gap | n, gaps, rad, r |
| `spokes` | **Beam sweep**: lines of zones whose windup staggers so the beam rotates across an arc | n (slices), len, sweep (deg) |
| `cross` | Static spokes radiating from the boss all at once | n, len, r |
| `lanes` | Parallel striped lanes toward / across the arena with one safe gap | n, gap, len, space |
| `spiral` | Marker spiral expanding from the boss, staggered windup | n, turns, rad |
| `rain` | Random circles over the arena near the player | n, area, r |
| `fan` | Projectile fan | n, spread, speed |
| `nova` | Projectile ring with a safe arc (**hide behind pillars**; projectiles stop at walls and pillars) | n, speed, gap |
| `adds` | Summon wave (capped by live adds) | type, n, cap |

Phase actions (at HP thresholds): `shield` (absorb pool; breaking it staggers = 1.5x damage for 4 s), `pylons` (**tether**: 90% less damage while any node lives; killing all staggers), `enrage` (speed and cooldown multipliers), `adds` (one-off wave), `gimmick` (switch arena gimmick).
Arena gimmicks (always on while the boss is alive): `rain` (floor strikes), `spokes` (centre beam sweeps), `pillarfire` (**pillars fire novas**), `edge` (arena rim turns hazardous, shrinking safe ground), `trickle` (periodic adds), `lanes` (periodic lane volleys).

Boss state: phase index is persisted on the enemy (`phase`), tether/summon children carry `bossAdd` so Reset/checkpoint restart/death cleans them up. Shields and gimmick timers are runtime-only (a page reload during a fight resets the shield, not the phase).

### 2.1 Uniqueness rule (enforced by `tests/content1.mjs`)
- Every boss has a unique full signature (moves with params + phase list + gimmick).
- No two bosses share the same (move kinds + gimmick kind + phase action kinds) triple.
- Every level has a unique (room shapes + palette motif/light + hazard mode + roster) fingerprint.

## 2.2 Level generator (`src/content/mapgen_batch1.ts`)
Same run chain as every dungeon (entry, gate1, hall, lock2, control with controller, boss door, boss arena with `revealX`, salvage room, checkpoints) so objective, boss reveal, checkpoint and daily-lockout logic apply unchanged. Per level, the four main rooms get a **shape** from 12 obstacle generators (`open pillars rings diag cave river maze islands colonnade pit zigzag cross`), sizes from the recipe, seeded jitter, hazards in one of four modes (`channels scatter ring lanes`), seeded packs from the roster. `validate()` plus deterministic seed retry guarantees connectivity, objective reachability and a boss-radius-reachable boss spawn.

## 2.3 Progression, tiering and rewards
- Tiers: I = Lv 12-24, II = 20-32, III = 28-42, IV = 38-50 (capstone). Existing four dungeons stay as they were.
- **Unlock path**: each level lists `unlock.after` (all must have been cleared at least once; persisted as `save.cleared[id]`). Entry, resume and daily lockout rules are the existing ones; the dungeon select shows tier and a "Requires clearing ..." line instead of the Start button.
- **Rewards**: credit multiplier and clear XP scale by tier; loot pool by faction (reusing the Foundry / Clinic / Warehouse tables, `mix` blends all three); each level has a themed chip cache. Boss damage scale 1.4 / 1.55 / 1.7 / 1.9 per tier.
- **Instance / reset rules**: unchanged. `LAYOUT_V` bumped so stale instances are discarded; Reset instance rolls a new seed.
- **Minimap / objectives**: unchanged (read `Level`); objective labels, relay labels and zone names are per level. Objective type for all 20 is the existing controller-then-boss-door chain with a themed device (the run-state machine is not forked).
- **Music**: each boss maps to one of the existing boss tracks in `BOSS_MAP`; pairs are chosen so neighbours in the same faction do not share a track.
