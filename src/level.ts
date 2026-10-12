// Handcrafted-room assembly for the Reclamation Annex. Every layout keeps a combat route to objective and boss.
import { RUSTLINE_STATIONS as STATIONS, type StationId, stationPrompt, TOWN_W, TOWN_H, TOWN_CX, TOWN_CY, SPAWN, RETURN_SPAWN } from './stations';
export type Zone = 'yard'|'proc'|'junction'|'boss'|'salvage'|'corridor'|'passage'|'town';
export interface DoorDef { id:string; tiles:[number,number][]; label:string; }
export interface Prop { x:number; y:number; kind:'crate'|'conveyor'|'machine'|'pillar'|'rack'; h:number; }
export interface Interact { id:string; x:number; y:number; r:number; label:string; kind:'terminal'|'hack'|'armory'|'controller'|'door'|'npc'|'locker'|'gate'|'vendor'|'crate'; /** town: screen to open when it differs from id */ opens?:string; /** town: owning station key */ station?:string; }
export interface SpawnDef { type:string; x:number; y:number; group:number; /** batch-2 elite affixes rolled by the level generator */ affix?:string[]; }
export interface Hazard { x:number; y:number; r:number; dps:number; heat:number; label:string; }
export interface Level { /** per-run hazards (seeded for generated dungeons) */ hazards?:Hazard[]; /** layout seed */ seed?:number; w:number; h:number; solid:Uint8Array; zone:Uint8Array; doors:DoorDef[]; props:Prop[]; interacts:Interact[]; spawns:SpawnDef[]; checkpoints:{id:number;x:number;y:number;label:string}[]; sensors:{x0:number;y0:number;x1:number;y1:number}; spawn:{x:number;y:number}; zoneNames:Zone[]; bossSpawn:{x:number;y:number}; revealX:number; /** archetype layouts: boss reveal fires within r of (x,y) instead of x>=revealX */ reveal?:{x:number;y:number;r:number}; salvage:{x:number;y:number};
  /** 'town' enables the illustrated hub renderer (src/town.ts); decor/npcs/lights are visual-only (collision comes from `solid`). */
  kind?:'town'|'annex'; returnSpawn?:{x:number;y:number}; /** dungeon visual theme ('foundry'|'clinic'|'warehouse'), see src/dungeon_env.ts */ theme?:string; decor?:Decor[]; npcs?:NpcDef[]; lights?:LightDef[]; hide?:Uint8Array; overhead?:Overhead[]; }
