// Dungeon registry: the Reclamation Annex plus three manufacturer-themed dungeons (data + procedural layouts).
// Layouts reuse the Annex structure (entry -> gate -> hall -> lock -> control -> boss door -> boss) so the proven run logic
// (guard-gate, elite-or-hack lock, objective controller, boss reveal, checkpoints, daily lockout) applies unchanged.
// Zone SLOT names (yard/proc/junction/boss/salvage/passage) are reused so existing renderer palettes/textures apply;
// each dungeon's concept-sheet names live in zoneLabels. ART NEEDED: per-dungeon floor/wall textures per the concept sheets
// in public/dungeons/source (foundry.jpg, clinic.jpg, warehouse.jpg).
import { ZONES, buildAnnex } from '../level';
import type { Level, Zone, Interact, Prop, DoorDef, SpawnDef } from '../level';
import type { LootEntry, ChipId, Mfr } from '../config';

export type Cap='hack'|'force'|'cloak'|'defib';
export interface CondDef { id:'A'|'B'; boss:string; cap:Cap; at:{x:number;y:number}; kind:Interact['kind']; label:string; title:string; body:string; confirm:string; denied:string; toast:string; arc:string; clueSource:'terminal'|'armory_marking'|'announcement'; clue:string; }
export interface Hazard { x:number; y:number; r:number; dps:number; heat:number; label:string; }
export interface DungeonDef {
  id:string; name:string; short:string; mfr:Mfr; district:string; fixer:string; blurb:string;
  minLevel:number; maxLevel:number; tierCap:number; estMinutes:[number,number];
  build:()=>Level; zoneLabels:Record<string,string>;
  defaultBoss:string; conds:CondDef[]; gateGuard:string; lockElite:string; alarmType:string;
  relayLabel:string; objectiveLabel:string; objectiveToast:string; cache:{ label:string; chips:ChipId[] };
  hazards:Hazard[]; loot?:{ ordinary:LootEntry[]; elite:LootEntry[]; boss:LootEntry[] }; signature:Record<string,{item:string;chance:number}>|null;
  creditMul:number; clearXp:number; intro:string; generalClue:string; needsArt:string[];
}

// ---------------- layout helper ----------------
function rng(seed:number){ let a=seed>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
class B {
  solid:Uint8Array; zone:Uint8Array; props:Prop[]=[]; spawns:SpawnDef[]=[]; interacts:Interact[]=[]; doors:DoorDef[]=[]; g=0; r:()=>number;
  constructor(public w:number,public h:number,seed:number){ this.solid=new Uint8Array(w*h).fill(1); this.zone=new Uint8Array(w*h); this.r=rng(seed); }
  carve(x0:number,y0:number,x1:number,y1:number,z:Zone){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){ this.solid[y*this.w+x]=0; this.zone[y*this.w+x]=ZONES.indexOf(z); } }
  block(x:number,y:number,kind:Prop['kind'],hh=1,wd=1,dp=1){ for(let j=0;j<dp;j++)for(let i=0;i<wd;i++){ this.solid[(y+j)*this.w+x+i]=1; this.props.push({x:x+i,y:y+j,kind,h:hh}); } }
  door(id:string,label:string,tiles:[number,number][]){ this.doors.push({id,label,tiles}); for(const [x,y] of tiles){ this.solid[y*this.w+x]=1; } }
  at(x:number,y:number,type:string,group:number){ this.spawns.push({type,x,y,group}); }
  /** deterministic scatter of n spawns on free tiles inside rect, keeping spacing and avoiding the start. */
  scatter(rect:[number,number,number,number],n:number,type:string,keepOut:[number,number][]=[]){ this.g++; const [x0,y0,x1,y1]=rect; let placed=0, tries=0; while(placed<n&&tries<400){ tries++; const x=x0+Math.floor(this.r()*(x1-x0+1)), y=y0+Math.floor(this.r()*(y1-y0+1)); if(this.solid[y*this.w+x]) continue; if(this.spawns.some(s=>Math.hypot(s.x-x,s.y-y)<1.6)) continue; if(keepOut.some(([kx,ky])=>Math.hypot(kx-x,ky-y)<5)) continue; this.spawns.push({type,x,y,group:this.g}); placed++; } return this.g; }
  finish(o:{spawn:{x:number;y:number};cps:{id:number;x:number;y:number;label:string}[];bossSpawn:{x:number;y:number};revealX:number;salvage:{x:number;y:number};sensors?:{x0:number;y0:number;x1:number;y1:number}}):Level {
    return { w:this.w,h:this.h,solid:this.solid,zone:this.zone,doors:this.doors,props:this.props,interacts:this.interacts,spawns:this.spawns,checkpoints:o.cps,
      sensors:o.sensors||{x0:0,y0:0,x1:0,y1:0}, spawn:o.spawn, zoneNames:ZONES, bossSpawn:o.bossSpawn, revealX:o.revealX, salvage:o.salvage };
  }
}
const ring=(cx:number,cy:number,rad:number,n:number,h:Omit<Hazard,'x'|'y'>,skip:number[]=[]):Hazard[]=>Array.from({length:n},(_,i)=>i).filter(i=>!skip.includes(i)).map(i=>({ x:cx+Math.cos(i/n*Math.PI*2)*rad, y:cy+Math.sin(i/n*Math.PI*2)*rad, ...h }));
const line=(x0:number,y0:number,x1:number,y1:number,step:number,h:Omit<Hazard,'x'|'y'>):Hazard[]=>{ const n=Math.max(1,Math.round(Math.hypot(x1-x0,y1-y0)/step)); return Array.from({length:n+1},(_,i)=>({ x:x0+(x1-x0)*i/n, y:y0+(y1-y0)*i/n, ...h })); };

