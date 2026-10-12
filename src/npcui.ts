// UI for NPC memory, free-text speech encounters and personal contracts (docs/NPC_MEMORY.md, docs/CONTRACTS.md).
// Short labels + tooltips. Network calls go through the story endpoint only; every reply is validated client-side again.
import { persist, contractState } from './state';
import { giveGift, giftCost } from './npcmem';
import { NPC_BY_ID, memLine, memFacts, trust, remember, humanityOf, humBand } from './npcmem';
import { INTENTS, INTENT_LABEL, INTENT_TIP, SPEECH_CFG, chance, ctxFor, bribeCost, resolve, validIntent, clampStrength, type Outcome } from './speechrules';
import { boardOf, refreshBoard, applyPick, acceptPersonal, MOD_LABEL, OBJ_LABEL, nemesesOf, type PContract } from './pcontracts';
import { MAX_ACTIVE_CONTRACTS } from './content/npcs';
import { DUNGEONS } from './content/dungeons';
import { ENEMIES } from './config';
import { traitsOf } from './traitstate';
import { TRAIT_BY_ID } from './traits';
import { PLAYER_ID, SESSION_ID } from './story_beats';
import type { Intent } from './npcmem';
type UIx=any;
const esc=(s:string)=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const endpoint=()=>((import.meta as any).env?.VITE_WV_STORY_URL as string)||'api/story-beat';
const post=async(body:any,fetcher=(u:string,i:any)=>fetch(u,i))=>{ const r=await fetcher(endpoint(),{ method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) }); return r.json(); };
const capsOf=(ui:UIx):Set<string>=>ui.g.build?.caps||new Set();
const keyName=(k:string)=>DUNGEONS[k]?.short||k;
export const TRUST_LABEL:Record<string,string>={ trusted:'Trusted', friendly:'Friendly', neutral:'Neutral', wary:'Wary', hostile:'Hostile' };

// ---------------- speech encounter ----------------
export type Situation='standdown'|'pass'|'discount'|'info'|'sitout';
export interface Encounter { npc:string; situation:Situation; resist:0|1|2|3; tier:0|1|2|3; free:boolean; busy:boolean; text:string; msg:string; reply:string; result:Outcome|null; scored:{ intent:Intent; strength:number; src:string }|null; onDone?:(o:Outcome)=>void }
/** on globalThis so Vite HMR re-imports (tests, dev) share the open encounter */
export const SP:{ enc:Encounter|null }=((globalThis as any).__wvSpeech??={ enc:null });
/** Open a speech encounter. Callable from any system (the hacking/speech nodes in dungeons, vendors, Odalys). Fighting/walking away is always possible. */
export function openSpeech(ui:UIx,npc:string,situation:Situation,opts:{ resist?:number; tier?:number; onDone?:(o:Outcome)=>void }={}){ if(!NPC_BY_ID[npc]) return false;
  SP.enc={ npc, situation, resist:Math.max(0,Math.min(3,opts.resist??1)) as any, tier:Math.max(0,Math.min(3,opts.tier??0)) as any, free:true, busy:false, text:'', msg:'', reply:'', result:null, scored:null, onDone:opts.onDone };
  remember(ui.g.save,npc,'met'); ui.modal='speech'; ui.render(); return true; }
