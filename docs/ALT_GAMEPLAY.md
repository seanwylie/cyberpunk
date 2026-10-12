# Alternative gameplay (hacking, speech, and the pattern for the next ones)

Rule: **an alternative style is never a hard block.** Every obstacle on the critical path opens by combat. A style only makes things faster, safer, or more rewarding.

## Audit (Oct 2026): what used to gate on a skill

| Where | Obstacle | Old gate | Critical path? | Non-hack route now |
|---|---|---|---|---|
| All 24 dungeons | `hackproc` relay → `lock2` | `hack` cap, else "Locked relay" | yes | Kill the lock elite (always spawned at stage ≤ 1). Stall watchdog force-opens after 3 min. **Plus** T0 mini-game for anyone |
| All 24 | `gate1` | gate-guard turrets | yes | Kill them, or **hack-turn them (T1)**. A turned gate turret counts as handled |
| All 24 | `controller` → boss door | none | yes | — |
| Annex | `terminal` (Neural Warden boss pick) | `hack` cap | no (optional boss pick) | Default boss. Now needs Hack T1 (augment, chip, ability or trait), not only hardware |
| Annex | `armorydoor` | `force` cap | no (side room) | Skipped |
| Warehouse | `cond_A` hack / `cond_B` defib | caps | no (boss pick) | Default boss. Hack cond now T1 |
| Foundry | `cond_A` force / `cond_B` hack | caps | no | Same |
| Clinic | `cond_A` hack / `cond_B` cloak | caps | no | Same |
| Every chip cache | `cratechip` | none | no | Open as before. Hack T1 adds a bonus chip |

`progression_sweep` now also fails a dungeon if, **with hacking disabled**, lock2 has no reachable lock elite, gate1 has no guards, or there is no controller. `tests/alt_gameplay.mjs` clears the Clinic with hack tier 0 at humanity 0 and at humanity 100.

## The pattern (`src/altplay.ts` rules, `src/altsim.ts` applies, `src/altui.ts` shows)

1. **Style**: `tierOf(style, ctx) → 0..3`, counted from explicit sources only. No hidden rules.
   - Hack: `hack` cap (augment or chip), a hacking-family ability, a hack L10 trait, a hack L20 trait.
   - Speech: `speech` cap (AS Seamless Faceplate), faction rep ≥ 40 with the dungeon maker, `speechTier` trait effects (Face, Kingpin, Grifter).
2. **Node** (`NODES`): payoff, style, min tier, short label, reward. The tooltip is always `"<Style> T<min>+ · You T<n> · <reward>"`.
3. **T0 for everyone**:
   - Hack: a timing bar (`miniFor`, `cursorAt`, `miniHit`) that takes a few seconds. F or Space stops it, Esc skips. A miss or a timeout raises the alarm: a 3-mob wave and a 4 s retry cooldown. **The node stays usable.**
   - Speech: choices with the odds shown. A failure means the target fights. One attempt per target.
4. **Teach then reward**: `firstSeen(save, style)` shows one short prompt, once per save. After that it's just an option. Every node has a consistent HUD icon (⌁ hack, ❝ talk) plus the tooltip.
5. **Signals**: `recordHack` → `hack`, `recordSpeech` → `social` (intimidate also feeds `chrome`), `recordHumanity` per run → `social` or `chrome`.
6. **Fixer hints**: `FIXER_HINTS` / `nextHint` produce Odalys lines on town return, each shown once.

### Hack payoffs
| Payoff | Tier | Effect |
|---|---|---|
| shortcut | T0 (T1+ instant) | Relay opens lock2 |
| turret | T1 | Turns a turret or cam for 20 s. Gate turrets turn permanently |
| cache | T1 | Bonus chip from the chip cache |
| shield | T2 | Boss vulnerable (+50% damage) for 6 s and stunned, once per fight |
| lights | T3 | Comes with the relay. Enemy aggro range ×0.6 for the run |

### Speech payoffs
| Payoff | Tier | Effect |
|---|---|---|
| standdown | T0 | A calm crew member or the lock elite leaves. Lock elite → lock2 opens |
| switch | T1, humanity ≥ 50 | Joins you |
| bribe | T0 | Credits (scaled by level, ×2 for elites, × vendor terms) |
| flee | T0 | Intimidate (Terrify at T2 or humanity < 25): the pack within 6 tiles flees |
| sitout | T3 | During the boss reveal: the lieutenant sits out, boss HP −20% |
| discount | T1 | Vendors −5% (stacks with humanity terms) |

Note: every dungeon's gate guards are turrets, so talking applies to crews and lock elites, and gate turrets are a hacking target.

### API for other modules (for example free-text speech in wv-npcmem)
- `speechOptions(ctx, {elite, boss, level}) → SpeechOpt[]`: the only source of options and odds.
- `speak(g, enemy, payoff, roll) → boolean`: the only way to resolve an outcome. Pass your own roll in [0, 1).
- `applyPayoff(g, payoff, enemy?)`: applies an outcome. Rules only; text never decides outcomes.
- `ctxOf(g)`, `hackTier(g)`, `speechTier(g)`, `humanity(g)`, `tooltip(payoff, tier)`, `altState(save)`.
- **AI or free-text layers may write flavor and map the player's text to one of the listed payoffs. They must never invent payoffs or odds.** The story Lambda limits apply.

### Adding a style (stealth, drones, social, bribe…)
Add the style to `Style`, `STYLE_META` and `tierOf`, add its `NODES` and their `applyPayoff` cases, give it a T0 version, a `TEACH` entry, a signal recorder and a fixer hint. Then extend `tests/alt_gameplay.mjs` with the same six checks: no hard block, T0 failure isn't a lock, tier gating, each payoff, onboarding once, and signals.
