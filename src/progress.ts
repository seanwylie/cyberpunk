// Progression safety nets (docs/PROGRESSION.md). Rule: the player must never be unable to progress.
// 1. A mob that gates a door (gate guard for gate1, lock elite for lock2) but stands where the player cannot reach it with that door closed is pulled to the player's side.
// 2. Watchdog: when nothing progresses (no kill, no flag change) for PROG.pullS seconds, the remaining gating mobs come to the player; after PROG.forceS the door opens by emergency override.
// 3. objectiveStep() names the next step for the HUD arrow (gate guards -> open gate -> lock -> objective -> boss).
import type { Level } from './level';
import { stageMap } from './content/safestart';
import { ENEMIES } from './config';

export const PROG={ pullS:75, forceS:180, scanS:1 };
const hf=Math.floor;
const cache=new WeakMap<Level,Uint8Array>();
export function stages(L:Level):Uint8Array{ let s=cache.get(L); if(!s){ s=stageMap(L); cache.set(L,s); } return s; }
export const stageAt=(L:Level,x:number,y:number)=>{ const xi=hf(x), yi=hf(y); if(xi<0||yi<0||xi>=L.w||yi>=L.h) return 255; return stages(L)[yi*L.w+xi]; };
/** stage of a point, tolerant of a mob standing on a prop edge: best stage of the 3x3 neighbourhood */
export function stageNear(L:Level,x:number,y:number){ let b=255; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) b=Math.min(b,stageAt(L,x+dx,y+dy)); return b; }

type Sim=any;
/** which door comes next and the living mobs whose death opens it (and the stage they must stand in to be reachable) */
export function gating(sim:Sim):{door:string|null;mobs:any[];need:number}{ const f=sim.inst.flags, dd=sim.dd;
  if(!f.gate1) return {door:'gate1',mobs:sim.enemies.filter((e:any)=>!e.dead&&e.faction!=='ally'&&e.type===dd.gateGuard),need:0};
  if(!f.lock2) return {door:'lock2',mobs:sim.enemies.filter((e:any)=>!e.dead&&e.faction!=='ally'&&e.type===dd.lockElite),need:1};
  if(!f.controller) return {door:'boss',mobs:[],need:2};
  return {door:null,mobs:[],need:3}; }

/** a free tile on the player's side, 5..10 tiles from (px,py), reachable within stage <= need */
function tileNear(sim:Sim,px:number,py:number,need:number):{x:number;y:number}|null{ const L:Level=sim.level; const st=stages(L); let best:{x:number;y:number}|null=null, bd=1e9;
  for(let y=hf(py)-12;y<=py+12;y++)for(let x=hf(px)-12;x<=px+12;x++){ if(x<1||y<1||x>=L.w-1||y>=L.h-1) continue; const i=y*L.w+x; if(L.solid[i]||st[i]>need) continue; if(L.solid[i-1]||L.solid[i+1]||L.solid[i-L.w]||L.solid[i+L.w]) continue; const d=Math.hypot(x+.5-px,y+.5-py); if(d<5) continue; const k=Math.abs(d-7); if(k<bd){ bd=k; best={x:x+.5,y:y+.5}; } }
  return best; }

export function pullTo(sim:Sim,e:any,need:number):boolean{ const p=tileNear(sim,sim.px,sim.py,need); if(!p) return false; e.x=p.x; e.y=p.y; e.home={x:p.x,y:p.y}; e.alert=true; return true; }

