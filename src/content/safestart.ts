// Calm start (docs/SAFE_START.md): every dungeon level gets a SAFE ENTRY ZONE and a ramped first encounter, applied to the built level (pure function of
// the level + its seed, so resume / party / re-entry rebuild the same result).
//  * no enemy spawn within SAFE_R tiles of the entry, no hazard within SAFE_R tiles,
//  * no ranged / elite / static spawn with line of sight to the entry inside max(aggro+6, 20) tiles, and no enemy whose own aggro range reaches the entry with LOS,
//  * violating groups are RELOCATED whole (same zone first, then the nearest zone that is far enough), so the enemy count is preserved,
//  * the first three packs (by walking distance from the entry) are capped at 3 / 4 / 5 members (the surplus is moved into later packs) and the first two packs carry no elite affixes.
import type { Level } from '../level';
import { ENEMIES } from '../config';
import { reachMap, clrAt, FLOW_R, clsOf, rngOf } from './mapgen';

export const SAFE_R=14;           // tiles around the entry with no enemies / hazards
export const RAMP_CAPS=[3,4,5];   // max pack sizes for the first three packs
const hf=Math.floor;

/** tile-grid line of sight on the closed-door level (props and doors are solid tiles) */
export function losTiles(L:Pick<Level,'w'|'h'|'solid'>,ax:number,ay:number,bx:number,by:number):boolean{
  const d=Math.hypot(bx-ax,by-ay); const n=Math.max(1,Math.ceil(d/.25)); for(let i=1;i<n;i++){ const x=hf(ax+(bx-ax)*i/n), y=hf(ay+(by-ay)*i/n); if(x<0||y<0||x>=L.w||y>=L.h||L.solid[y*L.w+x]) return false; } return true; }
/** true when an enemy of this type standing on tile (x,y) would be a problem for a player at the entry */
export function violates(L:Level,type:string,x:number,y:number,R=SAFE_R):boolean{
  const def=ENEMIES[type]; if(!def) return false; const ex=x+.5, ey=y+.5; const d=Math.hypot(ex-L.spawn.x,ey-L.spawn.y); if(d<R) return true;
  const far=def.ranged||def.elite||def.static; const reach=far?Math.max(def.aggro+6,20):def.aggro+3; return d<reach&&losTiles(L,L.spawn.x,L.spawn.y,ex,ey); }
/** all offending spawn indices (used by the relocation and by tests) */
export function offenders(L:Level,R=SAFE_R):number[]{ const o:number[]=[]; L.spawns.forEach((s,i)=>{ if(violates(L,s.type,s.x,s.y,R)) o.push(i); }); return o; }

function pathDist(L:Level):Int16Array{ const {w,h}=L; const s=new Uint8Array(L.solid); for(const d of L.doors) for(const [x,y] of d.tiles) s[y*w+x]=0; const dist=new Int16Array(w*h).fill(-1); const q=[hf(L.spawn.y)*w+hf(L.spawn.x)]; dist[q[0]]=0; for(let k=0;k<q.length;k++){ const c=q[k], cx=c%w, cy=(c/w)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h) continue; const i=ny*w+nx; if(dist[i]>=0||s[i]) continue; dist[i]=dist[c]+1; q.push(i); } } return dist; }

/** Progression stage per tile: how many doors (gate1, lock2, boss, in run order) must be open before the tile is reachable from the entry. 255 = never. */
export function stageMap(L:Pick<Level,'w'|'h'|'solid'|'doors'|'spawn'>):Uint8Array{ const {w,h}=L; const st=new Uint8Array(w*h).fill(255); const order=['gate1','lock2','boss']; const extra=L.doors.filter(d=>!order.includes(d.id)).map(d=>d.id);
  for(let k=0;k<=order.length;k++){ const open=new Set([...order.slice(0,k),...(k===order.length?extra:[])]); const s=new Uint8Array(L.solid); for(const d of L.doors){ for(const [x,y] of d.tiles) s[y*w+x]=open.has(d.id)?0:1; }
    const q=[hf(L.spawn.y)*w+hf(L.spawn.x)]; const seen=new Uint8Array(w*h); seen[q[0]]=1; for(let i=0;i<q.length;i++){ const c=q[i]; if(st[c]===255) st[c]=k; const cx=c%w, cy=(c/w)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h) continue; const n=ny*w+nx; if(seen[n]||s[n]) continue; seen[n]=1; q.push(n); } } }
  return st; }