// ================= Heavy industrial: Harrow-Brandt Foundry Line 7 =================
const FOUNDRY_HAZ:Hazard[]=[
  ...line(5.5,16.5,13.5,16.5,1.6,{r:1.1,dps:8,heat:10,label:'Slag trough'}), ...line(11.5,25.5,21.5,25.5,1.6,{r:1.1,dps:8,heat:10,label:'Slag trough'}),
  {x:38.5,y:20.5,r:1.3,dps:9,heat:12,label:'Press plate'},{x:44.5,y:20.5,r:1.3,dps:9,heat:12,label:'Press plate'},
  ...ring(82.5,20.5,4.4,8,{r:1.4,dps:9,heat:14,label:'Furnace heat'}),
];
function buildFoundry():Level {
  const b=new B(96,48,7101);
  b.carve(2,12,25,29,'yard'); b.carve(26,19,27,21,'corridor'); b.carve(28,8,53,32,'proc'); b.carve(54,19,55,21,'corridor');
  b.carve(56,10,70,29,'junction'); b.carve(71,19,72,21,'corridor'); b.carve(73,8,93,32,'boss');
  b.carve(12,30,13,33,'corridor'); b.carve(6,34,24,45,'salvage'); b.carve(60,5,66,9,'passage'); b.carve(60,30,66,34,'passage');
  // slag yard: troughs (hazards), gantries, crates
  [[9,13],[10,13],[18,19],[19,19],[16,21],[6,22],[7,22],[20,13],[4,26],[22,22]].forEach(([x,y])=>b.block(x,y,'crate',1));
  b.block(3,13,'rack',1.8,1,3); b.block(16,13,'machine',1.6,2,1); b.block(14,27,'machine',1.6,2,1);
  // casting hall: conveyors, ladle cranes, presses
  b.block(30,12,'conveyor',.7,10,1); b.block(30,28,'conveyor',.7,10,1); b.block(47,12,'conveyor',.7,1,5); b.block(47,24,'conveyor',.7,1,5);
  b.block(33,15,'machine',2,3,3); b.block(40,24,'machine',2,3,3); b.block(30,9,'rack',1.8,4,1); b.block(46,9,'rack',1.8,4,1); b.block(34,29,'crate',1,2,1); b.block(51,16,'crate',1,1,2); b.block(51,24,'crate',1,1,2);
  // control gantry
  b.block(58,12,'rack',1.8,1,4); b.block(58,23,'rack',1.8,1,4); b.block(64,13,'machine',1.6,2,2); b.block(64,24,'machine',1.6,2,2); b.block(68,12,'rack',1.8,1,3);
  // furnace ring (boss): central ring + pillars
  b.block(80,18,'machine',2.4,5,5); [[75,10],[75,30],[88,10],[88,30],[91,20],[85,13],[85,27]].forEach(([x,y])=>b.block(x,y,'pillar',2.2));
  b.block(8,37,'rack',1.4,4,1); b.block(15,40,'crate',1,2,1); b.block(10,43,'crate',1);
  b.door('gate1','Slag gate',[[26,19],[26,20],[26,21]]); b.door('lock2','Press lock',[[54,19],[54,20],[54,21]]); b.door('boss','Furnace ring door',[[71,19],[71,20],[71,21]]);
  b.at(24,14,'slagcannon',90); b.at(24,27,'slagcannon',91);
  b.scatter([3,12,23,29],8,'slaghauler',[[4,20]]); b.scatter([6,12,23,29],3,'ladlecrew',[[4,20]]); b.scatter([6,12,23,29],3,'cinderhound',[[4,20]]);
  b.scatter([29,9,52,31],8,'slaghauler'); b.scatter([29,9,52,31],5,'ladlecrew'); b.scatter([29,9,52,31],4,'cinderhound'); b.at(49,20,'brakeman',50);
  b.scatter([57,11,69,28],4,'ladlecrew'); b.scatter([57,11,69,28],4,'slaghauler'); b.at(66,20,'quenchpriest',55);
  b.scatter([7,35,23,44],5,'slaghauler'); b.scatter([7,35,23,44],2,'cinderhound'); b.at(18,38,'sawhand',60);
  b.interacts.push(
    { id:'hackproc', x:52.5, y:21.5, r:1.6, label:'Press-line relay (hack: reroute locks)', kind:'hack' },
    { id:'controller', x:68.5, y:19.5, r:1.6, label:'Pour controller (objective)', kind:'controller' },
    { id:'cond_A', x:63.5, y:32.5, r:1.6, label:'Casting-line interlock lever (force)', kind:'armory' },
    { id:'cond_B', x:63.5, y:6.5, r:1.6, label:'Pour-schedule console (hack)', kind:'terminal' },
    { id:'cratechip', x:20.5, y:43.5, r:1.5, label:'Tool-crib chip cache (bonus)', kind:'crate' });
  return b.finish({ spawn:{x:4.5,y:20.5}, cps:[{id:1,x:4.5,y:20.5,label:'Slag yard dock'},{id:2,x:58.5,y:20.5,label:'Control gantry'}], bossSpawn:{x:77.5,y:20.5}, revealX:75, salvage:{x:14,y:40} });
}