/** called once per world tick from Sim.updateWorldRun */
export function progressTick(sim:Sim,dt:number){ const inst=sim.inst; if(!inst||sim.mode!=='run') return; const f=inst.flags; if(f.bossSpawned||f.bossDead||sim.grace) { sim.progT=0; return; } // the calm-start grace never counts as a stall
  const kills=Object.values(inst.kills||{}).reduce((a:number,b:any)=>a+(b as number),0); const key=[f.gate1,f.lock2,f.controller,kills].join('|');
  if(key!==sim.progKey){ sim.progKey=key; sim.progT=0; sim.progPulled=false; }
  sim.progT=(sim.progT||0)+dt; sim.progScan=(sim.progScan||0)-dt; const g=gating(sim); if(!g.door) return;
  if(sim.progScan<=0){ sim.progScan=PROG.scanS; const L:Level=sim.level;
    for(const e of g.mobs){ if(stageNear(L,e.x,e.y)<=g.need) continue; if(pullTo(sim,e,g.need)){ sim.progFixed=(sim.progFixed||0)+1; sim.toast(ENEMIES[e.type].name+' was out of reach: it comes to you.'); } else { sim.killEnemy(e); sim.progFixed=(sim.progFixed||0)+1; } } }
  if(g.mobs.length&&sim.progT>PROG.pullS&&!sim.progPulled){ sim.progPulled=true; let n=0; for(const e of g.mobs) if(pullTo(sim,e,g.need)) n++; if(n) sim.toast(n>1?'The remaining guards come for you.':'The last guard comes for you.'); }
  if(sim.progT>PROG.forceS&&(g.door==='gate1'||g.door==='lock2')){ f[g.door]=true; sim.openDoor(g.door); sim.progT=0; sim.progForced=(sim.progForced||0)+1; sim.toast('Emergency override: '+(sim.level.doors.find((d:any)=>d.id===g.door)?.label||'door')+' opened.'); sim.saveNow?.(); }
}

/** HUD step for the stages before the lock: null hands back to the legacy objective chain */
export function objectiveStep(sim:Sim):{text:string;x:number;y:number;kind:string}|null{ const f=sim.inst.flags, L:Level=sim.level;
  const door=(id:string)=>{ const d=L.doors.find(d=>d.id===id); if(!d||!d.tiles.length) return null; let sx=0,sy=0; for(const [x,y] of d.tiles){ sx+=x; sy+=y; } return {x:sx/d.tiles.length+.5,y:sy/d.tiles.length+.5}; };
  const here=stageNear(L,sim.px,sim.py);
  if(!f.gate1){ const g=gating(sim).mobs; if(!g.length) return null; let b=g[0],bd=1e9; for(const e of g){ const d=Math.hypot(e.x-sim.px,e.y-sim.py); if(d<bd){ bd=d; b=e; } } return {text:'Next: destroy the gate guard'+(g.length>1?'s ('+g.length+' left)':' ('+ENEMIES[b.type].name+')'),x:b.x,y:b.y,kind:'guard'}; }
  if(here<1){ const p=door('gate1'); if(p) return {text:'Next: go through the open gate',x:p.x,y:p.y,kind:'gate'}; }
  if(f.lock2&&here<2){ const p=door('lock2'); if(p) return {text:'Next: go through the open lock',x:p.x,y:p.y,kind:'gate'}; }
  return null; }

/** Settings > Unstuck: snap to walkable ground on the reachable side, pull any gating mob to the player, and open the next door outright when nothing gates it. */
export function unstuck(sim:Sim):string{ if(sim.mode!=='run'||!sim.inst) return 'Only available inside a dungeon.'; const L:Level=sim.level;
  if(stageNear(L,sim.px,sim.py)===255){ const cp=L.checkpoints[0]; sim.px=cp.x; sim.py=cp.y; }
  sim.rescueStranded?.(); const g=gating(sim); let n=0; for(const e of g.mobs) if(pullTo(sim,e,g.need)) n++;
  if(!g.mobs.length&&(g.door==='gate1'||g.door==='lock2')){ sim.inst.flags[g.door]=true; sim.openDoor(g.door); sim.saveNow?.(); return 'Door opened.'; }
  sim.progT=0; return n?'The remaining '+(n>1?n+' guards come':'guard comes')+' to you.':'Repositioned. Follow the Next arrow.'; }
