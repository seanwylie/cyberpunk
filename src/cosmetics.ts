// Procedural renderer for wardrobe cosmetics (first-pass art; see docs/APPEARANCE_ITEMS.md for the art still needed).
// Drawn around the player sprite in two phases: 'back' (aura, back gear, behind the body) and 'front' (skin, marks, clothing, hair, headgear, eyes).
// Units: u = screen px per procedural unit; the character stands with feet at (x,y) and is ~48u tall (head ~y-41u, shoulders -34u, hips -20u).
import type { CosDef, CosSlot } from './content/appearance';
import { drawRarityFx, glowSprite } from './cosfx';
import { drawPm } from './pmfx';
import { hasCosArt } from './coslayers';

type C=CanvasRenderingContext2D;
export interface CosCtx { c:C; x:number; y:number; u:number; t:number; moving:boolean; face:number; /** an ability fired this frame (premium flourish) */ cast?:boolean; /** owner id for the shared rarity-FX particle pool (local player = 'me') */ id?:string; /** no baked model drawn (procedural fallback): draw every piece as 2D */ noModel?:boolean; }
const rgba=(hex:string,a:number)=>{ const h=hex.replace('#',''); const n=parseInt(h.length===3?h.split('').map(x=>x+x).join(''):h,16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; };
const ell=(c:C,x:number,y:number,rx:number,ry:number)=>{ c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); };
const glow=(c:C,x:number,y:number,r:number,col:string,a:number)=>{ const g=c.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,rgba(col,a)); g.addColorStop(1,rgba(col,0)); c.fillStyle=g; c.fillRect(x-r,y-r,r*2,r*2); };
const poly=(c:C,pts:number[][],fill?:string,stroke?:string,lw=1)=>{ c.beginPath(); pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])); c.closePath(); if(fill){ c.fillStyle=fill; c.fill(); } if(stroke){ c.strokeStyle=stroke; c.lineWidth=lw; c.stroke(); } };

type Fn=(k:CosCtx,d:CosDef)=>void;
/** Render audit (tests/cosmetics_render.mjs): when a test sets globalThis.__cosAudit = {} and counts canvas ops in globalThis.__ops,
 *  every cosmetic draw records how many canvas ops it issued under `${owner}|${slot}|${id}`. Off (one global read) in normal play. */
export function cosAudit(owner:string,slot:string,id:string,f:()=>void){ const A=(globalThis as any).__cosAudit; if(!A){ f(); return; } const n0=(globalThis as any).__ops||0; try{ f(); } finally{ const k=owner+'|'+slot+'|'+id; A[k]=(A[k]||0)+((globalThis as any).__ops||0)-n0; } }
const pulse=(k:CosCtx,sp=2,lo=.55)=>lo+(1-lo)*(.5+.5*Math.sin(k.t*sp));
const add=(c:C,f:()=>void)=>{ c.save(); c.globalCompositeOperation='lighter'; f(); c.restore(); };

/** body regions (centre x, centre y, rx, ry) in units, used by skin/tattoo/clothing overlays */
const REG={ torso:[0,-28,8.5,10], armL:[-9.5,-27,2.8,10], armR:[9.5,-27,2.8,10], legL:[-4,-10,3.6,10], legR:[4,-10,3.6,10], head:[0,-41,5.2,5.8] } as const;
const bodyEll=(k:CosCtx,names:(keyof typeof REG)[],fill:string)=>{ const {c,x,y,u}=k; c.fillStyle=fill; for(const n of names){ const r=REG[n]; ell(c,x+r[0]*u,y+r[1]*u,r[2]*u,r[3]*u); c.fill(); } };
const ALL:(keyof typeof REG)[]=['torso','armL','armR','legL','legR','head'];

// ---------- skin ----------
const SKIN:Record<string,Fn>={
  tint:(k,d)=>{ bodyEll(k,ALL,rgba(d.c,.3)); },
  patina:(k,d)=>{ const {c,x,y,u}=k; bodyEll(k,ALL,rgba(d.c,.22)); c.fillStyle=rgba(d.c2||d.c,.5); for(let i=0;i<14;i++){ const r=REG[ALL[i%6]]; const a=i*2.4; ell(c,x+(r[0]+Math.cos(a)*r[2]*.6)*u,y+(r[1]+Math.sin(a*1.7)*r[3]*.6)*u,1.4*u,1*u); c.fill(); } },
  chrome:(k,d)=>{ const {c,x,y,u,t}=k; bodyEll(k,ALL,rgba(d.c,.34)); const sx=((t*.6)%1.6-.3)*22*u-11*u; c.save(); c.globalCompositeOperation='lighter'; for(const n of ALL){ const r=REG[n]; const g=c.createLinearGradient(x+sx-3*u,0,x+sx+3*u,0); g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(.5,'rgba(255,255,255,.55)'); g.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=g; c.beginPath(); c.ellipse(x+r[0]*u,y+r[1]*u,r[2]*u,r[3]*u,0,0,7); c.save(); c.clip(); c.fillRect(x+sx-3*u,y+(r[1]-r[3])*u,6*u,r[3]*2*u); c.restore(); } c.restore(); },
  veins:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ c.strokeStyle=rgba(d.c,.55+.35*Math.sin(t*3)); c.lineWidth=Math.max(1,.9*u); c.lineCap='round'; for(const [a,b,e,f] of [[-5,-34,-6,-22],[5,-34,6,-22],[0,-36,0,-20],[-9.5,-33,-9.5,-20],[9.5,-33,9.5,-20],[-4,-18,-4,-3],[4,-18,4,-3],[-2,-44,2,-39]] as number[][]){ c.beginPath(); c.moveTo(x+a*u,y+b*u); c.quadraticCurveTo(x+(a+(f-b)*.12)*u,y+(b+e)/2*u,x+e*u,y+f*u); c.stroke(); } }); },
  ceramic:(k,d)=>{ const {c}=k; bodyEll(k,ALL,rgba(d.c,.55)); add(c,()=>bodyEll(k,['torso','head'],rgba('#ffffff',.14*pulse(k,1.2)))); },
  circuit:(k,d)=>{ const {c,x,y,u,t}=k; bodyEll(k,ALL,rgba('#10242a',.28)); add(c,()=>{ c.strokeStyle=rgba(d.c,.45+.3*Math.sin(t*2)); c.lineWidth=Math.max(1,.7*u); for(let i=0;i<7;i++){ const yy=-36+i*3.2; c.beginPath(); c.moveTo(x-7*u,y+yy*u); c.lineTo(x-3*u,y+yy*u); c.lineTo(x-1*u,y+(yy+1.6)*u); c.lineTo(x+4*u,y+(yy+1.6)*u); c.lineTo(x+7*u,y+yy*u); c.stroke(); } }); },
  ember:(k,d)=>{ const {c,x,y,u,t}=k; bodyEll(k,ALL,rgba('#2a1208',.3)); add(c,()=>{ c.strokeStyle=rgba(d.c,.5+.4*Math.sin(t*2.5)); c.lineWidth=Math.max(1,.9*u); for(const [a,b,e,f] of [[-6,-36,-2,-28],[2,-36,6,-26],[-4,-26,-7,-20],[5,-22,2,-18],[-11,-30,-10,-22],[10,-30,11,-22],[-4,-12,-3,-4],[4,-14,4,-6]] as number[][]){ c.beginPath(); c.moveTo(x+a*u,y+b*u); c.lineTo(x+(a+e)/2*u+u*.6,y+(b+f)/2*u); c.lineTo(x+e*u,y+f*u); c.stroke(); } glow(c,x,y-27*u,12*u,d.c2||d.c,.18*pulse(k,2)); }); },
  frost:(k,d)=>{ const {c,x,y,u}=k; bodyEll(k,ALL,rgba(d.c,.3)); c.fillStyle=rgba('#ffffff',.55); for(let i=0;i<16;i++){ const r=REG[ALL[i%6]]; const a=i*2.1; poly(c,[[x+(r[0]+Math.cos(a)*r[2]*.8)*u,y+(r[1]+Math.sin(a)*r[3]*.8)*u-1.3*u],[x+(r[0]+Math.cos(a)*r[2]*.8)*u+.9*u,y+(r[1]+Math.sin(a)*r[3]*.8)*u],[x+(r[0]+Math.cos(a)*r[2]*.8)*u-.9*u,y+(r[1]+Math.sin(a)*r[3]*.8)*u]],'rgba(255,255,255,.6)'); } },
  holo:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ for(const n of ALL){ const r=REG[n]; const g=c.createLinearGradient(x+(r[0]-r[2])*u,y+(r[1]-r[3])*u,x+(r[0]+r[2])*u,y+(r[1]+r[3])*u); const h=(t*60)%360; g.addColorStop(0,`hsla(${h},90%,70%,.55)`); g.addColorStop(.5,`hsla(${(h+120)%360},90%,70%,.45)`); g.addColorStop(1,`hsla(${(h+240)%360},90%,70%,.55)`); c.fillStyle=g; ell(c,x+r[0]*u,y+r[1]*u,r[2]*u,r[3]*u); c.fill(); } }); },
};

