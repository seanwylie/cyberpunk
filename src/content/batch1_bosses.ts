// CONTENT BATCH 1 (bosses): 20 new bosses defined as DATA (docs/CONTENT_BATCH_1.md). No sim code lives here: every boss is a combination of the
// reusable mechanics in src/content/mechanics.ts (moves + phase actions + an arena gimmick) on top of the existing melee attacks.
// PLACEHOLDER balance (like the rest of the prototype). Imported by config.ts (ENEMIES), music.ts (BOSS_MAP), enemyart.ts (ART) and dungeons.
export type Faction='Harrow-Brandt'|'Aldane Surgical'|'Kestrel Value'|'Rustline Compact'|'Quiet Shift'|'Recall Authority';
export type MoveKind='marks'|'ring'|'spokes'|'cross'|'lanes'|'spiral'|'rain'|'fan'|'nova'|'adds';
export interface MoveSpec { k:MoveKind; p?:Record<string,number|string>; /** overrides: windup, recovery, cooldown, dmg */ w?:number; rec?:number; cd?:number; dmg?:number; min?:number; max?:number }
export type PhaseAct =
  |{k:'shield';pct:number;dur:number}               // absorbs pct of max HP for up to dur s; breaking it staggers the boss (1.5x damage taken for 4 s)
  |{k:'pylons';type:string;n:number}                // n static nodes; boss takes 90% less damage while any live (tether). Killing all staggers.
  |{k:'enrage';spd:number;cd:number}                // speed multiplier, cooldown multiplier
  |{k:'adds';type:string;n:number}                  // one-off wave
  |{k:'gimmick';g:Gimmick};                         // switch on / replace the arena gimmick
