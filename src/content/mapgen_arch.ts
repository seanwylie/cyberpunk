// Archetype dungeon generator (docs/MAP_GENERATION.md "Archetypes"). The 20 batch levels used to share ONE macro layout (four rooms in a row,
// joined left to right), so only the room decoration differed. Here each level has a macro ARCHETYPE (room graph + geometry), chosen per level
// (with an occasional alternate), then varied per run seed: room sizes, corridor lengths/offsets, wings/loops, one of the 8 rotations/mirrors,
// objective spots, hazards, boss-arena shape. Everything is a pure function of (spec, seed); a structural check (closed-door reachability stages,
// boss-arena clearance) plus deterministic seed perturbation guarantees the run chain works for every layout.
import type { Level, Zone } from '../level';
import { Gen, rngOf, reachMap, validate, clrAt, FLOW_R } from './mapgen';
import type { Rm } from './mapgen';
import { shapeRoom } from './mapgen_batch1';
import type { LevelSpec, Shape } from './batch1_levels';
import { ENEMIES } from '../config';
import { rollAffixes } from './batch2_rosters';

export type Arch='gauntlet'|'ell'|'zig'|'uturn'|'hub'|'vault'|'floors';
export const ARCHS:Arch[]=['gauntlet','ell','zig','uturn','hub','vault','floors'];
/** [primary, alternate] macro layout per level; the alternate shows up on ~30% of runs so a dungeon keeps its identity but is not one fixed map. */
export const ARCH_OF:Record<string,[Arch,Arch]>={
  coke_ovens:['gauntlet','ell'], substation_12:['hub','uturn'], scrap_gantry:['ell','hub'], tailings_pit:['zig','ell'], bell_foundry:['vault','uturn'],
  cold_archive:['uturn','floors'], audit_tower:['floors','zig'], aesthetic_ward:['hub','vault'], pharmacy_vault:['vault','hub'], anechoic_lab:['uturn','zig'],
  outlet_mall:['hub','ell'], liquidation_floor:['ell','vault'], parcel_tower:['floors','zig'], freight_depot:['gauntlet','ell'], warranty_vault:['vault','uturn'],
  drained_reservoir:['uturn','gauntlet'], night_tunnels:['gauntlet','zig'], breaker_yard:['zig','hub'], radio_mast:['floors','ell'], recall_yard:['ell','hub'] };

const hf=Math.floor;
type Dir='E'|'S'|'W'|'N'; const VEC:Record<Dir,[number,number]>={E:[1,0],S:[0,1],W:[-1,0],N:[0,-1]};
const DIRS:Dir[]=['E','S','W','N'];
interface RR{ id:string; zone:Zone; x:number; y:number; w:number; h:number }
const X1=(r:RR)=>r.x+r.w-1, Y1=(r:RR)=>r.y+r.h-1;
const hit=(a:RR,b:RR,m=3)=>a.x<b.x+b.w+m&&b.x<a.x+a.w+m&&a.y<b.y+b.h+m&&b.y<a.y+a.h+m;
interface Wing{ r:RR; parent:string; dir:Dir; loop:boolean; kind:'salvage'|'wing' }
interface Link{ a:string; b:string; dir:Dir }
interface Plan{ rects:[number,number,number,number][]; from:{x:number;y:number}; to:{x:number;y:number}; doorFrom:[number,number][]; doorTo:[number,number][] }

function placeNext(all:RR[],from:RR,n:RR,d:Dir,gap:number,off:number){
  const [dx,dy]=VEC[d]; if(dx>0) n.x=from.x+from.w+gap; else if(dx<0) n.x=from.x-gap-n.w; if(dy>0) n.y=from.y+from.h+gap; else if(dy<0) n.y=from.y-gap-n.h;
  if(dx!==0) n.y=Math.round(from.y+from.h/2-n.h/2)+off; else n.x=Math.round(from.x+from.w/2-n.w/2)+off;
  for(let k=0;k<80&&all.some(r=>r!==from&&hit(r,n));k++){ n.x+=dx; n.y+=dy; }
  if(all.some(r=>r!==from&&hit(r,n))) throw new Error('place');
}