// ================= Precision surgical: Aldane Ward 9 Clinic =================
const CLINIC_HAZ:Hazard[]=[
  {x:12.5,y:12.5,r:1.6,dps:5,heat:14,label:'Spilled fluids'},{x:19.5,y:7.5,r:1.4,dps:5,heat:14,label:'Spilled fluids'},{x:30.5,y:36.5,r:1.6,dps:5,heat:14,label:'Spilled fluids'},{x:55.5,y:28.5,r:1.4,dps:5,heat:14,label:'Spilled coolant'},
  {x:79.5,y:26.0,r:1.5,dps:11,heat:12,label:'Saw rig'},{x:79.5,y:39.0,r:1.5,dps:11,heat:12,label:'Saw rig'},{x:73.0,y:32.5,r:1.5,dps:11,heat:12,label:'Saw rig'},{x:86.0,y:32.5,r:1.5,dps:11,heat:12,label:'Saw rig'},
];
function buildClinic():Level {
  const b=new B(92,52,7202);
  b.carve(2,3,24,20,'yard'); b.carve(12,21,14,23,'corridor'); b.carve(4,24,40,40,'proc'); b.carve(41,31,43,33,'corridor');
  b.carve(44,24,64,42,'junction'); b.carve(65,32,67,34,'corridor'); b.carve(68,18,90,48,'boss');
  b.carve(25,11,44,12,'passage'); b.carve(43,13,44,23,'passage'); b.carve(54,43,55,43,'corridor'); b.carve(46,44,62,50,'salvage');
  // reception & intake: gurneys, queue rails
  [[7,6],[8,6],[17,5],[18,5],[9,15],[10,15],[20,15],[21,15]].forEach(([x,y])=>b.block(x,y,'crate',.9));
  b.block(5,9,'rack',1.1,8,1); b.block(15,10,'rack',1.1,1,4); b.block(3,17,'machine',1.4,2,1);
  // theatre bays: partitions, surgical rigs
  b.block(14,27,'rack',1.7,1,6); b.block(26,27,'rack',1.7,1,6); b.block(8,33,'machine',1.8,3,2); b.block(18,35,'machine',1.8,3,2); b.block(30,26,'machine',1.8,3,2); b.block(33,35,'rack',1.6,4,1); b.block(22,25,'crate',1);
  // fabrication lab: consoles, cable trunks
  b.block(48,27,'machine',1.8,3,3); b.block(56,36,'machine',1.8,3,2); b.block(58,27,'rack',1.6,1,3); b.block(50,38,'rack',1.6,4,1);
  // amphitheatre: central dais, tiers
  b.block(77,30,'machine',2.0,5,5); [[70,20],[70,46],[88,20],[88,46],[72,27],[72,38],[86,27],[86,38]].forEach(([x,y])=>b.block(x,y,'pillar',2.0));
  b.block(48,46,'rack',1.4,3,1); b.block(58,46,'crate',1);
  b.door('gate1','Intake gate',[[12,21],[13,21],[14,21]]); b.door('lock2','Theatre lock',[[41,31],[41,32],[41,33]]); b.door('boss','Amphitheatre door',[[65,32],[65,33],[65,34]]);
  b.at(22,5,'sentry',90); b.at(22,18,'sentry',91);
  b.scatter([3,4,23,19],7,'orderly',[[4,5]]); b.scatter([3,4,23,19],3,'nursebot',[[4,5]]); b.scatter([3,4,23,19],2,'gurneyrunner',[[4,5]]);
  b.scatter([5,25,39,39],8,'orderly'); b.scatter([5,25,39,39],4,'nursebot'); b.scatter([5,25,39,39],3,'gurneyrunner'); b.at(37,33,'matron',50);
  b.scatter([45,25,63,41],5,'nursebot'); b.scatter([45,25,63,41],5,'orderly'); b.at(60,30,'anesthetist',55);
  b.scatter([47,45,61,49],5,'orderly'); b.scatter([47,45,61,49],2,'gurneyrunner');
  b.interacts.push(
    { id:'hackproc', x:38.5, y:36.5, r:1.6, label:'Theatre door relay (hack: reroute locks)', kind:'hack' },
    { id:'controller', x:60.5, y:34.5, r:1.6, label:'Implant fabricator core (objective)', kind:'controller' },
    { id:'cond_A', x:21.5, y:29.5, r:1.6, label:'Theatre scheduling terminal (hack)', kind:'terminal' },
    { id:'cond_B', x:36.5, y:11.5, r:1.6, label:'Quarantine ward seal (cloak weave)', kind:'armory' },
    { id:'cratechip', x:60.5, y:48.5, r:1.5, label:'Pharmacy chip cache (bonus)', kind:'crate' });
  return b.finish({ spawn:{x:4.5,y:5.5}, cps:[{id:1,x:4.5,y:6.5,label:'Reception'},{id:2,x:47.5,y:33.5,label:'Fabrication lab'}], bossSpawn:{x:73.5,y:33.5}, revealX:70, salvage:{x:54,y:47}, sensors:{x0:28,y0:10,x1:40,y1:13} });
}

