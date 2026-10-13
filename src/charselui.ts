// Character select (modal 'chars'). Shown on load when the account has 2+ characters (or ?chars), and from Settings > Gameplay > Characters.
// 10 slots, free create, delete with a confirm step. Short labels; full details live in the tooltip (docs/UI.md).
import { ensureRoster, createChar, selectChar, deleteChar, CHAR_LIMIT } from './chars';
import { newSave, persist } from './state';
import { TRAIT_BY_ID } from './traits';
import { esc } from './esc';
type UIx=any;
export const CS={ confirmDel:'' as string, naming:false, msg:'' };
const ago=(t:number)=>{ if(!t) return 'never played'; const m=Math.round((Date.now()-t)/60000); return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'; };
export function charsHtml(ui:UIx):string{ const r=ensureRoster(); let h=`<div class="csbody"><p class="mut csintro">Each character keeps its own level, traits, gear, bank and reputation. Cosmetics, settings and locker upgrades are shared.</p><div class="csgrid">`;
  for(let i=0;i<CHAR_LIMIT;i++){ const c=r.chars[i];
    if(!c){ h+= i===r.chars.length ? (CS.naming?`<div class="cscard csnew"><input id="csname" maxlength="16" placeholder="Name" aria-label="Character name"/><span class="csrow"><button class="btn" data-act="cs-create">Create</button><button class="btn ghost" data-act="cs-cancel">Cancel</button></span></div>`
      :`<button class="cscard csempty" data-act="cs-new" data-tip="<b>New character</b><br>Free. Starts with stock gear.">+ New</button>`) : `<div class="cscard csempty dim" aria-hidden="true">Empty</div>`; continue; }
    const t1=c.trait1?TRAIT_BY_ID[c.trait1]:null, t2=c.trait2?TRAIT_BY_ID[c.trait2]:null; const act=c.id===r.active;
    const tip=`<b>${esc(c.name)}</b><br>Level ${c.level}${t1?`<br>Trait: ${esc(t1.name)}`:''}${t2?`<br>Trait II: ${esc(t2.name)}`:''}<br>Last played ${ago(c.played)}`;
    h+=`<div class="cscard${act?' on':''}" data-tip="${esc(tip)}"><b class="csn">${esc(c.name)}</b><small>Lv ${c.level}${t1?' · '+esc(t1.short):''}</small>`
      +(CS.confirmDel===c.id?`<span class="csrow"><button class="btn danger" data-act="cs-delgo" data-id="${c.id}" data-tip="Deletes this character, its gear and bank. Cannot be undone.">Delete</button><button class="btn ghost" data-act="cs-delno">Keep</button></span>`
      :`<span class="csrow"><button class="btn" data-act="cs-play" data-id="${c.id}">${act?'Resume':'Play'}</button><button class="btn ghost csdel" data-act="cs-del" data-id="${c.id}" aria-label="Delete ${esc(c.name)}" data-tip="Delete ${esc(c.name)}">✕</button></span>`)+`</div>`; }
  return h+`</div><p class="mut">${r.chars.length}/${CHAR_LIMIT} characters${CS.msg?' · '+esc(CS.msg):''}</p></div>`; }
export function charsClick(ui:UIx,el:HTMLElement,a:string):boolean{ const g=ui.g;
  const go=(id:string)=>{ persist(g.save); const r=selectChar(id); if(r.ok){ (window as any).__wvNoPersist=true; location.reload(); } };
  switch(a){
    case 'cs-new': CS.naming=true; CS.msg=''; ui.render(); setTimeout(()=>(document.getElementById('csname') as HTMLInputElement)?.focus(),0); return true;
    case 'cs-cancel': CS.naming=false; ui.render(); return true;
    case 'cs-create': { const nm=(document.getElementById('csname') as HTMLInputElement)?.value||''; persist(g.save); const r=createChar(nm,newSave); CS.naming=false; if(!r.ok){ CS.msg=r.why; ui.render(); return true; } go(r.id); return true; }
    case 'cs-play': { const id=el.dataset.id!; if(id===ensureRoster().active){ ui.close(); return true; } go(id); return true; }
    case 'cs-del': CS.confirmDel=el.dataset.id!; ui.render(); return true;
    case 'cs-delno': CS.confirmDel=''; ui.render(); return true;
    case 'cs-delgo': { const id=el.dataset.id!; const wasActive=id===ensureRoster().active; if(!wasActive) persist(g.save); CS.confirmDel=''; const r=deleteChar(id); if(wasActive&&r.ok){ (window as any).__wvNoPersist=true; location.reload(); return true; } CS.msg='Character deleted.'; ui.render(); return true; }
  } return false; }
export function showCharsOnLoad():boolean{ const r=ensureRoster(); let q=false; try{ q=new URLSearchParams(location.search).has('chars'); }catch{} return q||r.chars.length>1; }
