# Progression: the player must never be unable to progress

## Run chain
entry -> gate guards (gate1 opens when every `gateGuard` mob is dead) -> lock elite or relay hack (lock2) -> objective controller (boss door) -> boss reveal.

## Root cause of the stuck-at-first-gate bug (Oct 2026)
The calm-start pass (`src/content/safestart.ts`) relocated packs that could see the entry. Gate guards are static/ranged, so they were often moved,
and the relocation searched every zone with doors treated as open. Guards landed behind the gate they open (or behind the lock), so gate1 could never open.
Affected ~5-20% of seeds in Slag Ovens, Substation 12, Aesthetic Ward, Reagent Vault and Foundry.

Fix: `stageMap(L)` gives each tile its progression stage (doors needed). Door-opening mobs (groups 90/91 gate guards, 50 lock elite) only move within their own stage.
When their stage has no calm-start-compliant tile, they take the best tile in that stage (out of line of sight if possible) and are listed in `safeInfo.gateExempt`.

## Runtime safety nets (`src/progress.ts`)
- A gating mob standing where the player cannot reach it with its door closed is pulled to the player's side (or killed if no tile exists).
- Stall watchdog: no kill and no flag change for `PROG.pullS` (75 s) -> remaining gating mobs come to the player; `PROG.forceS` (180 s) -> the door opens by emergency override.
- Boss chamber: standing inside the open boss chamber for 1.5 s starts the reveal even if the exact reveal spot is blocked.
- HUD objective names the next step: "Next: destroy the gate guards (N left)", "Next: go through the open gate/lock" (arrow points just past the doorway).
- Settings > Instance > **Unstuck** pulls the gate guards to you, or opens the next door when nothing is left to fight. Restart from checkpoint and Abandon remain.

## Tests
`node tests/progression_sweep.mjs` (in `npm test`): structural sweep of every dungeon x 6 seeds, runtime nets in the browser, 3 bot run-throughs.
`--full`: 40 seeds and a bot run of every dungeon x 2 seeds. `--node-only`: structural part only (no dev server needed).
