// Seeded procedural dungeon layouts. Every generator is a pure function of (seed): the same seed always rebuilds the same level
// (instance resume / checkpoint restart rebuild from inst.seed). A level is only returned when validate() passes, otherwise the
// seed is perturbed deterministically and generation retried. See docs/MAP_GENERATION.md.
import { ZONES } from '../level';
import type { Level, Zone, Interact, Prop, DoorDef, SpawnDef, Hazard } from '../level';
import { ENEMIES } from '../config';

export const rngOf=(seed:number)=>{ let a=seed>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; };
const ZI=(z:Zone)=>ZONES.indexOf(z);
/** Same clearance classes as Game.flowCls / FLOW_R in sim.ts. */
export const FLOW_R=[0,.7,1.1];
export const clsOf=(r:number)=>r<=.5?0:r<=.72?1:2;

/** circle (tile centre, radius R) vs solid tiles; out of bounds counts as solid. */
export function clrAt(w:number,h:number,sol:Uint8Array,x:number,y:number,R:number){
  if(x<0||y<0||x>=w||y>=h||sol[y*w+x]) return false; if(R<=0) return true; const cx=x+.5, cy=y+.5;
  for(let iy=Math.floor(cy-R);iy<=Math.floor(cy+R);iy++)for(let ix=Math.floor(cx-R);ix<=Math.floor(cx+R);ix++){ const solid=ix<0||iy<0||ix>=w||iy>=h||sol[iy*w+ix]; if(!solid) continue; const nx=Math.min(Math.max(cx,ix),ix+1), ny=Math.min(Math.max(cy,iy),iy+1); if((cx-nx)**2+(cy-ny)**2<R*R-1e-6) return false; }
  return true;
}
/** Walkable tiles reachable from `from` (4-neighbour, like the game's flow field) for clearance class `cls`, with all doors open. */
export function reachMap(L:Pick<Level,'w'|'h'|'solid'|'doors'>,from:{x:number;y:number},cls:number):Uint8Array{
  const {w,h}=L; const sol=new Uint8Array(L.solid); for(const d of L.doors) for(const [x,y] of d.tiles) sol[y*w+x]=0;
  const R=FLOW_R[cls]; const ok=new Uint8Array(w*h); for(let y=0;y<h;y++)for(let x=0;x<w;x++) ok[y*w+x]=clrAt(w,h,sol,x,y,R)?1:0;
  const seen=new Uint8Array(w*h); const sx=Math.floor(from.x), sy=Math.floor(from.y); const q=[sy*w+sx]; seen[q[0]]=1;
  while(q.length){ const c=q.pop()!; const cx=c%w, cy=(c/w)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h) continue; const i=ny*w+nx; if(seen[i]||sol[i]) continue; if(!ok[i]&&!(Math.abs(nx-sx)<=2&&Math.abs(ny-sy)<=2)) continue; seen[i]=1; q.push(i); } }
  return seen;
}
/** Structural check used by the generator (retry) and by tests. Returns a list of problems (empty = valid). */
export function validate(L:Level):string[]{
  const bad:string[]=[]; const {w}=L; const tile=(p:{x:number;y:number})=>Math.floor(p.y)*w+Math.floor(p.x);
  const r=[0,1,2].map(c=>reachMap(L,L.spawn,c));
  for(const i of L.interacts) if(!r[0][tile(i)]) bad.push('interact '+i.id);
  for(const c of L.checkpoints) if(!r[0][tile(c)]) bad.push('checkpoint '+c.id);
  for(const id of ['hackproc','controller','cratechip',...(L.kind==='annex'?['terminal','armoryfuse']:(L as any).noConds?[]:['cond_A','cond_B'])]) if(!L.interacts.some(i=>i.id===id)) bad.push('missing '+id);
  for(const s of L.spawns){ const c=clsOf(ENEMIES[s.type]?.radius??.4); if(!r[c][s.y*w+s.x]) bad.push('spawn '+s.type+'@'+s.x+','+s.y); }
  if(!r[2][tile(L.bossSpawn)]) bad.push('boss spawn not reachable at boss clearance');
  if(!r[0][tile(L.salvage)]) bad.push('salvage');
  for(const h of L.hazards||[]) if(L.solid[Math.floor(h.y)*w+Math.floor(h.x)]) bad.push('hazard in wall');
  return bad;
}

