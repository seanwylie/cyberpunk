# Balance pass (bosses, mobs, tiers I-IV)

Headless bot harness + tuning table + regression test. All numbers below come from `tools/balance` (6 seeds per cell, 888 runs per sweep).

## Tooling
- `tools/balance/harness.mjs`: runs the real sim (`src/sim.ts`, no rendering, 30 Hz steps, seeded `Math.random`) in a headless page with a simple bot: BFS navigation along `g.objective()` (kills gate guard and lock elite, takes the controller, enters the boss arena), fights the nearest alerted enemy (priority: boss pylons, healers/summoners, boss adds), casts abilities when 2+ enemies or an elite/boss are within 6 tiles, uses a stim under 40% HP (the run's 2 stims), dodges telegraphed melee windups and incoming projectiles, steps out of telegraphed boss zones (but walks through environment hazards), respawns at the checkpoint when downed (a run fails after 4 deaths, 1100 s, or when stuck). It records clear, time-to-clear, deaths, damage taken by source (`mob:attack`, `env`, boss mechanic), boss TTK, mob TTK, ability casts and max single hit. A tiny `dmgSrc` label in `sim.ts` attributes projectile/zone damage.
- Kits: `starter` (stock gear), `mid` (best green/blue per slot, half the sockets, <= blue chips), `blue` (same items, all sockets), `purple` (best <= purple, full <= purple chips), `orange` (the `idkfa` cheat). Player level = midpoint of the dungeon's level range.
- **Par kit** (the kit a player is expected to bring; target 70-90% clear): annex/warehouse mid, foundry blue, clinic purple, tier I mid, tier II blue, tier III purple, tier IV purple.
- `node tools/balance/run.mjs [--seeds 6] [--workers 4] [--mobs] [--par] [--kits a,b]` (needs a dev server, `URL=http://localhost:5173/`), `report.mjs`, `why.mjs` (per-level failure causes), `compare.mjs before.json after.json` (tables below). Raw sweeps are in `tools/balance/out/` (`before_final.json`, `after_final.json`).
- Mob duels: 3 of one mob vs the par kit for their tier in an open yard, 60 s cap.
- Test: `tests/balance.mjs` (`npm run test:balance`, ~2 min), loose bounds: par clear >= 50% per tier and 60-98% overall, tier III-IV take longer than base/I, bot never stuck, no hit > 50% of a par player's HP, boss TTK 8-360 s, starter kit cannot clear III/IV, orange clears III/IV flawlessly, five mob duels won in < 59 s with no hit > 70.

## Findings (before)
- **Tier curve was inverted/noisy.** Par clear: tier I 63%, II 93%, III 96%, IV 100%. Tailings Pit (pitboss) and Scrap Gantry (gantrymother) were near-impossible for the tier I kit (0% / 50%, 4 deaths) while Slag Ovens and Substation were trivial. Pharmacy Vault (Apothecary) and Warranty Vault (Warrantor) were the tier II/III outliers (50% / 67%); tier III purple was otherwise trivial (0.2 deaths).
- **No one-shots.** Largest hits: Tag Carrier slam 65, Pack Mule big detonation 71 (50 with armour), Rebar Crusher slam 60, Bulwark Tread slam 49, Shift Stalker riposte 38, all well under a par player's 200-290 HP (the starter kit, ~150 HP, loses 30-45% to one).
- **Biggest damage sources** per run: Bulwark Tread slam 48, Pack Mule detonation 19, Shift Stalker riposte 16, Rebar Crusher slam 15, Apothecary cleave 13.
- **Stalemate mobs (60 s duel timeouts):** Relay Node and Triage/Mender healers (3 healers/shielders heal each other: ward 30% of max HP per cast, mend 30%), Sedative Bloom and Purge Beacon (hex slow 3.5 s at x0.65 every 6 s keeps the player pinned), Sweeper Mk II (340 HP + shield + 57 HP lost per fight). Reclaim Walker (sniper that keeps distance) times out for every kit, including orange; partly a bot limitation (it never corners ranged mobs).
- **Summoner spam:** Handler/Tag Carrier fights end in 7-8 s with the par kit, so spam is not a problem; the cap (4 minions) and cooldown (11 s) were still trimmed slightly.
- **Elite rates** (10/18/28/40% of packs by tier) were left unchanged: elites accounted for no outlier damage once mob damage was tuned.
- Boss exposure was the main killer for under-geared kits; flat armour subtracts from every hit, so raising boss damage alone has a cliff effect (a level goes from 100% to 0% in one step). Tier III therefore got more boss HP (longer fight) plus damage.

## Tuning (all in `src/content/balance.ts`; defaults are the previous values)
| Knob | Before | After | Why |
|---|---|---|---|
| hex slow duration / speed multiplier | 3.5 s / x0.65 | 2.5 s / x0.8 | debuffers pinned the player; stalemate duels |
| hex heat spike | 22 | 16 | same |
| ward (shield granted) | 30% max HP | 22% | healer/shielder groups were unkillable |
| mend (heal) | 30% | 22% | same |
| mob shield sizes | x1 | x0.85 | Bulwark/Sweeper/Recall Trooper shield sponge |
| snipe damage | 26 | 22 | Long-Lens and Reclaim Walker 1-2 shot starter-kit players |
| detonate / big detonation | 30 / 42 | 26 / 34 | Pack Mule max hit 71 |
| summon cap / cooldown | 4 / 11 s | 3 / 13 s | minion spam under pressure |
| Bulwark Tread, Tag Carrier, Rebar Crusher, Shift Stalker, Sweeper Mk II damage | x1 | x0.75, x0.7, x0.85, x0.85, x0.8 | top damage sources / max hits |
| Sweeper Mk II HP, Reclaim Walker HP | x1 | x0.8, x0.85 | duel timeouts |
| Bosses | x1 | see table in the file | par clear rate per level toward 70-90% |

Boss multipliers (HP / damage): overseer 1.35/1.3, teague 1.05/1.05, surgeon 1.25/1, stockmgr 1.1/1; tier I: pitboss 0.85/0.65, gantrymother 1/0.85; tier II: apothecary 1/0.8, cryo 1.5/1.3, bellfounder 1.2/1, auditor 1.25/1.15, mirrorpt 1.1/1.05, clearance 1.25/1.25, tidewarden 1.05/1; tier III: resonance 2.2/2, liquidator 1.7/1.6, courier 2.2/2, dispatcher 2.2/2.2, warrantor 1/1.25, rattle 2.2/2, breaker 2.2/2, widow 1.8/2.2; tier IV: recall 1.1/1.1. The four original bosses are applied in `config.ts`, batch-1 bosses in `batch1_enemies.ts`, mobs in `batch2_enemies.ts`.

## Results (before -> after)
### Par-kit results per level (before -> after)

| level | tier | par kit | clear | deaths/run | time-to-clear (s) | boss TTK (s) |
|---|---|---|---|---|---|---|
| annex | base | mid | 100% -> **100%** | 0.0 -> 0.0 | 89 -> 96 | 39 -> 53 |
| foundry | base | blue | 100% -> **100%** | 0.0 -> 0.0 | 136 -> 121 | 43 -> 44 |
| clinic | base | purple | 100% -> **100%** | 0.0 -> 0.0 | 113 -> 126 | 37 -> 60 |
| warehouse | base | mid | 100% -> **100%** | 0.2 -> 0.0 | 172 -> 168 | 59 -> 75 |
| coke_ovens | 1 | mid | 100% -> **100%** | 0.5 -> 0.3 | 339 -> 278 | 68 -> 65 |
| substation_12 | 1 | mid | 100% -> **100%** | 0.2 -> 0.0 | 280 -> 237 | 118 -> 117 |
| scrap_gantry | 1 | mid | 50% -> **100%** | 2.0 -> 0.5 | 218 -> 279 | 74 -> 72 |
| tailings_pit | 1 | mid | 0% -> **83%** | 4.0 -> 0.7 | - -> 209 | - -> 62 |
| bell_foundry | 2 | blue | 100% -> **83%** | 0.5 -> 1.2 | 350 -> 378 | 94 -> 109 |
| cold_archive | 2 | blue | 100% -> **100%** | 0.0 -> 0.0 | 202 -> 236 | 43 -> 68 |
| audit_tower | 2 | blue | 100% -> **50%** | 0.0 -> 2.0 | 215 -> 206 | 54 -> 79 |
| aesthetic_ward | 2 | blue | 100% -> **83%** | 0.7 -> 1.0 | 318 -> 275 | 68 -> 76 |
| pharmacy_vault | 2 | blue | 50% -> **83%** | 3.0 -> 0.0 | 603 -> 385 | 129 -> 157 |
| anechoic_lab | 3 | purple | 100% -> **100%** | 0.0 -> 0.0 | 176 -> 240 | 47 -> 103 |
| outlet_mall | 2 | blue | 100% -> **83%** | 0.0 -> 0.7 | 166 -> 175 | 59 -> 67 |
| liquidation_floor | 3 | purple | 100% -> **100%** | 0.3 -> 0.8 | 186 -> 289 | 58 -> 97 |
| parcel_tower | 3 | purple | 100% -> **100%** | 0.0 -> 1.0 | 161 -> 317 | 44 -> 89 |
| freight_depot | 3 | purple | 100% -> **100%** | 0.0 -> 0.5 | 173 -> 320 | 74 -> 140 |
| warranty_vault | 3 | purple | 67% -> **83%** | 1.2 -> 1.5 | 365 -> 384 | 106 -> 101 |
| drained_reservoir | 2 | blue | 100% -> **100%** | 0.0 -> 0.0 | 208 -> 181 | 72 -> 68 |
| night_tunnels | 3 | purple | 100% -> **83%** | 0.0 -> 0.2 | 127 -> 221 | 45 -> 94 |
| breaker_yard | 3 | purple | 100% -> **100%** | 0.0 -> 0.7 | 135 -> 266 | 45 -> 103 |
| radio_mast | 3 | purple | 100% -> **100%** | 0.0 -> 0.3 | 292 -> 357 | 127 -> 122 |
| recall_yard | 4 | purple | 100% -> **67%** | 1.7 -> 1.5 | 589 -> 515 | 110 -> 107 |

### Par-kit results per tier

| tier | clear | deaths/run | time-to-clear (s) | boss TTK (s) |
|---|---|---|---|---|
| base | 100% -> **100%** | 0.04 -> 0.00 | 127 -> 128 | 45 -> 58 |
| 1 | 63% -> **96%** | 1.67 -> 0.38 | 291 -> 253 | 89 -> 80 |
| 2 | 93% -> **83%** | 0.60 -> 0.69 | 271 -> 262 | 70 -> 88 |
| 3 | 96% -> **96%** | 0.19 -> 0.63 | 195 -> 299 | 67 -> 106 |
| 4 | 100% -> **67%** | 1.67 -> 1.50 | 589 -> 515 | 110 -> 107 |

### Clear rate by kit and tier (before -> after)

| tier | starter | mid | blue | purple | orange |
|---|---|---|---|---|---|
| base | 0% -> 0% | 75% -> 63% | 96% -> 79% | 100% -> 100% | 100% -> 100% |
| 1 | 0% -> 0% | 63% -> 96% | 100% -> 100% | 100% -> 100% | 100% -> 100% |
| 2 | 0% -> 0% | 31% -> 21% | 93% -> 83% | 95% -> 95% | 100% -> 100% |
| 3 | 0% -> 0% | 48% -> 6% | 63% -> 15% | 96% -> 96% | 100% -> 100% |
| 4 | 0% -> 0% | 0% -> 0% | 0% -> 0% | 100% -> 67% | 67% -> 100% |

### Damage taken by source, top 10 (mean HP per run across all kits, before -> after)

| source | before | after |
|---|---|---|
| bulwarktread:slam | 47.7 | 31.2 |
| packmule:detonate_big | 18.9 | 15.6 |
| env | 17.2 | 17.4 |
| shiftstalker:riposte | 15.5 | 12.6 |
| rebarcrusher:slam | 14.7 | 10.7 |
| mortartread:mortartread.0 | 14.1 | 15.4 |
| apothecary:cleave | 12.6 | 7.3 |
| surgeon:chainsweep | 12.4 | 16.1 |
| coalheaver:slam | 12.2 | 11.6 |
| loader:cleave | 10.7 | 10.7 |

### Mob duels: 3 of a kind vs the par kit for their tier (before -> after)

| mob | tier/role | kill time (s) | HP lost per fight | max single hit | timeouts (60 s) |
|---|---|---|---|---|---|
| cindermite | T1 swarmer | 1 -> 1 | 0 -> 0 | 0 -> 0 | 0/3 -> 0/3 |
| coalheaver | T1 bruiser | 5 -> 5 | 10 -> 39 | 29 -> 29 | 0/3 -> 0/3 |
| arcflinger | T1 ranged | 22 -> 22 | 0 -> 0 | 0 -> 0 | 1/3 -> 1/3 |
| scrapram | T1 charger | 4 -> 4 | 25 -> 25 | 19 -> 19 | 0/3 -> 0/3 |
| fusecrawler | T1 exploder | 2 -> 2 | 0 -> 0 | 0 -> 0 | 0/3 -> 0/3 |
| barrierhand | T1 shielded | 5 -> 5 | 0 -> 0 | 0 -> 0 | 0/3 -> 0/3 |
| sootwisp | T1 debuffer | 21 -> 21 | 1 -> 1 | 1 -> 1 | 1/3 -> 1/3 |
| menderwisp | T2 healer | 22 -> 22 | 0 -> 0 | 0 -> 0 | 1/3 -> 1/3 |
| longlens | T2 sniper | 22 -> 41 | 0 -> 0 | 0 -> 0 | 1/3 -> 2/3 |
| handler | T2 summoner | 7 -> 8 | 0 -> 0 | 0 -> 0 | 0/3 -> 0/3 |
| belltoller | T2 caster | 11 -> 11 | 0 -> 0 | 0 -> 0 | 0/3 -> 0/3 |
| bulwarktread | T2 shielded | 18 -> 6 | 28 -> 12 | 21 -> 9 | 0/3 -> 0/3 |
| sedabloom | T2 debuffer | 60 -> 47 | 8 -> 18 | 1 -> 1 | 3/3 -> 2/3 |
| dustroach | T2 swarmer | 2 -> 21 | 0 -> 0 | 0 -> 0 | 0/3 -> 1/3 |
| shiftstalker | T3 charger | 4 -> 3 | 0 -> 15 | 0 -> 23 | 0/3 -> 0/3 |
| mortartread | T3 caster | 42 -> 23 | 5 -> 3 | 1 -> 1 | 2/3 -> 1/3 |
| leechorderly | T3 bruiser | 3 -> 3 | 0 -> 0 | 0 -> 0 | 0/3 -> 0/3 |
| packmule | T3 exploder | 2 -> 3 | 0 -> 0 | 0 -> 0 | 0/3 -> 0/3 |
| relaynode | T3 support | 40 -> 60 | 0 -> 0 | 0 -> 0 | 2/3 -> 3/3 |
| rebarcrusher | T3 charger | 4 -> 5 | 0 -> 0 | 0 -> 0 | 0/3 -> 0/3 |
| staticpup | T3 swarmer | 2 -> 2 | 0 -> 0 | 0 -> 0 | 0/3 -> 0/3 |
| recalltrooper | T4 shielded | 17 -> 12 | 0 -> 0 | 1 -> 0 | 0/3 -> 0/3 |
| tagcarrier | T4 summoner | 7 -> 9 | 13 -> 7 | 39 -> 19 | 0/3 -> 0/3 |
| reclaimwalker | T4 sniper | 60 -> 60 | 0 -> 0 | 0 -> 0 | 3/3 -> 3/3 |
| purgebeacon | T4 debuffer | 42 -> 42 | 6 -> 4 | 1 -> 1 | 2/3 -> 2/3 |
| sweepertread | T4 shielded | 37 -> 27 | 57 -> 7 | 40 -> 1 | 1/3 -> 0/3 |
| repocrawler | T4 charger | 3 -> 4 | 0 -> 0 | 0 -> 0 | 0/3 -> 0/3 |
| triagewarden | T4 healer | 30 -> 9 | 0 -> 0 | 0 -> 0 | 1/3 -> 0/3 |

### Ability usage per run (mean casts, par kit, after)

sweep 18.3, cloak 7.6, control 16.3, bladeburst 18.5, reposition 15.0, brace 0.7, forcedcool 0.6


## Honest caveats
- The bot is simple (no kiting, no cover play, melee-range trading), so absolute clear rates are conservative for skilled players and pessimistic for ranged mobs. Use it for relative comparisons across levels, tiers and kits.
- Tier III par clear stays high (96%) but costs much more: deaths per run 0.19 -> 0.63 and time 195 s -> 299 s. Tier IV (67%) is the hardest level; tier II sits at 83%. The tier-by-tier clear rate is therefore not strictly monotonic (II 83%, III 96%); difficulty rises in deaths, time and boss TTK. One more nudge on tier III boss damage would fix it.
- Gear gap is intentional: under-geared kits fail (tier III with blue 15%, mid 6%; starter 0% everywhere), the next kit up clears.
- Reclaim Walker, Relay Node, Sedative Bloom, Mortar Tread and Arc Flinger still time out in 3-of-a-kind duels (ranged/support mobs the bot cannot corner or that heal each other); they were not made weaker again because they are rarely alone in generated packs.
- Balance numbers are still placeholders until human playtesting.

## Drop rates (`DROP_RATE_SCALE`, `src/config.ts`)
Complaint: loot was far too frequent. Measured with `node tools/balance/drops.mjs --seeds 24 [--scale 1]` (kills every enemy in each dungeon at its max level on a seeded RNG; counts ground items, chips, stims, credits; raw tables in `tools/balance/out/drops_before.json|txt` and `drops_after.*`). `tests/drops.mjs` asserts the per-run range and the elite/boss guarantees.

What changed (`DROP` object; `DROP_RATE_SCALE` = 0.3):
- Ordinary mobs: item/chip/stim chance 0.16 -> 0.16 x 0.3. Credit piles: chance 0.5 -> 0.5 x 0.3, pile size x(0.5/0.3), so ordinary credit income is about half (and ground piles go from ~45 to ~15 per Annex run).
- Elites (def or affixed): 1 guaranteed roll + 1 extra at 40% (was 2 guaranteed). Bosses: 2 guaranteed rolls + 1 extra at 40% (was 3). Extras scale with `DROP.scale / DROP_RATE_SCALE`; signature drops, rarity weights (purple/orange stay rare), tutorial grants and idkfa are untouched. `DROP.scale = 1` restores old ordinary behaviour for comparisons.

Gear drops per run (items + chips + stims), before -> after (full table in the out files):
- Annex 13.2 -> 5.4 (items 6.0 -> 2.8); Foundry 15.6 -> 7.0; Clinic 12.3 -> 5.3; Warehouse 13.0 -> 6.0.
- Tier I levels ~18.4 -> ~8.1 avg; tier II ~19 -> ~8.5; tier III ~22 -> ~10.8; tier IV Recall Yard 27.9 -> 14.5. Overall total is ~47% of before (items alone ~52%).
- Purple items per run stay 0-1.7 and orange ~0 (rarity curve unchanged).

Economy check: sell-all value of an Annex run (credits + selling every item) 858c -> 483c; vendor blue gear costs 300c, install 80/400c for blue/purple removals, stim 30c, so a run still funds roughly one blue purchase; tier III/IV runs give 1.6-3.6k. Credit income overall is ~76% of before because elite/boss credit piles are unchanged. Still placeholders pending human playtests.

## Ability power pass (abilities are the main damage)

Par kits (tools/balance `--par --seeds 6`, ability bot: counters first, then attack abilities, closes to ability range). "Ability share" is damage dealt through an ability (including Cloak ambush hits, Control overload and Brace reflect) over all damage dealt; Control's +40% hack bonus and Overclock/Combo/Charged bonuses are counted inside the damage they boost.

| | Before (autos + old bot) | After |
|---|---|---|
| Clear rate (par kits) | 86.5% | 89.6% (target 70-90%) |
| Ability damage share | 13.8% | **66.4%** (target >60%) |
| Casts per run | 82.9 | 111.9 |
| Mean clear time | 268s | 271s |

Before (4 seeds, original bot and numbers):
```
par runs 96, clear 86.5%, mean clear time 268s
ability damage share 13.8% (auto 86.2%); casts per run 82.9
damage by source (%): auto 86.2%, bladeburst 10.0%, sweep 3.8%
casts per run: sweep 20.3, bladeburst 19.4, control 17.6, reposition 15.8, cloak 8.3, brace 0.8, forcedcool 0.7
  tier 0: ability share 15.2%, clear 100.0%, casts/run 45.9, time 142s
  tier 1: ability share 0.0%, clear 87.5%, casts/run 0.0, time 309s
  tier 2: ability share 14.5%, clear 78.6%, casts/run 107.4, time 318s
  tier 3: ability share 15.4%, clear 90.6%, casts/run 111.7, time 325s
  tier 4: ability share 13.8%, clear 50.0%, casts/run 159.5, time 561s
```
After (6 seeds, final numbers):
```
par runs 144, clear 89.6%, mean clear time 271s
ability damage share 66.4% (auto 33.6%); casts per run 111.9
damage by source (%): auto 33.6%, bladeburst 33.3%, sweep 17.4%, control 8.0%, reposition 6.5%, revive 1.1%, brace 0.0%
casts per run: control 32.5, sweep 28.0, bladeburst 26.0, reposition 22.3, revive 2.1, brace 1.0
  tier 0: ability share 66.0%, clear 83.3%, casts/run 87.0, time 218s
  tier 1: ability share 64.1%, clear 95.8%, casts/run 96.0, time 217s
  tier 2: ability share 67.2%, clear 90.5%, casts/run 109.4, time 314s
  tier 3: ability share 65.9%, clear 89.6%, casts/run 121.6, time 288s
  tier 4: ability share 68.1%, clear 83.3%, casts/run 214.5, time 678s
```
What moved the numbers: auto damage x0.45 and heat x2.4; Sweep 34->85, Burst 30->90, Pulse 22->55, Reposition 25->50, Control now deals 45 overload damage to everything it stuns; Revive got a solo effect (it was a dead slot in the T1 par kit); cooldowns 3-5s. To keep clears in band, enemy HP is multiplied by dungeon tier (`BAL.g.tier`: T0-T2 x1.75, T3 x1.4, T4 x1.25) and several boss multipliers were retuned (Overseer, Bellfounder, Auditor, Mirror P.T., Apothecary, Clearance, Courier, Recall). The earlier seeds of this pass are kept in `tools/balance/out/abil_a*.json`.

Tuning notes: the bot found that Control could turn the Overseer's pylons (boss then immune for ever); pylons and static enemies now only get stunned. Outliers left alone: Breaker Yard and Drained Reservoir swing 50-70% on 6 seeds (high variance, boss tele-chain), Recall Yard (T4) ~83%.

## Hard mode pass (difficulty, loot reach, rings, drops)

Tuning lives in `src/content/hardmode.ts` (HARD) plus `DROP`/`DROP_RATE_SCALE` in `config.ts`.

**Bosses punish passivity** (`pressureTick` in `content/mechanics.ts`): camping within body radius + 3.2 for 2 s triggers a telegraphed quake ring (18% max HP, knockback 3.4); a hazard is placed under the player every ~6.5 s (9% max HP, faster under 50% boss HP); 2 ranged adds every 26 s; after 140 s the boss enrages (damage and tempo ramp up to 2x). Class multipliers: boss hp x1.05 dmg x1.05, elite x1.25/x1.3, mob x1.05/x1.15, times a per-tier factor. Sustain: stim heals 32 (was 45) with a 9 s cooldown, run regen halved. Packs aggro together (10 tiles with LOS, or whole group). Death costs 35% of carried credits and repair x1.5.

**Bot results** (boss fights only, par kits, `tools/balance/run.mjs --boss --profile tank|skilled`, `bosssum.mjs`):

| | before | after |
|---|---|---|
| tank-and-spank bot loses | 65% | 100% (tests/hardmode.mjs asserts >80%) |
| skilled bot clears (<=1 death) | not measured (old full-run par clear 63-96%) | 63-67% overall; per tier 79/54/55/69/50% (T0..T4) |

**Drops** (`tools/balance/drops.mjs`): Annex items+chips+stims per run 14.3 -> 3.3 (ground piles 33 -> 7); other dungeons 3.5-5.7, tier IV 7-8. Rarity: re-roll keep chance blue .35, purple .06, orange 0 (signature drops only). Affixed pack leaders roll .25; true elites 1 guaranteed; bosses 2 guaranteed with the second mostly a chip/stim. Grey items auto-sell on pickup (Settings > Gameplay "Auto-sell junk").


## Heat pass (heat is the primary limiter, cooldown the secondary one)

Sean: "Heat is not an issue ever, cooldowns make it so heat isn't an issue ... if I spec for heat reduction I can spam abilities. Let's balance cooldowns with heat." All numbers live in `src/heat.ts` (`HEAT`); the pure functions there (`effCooling`, `effReduce`, `heatCost`, `cdAfter`, `throttle`, `dissipation`, `heatBand`) are what the sim, engine, HUD and tests share.

**Before:** passive dissipation was 9 x COOL (COOL is additive and uncapped: a purple kit reached x2.8, a cooling-only spec x5.2, so 25-46 heat/s), abilities cost 8-34 heat on 3-10 s cooldowns, autos built 2.4x weapon heat. Result: average heat 1-5 in every spec, 0 overheats in 300 s of bench time, so cooldowns alone set the cast rate. Chip heat-reduction (`coolant`/`quench`) was uncapped and stacked with COOL. `ABILITY_BAL.heat` was never read.

**What changed**
| Knob | Before | After |
|---|---|---|
| Baseline dissipation | 9/s x COOL | 6/s x effective COOL |
| Effective COOL | uncapped (x5+) | diminishing, hard cap x1.4 (dissipation never above 8.4/s) |
| Ability heat cost | authored | x1.8 for the core abilities, x1.2 for augment abilities (`HEAT.extMul`; at x1.4 the abmid kit overheated 13 times in 200 s and lost the Annex), heat scales with power; fewer, heavier casts |
| Ability cooldown | authored | x0.6 (cooldown is now the burst/ultimate limiter) |
| Ability power per cast | x1 | x1.4 (`HEAT.powerMul`: `AB` damages, `ABILITY_BAL.dmg`) |
| Chip heat-cost reduction | uncapped, raw sum | diminishing, hard cap 30% (`reduceCap`, `reduceK`) |
| Cooldown reduction | cap 50% | hard cap 30% |
| Auto-attack heat | x2.4 weapon heat | x1.2 (autos are sustainable alone, abilities are what overheats you) |
| Cast soak | none | dissipation pauses 0.6 s after each cast |
| Heat-efficiency tax | none | ability damage x(1 - 0.30 x reduction - 0.12 x cooling fraction): a maxed heat spec deals about 12-16% less |
| Overheat | abilities offline, recover at 35 | 2.5 s minimum lockout, recover at 50, dissipation x0.8, +25% damage taken, autos at half rate/damage, auto heat x0.25, slower movement |
| Vent (new) | n/a | `V` key or tap the heat bar: 1 s channel (abilities and autos offline, move x0.6), dumps 30 heat (45 when heat >= 75), 12 s cooldown, works while overheated |
| Stim | heal | heal + vents 25 heat |
| Toggles, vent abilities | authored | scaled by the same x1.8 so heat-control builds keep their value |

**Meaningful play:** hold heat under ~80, spend it on the right ability (cost tracks power), vent early in a lull (waiting for 75+ pays a bigger hot vent but risks overheating into a telegraph), save the stim for when both HP and heat are low, and use the existing enemy heat sources (hazard zones, hex spikes, boss floor patterns) as pressure that forces a vent. Heat-reduction chips and COOL gear are real but bounded; the damage tax means a pure heat spec is a sustain spec, not a spam spec.

**HUD:** the heat bar reads `HEAT n`, turns amber at 60% (`warm`), orange at 80% (`HOT n`, plus a `V` hint when vent is ready) and red at overheat (`OVERHEATED - V VENT`, the existing 1 Hz pulse). Warm and hot are steady colours (no flashing; `tests/flash.mjs` still applies). The bar tooltip shows the live dissipation rate and vent state; ability buttons mark `!` when a cast would overheat; tooltips show the real cost after gear.

**Bench (`node tools/balance/heat.mjs`, 120 s on an unkillable dummy, bot casts every ready ability; `skilled` stays under 96 heat and vents at 90, `sloppy` ignores heat but vents when overheated, `spam` ignores heat and never vents):**

| spec (profile) | cooling stat | casts/min before -> after | overheats/min before -> after | lockout before -> after |
|---|---|---|---|---|
| starter (skilled) | x1.0 | 38.7 -> 16.5 | 0 -> 0 | 0% -> 0% |
| starter (sloppy) | x1.0 | 38.7 -> 22 | 0 -> 5.5 | 0% -> 72% (no restraint is punished) |
| purple (skilled) | x2.8 | 17.3 -> 14.5 | 0 -> 0 | 0% |
| ability purple (skilled) | x2.7 | 21.3 -> 17 | 0 | 0% |
| max heat-reduction (skilled) | x5.2 | 35.3 -> 19 | 0 | 0% |
| max heat-reduction (sloppy) | x5.2 | 35.3 -> 32 | 0 -> 5 | 0% -> 54% |
| ability purple (spam) | x2.7 | 21.3 -> 10.5 | 0 -> 7 | 0% -> 96% |

The max heat-reduction spec used to cast 35/min with heat never above 2; it is now capped near 20 casts/min with average heat 87 (the bot sits at the heat ceiling the whole fight). The cooldown ceiling for three abilities is about 60 casts/min, so heat, not cooldown, is what stops it. Fully unspecced and fully specced builds end up within about 1.2-1.5x of each other in sustained casts because the caps flatten the curve on purpose; the rest of a heat spec's value is burst headroom and recovery speed.

**Level results (par kits, 3 seeds, final `powerMul` 1.4, same harness for both columns)**

Note: after the layout-variety commit the bot gets stuck on 30-40% of the batch-level layouts (it was written for the old east-boss layouts; boss reveal now uses `revealPoint()`). Both columns exclude those runs (`heatsum.mjs`; `--all` includes them), so absolute rates are for the levels the bot can finish, and "before" is the current main, which is harder than the older table above.
| | Before (main, no heat pass) | After |
|---|---|---|
| Par clear rate | 52% (44 runs) | **71%** (42 runs; target 70-90%) |
| Par clear with <=1 death | 48% | 57% |
| Ability damage share | 66% | **73%** (target >60%) |
| Overheats per minute | 0.00 | 1.1 |
| Time locked out | 0% | 10% |
| Average heat | 5 | 55 |
| Casts per minute | 19.9 | 20.7 |
| Boss fights, skilled bot, clear with <=1 death | 74% | 88% (target 50-70%: **not met**; it was already above target on current main, and heat barely touches a bot that vents and dodges) |
| Boss fights, tank-and-spank bot clears | 0% | 0% (loses 100%, target >80%) |

Tuning history for `powerMul`: 1.7 gave par 89% / skilled 77%; 1.5 gave par 78% / skilled 90%; 1.3 gave par 68% / skilled 83%; 1.4 is the compromise that keeps par in band. Skilled-bot boss clears do not respond much to ability power (bosses are long fights where the bot's dodging decides the outcome), so bringing that to 50-70% is a boss-damage tuning job, not a heat job; left open.

The first heat pass (x2.0 cost, no bot vent) showed the cost of getting heat wrong: 2.6 overheats/min and 39% lockout. The shipped numbers keep overheat a recurring, survivable event (about 1.4 a minute for the greedy bot that pushes into overheat on elites and bosses, with vent as the answer).

**Re-run:** `node tools/balance/heat.mjs --secs 120`, `node tools/balance/run.mjs --par --seeds 2`, `node tools/balance/abilshare.mjs out.json`, `node tools/balance/heatsum.mjs out.json`; `npm run test:heat` for the assertions (caps, consequences, vent, HUD bands, bench cast-rate limits).


## Boss pass (bosses decided by mechanics, not only stats)

**Harness navigation fixed.** The stuck runs were a level-generation bug, not bot navigation alone: in the archetype layouts (`mapgen_arch.ts`) one of the two gate guards was placed along the exit axis, i.e. *behind* the gate, so the gate (which opens when the guards die) could never open for anyone. Both guards now spawn on the spawn side of the gate. The harness also uses `revealPoint()` for the boss room. Par runs stuck: 30-40% -> 0/72, so every run is measured.

**Double-listing bug fixed.** `Game.saveNow()` stored the live `enemies` array as `inst.enemies`, so `spawnEnemy` pushed late boss/alarm adds into the same array twice (updated and hit twice). It now stores a copy.

**Mechanics (`HARD.mech`, `HARD.press`, `BAL.boss`)**
- Tier mechanic scaling: boss move tempo x[1,1,1.12,1.25,1.35] and hazard-under-player tempo x[1,1,1.2,1.4,1.55] by dungeon tier 0-4.
- Echo: tier II+ bosses below 75% HP repeat every 2nd zone move where you stand after 1.15 s with a full telegraph (same windup, flashguard-safe). Camping in the gap is punished.
- Enrage is a DPS check: starts at 100 s (was 140 s), ramp .02/s (was .012), cap 2.4x; ground hazards under the player hit for 11% max HP (was 9%).
- Boss HP normalised toward fight-length targets (base 100 s, T1 130, T2 140, T3 150, T4 170) with clamp .75-1.5x, so short fights get longer and mechanics matter; boss damage class mult 1.05 -> 1.2. Teague (0% clear before: slam wiped the par kit) HP x.9, dmg x.8.

**Results (skilled bot, boss only, 4 seeds x 24 bosses; tank 2 seeds)**

| metric | before | after | target |
|---|---|---|---|
| skilled clears boss with <=1 death | 88% | 66% | 50-70% |
| tank bot clears | 0% | 4% (loses 96%) | loses >80% |
| par full-run clear (72 runs, none stuck) | 89% (stuck-free) | 71% | 70-90% |
| ability damage share | 74% | 74% | >60% |

Per boss (after; tank clear column is 2 seeds):

| level | tier | boss | skilled clear | <=1 death | deaths/run | boss fight (s) | top damage source | tank clear |
|---|---|---|---|---|---|---|---|---|
| annex | base | overseer | 50% | 25% | 2.0 | 137 | overseer:slam | 0% |
| foundry | base | teague | 100% | 100% | 0.0 | 61 | teague:slam | 100% |
| clinic | base | surgeon | 0% | 0% | 4.0 | - | surgeon:chainsweep | 0% |
| warehouse | base | stockmgr | 100% | 100% | 0.5 | 197 | stockmgr:slam | 0% |
| coke_ovens | 1 | voss | 100% | 100% | 0.5 | 137 | voss:slam | 0% |
| substation_12 | 1 | lineman | 100% | 100% | 0.0 | 115 | lineman:lineman.1 | 0% |
| scrap_gantry | 1 | gantrymother | 100% | 75% | 1.0 | 140 | gantrymother:slam | 0% |
| tailings_pit | 1 | pitboss | 100% | 75% | 0.5 | 140 | pitboss:quake | 0% |
| bell_foundry | 2 | bellfounder | 75% | 50% | 0.8 | 217 | bellfounder:slam | 0% |
| cold_archive | 2 | cryo | 100% | 100% | 0.0 | 135 | cryo:riposte | 0% |
| audit_tower | 2 | auditor | 100% | 100% | 0.0 | 125 | auditor:cleave | 0% |
| aesthetic_ward | 2 | mirrorpt | 75% | 50% | 1.5 | 252 | mirrorpt:cleave | 0% |
| pharmacy_vault | 2 | apothecary | 50% | 50% | 1.0 | 246 | apothecary:cleave | 0% |
| anechoic_lab | 3 | resonance | 100% | 75% | 0.8 | 171 | resonance:resonance.1 | 0% |
| outlet_mall | 2 | clearance | 75% | 50% | 1.0 | 189 | clearance:slam | 0% |
| liquidation_floor | 3 | liquidator | 75% | 75% | 0.8 | 121 | liquidator:rsweep | 0% |
| parcel_tower | 3 | courier | 0% | 0% | 3.5 | - | courier:courier.0 | 0% |
| freight_depot | 3 | dispatcher | 100% | 100% | 0.0 | 83 | dispatcher:dispatcher.0 | 0% |
| warranty_vault | 3 | warrantor | 50% | 50% | 1.3 | 240 | warrantor:rsweep | 0% |
| drained_reservoir | 2 | tidewarden | 75% | 75% | 1.0 | 167 | tidewarden:rsweep | 0% |
| night_tunnels | 3 | rattle | 50% | 0% | 3.0 | 273 | rattle:rattle.0 | 0% |
| breaker_yard | 3 | breaker | 100% | 50% | 1.5 | 284 | breaker:chainsweep | 0% |
| radio_mast | 3 | widow | 100% | 100% | 0.3 | 177 | widow:widow.1 | 0% |
| recall_yard | 4 | recall | 75% | 75% | 0.8 | 209 | recall:hazard | 0% |

overall: clear 77%, <=1 death 66%; per tier (<=1 death): base 56%, 1 88%, 2 68%, 3 56%, 4 75%

