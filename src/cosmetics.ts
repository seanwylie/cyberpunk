// Procedural renderer for wardrobe cosmetics (first-pass art; see docs/APPEARANCE_ITEMS.md for the art still needed).
// Drawn around the player sprite in two phases: 'back' (aura, back gear, behind the body) and 'front' (skin, marks, clothing, hair, headgear, eyes).
// Units: u = screen px per procedural unit; the character stands with feet at (x,y) and is ~48u tall (head ~y-41u, shoulders -34u, hips -20u).
import type { CosDef, CosSlot } from './content/appearance';
import { drawRarityFx } from './cosfx';

type C=CanvasRenderingContext2D;
export interface CosCtx { c:C; x:number; y:number; u:number; t:number; moving:boolean; face:number; /** owner id for the shared rarity-FX particle pool (local player = 'me') */ id?:string; }
const rgba=(hex:string,a:number)=>{ const h=hex.replace('#',''); const n=parseInt(h.length===3?h.split('').map(x=>x+x).join(''):h,16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; };
const ell=(c:C,x:number,y:number,rx:number,ry:number)=>{ c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); };
const glow=(c:C,x:number,y:number,r:number,col:string,a:number)=>{ const g=c.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,rgba(col,a)); g.addColorStop(1,rgba(col,0)); c.fillStyle=g; c.fillRect(x-r,y-r,r*2,r*2); };
const poly=(c:C,pts:number[][],fill?:string,stroke?:string,lw=1)=>{ c.beginPath(); pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])); c.closePath(); if(fill){ c.fillStyle=fill; c.fill(); } if(stroke){ c.strokeStyle=stroke; c.lineWidth=lw; c.stroke(); } };

type Fn=(k:CosCtx,d:CosDef)=>void;
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
  serial:(k,d)=>{ const {c,x,y,u}=k; c.fillStyle=rgba(d.c,.85); c.font=`${Math.max(5,2.6*u)}px monospace`; c.textAlign='center'; c.fillText('HB-4471',x+10.5*u,y-26*u); },
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
  cable:(k,d)=>{ const {c,x,y,u,t}=k; c.strokeStyle=rgba(d.c,.95); c.lineWidth=Math.max(1.4,1.4*u); c.lineCap='round'; c.beginPath(); c.moveTo(x,y-22*u); c.bezierCurveTo(x-6*u,y-16*u,x+5*u,y-10*u+Math.sin(t*3)*u,x+1*u,y-2*u); c.stroke(); add(c,()=>{ c.fillStyle=rgba('#ffd060',Math.sin(t*9)>.4?.9:0); ell(c,x+1*u,y-2*u,1.1*u,1.1*u); c.fill(); }); },
  cape:(k,d)=>{ const {c,x,y,u,t}=k; const sw=Math.sin(t*2)*(k.moving?2.4:.8)*u; poly(c,[[x-7*u,y-37*u],[x+7*u,y-37*u],[x+10*u+sw,y-8*u],[x-10*u+sw,y-8*u]],rgba(d.c,.88),rgba('#000',.3),1); },
  vents:(k,d)=>{ const {c,x,y,u,t}=k; for(const sx of [-1,1]){ c.fillStyle=rgba(d.c,.95); c.fillRect(x+(sx*7-1.4)*u,y-41*u,2.8*u,7*u); c.fillStyle=rgba(d.c2||'#333',.9); c.fillRect(x+(sx*7-1.4)*u,y-41.4*u,2.8*u,1.2*u); add(c,()=>{ glow(c,x+sx*7*u,y-43*u-((t*4)%1)*3*u,3*u,'#aaaaaa',.12); }); } },
  tank:(k,d)=>{ const {c,x,y,u}=k; c.fillStyle=rgba(d.c,.92); c.beginPath(); c.roundRect?.(x-3.4*u,y-38*u,6.8*u,14*u,3*u); c.fill(); c.fillStyle=rgba(d.c2||'#fff',.7); c.fillRect(x-2.2*u,y-35*u,1.4*u,8*u); },
  array:(k,d)=>{ const {c,x,y,u,t}=k; c.strokeStyle=rgba(d.c,.95); c.lineWidth=Math.max(1,.8*u); for(let i=0;i<3;i++){ c.beginPath(); c.moveTo(x+(i-1)*2*u,y-36*u); c.lineTo(x+(i-1)*5*u,y-(50+i%2*3)*u); c.stroke(); add(c,()=>{ c.fillStyle=rgba(d.c2||d.c,Math.sin(t*3+i*2)>0?.95:.25); ell(c,x+(i-1)*5*u,y-(50+i%2*3)*u,.9*u,.9*u); c.fill(); }); } },
  banner:(k,d)=>{ const {c,x,y,u,t}=k; c.strokeStyle=rgba('#333',.95); c.lineWidth=Math.max(1,.8*u); c.beginPath(); c.moveTo(x+4*u,y-48*u); c.lineTo(x+4*u,y-22*u); c.stroke(); const sw=Math.sin(t*2.4)*1.2*u; poly(c,[[x+4*u,y-47*u],[x+11*u+sw,y-45*u],[x+10*u+sw,y-36*u],[x+4*u,y-37*u]],rgba(d.c,.92)); c.fillStyle=rgba(d.c2||'#fff',.8); c.fillRect(x+5.4*u,y-43.6*u,3.4*u,.9*u); },
  spine:(k,d)=>{ const {c,x,y,u}=k; for(let i=0;i<7;i++){ ell(c,x,y-(38-i*2.6)*u,(2.6-i*.12)*u,1.1*u); c.fillStyle=rgba(d.c,.95); c.fill(); c.strokeStyle=rgba(d.c2||'#888',.9); c.lineWidth=.8; c.stroke(); } },
  disc:(k,d)=>{ const {c,x,y,u,t}=k; c.save(); c.translate(x,y-31*u); c.rotate(t*.5); ell(c,0,0,9*u,9*u); c.strokeStyle=rgba(d.c,.95); c.lineWidth=Math.max(1.6,1.6*u); c.stroke(); for(let i=0;i<8;i++){ c.rotate(Math.PI/4); c.fillStyle=rgba(d.c2||d.c,.95); c.fillRect(8*u,-.8*u,2.4*u,1.6*u); } c.restore(); },
  wings:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ for(const sx of [-1,1]) for(let i=0;i<5;i++){ const fl=Math.sin(t*3+i*.8+sx)*1.2*u; poly(c,[[x+sx*3*u,y-33*u],[x+sx*(8+i*3)*u,y-(40+i*2)*u+fl],[x+sx*(7+i*3)*u,y-(32+i*2)*u+fl],[x+sx*3*u,y-30*u]],rgba(i%2?d.c:(d.c2||d.c),.45)); glow(c,x+sx*(10+i*2)*u,y-(38+i)*u+fl,3*u,d.c,.25); } }); },
};

