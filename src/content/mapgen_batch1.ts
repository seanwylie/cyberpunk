// Content batch 1 level generator (docs/CONTENT_BATCH_1.md 2.2). One generator driven by a LevelSpec recipe: the same run chain as every dungeon
// (entry -> gate1 -> hall -> lock2 -> control/controller -> boss door -> boss arena) with per-room SHAPES, hazard MODES, rosters and sizes from data.
// Pure function of (spec, seed); validate() + deterministic seed perturbation guarantee connectivity / reachability (same as mapgen.ts).
import type { Level, Zone } from '../level';
import { Gen, chain, link, doorsAt, bossArena, sideRoom, gen, rngOf } from './mapgen';
import type { Rm, Spec } from './mapgen';
import type { LevelSpec, Shape } from './batch1_levels';
import { ENEMIES } from '../config';
import { rollAffixes } from './batch2_rosters';
const hf=(n:number)=>Math.floor(n);
type R4=Rm;

/** carve a 3-wide guaranteed route through a room (L-shaped between the entry and exit corridor rows) and reserve it from decoration */
function route(g:Gen,r:R4,cyIn:number,cyOut:number){ const mid=hf((r.x0+r.x1)/2)+g.ri(-2,2);
  const seg=(x0:number,y0:number,x1:number,y1:number)=>{ g.carve(Math.min(x0,x1),Math.min(y0,y1),Math.max(x0,x1),Math.max(y0,y1),r.zone); g.reserve(Math.min(x0,x1),Math.min(y0,y1),Math.max(x0,x1),Math.max(y0,y1)); };
  seg(r.x0,cyIn-1,mid+1,cyIn+1); seg(mid,Math.min(cyIn,cyOut)-1,mid+1,Math.max(cyIn,cyOut)+1); seg(mid,cyOut-1,r.x1,cyOut+1); }
