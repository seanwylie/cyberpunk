// Trait selection modal ('traits') + recognition hints (docs/TRAITS.md). No progress meter, no checklist:
// before selection the player only gets Odalys lines and short barks; at selection the effects and the permanence are spelled out.
import { TRAIT_BY_ID, FAMILY_NAME, TRAIT_CFG, describeEffect, type Family } from './traits';
import { traitsOf, refreshOffer, chooseTrait, unlockedTier, lean } from './traitstate';
import { traitPrior } from './traithooks';
import { persist } from './state';
import { rankOffer } from './traitrank';
type UIx=any;
const esc=(s:string)=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
export const TS={ confirm:'' as string, msg:'' };
/** Odalys recognition lines by leading family (no numbers, no meter). */
export const RECOG:Record<Family,string[]>={
  hack:['Every lock you pass opens a little easier, doesn\'t it? People are noticing how you work.','You talk to machines more than people. That is a direction, whether you chose it or not.'],
  brute:['You go through doors, not around them. Clients like that. Doors do not.','Word is you finish fights up close. That reputation is starting to stick.'],
  gun:['You keep your distance and the bodies keep dropping. That is a style now.','Nobody sees you up close any more. Good habit, or a calling.'],
  ghost:['The cameras keep missing you. Coincidence stops being coincidence after a while.','You are getting hard to pin down. Some clients pay extra for that.'],
  tech:['Your little helpers do half the work. The other half is knowing where to put them.','People talk about your drones before they talk about you.'],
};
export const MIXED_LINE='You do a bit of everything. Some call that unfocused. Some call it range.';
export function recognitionLine(s:any,prior={}):string|null{ const L=lean(s,prior); if(L.sparse) return null; const f=L.order[0]; if(L.kind==='balanced') return MIXED_LINE; const lines=RECOG[f]; return lines[(traitsOf(s).runs.length)%lines.length]; }
/** Called on checkpoints (sim emits 'traitcheck'): an occasional bark, and a nudge once a pick becomes available. */
export function traitCheckpoint(ui:UIx){ const g=ui.g, s=g.save, T=traitsOf(s); const tier=unlockedTier(s);
  if(tier&&!(T.seenUnlock||{})[tier]){ T.seenUnlock={ ...(T.seenUnlock||{}), [tier]:Date.now() }; persist(s); ui.toast(tier===1?'Odalys: "You have a style now. Come see me when you want to make it official."':'Odalys: "Time to sharpen that specialty. Come talk."'); return; }
  const L=lean(s,traitPrior(g)); if(L.sparse||L.kind==='balanced') return; const f=L.order[0]; const last=T.hinted[f]||0; if(Date.now()-last<20*60*1000||L.shares[f]<TRAIT_CFG.hintShare) return;
  T.hinted[f]=Date.now(); persist(s); const lines=RECOG[f]; ui.toast('Odalys: "'+lines[Object.keys(T.hinted).length%lines.length]+'"'); }
/** Fixer panel block: a recognition line before unlock; a "Specialize" button once a pick is available; confirmed traits as short chips with tooltips. */
export function fixerTraitBlock(ui:UIx):string{ const g=ui.g, s=g.save, T=traitsOf(s); const tier=unlockedTier(s); const picks=[T.l10,T.l20].filter(Boolean).map(p=>TRAIT_BY_ID[p!.id]).filter(Boolean);
  const chips=picks.map(t=>`<span class="trchip" data-tip="${esc('<b>'+t.name+'</b><br>'+t.effects.map(describeEffect).join('<br>'))}">${esc(t.short)}</span>`).join('');
  const line=!tier?recognitionLine(s,traitPrior(g)):null;
  return `<div class="trfix">${chips?`<div class="trrow"><b>Traits</b> ${chips}</div>`:''}${line?`<div class="mut trrecog">“${esc(line)}”</div>`:''}${tier?`<button class="btn primary" data-act="tr-open">${tier===1?'Specialize':'Specialize II'}</button>`:''}</div>`; }
