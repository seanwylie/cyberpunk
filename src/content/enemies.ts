// Dungeon-pack enemy content (data only). PLACEHOLDER balance, not approved numbers.
// Every enemy here renders through the generic procedural enemy primitive (manufacturer colours, elite/boss scale).
// ART NEEDED: unique silhouettes/sprites for every id below (see docs/DUNGEON_ART_PROMPTS.md).
import type { EnemyDef } from '../config';
const E=(d:EnemyDef):[string,EnemyDef]=>[d.id,d];
export const EXTRA_ENEMIES:Record<string,EnemyDef> = Object.fromEntries([
  // ---------------- Harrow-Brandt Foundry Line 7 (heavy industrial) ----------------
  E({ id:'slaghauler', name:'Slag Hauler', hp:34, speed:2.9, radius:.42, mfr:'HI', aggro:7, xp:11, rep:1, attacks:['swing'], dmgMul:1.35 }),
  E({ id:'ladlecrew', name:'Ladle Crew', hp:28, speed:2.4, radius:.38, mfr:'HI', ranged:true, aggro:9, xp:13, rep:1, attacks:['slagshot'], dmgMul:1.35 }),
  E({ id:'cinderhound', name:'Cinder Hound', hp:22, speed:4.3, radius:.34, mfr:'HI', aggro:9, xp:10, rep:1, attacks:['bite'], dmgMul:1.35 }),
  E({ id:'slagcannon', name:'Slag Cannon', hp:120, speed:0, radius:.55, mfr:'HI', static:true, ranged:true, aggro:11, xp:22, rep:2, attacks:['turretshot'], dmgMul:1.35 }),
  E({ id:'brakeman', name:'Brakeman Orsolya Kade', hp:900, speed:3.1, radius:.62, mfr:'HI', elite:true, aggro:9, xp:90, rep:10, attacks:['cleave','charge'], dmgMul:1.35 }),
  E({ id:'quenchpriest', name:'Quench-Priest Dov Aleksandrov', hp:780, speed:2.6, radius:.58, mfr:'HI', elite:true, ranged:true, aggro:10, xp:95, rep:10, attacks:['slagpool','volley'], dmgMul:1.35 }),
  E({ id:'teague', name:'Crucible Foreman Aldric Teague', hp:3300, speed:2.7, radius:.95, mfr:'HI', boss:true, elite:true, aggro:30, xp:520, rep:30, attacks:['slam','slagpool','summon','charge'], summon:'slaghauler', dmgMul:1.35 }),
  E({ id:'brannoch', name:'Ladle-Tyrant Brannoch', hp:3600, speed:2.9, radius:1.0, mfr:'HI', boss:true, elite:true, aggro:30, xp:580, rep:30, attacks:['rsweep','charge','ringpools'], dmgMul:1.4 }),
  E({ id:'ore9', name:'Governor ORE-9', hp:3000, speed:2.2, radius:.85, mfr:'HI', boss:true, elite:true, ranged:true, aggro:30, xp:580, rep:30, attacks:['volley','ringpools','slagpool','summon'], summon:'cinderhound', dmgMul:1.35 }),
  // ---------------- Aldane Ward 9 Clinic (precision surgical) ----------------
  E({ id:'orderly', name:'Ward Orderly', hp:36, speed:3.1, radius:.38, mfr:'PS', aggro:8, xp:14, rep:1, attacks:['swing'], dmgMul:1.5 }),
  E({ id:'nursebot', name:'Intake Nurse-Bot', hp:30, speed:2.5, radius:.36, mfr:'PS', ranged:true, aggro:10, xp:15, rep:1, attacks:['dart'], dmgMul:1.5 }),
  E({ id:'gurneyrunner', name:'Gurney Runner', hp:44, speed:3.8, radius:.5, mfr:'PS', aggro:10, xp:16, rep:1, attacks:['charge'], dmgMul:.9 }),
  E({ id:'sentry', name:'Intake Sentry', hp:140, speed:0, radius:.5, mfr:'PS', static:true, ranged:true, aggro:11, xp:24, rep:2, attacks:['turretshot'], dmgMul:1.5 }),
  E({ id:'matron', name:'Matron Ilse Verhoeven', hp:1000, speed:3.3, radius:.6, mfr:'PS', elite:true, aggro:9, xp:105, rep:11, attacks:['cleave','blink'], dmgMul:1.5 }),
  E({ id:'anesthetist', name:'Dr. Quill the Anesthetist', hp:850, speed:2.5, radius:.55, mfr:'PS', elite:true, ranged:true, aggro:11, xp:110, rep:11, attacks:['gasvent','volley'], dmgMul:1.5 }),
  E({ id:'surgeon', name:'Chief Surgeon Aurelio Vance', hp:3900, speed:3.0, radius:.8, mfr:'PS', boss:true, elite:true, aggro:30, xp:640, rep:32, attacks:['blink','scalpelfan','chainsweep','summon'], summon:'orderly', dmgMul:1.5 }),
  E({ id:'autosurgeon', name:'Theatre Autosurgeon GEMINI', hp:3700, speed:2.2, radius:.9, mfr:'PS', boss:true, elite:true, ranged:true, aggro:30, xp:700, rep:32, attacks:['sawlanes','scalpelfan','volley'], dmgMul:1.5 }),
  E({ id:'recovered', name:'The Recovered (Patient Eleven)', hp:4000, speed:3.4, radius:.85, mfr:'PS', boss:true, elite:true, aggro:30, xp:700, rep:32, attacks:['blink','rsweep','charge'], dmgMul:1.5 }),
  // ---------------- Kestrel Distribution Hub 9 (economical mass market) ----------------
  E({ id:'picker', name:'Contract Picker', hp:16, speed:3.2, radius:.36, mfr:'MM', aggro:7, xp:8, rep:1, attacks:['swing'], dmgMul:.9 }),
  E({ id:'loader', name:'Dock Loader', hp:46, speed:2.4, radius:.55, mfr:'MM', aggro:7, xp:12, rep:1, attacks:['cleave'], dmgMul:.9 }),
  E({ id:'forkbot', name:'Fork-Lift Bot', hp:30, speed:3.7, radius:.5, mfr:'MM', aggro:10, xp:12, rep:1, attacks:['charge'], dmgMul:.8 }),
  E({ id:'scanner', name:'Inventory Scanner', hp:14, speed:2.6, radius:.34, mfr:'MM', ranged:true, aggro:10, xp:9, rep:1, attacks:['shot'], dmgMul:.9 }),
  E({ id:'camgun', name:'Dock Cam-Gun', hp:90, speed:0, radius:.5, mfr:'MM', static:true, ranged:true, aggro:10, xp:18, rep:2, attacks:['turretshot'], dmgMul:.9 }),
  E({ id:'shiftlead', name:'Shift Lead Dagny Pruitt', hp:520, speed:3.2, radius:.58, mfr:'MM', elite:true, aggro:9, xp:60, rep:8, attacks:['cleave','summon'], summon:'picker', dmgMul:.9 }),
  E({ id:'hobbs', name:'Pallet-Jack Hobbs', hp:480, speed:3.0, radius:.6, mfr:'MM', elite:true, aggro:9, xp:60, rep:8, attacks:['charge','slam'], dmgMul:.9 }),
  E({ id:'stockmgr', name:'Regional Stock Manager Wendell Rusk', hp:2400, speed:2.7, radius:.85, mfr:'MM', boss:true, elite:true, aggro:30, xp:380, rep:26, attacks:['slam','cratefall','summon'], summon:'picker', dmgMul:.9 }),
  E({ id:'retrieval', name:'Retrieval Unit R-0', hp:2800, speed:2.5, radius:1.1, mfr:'MM', boss:true, elite:true, aggro:30, xp:420, rep:26, attacks:['rsweep','chainsweep','cratefall','charge'], dmgMul:.95 }),
  E({ id:'reclaimer', name:'Returns Reclaimer LAZARUS-LITE', hp:2600, speed:3.0, radius:.9, mfr:'MM', boss:true, elite:true, aggro:30, xp:420, rep:26, attacks:['slam','charge','cratefall','summon'], summon:'forkbot', dmgMul:.95 }),
].map(([k,v])=>[k as string,v as EnemyDef]));
// Base damage per attack id (multiplied per enemy by dmgMul). zones/pool attacks use these as damage-per-tick.
export const EXTRA_ENEMY_DMG:Record<string,number> = { slagshot:15, bite:14, dart:11, scalpelfan:15, chainsweep:38, riposte:34, blink:0, slagpool:10, ringpools:10, gasvent:6, sawlanes:14, cratefall:24 };
