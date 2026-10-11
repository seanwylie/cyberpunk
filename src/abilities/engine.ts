// Ability engine: executes data-driven abilities (data.ts) by composing effect primitives against the Game sim.
// The sim calls: abxCast (from executeAbility), abxTick (every frame), abxIncoming (hurtPlayer), abxOutgoing (hurtEnemy), abxSpeedMul (enemy movement).
import { ENEMIES, COMBAT } from '../config';
import type { AbilityData, Prim, Tag } from './types';
import { ABILITY_BY_ID } from './registry';
import { ABILITY_BAL } from './hw';
import { HEAT, effCooling, throttle } from '../heat';
import { fxPrim, fxCastBase, fxDeploy } from './vfx';

export interface EnSt { marked:number; exposed:number; burn:{t:number;dps:number;acc:number}|null; root:number; slow:{t:number;m:number}|null; tether:{t:number;to:number}|null; }
export interface Dep { kind:'turret'|'drone'|'decoy'|'bot'|'aura'|'trap'; x:number; y:number; t:number; life:number; every:number; acc:number; r:number; tick:Prim[]; end?:Prim[]; then?:Prim[]; follow?:boolean; ab:AbilityData; ang:number; }
export interface Delayed { t:number; x:number; y:number; then:Prim[]; ab:AbilityData; ang:number; tid:number|null; }
export interface AProj { x:number;y:number;vx:number;vy:number;r:number;life:number;pierce:number;then:Prim[];ab:AbilityData;hit:Set<number>;ang:number; }
export interface Abx {
  st:Map<number,EnSt>; shield:number; shieldT:number; mit:{m:number;t:number}; reflect:{f:number;t:number}; dmg:{m:number;t:number}; move:{m:number;t:number}; steal:{f:number;t:number}; ambush:{m:number;t:number};
  hot:{left:number;rate:number}; toggles:Set<string>; deps:Dep[]; delayed:Delayed[]; projs:AProj[]; inCast:boolean; log:string[]; casts:Record<string,number>; ventedThisCast:number; invuln:number;
}
export const newAbx=():Abx=>({ st:new Map(), shield:0, shieldT:0, mit:{m:1,t:0}, reflect:{f:0,t:0}, dmg:{m:1,t:0}, move:{m:1,t:0}, steal:{f:0,t:0}, ambush:{m:1,t:0}, hot:{left:0,rate:0}, toggles:new Set(), deps:[], delayed:[], projs:[], inCast:false, log:[], casts:{}, ventedThisCast:0, invuln:0 });
export interface AbMods { cdr:number; heat:number; cc:number; cloak:number; arc:number; len:number; heal:number; shield:number; dash:number; dur:number; dmg:number; }
export const NO_MODS:AbMods={ cdr:0, heat:0, cc:0, cloak:0, arc:0, len:0, heal:0, shield:0, dash:0, dur:0, dmg:0 };
const dist=(ax:number,ay:number,bx:number,by:number)=>Math.hypot(ax-bx,ay-by);
const angDiff=(a:number,b:number)=>{ let d=a-b; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2; return d; };
export const BASE_DMG=30;
const mods=(g:any):AbMods=>g.build?.abMods||NO_MODS;
const abx=(g:any):Abx=>g.abx||(g.abx=newAbx());
export function enSt(g:any,e:any):EnSt{ const a=abx(g); let s=a.st.get(e.id); if(!s){ s={marked:0,exposed:0,burn:null,root:0,slow:null,tether:null}; a.st.set(e.id,s); } return s; }
const live=(g:any)=>g.enemies.filter((e:any)=>!e.dead&&e.faction==='enemy'&&!(e._rt&&e._rt.reveal>0));
const boss=(e:any)=>!!ENEMIES[e.type]?.boss;
const rad=(e:any)=>ENEMIES[e.type]?.radius||.4;

export interface Ctx { x:number;y:number;ang:number;tx:number;ty:number;target:any|null;hit:any[];ab:AbilityData;idx:number;kills:number }
/** Does the player/enemy currently carry this tag? */
export function hasTag(g:any,t:Tag,e?:any):boolean{ const a=abx(g); const s=e?a.st.get(e.id):null;
  switch(t){ case 'Marked': return !!s&&s.marked>0; case 'Exposed': return !!s&&s.exposed>0; case 'Burning': return !!s?.burn; case 'Rooted': return !!s&&s.root>0; case 'Slowed': return !!s?.slow; case 'Tethered': return !!s?.tether; case 'Staggered': return !!e&&e.stunT>0;
    case 'Cloaked': return g.cloakT>0; case 'Shielded': return a.shield>0; case 'Overheated': return !!g.overheated; case 'Hasted': return a.move.t>0&&a.move.m>1; case 'Charged': return a.dmg.t>0&&a.dmg.m>1; } return false; }

