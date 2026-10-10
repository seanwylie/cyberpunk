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
- **Tier curve was inverted/noisy.** Par clear: tier I 63%, II 93%, III 96%, IV 100%. Tailings Pit (pitboss) and Scrap Gantry (gantrymother) were near-impossible for the tier I kit (0% / 50%, 4 deaths) while Coke Ovens and Substation were trivial. Pharmacy Vault (Apothecary) and Warranty Vault (Warrantor) were the tier II/III outliers (50% / 67%); tier III purple was otherwise trivial (0.2 deaths).
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