const SIT_LABEL:Record<Situation,string>={ standdown:'Get them to stand down', pass:'Get past', discount:'Get a better price', info:'Get them talking', sitout:'Keep them out of the fight' };
export function speechHtml(ui:UIx):string{ const E=SP.enc; if(!E) return '<div class="mut">Nobody to talk to.</div>'; const s=ui.g.save, n=NPC_BY_ID[E.npc]; const c=ctxFor(s,E.npc,E); const tr=trust(s,E.npc); const ref=memLine(s,E.npc,keyName);
  const h=humanityOf(s); const done=!!E.result;
  const opts=INTENTS.map(i=>{ const st=SPEECH_CFG.choiceStrength; const cc={ ...c, memMod:0 }; const p=chance(i,st,cc); const cost=i==='bribe'?bribeCost(c,st):0; const off=done||E.busy||p<=0;
    return `<button class="btn sp-opt" data-act="sp-choose" data-i="${i}" ${off?'disabled':''} data-tip="${esc('<b>'+INTENT_LABEL[i]+'</b><br>'+INTENT_TIP[i]+(cost?'<br>Costs '+cost+'c':'')+'<br>About '+Math.round(p*100)+'% before history')}"><b>${INTENT_LABEL[i]}</b> <span class="mut">${Math.round(p*100)}%${cost?' · '+cost+'c':''}</span></button>`; }).join('');
  const res=E.result?`<div class="sp-res ${E.result.ok?'good':'bad'}"><b>${E.result.ok?'It works.':'It fails.'}</b> <span class="mut">${esc(INTENT_LABEL[E.result.intent])} ${E.result.strength}/3 · ${Math.round(E.result.chance*100)}%${E.scored?.src==='ai'?'':' · read by the game'}</span>${E.reply?`<blockquote class="quote">“${esc(E.reply)}”</blockquote>`:''}${E.result.ok?'':'<div class="mut">Talk failed. You can still fight or walk away.</div>'}</div>`:'';
  return `<div class="col speechcol"><div class="npchead"><span class="avatar" aria-hidden="true">${esc(n.name.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase())}</span><div><h3 style="margin:0">${esc(n.name)}</h3><div class="mut"><span class="tag" data-tip="${esc('How '+n.name+' feels about you, from what you have done. Changes prices, odds and jobs.')}">${TRUST_LABEL[tr]}</span> <span class="tag" data-tip="${esc('Humanity '+Math.round(h)+'. High helps persuade and empathize; low helps intimidate.')}">${esc(humBand(h)[0].toUpperCase()+humBand(h).slice(1))}</span> · ${esc(SIT_LABEL[E.situation])}</div></div></div>
    <blockquote class="quote sp-mem" data-kind="${ref.kind}">“${esc(ref.text)}”</blockquote>
    <h3>Say it your way</h3><div class="sp-free"><input id="sp-text" type="text" maxlength="${140}" placeholder="Type what you say…" aria-label="Your line" value="${esc(E.text)}" ${done||E.busy?'disabled':''}><button class="btn primary" data-act="sp-say" ${done||E.busy?'disabled':''} data-tip="${esc('The game reads your intent, then rolls the odds from your humanity, traits and history.')}">${E.busy?'…':'Say'}</button></div>
    ${E.msg?`<div class="mut sp-msg">${esc(E.msg)}</div>`:''}<h3>Or pick a line</h3><div class="sp-opts">${opts}</div>${res}
    <div class="actrow"><button class="btn" data-act="sp-gift" data-tip="${esc('Give '+n.name+' something. Once a day. They will remember it.')}">Gift ${giftCost(s)}c</button><button class="btn" data-act="sp-leave">${done?'Done':'Walk away'}</button></div></div>`; }
const SITU_RESIST=(E:Encounter)=>E.resist;
/** Apply one attempt (choice or scored free text). */
function finish(ui:UIx,scored:{ intent:Intent; strength:number },free:boolean,replies:{ ok:string; fail:string }|null,src:string){ const E=SP.enc!; const s=ui.g.save;
  const o=resolve(s,E.npc,scored,free,Math.random(),{ tier:E.tier, resist:SITU_RESIST(E) }); if(!o){ E.msg='That did not land. Pick a line.'; ui.render(); return; }
  E.result=o; E.scored={ intent:o.intent, strength:o.strength, src }; E.reply=replies?(o.ok?replies.ok:replies.fail):''; persist(s); try{ E.onDone?.(o); }catch{} ui.render(); }