/** Damage for one coefficient k of ability ab against target e (e optional). */
export function abDamage(g:any,ab:AbilityData,k:number,e?:any):number{
  const st=g.stat(); const sc=ab.scale==='dmg'?st.dmg:ab.scale==='cooling'?(.7+effCooling(st.cooling)*.3):ab.scale==='maxHp'?st.maxHp/100:ab.scale==='armor'?1+st.armor*.04:ab.scale==='move'?(.8+st.move*.2):(1+st.regen*.1);
  let d=BASE_DMG*k*sc*ABILITY_BAL.dmg*(1+mods(g).dmg)*throttle(mods(g).heat,st.cooling)*(g.overheated?COMBAT.heat.overheatDmgMult:1);
  if(e){ for(const b of ab.bonus||[]){ if(hasTag(g,b.w,e)){ d*=b.m; if(b.eat) eat(g,e,b.w); } }
    if(ab.exec&&e.hp/e.maxHp<=ab.exec.hp) d*=ab.exec.m; }
  return d; }
function eat(g:any,e:any,t:Tag){ const s=enSt(g,e); if(t==='Marked') s.marked=0; else if(t==='Exposed') s.exposed=0; else if(t==='Burning') s.burn=null; else if(t==='Slowed') s.slow=null; else if(t==='Rooted') s.root=0; else if(t==='Staggered') e.stunT=0; }
function cc(g:any,t:number){ return t*(1+mods(g).cc); }
function strike(g:any,c:Ctx,e:any,k:number,kb=0){ if(e.dead) return; const was=!e.dead; const d=abDamage(g,c.ab,k,e); const tg=g.curTag; g.curTag=c.ab.id; try{ g.hurtEnemy(e,d,c.x,c.y,kb); } finally { g.curTag=tg; } if(typeof g.vfx==='function'&&!g.save?.settings?.reducedFx) g.vfx(c.ab.id+'.hit',e.x,e.y,{a:c.ang}); if(!c.hit.includes(e)) c.hit.push(e); if(was&&e.dead) c.kills++; }
function select(g:any,c:Ctx,list:any[],k:number,kb=0){ c.hit=[]; for(const e of list){ if(k>0) strike(g,c,e,k,kb); else c.hit.push(e); } }
const inCone=(g:any,c:Ctx,r:number,arc:number)=>live(g).filter((e:any)=>dist(c.x,c.y,e.x,e.y)-rad(e)<=r&&Math.abs(angDiff(Math.atan2(e.y-c.y,e.x-c.x),c.ang))<=arc/2);
const inLine=(g:any,c:Ctx,len:number,w:number)=>live(g).filter((e:any)=>{ const dx=e.x-c.x, dy=e.y-c.y; const al=dx*Math.cos(c.ang)+dy*Math.sin(c.ang); const pe=Math.abs(-dx*Math.sin(c.ang)+dy*Math.cos(c.ang)); return al>-.3&&al<=len+rad(e)&&pe<=w/2+rad(e); });
const inCircle=(g:any,x:number,y:number,r:number)=>live(g).filter((e:any)=>dist(x,y,e.x,e.y)-rad(e)<=r);
function nearest(g:any,x:number,y:number,r:number,not?:Set<number>){ let b:any=null,bd=r; for(const e of live(g)){ if(not?.has(e.id)) continue; const d=dist(x,y,e.x,e.y)-rad(e)*.5; if(d<bd&&g.los(x,y,e.x,e.y)){ bd=d; b=e; } } return b; }
function stepTo(g:any,x:number,y:number,ang:number,len:number){ let px=x,py=y; for(let d=0;d<len;d+=.25){ const p=g.moveCircle(px,py,Math.cos(ang)*.25,Math.sin(ang)*.25,COMBAT.playerRadius); if(Math.hypot(p.x-px,p.y-py)<.05) break; px=p.x; py=p.y; } return {x:px,y:py}; }
function setStun(g:any,e:any,t:number){ t=cc(g,t); e.stunT=Math.max(e.stunT||0,boss(e)?t*.35:ENEMIES[e.type]?.elite?t*.6:t); }

