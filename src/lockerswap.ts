// Locker swap logic (pure, no DOM): plan / perform / undo a hardware swap or unequip, with chips kept on the part by default.
import { ABILITIES, INSTALL_COST, ITEM_BY_ID, REP_DISCOUNT_PER_RANK, SLOT_SOCKETS, type ChipId, type Slot, type Stats } from './config';
import { cloneLayout, computeBuild, installedLayout, repRank, wouldConflict } from './build';
import { capacityUsed, mkInst, type Inst, type Save } from './state';

export const STAT_KEYS:(keyof Stats)[]=['maxHp','dmg','atkSpeed','cooling','move','armor','regen','pickup'];
export interface SwapPlan { uid:string; slot:Slot; newName:string; oldName:string; oldIsStock:boolean; cost:number; disc:number; block:string; before:Stats; after:Stats; lostIds:string[]; gainedIds:string[]; lost:string[]; gained:string[]; mixLine:string;
  oldChips:ChipId[]; keptChips:ChipId[]; returnedChips:ChipId[]; keep:boolean; }
export interface SwapUndo { slot:Slot; prevUid:string; newUid:string; cost:number; label:string; lockerChips:Partial<Record<ChipId,number>>; prevChips:ChipId[]; newChips:ChipId[]; createdUid?:string; }

export const isStock=(def:string)=>def.startsWith('stock_');
/** The Standard Issue part for a slot if one sits in storage (not installed). */
export function stockInStorage(s:Save,slot:Slot):Inst|undefined{ const inst=new Set(Object.values(s.installed)); return s.items.find(i=>i.def==='stock_'+slot&&!inst.has(i.uid)); }
/** Chip split for a swap: with keep, the old part's chips move to the new part (same slot = same sockets); overflow returns to stock. */
function chipSplit(oldChips:ChipId[],newOwn:ChipId[],slot:Slot,keep:boolean){ const n=SLOT_SOCKETS[slot]; if(!keep) return { chips:newOwn.slice(0,n), kept:[] as ChipId[], returned:[...oldChips,...newOwn.slice(n)] };
  const all=[...oldChips,...newOwn]; return { chips:all.slice(0,n), kept:all.slice(0,n).filter((_,i)=>i<oldChips.length), returned:all.slice(n) }; }

export function planSwap(s:Save,uid:string,keep=true):SwapPlan{
  const inst=s.items.find(i=>i.uid===uid)!; const nd=ITEM_BY_ID[inst.def]; const slot=nd.slot; const L=installedLayout(s); const old=L[slot]; const od=old?ITEM_BY_ID[old.def]:null;
  const base=od?INSTALL_COST[od.rarity]:0; const disc=Math.min(.15,repRank(s.rep[nd.mfr])*REP_DISCOUNT_PER_RANK); const cost=Math.round(base*(1-disc));
  const sp=chipSplit(old?.chips||[],inst.chips,slot,keep); const L2=cloneLayout(L); L2[slot]={...inst,chips:[...sp.chips]};
  const b0=computeBuild(L,s.level,s.rep), b1=computeBuild(L2,s.level,s.rep);
  const lostIds=b0.abilities.filter(a=>!b1.abilities.includes(a)), gainedIds=b1.abilities.filter(a=>!b0.abilities.includes(a));
  let block=''; if(nd.lvl>s.level) block=`Requires level ${nd.lvl} (you are ${s.level}).`; const hc=wouldConflict(L,slot,nd.id); if(hc) block=hc;
  const mixLine=`${b1.mix.mfrs.length?b1.mix.mfrs.join(' + '):'baseline'}${b1.mix.coolingPenalty>b0.mix.coolingPenalty?` (mixing penalty −${(b1.mix.coolingPenalty*100).toFixed(0)}% cooling)`:''}`;
  return { uid,slot,newName:nd.name,oldName:od?od.name:'empty slot',oldIsStock:!od||isStock(od.id),cost,disc,block,before:b0.stats,after:b1.stats,lostIds,gainedIds,lost:lostIds.map(a=>ABILITIES[a as keyof typeof ABILITIES].name),gained:gainedIds.map(a=>ABILITIES[a as keyof typeof ABILITIES].name),mixLine,
    oldChips:[...(old?.chips||[])],keptChips:sp.kept,returnedChips:sp.returned,keep}; }

/** Stat deltas (after - before), good = higher for every stat. */
export function statDeltas(p:{before:Stats;after:Stats}){ const o:{k:keyof Stats;d:number}[]=[]; for(const k of STAT_KEYS){ const d=(p.after[k] as number)-(p.before[k] as number); if(Math.abs(d)>1e-6) o.push({k,d}); } return o; }

/** Performs the swap. Returns an undo record, or a string reason when it cannot happen. Does not check `block` (callers do) but does check credits. */
export function performSwap(s:Save,uid:string,keep:boolean,createdUid?:string):SwapUndo|string{
  const p=planSwap(s,uid,keep); if(p.block) return p.block; if(s.credits<p.cost) return `Need ${p.cost}c (you have ${s.credits}c).`;
  const inst=s.items.find(i=>i.uid===uid)!; const L=installedLayout(s); const old=L[p.slot]; const snap:SwapUndo={ slot:p.slot,prevUid:old?old.uid:'',newUid:uid,cost:p.cost,label:`${p.oldName} → ${p.newName}`,lockerChips:{...s.lockerChips},prevChips:[...(old?.chips||[])],newChips:[...inst.chips],createdUid };
  const sp=chipSplit(old?.chips||[],inst.chips,p.slot,keep); s.credits-=p.cost;
  for(const c of sp.returned) s.lockerChips[c]=(s.lockerChips[c]||0)+1;
  if(old) old.chips=[]; inst.chips=[...sp.chips]; s.installed[p.slot]=uid; return snap; }

export function undoSwap(s:Save,u:SwapUndo):boolean{
  const nu=s.items.find(i=>i.uid===u.newUid); if(!nu||s.installed[u.slot]!==u.newUid) return false; const pu=u.prevUid?s.items.find(i=>i.uid===u.prevUid):undefined; if(u.prevUid&&!pu) return false;
  nu.chips=[...u.newChips]; if(pu){ pu.chips=[...u.prevChips]; s.installed[u.slot]=pu.uid; } else delete s.installed[u.slot];
  s.lockerChips={...u.lockerChips}; s.credits+=u.cost; if(u.createdUid) s.items=s.items.filter(i=>i.uid!==u.createdUid||s.installed[u.slot]===i.uid); return true; }

/** Unequip = put the Standard Issue part back (created on demand, which needs one free storage slot). Returns the uid to swap in, or a reason. */
export function unequipTarget(s:Save,slot:Slot,cap:number):{uid:string;created?:string}|string{
  const cur=installedLayout(s)[slot]; if(!cur||isStock(cur.def)) return 'Nothing to unequip: Standard Issue is already installed.';
  const st=stockInStorage(s,slot); if(st) return { uid:st.uid }; if(capacityUsed(s)>=cap) return 'Locker full: free a storage slot first.';
  const it=mkInst(s,'stock_'+slot); s.items.push(it); return { uid:it.uid, created:it.uid }; }

/** Credits an unequip costs (same rule as any swap: priced by the part being removed, Standard Issue is MM hardware). */
export function unequipCost(s:Save,slot:Slot):number{ const cur=installedLayout(s)[slot]; if(!cur||isStock(cur.def)) return 0; const d=ITEM_BY_ID[cur.def]; const disc=Math.min(.15,repRank(s.rep.MM)*REP_DISCOUNT_PER_RANK); return Math.round(INSTALL_COST[d.rarity]*(1-disc)); }
