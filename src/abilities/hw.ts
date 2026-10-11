// Ability-bearing hardware (generated from data.ts), acquisition curve (drop/vendor weights, gates, pity) and chip->ability modifiers.
import type { ItemDef, Slot, Stats } from '../config';
import { ABILITY_DATA } from './registry';
import type { AbilityData, Grp, Rar, Mf } from './types';
import type { AbMods } from './engine';

/** ===== Acquisition curve knobs (docs/ABILITIES.md "Acquisition"). Respects DROP_RATE_SCALE: these REPLACE a roll, they never add rolls. ===== */
/** Global power knob for the augment abilities (1 = authored values). Ability damage is multiplied by dmg, heat costs by heat. Balance tool: tools/balance/run.mjs --kits abmid,abpurple. */
export const ABILITY_BAL={ dmg:1.5, heat:1 };
export const ABILITY_ACQ = {
  /** global multiplier on every conversion chance below (1 = design target) */
  scale:1,
  /** chance that an item/chip/stim roll from this loot tier is converted into an ability-bearing augment */
  convert:{ ordinary:.22, elite:.35, boss:.5 } as Record<'ordinary'|'elite'|'boss',number>,
  /** relative weight of each ability rarity in a converted roll */
  weights:{
    ordinary:{ grey:44, green:42, blue:12, purple:2, orange:0 },
    elite:{ grey:8, green:26, blue:52, purple:13, orange:1 },
    boss:{ grey:0, green:12, blue:46, purple:32, orange:10 } } as Record<'ordinary'|'elite'|'boss',Record<Rar,number>>,
  /** extra weight for abilities not yet discovered (variety first) */
  newBoost:3,
  /** purple/orange gates: manufacturer reputation rank needed, and orange only from bosses */
  rankGate:{ grey:0, green:0, blue:0, purple:1, orange:2 } as Record<Rar,number>,
  orangeBossOnly:true,
  /** pity: after this many finished runs without an ability-bearing augment, the next item roll is forced to a common one. First run too. */
  pityRuns:1,
  /** the first item roll of the very first run is forced (so the first run visibly yields an ability) */
  firstRunGuarantee:true,
};

const P:Record<Mf,string>={ HI:'HB', PS:'AS', MM:'KV' };
const SLOTS_OF:Record<Grp,Slot[]>={ arm:['armR','armL'], hand:['handR','handL'], leg:['legL','legR'], foot:['footL','footR'], torso:['torso'], face:['face'], brain:['brain'] };
const NOUN:Record<Slot,string>={ armR:'Arm (R)', armL:'Arm (L)', handR:'Hand (R)', handL:'Hand (L)', legL:'Leg (L)', legR:'Leg (R)', footL:'Foot (L)', footR:'Foot (R)', torso:'Torso', face:'Visor', brain:'Core' };
const U:Record<Rar,number>={ grey:.5, green:1, blue:1.8, purple:3, orange:5 };
const LVL:Record<Rar,number>={ grey:6, green:9, blue:14, purple:20, orange:27 };
const r2=(v:number)=>Math.round(v*100)/100;
function stats(g:Grp,m:Mf,rar:Rar):Partial<Stats>{ const u=U[rar]; let s:Partial<Stats>={};
  if(g==='arm'||g==='hand') s={dmg:.03*u}; else if(g==='leg') s={maxHp:Math.round(5*u),move:.012*u}; else if(g==='foot') s={move:.015*u,armor:.3*u}; else if(g==='torso') s={maxHp:Math.round(8*u),armor:.4*u}; else if(g==='brain') s={cooling:.05*u,dmg:.01*u}; else s={armor:.3*u,dmg:.015*u};
  if(m==='HI'){ s.armor=(s.armor||0)+.5*u; s.maxHp=(s.maxHp||0)+Math.round(3*u); } else if(m==='PS'){ s.cooling=(s.cooling||0)+.03*u; s.dmg=(s.dmg||0)+.01*u; } else { s.regen=(s.regen||0)+.08*u; s.pickup=(s.pickup||0)+.08*u; }
  for(const k of Object.keys(s) as (keyof Stats)[]) s[k]=r2(s[k]!); return s; }
export interface HwRow { item:ItemDef; abilities:string[]; }
function build():ItemDef[]{
  const out:ItemDef[]=[]; const ctr:Record<string,number>={}; const bundles:Record<string,AbilityData[]>={};
  const addTo=(a:AbilityData,g:Grp,variant:number)=>{ const sl=SLOTS_OF[g]; const n=(ctr[g+variant]=(ctr[g+variant]||0)+1); const slot=sl[n%sl.length]; const key=[a.mfr,a.rarity,slot,variant].join('|'); (bundles[key]=bundles[key]||[]).push(a); };
  for(const a of ABILITY_DATA){ addTo(a,a.slots[0],0); if((a.rarity==='grey'||a.rarity==='green')&&a.slots[1]) addTo(a,a.slots[1],1); }
  for(const [key,list] of Object.entries(bundles)){ const [mfr,rar,slot,v]=key.split('|') as [Mf,Rar,Slot,string]; const grp=Object.entries(SLOTS_OF).find(([,s])=>s.includes(slot))![0] as Grp;
    // bundles of up to 2 abilities, never two with the same role in one augment
    const rest=[...list]; while(rest.length){ const first=rest.shift()!; let sec:AbilityData|undefined; if(first.rarity!=='orange'){ const i=rest.findIndex(x=>x.role!==first.role&&!x.id.startsWith(first.id)); if(i>=0&&(rest.length>=1)) sec=rest.splice(i,1)[0]; }
      const abil=[first,...(sec?[sec]:[])]; const nm=`${P[mfr]} ${first.name}${sec?' Duo':''} ${NOUN[slot]}`;
      const id=`ab_${mfr.toLowerCase()}_${slot}_${first.id}${v==='1'?'_v2':''}`;
      const lvl=LVL[rar]+(first.heat%3)+(sec?1:0)+(v==='1'?1:0);
      out.push({ id,name:nm,slot,mfr,rarity:rar,lvl,stats:stats(grp,mfr,rar),abilities:abil.map(a=>a.id),blurb:abil.map(a=>`${a.name}: ${a.flavor}`).join(' ') } as ItemDef); } }
  return out; }
