// Runtime for batch-2 mobs (docs/MOBS_BATCH_2.md): mob-only attacks (snipe / mend / ward / hex / detonate / summonlite), elite AFFIXES and shield/regen/frenzy ticks.
// The sim only calls the hooks at the bottom (mobTick, mobDeath, mobAfterHit, resolveMobAttack, mobPattern, MOB_COND, mobLabel). Toolkit moves ("<mob>.<n>") run through mechanics.ts.
import { ENEMIES, COMBAT } from '../config';
import { MOB_ATK, TIER_CURVE, AFFIX_LABEL } from './batch2_mobs';
import type { Affix } from './batch2_mobs';
import { BAL } from './balance';
export const BLAST:Record<string,number>={ detonate:2.6, detonate_big:3.6 };
const alive=(sim:any,e:any)=>sim.enemies.filter((o:any)=>o!==e&&!o.dead&&o.faction===e.faction&&o._rt.reveal<=0&&!ENEMIES[o.type].boss);
const wounded=(sim:any,e:any,r:number,f=.8)=>{ let best:any=null,bv=f; for(const o of alive(sim,e)){ if(Math.hypot(o.x-e.x,o.y-e.y)>r) continue; const v=o.hp/o.maxHp; if(v<bv){ bv=v; best=o; } } return best; };
const unshielded=(sim:any,e:any,r:number)=>alive(sim,e).filter((o:any)=>Math.hypot(o.x-e.x,o.y-e.y)<=r&&!(o._rt.shield&&o._rt.shield.hp>0)&&o.alert&&!ENEMIES[o.type].static);
export const MOB_COND:Record<string,(sim:any,e:any)=>boolean>={
  mend:(s,e)=>!!wounded(s,e,10), ward:(s,e)=>unshielded(s,e,9).length>0,
  summonlite:(s,e)=>s.enemies.filter((o:any)=>!o.dead&&o.minionOf===e.id).length<4,
};
const tierOf=(e:any)=>ENEMIES[e.type].mob?.tier??1;
function init(sim:any,e:any){ const rt=e._rt, def=ENEMIES[e.type]; rt.mi=1; const aff:string[]=e.affix||[]; rt.lastHp=e.hp; rt.calm=0;
  if(aff.length&&!e.eliteDone){ e.eliteDone=true; const k=1.6+.25*aff.length; e.maxHp=Math.round(e.maxHp*k); e.hp=e.maxHp; rt.lastHp=e.hp; }
  if(def.mob?.hasted) rt.cdMul=(rt.cdMul||1)*.8;
  if(aff.includes('hasted')){ rt.spdMul=(rt.spdMul||1)*1.3; rt.cdMul=(rt.cdMul||1)*.8; }
  const sh=(def.mob?.shield||0)+(aff.includes('shielded')?.5:0); if(sh>0) rt.shield={hp:e.maxHp*sh*BAL.p.shieldMul,max:e.maxHp*sh*BAL.p.shieldMul,t:999}; }
export function mobTick(sim:any,e:any,dt:number){ const rt=e._rt; if(e.dead) return; if(!rt.mi) init(sim,e);
  if(rt.cdMul&&rt.cdMul!==1){ const extra=dt*(1/rt.cdMul-1); for(const k in rt.acd) rt.acd[k]-=extra; }
  if(rt.immune>0) rt.immune-=dt; const aff:string[]=e.affix; if(!aff||!aff.length) return;
  if(e.hp<rt.lastHp-.01) rt.calm=0; else rt.calm+=dt;
  if(aff.includes('regenerating')&&rt.calm>3&&e.hp<e.maxHp) e.hp=Math.min(e.maxHp,e.hp+e.maxHp*.025*dt);
  rt.lastHp=e.hp;
  if(aff.includes('frenzied')&&!rt.fr&&e.hp<e.maxHp*.4){ rt.fr=1; rt.spdMul=(rt.spdMul||1)*1.35; rt.cdMul=(rt.cdMul||1)*.71; sim.fx.push({kind:'ring',x:e.x,y:e.y,r:2.4,t:0,life:.5,c:'#d85a3a'}); }
  if(aff.includes('warded')&&!rt.wd&&e.hp<e.maxHp*.5){ rt.wd=1; rt.immune=2; sim.fx.push({kind:'ring',x:e.x,y:e.y,r:2.8,t:0,life:.6,c:'#e8d890'}); } }