// ---------- tattoos ----------
const TAT:Record<string,Fn>={
  barcode:(k,d)=>{ const {c,x,y,u}=k; c.fillStyle=rgba(d.c,.85); for(let i=0;i<9;i++) c.fillRect(x+(-3.6+i*.9)*u,y-37.5*u,(i%3?.4:.7)*u,3*u); },
  serial:(k,d)=>{ const {c,x,y,u}=k; c.fillStyle=rgba(d.c,.85); c.font=`${Math.max(5,2.6*u)}px monospace`; c.textAlign='center'; c.fillText('HB-4471',x+6.8*u,y-25*u); },
  sigil:(k,d)=>{ const {c,x,y,u}=k; c.strokeStyle=rgba(d.c,.9); c.lineWidth=Math.max(1,.9*u); c.beginPath(); c.arc(x,y-30*u,2.6*u,0,7); c.moveTo(x-3.4*u,y-30*u); c.lineTo(x+3.4*u,y-30*u); c.moveTo(x,y-33.6*u); c.lineTo(x,y-26.4*u); c.stroke(); },
  cracks:(k,d)=>{ const {c,x,y,u}=k; c.strokeStyle=rgba(d.c,.8); c.lineWidth=Math.max(1,.7*u); for(const [a,b] of [[-6,-34],[3,-31],[-9,-26],[10,-27]]){ c.beginPath(); c.moveTo(x+a*u,y+b*u); c.lineTo(x+(a+2)*u,y+(b+2.2)*u); c.lineTo(x+(a+1)*u,y+(b+4.4)*u); c.lineTo(x+(a+3)*u,y+(b+6)*u); c.stroke(); } },
  circuit:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ c.strokeStyle=rgba(d.c,.55+.3*Math.sin(t*2.4)); c.lineWidth=Math.max(1,.8*u); c.beginPath(); c.moveTo(x-11*u,y-34*u); c.lineTo(x-11*u,y-28*u); c.lineTo(x-9.5*u,y-26*u); c.lineTo(x-9.5*u,y-20*u); c.moveTo(x-11*u,y-30*u); c.lineTo(x-13*u,y-28*u); c.stroke(); }); },
  bio:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ c.fillStyle=rgba(d.c,.4+.4*Math.sin(t*1.6)); for(let i=0;i<6;i++){ ell(c,x+(-5+i*2)*u,y+(-33+((i*7)%5)*2.6)*u,.9*u,.9*u); c.fill(); } glow(c,x,y-29*u,9*u,d.c,.1); }); },
  stamp:(k,d)=>{ const {c,x,y,u,t}=k; c.save(); c.translate(x,y-29*u); c.rotate(-.15); c.globalAlpha=.7+.25*Math.sin(t*2); c.strokeStyle=d.c; c.lineWidth=Math.max(1,.8*u); c.strokeRect(-5.2*u,-2.2*u,10.4*u,4.4*u); c.fillStyle=d.c; c.font=`bold ${Math.max(6,3.4*u)}px sans-serif`; c.textAlign='center'; c.textBaseline='middle'; c.fillText('VOID',0,.2*u); c.restore(); },
};

