// Appearance / wardrobe content: cosmetic-only items and body mods. See docs/APPEARANCE_ITEMS.md.
// Cosmetics NEVER change stats (no stats field exists). Rarity reuses the existing RARITIES colour scheme
// (grey < green < blue < purple < orange). Per Sean: green/blue are aspirational, purple is the top *practical* tier
// (late-boss drops), orange is extremely rare (event rolls / marathon achievements only, lowest drop weight by far).
import type { Rarity } from '../config';
import type { Variant } from '../bodyvariants';

export type CosSlot = 'hair'|'head'|'eyes'|'torso'|'arms'|'hands'|'legs'|'back'|'skin'|'tattoo'|'aura'|'trail';
export const COS_SLOTS: CosSlot[] = ['hair','head','eyes','torso','arms','hands','legs','back','skin','tattoo','aura','trail'];
export const COS_SLOT_LABEL: Record<CosSlot,string> = { hair:'Hair', head:'Headgear', eyes:'Eyes', torso:'Torso', arms:'Arms', hands:'Hands', legs:'Legs', back:'Back', skin:'Skin & body mods', tattoo:'Tattoos & marks', aura:'Aura', trail:'Trail' };
export const COS_SLOT_ICON: Record<CosSlot,string> = { hair:'HR', head:'HD', eyes:'EY', torso:'TR', arms:'AR', hands:'HN', legs:'LG', back:'BK', skin:'SK', tattoo:'TT', aura:'AU', trail:'TL' };
/** Which prebaked body layers a slot's `variant` override (real art) replaces. */
export const COS_BODY_LAYERS: Partial<Record<CosSlot,string[]>> = { torso:['torso'], arms:['armL','armR'], hands:['handL','handR'], legs:['legL','legR','footL','footR'] };

export type CosTheme = 'HI'|'PS'|'MM'|'ST'|'EV';
export const COS_THEME_LABEL: Record<CosTheme,string> = { HI:'Harrow-Brandt Heavy Works', PS:'Aldane Surgical', MM:'Kestrel Value Systems', ST:'Independent / street', EV:'Basin legends & events' };
export type CosSource =
  | { k:'vendor'; price:number }          // Outfitter / Wardrobe counter, credits
  | { k:'premium'; cents:number }         // simulated IAP skin (src/store.ts). grey..orange (premium tier pm_* only); never rolled from drops; earn-only orange is never sold
  | { k:'drop' }                          // any elite/boss/ordinary cosmetic roll
  | { k:'elite' }                         // elite+ rolls only
  | { k:'boss' }                          // any boss kill
  | { k:'bossId'; boss:string }           // that boss only
  | { k:'ach'; key:string }               // achievement
  | { k:'event'; key:string };            // rare event roll (very low weight)

export interface CosDef {
  id:string; name:string; slot:CosSlot; rarity:Rarity; theme:CosTheme;
  /** procedural style key interpreted by src/cosmetics.ts */ style:string; c:string; c2?:string;
  desc:string; lore:string; src:CosSource;
  /** real art: swap that body part to a manufacturer's prebaked layer set (appearance only, no hardware) */ variant?:Variant;
}

