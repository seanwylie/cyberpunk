// Structural progression checks (bundled by tests/progression_sweep.mjs with esbuild, run in node).
import { DUNGEON_LIST } from '../../src/content/dungeons';
import { stageMap } from '../../src/content/safestart';
import { reachMap } from '../../src/content/mapgen';
import { ENEMIES } from '../../src/config';
/** intentional bypass routes: the Annex maintenance passage (cloak route) reaches the control junction around the security lock */
export const BYPASS_OK:Record<string,string[]>={ annex:['objective'] };
export function sweep(seeds:number[]){
  const rows:any[]=[];
  for(const d of DUNGEON_LIST) for(const seed of seeds){ const issues:string[]=[]; let L:any;
    try{ L=d.build(seed); }catch(e:any){ rows.push({id:d.id,seed,issues:['build threw: '+e.message]}); continue; }
    const st=stageMap(L); const w=L.w; const S=(x:number,y:number)=>st[Math.floor(y)*w+Math.floor(x)];
    const it=(id:string)=>L.interacts.find((i:any)=>i.id===id);
    const need=(lab:string,p:any,k:number)=>{ if(!p){ issues.push('missing '+lab); return; } const s=S(p.x,p.y); if(s>k) issues.push(lab+' needs stage '+k+' but is '+(s===255?'unreachable':'stage '+s)); };
    // no objective (relay, controller, boss) is reachable with every door closed, and the controller never before the lock, unless whitelisted as an intentional route
    { const wl=BYPASS_OK[d.id]||[]; for(const [lab,p,min] of [['relay',it('hackproc'),1],['objective',it('controller'),2],['boss',L.bossSpawn,3]] as [string,any,number][]){ if(!p) continue; const v=S(p.x,p.y); if(v<min&&!wl.includes(lab)) issues.push(lab+' reachable at stage '+v+' (needs '+min+'): door bypass'); } }
    need('spawn',L.spawn,0); need('relay',it('hackproc'),1); need('objective',it('controller'),2); need('boss',L.bossSpawn,3); if(L.checkpoints[1]) need('checkpoint2',L.checkpoints[1],2);
    // gate guards (gate1 opens when all are dead): every one must stand where the player is with all doors closed
    const gg=L.spawns.filter((s:any)=>s.type===d.gateGuard); gg.forEach((s:any)=>{ if(st[s.y*w+s.x]!==0) issues.push('gate guard g'+s.group+' at '+s.x+','+s.y+' is '+(st[s.y*w+s.x]===255?'unreachable':'behind door stage '+st[s.y*w+s.x])); });
    // lock elite (lock2 opens on its death; hack is optional hardware, so the combat route must work)
    const le=L.spawns.filter((s:any)=>s.type===d.lockElite); if(!le.length&&!d.conds?.length&&d.id!=='annex') issues.push('no lock elite (lock2 only openable by hack)'); le.forEach((s:any)=>{ if(st[s.y*w+s.x]>1) issues.push('lock elite at '+s.x+','+s.y+' is '+(st[s.y*w+s.x]===255?'unreachable':'stage '+st[s.y*w+s.x])); });
    // every mob is reachable (some stage) for its own body size, so a clear never counts an unkillable mob
    const rm=[0,1,2].map(c=>reachMap({...L,solid:openAll(L)},L.spawn,c)); let unreach=0; for(const s of L.spawns){ const r=ENEMIES[s.type]?.radius??.4; const c=r>.75?2:r>.45?1:0; if(!rm[c][s.y*w+s.x]&&!rm[0][s.y*w+s.x]) unreach++; } if(unreach) issues.push(unreach+' mob(s) on unreachable tiles');
    // simulated clear: with guards dead the gate tiles open and connect stage 0 to stage 1, etc. (stageMap already opens doors in run order; check each door actually joins)
    for(const [k,id] of [[1,'gate1'],[2,'lock2'],[3,'boss']] as [number,string][]){ const dr=L.doors.find((x:any)=>x.id===id); if(!dr){ issues.push('missing door '+id); continue; } if(!dr.tiles.some(([x,y]:any)=>st[y*w+x]===k||st[y*w+x]===k-1)) issues.push('door '+id+' not on the route'); }
    rows.push({id:d.id,seed,issues}); }
  return rows; }
function openAll(L:any){ const s=new Uint8Array(L.solid); for(const d of L.doors) for(const [x,y] of d.tiles) s[y*L.w+x]=0; return s; }