export class Gen{
  solid:Uint8Array; zone:Uint8Array; keep:Uint8Array; pm:Uint8Array; props:Prop[]=[]; spawns:SpawnDef[]=[]; interacts:Interact[]=[]; doors:DoorDef[]=[]; hazards:Hazard[]=[]; gid=0; r:()=>number; sx=0; sy=0;
  constructor(public w:number,public h:number,public seed:number){ this.solid=new Uint8Array(w*h).fill(1); this.zone=new Uint8Array(w*h); this.keep=new Uint8Array(w*h); this.pm=new Uint8Array(w*h); this.r=rngOf(seed); }
  static from(L:Level,seed:number){ const g=new Gen(L.w,L.h,seed); g.solid=new Uint8Array(L.solid); g.zone=new Uint8Array(L.zone); g.doors=L.doors.map(d=>({...d,tiles:d.tiles.map(t=>[...t] as [number,number])})); g.interacts=L.interacts.map(i=>({...i})); g.spawns=L.spawns.map(s=>({...s})); g.props=L.props.map(p=>({...p})); g.sx=L.spawn.x; g.sy=L.spawn.y; return g; }
  ri(a:number,b:number){ return a+Math.floor(this.r()*(b-a+1)); }
  pick<T>(a:T[]):T{ return a[Math.floor(this.r()*a.length)]; }
  shuffle<T>(a:T[]):T[]{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(this.r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  inb(x:number,y:number){ return x>=0&&y>=0&&x<this.w&&y<this.h; }
  carve(x0:number,y0:number,x1:number,y1:number,z:Zone){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){ this.solid[y*this.w+x]=0; this.zone[y*this.w+x]=ZI(z); } }
  zoneRect(x0:number,y0:number,x1:number,y1:number,z:Zone){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) if(!this.solid[y*this.w+x]) this.zone[y*this.w+x]=ZI(z); }
  reserve(x0:number,y0:number,x1:number,y1:number){ for(let y=Math.max(0,y0);y<=Math.min(this.h-1,y1);y++)for(let x=Math.max(0,x0);x<=Math.min(this.w-1,x1);x++) this.keep[y*this.w+x]=1; }
  clr(x:number,y:number,R:number){ return clrAt(this.w,this.h,this.solid,x,y,R); }
  /** Place a solid prop block. gap = free tiles required between it and other props. Returns false when rejected. */
  block(x:number,y:number,kind:Prop['kind'],hh=1,wd=1,dp=1,gap=0):boolean{
    for(let j=-gap;j<dp+gap;j++)for(let i=-gap;i<wd+gap;i++){ const X=x+i,Y=y+j; if(!this.inb(X,Y)) { if(i>=0&&i<wd&&j>=0&&j<dp) return false; continue; } const inside=i>=0&&i<wd&&j>=0&&j<dp; const k=Y*this.w+X; if(inside){ if(this.solid[k]||this.keep[k]||this.zone[k]===ZI('corridor')){ if((globalThis as any).DBG) console.log('blockfail',X,Y,this.solid[k],this.keep[k],this.zone[k]); return false; } } if(this.pm[k]) return false; }
    for(let j=0;j<dp;j++)for(let i=0;i<wd;i++){ const k=(y+j)*this.w+x+i; this.solid[k]=1; this.pm[k]=1; this.props.push({x:x+i,y:y+j,kind,h:hh}); } return true; }
  tiles(zs:Zone[]):[number,number][]{ const zi=zs.map(ZI); const out:[number,number][]=[]; for(let y=0;y<this.h;y++)for(let x=0;x<this.w;x++){ const k=y*this.w+x; if(!this.solid[k]&&zi.includes(this.zone[k])) out.push([x,y]); } return out; }
  /** try to drop `n` props of a kind at random free tiles of the given zones */
  scatterProps(zs:Zone[],kind:Prop['kind'],hh:number,wd:number,dp:number,n:number,gap=2,wdMax=wd,dpMax=dp){ const t=this.tiles(zs); let done=0; for(let k=0;k<n*30&&done<n&&t.length;k++){ const [x,y]=this.pick(t); if(this.block(x,y,kind,hh,wd===wdMax?wd:this.ri(wd,wdMax),dp===dpMax?dp:this.ri(dp,dpMax),gap)) done++; } return done; }
  hz(x:number,y:number,r:number,dps:number,heat:number,label:string){ this.hazards.push({x,y,r,dps,heat,label}); }
  hline(x0:number,y0:number,x1:number,y1:number,step:number,r:number,dps:number,heat:number,label:string,skip:(x:number,y:number)=>boolean=()=>false){ const n=Math.max(1,Math.round(Math.hypot(x1-x0,y1-y0)/step)); for(let i=0;i<=n;i++){ const x=x0+(x1-x0)*i/n, y=y0+(y1-y0)*i/n; if(skip(x,y)) continue; if(this.solid[Math.floor(y)*this.w+Math.floor(x)]) continue; this.hz(x,y,r,dps,heat,label); } }
  nearHaz(x:number,y:number){ return this.hazards.some(h=>Math.hypot(h.x-x-.5,h.y-y-.5)<h.r+.9); }
  /** A clustered pack of `n` enemies in the given zones, on tiles with clearance for that enemy's flow class. */
  pack(zs:Zone[],n:number,type:string,o:{minD?:number;spread?:number;rect?:[number,number,number,number]}={}):number{
    const R=FLOW_R[clsOf(ENEMIES[type]?.radius??.4)]; const minD=o.minD??8; const sp=o.spread??(2+Math.sqrt(n)*1.7);
    const tl=this.tiles(zs).filter(([x,y])=>this.clr(x,y,R)&&!this.nearHaz(x,y)&&Math.hypot(x+.5-this.sx,y+.5-this.sy)>=minD&&(!o.rect||(x>=o.rect[0]&&y>=o.rect[1]&&x<=o.rect[2]&&y<=o.rect[3]))&&!this.interacts.some(i=>Math.hypot(i.x-x-.5,i.y-y-.5)<2.2));
    if(!tl.length) return 0; const c=this.pick(tl); const gid=++this.gid; let placed=0;
    for(const [x,y] of this.shuffle(tl.filter(t=>Math.hypot(t[0]-c[0],t[1]-c[1])<=sp))){ if(placed>=n) break; if(this.spawns.some(s=>Math.hypot(s.x-x,s.y-y)<1.6)) continue; this.spawns.push({type,x,y,group:gid}); placed++; }
    return gid; }
  /** A mixed-role SQUAD: several types placed around one centre under one alert group (batch-2 pack composition). Each type uses its own clearance class. */
  squad(zs:Zone[],parts:[string,number][],o:{minD?:number}={}):number{
    const maxR=Math.max(...parts.map(([t])=>FLOW_R[clsOf(ENEMIES[t]?.radius??.4)])); const minD=o.minD??8; const total=parts.reduce((a,[,n])=>a+n,0); const sp=2.4+Math.sqrt(total)*1.5; const all=this.tiles(zs);
    const tl=all.filter(([x,y])=>this.clr(x,y,maxR)&&!this.nearHaz(x,y)&&Math.hypot(x+.5-this.sx,y+.5-this.sy)>=minD&&!this.interacts.some(i=>Math.hypot(i.x-x-.5,i.y-y-.5)<2.2)); if(!tl.length) return 0;
    const c=this.pick(tl); const gid=++this.gid; let placed=0;
    for(const [type,n] of parts){ const R=FLOW_R[clsOf(ENEMIES[type]?.radius??.4)]; const cand=this.shuffle(all.filter(([x,y])=>Math.hypot(x-c[0],y-c[1])<=sp&&this.clr(x,y,R)&&!this.nearHaz(x,y)&&Math.hypot(x+.5-this.sx,y+.5-this.sy)>=minD-1&&!this.interacts.some(i=>Math.hypot(i.x-x-.5,i.y-y-.5)<2.2))); let k=0;
      for(const [x,y] of cand){ if(k>=n) break; if(this.spawns.some(s=>Math.hypot(s.x-x,s.y-y)<1.6)) continue; this.spawns.push({type,x,y,group:gid}); k++; placed++; } }
    return placed?gid:0; }
  /** single static/guard/elite spawn near a preferred point */
  single(type:string,group:number,px:number,py:number,rad=5,zs?:Zone[]){ const R=FLOW_R[clsOf(ENEMIES[type]?.radius??.4)]; const c:[number,number][]=[]; for(let y=Math.floor(py-rad);y<=py+rad;y++)for(let x=Math.floor(px-rad);x<=px+rad;x++){ if(!this.inb(x,y)||!this.clr(x,y,R)||this.nearHaz(x,y)) continue; if(zs&&!zs.map(ZI).includes(this.zone[y*this.w+x])) continue; if(this.spawns.some(s=>Math.hypot(s.x-x,s.y-y)<2)) continue; c.push([x,y]); } if(!c.length) return; c.sort((a,b)=>Math.hypot(a[0]-px,a[1]-py)-Math.hypot(b[0]-px,b[1]-py)); const t=c[Math.min(c.length-1,Math.floor(this.r()*3))]; this.spawns.push({type,x:t[0],y:t[1],group}); }
  /** Interactable on a free tile with clearance near (px,py) (or anywhere in zones). */
  put(id:string,label:string,kind:Interact['kind'],px:number,py:number,rad=6,zs?:Zone[],r=1.6){ let best:[number,number]|null=null, bd=1e9; for(let y=Math.floor(py-rad);y<=py+rad;y++)for(let x=Math.floor(px-rad);x<=px+rad;x++){ if(!this.inb(x,y)||!this.clr(x,y,zs&&zs.includes('passage')?.5:1)) continue; if(zs&&!zs.map(ZI).includes(this.zone[y*this.w+x])) continue; if(this.interacts.some(i=>Math.hypot(i.x-x-.5,i.y-y-.5)<3.5)||this.nearHaz(x,y)) continue; const d=Math.hypot(x+.5-px,y+.5-py)+this.r()*1.5; if(d<bd){ bd=d; best=[x,y]; } } if(!best) return false; this.interacts.push({id,x:best[0]+.5,y:best[1]+.5,r,label,kind}); return true; }
  door(id:string,label:string,tiles:[number,number][]){ this.doors.push({id,label,tiles}); for(const [x,y] of tiles) this.solid[y*this.w+x]=1; }
  /** wall off walkable tiles that cannot be reached (props can seal pockets) */
  prune(){ const L={w:this.w,h:this.h,solid:this.solid,doors:this.doors}; const m=reachMap(L,{x:this.sx,y:this.sy},0); const sol=this.solid; for(let i=0;i<m.length;i++) if(!sol[i]&&!m[i]&&!this.doors.some(d=>d.tiles.some(t=>t[1]*this.w+t[0]===i))) sol[i]=1; }
  level(o:{spawn:{x:number;y:number};cps:{id:number;x:number;y:number;label:string}[];bossSpawn:{x:number;y:number};revealX:number;salvage:{x:number;y:number};sensors?:{x0:number;y0:number;x1:number;y1:number}}):Level{
    return { w:this.w,h:this.h,solid:this.solid,zone:this.zone,doors:this.doors,props:this.props,interacts:this.interacts,spawns:this.spawns,checkpoints:o.cps,sensors:o.sensors||{x0:0,y0:0,x1:0,y1:0},spawn:o.spawn,zoneNames:ZONES,bossSpawn:o.bossSpawn,revealX:o.revealX,salvage:o.salvage,hazards:this.hazards,seed:this.seed }; }
}

