// Dungeon-pack hardware, chips and conflicts (data only). PLACEHOLDER numbers.
// Orange rule: orange items are HIGH-LEVEL ONLY (lvl >= 24) except small, explicitly flagged authoredException Easter eggs.
// ART NEEDED: slot sprites/icons and rarity animations for every item (esp. orange). See docs/DUNGEON_ART_PROMPTS.md.
import type { ItemDef, ChipDef, Mfr, Rarity, Slot, Stats } from '../config';
const H=(id:string,name:string,slot:Slot,mfr:Mfr,rarity:Rarity,lvl:number,stats:Partial<Stats>,x:Partial<ItemDef>={}):ItemDef=>({id,name,slot,mfr,rarity,lvl,stats,...x});
export const EXTRA_CHIPS:Record<'ablative'|'fineedge'|'quench'|'overdrive'|'gridlink',ChipDef> = {
  ablative:{ id:'ablative', name:'Ablative Chip', desc:'+2 armor, +10 max HP.', stats:{armor:2,maxHp:10}, rarity:'green' },
  fineedge:{ id:'fineedge', name:'Fine-Edge Chip', desc:'+10% attack speed, +4% damage.', stats:{atkSpeed:.1,dmg:.04}, rarity:'blue' },
  quench:{ id:'quench', name:'Quench Coil', desc:'+35% cooling rate.', stats:{cooling:.35}, rarity:'blue' },
  overdrive:{ id:'overdrive', name:'Overdrive Chip', desc:'+22% damage, -10% cooling.', stats:{dmg:.22,cooling:-.1}, rarity:'purple' },
  gridlink:{ id:'gridlink', name:'Grid-Link Chip', desc:'+2s enemy control, +10% cooling.', stats:{cooling:.1}, mod:{ctrlDur:2}, rarity:'blue' },
};
export const EXTRA_ITEMS:ItemDef[] = [
  // ---- Heavy industrial (Foundry Line 7) ----
  H('hi_slag_apron','HB Slag Apron Frame','torso','HI','green',18,{maxHp:34,armor:2}),
  H('hi_crucible_torso','HB Crucible Exchange Chassis','torso','HI','blue',22,{maxHp:30,cooling:.3,regen:.6},{abilities:['brace','forcedcool'],blurb:'Foundry-grade heat exchanger torso.'}),
  H('hi_ladle_hand','HB Ladle-Saw Hand','handR','HI','blue',20,{dmg:.1,atkSpeed:.04},{weapon:'ripper'}),
  H('hi_press_arm','HB Press-Ram Arm (L)','armL','HI','blue',22,{dmg:.1,armor:3},{abilities:['sweep'],caps:['force']}),
  H('hi_gantry_leg_l','HB Gantry Leg (L)','legL','HI','purple',26,{maxHp:36,armor:3,move:.05}),
  H('hi_gantry_leg_r','HB Gantry Leg (R)','legR','HI','purple',26,{maxHp:36,armor:3,move:.05}),
  H('hi_slag_face','HB Slag Visor','face','HI','green',18,{armor:2,maxHp:10}),
  H('hi_anvil_foot','HB Anvil Foot (R)','footR','HI','blue',21,{armor:2,maxHp:12}),
  H('sig_anvil_arm','Brannoch Anvil-Arm','armR','HI','orange',28,{dmg:.28,armor:6},{abilities:['sweep','brace'],caps:['force'],blurb:'Ladle-Tyrant signature. A foundry ram that never cools.'}),
  H('sig_governor_core','Governor Core','brain','HI','orange',28,{cooling:.4,dmg:.1,regen:.6},{abilities:['forcedcool','control'],caps:['hack'],blurb:'ORE-9 signature. Governs heat, then turns on its owners.'}),
  // ---- Precision surgical (Ward 9 Clinic) ----
  H('ps_sutured_torso','AS Sutured Ceramic Torso','torso','PS','green',22,{maxHp:20,cooling:.1}),
  H('ps_theatre_torso','AS Theatre Veil Torso','torso','PS','blue',24,{cooling:.2,maxHp:16},{abilities:['cloak'],caps:['cloak']}),
  H('ps_scalpel_hand_l2','AS Micro-Scalpel Hand (L)','handL','PS','blue',24,{atkSpeed:.1,dmg:.05}),
  H('ps_fan_arm','AS Fan-Blade Arm (L)','armL','PS','purple',28,{dmg:.14,atkSpeed:.08},{abilities:['bladeburst']}),
  H('ps_ceramic_leg_l','AS Ceramic Strider (L)','legL','PS','purple',28,{move:.14,maxHp:20},{abilities:['reposition']}),
  H('ps_ceramic_leg_r','AS Ceramic Strider (R)','legR','PS','purple',28,{move:.14,maxHp:20}),
  H('ps_anesthesia_face','AS Anesthesia Mask','face','PS','blue',24,{armor:2,pickup:.3,cooling:.1}),
  H('ps_sensor_foot','AS Sensor Foot (L)','footL','PS','green',22,{move:.06}),
  H('ps_nerve_brain','AS Nerve-Lace Cortex','brain','PS','purple',30,{cooling:.25,dmg:.08},{abilities:['control'],caps:['hack']}),
  H('sig_autosurgeon_rig','GEMINI Autosurgeon Rig','armL','PS','orange',32,{dmg:.2,atkSpeed:.15},{abilities:['bladeburst','pulse'],blurb:'Twin saw-rig cut from the theatre ceiling.'}),
  H('sig_recovered_veil','Recovered Veil','torso','PS','orange',32,{cooling:.3,maxHp:30,regen:.6},{abilities:['cloak','reposition'],caps:['cloak'],blurb:'Patient Eleven. Nothing in this weave remembers a person.'}),
  // ---- Mass market (Kestrel Hub 9) ----
  H('mm_pallet_torso','Kestrel Pallet Frame','torso','MM','grey',8,{maxHp:16}),
  H('mm_stocker_arm','Kestrel Stocker Arm (R)','armR','MM','green',9,{maxHp:8,dmg:.03}),
  H('mm_jack_leg_l','Kestrel Jack Leg (L)','legL','MM','green',10,{maxHp:12,move:.03}),
  H('mm_jack_leg_r','Kestrel Jack Leg (R)','legR','MM','green',10,{maxHp:12,move:.03}),
  H('mm_scanner_face','Kestrel Barcode Optics','face','MM','green',10,{pickup:.5}),
  H('mm_clamp_hand','Kestrel Clamp Hand (L)','handL','MM','green',9,{armor:1,maxHp:4}),
  H('mm_nailgun','Kestrel Nail Driver','handR','MM','green',12,{dmg:.05},{weapon:'slug'}),
  H('mm_cutter_hand','Kestrel Box-Cutter Hand','handR','MM','blue',14,{atkSpeed:.06,dmg:.04},{weapon:'blade'}),
  H('mm_barcode_brain','Kestrel Inventory Brain','brain','MM','blue',16,{cooling:.1},{abilities:['control'],caps:['hack']}),
  H('mm_returns_torso','Kestrel Returns Rack','torso','MM','blue',15,{maxHp:26,regen:.5},{abilities:['revive','defib'],caps:['defib']}),
  H('sig_lazarus_rack','Lazarus Rack','torso','MM','orange',14,{maxHp:40,regen:1.2},{abilities:['revive','brace','defib'],caps:['defib'],authoredException:true,blurb:'Authored Easter egg: an orange item outside the high-level band. Returned, refurbished, resold.'}),
  H('sig_r0_lifter','R-0 Lifter Legs','legR','MM','orange',24,{maxHp:50,armor:5,move:.1},{abilities:['reposition'],blurb:'Retrieval Unit R-0 signature. Built to lift what the shelves cannot.'}),
];
export const EXTRA_CONFLICTS:{a:string;b:string;reason:string}[] = [
  { a:'sig_anvil_arm', b:'sig_recovered_veil', reason:'Ram vibration defeats the Veil weave. Hard conflict (unchanged by reputation).' },
  { a:'hi_press_arm', b:'ps_theatre_torso', reason:'Press vibration defeats the Theatre weave. Hard conflict (unchanged by reputation).' },
  { a:'sig_anvil_arm', b:'ps_theatre_torso', reason:'Ram vibration defeats the Theatre weave. Hard conflict (unchanged by reputation).' },
];
