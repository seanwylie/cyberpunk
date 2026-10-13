# Music Direction: loneliness into rage, unease into emergency

Sean's brief, October 2026. This applies to the primary tracks (main theme, town and dungeon loops, and boss fights). Older district pools stay in rotation and the new pieces sit alongside them.

## Two poles
| Pole | Character | Palette |
|---|---|---|
| **Desolation into rage** | Raw, haunting ambient and post-rock. Quiet passages feel lonely and mournful. A simple, insistent figure repeats until it becomes frightening and relentless. There are moments of spiritual calm and of vast, unsettling emptiness. | Felt or felt-muted piano, clean electric guitar ostinato with long delay, tremolo guitar walls, feedback, bowed cello drones, tape hiss, wind |
| **Unease into emergency** | Orchestral tension, driving percussion and abrasive textures that convey urgency and mass panic. The cool counterpoint is a repeating piano line over electronic pulses, with distant wordless voices. | Taiko-like and war-drum ensembles, staccato low strings, brass-like stabs and alarms, analog pulse bass, ticking sequenced pulses, far-off wordless choir |

**Core rule:** repetition plus gradual escalation. The danger should feel inevitable. A motif is introduced quietly and never abandoned, only intensified.

## Game contexts
| Context | Direction | Tempo | Tracks |
|---|---|---|---|
| Towns (hub, safe) | Lonely or hypnotic piano over soft electronic pulses, distant voices, quiet dynamics, nothing resolves. Safe, but the world outside is felt. | 58–108 bpm | `town`, `theme_main`, `town_dir_*` (16) |
| Dungeon traversal | An insistent motif (guitar ostinato or muted piano eighths), drones, distant percussion. Tension is held and never released. | 64–108 bpm | `traversal_a/b`, `calm_dir_*` (4) |
| Dungeon combat (elite) | The same motif, distorted and driven, escalating with combat intensity. | 132–140 bpm | elite pool, plus escalation stems `elite_escalate_a/b` |
| Boss | A full wall of noise: layered tremolo guitars and feedback, war drums, brass-like swells, maximum intensity. | 120–160 bpm | `boss_fight`, `boss_reveal`, `boss_wall_*` (4, intensity 2–4) |
| Gateway clear and arrival | An ascent: a luminous swell from silence, a warm sustained chord, spiritual calm. | free | `stinger_ascent`, `clear` |
| Main theme | A lone piano motif, joined by guitar, then percussion, then a roaring crescendo, falling back to the lone piano. | 84 bpm | `theme_main` (in the Rustline town pool) |

## Escalation (runtime)
- `src/sim.ts` emits `musicint`, the number of engaged elites within 10 tiles (0–4), during elite combat only.
- `MusicManager.setIntensity` prefetches the first escalation stem at intensity 2. When intensity stays at 3 or more for 3 s, it crossfades (2 s) to an escalation stem. When intensity stays at 1 or less for 6 s, it crossfades back to the track it came from.
- The stems use a single crossfade, never a parallel layer, so only one hard track decodes and plays at a time. Memory and CPU stay the same as before. The stems are lazy and fetched only when a fight heats up.
- Ordinary single-elite fights never escalate, so the existing dwell and rotation behaviour is unchanged.

## Prompt rules (tools/gen_music.py pack 7)
- Describe instruments, tempo, key, structure and mood only.
- **Never** name films, scores, composers, bands or songs, and never ask to sound like any existing work.
- Always include: instrumental, no vocals or lyrics, seamless loop for loops.
- Keep prompts clean of banned content (see `tests/no_drug_refs.mjs`).
- Long calm tracks are encoded at 80 kbps (LOWRATE). Hard tracks and stingers use 112 kbps.

Regenerate with `python3 tools/gen_music.py --pack7 --force` (needs `ELEVENLABS_API_KEY`).

## Theme variations (pack 8)
`theme_main` measures **D minor at about 84 bpm** (`tools/motif_analyze.py`, librosa in a venv). ElevenLabs can only condition on audio from a stored song id, and none was kept for `theme_main`. So each variation prompt describes the motif explicitly: F, E, D, then a low A (scale degrees 3, 2, 1, low 5), repeated, then answered by a chromatic A, G♯, G, F♯ resolving to D over a D pedal.

| Track | Use | Measured |
|---|---|---|
| `theme_lofi_dust`, `theme_lofi_rain`, `theme_lofi_tape` | Rustline and Harrow town pools. On the first town track of a session, there's a 50% chance (`BOOT_THEME`) one of them plays, unless it is in the recent-play history. | D minor, 83 bpm |
| `boss_theme_wall`, `boss_theme_siege`, `boss_theme_storm` | Boss pool (intensity 4, 3 and 4). `storm` is also an elite escalation stem. | D minor or D, double or triplet readings of the same pulse |

A variation is regenerated when it drifts. It passes when it has the same key, or a chroma correlation of at least 0.8 with the theme, and a tempo within 6% of 84 bpm at a half, 2/3, 1, 4/3, 1.5 or 2 multiple. The first takes of `theme_lofi_rain` (B♭ major) and `boss_theme_siege` (C minor) drifted and were regenerated.

## Endings and seams
- Calm tracks, `theme_main` and the lo-fi themes never loop in game. They keep their composed ending and get a 4.5–5.5 s fade.
- Hard loops (`combat_`, `boss_`, `elite_`) are trimmed to their steady body, without the generated intro swell or outro fade. The tail is blended into the head over 3 s, with a static gain and no limiter, because a limiter's look-ahead shifts the seam.
- `tools/check_music_tails.py` checks both rules. `tools/fix_music_endings.py` repairs from the shipped mp3.
- In game, `MusicManager.tailGuard` ramps any non-looping track that is about to end to silence, so nothing ever hard-stops.

## Strict ending rule (Oct 12)
Every file in `public/audio/music`, loops included, must end with a smooth fade of at least 4 s, and its final 0.5 s must be below -45 dBFS. `tools/check_music_tails.py` enforces this and `tests/music.mjs` fails on any violation.
- **Hard loops:** the file is the seamless loop body, then the first 4.5 s of that body faded out, then 0.5 s of silence. The loop point goes in `src/music_loops.ts` (generated). In game the source loops `0..loopEnd` sample-accurately (`src.loopStart/loopEnd`), so the faded tail is never heard. The loop seam is the original blended seam.
- **Everything else:** a 4.5 s ring-out (a light echo tail where the file is short) faded to silence.
- `tools/fade_all.py` applies the rule. It is idempotent and makes the fade steeper when a loud passage would bump it.

## theme_main_long
`tools/extend_theme.py` re-arranges theme_main's own audio at its phrase downbeats (4 bars at 84 bpm), using equal-power one-beat crossfades, so it is literally the same music. It follows Sean's shape: intro/A, dip 1, build 1, dip 2, build 2, a hard dip (near-silent lone piano), a final build to the biggest climax, then a long fade (241 s). `tools/theme_envelope.py` checks the shape and draws `docs/img/theme_main_long_envelope.png`: peaks −18.3 < −14.5 < −11.4 dB, troughs −34.2 / −34.4 / −45.6 dB. In game, a quarter of boot-roll hits (in Rustline, the starting town) open the session with it, and it plays through to its ending.

## Snare-forward bosses (pack 9)
The boss prompts now open with a drum-style description: a crisp, prominent snare, rolling fills into each section, 16th- and 32nd-note snare rushes before drops, and ghost-note grooves. It names no artists. `tools/snare_ab.py` compares onset density and flux in the 150–250 Hz and 2–6 kHz bands against the previous takes.
