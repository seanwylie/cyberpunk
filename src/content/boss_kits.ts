// Boss signature kits (docs/BOSSES.md). Every boss gets 2-3 themed mechanics from the library below on top of its old move list. Each mechanic has its own telegraph
// shape and visual language (src/boss_draw.ts), its own synth stinger (audio.ts bossSfx), a readable tell with a fair windup, and escalates by HP phase (thirds).
// Layouts come from a seeded stream (instance seed + boss id + cast number) so every client of a party sees the same safe zones / tile order / gaps.
import { ENEMIES } from '../config';
import { HARD } from './hardmode';
import { rng32, hash32 } from '../net/shared';
import { arenaOf, applyAct, freeTile, bossTierOf } from './mechanics';
import { BOSS_BY_ID } from './batch1_bosses';
import type { Arena } from './mechanics';
import { rayLen } from './zoneshape';

export type MechId='beam'|'grid'|'scythe'|'vortex'|'conveyor'|'ricochet'|'pylons'|'safe'|'gaze'|'tiles'|'bombs'|'strike'|'overload'|'buffers'|'shockring'|'shield';
export interface Pal { a:string; b:string; d:string }
export const PALS:Record<string,Pal>={
  amber:{a:'#ffae2b',b:'#fff0c0',d:'#3b2300'}, cyan:{a:'#33d4ff',b:'#d9f7ff',d:'#04293a'}, yellow:{a:'#f2e23a',b:'#fffbc4',d:'#332f00'}, violet:{a:'#a470ff',b:'#eadfff',d:'#1f0b3d'},
  magenta:{a:'#ff4fba',b:'#ffd6ef',d:'#3a0a29'}, ice:{a:'#9fdcff',b:'#f2fbff',d:'#0e2a3c'}, coral:{a:'#ff8466',b:'#ffe0d6',d:'#3b140a'}, gold:{a:'#d8b457',b:'#fff1c9',d:'#2c2306'},
  blue:{a:'#5683ff',b:'#d9e4ff',d:'#0a1640'}, white:{a:'#e6edf5',b:'#ffffff',d:'#1c2430'}, bronze:{a:'#cf8c4e',b:'#ffe3c4',d:'#2e1a08'}, orchid:{a:'#e08cff',b:'#fbe3ff',d:'#33103f'},
};
export interface KitMech { m:MechId; cd:number; first?:number; /** only once HP fraction is at or below this */ at?:number; p?:Record<string,number|string> }
export interface Kit { pal:keyof typeof PALS; mechs:KitMech[]; title:string }
/** shape + visual language per mechanic (what a player learns to read). Unique per mechanic: tests/boss_kits.mjs */
export const MECH_INFO:Record<MechId,{name:string;shape:string;style:string;tell:string;sfx:string}>={
  beam:{name:'Rotating beam',shape:'line',style:'beam',tell:'Dashed line with rotation arrows, hairline brightens, then the beam turns',sfx:'bk:beam'},
  grid:{name:'Laser grid',shape:'line',style:'lattice',tell:'Thin hairline lattice with safe cells; lit lines flash white',sfx:'bk:grid'},
  scythe:{name:'Scythe sweep',shape:'cone',style:'scythe',tell:'Swept sector outline with chevrons showing direction',sfx:'bk:scythe'},
  vortex:{name:'Gravity vortex',shape:'disc',style:'vortex',tell:'Concentric rings with arrows in (pull) or out (push), core saw',sfx:'bk:vortex'},
  conveyor:{name:'Conveyor floor',shape:'line',style:'belt',tell:'Marching chevron belt, shredder teeth at the end',sfx:'bk:belt'},
  ricochet:{name:'Ricochet roller',shape:'disc',style:'roller',tell:'Dotted bounce path with a spinning gear at the start',sfx:'bk:roll'},
  pylons:{name:'Tether pylons + snipes',shape:'line',style:'snipe',tell:'Locked crosshair lines from each live pylon',sfx:'bk:pylon'},
  safe:{name:'Safe zones',shape:'safe',style:'beacon',tell:'Whole arena hatched, green beacon rings with a countdown',sfx:'bk:safe'},
  gaze:{name:'Line-of-sight gaze',shape:'line',style:'gaze',tell:'Eye glyph, tracking line that freezes, blocked by pillars',sfx:'bk:gaze'},
  tiles:{name:'Tile sequence',shape:'tile',style:'rune',tell:'Numbered floor tiles light in order, then detonate in order',sfx:'bk:tile'},
  bombs:{name:'Chain bombs',shape:'disc',style:'bomb',tell:'Fuse rings with countdown digits and tether links',sfx:'bk:bomb'},
  strike:{name:'Afterimage strike',shape:'line',style:'lunge',tell:'Ghost silhouettes, lunge lane, then a slash cone at the landing spot',sfx:'bk:strike'},
  overload:{name:'Heat overload',shape:'safe',style:'coolant',tell:'Shimmering heat haze with cyan coolant rings',sfx:'bk:heat'},
  buffers:{name:'Buff nodes',shape:'ghost',style:'tether',tell:'Violet tethers from nodes to the boss, boss takes less damage',sfx:'bk:buff'},
  shockring:{name:'Gapped shockwave',shape:'ring',style:'toll',tell:'Dashed full-size ring with one green gap arrow',sfx:'bk:toll'},
  shield:{name:'Shield-break window',shape:'ghost',style:'hex',tell:'Hex shield around the boss; break it for a stagger window',sfx:'bk:shield'},
};
const M=(m:MechId,cd:number,o:Partial<KitMech>={}):KitMech=>({m,cd,...o});
export const KITS:Record<string,Kit>={
  // ---- original bosses
  teague:{pal:'amber',title:'Slag Line',mechs:[M('conveyor',16,{first:7}),M('bombs',13)]},
  brannoch:{pal:'bronze',title:'Ladle Toll',mechs:[M('shockring',12,{first:6}),M('scythe',10)]},
  ore9:{pal:'cyan',title:'Governor Protocol',mechs:[M('grid',14,{first:7}),M('pylons',30,{first:14})]},
  surgeon:{pal:'white',title:'Operating Theatre',mechs:[M('strike',11,{first:6}),M('scythe',13),M('shield',34,{at:.7})]},
  autosurgeon:{pal:'ice',title:'Twin Arms',mechs:[M('beam',13,{first:6}),M('tiles',14)]},
  recovered:{pal:'orchid',title:'Patient Eleven',mechs:[M('strike',12,{first:6}),M('vortex',15,{p:{dir:1}}),M('buffers',34,{at:.75})]},
  stockmgr:{pal:'yellow',title:'Clearance Haul',mechs:[M('ricochet',12,{first:6}),M('bombs',14)]},
  retrieval:{pal:'blue',title:'Retrieval Magnet',mechs:[M('gaze',11,{first:6}),M('vortex',15,{p:{dir:1}})]},
  reclaimer:{pal:'magenta',title:'Returns Desk',mechs:[M('buffers',32,{first:10}),M('ricochet',13),M('safe',20,{first:12})]},
  overseer:{pal:'coral',title:'Annex Oversight',mechs:[M('pylons',30,{first:12}),M('shockring',12,{first:6})]},
  warden:{pal:'violet',title:'Neural Warden',mechs:[M('safe',20,{first:10}),M('tiles',13,{first:6}),M('gaze',15)]},
  enforcer:{pal:'gold',title:'Repossession',mechs:[M('conveyor',16,{first:8}),M('scythe',10,{first:5}),M('ricochet',14)]},
  // ---- content batch 1
  voss:{pal:'amber',title:'Coke Battery',mechs:[M('beam',12,{first:6}),M('overload',22,{first:12})]},
  lineman:{pal:'cyan',title:'Live Lines',mechs:[M('gaze',11,{first:6}),M('pylons',30,{first:12}),M('grid',16)]},
  gantrymother:{pal:'yellow',title:'Crane Drop',mechs:[M('conveyor',15,{first:7}),M('grid',14),M('buffers',34,{at:.8})]},
  pitboss:{pal:'bronze',title:'The Pit',mechs:[M('vortex',14,{p:{dir:1},first:7}),M('shockring',12),M('ricochet',15)]},
  bellfounder:{pal:'gold',title:'Foundry Bell',mechs:[M('safe',19,{first:9}),M('shield',34,{at:.7}),M('shockring',11,{first:6})]},
  cryo:{pal:'ice',title:'Deep Freeze',mechs:[M('grid',13,{first:6}),M('shield',34,{at:.75}),M('tiles',14)]},
  auditor:{pal:'blue',title:'Audit Trail',mechs:[M('tiles',12,{first:6}),M('strike',12),M('shield',36,{at:.6})]},
  mirrorpt:{pal:'orchid',title:'Hall of Mirrors',mechs:[M('strike',11,{first:6}),M('gaze',13),M('buffers',34,{at:.7})]},
  apothecary:{pal:'magenta',title:'Dispensary',mechs:[M('bombs',12,{first:6}),M('overload',22,{first:12}),M('pylons',30,{first:16,at:.7})]},
  resonance:{pal:'white',title:'Anechoic Cell',mechs:[M('beam',12,{first:6}),M('safe',19,{first:10}),M('shockring',13)]},
  clearance:{pal:'coral',title:'Final Markdown',mechs:[M('conveyor',14,{first:6}),M('ricochet',12),M('tiles',15)]},
  liquidator:{pal:'bronze',title:'Liquidation',mechs:[M('bombs',12,{first:6}),M('shield',30,{at:.8}),M('grid',16)]},
  courier:{pal:'yellow',title:'Express Route',mechs:[M('strike',9,{first:5}),M('conveyor',16),M('ricochet',13)]},
  dispatcher:{pal:'cyan',title:'Fleet Uplink',mechs:[M('beam',13,{first:6}),M('pylons',30,{first:14}),M('buffers',32,{at:.8})]},
  warrantor:{pal:'gold',title:'Warranty Seal',mechs:[M('safe',19,{first:10}),M('pylons',30,{first:14}),M('tiles',14)]},
  tidewarden:{pal:'blue',title:'Pump Hall',mechs:[M('vortex',14,{p:{dir:-1},first:7}),M('conveyor',16),M('shockring',12)]},
  rattle:{pal:'coral',title:'Night Shift',mechs:[M('strike',10,{first:5}),M('buffers',32,{first:12}),M('scythe',11)]},
  breaker:{pal:'amber',title:'Chain Yard',mechs:[M('scythe',10,{first:5}),M('ricochet',13),M('vortex',16,{p:{dir:-1}})]},
  widow:{pal:'violet',title:'Signal Web',mechs:[M('beam',12,{first:6}),M('gaze',12),M('pylons',30,{first:14})]},
  recall:{pal:'magenta',title:'Recall Everything',mechs:[M('shield',30,{first:9}),M('pylons',30,{first:14,at:.8}),M('overload',22,{first:12,at:.6}),M('grid',15,{at:.5})]},
};
export const kitOf=(id:string):Kit|undefined=>KITS[id];
export const palOf=(id:string):keyof typeof PALS=>KITS[id]?.pal||'amber';
export const kph=(e:any)=>{ const f=e.hp/e.maxHp; return f>.66?0:f>.33?1:2; };

