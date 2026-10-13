# Cosmetics variety brief

Rule: within a slot, every item has its **own silhouette, shape and material**, not only a colour swap. Each one has to read at
gameplay zoom (about 40 px tall) and in the 48 px store/locker icon. Art direction is LoL/Arcane painterly: premium and restrained,
with clean big shapes, one accent material and glow used sparingly. The pieces are real meshes on the rig (tools/sprites/cos3d.py),
rendered per item. Colours come from the item's `c` / `c2`, so the model always matches the store swatch.

Silhouette families are listed per slot so that no two items share a family unless their materials differ strongly.

## HD: Head (phase 1)
| Item | Concept: silhouette / shape / material |
|---|---|
| head_cap Shift Cap | Low soft crown with a long **forward bill**. Matte canvas, single stitched seam. |
| head_bandana Rag Bandana | **Knotted brow band**, two ragged tails flying out the back. Soft cloth, frayed edges. |
| head_goggles Welder's Goggles | Two chunky **round brass cups** pushed up on the forehead, amber glass lenses, leather strap. |
| head_resp Filter Respirator | **Lower-face snout** with twin canisters angled out at the cheeks. Rubber mask, metal cans. |
| head_visor Audit Visor | **Thin wraparound bar** across the eyes, glossy slate glass, minimal frame. Flat and narrow. |
| pm_head_nightvisor Night-Shift Visor | **Tall angular shield visor** with a raised fin over the crown. Violet glowing glass, chrome frame. |
| pass_s1_visor Saint's Visor | **Winged visor**: glass band with two swept ivory wings at the temples. Pale blue glow. |
| head_horns Ram-Horn Brackets | Two thick **curling ram horns** from the temples. Forged iron with rust-red enamel bands. |
| head_mast Relay Mast | **Single tall thin antenna** off one side of the skull, a small housing and a glowing bulb tip. Asymmetric. |
| head_halo Compliance Halo | **Thin flat floating ring** above the head. Pure pale light, no metal. |
| pm_head_vigil Vigil Halo | **Clock-face halo**: a ring with 12 tick spikes and a single hand. Violet light and silver. |
| col_hextech_halo Saint's Halo | **Gilded sunburst halo** standing up behind the head (vertical disc of gold rays). |
| head_crown Reclaimer's Crown | **Squat welded crown** of uneven salvage tags and bolts. Brass, hammered and uneven. |
| ex_world_first_gateway Gateway Breaker Crest | **Tall pointed arch crest**: a central spire flanked by two blades, with a gem in the brow. Gold, orange glow. |
| head_cowl Warrantor's Void Cowl | **Full deep hood** shading the face, with a pointed back peak and a glowing orange seam down the centre. Black cloth. |

Other slots (AU, BK, PT, EM, TR, SK, HR, EY, TT, torso/arms/hands/legs, weapons) get their table here in their own phase,
before their art is generated.