export interface Rm{ zone:Zone; x0:number;y0:number;x1:number;y1:number; cy:number }
export interface Spec{ zone:Zone; w:number; h:number; cy:number }
/** Lay rooms left-to-right joined by 2-long, 3-wide door corridors. cys optionally fixes the corridor row per boundary. */
export function chain(g:{ri:(a:number,b:number)=>number}|null,specs:Spec[],cys:(number|undefined)[]=[]){
  const rooms:Rm[]=[]; let x=2; for(const s of specs){ const y0=Math.round(s.cy-s.h/2); rooms.push({zone:s.zone,x0:x,y0,x1:x+s.w-1,y1:y0+s.h-1,cy:s.cy}); x+=s.w+2; }
  const cors:number[]=[]; for(let i=0;i<rooms.length-1;i++){ const a=rooms[i], b=rooms[i+1]; const lo=Math.max(a.y0,b.y0)+3, hi=Math.min(a.y1,b.y1)-3; cors.push(cys[i]??(hi>=lo&&g?g.ri(lo,hi):Math.round((lo+hi)/2))); }
  return { rooms, cors, W:x+1 };
}
export function link(g:Gen,rooms:Rm[],cors:number[]){ for(let i=0;i<cors.length;i++){ const x=rooms[i].x1+1, cy=cors[i]; g.carve(x,cy-1,x+1,cy+1,'corridor'); g.reserve(x-4,cy-3,x+5,cy+3); } }
export function doorsAt(g:Gen,rooms:Rm[],cors:number[],names:[string,string,string]){ const ids=['gate1','lock2','boss']; for(let i=0;i<3;i++){ const x=rooms[i].x1+1, cy=cors[i]; g.door(ids[i],names[i],[[x,cy-1],[x,cy],[x,cy+1]]); } }
const hf=(n:number)=>Math.floor(n);

export function bossArena(g:Gen,b:Rm,kind:'ring'|'dais'|'hall'|'lanes',cy:number){
  const cx=hf((b.x0+b.x1)/2)+2; const spawn={x:b.x0+4.5,y:b.cy+.5};
  g.reserve(b.x0,cy-3,b.x0+8,cy+3); g.reserve(hf(spawn.x)-3,hf(spawn.y)-3,hf(spawn.x)+3,hf(spawn.y)+3);
  if(kind==='ring'||kind==='dais'){ g.block(cx-2,b.cy-2,'machine',kind==='ring'?2.4:2,5,5); }
  const n=g.ri(3,5); for(let k=0;k<n*20&&k<120;k++){ const x=g.ri(b.x0+6,b.x1-2), y=g.ri(b.y0+2,b.y1-2); if(Math.hypot(x-cx,y-b.cy)<(kind==='hall'?2:4.5)||!g.clr(x,y,4.2)) continue; const my=2*b.cy-y; if(my===y) continue; const ph=kind==='hall'?2.4:2.2; if(g.block(x,y,"pillar",ph,1,1,4)){ g.block(x,my,'pillar',ph,1,1,3); } }
  return { spawn, cx };
}
export function packs(g:Gen,spec:[Zone[],number,string,number?][]){ for(const [z,n,t,minD] of spec) g.pack(z,n,t,{minD}); }
export function sideRoom(g:Gen,x:number,y1:number,w:number,h:number,corLen=4){ const rx=Math.max(3,Math.min(g.w-w-3,x)); const cx=Math.max(rx+2,Math.min(rx+w-5,x+g.ri(0,w-5))); g.carve(cx,y1+1,cx+2,y1+corLen,'corridor'); g.carve(rx,y1+corLen+1,rx+w-1,y1+corLen+h,'salvage'); return {x0:rx,y0:y1+corLen+1,x1:rx+w-1,y1:y1+corLen+h,cx}; }

