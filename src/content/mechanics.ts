// Reusable boss mechanics toolkit (docs/CONTENT_BATCH_1.md section 2). Bosses are DATA (batch1_bosses.ts): lists of moves, phase actions and an
// arena gimmick that this module turns into ATK entries and runtime behaviour. The sim only calls the hooks at the bottom of this file.
import { BOSS_BY_ID } from './batch1_bosses';
import type { MoveSpec, MoveKind, PhaseAct, Gimmick } from './batch1_bosses';

import { MOVES, MOVE_ATK, MOVE_DMG } from './boss_moves';
export { MOVES, MOVE_ATK, MOVE_DMG };
import { ENEMIES } from '../config';
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
  const mv=MOVES[a]; if(!mv) return null; if(mv.spec.k==='fan'||mv.spec.k==='nova'||mv.spec.k==='adds') return null;
  const aim=Math.atan2(ty-e.y,tx-e.x); const zs=patternZones(mv.spec.k,mv.spec.p,{ox:e.x,oy:e.y,aim,tx,ty,w:windup,rnd:rndOf()}); const out:{x:number;y:number}[]=[];
  for(const z of zs){ if(sim.solidAt(z.x,z.y)) continue; out.push({x:z.x,y:z.y}); sim.zones.push({x:z.x,y:z.y,r:z.r,t:0,life:z.life,dps,heat:z.heat,windup:z.windup}); }
  return out; }
/** called from Game.resolveAttack for projectile / summon moves (zone moves already spawned at telegraph start). Returns true if handled. */
export function resolveMove(sim:any,e:any,a:string,tx:number,ty:number,dmg:number):boolean{
  const mv=MOVES[a]; if(!mv) return false; const p=mv.spec.p; const rt=e._rt; const aim=rt.ang;
  const proj=(ang:number,speed:number,ox=e.x,oy=e.y,off=.6)=>{ sim.projs.push({x:ox+Math.cos(ang)*off,y:oy+Math.sin(ang)*off,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,dmg,r:.22,life:1.7,faction:'enemy',kind:'bolt'}); };
  if(mv.spec.k==='fan'){ const n=N(p,'n',5), sp=N(p,'spread',60)*D2R, v=N(p,'speed',11); for(let i=0;i<n;i++) proj(aim-sp/2+sp*(n===1?.5:i/(n-1)),v); sim.emit('sfx','enemy_shot'); return true; }
  if(mv.spec.k==='nova'){ const n=N(p,'n',14), v=N(p,'speed',8), gap=N(p,'gap',0)*D2R; const g0=Math.random()*6.283; for(let i=0;i<n;i++){ const ang=i/n*6.283+g0; if(gap>0&&Math.abs(Math.atan2(Math.sin(ang-g0),Math.cos(ang-g0)))<gap/2) continue; proj(ang,v); } sim.fx.push({kind:'ring',x:e.x,y:e.y,r:2.2,t:0,life:.4,c:'#c8b070'}); sim.emit('sfx','enemy_shot'); return true; }
  if(mv.spec.k==='adds'){ spawnAdds(sim,e,String(p?.type||'worker'),N(p,'n',3),N(p,'cap',8)); return true; }
  return true; }
function liveAdds(sim:any){ return sim.enemies.filter((o:any)=>!o.dead&&o.faction==='enemy'&&!(ENEMIES[o.type]||{}).boss&&!o.pylon); }
function spawnAdds(sim:any,e:any,type:string,n:number,cap:number){ if(liveAdds(sim).length>=cap) return; for(let i=0;i<n;i++){ const aa=Math.random()*6.283, d=2.4+Math.random()*1.6; const x=e.x+Math.cos(aa)*d, y=e.y+Math.sin(aa)*d; if(sim.solidAt(x,y)||sim.circleHits(x,y,.4)) continue; const w=sim.spawnEnemy(type,x,y); w.alert=true; w.bossAdd=true; }
  sim.fx.push({kind:'ring',x:e.x,y:e.y,r:2.5,t:0,life:.5,c:'#8f8a74'}); }
function freeTile(sim:any,ar:Arena,minD:number,from:{x:number;y:number},tries=40):{x:number;y:number}|null{ for(let k=0;k<tries;k++){ const [x,y]=ar.tiles[Math.floor(Math.random()*ar.tiles.length)]; if(Math.hypot(x+.5-from.x,y+.5-from.y)<minD) continue; if(sim.circleHits(x+.5,y+.5,.7)) continue; return {x:x+.5,y:y+.5}; } return null; }
const addZone=(sim:any,x:number,y:number,r:number,windup:number,life:number,dps:number,heat:number)=>{ if(sim.solidAt(x,y)) return; sim.zones.push({x,y,r,t:0,life,dps,heat,windup}); };

