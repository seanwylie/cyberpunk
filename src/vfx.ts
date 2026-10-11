// Ability VFX: a data-driven, pooled particle system drawn in iso world space by the canvas renderer.
// The sim only pushes tiny events (g.vev: 'sweep.cast', 'pulse.shatter', ...). EVENTS maps each event to emitter recipes; the pool is
// fixed-size (cap per quality tier), additive-blended where it helps readability, and Reduced FX swaps in a tiny, flash-free set.
import { ABILITY_TYPE_COLOR } from './config';
import { Q } from './quality';
import { flashAllowed } from './flashguard';
import { profileOf, ELEM_PAL } from './abilities/vfxprofile';
import type { Elem } from './abilities/vfxprofile';

export type PK='spark'|'streak'|'shard'|'debris'|'glow'|'ring'|'hex'|'ghost'|'steam'|'frost'|'star'|'arc'|'foot'|'rune';
export interface P { on:boolean; k:PK; x:number; y:number; z:number; vx:number; vy:number; vz:number; t:number; life:number; s:number; c:string; a:number; x2:number; y2:number; g:number; d:number; add:boolean; rot:number; vr:number; ab:string }
const C={ attack:['#a8483a','#e8845a','#fff0d8'], defense:['#a39e8a','#e4dcc8','#fffaf0'], hacking:['#5f7f9e','#8fc4ea','#e8f6ff'], mobility:['#7d8a52','#b5d07a','#f4ffe0'], heat:['#b8c8cc','#e7f2f2','#ffffff'] } as const;
export const PAL:Record<string,readonly string[]>={ sweep:C.attack, bladeburst:C.attack, control:C.hacking, pulse:C.hacking, brace:C.defense, forcedcool:C.heat, defib:C.defense, revive:C.defense, reposition:C.mobility, cloak:C.mobility };
/** Data-driven augment abilities (src/abilities) draw through the same pool with generic recipes: '<id>.cast' (shape from e.n: 0 self ring, 1 cone/line streaks, 2 ground blast) and '<id>.hit'. */
export const GEN=new Set<string>(); export const registerGenericVfx=(id:string,type:'attack'|'defense'|'hacking'|'mobility'|'heat')=>{ PAL[id]=C[type]; GEN.add(id); };
export const CAPS={ high:700, medium:260, low:100 } as const; export const SCALE={ high:1, medium:.5, low:.25 } as const;
const REDUCED_CAP=36; const AMP=1.7;

export class Vfx {
  pool:P[]=[]; live=0;
  /** per-ability counts of particles/effects spawned (tests + balance docs) */
  stats={ spawned:{} as Record<string,number>, events:{} as Record<string,number>, dropped:0, flashes:0, peak:0 };
  reduced=false;
  constructor(){ for(let i=0;i<CAPS.high;i++) this.pool.push({on:false,k:'spark',x:0,y:0,z:0,vx:0,vy:0,vz:0,t:0,life:1,s:1,c:'#fff',a:0,x2:0,y2:0,g:0,d:0,add:false,rot:0,vr:0,ab:''}); }
  cap(){ return this.reduced?REDUCED_CAP:CAPS[Q.tier]; }
  scale(){ return this.reduced?.15:SCALE[Q.tier]; }
  reset(){ for(const p of this.pool) p.on=false; this.live=0; this.accent=null; }
  /** amplitude applied to profile-driven effects: sizes and lifetimes of glow/spark/streak/arc/ring/star particles (the 'flashy' dial) */
  private amp=1;
  private add(ab:string,k:PK,x:number,y:number,o:Partial<P>){
    if(this.amp!==1&&(k==='glow'||k==='spark'||k==='streak'||k==='arc'||k==='ring'||k==='star'||k==='hex'||k==='rune'||k==='frost'||k==='shard')){ const m=k==='ring'||k==='hex'||k==='rune'?1+(this.amp-1)*.45:this.amp; o={...o,s:(o.s??1)*m,life:(o.life??.6)*(1+(this.amp-1)*.7)}; }
    if(this.live>=this.cap()){ this.stats.dropped++; return null; }
    let p:P|undefined; for(const q of this.pool) if(!q.on){ p=q; break; } if(!p){ this.stats.dropped++; return null; }
    Object.assign(p,{on:true,k,x,y,z:0,vx:0,vy:0,vz:0,t:0,life:.6,s:1,c:'#fff',a:0,x2:0,y2:0,g:0,d:0,add:false,rot:0,vr:0,ab},o); this.live++; this.stats.spawned[ab]=(this.stats.spawned[ab]||0)+1; if(this.live>this.stats.peak) this.stats.peak=this.live; return p; }
  /** n scaled by tier; at least 1 so every effect stays visible on Low */
  private N(n:number){ return Math.max(1,Math.round(n*this.scale())); }
  /** local bloom (never full-screen). Skipped under Reduced FX; limited by the global flash guard. */
  private bloom(ab:string,x:number,y:number,r:number,c:string,life=.22){ if(this.reduced||Q.fx>=2) return; if(!flashAllowed(false)&&ab!=='x') { /* flash guard: fall back to a ring */ this.add(ab,'ring',x,y,{s:r*.8,life:.3,c,a:0}); return; } this.stats.flashes++; this.add(ab,'glow',x,y,{s:r,life,c,add:true,z:.3}); }

