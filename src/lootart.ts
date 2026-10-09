import { ITEM_BY_ID, CHIPS, RARITY_COLOR, RARITY_RANK } from './config';
import type { Rarity, Slot, Mfr } from './config';
/**
 * Loot-drop art (see docs/LOOT_ART.md). Everything is pre-rendered into small offscreen canvases (icon cells, sheen frames)
 * and cached per (kind, slot, manufacturer, rarity); per-frame work is a handful of drawImage calls plus a few vector arcs.
 * Rarity follows the art style guide: grey none, green very slight, blue slight, purple restrained spectacle,
 * orange elaborate *mechanical* animation (opening plated housing, gears, hover, heat shimmer) with controlled light. No neon.
 */
export interface LootSpec { kind:'item'|'chip'|'stim'|'credits'; slot?:Slot; mfr?:Mfr; rar:Rarity; name:string; sig:boolean; weapon?:string; amount:number; key:string; }
export interface DropLike { id:number; kind:'item'|'chip'|'stim'|'credits'; inst?:{def:string}; chip?:string; amount:number; born?:number; }
export function specOf(d:DropLike):LootSpec {
  if(d.kind==='item'){ const it=ITEM_BY_ID[d.inst!.def]; const sig=!!(it as any).authoredException; return { kind:'item', slot:it.slot, mfr:it.mfr, rar:it.rarity, name:it.name, sig, weapon:it.weapon, amount:1, key:`i|${it.slot}|${it.mfr}|${it.rarity}|${it.weapon||''}|${sig?1:0}` }; }
  if(d.kind==='chip'){ const c=(CHIPS as any)[d.chip!]; return { kind:'chip', rar:c.rarity, name:c.name, sig:false, amount:1, key:`c|${c.rarity}` }; }
  if(d.kind==='stim') return { kind:'stim', rar:'green', name:'Stim injector', sig:false, amount:1, key:'s|green' };
  const n=d.amount>=60?3:d.amount>=15?2:1; return { kind:'credits', rar:'grey', name:d.amount+' credits', sig:false, amount:n, key:'$|'+n };
}
// ---------------------------------------------------------------- palettes
interface Pal { b:string; d:string; l:string; a:string }
const PAL:Record<Mfr|'N',Pal> = {
  HI:{ b:'#8f3b2e', d:'#40201a', l:'#b8644f', a:'#c9b28a' },   // oxide red
  PS:{ b:'#58708a', d:'#242f3b', l:'#8da3b8', a:'#d3ccb8' },   // slate blue
  MM:{ b:'#707a45', d:'#31361d', l:'#9ca66b', a:'#c9b28a' },   // olive
  N: { b:'#4a5058', d:'#1f2326', l:'#7a828a', a:'#b8a46a' } };
const hx=(s:string)=>{ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return Math.abs(h); };
const mk=(w:number,h:number)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; };
const CELL=96;
type C=CanvasRenderingContext2D;
function rr(c:C,x:number,y:number,w:number,h:number,r:number){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function poly(c:C,pts:number[][]){ c.beginPath(); pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])); c.closePath(); }
function rivet(c:C,x:number,y:number,P:Pal,r=1.7){ c.fillStyle=P.d; c.beginPath(); c.arc(x,y,r,0,7); c.fill(); c.fillStyle=P.l; c.beginPath(); c.arc(x-.5,y-.5,r*.45,0,7); c.fill(); }
/** fill with body colour + top highlight + bottom shade (path must already be built) */
function shade(c:C,P:Pal,y0:number,y1:number){ const g=c.createLinearGradient(0,y0,0,y1); g.addColorStop(0,P.l); g.addColorStop(.35,P.b); g.addColorStop(1,P.d); c.fillStyle=g; c.fill(); c.lineWidth=1.2; c.strokeStyle=P.d; c.stroke(); }