interface C { sim:any; e:any; rt:any; rng:()=>number; ar:Arena; ph:number; km:KitMech; pal:string; id:string; dmg:(f:number)=>number; P:(k:string,d:number)=>number; add:(z:any)=>any; free:(x:number,y:number,minD?:number)=>boolean }
const TAU=Math.PI*2;
const inBoss=(sim:any,x:number,y:number)=>!sim.solidAt(x,y)&&sim.zoneAt(x,y)==='boss';
function mkCtx(sim:any,e:any,km:KitMech,kit:Kit,n:number):C{
  const rt=e._rt; const seed=String(sim.inst?.seed??0); const rng=rng32(hash32(seed+':'+e.type+':'+n)); const ar=arenaOf(sim); const ph=kph(e);
  const add=(z:any)=>{ if(sim.zones.filter((q:any)=>q.kit).length>=26) return null; const o={t:0,heat:0,dps:0,windup:1,life:2,r:1,kit:km.m,pal:kit.pal,style:MECH_INFO[km.m].style,x:e.x,y:e.y,...z}; sim.zones.push(o); return o; };
  return { sim,e,rt,rng,ar,ph,km,pal:kit.pal,id:e.type,add,
    dmg:(f:number)=>f*sim.maxHp*(rt.hardDmg||1), P:(k:string,d:number)=>{ const v=km.p?.[k]; return typeof v==='number'?v:d; },
    free:(x:number,y:number,minD=0)=>inBoss(sim,x,y)&&!sim.circleHits(x,y,.5)&&Math.hypot(x-e.x,y-e.y)>=minD };
}
const sfx=(c:C,w:'tell'|'fire')=>c.sim.emit('sfx',MECH_INFO[c.km.m].sfx+':'+w);
const fireSfx=(c:C)=>(sim:any)=>sim.emit('sfx',MECH_INFO[c.km.m].sfx+':fire');
const wind=(c:C,base:number)=>Math.max(1.0,base-.12*c.ph);
const tgt=(c:C)=>({x:c.sim.px,y:c.sim.py});
const aimAt=(c:C)=>Math.atan2(c.sim.py-c.e.y,c.sim.px-c.e.x);
const RAY=(sim:any,x:number,y:number,a:number,max:number)=>rayLen(sim,x,y,a,max);
/** each mechanic returns how long the player is busy with it (windup + live time) */
const MECHS:Record<MechId,(c:C)=>number|null>={
  beam(c){ const n=Math.min(4,c.P('n',2)+(c.ph>=2?1:0)), w=wind(c,1.5), dur=3.2+.3*c.ph, dir=c.rng()<.5?1:-1, a0=c.rng()*TAU, sp=(.5+.08*c.ph)*dir;
    for(let i=0;i<n;i++) c.add({shape:'line',x:c.e.x,y:c.e.y,a:a0+i*TAU/n,len:13,w:.95,follow:c.e,spin:sp,sweep:sp*dur,windup:w,life:w+dur,dps:c.dmg(.05),burst:true,rearm:.85,label:i?undefined:'BEAM',onFire:i?undefined:fireSfx(c)});
    sfx(c,'tell'); return w+dur; },
  grid(c){ const S=3.6, ar=c.ar, w=wind(c,1.6), k=2+Math.min(2,c.ph), ox=ar.cx+(c.rng()-.5)*S, oy=ar.cy+(c.rng()-.5)*S; const xs:number[]=[], ys:number[]=[]; for(let v=-4;v<=4;v++){ const x=ox+v*S, y=oy+v*S; if(x>ar.x0+.5&&x<ar.x1+.5) xs.push(x); if(y>ar.y0+.5&&y<ar.y1+.5) ys.push(y); }
    const pick=(a:number[],n:number)=>{ const b=a.slice(); const out:number[]=[]; while(out.length<n&&b.length) out.push(b.splice(Math.floor(c.rng()*b.length),1)[0]); return out; };
    let first=true; for(const x of pick(xs,k)){ c.add({shape:'line',x,y:ar.y0-1,a:Math.PI/2,len:ar.y1-ar.y0+3,w:.8,windup:w,life:w+.55,dps:c.dmg(.09),burst:true,label:first?'LASER GRID':undefined,onFire:first?fireSfx(c):undefined}); first=false; }
    for(const y of pick(ys,k)) c.add({shape:'line',x:ar.x0-1,y,a:0,len:ar.x1-ar.x0+3,w:.8,windup:w,life:w+.55,dps:c.dmg(.09),burst:true});
    sfx(c,'tell'); return w+.6; },
  scythe(c){ const w=wind(c,1.25), S=3.1, D=1.05, dir=c.rng()<.5?1:-1, a0=aimAt(c), arc=1.0, n=c.ph>=1?2:1; for(let i=0;i<n;i++){ const d=i?-dir:dir, ww=w+i*(D+.45); c.add({shape:'cone',x:c.e.x,y:c.e.y,a:a0-d*S/2,len:6.4+.4*c.ph,arc,follow:c.e,spin:d*S/D,sweep:d*S,windup:ww,life:ww+D,dps:c.dmg(.12),burst:true,label:i?undefined:'SCYTHE',onFire:i?undefined:fireSfx(c)}); }
    sfx(c,'tell'); return w+D+(n-1)*(D+.45); },
  vortex(c){ const dir=c.P('dir',1), w=wind(c,1.3), dur=3.4, R=8.5, at=dir>0&&c.ph>=1?{x:c.ar.cx,y:c.ar.cy}:{x:c.e.x,y:c.e.y};
    c.add({shape:'disc',style:'vortex',x:at.x,y:at.y,r:R,dir,windup:w,life:w+dur,dps:0,pull:dir*(3.1+.2*c.ph),keepIn:true,label:dir>0?'PULL':'PUSH',onFire:fireSfx(c)});
    if(dir>0) c.add({shape:'disc',style:'saw',x:at.x,y:at.y,r:1.5,windup:w,life:w+dur,dps:c.dmg(.08),burst:true,rearm:.9});
    else { const outer=Math.min(R,Math.max(6,c.ar.maxR-.5)); c.add({shape:'ring',style:'toll',x:c.ar.cx,y:c.ar.cy,r:outer+3,r0:outer-.2,windup:w,life:w+dur,dps:c.dmg(.06),burst:true,rearm:1}); }
    sfx(c,'tell'); return w+dur; },
  conveyor(c){ const ar=c.ar, w=.95, dur=5.2+c.ph*.5, horiz=c.rng()<.5, rows=3, sp=3.4+.2*c.ph; const span=horiz?ar.x1-ar.x0+1:ar.y1-ar.y0+1; const mid=horiz?ar.cy:ar.cx; let dir=c.rng()<.5?1:-1;
    for(let i=0;i<rows;i++){ const off=(i-1)*3.6; const x0=ar.x0, y0=ar.y0; const a=horiz?(dir>0?0:Math.PI):(dir>0?Math.PI/2:-Math.PI/2); const sx=horiz?(dir>0?x0:x0+span):mid+off, sy=horiz?mid+off:(dir>0?y0:y0+span);
      c.add({shape:'line',style:'belt',x:horiz?(dir>0?x0:x0+span):mid+off,y:horiz?mid+off:(dir>0?y0:y0+span),a,len:span,w:2.3,windup:w,life:w+dur,dps:0,push:sp,pushA:a,keepIn:true,label:i?undefined:'CONVEYOR',onFire:i?undefined:fireSfx(c)});
      const ex=sx+Math.cos(a)*(span-.6), ey=sy+Math.sin(a)*(span-.6); c.add({shape:'disc',style:'saw',x:ex,y:ey,r:1.4,windup:w,life:w+dur,dps:c.dmg(.1),burst:true,rearm:1});
      dir=-dir; }
    sfx(c,'tell'); return w+dur; },
  ricochet(c){ const n=1+Math.min(2,c.ph), w=wind(c,1.2), sp=6.2, a0=aimAt(c); for(let i=0;i<n;i++){ const a=a0+(i-(n-1)/2)*.7, vx=Math.cos(a)*sp, vy=Math.sin(a)*sp; const path=bouncePath(c.sim,c.e.x,c.e.y,vx,vy,3);
    c.add({shape:'disc',style:'roller',x:c.e.x,y:c.e.y,r:.85,vx,vy,bounces:3,path,windup:w,life:w+6.5,dps:c.dmg(.09),burst:true,rearm:.9,label:i?undefined:'ROLLER',onFire:i?undefined:fireSfx(c)}); }
    sfx(c,'tell'); return w+5; },
  pylons(c){ const live=c.sim.enemies.some((o:any)=>o.pylon&&!o.dead&&o.bossAdd); if(live) return null; applyAct(c.sim,c.e,{k:'pylons',type:String(c.km.p?.type||'camgun'),n:2+(c.ph>=2?1:0)}); c.rt.kit.snipeT=3; sfx(c,'fire'); return 4; },
  safe(c){ const ar=c.ar, w=wind(c,3.1), r=2.6-.25*c.ph, R=ar.maxR+2.5; const pts:{x:number;y:number;r:number}[]=[]; const T=tgt(c);
    for(let tries=0;tries<80&&pts.length<2;tries++){ const [tx,ty]=ar.tiles[Math.floor(c.rng()*ar.tiles.length)]; const x=tx+.5,y=ty+.5; if(!c.free(x,y)) continue; const dp=Math.hypot(x-T.x,y-T.y); if(pts.length===0&&(dp<4||dp>9)) continue; if(pts.length===1&&Math.hypot(x-pts[0].x,y-pts[0].y)<6) continue; pts.push({x,y,r}); }
    if(pts.length<1) pts.push({x:T.x,y:T.y,r});
    c.add({shape:'safe',x:ar.cx,y:ar.cy,r:R,safe:pts,windup:w,life:w+.6,dps:c.dmg(.27),burst:true,label:'GET TO A SAFE ZONE',onFire:fireSfx(c)}); sfx(c,'tell'); return w+.6; },
  gaze(c){ const n=1+Math.min(2,c.ph), w=wind(c,1.5); for(let i=0;i<n;i++){ const ww=w+i*.8; c.add({shape:'line',x:c.e.x,y:c.e.y,a:aimAt(c),len:12,R:14,w:.9,follow:c.e,track:'ray',freeze:.45,windup:ww,life:ww+.5,dps:c.dmg(.12),burst:true,label:i?undefined:'GAZE: BREAK LINE OF SIGHT',onFire:i?undefined:fireSfx(c)}); }
    sfx(c,'tell'); return w+.5+(n-1)*.8; },
  tiles(c){ const k=4+Math.min(3,c.ph*1.5|0), ar=c.ar, T=tgt(c), CS=2.4; const cells:{x:number;y:number}[]=[]; for(let tries=0;tries<200&&cells.length<k;tries++){ const gx=Math.round((T.x+(c.rng()-.5)*14-ar.x0)/CS), gy=Math.round((T.y+(c.rng()-.5)*14-ar.y0)/CS); const x=ar.x0+gx*CS, y=ar.y0+gy*CS; if(!c.free(x,y)) continue; if(cells.some(q=>Math.abs(q.x-x)<CS-.1&&Math.abs(q.y-y)<CS-.1)) continue; cells.push({x,y}); }
    const show=.5*cells.length+.5; cells.forEach((q,i)=>{ const w=show+.7+i*(.42-.04*c.ph); c.add({shape:'tile',x:q.x,y:q.y,r:CS/2-.05,num:i+1,dir:show,windup:w,life:w+.4,dps:c.dmg(.09),burst:true,label:i?undefined:'SEQUENCE',onFire:(s:any)=>s.emit('sfx','bk:tile:fire')}); });
    sfx(c,'tell'); return show+.7+cells.length*.4+.4; },
  bombs(c){ const n=4+Math.min(2,c.ph), T=tgt(c), pts:{x:number;y:number}[]=[{x:T.x,y:T.y}]; for(let tries=0;tries<120&&pts.length<n;tries++){ const p=pts[pts.length-1], a=c.rng()*TAU, d=3+c.rng()*1.2; const x=p.x+Math.cos(a)*d, y=p.y+Math.sin(a)*d; if(!c.free(x,y)||pts.some(q=>Math.hypot(q.x-x,q.y-y)<2.9)) continue; pts.push({x,y}); }
    const w0=wind(c,2.4)+.2; pts.forEach((p,i)=>{ const w=w0+i*.5; c.add({shape:'disc',style:'bomb',x:p.x,y:p.y,r:1.7,windup:w,life:w+.4,dps:c.dmg(.1),burst:true,link:pts[i+1]||null,num:i,label:i?undefined:'CHAIN BOMBS',onFire:(s:any)=>s.emit('sfx','bk:bomb:fire')}); });
    sfx(c,'tell'); return w0+n*.5+.4; },
  strike(c){ const w=wind(c,1.15), T=tgt(c); const e=c.e; let L:{x:number;y:number}|null=null; for(let tries=0;tries<70&&!L;tries++){ const a=c.rng()*TAU, d=3+c.rng()*1.2; const x=T.x+Math.cos(a)*d, y=T.y+Math.sin(a)*d; if(c.free(x,y)&&(tries>40||!sim_blocked(c.sim,e.x,e.y,x,y))) L={x,y}; } if(!L) return null;
    const sx=e.x, sy=e.y, ang=Math.atan2(L.y-sy,L.x-sx), len=Math.hypot(L.x-sx,L.y-sy);
    c.add({shape:'ghost',style:'ghost',x:sx,y:sy,r:1,windup:w,life:w+.9,dps:0,label:'STRIKE'});
    c.add({shape:'ghost',style:'ghost',x:L.x,y:L.y,r:1,windup:w,life:w+.5,dps:0});
    c.add({shape:'line',style:'lunge',x:sx,y:sy,a:ang,len,w:1.5,windup:w,life:w+.3,dps:c.dmg(.1),burst:true,onFire:(s:any)=>{ s.emit('sfx','bk:strike:fire'); if(e.dead) return; for(let k=1;k<=4;k++){ const d=len*k/5; c.add({shape:'ghost',style:'ghost',x:sx+Math.cos(ang)*d,y:sy+Math.sin(ang)*d,r:1,windup:0,life:.6,dps:0}); } if(!s.circleHits(L!.x,L!.y,ENEMIES[e.type].radius*.8)){ e.x=L!.x; e.y=L!.y; } }});
    c.add({shape:'cone',style:'slash',x:L.x,y:L.y,a:Math.atan2(T.y-L.y,T.x-L.x),len:4.2,arc:1.7,track:'aim',freeze:.3,windup:w+.6,life:w+.85,dps:c.dmg(.12),burst:true});
    sfx(c,'tell'); return w+.9; },
  overload(c){ const ar=c.ar, w=wind(c,1.7), dur=5, n=2+(c.ph>=2?1:0), r=2.7-.2*c.ph; const pts:{x:number;y:number;r:number}[]=[]; const T=tgt(c);
    for(let tries=0;tries<80&&pts.length<n;tries++){ const [tx,ty]=ar.tiles[Math.floor(c.rng()*ar.tiles.length)]; const x=tx+.5,y=ty+.5; if(!c.free(x,y)) continue; if(pts.length===0&&Math.hypot(x-T.x,y-T.y)>10) continue; if(pts.some(q=>Math.hypot(q.x-x,q.y-y)<6)) continue; pts.push({x,y,r}); }
    if(!pts.length) pts.push({x:T.x,y:T.y,r});
    c.add({shape:'safe',style:'coolant',x:ar.cx,y:ar.cy,r:ar.maxR+2.5,safe:pts,windup:w,life:w+dur,dps:0,heat:24+3*c.ph,heatOnly:true,label:'HEAT OVERLOAD: STAND IN COOLANT',onFire:fireSfx(c)}); sfx(c,'tell'); return w+dur; },
  buffers(c){ if(c.sim.enemies.some((o:any)=>o.kitBuf&&!o.dead)) return null; const T=String(c.km.p?.type||'sentry'); if(!ENEMIES[T]) return null; let made=0; for(let i=0;i<2+(c.ph>=2?1:0);i++){ const t=freeTile(c.sim,c.ar,5,c.e); if(!t) continue; const o=c.sim.spawnEnemy(T,t.x,t.y); o.alert=true; o.bossAdd=true; o.kitBuf=true; o.maxHp=o.hp=Math.round(o.maxHp*2.2); made++; c.sim.fx.push({kind:'ring',x:t.x,y:t.y,r:1.6,t:0,life:.6,c:PALS[c.pal].a}); }
    if(made){ c.sim.toast('Buff nodes online: destroy them to expose '+ENEMIES[c.e.type].name); sfx(c,'fire'); return 6; } return null; },
  shockring(c){ const n=1+Math.min(2,c.ph), w=wind(c,1.25), R=Math.min(10,c.ar.maxR+1), g=5.2; let gap=c.rng()*TAU; for(let i=0;i<n;i++){ const ww=w+i*1.1; const ax=gap+(i?Math.PI+(c.rng()-.5):0); c.add({shape:'ring',style:'toll',x:c.e.x,y:c.e.y,r:1.6,r0:.5,R,gapA:ax,gapW:1.35,grow:g,windup:ww,life:ww+(R-1.6)/g+.15,dps:c.dmg(.1),burst:true,label:i?undefined:'SHOCKWAVE: FIND THE GAP',onFire:i?undefined:fireSfx(c)}); }
    sfx(c,'tell'); return w+(R-1.6)/g+(n-1)*1.1; },
  shield(c){ if(c.rt.shield&&c.rt.shield.hp>0) return null; const dur=10; applyAct(c.sim,c.e,{k:'shield',pct:.12,dur}); c.rt.kit.hex=c.add({shape:'ghost',style:'hex',x:c.e.x,y:c.e.y,r:2.2,follow:c.e,windup:0,life:dur+.2,dps:0,label:'SHIELD: BREAK IT'}); sfx(c,'tell'); return 5; },
};
/** simple ray test between two points (walls and prop colliders) */
function sim_blocked(sim:any,x0:number,y0:number,x1:number,y1:number){ const a=Math.atan2(y1-y0,x1-x0), d=Math.hypot(x1-x0,y1-y0); return rayLen(sim,x0,y0,a,d+.01)<d-.3; }
/** the preview path a ricochet roller will take (dotted line in the telegraph), same wall rule as the live zone */
function bouncePath(sim:any,x:number,y:number,vx:number,vy:number,bounces:number){ const pts=[{x,y}]; let b=bounces; const dt=.06; for(let i=0;i<400&&b>=0;i++){ const nx=x+vx*dt, ny=y+vy*dt; let bx=sim.solidAt(nx,y), by=sim.solidAt(x,ny); if(sim.solidAt(nx,ny)&&!bx&&!by){ bx=true; by=true; } if(bx||by){ if(bx) vx=-vx; if(by) vy=-vy; b--; pts.push({x,y}); } else { x=nx; y=ny; } } pts.push({x,y}); return pts; }