function applyAct(sim:any,e:any,act:PhaseAct){ const rt=e._rt; const def=ENEMIES[e.type];
  switch(act.k){
    case 'shield': rt.shield={hp:e.maxHp*act.pct,max:e.maxHp*act.pct,t:act.dur}; sim.fx.push({kind:'ring',x:e.x,y:e.y,r:3,t:0,life:.6,c:'#8fb8d8'}); break;
    case 'pylons': { const ar=arenaOf(sim); let made=0; for(let i=0;i<act.n;i++){ const t=freeTile(sim,ar,5,e); if(!t) continue; const p=sim.spawnEnemy(act.type,t.x,t.y); p.alert=true; p.bossAdd=true; p.pylon=true; p.maxHp=p.hp=Math.round(p.maxHp*3); made++; sim.fx.push({kind:'ring',x:t.x,y:t.y,r:1.6,t:0,life:.6,c:'#e0c060'}); } if(made) sim.toast('Tether nodes online: destroy them to expose '+def.name+'.'); break; }
    case 'enrage': rt.spdMul=(rt.spdMul||1)*act.spd; rt.cdMul=(rt.cdMul||1)*act.cd; sim.fx.push({kind:'ring',x:e.x,y:e.y,r:4,t:0,life:.7,c:'#d85a3a'}); break;
    case 'adds': spawnAdds(sim,e,act.type,act.n,99); break;
    case 'gimmick': rt.gim=act.g; rt.gimT=act.g.every*.6; break; } }

/** per-frame boss logic: phase transitions, shield timer, tether line fx, enrage cooldown scaling, arena gimmick. Skipped during the reveal. */
export function bossTick(sim:any,e:any,dt:number){
  const spec=BOSS_BY_ID[e.type]; if(!spec||e.dead) return; const rt=e._rt; if(rt.reveal>0||!e.alert) return;
  if(rt.gim===undefined){ rt.gim=spec.gimmick||null; rt.gimT=(spec.gimmick?.every||0)*.7; rt.q=[]; if(e.phase===undefined) e.phase=0; if(e.phase>0){ /* resumed mid-fight: re-apply passive phase acts that are not one-offs */ for(let i=0;i<e.phase;i++) for(const a of spec.phases[i].acts) if(a.k==='enrage'||a.k==='gimmick') applyAct(sim,e,a); } }
  const frac=e.hp/e.maxHp; const ph=spec.phases[e.phase||0];
  if(ph&&frac<=ph.at){ e.phase=(e.phase||0)+1; sim.toast(spec.name+': "'+ph.say+'"'); for(const a of ph.acts) applyAct(sim,e,a); }
  if(rt.cdMul&&rt.cdMul!==1){ const extra=dt*(1/rt.cdMul-1); for(const k in rt.acd) rt.acd[k]-=extra; }
  const sh=rt.shield; if(sh){ sh.t-=dt; if(sh.t<=0||sh.hp<=0){ rt.shield=null; if(sh.hp<=0){ rt.vuln=4; sim.toast('Shield broken: '+spec.name+' is staggered!'); sim.fx.push({kind:'ring',x:e.x,y:e.y,r:3.6,t:0,life:.5,c:'#e8d890'}); } } }
  const pyl=sim.enemies.filter((o:any)=>o.pylon&&!o.dead&&o.bossAdd).length; if(rt.pylPrev===undefined) rt.pylPrev=0;
  if(rt.pylPrev>0&&pyl===0){ rt.vuln=Math.max(rt.vuln||0,4); sim.toast('Tether broken: '+spec.name+' is exposed!'); } rt.pylPrev=pyl;
  if(pyl>0){ rt.tl=(rt.tl||0)-dt; if(rt.tl<=0){ rt.tl=.25; for(const o of sim.enemies) if(o.pylon&&!o.dead&&o.bossAdd){ const a=Math.atan2(o.y-e.y,o.x-e.x), L=Math.hypot(o.x-e.x,o.y-e.y); sim.fx.push({kind:'line',x:e.x,y:e.y,a,len:L,w:.1,t:0,life:.3,c:'#e0c060'}); } } }
  for(const j of rt.q){ j.t-=dt; } if(rt.q.length){ const due=rt.q.filter((j:any)=>j.t<=0); rt.q=rt.q.filter((j:any)=>j.t>0); for(const j of due) j.f(); }
  const g:Gimmick|null=rt.gim; if(g&&sim.zoneAt(sim.px,sim.py)==='boss'){ rt.gimT-=dt; if(rt.gimT<=0){ rt.gimT=g.every*(.85+Math.random()*.3); fireGimmick(sim,e,g); } } }