// ================= Economical mass market: Kestrel Distribution Hub 9 =================
const WAREHOUSE_HAZ:Hazard[]=[
  {x:12.5,y:20.5,r:1.3,dps:6,heat:8,label:'Pallet-jack lane'},{x:7.5,y:25.5,r:1.2,dps:6,heat:8,label:'Pallet-jack lane'},
  {x:39.5,y:17.5,r:1.4,dps:8,heat:6,label:'Collapsed shelving'},{x:45.5,y:26.5,r:1.4,dps:8,heat:6,label:'Collapsed shelving'},
  {x:62.5,y:20.5,r:1.4,dps:12,heat:10,label:'Stamping press'},
  {x:79.5,y:12.5,r:1.8,dps:12,heat:8,label:'Gantry crane'},{x:79.5,y:28.5,r:1.8,dps:12,heat:8,label:'Gantry crane'},
];
function buildWarehouse():Level {
  const b=new B(88,46,7303);
  b.carve(2,10,22,30,'yard'); b.carve(23,19,24,21,'corridor'); b.carve(25,6,52,34,'proc'); b.carve(53,19,54,21,'corridor');
  b.carve(55,8,70,32,'junction'); b.carve(71,19,72,21,'corridor'); b.carve(73,6,86,36,'boss');
  b.carve(10,31,11,33,'corridor'); b.carve(4,34,20,43,'salvage'); b.carve(56,33,68,37,'passage');
  // loading dock
  [[8,12],[9,12],[16,14],[17,14],[6,24],[7,24],[15,26],[16,26],[19,20]].forEach(([x,y])=>b.block(x,y,'crate',1)); b.block(10,17,'machine',1.4,2,2); b.block(4,12,'rack',1.6,1,3);
  // storage aisles: tall racks with gaps
  for(const [y,segs] of [[11,[[27,34],[38,48]]],[[15],[[29,36],[40,50]]],[[24],[[27,33],[37,47]]],[[28],[[29,38],[42,51]]]] as any){ for(const s of segs) b.block(s[0],y,'rack',2.2,s[1]-s[0]+1,2); }
  b.block(27,7,'rack',2.2,6,1); b.block(44,7,'rack',2.2,7,1); b.block(27,32,'rack',2.2,8,1);
  // sorting line: conveyors + presses
  b.block(58,12,'conveyor',.7,10,1); b.block(58,27,'conveyor',.7,10,1); b.block(62,15,'machine',1.8,2,2); b.block(62,24,'machine',1.8,2,2); b.block(68,13,'conveyor',.7,1,6); b.block(57,17,'crate',1,1,1);
  // retrieval hall: gantry legs
  [[76,10],[76,32],[83,10],[83,32],[76,21],[83,21]].forEach(([x,y])=>b.block(x,y,'pillar',2.4)); b.block(79,18,'crate',1,3,1); b.block(79,23,'crate',1,3,1);
  b.block(8,37,'rack',1.4,3,1); b.block(14,40,'crate',1,2,1);
  b.door('gate1','Dock shutter',[[23,19],[23,20],[23,21]]); b.door('lock2','Sorting shutter',[[53,19],[53,20],[53,21]]); b.door('boss','Retrieval hall door',[[71,19],[71,20],[71,21]]);
  b.at(21,12,'camgun',90); b.at(21,28,'camgun',91);
  b.scatter([3,11,21,29],8,'picker',[[4,20]]); b.scatter([3,11,21,29],3,'scanner',[[4,20]]); b.scatter([3,11,21,29],2,'loader',[[4,20]]);
  b.scatter([26,8,51,33],9,'picker'); b.scatter([26,8,51,33],4,'scanner'); b.scatter([26,8,51,33],3,'loader'); b.scatter([26,8,51,33],3,'forkbot'); b.at(49,20,'shiftlead',50);
  b.scatter([56,9,69,31],5,'scanner'); b.scatter([56,9,69,31],5,'picker'); b.scatter([56,9,69,31],2,'forkbot'); b.at(66,24,'hobbs',55);
  b.scatter([5,35,19,42],5,'picker'); b.scatter([5,35,19,42],2,'loader');
  b.interacts.push(
    { id:'hackproc', x:50.5, y:20.5, r:1.6, label:'Shutter relay (hack: reroute locks)', kind:'hack' },
    { id:'controller', x:68.5, y:30.5, r:1.6, label:'Master sort controller (objective)', kind:'controller' },
    { id:'cond_A', x:60.5, y:10.5, r:1.6, label:'Order-queue console (hack)', kind:'terminal' },
    { id:'cond_B', x:62.5, y:36.5, r:1.6, label:'Dormant returns cradle (defib rack)', kind:'armory' },
    { id:'cratechip', x:18.5, y:41.5, r:1.5, label:'Returns-cage chip cache (bonus)', kind:'crate' });
  return b.finish({ spawn:{x:4.5,y:20.5}, cps:[{id:1,x:4.5,y:20.5,label:'Loading dock'},{id:2,x:57.5,y:20.5,label:'Sorting line'}], bossSpawn:{x:80.5,y:20.5}, revealX:75, salvage:{x:12,y:39} });
}