const solidRect=(g:Gen,x0:number,y0:number,x1:number,y1:number,room:R4)=>{ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){ if(x<room.x0+1||x>room.x1-1||y<room.y0+1||y>room.y1-1) continue; const k=y*g.w+x; if(g.keep[k]||g.solid[k]||g.pm[k]) continue; g.solid[k]=1; } };
function shapeRoom(g:Gen,r:R4,shape:Shape,props:LevelSpec['props'],pillarH=2.2){
  const w=r.x1-r.x0+1, h=r.y1-r.y0+1, cx=hf((r.x0+r.x1)/2), cy=hf((r.y0+r.y1)/2);
  const prop=()=>{ g.scatterProps([r.zone],'crate',1,1,1,g.ri(Math.max(1,props.crate-2),props.crate+1),2); if(props.machine) g.scatterProps([r.zone],'machine',1.6,2,2,props.machine>3?g.ri(2,3):g.ri(1,2),3); if(props.rack) g.scatterProps([r.zone],'rack',1.8,3,1,Math.min(props.rack,4),2); if(props.conveyor) g.scatterProps([r.zone],'conveyor',.7,5,1,Math.min(props.conveyor,3),2,8); };
  switch(shape){
    case 'open': prop(); break;
    case 'pillars': for(let y=r.y0+3;y<=r.y1-3;y+=5)for(let x=r.x0+4;x<=r.x1-3;x+=5) if(g.r()<.8) g.block(x+g.ri(-1,1),y+g.ri(-1,1),'pillar',pillarH,1,1,2); prop(); break;
    case 'colonnade': for(const fy of [.28,.72]){ const y=r.y0+hf(h*fy); for(let x=r.x0+3;x<=r.x1-3;x+=4) if(g.r()<.85) g.block(x,y,'pillar',pillarH,1,1,1); } prop(); break;
    case 'rings': { const n=w>20&&h>16?2:1; for(let k=0;k<n;k++){ const ins=3+k*4; const x0=r.x0+ins, x1=r.x1-ins, y0=r.y0+ins, y1=r.y1-ins; if(x1-x0<5||y1-y0<5) break; solidRect(g,x0,y0,x1,y0,r); solidRect(g,x0,y1,x1,y1,r); solidRect(g,x0,y0,x0,y1,r); solidRect(g,x1,y0,x1,y1,r);
        for(const [gx,gy,hz] of [[g.ri(x0+2,x1-4),y0,1],[g.ri(x0+2,x1-4),y1,1],[x0,g.ri(y0+2,y1-4),0],[x1,g.ri(y0+2,y1-4),0]] as [number,number,number][]){ for(let i=0;i<3;i++){ const X=hz?gx+i:gx, Y=hz?gy:gy+i; if(X>=0&&Y>=0&&X<g.w&&Y<g.h&&!g.pm[Y*g.w+X]) g.solid[Y*g.w+X]=0; } } } prop(); break; }
    case 'diag': { const slope=h/w*(g.r()<.5?1:-1); const gaps=[g.ri(2,w-6),g.ri(2,w-6)]; for(let x=r.x0+1;x<=r.x1-1;x++){ const yy=Math.round((slope>0?r.y0+(x-r.x0)*slope:r.y1+(x-r.x0)*slope)); if(gaps.some(q=>x>=r.x0+q&&x<r.x0+q+4)) continue; for(let t=0;t<2;t++) solidRect(g,x,yy+t,x,yy+t,r); } prop(); break; }
    case 'cave': { const a=new Uint8Array(g.w*g.h); for(let y=r.y0+1;y<r.y1;y++)for(let x=r.x0+1;x<r.x1;x++) a[y*g.w+x]=g.r()<.4?1:0; for(let it=0;it<3;it++){ const b=new Uint8Array(a); for(let y=r.y0+1;y<r.y1;y++)for(let x=r.x0+1;x<r.x1;x++){ let c=0; for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++) c+=a[(y+j)*g.w+x+i]; b[y*g.w+x]=c>=5?1:0; } a.set(b); }
      for(let y=r.y0+1;y<r.y1;y++)for(let x=r.x0+1;x<r.x1;x++){ const k=y*g.w+x; if(a[k]&&!g.keep[k]&&!g.pm[k]) g.solid[k]=1; } g.scatterProps([r.zone],'crate',1,1,1,Math.max(2,props.crate-3),3); break; }
    case 'river': { const x=cx+g.ri(-4,4); solidRect(g,x-1,r.y0+1,x+1,r.y1-1,r); const bridges=[g.ri(r.y0+3,r.y1-3),g.ri(r.y0+3,r.y1-3)]; for(const by of bridges) for(let yy=by-1;yy<=by+1;yy++)for(let xx=x-1;xx<=x+1;xx++) if(!g.pm[yy*g.w+xx]&&yy>r.y0&&yy<r.y1) g.solid[yy*g.w+xx]=0; prop(); break; }
    case 'maze': { for(let y=r.y0+4;y<=r.y1-4;y+=5){ let x=r.x0+3; while(x<r.x1-5){ const len=g.ri(4,8); if(g.r()<.8) solidRect(g,x,y,Math.min(x+len,r.x1-3),y,r); x+=len+g.ri(3,4); } } for(let x=r.x0+7;x<=r.x1-5;x+=8) if(g.r()<.6){ const y=g.ri(r.y0+3,r.y1-8); solidRect(g,x,y,x,y+g.ri(3,6),r); } g.scatterProps([r.zone],'crate',1,1,1,Math.max(2,props.crate-4),2); if(props.rack) g.scatterProps([r.zone],'rack',1.8,3,1,2,2); break; }
    case 'islands': { const n=g.ri(4,7); for(let k=0;k<n*10&&k<90;k++){ const iw=g.ri(2,5), id=g.ri(2,4); const x=g.ri(r.x0+3,r.x1-iw-3), y=g.ri(r.y0+3,r.y1-id-3); const kind=['machine','crate','rack'][g.ri(0,2)] as any; g.block(x,y,kind,kind==='crate'?1:1.8,iw,id,3); } prop(); break; }
    case 'pit': { const px0=r.x0+hf(w*.3), px1=r.x1-hf(w*.3), py0=r.y0+hf(h*.3), py1=r.y1-hf(h*.3); solidRect(g,px0,py0,px1,py1,r); g.scatterProps([r.zone],'crate',1,1,1,Math.max(2,props.crate-3),2); break; }
    case 'zigzag': { let top=true; for(let x=r.x0+5;x<=r.x1-5;x+=6){ const len=hf(h*.62); if(top) solidRect(g,x,r.y0+1,x,r.y0+len,r); else solidRect(g,x,r.y1-len,x,r.y1-1,r); top=!top; } prop(); break; }
    case 'cross': { const gp=[[g.ri(r.x0+2,cx-3),cy],[g.ri(cx+3,r.x1-4),cy],[cx,g.ri(r.y0+2,cy-3)],[cx,g.ri(cy+3,r.y1-4)]]; solidRect(g,r.x0+1,cy,r.x1-1,cy,r); solidRect(g,cx,r.y0+1,cx,r.y1-1,r); for(const [gx,gy] of gp) for(let i=-1;i<=1;i++){ const X=gy===cy?gx+i:gx, Y=gy===cy?gy:gy+i; if(!g.pm[Y*g.w+X]) g.solid[Y*g.w+X]=0; } prop(); break; }
  }
}
function hazards(g:Gen,spec:LevelSpec,rooms:R4[],cors:number[]){ const hz=spec.haz; if(hz.mode==='none'||hz.n<=0) return; const [Y,P,J,B]=rooms; const lab=hz.label;
  const add=(x:number,y:number)=>{ if(g.solid[hf(y)*g.w+hf(x)]||g.keep[hf(y)*g.w+hf(x)]) return; g.hz(x,y,hz.r,hz.dps,hz.heat,lab); };
  if(hz.mode==='channels'){ for(let k=0;k<hz.n;k++){ const x=P.x0+Math.round((k+1)*(P.x1-P.x0+1)/(hz.n+1))+g.ri(-3,3); const bys=Array.from({length:g.ri(1,3)},()=>g.ri(P.y0+4,P.y1-4)); g.hline(x+.5,P.y0+1.5,x+.5,P.y1-.5,1.6,hz.r,hz.dps,hz.heat,lab,(_x,y)=>bys.some(by=>Math.abs(y-by-.5)<2.6)||g.keep[hf(y)*g.w+hf(x)]===1); } }
  else if(hz.mode==='scatter'){ for(const r of [Y,P,J]) for(let k=0;k<hz.n/ 2+g.ri(0,2);k++){ for(let t=0;t<20;t++){ const x=g.ri(r.x0+3,r.x1-3), y=g.ri(r.y0+3,r.y1-3); if(g.solid[y*g.w+x]||g.keep[y*g.w+x]||!g.clr(x,y,1)) continue; add(x+.5,y+.5); break; } } }
  else if(hz.mode==='ring'){ const rc=hf((B.x0+B.x1)/2)+2, rn=hz.n, rr=g.ri(44,52)/10, gapI=g.ri(0,rn-1); for(let i=0;i<rn;i++){ if(i===gapI) continue; const a=i/rn*Math.PI*2; add(rc+.5+Math.cos(a)*rr,B.cy+.5+Math.sin(a)*rr); } for(let k=0;k<3;k++){ const x=g.ri(P.x0+3,P.x1-3), y=g.ri(P.y0+3,P.y1-3); if(!g.solid[y*g.w+x]&&!g.keep[y*g.w+x]) add(x+.5,y+.5); } }
  else if(hz.mode==='lanes'){ for(const r of [P,J]){ for(let k=0;k<hz.n;k++){ const y=r.y0+3+hf((k+.5)*(r.y1-r.y0-5)/hz.n)+g.ri(-1,1); const gx=g.ri(r.x0+4,r.x1-6); g.hline(r.x0+1.5,y+.5,r.x1-.5,y+.5,1.7,hz.r,hz.dps,hz.heat,lab,(x,_y)=>Math.abs(x-gx)<2.6||g.keep[hf(y)*g.w+hf(x)]===1); } if(r===P) continue; } } }
