// IDKFA as a TOGGLE (dev cheat). ON: snapshot the real state, then grant the overpowered set. OFF: restore the snapshot exactly and strip every
// cheat-granted item (inventory, bank) so nothing leaks into storage or build exports. Real loot picked up while ON is kept (items, chips,
// credits/stims gained). The snapshot lives in the save (save.idkfa) so a reload while ON can still revert. Pure save logic, no DOM.
import { SLOTS, ITEM_BY_ID, type Slot, type ChipId } from './config';
import { mkInst, type Save, type Inst } from './state';
import { IDKFA_SET, IDKFA_CHIPS, IDKFA_PICK } from './content/idkfa';
import { ABILITY_ITEMS } from './abilities/hw';

export interface IdkfaSnap { at:string; installed:Partial<Record<Slot,string>>; chips:Record<string,ChipId[]>; lockerChips:Partial<Record<ChipId,number>>; abPick:(string|null)[]|null;
  level:number; xp:number; credits:number; stims:number; repairBill:number; lockerCap:number; codex:Record<string,number>|null; cheated:boolean;
  hp:number|null; broken:Slot[]|null; carriedStims:number|null;
  /** values right after the grant, so real gains while ON can be kept as deltas */ after:{ credits:number; stims:number; carriedStims:number|null; chipTotals:Record<string,number> } }
export interface IdkfaState { on:boolean; granted:string[]; snap:IdkfaSnap|null }
export const idkfaOf=(s:Save):IdkfaState=>((s as any).idkfa||((s as any).idkfa={on:false,granted:[],snap:null}));
export const idkfaActive=(s:Save)=>!!(s as any).idkfa?.on;
const chipTotals=(s:Save)=>{ const t:Record<string,number>={}; for(const it of s.items) for(const c of it.chips) t[c]=(t[c]||0)+1; for(const [c,n] of Object.entries(s.lockerChips)) t[c]=(t[c]||0)+(n||0); return t; };
const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x));

