# Rarity FX (painterly, stylized, restrained)

The v1 rings, pillars, embers, scanlines and spark bursts are gone.

- **Look:** flat-shaded painterly shapes with ink outlines and tapered brush strokes. Four limited palettes live in `PALETTES`: arcforge blue/gold, shimmer pink/purple, chem-punk green, and forge. Each orange item has its own `SIGNATURE` (an fx type plus a palette).
- **On the model:** inlays, crystal growths and accessories are drawn per slot (`ACCESSORY`). There is no floor ring.
- **Motion:** `flourishCurve` runs anticipation (0–.12 s), then a snap (to .26 s), then a soft settle (to 1.1 s).
- **When effects play:**
  - Orange idles with a subtle breathing motion.
  - A brush smear trail appears only while the character moves.
  - The full flourish plays only on ability impact, emote, or the dressing-room reveal (`flourish(owner)`).
- **Purple:** accessories plus a rim highlight. It stays subtle.
- **Gear and augments:** purple/orange gear gets small inlays and at most 4 glints (`drawGearFx`), always below the cosmetic tier. Gear particles are off when an orange cosmetic is worn, which caps the combined effects.
- **Reveal:** recall-style painterly wash, then a framed splash card (gold corners on orange) with a name plaque. It lasts 3.4 s.
- **Sound:**
  - Equip sound plays at gain .35.
  - Flourish sound plays at gain .22, at most once every 25 s.
- **Budget:** shared pool of 240. Reduced FX turns off the trails and flourish particles. Perf test: 12 orange characters at 1.6 ms/frame against a 4 ms budget.
- **Tests and media:** `tests/rarity_fx.mjs` writes to `shots/rarity_fx/`; v1 "before" copies are in `shots/rarity_fx/before/`.
- **Flag:** `?skinfx=0` or `localStorage['flag.skinfx']='0'` turns off all skin and gear FX (`setSkinFx`). Use it as a kill switch if the perf gate trips.
