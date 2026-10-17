// Limb loss UI (src/limbs.ts, docs/LIMBS.md): in-run "Torn" panel with the free Field Patch, and the Repair Bay (ripperdoc) section in town.
import { ITEM_BY_ID, type Slot } from './config';
import { persist, type Save } from './state';
import { limbState, openSlots, lostSlots, patchLimb, reattach, reattachCost, stockRefit, isPatch, slotName, LIMBS } from './limbs';
const esc=(t:string)=>t.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const partName=(s:Save,sl:Slot)=>{ const r=limbState(s).lost[sl]; return r?(ITEM_BY_ID[r.inst.def]?.name||slotName(sl)):slotName(sl); };
const PATCH_TIP='<b>Field Patch</b><br>Free Mass-Market limb, fitted now. Restores the limb but jams for a moment now and then. Costs 3 Humanity. Your old part stays on the Repair Bay shelf.';
let sig='', el:HTMLElement|null=null, small=false;
/** called from the HUD update; rebuilds DOM only when the open-slot set changes */
export function syncLimbPanel(g:any){ if(typeof document==='undefined') return; const s:Save=g.save; const open=g.mode==='run'?openSlots(s):[]; const k=open.join(',')+'|'+small;
  if(k===sig) return; sig=k; if(!el){ el=document.createElement('div'); el.id='limbpanel'; el.className='interactive'; document.getElementById('hud')?.appendChild(el)||document.body.appendChild(el);
    el.addEventListener('click',ev=>{ const b=(ev.target as HTMLElement).closest('[data-limb]') as HTMLElement|null; if(!b) return; ev.stopPropagation(); const act=b.dataset.limb!, sl=b.dataset.slot as Slot;
      if(act==='patch'){ if(patchLimb(s0(),sl)){ persist(s0()); gRef?.recompute(); gRef?.toast('Field Patch fitted. Expect the odd jam.'); } } else if(act==='hide'){ small=true; } else if(act==='show'){ small=false; } sig=''; syncLimbPanel(gRef); }); }
  gRef=g; if(!open.length){ el.style.display='none'; el.innerHTML=''; small=false; return; } el.style.display='block';
  if(small){ el.innerHTML=`<button class="btn" data-limb="show" data-tip="${esc('A limb is torn off. Tap to patch it.')}">Torn ${open.length}</button>`; return; }
  el.innerHTML=`<b>LIMB TORN</b>`+open.map(sl=>`<div class="lp-row"><span>${esc(partName(s,sl))}</span><button class="btn primary" data-limb="patch" data-slot="${sl}" data-tip="${esc(PATCH_TIP)}">Patch</button></div>`).join('')+
    `<button class="btn" data-limb="hide" data-tip="${esc('Fight on without it (weaker until fixed). The Repair Bay in town reattaches it, or fits a free stock limb.')}">Fight on</button>`; }
let gRef:any=null; const s0=()=>gRef.save as Save;
/** Repair Bay section ("ripperdoc"): one row per lost part. Reattach costs credits; Stock refit and Field Patch are always free. */
export function limbVendorHtml(s:Save):string{ const L=limbState(s); const rows=lostSlots(s).map(sl=>{ const r=L.lost[sl]!; const cost=reattachCost(s,sl); const cur=s.installed[sl]?s.items.find(i=>i.uid===s.installed[sl]):undefined;
    const now=!cur?'missing':isPatch(cur.def)?'Field Patch':cur.def.startsWith('stock_')?'stock':esc(ITEM_BY_ID[cur.def]?.name||'');
    const tip=`<b>${esc(partName(s,sl))}</b><br>${esc(slotName(sl))} · torn off by ${esc(r.by)}<br>Fitted now: ${now}<br>Reattach leaves a scar (-${LIMBS.scarHum} Humanity, up to -${LIMBS.scarMax}).`;
    return `<div class="row" data-tip="${esc(tip)}"><span class="nm2">${esc(partName(s,sl))}</span> <span class="tag">${now}</span><button class="btn ${s.credits>=cost?'primary':''}" data-act="limb-reattach" data-slot="${sl}" ${s.credits>=cost?'':'disabled'} data-tip="${esc('Put your own part back. '+cost+'c.')}">Reattach ${cost}c</button>${cur&&cur.def.startsWith('stock_')?'':`<button class="btn" data-act="limb-refit" data-slot="${sl}" data-tip="${esc('Free Standard Issue limb. No jams. Your part stays on the shelf.')}">Stock refit</button>`}${cur?'':`<button class="btn" data-act="limb-patch" data-slot="${sl}" data-tip="${esc(PATCH_TIP)}">Patch</button>`}</div>`; }).join('');
  if(!rows&&!L.scars) return ''; return `<h3>Ripperdoc <span class="help" tabindex="0" data-tip="${esc('Elites and bosses can tear off an augmented limb with Rend. Bring it back here.')}">?</span></h3>${rows||'<div class="mut">No torn limbs.</div>'}${L.scars?`<div class="mut">Scars: ${L.scars} (-${Math.min(LIMBS.scarMax,L.scars)*LIMBS.scarHum} Humanity)</div>`:''}`; }
/** ui.ts action dispatch; returns true if handled */
export function limbVendorAct(g:any,act:string,sl:Slot):boolean{ const s:Save=g.save;
  if(act==='limb-reattach'){ const r=reattach(s,sl); g.toast(r.ok?'Reattached for '+r.cost+'c. It will scar.':r.why); if(r.ok){ persist(s); g.recompute(); } return true; }
  if(act==='limb-refit'){ if(stockRefit(s,sl)){ persist(s); g.recompute(); g.toast('Stock limb fitted. Free.'); } return true; }
  if(act==='limb-patch'){ if(patchLimb(s,sl)){ persist(s); g.recompute(); g.toast('Field Patch fitted.'); } return true; }
  return false; }
