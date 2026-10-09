# Instance reset, ranged weapons and dungeon guidance (decision log)

## Reset instance (spec: Instances & lockouts, Primary Requirements / Representative Dungeon)
Spec facts: entry alone never consumes the daily clear; boss completion does; a completed instance persists for loot but never grants a new boss kill; town trips don't reset retention.
Decisions:
- **Unfinished instance** → "Reset instance" is free (confirm dialog). Abandons instance state, discards uncollected/unloaded loot, refunds carried stims, **keeps the repair bill**, and in a run restarts a fresh instance in the same dungeon at the entry. Available in: dungeon select (live card), Settings/menu (in run and in town), end-of-run summary ("Quick re-run").
- **Completed instance (lockout consumed)** → free reset is **not** allowed (it would be a second boss kill). The button is disabled with the reason. "Abandon only" still lets the player forfeit remaining loot. A clearly labelled Settings toggle **"PROTOTYPE: allow resetting cleared dungeons"** (default off) enables it and refunds that dungeon's lockout. Dev panel "Reset daily lockout" still works.
- **Restart from checkpoint** (menu, in run): returns to the last checkpoint with full HP/heat, no state wipe, boss reveal re-armed if the boss is alive. Hardware breakage is only restored by checkpoints/down recovery, as before.
- **Dev hotkey `\`** (or dev panel button): wipes instance + lockout and restarts the current dungeon from the entry.
- Open spec items unchanged: timer anchor/timezone for daily reset.

## Ranged weapons (UX spec: auto attacks, deliberate ability aiming)
Weapons are hardware (handR; the arm-mounted Shard Thrower sits in armR and is used when no non-stock handR weapon is equipped). Auto-attack targeting is unchanged (nearest eligible or tapped target); abilities remain the deliberately-aimed layer. All values are PLACEHOLDERS.
| Kind | Item(s) | Mfr | Dmg | Rate | Range | Heat | Notes |
|---|---|---|---|---|---|---|---|
| popper | Standard Issue Right Hand (default) | MM | 6 | 1.7 | 5 | .5 | weak, fires while moving: default is no longer melee-only |
| autopistol | Kestrel Pocket Auto I/II | MM | 7.5 | 3.2 | 6.5 | .9 | cheap, fast |
| burst | AS Needle Burst Rifle (blue/purple) | PS | 9×3 | .95 | 9 | 1.0/round | efficient, long reach |
| shard | HB Shard Thrower Arm, Foundry Shard Battery | HI | 5 pellets | 1.15 | 5.5 | 2.6 | scatter, hot |
| arc | AS Chain-Arc Caster, Kestrel Shock-Tack | PS/MM | 11 (−30% per jump) | 1.5 | 6.5 | 2.4 | hitscan chain of 3 |
| slug | Kestrel Slug Driver, HB Foundry Slug Cannon | MM/HI | 30 | 1.5 | 8.5 | 3.4 | stationary only |
Rarity multiplies weapon damage (grey 1.0, green 1.1, blue 1.25, purple 1.45, orange 1.75). Projectiles are tinted by manufacturer (HI oxide, PS pale blue, MM olive). Dev panel has "grant + equip" buttons per weapon. Loot: Annex/global pools, Foundry (shard, slug cannon), Clinic (needle rifle, arc caster), Warehouse (autopistol, shock-tack).

## Dungeon guidance
Objective strip + pathed arrow (BFS around walls), objective beacon/edge marker, minimap with fog-of-war, checkpoints, objective and alerted enemies. Zone-entry banners with the next objective. Checkpoint rings show reached/current; first touch heals 40% and vents heat (pacing). Stronger enemy telegraphs (brighter fill ramp, flash in the last 30%, "!" marker). End-of-run summary modal (time, kills, loot recap, return/re-run).