export function runSteps(g:any,c:Ctx,steps:Prim[],depth=0){ if(depth>6) return; for(const p of steps) runPrim(g,c,p,depth); }
function runPrim(g:any,c:Ctx,p:Prim,depth:number){
  const a=abx(g), m=mods(g), ab=c.ab; fxPrim(g,c,p);
  switch(p.p){
    case 'damage': { const t=c.target&&!c.target.dead?c.target:nearest(g,c.x,c.y,3,undefined); if(t){ c.hit=[]; strike(g,c,t,p.k,p.kb||0); } break; }
    case 'cone': { const arc=(p.arc*Math.PI/180)*(1+m.arc); select(g,c,inCone(g,c,p.r,arc),p.k,p.kb||0); break; }
    case 'line': select(g,c,inLine(g,c,p.len*(1+m.len),p.w),p.k,p.kb||0); break;
    case 'circle': { const at=p.at||'self'; const x=at==='self'?c.x:at==='aim'?c.tx:(c.target?c.target.x:c.tx), y=at==='self'?c.y:at==='aim'?c.ty:(c.target?c.target.y:c.ty); select(g,c,inCircle(g,x,y,p.r*(1+m.arc*.5)),p.k,p.kb||0); (c as any).ox=x; (c as any).oy=y; break; }
    case 'chain': { const seen=new Set<number>(); let cur:any=c.target&&!c.target.dead?c.target:nearest(g,c.tx,c.ty,6); let k=p.k; c.hit=[]; let from={x:c.x,y:c.y}; for(let i=0;i<p.n&&cur;i++){ seen.add(cur.id); g.fx.push({kind:'line',x:from.x,y:from.y,a:Math.atan2(cur.y-from.y,cur.x-from.x),len:dist(from.x,from.y,cur.x,cur.y),w:.12,t:0,life:.2,c:'#9fc4e4'}); strike(g,c,cur,k); k*=p.fall||.85; from={x:cur.x,y:cur.y}; cur=nearest(g,cur.x,cur.y,p.r,seen); } break; }
    case 'projectile': a.projs.push({ x:c.x,y:c.y,vx:Math.cos(c.ang)*p.speed,vy:Math.sin(c.ang)*p.speed,r:p.r,life:p.life*(1+m.len*.8),pierce:p.pierce,then:p.then,ab,hit:new Set(),ang:c.ang }); break;
    case 'dash': { let ang=c.ang, len=p.len*(1+m.dash); if(p.toTarget&&c.target){ ang=Math.atan2(c.target.y-g.py,c.target.x-g.px); len=Math.max(0,Math.min(len,dist(g.px,g.py,c.target.x,c.target.y)-rad(c.target)-.4)); }
      const o={x:g.px,y:g.py}; const end=stepTo(g,o.x,o.y,ang,len); g.face=ang; const T=.14; g.slideFx=(end.x-o.x)/T; g.slideFy=(end.y-o.y)/T; g.slideT=T; g.iframes=Math.max(g.iframes,(p.inv||.15)); 
      if(p.k){ const cc2:Ctx={...c,x:o.x,y:o.y,ang}; const L=dist(o.x,o.y,end.x,end.y)+.8; select(g,c,inLine(g,cc2,L,1.4),p.k,.5); } c.x=end.x; c.y=end.y; c.ang=ang; break; }
    case 'teleport': { const len=Math.min(c.ab.range*(1+m.dash), dist(g.px,g.py,c.tx,c.ty)||c.ab.range); const o={x:g.px,y:g.py}; const ang=Math.atan2(c.ty-g.py,c.tx-g.px); const end=stepTo(g,o.x,o.y,ang,len); g.px=end.x; g.py=end.y; g.iframes=Math.max(g.iframes,.12); c.x=end.x; c.y=end.y; fxPrim(g,{...c,x:o.x,y:o.y},p); break; }
    case 'pull': case 'push': { const ox=(c as any).ox??c.x, oy=(c as any).oy??c.y; for(const e of c.hit){ if(e.dead||boss(e)) continue; const dx=e.x-ox, dy=e.y-oy, d=Math.hypot(dx,dy)||1; const s=p.p==='pull'?-Math.min(p.s,d):p.s; const q=g.moveCircle(e.x,e.y,dx/d*s,dy/d*s,rad(e)); e.x=q.x; e.y=q.y; } break; }
    case 'stun': for(const e of c.hit) if(!e.dead) setStun(g,e,p.t); break;
    case 'slow': for(const e of c.hit) if(!e.dead) enSt(g,e).slow={ t:cc(g,p.t), m:boss(e)?1-(1-p.m)*.5:p.m }; break;
    case 'root': for(const e of c.hit) if(!e.dead){ const s=enSt(g,e); s.root=Math.max(s.root,cc(g,p.t)*(boss(e)?.4:1)); } break;
    case 'mark': for(const e of c.hit) if(!e.dead) enSt(g,e).marked=Math.max(enSt(g,e).marked,p.t*(1+m.dur)); break;
    case 'expose': for(const e of c.hit) if(!e.dead) enSt(g,e).exposed=Math.max(enSt(g,e).exposed,p.t*(1+m.dur)); break;
    case 'burn': for(const e of c.hit) if(!e.dead) enSt(g,e).burn={ t:p.t, dps:abDamage(g,ab,p.k*1)/1, acc:0 }; break;
    case 'tether': { const L=c.hit.filter((e:any)=>!e.dead); if(L.length===1){ const o=nearest(g,L[0].x,L[0].y,6,new Set([L[0].id])); if(o) L.push(o); } for(let i=1;i<L.length;i++) enSt(g,L[i]).tether={ t:p.t, to:L[0].id }; if(L[0]&&L.length>1) enSt(g,L[0]).tether={ t:p.t, to:L[1].id };  break; }
    case 'control': for(const e of c.hit.slice(0,1)){ if(e.dead) continue; if(ENEMIES[e.type]?.elite){ setStun(g,e,1.8); } else { e.faction='ally'; e.ctrlT=cc(g,p.t)+(g.build?.mods?.ctrlDur||0); e.alert=true; } } break;
    case 'strip': for(const e of c.hit){ const sh=e._rt?.shield; if(sh&&sh.hp>0){ sh.hp=0; e._rt.shield=null; e._rt.vuln=Math.max(e._rt.vuln||0,2); } } break;
    case 'lose': for(const e of live(g)){ if(boss(e)||dist(g.px,g.py,e.x,e.y)>p.r&&dist(c.x,c.y,e.x,e.y)>p.r) continue; if(e._rt&&e.alert){ e._rt.st='lost'; e._rt.lost=Math.max(e._rt.lost||0,.1); } } break;
    case 'shield': a.shield=Math.max(a.shield,g.maxHp*p.f*(1+m.shield)); a.shieldT=Math.max(a.shieldT,p.t); break;
    case 'mitigate': { const mm=1-(1-p.m)*(1+m.shield); a.mit={ m:Math.min(a.mit.t>0?a.mit.m:1,Math.max(.1,mm)), t:Math.max(a.mit.t,p.t) }; break; }
    case 'reflect': a.reflect={ f:p.f, t:p.t }; break;
    case 'heal': { const tot=g.maxHp*p.f*(1+m.heal); if(p.over){ a.hot={ left:a.hot.left+tot, rate:tot/p.over }; } else g.hp=Math.min(g.maxHp,g.hp+tot); break; }
    case 'cloak': g.cloakT=Math.max(g.cloakT,p.t+m.cloak); break;
    case 'cdr': for(let i=0;i<3;i++){ if(i===c.idx) continue; g.abCd[i]=p.all&&p.t>=30?0:Math.max(0,g.abCd[i]-p.t); } break;
    case 'vent': g.heat=Math.max(0,g.heat-p.n*HEAT.abilityMul*.8); if(g.overheated&&g.heat<=COMBAT.heat.overheatRecover) g.overheated=false; break;
    case 'ventHit': { const v=Math.min(p.cap*HEAT.abilityMul*.8-a.ventedThisCast,p.n*HEAT.abilityMul*.8*c.hit.length); if(v>0){ g.heat=Math.max(0,g.heat-v); a.ventedThisCast+=v; } break; }
    case 'buff': { const T=p.t*(1+m.dur); if(p.s==='dmg') a.dmg={ m:p.m, t:T }; else if(p.s==='move') a.move={ m:1+(p.m-1)*(1+m.dash), t:T }; else if(p.s==='lifesteal') a.steal={ f:p.m*(1+m.heal), t:T }; else a.ambush={ m:p.m, t:T }; break; }
    case 'invuln': g.iframes=Math.max(g.iframes,p.t); break;
    case 'shoot': { const t=nearest(g,c.x,c.y,(c as any).range||9); if(t){ c.hit=[]; strike(g,c,t,p.k); g.fx.push({kind:'line',x:c.x,y:c.y,a:Math.atan2(t.y-c.y,t.x-c.x),len:dist(c.x,c.y,t.x,t.y),w:.08,t:0,life:.12,c:'#d9d4a0'}); } break; }
    case 'summon': { const n=a.deps.filter(d=>d.kind!=='aura'&&d.kind!=='trap').length; if(n>=8) a.deps.shift(); const life=p.life*(1+m.dur)+(g.build?.mods?.ctrlDur||0)*.25; const off=p.kind==='drone'?(a.deps.filter(d=>d.kind==='drone').length*1.3):0; const pos=p.kind==='drone'||c.ab.shape==='self'?{x:g.px+Math.cos(off)*1.2,y:g.py+Math.sin(off)*1.2}:{x:c.tx,y:c.ty};
      const d:Dep={ kind:p.kind,x:pos.x,y:pos.y,t:0,life,every:p.every,acc:0,r:p.r,tick:p.tick,end:p.end,follow:p.kind==='drone',ab,ang:c.ang }; a.deps.push(d); fxDeploy(g,d); break; }
    case 'aura': { const at=p.at==='self'||c.ab.shape==='self'?{x:g.px,y:g.py}:{x:c.tx,y:c.ty}; const d:Dep={ kind:'aura',x:at.x,y:at.y,t:0,life:p.life*(1+m.dur),every:p.every,acc:0,r:p.r,tick:p.tick,follow:!!p.follow,ab,ang:c.ang }; a.deps.push(d); fxDeploy(g,d); break; }
    case 'trap': { const d:Dep={ kind:'trap',x:c.tx,y:c.ty,t:0,life:p.life,every:.1,acc:0,r:p.r,tick:[],then:p.then,ab,ang:c.ang }; a.deps=a.deps.filter(x=>!(x.kind==='trap'&&x.ab.id===ab.id)||false); a.deps.push(d); fxDeploy(g,d); break; }
    case 'delayed': { const at=p.at==='self'?{x:g.px,y:g.py}:p.at==='target'&&c.target?{x:c.target.x,y:c.target.y}:{x:c.tx,y:c.ty}; a.delayed.push({ t:p.t, x:at.x, y:at.y, then:p.then, ab, ang:c.ang, tid:c.target?c.target.id:null }); g.fx.push({kind:'ring',x:at.x,y:at.y,r:2,t:0,life:p.t,c:'#d9a36a'}); break; }
  }
}
function mkCtx(g:any,ab:AbilityData,idx:number,aim:{wx:number;wy:number},v:any):Ctx{ const ang=Math.atan2(aim.wy-g.py,aim.wx-g.px); return { x:g.px,y:g.py,ang,tx:v.tx??(g.px+Math.cos(ang)*Math.min(ab.range||3,3)),ty:v.ty??(g.py+Math.sin(ang)*Math.min(ab.range||3,3)),target:v.target||null,hit:v.target?[v.target]:[],ab,idx,kills:0 }; }

