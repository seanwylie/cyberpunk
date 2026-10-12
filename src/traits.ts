// Trait progression (docs/TRAITS.md). Permanent, playstyle-driven specialization at levels 10 and 20.
// Everything here is bounded, data-driven and validated by the game: a trait is a set of FAMILY-LEVEL modifiers (never one augment),
// every modifier type is whitelisted with numeric bounds (EFFECT_BOUNDS), and validateTrait()/clampEffects() enforce them at load and apply time.
import { ABILITIES } from './config';
import { ABILITY_DATA } from './abilities/data';

/** Tunable constants (docs/TRAITS.md). */
export const TRAIT_CFG = {
  unlock1:10, unlock2:20,
  /** rolling window: the last windowRuns dungeon runs OR windowHours of play, whichever is SHORTER in events kept */
  windowRuns:15, windowHours:3,
  /** buckets older than this are dropped regardless of run count */
  windowMs:3*3600*1000,
  /** below this many weighted signal points the history is "sparse": balanced set + equipped ability tags as a weak prior */
  sparseMin:40, priorWeight:.25,
  /** a family needs this share of the total to count as a lean; two families within hybridGap of each other (both >= hybridMin) produce a hybrid */
  leanMin:.34, hybridMin:.25, hybridGap:.12,
  /** options offered at once */
  offerN:3,
  /** hints: recognition lines fire when a family's share crosses this */
  hintShare:.4,
};
export type Family='hack'|'brute'|'gun'|'ghost'|'tech';
export const FAMILIES:Family[]=['hack','brute','gun','ghost','tech'];
export const FAMILY_NAME:Record<Family,string>={ hack:'Hacking', brute:'Direct combat', gun:'Ranged', ghost:'Stealth & evasion', tech:'Drones & tech' };

/** Whitelisted effect types with hard numeric bounds (fractions). Anything else is rejected. */
export const EFFECT_BOUNDS = {
  famDmg:   { min:0, max:.15, desc:(v:number,f?:Family)=>`+${pct(v)} damage with ${fam(f)} abilities` },
  famCdr:   { min:0, max:.15, desc:(v:number,f?:Family)=>`${pct(v)} faster cooldowns on ${fam(f)} abilities` },
  famHeat:  { min:0, max:.2,  desc:(v:number,f?:Family)=>`${pct(v)} less heat from ${fam(f)} abilities` },
  famDur:   { min:0, max:.25, desc:(v:number,f?:Family)=>`+${pct(v)} duration on ${fam(f)} effects (stuns, cloaks, summons)` },
  autoDmg:  { min:0, max:.12, desc:(v:number)=>`+${pct(v)} basic attack damage` },
  meleeDmg: { min:0, max:.12, desc:(v:number)=>`+${pct(v)} melee basic attack damage` },
  rangedDmg:{ min:0, max:.12, desc:(v:number)=>`+${pct(v)} ranged basic attack damage` },
  maxHp:    { min:0, max:.1,  desc:(v:number)=>`+${pct(v)} max HP` },
  moveSpd:  { min:0, max:.08, desc:(v:number)=>`+${pct(v)} move speed` },
  dodgeCd:  { min:0, max:.2,  desc:(v:number)=>`${pct(v)} faster dodge recovery` },
} as const;
export type EffectType=keyof typeof EFFECT_BOUNDS;
export interface Effect { t:EffectType; v:number; f?:Family }
export interface TraitDef { id:string; tier:1|2; name:string; short:string; fams:Family[]; /** level 20 only: which L10 traits it complements */ parent?:string[]; blurb:string; effects:Effect[] }
const pct=(v:number)=>Math.round(v*100)+'%';
const fam=(f?:Family)=>f?FAMILY_NAME[f].toLowerCase():'all';
/** Max total |value| per effect type summed over BOTH traits of a character (stacking bound). */
export const STACK_CAP:Partial<Record<EffectType,number>>={ famDmg:.25, famCdr:.2, famHeat:.25, famDur:.3, autoDmg:.15, meleeDmg:.15, rangedDmg:.15, maxHp:.12, moveSpd:.1, dodgeCd:.25 };

