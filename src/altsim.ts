// Applies src/altplay.ts outcomes to a live Game (docs/ALT_GAMEPLAY.md). Kept out of sim.ts so new styles plug in here.
import { ENEMIES } from './config';
import { tierOf, NODES, tooltip, canUse, miniFor, cursorAt, miniHit, speechOptions, rollOk, ALT_CFG, STYLE_META, TEACH, altState, firstSeen, humanityOfSave, psychoDmg, nextHint, type Ctx, type Payoff, type Style, type Mini } from './altplay';
import { traitsOf, recordHack, recordSpeech, recordHumanity } from './traitstate';
type G=any;
export function ctxOf(g:G):Ctx{ const T=traitsOf(g.save); return { caps:g.build?.caps||new Set(), abilities:g.build?.abilities||[], traits:{ l10:T.l10?.id||null, l20:T.l20?.id||null }, rep:g.save.rep, mfr:g.dd?.mfr, humanity:humanity(g), credits:g.save.credits }; }
export const hackTier=(g:G)=>g.dbg?.noHack?0:tierOf('hack',ctxOf(g));
export const speechTier=(g:G)=>tierOf('speech',ctxOf(g));
/** dbg.hum: test/dev override (docs/HUMANITY.md) */
export function humanity(g:G):number{ return typeof g.dbg?.hum==='number'?g.dbg.hum:humanityOfSave(g.save); }
const isTurret=(e:any)=>{ const d=ENEMIES[e.type]; return !!d&&!d.boss&&(d.static||/drone|turret|sentry|cam/i.test(d.name)); };
const near=(g:G,e:any,r:number)=>Math.hypot(e.x-g.px,e.y-g.py)<r;
/** teach-then-reward: the first time a style is offered, one prompt, once per save */
function teach(g:G,style:Style){ if(firstSeen(g.save,style)){ g.emit('dialog',{ title:TEACH[style].title, body:TEACH[style].body, options:[{label:'Got it'}] }); g.emit('altteach',style); return true; } return false; }

/** dynamic prompts (turrets, boss shield, talkable guards). Only used when no fixed interact is in range. */
export function altPrompt(g:G):any{ if(g.mode!=='run'||!g.inst) return null; const f=g.inst.flags; let best:any=null, bd=1e9;
  const put=(e:any,id:string,p:Payoff,r:number)=>{ const d=Math.hypot(e.x-g.px,e.y-g.py); if(d<r&&d<bd){ bd=d; best=mk(id+e.id,e,p,g); } };
  for(const e of g.enemies){ if(e.dead||e.faction!=='enemy') continue; const d=ENEMIES[e.type]; if(!d) continue;
    if(d.boss&&e._rt?.reveal>0&&!f.sitout) put(e,'alt:sitout:','sitout',7);
    else if(d.boss&&!f.shieldHacked&&!g.revealing) put(e,'alt:shield:','shield',3.2);
    else if(isTurret(e)) put(e,'alt:turret:','turret',2.6);
    else if(!e.alert&&!e.talked) put(e,'alt:talk:','standdown',3.5); /* lock elite + any calm crew: talk */ }
  return best; }
function mk(id:string,e:any,p:Payoff,g:G){ const n=NODES[p]; const tier=n.style==='hack'?hackTier(g):speechTier(g); return { id, x:e.x, y:e.y, r:3, label:n.label, kind:n.style==='hack'?'hack':'npc', alt:{ payoff:p, style:n.style, tip:tooltip(p,tier) } }; }
/** HUD tooltip for any prompt (fixed interacts get theirs too) */
export function promptTip(g:G,it:any):string|null{ if(it?.alt) return it.alt.tip; if(it?.id==='hackproc') return tooltip('shortcut',hackTier(g))+' · '+STYLE_META.hack.fallback; if(it?.id==='cratechip') return tooltip('cache',hackTier(g)); return null; }
export const promptIcon=(it:any)=>it?.alt?STYLE_META[it.alt.style as Style].icon:it?.id==='hackproc'||it?.kind==='hack'||it?.kind==='terminal'?STYLE_META.hack.icon:'';

