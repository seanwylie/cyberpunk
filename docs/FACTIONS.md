# Manufacturer factions

The three houses (Heavy Industrial, Precision Surgical, Mass Market) judge you by what is in your body.

**Standing** = reputation rank (0-3, earned) + 0.5 per installed part of theirs (cap 3) − 0.5 per installed part of their rival (cap 3).
Rivalry: Heavy resents Surgical parts, Surgical resents Mass Market parts, Mass Market resents Heavy parts.

| Standing | Score | Vendor prices | Access | Contracts | Hunters |
|---|---|---|---|---|---|
| ★ Loyal | ≥3 | −13% | full | more of their jobs, Patron +15% | none |
| + Trusted | ≥1.5 | −7% | full | more jobs, Patron +15% | none |
| · Neutral | 0..1.5 | 0 | full | normal | none |
| ! Wary | <0 | +10% | full | fewer | 15% of runs |
| ✕ Hostile | ≤−2 | +20% | blue stock closed | far fewer | 45% of runs |

Hunter squad: one elite + two crew of the most hostile house, parked about a third of the way into the dungeon (level 6+, solo runs only, never the gate guard or lock elite). Optional fight, never blocks the path.

Never stuck: grey/green and stock parts are always sold, story contracts are untouched, standing is fully earnable in play (no purchase affects it).
Code: `src/factions.ts`, hooks in `src/ui.ts` (strip, price, shelf), `src/pcontracts.ts` (weight, Patron), `src/sim.ts` (`spawnHunters`). Test: `tests/factions.mjs`.
