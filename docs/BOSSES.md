# Boss signature kits

Every boss (12 original, 20 from content batch 1) has a **kit** of 2-3 themed mechanics on top of its old move list. Source: `src/content/boss_kits.ts` (kits, palettes, mechanic logic), `src/content/zoneshape.ts` (shaped ground zones: disc/line/cone/ring/tile/safe/ghost, motion, forces), `src/boss_draw.ts` (telegraph art), `src/audio.ts` `bossSfx` (stingers).

## Rules every mechanic follows
- **Own telegraph language**: no two mechanics share shape+style (tested). Warn state = hatched outline/hairline, live state = filled and brightened; countdown digits/glyphs where timing matters.
- **Fair timing**: windup >= 1.0 s (>= 1.3 s for tracking lines, which freeze 0.45 s before firing); dodge i-frames cover every burst hit; one signature mechanic at a time, never during a normal attack windup.
- **Escalation by HP thirds** (`kph`): shorter cooldowns, more bombs/tiles/lines; a ring + `bk:phase` stinger marks each phase.
- **Multiplayer**: layouts (safe zones, tile order, ring gaps, ricochet paths) come from a seeded stream (instance seed + boss id + cast number), so every client draws and simulates the same thing; kill claims are unchanged.
- **Cleanup**: kit zones are tagged and removed on boss death, player death/respawn, leash reset and zone leave (tests/boss_kits.mjs).
- **Reduced FX / quality tiers**: hatching, particles and glow drop out; shapes and countdowns stay readable. Kit zone cap 26.
- Sounds: synth stingers `bk:<mech>:tell|fire`, `bk:phase`, `bk:break`.

## Mechanics
| Mechanic | Telegraph (shape / style) | Visual language | Stinger |
|---|---|---|---|
| **Rotating beam** (`beam`) | line / beam | Dashed line with rotation arrows, hairline brightens, then the beam turns | `bk:beam:tell` / `:fire` |
| **Laser grid** (`grid`) | line / lattice | Thin hairline lattice with safe cells; lit lines flash white | `bk:grid:tell` / `:fire` |
| **Scythe sweep** (`scythe`) | cone / scythe | Swept sector outline with chevrons showing direction | `bk:scythe:tell` / `:fire` |
| **Gravity vortex** (`vortex`) | disc / vortex | Concentric rings with arrows in (pull) or out (push), core saw | `bk:vortex:tell` / `:fire` |
| **Conveyor floor** (`conveyor`) | line / belt | Marching chevron belt, shredder teeth at the end | `bk:belt:tell` / `:fire` |
| **Ricochet roller** (`ricochet`) | disc / roller | Dotted bounce path with a spinning gear at the start | `bk:roll:tell` / `:fire` |
| **Tether pylons + snipes** (`pylons`) | line / snipe | Locked crosshair lines from each live pylon | `bk:pylon:tell` / `:fire` |
| **Safe zones** (`safe`) | safe / beacon | Whole arena hatched, green beacon rings with a countdown | `bk:safe:tell` / `:fire` |
| **Line-of-sight gaze** (`gaze`) | line / gaze | Eye glyph, tracking line that freezes, blocked by pillars | `bk:gaze:tell` / `:fire` |
| **Tile sequence** (`tiles`) | tile / rune | Numbered floor tiles light in order, then detonate in order | `bk:tile:tell` / `:fire` |
| **Chain bombs** (`bombs`) | disc / bomb | Fuse rings with countdown digits and tether links | `bk:bomb:tell` / `:fire` |
| **Afterimage strike** (`strike`) | line / lunge | Ghost silhouettes, lunge lane, then a slash cone at the landing spot | `bk:strike:tell` / `:fire` |
| **Heat overload** (`overload`) | safe / coolant | Shimmering heat haze with cyan coolant rings | `bk:heat:tell` / `:fire` |
| **Buff nodes** (`buffers`) | ghost / tether | Violet tethers from nodes to the boss, boss takes less damage | `bk:buff:tell` / `:fire` |
| **Gapped shockwave** (`shockring`) | ring / toll | Dashed full-size ring with one green gap arrow | `bk:toll:tell` / `:fire` |
| **Shield-break window** (`shield`) | ghost / hex | Hex shield around the boss; break it for a stagger window | `bk:shield:tell` / `:fire` |