/** ON: snapshot, then grant. inst/hp are the live run values (null in town). Returns the snapshot. */
export function idkfaEnable(s:Save, live:{hp:number|null; inst:{broken:Slot[]; carried:{stims:number}}|null}):IdkfaSnap{
  const st=idkfaOf(s); if(st.on&&st.snap) return st.snap;
  const snap:IdkfaSnap={ at:new Date().toISOString(), installed:{...s.installed}, chips:Object.fromEntries(s.items.map(i=>[i.uid,[...i.chips]])), lockerChips:{...s.lockerChips}, abPick:s.abPick?[...s.abPick]:null,
    level:s.level, xp:s.xp, credits:s.credits, stims:s.stims, repairBill:s.repairBill, lockerCap:s.lockerCap, codex:s.codex?{...s.codex}:null, cheated:!!s.cheated,
    hp:live.hp, broken:live.inst?[...live.inst.broken]:null, carriedStims:live.inst?live.inst.carried.stims:null, after:{credits:0,stims:0,carriedStims:null,chipTotals:{}} };
  const granted:string[]=[];
  for(const sl of SLOTS){ const it=mkInst(s,IDKFA_SET[sl]); it.chips=[...IDKFA_CHIPS[sl]]; s.items.push(it); s.installed[sl]=it.uid; granted.push(it.uid); }
  for(const d of ABILITY_ITEMS){ if((d.rarity==='purple'||d.rarity==='orange')&&!s.items.some(i=>i.def===d.id)){ const it=mkInst(s,d.id); s.items.push(it); granted.push(it.uid); } }
  s.lockerCap=Math.max(s.lockerCap,s.items.length+20); s.abPick=[...IDKFA_PICK];
  s.level=Math.max(s.level,30); s.credits=Math.max(s.credits,99999); s.stims=Math.max(s.stims,20); s.repairBill=0;
  if(live.inst){ live.inst.broken=[]; live.inst.carried.stims=Math.max(live.inst.carried.stims,10); }
  s.cheated=true; (s.cheatLog=s.cheatLog||[]).push('idkfa on@'+snap.at);
  snap.after={ credits:s.credits, stims:s.stims, carriedStims:live.inst?live.inst.carried.stims:null, chipTotals:chipTotals(s) };
  st.on=true; st.granted=granted; st.snap=snap; return snap;
}
/** OFF: restore the real loadout exactly; strip cheat items; keep real gains. Returns hp to restore (or null). */
export function idkfaDisable(s:Save, live:{inst:{broken:Slot[]; carried:{stims:number}}|null}):{hp:number|null}{
  const st=idkfaOf(s); const snap=st.snap; if(!st.on||!snap){ st.on=false; return {hp:null}; }
  const g=new Set(st.granted); const gainedChips:Record<string,number>={}; const now=chipTotals(s);
  // chips in play now minus (pre-cheat + cheat-granted) = real chips picked up while ON
  for(const c of Object.keys(now)){ const base=(snap.after.chipTotals[c]||0); const d=now[c]-base; if(d>0) gainedChips[c]=d; }
  s.items=s.items.filter(i=>!g.has(i.uid)); if(s.bank) s.bank.entries=s.bank.entries.filter(e=>!(e.item&&g.has(e.item.uid)));
  for(const it of s.items){ if(snap.chips[it.uid]) it.chips=[...snap.chips[it.uid]]; else it.chips=it.chips.filter(c=>!!c); } // real items from before: exact chips; real drops: keep theirs
  s.installed={}; for(const sl of SLOTS){ const u=snap.installed[sl]; if(u&&s.items.some(i=>i.uid===u)) s.installed[sl]=u; else { let st0=s.items.find(i=>i.def==='stock_'+sl&&!Object.values(s.installed).includes(i.uid)); if(!st0){ st0=mkInst(s,'stock_'+sl); s.items.push(st0); } s.installed[sl]=st0.uid; } }
  s.lockerChips={...snap.lockerChips}; for(const [c,n] of Object.entries(gainedChips)) s.lockerChips[c as ChipId]=(s.lockerChips[c as ChipId]||0)+n;
  s.abPick=snap.abPick?[...snap.abPick]:undefined; s.level=snap.level; s.xp=snap.xp; s.repairBill=snap.repairBill; s.lockerCap=Math.max(snap.lockerCap,0);
  s.credits=Math.max(0,snap.credits+(s.credits-snap.after.credits)); s.stims=Math.max(0,snap.stims+(s.stims-snap.after.stims));
  if(snap.codex){ const keep:Record<string,number>={...snap.codex}; for(const it of s.items) for(const a of ITEM_BY_ID[it.def]?.abilities||[]) if(s.codex?.[a]!==undefined&&keep[a]===undefined) keep[a]=s.codex[a]; s.codex=keep; }
  if(live.inst){ if(snap.broken) live.inst.broken=[...snap.broken.filter(sl=>!!s.installed[sl])]; if(snap.carriedStims!=null&&snap.after.carriedStims!=null) live.inst.carried.stims=Math.max(0,snap.carriedStims+(live.inst.carried.stims-snap.after.carriedStims)); }
  (s.cheatLog=s.cheatLog||[]).push('idkfa off@'+new Date().toISOString());
  const hp=snap.hp; st.on=false; st.granted=[]; st.snap=null; return {hp};
}
/** Real loadout fingerprint (for tests): installed defs + chips per slot, ability picks. */
export function loadoutKey(s:Save){ const by=(u?:string)=>s.items.find(i=>i.uid===u) as Inst|undefined; return JSON.stringify({ slots:SLOTS.map(sl=>{ const it=by(s.installed[sl]); return [sl,it?.uid,it?.def,it?.chips]; }), pick:s.abPick||null, level:s.level, locker:s.lockerChips }); }
export { clone };