/** Entry from Game.executeAbility. Heat and base cooldown were already committed by the sim. Returns true when handled. */
export function abxCast(g:any,def:{id:string},idx:number,aim:{wx:number;wy:number},v:any):boolean{
  const ab=ABILITY_BY_ID[def.id]; if(!ab) return false; const a=abx(g); const m=mods(g);
  a.casts[ab.id]=(a.casts[ab.id]||0)+1; a.log.push(ab.id); if(a.log.length>200) a.log.shift();
  // heat cost (diminishing, capped chip reduction) and cooldown (capped cdr) were committed by Game.executeAbility
  if(ab.shape==='toggle'){ if(a.toggles.has(ab.id)){ a.toggles.delete(ab.id); g.toast(ab.name+' off'); } else { a.toggles.add(ab.id); g.toast(ab.name+' on'); } fxCastBase(g,ab); return true; }
  const c=mkCtx(g,ab,idx,aim,v); a.inCast=true; a.ventedThisCast=0; fxCastBase(g,ab); g.face=c.ang;
  try{ runSteps(g,c,ab.steps); } finally { a.inCast=false; if(a.ambush.t>0&&a.ambush.m>1&&ab.steps.some(s=>['cone','line','circle','damage','chain','projectile'].includes(s.p))&&!(ab.steps.some(s=>s.p==='buff'&&(s as any).s==='ambush'))) a.ambush={m:1,t:0}; }
  if(ab.refundOnKill&&c.kills>0){ g.abCd[idx]=Math.max(0,g.abCd[idx]-ab.refundOnKill); g.toast(ab.name+': kill, cooldown refunded'); }
  return true;
}

