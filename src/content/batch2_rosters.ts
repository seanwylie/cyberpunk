// CONTENT BATCH 2 (rosters): which mobs each of the 20 batch-1 levels fields, and how packs are composed (docs/MOBS_BATCH_2.md section 3).
// Per level: `new` = the mobs this level is meant to introduce (theme/faction fit), `old` = earlier-tier and legacy mobs mixed back in.
// Pack composition rules (composeSquads): every pack is a SQUAD of mixed roles placed together (shared alert group), by zone:
//   yard      = easy intro: a legacy frontline + ranged squad, a swarm squad, and one squad of the level's first new mob.
//   proc      = the main fight: new front + old front + ranged + (tier>=2) support; a swarm+charger squad; a ranged/shielded/support squad.
//   junction  = pre-boss: shielded/front + ranged + support, and a caster/ranged battery.
//   salvage   = small swarm + exploder squad.
// Elite chance (a pack leader gets affixes) and affix count rise by tier (TIER_CURVE in batch2_mobs.ts); rollAffixes() is called by the generator.
import { MOB_BY_ID, TIER_CURVE, AFFIX_TIER } from './batch2_mobs';
import type { Affix, Role } from './batch2_mobs';
export type Squad=[string,number][];
export interface LevelMobs { new:string[]; old:string[] }
/** roles for legacy (pre-batch-2) enemies so they mix with the new ones */
export const LEGACY_ROLE:Record<string,Role>={ worker:'swarmer', shooter:'ranged', picker:'swarmer', loader:'bruiser', forkbot:'charger', scanner:'ranged', slaghauler:'bruiser', ladlecrew:'ranged', cinderhound:'swarmer', orderly:'bruiser', nursebot:'ranged', gurneyrunner:'charger' };
export const roleOf=(id:string):Role|undefined=>MOB_BY_ID[id]?.role||LEGACY_ROLE[id];
export const LEVEL_MOBS:Record<string,LevelMobs>={
  // ---- tier I
  coke_ovens:       { new:['cindermite','coalheaver','fusecrawler','sootwisp'], old:['slaghauler','ladlecrew','cinderhound'] },
  substation_12:    { new:['arcflinger','sootwisp','barrierhand','fusecrawler'], old:['worker','shooter'] },
  scrap_gantry:     { new:['scrapram','cindermite','fusecrawler','barrierhand'], old:['picker','loader','forkbot','scanner'] },
  tailings_pit:     { new:['coalheaver','scrapram','cindermite','arcflinger'], old:['slaghauler','loader','ladlecrew'] },
  // ---- tier II
  bell_foundry:     { new:['belltoller','bulwarktread'], old:['coalheaver','arcflinger','fusecrawler','cindermite','sootwisp','slaghauler','ladlecrew'] },
  cold_archive:     { new:['menderwisp','longlens','sedabloom','bulwarktread'], old:['orderly','nursebot','gurneyrunner','barrierhand'] },
  audit_tower:      { new:['longlens','handler','menderwisp','bulwarktread'], old:['nursebot','orderly','gurneyrunner'] },
  aesthetic_ward:   { new:['sedabloom','menderwisp','handler'], old:['orderly','nursebot','gurneyrunner','barrierhand'] },
  pharmacy_vault:   { new:['sedabloom','menderwisp','longlens','bulwarktread'], old:['nursebot','orderly','gurneyrunner'] },
  outlet_mall:      { new:['handler','dustroach','longlens','bulwarktread'], old:['picker','scanner','loader','forkbot','scrapram','barrierhand'] },
  drained_reservoir:{ new:['dustroach','longlens','handler'], old:['picker','loader','slaghauler','scrapram','fusecrawler','cindermite'] },
  // ---- tier III
  anechoic_lab:     { new:['shiftstalker','leechorderly','relaynode'], old:['menderwisp','sedabloom','longlens','bulwarktread','nursebot','orderly'] },
  liquidation_floor:{ new:['packmule','mortartread','rebarcrusher'], old:['loader','scanner','handler','dustroach','bulwarktread','forkbot'] },
  parcel_tower:     { new:['packmule','mortartread','relaynode'], old:['picker','forkbot','scanner','handler','dustroach','longlens'] },
  freight_depot:    { new:['rebarcrusher','packmule','mortartread','staticpup'], old:['forkbot','loader','scanner','scrapram','dustroach'] },
  warranty_vault:   { new:['relaynode','packmule','mortartread'], old:['loader','scanner','picker','handler','longlens','bulwarktread'] },
  night_tunnels:    { new:['shiftstalker','staticpup','relaynode'], old:['worker','shooter','arcflinger','dustroach','longlens','sootwisp'] },
  breaker_yard:     { new:['rebarcrusher','mortartread','staticpup','packmule'], old:['slaghauler','ladlecrew','cinderhound','belltoller','coalheaver','arcflinger'] },
  radio_mast:       { new:['relaynode','staticpup','mortartread'], old:['nursebot','shooter','longlens','sedabloom','menderwisp','scrapram'] },
  // ---- tier IV
  recall_yard:      { new:['recalltrooper','tagcarrier','reclaimwalker','purgebeacon','sweepertread','repocrawler','triagewarden'], old:['shooter','arcflinger','shiftstalker','mortartread','relaynode','leechorderly','rebarcrusher','staticpup','fusecrawler','packmule','bulwarktread','menderwisp','longlens'] },
};
const GROUPS:Record<string,Role[]>={ front:['bruiser','shielded','charger'], swarm:['swarmer','exploder'], range:['ranged','sniper','caster'], supp:['healer','support','summoner','debuffer'] };
type Slot=[string,number]; // "group.pref.index", count
const TEMPLATES:Record<'yard'|'proc'|'junction'|'salvage',Slot[][]>={
  yard:     [ [['front.old.0',5],['range.old.0',2]], [['swarm.any.0',6]], [['front.new.0',2],['range.new.0',1]] ],
  proc:     [ [['front.new.0',3],['front.old.1',3],['range.new.0',2],['supp.new.0',1]], [['swarm.new.0',6],['front.new.1',1]], [['range.new.1',3],['front.new.2',2],['supp.new.1',1]] ],
  junction: [ [['front.new.1',2],['range.new.0',3],['supp.new.0',1]], [['range.any.1',3],['range.new.2',2],['supp.new.2',1]] ],
  salvage:  [ [['swarm.new.1',4],['swarm.any.2',2]] ],
};
const FALLBACK:Slot[][]=[ [['front.any.0',3],['range.any.0',2]] ]; // levels with no swarmers (clinic themes): a small front+ranged squad instead
const sel=(lm:LevelMobs,grp:string,pref:string,i:number,tier:number):string|undefined=>{
  const ok=(id:string)=>GROUPS[grp].includes(roleOf(id)!); const nw=lm.new.filter(ok), od=lm.old.filter(ok);
  let pool=pref==='new'?[...nw,...od]:pref==='old'?[...od,...nw]:[...nw,...od].sort((a,b)=>(a<b?-1:1)); if(grp==='supp'&&tier<2&&!pool.some(id=>MOB_BY_ID[id]?.tier===1)) return undefined; return pool.length?pool[i%pool.length]:undefined; };