// ---------------- loot pools (replace the global pools in these dungeons) ----------------
const L=(...a:LootEntry[])=>a;
const FOUNDRY_LOOT={ ordinary:L({item:'hi_slag_apron',w:3},{item:'hi_slag_face',w:3},{item:'hi_anvil_foot',w:1.5},{item:'hi_ladle_hand',w:1},{item:'hi_gantry_leg_l',w:.25},{item:'hi_gantry_leg_r',w:.25},{chip:'ablative',w:5},{chip:'coolant',w:4},{chip:'plating',w:4},{chip:'power',w:3},{chip:'sustain',w:3},{stim:true,w:7}),
  elite:L({item:'hi_crucible_torso',w:2},{item:'hi_press_arm',w:2},{item:'hi_ladle_hand',w:2},{item:'hi_anvil_foot',w:2},{item:'hi_gantry_leg_l',w:.8},{item:'hi_gantry_leg_r',w:.8},{chip:'quench',w:3},{chip:'overdrive',w:.6},{chip:'ablative',w:3},{stim:true,w:3}),
  boss:L({item:'hi_crucible_torso',w:3},{item:'hi_press_arm',w:3},{item:'hi_gantry_leg_l',w:1.5},{item:'hi_gantry_leg_r',w:1.5},{chip:'quench',w:3},{chip:'overdrive',w:1.5},{chip:'fineedge',w:2},{stim:true,w:3}) };
const CLINIC_LOOT={ ordinary:L({item:'ps_sutured_torso',w:3},{item:'ps_sensor_foot',w:3},{item:'ps_anesthesia_face',w:1.5},{item:'ps_scalpel_hand_l2',w:1},{item:'ps_ceramic_leg_l',w:.25},{item:'ps_ceramic_leg_r',w:.25},{chip:'fineedge',w:3},{chip:'coolant',w:4},{chip:'cloakdur',w:3},{chip:'sustain',w:3},{chip:'gridlink',w:2},{stim:true,w:7}),
  elite:L({item:'ps_theatre_torso',w:2},{item:'ps_scalpel_hand_l2',w:2},{item:'ps_anesthesia_face',w:2},{item:'ps_fan_arm',w:.8},{item:'ps_ceramic_leg_l',w:.8},{item:'ps_ceramic_leg_r',w:.8},{item:'ps_nerve_brain',w:.6},{chip:'quench',w:3},{chip:'gridlink',w:3},{chip:'overdrive',w:.6},{stim:true,w:3}),
  boss:L({item:'ps_theatre_torso',w:3},{item:'ps_fan_arm',w:2},{item:'ps_ceramic_leg_l',w:1.5},{item:'ps_ceramic_leg_r',w:1.5},{item:'ps_nerve_brain',w:1.5},{chip:'fineedge',w:3},{chip:'overdrive',w:1.5},{chip:'gridlink',w:2},{stim:true,w:3}) };