// ---------- auras (ground / around) ----------
const AURA:Record<string,Fn>={
  dust:(k,d)=>{ const {c,x,y,u,t}=k; for(let i=0;i<8;i++){ const a=t*.7+i*.8; c.fillStyle=rgba(d.c,.2); ell(c,x+Math.cos(a)*11*u,y-3*u+Math.sin(a)*4*u,1.8*u,1.2*u); c.fill(); } },
  haze:(k,d)=>{ const {c,x,y,u,t}=k; for(let i=0;i<4;i++){ glow(c,x+Math.cos(t*.5+i*1.6)*7*u,y-16*u+Math.sin(t*.4+i)*8*u,12*u,d.c,.16); } },
  sparks:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ for(let i=0;i<10;i++){ const a=t*1.4+i*.63, r=10+(i%3)*2; c.fillStyle=rgba(d.c,.4+.5*Math.sin(t*5+i)); ell(c,x+Math.cos(a)*r*u,y-(18+Math.sin(a*1.3)*14)*u,.7*u,.7*u); c.fill(); } }); },
  mist:(k,d)=>{ const {c,x,y,u,t}=k; for(let i=0;i<5;i++){ glow(c,x+Math.sin(t*.8+i*1.3)*8*u,y-(6+((t*3+i*3)%14))*u,8*u,d.c,.2); } },
  static:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ c.strokeStyle=rgba(d.c,.7); c.lineWidth=Math.max(1,.8*u); for(let i=0;i<3;i++){ const a=Math.floor(t*8+i*2.3)*1.7, r=9*u; c.beginPath(); c.moveTo(x+Math.cos(a)*r,y-24*u+Math.sin(a)*r*.8); c.lineTo(x+Math.cos(a+.2)*(r+3*u),y-24*u+Math.sin(a+.2)*(r+3*u)*.8); c.lineTo(x+Math.cos(a+.1)*(r+6*u),y-24*u+Math.sin(a+.1)*(r+6*u)*.8); c.stroke(); } glow(c,x,y-24*u,16*u,d.c,.06); }); },
  glow:(k,d)=>{ const {c,x,y,u}=k; add(c,()=>{ glow(c,x,y-3*u,18*u,d.c,.42*pulse(k,1.8,.7)); ell(k.c,x,y,12*u,4.4*u); c.strokeStyle=rgba(d.c,.5); c.lineWidth=1.2; c.stroke(); }); },
  ring:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ const r=(8+((t*6)%12))*u; c.strokeStyle=rgba(d.c,.6*(1-((t*6)%12)/12)); c.lineWidth=Math.max(1.2,1.2*u); c.beginPath(); c.ellipse(x,y,r,r*.4,0,0,7); c.stroke(); c.strokeStyle=rgba(d.c,.55); c.beginPath(); c.ellipse(x,y,9*u,3.6*u,0,0,7); c.stroke(); }); },
  nova:(k,d)=>{ const {c,x,y,u,t}=k; add(c,()=>{ glow(c,x,y-24*u,26*u,d.c,.38*pulse(k,2,.6)); glow(c,x,y-24*u,14*u,d.c2||d.c,.3); c.strokeStyle=rgba(d.c,.55); c.lineWidth=Math.max(1,.9*u); for(let i=0;i<8;i++){ const a=t*.8+i*Math.PI/4; c.beginPath(); c.moveTo(x+Math.cos(a)*15*u,y-24*u+Math.sin(a)*15*u); c.lineTo(x+Math.cos(a)*(22+4*Math.sin(t*3+i))*u,y-24*u+Math.sin(a)*(22+4*Math.sin(t*3+i))*u); c.stroke(); } }); },
};