function fireGimmick(sim:any,e:any,g:Gimmick){ const ar=arenaOf(sim); const dm=ENEMIES[e.type].dmgMul||1; const dps=11*dm;
  switch(g.k){
    case 'rain': for(let i=0;i<g.n;i++){ const near=Math.random()<.5; const a=Math.random()*6.283, rr=Math.random()*5; let x=near?sim.px+Math.cos(a)*rr:0, y=near?sim.py+Math.sin(a)*rr:0; if(!near){ const t=ar.tiles[Math.floor(Math.random()*ar.tiles.length)]; x=t[0]+.5; y=t[1]+.5; } addZone(sim,x,y,g.r,1.4+Math.random()*.4,2.6,dps,8); } break;
    case 'spokes': for(const z of patternZones('spokes',{n:9,len:g.len,sweep:300},{ox:ar.cx,oy:ar.cy,aim:Math.random()*6.283,tx:sim.px,ty:sim.py,w:1.3,rnd:Math.random})) addZone(sim,z.x,z.y,z.r,z.windup,z.life,dps,z.heat); break;
    case 'pillarfire': { const ps=sim.level.props.filter((p:any)=>p.kind==='pillar'&&ar.tiles.some(t=>Math.abs(t[0]-p.x)<=1&&Math.abs(t[1]-p.y)<=1)); for(let i=0;i<Math.min(2,ps.length);i++){ const p=ps[Math.floor(Math.random()*ps.length)]; const px=p.x+.5, py=p.y+.5; sim.fx.push({kind:'ring',x:px,y:py,r:1.6,t:0,life:.9,c:'#d8b050'}); const dmg=dps*1.0; rtQ(e,.9,()=>{ if(e.dead) return; const g0=Math.random()*6.283; for(let k=0;k<g.n;k++){ const a=g0+k/g.n*6.283; sim.projs.push({x:px+Math.cos(a)*.95,y:py+Math.sin(a)*.95,vx:Math.cos(a)*7.5,vy:Math.sin(a)*7.5,dmg,r:.22,life:1.8,faction:'enemy',kind:'bolt'}); } sim.emit('sfx','enemy_shot'); }); } break; }
    case 'edge': for(let i=0;i<g.n;i++){ for(let k=0;k<30;k++){ const t=ar.tiles[Math.floor(Math.random()*ar.tiles.length)]; if(Math.hypot(t[0]+.5-ar.cx,t[1]+.5-ar.cy)<ar.maxR*.62) continue; addZone(sim,t[0]+.5,t[1]+.5,1.9,1.6,7,dps*.8,10); break; } } break;
    case 'trickle': if(liveAdds(sim).length<g.cap){ const t=freeTile(sim,ar,6,{x:sim.px,y:sim.py}); if(t){ const w=sim.spawnEnemy(g.type,t.x,t.y); w.alert=true; w.bossAdd=true; sim.fx.push({kind:'ring',x:t.x,y:t.y,r:1.4,t:0,life:.5,c:'#8f8a74'}); } } break;
    case 'lanes': { const y=ar.y0+1+Math.random()*(ar.y1-ar.y0-1), gx=ar.x0+Math.random()*(ar.x1-ar.x0); for(let x=ar.x0;x<=ar.x1+1;x+=1.8){ if(Math.abs(x-gx)<2.6) continue; addZone(sim,x,y,1.1,1.5,2.0,dps,8); } break; } } }
const rtQ=(e:any,t:number,f:()=>void)=>{ e._rt.q.push({t,f}); };
/** damage filter: shield absorbs, tether pylons cut damage by 90%. */
export function filterDamage(sim:any,e:any,dmg:number):number{ if(!BOSS_BY_ID[e.type]) return dmg; const rt=e._rt; if(rt.shield&&rt.shield.hp>0){ rt.shield.hp-=dmg; if(rt.shield.hp<=0){ rt.shield=null; rt.vuln=4; sim.toast('Shield broken: '+BOSS_BY_ID[e.type].name+' is staggered!'); sim.fx.push({kind:'ring',x:e.x,y:e.y,r:3.6,t:0,life:.5,c:'#e8d890'}); } return 0; }
  if(sim.enemies.some((o:any)=>o.pylon&&!o.dead&&o.bossAdd)) return dmg*.1; return dmg; }
/** remove pylons/adds spawned by a boss (reset, restart, death) */
export function clearBossAdds(sim:any,killDead=true){ for(const o of sim.enemies) if(o.bossAdd&&!o.dead){ o.dead=true; o.hp=0; } if(sim.inst) sim.inst.enemies=sim.inst.enemies.filter((o:any)=>!(o.bossAdd&&killDead)); sim.enemies=sim.enemies.filter((o:any)=>!o.bossAdd); }
/** A one-line HUD-ready status for the boss (shield / tether), used by tests and the boss bar if wanted */
export function bossStatus(sim:any,e:any):string{ const rt=e._rt; const bits:string[]=[]; if(rt.shield&&rt.shield.hp>0) bits.push('Shielded'); if(sim.enemies.some((o:any)=>o.pylon&&!o.dead)) bits.push('Tethered'); if(rt.vuln>0) bits.push('Staggered'); if(rt.spdMul>1) bits.push('Enraged'); return bits.join(' / '); }