export function abxReset(g:any){ g.abx=newAbx(); }
export function abxTick(g:any,dt:number){
  const a=abx(g);
  for(const k of ['mit','reflect','dmg','move','steal','ambush'] as const){ const o:any=(a as any)[k]; if(o.t>0){ o.t-=dt; if(o.t<=0){ if('m' in o) o.m=1; if('f' in o) o.f=0; } } }
  if(a.shieldT>0){ a.shieldT-=dt; if(a.shieldT<=0) a.shield=0; } if(a.invuln>0) a.invuln-=dt;
  if(a.hot.left>0){ const h=Math.min(a.hot.left,a.hot.rate*dt); a.hot.left-=h; g.hp=Math.min(g.maxHp,g.hp+h); }
  // toggles
  for(const id of [...a.toggles]){ const ab=ABILITY_BY_ID[id]; if(!ab||!ab.toggle) { a.toggles.delete(id); continue; } if(g.overheated||g.downed){ a.toggles.delete(id); g.toast(ab.name+' off (overheat)'); continue; } g.heat=Math.max(0,g.heat+(ab.toggle.heat-(ab.toggle.vent||0))*HEAT.abilityMul*dt); }
  // enemy statuses
  for(const e of g.enemies){ const s=a.st.get(e.id); if(!s) continue; if(e.dead){ a.st.delete(e.id); continue; }
    if(s.marked>0) s.marked-=dt; if(s.exposed>0) s.exposed-=dt; if(s.root>0) s.root-=dt; if(s.slow&&(s.slow.t-=dt)<=0) s.slow=null; if(s.tether&&(s.tether.t-=dt)<=0) s.tether=null;
    if(s.burn){ s.burn.t-=dt; s.burn.acc+=dt; if(s.burn.acc>=.5){ s.burn.acc-=.5; const d=s.burn.dps*.5; g.hurtEnemy(e,d,e.x,e.y,0); g.fx.push({kind:'spark',x:e.x,y:e.y,t:0,life:.25,c:'#e0803a'}); } if(s.burn&&s.burn.t<=0) s.burn=null; } }
  if(g.mode!=='run') { return; }
  // delayed explosions
  for(const d of a.delayed){ d.t-=dt; if(d.t<=0){ const tg=d.tid!=null?g.enemies.find((e:any)=>e.id===d.tid):null; const c:Ctx={x:d.x,y:d.y,ang:d.ang,tx:d.x,ty:d.y,target:tg&&!tg.dead?tg:null,hit:[],ab:d.ab,idx:0,kills:0}; (c as any).ox=d.x; (c as any).oy=d.y; fxCastBase(g,d.ab,d.x,d.y); runSteps(g,c,d.then,2); } }
  a.delayed=a.delayed.filter(d=>d.t>0);
  // projectiles
  for(const p of a.projs){ const steps=Math.ceil(Math.hypot(p.vx,p.vy)*dt/.3); for(let i=0;i<steps&&p.life>0;i++){ p.x+=p.vx*dt/steps; p.y+=p.vy*dt/steps; if(g.solidAt(p.x,p.y)){ p.life=0; break; }
    for(const e of live(g)){ if(p.hit.has(e.id)||dist(p.x,p.y,e.x,e.y)>p.r+rad(e)) continue; p.hit.add(e.id); const c:Ctx={x:p.x,y:p.y,ang:p.ang,tx:e.x,ty:e.y,target:e,hit:[],ab:p.ab,idx:0,kills:0}; (c as any).ox=p.x; (c as any).oy=p.y; runSteps(g,c,p.then,2); if(p.pierce--<=0){ p.life=0; break; } } } p.life-=dt; }
  a.projs=a.projs.filter(p=>p.life>0);
  // deployables
  for(const d of a.deps){ d.t+=dt; if(d.follow&&(d.kind==='drone'||d.kind==='aura')){ const ph=d.t*1.6+d.x; if(d.kind==='drone'){ d.x+=(g.px+Math.cos(ph)*1.3-d.x)*Math.min(1,dt*4); d.y+=(g.py+Math.sin(ph)*1.3-d.y)*Math.min(1,dt*4); } else { d.x=g.px; d.y=g.py; } }
    if(d.kind==='trap'){ const t=nearest(g,d.x,d.y,d.r); if(t){ d.t=d.life+1; const c:Ctx={x:d.x,y:d.y,ang:0,tx:d.x,ty:d.y,target:t,hit:[],ab:d.ab,idx:0,kills:0}; (c as any).ox=d.x; (c as any).oy=d.y; fxCastBase(g,d.ab,d.x,d.y); runSteps(g,c,d.then||[],2); } continue; }
    d.acc+=dt; while(d.acc>=d.every&&d.t<d.life){ d.acc-=d.every; const c:Ctx={x:d.x,y:d.y,ang:d.ang,tx:d.x,ty:d.y,target:null,hit:[],ab:d.ab,idx:0,kills:0}; (c as any).ox=d.x; (c as any).oy=d.y; (c as any).range=d.r; runSteps(g,c,d.tick,3); }
    if(d.t>=d.life&&d.end){ const c:Ctx={x:d.x,y:d.y,ang:d.ang,tx:d.x,ty:d.y,target:null,hit:[],ab:d.ab,idx:0,kills:0}; runSteps(g,c,d.end,3); d.end=undefined; } }
  a.deps=a.deps.filter(d=>d.t<d.life);
}
/** Called from Game.hurtPlayer before armor. Returns the damage that gets through (0 = absorbed). */
export function abxIncoming(g:any,dmg:number,sx:number,sy:number):number{ const a=abx(g); let d=dmg;
  if(a.mit.t>0) d*=a.mit.m; for(const id of a.toggles){ const t=ABILITY_BY_ID[id]?.toggle; if(t?.mitigate) d*=1-(1-t.mitigate)*(1+mods(g).shield); }
  if(a.reflect.t>0&&a.reflect.f>0){ const e=nearest(g,sx,sy,5)||nearest(g,g.px,g.py,4); if(e) g.hurtEnemy(e,Math.min(120,dmg*a.reflect.f),g.px,g.py,0); }
  if(a.shield>0){ const ab=Math.min(a.shield,d); a.shield-=ab; d-=ab; g.fx.push({kind:'ring',x:g.px,y:g.py,r:1.3,t:0,life:.25,c:'#9ec7e8'}); if(a.shield<=0) a.shieldT=0; }
  return d; }