// ---------- clothing / plating (non-variant look) ----------
const CLOTH:Record<string,Fn>={
  stripe:(k,d)=>{ const {c,x,y,u}=k; const L=d.slot==='legs'; for(let i=0;i<3;i++){ c.fillStyle=i%2?rgba(d.c2||'#222',.8):rgba(d.c,.85); if(L){ c.fillRect(x-7.4*u,y-(6+i*2.6)*u,6.4*u,1.5*u); c.fillRect(x+1*u,y-(6+i*2.6)*u,6.4*u,1.5*u); } else c.fillRect(x-8*u,y-(33-i*3)*u,16*u,1.8*u); } },
  vest:(k,d)=>{ const {c,x,y,u}=k; poly(c,[[x-8*u,y-36*u],[x-2.5*u,y-36*u],[x-3.2*u,y-18*u],[x-8.2*u,y-18*u]],rgba(d.c,.85)); poly(c,[[x+8*u,y-36*u],[x+2.5*u,y-36*u],[x+3.2*u,y-18*u],[x+8.2*u,y-18*u]],rgba(d.c,.85)); c.fillStyle=rgba(d.c2||'#ccc',.9); c.fillRect(x-8*u,y-29*u,5.2*u,1.4*u); c.fillRect(x+2.8*u,y-29*u,5.2*u,1.4*u); },
  chevron:(k,d)=>{ const {c,x,y,u}=k; c.strokeStyle=rgba(d.c,.9); c.lineWidth=Math.max(1.4,1.7*u); for(let i=0;i<3;i++){ c.beginPath(); c.moveTo(x-6*u,y-(33-i*3.6)*u); c.lineTo(x,y-(30-i*3.6)*u); c.lineTo(x+6*u,y-(33-i*3.6)*u); c.stroke(); } },
  lights:(k,d)=>{ const {c,x,y,u,t}=k; for(let i=0;i<5;i++){ const on=Math.sin(t*2.2+i*1.3)>-.2; add(c,()=>{ c.fillStyle=rgba(on?d.c:(d.c2||d.c),on?.9:.35); ell(c,x,y-(35-i*3.4)*u,1*u,1*u); c.fill(); }); } },
  gown:(k,d)=>{ const {c,x,y,u}=k; poly(c,[[x-8.5*u,y-37*u],[x+8.5*u,y-37*u],[x+9.5*u,y-14*u],[x-9.5*u,y-14*u]],rgba(d.c,.62)); c.fillStyle=rgba(d.c2||'#fff',.8); c.fillRect(x-1*u,y-37*u,2*u,20*u); },
  core:(k,d)=>{ const {c,x,y,u,t}=k; ell(c,x,y-29*u,3.6*u,3.6*u); c.fillStyle=rgba(d.c2||'#222',.85); c.fill(); add(c,()=>{ glow(c,x,y-29*u,10*u,d.c,.55*pulse(k,2.2)); c.fillStyle=rgba(d.c,.95); ell(c,x,y-29*u,2.2*u,2.2*u); c.fill(); }); void t; },
  panel:(k,d)=>{ const {c,x,y,u}=k; poly(c,[[x-7*u,y-37*u],[x+7*u,y-37*u],[x+7.5*u,y-20*u],[x-7.5*u,y-20*u]],rgba(d.c,.7),rgba(d.c2||'#fff',.9),Math.max(1,.8*u)); c.fillStyle=rgba(d.c2||'#555',.8); for(let i=0;i<4;i++) c.fillRect(x-5*u,y-(34-i*4)*u,10*u,.8*u); },
  plate:(k,d)=>{ const {c,x,y,u}=k; poly(c,[[x-8.5*u,y-37*u],[x+8.5*u,y-37*u],[x+6.5*u,y-19*u],[x-6.5*u,y-19*u]],rgba(d.c,.75),rgba(d.c2||'#444',.95),Math.max(1,.9*u)); c.fillStyle=rgba(d.c2||'#444',.9); for(const [a,b] of [[-6,-35],[6,-35],[-5,-21],[5,-21]]) { ell(c,x+a*u,y+b*u,.6*u,.6*u); c.fill(); } },
  bands:(k,d)=>{ const {c,x,y,u}=k; c.fillStyle=rgba(d.c,.85); for(const sx of [-1,1]) for(let i=0;i<3;i++) c.fillRect(x+(sx*10.5-2.6)*u,y-(31-i*3.2)*u,5.2*u,1.3*u); },
  sleeve:(k,d)=>{ const {c,x,y,u}=k; c.fillStyle=rgba(d.c,.7); for(const sx of [-1,1]) c.fillRect(x+(sx*10.5-3.2)*u,y-36*u,6.4*u,13*u); },
  piston:(k,d)=>{ const {c,x,y,u}=k; for(const sx of [-1,1]){ c.fillStyle=rgba(d.c,.95); c.fillRect(x+(sx*12.4-.7)*u,y-33*u,1.4*u,11*u); c.fillStyle=rgba(d.c2||'#333',.9); c.fillRect(x+(sx*12.4-1.2)*u,y-28*u,2.4*u,3*u); } },
  conduit:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ c.strokeStyle=rgba(d.c,.6+.3*Math.sin(t*3)); c.lineWidth=Math.max(1,1*u); for(const sx of [-1,1]){ c.beginPath(); c.moveTo(x+sx*11*u,y-36*u); c.lineTo(x+sx*11*u,y-22*u); c.stroke(); } }); },
  fused:(k,d)=>{ const {c,x,y,u,t}=k; for(const sx of [-1,1]){ c.fillStyle=rgba(d.c2||'#333',.6); c.fillRect(x+(sx*10.5-3.2)*u,y-36*u,6.4*u,13*u); } add(c,()=>{ c.strokeStyle=rgba(d.c,.6+.3*Math.sin(t*2.4)); c.lineWidth=Math.max(1,.9*u); for(const sx of [-1,1]){ c.beginPath(); c.moveTo(x+(sx*10.5-2)*u,y-34*u); c.lineTo(x+(sx*10.5+2)*u,y-30*u); c.lineTo(x+(sx*10.5-2)*u,y-26*u); c.stroke(); } }); },
  gloves:(k,d)=>{ const {c,x,y,u}=k; c.fillStyle=rgba(d.c,.9); for(const sx of [-1,1]){ ell(c,x+sx*11.2*u,y-16.5*u,2.6*u,2.6*u); c.fill(); } },
  knuckle:(k,d)=>{ const {c,x,y,u}=k; c.strokeStyle=rgba(d.c,.95); c.lineWidth=Math.max(1,.9*u); for(const sx of [-1,1]) for(let i=0;i<3;i++){ c.beginPath(); c.arc(x+(sx*11.2+(i-1)*1.4)*u,y-16*u,.8*u,0,7); c.stroke(); } },
  glowpalm:(k,d)=>{ const {c,x,y,u}=k; add(c,()=>{ for(const sx of [-1,1]) glow(c,x+sx*11.2*u,y-16.5*u,5.5*u,d.c,.6*pulse(k,2.6,.5)); }); },
  greaves:(k,d)=>{ const {c,x,y,u}=k; for(const sx of [-1,1]){ poly(c,[[x+sx*4*u-3*u,y-14*u],[x+sx*4*u+3*u,y-14*u],[x+sx*4*u+2.4*u,y-5*u],[x+sx*4*u-2.4*u,y-5*u]],rgba(d.c,.8),rgba(d.c2||'#222',.9),Math.max(1,.7*u)); } },
  rails:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ c.strokeStyle=rgba(d.c,.65+.3*Math.sin(t*3)); c.lineWidth=Math.max(1,.9*u); for(const sx of [-1,1]){ c.beginPath(); c.moveTo(x+sx*5.6*u,y-18*u); c.lineTo(x+sx*5.2*u,y-2*u); c.stroke(); } }); },
};

