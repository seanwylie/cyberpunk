# Abilities: the power pass

Sean: "abilities are not useful at all, we should stress the use of them." This pass makes the 3 ability buttons the main way you fight; auto-attacks are filler that builds heat. All numbers live in `AB` and `ABILITIES` in `src/config.ts` (enemy HP retune in `BAL.g.hp`, `src/content/balance.ts`). Measured with `tools/balance` (`abilshare.mjs`); before/after table in `docs/BALANCE.md`.

## The loop
- **Auto-attacks are weaker (x0.45 damage) and hot (x2.4 heat).** A spammed ripper/pistol runs toward overheat (abilities offline, damage x0.5), so you want to spend heat through abilities.
- **Abilities cost less heat, cool down faster and hit harder.** Damage per heat: Sweep 8.0 vs auto 2.0 (test asserts >3x).
- **Heat-spend reward:** an ability cast with heat banked is CHARGED: +0.5% damage per heat point held (max +40%).
- **Combo chain:** a *different* ability within 3s of the last stacks +15% (max 3 stacks). Popup: `COMBO x2 +15%`.
- **Momentum:** killing with an ability refunds 0.8s on all cooldowns. A short hit-stop and screen kick sell the kill (off with Reduced FX).
- **Overclock:** Forced Cooling and Perfect Evade give +30% ability damage for 5s / 3s.

## Abilities (before -> after)
| Ability | Heat | Cooldown | Effect now |
|---|---|---|---|
| Powered Sweep | 24 -> 14 | 4 -> 3s | 34 -> 85 damage in a wide arc, shove, **staggers 0.7s**; "CLEAR xN" for 3+ hits |
| Blade Burst | 22 -> 14 | 5 -> 4s | 30 -> 90 damage through everything, **0.3s invulnerable** (was 0.2), 0.5s stagger |
| Disruption Pulse | 20 -> 14 | 6 -> 5s | 22 -> 55 damage, 1.2 -> 1.8s stun, radius 2.8 -> 3.2, **SHIELD-BREAK: 4x vs shields (min 45% of the shield)**, breaks stagger +50% damage |
| Enemy Control | 30 -> 20 | 12 -> 9s | turns one enemy for 8s; **mass stun: everything within 3.8 tiles is pulled in, stunned 1.6s, takes 45 overload damage and is HACKED (+40% damage taken for 6s)**. Elites/bosses/pylons resist: stun 2s/1s + hacked |
| Bracing | 14 -> 10 | 9 -> 7s | 60% -> **75% less damage** for 3.5s, **reflects 150% of what you take** to the attacker (cap 120), a charging attacker is **counter-stunned 2s**, shoves adjacent enemies, clears slows |
| Reposition | 12 -> 8 | 6 -> 4s | dash-strike 50 damage along the path + stagger, invulnerable 0.14 -> 0.32s. **Cast into a telegraph = PERFECT EVADE**: cooldown drops to 1.5s, -12 heat, +30% abilities for 3s |
| Cloak | 20 -> 12 | 10 -> 8s | next hit is an **AMBUSH crit**: autos x3 (was x2), abilities x2.5, and the damage is credited to Cloak |
| Forced Cooling | 0 | 10 -> 8s | vent 70 heat, weapons offline 2 -> 1.2s, **OVERCLOCK** (+30% abilities 5s) and other cooldowns -2s |
| Team Revival | 18 -> 16 | 6 -> 8s | was inactive solo; now **Rally**: heal 30% HP + 60-damage shockwave with 1.2s stun (still revives a party member) |
| Self-Defib | passive | | unchanged; now has its own arc/glow effect |

## Enemies that need abilities
- **Shielded mobs and boss shields:** autos do 35% to a shield, abilities 150%, Pulse 400%. Breaking a shield staggers (+50% damage). "Shield: use Pulse".
- **Healers/support** (Mender, Relay Node...): Control stuns and hacks them (stunned casters cannot cast). "Healer: use Control".
- **Chargers** (Scrap Ram, Shift Stalker, Rebar Crusher): Brace through the charge = counter-stun; Reposition dodges it. "Charger: Brace".
- **Telegraphed AoE** (casters, bosses): Reposition into the telegraph is a perfect evade.
- **Summoners/swarms:** Sweep clears adds and staggers the pack.
- **Elite affixes:** regenerating stops healing for 3s after any ability hit and heals 4%/s otherwise (burst it); vampiric/hasted -> stun with Control; volatile -> stun and kill at range; shielded -> Pulse.
- Control cannot turn boss pylons any more (a bot found that it softlocked the Overseer).

## Guidance in game
- Counter icon over every alerted enemy (small medallion of the ability that answers it, with the hotkey; bright when ready, dim on cooldown, faint if not equipped).
- First-time toasts per trait ("Shield: use Pulse [E]", "Healer: use Control [R]") stored in `localStorage.wv_abhints`.
- Low-use nudge: 16s of combat with no cast and an ability ready: "Abilities are ready: Sweep [Q] hits far harder than auto-attacks." (once per 40s)
- Tooltips list the numbers (damage, stun, reflect, shield multiplier, cooldown, heat).

## Visual effects (src/vfx.ts, src/vfxdraw.ts)
Pooled particle system (700 / 260 / 100 particles on High / Medium / Low, 36 with Reduced FX), iso world space, additive blends, per-event emitters. The sim only pushes events (`g.vfx('sweep.cast', ...)`).
| Ability | Cast | Impact |
|---|---|---|
| Sweep | arc streak fan + shockwave ring + debris at the tips | sparks + debris per target, CLEAR popup |
| Blade Burst | afterimage ghosts and streaks along the lunge | X-slash flurry + sparks + local bloom |
| Pulse | double expanding ring, rune glyph, radial sparks | shard shatter on shield break, "SHIELD BREAK" |
| Control | contracting pull rings, tether arc to the target, rune | rings + stun stars on each pulled enemy |
| Brace | hex barrier burst; persistent rotating hex shell | hit ripple at the impact side, reflect arc + flash |
| Reposition | ghost afterimages, streak, footprint dust | spark burst; PERFECT EVADE ring + bloom |
| Cloak | rising shimmer motes, ghost | AMBUSH slash trio + ring + bloom |
| Forced Cooling | steam puffs + frost shards | OVERCLOCK ring around the player while active |
| Revive / Defib | electric arcs, ring, glow | |
Status icons over enemies: stunned (orbiting stars), hacked (diamond with countdown), staggered/shield broken (cracked shield), controlled (dashed tether + hex ring). Aim previews are colour-matched to the ability type with the true areas (Sweep arc, Burst line, Pulse radius with shielded targets highlighted gold, Control pull radius, Reposition path with a green ring when it would be a perfect evade).
Photosensitivity: local blooms go through `flashguard.ts` (max 3/s, alpha capped), there are no full-screen flashes, and Reduced FX removes blooms, additive glows, hit-stop, shake and most particles.

## Tests
- `tests/ability_e2e.mjs`: every ability by pointer, key and touch, plus sim-level asserts for each synergy (stagger, shield-break, mass stun + hack, reflect, counter-stun, ambush, perfect evade, overclock, combo, kill refund, rally, damage per heat, first-shield hint).
- `tests/ability_vfx.mjs`: every ability spawns cast/impact effects, caps per tier, Reduced FX has no blooms, flash guard, defib effect. `SHOTS=dir` writes frame strips; `tools/ability_vfx_sheet.mjs` builds `docs/art/ability_vfx/contact_sheet.png` (before/after rows).