/** deterministic retry wrapper: perturb the seed until the layout validates */
export function gen(seed:number,once:(s:number)=>Level,tag:string):Level{ let last:Level|null=null; for(let k=0;k<40;k++){ const s=(seed+k*7919)>>>0; const L=once(s); (L as any).attempt=k; (L as any).seed=seed; last=L; if(!validate(L).length) return L; } console.warn('mapgen: '+tag+' seed '+seed+' failed validation: '+validate(last!).slice(0,3).join('; ')); return last!; }

// ============================== FOUNDRY: open furnace halls, slag channels, catwalk bridges ==============================
export const genFoundry=(seed:number)=>gen(seed,foundryOnce,'foundry');
function foundryOnce(seed:number):Level{
  const q=rngOf(seed^0x5bd1e995); const ri=(a:number,b:number)=>a+Math.floor(q()*(b-a+1)); const H=58, base=29;
  const sp:Spec[]=[{zone:'yard',w:ri(18,20),h:ri(16,20),cy:base+ri(-3,3)},{zone:'proc',w:ri(27,30),h:ri(26,30),cy:base+ri(-2,2)},{zone:'junction',w:ri(14,16),h:ri(18,22),cy:base+ri(-2,2)},{zone:'boss',w:ri(18,20),h:ri(24,28),cy:base+ri(-2,2)}];
  const {rooms,cors,W}=chain({ri},sp,[]); const g=new Gen(W,H,seed); const [Y,P,J,B]=rooms;
  for(const r of rooms) g.carve(r.x0,r.y0,r.x1,r.y1,r.zone); link(g,rooms,cors); doorsAt(g,rooms,cors,['Slag gate','Press lock','Furnace ring door']);
  const spawn={x:Y.x0+2.5,y:cors[0]+.5}; g.sx=spawn.x; g.sy=spawn.y; g.reserve(Y.x0,hf(spawn.y)-3,Y.x0+6,hf(spawn.y)+3);
  // salvage tool crib under the yard
  const S=sideRoom(g,Y.x0+g.ri(0,4),Y.y1,g.ri(14,18),g.ri(8,10)); g.reserve(S.cx-1,Y.y1,S.cx+2,Y.y1+6);
  // alcoves north / south of the gantry hold the two replacement-boss conditions (side picked by seed)
  const ax=J.x0+g.ri(2,J.x1-J.x0-8); const north={x0:ax,y0:J.y0-5,x1:ax+6,y1:J.y0-1}, south={x0:J.x0+g.ri(2,J.x1-J.x0-8),y0:J.y1+1,x1:0,y1:J.y1+5}; south.x1=south.x0+6;
  g.carve(north.x0,north.y0,north.x1,north.y1,'passage'); g.carve(south.x0,south.y0,south.x1,south.y1,'passage');
  // slag yard: 1-2 troughs along a random row, crates, racks
  const tr=g.ri(1,2); for(let k=0;k<tr;k++){ const ty=g.ri(Y.y0+2,Y.y1-2), tx=g.ri(Y.x0+5,Y.x0+8), len=g.ri(7,10); if(Math.abs(ty-cors[0])<4) continue; g.hline(tx+.5,ty+.5,tx+len+.5,ty+.5,1.6,1.1,8,10,'Slag trough'); g.reserve(tx,ty-1,tx+len,ty+1); }
  g.scatterProps(['yard'],'crate',1,1,1,g.ri(8,12),2); g.scatterProps(['yard'],'rack',1.8,1,3,2,2); g.scatterProps(['yard'],'machine',1.6,2,1,2,2);
  // casting hall: 1-2 N-S slag channels with catwalk bridges, big machines, conveyors
  const nch=g.ri(1,2); const chx:number[]=[]; for(let k=0;k<nch;k++){ const x=P.x0+Math.round((k+1)*(P.x1-P.x0+1)/(nch+1))+g.ri(-3,3); chx.push(x); const nb=g.ri(1,3); const bys=Array.from({length:nb},()=>g.ri(P.y0+4,P.y1-4)); g.reserve(x-1,P.y0,x+1,P.y1); g.hline(x+.5,P.y0+1.5,x+.5,P.y1-.5,1.6,1.1,8,10,'Slag trough',(_x,y)=>bys.some(by=>Math.abs(y-by-.5)<2.6)); for(const by of bys) g.zoneRect(x-1,by-1,x+1,by+1,'passage'); }
  g.scatterProps(['proc'],'machine',2,3,3,g.ri(2,3),3); g.scatterProps(['proc'],'conveyor',.7,6,1,g.ri(2,3),2,10); g.scatterProps(['proc'],'conveyor',.7,1,4,1,2,6); g.scatterProps(['proc'],'rack',1.8,3,1,2,2,4); g.scatterProps(['proc'],'crate',1,1,1,g.ri(4,7),2);
  // control gantry
  g.scatterProps(['junction'],'rack',1.8,1,3,g.ri(2,4),2,4); g.scatterProps(['junction'],'machine',1.6,2,2,g.ri(2,3),2);
  // furnace ring
  const ba=bossArena(g,B,'ring',cors[2]); g.reserve(B.x1-1,B.y0,B.x1,B.y1);
  const rc=hf((B.x0+B.x1)/2)+2, rn=g.ri(6,10), rr=g.ri(44,52)/10, gapI=g.ri(0,rn-1); for(let i=0;i<rn;i++){ if(i===gapI) continue; const a=i/rn*Math.PI*2; g.hz(rc+.5+Math.cos(a)*rr,B.cy+.5+Math.sin(a)*rr,1.4,9,14,'Furnace heat'); }
  // objectives and conditions
  g.put('hackproc','Press-line relay (hack: reroute locks)','hack',P.x1-1.5,cors[1]+g.ri(-3,3),4,['proc']);
  g.put('controller','Pour controller (objective)','controller',J.x1-2,J.cy+g.ri(-5,5),5,['junction']);
  const sides=g.r()<.5?[north,south]:[south,north]; g.put('cond_A','Casting-line interlock lever (force)','armory',(sides[0].x0+sides[0].x1)/2+.5,(sides[0].y0+sides[0].y1)/2,3,['passage']); g.put('cond_B','Pour-schedule console (hack)','terminal',(sides[1].x0+sides[1].x1)/2+.5,(sides[1].y0+sides[1].y1)/2,3,['passage']);
  g.put('cratechip','Tool-crib chip cache (bonus)','crate',S.x1-2,S.y1-1,5,['salvage'],1.5);
  // enemies: seeded packs
  g.single('slagcannon',90,Y.x1-1,cors[0]-g.ri(4,6)); g.single('slagcannon',91,Y.x1-1,cors[0]+g.ri(4,6));
  packs(g,[[['yard'],g.ri(7,9),'slaghauler',7],[['yard'],3,'ladlecrew',7],[['yard'],3,'cinderhound',7],[['proc'],g.ri(7,9),'slaghauler'],[['proc'],4,'slaghauler'],[['proc'],5,'ladlecrew'],[['proc'],4,'cinderhound'],[['junction'],4,'ladlecrew'],[['junction'],4,'slaghauler'],[['salvage'],5,'slaghauler'],[['salvage'],2,'cinderhound']]);
  g.single('brakeman',50,P.x1-4,cors[1],6,['proc']); g.single('quenchpriest',55,hf((J.x0+J.x1)/2),J.cy,5,['junction']); g.single('sawhand',60,S.x0+(S.x1-S.x0)/2,S.y0+3,4,['salvage']);
  g.prune();
  return g.level({spawn,cps:[{id:1,x:spawn.x,y:spawn.y,label:'Slag yard dock'},{id:2,x:J.x0+2.5,y:cors[1]+.5,label:'Control gantry'}],bossSpawn:ba.spawn,revealX:B.x0+2,salvage:{x:(S.x0+S.x1)/2,y:S.y0+4}});
}

