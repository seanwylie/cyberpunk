// Canvas drawing for the ability VFX pool (src/vfx.ts), enemy status indicators and player auras. Everything is iso-anchored via the renderer's sx/sy.
import { VFX, P, PAL } from './vfx';
import { Q } from './quality';
import { ABILITIES, ABILITY_TYPE_COLOR, ENEMIES, AB, uiFs, cpx, COMBAT } from './config';
import { counterFor } from './content/abilfx';

type R=any;
const GROUND=new Set(['ring','hex','rune','foot']);
const hexPts=(x:number,y:number,r:number,rot:number):[number,number][]=>Array.from({length:6},(_,i)=>[x+Math.cos(rot+i*Math.PI/3)*r,y+Math.sin(rot+i*Math.PI/3)*r] as [number,number]);
function drawOne(r:R,p:P,add:boolean){
  const c:CanvasRenderingContext2D=r.ctx, s=r.TW/64, k=p.t/p.life, f=1-k, a=r.sx(p.x,p.y), b=r.sy(p.x,p.y,p.z);
  switch(p.k){
    case 'ring': r.ring(p.x,p.y,p.s*(.25+.75*(1-(1-k)*(1-k))),p.c,f*.95); break;
    case 'hex': r.poly(hexPts(p.x,p.y,p.s*(.5+.5*k),p.rot+k),p.c,p.c,f*.28,2); break;
    case 'rune': { const R0=p.s*(.6+.4*k); r.ring(p.x,p.y,R0,p.c,f*.8); for(let i=0;i<6;i++){ const an=p.rot+k*3+i*1.047; r.poly(hexPts(p.x+Math.cos(an)*R0*.8,p.y+Math.sin(an)*R0*.8,.12,an),p.c,undefined,f*.9); } break; }
    case 'foot': c.save(); c.globalAlpha=f*.45; c.fillStyle=p.c; c.beginPath(); c.ellipse(a,b,p.s*r.TW*.35,p.s*r.TW*.17,0,0,7); c.fill(); c.restore(); break;
    case 'ghost': { c.save(); c.globalAlpha=f*(p.a||.5); c.fillStyle=p.c; const h=r.TW*.5; c.beginPath(); c.ellipse(a,b-h*.5,h*.16,h*.42,0,0,7); c.fill(); c.beginPath(); c.arc(a,b-h*1.02,h*.12,0,7); c.fill(); c.restore(); break; }
    case 'streak': { const L=p.x2, ex=p.x+Math.cos(p.a)*L*(.4+.6*(1-f)), ey=p.y+Math.sin(p.a)*L*(.4+.6*(1-f)); const x1=r.sx(p.x,p.y), y1=r.sy(p.x,p.y,p.z), x2=r.sx(ex,ey), y2=r.sy(ex,ey,p.z); c.save(); c.lineCap='round'; c.strokeStyle=p.c; c.globalAlpha=f*.55; c.lineWidth=p.s*s*2.4; c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke(); c.globalAlpha=f*.95; c.strokeStyle=PAL[p.ab]?.[2]||'#fff'; c.lineWidth=p.s*s*.8; c.stroke(); c.restore(); break; }
    case 'spark': { const px=r.sx(p.x-p.vx*.05,p.y-p.vy*.05), py=r.sy(p.x-p.vx*.05,p.y-p.vy*.05,Math.max(0,p.z-p.vz*.05)); c.save(); c.lineCap='round'; c.strokeStyle=p.c; c.globalAlpha=f; c.lineWidth=p.s*s*1.2; c.beginPath(); c.moveTo(px,py); c.lineTo(a,b); c.stroke(); c.restore(); break; }
    case 'shard': case 'frost': { const z=p.s*r.TW; c.save(); c.translate(a,b); c.rotate(p.rot); c.globalAlpha=f; c.fillStyle=p.c; c.beginPath(); if(p.k==='shard'){ c.moveTo(0,-z); c.lineTo(z*.45,z*.6); c.lineTo(-z*.45,z*.6); } else { c.moveTo(0,-z); c.lineTo(z*.5,0); c.lineTo(0,z); c.lineTo(-z*.5,0); } c.closePath(); c.fill(); c.restore(); break; }
    case 'debris': { const z=p.s*r.TW; c.save(); c.translate(a,b); c.rotate(p.rot); c.globalAlpha=Math.min(1,f*2); c.fillStyle=p.c; c.fillRect(-z/2,-z/2,z,z*.7); c.restore(); break; }
    case 'glow': { const z=p.s*r.TW*(.7+.6*k); const gr=c.createRadialGradient(a,b,0,a,b,z); gr.addColorStop(0,p.c); gr.addColorStop(1,'rgba(0,0,0,0)'); c.save(); c.globalAlpha=f*.7; c.fillStyle=gr; c.beginPath(); c.arc(a,b,z,0,7); c.fill(); c.restore(); break; }
    case 'steam': { c.save(); c.globalAlpha=f*.38; c.fillStyle=p.c; c.beginPath(); c.arc(a,b,p.s*r.TW*(.5+k*.9),0,7); c.fill(); c.restore(); break; }
    case 'star': { const z=p.s*r.TW; c.save(); c.translate(a,b); c.rotate(p.rot); c.globalAlpha=f; c.fillStyle=p.c; c.beginPath(); for(let i=0;i<8;i++){ const rr=i%2?z*.4:z; c.lineTo(Math.cos(i*Math.PI/4)*rr,Math.sin(i*Math.PI/4)*rr); } c.closePath(); c.fill(); c.restore(); break; }
    case 'arc': { const x1=a,y1=b, x2=r.sx(p.x2,p.y2), y2=r.sy(p.x2,p.y2,p.z); const seed=Math.floor(p.t*30); c.save(); c.lineCap='round'; c.lineJoin='round'; c.strokeStyle=p.c; c.globalAlpha=f; c.lineWidth=Math.max(1.5,p.s*r.TW*.5); c.beginPath(); c.moveTo(x1,y1); for(let i=1;i<7;i++){ const t=i/7, j=((Math.sin(seed*12.9+i*78.2)*43758.5)%1)*10*s; c.lineTo(x1+(x2-x1)*t+j,y1+(y2-y1)*t-j*.5); } c.lineTo(x2,y2); c.stroke(); c.lineWidth=1; c.strokeStyle='#fff'; c.stroke(); c.restore(); break; }
  }
  void add;
}
export function vfxFrame(r:R,dt:number){ const g=r.g; VFX.reduced=!!g.save.settings.reducedFx; while(g.vev.length){ const e=g.vev.shift(); VFX.event(e); } VFX.update(dt); }
export function vfxGround(r:R){ if(!VFX.live) return; const c:CanvasRenderingContext2D=r.ctx; const add=!VFX.reduced&&Q.fx<2; for(const p of VFX.pool){ if(!p.on||!GROUND.has(p.k)) continue; if(p.add&&add){ c.globalCompositeOperation='lighter'; drawOne(r,p,true); c.globalCompositeOperation='source-over'; } else drawOne(r,p,false); } }
export function vfxItems(r:R,items:{d:number;f:()=>void}[]){ if(!VFX.live) return; const add=!VFX.reduced&&Q.fx<2; const buckets=new Map<number,P[]>(); for(const p of VFX.pool){ if(!p.on||GROUND.has(p.k)) continue; const key=Math.round((p.x+p.y)*1.5); let b=buckets.get(key); if(!b){ b=[]; buckets.set(key,b); } b.push(p); }
  for(const [key,list] of buckets) items.push({d:key/1.5+.3,f:()=>{ const c:CanvasRenderingContext2D=r.ctx; for(const p of list){ if(!p.on) continue; if(p.add&&add){ c.globalCompositeOperation='lighter'; drawOne(r,p,true); c.globalCompositeOperation='source-over'; } else drawOne(r,p,false); } }}); }
