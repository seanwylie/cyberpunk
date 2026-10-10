# First-run tutorial

Source: `src/tutorial.ts`, styles at the end of `src/style.css`, test `tests/tutorial.mjs` (in `npm test`).

## Model
The tutorial **observes** the game and never drives it. Progress is a set of latched facts in `save.tutorial.done`; a step is complete once its fact is latched. The current step is the first incomplete step that fits where you are (town or run). If only steps for the other place remain, a redirect card is shown ("Back to town (B)" / "Back to the gate"). So skipping ahead, doing things out of order, dying, opening other panels and resizing cannot break it, and every step has **Skip step**.

| # | Step | Completes when |
|---|---|---|
| 1 | Walk the market | 4 tiles travelled (or a run starts) |
| 2 | Get a contract | any contract accepted (Odalys, fixer panel, contacts) |
| 3 | Install an upgrade | installed rarity total rises (a guaranteed upgrade, Bellows Clamp, is put in storage) |
| 4 | Socket a chip | chips on installed gear rise after Apply (a fitting chip is guaranteed in stock) |
| 5 | Vendor and repair | vendor open 2.5 s |
| 6 | Enter the Annex | a run starts |
| 7 | Your combat kit | ability cast event + dodge, then "Got it" (stim / interact are optional ticks) |
| 8 | Clear the pack | 3 kills + a pickup (item or credits) |
| 9 | Back to town | town return from a run |
| 10 | Spend it | "Finish and claim reward" (locker/vendor Recommended panel is spotlit) |

Reward: 150c + 1 stim, once (replays never re-reward). The card always shows "Step X of 10" and "Skip tutorial" (needs a second tap within 3.5 s to confirm).

## UI
- Card: top-left under the HUD bars (picks a spot that overlaps no HUD element); docked bottom bar while a panel is open (the panel shrinks via `--tutdock`).
- Spotlight: pulsing ring + arrow on UI elements (dimmed backdrop only for HUD targets and only when the interact prompt is hidden); world targets get a ground ring or an edge arrow when off-screen. None take pointer events.
- Text uses the type scale (`--fs`, `--fmin`). Touch copy: joystick, tap, hold-and-drag abilities, tap the prompt; buttons are 44px.
- Hidden while Settings/Dev is open. The old first-time hint line is suppressed while the tutorial is active.

## Persistence / replay / switches
- `save.tutorial` (status active|done|skipped, done facts, kit choices). Existing saves with runs/kills/clears/level>12 start as `done`.
- Settings > Gameplay > **Replay tutorial** restarts it (clears the Annex lockout so the gate works).
- Off for tests via `localStorage.wv_notut=1` (set by `tests/lib.mjs`, pass `tutorial:true` to keep it). `?tutorial=off|on` overrides.
- The `idkfa` cheat is independent (it flags the save cheated, so a fresh cheated save is treated as a veteran).
