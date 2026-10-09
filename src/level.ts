// Handcrafted-room assembly for the Reclamation Annex. Every layout keeps a combat route to objective and boss.
export type Zone = 'yard'|'proc'|'junction'|'boss'|'salvage'|'corridor'|'passage'|'town';
export interface DoorDef { id:string; tiles:[number,number][]; label:string; }
export interface Prop { x:number; y:number; kind:'crate'|'conveyor'|'machine'|'pillar'|'rack'; h:number; }
export interface Interact { id:string; x:number; y:number; r:number; label:string; kind:'terminal'|'hack'|'armory'|'controller'|'door'|'npc'|'locker'|'gate'|'vendor'|'crate'; }
export interface SpawnDef { type:string; x:number; y:number; group:number; }
export interface Level { w:number; h:number; solid:Uint8Array; zone:Uint8Array; doors:DoorDef[]; props:Prop[]; interacts:Interact[]; spawns:SpawnDef[]; checkpoints:{id:number;x:number;y:number;label:string}[]; sensors:{x0:number;y0:number;x1:number;y1:number}; spawn:{x:number;y:number}; zoneNames:Zone[]; bossSpawn:{x:number;y:number}; revealX:number; salvage:{x:number;y:number};
  /** 'town' enables the illustrated hub renderer (src/town.ts); decor/npcs/lights are visual-only (collision comes from `solid`). */
  kind?:'town'|'annex'; decor?:Decor[]; npcs?:NpcDef[]; lights?:LightDef[]; hide?:Uint8Array; overhead?:Overhead[]; }
export interface Overhead { spr:string; x:number; y:number; z:number; sw:number; glow?:'lanterns'|'bulbs'; }
export interface Decor { spr:string; x:number; y:number; fw:number; fd:number; sw:number; ay?:number; solid?:boolean; flip?:boolean; glow?:string; steam?:boolean; }
export interface NpcDef { spr:string; x:number; y:number; wander?:[number,number]; speed?:number; ph:number; h?:number; }
export interface LightDef { x:number; y:number; z:number; r:number; c:'warm'|'cool'|'fire'; a:number; flick?:number; }
export const ZONES:Zone[]=['yard','proc','junction','boss','salvage','corridor','passage','town'];

