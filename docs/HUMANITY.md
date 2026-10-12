# Humanity

A per-character stat from 0 to 100: `100 − Σ humanityCost(installed augments)` (`src/altplay.ts`). Gear is per character, so humanity is too.

**Cost** = rarity base (grey 0, green 1, blue 2, purple 5, orange 9) × slot invasiveness (brain 1.6, torso 1.4, face 1.3, arms 1.1, hands and legs 0.9, feet 0.5). Each item then adds +1 for a weapon, +1 per non-speech capability and +0.5 per ability, and −1 if it carries the speech capability. `ItemDef.hum` overrides the formula. Stock gear costs 0.
- Rough totals: a full green build is about 81, full blue 67, full purple 45, and full orange 0. Three orange signatures alone take you to about 57 (Mixed). Orange keeps its power but costs your humanity.
- The cost appears in the catalog (`humanity`, plus a "Hum" column), the build snapshot (`h`), the "What changed" diff (`humanity` kind), locker tooltips (cost plus a delta, for example "−16 Humanity: persuasion odds down"), build-inspector tiles, and the HUM gauge in the locker and the Build tab. The gauge is visible, not a hidden meter.

| Band | Range | Effect |
|---|---|---|
| Human | ≥ 70 | Talk/persuade odds + up to 20%. Persuade (switch sides) available from 50. Vendors ×0.92 |
| Mixed | 35–69 | Neutral |
| Chromed | 15–34 | Talking down needs Talk T1, intimidate odds up. Vendors ×1.06, ×1.15 in Aldane Spire. Cyberpsycho damage bonus starts below 35 |
| Cyberpsycho | < 15 | Talk and persuade are gone and Terrify is unlocked. Up to +8% damage. Aldane Spire vendors refuse (optional vendors only) |

**Traits**: each town return records humanity as a small `social`/`chrome` signal. Face, Silver Tongue and Kingpin favor high humanity. Full Chrome, Ironclad and Cyberpsycho favor low. Hybrids (Con Artist = hack + social, Heavy = chrome + social) keep mixed builds possible.

**No hard block**: humanity never touches doors. `tests/alt_gameplay.mjs` clears with hacking off at humanity 0 and 100, and `progression_sweep` stays clean.

Not built yet: guards turning hostile in high-humanity districts, and loss-of-control episodes (`PSYCHO` constants are reserved, nothing uses them yet).