// ---------- hair ----------
const HAIR:Record<string,Fn>={
  buzz:(k,d)=>{ const {c,x,y,u}=k; c.fillStyle=rgba(d.c,.85); c.beginPath(); c.ellipse(x,y-43.5*u,5.1*u,3.6*u,0,Math.PI,0); c.fill(); },
  crop:(k,d)=>{ const {c,x,y,u}=k; c.fillStyle=rgba(d.c,.95); c.beginPath(); c.ellipse(x,y-43.2*u,5.4*u,4*u,0,Math.PI,0); c.lineTo(x+5.4*u,y-41*u); c.lineTo(x-5.4*u,y-41*u); c.fill(); },
  tail:(k,d)=>{ const {c,x,y,u,t}=k; HAIR.crop(k,d); c.strokeStyle=rgba(d.c,.95); c.lineWidth=2*u; c.lineCap='round'; c.beginPath(); c.moveTo(x,y-42*u); c.quadraticCurveTo(x-6*u,y-38*u+Math.sin(t*3)*u,x-6.5*u,y-32*u); c.stroke(); },
  mohawk:(k,d)=>{ const {c,x,y,u}=k; for(let i=0;i<6;i++){ poly(c,[[x-1*u,y-(46-i*.2)*u+i*.9*u],[x+1*u,y-(46-i*.2)*u+i*.9*u],[x+.2*u,y-(52-i*.8)*u]],rgba(i%2?d.c:(d.c2||d.c),.95)); } c.fillStyle=rgba(d.c,.95); c.fillRect(x-1.3*u,y-47*u,2.6*u,5*u); },
  braids:(k,d)=>{ HAIR.crop(k,d); const {c,x,y,u}=k; c.strokeStyle=rgba(d.c,.95); c.lineWidth=1.4*u; for(const sx of [-1,1]) for(let i=0;i<2;i++){ c.beginPath(); c.moveTo(x+sx*(4.5-i*1.4)*u,y-42*u); c.lineTo(x+sx*(5.6-i*1.2)*u,y-33*u); c.stroke(); c.strokeStyle=rgba(d.c2||d.c,.9); c.lineWidth=.6*u; c.beginPath(); c.moveTo(x+sx*(5.6-i*1.2)*u,y-35*u); c.lineTo(x+sx*(5.6-i*1.2)*u,y-33*u); c.stroke(); c.strokeStyle=rgba(d.c,.95); c.lineWidth=1.4*u; } },
  undercut:(k,d)=>{ const {c,x,y,u}=k; c.fillStyle=rgba(d.c,.95); c.beginPath(); c.ellipse(x+.5*u,y-44.5*u,4.4*u,3*u,0,Math.PI,0); c.fill(); c.fillStyle=rgba(d.c,.4); c.fillRect(x-5*u,y-42*u,10*u,1.6*u); },
  spikes:(k,d)=>{ const {c,x,y,u,t}=k; for(let i=0;i<7;i++){ const a=-Math.PI*.9+i*Math.PI*.8/6; poly(c,[[x+Math.cos(a)*4*u-.9*u,y-43*u+Math.sin(a)*3*u],[x+Math.cos(a)*4*u+.9*u,y-43*u+Math.sin(a)*3*u],[x+Math.cos(a)*8.4*u,y-43*u+Math.sin(a)*7*u]],rgba(d.c,.95)); } add(k.c,()=>{ for(let i=0;i<7;i++){ const a=-Math.PI*.9+i*Math.PI*.8/6; k.c.fillStyle=rgba(d.c2||d.c,.4+.3*Math.sin(t*2+i)); ell(k.c,x+Math.cos(a)*8.2*u,y-43*u+Math.sin(a)*6.8*u,.8*u,.8*u); k.c.fill(); } }); },
  long:(k,d)=>{ const {c,x,y,u,t}=k; HAIR.crop(k,d); c.strokeStyle=rgba(d.c,.9); c.lineWidth=1.3*u; c.lineCap='round'; for(let i=0;i<8;i++){ const sx=(i-3.5)*1.2; c.beginPath(); c.moveTo(x+sx*u,y-42*u); c.quadraticCurveTo(x+(sx*1.6)*u+Math.sin(t*1.6+i)*u,y-34*u,x+sx*1.8*u+Math.sin(t*1.8+i)*1.5*u,y-27*u); c.stroke(); } if(d.c2) add(c,()=>{ c.strokeStyle=rgba(d.c2!,.35+.25*Math.sin(t*2)); c.lineWidth=.5*u; for(let i=0;i<8;i+=2){ const sx=(i-3.5)*1.2; c.beginPath(); c.moveTo(x+sx*u,y-42*u); c.quadraticCurveTo(x+(sx*1.6)*u,y-34*u,x+sx*1.8*u,y-27*u); c.stroke(); } }); },
  flame:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ for(let i=0;i<9;i++){ const a=-Math.PI*.95+i*Math.PI*.9/8, fl=1+.35*Math.sin(t*9+i*1.7); const bx=x+Math.cos(a)*3.8*u, by=y-43*u+Math.sin(a)*3*u; poly(c,[[bx-1.4*u,by],[bx+1.4*u,by],[bx+Math.cos(a)*3*u,by+Math.sin(a)*(8+i%3*2)*u*fl]],rgba(i%2?d.c:(d.c2||d.c),.8)); } glow(c,x,y-44*u,10*u,d.c,.35); }); },
};

// ---------- headgear ----------
const HEAD:Record<string,Fn>={
  cap:(k,d)=>{ const {c,x,y,u}=k; c.fillStyle=rgba(d.c,.95); c.beginPath(); c.ellipse(x,y-43.3*u,5.5*u,3.8*u,0,Math.PI,0); c.fill(); c.fillRect(x-5.5*u,y-43.6*u,11*u,1.4*u); c.fillRect(x+1*u,y-42.4*u,6*u,1*u); },
  bandana:(k,d)=>{ const {c,x,y,u}=k; c.fillStyle=rgba(d.c,.95); c.fillRect(x-5.4*u,y-44*u,10.8*u,2.2*u); poly(c,[[x-5.4*u,y-43.8*u],[x-8*u,y-42*u],[x-5.4*u,y-41.6*u]],rgba(d.c,.95)); },
  goggles:(k,d)=>{ const {c,x,y,u}=k; c.fillStyle=rgba(d.c,.95); c.fillRect(x-5.6*u,y-45.4*u,11.2*u,1.2*u); for(const sx of [-2.4,2.4]){ ell(c,x+sx*u,y-45.4*u,2.2*u,2.2*u); c.fillStyle=rgba(d.c,1); c.fill(); ell(c,x+sx*u,y-45.4*u,1.5*u,1.5*u); c.fillStyle=rgba(d.c2||'#e0b050',.9); c.fill(); } },
  respirator:(k,d)=>{ const {c,x,y,u}=k; ell(c,x,y-38.2*u,3.8*u,2.4*u); c.fillStyle=rgba(d.c,.95); c.fill(); for(const sx of [-3.6,3.6]){ ell(c,x+sx*u,y-37.6*u,1.5*u,1.5*u); c.fillStyle=rgba(d.c2||'#999',.95); c.fill(); } },
  visor:(k,d)=>{ const {c,x,y,u,t}=k; c.fillStyle=rgba(d.c,.55); c.fillRect(x-5.4*u,y-42.4*u,10.8*u,2.6*u); add(c,()=>{ c.fillStyle=rgba(d.c2||'#fff',.35+.25*Math.sin(t*2.4)); c.fillRect(x-5.4*u,y-41.6*u,10.8*u,.7*u); }); },
  horns:(k,d)=>{ const {c,x,y,u}=k; c.strokeStyle=rgba(d.c,.95); c.lineWidth=Math.max(1.4,1.8*u); c.lineCap='round'; for(const sx of [-1,1]){ c.beginPath(); c.moveTo(x+sx*5*u,y-42*u); c.quadraticCurveTo(x+sx*10*u,y-43*u,x+sx*8.6*u,y-49*u); c.stroke(); } },
  antenna:(k,d)=>{ const {c,x,y,u,t}=k; c.strokeStyle=rgba(d.c,.95); c.lineWidth=Math.max(1,.9*u); c.beginPath(); c.moveTo(x+3*u,y-46*u); c.lineTo(x+4.4*u,y-53*u); c.stroke(); add(c,()=>{ c.fillStyle=rgba(d.c2||d.c,Math.sin(t*4)>0?.95:.25); ell(c,x+4.4*u,y-53.4*u,1.1*u,1.1*u); c.fill(); }); },
  halo:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ c.strokeStyle=rgba(d.c,.7+.25*Math.sin(t*2)); c.lineWidth=Math.max(1.2,1.2*u); c.beginPath(); c.ellipse(x,y-50*u+Math.sin(t*2)*.5*u,6*u,2*u,0,0,7); c.stroke(); glow(c,x,y-50*u,9*u,d.c,.18); }); },
  crown:(k,d)=>{ const {c,x,y,u}=k; for(let i=0;i<5;i++){ poly(c,[[x+(-5+i*2.5)*u-1.1*u,y-45*u],[x+(-5+i*2.5)*u+1.1*u,y-45*u],[x+(-5+i*2.5)*u,y-49*u]],rgba(d.c,.98),rgba(d.c2||'#555',.9),Math.max(1,.5*u)); } c.fillStyle=rgba(d.c,.98); c.fillRect(x-5.5*u,y-45.2*u,11*u,1.8*u); },
  cowl:(k,d)=>{ const {c,x,y,u,t}=k; c.fillStyle=rgba(d.c,.95); c.beginPath(); c.ellipse(x,y-42.5*u,6.4*u,5.4*u,0,Math.PI,0); c.lineTo(x+6.4*u,y-36*u); c.lineTo(x+3.8*u,y-37*u); c.lineTo(x-3.8*u,y-37*u); c.lineTo(x-6.4*u,y-36*u); c.fill(); add(c,()=>{ c.strokeStyle=rgba(d.c2||'#f80',.6+.35*Math.sin(t*2)); c.lineWidth=Math.max(1,.8*u); c.beginPath(); c.moveTo(x-4*u,y-44*u); c.lineTo(x,y-46*u); c.lineTo(x+4*u,y-44*u); c.stroke(); }); },
};