// ============================== CLINIC: grid of small rooms, 3-wide sterile choke points ==============================
interface Cell{ x:number;y:number }
/** Room grid (6x6 rooms on an 8-tile pitch) joined by a random spanning tree + loops; some neighbours are merged into one big room. */
function roomGrid(g:Gen,x0:number,y0:number,cols:number,rows:number,zone:Zone,loops=.3,merge=.25){
  const rx=(i:number)=>x0+i*8, ry=(j:number)=>y0+j*8; for(let j=0;j<rows;j++)for(let i=0;i<cols;i++) g.carve(rx(i),ry(j),rx(i)+5,ry(j)+5,zone);
  const open=(a:Cell,b:Cell)=>{ const big=g.r()<merge; if(a.y===b.y){ const i=Math.min(a.x,b.x); const x=rx(i)+6; if(big) g.carve(x,ry(a.y),x+1,ry(a.y)+5,zone); else g.carve(x,ry(a.y)+1,x+1,ry(a.y)+3,zone); } else { const j=Math.min(a.y,b.y); const y=ry(j)+6; if(big) g.carve(rx(a.x),y,rx(a.x)+5,y+1,zone); else g.carve(rx(a.x)+1,y,rx(a.x)+3,y+1,zone); } };
  const seen=new Set<string>(); const key=(c:Cell)=>c.x+','+c.y; const st:Cell[]=[{x:g.ri(0,cols-1),y:g.ri(0,rows-1)}]; seen.add(key(st[0])); const used=new Set<string>();
  while(st.length){ const c=st[st.length-1]; const nb=g.shuffle([[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:c.x+dx,y:c.y+dy})).filter(n=>n.x>=0&&n.y>=0&&n.x<cols&&n.y<rows&&!seen.has(key(n)))); if(!nb.length){ st.pop(); continue; } const n=nb[0]; seen.add(key(n)); st.push(n); open(c,n); used.add(key(c)+'|'+key(n)); used.add(key(n)+'|'+key(c)); }
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++) for(const [dx,dy] of [[1,0],[0,1]]){ const n={x:i+dx,y:j+dy}; if(n.x>=cols||n.y>=rows) continue; if(used.has(key({x:i,y:j})+'|'+key(n))) continue; if(g.r()<loops) open({x:i,y:j},n); }
  return { rx, ry, w:cols*8-2, h:rows*8-2 };
}
export const genClinic=(seed:number)=>gen(seed,clinicOnce,'clinic');
function clinicOnce(seed:number):Level{
  const q=rngOf(seed^0x1b873593); const ri=(a:number,b:number)=>a+Math.floor(q()*(b-a+1)); const Y0=8, rows=3;
  const jw=ri(14,17), bw=ri(20,23); const yr=ri(0,2), pr=ri(0,2); const ycy=Y0+8*yr+2, pcy=Y0+8*pr+2;
  const gh=rows*8-2; const sp:Spec[]=[{zone:'yard',w:14,h:gh,cy:Y0+gh/2},{zone:'proc',w:30,h:gh,cy:Y0+gh/2},{zone:'junction',w:jw,h:gh,cy:Y0+gh/2},{zone:'boss',w:bw,h:gh+2,cy:Y0+gh/2}];
  const jr=ri(0,2); const {rooms,cors,W}=chain(null,sp,[ycy,pcy,Y0+8*jr+2]); const H=Y0+gh+16; const g=new Gen(W,H,seed); const [Y,P,J,B]=rooms;
  const yg=roomGrid(g,Y.x0,Y0,2,rows,'yard',.3,.2), pg=roomGrid(g,P.x0,Y0,4,rows,'proc',.35,.3);
  g.carve(J.x0,J.y0,J.x1,J.y1,'junction'); g.carve(B.x0,B.y0,B.x1,B.y1,'boss'); link(g,rooms,cors); doorsAt(g,rooms,cors,['Intake gate','Theatre lock','Amphitheatre door']);
  // entry in a left-column ward on a random row
  const er=ri(0,rows-1); const spawn={x:Y.x0+2.5,y:Y0+8*er+2.5}; g.sx=spawn.x; g.sy=spawn.y; g.reserve(Y.x0,Y0+8*er,Y.x0+5,Y0+8*er+5);
  // sterile cloak passage over the top: yard (top row) -> junction roof. Sensor strip mid-way.
  const pxv=Y.x0+g.ri(0,1)*8+2, jxv=J.x0+g.ri(3,J.x1-J.x0-4); g.carve(pxv,Y0-4,pxv+1,Y0-1,'passage'); g.carve(pxv,Y0-5,jxv+1,Y0-4,'passage'); g.carve(jxv,Y0-5,jxv+1,Y0-1,'passage'); g.carve(pxv,Y0-5,pxv+1,Y0-1,'passage');
  const mx=Math.round((pxv+jxv)/2), sens={x0:mx-4,y0:Y0-5,x1:mx+4,y1:Y0-4};
  // salvage recovery ward below the junction
  const S=sideRoom(g,J.x0-2,J.y1,g.ri(14,17),7,4); g.reserve(S.cx-1,J.y1,S.cx+2,J.y1+6);
  // rooms: small corner props only (never in the 3-wide openings), spilled fluids
  const corners=(gr:{rx:(i:number)=>number;ry:(j:number)=>number},cols:number,zn:Zone)=>{ for(let j=0;j<rows;j++)for(let i=0;i<cols;i++) for(const [ox,oy] of g.shuffle([[0,0],[5,0],[0,5],[5,5]]).slice(0,g.ri(0,2))){ const x=gr.rx(i)+ox,y=gr.ry(j)+oy; if(g.zone[y*g.w+x]===ZI(zn)&&Math.hypot(x-spawn.x,y-spawn.y)>3) g.block(x,y,g.r()<.5?'crate':'machine',g.r()<.5?.9:1.4,1,1,0); } };
  corners(yg,2,'yard'); corners(pg,4,'proc');
  g.scatterProps(['junction'],'machine',1.8,3,3,g.ri(1,2),3); g.scatterProps(['junction'],'rack',1.6,1,3,g.ri(2,3),2,4);
  const rc=ri(0,1); void rc; const fl=g.ri(3,5); for(let k=0;k<fl;k++){ const gr=g.r()<.5?yg:pg; const i=g.ri(0,(gr===yg?2:4)-1), j=g.ri(0,rows-1); g.hz(gr.rx(i)+3,gr.ry(j)+3,1.5,5,14,'Spilled fluids'); }
  g.hz(J.x0+jw/2+g.ri(-2,2),J.y0+g.ri(3,gh-4)+.5,1.4,5,14,'Spilled coolant');
  // amphitheatre: dais + saw rigs at seeded ring positions
  const ba=bossArena(g,B,'dais',cors[2]); const bc={x:hf((B.x0+B.x1)/2)+2.5,y:B.cy+.5}; const nsaw=4, off=g.r()*Math.PI/2; for(let i=0;i<nsaw;i++){ const a=off+i/nsaw*Math.PI*2, d=g.ri(60,72)/10; g.hz(bc.x+Math.cos(a)*d,bc.y+Math.sin(a)*d,1.5,11,12,'Saw rig'); }
  // objectives
  g.put('hackproc','Theatre door relay (hack: reroute locks)','hack',P.x1-3,pcy+g.ri(-2,2)+.5,5,['proc']);
  g.put('controller','Implant fabricator core (objective)','controller',J.x1-3,J.cy+g.ri(-5,5),5,['junction']);
  g.put('cond_A','Theatre scheduling terminal (hack)','terminal',P.x0+g.ri(8,22),Y0+g.ri(2,gh-3),3,['proc']);
  g.put('cond_B','Quarantine ward seal (cloak weave)','armory',mx+.5+g.ri(-2,2),Y0-4,3,['passage']);
  g.put('cratechip','Pharmacy chip cache (bonus)','crate',S.x1-2,S.y1-1,5,['salvage'],1.5);
  // guards sit in the intake wards nearest the gate, packs fill rooms
  g.single('sentry',90,Y.x1-1,Y0+2,5,['yard']); g.single('sentry',91,Y.x1-1,Y0+gh-3,5,['yard']);
  packs(g,[[['yard'],7,'orderly',7],[['yard'],3,'nursebot',7],[['yard'],2,'gurneyrunner',7],[['proc'],4,'orderly'],[['proc'],4,'orderly'],[['proc'],4,'nursebot'],[['proc'],3,'gurneyrunner'],[['proc'],3,'nursebot'],[['junction'],5,'nursebot'],[['junction'],5,'orderly'],[['salvage'],5,'orderly'],[['salvage'],2,'gurneyrunner']]);
  g.single('matron',50,P.x1-6,pcy,6,['proc']); g.single('anesthetist',55,J.x0+jw/2,J.cy,5,['junction']);
  g.prune();
  return g.level({spawn,cps:[{id:1,x:spawn.x,y:spawn.y,label:'Reception'},{id:2,x:J.x0+2.5,y:cors[1]+.5,label:'Fabrication lab'}],bossSpawn:ba.spawn,revealX:B.x0+2,salvage:{x:(S.x0+S.x1)/2,y:S.y0+4},sensors:sens});
}