type Row=[id:string,name:string,slot:CosSlot,rar:Rarity,theme:CosTheme,style:string,c:string,c2:string,desc:string,lore:string,src:string];
// src grammar: v:<price> | d | e | b | b:<boss> | a:<key> | ev:<key>
const R:Row[]=[
// ---- HAIR ----
['hair_buzz','Regulation Buzz','hair','grey','ST','buzz','#4a443c','','Clipped to the scalp. Nothing to snag in a press.','Every shift lead cuts it the same.','v:60'],
['hair_crop','Salvage Crop','hair','grey','ST','crop','#6a5a48','','Uneven scissor crop, grey at the edges.','Cut by whoever had scissors and a minute.','d'],
['hair_tail','Shift-Lead Ponytail','hair','grey','HI','tail','#3d3028','','Tied back with a strip of insulation tape.','Harrow-Brandt shift leads tie it back for the furnace.','v:60'],
['hair_olive','Surplus Dye: Olive','hair','green','MM','crop','#7a8a4c','','Short crop in Kestrel clearance olive.','Dye lots that missed their ship date.','v:420'],
['hair_mohawk','Weld-Line Mohawk','hair','green','HI','mohawk','#b4553a','#7a2f20','A stiff oxide-red ridge down the centre.','Foundry apprentices set theirs with flux paste.','v:480'],
['hair_braids','Ward-Braid','hair','green','PS','braids','#2f2a28','#8fb0c8','Tight dark braids threaded with slate-blue cord.','Clinic orderlies braid to keep hair out of sterile fields.','d'],
['hair_undercut','Aldane Clean-Cut','hair','blue','PS','undercut','#d8d4c4','','Ivory undercut, razor-clean lines.','Compliance requires a visible neck.','v:1500'],
['hair_spikes','Slag-Spike Crest','hair','blue','HI','spikes','#c85a2e','#ffb060','Heat-hardened spikes, tips glowing faintly.','Cast from the cooled edge of a slag pour.','e'],
['hair_cinder','Cinder Fade','hair','blue','HI','crop','#3a3330','#ff7a30','Charcoal crop with ember flecks.','You never quite wash out Line 7.','d'],
['hair_frostlock','Archive Frostlock','hair','purple','PS','long','#bfe3f0','#ffffff','Long rime-white strands that glitter and sway.','Frozen in the Cold Archive and never thawed.','b:cryo'],
['hair_neonwire','Fibre-Optic Mane','hair','purple','MM','long','#7fd8d0','#e8f4ff','Trailing fibre strands carrying a slow pulse of light.','Kestrel overstock, wired by an independent artist.','b'],
['hair_flame','Foundry-Fire Mane','hair','orange','EV','flame','#ff8a2a','#ffd060','A living plume of flame where hair should be.','Seen once at Line 7 the night the horn stopped. Nobody sells it.','ev:mythic'],
// ---- HEADGEAR ----
['head_cap','Shift Cap','head','grey','ST','cap','#5a5c58','','Grease-dark work cap.','Standard issue, never washed.','v:70'],
['head_bandana','Rag Bandana','head','grey','ST','bandana','#8a3a30','','A red rag tied across the brow.','Doubles as a filter on dusty days.','d'],
['head_goggles','Welder\'s Goggles','head','green','HI','goggles','#3a3d3f','#e0b050','Round amber-lens goggles pushed up on the forehead.','Foundry crews swap lenses by shade number.','v:450'],
['head_resp','Filter Respirator','head','green','MM','respirator','#6a6e66','#9a9a90','Half-mask respirator with twin canisters.','Sold by the case. Refilters are extra.','v:430'],
['head_visor','Audit Visor','head','blue','PS','visor','#6f9ec4','#dfeffa','Slim slate-blue visor across the eyes.','Everything you see is logged somewhere.','v:1700'],
['head_horns','Ram-Horn Brackets','head','blue','HI','horns','#8a3a30','#3a3a3a','Two forged brackets curving from the temples.','Rams carry them as shorthand for "do not argue".','e'],
['head_mast','Relay Mast','head','blue','MM','antenna','#8da05c','#d0e0a0','A stubby antenna with a blinking tip.','Kestrel handlers can find you with it. They say.','d'],
['head_halo','Compliance Halo','head','purple','PS','halo','#cfe4ff','','A thin floating ring of pale light above the head.','Issued to auditors who passed their own audit.','b:auditor'],
['head_crown','Reclaimer\'s Crown','head','purple','HI','crown','#d0a24a','#7a5a20','Welded brass crown of salvage tags.','Each tag is a facility someone reclaimed.','b:reclaimer'],
['head_cowl','Warrantor\'s Void Cowl','head','orange','EV','cowl','#16161c','#ff7a1a','A black cowl with a seam of orange light, like a warranty seal breaking.','Given only to those who voided every contract in the Basin.','a:clears_all'],
// ---- EYES ----
['eyes_amber','Amber Retrofit Lenses','eyes','green','MM','dots','#e0a040','','Two warm amber optic lenses.','Standard optic retrofit. Fits most sockets.','v:400'],
['eyes_teal','Teal Diagnostic Lenses','eyes','green','PS','dots','#50c0b0','','Cool teal lenses with a faint scan flicker.','Technicians leave them on by habit.','v:420'],
['eyes_red','Oxide Targeting Lenses','eyes','blue','HI','slit','#d04a3a','','Narrow red slits that glow in the dark.','Designed for tracking rivets across a shop floor.','e'],
['eyes_cyclops','Single-Lens Scanner','eyes','blue','MM','cyclops','#6fc0e0','','One broad scanning lens across the brow.','Refurbished twice; the original owner is unknown.','v:1600'],
['eyes_blank','Ceramic Blank Eyes','eyes','purple','PS','dots','#f4f4ee','','Pure white glowing eyes, no pupils.','The face of a perfect audit.','b:clearance'],
['eyes_void','Void-Lens Pair','eyes','purple','EV','dots','#9a6adb','','Violet lenses that seem to drink the light.','From the Anechoic Lab. Silence made visible.','b:resonance'],
['eyes_sun','Furnace-Heart Gaze','eyes','orange','EV','flame','#ffa030','#fff0b0','Eyes that burn like open furnace doors.','Whoever carries it is never cold again.','ev:mythic'],
// ---- TORSO ----
['torso_mm','Kestrel Surplus Shell','torso','grey','MM','shell','#7a8052','','Refurbished olive plastics over the torso (Kestrel body part).','Secondhand twice.','v:120'],
['torso_hazard','Hazard-Stripe Tabard','torso','grey','ST','stripe','#d0a030','#2a2a2a','Yellow-black diagonal tabard.','You can be seen from the next district.','d'],
['torso_hi','Harrow Pattern Shell','torso','green','HI','shell','#a04a34','','Gunmetal and oxide-red plating (Harrow body part).','Visible fasteners, loud hydraulics.','v:520'],
['torso_ps','Aldane Ceramic Shell','torso','green','PS','shell','#e8e4d6','','Flush ivory ceramic shell (Aldane body part).','Seamless, silent, cold.','v:520'],
['torso_vest','Reflective Safety Vest','torso','green','ST','vest','#d8a030','#cfd0c8','High-visibility vest with silver bands.','Required inside every Harrow facility.','v:460'],
['torso_chevron','Chevron Plate','torso','blue','HI','chevron','#a8483a','#d8d4c4','Painted chevron plates across the chest.','Rank marks for the Reclaim crews.','v:1650'],
['torso_lights','Status Light Array','torso','blue','MM','lights','#7fd0a0','#e0b050','A column of status lights down the sternum.','Green means resale-ready.','e'],
['torso_gown','Ward 9 Surgical Gown','torso','blue','PS','gown','#bcd6e0','#e8f4f8','Pale scrub gown with a stencilled bed number.','Nobody remembers whose bed.','d'],
['torso_core','Exposed Heat Core','torso','purple','HI','core','#ff7a30','#3a2a20','A glowing heat core visible through the chest plate.','Cut from the Foundry brannoch press.','b:brannoch'],
['torso_ledger','Ledger Plate','torso','purple','EV','panel','#d8d0b0','#a07a30','Brass-trimmed plate etched with an endless ledger.','Every line is a debt to the warranty vault.','b:warrantor'],
['torso_cuirass','Recall-Yard Cuirass','torso','purple','HI','plate','#c9c7c0','#7a7a74','Stamped steel breastplate with recall numbers.','Final batch. None were returned.','b:recall'],
['torso_nova','Heartstar Casing','torso','orange','EV','core','#ffd24a','#ff5a1a','A blazing white-gold core behind a cracked casing.','A rumoured prototype nobody admits to building.','ev:mythic'],
// ---- ARMS ----
['arms_mm','Kestrel Pattern Arms','arms','grey','MM','shell','#7a8052','','Refurbished olive arm shells (Kestrel body part).','Stamped steel, replaceable by the dozen.','v:100'],
['arms_wraps','Cable Wraps','arms','grey','ST','bands','#7a746a','','Cable ties and tape around both forearms.','Holds things together. Mostly.','d'],
['arms_hi','Harrow Pattern Arms','arms','green','HI','shell','#a04a34','','Heavy gunmetal arm shells (Harrow body part).','Hydraulic pistons you can hear.','v:480'],
['arms_ps','Aldane Pattern Arms','arms','green','PS','shell','#e8e4d6','','Flush ceramic arm shells (Aldane body part).','Quiet enough to hide a pulse.','v:480'],
['arms_sleeves','Tarp-Cloth Sleeves','arms','green','ST','sleeve','#5a6a4a','','Cut-down market tarp sleeves.','Rustline stalls all share one supplier.','d'],
['arms_piston','Exposed Piston Sleeves','arms','blue','HI','piston','#b08a50','#3a3a3a','Brass pistons visible along both forearms.','Pressure gauges optional.','v:1600'],
['arms_conduit','Lit Conduit Bracers','arms','blue','PS','conduit','#70c0d0','','Bracers with a thin lit conduit running along them.','Looks like power. Often is.','e'],
['arms_fused','Foundry-Fused Arms','arms','purple','HI','fused','#ff8a3a','#3a3a3a','Heat-seamed arm plating with glowing weld lines.','Welded in place under a ripper strike.','b:voss'],
// ---- HANDS ----
['hands_work','Work Gloves','hands','grey','ST','gloves','#8a6a40','','Cracked leather gloves.','Everyone owns a pair.','v:50'],
['hands_hi','Harrow Pattern Hands','hands','green','HI','shell','#a04a34','','Armoured gunmetal hands (Harrow body part).','Built to hold a hot ingot.','v:440'],
['hands_ps','Aldane Pattern Hands','hands','green','PS','shell','#e8e4d6','','Fine ceramic hands (Aldane body part).','Steady to a tenth of a millimetre.','v:440'],
['hands_nitrile','Clinic Nitrile','hands','blue','PS','gloves','#7fb0d0','','Snug slate-blue clinical gloves.','Ward 9 changes them every hour. Every hour.','d'],
['hands_signet','Signet Knuckles','hands','blue','ST','knuckle','#d0b060','','Brass knuckle rings, each with a stamped crest.','Every crew has a signet. Few survive.','e'],
['hands_ember','Ember-Palm Grips','hands','purple','HI','glowpalm','#ff7a30','','Palms that glow like coals when you fight.','Heat bleeds out of a press and into you.','b:lineman'],
// ---- LEGS ----
['legs_mm','Kestrel Pattern Legs','legs','grey','MM','shell','#7a8052','','Refurbished olive legs and boots (Kestrel body part).','Resold more often than they were worn.','v:100'],
['legs_stripe','Hi-Vis Leg Stripes','legs','grey','ST','stripe','#d0a030','','Reflective bands on shins and knees.','Cheap and visible.','d'],
['legs_hi','Harrow Pattern Legs','legs','green','HI','shell','#a04a34','','Heavy gunmetal legs and boots (Harrow body part).','Loadbearers. They creak when loaded.','v:480'],
['legs_ps','Aldane Pattern Legs','legs','green','PS','shell','#e8e4d6','','Slim ceramic strider legs (Aldane body part).','Silent on stone.','v:480'],
['legs_greaves','Slag-Plate Greaves','legs','blue','HI','greaves','#8a3a2a','#2a2a2a','Scorched armour plates over shin and knee.','Pulled from a cooled pour.','v:1650'],
['legs_rails','Strider Light Rails','legs','purple','PS','rails','#9fd0ff','','Thin lit rails running down both legs.','Aldane stride tech, unlicensed.','b:mirrorpt'],
// ---- BACK ----
['back_rucksack','Salvage Rucksack','back','grey','ST','pack','#5a5648','','Patched canvas rucksack.','The first thing every salvager owns.','v:70'],
['back_cable','Trailing Cable Tail','back','grey','MM','cable','#2a2a2a','','A loose power cable trailing from the spine.','Not supposed to still be live.','d'],
['back_cape','Tarp Cape','back','green','ST','cape','#6a7a52','','A weathered tarp cape.','Keeps the haze off.','v:420'],
['back_vents','Heat Vent Stacks','back','green','HI','vents','#8a8a84','#3a3a3a','Two short exhaust stacks on the shoulders.','They do vent. Don\'t stand behind.','v:460'],
['back_tank','Coolant Tank Rig','back','blue','PS','tank','#6a9ab8','#dfeffa','A pale coolant tank on a bracket.','Aldane keeps the coolant clear on purpose.','v:1600'],
['back_array','Relay Antenna Array','back','blue','MM','array','#9cb060','#d0e0a0','Three whip antennae with tiny lights.','Kestrel Row can hear you everywhere.','e'],
['back_banner','Reclaim Banner','back','blue','HI','banner','#a8483a','#d8d4c4','A short banner of the Reclaim crews.','Reclaim is not theft; it is theft with a form.','d'],
['back_spine','Exposed Ceramic Spine','back','purple','PS','spine','#ecebe4','#a0a098','A bare ceramic spine rising along the back.','Auto-surgeon showpiece.','b:surgeon'],
['back_disc','Warrant Disc','back','purple','EV','disc','#d8b050','#7a5a20','A large brass disc behind the shoulders.','Stamped void. Void is not the same as empty.','b:liquidator'],
['back_wings','Cinder Wings','back','orange','EV','wings','#ff7a30','#ffd060','Two wings of drifting embers.','The Basin tells of a mechanic who flew out.','ev:mythic'],
// ---- SKIN ----
['skin_tan','Weathered Tan','skin','grey','ST','tint','#b08a60','','Sun-hardened skin tone.','Haze burns slow.','v:80'],
['skin_pale','Basin Pallor','skin','grey','ST','tint','#cfc6b8','','Pale, never-sunlit skin.','Born under haze.','v:80'],
['skin_soot','Soot-Stained','skin','green','HI','tint','#4a4640','','Soot ground into every pore.','Foundry hands do not scrub clean.','v:430'],
['skin_rust','Rust Patina','skin','green','HI','patina','#a85a30','#6a3a20','Orange-brown rust bloom over the body.','Salvage ages quickly.','d'],
['skin_chrome','Chrome Plating','skin','blue','PS','chrome','#cfd6dc','#ffffff','Mirror-polished plating with a travelling sheen.','Aldane plates it for free. Then bills for polish.','e'],
['skin_veins','Lit Veins (Teal)','skin','blue','PS','veins','#40d8c8','','Teal light pulses through veins.','Sold as a diagnostic, worn as a style.','v:1750'],
['skin_veins2','Lit Veins (Amber)','skin','blue','HI','veins','#e0a040','','Warm amber pulses under the skin.','Heat shows through when you run hot.','d'],
['skin_frost','Cold-Archive Rime','skin','blue','PS','frost','#bfe8f4','','A frosty crust of rime across the body.','Never melts indoors.','d'],
['skin_ceramic','Aldane Glaze Finish','skin','purple','PS','ceramic','#f2f0e8','#c8c4b8','Fully glazed ivory ceramic skin with a soft sheen.','Spotless. Unnerving.','b:clearance'],
['skin_circuit','Etched Circuit Dermis','skin','purple','MM','circuit','#7fd0e0','','Fine glowing circuit traces across the skin.','Every trace has a part number.','b:resonance'],
['skin_ember','Furnace Bloom','skin','purple','HI','ember','#ff6a2a','#ffc060','Cracked skin glowing like a banked furnace.','Never fully cools.','b:voss'],
['skin_holo','Starforged Hologram Skin','skin','orange','EV','holo','#a0e0ff','#ffa0e0','A shifting prismatic hologram where skin should be.','No one has ever admitted to buying it.','ev:mythic'],
// ---- TATTOOS ----
['tat_barcode','Asset-Tag Barcode','tattoo','grey','MM','barcode','#2a2a2a','','Inked barcode on the neck.','Scan me. Go on.','v:80'],
['tat_serial','Serial Number Brand','tattoo','grey','HI','serial','#3a2a20','','A brand-stamped serial on the forearm.','Harrow counts everything.','d'],
['tat_sigil','Union Sigil','tattoo','green','HI','sigil','#a8483a','','A red sigil on the chest.','The old shop-floor union, still unlisted.','v:440'],
['tat_cracks','Stress-Crack Lines','tattoo','green','ST','cracks','#3a3a3a','','Fine black lines like stress cracks.','Shows where you break.','d'],
['tat_circuit','Circuit Trace Sleeve','tattoo','blue','MM','circuit','#70c0d0','','A glowing circuit sleeve down one arm.','Mass-market tattoo with a warranty. No, really.','v:1600'],
['tat_bio','Bioluminescent Ink','tattoo','blue','PS','bio','#7fe0a0','','Soft green glowing glyphs under the skin.','Ward 9 stock. No questions.','e'],
['tat_stamp','Void-Warranty Stamp','tattoo','purple','EV','stamp','#c0392b','','A bold VOID stamp across the chest that pulses.','The only warranty claim ever honoured.','a:clears_12'],
// ---- AURA ----
['aura_grit','Grit Cloud','aura','grey','ST','dust','#8a8070','','A faint cloud of dust.','The Basin follows you.','d'],
['aura_haze','Basin Haze','aura','green','ST','haze','#9aa090','','A soft smoky haze rolling around you.','Permanent haze. Now personal.','d'],
['aura_sparks','Weld Sparks','aura','green','HI','sparks','#ffb040','','A ring of drifting weld sparks.','Never quite stops.','v:480'],
['aura_mist','Coolant Mist','aura','blue','PS','mist','#8fc8e0','','Cool pale mist curling off the body.','Aldane vents it on purpose.','v:1650'],
['aura_static','Static Halo','aura','blue','MM','static','#c0d0ff','','A crackle of blue static.','Kestrel wiring is never grounded.','e'],
['aura_foundry','Foundry Glow','aura','purple','HI','glow','#ff7a2a','','A deep orange glow from below.','From the Bell Foundry cast pit.','b:bellfounder'],
['aura_audit','Audit Ring','aura','purple','PS','ring','#d0e0ff','','A thin ring of light that sweeps the ground.','Scans at all times.','b:auditor'],
['aura_nova','Heartstar Corona','aura','orange','EV','nova','#ffd24a','#ff5a1a','A pulsing white-gold corona.','Seen from three districts away.','ev:mythic'],
// ---- TRAILS ----
['trail_dust','Dust Wake','trail','grey','ST','dust','#8a8070','','A puff of dust where you ran.','Grit marks your path.','d'],
['trail_sparks','Spark Trail','trail','green','HI','sparks','#ffb040','','A trail of falling sparks.','Metal on metal.','v:460'],
['trail_smoke','Exhaust Smoke','trail','green','MM','smoke','#6a6a66','','A grey wisp of exhaust.','Refurbished means not clean.','d'],
['trail_ghost','Afterimage Ghost','trail','blue','PS','ghost','#9fb8d0','','Pale afterimages that linger a moment.','Old Aldane stride-tech glitch.','e'],
['trail_ember','Ember Wake','trail','purple','HI','embers','#ff7a30','','Glowing embers fall behind you.','From the lineman\'s last switch.','b:lineman'],
['trail_glitch','Data-Glitch Trail','trail','purple','MM','glitch','#70e0e0','','Pixel glitches stutter behind you.','Dropped frames from a radio mast.','b:widow'],
// ---- PREMIUM (simulated store skins: appearance only, grey/green/blue, sold via src/store.ts) ----
['pm_skin_cobalt','Cobalt Anodize','skin','blue','PS','chrome','#3a6ad0','#bcd4ff','Deep cobalt anodised plating with a slow sheen.','Aldane\'s limited colourway. Inspected twice.','p:299'],
['pm_skin_jade','Jade Patina','skin','green','HI','patina','#3a9a78','#1f6a50','Verdigris bloom over the whole frame.','Copper ages kindly if you let it.','p:199'],
['pm_hair_signal','Signal-Flare Crest','hair','blue','HI','spikes','#ff3a6a','#ffb0c0','A crest of hot-pink flare spikes.','Visible from the far end of the Basin.','p:299'],
['pm_aura_brine','Brine Mist','aura','blue','PS','mist','#50d0b0','','Sea-green mist curling off the shoulders.','Smells of a harbour that drained decades ago.','p:299'],
['pm_trail_sodium','Sodium Spark Trail','trail','blue','HI','sparks','#ffd040','','Yellow sodium sparks fall behind you.','Streetlamp light, spent and scattered.','p:299'],
['pm_back_hazard','Hazard-Stripe Cape','back','green','ST','cape','#d0a020','','A yellow-black striped safety cape.','Cheaper than a warning sign.','p:199'],
['pm_head_nightvisor','Night-Shift Visor','head','blue','MM','visor','#c060e0','#f0d0ff','A violet visor for the long shift.','Kestrel night crews swear by the tint.','p:299'],
['pm_eyes_lime','Lime Diagnostic Lenses','eyes','green','PS','dots','#a0e040','','Bright lime lenses with a scan flicker.','Calibration green, never meant to be a look.','p:199'],
// ---- PREMIUM EPIC / LEGENDARY (simulated store, see docs/STORE_SIM.md "Premium tier"). The 7 earn-only orange pieces are NEVER sold. ----
['pm_hair_prism','Prism-Fibre Mane','hair','purple','MM','long','#b46bff','#ffd0ff','Long fibre-optic hair that shifts through violet.','Kestrel display stock, recut for heads.','p:499'],
['pm_head_vigil','Vigil Halo','head','purple','PS','halo','#c9a0ff','#ffffff','A floating violet halo that ticks like a watch.','Aldane night-ward staff wear them off shift.','p:499'],
['pm_torso_lattice','Lattice Plate','torso','purple','HI','panel','#7a4ad0','#d8c0ff','A violet lattice chest plate with lit seams.','Heavy Works parade armour, never issued.','p:499'],
['pm_trail_violet','Violet Static Trail','trail','purple','MM','glitch','#c070ff','','Violet glitch blocks stutter behind you.','A broadcast that never ended.','p:399'],
['pm_skin_plasma','Plasma-Vein Dermis','skin','orange','EV','holo','#ff8a1f','#fff1c4','Molten plasma veins run under a dark glass skin.','A legend you can buy. The Basin still argues about it.','p:999'],
['pm_aura_swarm','Nanoswarm Halo','aura','orange','EV','nova','#ffb347','#e8f4ff','A glittering swarm of nanites orbits you.','Repair nanites that forgot what to fix.','p:999'],
['pm_back_chrome','Liquid-Chrome Wings','back','orange','EV','wings','#e8f4ff','#ff9a1f','Wings of flowing liquid chrome edged in fire.','Poured once, never set.','p:1299'],
];

