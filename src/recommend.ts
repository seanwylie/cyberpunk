// Upgrade recommendation engine. PURE: no DOM, no save mutation. Given the build, storage, chips, credits, level, reputation and
// vendor stock it ranks (a) hardware swaps from storage / vendor, (b) chip moves, (c) "save up" items, (d) maintenance nudges.
// Scoring = weighted log-deltas of DPS / survivability / mobility / cooling (+ ability and chip-modifier value), so every number is ~"% better".
import { ABILITIES, ABILITY_TYPE, AbilityId, CHIPS, ChipId, INSTALL_COST, ITEM_BY_ID, ItemDef, Mfr, REP_DISCOUNT_PER_RANK, SELL_VALUE, SLOTS, SLOT_LABEL, SLOT_SOCKETS, Slot, chipFits } from './config';
import { BuildResult, Layout, cloneLayout, computeBuild, repRank, wouldConflict } from './build';
import type { Inst } from './state';

export interface RecInput {
  items:Inst[]; installed:Partial<Record<Slot,string>>; lockerChips:Partial<Record<ChipId,number>>;
  credits:number; level:number; rep:Record<Mfr,number>; repairBill:number;
  /** Hardware the vendor sells right now (empty when no vendor is reachable, e.g. mid-run) and its base price per item. */
  vendorStock?:ItemDef[]; vendorPrice?:(d:ItemDef)=>number;
  /** free locker slots (a vendor purchase needs one) */ lockerFree?:number; greyCount?:number; broken?:Slot[];
}
export type RecKind='swap'|'buy'|'chip'|'repair'|'tidy';
export interface Delta { k:'DMG'|'HP'|'MOVE'|'COOL'; pct:number; }
export interface Rec {
  id:string; kind:RecKind; action:'install'|'buy'|'socket'|'repair'|'dispose'; slot?:Slot; uid?:string; defId?:string; chip?:ChipId; replaces?:ChipId; socket?:number;
  /** build-score gain (log units, ~fractional improvement) */ gain:number; rank:number; cost:number; needed:number; deltas:Delta[]; gained:AbilityId[]; lost:AbilityId[]; why:string[]; title:string;
}
export interface RecResult { recs:Rec[]; chipMoves:Rec[]; saveUp:Rec[]; maintenance:Rec[]; style:Playstyle; significant:Rec|null; }
export type Playstyle='melee'|'ranged'|'hacker'|'tank'|'balanced';

export const REC_MIN_GAIN=.02;       // below this a change is noise
export const REC_SIGNIFICANT=.06;    // toast threshold
export const SAVE_UP_FRACTION=.4;    // you hold at least 40% of the cost => "save up" (else too far to mention)
const W0={ dps:.42, surv:.3, mob:.1, cool:.18 };

