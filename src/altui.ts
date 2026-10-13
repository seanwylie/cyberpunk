// Alt gameplay UI (docs/ALT_GAMEPLAY.md): humanity gauge, equip delta text, T0 hack mini-game overlay.
import { humanityOfSave, band, BAND_LABEL, humanityDelta, humanityCost, persuadeMod } from './altplay';
import { miniPos, miniResolve, miniSkip } from './altsim';
import type { ItemDef } from './config';
import { esc } from './esc';
export function humGauge(s:any):string{ const h=humanityOfSave(s); const b=band(h); const tip=`<b>Humanity ${h}</b> · ${BAND_LABEL[b]}<br>Talk odds ${persuadeMod(h)>=0?'+':''}${Math.round(persuadeMod(h)*100)}%<br>${b==='human'?'Vendors trust you':b==='mixed'?'Neutral':b==='chrome'?'Intimidate up, prices up':'Dark bonus, some vendors refuse'}`;
  return `<div class="humg hb-${b}" data-tip="${esc(tip)}" tabindex="0" aria-label="Humanity ${h}"><span>HUM</span><i><u style="width:${h}%"></u></i><b>${h}</b></div>`; }
/** plain text for item tooltips: cost + delta vs installed */
export function humTip(d:ItemDef,cur:ItemDef|undefined,s:any):string{ const h=humanityOfSave(s); const x=humanityDelta(cur,d,h); return 'Humanity cost '+humanityCost(d)+(x.text?' · '+x.text:''); }
let el:HTMLElement|null=null;
export function altHud(g:any){ const M=g.altMini; if(!M){ if(el) el.style.display='none'; return; }
  if(!el){ el=document.createElement('div'); el.id='altmini'; el.innerHTML='<b>HACK</b><div class="amtrack"><div class="amzone"></div><div class="amcur"></div></div><small>F / Space: stop · Esc: skip</small>'; document.body.appendChild(el);
    el.addEventListener('pointerdown',ev=>{ ev.preventDefault(); if((window as any).__game?.altMini) miniResolve((window as any).__game); });
    window.addEventListener('keydown',ev=>{ const gg=(window as any).__game; if(!gg?.altMini) return; if(ev.key==='Escape'){ miniSkip(gg); ev.preventDefault(); ev.stopPropagation(); } else if(ev.key===' '||ev.key==='f'||ev.key==='F'||ev.key==='e'||ev.key==='E'){ miniResolve(gg); ev.preventDefault(); ev.stopPropagation(); } },true); }
  el.style.display='block'; const z=el.querySelector('.amzone') as HTMLElement; z.style.left=M.m.start*100+'%'; z.style.width=M.m.w*100+'%'; (el.querySelector('.amcur') as HTMLElement).style.left=miniPos(g)*100+'%'; }
