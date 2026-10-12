// Shaped ground zones for boss telegraphs (docs/BOSSES.md). A Zone is still the same {x,y,r,t,life,dps,heat,windup} record the sim has always used;
// the optional fields below give it a shape (line / cone / annulus-with-gap / tile / arena-wide "safe circles"), motion (spin, drift + bounce, follow the boss),
// a force (pull / push / conveyor) and a one-shot burst hit. Pure data + geometry, no sim imports, so src/sim.ts, src/core/party.ts (server host) and the
// renderer (src/boss_draw.ts) share exactly one definition of "is this point inside the telegraph".
export type ZShape='disc'|'line'|'cone'|'ring'|'tile'|'safe'|'ghost';
export interface ZX {
  shape?:ZShape; style?:string; pal?:string; kit?:string; label?:string; num?:number;
  /** line: from (x,y) along angle a for len, width w. cone: from (x,y) along a, radius len, total arc. ring: outer radius r, inner r0, gap centred on gapA (width gapW) is SAFE. tile: square half-size r. safe: arena disc radius r, safe circles in `safe` */
  a?:number; len?:number; w?:number; arc?:number; r0?:number; gapA?:number; gapW?:number; safe?:{x:number;y:number;r:number}[];
  /** a: radians/s after the windup (beams, scythes); sweep: total angle the spin covers (draw hint); grow: ring radius growth /s; vx,vy: drift tiles/s; bounces: wall bounces left */
  spin?:number; sweep?:number; grow?:number; vx?:number; vy?:number; bounces?:number; follow?:{x:number;y:number;dead?:boolean}|null;
  /** forces while the telegraph is live: pull>0 toward (x,y), <0 away; push moves along pushA (conveyor), tiles/s */
  pull?:number; push?:number; pushA?:number;
  /** burst: one hit on first contact after the windup (per target) instead of a damage tick every .5 s. heatOnly: heat, no hp damage */
  burst?:boolean; heatOnly?:boolean; hitSet?:Set<any>; fired?:boolean; ended?:boolean;
  onFire?:(sim:any,z:any)=>void; onEnd?:(sim:any,z:any)=>void; link?:{x:number;y:number}|null; freeze?:number; track?:'aim'|'ray'|null; trackRt?:any; path?:{x:number;y:number}[]; rearm?:number; rt2?:number; onBounce?:(sim:any,z:any)=>void; R?:number; dir?:number; keepIn?:boolean;
}
const TAU=Math.PI*2; const angDiff=(a:number,b:number)=>{ let d=(a-b)%TAU; if(d>Math.PI) d-=TAU; if(d<-Math.PI) d+=TAU; return Math.abs(d); };
/** is a player body at (x,y) inside the zone's damaging shape? (pad = body radius allowance, small so edges favour the player) */
export function zoneInside(z:any,x:number,y:number,pad=.08):boolean{
  const dx=x-z.x, dy=y-z.y;
  switch(z.shape){
    case 'line': { const ca=Math.cos(z.a||0), sa=Math.sin(z.a||0); const u=dx*ca+dy*sa, v=-dx*sa+dy*ca; return u>=-pad&&u<=(z.len||0)+pad&&Math.abs(v)<=(z.w||1)/2+pad; }
    case 'cone': { const d=Math.hypot(dx,dy); if(d>(z.len||z.r)+pad) return false; return d<.4||angDiff(Math.atan2(dy,dx),z.a||0)<=(z.arc||1)/2; }
    case 'ring': { const d=Math.hypot(dx,dy); if(d>z.r+pad||d<(z.r0||0)-pad) return false; if(z.gapW&&angDiff(Math.atan2(dy,dx),z.gapA||0)<=z.gapW/2) return false; return true; }
    case 'tile': return Math.abs(dx)<z.r&&Math.abs(dy)<z.r;
    case 'safe': { if(Math.hypot(dx,dy)>z.r) return false; for(const s of z.safe||[]) if(Math.hypot(x-s.x,y-s.y)<s.r) return false; return true; }
    case 'ghost': return false;
    default: return Math.hypot(dx,dy)<z.r;
  } }
