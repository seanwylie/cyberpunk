// Per-character trait state: rolling playstyle log, provisional offers, permanent picks (docs/TRAITS.md).
// Deterministic rules choose the CANDIDATE SET; AI (server/story Lambda) may only rank inside it and write the descriptions.
import { TRAIT_CFG as C, TRAITS, TRAIT_BY_ID, FAMILIES, type Family, type TraitDef, type Effect, type EffectType, abilityFamilies, STACK_CAP, EFFECT_BOUNDS, MELEE_WEAPONS } from './traits';
export type Sig=Partial<Record<Family,number>>;
export interface RunBucket { t:number; end?:number; sig:Sig; n:number }
export interface Pick { id:string; at:number; level:number }
export interface Offer { tier:1|2; ids:string[]; at:number; src:'rules'|'ai'; sparse:boolean; lines?:Record<string,string>; key:string }
export interface TraitState { v:1; runs:RunBucket[]; cur:RunBucket|null; l10:Pick|null; l20:Pick|null; offer:Offer|null; hinted:Record<string,number>; seenUnlock?:Record<string,number> }
export const traitsOf=(s:any):TraitState=>{ if(!s.traits||s.traits.v!==1) s.traits={ v:1, runs:[], cur:null, l10:null, l20:null, offer:null, hinted:{} }; return s.traits; };

// ---------- recording ----------
export function addSig(s:any,sig:Sig,w=1,now=Date.now()){ const T=traitsOf(s); if(!T.cur) T.cur={ t:now, sig:{}, n:0 }; for(const f of FAMILIES){ const v=sig[f]; if(v) T.cur.sig[f]=Math.round(((T.cur.sig[f]||0)+v*w)*100)/100; } T.cur.n++; }
export const recordAbility=(s:any,abilityId:string)=>addSig(s,abilityFamilies(abilityId),3);
export const recordAuto=(s:any,weaponKind:string)=>addSig(s,MELEE_WEAPONS.has(weaponKind)?{ brute:1 }:weaponKind==='arc'?{ gun:.6, hack:.4 }:{ gun:1 },.25);
export const recordDodge=(s:any)=>addSig(s,{ ghost:1 },.6);
export const recordHack=(s:any)=>addSig(s,{ hack:1 },4);
export const recordCloakKill=(s:any)=>addSig(s,{ ghost:1 },2);
/** Close the current bucket (dungeon clear / town return) and trim to the rolling window. */
export function closeRun(s:any,now=Date.now()){ const T=traitsOf(s); if(T.cur&&T.cur.n>0){ T.cur.end=now; T.runs.push(T.cur); } T.cur=null; trimWindow(T,now); }
export function trimWindow(T:TraitState,now=Date.now()){ T.runs=T.runs.filter(r=>now-(r.end??r.t)<=C.windowMs).slice(-C.windowRuns); }
export function scores(s:any,now=Date.now()):{ sig:Record<Family,number>; total:number }{ const T=traitsOf(s); const sig=Object.fromEntries(FAMILIES.map(f=>[f,0])) as Record<Family,number>;
  for(const r of [...T.runs.filter(r=>now-(r.end??r.t)<=C.windowMs).slice(-C.windowRuns),...(T.cur?[T.cur]:[])]) for(const f of FAMILIES) sig[f]+=r.sig[f]||0; return { sig, total:FAMILIES.reduce((a,f)=>a+sig[f],0) }; }

// ---------- candidate rules ----------
const singles:Record<Family,string>={ hack:'netrunner', brute:'bruiser', gun:'gunslinger', ghost:'ghost', tech:'tinker' };
const hybridsOf=(f:Family)=>TRAITS.filter(t=>t.tier===1&&t.fams.length===2&&t.fams.includes(f));
export interface Lean { shares:Record<Family,number>; order:Family[]; sparse:boolean; kind:'lean'|'hybrid'|'balanced' }
/** prior = family weights of the currently equipped abilities (weak prior used only when the history is sparse). */
export function lean(s:any,prior:Sig={},now=Date.now()):Lean{ const { sig, total }=scores(s,now); const sparse=total<C.sparseMin; const w:Record<Family,number>={ ...sig };
  if(sparse){ const pt=FAMILIES.reduce((a,f)=>a+(prior[f]||0),0)||1; for(const f of FAMILIES) w[f]+=(prior[f]||0)/pt*C.sparseMin*C.priorWeight; }
  const tot=FAMILIES.reduce((a,f)=>a+w[f],0)||1; const shares=Object.fromEntries(FAMILIES.map(f=>[f,w[f]/tot])) as Record<Family,number>; const order=[...FAMILIES].sort((a,b)=>shares[b]-shares[a]||FAMILIES.indexOf(a)-FAMILIES.indexOf(b));
  const [a,b]=order; const kind:Lean['kind']=sparse?'balanced':(shares[b]>=C.hybridMin&&shares[a]-shares[b]<=C.hybridGap)?'hybrid':shares[a]>=C.leanMin?'lean':'balanced'; return { shares, order, sparse, kind }; }