const WAREHOUSE_LOOT={ ordinary:L({item:'mm_pallet_torso',w:6},{item:'mm_stocker_arm',w:4},{item:'mm_jack_leg_l',w:3},{item:'mm_jack_leg_r',w:3},{item:'mm_scanner_face',w:3},{item:'mm_clamp_hand',w:3},{item:'mm_nailgun',w:1.5},{chip:'ablative',w:4},{chip:'speed',w:4},{chip:'coolant',w:4},{chip:'magnet',w:4},{chip:'power',w:3},{stim:true,w:8}),
  elite:L({item:'mm_cutter_hand',w:2},{item:'mm_returns_torso',w:2},{item:'mm_barcode_brain',w:1.5},{item:'mm_nailgun',w:2},{chip:'gridlink',w:3},{chip:'fineedge',w:2},{chip:'ablative',w:3},{stim:true,w:3}),
  boss:L({item:'mm_returns_torso',w:3},{item:'mm_barcode_brain',w:3},{item:'mm_cutter_hand',w:3},{chip:'fineedge',w:2},{chip:'quench',w:2},{chip:'gridlink',w:2},{stim:true,w:3}) };

// ---------------- registry ----------------
const annexConds:CondDef[]=[]; // Annex keeps its legacy terminal/armory handling in sim.ts (ids 'terminal' and 'armoryfuse').
export const DUNGEONS:Record<string,DungeonDef> = {
  annex:{ id:'annex', name:'Reclamation Annex', short:'Annex', mfr:'HI', district:'Harrow Reach', fixer:'odalys_vane', blurb:'A Harrow-Brandt salvage annex staffed by Kestrel contractors. Steal the integration controller; the first confirmed condition (audit terminal or sealed armory) picks the boss.',
    minLevel:10, maxLevel:20, tierCap:20, estMinutes:[6,10], build:buildAnnex, zoneLabels:{yard:'Annex yard',proc:'Processing floor',junction:'Control junction',boss:'Boss chamber',salvage:'Salvage room',passage:'Maintenance passage'},
    defaultBoss:'overseer', conds:annexConds, gateGuard:'turret', lockElite:'sawhand', alarmType:'worker', relayLabel:'Security relay', objectiveLabel:'Integration controller', objectiveToast:'Integration controller secured. Boss chamber door open.',
    cache:{label:'Chip cache',chips:['cutwide','ctrldur']}, hazards:[], signature:null, creditMul:1, clearXp:250, intro:'Reclamation Annex: steal the controller, defeat the boss.', generalClue:'Announcements on the Annex floor mention routine audits and reclaim sweeps.', needsArt:['Annex enemy sprites (workers, shooters, sawhand, foreman, bosses)'] },
  foundry:{ id:'foundry', name:'Harrow-Brandt Foundry Line 7', short:'Foundry', mfr:'HI', district:'Harrow Reach', fixer:'ten_hallowell', blurb:'Heavy industrial casting line. Slag troughs, press plates and a furnace-ring boss arena. Force hardware and hacking each bring a different boss to the ring.',
    minLevel:18, maxLevel:30, tierCap:30, estMinutes:[7,10], build:buildFoundry, zoneLabels:{yard:'Slag yard',proc:'Casting hall',junction:'Quench & press control gantry',boss:'Furnace ring',salvage:'Tool crib',passage:'Service alcove'},
    defaultBoss:'teague', gateGuard:'slagcannon', lockElite:'brakeman', alarmType:'slaghauler', relayLabel:'Press-line relay', objectiveLabel:'Pour controller', objectiveToast:'Pour controller secured. The furnace ring door grinds open.',
    cache:{label:'Tool-crib cache',chips:['ablative','quench']}, hazards:FOUNDRY_HAZ, loot:FOUNDRY_LOOT, creditMul:1.8, clearXp:520, intro:'Foundry Line 7: release the slag gate, seize the pour controller, face the ring.',
    conds:[
      { id:'A', boss:'brannoch', cap:'force', at:{x:63.5,y:32.5}, kind:'armory', label:'Casting-line interlock lever (force)', title:'Casting-line interlock', body:'A hydraulic interlock keeps the Ladle-Tyrant in cold storage. Shearing it off its latch calls Brannoch to the furnace ring: ram sweeps, charges and rings of slag with a single safe gap.', confirm:'Shear the interlock (Ladle-Tyrant Brannoch)', denied:'Interlock lever. Needs force hardware (e.g. a press or ripper arm).', toast:'Interlock sheared: Ladle-Tyrant Brannoch selected', arc:'foundry_unrest', clueSource:'armory_marking',
        clue:'Stencils on the cold-storage latch read BRANNOCH, HB RECLAIM LOT 7. Hallowell says only force hardware can shear the interlock clean.' },
      { id:'B', boss:'ore9', cap:'hack', at:{x:63.5,y:6.5}, kind:'terminal', label:'Pour-schedule console (hack)', title:'Pour-schedule console', body:'The console governs furnace pour order. Overwriting the schedule hands the ring to Governor ORE-9: ranged volleys, slag rings, and cinder drones.', confirm:'Overwrite the schedule (Governor ORE-9)', denied:'ACCESS DENIED. Requires hacking hardware.', toast:'Schedule overwritten: Governor ORE-9 selected', arc:'audit_pressure', clueSource:'terminal',
        clue:'Console logs show Aldane auditors flagged Line 7 for an unlicensed furnace governor. An audit command from a hacking brain could wake it.' },
    ], signature:{ brannoch:{item:'sig_anvil_arm',chance:.1}, ore9:{item:'sig_governor_core',chance:.1} },
    generalClue:'The shift horn at Line 7 has not stopped. Hallowell says the line is pouring for no one.', needsArt:['Foundry floor/wall textures per foundry.jpg (slag troughs, tread plate, gantry catwalks)','Enemy sprites: slaghauler, ladlecrew, cinderhound, slagcannon, brakeman, quenchpriest','Boss sprites/arena: teague, brannoch, ore9, furnace ring centerpiece','Slag/heat hazard rendering (currently generic grey-blue circle)','Signature orange animations: Anvil-Arm, Governor Core'] },
  clinic:{ id:'clinic', name:'Aldane Ward 9 Clinic', short:'Clinic', mfr:'PS', district:'Aldane Terrace', fixer:'noor_abiodun', blurb:'A quiet precision-surgical clinic. Spilled fluids, theatre bays, a fabrication lab and a saw-rigged amphitheatre. A cloak-weave passage skips the theatre lock; hacking and cloaking each choose a different boss.',
    minLevel:22, maxLevel:34, tierCap:34, estMinutes:[7,10], build:buildClinic, zoneLabels:{yard:'Reception & intake ward',proc:'Surgical theatre bays',junction:'Ceramic implant fabrication lab',boss:'Operating amphitheatre',salvage:'Recovery ward',passage:'Sterile corridor'},
    defaultBoss:'surgeon', gateGuard:'sentry', lockElite:'matron', alarmType:'orderly', relayLabel:'Theatre door relay', objectiveLabel:'Implant fabricator core', objectiveToast:'Fabricator core secured. The amphitheatre doors unseal.',
    cache:{label:'Pharmacy cache',chips:['fineedge','gridlink']}, hazards:CLINIC_HAZ, loot:CLINIC_LOOT, creditMul:2.2, clearXp:640, intro:'Ward 9: pass intake, cut through the theatre bays, take the fabricator core.',
    conds:[
      { id:'A', boss:'autosurgeon', cap:'hack', at:{x:21.5,y:29.5}, kind:'terminal', label:'Theatre scheduling terminal (hack)', title:'Theatre scheduling terminal', body:'Booking an emergency procedure wakes the GEMINI autosurgeon: saw lanes with a safe gap, scalpel fans and ranged pressure. It is a ranged boss, not a lockout for brain builds.', confirm:'Book the procedure (GEMINI Autosurgeon)', denied:'ACCESS DENIED. Requires hacking hardware.', toast:'Procedure booked: GEMINI Autosurgeon selected', arc:'ward_secrets', clueSource:'terminal',
        clue:'Theatre booking logs list a standing emergency slot for GEMINI, signed Aldane Surgical. Sen says a hacking brain can book it.' },
      { id:'B', boss:'recovered', cap:'cloak', at:{x:36.5,y:11.5}, kind:'armory', label:'Quarantine ward seal (cloak weave)', title:'Quarantine ward seal', body:'The seal only recognises sensor-dampened staff. Unsealing the recovery cell lets Patient Eleven out: fast, blinking melee with clear recovery openings.', confirm:'Unseal the cell (The Recovered)', denied:'Seal ignores you. Needs a sensor-dampening cloak weave.', toast:'Cell unsealed: The Recovered selected', arc:'ward_secrets', clueSource:'announcement',
        clue:'Intake announcements keep paging "Patient Eleven, please return to your bed". The sterile corridor seal only answers a cloak weave.' },
    ], signature:{ autosurgeon:{item:'sig_autosurgeon_rig',chance:.1}, recovered:{item:'sig_recovered_veil',chance:.1} },
    generalClue:'Ward 9 appears on no current Aldane roster. Costa has asked Rustline fixers not to ask why.', needsArt:['Clinic floor/wall textures per clinic.jpg (ivory tile, glass partitions, amphitheatre tiers)','Enemy sprites: orderly, nursebot, gurneyrunner, sentry, matron, anesthetist','Boss sprites/arena: surgeon, autosurgeon (ceiling rig), recovered, amphitheatre centerpiece','Saw-rig and fluid hazard rendering','Signature orange animations: GEMINI Rig, Recovered Veil'] },
  warehouse:{ id:'warehouse', name:'Kestrel Distribution Hub 9', short:'Warehouse', mfr:'MM', district:'Kestrel Row', fixer:'handler_cole', blurb:'An economical cyberware refurbishing warehouse. Loading dock, tall aisles, a sorting line and a retrieval hall guarded by a repurposed mech. A good first step beyond the Annex.',
    minLevel:8, maxLevel:18, tierCap:26, estMinutes:[5,8], build:buildWarehouse, zoneLabels:{yard:'Loading dock',proc:'Storage aisles',junction:'Sorting line',boss:'Retrieval hall',salvage:'Returns cage',passage:'Returns bay'},
    defaultBoss:'stockmgr', gateGuard:'camgun', lockElite:'shiftlead', alarmType:'picker', relayLabel:'Shutter relay', objectiveLabel:'Master sort controller', objectiveToast:'Sort controller secured. The retrieval hall door lifts.',
    cache:{label:'Returns-cage cache',chips:['ablative','gridlink']}, hazards:WAREHOUSE_HAZ, loot:WAREHOUSE_LOOT, creditMul:.8, clearXp:380, intro:'Hub 9: clear the dock, work the aisles, claim the sort controller.',
    conds:[
      { id:'A', boss:'retrieval', cap:'hack', at:{x:60.5,y:10.5}, kind:'terminal', label:'Order-queue console (hack)', title:'Order-queue console', body:'Processing Return Order #0 dispatches Retrieval Unit R-0, the repurposed mech: ring sweeps, gantry chains and crate drops. Plenty of recovery between sweeps.', confirm:'Process Return Order #0 (Retrieval Unit R-0)', denied:'ACCESS DENIED. Requires hacking hardware.', toast:'Return Order #0 processed: Retrieval Unit R-0 selected', arc:'stock_shrinkage', clueSource:'terminal',
        clue:'The order queue holds one entry Kestrel cannot close: RETURN ORDER 0, item "unit, refurbished". Cole wants it closed.' },
      { id:'B', boss:'reclaimer', cap:'defib', at:{x:62.5,y:36.5}, kind:'armory', label:'Dormant returns cradle (defib rack)', title:'Dormant returns cradle', body:'The cradle holds a dead refurbishment. Jump-starting it with a defib rack brings back LAZARUS-LITE: slams, charges, crate drops and fork-bot summons.', confirm:'Jump-start the cradle (Returns Reclaimer)', denied:'Cradle is dead. A defib rack could jump-start it.', toast:'Cradle jump-started: Returns Reclaimer selected', arc:'stock_shrinkage', clueSource:'armory_marking',
        clue:'A tag on the cradle reads LAZARUS-LITE, RETURNED x3, RESOLD x3. Okafor says the power cell is still warm.' },
    ], signature:{ retrieval:{item:'sig_r0_lifter',chance:.1}, reclaimer:{item:'sig_lazarus_rack',chance:.08} },
    generalClue:'Shrinkage at Hub 9 is up again. Cole says the numbers do not add up in either direction.', needsArt:['Warehouse floor/wall textures per warehouse.jpg (loading dock decals, shelving, stamped plate)','Enemy sprites: picker, loader, forkbot, scanner, camgun, shiftlead, hobbs','Boss sprites: stockmgr, retrieval (large mech per sheet), reclaimer','Gantry-crane/stamping-press hazard rendering','Signature orange animations: Lazarus Rack, R-0 Lifter'] },
};
export const DUNGEON_LIST:DungeonDef[]=['warehouse','annex','foundry','clinic'].map(k=>DUNGEONS[k]);
export const DUNGEON_IDS=DUNGEON_LIST.map(d=>d.id);
export const dungeonOf=(id?:string|null):DungeonDef=>DUNGEONS[id||'annex']||DUNGEONS.annex;
/** Level-appropriate band used by the dungeon select filter. Low-level players may still enter (carry/party); they just get fewer eligible drops. */
export const inBand=(d:DungeonDef,level:number)=>level>=d.minLevel&&level<=d.maxLevel;
/** BFS over walkable tiles with all doors open (test helper + sanity check). */
export function reachable(lv:Level,from:{x:number;y:number},to:{x:number;y:number}):boolean{
  const s=new Uint8Array(lv.solid); for(const d of lv.doors) for(const [x,y] of d.tiles) s[y*lv.w+x]=0;
  const q=[Math.floor(from.y)*lv.w+Math.floor(from.x)], seen=new Uint8Array(s.length); seen[q[0]]=1; const t=Math.floor(to.y)*lv.w+Math.floor(to.x);
  while(q.length){ const c=q.pop()!; if(c===t) return true; const cx=c%lv.w, cy=(c/lv.w)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=cx+dx,ny=cy+dy; if(nx<0||ny<0||nx>=lv.w||ny>=lv.h) continue; const i=ny*lv.w+nx; if(seen[i]||s[i]) continue; seen[i]=1; q.push(i); } }
  return false;
}