interface Layout{ rooms:Record<'Y'|'P'|'J'|'B',RR>; links:Link[]; wings:Wing[] }
/** Canonical (pre-rotation) macro layouts. dims = per-room [w,h] from the level spec (already seed-jittered). */
function layout(arch:Arch,dims:[number,number][],ri:(a:number,b:number)=>number,spec:LevelSpec):Layout{
  const mk=(id:'Y'|'P'|'J'|'B',zone:Zone,i:number,dw=0,dh=0):RR=>({id,zone,x:0,y:0,w:Math.max(id==='B'?20:14,dims[i][0]+dw),h:Math.max(id==='B'?20:13,dims[i][1]+dh)});
  let Y:RR,P:RR,J:RR,B:RR; let dirs:Dir[]; let gaps:number[]; let offs:number[];
  switch(arch){
    case 'gauntlet': Y=mk('Y','yard',0,0,-4); P=mk('P','proc',1,2,-5); J=mk('J','junction',2,0,-3); B=mk('B','boss',3,0,-2); dirs=['E','E','E']; gaps=[ri(6,9),ri(6,9),ri(6,8)]; offs=[ri(-5,5),ri(-5,5),ri(-4,4)]; break;
    case 'ell': Y=mk('Y','yard',0); P=mk('P','proc',1,2,0); J=mk('J','junction',2); B=mk('B','boss',3,2,2); dirs=['E','E','S']; gaps=[ri(6,9),ri(6,9),ri(6,9)]; offs=[ri(-4,4),ri(-3,3),ri(-6,6)]; break;
    case 'zig': Y=mk('Y','yard',0); P=mk('P','proc',1); J=mk('J','junction',2,2); B=mk('B','boss',3); dirs=['E','S','E']; gaps=[ri(6,8),ri(6,9),ri(6,8)]; offs=[ri(-3,3),ri(-10,-4)*(ri(0,1)?1:-1),ri(-3,3)]; break;
    case 'uturn': Y=mk('Y','yard',0); P=mk('P','proc',1,0,-2); J=mk('J','junction',2,2,-1); B=mk('B','boss',3,0,0); dirs=['E','S','W']; gaps=[ri(6,8),ri(6,9),ri(6,8)]; offs=[ri(-3,3),ri(-4,4),ri(-3,3)]; break;
    case 'hub': Y=mk('Y','yard',0,-2,-2); P=mk('P','proc',1,6,5); J=mk('J','junction',2,0,0); B=mk('B','boss',3); dirs=['E','N','E']; gaps=[ri(6,7),ri(6,7),ri(6,8)]; offs=[ri(-4,4),ri(-5,5),ri(-3,3)]; break;
    case 'vault': Y=mk('Y','yard',0); P=mk('P','proc',1,0,-1); J=mk('J','junction',2,2,4); B=mk('B','boss',3,8,4); dirs=['E','E','E']; gaps=[ri(6,8),ri(6,8),ri(6,7)]; offs=[ri(-3,3),ri(-3,3),ri(-3,3)]; break;
    default: /* floors: wide flat storeys stacked top to bottom, doors alternate between the left and right ends */ { const fw=(i:number)=>dims[i][0]+10; Y=mk('Y','yard',0,fw(0)-dims[0][0],-5); P=mk('P','proc',1,fw(1)-dims[1][0],-7); J=mk('J','junction',2,fw(2)-dims[2][0],-5); B=mk('B','boss',3,6,0); const s=ri(0,1)?1:-1; dirs=['S','S','S']; gaps=[ri(6,8),ri(6,8),ri(6,8)]; offs=[s*ri(8,13),-s*ri(8,13),s*ri(6,10)]; } }
  const rs=[Y,P,J,B]; Y.x=Y.y=0; for(let i=0;i<3;i++) placeNext(rs.slice(0,i+1),rs[i],rs[i+1],dirs[i],gaps[i],offs[i]);
  const all:RR[]=[...rs]; const wings:Wing[]=[]; const links:Link[]=[{a:'Y',b:'P',dir:dirs[0]},{a:'P',b:'J',dir:dirs[1]},{a:'J',b:'B',dir:dirs[2]}];
  const by:Record<string,RR>={Y,P,J,B};
  const addWing=(parent:string,kind:'salvage'|'wing',w:number,h:number,loop:boolean,prefer:Dir[]):boolean=>{
    const par=by[parent]; const order=[...prefer,...DIRS.filter(d=>!prefer.includes(d))];
    for(const d of order){ const r:RR={id:'W'+wings.length,zone:kind==='salvage'?'salvage':'passage',x:0,y:0,w,h}; const gap=ri(6,8); const [dx,dy]=VEC[d];
      if(dx>0) r.x=par.x+par.w+gap; else if(dx<0) r.x=par.x-gap-w; if(dy>0) r.y=par.y+par.h+gap; else if(dy<0) r.y=par.y-gap-h;
      const off=loop?0:ri(-4,4); if(dx!==0) r.y=Math.round(par.y+par.h/2-h/2)+off; else r.x=Math.round(par.x+par.w/2-w/2)+off;
      if(all.some(o=>hit(o,r))) continue;
      // a loop wing needs two well-separated rows on the shared edge
      const lo=dx!==0?Math.max(par.y,r.y)+2:Math.max(par.x,r.x)+2, hi=dx!==0?Math.min(Y1(par),Y1(r))-2:Math.min(X1(par),X1(r))-2;
      all.push(r); by[r.id]=r; wings.push({r,parent,dir:d,loop:loop&&hi-lo>=6,kind}); links.push({a:parent,b:r.id,dir:d}); return true; }
    return false; };
  const sal=['Y','Y','P','J'][ri(0,3)]; const sw=ri(12,15), sh=ri(8,10);
  switch(arch){
    case 'hub': addWing('P','wing',ri(14,17),ri(12,15),true,['S','E','W']); addWing('P','wing',ri(12,15),ri(12,14),false,['S','W','E']); addWing('Y','wing',ri(12,14),ri(12,14),false,['S','N']); break;
    case 'vault': addWing('J','wing',ri(14,18),ri(12,14),true,['N','S']); addWing('J','wing',ri(14,16),ri(12,14),true,['S','N']); addWing('P','wing',ri(13,16),ri(12,14),ri(0,1)===1,['N','S']); break;
    case 'gauntlet': if(ri(0,1)) addWing('P','wing',ri(14,18),ri(11,13),false,['N','S']); break;
    case 'ell': case 'uturn': if(ri(0,2)) addWing('P','wing',ri(14,16),ri(12,14),true,['N','S','E']); break;
    case 'zig': addWing('J','wing',ri(13,16),ri(12,14),false,['S','N','W']); break;
    default: if(ri(0,1)) addWing('P','wing',ri(14,16),ri(12,13),true,['E','W']); }
  if(!addWing(sal,'salvage',sw,sh,false,['S','N','E','W'])&&!addWing('J','salvage',sw,sh,false,DIRS)&&!addWing('Y','salvage',sw,sh,false,DIRS)) throw new Error('salvage');
  void spec; return { rooms:{Y,P,J,B}, links, wings };
}

