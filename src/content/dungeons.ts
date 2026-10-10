// Dungeon registry: the Reclamation Annex plus three manufacturer-themed dungeons (data + procedural layouts).
// Layouts reuse the Annex structure (entry -> gate -> hall -> lock -> control -> boss door -> boss) so the proven run logic
// (guard-gate, elite-or-hack lock, objective controller, boss reveal, checkpoints, daily lockout) applies unchanged.
// Zone SLOT names (yard/proc/junction/boss/salvage/passage) are reused so existing renderer palettes/textures apply;
// each dungeon's concept-sheet names live in zoneLabels. ART NEEDED: per-dungeon floor/wall textures per the concept sheets
// in public/dungeons/source (foundry.jpg, clinic.jpg, warehouse.jpg).
import { buildAnnex } from '../level';
import type { Level, Interact, Hazard } from '../level';
import { genFoundry, genClinic, genWarehouse, varyAnnex } from './mapgen';
import { genBatch1 } from './mapgen_batch1';
import { LEVELS } from './batch1_levels';
import type { LevelSpec } from './batch1_levels';
export type { Hazard };
import type { LootEntry, ChipId, Mfr } from '../config';

export type Cap='hack'|'force'|'cloak'|'defib';
export interface CondDef { id:'A'|'B'; boss:string; cap:Cap; at:{x:number;y:number}; kind:Interact['kind']; label:string; title:string; body:string; confirm:string; denied:string; toast:string; arc:string; clueSource:'terminal'|'armory_marking'|'announcement'; clue:string; }
export interface DungeonDef {
  id:string; name:string; short:string; mfr:Mfr; district:string; fixer:string; blurb:string;
  minLevel:number; maxLevel:number; tierCap:number; estMinutes:[number,number];
  /** seeded: same seed => same layout (instance seed; see docs/MAP_GENERATION.md) */ build:(seed?:number)=>Level; zoneLabels:Record<string,string>;
  defaultBoss:string; conds:CondDef[]; gateGuard:string; lockElite:string; alarmType:string;
  relayLabel:string; objectiveLabel:string; objectiveToast:string; cache:{ label:string; chips:ChipId[] };
  hazards:Hazard[]; loot?:{ ordinary:LootEntry[]; elite:LootEntry[]; boss:LootEntry[] }; signature:Record<string,{item:string;chance:number}>|null;
  creditMul:number; clearXp:number; intro:string; generalClue:string; needsArt:string[];
  /** content batch 1: difficulty tier (I-IV) and the dungeons that must have been cleared before this one unlocks */ tier?:1|2|3|4; unlock?:string[]; faction?:string; boss?:string;
}

// ---------------- loot pools (replace the global pools in these dungeons) ----------------
const L=(...a:LootEntry[])=>a;
const FOUNDRY_LOOT={ ordinary:L({item:'hi_slag_apron',w:3},{item:'hi_slag_face',w:3},{item:'hi_anvil_foot',w:1.5},{item:'hi_ladle_hand',w:1},{item:'hi_shard_arm',w:1},{item:'hi_gantry_leg_l',w:.25},{item:'hi_gantry_leg_r',w:.25},{chip:'ablative',w:5},{chip:'coolant',w:4},{chip:'plating',w:4},{chip:'power',w:3},{chip:'sustain',w:3},{stim:true,w:7}),
  elite:L({item:'hi_crucible_torso',w:2},{item:'hi_press_arm',w:2},{item:'hi_ladle_hand',w:2},{item:'hi_anvil_foot',w:2},{item:'hi_shard_arm',w:1.5},{item:'hi_shard_arm_p',w:.3},{item:'hi_gantry_leg_l',w:.8},{item:'hi_gantry_leg_r',w:.8},{chip:'quench',w:3},{chip:'overdrive',w:.6},{chip:'ablative',w:3},{stim:true,w:3}),
  boss:L({item:'hi_crucible_torso',w:3},{item:'hi_press_arm',w:3},{item:'hi_slug_cannon',w:1.2},{item:'hi_shard_arm_p',w:.5},{item:'hi_gantry_leg_l',w:1.5},{item:'hi_gantry_leg_r',w:1.5},{chip:'quench',w:3},{chip:'overdrive',w:1.5},{chip:'fineedge',w:2},{stim:true,w:3}) };
