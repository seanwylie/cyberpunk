# Simplify audit (Oct 2026)

Sean: "complexity is easy, simplicity is key." Scope: (A) the game, (B) the code.
Each item lists **impact** (what simplifying buys), **risk**, and a **recommendation**: cut / merge / tooltip (hide behind a tooltip or an advanced section) / keep.
Phase 2 (done in this pass) is marked **DONE**. Anything that removes or merges a whole player-facing system is a **PROPOSAL** for Sean and was not changed.

Standing rules: the player never gets stuck, `npm run test:perf` must not regress (docs/PERF_BUDGETS.md), keep bundle headroom, short labels with tooltips, no drug references.

## A. Game

### A1. Currencies and meters a new player sees
| Thing | What it does | Impact | Risk | Rec |
|---|---|---|---|---|
| Credits | Main money: vendors, repair bill, bank | core | - | keep |
| Rep (faction rep) | Unlocks vendor stock / ranks, speech odds | medium | med | keep, but **PROPOSAL**: show it only in the vendor/contact panels, not as a general stat |
| Heat (HUD bar) | Ability resource, vent with V | core combat | - | keep |
| Humanity (gauge) | Augments vs NPC trust | adds a second always-on meter beside Heat | med | **PROPOSAL**: hide the gauge until the first augment is installed; explain with a tooltip |
| Repair bill | Debt paid in town | a second "money" concept | med | **PROPOSAL**: auto-deduct from credits on town return, with a toast, instead of a separate bill |
| Prism Shards | Duplicate-orange protection | rare, late-game | low | tooltip (only show once the player owns one) |
| Season pass XP | Cosmetic track | separate progress bar | low | keep, but only inside the store/pass panel |
| Chips | Sockets in gear | build depth | med | keep |
| Patches (`stims` in code) | Heal consumable | core | - | keep. Code still calls them `stim*` while the UI says Patch: rename internally later (no player impact) |
| Bank + Locker + Mail | Three storage/inbox places | medium | med | **PROPOSAL**: merge Mail into the Locker as a "Delivered" tab |

### A2. HUD and menus
- Top-right toolbar has 7 buttons (Pack, Patch, Town, Minimap, Story log, Help, Menu). **PROPOSAL / merge**: move Help and Story log into the Menu panel (keys `?` and the story toast still open them directly), leaving 5 buttons. Low risk, every feature stays reachable; not done yet because 6+ HUD tests pin the toolbar layout and Sean should see the before/after.
- Toasts: ~165 `toast(` call sites. Many low-value toasts compete with legendary banners. **Rec**: add a toast priority and drop "info" toasts while in combat (code change, no feature loss). Not done in this pass; needs a play-feel check.
- Objective box, live panel, minimap, support strip, IDKFA badge all share the top-left: fine, each hides when empty. keep.

### A3. Settings (~38 rows)
| Rows | Issue | Rec |
|---|---|---|
| Upgrade recommendations + Recommendations: nudge on town return | two toggles for one feature | merge into one 3-way: Off / Badges / Badges + nudge |
| Master volume + Music (toggle) + Music volume + Effects volume | Music on/off duplicates Music volume = 0 | merge: drop the toggle, `M` mutes by setting volume to 0 and back |
| Reset instance + Unstuck + Restart from checkpoint + Abandon instance | four "get me out" buttons | **PROPOSAL**: keep Unstuck (never-stuck rule) and Abandon; fold Restart from checkpoint into Unstuck as a second step; move Reset instance under the PROTOTYPE/dev section |
| Story line after each run / Typewriter reveal / Name me in city news | story niche | tooltip: move to an "Story" sub-section |
| Moment cards / Clip buffer / Nemesis voice | feature-flag switches | keep (they are the user-facing side of the flags) |
| Use a real provider, PROTOTYPE reset, DEV tools | dev-only | hide behind the DEV tools section in production builds |

### A4. Feature flags (src/features.ts)
`nemesis`, `nemesisVoice`, `moments` are always on; `momentClip` is off and opt-in. They gate allocation (perf rule), so **keep**. Rec: fold `nemesis` into a plain constant once nemesis ships to multiplayer (no setting toggles it).