export interface Phase { at:number; say:string; acts:PhaseAct[] }
export type Gimmick={k:'rain';every:number;n:number;r:number}|{k:'spokes';every:number;n:number;len:number}|{k:'pillarfire';every:number;n:number}|{k:'edge';every:number;n:number}|{k:'trickle';every:number;type:string;cap:number}|{k:'lanes';every:number;n:number};
export interface BossSpec {
  id:string; name:string; faction:Faction; mfr:'HI'|'PS'|'MM'; level:string; tier:1|2|3|4; lore:string;
  hp:number; speed:number; radius:number; melee:string[]; summon?:string; moves:MoveSpec[]; phases:Phase[]; gimmick?:Gimmick; arena:string; signature:string;
  /** world height in tiles, hover height */ h:number; hover?:number; track:string; xp:number;
}
const P=(at:number,say:string,...acts:PhaseAct[]):Phase=>({at,say,acts});
export const BOSSES:BossSpec[]=[
 { id:'voss', name:'Coke-Tender Marguerite Voss', faction:'Harrow-Brandt', mfr:'HI', level:'coke_ovens', tier:1, lore:'Last tender of the Basin coke batteries. Harrow-Brandt kept her on the books for forty years after the ovens were condemned; she keeps feeding them.',
   hp:2800, speed:2.6, radius:.9, melee:['slam','charge'], moves:[{k:'marks',p:{n:5,r:1.6,spread:3.6}},{k:'spokes',p:{n:7,len:8,sweep:150}}], phases:[P(.45,'The ovens remember the schedule.',{k:'enrage',spd:1.25,cd:.75},{k:'gimmick',g:{k:'rain',every:6,n:4,r:1.5}})], gimmick:{k:'rain',every:11,n:3,r:1.5},
   arena:'Coke battery floor: ember rain falls in the open.', signature:'Rotating coke-door beam sweep + ember rain', h:2.3, track:'elite_siege', xp:380 },
 { id:'lineman', name:'Lineman Tomasz Brandt', faction:'Harrow-Brandt', mfr:'HI', level:'substation_12', tier:1, lore:'A Brandt cousin who kept Substation 12 live through the strikes. Believes the grid is a promise.',
   hp:3000, speed:2.3, radius:.85, melee:['cleave'], moves:[{k:'nova',p:{n:16,speed:7.5,gap:50}},{k:'fan',p:{n:5,spread:50,speed:11}}], phases:[P(.7,'Phase to ground. Lines are live.',{k:'pylons',type:'camgun',n:3})], gimmick:{k:'pillarfire',every:9,n:8},
   arena:'Pylon tether: three relay nodes shield him; pillars shield you from the arc nova.', signature:'Tether pylons + arc nova you hide from behind pillars', h:2.3, track:'boss_lineman', xp:390 },
 { id:'gantrymother', name:'Gantry-Mother Ngozi Adeyemi', faction:'Rustline Compact', mfr:'MM', level:'scrap_gantry', tier:1, lore:'Runs the scrapyard cranes for the Rustline independents and has never dropped a load she did not mean to.',
   hp:2900, speed:2.7, radius:.9, melee:['slam'], summon:'picker', moves:[{k:'lanes',p:{n:5,gap:2,len:12,space:2.4}},{k:'adds',p:{type:'picker',n:3,cap:7}}], phases:[P(.5,'Hook down!',{k:'adds',type:'forkbot',n:2},{k:'gimmick',g:{k:'lanes',every:8,n:6}})], gimmick:{k:'trickle',every:14,type:'picker',cap:5},
   arena:'Crane lanes: striped drop lanes with one safe gap each cast.', signature:'Crane-drop lane volleys with a safe gap + scrap-crew trickle', h:2.2, track:'elite_hunt', xp:380 },
 { id:'pitboss', name:'Pit Boss Karl Ossendrecht', faction:'Harrow-Brandt', mfr:'HI', level:'tailings_pit', tier:1, lore:'Ran the tailings pit until the contract lapsed. His shift whistle still sets the pace of the machines.',
   hp:3300, speed:3.0, radius:1.0, melee:['charge','slam','rsweep'], moves:[{k:'ring',p:{n:12,gaps:2,rad:6,r:1.6}}], phases:[P(.6,'The pit is getting smaller.',{k:'gimmick',g:{k:'edge',every:5,n:3}})], gimmick:{k:'edge',every:9,n:2},
   arena:'Collapsing rim: ground along the arena edge turns toxic, shrinking the safe area.', signature:'Shrinking arena + charge/slam brawler', h:2.4, track:'boss_pitboss', xp:400 },
 { id:'bellfounder', name:'Bell-Founder Vesper Calloway', faction:'Harrow-Brandt', mfr:'HI', level:'bell_foundry', tier:2, lore:'Cast the shift-bells for every Harrow plant. Each bell she rings is a tolling shockwave, and she rings them all.',
   hp:3800, speed:2.4, radius:.95, melee:['slam'], moves:[{k:'ring',p:{n:14,gaps:1,rad:4.5,r:1.5},w:1.0,cd:8},{k:'ring',p:{n:18,gaps:3,rad:8,r:1.5},w:1.4,cd:11},{k:'cross',p:{n:4,len:9}}], phases:[P(.5,'Toll for the line!',{k:'shield',pct:.12,dur:12})], gimmick:{k:'spokes',every:12,n:3,len:11},
   arena:'Tolling rings: a tight ring and a wide ring, with rotating floor spokes.', signature:'Double concentric ring tolls + bronze shield break', h:2.4, track:'boss_bellfounder', xp:520 },
 { id:'cryo', name:'Cryo-Archivist Linnea Frost', faction:'Aldane Surgical', mfr:'PS', level:'cold_archive', tier:2, lore:'Aldane keeps its oldest case files frozen. Frost keeps the files, and everything that tries to read them.',
   hp:3600, speed:2.5, radius:.8, melee:['blink'], moves:[{k:'lanes',p:{n:7,gap:1,len:13,space:1.9},w:1.2,cd:8},{k:'fan',p:{n:7,spread:80,speed:10}}], phases:[P(.65,'Closed to the public.',{k:'shield',pct:.14,dur:14}),P(.3,'Deep freeze.',{k:'enrage',spd:1.2,cd:.7})], gimmick:{k:'lanes',every:10,n:5},
   arena:'Frost lanes sweep the vault, narrowing the safe gaps.', signature:'Narrow frost lanes + ice shield, then deep-freeze enrage', h:2.2, track:'boss_cryo', xp:520 },
 { id:'auditor', name:'Compliance Officer Hale Thornquist', faction:'Aldane Surgical', mfr:'PS', level:'audit_tower', tier:2, lore:'Aldane compliance liaison for Aldane Terrace. Every conversation is an audit; his final audit is yours.',
   hp:3500, speed:2.8, radius:.75, melee:['cleave','blink'], summon:'nursebot', moves:[{k:'spiral',p:{n:20,turns:1.7,rad:9,r:1.3}},{k:'adds',p:{type:'nursebot',n:2,cap:6}}], phases:[P(.5,'Finding: non-compliant.',{k:'enrage',spd:1.3,cd:.65})], gimmick:{k:'rain',every:12,n:3,r:1.4},
   arena:'Audit spiral: markers spiral out from him; step between the arms.', signature:'Outward audit spiral + blink strikes + timed enrage', h:2.3, track:'boss_auditor', xp:510 },
 { id:'mirrorpt', name:'The Mirror Patient', faction:'Aldane Surgical', mfr:'PS', level:'aesthetic_ward', tier:2, lore:'Elective-procedure ward 3 never discharged her. Every revision left another reflection.',
   hp:3400, speed:3.3, radius:.8, melee:['blink','cleave'], moves:[{k:'fan',p:{n:9,spread:100,speed:12}},{k:'marks',p:{n:6,r:1.5,spread:4.4}}], phases:[P(.66,'Look. Look at me.',{k:'adds',type:'orderly',n:2}),P(.33,'Look closer.',{k:'adds',type:'matron',n:1},{k:'enrage',spd:1.15,cd:.8})], gimmick:{k:'trickle',every:16,type:'nursebot',cap:4},
   arena:'Hall of mirrors: reflections (adds) join at 66% and 33%.', signature:'Wide mirror fans + summoned reflections at two phases', h:2.2, track:'boss_fight', xp:500 },
 { id:'apothecary', name:'Apothecary Dessa Quill', faction:'Aldane Surgical', mfr:'PS', level:'pharmacy_vault', tier:2, lore:'Quill dispensed the Ward 9 sedatives. The vault filled with her mistakes a long time ago.',
   hp:3700, speed:2.4, radius:.8, melee:['cleave'], moves:[{k:'cross',p:{n:6,len:10,r:1.4},w:1.5,cd:9},{k:'rain',p:{n:9,area:7,r:1.7},cd:8}], phases:[P(.55,'Take one every four hours.',{k:'pylons',type:'sentry',n:2})], gimmick:{k:'spokes',every:14,n:4,len:10},
   arena:'Vent cross: six gas spokes burst from her, with extra sentry dispensers at 55%.', signature:'Six-arm gas cross + dispenser tether', h:2.2, track:'boss_apothecary', xp:520 },
 { id:'resonance', name:'Resonance Engineer Obi Lindqvist', faction:'Aldane Surgical', mfr:'PS', level:'anechoic_lab', tier:3, lore:'Built the quietest room in the Basin, then lost the habit of leaving it. Sound is his weapon now.',
   hp:5000, speed:2.6, radius:.8, melee:['blink'], moves:[{k:'spokes',p:{n:9,len:10,sweep:210},w:1.5,cd:9},{k:'nova',p:{n:20,speed:8,gap:40}}], phases:[P(.5,'Silence.',{k:'enrage',spd:1.2,cd:.7},{k:'gimmick',g:{k:'spokes',every:9,n:3,len:11}})], gimmick:{k:'pillarfire',every:10,n:10},
   arena:'Anechoic cell: wide beam sweeps and pillar echoes; pillars both shield and reflect.', signature:'210-degree beam sweep + pillar echo novas', h:2.3, hover:.5, track:'boss_resonance', xp:700 },
 { id:'clearance', name:'Clearance Manager Bryce Tolliver', faction:'Kestrel Value', mfr:'MM', level:'outlet_mall', tier:2, lore:'Everything must go. He has been on the final day of the sale for nine years.',
   hp:3700, speed:3.2, radius:.85, melee:['charge','slam'], summon:'picker', moves:[{k:'rain',p:{n:12,area:8,r:1.6},cd:6},{k:'adds',p:{type:'picker',n:4,cap:9}}], phases:[P(.5,'Final markdown!',{k:'enrage',spd:1.3,cd:.7})], gimmick:{k:'trickle',every:9,type:'scanner',cap:6},
   arena:'Sale floor: constant markdown rain and trickling shoppers.', signature:'Heavy markdown rain + endless add trickle', h:2.2, track:'boss_clearance', xp:510 },
 { id:'liquidator', name:'Liquidator Prime', faction:'Kestrel Value', mfr:'MM', level:'liquidation_floor', tier:3, lore:'A Kestrel receivership routine that never closed an account. It values everything at salvage.',
   hp:5200, speed:2.7, radius:.9, melee:['slam','rsweep'], moves:[{k:'marks',p:{n:8,r:1.5,spread:5},w:1.2,cd:6},{k:'ring',p:{n:10,gaps:2,rad:5,r:1.5}}], phases:[P(.7,'Appraising.',{k:'shield',pct:.1,dur:10}),P(.4,'Assets frozen.',{k:'shield',pct:.12,dur:10},{k:'enrage',spd:1.15,cd:.8})], gimmick:{k:'rain',every:13,n:4,r:1.4},
   arena:'Receivership floor: stacked mark barrages and two shield cycles.', signature:'Eight-mark barrage + twin shield cycles', h:2.3, track:'boss_liquidator', xp:700 },
 { id:'courier', name:'Courier-Queen Marisol Pike', faction:'Kestrel Value', mfr:'MM', level:'parcel_tower', tier:3, lore:'Her couriers run the Basin on a bonus system. She is never late, and neither are her packages.',
   hp:4800, speed:3.6, radius:.8, melee:['charge','blink'], moves:[{k:'lanes',p:{n:6,gap:1,len:14,space:2.1},w:.9,cd:6},{k:'fan',p:{n:11,spread:120,speed:13}}], phases:[P(.55,'Express delivery.',{k:'enrage',spd:1.3,cd:.6})], gimmick:{k:'lanes',every:7,n:5},
   arena:'Conveyor tower: fast parcel lanes cross the floor constantly.', signature:'Fast repeating lanes + double charge/blink mobility', h:2.0, track:'boss_courier', xp:690 },
 { id:'dispatcher', name:'Fleet Dispatcher AUTO-7', faction:'Kestrel Value', mfr:'MM', level:'freight_depot', tier:3, lore:'A routing intelligence that outlived its fleet. It now routes everything, including you.',
   hp:5000, speed:2.4, radius:.9, melee:[], summon:'forkbot', moves:[{k:'fan',p:{n:7,spread:60,speed:12}},{k:'nova',p:{n:12,speed:9,gap:60}},{k:'adds',p:{type:'forkbot',n:3,cap:7}}], phases:[P(.6,'Recalculating route.',{k:'pylons',type:'camgun',n:2})], gimmick:{k:'pillarfire',every:8,n:6},
   arena:'Rail yard: signal pylons feed the dispatcher, forkbots stream in.', signature:'Ranged hover dispatcher: pylon feed + forkbot waves', h:2.2, hover:.9, track:'boss_dispatcher', xp:700 },
 { id:'warrantor', name:'Warrantor Edda Marsh', faction:'Kestrel Value', mfr:'MM', level:'warranty_vault', tier:3, lore:'Kestrel claims adjuster for the unit "Retrieval R-0" and every other void warranty. She denies by default.',
   hp:5400, speed:2.5, radius:.9, melee:['slam','rsweep'], moves:[{k:'ring',p:{n:12,gaps:1,rad:6.5,r:1.6},w:1.2,cd:9},{k:'marks',p:{n:6,r:1.8,spread:4}}], phases:[P(.66,'Claim denied.',{k:'pylons',type:'sentry',n:3}),P(.3,'Void where prohibited.',{k:'shield',pct:.12,dur:10},{k:'enrage',spd:1.2,cd:.7})], gimmick:{k:'edge',every:10,n:2},
   arena:'Vault: seal-pylons make her near invulnerable until destroyed, then edge fills in.', signature:'Seal-pylon tether then late shield+enrage with creeping edge', h:2.3, track:'boss_warrantor', xp:720 },
 { id:'tidewarden', name:'Pump-Warden Alva Strand', faction:'Rustline Compact', mfr:'MM', level:'drained_reservoir', tier:2, lore:'Kept the Basin reservoir pumps running after the water left. She still believes the tide is coming back.',
   hp:3800, speed:2.5, radius:.9, melee:['rsweep'], moves:[{k:'lanes',p:{n:5,gap:1,len:12,space:2.6},w:1.5,cd:9},{k:'spiral',p:{n:16,turns:1.2,rad:8,r:1.5}}], phases:[P(.5,'Tide is in.',{k:'gimmick',g:{k:'edge',every:6,n:3}})], gimmick:{k:'rain',every:10,n:3,r:1.7},
   arena:'Flood basin: wave lanes and rising edge water.', signature:'Tidal lanes + rising edge water', h:2.3, track:'boss_hydraulic', xp:520 },
 { id:'rattle', name:"Quiet Shift Foreman 'Rattle'", faction:'Quiet Shift', mfr:'MM', level:'night_tunnels', tier:3, lore:'The Quiet Shift are the workers who kept working after the plants closed. Rattle is the one who counts them each night.',
   hp:5000, speed:3.4, radius:.8, melee:['blink','cleave','charge'], summon:'worker', moves:[{k:'marks',p:{n:7,r:1.4,spread:4.6},w:1.0,cd:5},{k:'adds',p:{type:'worker',n:4,cap:9}}], phases:[P(.5,'Roll call.',{k:'adds',type:'shooter',n:3}),P(.25,'Last shift.',{k:'enrage',spd:1.3,cd:.65})], gimmick:{k:'trickle',every:11,type:'worker',cap:7},
   arena:'Dark tunnels: night shift crews keep coming, and he blinks between them.', signature:'Blink-melee foreman with constant crew adds', h:2.1, track:'boss_rattle', xp:700 },
 { id:'breaker', name:'Breaker-King Joss Kellan', faction:'Rustline Compact', mfr:'HI', level:'breaker_yard', tier:3, lore:'Strips decommissioned hardware for the Rustline market and keeps the best parts for himself.',
   hp:5600, speed:3.0, radius:1.05, melee:['chainsweep','charge','slam'], moves:[{k:'spiral',p:{n:24,turns:2.2,rad:9,r:1.4}},{k:'ring',p:{n:9,gaps:2,rad:4.8,r:1.4},cd:6}], phases:[P(.5,'Rip it down!',{k:'enrage',spd:1.25,cd:.7},{k:'gimmick',g:{k:'rain',every:7,n:5,r:1.5}})], gimmick:{k:'edge',every:12,n:2},
   arena:'Breaker pit: heavy melee chains with spirals and a rubble edge.', signature:'Chain-sweep brawler with double-spiral scrap', h:2.5, track:'boss_meltdown', xp:720 },
 { id:'widow', name:'Signal Widow Perpetua', faction:'Rustline Compact', mfr:'PS', level:'radio_mast', tier:3, lore:'Kept the Basin broadcast mast alive for a husband who stopped answering. She relays only what she chooses.',
   hp:5100, speed:2.3, radius:.8, melee:[], moves:[{k:'spokes',p:{n:10,len:13,sweep:240},w:1.6,cd:10},{k:'fan',p:{n:5,spread:40,speed:14}},{k:'nova',p:{n:10,speed:10,gap:70}}], phases:[P(.6,'Antenna array online.',{k:'pylons',type:'camgun',n:4})], gimmick:{k:'pillarfire',every:11,n:8},
   arena:'Mast platform: long 240-degree beam sweeps, four antenna tethers.', signature:'Extra-long beam sweeps + four antenna tethers', h:2.2, hover:.7, track:'boss_widow', xp:710 },
 { id:'recall', name:'Recall Engine R-ALL', faction:'Recall Authority', mfr:'HI', level:'recall_yard', tier:4, lore:'The Basin Recall Authority was meant to retire dangerous hardware. R-ALL decided the people carrying it count as hardware.',
   hp:8200, speed:2.8, radius:1.15, melee:['slam','charge','chainsweep'], summon:'scanner', moves:[{k:'spokes',p:{n:9,len:11,sweep:200},w:1.5},{k:'ring',p:{n:14,gaps:2,rad:7,r:1.6}},{k:'marks',p:{n:7,r:1.6,spread:5}},{k:'adds',p:{type:'scanner',n:4,cap:10}}],
   phases:[P(.75,'Recall initiated.',{k:'shield',pct:.1,dur:12}),P(.5,'Recall: all units.',{k:'pylons',type:'turret',n:3}),P(.25,'Recall: self.',{k:'enrage',spd:1.3,cd:.6},{k:'gimmick',g:{k:'rain',every:5,n:5,r:1.5}})], gimmick:{k:'pillarfire',every:10,n:8},
   arena:'Recall yard: three escalating phases (shield, tether, enrage) on the toughest arena.', signature:'Capstone: shield, tether and enrage phases combined', h:2.9, track:'boss_recall', xp:1100 },
];
export const BOSS_BY_ID:Record<string,BossSpec>=Object.fromEntries(BOSSES.map(b=>[b.id,b]));