const FN:Partial<Record<CosSlot,Record<string,Fn>>>={ skin:SKIN, tattoo:TAT, torso:CLOTH, arms:CLOTH, hands:CLOTH, legs:CLOTH, hair:HAIR, head:HEAD, eyes:EYES, back:BACK, aura:AURA };
/** Draw order inside each phase. */
const BACK_SLOTS:CosSlot[]=['aura','back'];
const FRONT_SLOTS:CosSlot[]=['skin','legs','torso','arms','hands','tattoo','hair','head','eyes'];

export function drawCosmetics(k:CosCtx,list:CosDef[],phase:'back'|'front'){
  const order=phase==='back'?BACK_SLOTS:FRONT_SLOTS; k.c.save();
  for(const sl of order){ const d=list.find(x=>x.slot===sl); if(!d) continue; if(d.variant&&d.style==='shell') continue; const f=FN[sl]?.[d.style]; if(f){ k.c.save(); try{ f(k,d); }catch{ /* never break the frame */ } k.c.restore(); } }
  k.c.restore(); try{ drawRarityFx(k,list,phase); }catch{ /* never break the frame */ }
}
/** Trail: afterimage particles sampled behind the player (world->screen done by the caller). */
export interface TrailPt { x:number; y:number; t:number }
export function drawTrail(c:C,pts:TrailPt[],now:number,u:number,d:CosDef){
  c.save(); for(const p of pts){ const a=1-(now-p.t)/.9; if(a<=0) continue; const r=(1.2+(1-a)*2)*u;
    switch(d.style){
      case 'dust': c.fillStyle=rgba(d.c,.28*a); ell(c,p.x,p.y-1*u,r*1.6,r*.8); c.fill(); break;
      case 'smoke': c.fillStyle=rgba(d.c,.3*a); ell(c,p.x,p.y-(1+(1-a)*8)*u,r*1.8,r*1.5); c.fill(); break;
      case 'sparks': c.globalCompositeOperation='lighter'; c.fillStyle=rgba(d.c,.9*a); ell(c,p.x+Math.sin(p.t*50)*3*u,p.y-(1+(1-a)*5)*u,.7*u,.7*u); c.fill(); break;
      case 'embers': c.globalCompositeOperation='lighter'; c.fillStyle=rgba(d.c,.85*a); ell(c,p.x+Math.sin(p.t*37)*4*u,p.y-(2+(1-a)*12)*u,1.1*u,1.1*u); c.fill(); glow(c,p.x,p.y-3*u,4*u,d.c,.2*a); break;
      case 'ghost': c.globalCompositeOperation='lighter'; c.fillStyle=rgba(d.c,.2*a); ell(c,p.x,p.y-24*u,5*u,12*u); c.fill(); break;
      case 'glitch': c.globalCompositeOperation='lighter'; c.fillStyle=rgba(d.c,.7*a); c.fillRect(p.x+Math.sin(p.t*91)*6*u,p.y-(3+Math.abs(Math.sin(p.t*53))*26)*u,2.4*u,1.1*u); break;
      default: c.fillStyle=rgba(d.c,.3*a); ell(c,p.x,p.y,r,r*.5); c.fill(); } }
  c.restore();
}
