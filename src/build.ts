import { ABILITY_SLOT_ORDER, STARTER_ABILITIES, ABILITIES, AbilityId, BASE_STATS, BASE_STATS as B0, CHIPS, ITEM_BY_ID, MIX_PENALTY, REP_RANKS, SLOTS, Slot, Stats, WEAPONS, WEAPON_RARITY_MUL, WeaponDef, Mfr, ChipId, SLOT_SOCKETS, ItemDef, PROGRESSION } from './config';
import type { Inst, Save } from './state';

export interface BuildResult { stats:Stats; abilities:AbilityId[]; passives:AbilityId[]; weapon:WeaponDef; caps:Set<string>; mix:{ mfrs:Mfr[]; coolingPenalty:number }; mods:{ ctrlDur:number; cloakDur:number; arc:number; burstLen:number }; conflicts:string[]; weaponMul:number; weaponMfr:Mfr|null; weaponName:string; extraAbilities:AbilityId[]; }
export type Layout = Partial<Record<Slot, Inst|undefined>>;

export function repRank(rep:number){ let r=0; REP_RANKS.forEach((t,i)=>{ if(rep>=t) r=i; }); return r; }
export function installedLayout(s:Save, broken:Slot[]=[]):Layout { const L:Layout={}; for(const sl of SLOTS){ const u=s.installed[sl]; const it=u?s.items.find(i=>i.uid===u):undefined; if(it) L[sl]=it; } return L; }

/** Compute build from a layout (installed or staged), excluding broken slots. */
export function computeBuild(L:Layout, level:number, rep:Record<Mfr,number>, broken:Slot[]=[]):BuildResult {
  const stats:Stats={...B0}; stats.maxHp += level*1.5; stats.dmg += level*.01;
  const abilities:AbilityId[]=[]; const passives:AbilityId[]=[]; const caps=new Set<string>(); const mods={ctrlDur:0,cloakDur:0,arc:0,burstLen:0};
  const mfrs=new Set<Mfr>(); let weaponKind:WeaponDef=WEAPONS.fist; let wRank=-1; let wMul=1; let wMfr:Mfr|null=null; let wName='Bare hands'; const conflicts:string[]=[];
  const add=(p:Partial<Stats>)=>{ for(const k of Object.keys(p) as (keyof Stats)[]) stats[k]+= p[k]!; };
  const defs:ItemDef[]=[];
  for(const sl of ABILITY_SLOT_ORDER){ const inst=L[sl]; if(!inst) continue; const d=ITEM_BY_ID[inst.def]; if(broken.includes(sl)) continue; defs.push(d);
    add(d.stats); for(const c of inst.chips){ const cd=CHIPS[c]; add(cd.stats); if(cd.mod){ mods.ctrlDur+=cd.mod.ctrlDur||0; mods.cloakDur+=cd.mod.cloakDur||0; mods.arc+=cd.mod.arc||0; mods.burstLen+=cd.mod.burstLen||0; } }
    for(const a of d.abilities||[]) (ABILITIES[a].id==='defib'?passives:abilities).push(a);
    (d.caps||[]).forEach(c=>caps.add(c));
    if(!d.id.startsWith('stock_')) mfrs.add(d.mfr);
    if(d.weapon && (sl==='handR'||sl==='armR')){ const rk=sl==='handR'?(d.id.startsWith('stock_')?1:3):2; if(rk>wRank){ wRank=rk; weaponKind=WEAPONS[d.weapon]; wMul=WEAPON_RARITY_MUL[d.rarity]; wMfr=d.id.startsWith('stock_')?null:d.mfr; wName=d.name; } }
  }
  // dedupe abilities preserving order
  const ab=[...new Set(abilities)]; if(!ab.length) ab.push(...STARTER_ABILITIES);
  // Mixed manufacturer soft penalty
  const mf=[...mfrs]; let pen=0; if(mf.length>1){ pen=(mf.length-1)*MIX_PENALTY.coolingPerExtraMfr; const best=Math.max(...mf.map(m=>repRank(rep[m]))); pen=Math.max(0,pen-best*MIX_PENALTY.reputationRankReduces); }
  stats.cooling = Math.max(.3, stats.cooling - pen);
  for(const sl of SLOTS){ const a=L[sl]; if(!a) continue; for(const sl2 of SLOTS){ const b=L[sl2]; if(!b||a===b) continue; }}
  const hard = hardConflicts(L); conflicts.push(...hard);
  return { stats, abilities:ab.slice(0,3), extraAbilities:ab.slice(3), passives, weapon:weaponKind, weaponMul:wMul, weaponMfr:wMfr, weaponName:wName, caps, mix:{mfrs:mf,coolingPenalty:pen}, mods, conflicts };
}
import { HARD_CONFLICTS } from './config';
export function hardConflicts(L:Layout):string[]{ const ids=new Set(Object.values(L).filter(Boolean).map(i=>i!.def)); return HARD_CONFLICTS.filter(c=>ids.has(c.a)&&ids.has(c.b)).map(c=>c.reason); }
export function wouldConflict(L:Layout, slot:Slot, def:string):string|null{ const L2={...L,[slot]:{uid:'tmp',def,chips:[]}}; const h=hardConflicts(L2); return h.length?h[0]:null; }
export const socketCap=(slot:Slot)=>SLOT_SOCKETS[slot];
export function cloneLayout(L:Layout):Layout{ const o:Layout={}; for(const k of Object.keys(L) as Slot[]) { const v=L[k]; if(v) o[k]={...v,chips:[...v.chips]}; } return o; }
export type { ChipId };
