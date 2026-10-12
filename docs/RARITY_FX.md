# Rarity FX: legendary (orange) and epic (purple) cosmetics

`src/cosfx.ts` is called at the end of `drawCosmetics()`. That means the local player, other players in multiplayer (`net/remote_render.ts`, owner `net:<id>`) and the dressing-room model (owner `dr`) all get the same effects.

## Orange (legendary): reads as the top tier at a glance
* **Shared layers:**
  * A floor "crown": a bright ring, rotating light ticks and a soft light pillar.
  * Ambient rising embers.
  * A scanline/pulse sweep up the body.
  * A head glint.
* **Idle flourish** every 7 s: a spiral spark burst plus the `cos_flourish_orange` sound (local player and dressing room only).
* **Moving trail:** pooled particles left in screen space behind the character.
* **Signature per skin** (`SIGNATURE`; every orange cosmetic must have one, enforced by the test):

| Skin | Signature |
|---|---|
| hair_flame Foundry-Fire Mane | plasma flame crown (flickering tongues + rising sparks) |
| head_cowl Warrantor's Void Cowl | liquid chrome seam (chrome drips + pulsing seam) |
| eyes_sun Furnace-Heart Gaze | furnace gaze beams that sweep with facing |
| torso_nova Heartstar Casing | plasma veins branching from a pulsing core |
| back_wings Cinder Wings | cinder wingbeat (flapping ember sheets + falling cinders) |
| skin_holo Starforged Hologram Skin | holographic glitch (hue scanlines, slice offsets, RGB edge split) |
| aura_nova Heartstar Corona | nanoswarm corona (orbiting swarm, depth-sorted in front of and behind the body) |

## Purple (epic): aspirational but clearly below orange
* A soft violet floor glow and a single ring, with no pillar, crown ticks or flourish.
* A slow sheen band, and a light sparkle accent of about 2.5 particles/s (orange spawns about 14/s, plus bursts and trail).
* A **distinct accessory silhouette per skin slot** (`ACCESSORY`): crest spikes, a ticking halo ring, a visor glint, shoulder fins, bracers, knuckle orbs, ankle fins, hovering back shards, a body outline, a glowing glyph, an orbiting mote.

## Dressing room and tiles
* **Entrance:** selecting a purple or orange piece plays a beam from above, an expanding burst ring and a tinted spotlight, plus the equip sound.
  * Orange gets a wider beam, a double ring, a white flash and a 2.2 s reveal.
  * Purple gets a 1.4 s reveal.
* **Showcase (▶):** turns the model 45° every 1.6 s and replays the reveal every 5 s.
* **Equip sounds:** Apply plays `cos_equip_orange` or `cos_equip_purple` for the top tier worn.
* **Tiles** (dressing room and store grids):
  * Orange gets a spinning conic gold border (`@property --rfa`), an outer glow and a light sweep.
  * Purple gets a soft sheen and glow.
* Sounds were generated with ElevenLabs via `tools/gen_sfx.py cos` and saved as `public/audio/sfx/cos_*.mp3` (~7–9 KB each). They are lazy-loaded and rate-limited.

## Budget
* **One shared particle pool** of `POOL_MAX`=240 for everyone. When it is full, spawns are dropped, never allocated.
* **Cached glow sprites** (one 64px radial sprite per colour), drawn with `drawImage` rather than per-frame gradients.
* **Quality:** high spawns at 1×, medium at 0.6×, low at 0.3× and also skips the scanline sweep.
* **Reduced FX** (Settings, `body.reducefx`): the layers are frozen (t=0), with no particles, flourishes, beams or sweeps. Static glows and the crown stay so the tier still reads. Tile animations stop, as they do under `prefers-reduced-motion`.
* **Measured:** 12 characters all in full orange cost about 1.5 ms/frame for the FX layer (budget 4 ms).
* **Also run with this change:**
  * `tests/townperf.mjs`: OK at all sizes, with no cosmetics equipped.
  * `tests/memory.mjs`: no growth.

## Tests and media
`tests/rarity_fx.mjs` checks:
* Every orange skin has a signature, animated layers and particles, and the FX layer alone animates.
* Every purple skin has an accessory.
* The orange set beats the purple set on pixel energy, warm pixels and particles, and the same is true for a single slot pair.
* Purple reads as violet.
* The moving trail produces more particles than idle.
* Reduced FX freezes the layer.
* Perf stays within budget, and low quality scales the particles down.
* The reveal plays, the tile animations work and stop under Reduced FX, and the sounds play and their files exist.

Media in `shots/rarity_fx/`:
* `world_orange.png`, `world_purple.png`
* `reveal_orange.png`, `reveal_purple.png`
* `dressing_orange_showcase.png`
* `world_orange_idle.gif/.webm`
* `showcase_orange.gif/.webm`

No new Blender sprite frames were needed: the effects are procedural layers composited over the existing 8-direction sprite.