// ---------- eyes ----------
const EYES:Record<string,Fn>={
  dots:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ for(const sx of [-2,2]){ glow(c,x+sx*u,y-41*u,3.4*u,d.c,.35); c.fillStyle=rgba(d.c,.95); ell(c,x+sx*u,y-41*u,1*u,.8*u); c.fill(); } }); void t; },
  slit:(k,d)=>{ const {c,x,y,u}=k; add(c,()=>{ c.strokeStyle=rgba(d.c,.95); c.lineWidth=Math.max(1,.8*u); for(const sx of [-2,2]){ c.beginPath(); c.moveTo(x+(sx-1)*u,y-41.4*u); c.lineTo(x+(sx+1)*u,y-40.8*u); c.stroke(); glow(c,x+sx*u,y-41*u,3*u,d.c,.3); } }); },
  cyclops:(k,d)=>{ const {c,x,y,u,t}=k; c.fillStyle='rgba(20,22,24,.8)'; c.fillRect(x-4*u,y-42.4*u,8*u,2*u); add(c,()=>{ const sx=Math.sin(t*1.4)*2.2*u; glow(c,x+sx,y-41.4*u,4*u,d.c,.45); c.fillStyle=rgba(d.c,.95); ell(c,x+sx,y-41.4*u,1.2*u,.9*u); c.fill(); }); },
  flame:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ for(const sx of [-2,2]){ glow(c,x+sx*u,y-41*u,4.6*u,d.c,.55); poly(c,[[x+(sx-.9)*u,y-40.6*u],[x+(sx+.9)*u,y-40.6*u],[x+sx*u,y-(43.4+Math.sin(t*10+sx)*.6)*u]],rgba(d.c2||d.c,.9)); c.fillStyle=rgba(d.c,.95); ell(c,x+sx*u,y-41*u,.9*u,.8*u); c.fill(); } }); },
};

// ---------- back gear (drawn behind the body) ----------
const BACK:Record<string,Fn>={
  pack:(k,d)=>{ const {c,x,y,u}=k; c.fillStyle=rgba(d.c,.95); c.fillRect(x-6*u,y-37*u,12*u,15*u); c.fillStyle=rgba('#000',.25); c.fillRect(x-6*u,y-30*u,12*u,1*u); },
  cable:(k,d)=>{ const {c,x,y,u,t}=k; c.lineCap='round'; for(const sx of [-1,1]){ c.strokeStyle='rgba(10,12,16,.7)'; c.lineWidth=Math.max(2.2,2.4*u); c.beginPath(); c.moveTo(x+sx*4*u,y-38*u); c.bezierCurveTo(x+sx*13*u,y-34*u,x+sx*12*u,y-20*u+Math.sin(t*3+sx)*u,x+sx*9*u,y-12*u); c.stroke(); c.strokeStyle=rgba(d.c,.95); c.lineWidth=Math.max(1.4,1.5*u); c.stroke(); } add(c,()=>{ for(const sx of [-1,1]){ c.fillStyle=rgba('#ffd060',.55+.4*Math.sin(t*4+sx)); ell(c,x+sx*9*u,y-12*u,1.2*u,1.2*u); c.fill(); } }); },
  cape:(k,d)=>{ const {c,x,y,u,t}=k; const sw=Math.sin(t*2)*(k.moving?2.4:.8)*u; poly(c,[[x-7*u,y-37*u],[x+7*u,y-37*u],[x+10*u+sw,y-8*u],[x-10*u+sw,y-8*u]],rgba(d.c,.88),rgba('#000',.3),1); },
  vents:(k,d)=>{ const {c,x,y,u,t}=k; for(const sx of [-1,1]){ c.fillStyle=rgba(d.c,.95); c.fillRect(x+(sx*7-1.4)*u,y-41*u,2.8*u,7*u); c.fillStyle=rgba(d.c2||'#333',.9); c.fillRect(x+(sx*7-1.4)*u,y-41.4*u,2.8*u,1.2*u); add(c,()=>{ glow(c,x+sx*7*u,y-43*u-((t*4)%1)*3*u,3*u,'#aaaaaa',.12); }); } },
  tank:(k,d)=>{ const {c,x,y,u}=k; for(const sx of [-1,1]){ c.fillStyle='rgba(10,12,16,.6)'; c.beginPath(); c.roundRect?.(x+sx*6*u-3.6*u,y-47*u,7.2*u,17*u,3.2*u); c.fill(); c.fillStyle=rgba(d.c,.95); c.beginPath(); c.roundRect?.(x+sx*6*u-3*u,y-46.4*u,6*u,16*u,3*u); c.fill(); c.fillStyle=rgba(d.c2||'#fff',.7); c.fillRect(x+sx*6*u-1.8*u,y-44*u,1.3*u,10*u); c.fillStyle='rgba(30,30,34,.95)'; c.fillRect(x+sx*6*u-1.6*u,y-48.6*u,3.2*u,2.2*u); } },
  array:(k,d)=>{ const {c,x,y,u,t}=k; c.strokeStyle=rgba(d.c,.95); c.lineWidth=Math.max(1,.8*u); for(let i=0;i<3;i++){ c.beginPath(); c.moveTo(x+(i-1)*2*u,y-36*u); c.lineTo(x+(i-1)*5*u,y-(50+i%2*3)*u); c.stroke(); add(c,()=>{ c.fillStyle=rgba(d.c2||d.c,Math.sin(t*3+i*2)>0?.95:.25); ell(c,x+(i-1)*5*u,y-(50+i%2*3)*u,.9*u,.9*u); c.fill(); }); } },
  banner:(k,d)=>{ const {c,x,y,u,t}=k; c.strokeStyle=rgba('#333',.95); c.lineWidth=Math.max(1,.8*u); c.beginPath(); c.moveTo(x+4*u,y-48*u); c.lineTo(x+4*u,y-22*u); c.stroke(); const sw=Math.sin(t*2.4)*1.2*u; poly(c,[[x+4*u,y-47*u],[x+11*u+sw,y-45*u],[x+10*u+sw,y-36*u],[x+4*u,y-37*u]],rgba(d.c,.92)); c.fillStyle=rgba(d.c2||'#fff',.8); c.fillRect(x+5.4*u,y-43.6*u,3.4*u,.9*u); },
  spine:(k,d)=>{ const {c,x,y,u}=k; for(let i=0;i<7;i++){ ell(c,x,y-(38-i*2.6)*u,(2.6-i*.12)*u,1.1*u); c.fillStyle=rgba(d.c,.95); c.fill(); c.strokeStyle=rgba(d.c2||'#888',.9); c.lineWidth=.8; c.stroke(); } },
  disc:(k,d)=>{ const {c,x,y,u,t}=k; c.save(); c.translate(x,y-31*u); c.rotate(t*.5); ell(c,0,0,9*u,9*u); c.strokeStyle=rgba(d.c,.95); c.lineWidth=Math.max(1.6,1.6*u); c.stroke(); for(let i=0;i<8;i++){ c.rotate(Math.PI/4); c.fillStyle=rgba(d.c2||d.c,.95); c.fillRect(8*u,-.8*u,2.4*u,1.6*u); } c.restore(); },
  wings:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ for(const sx of [-1,1]) for(let i=0;i<5;i++){ const fl=Math.sin(t*3+i*.8+sx)*1.2*u; poly(c,[[x+sx*3*u,y-33*u],[x+sx*(8+i*3)*u,y-(40+i*2)*u+fl],[x+sx*(7+i*3)*u,y-(32+i*2)*u+fl],[x+sx*3*u,y-30*u]],rgba(i%2?d.c:(d.c2||d.c),.45)); glow(c,x+sx*(10+i*2)*u,y-(38+i)*u+fl,3*u,d.c,.25); } }); },
};