function parseSrc(s:string):CosSource{ if(s.startsWith('v:')) return {k:'vendor',price:+s.slice(2)}; if(s.startsWith('p:')) return {k:'premium',cents:+s.slice(2)}; if(s==='d') return {k:'drop'}; if(s==='e') return {k:'elite'}; if(s==='b') return {k:'boss'}; if(s.startsWith('b:')) return {k:'bossId',boss:s.slice(2)}; if(s.startsWith('a:')) return {k:'ach',key:s.slice(2)}; return {k:'event',key:s.slice(3)}; }
const VAR:Record<string,Variant>={ torso_mm:'market',torso_hi:'heavy',torso_ps:'surgical', arms_mm:'market',arms_hi:'heavy',arms_ps:'surgical', hands_hi:'heavy',hands_ps:'surgical', legs_mm:'market',legs_hi:'heavy',legs_ps:'surgical' };
export const COSMETICS:CosDef[]=R.map(r=>({ id:r[0],name:r[1],slot:r[2],rarity:r[3],theme:r[4],style:r[5],c:r[6],c2:r[7]||undefined,desc:r[8],lore:r[9],src:parseSrc(r[10]),variant:VAR[r[0]] }));
export const COS_BY_ID:Record<string,CosDef>=Object.fromEntries(COSMETICS.map(c=>[c.id,c]));