// ---------------- geometry transforms (8 symmetries of the square) ----------------
function symRect(r:RR,t:number):RR{ let {x,y,w,h}=r; if(t&1){ [x,y]=[y,x]; [w,h]=[h,w]; } if(t&2) x=-(x+w-1); if(t&4) y=-(y+h-1); return {...r,x,y,w,h}; }
function symDir(d:Dir,t:number):Dir{ let [dx,dy]=VEC[d]; if(t&1) [dx,dy]=[dy,dx]; if(t&2) dx=-dx; if(t&4) dy=-dy; return DIRS.find(k=>VEC[k][0]===dx&&VEC[k][1]===dy)!; }

/** corridor plan for B lying to the east of A (3 wide, optional dogleg, door cross-sections sit right outside each room edge and stay straight) */
function planE(A:RR,B:RR,ri:(a:number,b:number)=>number,rows?:[number,number]):Plan{
  const ax1=X1(A), bx0=B.x; if(bx0-ax1<6) throw new Error('gap');
  const lo=Math.max(A.y,B.y)+2, hi=Math.min(Y1(A),Y1(B))-2; let ya:number,yb:number;
  if(rows){ [ya,yb]=rows; } else if(hi>=lo&&ri(0,9)<6){ ya=yb=ri(lo,hi); } else { ya=ri(A.y+2,Y1(A)-2); yb=ri(B.y+2,Y1(B)-2); }
  const xm=ri(ax1+3,bx0-3);
  return { rects:[[ax1+1,ya-1,xm,ya+1],[xm-1,Math.min(ya,yb)-1,xm+1,Math.max(ya,yb)+1],[xm,yb-1,bx0-1,yb+1]], from:{x:ax1,y:ya}, to:{x:bx0,y:yb}, doorFrom:[[ax1+1,ya-1],[ax1+1,ya],[ax1+1,ya+1]], doorTo:[[bx0-1,yb-1],[bx0-1,yb],[bx0-1,yb+1]] };
}
const tr=(r:RR):RR=>({...r,x:r.y,y:r.x,w:r.h,h:r.w});
function planLink(A:RR,B:RR,dir:Dir,ri:(a:number,b:number)=>number,rows?:[number,number]):Plan{
  const flip=(p:Plan):Plan=>({ rects:p.rects.map(([a,b,c,d])=>[b,a,d,c] as [number,number,number,number]), from:{x:p.from.y,y:p.from.x}, to:{x:p.to.y,y:p.to.x}, doorFrom:p.doorFrom.map(([a,b])=>[b,a] as [number,number]), doorTo:p.doorTo.map(([a,b])=>[b,a] as [number,number]) });
  const swap=(p:Plan):Plan=>({ rects:p.rects, from:p.to, to:p.from, doorFrom:p.doorTo, doorTo:p.doorFrom });
  switch(dir){ case 'E': return planE(A,B,ri,rows); case 'S': return flip(planE(tr(A),tr(B),ri,rows)); case 'W': return swap(planE(B,A,ri,rows&&[rows[1],rows[0]])); default: return swap(flip(planE(tr(B),tr(A),ri,rows&&[rows[1],rows[0]]))); }
}