export interface Overhead { spr:string; x:number; y:number; z:number; sw:number; glow?:'lanterns'|'bulbs'; }
export interface Decor { spr:string; x:number; y:number; fw:number; fd:number; sw:number; ay?:number; solid?:boolean; flip?:boolean; glow?:string; steam?:boolean; station?:string; }
export interface NpcDef { spr:string; x:number; y:number; wander?:[number,number]; speed?:number; ph:number; h?:number; }
export interface LightDef { x:number; y:number; z:number; r:number; c:'warm'|'cool'|'fire'|StationId; a:number; flick?:number; }
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
  const w=TOWN_W,h=TOWN_H,CX=TOWN_CX,CY=TOWN_CY; const solid=new Uint8Array(w*h).fill(1); const zone=new Uint8Array(w*h).fill(ZONES.indexOf('town')); const hide=new Uint8Array(w*h);
  // organic plaza: ellipse with angular noise, so the boundary is not a rectangle. Districts sit on its rim, the open plaza is the hub.
  const RX=25, RY=18.5; const edge=(a:number)=>1+.085*Math.sin(a*3+1.3)+.06*Math.sin(a*5+.4)+.04*Math.sin(a*9+2);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const dx=(x+.5-CX)/RX, dy=(y+.5-CY)/RY; const n=edge(Math.atan2(dy,dx)); if(dx*dx+dy*dy<n*n) solid[y*w+x]=0; }
  const carve=(x0:number,y0:number,x1:number,y1:number)=>{ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) solid[y*w+x]=0; };
  carve(48,20,56,24);
  const decor:Decor[]=[]; const props:Prop[]=[];
  const D=(spr:string,x:number,y:number,fw:number,fd:number,sw:number,o:Partial<Decor>={})=>{ decor.push({spr,x,y,fw,fd,sw,solid:true,...o}); if(o.solid!==false) for(let j=0;j<fd;j++)for(let i=0;i<fw;i++){ solid[(y+j)*w+x+i]=1; hide[(y+j)*w+x+i]=1; } };
  const S=(k:string)=>STATIONS.find(s=>s.key===k)!;
  // ---- DISTRICT: JOB BOARD (NW, amber): job board wall + fixer booth + notice boards, big amber banner tower ----
  { const s=S('jobs'); D('board_jobs',s.lx,s.ly,2,2,3.6,{station:s.key,glow:'warm'}); D('fixer_booth',s.lx+4,s.ly-1,3,3,3.4,{station:s.key,glow:'warm'}); D('noticeboard',s.lx-2,s.ly+3,1,1,1.4,{station:s.key}); D('poster_wall',s.lx-1,s.ly-2,3,1,3.0,{station:s.key}); D('stall_a',s.lx-4,s.ly+1,3,3,4.1,{glow:'warm'}); D('banner_pole',s.lx+7,s.ly+3,1,1,1.7); D('barrel_fire',s.lx+6,s.ly+5,1,1,1.3,{glow:'fire'}); }
  // ---- DISTRICT: IMPLANT PARTS (NE, cyan): implant stall + clinic + vending, cool light ----
  { const s=S('implants'); D('stall_implant',s.lx,s.ly,3,3,4.4,{station:s.key,glow:'cool'}); D('stall_clinic',s.lx+5,s.ly+1,3,3,4.2,{station:s.key,glow:'cool'}); D('vending',s.lx-2,s.ly+2,1,1,1.25,{glow:'cool'}); D('stall_vendor_sign',s.lx+9,s.ly+5,3,3,3.4,{glow:'cool'}); D('steam_drums',s.lx-3,s.ly-1,2,2,2.5,{steam:true}); D('banner_pole',s.lx+4,s.ly+5,1,1,1.7); }
  // ---- DISTRICT: DUNGEON GATE (E, red): hazard-striped gate arch at the end of a corridor, guards, barriers ----
  { const s=S('gate'); D('gate_arch',s.lx,s.ly-1,3,1,4.6,{station:s.key,glow:'warm'}); D('barrier',s.lx-5,s.ly-3,3,1,3.0); D('barrier',s.lx-5,s.ly+4,3,1,3.0); D('barrels',s.lx+1,s.ly+3,2,2,2.4); D('barrier_corner',s.lx-9,s.ly-2,2,2,3.2); D('steam_drums',s.lx-9,s.ly+4,2,2,2.5,{steam:true}); }
  // ---- DISTRICT: REPAIR BAY (SE, violet): workbench + weapons rack + welding drums ----
  { const s=S('repair'); D('workbench',s.lx,s.ly,2,2,3.4,{station:s.key,glow:'warm'}); D('stall_weapons',s.lx+3,s.ly+1,3,3,3.9,{station:s.key,glow:'warm'}); D('steam_drums',s.lx-3,s.ly+1,2,2,2.5,{steam:true}); D('crates',s.lx+7,s.ly,2,2,2.6); D('gantry',s.lx-5,s.ly-1,2,2,2.3); D('lamp',s.lx+2,s.ly-2,1,1,1.0,{glow:'warm'}); }
  // ---- DISTRICT: LOCKER (S, green): lockers + stash containers + bench ----
  { const s=S('locker'); D('lockers',s.lx,s.ly,1,2,1.8,{station:s.key,glow:'cool'}); D('lockers',s.lx+1,s.ly,1,2,1.8,{station:s.key}); D('lockers',s.lx+2,s.ly,1,2,1.8,{station:s.key}); D('container',s.lx+4,s.ly+1,4,2,3.7); D('bench',s.lx-3,s.ly,2,1,2.0); D('crates',s.lx-6,s.ly+1,2,2,2.6); D('lamp',s.lx-1,s.ly-2,1,1,1.0,{glow:'cool'}); }
  // ---- DISTRICT: OUTFITTER (SW, magenta): clothes + goods stalls, neon ----
  { const s=S('store'); D('stall_clothes',s.lx,s.ly,3,3,3.5,{station:s.key,glow:'warm'}); D('stall_goods',s.lx+4,s.ly+2,3,3,4.1,{station:s.key,glow:'warm'}); D('stall_noodle',s.lx-4,s.ly-3,3,3,4.2,{glow:'warm'}); D('stall_junk',s.lx+5,s.ly-3,3,3,4.1,{glow:'warm'}); D('lamp',s.lx+3,s.ly-1,1,1,1.0,{glow:'warm'}); }
  // ---- DISTRICT: BANK (N, brass): riveted vault house, two guards' crates, lamps; interact pad on the plaza side ----
  { const s=S('bank'); D('bank_vault',s.lx,s.ly,4,3,5.4,{station:s.key,glow:'warm'}); D('crates',s.lx-3,s.ly+1,2,2,2.4); D('barrier',s.lx+5,s.ly+1,3,1,3.0); D('lamp',s.lx-1,s.ly+4,1,1,1.0,{glow:'warm'}); D('lamp',s.lx+4,s.ly+4,1,1,1.0,{glow:'warm'}); }
  // ---- TRANSIT (plaza centre, orange): Reach Line tram stop to the other towns ----
  { const s=S('transit'); D('tram_platform',s.lx,s.ly,4,2,5.6,{station:s.key,glow:'warm'}); D('lamp',s.lx-1,s.ly+3,1,1,1.0,{glow:'warm'}); D('lamp',s.lx+4,s.ly+3,1,1,1.0,{glow:'warm'}); }
  // big readable world-space signs (pole + neon panel with icon and label), one per station
  for(const s of STATIONS) D('sign_'+s.key,s.sx,s.sy,1,1,1.9,{station:s.key,ay:.93,glow:undefined});
  // ---- plaza hub furniture (kept low so spawn reads from afar): directory kiosk, benches, fire barrel ring ----
  D('bench',26,19,2,1,2.0); D('bench',33,25,2,1,2.0); D('bench',23,26,1,2,1.8); D('barrels',36,18,2,2,2.4); D('cables',27,25,1,1,1.5); D('scaffold',22,16,3,3,3.2,{solid:true}); D('steam_drums',37,25,2,2,2.5,{steam:true});
  for(const [lx,ly] of [[24,14],[36,14],[24,29],[36,29],[19,21],[41,22],[30,11],[30,32]]) D('lamp',lx,ly,1,1,1.0,{glow:'warm'});
  D('crates',6,22,2,2,2.6); D('crates',19,38,2,2,2.4); D('junk',50,32,2,1,2.8,{solid:false}); D('junk',8,12,2,1,2.8,{solid:false});
  // ---- perimeter: tenements (back), containers/slabs/barriers/gantries (sides & front) ----
  { let seed=7; const R=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
    const free=(x:number,y:number,fw:number,fd:number)=>{ if(x<0||y<0||x+fw>w||y+fd>h) return false; for(let j=0;j<fd;j++)for(let i=0;i<fw;i++){ const k=(y+j)*w+x+i; if(!solid[k]||hide[k]) return false; } return true; };
    for(let a=-Math.PI;a<Math.PI;a+=.06){ const r=1.5+R()*1.2; const cx=CX+(RX*edge(a)+r)*Math.cos(a), cy=CY+(RY*edge(a)+r)*Math.sin(a); const depth=cx+cy-(CX+CY)+35;
      const pool:[string,number,number,number][]= depth<30? [['bld1',3,3,3.0],['bld2',3,3,3.0],['bld3',3,3,3.0],['gantry',2,2,2.3]] : depth<39? [['container',4,2,3.7],['slab',2,2,2.6],['barrier',3,1,3.0],['bld1',3,3,2.7],['gantry',2,2,2.2],['barrier_corner',2,2,3.2]] : [['container',4,2,3.7],['slab',2,2,2.6],['barrier',3,1,3.0],['barrier_corner',2,2,3.2],['container',2,4,3.7]];
      const [spr,fw,fd,sw]=pool[(R()*pool.length)|0]; const x=Math.round(cx-fw/2), y=Math.round(cy-fd/2);
      for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) if(free(x+dx,y+dy,fw,fd)){ D(spr,x+dx,y+dy,fw,fd,sw); break; } }
  }
  const lights:LightDef[]=[];
  for(const d of decor){ if(!d.glow) continue; const cx=d.x+d.fw/2, cy=d.y+d.fd/2; if(d.glow==='warm') lights.push({x:cx,y:cy,z:d.spr==='lamp'?1.5:1.1,r:d.spr==='lamp'?5.4:4.2,c:'warm',a:d.spr==='lamp'?.42:.3,flick:d.spr==='lamp'?.04:.12}); else if(d.glow==='fire') lights.push({x:cx,y:cy,z:.6,r:5.2,c:'fire',a:.45,flick:.3}); else lights.push({x:cx,y:cy,z:1,r:3.4,c:'cool',a:.2,flick:.03}); }
  // coloured function lights: a wide pool on each station's interact pad (baked into the ground) + a flickering sign light
  for(const s of STATIONS){ lights.push({x:s.x,y:s.y,z:.2,r:7.5,c:s.key,a:.5,flick:s.ambient==='screens'||s.ambient==='neon'?.25:s.ambient==='beacon'?.35:.08}); lights.push({x:s.lx+1,y:s.ly+1,z:2.2,r:5,c:s.key,a:.35,flick:.1}); }
  lights.push({x:CX,y:CY,z:0,r:11,c:'cool',a:.07});
  // ---- overhead dressing (drawn above actors, fades when the player is underneath) ----
  const AW=['awn_red','awn_blue','awn_green','awn_grey'] as const; const overhead:Overhead[]=[];
  for(const s of STATIONS){ if(s.key==='bank') continue; overhead.push({spr:AW[STATIONS.indexOf(s)%4],x:s.lx+2,y:s.ly+3.3,z:2.2,sw:3.3}); }
  overhead.push({spr:'swag1',x:S('jobs').lx+4,y:S('jobs').ly+4,z:2.3,sw:3.0,glow:'lanterns'},{spr:'swag2',x:S('implants').lx+4,y:S('implants').ly+4,z:2.3,sw:3.0,glow:'lanterns'},{spr:'swag3',x:S('store').lx+4,y:S('store').ly+1,z:2.4,sw:3.0,glow:'lanterns'},{spr:'swag1',x:S('repair').lx+4,y:S('repair').ly+3,z:2.3,sw:2.8,glow:'lanterns'},
    {spr:'bulbs',x:CX,y:11,z:3.0,sw:7.5,glow:'bulbs'},{spr:'bulbs',x:CX,y:33,z:2.9,sw:7,glow:'bulbs'},{spr:'rags1',x:S('store').lx-2,y:S('store').ly-1,z:2.7,sw:3.4},{spr:'rags2',x:S('repair').lx+6,y:S('repair').ly+3,z:2.7,sw:3.4},{spr:'leanto',x:S('locker').lx+6,y:S('locker').ly+3.5,z:2.3,sw:3.6});
  const npcs:NpcDef[]=[
    // plaza life (wanderers keep to the hub so stations stay readable)
    {spr:'np_pair_talk',x:27,y:17,ph:0,h:1.45},{spr:'np_kid_l',x:33.5,y:22,ph:2.1,wander:[26,24],speed:.5,h:1.0},{spr:'np_kid_r',x:28,y:26,ph:3.4,wander:[36,21],speed:.45,h:1.0},
    {spr:'np_lantern_l',x:34,y:25,ph:5.2,wander:[28,18],speed:.28,h:1.35},{spr:'np_lantern_r',x:25,y:20,ph:2.7,wander:[34,14],speed:.25,h:1.35},{spr:'npc1',x:28.5,y:22,ph:0,h:1.25},{spr:'npc3',x:32,y:23.5,ph:1.3,h:1.25},
    // job board: Odalys Vane (npc2) + clients
    {spr:'npc2',x:S('jobs').x-.8,y:S('jobs').y-1.4,ph:.2,h:1.3},{spr:'np_kneel_l',x:S('jobs').x-3.5,y:S('jobs').y+.5,ph:.6,h:.95},{spr:'npc4',x:S('jobs').x+2.5,y:S('jobs').y+.5,ph:2.7,h:1.25},
    // implants: clinic staff
    {spr:'np_hooded_wall',x:S('implants').x+3,y:S('implants').y-.5,ph:1.8,h:1.55},{spr:'npc3',x:S('implants').x-2.5,y:S('implants').y+.6,ph:3.3,h:1.25},
    // gate: guards
    {spr:'np_guard_l',x:50,y:21,ph:1.3,h:1.35},{spr:'np_guard_r',x:50.5,y:24.2,ph:.4,h:1.35},
    // bank: two guards flank the vault steps
    {spr:'np_guard_l',x:S('bank').x-3.2,y:S('bank').y-1.6,ph:.9,h:1.35},{spr:'np_guard_r',x:S('bank').x+3.2,y:S('bank').y-1.6,ph:1.6,h:1.35},
    // repair, locker, store
    {spr:'np_porter',x:S('repair').x-3,y:S('repair').y-1,ph:.7,wander:[S('repair').x-3,S('repair').y-5],speed:.3,h:1.3},{spr:'np_kneel_r',x:S('repair').x+2.5,y:S('repair').y-.5,ph:4.1,h:.95},
    {spr:'npc1',x:S('locker').x+3.5,y:S('locker').y-.5,ph:4.4,h:1.25},{spr:'npc2',x:S('store').x+2.5,y:S('store').y-1,ph:4.9,wander:[S('store').x+2.5,S('store').y-4],speed:.25,h:1.25},{spr:'npc4',x:S('store').x-2,y:S('store').y-.5,ph:3.9,h:1.25},
  ];
  const interacts:Interact[]=STATIONS.map(s=>({ id:s.id, x:s.x, y:s.y, r:2.4, label:stationPrompt(s), kind:s.kind, opens:s.opens, station:s.key }));
  return { w,h,solid,zone,doors:[],props,interacts,spawns:[],checkpoints:[],sensors:{x0:0,y0:0,x1:0,y1:0}, spawn:{...SPAWN}, returnSpawn:{...RETURN_SPAWN}, zoneNames:ZONES, bossSpawn:{x:0,y:0}, revealX:0, salvage:{x:0,y:0}, kind:'town', decor, npcs, lights, hide, overhead };
}

/** Hazard budget per room/level: zones never overlap (centres >= (r1+r2)*SPACING apart) and a level has at most HAZARD_CAP of them. Thins long chains evenly instead of cutting one end. */
export const HAZARD_CAP=16, HAZARD_SPACING=1.0;
export function thinHazards<T extends {hazards?:Hazard[]}>(L:T):T{ const h=L.hazards; if(!h||!h.length) return L; const keep:Hazard[]=[];
  for(const z of h){ if(keep.every(k=>Math.hypot(k.x-z.x,k.y-z.y)>=(k.r+z.r)*HAZARD_SPACING)) keep.push(z); }
  if(keep.length>HAZARD_CAP){ const out:Hazard[]=[]; for(let i=0;i<HAZARD_CAP;i++) out.push(keep[Math.floor((i+.5)*keep.length/HAZARD_CAP)]); L.hazards=out; } else L.hazards=keep; return L; }
