// Default, colour-coded VFX for every effect primitive and ability type, built only from basic Fx kinds (ring/slash/line/burst/spark) so every ability is visible
// before bespoke art exists. Bespoke art can override per ability with registerAbilityVfx(id, fn) (used by the ability VFX system).
import type { AbilityData, Prim, AType } from './types';
import { registerGenericVfx } from '../vfx';
import { ABILITY_DATA } from './data';
for(const a of ABILITY_DATA) registerGenericVfx(a.id,a.role==='heat'?'heat':a.type);
export const TYPE_FX:Record<AType,string>={ attack:'#c4543c', defense:'#d8d2bf', hacking:'#6d90b0', mobility:'#a8b87a' };
const PRIM_FX:Record<string,string>={ burn:'#e0803a', mark:'#e8d890', expose:'#d9a36a', stun:'#e8e3b0', slow:'#8fb4c8', root:'#9a8250', shield:'#9ec7e8', heal:'#8fcf8a', cloak:'#8a9a62', vent:'#d5e4e6', tether:'#b79ccb', control:'#7f9bb8' };
type Hook=(g:any,ab:AbilityData,x:number,y:number)=>boolean|void;
const hooks:Record<string,Hook>={}; export const registerAbilityVfx=(id:string,fn:Hook)=>{ hooks[id]=fn; };
const reduced=(g:any)=>!!g.save?.settings?.reducedFx;
const push=(g:any,f:any)=>{ if(g.fx.length<260) g.fx.push(f); };
export function fxCastBase(g:any,ab:AbilityData,x=g.px,y=g.py){ if(hooks[ab.id]&&hooks[ab.id](g,ab,x,y)) return;
  // particle system (src/vfx.ts) recipe + the basic Fx rings below as a floor
  if(typeof g.vfx==='function') g.vfx(ab.id+'.cast',x,y,{a:g.face,r:ab.range||2,n:ab.shape==='cone'||ab.shape==='line'?1:ab.shape==='ground'?2:0}); const c=TYPE_FX[ab.type]; const k=reduced(g)?.5:1;
  push(g,{kind:'ring',x,y,r:ab.shape==='self'||ab.shape==='toggle'?1.4:.9,t:0,life:.35*k+.1,c}); if(!reduced(g)) push(g,{kind:'burst',x,y,t:0,life:.25,c}); }
export function fxPrim(g:any,c:{x:number;y:number;ang:number;tx:number;ty:number;ab:AbilityData},p:Prim){ const col=PRIM_FX[p.p]||TYPE_FX[c.ab.type]; const L=reduced(g)?.2:.4;
  switch(p.p){
    case 'cone': push(g,{kind:'slash',x:c.x,y:c.y,a:c.ang,r:p.r,w:p.arc*Math.PI/180,t:0,life:L,c:TYPE_FX[c.ab.type]}); break;
    case 'line': push(g,{kind:'line',x:c.x,y:c.y,a:c.ang,len:p.len,w:Math.max(.2,p.w*.5),t:0,life:L,c:TYPE_FX[c.ab.type]}); break;
    case 'circle': push(g,{kind:'ring',x:p.at==='aim'?c.tx:c.x,y:p.at==='aim'?c.ty:c.y,r:p.r,t:0,life:L+.1,c:TYPE_FX[c.ab.type]}); break;
    case 'dash': push(g,{kind:'line',x:g.px,y:g.py,a:c.ang,len:p.len,w:.5,t:0,life:L,c:TYPE_FX.mobility}); break;
    case 'teleport': push(g,{kind:'ring',x:g.px,y:g.py,r:1.1,t:0,life:L,c:TYPE_FX.mobility}); push(g,{kind:'ring',x:c.tx,y:c.ty,r:1.1,t:0,life:L+.1,c:TYPE_FX.mobility}); break;
    case 'shield': case 'mitigate': case 'reflect': case 'heal': case 'cloak': case 'vent': case 'buff': case 'cdr': case 'invuln': push(g,{kind:'ring',x:g.px,y:g.py,r:1.1,t:0,life:L+.2,c:col}); if(!reduced(g)) push(g,{kind:'vent',x:g.px,y:g.py,t:0,life:.5,c:col}); break;
    case 'burn': case 'mark': case 'expose': case 'stun': case 'slow': case 'root': case 'tether': case 'control': case 'strip': break; // drawn as status marks by abx_render
    default: break; } }
export function fxDeploy(g:any,d:{x:number;y:number;kind:string;r:number;ab:AbilityData}){ push(g,{kind:'ring',x:d.x,y:d.y,r:Math.min(2,d.r),t:0,life:.4,c:TYPE_FX[d.ab.type]}); }