// ---------------- boss arenas (shape follows the level's boss-room shape) ----------------
type ArenaKind='ring'|'dais'|'hall'|'lanes'|'octagon'|'cross4'|'split'|'islands';
const ARENA_OF:Record<Shape,ArenaKind>={ open:'lanes', pillars:'hall', rings:'octagon', diag:'lanes', cave:'octagon', river:'split', maze:'islands', islands:'islands', colonnade:'hall', pit:'ring', zigzag:'split', cross:'cross4' };
function arena(g:Gen,B:RR,kind:ArenaKind,mouth:{x:number;y:number},inward:Dir){
  const cx=B.x+hf(B.w/2), cy=B.y+hf(B.h/2); const horiz=VEC[inward][0]!==0; const [vx,vy]=VEC[inward];
  g.reserve(mouth.x-4,mouth.y-4,mouth.x+4,mouth.y+4);
  const mir=(x:number,y:number):[number,number]=>horiz?[x,2*cy-y]:[2*cx-x,y];
  const pairs=(n:number,minR:number,h:number,gap=4)=>{ for(let k=0;k<n*25;k++){ if(!n) break; const x=g.ri(B.x+3,X1(B)-3), y=g.ri(B.y+3,Y1(B)-3); if(Math.hypot(x-cx,y-cy)<minR||Math.hypot(x-mouth.x,y-mouth.y)<7||!g.clr(x,y,3.6)) continue; const [mx,my]=mir(x,y); if(mx===x&&my===y) continue; if(g.block(x,y,'pillar',h,1,1,gap)){ g.block(mx,my,'pillar',h,1,1,gap-1); n--; } } };
  const [vxu,vyu]=[vx,vy];
  switch(kind){
    case 'ring': g.block(cx-2,cy-2,'machine',2.4,5,5); pairs(g.ri(3,5),4.5,2.2); break;
    case 'dais': g.block(cx-2,cy-2,'machine',2,4,4); pairs(g.ri(3,5),4.5,2.2); break;
    case 'hall': pairs(g.ri(4,6),2,2.4); break;
    case 'lanes': for(const s of [-1,1]){ const L=g.ri(6,9); const off=s*g.ri(5,6); if(horiz) g.block(cx-hf(L/2)+g.ri(-2,2),cy+off,'rack',1.6,L,1,1); else g.block(cx+off,cy-hf(L/2)+g.ri(-2,2),'rack',1.6,1,L,1); } pairs(g.ri(2,3),4.5,2.2); break;
    case 'octagon': { const c=g.ri(4,6); for(const [sx,sy] of [[1,1],[1,-1],[-1,1],[-1,-1]]){ const ox=sx>0?X1(B):B.x, oy=sy>0?Y1(B):B.y; for(let j=0;j<c;j++)for(let i=0;i<c-j;i++){ const x=ox-sx*i, y=oy-sy*j; if(Math.hypot(x-mouth.x,y-mouth.y)<6||g.keep[y*g.w+x]) continue; g.solid[y*g.w+x]=1; } } pairs(g.ri(2,3),4,2.2); break; }
    case 'cross4': { const d=g.ri(5,7); for(const [sx,sy] of [[1,1],[1,-1],[-1,1],[-1,-1]]) g.block(cx+sx*d-1,cy+sy*d-1,'machine',1.8,3,3,1); pairs(g.ri(1,2),3,2.2); break; }
    case 'split': { const len=hf((horiz?B.h:B.w)*.5); for(let t=-hf(len/2);t<=hf(len/2);t++){ const x=horiz?cx:cx+t, y=horiz?cy+t:cy; if(g.keep[y*g.w+x]) continue; g.solid[y*g.w+x]=1; g.pm[y*g.w+x]=1; } pairs(g.ri(2,3),5,2.2); break; }
    default: for(let k=0;k<g.ri(6,9)*8;k++){ const x=g.ri(B.x+3,X1(B)-4), y=g.ri(B.y+3,Y1(B)-4); if(Math.hypot(x-mouth.x,y-mouth.y)<8||Math.hypot(x-cx,y-cy)<3) continue; g.block(x,y,'machine',1.6,2,2,3); }
  }
  void vxu; void vyu;
  // boss spawns on the far side of the centre from the door
  const far=Math.round(Math.min(B.w,B.h)*.22); let best:{x:number;y:number}|null=null; for(let r=0;r<10&&!best;r++) for(const [ox,oy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){ const x=cx+vx*far+ox*r, y=cy+vy*far+oy*r; if(g.inb(x,y)&&g.clr(x,y,1.2)){ best={x,y}; break; } }
  if(!best) throw new Error('boss spawn'); g.reserve(best.x-3,best.y-3,best.x+3,best.y+3);
  return { spawn:{x:best.x+.5,y:best.y+.5}, cx, cy };
}

function dress(g:Gen,r:RR,mfr:string,n:number){
  // manufacturer cover themes: HI = heavy machinery + conveyors, PS = partition stubs + cabinets, MM = shelving blocks + pallets
  if(mfr==='HI'){ g.scatterProps([r.zone],'machine',2,3,3,hf(n/2)+g.ri(0,1),3); g.scatterProps([r.zone],'conveyor',.7,7,1,g.ri(0,1),2,9); }
  else if(mfr==='PS'){ for(let k=0;k<n;k++){ const x=g.ri(r.x+3,X1(r)-6), y=g.ri(r.y+3,Y1(r)-3); const L=g.ri(3,5); g.block(x,y,'rack',1.4,L,1,3); } g.scatterProps([r.zone],'crate',.9,1,1,g.ri(1,3),2); }
  else { g.scatterProps([r.zone],'rack',2,4,2,hf(n/2)+g.ri(0,1),2,6); g.scatterProps([r.zone],'crate',1,2,2,g.ri(1,3),2); }
}

// ---------------- generator ----------------
export function genArch(spec:LevelSpec,seed:number):Level{
  let last:Level|null=null, lastErr='';
  for(let k=0;k<60;k++){ const s=(seed+k*7919)>>>0; try{ const L=once(spec,s); (L as any).attempt=k; (L as any).seed=seed; last=L; const bad=archCheck(L); if(!bad.length) return L; lastErr=bad.slice(0,3).join('; '); }catch(e:any){ lastErr=String(e&&e.message||e); if(!/^(place|gap|salvage|boss spawn|corridor)/.test(lastErr)) throw e; } }
  console.warn('mapgen_arch: '+spec.id+' seed '+seed+' failed: '+lastErr); if(last) return last; throw new Error('mapgen_arch '+spec.id+' '+lastErr);
}
export function archOfSeed(spec:LevelSpec,seed:number):Arch{ const ps=ARCH_OF[spec.id]||['gauntlet','ell']; let h0=0; for(const c of spec.id) h0=(h0*31+c.charCodeAt(0))>>>0; const q=rngOf(seed^h0^0x51ed270b); return q()<.3?ps[1]:ps[0]; }

function once(spec:LevelSpec,seed:number):Level{
  let h0=0; for(const c of spec.id) h0=(h0*31+c.charCodeAt(0))>>>0; const q=rngOf(seed^h0^0x51ed270b); const ri=(a:number,b:number)=>a+Math.floor(q()*(b-a+1));
  const arch=ri(0,99)<30?ARCH_OF[spec.id][1]:ARCH_OF[spec.id][0];
  const dims=spec.dims.map(([w,h])=>[w+ri(-2,2),h+ri(-2,2)] as [number,number]);
  const lay=layout(arch,dims,ri,spec); const t=ri(0,7);
  const rooms:Record<string,RR>={...lay.rooms}; for(const w of lay.wings) rooms[w.r.id]=w.r;
  for(const id of Object.keys(rooms)) rooms[id]=symRect(rooms[id],t);
  const links=lay.links.map(l=>({...l,dir:symDir(l.dir,t)}));
  // normalise to a 3-tile margin
  let mx=1e9,my=1e9,Mx=-1e9,My=-1e9; for(const r of Object.values(rooms)){ mx=Math.min(mx,r.x); my=Math.min(my,r.y); Mx=Math.max(Mx,X1(r)); My=Math.max(My,Y1(r)); }
  for(const r of Object.values(rooms)){ r.x-=mx-3; r.y-=my-3; } const W=Mx-mx+7, H=My-my+7;
  const g=new Gen(W,H,seed); const {Y,P,J,B}=rooms as Record<'Y'|'P'|'J'|'B',RR>; const toRm=(r:RR):Rm=>({zone:r.zone,x0:r.x,y0:r.y,x1:X1(r),y1:Y1(r),cy:r.y+hf(r.h/2)});
  for(const r of Object.values(rooms)) g.carve(r.x,r.y,X1(r),Y1(r),r.zone);
  // corridors (primary chain first); every corridor must stay clear of rooms that are not its endpoints
  const plans:{l:Link;p:Plan;loop?:Plan}[]=[]; const doorsPlan:Record<string,Plan>={};
  const check=(l:Link,p:Plan)=>{ for(const [a,b,c,d] of p.rects) for(const [id,r] of Object.entries(rooms)){ if(id===l.a||id===l.b) continue; if(a-1<=X1(r)&&c+1>=r.x&&b-1<=Y1(r)&&d+1>=r.y) throw new Error('corridor hits '+id); } };
  const lw=new Map(lay.wings.map(w=>[w.r.id,w])); const mouths:Record<string,{x:number;y:number}[]>={};
  const addMouth=(id:string,m:{x:number;y:number})=>{ (mouths[id]||(mouths[id]=[])).push(m); };
  for(const l of links){ const A=rooms[l.a], Bq=rooms[l.b]; const w=lw.get(l.b); let p:Plan, p2:Plan|undefined;
    if(w&&w.loop){ // two well separated corridors between parent and wing (a loop)
      const horizontal=l.dir==='E'||l.dir==='W'; const lo=horizontal?Math.max(A.y,Bq.y)+2:Math.max(A.x,Bq.x)+2, hi=horizontal?Math.min(Y1(A),Y1(Bq))-2:Math.min(X1(A),X1(Bq))-2;
      if(hi-lo>=6){ const r1=ri(lo,lo+2), r2=ri(hi-2,hi); p=planLink(A,Bq,l.dir,ri,[r1,r1]); p2=planLink(A,Bq,l.dir,ri,[r2,r2]); } else p=planLink(A,Bq,l.dir,ri); }
    else p=planLink(A,Bq,l.dir,ri);
    check(l,p); if(p2) check(l,p2); plans.push({l,p,loop:p2}); addMouth(l.a,p.from); addMouth(l.b,p.to); if(p2){ addMouth(l.a,p2.from); addMouth(l.b,p2.to); } }
  for(const {p,loop} of plans) for(const pl of [p,loop]) if(pl) for(const [a,b,c,d] of pl.rects){ g.carve(a,b,c,d,'corridor'); g.reserve(a-1,b-1,c+1,d+1); }
  const [lY,lP,lJ]=plans; const names=spec.zoneLabels;
  g.door('gate1',names.yard+' gate',lY.p.doorFrom); g.door('lock2',names.proc+' lock',lP.p.doorFrom); g.door('boss',names.boss+' door',lJ.p.doorFrom);
  void doorsPlan;
  // in-room guaranteed routes (3 wide, reserved from decoration)
  const route=(r:RR,a:{x:number;y:number},b:{x:number;y:number})=>{ const cl=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v)); const ax=cl(a.x,r.x,X1(r)), ay=cl(a.y,r.y,Y1(r)), bx=cl(b.x,r.x,X1(r)), by=cl(b.y,r.y,Y1(r));
    const seg=(x0:number,y0:number,x1:number,y1:number)=>{ const X0=Math.max(r.x,Math.min(x0,x1)-1), Y0=Math.max(r.y,Math.min(y0,y1)-1), XX=Math.min(X1(r),Math.max(x0,x1)+1), YY=Math.min(Y1(r),Math.max(y0,y1)+1); g.carve(X0,Y0,XX,YY,r.zone); g.reserve(X0,Y0,XX,YY); };
    if(ri(0,1)){ seg(ax,ay,bx,ay); seg(bx,ay,bx,by); } else { seg(ax,ay,ax,by); seg(ax,by,bx,by); } };
  const mid=(r:RR)=>({x:r.x+hf(r.w/2),y:r.y+hf(r.h/2)});
  const inDir=(d:Dir,n:number,p:{x:number;y:number})=>({x:p.x+VEC[d][0]*n,y:p.y+VEC[d][1]*n});
  // entry: far corner of the yard from its exit mouth
  const yExit=lY.p.from; const yc=mid(Y); const sp0={x:Math.max(Y.x+2,Math.min(X1(Y)-2,2*yc.x-yExit.x)),y:Math.max(Y.y+2,Math.min(Y1(Y)-2,2*yc.y-yExit.y))};
  const spawn={x:sp0.x+.5,y:sp0.y+.5}; g.sx=spawn.x; g.sy=spawn.y; g.reserve(sp0.x-3,sp0.y-3,sp0.x+3,sp0.y+3);
  route(Y,sp0,yExit); route(P,lY.p.to,lP.p.from); route(J,lP.p.to,lJ.p.from);
  for(const w of lay.wings){ const r=rooms[w.r.id]; for(const m of mouths[r.id]||[]) { g.reserve(m.x-3,m.y-3,m.x+3,m.y+3); } if((mouths[r.id]||[]).length>1) route(r,mouths[r.id][0],mouths[r.id][1]); }
  for(const id of ['P','J','Y']) for(const m of mouths[id]||[]) g.reserve(m.x-3,m.y-3,m.x+3,m.y+3);
  // decoration: spec room shapes + manufacturer cover
  const ph=spec.mfr==='PS'?2.4:2.2; for(const [id,i] of [['Y',0],['P',1],['J',2]] as [string,number][]){ const r=rooms[id]; shapeRoom(g,toRm(r),spec.shapes[i],spec.props,ph); dress(g,r,spec.mfr,3); }
  for(const w of lay.wings){ const r=rooms[w.r.id]; if(w.kind==='salvage') g.scatterProps(['salvage'],'crate',1,1,1,g.ri(3,6),2); else { shapeRoom(g,toRm(r),(['open','pillars','islands','colonnade'] as Shape[])[ri(0,3)],spec.props,ph); } }
  const bossIn=lJ.p.to; const bInward=links[2].dir; const ba=arena(g,B,ARENA_OF[spec.shapes[3]],bossIn,bInward); g.reserve(bossIn.x-3,bossIn.y-3,bossIn.x+3,bossIn.y+3);
  hazards(g,spec,rooms as any,ri);
  // objectives: seeded spot style (near the exit, tucked in a far corner, or mid-room) so the run route differs per seed
  const spot=(r:RR,entry:{x:number;y:number},exit:{x:number;y:number},zs:Zone[],rad:number):{x:number;y:number;rad:number}=>{ const m=ri(0,2); if(m===0){ const p=inDir(links.find(l=>l.b===r.id)!.dir,0,exit); return {x:p.x-(exit.x>mid(r).x?2:-2)+ri(-3,3),y:p.y+ri(-4,4),rad}; } if(m===1){ const tl=g.tiles(zs).filter(([x,y])=>g.clr(x,y,1)); tl.sort((a,b)=>(Math.min(Math.hypot(b[0]-entry.x,b[1]-entry.y),Math.hypot(b[0]-exit.x,b[1]-exit.y)))-(Math.min(Math.hypot(a[0]-entry.x,a[1]-entry.y),Math.hypot(a[0]-exit.x,a[1]-exit.y)))); const c=tl[Math.min(tl.length-1,ri(0,Math.max(0,hf(tl.length*.08))))]; return c?{x:c[0],y:c[1],rad:3}:{x:mid(r).x,y:mid(r).y,rad}; } const c=mid(r); return {x:c.x+ri(-4,4),y:c.y+ri(-4,4),rad:rad+2}; };
  const sp1=spot(P,lY.p.to,lP.p.from,['proc'],5); g.put('hackproc',spec.objective.relay+' (hack: reroute locks)','hack',sp1.x,sp1.y,sp1.rad,['proc']);
  const sp2=spot(J,lP.p.to,lJ.p.from,['junction'],6); g.put('controller',spec.objective.label+' (objective)','controller',sp2.x,sp2.y,sp2.rad,['junction'],1.6);
  const S=lay.wings.find(w=>w.kind==='salvage')!; const SR=rooms[S.r.id]; g.put('cratechip',spec.objective.bonus+' (bonus chips)','crate',SR.x+SR.w-2.5,SR.y+SR.h-2,6,['salvage'],1.5);
  // enemies
  const ro=spec.roster; const eq=(tp:string)=>tp===spec.gateGuard||tp===spec.lockElite;
  { // both gate guards stand on the spawn side of the gate (inside the yard): a guard behind the gate made it impossible to open (guards are what open it)
    const horiz=Math.abs(yc.x-yExit.x)>Math.abs(yc.y-yExit.y); const bx=horiz?Math.sign(yc.x-yExit.x)||1:0, by=horiz?0:(Math.sign(yc.y-yExit.y)||1), sx=horiz?0:1, sy=horiz?1:0;
    const gp=(side:number)=>{ const back=g.ri(3,5), lat=side*g.ri(2,4); return { x:Math.max(Y.x+1.5,Math.min(X1(Y)-1.5,yExit.x+bx*back+sx*lat)), y:Math.max(Y.y+1.5,Math.min(Y1(Y)-1.5,yExit.y+by*back+sy*lat)) }; };
    const g1=gp(-1), g2=gp(1); g.single(spec.gateGuard,90,g1.x,g1.y); g.single(spec.gateGuard,91,g2.x,g2.y); } { const a=g.spawns.length; void a; }
  const place=(zs:Zone[],list:[string,number][],minD?:number)=>{ for(const [tp,n] of list){ if(n<=0||eq(tp)) continue; g.pack(zs,n,tp,{minD}); } };
  const half=(qq:[string,number][])=>qq.map(([tp,n])=>[tp,Math.max(1,Math.ceil(n/2))] as [string,number]);
  if(spec.squads){ const zmap:[Zone,Zone[],number][]=[['yard',['yard'],7],['proc',['proc'],8],['junction',['junction'],6],['salvage',['salvage'],5]];
    for(const [kz,zs,minD] of zmap){ const sq=spec.squads[kz as 'yard'|'proc'|'junction'|'salvage']; for(const s of sq) g.squad(zs,s,{minD}); if(kz!=='salvage') for(const s of sq) g.squad(zs,half(s),{minD}); } }
  else { place(['yard'],ro.yard,7); place(['yard'],half(ro.yard),7); place(['proc'],ro.proc,8); place(['proc'],half(ro.proc),8); place(['junction'],ro.junction,6); place(['junction'],half(ro.junction),6); place(['salvage'],ro.salvage,5); }
  for(const w of lay.wings) if(w.kind==='wing'){ const src=ro.proc.filter(([tp])=>!eq(tp)); if(src.length) g.pack(['passage'],Math.max(3,Math.ceil(src[0][1]/2)),src[0][0],{minD:6}); }
  const pe=lP.p.from; const jc=mid(J);
  g.single(spec.lockElite,50,pe.x,pe.y,6,['proc']); g.single(spec.lockElite==='brakeman'?'quenchpriest':spec.lockElite==='quenchpriest'?'brakeman':spec.lockElite==='matron'?'anesthetist':spec.lockElite==='anesthetist'?'matron':spec.lockElite==='shiftlead'?'hobbs':spec.lockElite==='hobbs'?'shiftlead':spec.lockElite==='sawhand'?'foreman':'sawhand',55,jc.x,jc.y,5,['junction']);
  for(const rad of [12,20]) if(!g.spawns.some(s=>s.type===spec.lockElite)) g.single(spec.lockElite,50,pe.x,pe.y,rad,['proc']); // the lock elite must always exist: widen the search when the procedure room is cramped
  g.prune();
  { const seen=new Set<number>(); for(const s of g.spawns){ if(s.group>=90||seen.has(s.group)) continue; seen.add(s.group); const mem=g.spawns.filter(m=>m.group===s.group); const lead=mem.slice().sort((a,b)=>(ENEMIES[b.type]?.hp||0)-(ENEMIES[a.type]?.hp||0))[0]; if(!lead||mem.length<2) continue; const af=rollAffixes(lead.type,spec.tier,()=>g.r()); if(af.length) lead.affix=af; } }
  const cp2=inDir(links[1].dir,3,lP.p.to);
  const L=g.level({spawn,cps:[{id:1,x:spawn.x,y:spawn.y,label:names.yard},{id:2,x:cp2.x+.5,y:cp2.y+.5,label:names.junction}],bossSpawn:ba.spawn,revealX:0,salvage:{x:SR.x+SR.w/2,y:SR.y+hf(SR.h/2)}});
  const rv=inDir(bInward,2,bossIn); L.reveal={x:rv.x+.5,y:rv.y+.5,r:2.4};
  (L as any).noConds=true; L.theme=spec.theme;
  (L as any).arch={ name:arch, sym:t, rooms:Object.values(rooms).map(r=>({id:r.id,zone:r.zone,x:r.x,y:r.y,w:r.w,h:r.h})), links:links.map(l=>({a:l.a,b:l.b,dir:l.dir})), arena:ARENA_OF[spec.shapes[3]], bossIn:{...bossIn} };
  return L;
}