const ARENA:Record<Shape,'ring'|'dais'|'hall'|'lanes'>={ open:'lanes', pillars:'hall', rings:'dais', diag:'lanes', cave:'lanes', river:'lanes', maze:'lanes', islands:'hall', colonnade:'hall', pit:'ring', zigzag:'lanes', cross:'dais' };
function once(spec:LevelSpec,seed:number):Level{
  let h0=0; for(const c of spec.id) h0=(h0*31+c.charCodeAt(0))>>>0; const q=rngOf(seed^h0^0x9e3779b9); const ri=(a:number,b:number)=>a+Math.floor(q()*(b-a+1)); const H=62, base=31;
  const names=spec.zoneLabels; const sz=spec.dims.map(([w,h])=>[w+ri(-2,2),Math.max(14,h+ri(-2,2))]);
  const sp:Spec[]=[{zone:'yard',w:sz[0][0],h:sz[0][1],cy:base+ri(-3,3)},{zone:'proc',w:sz[1][0],h:sz[1][1],cy:base+ri(-3,3)},{zone:'junction',w:sz[2][0],h:sz[2][1],cy:base+ri(-3,3)},{zone:'boss',w:sz[3][0],h:sz[3][1],cy:base+ri(-3,3)}];
  const {rooms,cors,W}=chain({ri},sp,[]); const g=new Gen(W,H,seed); const [Y,P,J,B]=rooms;
  for(const r of rooms) g.carve(r.x0,r.y0,r.x1,r.y1,r.zone); link(g,rooms,cors); doorsAt(g,rooms,cors,[names.yard+' gate',names.proc+' lock',names.boss+' door']);
  const spawn={x:Y.x0+2.5,y:cors[0]+.5}; g.sx=spawn.x; g.sy=spawn.y; g.reserve(Y.x0,hf(spawn.y)-3,Y.x0+6,hf(spawn.y)+3);
  const S=sideRoom(g,Y.x0+g.ri(0,4),Y.y1,g.ri(12,16),g.ri(7,9)); g.reserve(S.cx-1,Y.y1,S.cx+2,Y.y1+6);
  // objective alcove for the junction (kept simple: put() finds a free tile); guaranteed routes first, then shape decoration
  route(g,Y,cors[0],cors[0]); route(g,P,cors[0],cors[1]); route(g,J,cors[1],cors[2]);
  const ph=spec.mfr==='PS'?2.4:2.2;
  shapeRoom(g,Y,spec.shapes[0],spec.props,ph); shapeRoom(g,P,spec.shapes[1],spec.props,ph); shapeRoom(g,J,spec.shapes[2],spec.props,ph);
  g.scatterProps(['salvage'],'crate',1,1,1,g.ri(3,6),2);
  const ba=bossArena(g,B,ARENA[spec.shapes[3]],cors[2]); g.reserve(B.x1-1,B.y0,B.x1,B.y1);
  hazards(g,spec,rooms,cors);
  g.put('hackproc',spec.objective.relay+' (hack: reroute locks)','hack',P.x1-1.5,cors[1]+g.ri(-3,3),5,['proc']);
  g.put('controller',spec.objective.label+' (objective)','controller',J.x1-2,J.cy+g.ri(-5,5),6,['junction']);
  g.put('cratechip',spec.objective.bonus+' (bonus chips)','crate',S.x1-2,S.y1-1,5,['salvage'],1.5);
  const ro=spec.roster; const eq=(t:string)=>t===spec.gateGuard||t===spec.lockElite;
  g.single(spec.gateGuard,90,Y.x1-1,cors[0]-g.ri(4,6)); g.single(spec.gateGuard,91,Y.x1-1,cors[0]+g.ri(4,6));
  const place=(zs:Zone[],list:[string,number][],minD?:number)=>{ for(const [t,n] of list){ if(n<=0||eq(t)) continue; g.pack(zs,n,t,{minD}); } };
  const half=(q:[string,number][])=>q.map(([t,n])=>[t,Math.max(1,Math.ceil(n/2))] as [string,number]);
  if(spec.squads){ // batch 2: mixed-role squads (shared alert group); a full set plus a half-size second pass, like the batch-1 density
    const zmap:[Zone,Zone[],number][]=[['yard',['yard'],7],['proc',['proc'],8],['junction',['junction'],6],['salvage',['salvage'],5]];
    for(const [k,zs,minD] of zmap){ const sq=spec.squads[k as 'yard'|'proc'|'junction'|'salvage']; for(const q of sq) g.squad(zs,q,{minD}); if(k!=='salvage') for(const q of sq) g.squad(zs,half(q),{minD}); } }
  else {
  place(['yard'],ro.yard,7); place(['yard'],ro.yard.map(([t,n])=>[t,Math.ceil(n/2)] as [string,number]),7); place(['proc'],ro.proc,8); place(['proc'],ro.proc.map(([t,n])=>[t,Math.ceil(n/2)] as [string,number]),8); place(['junction'],ro.junction,6); place(['junction'],ro.junction.map(([t,n])=>[t,Math.ceil(n/2)] as [string,number]),6); place(['salvage'],ro.salvage,5); }
  g.single(spec.lockElite,50,P.x1-4,cors[1],6,['proc']); g.single(spec.lockElite==='brakeman'?'quenchpriest':spec.lockElite==='quenchpriest'?'brakeman':spec.lockElite==='matron'?'anesthetist':spec.lockElite==='anesthetist'?'matron':spec.lockElite==='shiftlead'?'hobbs':spec.lockElite==='hobbs'?'shiftlead':spec.lockElite==='sawhand'?'foreman':'sawhand',55,hf((J.x0+J.x1)/2),J.cy,5,['junction']);
  g.prune();
  { const seen=new Set<number>(); for(const sp of g.spawns){ if(sp.group>=90||seen.has(sp.group)) continue; seen.add(sp.group); const mem=g.spawns.filter(m=>m.group===sp.group); const lead=mem.slice().sort((a,b)=>(ENEMIES[b.type]?.hp||0)-(ENEMIES[a.type]?.hp||0))[0]; if(!lead||mem.length<2) continue; const af=rollAffixes(lead.type,spec.tier,()=>g.r()); if(af.length) lead.affix=af; } } // batch 2: elite pack leaders
  const L=g.level({spawn,cps:[{id:1,x:spawn.x,y:spawn.y,label:names.yard},{id:2,x:J.x0+2.5,y:cors[1]+.5,label:names.junction}],bossSpawn:ba.spawn,revealX:B.x0+2,salvage:{x:(S.x0+S.x1)/2,y:S.y0+4}});
  (L as any).noConds=true; L.theme=spec.theme; return L;
}
export const genBatch1=(spec:LevelSpec,seed:number)=>gen(seed,s=>once(spec,s),spec.id);