const T=(id:string,tier:1|2,name:string,short:string,fams:Family[],blurb:string,effects:Effect[],parent?:string[]):TraitDef=>({ id,tier,name,short,fams,blurb,effects,parent });
export const TRAITS:TraitDef[]=[
  // ---- level 10: one per family + hybrids ----
  T('netrunner',1,'Netrunner','Netrun',['hack'],'You get into systems before you get into fights.',[{t:'famDmg',f:'hack',v:.1},{t:'famCdr',f:'hack',v:.1}]),
  T('bruiser',1,'Bruiser','Bruiser',['brute'],'Close the distance. Stay there.',[{t:'meleeDmg',v:.1},{t:'famDmg',f:'brute',v:.08},{t:'maxHp',v:.06}]),
  T('gunslinger',1,'Gunslinger','Gunsl.',['gun'],'Range is armour you never have to repair.',[{t:'rangedDmg',v:.1},{t:'famDmg',f:'gun',v:.08}]),
  T('ghost',1,'Ghost','Ghost',['ghost'],'Nobody remembers seeing you, which is the point.',[{t:'famDur',f:'ghost',v:.2},{t:'dodgeCd',v:.15},{t:'moveSpd',v:.04}]),
  T('tinker',1,'Drone Tinker','Tinker',['tech'],'Your best work fights for you.',[{t:'famDur',f:'tech',v:.2},{t:'famDmg',f:'tech',v:.08}]),
  T('breacher',1,'Breacher','Breach',['hack','brute'],'Crack the lock, then crack the guard.',[{t:'famCdr',f:'hack',v:.07},{t:'meleeDmg',v:.07},{t:'maxHp',v:.04}]),
  T('overwatch',1,'Overwatch','Overw.',['gun','tech'],'Turrets on the left, you on the right.',[{t:'rangedDmg',v:.07},{t:'famDur',f:'tech',v:.12}]),
  T('phantom',1,'Phantom Blade','Phantom',['ghost','brute'],'In, out, gone.',[{t:'meleeDmg',v:.07},{t:'famDur',f:'ghost',v:.12},{t:'dodgeCd',v:.08}]),
  T('glitch',1,'Glitch','Glitch',['hack','ghost'],'The cameras see static where you stood.',[{t:'famDmg',f:'hack',v:.07},{t:'famDur',f:'ghost',v:.12}]),
  T('jackofall',1,'Freelancer','Freel.',['hack','brute','gun','ghost','tech'],'No speciality is still a speciality.',[{t:'autoDmg',v:.05},{t:'maxHp',v:.05},{t:'moveSpd',v:.03}]),
  // ---- level 20: per L10 trait, complements it ----
  T('rootkit',2,'Rootkit','Rootkit',['hack'],'Every system you touch stays a little bit yours.',[{t:'famDur',f:'hack',v:.2},{t:'famHeat',f:'hack',v:.15}],['netrunner','glitch','breacher']),
  T('icebreaker',2,'Icebreaker','Icebrk.',['hack','brute'],'Overload first, ask later.',[{t:'famDmg',f:'hack',v:.1},{t:'maxHp',v:.04}],['netrunner','breacher']),
  T('juggernaut',2,'Juggernaut','Jugg.',['brute'],'Stops for nothing that hits it.',[{t:'maxHp',v:.06},{t:'famHeat',f:'brute',v:.15}],['bruiser','breacher','phantom']),
  T('berserker',2,'Berserker','Berserk',['brute'],'Faster, louder, closer.',[{t:'meleeDmg',v:.05},{t:'famCdr',f:'brute',v:.1}],['bruiser','phantom']),
  T('deadeye',2,'Deadeye','Deadeye',['gun'],'One shot, one invoice.',[{t:'famDmg',f:'gun',v:.1},{t:'famCdr',f:'gun',v:.08}],['gunslinger','overwatch']),
  T('runandgun',2,'Run and Gun','R&G',['gun','ghost'],'Never be where the return fire lands.',[{t:'rangedDmg',v:.05},{t:'moveSpd',v:.04},{t:'dodgeCd',v:.1}],['gunslinger','ghost']),
  T('shade',2,'Shade','Shade',['ghost'],'Longer gone, harder to find.',[{t:'famCdr',f:'ghost',v:.12},{t:'moveSpd',v:.04}],['ghost','phantom','glitch']),
  T('swarmlord',2,'Swarm Lord','Swarm',['tech'],'More of them, for longer.',[{t:'famDur',f:'tech',v:.1},{t:'famCdr',f:'tech',v:.12}],['tinker','overwatch']),
  T('fieldmech',2,'Field Mechanic','Mech.',['tech','brute'],'Keeps the drones and the body running.',[{t:'maxHp',v:.05},{t:'famHeat',f:'tech',v:.15}],['tinker','overwatch']),
  T('journeyman',2,'Journeyman','Journ.',['hack','brute','gun','ghost','tech'],'Every tool, a little sharper.',[{t:'famCdr',v:.06},{t:'maxHp',v:.04}],['jackofall']),
  T('adaptable',2,'Adaptable','Adapt.',['hack','brute','gun','ghost','tech'],'Whatever the job needs, again.',[{t:'autoDmg',v:.05},{t:'famHeat',v:.1},{t:'dodgeCd',v:.08}],['jackofall','glitch','breacher','phantom','overwatch']),
];
export const TRAIT_BY_ID:Record<string,TraitDef>=Object.fromEntries(TRAITS.map(t=>[t.id,t]));