// ---------- auras (ground / around) ----------
// Painterly pass (docs/COSMETIC_TRAILS.md): tapered brush crescents and wisps, slow continuous motion (no frame-stepped jumps, no pulsing
// rings, no dot sparks). Each aura is 1-4 canvas ops: crescents are batched into one path per colour.
/** add a tapered brush crescent to the current path: an ellipse arc (rx, ry) from a0 to a1, w thick in the middle, pointed ends */
function crescent(c:C,cx:number,cy:number,rx:number,ry:number,a0:number,a1:number,w:number,n=10){ for(let i=0;i<=n;i++){ const f=i/n, a=a0+(a1-a0)*f, ww=w*Math.sin(f*Math.PI); const x=cx+Math.cos(a)*(rx+ww), y=cy+Math.sin(a)*(ry+ww*ry/rx); i?c.lineTo(x,y):c.moveTo(x,y); } for(let i=n;i>=0;i--){ const f=i/n, a=a0+(a1-a0)*f, ww=w*Math.sin(f*Math.PI)*.35; c.lineTo(cx+Math.cos(a)*(rx-ww),cy+Math.sin(a)*(ry-ww*ry/rx)); } c.closePath(); }
/** add a tapered vertical wisp (flame / mist lick) to the current path */
function wisp(c:C,x:number,y:number,h:number,w:number,bend:number){ c.moveTo(x-w,y); c.quadraticCurveTo(x-w*.6+bend*.5,y-h*.55,x+bend,y-h); c.quadraticCurveTo(x+w*.7+bend*.4,y-h*.45,x+w,y); c.closePath(); }
const soft=(c:C,x:number,y:number,r:number,col:string,a:number)=>{ c.save(); c.globalCompositeOperation='lighter'; c.globalAlpha=Math.min(1,a); c.drawImage(glowSprite(col),x-r,y-r,r*2,r*2); c.restore(); };
const AURA:Record<string,Fn>={
  // grey: a low ground smudge of grit, two crescents drifting round the feet
  dust:(k,d)=>{ const {c,x,y,u,t}=k; c.beginPath(); for(const o of [0,Math.PI]) crescent(c,x,y,11*u,4.2*u,t*.35+o,t*.35+o+1.9,2*u); c.fillStyle=rgba(d.c,.32); c.fill(); },
  // green: two soft painted wisps orbiting the waist
  haze:(k,d)=>{ const {c,x,y,u,t}=k; c.beginPath(); for(const o of [0,Math.PI]) crescent(c,x,y-16*u,10*u,5*u,t*.5+o,t*.5+o+2.2,3*u); c.fillStyle=rgba(d.c,.3); c.fill(); },
  // green: weld sparks as three short brush streaks arcing round (no dots)
  sparks:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ c.beginPath(); for(let i=0;i<3;i++) crescent(c,x,y-20*u+Math.sin(t*1.3+i*2)*3*u,11*u,7*u,t*1.6+i*2.09,t*1.6+i*2.09+.9,1.4*u,6); c.fillStyle=rgba(d.c,.75); c.fill(); }); },
  // blue: cool mist licks rising slowly from the feet
  mist:(k,d)=>{ const {c,x,y,u,t}=k; c.beginPath(); for(let i=0;i<3;i++){ const ph=(t*.35+i/3)%1; wisp(c,x+(i-1)*6*u,y-ph*6*u,(10+ph*8)*u,(2.8-ph)*u,Math.sin(t+i)*3*u); } c.fillStyle=rgba(d.c,.26); c.fill(); soft(c,x,y-6*u,14*u,d.c,.18); },
  // blue: one painted lightning arc that slides smoothly round the body (no stepped flicker)
  static:(k,d)=>{ const {c,x,y,u,t}=k; const a0=t*.9; c.beginPath(); for(let i=0;i<=8;i++){ const a=a0+i*.22, r=(11+((i%2)?1.6:-1.6))*u; const px=x+Math.cos(a)*r, py=y-24*u+Math.sin(a)*r*.8; i?c.lineTo(px,py):c.moveTo(px,py); } c.lineJoin='round'; c.lineCap='round'; c.strokeStyle='rgba(8,14,24,.45)'; c.lineWidth=Math.max(2,2.4*u); c.stroke(); add(c,()=>{ c.strokeStyle=rgba(d.c,.85); c.lineWidth=Math.max(1,1.1*u); c.stroke(); }); },
  // purple: a painted pool of light under the feet with an ink-edged brush crescent sweeping it
  glow:(k,d)=>{ const {c,x,y,u,t}=k; soft(c,x,y-2*u,20*u,d.c,.4); c.beginPath(); crescent(c,x,y,12*u,4.6*u,t*.6,t*.6+2.6,2.4*u); crescent(c,x,y,12*u,4.6*u,t*.6+Math.PI,t*.6+Math.PI+1.6,1.6*u); c.fillStyle=rgba(d.c2||d.c,.7); c.fill(); c.strokeStyle='rgba(12,8,20,.35)'; c.lineWidth=1; c.stroke(); },
  // purple: twin brush crescents counter-rotating on the ground (replaces the pulsing ring)
  ring:(k,d)=>{ const {c,x,y,u,t}=k; c.beginPath(); crescent(c,x,y,13*u,5*u,t*.8,t*.8+2.4,2.2*u); crescent(c,x,y,9*u,3.4*u,-t*1.1,-t*1.1+2,1.6*u); c.fillStyle='rgba(12,8,20,.4)'; c.fill(); add(c,()=>{ c.fillStyle=rgba(d.c,.8); c.fill(); }); },
  // orange: a corona of painted flame petals behind the body, inner light, one bloom sprite
  nova:(k,d)=>{ const {c,x,y,u,t}=k; const cy=y-24*u; soft(c,x,cy,26*u,d.c,.32); c.beginPath(); for(let i=0;i<7;i++){ const a=i*Math.PI*2/7+t*.25, L=(15+3*Math.sin(t*1.2+i*1.7))*u; const bx=x+Math.cos(a)*7*u, by=cy+Math.sin(a)*7*u, tx=x+Math.cos(a)*L, ty=cy+Math.sin(a)*L, nx=-Math.sin(a)*3*u, ny=Math.cos(a)*3*u; c.moveTo(bx-nx,by-ny); c.quadraticCurveTo(bx+(tx-bx)*.5+nx*1.4,by+(ty-by)*.5+ny*1.4,tx,ty); c.quadraticCurveTo(bx+(tx-bx)*.5-nx*.6,by+(ty-by)*.5-ny*.6,bx+nx,by+ny); c.closePath(); } c.fillStyle='rgba(20,10,4,.35)'; c.fill(); add(c,()=>{ c.fillStyle=rgba(d.c,.62); c.fill(); }); soft(c,x,cy,10*u,d.c2||'#fff0c8',.35); },
};