export function candidates(s:any,tier:1|2,prior:Sig={},now=Date.now()):{ ids:string[]; lean:Lean }{ const L=lean(s,prior,now); const out:string[]=[]; const add=(id?:string)=>{ if(id&&TRAIT_BY_ID[id]&&!out.includes(id)&&out.length<C.offerN) out.push(id); };
  if(tier===2){ const T=traitsOf(s); const p=T.l10?.id; if(!p) return { ids:[], lean:L }; const pool=TRAITS.filter(t=>t.tier===2&&t.parent!.includes(p)); const sc=(t:TraitDef)=>t.fams.reduce((a,f)=>a+L.shares[f],0)/t.fams.length; pool.sort((x,y)=>sc(y)-sc(x)||x.id.localeCompare(y.id)); for(const t of pool) add(t.id); return { ids:out, lean:L }; }
  const [a,b]=L.order;
  if(L.kind==='hybrid'){ add(TRAITS.find(t=>t.tier===1&&t.fams.length===2&&t.fams.includes(a)&&t.fams.includes(b))?.id); add(singles[a]); add(singles[b]); add('jackofall'); }
  else if(L.kind==='lean'){ add(singles[a]); for(const h of hybridsOf(a).sort((x,y)=>L.shares[x.fams.find(f=>f!==a)!]-L.shares[y.fams.find(f=>f!==a)!]).reverse()) add(h.id); add('jackofall'); }
  else { add('jackofall'); add(singles[a]); add(TRAITS.find(t=>t.tier===1&&t.fams.length===2&&t.fams.includes(a)&&t.fams.includes(b))?.id||hybridsOf(a)[0]?.id); add(singles[b]); }
  return { ids:out, lean:L }; }

// ---------- offers (provisional) and picks (permanent) ----------
export const unlockedTier=(s:any):1|2|0=>{ const T=traitsOf(s); if(!T.l10) return s.level>=C.unlock1?1:0; if(!T.l20) return s.level>=C.unlock2?2:0; return 0; };
/** Refresh the provisional offer at a checkpoint (town return / dungeon clear / first unlock). Never touches confirmed picks. */
export function refreshOffer(s:any,prior:Sig={},now=Date.now()):Offer|null{ const T=traitsOf(s); const tier=unlockedTier(s); if(!tier){ T.offer=null; return null; }
  const c=candidates(s,tier,prior,now); const key=tier+':'+[...c.ids].sort().join(',');
  if(T.offer&&T.offer.key===key&&T.offer.tier===tier) return T.offer; T.offer={ tier, ids:c.ids, at:now, src:'rules', sparse:c.lean.sparse, key }; return T.offer; }
/** AI ranking: accepted only if it is a permutation of (a subset of) the current candidate set; lines are kept only for valid ids. */
export function applyRanking(s:any,ranked:unknown,lines?:unknown):boolean{ const T=traitsOf(s); const o=T.offer; if(!o||!Array.isArray(ranked)) return false; const ids=ranked.filter((x):x is string=>typeof x==='string');
  if(!ids.length||ids.length!==new Set(ids).size||ids.some(x=>!o.ids.includes(x))) return false; const rest=o.ids.filter(x=>!ids.includes(x)); o.ids=[...ids,...rest]; o.src='ai';
  if(lines&&typeof lines==='object'){ o.lines={}; for(const id of o.ids){ const l=(lines as any)[id]; if(typeof l==='string'&&l.length<=200) o.lines[id]=l; } } return true; }
export type ChooseResult={ ok:true; trait:TraitDef }|{ ok:false; why:string };
/** Permanent commit. There is deliberately NO respec / unpick function anywhere: changing specialization means a new character. */
export function chooseTrait(s:any,id:string,now=Date.now()):ChooseResult{ const T=traitsOf(s); const t=TRAIT_BY_ID[id]; if(!t) return { ok:false, why:'Unknown trait.' };
  if(t.tier===1){ if(T.l10) return { ok:false, why:'Your level 10 trait is permanent.' }; if(s.level<C.unlock1) return { ok:false, why:`Unlocks at level ${C.unlock1}.` }; }
  else { if(!T.l10) return { ok:false, why:'Confirm a level 10 trait first.' }; if(T.l20) return { ok:false, why:'Your level 20 trait is permanent.' }; if(s.level<C.unlock2) return { ok:false, why:`Unlocks at level ${C.unlock2}.` }; if(!t.parent!.includes(T.l10.id)) return { ok:false, why:'That trait does not build on your path.' }; }
  if(!T.offer||T.offer.tier!==t.tier||!T.offer.ids.includes(id)) return { ok:false, why:'That trait is not on offer right now.' };
  const p={ id, at:now, level:s.level }; if(t.tier===1) T.l10=p; else T.l20=p; T.offer=null; return { ok:true, trait:t }; }
/** Validated, clamped, merged effects of the character's confirmed traits. Unknown / out-of-bounds data from a tampered save is dropped or clamped. */
export function traitEffects(s:any):Effect[]{ const T=traitsOf(s); const out:Effect[]=[]; const tot:Partial<Record<string,number>>={};
  for(const p of [T.l10,T.l20]){ const t=p&&TRAIT_BY_ID[p.id]; if(!t) continue; if(t.tier===2&&(!T.l10||!t.parent!.includes(T.l10.id))) continue; for(const e of t.effects){ const b=(EFFECT_BOUNDS as any)[e.t]; if(!b) continue; let v=Math.max(b.min,Math.min(b.max,e.v)); const k=e.t+':'+(e.f||'*'); const cap=STACK_CAP[e.t as EffectType]??b.max; v=Math.max(0,Math.min(v,cap-(tot[k]||0))); tot[k]=(tot[k]||0)+v; if(v>0) out.push({ ...e, v }); } }
  return out; }
/** Sum of one effect type for an ability (family-weighted: an ability counts for a family when its weight >= .5) or globally. */
export function famBonus(fx:Effect[],t:EffectType,abilityId?:string):number{ const fw=abilityId?abilityFamilies(abilityId):{}; let v=0; for(const e of fx){ if(e.t!==t) continue; if(!e.f) v+=e.v; else if((fw[e.f]||0)>=.5) v+=e.v; } return v; }
export const statBonus=(fx:Effect[],t:EffectType)=>fx.filter(e=>e.t===t&&!e.f).reduce((a,e)=>a+e.v,0);
