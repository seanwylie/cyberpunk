# Limb loss: your body is the build

Elites and bosses can tear an augmented limb off. What you fit back on is a choice, and it shows on your character.

## Rend (telegraphed dismember)
- Only elites and bosses use it, and only in solo runs (party dungeons keep their penalty-free downs). It needs player level 4 or higher and at least one tearable limb. A run allows at most one tear.
- The tell is a 1.5 s windup with a "REND" call-out and the standard red cone (2.4 tiles, 90°). Dodging through it (i-frames) or stepping out tears nothing.
- On a hit the attack does normal damage (20, inside the usual boss floor and cap). If you are still standing, one random augmented limb comes off. That can be an arm, hand, leg or foot, but never a stock part.
- The part leaves your build and your locker and goes on the Repair Bay shelf, so you can't simply re-equip it.

## While the limb is missing
- Its stats and abilities are gone, and a small debuff applies: arm −15% damage, hand −15% attack speed, leg −12% move, foot −6% move.
- The **LIMB TORN** panel offers **Patch** or **Fight on**. Fight on collapses the panel to a small "Torn" button.

## Choices
| Option | Where | Cost | Result |
|---|---|---|---|
| Patch | On the spot (or at the Repair Bay) | Free | A Mass-Market Field Patch, a grey olive part that costs 3 Humanity. In combat it jams every 16 to 30 s for 1.4 s: arms and hands slow attacks, legs and feet slow movement. |
| Reattach | Repair Bay "Ripperdoc" section | 2× repair cost (grey 10c, green 40c, blue 120c, purple 400c, orange 1600c) | Your own part goes back on and leaves a scar: −1 Humanity each, capped at −8 and permanent. |
| Stock refit | Repair Bay | Free | A Standard Issue limb with no jams. Your part stays on the shelf. |
| Equip anything | Locker | The item | Any part you own can fill the slot. |

## Never stuck
- Every path has a free option (Patch, Stock refit).
- With all eight limbs gone you still punch (fist), move at about 70% speed, keep the starter abilities and can return to town.
- Costs are credits earned in play. Nothing is sold for real money.
- `tests/limbs.mjs` covers the rules and runs a real browser run. In that run Rend tears one limb, a dodge tears none, the in-run Patch works and the jam recovers. With every limb torn, the bare player still damages a mob, returns to town at 0 credits, refits for free and starts another run.

## Code
- `src/limbs.ts` holds the rules and tuning (`LIMBS`).
- `src/limbsui.ts` holds the in-run panel and the Repair Bay section.
- `Field Patch` items are `mmpatch_<slot>` in `src/config.ts`. They never come from the shop or loot.
- Hooks:
  - `Game.recompute`: stats.
  - `updateRun`: jam timer.
  - Attack choice and `resolveAttack`: `rend`.
  - `render.ts`: telegraph geometry.
  - `humanityOfSave`: scars.
- Sprite: `bodyvariants.tornVariants` drops the layers of an open arm or hand slot (a lost arm takes the hand with it). An open leg or foot is a darkened stump layer (`base@scar`). A Field Patch shows the Mass-Market body part. All of this is composited once per body signature, so per-frame cost is zero.