export function buildAnnex():Level {
  const w=88,h=46; const solid=new Uint8Array(w*h).fill(1); const zone=new Uint8Array(w*h);
  const carve=(x0:number,y0:number,x1:number,y1:number,z:Zone)=>{ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){ solid[y*w+x]=0; zone[y*w+x]=ZONES.indexOf(z);} };
  const props:Prop[]=[]; const spawns:SpawnDef[]=[]; const interacts:Interact[]=[];
  const block=(x:number,y:number,kind:Prop['kind'],hh=1,wd=1,dp=1)=>{ for(let j=0;j<dp;j++)for(let i=0;i<wd;i++){ solid[(y+j)*w+x+i]=1; props.push({x:x+i,y:y+j,kind,h:hh}); } };
  // Yard
  carve(2,12,23,27,'yard'); carve(24,18,25,20,'corridor');
  carve(26,8,47,30,'proc'); carve(48,18,49,20,'corridor');
  carve(50,10,62,27,'junction');
  carve(63,18,64,20,'corridor'); carve(65,8,84,30,'boss');
  carve(10,28,11,31,'corridor'); carve(4,32,19,42,'salvage');
  // Maintenance passage (cloak route): proc north -> along top -> junction north
  carve(36,4,37,7,'passage'); carve(36,3,57,4,'passage'); carve(56,5,57,9,'passage');
  // Armory below junction
  carve(57,29,62,34,'junction');
  // Yard props
  [[8,14],[9,14],[14,20],[15,20],[14,21],[18,16],[7,24],[8,24],[19,25],[12,25]].forEach(([x,y])=>block(x,y,'crate',1));
  block(11,15,'machine',1.6,2,1);
  // Processing floor: conveyors (cover) + machines
  block(30,12,'conveyor',.7,8,1); block(30,26,'conveyor',.7,8,1); block(41,12,'conveyor',.7,1,6); block(41,22,'conveyor',.7,1,6);
  block(34,17,'machine',1.8,2,2); block(44,28,'machine',1.8,2,2); block(28,9,'rack',1.6,3,1); block(44,9,'rack',1.6,3,1);
  block(33,21,'crate',1,1,1); block(37,16,'crate',1); block(38,24,'crate',1);
  // Junction
  block(54,14,'rack',1.6,1,3); block(54,22,'rack',1.6,1,3); block(60,14,'machine',1.5,1,2); block(60,23,'machine',1.5,1,2);
  // Boss pillars
  [[70,12],[70,26],[76,12],[76,26],[82,12],[82,26],[72,15],[72,23],[79,15],[79,23]].forEach(([x,y])=>block(x,y,'pillar',2.2));
  // Salvage props
  block(8,35,'rack',1.4,3,1); block(14,38,'crate',1,2,1); block(6,40,'crate',1);
  const doors:DoorDef[]=[
    { id:'gate1', tiles:[[24,18],[24,19],[24,20]], label:'Security gate' },
    { id:'lock2', tiles:[[48,18],[48,19],[48,20]], label:'Security lock' },
    { id:'armory', tiles:[[59,28],[60,28]], label:'Armory shutter' },
    { id:'boss', tiles:[[63,18],[63,19],[63,20]], label:'Boss chamber door' },
  ];
  // Armory shutter tile row must be carvable floor when open; mark solid initially and door controls it
  for(const d of doors) for(const [x,y] of d.tiles){ solid[y*w+x]=1; if(!zone[y*w+x]) zone[y*w+x]=ZONES.indexOf('corridor'); }
  zone[28*w+59]=zone[28*w+60]=ZONES.indexOf('junction');
  // Spawns
  let g=0; const grp=(type:string,pts:[number,number][])=>{ g++; pts.forEach(([x,y])=>spawns.push({type,x,y,group:g})); };
  spawns.push({type:'turret',x:22,y:14,group:90},{type:'turret',x:22,y:25,group:91});
  grp('worker',[[12,18],[13,19],[12,21],[17,18],[17,22],[10,22]]); grp('shooter',[[19,15],[19,22]]); grp('worker',[[16,26],[6,16]]);
  grp('worker',[[30,15],[31,16],[33,15],[30,23],[32,24],[34,23]]); grp('shooter',[[36,10],[39,28],[44,15],[45,24]]);
  grp('worker',[[38,19],[40,20],[39,17]]); spawns.push({type:'sawhand',x:43,y:19,group:50});
  grp('worker',[[45,10],[46,12]]); grp('worker',[[29,28],[28,24]]);
  grp('shooter',[[56,12],[57,11],[58,12]]); grp('shooter',[[53,17],[53,21]]); grp('worker',[[57,16],[57,22],[56,19]]);
  grp('worker',[[8,34],[10,37],[13,34],[16,36],[17,40],[7,38]]); spawns.push({type:'foreman',x:12,y:40,group:60});
  // Density pass: add a jittered companion for every other ordinary spawn on the processing floor, junction and salvage rooms.
  { const base=spawns.filter(s=>(s.type==='worker'||s.type==='shooter')&&s.x>=26&&s.group!==99); base.concat(spawns.filter(s=>s.type==='worker'&&s.x<20&&s.y>30)).forEach((s,i)=>{ if(i%2) return; for(const [dx,dy] of [[1.4,1],[-1.2,1.3],[1,-1.4]]){ const x=Math.floor(s.x+dx), y=Math.floor(s.y+dy); if(!solid[y*w+x]&&!solid[y*w+Math.floor(s.x)]){ spawns.push({type:s.type,x,y,group:s.group}); break; } } }); }
  // Chamfered room corners (visual + collision): cut stair-step triangles off rectangular room corners so rooms read as irregular/octagonal.
  // Skipped for any tile holding a prop, spawn, interactable, checkpoint or door tile.
  { const keep=(x:number,y:number)=>props.some(p=>p.x===x&&p.y===y)||spawns.some(sp=>Math.abs(sp.x-x-.5)<1.6&&Math.abs(sp.y-y-.5)<1.6)||doors.some(d=>d.tiles.some(t=>Math.abs(t[0]-x)<=1&&Math.abs(t[1]-y)<=1))||[...interacts,...[{x:4,y:19.5},{x:52,y:19.5}]].some(it=>Math.abs(it.x-x-.5)<1.8&&Math.abs(it.y-y-.5)<1.8);
    const cut=(x0:number,y0:number,x1:number,y1:number,n:number)=>{ for(const [cx,cy,sx,sy] of [[x0,y0,1,1],[x1,y0,-1,1],[x0,y1,1,-1],[x1,y1,-1,-1]] as [number,number,number,number][]) for(let j=0;j<=n;j++)for(let i=0;i+j<=n;i++){ const x=cx+sx*i,y=cy+sy*j; if(!solid[y*w+x]&&!keep(x,y)) solid[y*w+x]=1; } };
    cut(2,12,23,27,2); cut(26,8,47,30,2); cut(50,10,62,27,2); cut(65,8,84,30,4); cut(4,32,19,42,2); }
  // Interactables
  interacts.push(
    { id:'hackproc', x:46, y:19, r:1.6, label:'Security relay (hack: reroute locks)', kind:'hack' },
    { id:'terminal', x:56, y:11, r:1.6, label:'Annex security terminal', kind:'terminal' },
    { id:'controller', x:58, y:19, r:1.6, label:'Integration controller (objective)', kind:'controller' },
    { id:'armoryfuse', x:60, y:31, r:1.6, label:'Sealed armory: command fuse', kind:'armory' },
    { id:'armorydoor', x:59.5, y:27, r:1.8, label:'Armory shutter', kind:'door' },
    { id:'cratechip', x:8, y:41, r:1.5, label:'Chip cache (bonus)', kind:'crate' },
  );
  return { kind:'annex', w,h,solid,zone,doors,props,interacts,spawns,
    checkpoints:[{id:1,x:4,y:19.5,label:'Entry'},{id:2,x:52,y:19.5,label:'Control junction'}],
    sensors:{x0:40,y0:3,x1:52,y1:5}, spawn:{x:4.5,y:19.5}, zoneNames:ZONES, bossSpawn:{x:75.5,y:19.5}, revealX:67, salvage:{x:12,y:37} };
}