export function mobDeath(sim:any,e:any){ const aff:string[]=e.affix; if(aff&&aff.includes('volatile')){ const k=TIER_CURVE[tierOf(e)].dmg; sim.zones.push({x:e.x,y:e.y,r:2.5,t:0,life:2.1,dps:12*k,heat:10,windup:.9}); sim.fx.push({kind:'ring',x:e.x,y:e.y,r:2.5,t:0,life:.9,c:'#e0803a'}); } }
/** melee/zone hits that landed on the player this attack heal a vampiric mob */
export function mobAfterHit(sim:any,e:any,hp0:number){ const def=ENEMIES[e.type]; const ls=(e.affix&&e.affix.includes('vampiric')?.6:0)+(def.mob?.lifesteal||0); if(ls>0&&sim.hp<hp0){ const h=(hp0-sim.hp)*ls*2; e.hp=Math.min(e.maxHp,e.hp+h); sim.fx.push({kind:'ring',x:e.x,y:e.y,r:1.1,t:0,life:.4,c:'#c04a5a'}); } }
export function mobPattern(sim:any,e:any,a:string,tx:number,ty:number):{x:number;y:number}[]|null{ return null; }
export function resolveMobAttack(sim:any,e:any,a:string,tx:number,ty:number,dmg:number):boolean{ if(!MOB_ATK[a]) return false; const rt=e._rt, def=ENEMIES[e.type];
  const proj=(ang:number,speed:number,life=1.7)=>{ sim.projs.push({x:e.x+Math.cos(ang)*.6,y:e.y+Math.sin(ang)*.6,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,dmg,r:.25,life,faction:e.faction==='ally'?'ally':'enemy',kind:'bolt'}); };
  switch(a){
    case 'snipe': proj(rt.ang,22,1.2); sim.emit('sfx','enemy_shot'); sim.fx.push({kind:'spark',x:e.x+Math.cos(rt.ang)*.6,y:e.y+Math.sin(rt.ang)*.6,t:0,life:.2}); break;
    case 'mend': { const t=wounded(sim,e,10); if(t){ t.hp=Math.min(t.maxHp,t.hp+t.maxHp*BAL.p.mend); sim.fx.push({kind:'ring',x:t.x,y:t.y,r:1.5,t:0,life:.6,c:'#7fe0b0'}); sim.fx.push({kind:'ring',x:e.x,y:e.y,r:1,t:0,life:.4,c:'#7fe0b0'}); } break; }
    case 'ward': { const ts=unshielded(sim,e,9).sort((p:any,q:any)=>Math.hypot(p.x-e.x,p.y-e.y)-Math.hypot(q.x-e.x,q.y-e.y)).slice(0,3); for(const t of ts){ t._rt.shield={hp:t.maxHp*BAL.p.ward,max:t.maxHp*BAL.p.ward,t:8}; sim.fx.push({kind:'ring',x:t.x,y:t.y,r:1.3,t:0,life:.6,c:'#8fb8d8'}); } break; }
    case 'hex': { if(sim.downed||sim.iframes>0) break; const d=Math.hypot(sim.px-e.x,sim.py-e.y); if(d>14||!sim.los(e.x,e.y,sim.px,sim.py)) break; sim.hurtPlayer(dmg,e.x,e.y); sim.slowT=BAL.p.hexSlow; sim.heat=Math.min(COMBAT.heat.max,sim.heat+BAL.p.hexHeat); sim.fx.push({kind:'ring',x:sim.px,y:sim.py,r:1.5,t:0,life:.6,c:'#b078d8'}); if(!sim._hexToast||sim.time-sim._hexToast>6){ sim._hexToast=sim.time; sim.toast('Hexed: slowed and heating up'); } break; }
    case 'detonate': case 'detonate_big': { const R=BLAST[a]; sim.fx.push({kind:'ring',x:e.x,y:e.y,r:R,t:0,life:.5,c:'#e0803a'}); sim.emit('sfx','slam'); for(const o of sim.opponents(e.faction)) if(Math.hypot(o.x-e.x,o.y-e.y)-o.r<=R) o.hurt(dmg,e.x,e.y); sim.killEnemy(e); break; }
    case 'summonlite': { const n=sim.enemies.filter((o:any)=>!o.dead&&o.minionOf===e.id).length; for(let i=0;i<2&&n+i<BAL.p.summonCap;i++){ const aa=Math.random()*6.283, d=1.6+Math.random(); const x=e.x+Math.cos(aa)*d, y=e.y+Math.sin(aa)*d; if(sim.solidAt(x,y)||sim.circleHits(x,y,.4)) continue; const w=sim.spawnEnemy(def.summon||'cindermite',x,y); w.alert=true; w.minionOf=e.id; } sim.fx.push({kind:'ring',x:e.x,y:e.y,r:2,t:0,life:.5,c:'#8f8a74'}); break; }
  }
  return true; }
/** short text for the enemy tag: "Hasted · Volatile" (empty when the mob has no affix) */
export function mobLabel(e:any):string{ const a:string[]=e.affix; return a&&a.length?a.map(x=>AFFIX_LABEL[x as Affix]||x).join(' · '):''; }