export function playstyle(b:BuildResult):{ style:Playstyle; w:typeof W0 } {
  const w={...W0}; const c:Record<string,number>={attack:0,defense:0,hacking:0,mobility:0}; for(const a of b.abilities) c[ABILITY_TYPE[a]]++;
  const ranged=!!b.weapon.proj; if(ranged){ w.mob+=.06; w.surv-=.03; w.dps+=.0; } else { w.surv+=.04; }
  w.dps+=.08*c.attack; w.surv+=.08*c.defense; w.cool+=.07*c.hacking; w.mob+=.06*c.mobility;
  const sum=w.dps+w.surv+w.mob+w.cool; (Object.keys(w) as (keyof typeof w)[]).forEach(k=>w[k]/=sum);
  let style:Playstyle='balanced'; if(c.hacking>=2||c.hacking>=1&&c.attack===0) style='hacker'; else if(c.defense>=2&&c.defense>c.attack) style='tank'; else if(ranged) style='ranged'; else if(c.attack>=1||b.weapon.kind!=='fist') style='melee';
  return { style, w };
}
export const effHp=(b:BuildResult)=>(b.stats.maxHp+b.stats.regen*25)*(1+b.stats.armor*.04);
/** Weapon term is damped (^.6): swapping weapon KIND is a playstyle change (range, heat), not a pure multiplier. Melee needs to close distance (x.65); stationary weapons lose uptime (x.85). */
export const dpsOf=(b:BuildResult)=>b.stats.dmg*b.stats.atkSpeed*Math.pow(b.weapon.dmg*b.weaponMul*b.weapon.rate*(b.weapon.proj?1:.65)*(b.weapon.stationary?.85:1),.6);
function modValue(b:BuildResult):number{ const m=b.mods; let v=0; if(b.abilities.includes('control')) v+=.004*m.ctrlDur; if(b.abilities.includes('cloak')) v+=.004*m.cloakDur; if(b.abilities.includes('sweep')||(!b.weapon.proj&&b.weapon.kind!=='fist')) v+=.05*m.arc; if(b.abilities.includes('bladeburst')) v+=.01*m.burstLen; return v; }
const abVal=(a:AbilityId)=>a==='defib'?.03:.04;
/** Single build-score used for every comparison. weights come from the CURRENT build's playstyle so a swap is judged by what the player does. */
export function buildScore(b:BuildResult, w:typeof W0):number{
  return w.dps*Math.log(Math.max(1e-6,dpsOf(b)))+w.surv*Math.log(effHp(b))+w.mob*Math.log(b.stats.move)+w.cool*Math.log(b.stats.cooling)+.01*b.stats.pickup+modValue(b)
    +b.abilities.reduce((s,a)=>s+abVal(a),0)+b.passives.reduce((s,a)=>s+abVal(a),0)-.06*b.conflicts.length; }
function deltas(a:BuildResult,b:BuildResult):Delta[]{ const p=(x:number,y:number)=>Math.round((y/x-1)*100); const out:Delta[]=[{k:'DMG',pct:p(dpsOf(a),dpsOf(b))},{k:'HP',pct:p(effHp(a),effHp(b))},{k:'MOVE',pct:p(a.stats.move,b.stats.move)},{k:'COOL',pct:p(a.stats.cooling,b.stats.cooling)}];
  return out.filter(d=>d.pct!==0).sort((x,y)=>Math.abs(y.pct)-Math.abs(x.pct)); }
const abDiff=(a:BuildResult,b:BuildResult)=>({ gained:b.abilities.filter(x=>!a.abilities.includes(x)), lost:a.abilities.filter(x=>!b.abilities.includes(x)) });
export const repDiscount=(rep:Record<Mfr,number>,m:Mfr)=>Math.min(.15,repRank(rep[m])*REP_DISCOUNT_PER_RANK);
export const installCostFor=(old:ItemDef|null,incoming:ItemDef,rep:Record<Mfr,number>)=>Math.round((old?INSTALL_COST[old.rarity]:0)*(1-repDiscount(rep,incoming.mfr)));
const fmtD=(d:Delta[])=>d.slice(0,3).map(x=>`${x.pct>0?'+':''}${x.pct}% ${x.k}`).join(', ');
const rankOf=(gain:number,cost:number)=>gain/(1+cost/500);

