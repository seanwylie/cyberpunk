# Loot economy: oranges and season exclusives

Earned oranges and Season exclusives are the game's prestige items, on par with store exclusives. They come from **one hidden roll** (`src/loot_eco.ts`, `rollPrestige`) on elite and boss kills. Regular loot tables never drop oranges.

## The model
- **Who rolls:** elites and bosses only, and only players who took part (damage dealt or in the boss room). Each party member rolls on their own save, scaled down by party size.
- **Eligibility:** a kill only rolls (and only advances pity) if an orange or a live season item is reachable: item level <= character level and <= the dungeon's tier cap.
- **Orange or seasonal:** one roll picks orange, seasonal or nothing. Chances scale with dungeon tier, epic gateways and hard mode, so harder content is the better farm.
- **Target farming:** each signature boss's orange lands on its own signature item 75% of the time (`sigShare`). Signature items never drop elsewhere.
- **Bad-luck protection (hidden pity):** counted in boss-kill equivalents (an elite = 0.06). After 130 dry kills each kill adds +0.07 pp; at 320 the next eligible kill is guaranteed. Any prestige award resets it.
- **Duplicates:** one reroll into an orange you don't own; after that a duplicate becomes a Prism Shard. 6 shards rebuild any orange you have already seen. Season exclusives can't be rebuilt.
- **Seasons** (`src/seasons.ts`): season items drop only inside the season window, then retire forever. Retired ids can't be granted by anything, including forced pity. Items carry provenance ("Season 1 · Limited" / "Season 1 · Retired"), shown in tooltips and to other players.
- **Low band (level <= 22):** few oranges are reachable this early, so eligible kills are sparse. The orange chance is x3.5 (instead of the in-season x1.25). On kills where an orange can land, hard pity drops to 30% (96 kills), and forced pity picks orange 62% of the time.
- **Moments:** a painted drop beam, a banner, a first-orange line from Odalys, the Loot log, and an opt-out party/town announcement.

## Low-level signature oranges
| Item | Slot | Lv | Boss | Dungeon (and gateway copy) |
|---|---|---|---|---|
| Voss Oven-Heart | torso | 15 | Oven-Tender Marguerite Voss | coke_ovens, gw_coke_ovens |
| Ossendrecht Pit-Drill | armL | 16 | Pit Boss Karl Ossendrecht | tailings_pit, gw_tailings_pit |
| Gantry-Mother Crane Legs | legL | 17 | Gantry-Mother Ngozi Adeyemi | scrap_gantry |

## Tuning (`LOOT_ECO`)
| Knob | Value |
|---|---|
| orange per boss / elite | 0.42% / 0.02% |
| seasonal per boss / elite | 0.50% / 0.022% |
| in-season orange multiplier | x1.25 |
| tier multipliers (tier 0-4) | 0.85 / 0.95 / 1 / 1.2 / 1.5 |
| gateway / hard mode | x1.5 / x1.35 |
| pity soft start / step / hard | 130 / +0.07 pp / 320 |
| pity split when both are reachable | 55% orange / 45% seasonal |
| low band (level <= 22) | orange x3.5, hard pity x0.3 where an orange can land, forced pity 62% orange |
| party size 1-5 | 1 / 0.9 / 0.8 / 0.72 / 0.65 |
| target-farm share | 75% |
| shards per duplicate / shard cost | 1 / 6 |

## Targets and test bounds (`tests/loot_economy.mjs`)
Farm model (`tools/balance/prestige_sim.mjs`, shared with `tools/balance/loot_audit.mjs`): a dedicated solo player clears every on-level dungeon once per lockout, at mid estimated run time plus 1.5 min town overhead, killing 4 elites and the boss each run. 120 simulated players at levels 18, 30, 42 and 50.

| Check | Target | Test bound |
|---|---|---|
| first orange, in season | 15-25 h | 13-25 h |
| first seasonal, in season | 20-25 h | 18-27 h |
| first orange, off season | 15-25 h | 11-25 h, slowest 10% under 40 h |
| per-boss orange rate | 0.42% | within 4 sigma |
| 4-player party member vs solo, per hour | no more than solo | <= solo x1.02 |

Last run (Oct 12, 2026, after the level-1 start rebanding):

| Level | In season: first orange / first seasonal | Off season: first orange (slowest 10%) |
|---|---|---|
| 18 | 16.6 h / 18.5 h | 21.0 h (38.0 h) |
| 30 | 17.8 h / 21.9 h | 16.6 h (27.9 h) |
| 42 | 20.2 h / 25.4 h | 16.6 h (28.2 h) |
| 50 | 22.9 h / 22.5 h | 18.6 h (36.8 h) |

Level 18 sits close to the test bounds: its few eligible bosses make it sensitive to the dungeon level bands. If the bands move, recheck it.

Rerun: start a dev server, then run `URL=http://localhost:<port>/ node tests/loot_economy.mjs`. For a per-dungeon breakdown, run `node tools/balance/loot_audit.mjs --seeds 4`.