// ---------------------------------------------------------------- silhouettes (96px cell, drawn around (48,50))
function sFace(c:C,P:Pal,m:Mfr){
  poly(c,[[27,24],[69,24],[73,44],[64,68],[48,76],[32,68],[23,44]]); shade(c,P,24,76);
  c.fillStyle=P.d; c.fillRect(24,22,48,5); c.fillStyle=P.a; c.fillRect(26,22,44,1.6); // brow plate
  if(m==='MM'){ c.fillStyle=P.d; c.beginPath(); c.arc(37,44,7,0,7); c.arc(59,44,7,0,7); c.fill(); c.fillStyle=P.a; c.beginPath(); c.arc(37,44,3.4,0,7); c.arc(59,44,3.4,0,7); c.fill(); c.fillStyle=P.l; c.fillRect(34,45,4,1.4); }
  else if(m==='PS'){ c.fillStyle=P.d; rr(c,29,39,38,8,3); c.fill(); c.fillStyle=P.a; c.fillRect(33,42,30,1.8); c.strokeStyle=P.d; c.lineWidth=1; c.beginPath(); c.moveTo(48,48); c.lineTo(48,70); c.stroke(); }
  else { c.fillStyle=P.d; c.fillRect(29,39,15,7); c.fillRect(52,39,15,7); c.fillStyle=P.a; c.fillRect(31,41,11,2); c.fillRect(54,41,11,2); c.fillStyle=P.d; for(let i=0;i<5;i++) c.fillRect(36+i*6,58,3,12); }
  rivet(c,30,30,P); rivet(c,66,30,P); c.fillStyle=P.d; c.fillRect(45,50,6,5);
}
function sBrain(c:C,P:Pal,m:Mfr){
  c.beginPath(); c.moveTo(26,52); c.bezierCurveTo(24,22,72,22,70,52); c.lineTo(70,64); c.lineTo(26,64); c.closePath(); shade(c,P,24,64);
  c.strokeStyle=P.d; c.lineWidth=1.4; for(let i=0;i<3;i++){ c.beginPath(); c.moveTo(34+i*14,30+Math.abs(i-1)*3); c.lineTo(34+i*14,64); c.stroke(); }
  c.fillStyle=P.a; c.fillRect(26,50,44,3); c.fillStyle=P.d; rr(c,30,64,36,8,2); c.fill();
  for(let i=0;i<5;i++){ c.fillStyle=P.a; c.fillRect(34+i*7,70,3,6); }
  c.strokeStyle=P.a; c.lineWidth=1.6; c.beginPath(); c.moveTo(36,40); for(let i=0;i<6;i++) c.lineTo(36+i*5.6,i%2?36:42); c.stroke();
  if(m==='HI'){ rivet(c,30,58,P); rivet(c,66,58,P); }
}
function sTorso(c:C,P:Pal,m:Mfr){
  poly(c,[[24,28],[38,22],[58,22],[72,28],[68,52],[62,74],[34,74],[28,52]]); shade(c,P,22,74);
  c.fillStyle=P.d; poly(c,[[40,22],[56,22],[52,32],[44,32]]); c.fill();
  c.strokeStyle=P.d; c.lineWidth=1.5; c.beginPath(); c.moveTo(48,32); c.lineTo(48,74); c.stroke();
  c.fillStyle=P.a; c.save(); c.globalAlpha=.9; poly(c,[[26,36],[32,34],[70,58],[66,64]]); c.fill(); c.restore(); // strap
  c.fillStyle=P.d; for(let i=0;i<4;i++) c.fillRect(33,56+i*4,10,1.8); 
  if(m==='PS'){ c.strokeStyle=P.a; c.lineWidth=1.4; c.beginPath(); c.arc(48,50,9,0,7); c.stroke(); } else { rivet(c,30,38,P); rivet(c,66,38,P); rivet(c,36,70,P); rivet(c,60,70,P); }
}
function limb(c:C,P:Pal,x1:number,y1:number,x2:number,y2:number,w1:number,w2:number){ const a=Math.atan2(y2-y1,x2-x1), nx=-Math.sin(a), ny=Math.cos(a); poly(c,[[x1+nx*w1,y1+ny*w1],[x2+nx*w2,y2+ny*w2],[x2-nx*w2,y2-ny*w2],[x1-nx*w1,y1-ny*w1]]); c.fillStyle=P.b; c.fill(); c.strokeStyle=P.d; c.lineWidth=1.2; c.stroke(); poly(c,[[x1+nx*w1,y1+ny*w1],[x2+nx*w2,y2+ny*w2],[x2+nx*w2*.3,y2+ny*w2*.3],[x1+nx*w1*.3,y1+ny*w1*.3]]); c.fillStyle=P.l; c.fill(); }
function joint(c:C,P:Pal,x:number,y:number,r:number){ c.fillStyle=P.d; c.beginPath(); c.arc(x,y,r,0,7); c.fill(); c.fillStyle=P.a; c.beginPath(); c.arc(x,y,r*.55,0,7); c.fill(); c.fillStyle=P.d; c.beginPath(); c.arc(x,y,r*.2,0,7); c.fill(); }
function sArm(c:C,P:Pal,m:Mfr,left:boolean){ c.save(); if(left){ c.translate(96,0); c.scale(-1,1); }
  limb(c,P,28,24,46,48,8,7); joint(c,P,47,49,7.5); limb(c,P,47,49,66,72,7,5); // upper, elbow, forearm
  c.fillStyle=P.d; poly(c,[[63,66],[74,70],[70,80],[62,76]]); c.fill(); c.strokeStyle=P.a; c.lineWidth=1.6; c.beginPath(); c.moveTo(35,26); c.lineTo(52,50); c.stroke();
  c.fillStyle=P.a; c.fillRect(54,60,9,2.4); if(m==='HI') rivet(c,34,32,P); c.restore(); }