/** length of a straight ray from (x,y) along a until a wall or prop collider (the line-of-sight rule for gaze beams: hide behind pillars) */
export function rayLen(sim:any,x:number,y:number,a:number,max:number):number{ const ca=Math.cos(a), sa=Math.sin(a); for(let d=.5;d<max;d+=.25){ const px=x+ca*d, py=y+sa*d; if(sim.solidAt(px,py)||sim.circleHits(px,py,.12)) return Math.max(.5,d-.25); } return max; }
/** advance motion (follow / spin / drift+bounce / ring growth). dt in seconds. Called once per zone per sim step (sim.updateZones and the party host). */
export function stepZone(sim:any,z:any,dt:number){
  if(z.follow){ if(z.follow.dead){ z.life=Math.min(z.life,z.t); } else { z.x=z.follow.x; z.y=z.follow.y; } }
  if(z.trackRt&&z.t<z.windup) z.a=z.trackRt._rt.ang;
  if(z.track&&z.t<z.windup-(z.freeze??.4)){ z.a=Math.atan2(sim.py-z.y,sim.px-z.x); if(z.track==='ray') z.len=rayLen(sim,z.x,z.y,z.a,z.R||15); }
  if(z.t<z.windup) return;
  if(z.spin) z.a=(z.a||0)+z.spin*dt;
  if(z.grow){ z.r+=z.grow*dt; if(z.shape==='ring'&&z.r0!==undefined) z.r0+=z.grow*dt; }
  if(z.vx||z.vy){ const nx=z.x+z.vx*dt, ny=z.y+z.vy*dt; let bx=false, by=false; if(sim.solidAt(nx,z.y)) bx=true; if(sim.solidAt(z.x,ny)) by=true; if(sim.solidAt(nx,ny)&&!bx&&!by){ bx=true; by=true; }
    if(bx||by){ if(bx) z.vx=-z.vx; if(by) z.vy=-z.vy; z.bounces=(z.bounces??0)-1; if(z.bounces<0){ z.life=Math.min(z.life,z.t+.25); z.vx=0; z.vy=0; } if(z.onBounce) z.onBounce(sim,z); } else { z.x=nx; z.y=ny; } }
}
/** one zone for one step: motion, one-time onFire, forces and damage on the given targets. `targets` are {px,py,g(game-like with heat, zoneTick, moveCircle), hurt(dmg,sx,sy)}. */
export function tickZone(sim:any,z:any,dt:number,targets:{px:number;py:number;g:any;hurt:(d:number,sx:number,sy:number)=>void}[],heatMax:number,bodyR:number){
  z.t+=dt; stepZone(sim,z,dt); if(z.t<z.windup) return;
  if(!z.fired){ z.fired=true; if(z.onFire) z.onFire(sim,z); }
  for(const tg of targets){ const g=tg.g; if(!zoneInside(z,tg.px,tg.py)) continue;
    if(z.pull||z.push){ let mx=0,my=0; if(z.pull){ const d=Math.hypot(z.x-tg.px,z.y-tg.py)||1; mx=(z.x-tg.px)/d*z.pull*dt; my=(z.y-tg.py)/d*z.pull*dt; if(z.pull>0&&d<.5){ mx*=d/.5; my*=d/.5; } } if(z.push){ mx+=Math.cos(z.pushA||0)*z.push*dt; my+=Math.sin(z.pushA||0)*z.push*dt; } if(g.moveCircle&&(mx||my)){ const p=g.moveCircle(tg.px,tg.py,mx,my,bodyR); if(!(z.keepIn&&g.zoneAt&&g.zoneAt(p.x,p.y)!=='boss')){ g.px=p.x; g.py=p.y; } } }
    if(z.heat&&g.heat!==undefined) g.heat=Math.min(heatMax,g.heat+z.heat*dt);
    if(!(z.dps>0)||z.heatOnly) continue;
    if(z.burst){ if(z.rearm){ z.rt2=(z.rt2||0)+dt/Math.max(1,targets.length); if(z.rt2>z.rearm){ z.rt2=0; z.hitSet?.clear(); } } const hs=z.hitSet||(z.hitSet=new Set()); if(!hs.has(g)){ hs.add(g); tg.hurt(z.dps,z.x,z.y); } }
    else { g.zoneTick=(g.zoneTick||0)+dt; if(g.zoneTick>.5){ g.zoneTick=0; tg.hurt(z.dps,z.x,z.y); } } }
}
/** call after the per-step filter: fire onEnd for zones that just expired */
export function endZones(sim:any,zs:any[]){ for(const z of zs) if(z.t>=z.life&&!z.ended){ z.ended=true; if(z.onEnd) z.onEnd(sim,z); } }
