// Handcrafted-room assembly for the Reclamation Annex. Every layout keeps a combat route to objective and boss.
export type Zone = 'yard'|'proc'|'junction'|'boss'|'salvage'|'corridor'|'passage'|'town';
export interface DoorDef { id:string; tiles:[number,number][]; label:string; }
export interface Prop { x:number; y:number; kind:'crate'|'conveyor'|'machine'|'pillar'|'rack'; h:number; }
export interface Interact { id:string; x:number; y:number; r:number; label:string; kind:'terminal'|'hack'|'armory'|'controller'|'door'|'npc'|'locker'|'gate'|'vendor'|'crate'; }
export interface SpawnDef { type:string; x:number; y:number; group:number; }
export interface Level { w:number; h:number; solid:Uint8Array; zone:Uint8Array; doors:DoorDef[]; props:Prop[]; interacts:Interact[]; spawns:SpawnDef[]; checkpoints:{id:number;x:number;y:number;label:string}[]; sensors:{x0:number;y0:number;x1:number;y1:number}; spawn:{x:number;y:number}; zoneNames:Zone[]; bossSpawn:{x:number;y:number}; revealX:number; salvage:{x:number;y:number}; }
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
  // Interactables
  interacts.push(
    { id:'hackproc', x:46, y:19, r:1.6, label:'Security relay (hack: reroute locks)', kind:'hack' },
    { id:'terminal', x:56, y:11, r:1.6, label:'Annex security terminal', kind:'terminal' },
    { id:'controller', x:58, y:19, r:1.6, label:'Integration controller (objective)', kind:'controller' },
    { id:'armoryfuse', x:60, y:31, r:1.6, label:'Sealed armory: command fuse', kind:'armory' },
    { id:'armorydoor', x:59.5, y:27, r:1.8, label:'Armory shutter', kind:'door' },
    { id:'cratechip', x:8, y:41, r:1.5, label:'Chip cache (bonus)', kind:'crate' },
  );
  return { w,h,solid,zone,doors,props,interacts,spawns,
    checkpoints:[{id:1,x:4,y:19.5,label:'Entry'},{id:2,x:52,y:19.5,label:'Control junction'}],
    sensors:{x0:40,y0:3,x1:52,y1:5}, spawn:{x:4.5,y:19.5}, zoneNames:ZONES, bossSpawn:{x:75.5,y:19.5}, revealX:67, salvage:{x:12,y:37} };
}

export function buildTown():Level {
  const w=30,h=22; const solid=new Uint8Array(w*h).fill(1); const zone=new Uint8Array(w*h).fill(ZONES.indexOf('town'));
  for(let y=3;y<=18;y++)for(let x=3;x<=26;x++) solid[y*w+x]=0;
  const props:Prop[]=[]; const block=(x:number,y:number,kind:Prop['kind'],hh:number,wd=1,dp=1)=>{ for(let j=0;j<dp;j++)for(let i=0;i<wd;i++){ solid[(y+j)*w+x+i]=1; props.push({x:x+i,y:y+j,kind,h:hh}); } };
  block(6,5,'rack',1.6,3,1); block(20,5,'machine',1.6,3,1); block(12,10,'crate',1,2,1); block(18,13,'crate',1,1,2); block(7,14,'conveyor',.7,4,1);
  const interacts:Interact[]=[
    { id:'locker', x:5.5, y:8, r:2.2, label:'Body workspace & locker', kind:'locker' },
    { id:'vendor', x:24, y:8, r:2.2, label:'Vendor & repair', kind:'vendor' },
    { id:'fixer', x:15, y:5, r:2.2, label:'Fixer: Odalys Vane', kind:'npc' },
    { id:'annex', x:24, y:15, r:2.2, label:'Reclamation Annex gate', kind:'gate' },
    { id:'store', x:5.5, y:15, r:2.2, label:'Outfitter (simulated purchases)', kind:'terminal' },
  ];
  return { w,h,solid,zone,doors:[],props,interacts,spawns:[],checkpoints:[],sensors:{x0:0,y0:0,x1:0,y1:0}, spawn:{x:14,y:12}, zoneNames:ZONES, bossSpawn:{x:0,y:0}, revealX:0, salvage:{x:0,y:0} };
}