function sHand(c:C,P:Pal,m:Mfr,left:boolean,weapon?:string){ c.save(); if(left){ c.translate(96,0); c.scale(-1,1); }
  rr(c,32,46,32,24,5); shade(c,P,46,70); rr(c,36,70,24,6,2); c.fillStyle=P.d; c.fill();
  for(let i=0;i<4;i++){ const x=34+i*7.4, h=18-(i===1||i===2?3:0)+(i===0?3:0); rr(c,x,46-h,6,h+2,2.2); c.fillStyle=P.b; c.fill(); c.strokeStyle=P.d; c.lineWidth=1; c.stroke(); c.fillStyle=P.a; c.fillRect(x,46-h*.55,6,1.4); }
  poly(c,[[64,52],[74,46],[77,52],[66,62]]); c.fillStyle=P.l; c.fill(); c.stroke(); rivet(c,40,58,P); rivet(c,56,58,P);
  if(weapon&&['slug','popper','autopistol','burst','shard','arc'].includes(weapon)){ rr(c,56,52,26,9,2); c.fillStyle=P.d; c.fill(); c.fillStyle=P.a; c.fillRect(74,54,8,2.4); }
  else if(weapon==='ripper'||weapon==='blade'){ poly(c,[[52,44],[56,10],[62,44]]); c.fillStyle=P.a; c.fill(); c.strokeStyle=P.d; c.stroke(); }
  c.restore(); }
function sLeg(c:C,P:Pal,m:Mfr){
  poly(c,[[36,14],[60,14],[62,44],[34,44]]); shade(c,P,14,44); joint(c,P,48,46,8); poly(c,[[36,50],[60,50],[56,82],[40,82]]); shade(c,P,50,82);
  c.fillStyle=P.a; c.fillRect(36,22,24,2.4); c.fillStyle=P.d; c.fillRect(42,60,12,2); c.fillRect(42,66,12,2); if(m==='HI'){ rivet(c,40,30,P); rivet(c,56,30,P); } c.fillStyle=P.d; rr(c,38,82,20,5,2); c.fill(); }
function sFoot(c:C,P:Pal,m:Mfr,left:boolean){ c.save(); if(left){ c.translate(96,0); c.scale(-1,1); }
  poly(c,[[30,24],[50,24],[52,46],[74,56],[78,70],[26,70],[26,48]]); shade(c,P,24,70);
  c.fillStyle=P.d; c.fillRect(24,70,56,7); c.fillStyle=P.a; c.fillRect(30,30,18,2.4); for(let i=0;i<6;i++){ c.fillStyle=P.d; c.fillRect(27+i*9,77,5,3); }
  poly(c,[[56,52],[74,58],[76,66],[56,66]]); c.fillStyle=P.l; c.fill(); c.stroke(); rivet(c,40,44,P); rivet(c,36,60,P); c.restore(); }
function sChip(c:C,rar:Rarity){ const P=PAL.N; poly(c,[[22,34],[70,34],[74,38],[74,70],[22,70]]); c.fillStyle='#2c3a36'; c.fill(); c.strokeStyle=P.d; c.lineWidth=1.4; c.stroke();
  c.fillStyle=P.a; for(let i=0;i<7;i++){ c.fillRect(26+i*6,28,3,6); c.fillRect(26+i*6,70,3,6); }
  c.strokeStyle='#8c8a6a'; c.lineWidth=1.3; c.beginPath(); c.moveTo(27,42); c.lineTo(38,42); c.lineTo(42,48); c.moveTo(70,42); c.lineTo(58,42); c.lineTo(54,48); c.moveTo(27,62); c.lineTo(40,62); c.lineTo(44,56); c.moveTo(70,62); c.lineTo(56,62); c.stroke();
  rr(c,38,44,22,18,2); c.fillStyle='#14181a'; c.fill(); c.strokeStyle=P.a; c.lineWidth=1; c.stroke(); c.fillStyle=P.a; c.fillRect(42,50,14,2); c.fillRect(42,55,9,2); c.fillStyle=RARITY_COLOR[rar]; c.fillRect(38,44,4,4); }