/** per-frame kit logic, called for every boss once its fight is live. Schedules mechanics, runs pylon snipes, buff nodes and the shield hex. */
export function kitTick(sim:any,e:any,dt:number){
  const kit=KITS[e.type]; if(!kit||e.dead) return; const rt=e._rt; if(rt.reveal>0||!e.alert||sim.revealing||sim.downed) return;
  if(!rt.kit) rt.kit={t:0,n:0,busy:0,next:{},last:'',ph:kph(e),snipeT:0,hex:null,bufPrev:0};
  const k=rt.kit; if(sim.zoneAt(sim.px,sim.py)!=='boss') return; k.t+=dt;
  if(!BOSS_BY_ID[e.type]) originalSupport(sim,e,dt,rt);
  // phase escalation stinger
  const ph=kph(e); if(ph>k.ph){ k.ph=ph; sim.emit('sfx','bk:phase'); sim.fx.push({kind:'ring',x:e.x,y:e.y,r:4.2,t:0,life:.8,c:PALS[kit.pal].a}); k.busy=Math.max(k.busy,k.t+1.2); }
  // buff nodes: boss takes less damage while any live; breaking all of them staggers
  const bufs=sim.enemies.filter((o:any)=>o.kitBuf&&!o.dead&&o.bossAdd).length; rt.kitBuf=bufs;
  if(bufs>0){ rt.btl=(rt.btl||0)-dt; if(rt.btl<=0){ rt.btl=.25; for(const o of sim.enemies) if(o.kitBuf&&!o.dead){ const a=Math.atan2(o.y-e.y,o.x-e.x), L=Math.hypot(o.x-e.x,o.y-e.y); sim.fx.push({kind:'line',x:e.x,y:e.y,a,len:L,w:.12,t:0,life:.3,c:PALS[kit.pal].a}); } } }
  if(k.bufPrev>0&&bufs===0){ rt.vuln=Math.max(rt.vuln||0,3.5); sim.toast('Buff nodes down: '+ENEMIES[e.type].name+' is exposed!'); sim.emit('sfx','bk:break'); } k.bufPrev=bufs;
  // pylon snipes: every live tether pylon locks a crosshair line onto you (>= 1.3 s tell, tracking freezes .45 s before it fires)
  const pyl=sim.enemies.filter((o:any)=>o.pylon&&!o.dead&&o.bossAdd);
  if(pyl.length){ k.snipeT-=dt; if(k.snipeT<=0){ k.snipeT=6.5/(1+.2*ph); const o=pyl[Math.floor(((k.n+k.t*7)|0)%pyl.length)]; if(sim.zones.filter((q:any)=>q.kit).length<22){ const a=Math.atan2(sim.py-o.y,sim.px-o.x); sim.zones.push({t:0,heat:0,kit:'pylons',pal:kit.pal,shape:'line',style:'snipe',x:o.x,y:o.y,a,len:14,R:15,w:.8,track:'ray',freeze:.45,windup:1.4,life:1.9,r:1,dps:.07*sim.maxHp*(rt.hardDmg||1),burst:true,label:'SNIPE',onFire:(s:any)=>s.emit('sfx','bk:pylon:fire')}); sim.emit('sfx','bk:pylon:tell'); } } }
  // shield hex ends with the shield
  if(k.hex&&(!rt.shield||rt.shield.hp<=0)){ k.hex.life=Math.min(k.hex.life,k.hex.t+.1); k.hex=null; sim.emit('sfx','bk:break'); }
  // scheduling: one signature mechanic at a time, never while the boss is mid-windup of a normal attack
  if(k.t<k.busy||rt.st==='tele'||rt.st==='dash') return;
  const tc=HARD.mech.tierCd[bossTierOf(e.type)]||1; let best:KitMech|null=null, bi=-1, bo=-1e9;
  kit.mechs.forEach((km,i)=>{ if(km.at!==undefined&&e.hp/e.maxHp>km.at) return; if(km.m===k.last&&kit.mechs.length>1) return; const nx=k.next[i]??(km.first??km.cd*.6); const over=k.t-nx; if(over>=0&&over>bo){ bo=over; best=km; bi=i; } });
  if(!best) return; const km=best as KitMech; const c=mkCtx(sim,e,km,kit,k.n++); const dur=MECHS[km.m](c);
  if(dur===null){ k.next[bi]=k.t+4; return; } k.last=km.m; const cd=km.cd/tc*(1-.06*ph)*(.9+c.rng()*.2); k.next[bi]=k.t+dur+cd; k.busy=k.t+dur+1.6;
  rt.underT=Math.max(rt.underT||0,4.5); // a signature mechanic is the pressure: delay the generic under-your-feet hazard
}
export const KIT_ZONE_CAP=26;