const FN:Partial<Record<CosSlot,Record<string,Fn>>>={ skin:SKIN, tattoo:TAT, torso:CLOTH, arms:CLOTH, hands:CLOTH, legs:CLOTH, hair:HAIR, head:HEAD, eyes:EYES, back:BACK, aura:AURA };
/** Draw order inside each phase. */
const BACK_SLOTS:CosSlot[]=['aura','back'];
const FRONT_SLOTS:CosSlot[]=['skin','legs','torso','arms','hands','tattoo','hair','head','eyes'];

export function drawCosmetics(k:CosCtx,list:CosDef[],phase:'back'|'front'){
  const order=phase==='back'?BACK_SLOTS:FRONT_SLOTS; k.c.save();
  for(const sl of order){ const d=list.find(x=>x.slot===sl); if(!d) continue; if(d.variant&&d.style==='shell') continue; if(hasCosArt(d.id)&&!k.noModel) continue; /* real model layer is baked into the body sheet (src/coslayers.ts) */ const f=FN[sl]?.[d.style]; if(f){ k.c.save(); try{ cosAudit(k.id||'me',sl,d.id,()=>f(k,d)); }catch{ /* never break the frame */ } k.c.restore(); } }
  k.c.restore(); try{ cosAudit(k.id||'me','rarityfx',phase,()=>drawRarityFx(k,k.noModel?list:list.filter(d=>!hasCosArt(d.id)&&!d.body),phase)); }catch{ /* never break the frame */ }
  try{ k.c.save(); drawPm(k,list,phase); }catch{ /* never break the frame */ } finally{ k.c.restore(); }
}
/** Trail: one painted brush-stroke ribbon that follows the feet (world->screen done by the caller). Tier-scaled (docs/COSMETIC_TRAILS.md):
 *  grey/green = a single soft stroke, blue = stroke + bright core, purple = two-tone stroke with ink edge + painted flecks, orange = signature
 *  (wide gilded stroke, inner light, slow brush flecks). No random/time jitter per point, so nothing flickers; points age out (TRAIL_LIFE)
 *  and the ribbon tapers + fades from the tail, so it melts away smoothly when you stop. A fixed handful of fills per frame (no particles). */
export interface TrailPt { x:number; y:number; t:number }
export const TRAIL_LIFE=.75, TRAIL_STEP=.03, TRAIL_MAX=32;
const TIER:Record<string,{w:number;a:number;core:number;ink:number;fl:number;halo:number}>={ grey:{w:3,a:.36,core:0,ink:.25,fl:0,halo:0}, green:{w:4,a:.55,core:.4,ink:.35,fl:0,halo:0}, blue:{w:5,a:.66,core:.7,ink:.45,fl:2,halo:.18}, purple:{w:6.2,a:.8,core:.9,ink:.6,fl:4,halo:.28}, orange:{w:7.4,a:.92,core:1,ink:.7,fl:6,halo:.4} };
/** per-style shape: lift (u above the feet), widen, light core colour, additive? */
const TSTYLE:Record<string,{lift:number;wide:number;core:string;add:boolean;step?:boolean;rise?:number}>={ dust:{lift:1,wide:1.5,core:'#e8dcc4',add:false}, smoke:{lift:3,wide:1.9,core:'#b8b8b0',add:false,rise:6}, sparks:{lift:2,wide:.85,core:'#fff4d0',add:true}, embers:{lift:3,wide:1,core:'#ffe0a0',add:true,rise:4}, ghost:{lift:18,wide:2.6,core:'#ffffff',add:true}, glitch:{lift:6,wide:1,core:'#ffffff',add:true,step:true} };
/** keep a trail buffer in world coords: sample while moving, age out always */
export function trailSample(buf:TrailPt[],x:number,y:number,t:number,moving:boolean):TrailPt[]{ const last=buf[buf.length-1]; if(moving&&(!last||t-last.t>=TRAIL_STEP)) buf.push({x,y,t}); let i=0; while(i<buf.length&&t-buf[i].t>TRAIL_LIFE) i++; if(i) buf.splice(0,i); if(buf.length>TRAIL_MAX) buf.splice(0,buf.length-TRAIL_MAX); return buf; }
export function drawTrail(c:C,pts:TrailPt[],now:number,u:number,d:CosDef,head?:{x:number;y:number}){
  cosAudit((globalThis as any).__cosOwner||'me','trail',d.id,()=>paintTrail(c,pts,now,u,d,head)); }