function sStim(c:C){ c.save(); c.translate(48,50); c.rotate(-.62); c.translate(-48,-50);
  rr(c,28,42,40,16,4); c.fillStyle='#b8b6a6'; c.fill(); c.strokeStyle='#2c2f2a'; c.lineWidth=1.4; c.stroke(); rr(c,32,45,24,10,2.5); c.fillStyle='#8fae7f'; c.fill(); c.fillStyle='rgba(255,255,255,.35)'; c.fillRect(34,46,20,2);
  c.fillStyle='#4a4f47'; c.fillRect(64,38,5,24); c.fillRect(18,44,7,12); c.fillStyle='#8a8d84'; c.fillRect(8,49,12,2.4); c.fillStyle='#d8d2bf'; c.fillRect(68,48,14,4); c.fillStyle='#2c2f2a'; for(let i=0;i<4;i++) c.fillRect(31+i*7,42,1.2,3); c.restore(); }
function sCredits(c:C,n:number){ const P={ b:'#a08f56', d:'#473f22', l:'#d0c186', a:'#e0d6a8' };
  for(let i=0;i<n;i++){ const y=64-i*11, x=48+(i===1?-4:i===2?3:0); const hexp=(yy:number,sc=1)=>{ c.beginPath(); for(let k=0;k<6;k++){ const a=k/6*6.283; const px=x+Math.cos(a)*26*sc, py=yy+Math.sin(a)*11*sc; k?c.lineTo(px,py):c.moveTo(px,py); } c.closePath(); };
    hexp(y+7); c.fillStyle=P.d; c.fill(); hexp(y); const g=c.createLinearGradient(0,y-11,0,y+11); g.addColorStop(0,P.l); g.addColorStop(1,P.b); c.fillStyle=g; c.fill(); c.strokeStyle=P.d; c.lineWidth=1.2; c.stroke();
    c.beginPath(); c.ellipse(x,y,9,3.8,0,0,7); c.fillStyle=P.d; c.fill(); c.beginPath(); c.ellipse(x,y,4.5,1.9,0,0,7); c.fillStyle=P.a; c.fill(); }
}
function paintSilhouette(c:C,s:LootSpec){
  const m=s.mfr||'MM', P=PAL[s.mfr||'N'];
  if(s.kind==='chip') return sChip(c,s.rar); if(s.kind==='stim') return sStim(c); if(s.kind==='credits') return sCredits(c,s.amount);
  switch(s.slot){ case 'face': return sFace(c,P,m); case 'brain': return sBrain(c,P,m); case 'torso': return sTorso(c,P,m);
    case 'armL': return sArm(c,P,m,true); case 'armR': return sArm(c,P,m,false); case 'handL': return sHand(c,P,m,true,s.weapon); case 'handR': return sHand(c,P,m,false,s.weapon);
    case 'legL': case 'legR': return sLeg(c,P,m); case 'footL': return sFoot(c,P,m,true); case 'footR': return sFoot(c,P,m,false); }
}
// ---------------------------------------------------------------- caches
const icons=new Map<string,HTMLCanvasElement>(); const sheens=new Map<string,HTMLCanvasElement[]>();
export const SHEEN_N=10;
export function iconCanvas(s:LootSpec):HTMLCanvasElement {
  let cv=icons.get(s.key); if(cv) return cv;
  const raw=mk(CELL,CELL); const rc=raw.getContext('2d')!; paintSilhouette(rc,s);
  // rarity trim: band across the lower third (blue+), notch (green), corner diamonds (purple+) -- baked with source-atop
  const col=RARITY_COLOR[s.rar]; const rk=RARITY_RANK[s.rar];
  if(rk>=1&&s.kind!=='chip'||rk>=2){ rc.globalCompositeOperation='source-atop'; rc.fillStyle=col;
    if(rk===1){ rc.globalAlpha=.9; rc.fillRect(0,62,CELL,2.6); } else if(rk>=2){ rc.globalAlpha=.7; rc.fillRect(0,60,CELL,3); if(rk>=3){ rc.fillRect(0,67,CELL,1.6); } if(rk>=4){ rc.globalAlpha=.55; for(let i=0;i<7;i++) rc.fillRect(8+i*12,30,5,2); } }
    rc.globalAlpha=1; rc.globalCompositeOperation='source-over'; }
  // outline: 8-offset stamp tinted by rarity (grey: dark outline)
  cv=mk(CELL,CELL); const c=cv.getContext('2d')!; const t=mk(CELL,CELL); const tc=t.getContext('2d')!; const oc=rk===0?'#1d1f1e':col; const w=rk>=3?2.2:rk>=1?1.8:1.4;
  for(let i=0;i<8;i++){ const a=i/8*6.283; tc.drawImage(raw,Math.cos(a)*w,Math.sin(a)*w); } tc.globalCompositeOperation='source-in'; tc.fillStyle=oc; tc.fillRect(0,0,CELL,CELL);
  c.drawImage(t,0,0); c.drawImage(raw,0,0); icons.set(s.key,cv); return cv;
}
/** pre-rendered light-sweep frames: the icon silhouette intersected with a moving diagonal band */
function sheenFrames(s:LootSpec):HTMLCanvasElement[]{ let f=sheens.get(s.key); if(f) return f; const ic=iconCanvas(s); f=[];
  for(let i=0;i<SHEEN_N;i++){ const cv=mk(CELL,CELL); const c=cv.getContext('2d')!; c.drawImage(ic,0,0); c.globalCompositeOperation='source-atop'; const x=-30+i/(SHEEN_N-1)*(CELL+60); const g=c.createLinearGradient(x-14,0,x+14,0); g.addColorStop(0,'rgba(255,244,214,0)'); g.addColorStop(.5,'rgba(255,244,214,.85)'); g.addColorStop(1,'rgba(255,244,214,0)'); c.fillStyle=g; c.save(); c.translate(48,48); c.rotate(.5); c.translate(-48,-48); c.fillRect(x-20,-40,40,CELL+80); c.restore(); f.push(cv); }
  sheens.set(s.key,f); return f; }