/** All generated ability-bearing hardware. config.ts appends these to ITEMS. */
export const ABILITY_ITEMS:ItemDef[]=build();

/** Chip -> ability modifier table: how chips change ability behaviour. */
export const CHIP_AB_MODS:Record<string,Partial<AbMods>>={
  speed:{cdr:.03}, fineedge:{cdr:.02,dmg:.02}, power:{dmg:.06}, overdrive:{dmg:.12}, cutwide:{arc:.25}, bladepat:{len:.25}, coolant:{heat:.04}, quench:{heat:.07}, sustain:{heal:.1},
  ablative:{shield:.1}, plating:{shield:.08}, cloakdur:{cloak:2}, ctrldur:{cc:.2,dur:.1}, gridlink:{cc:.1,dur:.1}, stride:{dash:.06}, servo:{dash:.1}, magnet:{} };
/** Chips that visibly change this ability (derived from its primitives). */
export function chipsFor(a:AbilityData):string[]{ const s=new Set<string>(['speed','fineedge','coolant','quench']); const walk=(ps:any[])=>{ for(const p of ps){ switch(p.p){
  case 'cone': s.add('cutwide'); s.add('power'); s.add('overdrive'); break; case 'line': case 'projectile': s.add('bladepat'); s.add('power'); s.add('overdrive'); if(p.then) walk(p.then); break;
  case 'circle': case 'chain': case 'damage': case 'shoot': s.add('power'); s.add('overdrive'); break; case 'dash': s.add('stride'); s.add('servo'); case 'teleport': s.add('stride'); s.add('servo'); break;
  case 'stun': case 'slow': case 'root': case 'control': s.add('ctrldur'); s.add('gridlink'); break; case 'cloak': s.add('cloakdur'); break; case 'heal': s.add('sustain'); break; case 'shield': case 'mitigate': s.add('ablative'); s.add('plating'); break; case 'buff': s.add('gridlink'); s.add('ctrldur'); if(p.s==='move'){ s.add('stride'); s.add('servo'); } if(p.s==='lifesteal') s.add('sustain'); break; case 'vent': break;
  case 'mark': case 'expose': case 'summon': case 'aura': s.add('gridlink'); s.add('ctrldur'); if(p.tick) walk(p.tick); break; case 'delayed': case 'trap': walk(p.then); break; } } }; walk(a.steps); if(a.toggle){ if(a.toggle.mitigate){ s.add('plating'); s.add('ablative'); } if(a.toggle.dmg){ s.add('power'); s.add('overdrive'); } } return [...s]; }

export const abilityOrder=(id:string)=>ABILITY_DATA.findIndex(a=>a.id===id);

export interface PickEnv { tier:'ordinary'|'elite'|'boss'; level:number; tierCap:number; rank:Record<Mf,number>; discovered:Record<string,number>|undefined; rnd:()=>number; }
/** Choose an ability-bearing augment for a converted roll. Returns null when nothing is eligible. */
export function pickAbilityItem(env:PickEnv):ItemDef|null{
  const w=ABILITY_ACQ.weights[env.tier]; const elig=(i:ItemDef)=>i.lvl<=env.level&&i.lvl<=env.tierCap&&env.rank[i.mfr]>=ABILITY_ACQ.rankGate[i.rarity]&&!(i.rarity==='orange'&&ABILITY_ACQ.orangeBossOnly&&env.tier!=='boss');
  const pool=ABILITY_ITEMS.filter(elig); if(!pool.length) return null;
  const byRar:Record<string,ItemDef[]>={}; for(const i of pool) (byRar[i.rarity]=byRar[i.rarity]||[]).push(i);
  const rars=Object.keys(byRar) as Rar[]; const tot=rars.reduce((s,r)=>s+(w[r]||0),0); if(tot<=0) return null; let x=env.rnd()*tot; let rar=rars[0]; for(const r of rars){ x-=w[r]||0; if(x<=0){ rar=r; break; } }
  const list=byRar[rar]; const wt=list.map(i=>1+(i.abilities!.some(a=>!(env.discovered&&env.discovered[a]))?ABILITY_ACQ.newBoost-1:0)); const T=wt.reduce((a,b)=>a+b,0); let y=env.rnd()*T; for(let i=0;i<list.length;i++){ y-=wt[i]; if(y<=0) return list[i]; } return list[0]; }
/** Common-only pick for the pity timer / tutorial. */
export function pickCommonAbilityItem(env:Omit<PickEnv,'tier'>):ItemDef|null{ const pool=ABILITY_ITEMS.filter(i=>(i.rarity==='grey'||i.rarity==='green')&&i.lvl<=env.level&&i.lvl<=env.tierCap); if(!pool.length) return null;
  const fresh=pool.filter(i=>i.abilities!.some(a=>!(env.discovered&&env.discovered[a]))); const L=fresh.length?fresh:pool; return L[Math.floor(env.rnd()*L.length)]; }
