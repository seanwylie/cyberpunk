// "Your body is the build": permanent limb losses (docs/LIMBS.md).
// Elites and bosses have a telegraphed Rend. If it lands, one augmented limb is torn off: its benefits are gone and a small debuff applies.
// Choices: fit a free Mass-Market Field Patch on the spot (works, but jams now and then), or fight on and have the Repair Bay reattach the part in town (credits),
// or take a free Stock refit there. Never stuck: every path has a free option, bare limbs still fight, and lost parts are kept on the shelf until reattached.
import { ITEM_BY_ID, REPAIR_COST, SLOT_LABEL, type Slot, type Stats } from './config';
import { mkInst, type Inst, type Save } from './state';

export const LIMB_SLOTS:Slot[]=['armL','armR','handL','handR','legL','legR','footL','footR'];
export const LIMBS={
  /** Rend: windup (s), reach (tiles), arc (rad), cooldown (s). Long windup + "REND" call-out: always dodgeable. */
  rend:{ w:1.5, rec:1.0, cd:24, r:2.4, arc:Math.PI*.5 },
  /** no tearing below this level (first hours stay calm) and at most this many tears per run */
  minLevel:4, perRun:1,
  /** reattach price = REPAIR_COST[rarity] x mul */ reattachMul:2,
  /** humanity: each reattachment leaves a scar (-1 humanity, capped); patches cost their own humanity (ItemDef.hum) */
  scarHum:1, scarMax:8,
  /** Field Patch jams: a jam every jamMin..jamMax s of combat, lasting jamDur s */
  jamMin:16, jamMax:30, jamDur:1.4,
  /** debuff while a limb slot is empty, multiplied in per slot */
  debuff:{ arm:{dmg:.85}, hand:{atkSpeed:.85}, leg:{move:.88}, foot:{move:.94} } as Record<string,Partial<Record<keyof Stats,number>>>,
  /** effect while a patch is jammed, per patched group */
  jam:{ arm:{atkSpeed:.35}, hand:{atkSpeed:.35}, leg:{move:.55}, foot:{move:.7} } as Record<string,Partial<Record<keyof Stats,number>>>,
};
export interface LostRec{ inst:Inst; by:string; at:number }
export interface LimbState{ lost:Partial<Record<Slot,LostRec>>; scars:number; tears:number }
const group=(sl:Slot)=>sl.replace(/[LR]$/,'');
export const isPatch=(def:string|undefined)=>!!def&&def.startsWith('mmpatch_');
export function limbState(s:Save):LimbState{ const x=(s as any).limbs as LimbState|undefined; if(x&&x.lost) return x; const n:LimbState={ lost:{}, scars:0, tears:0 }; (s as any).limbs=n; return n; }
const instAt=(s:Save,sl:Slot)=>{ const u=s.installed[sl]; return u?s.items.find(i=>i.uid===u):undefined; };
/** limb slots whose installed part can be torn: real augments only (never stock, never a patch, never a slot already open) */
export function tearable(s:Save):Slot[]{ return LIMB_SLOTS.filter(sl=>{ const it=instAt(s,sl); return !!it&&!it.def.startsWith('stock_')&&!isPatch(it.def)&&!limbState(s).lost[sl]; }); }
/** slots with a lost part (on the Repair Bay shelf) */
export const lostSlots=(s:Save)=>LIMB_SLOTS.filter(sl=>!!limbState(s).lost[sl]);
/** lost and nothing fitted yet: the debuffed state */
export const openSlots=(s:Save)=>lostSlots(s).filter(sl=>!s.installed[sl]);
export const patchedSlots=(s:Save)=>LIMB_SLOTS.filter(sl=>isPatch(instAt(s,sl)?.def));

/** Tear one augmented limb off. The part leaves the build (and the locker) and goes on the shelf. Returns the slot or null. */
export function tearLimb(s:Save,by:string,rnd:()=>number=Math.random):Slot|null{
  const c=tearable(s); if(!c.length) return null; const sl=c[Math.floor(rnd()*c.length)%c.length]; const it=instAt(s,sl)!;
  const L=limbState(s); s.items=s.items.filter(i=>i!==it); delete s.installed[sl]; L.lost[sl]={ inst:it, by:String(by).slice(0,40), at:Date.now() }; L.tears++; return sl; }