export function clearLootCaches(){ icons.clear(); sheens.clear(); }
export const cacheStats=()=>({icons:icons.size,sheens:sheens.size});

// ---------------------------------------------------------------- spawn toss
export const TOSS_T=.72;
/** analytic toss: returns screen offsets (dx,dy px, up = z px) and dust phases. age in seconds since spawn. */
export function toss(age:number,seed:number,s:number){
  const a=(seed%628)/100, sx=Math.cos(a)*26*s, sy=Math.sin(a)*13*s; // start offset (where the enemy was) in screen px
  const T1=.36; let z=0, k=1;
  if(age<T1){ const u=age/T1; z=4*40*s*u*(1-u)*.9; k=1-u*u*(3-2*u)*1; k=1-(3*u*u-2*u*u*u); }
  else if(age<T1+.17){ const u=(age-T1)/.17; z=4*9*s*u*(1-u); k=0; }
  else if(age<T1+.17+.1){ const u=(age-T1-.17)/.1; z=4*3*s*u*(1-u); k=0; } else k=0;
  return { dx:sx*k, dy:sy*k, z, flying:age<T1, landed1:age>=T1, landed2:age>=T1+.17, done:age>=TOSS_T };
}
function dust(c:C,x:number,y:number,u:number,s:number,col:string,sparks:boolean,seed:number){ if(u<0||u>1) return; const a=1-u;
  c.save(); c.globalAlpha=a*.5; c.fillStyle='#8d8878'; for(let i=0;i<6;i++){ const an=i/6*6.283+seed*.1; const r=(5+u*14)*s; c.beginPath(); c.ellipse(x+Math.cos(an)*r,y+Math.sin(an)*r*.5,(2.6+u*2)*s,(1.6+u)*s,0,0,7); c.fill(); }
  if(sparks){ c.globalAlpha=a; c.strokeStyle=col; c.lineWidth=1.4; for(let i=0;i<5;i++){ const an=i/5*6.283+seed; const r0=(3+u*12)*s, r1=r0+4*s; c.beginPath(); c.moveTo(x+Math.cos(an)*r0,y+Math.sin(an)*r0*.5-u*6*s); c.lineTo(x+Math.cos(an)*r1,y+Math.sin(an)*r1*.5-u*8*s); c.stroke(); } }
  c.restore(); }