export async function sayFree(ui:UIx,text:string,fetcher?:(u:string,i:any)=>Promise<any>){ const E=SP.enc; if(!E||E.busy||E.result) return; const s=ui.g.save; const t=String(text||'').trim().slice(0,140); E.text=t; if(t.length<2){ E.msg='Say something first.'; ui.render(); return; }
  if(s.settings?.storyAi===false){ E.msg='Free text needs story AI (Settings). Pick a line.'; ui.render(); return; }
  E.busy=true; E.msg=''; ui.render(); const F=memFacts(s,E.npc); const n=NPC_BY_ID[E.npc];
  try{ const j=await post({ kind:'npc_intent', session:SESSION_ID, player:PLAYER_ID, npc:E.npc, role:n.role, situation:E.situation, trust:F.trust, band:F.band, mem:F.kinds.filter(k=>k!=='met'), text:t },fetcher as any);
    E.busy=false; if(SP.enc!==E) return;
    if(j&&j.moderated){ E.msg='Keep it in the world. Try other words or pick a line.'; ui.render(); return; }
    const v=j&&j.ok?validIntent(j):null; if(!v){ E.msg=j?.reason==='rate_limited'?'Slow down. Pick a line or try again in a moment.':'They did not catch that. Pick a line.'; ui.render(); return; }
    const rep=j.replies&&typeof j.replies.ok==='string'&&typeof j.replies.fail==='string'&&j.replies.ok.length<=200&&j.replies.fail.length<=200?j.replies:null;
    finish(ui,v,true,rep,j.src==='ai'?'ai':'canned'); }
  catch{ E.busy=false; E.msg='No answer. Pick a line.'; ui.render(); } }
const CHOICE_REPLY:Record<Intent,[string,string]>={ persuade:['Fair point. Go on.','No. Not today.'], intimidate:['Easy. I am moving.','Try it and see.'], bribe:['Pleasure doing business.','Keep it.'], deceive:['Right. Go ahead.','Nice story. No.'], empathize:['Yeah. Go on through.','Save it.'] };
export function npcClick(ui:UIx,el:HTMLElement,a:string):boolean{ const s=ui.g.save;
  switch(a){
    case 'sp-choose': { const E=SP.enc; if(!E||E.result) return true; const i=el.dataset.i as Intent; finish(ui,{ intent:i, strength:SPEECH_CFG.choiceStrength },false,{ ok:CHOICE_REPLY[i][0], fail:CHOICE_REPLY[i][1] },'choice'); return true; }
    case 'sp-say': { const inp=document.getElementById('sp-text') as HTMLInputElement|null; void sayFree(ui,inp?.value||''); return true; }
    case 'sp-gift': { const E=SP.enc; if(!E) return true; const why=giveGift(s,E.npc); ui.g.toast(why||'They take it. They will remember.'); if(!why) persist(s); ui.render(); return true; }
    case 'sp-leave': { SP.enc=null; ui.close(); return true; }
    case 'pc-accept': { const r=acceptPersonal(s,el.dataset.id!,capsOf(ui),MAX_ACTIVE_CONTRACTS); ui.g.toast(r.ok?'Contract accepted.':r.why); if(r.ok) persist(s); ui.render(); return true; }
    case 'pc-reroll': { const B=boardOf(s); if((B.n||0)>=2){ ui.g.toast('No more jobs today.'); return true; } refreshBoard(s,capsOf(ui),Date.now(),true); persist(s); void pickWithAi(ui); ui.render(); return true; }
    case 'od-talk': { openSpeech(ui,'odalys_vane','info',{ resist:1 }); return true; }
    case 'vd-haggle': { const npc=ui.g.townId==='harrow'?'vendor_harrow':'vendor_rustline'; const day=new Date().toDateString(); if(s.haggle?.day===day&&s.haggle.npc===npc){ ui.g.toast('Already haggled today.'); return true; }
      openSpeech(ui,npc,'discount',{ resist:1, onDone:o=>{ s.haggle={ day, npc, ok:o.ok }; persist(s); } }); return true; }
  } return false; }
export { vendorMul } from './npcmem';