/** Called from Game.hurtEnemy (all player damage). */
export function abxOutgoing(g:any,e:any,dmg:number):number{ const a=abx(g); const s=a.st.get(e.id); let d=dmg;
  if(s){ if(s.marked>0) d*=1.15; if(s.exposed>0) d*=1.2; }
  if(a.dmg.t>0) d*=a.dmg.m; for(const id of a.toggles){ const t=ABILITY_BY_ID[id]?.toggle; if(t?.dmg) d*=t.dmg*(1+mods(g).dmg); }
  if(a.ambush.t>0&&a.ambush.m>1){ d*=a.ambush.m; if(!a.inCast) a.ambush={m:1,t:0}; }
  if(a.steal.t>0) g.hp=Math.min(g.maxHp,g.hp+d*a.steal.f);
  if(s?.tether&&!(a as any)._echo){ (a as any)._echo=true; const o=s.tether.to>=0?g.enemies.find((x:any)=>x.id===s.tether!.to):null; if(o&&!o.dead) g.hurtEnemy(o,d*.5,e.x,e.y,0); (a as any)._echo=false; }
  return d; }
export function abxSpeedMul(g:any,e:any):number{ const s=g.abx?.st.get(e.id); if(!s) return 1; if(s.root>0) return 0; return s.slow?s.slow.m:1; }
export function abxPlayerSpeed(g:any):number{ const a=abx(g); let m=a.move.t>0?a.move.m:1; for(const id of a.toggles){ const t=ABILITY_BY_ID[id]?.toggle; if(t?.move) m*=t.move; } return m; }
export function abxCoolMul(g:any):number{ let m=1; for(const id of abx(g).toggles){ const t=ABILITY_BY_ID[id]?.toggle; if(t?.cool) m*=t.cool; } return m; }