/** ---- Rarity policy (see docs/APPEARANCE_ITEMS.md section 2) ---- */
/** Relative weight of each rarity in a cosmetic roll, per kill tier. Orange is always the smallest by an order of magnitude; purple is only practical from bosses. */
export const COS_RARITY_W:Record<'ordinary'|'elite'|'boss',Record<Rarity,number>>={
  ordinary:{ grey:70, green:24, blue:5.5, purple:.4, orange:.01 },
  elite:   { grey:38, green:38, blue:18,  purple:5.5, orange:.03 },
  boss:    { grey:8,  green:38, blue:38,  purple:15.5, orange:.12 } };
/** Chance that a kill rolls a cosmetic at all. They go straight to the wardrobe (no ground pile), so they never touch DROP_RATE_SCALE volume. */
export const COS_ROLL_CHANCE={ ordinary:.004, elite:.05, boss:.35, bossSpecific:.12, eventMythic:.002 };
/** Credit value when a duplicate (or an all-owned rarity) rolls. */
export const COS_DUPE_CREDITS:Record<Rarity,number>={ grey:10, green:40, blue:150, purple:600, orange:4000 };

export interface CosState { owned:Record<string,number>; equipped:Partial<Record<CosSlot,string>>; seen?:Record<string,number>; outfits?:({ n:string; eq:Partial<Record<CosSlot,string>> }|null)[] }
export const newCos=():CosState=>({ owned:{}, equipped:{}, seen:{} });
export function cosOf(s:{cosmetics?:CosState}):CosState{ if(!s.cosmetics) s.cosmetics=newCos(); const c=s.cosmetics; c.owned=c.owned||{}; c.equipped=c.equipped||{}; c.seen=c.seen||{}; return c; }
export const ownsCos=(s:{cosmetics?:CosState},id:string)=>!!cosOf(s).owned[id];
/** Equipped cosmetic defs (unknown / unowned ids are ignored). */
export function equippedCos(s:{cosmetics?:CosState}):CosDef[]{ const c=cosOf(s); const o:CosDef[]=[]; for(const sl of COS_SLOTS){ const id=c.equipped[sl]; const d=id?COS_BY_ID[id]:undefined; if(d&&d.slot===sl&&c.owned[id!]) o.push(d); } return o; }
export function grantCos(s:{cosmetics?:CosState},id:string):boolean{ const c=cosOf(s); if(!COS_BY_ID[id]||c.owned[id]) return false; c.owned[id]=Date.now(); return true; }
export function equipCos(s:{cosmetics?:CosState},id:string|null,slot?:CosSlot):boolean{ const c=cosOf(s); if(id===null){ if(slot) delete c.equipped[slot]; return true; } const d=COS_BY_ID[id]; if(!d||!c.owned[id]) return false; c.equipped[d.slot]=id; return true; }
export function buyCos(s:{cosmetics?:CosState;credits:number},id:string):{ok:boolean;why:string}{ const d=COS_BY_ID[id]; if(!d) return {ok:false,why:'Unknown item'}; if(d.src.k!=='vendor') return {ok:false,why:'Not sold here'}; if(ownsCos(s,id)) return {ok:false,why:'Already owned'}; if(s.credits<d.src.price) return {ok:false,why:'Need '+d.src.price+'c'}; s.credits-=d.src.price; grantCos(s,id); return {ok:true,why:'Bought '+d.name}; }

