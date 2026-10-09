// Ranged weapon hardware (PLACEHOLDER balance). Identity: HI = heavy, slow, hard-hitting, red-orange shots;
// PS = precise, efficient, cool bursts/arcs (ivory/blue); MM = cheap, fast, low-damage, olive. Rarity scales damage via WEAPON_RARITY_MUL.
import type { ItemDef, Mfr, Rarity, Slot, Stats } from '../config';
const H=(id:string,name:string,slot:Slot,mfr:Mfr,rarity:Rarity,lvl:number,stats:Partial<Stats>,x:Partial<ItemDef>={}):ItemDef=>({id,name,slot,mfr,rarity,lvl,stats,...x});
export const WEAPON_ITEMS:ItemDef[] = [
  H('mm_autopistol','Kestrel Pocket Auto','handR','MM','green',6,{atkSpeed:.03},{weapon:'autopistol',blurb:'Cheap auto-pistol. Fires on the move.'}),
  H('mm_autopistol_b','Kestrel Pocket Auto II','handR','MM','blue',14,{atkSpeed:.05,dmg:.03},{weapon:'autopistol'}),
  H('mm_shocktack','Kestrel Shock-Tack Caster','handR','MM','green',12,{dmg:.02},{weapon:'arc',blurb:'Budget chain-arc. Short chain, lots of heat.'}),
  H('ps_needle_rifle','AS Needle Burst Rifle','handR','PS','blue',14,{atkSpeed:.04},{weapon:'burst',blurb:'Three-round burst, efficient heat, long reach.'}),
  H('ps_needle_rifle_p','AS Needle Burst Rifle (Theatre)','handR','PS','purple',26,{atkSpeed:.08,dmg:.06},{weapon:'burst'}),
  H('ps_arc_caster','AS Chain-Arc Caster','handR','PS','purple',22,{dmg:.06,cooling:.1},{weapon:'arc',blurb:'Arcs jump between nearby targets.'}),
  H('hi_shard_arm','HB Shard Thrower Arm (R)','armR','HI','blue',16,{dmg:.04,armor:2},{weapon:'shard',blurb:'Arm-mounted scatter of cast shards. Short range, fires on the move.'}),
  H('hi_shard_arm_p','HB Foundry Shard Battery (R)','armR','HI','purple',26,{dmg:.1,armor:3},{weapon:'shard'}),
  H('hi_slug_cannon','HB Foundry Slug Cannon','handR','HI','purple',24,{dmg:.08,armor:2},{weapon:'slug',blurb:'Heavy slug driver, stand-still only. Hits very hard.'}),
];