export function safeEntry(L:Level,seed:number):Level{
  if((L as any).safeEntry||L.kind==='town'||!L.spawns.length) return L; (L as any).safeEntry=true;
  const q=rngOf((seed^0x5afe57a7)>>>0); const w=L.w, h=L.h; const reach=[0,1,2].map(c=>reachMap(L,L.spawn,c)); const dist=pathDist(L);
  // progression stage of every tile (0 = reachable with every door closed, 1 = after gate1, 2 = after lock2, 3 = boss side). A relocated pack must stay in its own stage:
  // moving a gate guard past the gate it opens made the gate impossible to open (Sean's stuck run, docs/PROGRESSION.md).
  const stage=stageMap(L);
  // hazards never sit inside the safe zone
  if(L.hazards) L.hazards=L.hazards.filter(z=>Math.hypot(z.x-L.spawn.x,z.y-L.spawn.y)>=SAFE_R);
  const used=()=>{ const m=new Set<number>(); for(const s of L.spawns) m.add(s.y*w+s.x); return m; };
  const nearHaz=(x:number,y:number)=>(L.hazards||[]).some(z=>Math.hypot(z.x-x-.5,z.y-y-.5)<z.r+1.2);
  const nearInt=(x:number,y:number)=>L.interacts.some(i=>Math.hypot(i.x-x-.5,i.y-y-.5)<2.4);
  const nearCp=(x:number,y:number)=>L.checkpoints.some(c=>Math.hypot(c.x-x-.5,c.y-y-.5)<4);
  const zoneOf=(x:number,y:number)=>L.zoneNames[L.zone[y*w+x]];
  const okTile=(type:string,x:number,y:number)=>{ const R=FLOW_R[clsOf(ENEMIES[type]?.radius??.4)]; const c=clsOf(ENEMIES[type]?.radius??.4); return x>=0&&y>=0&&x<w&&y<h&&!L.solid[y*w+x]&&reach[c][y*w+x]===1&&clrAt(w,h,L.solid,x,y,R)&&!violates(L,type,x,y)&&!nearHaz(x,y)&&!nearInt(x,y)&&!nearCp(x,y)&&dist[y*w+x]>=0; };
  /** a pack's walking distance from the entry: mean over its members (a centroid can land inside a wall) */ const packDist=(ids:number[])=>{ let a=0,n=0; for(const i of ids){ const d=dist[L.spawns[i].y*w+L.spawns[i].x]; if(d>=0){ a+=d; n++; } } return n?a/n:1e9; };
  const groups=new Map<number,number[]>(); L.spawns.forEach((s,i)=>{ (groups.get(s.group)||groups.set(s.group,[]).get(s.group)!).push(i); });
  const centre=(ids:number[])=>({x:ids.reduce((a,i)=>a+L.spawns[i].x,0)/ids.length,y:ids.reduce((a,i)=>a+L.spawns[i].y,0)/ids.length});
  /** move a whole group so its members stand on valid tiles around a freshly chosen centre */
  const relocate=(ids:number[],prefZones:string[],minDist=SAFE_R,maxTries=1):boolean=>{
    const types=ids.map(i=>L.spawns[i].type); const lead=types[0]; const st0=stage[L.spawns[ids[0]].y*w+L.spawns[ids[0]].x]; const gate=ids.some(i=>L.spawns[i].group>=90||L.spawns[i].group===50); /* only door-opening mobs (gate guards 90/91, lock elite 50) are stage-bound */ const occ=used(); for(const i of ids) occ.delete(L.spawns[i].y*w+L.spawns[i].x);
    const cand:[number,number][]=[]; for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){ if(L.solid[y*w+x]||occ.has(y*w+x)) continue; const zn=zoneOf(x,y); if(zn==='corridor'||zn==='boss') continue; if(!types.every(t=>okTile(t,x,y))) continue; if(gate&&stage[y*w+x]!==st0) continue; cand.push([x,y]); }
    if(!cand.length) return false; void minDist; void maxTries;
    const c0=centre(ids); for(const zs of [prefZones,null]){ const pool=cand.filter(([x,y])=>!zs||zs.includes(zoneOf(x,y))); if(!pool.length) continue;
      // prefer tiles that are well past the safe radius but not at the far end of the level: walking distance 18..45 from the entry
      const mid=pool.filter(([x,y])=>dist[y*w+x]>=SAFE_R+4); const base=(mid.length?mid:pool); const ctr=base[hf(q()*base.length)];
      const order=pool.filter(t=>!occ.has(t[1]*w+t[0])).sort((a,b)=>Math.hypot(a[0]-ctr[0],a[1]-ctr[1])-Math.hypot(b[0]-ctr[0],b[1]-ctr[1]));
      const placed:[number,number][]=[]; let ok=true; for(const i of ids){ const t=L.spawns[i].type; const pick=order.find(([x,y])=>okTile(t,x,y)&&!placed.some(p=>Math.hypot(p[0]-x,p[1]-y)<1.6)&&!occ.has(y*w+x)); if(!pick){ ok=false; break; } placed.push(pick); }
      if(!ok) continue; ids.forEach((i,k)=>{ L.spawns[i].x=placed[k][0]; L.spawns[i].y=placed[k][1]; }); void c0; return true; }
    return false; };
  let moved=0; for(const [,ids] of groups){ if(!ids.some(i=>violates(L,L.spawns[i].type,L.spawns[i].x,L.spawns[i].y))) continue; const zn=ids.map(i=>zoneOf(L.spawns[i].x,L.spawns[i].y)); if(relocate(ids,[zn[0]])) moved++; else { // cannot keep the pack together: place the offenders one by one
      for(const i of ids){ const s=L.spawns[i]; if(violates(L,s.type,s.x,s.y)) relocate([i],[zoneOf(s.x,s.y)]); } } }
  // door-opening mobs that still violate (their stage has no compliant tile, e.g. a cramped entry yard): progression wins over calm start. Put each on the stage-0/1 tile
  // that is out of line of sight if possible and otherwise as far from the entry as the stage allows; listed in safeInfo.gateExempt (tests/calm_start.mjs exempts them).
  const gateExempt:number[]=[]; L.spawns.forEach((sp,i)=>{ if(!(sp.group>=90||sp.group===50)||!violates(L,sp.type,sp.x,sp.y)) return; const st0=stage[sp.y*w+sp.x]; const c=clsOf(ENEMIES[sp.type]?.radius??.4), R=FLOW_R[c]; const occ=used(); occ.delete(sp.y*w+sp.x); let best=-1,bs=-1e9;
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){ const k=y*w+x; if(L.solid[k]||occ.has(k)||stage[k]!==st0||reach[c][k]!==1||!clrAt(w,h,L.solid,x,y,R)||nearHaz(x,y)||nearInt(x,y)) continue; const d=Math.hypot(x+.5-L.spawn.x,y+.5-L.spawn.y); const sc=(losTiles(L,L.spawn.x,L.spawn.y,x+.5,y+.5)?0:1000)+d; if(sc>bs){ bs=sc; best=k; } }
    if(best>=0){ sp.x=best%w; sp.y=(best/w)|0; } if(violates(L,sp.type,sp.x,sp.y)) gateExempt.push(i); });
  let surplusN=0; for(let pass=0;pass<8;pass++){
  // ramp (re-ranked until stable, because moving surplus into later packs can shift the ranking): the first packs (by walking distance from the entry) are small; surplus members join later packs
  const gm=new Map<number,number[]>(); L.spawns.forEach((sp,i)=>{ (gm.get(sp.group)||gm.set(sp.group,[]).get(sp.group)!).push(i); }); const normal=[...gm.entries()].filter(([g,ids])=>g<90&&ids.length>0&&!ids.some(i=>ENEMIES[L.spawns[i].type]?.elite||ENEMIES[L.spawns[i].type]?.static)).map(([g,ids])=>{ return {g,ids,d:packDist(ids)}; }).sort((a,b)=>a.d-b.d);
  const surplus:number[]=[]; normal.slice(0,RAMP_CAPS.length).forEach((p,k)=>{ const keep=RAMP_CAPS[k]; if(p.ids.length>keep){ const lead=p.ids.slice().sort((a,b)=>(ENEMIES[L.spawns[b].type]?.hp||0)-(ENEMIES[L.spawns[a].type]?.hp||0))[0]; const rest=p.ids.filter(i=>i!==lead); const drop=rest.slice(keep-1); surplus.push(...drop); } if(k<2) for(const i of p.ids) delete (L.spawns[i] as any).affix; });
  const later=normal.slice(RAMP_CAPS.length+1).reverse(); /* farthest packs first: surplus parked in a near pack could re-enter the first three and keep the ramp from settling */ const pool=later.length?later:normal.slice(-1); let rr=0; for(const i of surplus){ const t=L.spawns[i].type; let done=false; for(const R of [6,12,20]){ for(let a=0;a<pool.length&&!done;a++){ const dest=pool[(rr+a)%pool.length]; const c=centre(dest.ids); const occ=used(); const tl:[number,number][]=[]; for(let y=hf(c.y)-R;y<=c.y+R;y++)for(let x=hf(c.x)-R;x<=c.x+R;x++) if(okTile(t,x,y)&&!occ.has(y*w+x)&&!L.spawns.some(s=>Math.hypot(s.x-x,s.y-y)<1.6)) tl.push([x,y]); tl.sort((p,q2)=>Math.hypot(p[0]-c.x,p[1]-c.y)-Math.hypot(q2[0]-c.x,q2[1]-c.y)); if(tl.length){ L.spawns[i].x=tl[0][0]; L.spawns[i].y=tl[0][1]; L.spawns[i].group=dest.g; dest.ids.push(i); done=true; rr=(rr+a+1)%pool.length; } } if(done) break; } }
  surplusN+=surplus.length; if(!surplus.length) break; }
  (L as any).safeInfo={ moved, surplus:surplusN, gateExempt, left:offenders(L).length };
  return L;
}