// ============================== WAREHOUSE: long shelving aisles, open loading dock ==============================
export const genWarehouse=(seed:number)=>gen(seed,warehouseOnce,'warehouse');
function warehouseOnce(seed:number):Level{
  const q=rngOf(seed^0x85ebca6b); const ri=(a:number,b:number)=>a+Math.floor(q()*(b-a+1)); const H=58, base=29;
  const nrow=ri(4,5); const ph=5*nrow+3; const sp:Spec[]=[{zone:'yard',w:ri(20,22),h:ri(18,22),cy:base+ri(-2,2)},{zone:'proc',w:ri(30,34),h:ph,cy:base},{zone:'junction',w:ri(14,17),h:ri(20,24),cy:base+ri(-2,2)},{zone:'boss',w:ri(17,20),h:ri(24,28),cy:base+ri(-2,2)}];
  const P0=Math.round(base-ph/2); const aisle=(j:number)=>P0+5*j+1; // centre row of aisle j (3 tall: P0+5j .. +2)
  const {rooms,cors,W}=chain({ri},sp,[undefined,undefined,undefined]); const [Y,P,J,B]=rooms;
  // snap the proc entry/exit corridors onto aisle centres
  cors[0]=Math.max(Y.y0+3,Math.min(Y.y1-3,aisle(ri(0,nrow)))); cors[1]=aisle(ri(0,nrow)); if(cors[0]<P.y0+1||cors[0]>P.y1-1) cors[0]=aisle(ri(0,nrow));
  // yard corridor must sit inside both yard and an aisle row
  { const ok=(c:number)=>c>=Y.y0+2&&c<=Y.y1-2; const alts=Array.from({length:nrow+1},(_,j)=>aisle(j)).filter(ok); cors[0]=alts[ri(0,alts.length-1)]??cors[0]; const lo=Math.max(P.y0,J.y0)+3, hi=Math.min(P.y1,J.y1)-3; const a2=Array.from({length:nrow+1},(_,j)=>aisle(j)).filter(c=>c>=lo&&c<=hi); cors[1]=a2[ri(0,a2.length-1)]??Math.round((lo+hi)/2); }
  { const lo=Math.max(J.y0,B.y0)+3, hi=Math.min(J.y1,B.y1)-3; cors[2]=ri(lo,Math.max(lo,hi)); }
  const g=new Gen(W,H,seed);
  for(const r of rooms) g.carve(r.x0,r.y0,r.x1,r.y1,r.zone); link(g,rooms,cors); doorsAt(g,rooms,cors,['Dock shutter','Sorting shutter','Retrieval hall door']);
  const spawn={x:Y.x0+2.5,y:cors[0]+.5}; g.sx=spawn.x; g.sy=spawn.y; g.reserve(Y.x0,hf(spawn.y)-3,Y.x0+6,hf(spawn.y)+3);
  const S=sideRoom(g,Y.x0+g.ri(0,5),Y.y1,g.ri(14,17),g.ri(7,9)); g.reserve(S.cx-1,Y.y1,S.cx+2,Y.y1+6);
  const ax=J.x0+g.ri(1,J.x1-J.x0-10); g.carve(ax,J.y1+1,ax+9,J.y1+5,'passage');
  // loading dock: trailers along one wall, crates, pallet-jack lanes
  const topWall=g.r()<.5; const ty=topWall?Y.y0+1:Y.y1-3; for(let k=0,x=Y.x0+3;k<3&&x<Y.x1-9;k++){ if(g.block(x,ty,'machine',1.6,g.ri(7,9),3,1)) x+=11; else x+=3; }
  g.scatterProps(['yard'],'crate',1,1,1,g.ri(7,11),2); g.scatterProps(['yard'],'crate',1,2,1,2,2); g.scatterProps(['yard'],'machine',1.4,2,2,1,2);
  for(let k=0;k<g.ri(1,2);k++){ const y=g.ri(Y.y0+3,Y.y1-3); if(Math.abs(y-cors[0])<4) continue; g.hline(Y.x0+4.5,y+.5,Y.x0+4.5+g.ri(5,9),y+.5,2,1.2,6,8,'Pallet-jack lane'); }
  // storage aisles: long horizontal shelving rows with seeded cross-aisle gaps; 3-wide aisles everywhere
  for(let i=0;i<nrow;i++){ const y=P0+3+5*i; const x0=P.x0+3, x1=P.x1-3; const ng=g.ri(1,3); const gaps:number[]=[]; for(let k=0;k<ng;k++) gaps.push(g.ri(x0+2,x1-5)); gaps.sort((a,b)=>a-b); let cur=x0; const segs:[number,number][]=[]; for(const gp of gaps){ if(gp-cur>=2&&gp>=cur) segs.push([cur,gp-1]); cur=Math.max(cur,gp+3); } if(x1>=cur) segs.push([cur,x1]); for(const [a,b] of segs){ let st=-1; for(let x=a;x<=b+1;x++){ const bad=x>b||g.keep[y*g.w+x]||g.keep[(y+1)*g.w+x]; if(!bad&&st<0) st=x; if(bad&&st>=0){ if(x-st>=2) g.block(st,y,'rack',2.2,x-st,2,0); st=-1; } } } }
  g.reserve(P.x0,P.y0,P.x0,P.y1);
  for(let k=0;k<g.ri(3,4);k++){ const j=g.ri(0,nrow), x=g.ri(P.x0+4,P.x1-4); g.hz(x+.5,aisle(j)+.5,1.4,8,6,'Collapsed shelving'); }
  // sorting line: conveyors and a stamping press
  g.scatterProps(['junction'],'conveyor',.7,8,1,g.ri(2,3),2,10); g.scatterProps(['junction'],'conveyor',.7,1,5,1,2,6); g.scatterProps(['junction'],'machine',1.8,2,2,g.ri(2,3),2); g.scatterProps(['junction'],'crate',1,1,1,g.ri(2,4),2);
  { const t=g.tiles(['junction']).filter(([x,y])=>g.clr(x,y,1.5)&&x>J.x0+4&&x<J.x1-3); if(t.length){ const [x,y]=g.pick(t); g.hz(x+.5,y+.5,1.4,12,10,'Stamping press'); } }
  // retrieval hall: gantry legs + crane hazards
  const ba=bossArena(g,B,'hall',cors[2]); const bc={x:hf((B.x0+B.x1)/2)+.5,y:B.cy+.5}; g.hz(bc.x+g.ri(-2,2),B.y0+g.ri(3,6)+.5,1.8,12,8,'Gantry crane'); g.hz(bc.x+g.ri(-2,2),B.y1-g.ri(3,6)+.5,1.8,12,8,'Gantry crane');
  g.put('hackproc','Shutter relay (hack: reroute locks)','hack',P.x1-1.5,cors[1]+g.ri(-1,1),5,['proc']);
  g.put('controller','Master sort controller (objective)','controller',J.x1-2,J.y0+g.ri(3,J.y1-J.y0-3),6,['junction']);
  g.put('cond_A','Order-queue console (hack)','terminal',J.x0+g.ri(4,J.x1-J.x0-3),J.y0+g.ri(1,4),4,['junction']);
  g.put('cond_B','Dormant returns cradle (defib rack)','armory',ax+4.5,J.y1+3,3,['passage']);
  g.put('cratechip','Returns-cage chip cache (bonus)','crate',S.x1-2,S.y1-1,5,['salvage'],1.5);
  g.single('camgun',90,Y.x1-1,cors[0]-g.ri(4,7)); g.single('camgun',91,Y.x1-1,cors[0]+g.ri(4,7));
  packs(g,[[['yard'],8,'picker',7],[['yard'],3,'scanner',7],[['yard'],2,'loader',7],[['proc'],9,'picker'],[['proc'],4,'scanner'],[['proc'],3,'loader'],[['proc'],3,'forkbot'],[['proc'],4,'picker'],[['junction'],5,'scanner'],[['junction'],5,'picker'],[['junction'],2,'forkbot'],[['salvage'],5,'picker'],[['salvage'],2,'loader']]);
  g.single('shiftlead',50,P.x1-5,cors[1],5,['proc']); g.single('hobbs',55,J.x0+J.x1>>1,J.cy,6,['junction']);
  g.prune();
  return g.level({spawn,cps:[{id:1,x:spawn.x,y:spawn.y,label:'Loading dock'},{id:2,x:J.x0+2.5,y:cors[1]+.5,label:'Sorting line'}],bossSpawn:ba.spawn,revealX:B.x0+2,salvage:{x:(S.x0+S.x1)/2,y:S.y0+4}});
}