export function altInteract(g:G,it:any){ const [,kind,sid]=String(it.id).split(':'); const e=g.enemies.find((x:any)=>String(x.id)===sid); if(!e||e.dead) return;
  if(kind==='turret'){ teach(g,'hack'); if(!canUse('turret',hackTier(g))) return deny(g,'turret'); g.channel={ kind:'hack', t:0, dur:1, cb:()=>{ if(e.dead) return; applyPayoff(g,'turret',e); g.toast('Turret is yours'); } }; return; }
  if(kind==='shield'){ teach(g,'hack'); if(!canUse('shield',hackTier(g))) return deny(g,'shield'); g.channel={ kind:'hack', t:0, dur:1.2, cb:()=>{ if(e.dead) return; applyPayoff(g,'shield',e); } }; return; }
  if(kind==='talk'||kind==='sitout') return talk(g,e,kind==='sitout'); }
function deny(g:G,p:Payoff){ g.emit('sfx','deny'); g.toast(tooltip(p,NODES[p].style==='hack'?hackTier(g):speechTier(g))); }
function hackDone(g:G,p:Payoff){ const a=altState(g.save); a.n.hack++; recordHack(g.save); g.note?.('route_used','hack'); g.emit('althack',p); }

/** payoffs, applied by rule (tests call these directly) */
export function applyPayoff(g:G,p:Payoff,e?:any){ const f=g.inst.flags;
  switch(p){
    case 'shortcut': f.lock2=true; g.openDoor('lock2'); g.toast('Relay hacked: lock open'); if(hackTier(g)>=3) applyPayoff(g,'lights'); hackDone(g,'shortcut'); break;
    case 'lights': f.lightsOut=true; g.toast('Lights out: enemies see less'); break;
    case 'turret': if(e){ e.faction='ally'; e.alert=true; /* a gate-guard turret stays yours and counts as handled for its gate */ if(e.type===g.dd.gateGuard){ e.turned=true; e.ctrlT=1e6; } else e.ctrlT=20; } hackDone(g,'turret'); break;
    case 'cache': g.addDrop(g.px+.6,g.py+.6,{ kind:'chip', chip:g.dd.cache.chips[1]||g.dd.cache.chips[0], amount:1 }); g.toast('Cache cracked: bonus chip'); hackDone(g,'cache'); break;
    case 'shield': if(e){ e._rt.vuln=6; e.stunT=Math.max(e.stunT,1.5); } f.shieldHacked=true; g.toast('Shield down: 6s'); hackDone(g,'shield'); break;
    case 'standdown': case 'bribe': if(e) standDown(g,e); break;
    case 'switch': if(e){ e.faction='ally'; e.ctrlT=1e6; e.turned=true; e.alert=true; gateCheck(g,e); g.toast(ENEMIES[e.type].name+' switches sides'); } break;
    case 'flee': { let n=0; for(const o of g.enemies){ if(o.dead||o.faction!=='enemy'||ENEMIES[o.type]?.boss) continue; if(e&&Math.hypot(o.x-e.x,o.y-e.y)>6) continue; standDown(g,o,true); n++; } g.toast(n+' fled'); break; }
    case 'sitout': f.sitout=true; if(e){ e.hp*=.8; } g.toast('Lieutenant sits this one out'); break;
  } g.saveNow?.(); }
function standDown(g:G,e:any,quiet=false){ e.dead=true; e.fled=true; e.hp=0; gateCheck(g,e); if(!quiet) g.toast(ENEMIES[e.type].name+' stands down'); }
function gateCheck(g:G,e:any){ const f=g.inst.flags; if(e.type===g.dd.lockElite&&!f.lock2){ f.lock2=true; g.openDoor('lock2'); g.toast('Lock released'); } }