/** shield timer + pylon/tether upkeep that bossTick does for the batch-1 bosses; the 12 original bosses get it here so every kit mechanic works for them too */
function originalSupport(sim:any,e:any,dt:number,rt:any){ const def=ENEMIES[e.type];
  const sh=rt.shield; if(sh){ sh.t-=dt; if(sh.t<=0||sh.hp<=0){ rt.shield=null; if(sh.hp<=0){ rt.vuln=4; sim.toast('Shield broken: '+def.name+' is staggered!'); sim.fx.push({kind:'ring',x:e.x,y:e.y,r:3.6,t:0,life:.5,c:'#e8d890'}); } } }
  const pyl=sim.enemies.filter((o:any)=>o.pylon&&!o.dead&&o.bossAdd).length; if(rt.pylPrev===undefined) rt.pylPrev=0;
  if(rt.pylPrev>0&&pyl===0){ rt.vuln=Math.max(rt.vuln||0,4); sim.toast('Tether broken: '+def.name+' is exposed!'); } rt.pylPrev=pyl;
  if(pyl>0){ rt.tl=(rt.tl||0)-dt; if(rt.tl<=0){ rt.tl=.25; for(const o of sim.enemies) if(o.pylon&&!o.dead&&o.bossAdd){ const a=Math.atan2(o.y-e.y,o.x-e.x), L=Math.hypot(o.x-e.x,o.y-e.y); sim.fx.push({kind:'line',x:e.x,y:e.y,a,len:L,w:.1,t:0,life:.3,c:'#e0c060'}); } } } }
/** dev/test hook: cast one mechanic right now (tests/boss_kits.mjs, tests/boss_shots.mjs, tools/balance). Returns its duration or null if it declined. */
export function castMech(sim:any,e:any,m:MechId,palKey?:string):number|null{ const kit:Kit=KITS[e.type]||{pal:(palKey as any)||'amber',mechs:[],title:''}; const rt=e._rt; if(!rt.kit) rt.kit={t:0,n:0,busy:0,next:{},last:'',ph:kph(e),snipeT:0,hex:null,bufPrev:0}; return MECHS[m](mkCtx(sim,e,{m,cd:10},kit,rt.kit.n++)); }