  /** screen-space accent (edge tint, never a full-screen flash; honours the flash guard, Reduced FX and the Low tier) */
  accent:{c:string;t:number;life:number;a:number}|null=null;
  private screen(c:string,a:number,life=.45){ if(this.reduced||Q.fx>=2||!flashAllowed(false)) return; this.accent={c,t:0,life,a}; }
  /** element motif: the distinct "look" of fire / arc / frost / void / ... at a point. size ~ tiles, pw 0..1 */
  private motif(ab:string,el:Elem,x:number,y:number,a:number,size:number,pw:number,mode:'cast'|'hit'|'trail'){
    const R=Math.random, [h,core]=ELEM_PAL[el]; const n=(base:number)=>this.N(base*(mode==='trail'?.35:.6+pw)); const rad=(cnt:number,sp:number,k:PK,o:(i:number)=>Partial<P>)=>{ for(let i=0;i<n(cnt);i++){ const an=R()*6.283, v=sp*(.4+R()); this.add(ab,k,x,y,{vx:Math.cos(an)*v,vy:Math.sin(an)*v,...o(i)}); } };
    switch(el){
      case 'kinetic': rad(6,3.5*size,'debris',()=>({vz:2+R()*3,g:14,life:.6,s:.07+R()*.05,c:R()<.5?'#7a6a58':'#4a403a',rot:R()*6,vr:R()*10-5})); rad(5,4*size,'spark',()=>({life:.28,s:1.4,c:h,add:true,z:.4,d:3})); if(mode!=='trail') this.add(ab,'steam',x,y,{s:.5*size,life:.5,c:'#b8b09a',vz:.5,z:.1}); break;
      case 'fire': rad(7,2.2*size,'glow',()=>({vz:1.2+R()*2.2,life:.55+R()*.4,s:.1+R()*.08,c:R()<.5?h:core,add:true,z:.2,d:2})); rad(4,3.5*size,'spark',()=>({life:.3,s:1.5,c:h,add:true,z:.4,vz:1.5})); if(mode==='hit'&&pw>=.5) this.add(ab,'glow',x,y,{s:.9*size,life:.5,c:core,add:true,z:.3}); break;
      case 'arc': for(let i=0;i<n(mode==='trail'?2:5);i++){ const an=R()*6.283, L=(.8+R()*1.2)*size; this.add(ab,'arc',x,y,{x2:x+Math.cos(an)*L,y2:y+Math.sin(an)*L,life:.12+R()*.16,s:.08,c:i%2?h:core,add:true,z:.6}); } rad(4,5*size,'spark',()=>({life:.2,s:1.3,c:h,add:true,z:.5,d:4})); break;
      case 'frost': rad(7,2.6*size,'frost',()=>({vz:1.2+R()*2,g:7,life:.7,s:.1+R()*.06,c:R()<.5?h:core,add:true,z:.5,rot:R()*6,vr:R()*8-4})); this.add(ab,'glow',x,y,{s:.7*size,life:.5,c:core,add:!this.reduced,z:.3}); break;
      case 'void': for(let i=0;i<n(8);i++){ const an=R()*6.283, d=(.9+R()*.9)*size; this.add(ab,'spark',x+Math.cos(an)*d,y+Math.sin(an)*d,{vx:-Math.cos(an)*d*3,vy:-Math.sin(an)*d*3,life:.34,s:1.4,c:i%2?h:core,add:true,z:.4}); } this.add(ab,'glow',x,y,{s:.8*size,life:.55,c:core,add:false,z:.2}); break;
      case 'barrier': this.add(ab,'hex',x,y,{s:1.2*size,life:.5,c:core,add:!this.reduced}); rad(5,3*size,'spark',()=>({life:.3,s:1.3,c:h,add:true,z:.6})); break;
      case 'verdant': rad(8,1.1*size,'glow',()=>({vz:1.2+R()*1.6,life:.8+R()*.4,s:.1,c:R()<.5?h:core,add:!this.reduced,z:.2})); for(let i=0;i<n(2);i++) this.add(ab,'star',x+(R()-.5)*size,y+(R()-.5)*size,{life:.7,s:.16,c:h,z:.8,rot:R()*6,vr:5,vz:.5}); break;
      case 'blink': for(let i=0;i<n(3);i++) this.add(ab,'ghost',x-Math.cos(a)*i*.6,y-Math.sin(a)*i*.6,{life:.3+i*.08,c:core,a:.4-i*.1}); rad(5,4*size,'spark',()=>({life:.25,s:1.4,c:h,add:true,z:.4,d:3})); break;
      case 'gear': rad(5,4*size,'spark',()=>({life:.3,s:1.5,c:h,add:true,z:.5,d:3})); rad(3,3*size,'shard',()=>({vz:2+R()*2,g:12,life:.5,s:.1,c:core,rot:R()*6,vr:R()*12-6,add:false})); break;
      case 'steam': rad(6,1.4*size,'steam',()=>({vz:.8+R()*.8,life:.7+R()*.3,s:.28+R()*.2,c:R()<.5?h:core,z:.2})); rad(3,5*size,'spark',()=>({life:.2,s:1.2,c:h,add:true,z:.5,d:3})); break;
      case 'shadow': rad(6,1.2*size,'glow',()=>({vz:.8+R()*1.4,life:.7+R()*.4,s:.14,c:core,add:false,z:.2})); this.add(ab,'ghost',x,y,{life:.45,c:core,a:.5}); break;
      case 'sonic': for(let i=0;i<3;i++) this.add(ab,'ring',x,y,{s:size*(.6+i*.45),life:.3+i*.12,c:i%2?core:h,add:!this.reduced}); break;
      case 'holo': this.add(ab,'hex',x,y,{s:1.1*size,life:.5,c:core,add:!this.reduced}); this.add(ab,'rune',x,y,{s:.9*size,life:.7,c:h}); rad(4,3.5*size,'spark',()=>({life:.3,s:1.3,c:R()<.5?h:core,add:true,z:.5})); break; } }
  /** Profile-driven recipe for every data-driven ability: wind-up flare, shape structure, element motif, shockwave, lingering ground effects, chain/beam arcs, buffs. Grander with rarity/role power. */
  private gen(e:{k:string;x:number;y:number;a?:number;r?:number;len?:number;x2?:number;y2?:number;n?:number},ab:string,ph:string){
    const P=profileOf(ab), el=P.elem, [h,core]=ELEM_PAL[el], tc=P.type==='heat'?'#b8c8cc':ABILITY_TYPE_COLOR[P.type], pw=P.power, R=Math.random, a=e.a||0, red=this.reduced, rr=Math.max(1,e.r||2), sh=e.n||0, v=P.v;
    const big=1+pw*.9; const N=(n:number)=>this.N(n*(.6+pw));
    if(red){ if(ph==='cast'||ph==='deploy'||ph==='buff') this.add(ab,'ring',e.x,e.y,{s:1.4+pw,life:.4,c:tc}); else if(ph==='hit') for(let i=0;i<2;i++){ const an=R()*6.283; this.add(ab,'spark',e.x,e.y,{vx:Math.cos(an)*3,vy:Math.sin(an)*3,life:.22,s:1.3,c:h,d:3}); } return; }
    switch(ph){
      case 'cast': {
        this.add(ab,'glow',e.x,e.y,{s:1.1+pw*1.0,life:.32,c:h,add:true,z:.6}); // wind-up flare at the caster (bloom-limited: local, never full-screen)
        this.add(ab,'ring',e.x,e.y,{s:sh===0?1.8+pw:Math.max(1.2,Math.min(rr,3.5)),life:.45,c:tc,add:true});
        if(sh===1){ const cnt=N(6+v); for(let i=0;i<cnt;i++){ const an=a+(R()-.5)*(.5+v*.08); this.add(ab,'streak',e.x+Math.cos(an)*.8,e.y+Math.sin(an)*.8,{a:an,x2:Math.min(6,rr)*(.5+R()*.5),vx:Math.cos(an)*10,vy:Math.sin(an)*10,life:.3+R()*.18,s:3+pw*1.6,c:i%2?h:core,add:true,z:.5}); }
          this.motif(ab,el,e.x+Math.cos(a)*Math.min(rr,4),e.y+Math.sin(a)*Math.min(rr,4),a,1+pw*.6,pw,'cast'); }
        else if(sh===2){ this.add(ab,'ring',e.x,e.y,{s:rr*.6,life:.5,c:h,add:!red}); this.add(ab,'rune',e.x,e.y,{s:Math.min(rr,3.5)*.8,life:pw>=.4?1.3:.8,c:core}); this.motif(ab,el,e.x,e.y,a,1+pw*.8,pw,'cast'); if(pw>=.6) this.add(ab,'ring',e.x,e.y,{s:rr*1.1,life:.6,c:tc,add:true}); this.bloom(ab,e.x,e.y,1.2+pw,core); }
        else { this.motif(ab,el,e.x,e.y,a,1+pw*.7,pw,'cast'); if(P.type==='defense'||P.type==='heat') this.add(ab,'hex',e.x,e.y,{s:1.8+pw*.6,life:.55,c:core,add:true}); if(pw>=.7) this.add(ab,'ring',e.x,e.y,{s:2.6+pw,life:.55,c:h,add:true}); }
        if(P.accent) this.screen(core,.1+.09*pw); break; }
      case 'hit': {
        this.add(ab,'ring',e.x,e.y,{s:1.0+pw*1.8,life:.45+pw*.2,c:tc,add:true}); this.add(ab,'glow',e.x,e.y,{s:.9+pw*.9,life:.28,c:h,add:true,z:.5}); // impact shockwave
        for(let i=0;i<N(8);i++){ const an=R()*6.283, sp=3+R()*3+pw*4; this.add(ab,'spark',e.x,e.y,{vx:Math.cos(an)*sp,vy:Math.sin(an)*sp,life:.4,s:2.2,c:i%2?h:core,add:true,z:.5,d:4}); }
        this.motif(ab,el,e.x,e.y,a,1.1+pw*.8,pw,'hit'); if(pw>=.5) this.add(ab,'star',e.x,e.y,{life:.4,s:.2+pw*.18,c:h,z:1,rot:R()*6,vr:6}); if(pw>=.4) this.bloom(ab,e.x,e.y,.8+pw*.8,core,.16); break; }
      case 'trail': this.add(ab,'glow',e.x,e.y,{s:.28+pw*.2,life:.3,c:core,add:true,z:.5}); this.add(ab,'spark',e.x,e.y,{vx:(R()-.5)*1.5,vy:(R()-.5)*1.5,life:.22,s:1.2,c:h,add:true,z:.5,d:3}); if(pw>=.5||v%2===0) this.motif(ab,el,e.x,e.y,a,.5,pw,'trail'); break;
      case 'arc': { this.add(ab,'arc',e.x,e.y,{x2:e.x2!,y2:e.y2!,life:.22+pw*.12,s:.1+pw*.06,c:core,add:true,z:.7}); this.add(ab,'arc',e.x,e.y,{x2:e.x2!,y2:e.y2!,life:.16,s:.06,c:h,add:true,z:.75}); for(const [x,y] of [[e.x,e.y],[e.x2!,e.y2!]]) for(let i=0;i<N(3);i++){ const an=R()*6.283; this.add(ab,'spark',x,y,{vx:Math.cos(an)*4,vy:Math.sin(an)*4,life:.2,s:1.3,c:h,add:true,z:.6,d:3}); } break; }
      case 'deploy': this.add(ab,'ring',e.x,e.y,{s:Math.min(2.4,rr),life:.5,c:tc,add:true}); this.add(ab,'rune',e.x,e.y,{s:Math.min(2.2,rr)*.8,life:.9,c:core}); this.motif(ab,el,e.x,e.y,a,.9+pw*.5,pw,'cast'); break;
      case 'buff': this.add(ab,'ring',e.x,e.y,{s:1.3+pw*.5,life:.6,c:tc,add:true}); this.add(ab,'glow',e.x,e.y,{s:.9+pw*.6,life:.6,c:core,add:true,z:.5}); for(let i=0;i<N(6);i++){ const an=i/6*6.283+R()*.4; this.add(ab,'glow',e.x+Math.cos(an)*.8,e.y+Math.sin(an)*.8,{vz:1.1+R()*1.2,life:.7+R()*.3,s:.1,c:i%2?h:core,add:true,z:.1}); } if(P.type==='defense') this.add(ab,'hex',e.x,e.y,{s:1.5,life:.5,c:core,add:true}); break;
      case 'pulse': this.add(ab,'ring',e.x,e.y,{s:Math.min(rr,3.5)*(.5+R()*.5),life:.5,c:tc,add:true}); this.motif(ab,el,e.x,e.y,a,.6,pw,'trail'); break; } }
  /** extra grandness for the hand-authored core abilities: element motif, power-scaled shockwave and the screen accent */
  private layer(e:{k:string;x:number;y:number;a?:number;r?:number},ab:string,ph:string){ if(this.reduced) return; const P=profileOf(ab); if(!P||P.id!==ab) return; const [h,core]=ELEM_PAL[P.elem]; const pw=P.power;
    if(ph==='cast'||ph==='fire'){ this.add(ab,'glow',e.x,e.y,{s:.6+pw*.6,life:.2,c:h,add:true,z:.6}); this.motif(ab,P.elem,e.x,e.y,e.a||0,.8+pw*.5,pw*.8,'cast'); if(P.accent) this.screen(core,.1+.09*pw); }
    else if(ph==='hit') { this.add(ab,'ring',e.x,e.y,{s:.6+pw*1.2,life:.28+pw*.12,c:ELEM_PAL[P.elem][1],add:true}); if(pw>=.5) this.add(ab,'star',e.x,e.y,{life:.35,s:.2+pw*.15,c:h,z:1,rot:Math.random()*6,vr:6}); } }
  event(e:{k:string;x:number;y:number;a?:number;r?:number;len?:number;x2?:number;y2?:number;n?:number}){
    const ab=e.k.split('.')[0], ph=e.k.split('.')[1]||''; this.stats.events[e.k]=(this.stats.events[e.k]||0)+1;
    const pal=PAL[ab]||C.attack, [c0,c1,c2]=pal; const R=Math.random, a=e.a||0; const red=this.reduced;
    const rad=(n:number,speed:number,k:PK,o:(i:number,ang:number)=>Partial<P>)=>{ for(let i=0;i<this.N(n);i++){ const ang=R()*6.283, sp=speed*(.5+R()); this.add(ab,k,e.x,e.y,{vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,...o(i,ang)}); } };
    if(GEN.has(ab)){ this.amp=AMP; try{ this.gen(e,ab,ph); } finally{ this.amp=1; } return; }
    switch(e.k){
      case 'sweep.cast': { const w=e.r!, arc=e.len||2.3; // slash trail: streaks fanning along the arc + shockwave + debris
        for(let i=0;i<this.N(10);i++){ const t=i/Math.max(1,this.N(10)-1), an=a-arc/2+arc*t; this.add(ab,'streak',e.x+Math.cos(an)*.8,e.y+Math.sin(an)*.8,{a:an+1.57,x2:w*(.7+R()*.4),vx:Math.cos(an)*9,vy:Math.sin(an)*9,life:.28+R()*.1,s:2.2,c:i%2?c2:c1,add:true,z:.5,d:3}); }
        this.add(ab,'ring',e.x,e.y,{s:w*1.15,life:.35,c:c1,add:!red}); this.bloom(ab,e.x+Math.cos(a)*1.5,e.y+Math.sin(a)*1.5,1.6,c1);
        for(let i=0;i<this.N(9);i++){ const an=a-arc/2+arc*R(); this.add(ab,'debris',e.x+Math.cos(an)*w*.8,e.y+Math.sin(an)*w*.8,{vx:Math.cos(an)*(2+R()*3),vy:Math.sin(an)*(2+R()*3),vz:3+R()*3,g:14,life:.7,s:.07+R()*.05,c:i%3?'#7a6a58':'#4a403a',rot:R()*6,vr:R()*10-5}); } break; }
      case 'sweep.hit': rad(7,5,'spark',()=>({life:.3,s:1.6,c:c1,add:true,z:.5,d:4})); rad(3,3,'debris',()=>({vz:2+R()*2,g:14,life:.55,s:.07,c:'#6a5a4a'})); break;
      case 'bladeburst.cast': { const L=e.len||5; // flurry of afterimage streaks along the lunge path
        for(let i=0;i<this.N(8);i++){ const off=(R()-.5)*1.1, t=R(); const px=e.x+Math.cos(a)*L*t-Math.sin(a)*off, py=e.y+Math.sin(a)*L*t+Math.cos(a)*off; this.add(ab,'streak',px,py,{a,x2:L*.35,life:.3+R()*.15,s:1.8,c:i%2?c2:c1,add:true,z:.5,vx:Math.cos(a)*6,vy:Math.sin(a)*6,d:2}); }
        this.add(ab,'ghost',e.x,e.y,{life:.4,c:c0,a:.5,add:false}); this.add(ab,'ghost',e.x+Math.cos(a)*L*.4,e.y+Math.sin(a)*L*.4,{life:.35,c:c1,a:.4}); this.add(ab,'ghost',e.x+Math.cos(a)*L*.75,e.y+Math.sin(a)*L*.75,{life:.3,c:c1,a:.3}); break; }
      case 'bladeburst.hit': { for(let j=0;j<3;j++){ const an=a+(j-1)*.9+.5; this.add(ab,'streak',e.x,e.y,{a:an,x2:1.1,life:.22,s:2.4,c:c2,add:true,z:.6,vx:Math.cos(an)*3,vy:Math.sin(an)*3}); } rad(8,6,'spark',()=>({life:.3,s:1.7,c:c1,add:true,z:.5,d:3})); this.bloom(ab,e.x,e.y,.9,c2,.16); break; }
      case 'pulse.cast': { const r=e.r!; this.add(ab,'ring',e.x,e.y,{s:r,life:.5,c:c2,add:!red}); this.add(ab,'ring',e.x,e.y,{s:r*.65,life:.4,c:c1,add:!red}); this.add(ab,'rune',e.x,e.y,{s:r*.8,life:.7,c:c1}); this.bloom(ab,e.x,e.y,r*.45,c1,.2); for(let i=0;i<this.N(12);i++){ const an=i/12*6.283; this.add(ab,'spark',e.x,e.y,{vx:Math.cos(an)*r*2.2,vy:Math.sin(an)*r*2.2,life:.35,s:1.5,c:c2,add:true,z:.3,d:2}); } break; }
      case 'pulse.hit': rad(5,4,'spark',()=>({life:.3,s:1.4,c:c2,add:true,z:.6,d:3})); break;
      case 'pulse.shatter': rad(14,6,'shard',()=>({vz:3+R()*3,g:12,life:.7,s:.14,c:R()<.5?c2:'#e8d890',add:true,z:.9,rot:R()*6,vr:R()*14-7})); this.add(ab,'ring',e.x,e.y,{s:2.4,life:.4,c:'#e8d890',add:!red}); this.bloom(ab,e.x,e.y,1.4,'#e8d890',.2); break;
      case 'control.cast': { const r=e.r!; // pull rings contract inward + tether from the caster to the target
        for(let i=0;i<3;i++) this.add(ab,'ring',e.x,e.y,{s:r*(1.2-i*.25),life:.55+i*.1,c:i%2?c1:c2,add:!red,d:-1});
        this.add(ab,'arc',e.x2!,e.y2!,{x2:e.x,y2:e.y,life:.45,s:.12,c:c2,add:true,z:.8}); this.add(ab,'rune',e.x,e.y,{s:1.5,life:.9,c:c1}); break; }
      case 'control.hit': { this.add(ab,'ring',e.x,e.y,{s:1.1,life:.4,c:c2,add:!red,d:-1}); for(let i=0;i<this.N(3);i++) this.add(ab,'star',e.x,e.y,{life:.8,s:.18,c:c2,z:1.4,rot:R()*6,vr:6,vz:.4}); break; }
      case 'brace.cast': { this.add(ab,'hex',e.x,e.y,{s:2.4,life:.5,c:c1,add:!red}); this.add(ab,'hex',e.x,e.y,{s:1.5,life:.4,c:c2,add:!red}); rad(8,4,'spark',()=>({life:.3,s:1.4,c:c2,add:true,z:.5})); break; }
      case 'brace.hit': { const an=a; this.add(ab,'hex',e.x,e.y,{s:1.5,life:.3,c:c2,add:!red}); this.add(ab,'ring',e.x+Math.cos(an)*.8,e.y+Math.sin(an)*.8,{s:.9,life:.3,c:c1,add:!red}); rad(4,4,'spark',()=>({life:.25,s:1.3,c:c2,add:true,z:.8})); break; }
      case 'brace.reflect': { this.add(ab,'arc',e.x2!,e.y2!,{x2:e.x,y2:e.y,life:.25,s:.1,c:c2,add:true,z:.8}); this.bloom(ab,e.x,e.y,1.1,c2,.15); rad(7,6,'spark',()=>({life:.3,s:1.6,c:c2,add:true,z:.7})); break; }
      case 'reposition.cast': { const L=e.len||4; // dash afterimages + footprint dust
        for(let i=0;i<this.N(5);i++){ const t=i/Math.max(1,this.N(5)-1); this.add(ab,'ghost',e.x+Math.cos(a)*L*t,e.y+Math.sin(a)*L*t,{life:.35+t*.2,c:i%2?c0:c1,a:.5-.3*t}); }
        this.add(ab,'streak',e.x,e.y,{a,x2:L,life:.3,s:3,c:c2,add:true,z:.4}); for(let i=0;i<this.N(6);i++){ const t=R(); this.add(ab,'foot',e.x+Math.cos(a)*L*t,e.y+Math.sin(a)*L*t,{life:.8,s:.25+R()*.15,c:'#9a9078'}); this.add(ab,'steam',e.x+Math.cos(a)*L*t,e.y+Math.sin(a)*L*t,{life:.6,s:.3,c:'#b8b09a',vz:.8,z:.1}); } break; }
      case 'reposition.hit': rad(5,5,'spark',()=>({life:.25,s:1.5,c:c2,add:true,z:.5})); break;
      case 'reposition.evade': this.add(ab,'ring',e.x,e.y,{s:2.4,life:.45,c:c2,add:!red}); rad(10,5,'spark',()=>({life:.4,s:1.5,c:c2,add:true,z:.5})); this.bloom(ab,e.x,e.y,1.3,c2,.2); break;
      case 'cloak.cast': { this.add(ab,'ring',e.x,e.y,{s:1.8,life:.5,c:c1,add:!red}); for(let i=0;i<this.N(14);i++){ const an=R()*6.283, d=R()*.6; this.add(ab,'glow',e.x+Math.cos(an)*d,e.y+Math.sin(an)*d,{vz:1+R()*1.5,life:.7+R()*.4,s:.14,c:i%2?c1:c2,add:!red,z:.2,a:0}); } this.add(ab,'ghost',e.x,e.y,{life:.5,c:c1,a:.5}); break; }
      case 'cloak.ambush': { for(let j=0;j<3;j++){ const an=a+(j-1)*.5; this.add(ab,'streak',e.x,e.y,{a:an,x2:2.4,life:.25,s:3,c:c2,add:true,z:.6,vx:Math.cos(an)*8,vy:Math.sin(an)*8}); } this.add(ab,'ring',e.x,e.y,{s:2.2,life:.35,c:c2,add:!red}); this.bloom(ab,e.x,e.y,1.6,c2,.18); rad(10,6,'spark',()=>({life:.35,s:1.6,c:c2,add:true,z:.6})); break; }
      case 'forcedcool.cast': { for(let i=0;i<this.N(12);i++){ const an=R()*6.283; this.add(ab,'steam',e.x+Math.cos(an)*.4,e.y+Math.sin(an)*.4,{vx:Math.cos(an)*1.5,vy:Math.sin(an)*1.5,vz:1.5+R()*1.5,life:.9+R()*.4,s:.35+R()*.25,c:i%2?c2:'#d8e2e4',z:.3}); }
        for(let i=0;i<this.N(8);i++){ const an=R()*6.283, sp=2+R()*3; this.add(ab,'frost',e.x,e.y,{vx:Math.cos(an)*sp,vy:Math.sin(an)*sp,vz:2+R()*2,g:10,life:.7,s:.1,c:i%2?'#bfe6f0':'#e8fbff',add:true,z:.5,rot:R()*6,vr:5}); }
        this.add(ab,'ring',e.x,e.y,{s:2,life:.45,c:c2,add:!red}); break; }
      case 'defib.fire': case 'revive.fire': { for(let i=0;i<this.N(5);i++){ const an=R()*6.283; this.add(ab,'arc',e.x,e.y,{x2:e.x+Math.cos(an)*2,y2:e.y+Math.sin(an)*2,life:.3+R()*.2,s:.1,c:i%2?'#e8f6ff':'#9fd0f0',add:true,z:.5}); }
        this.add(ab,'ring',e.x,e.y,{s:2.4,life:.6,c:'#9fd0f0',add:!red}); this.add(ab,'glow',e.x,e.y,{s:1.6,life:.9,c:'#9fd0f0',add:!red,z:.5}); this.bloom(ab,e.x,e.y,1.6,'#e8f6ff',.25); break; }
    }
    if(/^(cast|hit|fire|shatter)$/.test(ph)){ this.amp=AMP; try{ this.layer(e,ab,ph); } finally{ this.amp=1; } }
  }
  update(dt:number){ if(this.accent){ this.accent.t+=dt; if(this.accent.t>=this.accent.life) this.accent=null; } if(!this.live) return; for(const p of this.pool){ if(!p.on) continue; p.t+=dt; if(p.t>=p.life){ p.on=false; this.live--; continue; } p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; if(p.g){ p.vz-=p.g*dt; if(p.z<0){ p.z=0; p.vz*=-.3; p.vx*=.6; p.vy*=.6; } } if(p.d>0){ const f=Math.max(0,1-p.d*dt); p.vx*=f; p.vy*=f; } p.rot+=p.vr*dt; } }
}
export const VFX=new Vfx(); (globalThis as any).__vfx=VFX;
export const typeColor=(t:keyof typeof ABILITY_TYPE_COLOR)=>ABILITY_TYPE_COLOR[t];