function hazards(g:Gen,spec:LevelSpec,rooms:Record<string,RR>,ri:(a:number,b:number)=>number){ const hz=spec.haz; if(hz.mode==='none'||hz.n<=0) return; const {Y,P,J,B}=rooms; const lab=hz.label;
  const add=(x:number,y:number)=>{ if(g.solid[hf(y)*g.w+hf(x)]||g.keep[hf(y)*g.w+hf(x)]) return; g.hz(x,y,hz.r,hz.dps,hz.heat,lab); };
  const wide=P.w>=P.h;
  if(hz.mode==='channels'){ for(let k=0;k<hz.n;k++){ const c=(wide?P.x+Math.round((k+1)*P.w/(hz.n+1)):P.y+Math.round((k+1)*P.h/(hz.n+1)))+ri(-3,3); const bys=Array.from({length:ri(1,3)},()=>(wide?ri(P.y+4,Y1(P)-4):ri(P.x+4,X1(P)-4)));
      if(wide) g.hline(c+.5,P.y+1.5,c+.5,Y1(P)-.5,1.6,hz.r,hz.dps,hz.heat,lab,(x,y)=>bys.some(b=>Math.abs(y-b-.5)<2.6)||g.keep[hf(y)*g.w+hf(x)]===1); else g.hline(P.x+1.5,c+.5,X1(P)-.5,c+.5,1.6,hz.r,hz.dps,hz.heat,lab,(x,y)=>bys.some(b=>Math.abs(x-b-.5)<2.6)||g.keep[hf(y)*g.w+hf(x)]===1); } }
  else if(hz.mode==='scatter'){ for(const r of [Y,P,J]) for(let k=0;k<hz.n/2+ri(0,2);k++){ for(let t=0;t<20;t++){ const x=ri(r.x+3,X1(r)-3), y=ri(r.y+3,Y1(r)-3); if(g.solid[y*g.w+x]||g.keep[y*g.w+x]||!g.clr(x,y,1)) continue; add(x+.5,y+.5); break; } } }
  else if(hz.mode==='ring'){ const cx=B.x+hf(B.w/2), cy=B.y+hf(B.h/2), rn=hz.n, rr=ri(44,52)/10, gapI=ri(0,rn-1); for(let i=0;i<rn;i++){ if(i===gapI) continue; const a=i/rn*Math.PI*2; add(cx+.5+Math.cos(a)*rr,cy+.5+Math.sin(a)*rr); } for(let k=0;k<3;k++){ const x=ri(P.x+3,X1(P)-3), y=ri(P.y+3,Y1(P)-3); if(!g.solid[y*g.w+x]&&!g.keep[y*g.w+x]) add(x+.5,y+.5); } }
  else if(hz.mode==='lanes'){ for(const r of [P,J]){ const al=r.w>=r.h; for(let k=0;k<hz.n;k++){ if(al){ const y=r.y+3+hf((k+.5)*(r.h-5)/hz.n)+ri(-1,1); const gx=ri(r.x+4,X1(r)-6); g.hline(r.x+1.5,y+.5,X1(r)-.5,y+.5,1.7,hz.r,hz.dps,hz.heat,lab,(x)=>Math.abs(x-gx)<2.6||g.keep[y*g.w+hf(x)]===1); } else { const x=r.x+3+hf((k+.5)*(r.w-5)/hz.n)+ri(-1,1); const gy=ri(r.y+4,Y1(r)-6); g.hline(x+.5,r.y+1.5,x+.5,Y1(r)-.5,1.7,hz.r,hz.dps,hz.heat,lab,(_x,y)=>Math.abs(y-gy)<2.6||g.keep[hf(y)*g.w+x]===1); } } } } }

