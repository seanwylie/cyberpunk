// Persistent visuals for the augment ability system: status marks on enemies, player shield/mitigation/cloak/haste/toggle auras, deployables and bolts.
// Everything is colour-coded and drawn with simple shapes so any ability (including ones with no bespoke art) is readable. Cheap and capped; honours Reduced FX.
import type { Renderer } from './render';
import { TYPE_FX } from './abilities/vfx';
import { ABILITY_BY_ID } from './abilities/registry';
const COL={ marked:'#e8d890', exposed:'#d9a36a', burn:'#e0803a', root:'#9a8250', slow:'#8fb4c8', tether:'#b79ccb', shield:'#9ec7e8', mit:'#d8d2bf', reflect:'#e4c46a', haste:'#a8b87a', charged:'#d9824a', ambush:'#8a9a62', toggle:'#d9824a' };
export function drawAbx(r:Renderer){
  const g:any=r.g, a=g.abx; if(!a) return; const c=r.ctx, red=!!g.save.settings.reducedFx; const t=g.time;
  // enemy status marks
  let n=0; for(const e of g.enemies){ if(e.dead||n>40) continue; const s=a.st.get(e.id); const stun=e.stunT>0; if(!s&&!stun) continue; n++;
    const x=r.sx(e.x,e.y), y=r.sy(e.x,e.y,1.5); let i=0; const marks:[string,string][]=[]; if(s){ if(s.marked>0) marks.push([COL.marked,'x']); if(s.exposed>0) marks.push([COL.exposed,'!']); if(s.burn) marks.push([COL.burn,'^']); if(s.root>0) marks.push([COL.root,'#']); if(s.slow) marks.push([COL.slow,'~']); if(s.tether) marks.push([COL.tether,'o']); } if(stun) marks.push(['#e8e3b0','*']);
    const w=marks.length*14; c.save(); c.font='bold 12px monospace'; c.textAlign='center'; for(const [col,ch] of marks){ const px=x-w/2+7+i*14; c.fillStyle='rgba(18,16,14,.8)'; c.beginPath(); c.arc(px,y-14,7,0,7); c.fill(); c.strokeStyle=col; c.lineWidth=1.5; c.stroke(); c.fillStyle=col; c.fillText(ch,px,y-10); i++; }
    if(s?.burn&&!red){ r.ring(e.x,e.y,.6+.1*Math.sin(t*10),COL.burn,.6); } if(s?.root>0) r.ring(e.x,e.y,.7,COL.root,.7,true); if(s?.marked>0) r.ring(e.x,e.y,.85,COL.marked,.55+.2*Math.sin(t*6)); if(s?.tether&&s.tether.to>=0){ const o=g.enemies.find((q:any)=>q.id===s.tether.to); if(o&&!o.dead){ c.strokeStyle=COL.tether; c.globalAlpha=.7; c.lineWidth=2; c.setLineDash([5,4]); c.beginPath(); c.moveTo(x,r.sy(e.x,e.y,.6)); c.lineTo(r.sx(o.x,o.y),r.sy(o.x,o.y,.6)); c.stroke(); c.setLineDash([]); c.globalAlpha=1; } } c.restore(); }
  // player auras
  const px=g.px, py=g.py;
  if(a.shield>0) r.ring(px,py,1.35+.05*Math.sin(t*8),COL.shield,.85,true);
  if(a.mit.t>0) r.ring(px,py,1.15,COL.mit,.75); if(a.reflect.t>0) r.ring(px,py,1.5,COL.reflect,.8);
  if(a.move.t>0&&a.move.m>1&&!red) r.ring(px,py,.9,COL.haste,.5); if(a.dmg.t>0&&a.dmg.m>1) r.ring(px,py,1.0+.08*Math.sin(t*9),COL.charged,.7);
  if(a.ambush.t>0&&a.ambush.m>1) r.ring(px,py,1.1,COL.ambush,.8); if(g.cloakT>0&&!red) r.ring(px,py,1.25,COL.ambush,.35);
  for(const id of a.toggles){ const tg=ABILITY_BY_ID[id]; if(tg) r.ring(px,py,1.6+.06*Math.sin(t*5),(TYPE_FX as any)[tg.type],.7); }
  // deployables
  for(const d of a.deps){ const col=(TYPE_FX as any)[d.ab.type]; const life=1-d.t/d.life; const x=r.sx(d.x,d.y), y=r.sy(d.x,d.y,.5);
    if(d.kind==='aura'){ r.ring(d.x,d.y,d.r,col,.5*Math.min(1,life*3)+.15,true); if(!red) r.ring(d.x,d.y,d.r*(.5+.5*((t*1.5)%1)),col,.4); continue; }
    if(d.kind==='trap'){ r.ring(d.x,d.y,Math.min(d.r,1.2),col,.7+.2*Math.sin(t*6)); c.save(); c.fillStyle=col; c.beginPath(); c.arc(x,y,4,0,7); c.fill(); c.restore(); continue; }
    c.save(); c.globalAlpha=Math.min(1,life*4+.3); c.fillStyle='#1c1a17'; c.strokeStyle=col; c.lineWidth=2;
    if(d.kind==='turret'){ c.beginPath(); c.rect(x-8,y-6,16,12); c.fill(); c.stroke(); c.beginPath(); c.moveTo(x,y-4); c.lineTo(x+12,y-10); c.stroke(); }
    else if(d.kind==='drone'){ const yy=y-14+Math.sin(t*5+d.x)*3; c.beginPath(); c.arc(x,yy,6,0,7); c.fill(); c.stroke(); c.beginPath(); c.moveTo(x-11,yy-3); c.lineTo(x+11,yy-3); c.stroke(); }
    else if(d.kind==='bot'){ c.beginPath(); c.rect(x-10,y-18,20,18); c.fill(); c.stroke(); c.beginPath(); c.arc(x,y-24,5,0,7); c.fill(); c.stroke(); r.ring(d.x,d.y,d.r,col,.35); }
    else if(d.kind==='decoy'){ c.globalAlpha=.45+.2*Math.sin(t*9); c.fillStyle=col; c.beginPath(); c.arc(x,y-22,6,0,7); c.fill(); c.beginPath(); c.rect(x-6,y-16,12,16); c.fill(); }
    c.restore(); }
  for(const p of a.projs){ const x=r.sx(p.x,p.y), y=r.sy(p.x,p.y,.5); c.save(); c.strokeStyle=(TYPE_FX as any)[p.ab.type]; c.fillStyle='#f4ead8'; c.lineWidth=3; c.beginPath(); c.moveTo(x-p.vx*.02*8,y-p.vy*.01*8); c.lineTo(x,y); c.stroke(); c.beginPath(); c.arc(x,y,4,0,7); c.fill(); c.restore(); }
  for(const d of a.delayed){ r.ring(d.x,d.y,1.2+(1-d.t)*.3,'#d9a36a',.4+.3*Math.sin(t*14)); }
}