export function buildTown():Level {
  const w=40,h=30; const solid=new Uint8Array(w*h).fill(1); const zone=new Uint8Array(w*h).fill(ZONES.indexOf('town')); const hide=new Uint8Array(w*h);
  // organic plaza: ellipse with angular noise, so the boundary is not a rectangle
  const RX=16.8, RY=12.8; const edge=(a:number)=>1+.085*Math.sin(a*3+1.3)+.06*Math.sin(a*5+.4)+.04*Math.sin(a*9+2);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const dx=(x+.5-20)/RX, dy=(y+.5-15)/RY; const n=edge(Math.atan2(dy,dx)); if(dx*dx+dy*dy<n*n) solid[y*w+x]=0; }
  const carve=(x0:number,y0:number,x1:number,y1:number)=>{ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) solid[y*w+x]=0; };
  carve(32,19,36,22); carve(2,16,4,19);
  const decor:Decor[]=[]; const props:Prop[]=[];
  const D=(spr:string,x:number,y:number,fw:number,fd:number,sw:number,o:Partial<Decor>={})=>{ decor.push({spr,x,y,fw,fd,sw,solid:true,...o}); if(o.solid!==false) for(let j=0;j<fd;j++)for(let i=0;i<fw;i++){ solid[(y+j)*w+x+i]=1; hide[(y+j)*w+x+i]=1; } };
  // ---- stalls clustered along the edges (plaza centre stays open) ----
  // north / top of screen
  D('stall_goods',11,6,3,3,4.1,{glow:'warm'}); D('stall_clothes',15,4,3,3,3.5); D('stall_noodle',18,3,3,3,4.2,{glow:'warm'}); D('scaffold',21,4,3,3,3.2); D('stall_implant',24,4,3,3,4.2,{glow:'cool'}); D('board_jobs',27,4,2,2,2.7); D('poster_wall',31,5,3,1,3.0);
  // west: fixer / clinic / outfitter
  D('stall_a',6,9,3,3,4.1,{glow:'warm'}); D('fixer_booth',3,13,3,3,3.4,{glow:'cool'}); D('stall_clinic',3,17,3,3,4.2,{glow:'warm'}); D('stall_awning',6,21,3,3,3.6);
  // east: vendor row
  D('stall_vendor_sign',29,8,3,3,3.4,{glow:'warm'}); D('stall_vendor',33,11,3,3,4.0); D('steam_drums',36,15,2,2,2.5,{steam:true}); D('stall_junk',27,13,3,3,4.1,{glow:'warm'});
  // south: workbench / junk / weapons / gate
  D('workbench',15,22,2,2,3.1); D('lockers',12,23,1,2,1.5); D('stall_weapons',26,21,3,3,3.9,{glow:'warm'}); D('gate_arch',33,19,3,1,3.6); D('vending',23,23,1,1,1.25,{glow:'cool'});
  // clutter + street furniture
  D('crates',9,24,2,2,2.6); D('crates',21,26,2,2,2.4); D('cables',9,15,1,1,1.5); D('barrels',31,16,2,2,2.4); D('bench',24,19,2,1,2.0); D('bench',12,18,1,2,1.8); D('barrel_fire',9,17,1,1,1.3,{glow:'fire'}); D('banner_pole',13,10,1,1,1.7); D('banner_pole',27,10,1,1,1.7); D('junk',18,26,2,1,2.8,{solid:false});
  for(const [lx,ly] of [[14,13],[26,13],[17,20],[22,9],[30,16],[10,12]]) D('lamp',lx,ly,1,1,1.0,{glow:'warm'});
  // ---- perimeter: tenements (back), containers/slabs/barriers/gantries (sides & front) instead of rubble ----
  { let seed=7; const R=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
    const free=(x:number,y:number,fw:number,fd:number)=>{ if(x<0||y<0||x+fw>w||y+fd>h) return false; for(let j=0;j<fd;j++)for(let i=0;i<fw;i++){ const k=(y+j)*w+x+i; if(!solid[k]||hide[k]) return false; } return true; };
    const kinds:[string,number,number,number][]=[]; // spr, fw, fd, sw
    for(let a=-Math.PI;a<Math.PI;a+=.075){ const r=1.5+R()*1.2; const cx=20+(RX*edge(a)+r)*Math.cos(a), cy=15+(RY*edge(a)+r)*Math.sin(a); const depth=cx+cy;
      const pool:[string,number,number,number][]= depth<30? [['bld1',3,3,3.0],['bld2',3,3,3.0],['bld3',3,3,3.0],['gantry',2,2,2.3]] : depth<39? [['container',4,2,3.7],['slab',2,2,2.6],['barrier',3,1,3.0],['bld1',3,3,2.7],['gantry',2,2,2.2],['barrier_corner',2,2,3.2]] : [['container',4,2,3.7],['slab',2,2,2.6],['barrier',3,1,3.0],['barrier_corner',2,2,3.2],['container',2,4,3.7]];
      const [spr,fw,fd,sw]=pool[(R()*pool.length)|0]; const x=Math.round(cx-fw/2), y=Math.round(cy-fd/2);
      for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) if(free(x+dx,y+dy,fw,fd)){ D(spr,x+dx,y+dy,fw,fd,sw); kinds.push([spr,x,y,sw]); break; } }
  }
  const lights:LightDef[]=[];
  for(const d of decor){ if(!d.glow) continue; const cx=d.x+d.fw/2, cy=d.y+d.fd/2; if(d.glow==='warm') lights.push({x:cx,y:cy,z:d.spr==='lamp'?1.5:1.1,r:d.spr==='lamp'?5.4:4.2,c:'warm',a:d.spr==='lamp'?.42:.3,flick:d.spr==='lamp'?.04:.12}); else if(d.glow==='fire') lights.push({x:cx,y:cy,z:.6,r:5.2,c:'fire',a:.45,flick:.3}); else lights.push({x:cx,y:cy,z:1,r:3.4,c:'cool',a:.2,flick:.03}); }
  lights.push({x:20,y:15,z:0,r:9,c:'cool',a:.07});
  // ---- overhead dressing (drawn above actors, fades when the player is underneath) ----
  const overhead:Overhead[]=[
    {spr:'awn_red',x:13,y:11,z:2.1,sw:3.3},{spr:'awn_blue',x:24,y:8,z:2.1,sw:3.3},{spr:'awn_green',x:7,y:18,z:2.1,sw:3.2},{spr:'awn_grey',x:31,y:12,z:2.1,sw:3.2},
    {spr:'awn_blue',x:12,y:22,z:2.1,sw:2.9},{spr:'awn_red',x:29,y:19,z:2.1,sw:3.0},{spr:'awn_green',x:19,y:6,z:2.3,sw:2.9},{spr:'awn_grey',x:10,y:7,z:2.3,sw:2.9},{spr:'awn_red',x:33,y:9,z:2.2,sw:2.8},
    {spr:'leanto',x:28,y:22.5,z:2.3,sw:3.6},
    {spr:'swag1',x:14,y:9,z:2.3,sw:3.0,glow:'lanterns'},{spr:'swag2',x:27,y:10,z:2.3,sw:3.0,glow:'lanterns'},{spr:'swag3',x:13,y:20,z:2.4,sw:3.0,glow:'lanterns'},{spr:'swag1',x:28,y:20,z:2.3,sw:2.8,glow:'lanterns'},{spr:'swag2',x:21,y:7,z:2.3,sw:2.8,glow:'lanterns'},
    {spr:'bulbs',x:20,y:6.5,z:3.0,sw:7.5,glow:'bulbs'},{spr:'bulbs',x:21,y:23.5,z:2.9,sw:7,glow:'bulbs'},
    {spr:'rags1',x:9,y:12,z:2.7,sw:3.4},{spr:'rags2',x:32,y:16,z:2.7,sw:3.4},
  ];
  const npcs:NpcDef[]=[
    {spr:'np_pair_talk',x:19,y:12,ph:0,h:1.45},{spr:'np_kid_l',x:23.5,y:14,ph:2.1,wander:[17.5,17],speed:.5,h:1.0},{spr:'np_kid_r',x:22,y:18,ph:3.4,wander:[16,14],speed:.45,h:1.0},
    {spr:'np_guard_l',x:31,y:18,ph:1.3,h:1.35},{spr:'np_guard_r',x:31.5,y:21,ph:.4,h:1.35},{spr:'np_porter',x:13,y:16,ph:.7,wander:[13,21],speed:.3,h:1.3},
    {spr:'np_lantern_l',x:25,y:18,ph:5.2,wander:[20,21],speed:.28,h:1.35},{spr:'np_lantern_r',x:16,y:11,ph:2.7,wander:[22,10],speed:.25,h:1.35},
    {spr:'np_kneel_l',x:10.5,y:14,ph:.6,h:.95},{spr:'np_kneel_r',x:25,y:9,ph:4.1,h:.95},{spr:'np_hooded_wall',x:19.5,y:23.5,ph:1.8,h:1.55},
    {spr:'npc1',x:18.5,y:15,ph:0,h:1.25},{spr:'npc3',x:21.5,y:16.5,ph:1.3,h:1.25},{spr:'npc2',x:11.5,y:20,ph:.2,wander:[11.5,15],speed:.3,h:1.25},{spr:'npc4',x:29,y:11.5,ph:2.7,h:1.25},{spr:'npc3',x:24,y:11,ph:3.3,wander:[21,13],speed:.3,h:1.25},{spr:'npc1',x:8.5,y:13.5,ph:4.4,h:1.25},{spr:'npc4',x:20,y:18,ph:4.9,wander:[20,12.5],speed:.25,h:1.25},
  ];
  const interacts:Interact[]=[
    { id:'locker', x:17.8, y:22.8, r:2.2, label:'Body workspace & locker', kind:'locker' },
    { id:'vendor', x:28.4, y:9.8, r:2.2, label:'Vendor & repair', kind:'vendor' },
    { id:'fixer', x:8, y:15.6, r:2.2, label:'Fixer: Odalys Vane', kind:'npc' },
    { id:'annex', x:34.4, y:21.4, r:2.2, label:'Reclamation Annex gate', kind:'gate' },
    { id:'store', x:9.6, y:22.6, r:2.2, label:'Outfitter (simulated purchases)', kind:'terminal' },
    // secondary entry points (same ids on purpose: they open the same screens as the primary ones)
    { id:'vendor', x:26.4, y:7.8, r:2.0, label:'Implant parts (vendor & repair)', kind:'vendor' },
    { id:'fixer', x:28.6, y:6.6, r:2.0, label:'Jobs board (Fixer contracts)', kind:'npc' },
    { id:'locker', x:6.6, y:18.6, r:2.0, label:'Clinic chair (body workspace)', kind:'locker' },
  ];
  return { w,h,solid,zone,doors:[],props,interacts,spawns:[],checkpoints:[],sensors:{x0:0,y0:0,x1:0,y1:0}, spawn:{x:20.5,y:16.5}, zoneNames:ZONES, bossSpawn:{x:0,y:0}, revealX:0, salvage:{x:0,y:0}, kind:'town', decor, npcs, lights, hide, overhead };
}