// ---------------- structural check ----------------
/** BFS over class-0 clearance tiles with the given doors treated as open. */
function bfs(L:Level,from:{x:number;y:number},open:string[]){ const w=L.w; const s=new Uint8Array(L.solid); for(const d of L.doors) if(open.includes(d.id)) for(const [x,y] of d.tiles) s[y*w+x]=0; const seen=new Uint8Array(s.length); const q=[hf(from.y)*w+hf(from.x)]; seen[q[0]]=1; for(let h=0;h<q.length;h++){ const c=q[h], cx=c%w, cy=(c/w)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=L.h) continue; const i=ny*w+nx; if(seen[i]||s[i]) continue; seen[i]=1; q.push(i); } } return seen; }
/** Problems that would break the run chain / boss mechanics (empty = fine). Also used by tests/mapvary2.mjs. */
export function archCheck(L:Level):string[]{
  const bad=validate(L); const w=L.w; const at=(p:{x:number;y:number})=>hf(p.y)*w+hf(p.x); const it=(id:string)=>L.interacts.find(i=>i.id===id)!;
  for(const id of ['hackproc','controller','cratechip']) if(!L.interacts.some(i=>i.id===id)) return [...bad,'missing '+id];
  const cp2=L.checkpoints[1]; const s0=bfs(L,L.spawn,[]), s1=bfs(L,L.spawn,['gate1']), s2=bfs(L,L.spawn,['gate1','lock2']);
  if(!s1[at(it('hackproc'))]) bad.push('relay unreachable after gate1'); if(s0[at(it('hackproc'))]) bad.push('relay reachable with gate closed');
  if(s1[at(it('controller'))]||s1[at(cp2)]) bad.push('control room reachable past closed lock'); if(!s2[at(it('controller'))]||!s2[at(cp2)]) bad.push('control room unreachable after lock');
  if(s2[at(L.bossSpawn)]) bad.push('boss reachable past closed boss door'); if(!bfs(L,L.spawn,['gate1','lock2','boss'])[at(L.bossSpawn)]) bad.push('boss unreachable when open');
  // boss arena fits the mechanics: enough floor, boss-radius clearance covers most of it, spawn is not on top of the door
  const zi=L.zoneNames.indexOf('boss'); let floor=0; const bt:number[]=[]; for(let i=0;i<L.zone.length;i++) if(!L.solid[i]&&L.zone[i]===zi){ floor++; bt.push(i); }
  if(floor<300) bad.push('boss arena too small ('+floor+')');
  const r2=reachMap(L,L.spawn,2); let ok2=0; for(const i of bt) if(r2[i]) ok2++; if(ok2<.55*floor) bad.push('boss arena class-2 coverage '+(ok2/floor).toFixed(2));
  const bd=L.doors.find(d=>d.id==='boss')!; const dx=bd.tiles[0][0], dy=bd.tiles[0][1]; if(Math.hypot(L.bossSpawn.x-dx,L.bossSpawn.y-dy)<9) bad.push('boss spawn too close to door');
  if(!clrAt(w,L.h,L.solid,hf(L.bossSpawn.x),hf(L.bossSpawn.y),FLOW_R[2])) bad.push('boss spawn lacks clearance');
  return bad;
}