/** Validation (run by tests and at load): every effect whitelisted and within bounds; L20 has parents that exist; no augment ids. */
export function validateTrait(t:TraitDef):string[]{ const e:string[]=[]; for(const x of t.effects){ const b=(EFFECT_BOUNDS as any)[x.t]; if(!b){ e.push(t.id+': effect '+x.t+' not whitelisted'); continue; } if(!(typeof x.v==='number'&&x.v>=b.min&&x.v<=b.max)) e.push(`${t.id}: ${x.t}=${x.v} out of [${b.min},${b.max}]`); if(x.f&&!FAMILIES.includes(x.f)) e.push(t.id+': bad family '+x.f); }
  if(t.tier===2&&!(t.parent||[]).length) e.push(t.id+': level 20 trait without parent'); for(const p of t.parent||[]) if(TRAIT_BY_ID[p]?.tier!==1) e.push(t.id+': parent '+p+' is not a level 10 trait'); if(!t.effects.length||t.effects.length>4) e.push(t.id+': 1-4 effects'); return e; }
export const TRAIT_ERRORS=TRAITS.flatMap(validateTrait);
export function describeEffect(x:Effect){ return (EFFECT_BOUNDS as any)[x.t].desc(x.v,x.f); }

/** Ability -> family weights, derived from catalog data (role/type/shape/range). Built-in abilities use their type. */
export function abilityFamilies(id:string):Partial<Record<Family,number>>{ const d=ABILITY_DATA.find(a=>a.id===id);
  if(d){ const o:Partial<Record<Family,number>>={}; const add=(f:Family,v:number)=>{ o[f]=(o[f]||0)+v; };
    if(d.role==='tech'||d.role==='summon'){ add('tech',1); if(d.type==='hacking') add('hack',.3); }
    else if(d.type==='hacking') add('hack',1);
    if(d.role==='stealth'||d.role==='mobility'||d.type==='mobility') add('ghost',1);
    if(d.type==='attack'&&d.role!=='stealth'&&d.role!=='mobility'){ const ranged=d.shape==='line'||(d.shape==='lockon'&&d.range>=5)||(d.shape==='ground'&&d.range>=7); const close=d.shape==='cone'||d.shape==='self'||d.range<=3.5; if(ranged&&!close) add('gun',1); else if(close&&!ranged) add('brute',1); else { add('gun',.5); add('brute',.5); } }
    if(d.type==='defense') add('brute',.5);
    return o; }
  const b=(ABILITIES as any)[id]; if(!b) return {};
  switch(b.type){ case 'hacking': return { hack:1 }; case 'mobility': return id==='cloak'?{ ghost:1 }:{ ghost:.6, brute:.4 }; case 'defense': return { brute:.5 }; default: return b.range>=5?{ gun:.5, brute:.5 }:{ brute:1 }; } }
export const MELEE_WEAPONS=new Set(['fist','ripper','blade']);