// ---------------------------------------------------------------- idle effects
function gear(c:C,x:number,y:number,r:number,rot:number,teeth:number,col:string,dk:string){ c.beginPath(); for(let i=0;i<teeth*2;i++){ const a=rot+i/(teeth*2)*6.283; const rr_=i%2?r*.78:r; c.lineTo(x+Math.cos(a)*rr_,y+Math.sin(a)*rr_*.5); } c.closePath(); c.fillStyle=col; c.fill(); c.strokeStyle=dk; c.lineWidth=1; c.stroke(); c.fillStyle=dk; c.beginPath(); c.ellipse(x,y,r*.25,r*.125,0,0,7); c.fill(); }
function glint(c:C,x:number,y:number,r:number,a:number){ c.save(); c.globalAlpha=a; c.fillStyle='#f4ecd2'; c.beginPath(); c.moveTo(x,y-r); c.lineTo(x+r*.18,y-r*.18); c.lineTo(x+r,y); c.lineTo(x+r*.18,y+r*.18); c.lineTo(x,y+r); c.lineTo(x-r*.18,y+r*.18); c.lineTo(x-r,y); c.lineTo(x-r*.18,y-r*.18); c.closePath(); c.fill(); c.restore(); }
const sm=(u:number)=>u<=0?0:u>=1?1:u*u*(3-2*u);
export interface DrawOpts { age:number; reduced:boolean; fx:0|1|2; dim?:boolean; }
/** fx: 0 = icon + shadow only (far/over-budget), 1 = static trims (Reduced FX), 2 = full animation */
export function drawLoot(c:C,a:number,b:number,s:number,t:number,spec:LootSpec,seed:number,o:DrawOpts){
  const rk=RARITY_RANK[spec.rar], col=RARITY_COLOR[spec.rar]; const k=s*(o.dim?.34:.5)*(spec.kind==='credits'?.9:1)*(1+rk*.07); const ic=iconCanvas(spec);
  const tt=toss(o.age,seed,s); const settled=tt.done; const full=o.fx===2;
  const hoverBase=rk===4?(11+(full?2.2*Math.sin(t*1.5+seed):0))*s:rk===3&&full?(2+1.6*Math.sin(t*1.1+seed))*s:0; const hv=hoverBase*sm((o.age-TOSS_T)/.5);
  const gx=a+tt.dx, gy=b+tt.dy; const lift=tt.z+hv; const cy=gy-14*s*(o.dim?.7:1)-lift;
  c.save();
  // ground shadow shrinks with height
  c.fillStyle='rgba(0,0,0,.32)'; const sh=Math.max(.45,1-lift/(60*s)); c.beginPath(); c.ellipse(gx,gy,11*s*sh,5*s*sh,0,0,7); c.fill();
  if(o.dim){ c.globalAlpha=.7; c.drawImage(ic,gx-48*k,cy-50*k,CELL*k,CELL*k); c.restore(); return; }
  const ph=t*1.0+seed*.37; // idle phase
  if(settled||o.age>TOSS_T*.5){ // ground marks
    if(rk>=1){ const pul=full?.5+.5*Math.sin(t*(rk===1?1.6:2.2)+seed):.6; c.strokeStyle=col; c.lineWidth=1.2*s; c.globalAlpha=(rk===1?.2:.3)*(.6+.4*pul); c.beginPath(); c.ellipse(gx,gy,(14+rk*1.5+pul*(full?2:0))*s,(6.5+rk*.7)*s,0,0,7); c.stroke(); c.globalAlpha=1; }
    if(rk===2&&full){ const g=c.createLinearGradient(0,gy,0,gy-34*s); g.addColorStop(0,col); g.addColorStop(1,'rgba(0,0,0,0)'); c.globalAlpha=.16+.06*Math.sin(t*2+seed); c.fillStyle=g; c.fillRect(gx-5*s,gy-34*s,10*s,34*s); c.globalAlpha=1; }
    if(rk>=3){ // mechanical ring with tick marks
      const R=(17+(rk===4?3:0))*s; c.strokeStyle=col; c.globalAlpha=.55; c.lineWidth=1.3*s; c.beginPath(); c.ellipse(gx,gy,R,R*.46,0,0,7); c.stroke(); c.globalAlpha=.85; c.lineWidth=2.2*s; const rot=full?t*(rk===4?.9:.6)+seed:seed;
      for(let i=0;i<(rk===4?8:6);i++){ const n=rk===4?8:6; const an=rot+i/n*6.283; c.beginPath(); c.ellipse(gx,gy,R,R*.46,0,an,an+.22); c.stroke(); } c.globalAlpha=1; }
    if(rk===4){ // warm ground beam: readable, narrow, fades up
      const g=c.createLinearGradient(0,gy,0,gy-70*s); g.addColorStop(0,'rgba(226,150,72,.2)'); g.addColorStop(1,'rgba(204,127,60,0)'); c.fillStyle=g; const bw=(3.2+(full?.8*Math.sin(t*2.4+seed):0))*s; c.beginPath(); c.moveTo(gx-bw,gy-2*s); c.lineTo(gx-bw*.5,gy-70*s); c.lineTo(gx+bw*.5,gy-70*s); c.lineTo(gx+bw,gy-2*s); c.fill(); }
  }
  // purple gimbal rings (behind half)
  const gim=(front:boolean)=>{ const R=15*s, y0=cy; c.strokeStyle=col; c.lineWidth=1.5*s; for(let r=0;r<2;r++){ const tilt=full?t*(r?-1.1:1.4)+seed+r*1.7:seed+r*1.7; const ry=Math.abs(Math.cos(tilt))*R*.55+R*.12; const x0=r?Math.PI:0; c.globalAlpha=front?.85:.4; c.beginPath(); c.ellipse(gx,y0,R*(r?.78:1),ry,r?.9:-.5,front?0:Math.PI,front?Math.PI:Math.PI*2); c.stroke(); }
    c.globalAlpha=front?.95:.5; const pa=full?t*1.6+seed:seed; for(let i=0;i<3;i++){ const an=pa+i*2.094; const sn=Math.sin(an); if((sn>0)!==front) continue; const px=gx+Math.cos(an)*R, py=y0+sn*R*.4; c.fillStyle='#3a3340'; c.fillRect(px-2*s,py-1.6*s,4*s,3.2*s); c.fillStyle=col; c.fillRect(px-2*s,py-1.6*s,4*s,1.1*s); } c.globalAlpha=1; };
  // orange plated housing: plates open/close, split into back and front halves
  const open=rk===4&&full?sm(Math.sin(t*.8+seed)*1.6+.4)*.8+.1:.25;
  const housing=(front:boolean)=>{ const n=6; const R=(15+open*8)*s; for(let i=0;i<n;i++){ const an=(full?t*.5:0)+seed+i/n*6.283; const sn=Math.sin(an); if((sn>0)!==front) continue; const px=gx+Math.cos(an)*R, py=cy+9*s+sn*R*.4-open*3*s; const hh=(6.5-open*1.5)*s; c.save(); c.translate(px,py); c.rotate(Math.cos(an)*.25); const g=c.createLinearGradient(-3*s,0,3*s,0); g.addColorStop(0,'#5a4a3a'); g.addColorStop(.5,'#8a7355'); g.addColorStop(1,'#3a3026'); c.fillStyle=g; c.globalAlpha=front?1:.8; rr(c,-4.2*s,-hh,8.4*s,hh*2,1.6*s); c.fill(); c.strokeStyle='#201a14'; c.lineWidth=1; c.stroke(); c.fillStyle=col; c.fillRect(-4.2*s,-hh+1*s,8.4*s,1.3*s); c.restore(); } };
  if(rk===4){ // warm controlled light, then back housing
    if(full){ const g=c.createRadialGradient(gx,cy,0,gx,cy,34*s); g.addColorStop(0,'rgba(220,150,80,.22)'); g.addColorStop(1,'rgba(220,150,80,0)'); c.save(); c.globalCompositeOperation='lighter'; c.globalAlpha=.7+.3*Math.sin(t*1.7+seed); c.fillStyle=g; c.fillRect(gx-34*s,cy-34*s,68*s,68*s); c.restore(); }
    // kinetic gears on ground ring
    const gr=full?t:0; gear(c,gx-20*s,gy+1*s,4.6*s,gr*1.4+seed,8,'#7a6648','#251d14'); gear(c,gx+20*s,gy+1*s,4.6*s,-gr*1.4+.2,8,'#7a6648','#251d14'); if(spec.sig) gear(c,gx,gy+8*s,3.6*s,gr*2.2,6,'#8a7355','#251d14');
    housing(false); }
  if(rk===3) gim(false);
  // the item itself
  c.drawImage(ic,gx-48*k,cy-50*k,CELL*k,CELL*k);
  // light sweep (purple/orange continuous; grey rare, subtle) and glints
  if(full||o.fx===1){ const cyc=rk===0?4.5:rk>=3?2.6:3.4; const u=((t+seed*.13)%cyc)/cyc; const sw=rk>=3?.5:rk===0?.22:.3; if(u<.4&&full){ const fr=sheenFrames(spec); c.globalAlpha=sw*Math.sin(u/.4*Math.PI); c.drawImage(fr[Math.min(SHEEN_N-1,(u/.4*SHEEN_N)|0)],gx-48*k,cy-50*k,CELL*k,CELL*k); c.globalAlpha=1; }
    if(rk>=1&&rk<=2&&full){ const u2=((t*.7+seed*.21)%3)/3; if(u2<.18){ const hh=hx(spec.key); glint(c,gx+((hh%7)-3)*3*s,cy-6*s-(hh%5)*2*s,3.4*s*Math.sin(u2/.18*Math.PI),1); } } }
  if(rk===3) gim(true);
  if(rk===4){ housing(true);
    if(full){ // heat shimmer: faint warm wavy lines rising above
      c.strokeStyle='rgba(224,160,96,.5)'; c.lineWidth=1*s; for(let i=0;i<3;i++){ const ph2=(t*.5+i*.33+seed*.1)%1; c.globalAlpha=.32*(1-ph2)*Math.min(1,ph2*5); c.beginPath(); for(let y=0;y<=12;y++){ const yy=cy-14*s-ph2*26*s-y*1.2*s; const xx=gx+(i-1)*7*s+Math.sin(y*.9+t*5+i)*1.6*s; y?c.lineTo(xx,yy):c.moveTo(xx,yy); } c.stroke(); } c.globalAlpha=1; } }
  // spawn dust (+ sparks for blue and above), not under Reduced FX
  if(!o.reduced){ const sp=rk>=2; dust(c,a,b,(o.age-.36)/.32,s,col,sp,seed); dust(c,a,b,(o.age-.53)/.2,s*.6,col,false,seed+3); }
  c.restore();
}
// ---------------------------------------------------------------- pickup
export const PICK_T=.34;
export function drawPickup(c:C,fx:number,fy:number,tx:number,ty:number,s:number,p:number,spec:LootSpec,seed:number,reduced:boolean){
  if(p<0||p>1.5) return; const col=RARITY_COLOR[spec.rar]; const rk=RARITY_RANK[spec.rar]; const ic=iconCanvas(spec);
  const pos=(q:number)=>{ const e=q*q*(3-2*q*.6); const arc=Math.sin(q*Math.PI)*14*s; return { x:fx+(tx-fx)*e, y:(fy-14*s)+((ty-26*s)-(fy-14*s))*e-arc }; };
  c.save();
  if(p<=1){ const q=p; if(!reduced){ for(let i=5;i>=1;i--){ const qq=Math.max(0,q-i*.045); const pp=pos(qq); c.globalAlpha=(1-i/6)*.5; c.fillStyle=col; c.beginPath(); c.arc(pp.x,pp.y,(3.6-i*.4)*s,0,7); c.fill(); } }
    const pp=pos(q); const k=s*.5*(1-q*.6)*(1+rk*.07); c.globalAlpha=1-q*.35; c.drawImage(ic,pp.x-48*k,pp.y-50*k,CELL*k,CELL*k);
    if(q>.85&&!reduced){ c.globalAlpha=(q-.85)/.15; c.fillStyle='#fff6dc'; c.beginPath(); c.arc(pp.x,pp.y,5*s,0,7); c.fill(); } }
  else if(!reduced){ const u=(p-1)/.5; const pp=pos(1); c.globalAlpha=(1-u)*.8; c.strokeStyle=rk>0?col:'#d8d2bf'; c.lineWidth=2*s*(1-u); c.beginPath(); c.arc(pp.x,pp.y,(4+u*13)*s,0,7); c.stroke(); c.globalAlpha=(1-u)*.9; c.fillStyle='#fff6dc'; c.beginPath(); c.arc(pp.x,pp.y,(5*(1-u))*s,0,7); c.fill(); if(rk>=2){ c.lineWidth=1.2*s; for(let i=0;i<6;i++){ const an=i/6*6.283+seed; c.beginPath(); c.moveTo(pp.x+Math.cos(an)*(7+u*8)*s,pp.y+Math.sin(an)*(7+u*8)*s*.8); c.lineTo(pp.x+Math.cos(an)*(10+u*12)*s,pp.y+Math.sin(an)*(10+u*12)*s*.8); c.stroke(); } } }
  c.restore();
}
// ---------------------------------------------------------------- labels
export function drawLabel(c:C,x:number,y:number,s:number,spec:LootSpec,strong:boolean){ const fs=Math.max(10,Math.round(11*Math.max(.9,s))); c.save(); c.font=`600 ${fs}px system-ui,sans-serif`; const txt=spec.name; const w=c.measureText(txt).width+12, h=fs+7; const col=RARITY_COLOR[spec.rar];
  c.globalAlpha=strong?.95:.78; c.fillStyle='rgba(14,15,16,.82)'; rr(c,x-w/2,y-h,w,h,3); c.fill(); c.strokeStyle=col; c.lineWidth=1; c.stroke(); c.fillStyle=spec.rar==='grey'?'#cfc9b6':col; c.textAlign='center'; c.textBaseline='middle'; c.globalAlpha=1; c.fillText(txt,x,y-h/2+.5);
  if(spec.mfr){ c.fillStyle=PAL[spec.mfr].b; c.fillRect(x-w/2+1,y-h+1,2.6,h-2); } c.restore(); return { w, h }; }
export const LOOT_FILTERS:Rarity[]=['grey','green','blue','purple','orange'];
export const visibleAt=(spec:LootSpec,min:Rarity)=>RARITY_RANK[spec.rar]>=RARITY_RANK[min];