/** squads for one zone of a level (counts scale slightly with tier; missing roles drop out; duplicate types merge) */
export function composeSquads(levelId:string,tier:number,zone:'yard'|'proc'|'junction'|'salvage'):Squad[]{
  const lm=LEVEL_MOBS[levelId]; const out:Squad[]=[]; const k=1+.1*(tier-1);
  for(const t of TEMPLATES[zone]){ const m=new Map<string,number>();
    for(const [slot,n] of t){ const [g,p,i]=slot.split('.'); const id=sel(lm,g,p,+i,tier); if(!id) continue; const spec=MOB_BY_ID[id]; const cnt=Math.max(1,Math.round(n*k)); m.set(id,Math.min((m.get(id)||0)+cnt,spec?Math.max(spec.pack[1],cnt):12)); }
    if(m.size) out.push([...m.entries()]); }
  if(!out.length&&zone==='salvage') return composeFallback(levelId,tier);
  return out; }
function composeFallback(levelId:string,tier:number):Squad[]{ const lm=LEVEL_MOBS[levelId]; const out:Squad[]=[]; for(const t of FALLBACK){ const m=new Map<string,number>(); for(const [slot,n] of t){ const [g,p,i]=slot.split('.'); const id=sel(lm,g,p,+i,tier); if(id) m.set(id,(m.get(id)||0)+n); } if(m.size) out.push([...m.entries()]); } return out; }
/** flat per-type roster [type,count] (what batch-1 `roster` carried) derived from the squads */
export function flatten(sq:Squad[]):[string,number][]{ const m=new Map<string,number>(); for(const s of sq) for(const [t,n] of s) m.set(t,(m.get(t)||0)+n); return [...m.entries()]; }
const MELEE_IDS=['swing','cleave','bite','slam','charge','rsweep','riposte'];
import { ENEMIES } from '../config';
const compat=(a:Affix,type:string)=>{ const d=ENEMIES[type]; if(!d||d.static||d.boss) return false; if(a==='vampiric'||a==='frenzied') return d.attacks.some(x=>MELEE_IDS.includes(x)); return true; };
/** Elite roll for one pack leader: affix list, or [] (none). `rnd` is the generator's seeded RNG. */
export function rollAffixes(type:string,tier:number,rnd:()=>number):Affix[]{ const c=TIER_CURVE[tier]; if(rnd()>=c.elite) return []; const pool=(Object.keys(AFFIX_TIER) as Affix[]).filter(a=>AFFIX_TIER[a]<=tier&&compat(a,type)); const out:Affix[]=[]; while(out.length<c.affixes&&pool.length){ const i=Math.floor(rnd()*pool.length); out.push(pool.splice(i,1)[0]); } return out; }
