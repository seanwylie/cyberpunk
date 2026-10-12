import { paintedIconHtml } from './lootart';
// Loot log (docs/LOOT_ECONOMY.md): your purple / orange / seasonal finds, Prism Shards and shard rebuilds. Short labels, detail in tooltips.
import { ITEM_BY_ID, RARITY_COLOR } from './config';
import { ecoOf, redeemable, redeemShards, LOOT_ECO } from './loot_eco';
import { mkInst, persist } from './state';
import { SEASON_BY_ID, provenanceLabel, provenanceTip } from './seasons';
type UIx = any;
const esc=(s:string)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const col=(k:string)=>k==='seasonal'?'#7fe0ff':k==='orange'?RARITY_COLOR.orange:k==='purple'?RARITY_COLOR.purple:'#c9bfa0';
const LBL:Record<string,string>={ orange:'Legendary', seasonal:'Seasonal', purple:'Epic', shard:'Shard' };
let msg='';
export function lootLogHtml(ui:UIx):string{ const s=ui.g.save; const e=ecoOf(s); const now=Date.now();
  const rows=e.log.map(l=>{ const when=new Date(l.t).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); const pv=l.season?provenanceLabel(l.id,now):null;
    const tip=esc((l.where?'Found in '+esc(l.where):'')+(l.boss?' · '+esc(l.boss):'')+(l.season?'<br>'+esc(provenanceTip(l.id,l.t,now)||''):'')+(l.kind==='shard'?'<br>Duplicate legendary broken down. '+LOOT_ECO.shardCost+' shards rebuild any orange you have found.':''));
    return `<div class="llrow" data-kind="${l.kind}" data-tip="${tip}"><span class="lltag" style="color:${col(l.kind)};border-color:${col(l.kind)}">${LBL[l.kind]}</span> <b style="color:${col(l.kind)}">${esc(l.name)}</b>${pv?` <span class="llprov">${esc(pv)}</span>`:''} <span class="mut">${esc(when)}</span></div>`; }).join('')||'<div class="mut">No epic or better finds yet. Bosses on harder tiers and gateways are the best farm.</div>';
  const red=redeemable(s); const can=e.shards>=LOOT_ECO.shardCost;
  const shop=red.length?`<div class="llredeem">${red.map(id=>`<button class="btn mini" data-act="ll-redeem" data-id="${id}" ${can?'':'disabled'} data-tip="${esc('Rebuild '+esc(ITEM_BY_ID[id].name)+' for '+LOOT_ECO.shardCost+' Prism Shards.')}">${esc(ITEM_BY_ID[id].name)}</button>`).join(' ')}</div>`:'';
  return `<div class="lootlog"><div class="llhead"><span data-tip="${esc('Duplicate legendaries break down into Prism Shards. '+LOOT_ECO.shardCost+' shards rebuild an orange you have already found. Season exclusives cannot be rebuilt: once a season ends they are retired for good.')}"><b>Prism Shards</b> ${e.shards}/${LOOT_ECO.shardCost}</span></div>${msg?`<div class="bkmsg" role="status">${esc(msg)}</div>`:''}${shop}<div class="llrows">${rows}</div></div>`; }
export function lootLogClick(ui:UIx,el:HTMLElement,a:string):boolean{
  if(a==='ll-open'){ msg=''; ui.open('lootlog'); return true; }
  if(a==='ll-redeem'){ const s=ui.g.save; const id=el.dataset.id!; const r=redeemShards(s,id); if(r.ok){ s.items.push(mkInst(s,id)); persist(s); msg='Rebuilt '+ITEM_BY_ID[id].name+'. It is in your locker.'; } else msg=r.why||'Cannot rebuild'; ui.render(); return true; }
  return false; }
export const LOOTLOG_CSS=`.lootlog .llrow{ padding:3px 2px; border-bottom:1px solid #2a2b2d } .lootlog .lltag{ display:inline-block; min-width:64px; text-align:center; border:1px solid; border-radius:3px; font-size:.8em; padding:0 4px } .lootlog .llprov{ color:#9fd8ff; font-size:.85em } .lootlog .llrows{ max-height:52vh; overflow:auto } .lootlog .llredeem{ margin:6px 0; display:flex; flex-wrap:wrap; gap:4px }
#prestigebanner{ position:fixed; left:50%; top:66%; transform:translateX(-50%); z-index:40; pointer-events:none; text-align:center; padding:10px 26px 12px; border-radius:6px; background:radial-gradient(ellipse at center,rgba(20,14,8,.92),rgba(10,8,6,.75)); border:1px solid var(--pc,#ff9a2e); box-shadow:0 0 28px -6px var(--pc,#ff9a2e); font:600 1.05em "Roboto Condensed",sans-serif; color:#f3ead6; opacity:0; transition:opacity .5s, transform .5s }
#prestigebanner.on{ opacity:1; transform:translateX(-50%) translateY(-6px) } #prestigebanner small{ display:block; color:#cbbf9f; font-weight:500; margin-bottom:2px; letter-spacing:.08em; text-transform:uppercase } #prestigebanner b{ color:var(--pc,#ff9a2e); font-size:1.25em }`;
export function showPrestigeBanner(p:{kind:string;name:string;item?:string;season?:string;first?:boolean}){ let b=document.getElementById('prestigebanner'); if(!b){ b=document.createElement('div'); b.id='prestigebanner'; b.setAttribute('role','status'); document.body.appendChild(b); }
  const c=p.kind==='seasonal'?'#7fe0ff':'#ff9a2e'; b.style.setProperty('--pc',c); b.innerHTML=`<small>${p.kind==='seasonal'?esc(SEASON_BY_ID[p.season!]?.short||'Seasonal')+' exclusive':p.first?'Your first legendary':'Legendary'}</small>${paintedIconHtml(p.item,64)}<b>${esc(p.name)}</b>`; b.classList.add('on'); clearTimeout((b as any)._t); (b as any)._t=setTimeout(()=>b!.classList.remove('on'),4200); }
if(typeof document!=='undefined'&&!document.getElementById('lootlog-css')){ const st=document.createElement('style'); st.id='lootlog-css'; st.textContent=LOOTLOG_CSS; document.head.appendChild(st); }