const CLINIC_LOOT={ ordinary:L({item:'ps_sutured_torso',w:3},{item:'ps_sensor_foot',w:3},{item:'ps_anesthesia_face',w:1.5},{item:'ps_scalpel_hand_l2',w:1},{item:'ps_needle_rifle',w:1},{item:'ps_ceramic_leg_l',w:.25},{item:'ps_ceramic_leg_r',w:.25},{chip:'fineedge',w:3},{chip:'coolant',w:4},{chip:'cloakdur',w:3},{chip:'sustain',w:3},{chip:'gridlink',w:2},{stim:true,w:7}),
  elite:L({item:'ps_theatre_torso',w:2},{item:'ps_scalpel_hand_l2',w:2},{item:'ps_anesthesia_face',w:2},{item:'ps_fan_arm',w:.8},{item:'ps_ceramic_leg_l',w:.8},{item:'ps_ceramic_leg_r',w:.8},{item:'ps_nerve_brain',w:.6},{item:'ps_arc_caster',w:.9},{item:'ps_needle_rifle',w:1.5},{chip:'quench',w:3},{chip:'gridlink',w:3},{chip:'overdrive',w:.6},{stim:true,w:3}),
  boss:L({item:'ps_theatre_torso',w:3},{item:'ps_fan_arm',w:2},{item:'ps_arc_caster',w:1.3},{item:'ps_needle_rifle_p',w:.7},{item:'ps_ceramic_leg_l',w:1.5},{item:'ps_ceramic_leg_r',w:1.5},{item:'ps_nerve_brain',w:1.5},{chip:'fineedge',w:3},{chip:'overdrive',w:1.5},{chip:'gridlink',w:2},{stim:true,w:3}) };
const WAREHOUSE_LOOT={ ordinary:L({item:'mm_pallet_torso',w:6},{item:'mm_stocker_arm',w:4},{item:'mm_jack_leg_l',w:3},{item:'mm_jack_leg_r',w:3},{item:'mm_scanner_face',w:3},{item:'mm_clamp_hand',w:3},{item:'mm_nailgun',w:1.5},{item:'mm_autopistol',w:2.5},{chip:'ablative',w:4},{chip:'speed',w:4},{chip:'coolant',w:4},{chip:'magnet',w:4},{chip:'power',w:3},{stim:true,w:8}),
  elite:L({item:'mm_cutter_hand',w:2},{item:'mm_returns_torso',w:2},{item:'mm_barcode_brain',w:1.5},{item:'mm_nailgun',w:2},{item:'mm_autopistol_b',w:1.5},{item:'mm_shocktack',w:1.5},{chip:'gridlink',w:3},{chip:'fineedge',w:2},{chip:'ablative',w:3},{stim:true,w:3}),
  boss:L({item:'mm_returns_torso',w:3},{item:'mm_barcode_brain',w:3},{item:'mm_cutter_hand',w:3},{item:'mm_autopistol_b',w:2},{item:'mm_shocktack',w:2},{chip:'fineedge',w:2},{chip:'quench',w:2},{chip:'gridlink',w:2},{stim:true,w:3}) };


// ---------------- content batch 1: 20 data-driven dungeons (docs/CONTENT_BATCH_1.md) ----------------
const FIXER:Record<string,string>={ HI:'ten_hallowell', PS:'noor_abiodun', MM:'handler_cole' };
const mixPool=(k:'ordinary'|'elite'|'boss')=>[...FOUNDRY_LOOT[k],...CLINIC_LOOT[k],...WAREHOUSE_LOOT[k]];
const LOOT_BY:Record<string,{ordinary:LootEntry[];elite:LootEntry[];boss:LootEntry[]}>={ HI:FOUNDRY_LOOT, PS:CLINIC_LOOT, MM:WAREHOUSE_LOOT, mix:{ordinary:mixPool('ordinary'),elite:mixPool('elite'),boss:mixPool('boss')} };
export function makeBatch1Dungeon(sp:LevelSpec):DungeonDef{
  const indep=!['Harrow-Brandt','Aldane Surgical','Kestrel Value'].includes(sp.faction);
  return { id:sp.id, name:sp.name, short:sp.short, mfr:sp.mfr, district:sp.district, fixer:indep?'odalys_vane':FIXER[sp.mfr], blurb:sp.blurb, minLevel:sp.minLevel, maxLevel:sp.maxLevel, tierCap:sp.maxLevel, estMinutes:sp.est,
    build:(s=sp.id.length*977+sp.tier*131)=>genBatch1(sp,s), zoneLabels:sp.zoneLabels, defaultBoss:sp.boss, conds:[], gateGuard:sp.gateGuard, lockElite:sp.lockElite, alarmType:sp.alarmType,
    relayLabel:sp.objective.relay, objectiveLabel:sp.objective.label, objectiveToast:sp.objective.toast, cache:{label:sp.objective.bonus,chips:sp.chips as ChipId[]}, hazards:[], loot:LOOT_BY[sp.loot], signature:null,
    creditMul:sp.creditMul, clearXp:sp.xp, intro:sp.intro, generalClue:sp.blurb, needsArt:[], tier:sp.tier, unlock:sp.unlock.after, faction:sp.faction, boss:sp.boss } as DungeonDef; }