## Kits per boss

| **Safe zones** (`safe`) | safe / beacon | Whole arena hatched, green beacon rings with a countdown | `bk:safe:tell` / `:fire` |
| **Line-of-sight gaze** (`gaze`) | line / gaze | Eye glyph, tracking line that freezes, blocked by pillars | `bk:gaze:tell` / `:fire` |
| **Tile sequence** (`tiles`) | tile / rune | Numbered floor tiles light in order, then detonate in order | `bk:tile:tell` / `:fire` |
| **Chain bombs** (`bombs`) | disc / bomb | Fuse rings with countdown digits and tether links | `bk:bomb:tell` / `:fire` |
| **Afterimage strike** (`strike`) | line / lunge | Ghost silhouettes, lunge lane, then a slash cone at the landing spot | `bk:strike:tell` / `:fire` |
| **Heat overload** (`overload`) | safe / coolant | Shimmering heat haze with cyan coolant rings | `bk:heat:tell` / `:fire` |
| **Buff nodes** (`buffers`) | ghost / tether | Violet tethers from nodes to the boss, boss takes less damage | `bk:buff:tell` / `:fire` |
| **Gapped shockwave** (`shockring`) | ring / toll | Dashed full-size ring with one green gap arrow | `bk:toll:tell` / `:fire` |
| **Shield-break window** (`shield`) | ghost / hex | Hex shield around the boss; break it for a stagger window | `bk:shield:tell` / `:fire` |

| Boss id | Kit | Palette | Mechanics (cooldown s, gate) |
|---|---|---|---|
| `teague` | Slag Line | amber | Conveyor floor (16); Chain bombs (13) |
| `brannoch` | Ladle Toll | bronze | Gapped shockwave (12); Scythe sweep (10) |
| `ore9` | Governor Protocol | cyan | Laser grid (14); Tether pylons + snipes (30) |
| `surgeon` | Operating Theatre | white | Afterimage strike (11); Scythe sweep (13); Shield-break window (34, <=70% HP) |
| `autosurgeon` | Twin Arms | ice | Rotating beam (13); Tile sequence (14) |
| `recovered` | Patient Eleven | orchid | Afterimage strike (12); Gravity vortex (15); Buff nodes (34, <=75% HP) |
| `stockmgr` | Clearance Haul | yellow | Ricochet roller (12); Chain bombs (14) |
| `retrieval` | Retrieval Magnet | blue | Line-of-sight gaze (11); Gravity vortex (15) |
| `reclaimer` | Returns Desk | magenta | Buff nodes (32); Ricochet roller (13); Safe zones (20) |
| `overseer` | Annex Oversight | coral | Tether pylons + snipes (30); Gapped shockwave (12) |
| `warden` | Neural Warden | violet | Safe zones (20); Tile sequence (13); Line-of-sight gaze (15) |
| `enforcer` | Repossession | gold | Conveyor floor (16); Scythe sweep (10); Ricochet roller (14) |
| `voss` | Oven Battery | amber | Rotating beam (12); Heat overload (22) |
| `lineman` | Live Lines | cyan | Line-of-sight gaze (11); Tether pylons + snipes (30); Laser grid (16) |
| `gantrymother` | Crane Drop | yellow | Conveyor floor (15); Laser grid (14); Buff nodes (34, <=80% HP) |
| `pitboss` | The Pit | bronze | Gravity vortex (14); Gapped shockwave (12); Ricochet roller (15) |
| `bellfounder` | Foundry Bell | gold | Safe zones (19); Shield-break window (34, <=70% HP); Gapped shockwave (11) |
| `cryo` | Deep Freeze | ice | Laser grid (13); Shield-break window (34, <=75% HP); Tile sequence (14) |
| `auditor` | Audit Trail | blue | Tile sequence (13); Afterimage strike (13) |
| `mirrorpt` | Hall of Mirrors | orchid | Afterimage strike (16); Line-of-sight gaze (19) |
| `apothecary` | Reagent Store | magenta | Chain bombs (14); Heat overload (24) |
| `resonance` | Anechoic Cell | white | Rotating beam (13); Safe zones (26); Gapped shockwave (15) |
| `clearance` | Final Markdown | coral | Conveyor floor (14); Ricochet roller (12); Tile sequence (15) |
| `liquidator` | Liquidation | bronze | Chain bombs (18); Laser grid (20) |
| `courier` | Express Route | yellow | Afterimage strike (9); Conveyor floor (16); Ricochet roller (13) |
| `dispatcher` | Fleet Uplink | cyan | Rotating beam (13); Tether pylons + snipes (30); Buff nodes (32, <=80% HP) |
| `warrantor` | Warranty Seal | gold | Safe zones (19); Tether pylons + snipes (30); Tile sequence (14) |
| `tidewarden` | Pump Hall | blue | Gravity vortex (14); Conveyor floor (16); Gapped shockwave (12) |
| `rattle` | Night Shift | coral | Afterimage strike (12); Gapped shockwave (14) |
| `breaker` | Chain Yard | amber | Scythe sweep (10); Ricochet roller (13); Gravity vortex (16) |
| `widow` | Signal Web | violet | Rotating beam (12); Line-of-sight gaze (12); Tether pylons + snipes (30) |
| `recall` | Recall Everything | magenta | Heat overload (24, <=70% HP); Laser grid (16, <=50% HP) |