### A5. Things a new player must learn that add little
- Two progress meters on screen in the first hour (Heat + Humanity): see A1.
- Repair bill as a second debt concept: see A1.
- Personal contracts + regular contracts + story beats all on the job board: **PROPOSAL**: one board with a "For you" tag rather than separate lists.

## B. Code

| Item | Impact | Risk | Rec / status |
|---|---|---|---|
| 48 exports nothing referenced (src + tests + tools + server) | less to read | none (tsc + full tests) | **DONE**: removed |
| 19 copies of the same HTML `esc()` helper across UI panels | one place to fix escaping | none | **DONE**: `src/esc.ts` (also escapes `'` everywhere now) |
| `tests/station_label_stable.mjs` (not in `npm test`, failing 8 checks; superseded by station_label_vis + station_trigger_align) | stale test | none | **DONE**: deleted |
| `docs/..._Handoff_v1_SUPERSEDED.docx` | stale doc | none | **DONE**: deleted |
| 33 more test files not in any npm script (mostly `*_shots`, gifs, one-off probes). Run this pass: ability_labels, anim_ghost, body_variants, boss_kits, boss_resolve, build_id, gore, loot, sign_pixels, station_label_pixels, station_title, variety, variety2, walker_alpha, zones_cleanup all pass; `town_lights` times out taking a screenshot (flaky) | unclear which tests matter | low | Rec: move shot/gif generators to `tools/shots/`, add the passing probes to a `test:extra` script, fix or drop town_lights |
| Tests overwrite tracked files in `shots/` and `docs/art/` | every test run dirties the tree (this is what blocks `./update.sh client` with "uncommitted changes") | low | **PROPOSAL (high value)**: write test screenshots to an ignored `shots/out/` and stop tracking generated shots |
| `shots/` is 795 tracked images, 711 MB | slow clones, disk pressure on the box | low (history is kept) | **PROPOSAL**: stop tracking new shots (gitignore); keep the handful referenced from docs |
| `public/dungeons/source/*.jpg` (3.6 MB concept sheets) ship in the deployed client but are only read by tools | download/storage | low | Rec: `git mv` to `tools/dungeons/source/` and update the two scripts. Not done: tools paths need a re-run to verify |
| Legacy v1 multiplayer core `src/core/{party,profile,testkit}.ts` (docs say "not used by the hub") still imported by `sim.ts` / `zoneshape.ts` / tests | parallel system | med | Rec: move the few helpers sim uses into `src/net/` and delete the v1 core |
| Code says `stim`, UI says Patch | confusing for anyone reading code | low | Rec: internal rename in one commit (save key migration needed) |
| Big dense files: `sim.ts` 850 lines, `ui.ts` 651, `render.ts` 538 (long lines) | hard to review | med | keep for now; split UI panels out of ui.ts opportunistically |
| `npm test` is one 100+ step `&&` chain | first failure hides the rest | low | Rec: switch to `tools/run_tests.mjs` (already exists) with a list file |
| Unused-by-name exported types (~68, per knip) | noise | none | keep: most are documentation-style public types |
| Unused assets | checked enemies3d (all 110 ids in index), music (names built from pools) | - | no cuts found; Rec: add an asset-manifest test so orphans fail CI |
| Dead hooks that look like missing wiring, removed as dead: `recordCloakKill` (ghost trait never gets the cloak-kill signal), `setSkinFx` (no setting turns skin FX off), `harrowConditionMet` (logic lives in `harrowStatus`) | possible gaps | - | Rec: confirm cloak kills should feed the Ghost trait; if yes, wire it in sim |

## Top proposals for Sean
1. Stop tests writing into tracked `shots/` / `docs/art/` and stop tracking generated screenshots (fixes the dirty-tree `update.sh` error; 711 MB).
2. Escape options: keep Unstuck + Abandon, fold Restart-from-checkpoint into Unstuck, move Reset instance to dev.
3. Hide the Humanity gauge until the first augment; auto-pay the repair bill from credits.
4. Merge Mail into the Locker; one job board with a "For you" tag.
5. Toolbar 7 → 5 buttons (Help and Story log into the Menu, keys unchanged).
6. Settings merges: one recommendations control, drop the Music on/off toggle.

## Removed in this pass
See the commit list under "simplify:" in `git log`. Bundle (main chunk, gzip): 447.46 KB before, 447.10 KB after (dead code was mostly tree-shaken already).
