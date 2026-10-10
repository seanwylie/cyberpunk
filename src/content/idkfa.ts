// IDKFA dev cheat data: the "best gear" set. Orange items for slots that have no orange in the normal tables are
// defined here (dev/cheat only; never in loot pools). Flagged authoredException so the orange level rule is not violated.
import type { ItemDef, Mfr, Slot, Stats, ChipId } from '../config';
const H=(id:string,name:string,slot:Slot,mfr:Mfr,lvl:number,stats:Partial<Stats>,x:Partial<ItemDef>={}):ItemDef=>({id,name,slot,mfr,rarity:'orange',lvl,stats,authoredException:true,...x});
export const IDKFA_ITEMS:ItemDef[]=[
  H('idkfa_hand_l','Apex Micro-Scalpel Hand (L)','handL','PS',30,{atkSpeed:.15,dmg:.12},{blurb:'Dev cheat gear (IDKFA).'}),
  H('idkfa_hand_r','Apex Chain-Arc Caster','handR','PS',30,{dmg:.2,cooling:.2,atkSpeed:.1},{weapon:'arc',blurb:'Dev cheat gear (IDKFA).'}),
  H('idkfa_foot_l','Apex Damped Foot (L)','footL','PS',30,{move:.12,armor:3,maxHp:20},{blurb:'Dev cheat gear (IDKFA).'}),
  H('idkfa_foot_r','Apex Damped Foot (R)','footR','PS',30,{move:.12,armor:3,maxHp:20},{blurb:'Dev cheat gear (IDKFA).'}),
  H('idkfa_leg_l','Apex Strider Leg (L)','legL','PS',30,{move:.2,maxHp:45,armor:3},{abilities:['reposition'],blurb:'Dev cheat gear (IDKFA).'}),
  H('idkfa_face','Apex Seamless Faceplate','face','PS',30,{armor:4,pickup:.8,maxHp:30,regen:.4},{blurb:'Dev cheat gear (IDKFA).'}),
];
/** Best coherent set: one orange item per slot. Signature items preferred; no hard conflicts among them. */
export const IDKFA_SET:Record<Slot,string>={ armR:'sig_reclaimer_ripper', armL:'sig_autosurgeon_rig', torso:'sig_recovered_veil', brain:'sig_governor_core', legR:'sig_r0_lifter',
  handL:'idkfa_hand_l', handR:'idkfa_hand_r', footL:'idkfa_foot_l', footR:'idkfa_foot_r', legL:'idkfa_leg_l', face:'idkfa_face' };
/** Chips per slot; length equals the slot's socket capacity. */
export const IDKFA_CHIPS:Record<Slot,ChipId[]>={
  handL:['overdrive','fineedge'], handR:['overdrive','power'], armL:['overdrive','cutwide','bladepat'], armR:['overdrive','power','fineedge'],
  footL:['servo'], footR:['servo'], legL:['servo','plating','sustain'], legR:['servo','plating','sustain'],
  torso:['quench','quench','coolant','quench','sustain','ablative','plating','cloakdur'], face:['magnet','gridlink'], brain:['quench','gridlink','ctrldur','coolant'] };