/** Free Field Patch on the spot (or anywhere): fits a Mass-Market emergency part into an open lost slot. */
export function patchLimb(s:Save,sl:Slot):boolean{ if(!limbState(s).lost[sl]||s.installed[sl]) return false; const it=mkInst(s,'mmpatch_'+sl); s.items.push(it); s.installed[sl]=it.uid; return true; }
export const reattachCost=(s:Save,sl:Slot)=>{ const r=limbState(s).lost[sl]; const d=r&&ITEM_BY_ID[r.inst.def]; return d?Math.round(REPAIR_COST[d.rarity]*LIMBS.reattachMul):0; };
/** whatever is fitted now: a patch is scrapped, a stock part is scrapped, anything else goes back to the locker */
function clearSlot(s:Save,sl:Slot){ const it=instAt(s,sl); delete s.installed[sl]; if(it&&(isPatch(it.def)||it.def.startsWith('stock_'))) s.items=s.items.filter(i=>i!==it); }
/** Repair Bay: put the original part back (credits). Leaves a scar. */
export function reattach(s:Save,sl:Slot):{ok:boolean;why?:string;cost?:number}{ const L=limbState(s); const r=L.lost[sl]; if(!r) return {ok:false,why:'Nothing to reattach.'};
  const cost=reattachCost(s,sl); if(s.credits<cost) return {ok:false,why:'Needs '+cost+'c. Stock refit is free.'}; s.credits-=cost; clearSlot(s,sl); s.items.push(r.inst); s.installed[sl]=r.inst.uid; delete L.lost[sl]; L.scars=Math.min(LIMBS.scarMax,L.scars+1); return {ok:true,cost}; }
/** Repair Bay: free Standard Issue limb. The lost part stays on the shelf for later. */
export function stockRefit(s:Save,sl:Slot):boolean{ if(!limbState(s).lost[sl]) return false; const cur=instAt(s,sl); if(cur&&cur.def.startsWith('stock_')) return false; clearSlot(s,sl); const it=mkInst(s,'stock_'+sl); s.items.push(it); s.installed[sl]=it.uid; return true; }
/** humanity lost to scars (src/altplay.ts humanityOfSave) */
export const scarHumanity=(s:any)=>Math.min(LIMBS.scarMax,(s?.limbs?.scars|0))*LIMBS.scarHum;
/** stat changes from open slots and jammed patches (called by Game.recompute) */
export function applyLimbStats(s:Save,st:Stats,jammed:boolean){ const mul=(m?:Partial<Record<keyof Stats,number>>)=>{ if(m) for(const k of Object.keys(m) as (keyof Stats)[]) st[k]*=m[k]!; };
  for(const sl of openSlots(s)) mul(LIMBS.debuff[group(sl)]); if(jammed) for(const sl of patchedSlots(s)) mul(LIMBS.jam[group(sl)]); }
export const slotName=(sl:Slot)=>SLOT_LABEL[sl];

// ---------- runtime (Game) ----------
interface G{ save:Save; inst:any; mode:string; downed:boolean; dd:any; hp:number; combatHold:number; toast(t:string):void; recompute():void; popup(x:number,y:number,t:string,c:string):void; px:number; py:number; emit(k:string,v?:any):void; fx:any[]; _limb?:{jamT:number;next:number} }
/** may this enemy use Rend right now? (solo runs only, elites/bosses, a tearable limb, under the per-run cap) */
export function rendReady(g:G,def:any):boolean{ if(!(def.elite||def.boss)||g.mode!=='run'||!g.inst||String(g.inst.id).startsWith('net-')) return false; if((g.save.level|0)<LIMBS.minLevel) return false; if(((g.inst as any).tears|0)>=LIMBS.perRun) return false; return tearable(g.save).length>0; }
/** Rend landed (player took the hit and is still standing) */
export function onRendHit(g:G,by:string){ if(g.downed) return; const sl=tearLimb(g.save,by); if(!sl) return; g.inst.tears=(g.inst.tears|0)+1; g.recompute();
  const name=ITEM_BY_ID[limbState(g.save).lost[sl]!.inst.def]?.name||slotName(sl); g.popup(g.px,g.py-1,'LIMB TORN','#d9a066'); g.fx.push({kind:'blood',x:g.px,y:g.py,t:0,life:.9,c:'#7a2f26'});
  g.toast(by+' tore off your '+name+'. Patch it now, or fight on and reattach it at the Repair Bay.'); g.emit('sfx','down'); g.emit('limbTorn',sl); }
export function limbTick(g:G,dt:number){ const ps=patchedSlots(g.save); if(!ps.length){ if(g._limb?.jamT){ g._limb.jamT=0; g.recompute(); } return; }
  const J=g._limb||(g._limb={jamT:0,next:LIMBS.jamMin+Math.random()*(LIMBS.jamMax-LIMBS.jamMin)});
  if(J.jamT>0){ J.jamT-=dt; if(J.jamT<=0){ J.jamT=0; g.recompute(); } return; }
  if(g.mode!=='run'||g.downed||g.combatHold<=0) return; J.next-=dt; if(J.next>0) return;
  J.next=LIMBS.jamMin+Math.random()*(LIMBS.jamMax-LIMBS.jamMin); J.jamT=LIMBS.jamDur; g.recompute(); g.popup(g.px,g.py-1,'PATCH JAMMED','#b5a46a'); }
export const jammed=(g:G)=>!!g._limb&&g._limb.jamT>0;