// ---------------- registry ----------------
const annexConds:CondDef[]=[]; // Annex keeps its legacy terminal/armory handling in sim.ts (ids 'terminal' and 'armoryfuse').
export const DUNGEONS:Record<string,DungeonDef> = {
  annex:{ id:'annex', name:'Reclamation Annex', short:'Annex', mfr:'HI', district:'Harrow Reach', fixer:'odalys_vane', blurb:'A Harrow-Brandt salvage annex staffed by Kestrel contractors. Steal the integration controller; the first confirmed condition (audit terminal or sealed armory) picks the boss.',
    minLevel:10, maxLevel:20, tierCap:20, estMinutes:[6,10], build:(s=1)=>varyAnnex(buildAnnex,s), zoneLabels:{yard:'Annex yard',proc:'Processing floor',junction:'Control junction',boss:'Boss chamber',salvage:'Salvage room',passage:'Maintenance passage'},
    defaultBoss:'overseer', conds:annexConds, gateGuard:'turret', lockElite:'sawhand', alarmType:'worker', relayLabel:'Security relay', objectiveLabel:'Integration controller', objectiveToast:'Integration controller secured. Boss chamber door open.',
    cache:{label:'Chip cache',chips:['cutwide','ctrldur']}, hazards:[], signature:null, creditMul:1, clearXp:250, intro:'Reclamation Annex: steal the controller, defeat the boss.', generalClue:'Announcements on the Annex floor mention routine audits and reclaim sweeps.', needsArt:['Annex enemy sprites (workers, shooters, sawhand, foreman, bosses)'] },
  foundry:{ id:'foundry', name:'Harrow-Brandt Foundry Line 7', short:'Foundry', mfr:'HI', district:'Harrow Reach', fixer:'ten_hallowell', blurb:'Heavy industrial casting line. Slag troughs, press plates and a furnace-ring boss arena. Force hardware and hacking each bring a different boss to the ring.',
    minLevel:18, maxLevel:30, tierCap:30, estMinutes:[7,10], build:(s=7101)=>genFoundry(s), zoneLabels:{yard:'Slag yard',proc:'Casting hall',junction:'Quench & press control gantry',boss:'Furnace ring',salvage:'Tool crib',passage:'Service alcove'},
    defaultBoss:'teague', gateGuard:'slagcannon', lockElite:'brakeman', alarmType:'slaghauler', relayLabel:'Press-line relay', objectiveLabel:'Pour controller', objectiveToast:'Pour controller secured. The furnace ring door grinds open.',
    cache:{label:'Tool-crib cache',chips:['ablative','quench']}, hazards:[], loot:FOUNDRY_LOOT, creditMul:1.8, clearXp:520, intro:'Foundry Line 7: release the slag gate, seize the pour controller, face the ring.',
    conds:[
      { id:'A', boss:'brannoch', cap:'force', at:{x:63.5,y:32.5}, kind:'armory', label:'Casting-line interlock lever (force)', title:'Casting-line interlock', body:'A hydraulic interlock keeps the Ladle-Tyrant in cold storage. Shearing it off its latch calls Brannoch to the furnace ring: ram sweeps, charges and rings of slag with a single safe gap.', confirm:'Shear the interlock (Ladle-Tyrant Brannoch)', denied:'Interlock lever. Needs force hardware (e.g. a press or ripper arm).', toast:'Interlock sheared: Ladle-Tyrant Brannoch selected', arc:'foundry_unrest', clueSource:'armory_marking',
        clue:'Stencils on the cold-storage latch read BRANNOCH, HB RECLAIM LOT 7. Hallowell says only force hardware can shear the interlock clean.' },
      { id:'B', boss:'ore9', cap:'hack', at:{x:63.5,y:6.5}, kind:'terminal', label:'Pour-schedule console (hack)', title:'Pour-schedule console', body:'The console governs furnace pour order. Overwriting the schedule hands the ring to Governor ORE-9: ranged volleys, slag rings, and cinder drones.', confirm:'Overwrite the schedule (Governor ORE-9)', denied:'ACCESS DENIED. Requires hacking hardware.', toast:'Schedule overwritten: Governor ORE-9 selected', arc:'audit_pressure', clueSource:'terminal',
        clue:'Console logs show Aldane auditors flagged Line 7 for an unlicensed furnace governor. An audit command from a hacking brain could wake it.' },
    ], signature:{ brannoch:{item:'sig_anvil_arm',chance:.1}, ore9:{item:'sig_governor_core',chance:.1} },
    generalClue:'The shift horn at Line 7 has not stopped. Hallowell says the line is pouring for no one.', needsArt:['Foundry floor/wall textures per foundry.jpg (slag troughs, tread plate, gantry catwalks)','Enemy sprites: slaghauler, ladlecrew, cinderhound, slagcannon, brakeman, quenchpriest','Boss sprites/arena: teague, brannoch, ore9, furnace ring centerpiece','Slag/heat hazard rendering (currently generic grey-blue circle)','Signature orange animations: Anvil-Arm, Governor Core'] },
  clinic:{ id:'clinic', name:'Aldane Ward 9 Clinic', short:'Clinic', mfr:'PS', district:'Aldane Terrace', fixer:'noor_abiodun', blurb:'A quiet precision-surgical clinic. Spilled fluids, theatre bays, a fabrication lab and a saw-rigged amphitheatre. A cloak-weave passage skips the theatre lock; hacking and cloaking each choose a different boss.',
    minLevel:22, maxLevel:34, tierCap:34, estMinutes:[7,10], build:(s=7202)=>genClinic(s), zoneLabels:{yard:'Reception & intake ward',proc:'Surgical theatre bays',junction:'Ceramic implant fabrication lab',boss:'Operating amphitheatre',salvage:'Recovery ward',passage:'Sterile corridor'},
    defaultBoss:'surgeon', gateGuard:'sentry', lockElite:'matron', alarmType:'orderly', relayLabel:'Theatre door relay', objectiveLabel:'Implant fabricator core', objectiveToast:'Fabricator core secured. The amphitheatre doors unseal.',
    cache:{label:'Pharmacy cache',chips:['fineedge','gridlink']}, hazards:[], loot:CLINIC_LOOT, creditMul:2.2, clearXp:640, intro:'Ward 9: pass intake, cut through the theatre bays, take the fabricator core.',
    conds:[
      { id:'A', boss:'autosurgeon', cap:'hack', at:{x:21.5,y:29.5}, kind:'terminal', label:'Theatre scheduling terminal (hack)', title:'Theatre scheduling terminal', body:'Booking an emergency procedure wakes the GEMINI autosurgeon: saw lanes with a safe gap, scalpel fans and ranged pressure. It is a ranged boss, not a lockout for brain builds.', confirm:'Book the procedure (GEMINI Autosurgeon)', denied:'ACCESS DENIED. Requires hacking hardware.', toast:'Procedure booked: GEMINI Autosurgeon selected', arc:'ward_secrets', clueSource:'terminal',
        clue:'Theatre booking logs list a standing emergency slot for GEMINI, signed Aldane Surgical. Sen says a hacking brain can book it.' },
      { id:'B', boss:'recovered', cap:'cloak', at:{x:36.5,y:11.5}, kind:'armory', label:'Quarantine ward seal (cloak weave)', title:'Quarantine ward seal', body:'The seal only recognises sensor-dampened staff. Unsealing the recovery cell lets Patient Eleven out: fast, blinking melee with clear recovery openings.', confirm:'Unseal the cell (The Recovered)', denied:'Seal ignores you. Needs a sensor-dampening cloak weave.', toast:'Cell unsealed: The Recovered selected', arc:'ward_secrets', clueSource:'announcement',
        clue:'Intake announcements keep paging "Patient Eleven, please return to your bed". The sterile corridor seal only answers a cloak weave.' },
    ], signature:{ autosurgeon:{item:'sig_autosurgeon_rig',chance:.1}, recovered:{item:'sig_recovered_veil',chance:.1} },
    generalClue:'Ward 9 appears on no current Aldane roster. Costa has asked Rustline fixers not to ask why.', needsArt:['Clinic floor/wall textures per clinic.jpg (ivory tile, glass partitions, amphitheatre tiers)','Enemy sprites: orderly, nursebot, gurneyrunner, sentry, matron, anesthetist','Boss sprites/arena: surgeon, autosurgeon (ceiling rig), recovered, amphitheatre centerpiece','Saw-rig and fluid hazard rendering','Signature orange animations: GEMINI Rig, Recovered Veil'] },
  warehouse:{ id:'warehouse', name:'Kestrel Distribution Hub 9', short:'Warehouse', mfr:'MM', district:'Kestrel Row', fixer:'handler_cole', blurb:'An economical cyberware refurbishing warehouse. Loading dock, tall aisles, a sorting line and a retrieval hall guarded by a repurposed mech. A good first step beyond the Annex.',
    minLevel:8, maxLevel:18, tierCap:26, estMinutes:[5,8], build:(s=7303)=>genWarehouse(s), zoneLabels:{yard:'Loading dock',proc:'Storage aisles',junction:'Sorting line',boss:'Retrieval hall',salvage:'Returns cage',passage:'Returns bay'},
    defaultBoss:'stockmgr', gateGuard:'camgun', lockElite:'shiftlead', alarmType:'picker', relayLabel:'Shutter relay', objectiveLabel:'Master sort controller', objectiveToast:'Sort controller secured. The retrieval hall door lifts.',
    cache:{label:'Returns-cage cache',chips:['ablative','gridlink']}, hazards:[], loot:WAREHOUSE_LOOT, creditMul:.8, clearXp:380, intro:'Hub 9: clear the dock, work the aisles, claim the sort controller.',
    conds:[
      { id:'A', boss:'retrieval', cap:'hack', at:{x:60.5,y:10.5}, kind:'terminal', label:'Order-queue console (hack)', title:'Order-queue console', body:'Processing Return Order #0 dispatches Retrieval Unit R-0, the repurposed mech: ring sweeps, gantry chains and crate drops. Plenty of recovery between sweeps.', confirm:'Process Return Order #0 (Retrieval Unit R-0)', denied:'ACCESS DENIED. Requires hacking hardware.', toast:'Return Order #0 processed: Retrieval Unit R-0 selected', arc:'stock_shrinkage', clueSource:'terminal',
        clue:'The order queue holds one entry Kestrel cannot close: RETURN ORDER 0, item "unit, refurbished". Cole wants it closed.' },
      { id:'B', boss:'reclaimer', cap:'defib', at:{x:62.5,y:36.5}, kind:'armory', label:'Dormant returns cradle (defib rack)', title:'Dormant returns cradle', body:'The cradle holds a dead refurbishment. Jump-starting it with a defib rack brings back LAZARUS-LITE: slams, charges, crate drops and fork-bot summons.', confirm:'Jump-start the cradle (Returns Reclaimer)', denied:'Cradle is dead. A defib rack could jump-start it.', toast:'Cradle jump-started: Returns Reclaimer selected', arc:'stock_shrinkage', clueSource:'armory_marking',
        clue:'A tag on the cradle reads LAZARUS-LITE, RETURNED x3, RESOLD x3. Okafor says the power cell is still warm.' },
    ], signature:{ retrieval:{item:'sig_r0_lifter',chance:.1}, reclaimer:{item:'sig_lazarus_rack',chance:.08} },
    generalClue:'Shrinkage at Hub 9 is up again. Cole says the numbers do not add up in either direction.', needsArt:['Warehouse floor/wall textures per warehouse.jpg (loading dock decals, shelving, stamped plate)','Enemy sprites: picker, loader, forkbot, scanner, camgun, shiftlead, hobbs','Boss sprites: stockmgr, retrieval (large mech per sheet), reclaimer','Gantry-crane/stamping-press hazard rendering','Signature orange animations: Lazarus Rack, R-0 Lifter'] },
};
for(const sp of LEVELS) DUNGEONS[sp.id]=makeBatch1Dungeon(sp);
export const BATCH1_IDS=LEVELS.map(l=>l.id);
export const DUNGEON_LIST:DungeonDef[]=[...['warehouse','annex','foundry','clinic'].map(k=>DUNGEONS[k]),...[...LEVELS].sort((a,b)=>a.tier-b.tier||a.minLevel-b.minLevel).map(l=>DUNGEONS[l.id])];
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

// THEME TAG: visual theme id on each built level (consumed by src/dungeon_env.ts via themeOf); purely cosmetic.
for(const id of ['foundry','clinic','warehouse']){ const d=DUNGEONS[id]; const b=d.build; d.build=(s?:number)=>({ ...b(s), theme:id }); }

/** Unlock path (content batch 1): a dungeon with `unlock` needs every listed dungeon cleared once (save.cleared, or an existing daily-lock record from before this field existed). Returns a player-facing reason or null. */
export function unlockReason(save:{cleared?:Record<string,number>;lockouts?:Record<string,string>;lastClearDay?:string|null},id:string,bypass=false):string|null{
  const d=DUNGEONS[id]; if(!d||!d.unlock||bypass) return null; const done=(k:string)=>!!save.cleared?.[k]||(k==='annex'?!!save.lastClearDay:!!save.lockouts?.[k]);
  const need=d.unlock.filter(k=>!done(k)); if(!need.length) return null; return 'Locked: clear '+need.map(k=>DUNGEONS[k]?.name||k).join(' and ')+' first.'; }