export function recommend(inp:RecInput):RecResult {
  const byUid=new Map(inp.items.map(i=>[i.uid,i])); const L:Layout={}; for(const sl of SLOTS){ const u=inp.installed[sl]; const it=u?byUid.get(u):undefined; if(it) L[sl]=it; }
  const broken=inp.broken||[]; const cur=computeBuild(L,inp.level,inp.rep,broken); const { style, w }=playstyle(cur); const base=buildScore(cur,w);
  const recs:Rec[]=[]; const saveUp:Rec[]=[]; const maintenance:Rec[]=[]; const installedSet=new Set(Object.values(inp.installed));

  // (a) hardware: best candidate per slot from storage and vendor
  type Cand={ def:ItemDef; uid?:string; price:number };
  const cands:Cand[]=[]; for(const it of inp.items){ if(installedSet.has(it.uid)) continue; const d=ITEM_BY_ID[it.def]; if(d) cands.push({def:d,uid:it.uid,price:0}); }
  const free=inp.lockerFree??0; for(const d of inp.vendorStock||[]) cands.push({def:d,price:Math.round((inp.vendorPrice?inp.vendorPrice(d):0)*(1-repDiscount(inp.rep,d.mfr)))});
  const bestPer=new Map<string,{r:Rec;pass:boolean}>();
  for(const c of cands){ const d=c.def; if(d.lvl>inp.level) continue; if(d.id.startsWith('stock_')&&!c.uid) continue; const sl=d.slot; const old=L[sl]; const od=old?ITEM_BY_ID[old.def]:null; if(od&&od.id===d.id&&!c.price&&c.uid) continue;
    if(wouldConflict(L,sl,d.id)) continue;
    const L2=cloneLayout(L); L2[sl]={uid:'rec',def:d.id,chips:[]}; const b2=computeBuild(L2,inp.level,inp.rep,broken); const gain=buildScore(b2,w)-base; if(gain<REC_MIN_GAIN) continue;
    const vendor=!c.uid; const inst=installCostFor(od,d,inp.rep); const cost=c.price+inst; const dl=deltas(cur,b2); const ab=abDiff(cur,b2);
    const why:string[]=[`${d.name} vs ${od?od.name:'empty slot'}: ${fmtD(dl)||'similar stats'} (${style} build)`];
    if(ab.gained.length) why.push('Gains '+ab.gained.map(a=>ABILITIES[a].name).join(', ')); if(ab.lost.length) why.push('Loses '+ab.lost.map(a=>ABILITIES[a].name).join(', '));
    if(b2.mix.coolingPenalty>cur.mix.coolingPenalty+1e-9) why.push(`Mixing manufacturers costs −${Math.round((b2.mix.coolingPenalty-cur.mix.coolingPenalty)*100)}% cooling`); else if(b2.mix.coolingPenalty<cur.mix.coolingPenalty-1e-9) why.push('Cleans up manufacturer mixing');
    if(od&&old!.chips.length) why.push(`${old!.chips.length} chip(s) on the old part return to stock`);
    const rd=repDiscount(inp.rep,d.mfr); if(rd>0) why.push(`Reputation discount ${Math.round(rd*100)}%`);
    why.push(vendor?`Buy ${c.price}c + install ${inst}c`:`Install ${inst}c`);
    const need=Math.max(0,cost-inp.credits); const stock=vendor&&free<=0;
    const r:Rec={ id:(vendor?'buy:':'swap:')+d.id+(c.uid?':'+c.uid:''), kind:vendor?'buy':'swap', action:vendor?'buy':'install', slot:sl, uid:c.uid, defId:d.id, gain, rank:rankOf(gain,cost), cost, needed:need, deltas:dl, gained:ab.gained, lost:ab.lost, why, title:d.name };
    if(stock) continue; const prev=bestPer.get(sl); const pass=need===0;
    // prefer affordable options; among the same affordability class, the higher rank
    if(!prev||(pass&&!prev.pass)||(pass===prev.pass&&r.rank>prev.r.rank)) bestPer.set(sl,{r,pass}); }
  for(const {r,pass} of bestPer.values()){ if(pass) recs.push(r); else if(inp.credits>=r.cost*SAVE_UP_FRACTION){ r.why.push(`Save up: ${r.needed}c more`); saveUp.push(r); } }

  // (b) chip moves (greedy, uses remaining stock; every move is slot-legal via chipFits)
  const stock:Record<string,number>={ ...inp.lockerChips as Record<string,number> }; const chipMoves:Rec[]=[]; const work=cloneLayout(L); let wb=cur, ws=base;
  for(let guard=0;guard<40;guard++){ let best:{ sl:Slot; i:number; c:ChipId; rep?:ChipId; gain:number; nb:BuildResult }|null=null;
    for(const sl of SLOTS){ const it=work[sl]; if(!it||broken.includes(sl)) continue; const cap=SLOT_SOCKETS[sl];
      for(const c of Object.keys(stock) as ChipId[]){ if((stock[c]||0)<=0||!CHIPS[c]||!chipFits(c,sl)) continue;
        const tryAt=(mut:(x:ChipId[])=>void,idx:number,rep?:ChipId)=>{ const L2=cloneLayout(work); mut(L2[sl]!.chips); const nb=computeBuild(L2,inp.level,inp.rep,broken); const g=buildScore(nb,w)-ws; if(g>=.002&&(!best||g>best.gain)) best={sl,i:idx,c,rep,gain:g,nb}; };
        if(it.chips.length<cap) tryAt(x=>x.push(c),it.chips.length);
        else{ const seen=new Set<ChipId>(); it.chips.forEach((o,idx)=>{ if(o===c||seen.has(o)) return; seen.add(o); tryAt(x=>{ x[idx]=c; },idx,o); }); } } }
    if(!best) break; const bst=best as { sl:Slot; i:number; c:ChipId; rep?:ChipId; gain:number; nb:BuildResult };
    const it=work[bst.sl]!; const old=it.chips[bst.i]; if(bst.rep){ it.chips[bst.i]=bst.c; stock[bst.rep]=(stock[bst.rep]||0)+1; } else it.chips.push(bst.c); stock[bst.c]--;
    const dl=deltas(wb,bst.nb); chipMoves.push({ id:`chip:${bst.sl}:${bst.i}:${bst.c}`, kind:'chip', action:'socket', slot:bst.sl, chip:bst.c, replaces:bst.rep, socket:bst.i, gain:bst.gain, rank:bst.gain*3, cost:0, needed:0, deltas:dl, gained:[], lost:[],
      title:`${CHIPS[bst.c].name} → ${SLOT_LABEL[bst.sl]}`, why:[bst.rep?`${CHIPS[bst.c].name} beats ${CHIPS[old].name} here: ${fmtD(dl)||'better modifiers'}`:`Empty socket on ${SLOT_LABEL[bst.sl]}: ${CHIPS[bst.c].name} gives ${fmtD(dl)||'a better modifier'}`,'Free · fits '+SLOT_LABEL[bst.sl]] });
    wb=bst.nb; ws+=bst.gain; }
  recs.push(...chipMoves);

  // (d) maintenance
  if(inp.repairBill>0){ const pay=Math.min(inp.credits,inp.repairBill); maintenance.push({ id:'repair', kind:'repair', action:'repair', gain:0, rank:0, cost:inp.repairBill, needed:Math.max(0,inp.repairBill-inp.credits), deltas:[], gained:[], lost:[], title:'Repair all', why:[`Repair bill ${inp.repairBill}c stays owed until paid`+(pay<inp.repairBill?` (you can cover ${pay}c)`:'')] }); }
  if((inp.greyCount||0)>0&&free<=3) maintenance.push({ id:'tidy', kind:'tidy', action:'dispose', gain:0, rank:0, cost:0, needed:0, deltas:[], gained:[], lost:[], title:`Dispose ${inp.greyCount} grey`, why:[`Locker nearly full; ${inp.greyCount} grey item(s) sell for ${(inp.greyCount||0)*SELL_VALUE.grey}c`] });

  recs.sort((a,b)=>b.rank-a.rank); saveUp.sort((a,b)=>b.rank-a.rank);
  const significant=recs.filter(r=>r.kind!=='chip'||r.gain>=REC_SIGNIFICANT).find(r=>r.gain>=REC_SIGNIFICANT)||null;
  return { recs, chipMoves, saveUp, maintenance, style, significant };
}