/** Weighted cosmetic roll for a kill. Returns the granted def (new) or null; duplicates pay credits via `dupe`. */
export function rollCosmetic(s:{cosmetics?:CosState}, tier:'ordinary'|'elite'|'boss', bossId:string|null, dungeonTier:number, rnd:()=>number=Math.random):{ def?:CosDef; dupeCredits?:number }|null{
  const c=cosOf(s); const take=(d:CosDef)=>{ if(c.owned[d.id]) return { dupeCredits:COS_DUPE_CREDITS[d.rarity] }; c.owned[d.id]=Date.now(); return { def:d }; };
  if(tier==='boss'){
    if(bossId){ const spec=COSMETICS.filter(d=>d.src.k==='bossId'&&d.src.boss===bossId&&!c.owned[d.id]); if(spec.length&&rnd()<COS_ROLL_CHANCE.bossSpecific*(1+.1*dungeonTier)) return take(spec[Math.floor(rnd()*spec.length)]); }
    const ev=COSMETICS.filter(d=>d.src.k==='event'&&!c.owned[d.id]); if(ev.length&&rnd()<COS_ROLL_CHANCE.eventMythic*(1+.25*dungeonTier)) return take(ev[Math.floor(rnd()*ev.length)]);
  }
  if(rnd()>=COS_ROLL_CHANCE[tier]) return null;
  const W=COS_RARITY_W[tier]; const ok=(d:CosDef)=>d.src.k==='drop'||(d.src.k==='elite'&&tier!=='ordinary')||(d.src.k==='boss'&&tier==='boss');
  const rars=(Object.keys(W) as Rarity[]).filter(r=>r!=='orange'); // orange is ONLY from event/achievement sources
  const tot=rars.reduce((a,r)=>a+W[r]*(r==='purple'?1+.15*dungeonTier:1),0); let x=rnd()*tot, rar:Rarity='grey'; for(const r of rars){ x-=W[r]*(r==='purple'?1+.15*dungeonTier:1); if(x<=0){ rar=r; break; } }
  const pool=COSMETICS.filter(d=>d.rarity===rar&&ok(d)); if(!pool.length) return null; const un=pool.filter(d=>!c.owned[d.id]); if(!un.length) return { dupeCredits:COS_DUPE_CREDITS[rar] };
  return take(un[Math.floor(rnd()*un.length)]);
}

/** Achievements: guaranteed grants, evaluated from the save (idempotent). */
export interface AchDef { key:string; label:string; test:(s:any)=>boolean }
const nClear=(s:any)=>Object.keys(s.cleared||{}).length;
export const ACHIEVEMENTS:AchDef[]=[
  { key:'clears_12', label:'Clear 12 different dungeons', test:s=>nClear(s)>=12 },
  { key:'clears_all', label:'Clear every dungeon at least once', test:s=>nClear(s)>=24 } ];
export function checkAchievements(s:any):CosDef[]{ const got:CosDef[]=[]; for(const d of COSMETICS){ if(d.src.k!=='ach') continue; const a=ACHIEVEMENTS.find(x=>x.key===(d.src as any).key); if(a&&a.test(s)&&grantCos(s,d.id)) got.push(d); } return got; }