/** Rotate / mirror a finished level by one of the 8 symmetries of the square (bit0 transpose, bit1 flip x, bit2 flip y). Used on the four hand-structured
 * dungeons (annex, foundry, clinic, warehouse) so their fixed left-to-right chain also reads differently per run. Tiles map x -> W-1-x, points x -> W-x. */
export function symLevel(L:Level,t:number):Level{
  if(!t) return L; const w0=L.w, h0=L.h; const tp=!!(t&1), fx=!!(t&2), fy=!!(t&4); const W=tp?h0:w0, H=tp?w0:h0;
  if(!L.reveal){ L.reveal={x:L.revealX+1.5,y:L.bossSpawn.y,r:5}; }
  const tile=(x:number,y:number):[number,number]=>{ let a=x,b=y; if(tp){ a=y; b=x; } if(fx) a=W-1-a; if(fy) b=H-1-b; return [a,b]; };
  const pt=(x:number,y:number):{x:number;y:number}=>{ let a=x,b=y; if(tp){ a=y; b=x; } if(fx) a=W-a; if(fy) b=H-b; return {x:a,y:b}; };
  const mapArr=(s:Uint8Array)=>{ const o=new Uint8Array(W*H); for(let y=0;y<h0;y++)for(let x=0;x<w0;x++){ const [a,b]=tile(x,y); o[b*W+a]=s[y*w0+x]; } return o; };
  L.solid=mapArr(L.solid); L.zone=mapArr(L.zone); L.w=W; L.h=H;
  for(const p of L.props){ const [a,b]=tile(p.x,p.y); p.x=a; p.y=b; }
  for(const i of L.interacts){ const q=pt(i.x,i.y); i.x=q.x; i.y=q.y; }
  for(const s of L.spawns){ const [a,b]=tile(s.x,s.y); s.x=a; s.y=b; }
  for(const c of L.checkpoints){ const q=pt(c.x,c.y); c.x=q.x; c.y=q.y; }
  for(const d of L.doors) d.tiles=d.tiles.map(([x,y])=>tile(x,y));
  for(const h of L.hazards||[]){ const q=pt(h.x,h.y); h.x=q.x; h.y=q.y; }
  { const q=pt(L.spawn.x,L.spawn.y); L.spawn={x:q.x,y:q.y}; } { const q=pt(L.bossSpawn.x,L.bossSpawn.y); L.bossSpawn={x:q.x,y:q.y}; } { const q=pt(L.salvage.x,L.salvage.y); L.salvage={x:q.x,y:q.y}; } { const q=pt(L.reveal.x,L.reveal.y); L.reveal={x:q.x,y:q.y,r:L.reveal.r}; }
  { const s=L.sensors; if(s.x1>s.x0||s.y1>s.y0){ const a=pt(s.x0,s.y0), b=pt(s.x1+1,s.y1+1); const x0=Math.min(a.x,b.x), x1=Math.max(a.x,b.x)-1, y0=Math.min(a.y,b.y), y1=Math.max(a.y,b.y)-1; L.sensors={x0,y0,x1,y1}; } }
  (L as any).sym=t; return L;
}
export const symOfSeed=(seed:number,salt:number)=>{ const q=rngOf((seed^salt)>>>0); q(); return Math.floor(q()*8); };
