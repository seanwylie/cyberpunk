# Cosmetics variety brief

Rule: within a slot, every item has its **own silhouette, shape and material**, not only a colour swap. Each one has to read at
gameplay zoom (about 40 px tall) and in the 48 px store/locker icon. Art direction is painterly and stylized: premium and restrained,
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
| Saint's Halo (collection reward) | **Gilded sunburst halo** standing up behind the head (vertical disc of gold rays). |
| head_crown Reclaimer's Crown | **Squat welded crown** of uneven salvage tags and bolts. Brass, hammered and uneven. |
| ex_world_first_gateway Gateway Breaker Crest | **Tall pointed arch crest**: a central spire flanked by two blades, with a gem in the brow. Gold, orange glow. |
| head_cowl Warrantor's Void Cowl | **Full deep hood** shading the face, with a pointed back peak and a glowing orange seam down the centre. Black cloth. |

Other slots (AU, BK, PT, EM, TR, SK, HR, EY, TT, torso/arms/hands/legs, weapons) get their table here in their own phase,
before their art is generated.

## TR: Torso (phase 2)
The three body-part shells (Kestrel, Harrow, Aldane) already swap the whole torso mesh. Every other torso item is a worn piece over the jacket:
| Item | Concept: silhouette / shape / material |
|---|---|
| Hazard-Stripe Tabard | **Long front and back cloth panels** down to mid-thigh, with diagonal stripe bands and a rope belt. Soft cloth. |
| Reflective Safety Vest | **Bulky open vest** with a high collar, two bright reflective bands and chest pockets. Padded fabric. |
| Chevron Plate | **Three stacked V-plates** down the chest and a wide shoulder bar. Painted metal. |
| Status Light Array | **Crossed harness straps** with a vertical column of glowing pods. Webbing and light. |
| Ward 9 Surgical Gown | **Loose flared gown** past the hips, wrapped, with a tie. Thin cloth that hangs. |
| Exposed Heat Core | **Ribbed armour shell with a round reactor port** and a glowing core in the chest. Heavy metal. |
| Heartstar Casing | **Smooth casing with a blazing star core**, four radiating fins and round shoulder domes. Gilded metal and light. |
| Ledger Plate | **Tall flat riveted plate** with a rolled scroll across the top. Brass and enamel. |
| Recall-Yard Cuirass | **Full breastplate with a centre ridge** and three overlapping faulds over the hips. Stamped steel. |
| Lattice Plate | **Open diamond lattice cage** over the chest with lit seams top and bottom. Violet metal and light. |

## LG: Legs (phase 2)
Shells swap the leg mesh. The worn pieces sit on the thigh, knee and ankle joints, so they bend with every step:
| Item | Concept: silhouette / shape / material |
|---|---|
| Hi-Vis Leg Stripes | **Thin reflective rings** on the thighs and shins, plus reflector tabs. Tape. |
| Cargo Utility Legs (new) | **Bulging side pockets**, big domed knee pads and taped ankles. Canvas. |
| Runner Wraps (new) | **Spiral cloth wraps** from knee to ankle, sandal straps over the boots and a thigh sash. Cloth. |
| Slag-Plate Greaves | **Chunky shin and thigh plates** with domed knee cops. Scorched metal. |
| Plated Tassets (new) | **Armour skirt** of overlapping plates hanging from the hips. Steel and enamel. |
| Hydraulic Struts (new) | **Exposed pistons down the backs of the legs** with a knee hub. Ceramic and steel. |
| Strider Light Rails | **Slim glowing rails** on the outsides of the legs, with knee pods. Light. |

## AR: Arms (phase 3)
| Item | Concept: silhouette / shape / material |
|---|---|
| Cable Wraps | **Spiral ties and tape** round the forearms, with a loose cable end. Rubber and tape. |
| Tarp-Cloth Sleeves | **Loose sleeves flaring wide** at the elbow. Rippled cloth. |
| Fin-Blade Bracers (new) | **A long curved fin** along the outside of each forearm, over slim bracers. Ceramic. |
| Exposed Piston Sleeves | **Brass pistons** along the upper arm and forearm, with an elbow gauge. Brass. |
| Lit Conduit Bracers | **Slim bracer shells** with one lit conduit line from elbow to wrist. Enamel and light. |
| Warden Pauldron (new) | **One huge layered pauldron** on the left shoulder only, with a chest strap. Asymmetric. Steel. |
| Foundry-Fused Arms | **Heavy blocky plates** with glowing weld seams. Scorched metal. |

## HN: Hands (phase 3)
| Item | Concept: silhouette / shape / material |
|---|---|
| Work Gloves | **Thick gloves with big flared cuffs**. Leather. |
| Clinic Nitrile | **Snug thin gloves with long cuffs** up the forearm. Smooth rubber. |
| Scrapper Claws (new) | **Three long curved claws** off the back of each hand. Steel. |
| Signet Knuckles | **Brass knuckle bar** with a round crest plate. Brass. |
| Press Gauntlets (new) | **Oversized armoured fists** with knuckle spikes and wide cuffs. Steel and brass. |
| Ember-Palm Grips | **Open-backed grips with glowing palms**. Metal ring and light. |

## BK: Back (phase 3)
| Item | Concept: silhouette / shape / material |
|---|---|
| Salvage Rucksack | **Boxy pack with a bedroll on top** and a side pouch. Canvas. |
| Trailing Cable Tail | **Thick cable hanging in a long S-curve** to the knees from a spine socket. Rubber. |
| Tarp Cape | **Long tattered cape** to the calves. Rippled tarp. |
| Hazard-Stripe Cape | **Short square cape** to the waist with a stiff collar. Stiff fabric. |
| Heat Vent Stacks | **Two tall exhaust stacks** over the shoulders with flared caps. Steel. |
| Coolant Tank Rig | **One fat horizontal cylinder** with a glowing window and ring brackets. Enamel and glass. |
| Relay Antenna Array | **Three whips of different heights** fanning out, with lit tips. Thin metal. |
| Reclaim Banner | **Tall pole with a hanging rectangular banner** over one shoulder. Cloth. |
| Twin Banners (collection) | **Two narrow flags on crossed poles**. Cloth. |
| Exposed Ceramic Spine | **Vertebrae column rising past the head** with rib spurs. Ceramic. |
| Warrant Disc | **Huge flat brass disc** with a rim and a glowing boss. Brass. |
| Founder Plate (collection) | **Tall shield plate** with a pointed foot and a crest block. Blackened brass. |
| Storm Halo Wings | **Narrow upswept folded wings** with crackling light edges. |
| Cinder Wings | **Broad spread layered wings**, with ember feathers. |
| Liquid-Chrome Wings | **Smooth curved blades sweeping down**, with a glowing edge. Chrome. |