function paintTrail(c:C,pts:TrailPt[],now:number,u:number,d:CosDef,head?:{x:number;y:number}){
  const P=head?[...pts,{x:head.x,y:head.y,t:now}]:pts; if(P.length<2) return; const T=TIER[d.rarity]||TIER.green, S=TSTYLE[d.style]||TSTYLE.dust;
  // smooth (one Chaikin pass) so the ribbon follows movement as a curve, not a polyline
  const Q:{x:number;y:number;t:number}[]=[P[0]]; for(let i=0;i<P.length-1;i++){ const a=P[i],b=P[i+1]; Q.push({x:a.x*.75+b.x*.25,y:a.y*.75+b.y*.25,t:a.t*.75+b.t*.25},{x:a.x*.25+b.x*.75,y:a.y*.25+b.y*.75,t:a.t*.25+b.t*.75}); } Q.push(P[P.length-1]);
  const n=Q.length, L:number[][]=[], R:number[][]=[]; const tail=Q[0], hd=Q[n-1]; if(Math.hypot(hd.x-tail.x,hd.y-tail.y)<2*u) return;
  for(let i=0;i<n;i++){ const p=Q[i], a=Q[Math.max(0,i-1)], b=Q[Math.min(n-1,i+1)]; let dx=b.x-a.x, dy=b.y-a.y; const m=Math.hypot(dx,dy)||1; dx/=m; dy/=m;
    const age=Math.min(1,(now-p.t)/TRAIL_LIFE), f=i/(n-1); // f: 0 tail .. 1 head
    const w=T.w*S.wide*u*(.12+.88*Math.sin(Math.PI*Math.pow(f,2.2)*.92))*(1-age*.55); /* brush profile: hair-thin tail, full belly behind the feet, rounded nib */ const lift=(S.lift+(S.rise||0)*age)*u;
    const st=S.step?Math.round(Math.sin(i*2.7)*1.2)*u:0; L.push([p.x-dy*w+st,p.y-lift+dx*w*.55]); R.push([p.x+dy*w+st,p.y-lift-dx*w*.55]); }
  const g0=Q[0], g1=Q[n-1]; const ribbon=(scale:number,col:string,a:number,lw=0,ink='')=>{ const grd=c.createLinearGradient(g0.x,g0.y,g1.x,g1.y); grd.addColorStop(0,rgba(col,0)); grd.addColorStop(.55,rgba(col,a*.8)); grd.addColorStop(1,rgba(col,a));
    c.beginPath(); for(let i=0;i<n;i++){ const l=L[i],r=R[i],mx=(l[0]+r[0])/2,my=(l[1]+r[1])/2; const x=mx+(l[0]-mx)*scale,y=my+(l[1]-my)*scale; i?c.lineTo(x,y):c.moveTo(x,y); } for(let i=n-1;i>=0;i--){ const l=L[i],r=R[i],mx=(l[0]+r[0])/2,my=(l[1]+r[1])/2; c.lineTo(mx+(r[0]-mx)*scale,my+(r[1]-my)*scale); } c.closePath(); c.fillStyle=grd; c.fill(); if(lw&&ink){ c.lineJoin='round'; c.strokeStyle=rgba(ink,T.ink*.8); c.lineWidth=lw; c.stroke(); } };
  if(d.style==='ghost'){ c.save(); c.globalCompositeOperation='lighter'; for(const j of [.3,.55,.8]){ const p=Q[Math.floor(j*(n-1))], age=Math.min(1,(now-p.t)/TRAIL_LIFE), a=T.a*(1-age)*j*.7; if(a<.02) continue; const g=c.createLinearGradient(p.x,p.y-44*u,p.x,p.y); g.addColorStop(0,rgba(d.c,a*.9)); g.addColorStop(1,rgba(d.c,0)); c.fillStyle=g; c.globalAlpha=.55; c.beginPath(); c.ellipse(p.x,p.y-40*u,4.2*u,4.8*u,0,0,7); c.moveTo(p.x-7.5*u,p.y-33*u); c.quadraticCurveTo(p.x,p.y-36*u,p.x+7.5*u,p.y-33*u); c.lineTo(p.x+3.5*u,p.y-8*u); c.quadraticCurveTo(p.x,p.y-5*u,p.x-3.5*u,p.y-8*u); c.closePath(); c.fill(); c.globalAlpha=1; c.strokeStyle=rgba('#e8fbff',a*.9); c.lineWidth=Math.max(1,.8*u); c.stroke(); } c.restore(); return; }
  c.save(); c.lineCap='round';
  if(T.ink) ribbon(1.15,'#0b0d12',T.ink*.35);                                   // soft ink underlay: reads on bright and dark floors
  if(S.add) c.globalCompositeOperation='lighter';
  if(T.halo) ribbon(1.7,d.c,T.halo*(S.add?.45:1));                                             // soft painted bloom around the stroke (purple+)
  ribbon(1,d.c,T.a);                                                             // the brush body
  if(d.c2) ribbon(.7,d.c2,T.a*.7);
  if(T.core) ribbon(.38,S.core,T.a*T.core*.9);                                    // light core (blue+)
  if(d.rarity==='purple'||d.rarity==='orange'){ // tier read at 40 px: a twisting violet (purple) / gold (orange) braid weaves through the stroke; blue never gets it
    c.globalCompositeOperation='source-over'; c.beginPath(); for(let i=Math.floor(n*.25);i<n;i++){ const l=L[i],r=R[i],q=.5+.5*Math.sin(Q[i].t*16); const x=l[0]+(r[0]-l[0])*q, y=l[1]+(r[1]-l[1])*q; i>Math.floor(n*.25)?c.lineTo(x,y):c.moveTo(x,y); }
    c.lineJoin='round'; c.strokeStyle=d.rarity==='orange'?'#ffd27a':'#b48cff'; c.globalAlpha=1; c.lineWidth=Math.max(1.5,1.7*u); c.stroke(); c.globalAlpha=1; if(S.add) c.globalCompositeOperation='lighter'; }
  if(T.fl){ const k=Math.min(T.fl,Math.floor(n/3)); c.fillStyle=rgba(d.c2||S.core,.8*T.a); for(let j=0;j<k;j++){ const i=Math.floor((j+.5)/k*(n-1)); const p=Q[i], age=Math.min(1,(now-p.t)/TRAIL_LIFE); const l=L[i],r=R[i]; const side=j%2?1:-1; const ox=(r[0]-l[0])*.5*side*1.4, oy=(r[1]-l[1])*.5*side*1.4; const rr=(.6+T.w*.08)*u*(1-age); if(rr<.3) continue; c.globalAlpha=1-age; c.beginPath(); c.ellipse((l[0]+r[0])/2+ox,(l[1]+r[1])/2+oy-age*(S.rise||2)*u,rr*2.2,rr*.6,Math.atan2(oy,ox)+1.57,0,7); c.fill(); } c.globalAlpha=1; } // painted flecks (deterministic, fade with age)
  c.restore();
}
