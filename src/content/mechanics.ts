import { gwPhase, GW_BOSS_HP } from './gateways';
// Reusable boss mechanics toolkit (docs/CONTENT_BATCH_1.md section 2). Bosses are DATA (batch1_bosses.ts): lists of moves, phase actions and an
// arena gimmick that this module turns into ATK entries and runtime behaviour. The sim only calls the hooks at the bottom of this file.
import { BOSS_BY_ID } from './batch1_bosses';
import type { MoveSpec, MoveKind, PhaseAct, Gimmick } from './batch1_bosses';

import { MOVES, MOVE_ATK, MOVE_DMG } from './boss_moves';
export { MOVES, MOVE_ATK, MOVE_DMG };
import { ENEMIES } from '../config';
import { HARD } from './hardmode';
import { DUNGEONS } from './dungeons';
import { palOf } from './boss_kits';
const N=(p:MoveSpec['p']|undefined,k:string,d:number)=>{ const v=p?.[k]; return typeof v==='number'?v:d; };
interface Z { x:number; y:number; r:number; windup:number; life:number; heat:number }
interface PatCtx { ox:number; oy:number; aim:number; tx:number; ty:number; w:number; rnd:()=>number; arena?:Arena|null }
const D2R=Math.PI/180;
/** Ground-pattern generators for the zone-based kinds. Pure: they return zones, the sim pushes them. */
export function patternZones(kind:MoveKind,p:MoveSpec['p']|undefined,c:PatCtx):Z[]{
  const out:Z[]=[]; const {ox,oy,aim,tx,ty,w,rnd}=c;
  switch(kind){
    case 'marks': { const n=N(p,'n',5), r=N(p,'r',1.6), sp=N(p,'spread',3.6); for(let i=0;i<n;i++){ const a=rnd()*6.283, rr=i===0?0:1.2+rnd()*sp; out.push({x:tx+Math.cos(a)*rr,y:ty+Math.sin(a)*rr,r,windup:w+.3,life:w+1.9,heat:10}); } break; }
    case 'rain': { const n=N(p,'n',8), area=N(p,'area',7), r=N(p,'r',1.5); for(let i=0;i<n;i++){ const a=rnd()*6.283, rr=rnd()*area; out.push({x:tx+Math.cos(a)*rr,y:ty+Math.sin(a)*rr,r,windup:w+.2+rnd()*.5,life:w+2.2,heat:8}); } break; }
    case 'ring': { const n=N(p,'n',10), gaps=N(p,'gaps',2), rad=N(p,'rad',5.5), r=N(p,'r',1.5); const g=Math.floor(rnd()*n); for(let i=0;i<n;i++){ let skip=false; for(let k=0;k<gaps;k++) if(i===(g+k)%n) skip=true; if(skip) continue; const a=i/n*6.283; out.push({x:ox+Math.cos(a)*rad,y:oy+Math.sin(a)*rad,r,windup:w+.4,life:w+6,heat:12}); } break; }
    case 'spokes': { const n=N(p,'n',7), len=N(p,'len',8), sw=N(p,'sweep',140)*D2R, r=N(p,'r',1.1), step=N(p,'step',1.8); const dir=rnd()<.5?1:-1; for(let i=0;i<n;i++){ const a=aim-dir*sw/2+dir*sw*(i/Math.max(1,n-1)); const wi=w+i*(1.0/Math.max(1,n-1)); for(let d=2.2;d<=len;d+=step) out.push({x:ox+Math.cos(a)*d,y:oy+Math.sin(a)*d,r,windup:wi,life:wi+.55,heat:8}); } break; }
    case 'cross': { const n=N(p,'n',4), len=N(p,'len',9), r=N(p,'r',1.2), off=rnd()*6.283; for(let i=0;i<n;i++){ const a=off+i/n*6.283; for(let d=2;d<=len;d+=1.7) out.push({x:ox+Math.cos(a)*d,y:oy+Math.sin(a)*d,r,windup:w+.1,life:w+2.4,heat:10}); } break; }
    case 'lanes': { const n=N(p,'n',5), gap=N(p,'gap',1), len=N(p,'len',12), sp=N(p,'space',2.4), r=N(p,'r',1.1); const open=Math.floor(rnd()*n); const px=-Math.sin(aim), py=Math.cos(aim); for(let i=0;i<n;i++){ if(i>=open&&i<open+gap) continue; const off=(i-(n-1)/2)*sp; for(let d=1.5;d<=len;d+=1.7) out.push({x:ox+Math.cos(aim)*d+px*off,y:oy+Math.sin(aim)*d+py*off,r,windup:w+.15,life:w+1.6,heat:8}); } break; }
    case 'spiral': { const n=N(p,'n',18), turns=N(p,'turns',1.6), rad=N(p,'rad',9), r=N(p,'r',1.3); const dir=rnd()<.5?1:-1, a0=rnd()*6.283; for(let i=0;i<n;i++){ const t=i/Math.max(1,n-1); const a=a0+dir*t*turns*6.283, d=2+t*(rad-2); out.push({x:ox+Math.cos(a)*d,y:oy+Math.sin(a)*d,r,windup:w+t*1.1,life:w+t*1.1+2.2,heat:8}); } break; }
  }
  return out;
}
/** arena = the boss zone tiles of the level (computed once per fight) */
export interface Arena { cx:number; cy:number; x0:number; y0:number; x1:number; y1:number; tiles:[number,number][]; maxR:number }
export function arenaOf(sim:any):Arena{ const L=sim.level; if(L._arena) return L._arena; const zi=L.zoneNames.indexOf('boss'); const tiles:[number,number][]=[]; let x0=1e9,y0=1e9,x1=-1,y1=-1;
  for(let y=1;y<L.h-1;y++)for(let x=1;x<L.w-1;x++){ if(L.solid[y*L.w+x]||L.zone[y*L.w+x]!==zi) continue; tiles.push([x,y]); if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  const cx=(x0+x1+1)/2, cy=(y0+y1+1)/2; let maxR=0; for(const [x,y] of tiles) maxR=Math.max(maxR,Math.hypot(x+.5-cx,y+.5-cy)); const a={cx,cy,x0,y0,x1,y1,tiles,maxR}; L._arena=a; return a; }

// ------------------------------------------------------------------ sim hooks ------------------------------------------------------------------
const rndOf=()=>Math.random;
/** called from Game.zonePattern for a boss move: spawns telegraphed zones; returns their positions (for the renderer's telegraph) */
export function movePattern(sim:any,e:any,a:string,tx:number,ty:number,dps:number,windup:number):{x:number;y:number}[]|null{
  const mv=MOVES[a]; if(!mv||mv.spec.k==='adds') return null;
  const aim=Math.atan2(ty-e.y,tx-e.x); const out=emitMove(sim,e,mv,aim,e.x,e.y,tx,ty,windup,dps);
  // echo: below echoAt of its HP a high-tier boss repeats every echoEvery-th zone move where you stand NOW, after echoDelay, with a full telegraph (same windup): keep moving, do not park in the gap
  if(mv.spec.k!=='fan'&&mv.spec.k!=='nova'){ const rt=e._rt, MX=HARD.mech, t=bossTierOf(e.type); if(t>=MX.echoMinTier&&e.hp<e.maxHp*MX.echoAt){ rt.echoN=(rt.echoN||0)+1; if(rt.echoN%MX.echoEvery===0){ rtQ(e,MX.echoDelay,()=>{ if(e.dead||sim.downed||sim.revealing) return; const ax=sim.px, ay=sim.py; emitMove(sim,e,mv,Math.atan2(ay-e.y,ax-e.x),e.x,e.y,ax,ay,windup,dps,e.type+':echo'); sim.fx.push({kind:'ring',x:e.x,y:e.y,r:2.6,t:0,life:.5,c:'#e8c46a'}); sim.emit('sfx','telegraph_elite'); }); } } }
  return out; }
/** Spawns the telegraphed ground shapes of one boss move. Each move kind has its own shape language, tinted with the boss's kit palette (src/boss_draw.ts):
 *  marks = target reticles, rain = falling shadows, spiral = numbered sigils, ring = annulus with a green gap, spokes = beams, cross/lanes = hazard-stripe strips, fan = firing cone, nova = gapped ring. */
function emitMove(sim:any,e:any,mv:any,aim:number,ox:number,oy:number,tx:number,ty:number,w:number,dps:number,src?:string):{x:number;y:number}[]{
  const k:MoveKind=mv.spec.k, p=mv.spec.p; const pal=palOf(e.type); const out:{x:number;y:number}[]=[]; const base:any={t:0,heat:8,pal,dps}; if(src) base.src=src; const rnd=rndOf();
  const Zp=(z:any)=>{ sim.zones.push({...base,...z}); };
  if(k==='fan'){ const sp=N(p,'spread',60)*D2R; Zp({x:ox,y:oy,r:12,shape:'cone',style:'fan',a:aim,len:12,arc:sp+.12,trackRt:e,windup:w,life:w+.08,dps:0,heat:0,kit:'move'}); return out; }
  if(k==='nova'){ const gap=N(p,'gap',0)*D2R; const g0=rnd()*6.283; e._rt.novaG0=g0; Zp({x:ox,y:oy,r:3.6,r0:2.6,shape:'ring',style:'gapring',gapA:g0,gapW:gap,windup:w,life:w+.08,dps:0,heat:0,kit:'move'}); return out; }
  if(k==='ring'){ const n=N(p,'n',10), gaps=N(p,'gaps',2), rad=N(p,'rad',5.5), r=N(p,'r',1.5); const g=Math.floor(rnd()*n); const gc=(g+(gaps-1)/2)/n*6.283; const gw=Math.max(.6,(gaps+1)/n*6.283-2*r/rad); Zp({x:ox,y:oy,r:rad+r,r0:rad-r,shape:'ring',style:'toll',gapA:gc,gapW:gw,windup:w+.4,life:w+6,heat:12}); out.push({x:ox,y:oy}); return out; }
  if(k==='spokes'){ const n=N(p,'n',7), len=N(p,'len',8), sw=N(p,'sweep',140)*D2R, r=N(p,'r',1.1); const dir=rnd()<.5?1:-1; for(let i=0;i<n;i++){ const a=aim-dir*sw/2+dir*sw*(i/Math.max(1,n-1)); const wi=w+i*(1.0/Math.max(1,n-1)); const x=ox+Math.cos(a)*2.2, y=oy+Math.sin(a)*2.2; Zp({x,y,a,len:len-2.2,w:2*r,shape:'line',style:'beam',windup:wi,life:wi+.55,burst:true,heat:8}); out.push({x,y}); } return out; }
  if(k==='cross'){ const n=N(p,'n',4), len=N(p,'len',9), r=N(p,'r',1.2), off=rnd()*6.283; for(let i=0;i<n;i++){ const a=off+i/n*6.283; const x=ox+Math.cos(a)*2, y=oy+Math.sin(a)*2; Zp({x,y,a,len:len-2,w:2*r,shape:'line',style:'stripe',windup:w+.1,life:w+2.4,heat:10}); out.push({x,y}); } return out; }
  if(k==='lanes'){ const n=N(p,'n',5), gap=N(p,'gap',1), len=N(p,'len',12), sp=N(p,'space',2.4), r=N(p,'r',1.1); const open=Math.floor(rnd()*n); const px=-Math.sin(aim), py=Math.cos(aim); for(let i=0;i<n;i++){ if(i>=open&&i<open+gap) continue; const off=(i-(n-1)/2)*sp; const x=ox+Math.cos(aim)*1.5+px*off, y=oy+Math.sin(aim)*1.5+py*off; if(sim.solidAt(x,y)) continue; Zp({x,y,a:aim,len:len-1.5,w:2*r,shape:'line',style:'stripe',windup:w+.15,life:w+1.6,heat:8}); out.push({x,y}); } return out; }
  const zs=patternZones(k,p,{ox,oy,aim,tx,ty,w,rnd}); const style=k==='marks'?'reticle':k==='rain'?'drop':'sigil'; zs.forEach((z,i)=>{ if(sim.solidAt(z.x,z.y)) return; out.push({x:z.x,y:z.y}); Zp({x:z.x,y:z.y,r:z.r,windup:z.windup,life:z.life,heat:z.heat,style,num:k==='spiral'?i+1:undefined}); });
  return out; }
const _tierOfBoss:Record<string,number>={}; export function bossTierOf(id:string):number{ if(_tierOfBoss[id]===undefined){ let t=0; for(const d of Object.values(DUNGEONS) as any[]) if(d.defaultBoss===id) t=d.tier||0; _tierOfBoss[id]=t; } return _tierOfBoss[id]; }
/** called from Game.resolveAttack for projectile / summon moves (zone moves already spawned at telegraph start). Returns true if handled. */
export function resolveMove(sim:any,e:any,a:string,tx:number,ty:number,dmg:number):boolean{
  const mv=MOVES[a]; if(!mv) return false; const p=mv.spec.p; const rt=e._rt; const aim=rt.ang;
  const proj=(ang:number,speed:number,ox=e.x,oy=e.y,off=.6)=>{ sim.projs.push({x:ox+Math.cos(ang)*off,y:oy+Math.sin(ang)*off,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,dmg,r:.22,life:1.7,faction:'enemy',kind:'bolt'}); };
  if(mv.spec.k==='fan'){ const n=N(p,'n',5), sp=N(p,'spread',60)*D2R, v=N(p,'speed',11); for(let i=0;i<n;i++) proj(aim-sp/2+sp*(n===1?.5:i/(n-1)),v); sim.emit('sfx','enemy_shot'); return true; }
  if(mv.spec.k==='nova'){ const n=N(p,'n',14), v=N(p,'speed',8), gap=N(p,'gap',0)*D2R; const g0=rt.novaG0??Math.random()*6.283; for(let i=0;i<n;i++){ const ang=i/n*6.283+g0; if(gap>0&&Math.abs(Math.atan2(Math.sin(ang-g0),Math.cos(ang-g0)))<gap/2) continue; proj(ang,v); } sim.fx.push({kind:'ring',x:e.x,y:e.y,r:2.2,t:0,life:.4,c:'#c8b070'}); sim.emit('sfx','enemy_shot'); return true; }
  if(mv.spec.k==='adds'){ spawnAdds(sim,e,String(p?.type||'worker'),N(p,'n',3),N(p,'cap',8)); return true; }
  return true; }
export function liveAdds(sim:any){ return sim.enemies.filter((o:any)=>!o.dead&&o.faction==='enemy'&&!(ENEMIES[o.type]||{}).boss&&!o.pylon); }
export function spawnAdds(sim:any,e:any,type:string,n:number,cap:number){ if(liveAdds(sim).length>=cap) return; for(let i=0;i<n;i++){ const aa=Math.random()*6.283, d=2.4+Math.random()*1.6; const x=e.x+Math.cos(aa)*d, y=e.y+Math.sin(aa)*d; if(sim.solidAt(x,y)||sim.circleHits(x,y,.4)) continue; const w=sim.spawnEnemy(type,x,y); w.alert=true; w.bossAdd=true; }
  sim.fx.push({kind:'ring',x:e.x,y:e.y,r:2.5,t:0,life:.5,c:'#8f8a74'}); }
export function freeTile(sim:any,ar:Arena,minD:number,from:{x:number;y:number},tries=40):{x:number;y:number}|null{ for(let k=0;k<tries;k++){ const [x,y]=ar.tiles[Math.floor(Math.random()*ar.tiles.length)]; if(Math.hypot(x+.5-from.x,y+.5-from.y)<minD) continue; if(sim.circleHits(x+.5,y+.5,.7)) continue; return {x:x+.5,y:y+.5}; } return null; }
let gimPal='amber'; const addZone=(sim:any,x:number,y:number,r:number,windup:number,life:number,dps:number,heat:number,style='drop')=>{ if(sim.solidAt(x,y)) return; sim.zones.push({x,y,r,t:0,life,dps,heat,windup,style,pal:gimPal}); };

export function applyAct(sim:any,e:any,act:PhaseAct){ const rt=e._rt; const def=ENEMIES[e.type];
  switch(act.k){
    case 'shield': rt.shield={hp:e.maxHp*act.pct,max:e.maxHp*act.pct,t:act.dur}; sim.fx.push({kind:'ring',x:e.x,y:e.y,r:3,t:0,life:.6,c:'#8fb8d8'}); break;
    case 'pylons': { const ar=arenaOf(sim); let made=0; for(let i=0;i<act.n;i++){ const t=freeTile(sim,ar,5,e); if(!t) continue; const p=sim.spawnEnemy(act.type,t.x,t.y); p.alert=true; p.bossAdd=true; p.pylon=true; p.maxHp=p.hp=Math.round(p.maxHp*(act.hp??3)); made++; sim.fx.push({kind:'ring',x:t.x,y:t.y,r:1.6,t:0,life:.6,c:'#e0c060'}); } if(made) sim.toast('Tether nodes online: destroy them to expose '+def.name+'.'); break; }
    case 'enrage': rt.spdMul=(rt.spdMul||1)*act.spd; rt.cdMul=(rt.cdMul||1)*act.cd; sim.fx.push({kind:'ring',x:e.x,y:e.y,r:4,t:0,life:.7,c:'#d85a3a'}); break;
    case 'adds': spawnAdds(sim,e,act.type,act.n,99); break;
    case 'gimmick': rt.gim=act.g; rt.gimT=act.g.every*.6; break; } }

/** epic gateway runs: the boss gets +30% HP once and an extra final phase (src/content/gateways.ts) */
function gwSpec(sim:any,e:any,spec:any){ if(!spec||!sim.dd?.gateway||!e.boss&&e.type!==sim.dd.defaultBoss) return spec; const rt=e._rt; if(!rt.gwHp){ rt.gwHp=1; if(!e.gwBuffed){ e.gwBuffed=1; e.maxHp*=GW_BOSS_HP; e.hp*=GW_BOSS_HP; } }
  return rt.gwSpec??=({ ...spec, phases:[...spec.phases.filter((p:any)=>p.at>.22),gwPhase(spec.summon,spec.gimmick)] }); }
/** per-frame boss logic: phase transitions, shield timer, tether line fx, enrage cooldown scaling, arena gimmick. Skipped during the reveal. */
export function bossTick(sim:any,e:any,dt:number){
  const spec=gwSpec(sim,e,BOSS_BY_ID[e.type]); if(!spec||e.dead) return; const rt=e._rt; if(rt.reveal>0||!e.alert) return;
  if(rt.gim===undefined){ if(!rt.mechInit){ rt.mechInit=1; const tc=HARD.mech.tierCd[bossTierOf(e.type)]||1; if(tc!==1) rt.cdMul=(rt.cdMul||1)/tc; }  rt.gim=spec.gimmick||null; rt.gimT=(spec.gimmick?.every||0)*.7; rt.q=[]; if(e.phase===undefined) e.phase=0; if(e.phase>0){ /* resumed mid-fight: re-apply passive phase acts that are not one-offs */ for(let i=0;i<e.phase;i++) for(const a of spec.phases[i].acts) if(a.k==='enrage'||a.k==='gimmick') applyAct(sim,e,a); } }
  const frac=e.hp/e.maxHp; const ph=spec.phases[e.phase||0];
  if(ph&&frac<=ph.at){ e.phase=(e.phase||0)+1; sim.toast(spec.name+': "'+ph.say+'"'); for(const a of ph.acts) applyAct(sim,e,a); }
  if(rt.cdMul&&rt.cdMul!==1){ const extra=dt*(1/rt.cdMul-1); for(const k in rt.acd) rt.acd[k]-=extra; }
  const sh=rt.shield; if(sh){ sh.t-=dt; if(sh.t<=0||sh.hp<=0){ rt.shield=null; if(sh.hp<=0){ rt.vuln=4; sim.toast('Shield broken: '+spec.name+' is staggered!'); sim.fx.push({kind:'ring',x:e.x,y:e.y,r:3.6,t:0,life:.5,c:'#e8d890'}); } } }
  const pyl=sim.enemies.filter((o:any)=>o.pylon&&!o.dead&&o.bossAdd).length; if(rt.pylPrev===undefined) rt.pylPrev=0;
  if(rt.pylPrev>0&&pyl===0){ rt.vuln=Math.max(rt.vuln||0,4); sim.toast('Tether broken: '+spec.name+' is exposed!'); } rt.pylPrev=pyl;
  if(pyl>0){ rt.tl=(rt.tl||0)-dt; if(rt.tl<=0){ rt.tl=.25; for(const o of sim.enemies) if(o.pylon&&!o.dead&&o.bossAdd){ const a=Math.atan2(o.y-e.y,o.x-e.x), L=Math.hypot(o.x-e.x,o.y-e.y); sim.fx.push({kind:'line',x:e.x,y:e.y,a,len:L,w:.1,t:0,life:.3,c:'#e0c060'}); } } }
  for(const j of rt.q){ j.t-=dt; } if(rt.q.length){ const due=rt.q.filter((j:any)=>j.t<=0); rt.q=rt.q.filter((j:any)=>j.t>0); for(const j of due) j.f(); }
  pressureTick(sim,e,dt);
  const g:Gimmick|null=rt.gim; if(g&&sim.zoneAt(sim.px,sim.py)==='boss'){ rt.gimT-=dt; if(rt.gimT<=0){ rt.gimT=g.every*(.85+Math.random()*.3); fireGimmick(sim,e,g); } } }
function fireGimmick(sim:any,e:any,g:Gimmick){ gimPal=palOf(e.type); const ar=arenaOf(sim); const dm=ENEMIES[e.type].dmgMul||1; const dps=11*dm;
  switch(g.k){
    case 'rain': for(let i=0;i<g.n;i++){ const near=Math.random()<.5; const a=Math.random()*6.283, rr=Math.random()*5; let x=near?sim.px+Math.cos(a)*rr:0, y=near?sim.py+Math.sin(a)*rr:0; if(!near){ const t=ar.tiles[Math.floor(Math.random()*ar.tiles.length)]; x=t[0]+.5; y=t[1]+.5; } addZone(sim,x,y,g.r,1.4+Math.random()*.4,2.6,dps,8); } break;
    case 'spokes': emitMove(sim,e,{spec:{k:'spokes',p:{n:9,len:g.len,sweep:300}}},Math.random()*6.283,ar.cx,ar.cy,sim.px,sim.py,1.3,dps); break;
    case 'pillarfire': { const ps=sim.level.props.filter((p:any)=>p.kind==='pillar'&&ar.tiles.some(t=>Math.abs(t[0]-p.x)<=1&&Math.abs(t[1]-p.y)<=1)); for(let i=0;i<Math.min(2,ps.length);i++){ const p=ps[Math.floor(Math.random()*ps.length)]; const px=p.x+.5, py=p.y+.5; sim.fx.push({kind:'ring',x:px,y:py,r:1.6,t:0,life:.9,c:'#d8b050'}); const dmg=dps*1.0; rtQ(e,.9,()=>{ if(e.dead) return; const g0=Math.random()*6.283; for(let k=0;k<g.n;k++){ const a=g0+k/g.n*6.283; sim.projs.push({x:px+Math.cos(a)*.95,y:py+Math.sin(a)*.95,vx:Math.cos(a)*7.5,vy:Math.sin(a)*7.5,dmg,r:.22,life:1.8,faction:'enemy',kind:'bolt'}); } sim.emit('sfx','enemy_shot'); }); } break; }
    case 'edge': for(let i=0;i<g.n;i++){ for(let k=0;k<30;k++){ const t=ar.tiles[Math.floor(Math.random()*ar.tiles.length)]; if(Math.hypot(t[0]+.5-ar.cx,t[1]+.5-ar.cy)<ar.maxR*.62) continue; addZone(sim,t[0]+.5,t[1]+.5,1.9,1.6,7,dps*.8,10,'rim'); break; } } break;
    case 'trickle': if(liveAdds(sim).length<g.cap){ const t=freeTile(sim,ar,6,{x:sim.px,y:sim.py}); if(t){ const w=sim.spawnEnemy(g.type,t.x,t.y); w.alert=true; w.bossAdd=true; sim.fx.push({kind:'ring',x:t.x,y:t.y,r:1.4,t:0,life:.5,c:'#8f8a74'}); } } break;
    case 'lanes': { const y=ar.y0+1+Math.random()*(ar.y1-ar.y0-1), gx=ar.x0+Math.random()*(ar.x1-ar.x0); for(const [xa,xb] of [[ar.x0,gx-2.6],[gx+2.6,ar.x1+1]]){ if(xb-xa<.8) continue; sim.zones.push({x:xa,y,a:0,len:xb-xa,w:2.2,shape:'line',style:'stripe',pal:gimPal,t:0,life:3.5,dps,heat:8,windup:1.5}); } break; } } }
export const rtQ=(e:any,t:number,f:()=>void)=>{ e._rt.q.push({t,f}); };
/** damage filter: shield absorbs, tether pylons cut damage by 90%. */
export function filterDamage(sim:any,e:any,dmg:number):number{ const rt=e._rt; if(!BOSS_BY_ID[e.type]){ /* batch-2 mobs: affix immunity + shield absorb (breaking a shield staggers) */ if(rt.immune>0) return 0; if(rt.shield&&rt.shield.hp>0){ rt.shield.hp-=dmg; if(rt.shield.hp<=0){ rt.shield=null; rt.vuln=Math.max(rt.vuln||0,2.5); sim.fx.push({kind:'ring',x:e.x,y:e.y,r:2.2,t:0,life:.4,c:'#e8d890'}); } return 0; } return ENEMIES[e.type]?.boss?kitFilter(sim,e,dmg):dmg; } if(rt.shield&&rt.shield.hp>0){ rt.shield.hp-=dmg; if(rt.shield.hp<=0){ rt.shield=null; rt.vuln=4; sim.toast('Shield broken: '+BOSS_BY_ID[e.type].name+' is staggered!'); sim.fx.push({kind:'ring',x:e.x,y:e.y,r:3.6,t:0,life:.5,c:'#e8d890'}); } return 0; }
  return kitFilter(sim,e,dmg); }
/** tether pylons cut damage by 90%, signature buff nodes by 45% (src/content/boss_kits.ts) */
function kitFilter(sim:any,e:any,dmg:number){ if(sim.enemies.some((o:any)=>o.pylon&&!o.dead&&o.bossAdd)) return dmg*.1; if(e._rt.kitBuf>0) return dmg*.55; return dmg; }
/** remove pylons/adds spawned by a boss (reset, restart, death) */
export function clearBossAdds(sim:any,killDead=true){ for(const o of sim.enemies) if(o.bossAdd&&!o.dead){ o.dead=true; o.hp=0; } if(sim.inst) sim.inst.enemies=sim.inst.enemies.filter((o:any)=>!(o.bossAdd&&killDead)); sim.enemies=sim.enemies.filter((o:any)=>!o.bossAdd); }
/** A one-line HUD-ready status for the boss (shield / tether), used by tests and the boss bar if wanted */

/** Boss pressure (HARD.press): camping next to the boss triggers a quake ring + knockback, a hazard is placed under the player on a timer so standing still is punished,
 *  reinforcements arrive, and after enrageAt seconds damage and tempo ramp. All telegraphed (zone windup) so dodging/moving/abilities beat it. */
/** original (pre-batch) bosses have no phase spec: they still get the stand-still punishers (camp quake + hazard under the player), without enrage or adds. */
export function bossStillTick(sim:any,e:any,dt:number){ const rt=e._rt; rt.q??=[]; for(const j of rt.q) j.t-=dt; if(rt.q.length){ const due=rt.q.filter((j:any)=>j.t<=0); rt.q=rt.q.filter((j:any)=>j.t>0); for(const j of due) j.f(); } pressureTick(sim,e,dt,true); }
function pressureTick(sim:any,e:any,dt:number,lite=false){ const P=HARD.press, rt=e._rt, def=ENEMIES[e.type]; if(sim.downed||sim.revealing||e.dead) return;
  const dm=(def.dmgMul||1); const d=Math.hypot(sim.px-e.x,sim.py-e.y); rt.fightT=(rt.fightT||0)+dt;
  // enrage ramp
  if(!lite&&rt.fightT>P.enrageAt){ const k=Math.min(P.enrageMax,1+(rt.fightT-P.enrageAt)*P.enrageRamp); if(!rt.enraged){ rt.enraged=true; sim.toast(def.name+' is enraged!'); sim.fx.push({kind:'ring',x:e.x,y:e.y,r:4.5,t:0,life:.8,c:'#d85a3a'}); } rt.hardDmg=k; rt.hardCd=k; } 
  const cdk=rt.hardCd||1; if(cdk>1){ const extra=dt*(1-1/(1+(cdk-1)*.6)); for(const k in rt.acd) rt.acd[k]-=extra; }
  // camping next to the boss
  rt.quakeCd=(rt.quakeCd||0)-dt; if(d<def.radius+P.campR) rt.camp=(rt.camp||0)+dt; else rt.camp=Math.max(0,(rt.camp||0)-dt*2);
  const early=lite||(sim.earlyMul?.()??1)<1;
  if(!lite&&rt.camp>=P.campT&&rt.quakeCd<=0){ rt.camp=0; rt.quakeCd=P.quakeCd; const R=def.radius+P.quakeR; sim.zones.push({x:e.x,y:e.y,r:R,t:0,life:P.quakeWind+.6,dps:P.quakeDmg*sim.maxHp*(rt.hardDmg||1),heat:12,windup:P.quakeWind,src:e.type+':quake',style:'quake',pal:palOf(e.type)}); sim.emit('sfx','telegraph_elite');
    rtQ(e,P.quakeWind,()=>{ if(e.dead||sim.downed) return; if(Math.hypot(sim.px-e.x,sim.py-e.y)<R){ const a=Math.atan2(sim.py-e.y,sim.px-e.x); sim.slideFx=Math.cos(a)*P.quakePush/.15; sim.slideFy=Math.sin(a)*P.quakePush/.15; sim.slideT=.15; sim.fx.push({kind:'ring',x:e.x,y:e.y,r:R,t:0,life:.4,c:'#e8d890'}); } }); }
  // a hazard under the player, so passivity is punished
  const hurt=e.hp<e.maxHp*.5; rt.underT=(rt.underT===undefined?P.underEvery*.6:rt.underT)-dt/(hurt?1.4:1)/(rt.hardCd||1)*(HARD.mech.tierUnder[bossTierOf(e.type)]||1);
  /* stand-still rule: a player who has not moved for 1.5 s gets hazards twice as often and 1.7x as hard; a moving player only sees the normal cadence */ { const mv=Math.hypot(sim.px-(rt.lpx??sim.px),sim.py-(rt.lpy??sim.py)); rt.lpx=sim.px; rt.lpy=sim.py; rt.stillT=mv>.02?0:(rt.stillT||0)+dt; if(rt.stillT>1.5) rt.underT-=dt; } const still=rt.stillT>1.5;
  /* original + early-band bosses: rarer, shorter hazard (forgiving, not free) */ if(rt.underT<=0){ rt.underT=P.underEvery*(early?1.6:1)*(.85+Math.random()*.3); if(d<30) sim.zones.push({x:sim.px,y:sim.py,r:P.underR,t:0,life:P.underWind+(early?.6:(P.underLinger??.6)),dps:P.underDmg*(still?1.7:1)*sim.maxHp*(rt.hardDmg||1),heat:8,windup:P.underWind,src:e.type+':hazard',style:'reticle',pal:palOf(e.type)}); }
  // reinforcements: flanking ranged adds
  if(lite) return; rt.addsT=(rt.addsT===undefined?P.addsEvery*.5:rt.addsT)-dt; if(rt.addsT<=0){ rt.addsT=P.addsEvery; if(ENEMIES[P.addsType]) spawnAdds(sim,e,P.addsType,P.addsN,P.addsCap); } }
