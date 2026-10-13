// Mail modal ('mail'): send an unequipped item to another character, claim items sent to this one. Icon tiles + tooltips (docs/UI.md).
import { ensureRoster } from './chars';
import { ITEM_BY_ID, SLOT_LABEL, RARITY_COLOR } from './config';
import { lockerItems, persist } from './state';
import { inbox, sendItem, claimMail, canSend, canClaim } from './mail';
import { esc } from './esc';
type UIx=any;
export const ML={ sel:'' as string, to:'' as string, msg:'' };
const tip=(def:string,extra='')=>{ const d=ITEM_BY_ID[def]; return d?`<b style="color:${(RARITY_COLOR as any)[d.rarity]}">${esc(d.name)}</b><br>${esc(SLOT_LABEL[d.slot])} · ${d.rarity} · Lv ${d.lvl}${extra}`:esc(def); };
export function mailHtml(ui:UIx):string{ const s=ui.g.save, r=ensureRoster(); const others=r.chars.filter(c=>c.id!==r.active); if(!ML.to||!others.some(c=>c.id===ML.to)) ML.to=others[0]?.id||'';
  const items=lockerItems(s).filter(i=>canSend(s,i.uid).ok); const box=inbox();
  const tiles=items.map(i=>`<button class="slot tile st mltile${ML.sel===i.uid?' on':''}" data-act="ml-sel" data-uid="${i.uid}" data-def="${i.def}" data-tip="${esc(tip(i.def,'<br><i>Click: select to send</i>'))}" aria-label="${esc(ITEM_BY_ID[i.def]?.name||i.def)}"><span class="ticon"></span></button>`).join('');
  const inb=box.map(m=>{ const c=canClaim(s,m); return `<div class="mlrow"><button class="slot tile st mltile" data-def="${m.def}" data-act="noop" data-tip="${esc(tip(m.def,'<br>From '+esc(m.fromName)))}" aria-label="${esc(ITEM_BY_ID[m.def]?.name||m.def)}"><span class="ticon"></span></button><small class="mlfrom" data-tip="${esc('From '+m.fromName)}">From ${esc(m.fromName)}</small><button class="btn" data-act="ml-claim" data-id="${m.id}" ${c.ok?'':'disabled'} data-tip="${esc(c.ok?'Move to your locker':c.why)}">${c.ok?'Claim':'Locked'}</button></div>`; }).join('');
  return `<div class="mlbody"><p class="mut">Send unequipped gear to your other characters. Chips stay here. The receiver needs the item's level to claim it. Traits can't be sent.</p>
    <h3 class="sh">Inbox (${box.length})</h3><div class="mlinbox">${inb||'<span class="mut">Empty</span>'}</div>
    <h3 class="sh">Send</h3>${others.length?`<div class="mlgrid">${tiles||'<span class="mut">No unequipped items to send.</span>'}</div><div class="actrow"><label class="mut" for="mlto">To</label><select id="mlto" data-in="mlto">${others.map(c=>`<option value="${c.id}"${c.id===ML.to?' selected':''}>${esc(c.name)} · Lv ${c.level}</option>`).join('')}</select><button class="btn primary" data-act="ml-send" ${ML.sel?'':'disabled'}>Send</button></div>`:'<span class="mut">Create another character to send items (Settings > Characters).</span>'}
    <div class="mut" role="status">${esc(ML.msg)}</div></div>`; }
export function mailClick(ui:UIx,el:HTMLElement,a:string):boolean{ const s=ui.g.save;
  switch(a){
    case 'ml-open': ML.sel=''; ML.msg=''; ui.open('mail'); return true;
    case 'ml-sel': ML.sel=ML.sel===el.dataset.uid?'':el.dataset.uid!; ui.render(); return true;
    case 'ml-send': { const to=(document.getElementById('mlto') as HTMLSelectElement)?.value||ML.to; const r=sendItem(s,ML.sel,to); if(r.ok){ persist(s); ML.msg='Sent.'; ML.sel=''; } else ML.msg=r.why; ui.render(); return true; }
    case 'ml-claim': { const r=claimMail(s,el.dataset.id!); if(r.ok){ persist(s); ML.msg='Claimed to your locker.'; } else ML.msg=r.why; ui.render(); return true; }
  } return false; }
