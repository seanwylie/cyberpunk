// Character select (modal 'chars'). Shown on boot (first-time players go straight to naming), from the menu's Switch character (town only) and Settings > Gameplay > Characters.
// 10 slots, free create, delete with a confirm step. Short labels; full details live in the tooltip (docs/UI.md).
import { ensureRoster, createChar, selectChar, deleteChar, CHAR_LIMIT, charSave, nameFresh } from './chars';
import { TOWN_INFO } from './towns';
import { drawMini } from './wardrobeui';
import { newSave, persist } from './state';
import { TRAIT_BY_ID } from './traits';
import { esc } from './esc';
type UIx=any;
export const CS={ confirmDel:'' as string, naming:false, msg:'' };
const ago=(t:number)=>{ if(!t) return 'never played'; const m=Math.round((Date.now()-t)/60000); return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'; };
const townName=(id?:string)=>((TOWN_INFO as any)[id&&(TOWN_INFO as any)[id]?id:'rustline']?.name||'Town') as string;
const fresh=()=>{ const r=ensureRoster(); return r.chars.length===1&&!!r.chars[0].fresh; };
export function charsHtml(ui:UIx):string{ const r=ensureRoster(); void ui;
  if(fresh()) return `<div class="csbody csfirst"><p class="csintro">Name your runner. You start at level 1 with stock gear.</p><div class="cscard csnew"><input id="csname" maxlength="16" placeholder="Name" aria-label="Character name" value=""/><span class="csrow"><button class="btn" data-act="cs-create" data-tip="Start playing. Leave blank for Runner 1.">Start</button></span></div></div>`;
  let h=`<div class="csbody"><p class="mut csintro" data-tip="Each character keeps its own level, traits, gear, bank and reputation. Cosmetics, settings and locker upgrades are shared.">Pick a runner.</p><div class="csgrid">`;
  for(let i=0;i<CHAR_LIMIT;i++){ const c=r.chars[i];
    if(!c){ if(i!==r.chars.length) continue; h+= CS.naming?`<div class="cscard csnew"><input id="csname" maxlength="16" placeholder="Name" aria-label="Character name"/><span class="csrow"><button class="btn" data-act="cs-create" data-tip="Free. Starts at level 1 with stock gear.">Create</button><button class="btn ghost" data-act="cs-cancel">Cancel</button></span></div>`
      :`<button class="cscard csempty" data-act="cs-new" data-tip="<b>New character</b><br>Free. Starts at level 1 with stock gear.">+ New</button>`; continue; }
    const t1=c.trait1?TRAIT_BY_ID[c.trait1]:null, t2=c.trait2?TRAIT_BY_ID[c.trait2]:null; const act=c.id===r.active;
    const tip=`<b>${esc(c.name)}</b><br>Level ${c.level} · ${esc(townName(c.town))}${t1?`<br>Trait: ${esc(t1.name)}`:''}${t2?`<br>Trait II: ${esc(t2.name)}`:''}<br>Last played ${ago(c.played)}`;
    const del=CS.confirmDel===c.id;
    h+=`<div class="cscard${act?' on':''}" data-tip="${esc(tip)}"><canvas class="csprev" data-id="${c.id}" width="96" height="112" aria-hidden="true"></canvas><b class="csn">${esc(c.name)}</b><small>Lv ${c.level} · ${esc(townName(c.town))}</small>`
      +(del?`<input id="csdelname" class="csdelin" maxlength="16" placeholder="Type ${esc(c.name)}" aria-label="Type the name to confirm"/><span class="csrow"><button class="btn danger" data-act="cs-delgo" data-id="${c.id}" data-tip="Deletes this character, its gear and bank. Cannot be undone. Shared cosmetics stay.">Delete</button><button class="btn ghost" data-act="cs-delno">Keep</button></span>`
      :`<span class="csrow"><button class="btn" data-act="cs-play" data-id="${c.id}">${act?'Resume':'Play'}</button><button class="btn ghost csdel" data-act="cs-del" data-id="${c.id}" aria-label="Delete ${esc(c.name)}" data-tip="Delete ${esc(c.name)}">✕</button></span>`)+`</div>`; }
  return h+`</div><p class="mut">${r.chars.length}/${CHAR_LIMIT}${CS.msg?' · '+esc(CS.msg):''}</p></div>`; }
export function charsClick(ui:UIx,el:HTMLElement,a:string):boolean{ const g=ui.g;
  const go=(id:string)=>{ persist(g.save); const r=selectChar(id); if(r.ok){ (window as any).__wvNoPersist=true; location.reload(); } };
  switch(a){
    case 'cs-new': CS.naming=true; CS.msg=''; ui.render(); setTimeout(()=>(document.getElementById('csname') as HTMLInputElement)?.focus(),0); return true;
    case 'cs-cancel': CS.naming=false; ui.render(); return true;
    case 'cs-create': { if(fresh()){ nameFresh((document.getElementById('csname') as HTMLInputElement)?.value||''); persist(g.save); ui.close(); return true; } const nm=(document.getElementById('csname') as HTMLInputElement)?.value||''; persist(g.save); const r=createChar(nm,newSave); CS.naming=false; if(!r.ok){ CS.msg=r.why; ui.render(); return true; } go(r.id); return true; }
    case 'cs-play': { const id=el.dataset.id!; if(id===ensureRoster().active){ ui.close(); return true; } go(id); return true; }
    case 'cs-del': CS.confirmDel=el.dataset.id!; CS.msg=''; ui.render(); setTimeout(()=>(document.getElementById('csdelname') as HTMLInputElement)?.focus(),0); return true;
    case 'cs-delno': CS.confirmDel=''; ui.render(); return true;
    case 'cs-delgo': { const id=el.dataset.id!; { const want=ensureRoster().chars.find(c=>c.id===id)?.name||''; const got=((document.getElementById('csdelname') as HTMLInputElement)?.value||'').trim(); if(got.toLowerCase()!==want.toLowerCase()){ CS.msg='Type the name to delete.'; ui.render(); return true; } } const wasActive=id===ensureRoster().active; if(!wasActive) persist(g.save); CS.confirmDel=''; const r=deleteChar(id); if(wasActive&&r.ok){ (window as any).__wvNoPersist=true; location.reload(); return true; } CS.msg='Character deleted.'; ui.render(); return true; }
  } return false; }
/** Boot: always show the selector (first-time players land in naming). Tests opt out with wv_nocharsel (tests/lib.mjs), keeping the old 2+ rule. */
export function showCharsOnLoad():boolean{ const r=ensureRoster(); let q=false, off=false; try{ q=new URLSearchParams(location.search).has('chars'); off=!!localStorage.getItem('wv_nocharsel'); }catch{} return q||(off?r.chars.length>1:true); }
/** Live previews: every canvas.csprev shows that character's own body and worn cosmetics, idling and slowly turning. One rAF at ~15 fps. */
let prevRaf=0;
export function charsAfter(_ui:UIx){ cancelAnimationFrame(prevRaf); const cvs=Array.from(document.querySelectorAll('#modal canvas.csprev')) as HTMLCanvasElement[]; if(!cvs.length) return;
  const saves=new Map(cvs.map(cv=>[cv.dataset.id!, charSave(cv.dataset.id!)])); const t0=performance.now(); let last=-1;
  const frame=()=>{ if(!cvs.some(c=>c.isConnected)) return; prevRaf=requestAnimationFrame(frame); const now=performance.now(); if(now-last<66) return; last=now; const t=(now-t0)/1000;
    for(const cv of cvs){ const s=saves.get(cv.dataset.id!); drawMini(cv,s,t); } };
  frame(); }
