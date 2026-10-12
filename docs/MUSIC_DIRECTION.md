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
- No drug references (see `tests/no_drug_refs.mjs`).
- Long calm tracks are encoded at 80 kbps (LOWRATE). Hard tracks and stingers use 112 kbps.

Regenerate with `python3 tools/gen_music.py --pack7 --force` (needs `ELEVENLABS_API_KEY`).