export function traitsHtml(ui:UIx):string{ const g=ui.g, s=g.save, T=traitsOf(s); const tier=unlockedTier(s);
  if(tier&&!T.offer) refreshOffer(s,traitPrior(g));
  if(tier&&T.offer&&T.offer.src==='rules') rankOffer(s,traitPrior(g),ui.beats?.endpoint).then(r=>{ if(r==='ai'&&ui.modal==='traits') ui.render(); });
  const have=[T.l10,T.l20].filter(Boolean).map(p=>TRAIT_BY_ID[p!.id]).filter(Boolean);
  let h=`<div class="trbody">`;
  if(have.length) h+=`<div class="trhave">${have.map(t=>`<div class="trcard on"><b>${esc(t.name)}</b><small>Level ${t.tier===1?10:20} · permanent</small><ul>${t.effects.map(e=>`<li>${esc(describeEffect(e))}</li>`).join('')}</ul></div>`).join('')}</div>`;
  if(!tier){ h+=`<p class="mut">${T.l10&&T.l20?'Both traits are set. A different specialization needs a new character (Settings > Characters).':T.l10?`Your next trait unlocks at level ${TRAIT_CFG.unlock2}.`:`Traits unlock at level ${TRAIT_CFG.unlock1}.`}</p></div>`; return h; }
  if(tier===2&&!T.l10){ h+=`<p class="mut">Confirm a level 10 trait first.</p></div>`; return h; }
  const o=T.offer!; const fams=(ids:Family[])=>ids.length>=5?'All-round':ids.map(f=>FAMILY_NAME[f]).join(' + ');
  h+=`<p class="trlead">${tier===1?'Odalys has read how you work. These directions fit what you have been doing lately.':'Your path is set. These sharpen it, based on how you have played since.'} <span class="mut">The choices follow your recent runs until you commit, so you can wait.</span></p><div class="trgrid">`;
  for(const id of o.ids){ const t=TRAIT_BY_ID[id]; if(!t) continue; const line=o.lines?.[id]||t.blurb; const conf=TS.confirm===id;
    h+=`<div class="trcard${conf?' sel':''}"><b class="trn">${esc(t.name)}</b><small class="trf" data-tip="${esc(fams(t.fams))}">${esc(fams(t.fams))}</small><p class="trline">${esc(line)}</p><ul>${t.effects.map(e=>`<li>${esc(describeEffect(e))}</li>`).join('')}</ul>`
      +(conf?`<div class="trwarn" role="alert"><b>Permanent.</b> ${esc(t.name)} stays with this character for good. There is no respec: a different direction means a new character.</div><span class="trbtns"><button class="btn danger" data-act="tr-commit" data-id="${id}">Commit</button><button class="btn ghost" data-act="tr-back">Back</button></span>`
      :`<span class="trbtns"><button class="btn primary" data-act="tr-pick" data-id="${id}">Choose</button></span>`)+`</div>`; }
  h+=`</div><div class="trfoot"><button class="btn ghost" data-act="close">Decide later</button>${TS.msg?`<span class="mut"> ${esc(TS.msg)}</span>`:''}</div></div>`; return h; }
export function traitsClick(ui:UIx,el:HTMLElement,a:string):boolean{ const g=ui.g, s=g.save;
  switch(a){
    case 'tr-open': TS.confirm=''; TS.msg=''; ui.open('traits'); return true;
    case 'tr-pick': TS.confirm=el.dataset.id!; ui.render(); return true;
    case 'tr-back': TS.confirm=''; ui.render(); return true;
    case 'tr-commit': { const r=chooseTrait(s,el.dataset.id!); TS.confirm=''; if(!r.ok){ TS.msg=r.why; ui.render(); return true; } g.recompute(); persist(s); ui.toast('Trait committed: '+r.trait.name); g.emit?.('sfx','ab_ready_mobility'); TS.msg=''; ui.render(); return true; }
  } return false; }