// ============================== ANNEX: current handcrafted rooms, re-dressed per seed ==============================
const ANNEX_ROOMS:{z:Zone;r:[number,number,number,number]}[]=[{z:'yard',r:[2,12,23,27]},{z:'proc',r:[26,8,47,30]},{z:'junction',r:[50,10,62,27]},{z:'boss',r:[65,8,84,30]},{z:'salvage',r:[4,32,19,42]}];
export function varyAnnex(base:()=>Level,seed:number):Level{ return gen(seed,(s)=>annexOnce(base(),s),'annex'); }
function annexOnce(L:Level,seed:number):Level{
  const g=Gen.from(L,seed); const w=L.w, h=L.h;
  // strip hand-placed props from the five rooms (chamfer cuts / doors stay), then re-dress them
  for(const p of L.props){ const k=p.y*w+p.x; if(ANNEX_ROOMS.some(a=>p.x>=a.r[0]&&p.x<=a.r[2]&&p.y>=a.r[1]&&p.y<=a.r[3])) g.solid[k]=0; } g.props=[];
  for(const a of ANNEX_ROOMS) for(let y=a.r[1];y<=a.r[3];y++)for(let x=a.r[0];x<=a.r[2];x++) if(g.solid[y*w+x]===0&&g.zone[y*w+x]!==ZI(a.z)) g.zone[y*w+x]=ZI(a.z);
  g.reserve(22,16,27,22); g.reserve(46,16,51,22); g.reserve(61,16,66,22); g.reserve(2,16,8,23); g.reserve(50,16,56,23); g.reserve(55,9,62,13); g.reserve(60,10,61,12);
  for(const it of g.interacts) if(it.id==='armoryfuse'||it.id==='armorydoor') g.reserve(Math.floor(it.x)-2,Math.floor(it.y)-2,Math.floor(it.x)+2,Math.floor(it.y)+2); g.reserve(56,26,62,36);
  g.sx=L.spawn.x; g.sy=L.spawn.y; g.carve(10,28,12,31,'corridor'); g.reserve(66,16,78,23); g.reserve(9,26,13,33);
  g.scatterProps(['yard'],'crate',1,1,1,g.ri(8,11),2,1,1); g.scatterProps(['yard'],'crate',1,2,1,g.ri(1,3),2); g.scatterProps(['yard'],'machine',1.6,2,1,g.ri(1,2),2);
  g.scatterProps(['proc'],'conveyor',.7,6,1,g.ri(2,3),2,9); g.scatterProps(['proc'],'conveyor',.7,1,5,g.ri(1,2),2,6); g.scatterProps(['proc'],'machine',1.8,2,2,g.ri(2,4),3); g.scatterProps(['proc'],'rack',1.6,3,1,g.ri(1,3),2,4); g.scatterProps(['proc'],'crate',1,1,1,g.ri(3,6),2);
  g.scatterProps(['junction'],'rack',1.6,1,3,g.ri(1,3),2); g.scatterProps(['junction'],'machine',1.5,1,2,g.ri(1,3),2);
  { const cy=19.5; const n=g.ri(4,7); for(let k=0;k<n*10&&k<80;k++){ const x=g.ri(69,82), y=g.ri(10,28); if(Math.abs(y+.5-cy)<2.5&&x<72||!g.clr(x,y,4.2)) continue; if(g.block(x,y,'pillar',2.2,1,1,4)) { const my=Math.round(2*cy-y-1); if(my!==y) g.block(x,my,'pillar',2.2,1,1,4); } } }
  g.scatterProps(['salvage'],'rack',1.4,3,1,g.ri(1,2),2); g.scatterProps(['salvage'],'crate',1,1,1,g.ri(2,4),2);
  // move the roaming interactables (relay, terminal, controller, cache) to seeded spots in their rooms
  const mv=(id:string,z:Zone[],pref:[number,number],rad:number)=>{ const i=g.interacts.findIndex(x=>x.id===id); if(i<0) return; const old=g.interacts[i]; g.interacts.splice(i,1); if(!g.put(id,old.label,old.kind,pref[0],pref[1],rad,z,old.r)) g.interacts.push(old); };
  mv('hackproc',['proc'],[44,g.ri(12,26)],6); mv('terminal',['junction'],[g.ri(53,60),g.ri(11,15)],4); mv('controller',['junction'],[g.ri(56,60),g.ri(16,24)],5); mv('cratechip',['salvage'],[g.ri(7,17),g.ri(37,41)],5);
  // enemy packs: re-cluster each group inside the zone it started in
  const groups=new Map<number,SpawnDef[]>(); for(const s of g.spawns){ (groups.get(s.group)||groups.set(s.group,[]).get(s.group)!).push(s); }
  g.spawns=[]; g.gid=100; for(const [gid,mem] of groups){ if(gid>=90){ g.spawns.push(...mem); continue; } const zn=ZONES[L.zone[mem[0].y*w+mem[0].x]] as Zone; const zs:Zone[]=[zn]; const types=mem.map(m=>m.type); const t=types[0]; if(types.length===1){ g.single(t,gid,0,0,0); g.spawns.pop(); const R=FLOW_R[clsOf(ENEMIES[t].radius)]; const cand=g.tiles(zs).filter(([x,y])=>g.clr(x,y,R)&&Math.hypot(x+.5-g.sx,y+.5-g.sy)>10&&!g.interacts.some(i=>Math.hypot(i.x-x-.5,i.y-y-.5)<2.5)&&!g.spawns.some(s=>Math.hypot(s.x-x,s.y-y)<2.5)); const c=g.pick(cand); if(c) g.spawns.push({type:t,x:c[0],y:c[1],group:gid}); else g.spawns.push(mem[0]); continue; }
    const id=g.pack(zs,types.length,t,{minD:zn==='yard'?7:9}); if(!id){ g.spawns.push(...mem); continue; } for(let i=g.spawns.length-1;i>=0&&g.spawns[i].group===id;i--) g.spawns[i].group=gid; }
  g.prune();
  // mirror vertically half the time (entry, doors, interactables, cache all flip with the tiles)
  const out=g.level({spawn:L.spawn,cps:L.checkpoints,bossSpawn:L.bossSpawn,revealX:L.revealX,salvage:L.salvage,sensors:L.sensors}); out.kind='annex'; out.hazards=[];
  if(g.r()<.5) flipY(out); (out as any).seed=seed; return out;
}
function flipY(L:Level){ const {w,h}=L; const fy=(a:Uint8Array)=>{ const o=new Uint8Array(a.length); for(let y=0;y<h;y++) o.set(a.subarray(y*w,(y+1)*w),(h-1-y)*w); return o; }; L.solid=fy(L.solid); L.zone=fy(L.zone);
  for(const p of L.props) p.y=h-1-p.y; for(const i of L.interacts) i.y=h-i.y; for(const s of L.spawns) s.y=h-1-s.y; for(const c of L.checkpoints) c.y=h-c.y; for(const d of L.doors) for(const t of d.tiles) t[1]=h-1-t[1];
  L.spawn={x:L.spawn.x,y:h-L.spawn.y}; L.bossSpawn={x:L.bossSpawn.x,y:h-L.bossSpawn.y}; L.salvage={x:L.salvage.x,y:h-L.salvage.y}; const sn=L.sensors; L.sensors={x0:sn.x0,x1:sn.x1,y0:h-1-sn.y1,y1:h-1-sn.y0}; }