// ---------------- personal contracts on the job board / Odalys ----------------
let picking=false;
export async function pickWithAi(ui:UIx,fetcher?:(u:string,i:any)=>Promise<any>):Promise<'ai'|'kept'|'skip'>{ const s=ui.g.save; if(s.settings?.storyAi===false||picking) return 'skip'; const B=boardOf(s); const cands=(B as any)._cands as PContract[]|undefined; if(!cands?.length) return 'skip'; picking=true;
  try{ const T=traitsOf(s); const fams=[T.l10,T.l20].flatMap(p=>p&&TRAIT_BY_ID[p.id]?(TRAIT_BY_ID[p.id] as any).fams:[]).slice(0,2);
    const j=await post({ kind:'contract_pick', session:SESSION_ID, player:PLAYER_ID, candidates:cands.map(c=>({ id:c.id, tpl:c.tpl, obj:c.obj, boss:c.boss, mods:c.mods, giver:c.giver, n:c.goal.n })), player_facts:{ level:Math.max(1,Math.min(99,s.level|0)), band:humBand(humanityOf(s)), fams, rivals:nemesesOf(s).map(n=>n.boss) } },fetcher as any);
    if(j&&j.ok&&j.src==='ai'&&applyPick(s,cands,j.picks,capsOf(ui))){ persist(s); if(ui.modal==='fixer') ui.render(); return 'ai'; } return 'kept'; }
  catch{ return 'kept'; } finally{ picking=false; } }
export function ensureBoard(ui:UIx){ const s=ui.g.save; const r=refreshBoard(s,capsOf(ui)); if(r.cands.length){ Object.defineProperty(r.board,'_cands',{ value:r.cands, enumerable:false, configurable:true }); persist(s); void pickWithAi(ui); } return r.board; }
export function jobsBlock(ui:UIx):string{ const s=ui.g.save; const B=ensureBoard(ui); const cs=contractState(s); const caps=capsOf(ui);
  const row=(c:PContract,active:boolean)=>{ const d=DUNGEONS[c.tpl]; const prog=cs.active[c.id]||0; const giver=NPC_BY_ID[c.giver]?.name||'Odalys Vane';
    const tags=[`<span class="tag" data-tip="${esc(OBJ_LABEL[c.obj]+': '+({clear:'clear the dungeon',boss:'defeat '+(ENEMIES[c.boss]?.name||c.boss),cull:'defeat '+c.goal.n+' of its crew',salvage:'pick up '+c.goal.n+' items there',condition:'trigger the condition that wakes '+(ENEMIES[c.boss]?.name||c.boss)} as any)[c.obj])}">${OBJ_LABEL[c.obj]}</span>`,...c.mods.map(m=>`<span class="tag pcmod" data-tip="${esc(MOD_LABEL[m].tip)}">${MOD_LABEL[m].label}</span>`)].join(' ');
    return `<div class="row pcrow" data-pc="${c.id}"><div class="pcmain"><b class="nm2" title="${esc(c.title)}">${esc(c.title)}</b> ${tags}<div class="mut pcbrief">${esc(c.brief||'')}</div><div class="mut">${esc(d?.short||c.tpl)} · ${esc(giver)} · ${c.reward.credits}c${active?' · '+prog+'/'+c.goal.n:''}</div></div>${active?'':`<button class="btn primary" data-act="pc-accept" data-id="${c.id}" data-tip="${esc('Personal job. Built from your history; checked to be finishable.')}">Take</button>`}</div>`; };
  const act=Object.keys(cs.active).filter(k=>B.defs[k]).map(k=>row(B.defs[k],true)).join('');
  const offers=B.offers.map(c=>row(c,false)).join('')||'<div class="mut">Nothing that fits you today. Check back tomorrow.</div>';
  const od=memLine(s,'odalys_vane',keyName); void caps;
  return `<div class="pcblock"><h3>For you <span class="help" tabindex="0" data-tip="${esc('<b>Personal jobs</b><br>Odalys builds these from your clears, traits, humanity, rivals and standing. Every job is checked to be finishable from where you are.')}">?</span></h3>
    <div class="mut od-mem">${esc(od.text)}</div>${act}${offers}<div class="actrow"><button class="btn" data-act="pc-reroll" data-tip="Ask for different jobs (2 per day)">Other jobs</button><button class="btn" data-act="od-talk" data-tip="Talk to Odalys in your own words">Talk</button></div></div>`; }