// ---- speech ----
export function talkOptions(g:G,e:any,boss=false){ const d=ENEMIES[e.type]; return speechOptions(ctxOf(g),{ elite:!!d?.elite||e.type===g.dd.lockElite, boss, level:g.save.level }); }
function talk(g:G,e:any,boss:boolean){ if(teach(g,'speech')&&!boss){ /* the teach prompt is the first dialog; the talk opens right after */ }
  const opts=talkOptions(g,e,boss); g.emit('dialog',{ title:(boss?'Lieutenant':ENEMIES[e.type].name), body:'Odds shown. A failed talk is a fight.', options:[...opts.map(o=>({ label:o.label+(o.ok?' ('+Math.round(o.chance*100)+'%)':' · '+o.why), cb:o.ok?()=>speak(g,e,o.payoff,Math.random()):undefined })),{ label:'Fight' }] }); }
/** resolve one speech attempt with roll r (0..1). Failure = they fight; never a lock. */
export function speak(g:G,e:any,p:Payoff,r:number):boolean{ if(e.dead||e.talked&&p!=='sitout') return false; const opts=talkOptions(g,e,p==='sitout'); const o=opts.find(x=>x.payoff===p); if(!o||!o.ok) return false;
  e.talked=true; const a=altState(g.save); a.n.speech++; recordSpeech(g.save,p==='flee'?'intimidate':p); g.emit('altspeech',p);
  if(p==='bribe'){ g.save.credits-=o.cost!; }
  if(rollOk(o.chance,r)){ applyPayoff(g,p,e); g.emit('altspeech_res',{p,ok:true}); return true; } g.emit('altspeech_res',{p,ok:false});
  a.fails.speech++; e.alert=true; for(const x of g.enemies) if(!x.dead&&x.faction==='enemy'&&Math.hypot(x.x-e.x,x.y-e.y)<8) x.alert=true; g.toast('No deal. Fight!'); return false; }

// ---- T0 hack mini-game (relay) ----
export function relay(g:G){ const f=g.inst.flags; if(f.lock2){ g.toast('Lock already open.'); return; } const a=altState(g.save); if((a.cdUntil||0)>g.time){ g.toast('Alarm active. Retry in '+Math.ceil(a.cdUntil-g.time)+'s'); return; }
  const t=hackTier(g); if(teach(g,'hack')) g.altPending=true;
  if(t>=1){ g.channel={ kind:'hack', t:0, dur:1.5, cb:()=>applyPayoff(g,'shortcut') }; g.toast('Hacking relay…'); return; }
  g.altMini={ payoff:'shortcut', m:miniFor(t,(g.inst.seed||1)+a.n.hack+a.fails.hack), t0:g.time }; g.emit('altmini',g.altMini); }
export function miniPos(g:G){ const M=g.altMini; return M?cursorAt(M.m as Mini,g.time-M.t0):0; }
/** stop the bar at pos (UI passes miniPos). Hit = payoff; miss = alarm wave + short cooldown, relay stays usable. */
export function miniResolve(g:G,pos=miniPos(g)):boolean{ const M=g.altMini; if(!M) return false; g.altMini=null; g.emit('altmini',null); const hit=miniHit(M.m,pos);
  if(hit){ applyPayoff(g,M.payoff); return true; } alarm(g); return false; }
export function miniSkip(g:G){ if(!g.altMini) return; g.altMini=null; g.emit('altmini',null); g.toast('Hack skipped'); }
function alarm(g:G){ const a=altState(g.save); a.fails.hack++; recordHack(g.save); a.cdUntil=g.time+ALT_CFG.hack.failCd; g.inst.flags.alarm=true; const t=g.dd.alarmType||g.dd.gateGuard;
  for(let i=0;i<ALT_CFG.hack.alarmN;i++){ const ang=i*2.1; try{ const e=g.spawnEnemy(t,g.px+Math.cos(ang)*5,g.py+Math.sin(ang)*5); e.alert=true; }catch{} } g.emit('sfx','deny'); g.toast('Alarm! Wave incoming. Retry in '+ALT_CFG.hack.failCd+'s'); }
export function altTick(g:G,dt:number){ const M=g.altMini; if(M&&g.time-M.t0>6) miniResolve(g,-1); }
export const altDmgMul=(g:G)=>1+psychoDmg(humanity(g));
/** town arrival: humanity lean into traits + one fixer hint line */
export function altTown(g:G){ recordHumanity(g.save,humanity(g)); const l=nextHint(g.save,humanity(g)); if(l) g.toast(l); }