## Balance check
`URL=http://127.0.0.1:PORT/ node tools/balance/bosskits_ab.mjs out.json 3` runs boss-only fights per boss at par kit; run it against a baseline dev server and the new one and compare clear rate / deaths. The harness bot is shape-aware (flees lines/cones/rings, walks to safe circles). Tests: `tests/boss_kits.mjs`, screenshots `tools/shots/boss_shots.mjs` -> `shots/bosses/`.

## Resolution audit (tests/boss_resolve.mjs)
Every ground telegraph of all 32 bosses is instrumented during a 110 s fight (HP held in thirds so every phase fires). When a telegraph's windup ends, the real `tickZone` is run on a clone with a probe target inside it and the effect is measured (damage, heat, push/pull, hook, or projectiles spawned within 0.7 s). The test fails on:
- **orphan**: no area that can ever affect anything, or no measurable effect (ghost-only visuals such as hex shields and buff tethers are exempt: their consequence is the damage-reduction window);
- **cancelled**: removed before its windup finished (found and fixed: the zone cap used to drop the oldest zones, cancelling unresolved spiral sigils; it now sheds already-fired zones first);
- **never resolves** (life <= windup), **no tell** (damaging with windup < 0.3 s), **too brief** (< 0.6 s), **negligible** (damage < 3% max HP).

Findings fixed: the gapped shockwave probe artefact (ring band moves, probe now follows it); fan/gapring volleys count as resolved by their projectiles; breaker sigils cancelled by the zone cap. Final run: 222 telegraph kinds audited across 32 bosses, 0 flagged (see the test output).

Pylons: cast once per HP phase, destroyable (1.8x HP), self-shut-down after 20 s, snipe cadence 11 s so a fight can never stall on them. Kit cadence is scaled by `KIT_CD_SCALE` (2.0) with `KIT_FIRST_ADD` (8 s).


## Hit caps
- No single kit hit exceeds `KIT_HIT_CAP` (30%) of max HP; hard mode scales kit damage at half rate.
- No single boss melee/projectile hit exceeds `BOSS_HIT_CAP` (42%) of max HP (`src/sim.ts`). Rattle's riposte under hard-mode scaling used to reach 60%.