const imgs:Record<string,HTMLImageElement>={}; const icon=(id:string)=>{ let i=imgs[id]; if(!i){ i=new Image(); i.src='abilities/'+id+'.webp'; imgs[id]=i; } return i; };
/** status indicators over an enemy: stunned stars, hacked mark, staggered/shield-broken crack, controlled tether, and the "counter this with X" ability icon */
export function vfxStatus(r:R,e:any,a:number,b:number,top:number,def:any){
  const g=r.g, c:CanvasRenderingContext2D=r.ctx, s=r.TW/64, rt=e._rt, red=!!g.save.settings.reducedFx; if(e.dead||rt.reveal>0) return; const y0=b-top; const t=g.time;
  if(e.stunT>0){ const n=red?1:3; for(let i=0;i<n;i++){ const an=t*5+i*6.283/n; const sx=a+Math.cos(an)*13*s, sy=y0-6*s+Math.sin(an)*4*s; c.save(); c.fillStyle='#e8f6ff'; c.strokeStyle='#5f7f9e'; c.lineWidth=1; c.translate(sx,sy); c.rotate(an); c.beginPath(); for(let j=0;j<10;j++){ const rr=j%2?2.2*s:5*s; c.lineTo(Math.cos(j*Math.PI/5)*rr,Math.sin(j*Math.PI/5)*rr); } c.closePath(); c.fill(); c.stroke(); c.restore(); } }
  if(rt.hack>0){ const col=ABILITY_TYPE_COLOR.hacking; const hy=y0-(e.stunT>0?22:14)*s; c.save(); c.translate(a,hy); c.rotate(red?0:t*1.5); c.strokeStyle=col; c.fillStyle='rgba(20,30,40,.8)'; c.lineWidth=2; c.beginPath(); c.moveTo(0,-6*s); c.lineTo(6*s,0); c.lineTo(0,6*s); c.lineTo(-6*s,0); c.closePath(); c.fill(); c.stroke(); c.restore(); c.save(); c.strokeStyle='#8fc4ea'; c.lineWidth=2; c.beginPath(); c.arc(a,hy,9*s,-1.57,-1.57+6.283*Math.min(1,rt.hack/AB.hackT)); c.stroke(); c.restore(); }
  if(rt.vuln>0&&!rt.shield){ const hy=y0-8*s; c.save(); c.strokeStyle='#e8d890'; c.fillStyle='rgba(60,50,20,.7)'; c.lineWidth=2; c.translate(a+(e.stunT>0?20*s:0),hy); c.beginPath(); c.moveTo(-6*s,-6*s); c.lineTo(6*s,-6*s); c.lineTo(6*s,2*s); c.lineTo(0,8*s); c.lineTo(-6*s,2*s); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0,-6*s); c.lineTo(-2*s,0); c.lineTo(2*s,2*s); c.lineTo(0,8*s); c.stroke(); c.restore(); }
  if(e.faction==='ally'&&e.ctrlT>0){ c.save(); c.setLineDash([5*s,4*s]); c.lineDashOffset=-t*30; c.strokeStyle='#8fc4ea'; c.globalAlpha=.8; c.lineWidth=2; c.beginPath(); c.moveTo(r.sx(g.px,g.py),r.sy(g.px,g.py,.8)); c.lineTo(a,b-14*s); c.stroke(); c.restore(); r.poly(hexPts(e.x,e.y,ENEMIES[e.type].radius+.55,t),undefined,'#8fc4ea',.8,2); }
  // counter hint icon: which of your abilities answers this enemy
  if(e.alert&&e.faction==='enemy'&&!(e.stunT>0)){ const cn=counterFor(e); if(cn&&Math.hypot(e.x-g.px,e.y-g.py)<12){ const i=g.build.abilities.indexOf(cn.id); const equipped=i>=0, ready=equipped&&g.abCd[i]<=0&&!g.overheated; const x=a+(def.boss?30:18)*s, y=y0-2*s, rr=8*s; const col=ABILITY_TYPE_COLOR[ABILITIES[cn.id].type]; c.save(); c.globalAlpha=ready?1:equipped?.6:.4; c.fillStyle='rgba(12,12,14,.85)'; c.beginPath(); c.arc(x,y,rr+1.5,0,7); c.fill(); const im=icon(cn.id); if(im.complete&&im.naturalWidth){ c.save(); c.beginPath(); c.arc(x,y,rr,0,7); c.clip(); c.drawImage(im,x-rr,y-rr,rr*2,rr*2); c.restore(); } c.strokeStyle=col; c.lineWidth=ready&&!red?2+Math.sin(t*8):1.5; c.beginPath(); c.arc(x,y,rr+1.5,0,7); c.stroke(); if(equipped){ c.fillStyle='#fff'; c.font=`700 ${cpx(8*uiFs())}px sans-serif`; c.textAlign='center'; c.fillText(['Q','E','R'][i],x,y+rr+9*s); } c.restore(); } }
}
/** player auras: bracing hex shell, overclock heat ring, combo pips, heat-charge glow */
export function vfxAuras(r:R){ const g=r.g, c:CanvasRenderingContext2D=r.ctx, t=g.time, red=!!g.save.settings.reducedFx, s=r.TW/64; if(g.mode!=='run') return;
  if(g.braceT>0){ const f=Math.min(1,g.braceT/AB.braceT), rot=red?0:t*.8; r.poly(hexPts(g.px,g.py,1.35,rot),'#e4dcc8','#fffaf0',.12+.08*Math.sin(t*6)*(red?0:1),2); if(!red) r.poly(hexPts(g.px,g.py,1.0,-rot),undefined,'#e4dcc8',.5*f,1.5); }
  if(g.ovT>0){ r.ring(g.px,g.py,1.1+(red?0:.08*Math.sin(t*9)),'#e08a4a',.85); }
  const ch=Math.min(1,g.heat/80); if(ch>.3&&!red&&!g.overheated) r.ring(g.px,g.py,.8+ch*.35,'#e08a4a',.14+ch*.22);
  if(g.comboN>0&&g.comboT>0){ const a=r.sx(g.px,g.py), b=r.sy(g.px,g.py)-62*s; c.save(); for(let i=0;i<=g.comboN;i++){ c.fillStyle='#9fd8c8'; c.strokeStyle='#10201c'; c.lineWidth=1.5; c.beginPath(); c.arc(a+(i-g.comboN/2)*9*s,b,3.2*s,0,7); c.fill(); c.stroke(); } c.restore(); } }
