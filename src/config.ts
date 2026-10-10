import { EXTRA_CHIPS, EXTRA_ITEMS, EXTRA_CONFLICTS } from './content/items';
import { WEAPON_ITEMS } from './content/weapons';
import { IDKFA_ITEMS } from './content/idkfa';
import { EXTRA_ENEMIES, EXTRA_ENEMY_DMG } from './content/enemies';
import { BATCH1_ENEMIES } from './content/batch1_enemies';
import { BATCH2_ENEMIES } from './content/batch2_enemies';
import { MOB_DMG } from './content/batch2_mobs';
import type { MobMeta } from './content/batch2_mobs';
import { MOVE_DMG } from './content/boss_moves';
import { BAL } from './content/balance';
// Editable gameplay configuration. SEPARATE from save data (see save.ts). All numbers are PLACEHOLDER
// prototype values, not approved balance (spec: "Numerical examples are not approved balance").
export const CONFIG_VERSION = '0.1.0-proto';

export type Slot = 'handL'|'handR'|'armL'|'armR'|'footL'|'footR'|'legL'|'legR'|'torso'|'face'|'brain';
export const SLOTS: Slot[] = ['face','brain','armL','torso','armR','handL','legL','handR','footL','legR','footR'];
export const SLOT_LABEL: Record<Slot,string> = { handL:'Left hand',handR:'Right hand',armL:'Left arm',armR:'Right arm',footL:'Left foot',footR:'Right foot',legL:'Left leg',legR:'Right leg',torso:'Torso',face:'Face',brain:'Brain' };
// Chip socket capacity per body part is fixed regardless of rarity. Spec examples: hand 2, torso 8. Others = PLACEHOLDER.
export const SLOT_SOCKETS: Record<Slot,number> = { handL:2,handR:2,armL:3,armR:3,footL:1,footR:1,legL:3,legR:3,torso:8,face:2,brain:4 };
// Order in which installed hardware abilities are assigned to the 3 ability buttons.
export const ABILITY_SLOT_ORDER: Slot[] = ['armR','armL','handR','handL','torso','brain','face','legL','legR','footL','footR'];

export type Mfr = 'HI'|'PS'|'MM';
export const MFR: Record<Mfr,{name:string;short:string;color:string;accent:string}> = {
  HI:{ name:'Harrow-Brandt Heavy Works', short:'Heavy Industrial', color:'#6e5a4c', accent:'#8f3b2e' },
  PS:{ name:'Aldane Surgical', short:'Precision Surgical', color:'#d3ccb8', accent:'#4f6578' },
  MM:{ name:'Kestrel Value Systems', short:'Mass Market', color:'#7d7f60', accent:'#6b7035' },
};
export type Rarity = 'grey'|'green'|'blue'|'purple'|'orange';
export const RARITIES: Rarity[] = ['grey','green','blue','purple','orange'];
export const RARITY_COLOR: Record<Rarity,string> = { grey:'#b4b6b2', green:'#93b676', blue:'#82aed2', purple:'#b79ccb', orange:'#dd8d42' };
export const RARITY_RANK: Record<Rarity,number> = { grey:0, green:1, blue:2, purple:3, orange:4 };

export interface Stats { maxHp:number; dmg:number; atkSpeed:number; cooling:number; move:number; pickup:number; regen:number; armor:number; }
export const BASE_STATS: Stats = { maxHp:100, dmg:1, atkSpeed:1, cooling:1, move:1, pickup:0, regen:0, armor:0 };

export type AbilityId = 'sweep'|'brace'|'forcedcool'|'cloak'|'bladeburst'|'reposition'|'control'|'pulse'|'revive'|'defib';
export type AimType = 'self'|'direction'|'ground'|'target'|'ally';
export type AbilityType='attack'|'defense'|'hacking'|'mobility';
/** Muted per-type UI colours (oxide red / dirty bone-steel / slate blue / olive; no neon). */
export const ABILITY_TYPE_COLOR: Record<AbilityType,string> = { attack:'#a8483a', defense:'#a39e8a', hacking:'#5f7f9e', mobility:'#7d8a52' };
export const ABILITY_TYPE_LABEL: Record<AbilityType,string> = { attack:'Attack', defense:'Defense', hacking:'Hacking', mobility:'Mobility' };
export const ABILITY_TYPE: Record<AbilityId,AbilityType> = { sweep:'attack', bladeburst:'attack', brace:'defense', forcedcool:'defense', defib:'defense', revive:'defense', control:'hacking', pulse:'hacking', cloak:'mobility', reposition:'mobility' };
export interface AbilityDef { id:AbilityId; type:AbilityType; name:string; aim:AimType; heat:number; cd:number; windup:number; range:number; desc:string; }
export const ABILITIES: Record<AbilityId,AbilityDef> = {
  sweep:{ id:'sweep', type:'attack', name:'Powered Sweep', aim:'direction', heat:24, cd:4, windup:.25, range:3.2, desc:'Wide ripper arc; damages and shoves everything in front.' },
  brace:{ id:'brace', type:'defense', name:'Bracing', aim:'self', heat:14, cd:9, windup:.1, range:0, desc:'Lock the frame: 60% less damage for 3s, no movement penalty.' },
  forcedcool:{ id:'forcedcool', type:'defense', name:'Forced Cooling', aim:'self', heat:0, cd:10, windup:.15, range:0, desc:'Vent 70 heat. Weapons are offline for 2s.' },
  cloak:{ id:'cloak', type:'mobility', name:'Cloak', aim:'self', heat:20, cd:10, windup:.1, range:0, desc:'Enemies lose you for 5s. First strike hits 2x and breaks cloak.' },
  bladeburst:{ id:'bladeburst', type:'attack', name:'Blade Burst', aim:'direction', heat:22, cd:5, windup:.2, range:5.5, desc:'Lunge in a line, cutting through everything.' },
  reposition:{ id:'reposition', type:'mobility', name:'Reposition', aim:'ground', heat:12, cd:6, windup:.1, range:6.5, desc:'Short displacement to an open ground point.' },
  control:{ id:'control', type:'hacking', name:'Enemy Control', aim:'target', heat:30, cd:12, windup:.3, range:9, desc:'Turn an enemy against its squad for 8s. Elites resist (stun only).' },
  pulse:{ id:'pulse', type:'hacking', name:'Disruption Pulse', aim:'ground', heat:20, cd:6, windup:.25, range:8, desc:'Ground burst: damage and 1.2s stun.' },
  revive:{ id:'revive', type:'defense', name:'Team Revival', aim:'ally', heat:18, cd:6, windup:.3, range:7, desc:'Revive a downed teammate (needs a party; inactive solo).' },
  defib:{ id:'defib', type:'defense', name:'Self-Defib', aim:'self', heat:0, cd:0, windup:0, range:0, desc:'Passive: revive in place once per down (hardware stays broken).' },
};

export type ChipId = 'speed'|'cutwide'|'bladepat'|'coolant'|'sustain'|'cloakdur'|'ctrldur'|'magnet'|'power'|'plating'|'ablative'|'fineedge'|'quench'|'overdrive'|'gridlink'|'stride'|'servo';
export interface ChipDef { id:ChipId; name:string; desc:string; stats:Partial<Stats>; mod?:{ ctrlDur?:number; cloakDur?:number; arc?:number; burstLen?:number }; rarity:Rarity; }
export const CHIPS: Record<ChipId,ChipDef> = { ...EXTRA_CHIPS,
  speed:{ id:'speed', name:'Speed Chip', desc:'+15% attack speed. Rippers convert RPM into damage.', stats:{atkSpeed:.15}, rarity:'green' },
  cutwide:{ id:'cutwide', name:'Wide-Cut Pattern', desc:'Ripper/sweep arcs +25% wider.', stats:{}, mod:{arc:.25}, rarity:'blue' },
  bladepat:{ id:'bladepat', name:'Blade Pattern', desc:'Blade burst +1.5 length.', stats:{}, mod:{burstLen:1.5}, rarity:'blue' },
  coolant:{ id:'coolant', name:'Coolant Chip', desc:'+20% cooling rate.', stats:{cooling:.2}, rarity:'green' },
  sustain:{ id:'sustain', name:'Sustain Chip', desc:'+0.8 HP/s regeneration, +6 max HP.', stats:{regen:.8,maxHp:6}, rarity:'green' },
  cloakdur:{ id:'cloakdur', name:'Cloak Duration', desc:'+2s cloak.', stats:{}, mod:{cloakDur:2}, rarity:'blue' },
  ctrldur:{ id:'ctrldur', name:'Control Uptime', desc:'+4s enemy control.', stats:{}, mod:{ctrlDur:4}, rarity:'blue' },
  magnet:{ id:'magnet', name:'Magnet Chip', desc:'+0.7 pickup radius.', stats:{pickup:.7}, rarity:'green' },
  power:{ id:'power', name:'Power Chip', desc:'+12% damage.', stats:{dmg:.12}, rarity:'green' },
  stride:{ id:'stride', name:'Stride Chip', desc:'+6% move speed.', stats:{move:.06}, rarity:'green' },
  servo:{ id:'servo', name:'Servo Chip', desc:'+10% move speed, +1 armor.', stats:{move:.1,armor:1}, rarity:'blue' },
  plating:{ id:'plating', name:'Plating Chip', desc:'+3 armor (flat damage reduction).', stats:{armor:3}, rarity:'green' },
};

// Chip/body-part compatibility (docs/CHIP_SLOT_RULES.md). Every chip declares the body-part groups it fits.
export type SlotGroup = 'hand'|'arm'|'leg'|'foot'|'torso'|'face'|'brain';
export const SLOT_GROUP: Record<Slot,SlotGroup> = { handL:'hand',handR:'hand',armL:'arm',armR:'arm',legL:'leg',legR:'leg',footL:'foot',footR:'foot',torso:'torso',face:'face',brain:'brain' };
export const GROUP_LABEL: Record<SlotGroup,string> = { hand:'Hands',arm:'Arms',leg:'Legs',foot:'Feet',torso:'Torso',face:'Face',brain:'Brain' };
export const CHIP_FITS: Record<ChipId,SlotGroup[]> = {
  speed:['hand','arm'], fineedge:['hand','arm'], power:['hand','arm'], overdrive:['hand','arm'], cutwide:['hand','arm'], bladepat:['hand','arm'],
  coolant:['torso','brain'], quench:['torso','brain'], sustain:['torso','leg'], ablative:['torso','leg'], plating:['torso','leg'],
  cloakdur:['torso','face'], ctrldur:['brain','face'], gridlink:['brain','face'], magnet:['face','foot'], stride:['leg','foot'], servo:['leg','foot'] };
export const chipFits=(c:ChipId,sl:Slot):boolean=>!!CHIP_FITS[c]?.includes(SLOT_GROUP[sl]);
export const chipFitLabel=(c:ChipId):string=>CHIP_FITS[c].map(g=>GROUP_LABEL[g]).join(' / ');
export const chipReason=(c:ChipId,sl:Slot):string=>chipFits(c,sl)?'':`${CHIPS[c].name} fits ${chipFitLabel(c)}, not ${SLOT_LABEL[sl]}.`;

export type WeaponKind = 'fist'|'ripper'|'blade'|'slug'|'popper'|'autopistol'|'burst'|'shard'|'arc';
export interface WeaponDef { kind:WeaponKind; dmg:number; rate:number; range:number; arc:number; heat:number; stationary?:boolean; proj?:boolean; /** ranged extras */ burst?:number; burstGap?:number; pellets?:number; spread?:number; pspeed?:number; plife?:number; chain?:number; chainR?:number; label?:string; }
export const WEAPON_RARITY_MUL:Record<Rarity,number> = { grey:1, green:1.1, blue:1.25, purple:1.45, orange:1.75 };
export const WEAPONS: Record<WeaponKind,WeaponDef> = {
  fist:{ kind:'fist', dmg:10, rate:1.6, range:1.5, arc:Math.PI*.8, heat:1.0 },
  ripper:{ kind:'ripper', dmg:16, rate:1.8, range:2.0, arc:Math.PI*.9, heat:2.0 },
  blade:{ kind:'blade', dmg:12, rate:3.0, range:1.8, arc:Math.PI*.6, heat:1.6 },
  slug:{ kind:'slug', dmg:30, rate:1.5, range:8.5, arc:0, heat:3.4, stationary:true, proj:true, label:'Slug driver (stand still)' },
  // Ranged: all fire while moving (only the slug driver is stationary). Auto-targeted like every auto attack.
  popper:{ kind:'popper', dmg:6, rate:1.7, range:5, arc:0, heat:.5, proj:true, pspeed:15, plife:.5, label:'Pop pistol (starter)' },
  autopistol:{ kind:'autopistol', dmg:7.5, rate:3.2, range:6.5, arc:0, heat:.9, proj:true, pspeed:19, plife:.45, label:'Auto-pistol' },
  burst:{ kind:'burst', dmg:9, rate:.95, range:9, arc:0, heat:1.0, proj:true, burst:3, burstGap:.07, pspeed:26, plife:.5, label:'Burst rifle (3-round)' },
  shard:{ kind:'shard', dmg:5.5, rate:1.15, range:5.5, arc:0, heat:2.6, proj:true, pellets:5, spread:.5, pspeed:17, plife:.38, label:'Shard thrower (scatter)' },
  arc:{ kind:'arc', dmg:11, rate:1.5, range:6.5, arc:0, heat:2.4, chain:3, chainR:3.2, label:'Chain-arc caster (hitscan chain)' },
};

export type ItemKind = 'hardware';
export interface ItemDef { id:string; name:string; slot:Slot; mfr:Mfr; rarity:Rarity; lvl:number; stats:Partial<Stats>; abilities?:AbilityId[]; weapon?:WeaponKind; caps?:('force'|'hack'|'cloak'|'defib')[]; authoredException?:boolean; blurb?:string; }
const H = (id:string,name:string,slot:Slot,mfr:Mfr,rarity:Rarity,lvl:number,stats:Partial<Stats>,x:Partial<ItemDef>={}):ItemDef=>({id,name,slot,mfr,rarity,lvl,stats,...x});
export const ITEMS: ItemDef[] = [
  // --- Stock baseline hardware (grey), one per slot: "baseline hardware, not empty slots" ---
  ...SLOTS.map(s=>H('stock_'+s, 'Standard Issue '+SLOT_LABEL[s], s, 'MM','grey',1,{ maxHp: s==='torso'?10:2 }, s==='handR'?{weapon:'popper'}:{})),
  // --- Heavy industrial (ripper + cooling) ---
  H('hi_ripper_arm','HB-40 Ripper Arm','armR','HI','blue',10,{dmg:.08,armor:2},{abilities:['sweep'],caps:['force'],blurb:'Shoulder-mounted saw assembly. Opens armory shutters.'}),
  H('hi_cutting_head','HB-12 Cutting Head','handR','HI','blue',10,{atkSpeed:.05},{weapon:'ripper',blurb:'Attachment-convention test: separate cutting head on the arm.'}),
  H('hi_clamp','HB-9 Bellows Clamp','handL','HI','green',8,{armor:2,maxHp:8}),
  H('hi_legs_l','HB Loadbearer Leg (L)','legL','HI','green',8,{maxHp:14,armor:1}),
  H('hi_legs_r','HB Loadbearer Leg (R)','legR','HI','green',8,{maxHp:14,armor:1}),
  H('hi_torso_cool','HB Thermal Exchange Chassis','torso','HI','blue',10,{cooling:.25,maxHp:20,regen:.6},{abilities:['brace','forcedcool'],blurb:'Cooling torso: bracing frame plus forced venting.'}),
  H('hi_torso_green','HB Frame Mk1','torso','HI','green',6,{maxHp:24,armor:1}),
  // --- Precision surgical (cloak + blade) ---
  H('ps_blade_arm','AS Fan-Blade Arm','armR','PS','blue',10,{dmg:.06},{abilities:['bladeburst'],blurb:'Flush ceramic shell with a blade-ended assembly.'}),
  H('ps_blade_hand_r','AS Scalpel Hand (R)','handR','PS','blue',10,{atkSpeed:.1},{weapon:'blade'}),
  H('ps_blade_hand_l','AS Scalpel Hand (L)','handL','PS','green',8,{atkSpeed:.05,dmg:.03}),
  H('ps_veil_torso','AS Veil Torso','torso','PS','blue',10,{cooling:.1,maxHp:8},{abilities:['cloak'],caps:['cloak'],blurb:'Sensor-dampening cloak weave.'}),
  H('ps_legs_l','AS Strider Leg (L)','legL','PS','blue',10,{move:.1},{abilities:['reposition']}),
  H('ps_legs_r','AS Strider Leg (R)','legR','PS','green',8,{move:.08}),
  H('ps_brain','AS Cortex Link Mk2','brain','PS','blue',10,{cooling:.1},{abilities:['control'],caps:['hack'],blurb:'Hacking brain: terminal access and enemy control.'}),
  H('ps_face','AS Seamless Faceplate','face','PS','green',8,{armor:1,pickup:.2}),
  // --- Mass market (neural control + refurbished tools) ---
  H('mm_slug_hand','Kestrel Slug Driver','handR','MM','green',8,{dmg:.04},{weapon:'slug',blurb:'Heavy ranged tool: must stand still to fire.'}),
  H('mm_arm_l','Kestrel Refab Emitter Arm','armL','MM','green',8,{cooling:.05},{abilities:['pulse']}),
  H('mm_torso_defib','Kestrel Defib Rack','torso','MM','green',8,{maxHp:12,regen:.3},{abilities:['revive','defib'],caps:['defib']}),
  H('mm_arm_r','Kestrel Refab Arm (R)','armR','MM','green',6,{maxHp:6}),
  // --- Authored signature items (boss drops; authored Easter-egg exceptions to the high-level-only orange rule) ---
  H('sig_audit_core','Audit Core','brain','PS','orange',12,{cooling:.3,dmg:.1,regen:.5},{abilities:['control','pulse'],caps:['hack'],authoredException:true,blurb:'Neural Warden signature. Control + pulse in one brain.'}),
  H('sig_reclaimer_ripper','Reclaimer Ripper','armR','HI','orange',12,{dmg:.2,armor:4},{abilities:['sweep','bladeburst'],caps:['force'],authoredException:true,blurb:'Reclamation Enforcer signature. Sweep and lunge.'}),
  // --- Ordinary pool filler across rarities (levels vary to demo the level filter) ---
  H('pool_g_torso','Salvaged Torso Plate','torso','MM','grey',3,{maxHp:12}),
  H('pool_g_legs','Scrap Gait Leg','legL','MM','grey',4,{maxHp:6}),
  H('pool_gr_face','Kestrel Optic Housing','face','MM','green',7,{pickup:.3}),
  H('pool_b_foot','AS Damped Foot (L)','footL','PS','blue',11,{move:.06,armor:1}),
  H('pool_b_arm','HB Piston Arm (L)','armL','HI','blue',11,{dmg:.06,maxHp:10}),
  H('pool_p_hand','HB Rotor Hand (R)','handR','HI','purple',14,{dmg:.12,atkSpeed:.1},{weapon:'ripper'}),
  H('pool_p_torso','AS Lattice Torso','torso','PS','purple',15,{maxHp:30,cooling:.2,dmg:.05}),
  H('pool_o_legs','HB Bastion Legs','legR','HI','orange',20,{maxHp:40,armor:5}),
];
ITEMS.push(...EXTRA_ITEMS, ...WEAPON_ITEMS, ...IDKFA_ITEMS);
export const ITEM_BY_ID: Record<string,ItemDef> = Object.fromEntries(ITEMS.map(i=>[i.id,i]));

// Install cost depends on the hardware being REMOVED (spec). PLACEHOLDER curve.
export const INSTALL_COST: Record<Rarity,number> = { grey:0, green:12, blue:80, purple:400, orange:2500 };
export const SELL_VALUE: Record<Rarity,number> = { grey:5, green:25, blue:110, purple:500, orange:3000 };
export const REPAIR_COST: Record<Rarity,number> = { grey:5, green:20, blue:60, purple:200, orange:800 };

// Manufacturer mixing: soft penalty per extra manufacturer; hard conflicts block install.
export const MIX_PENALTY = { coolingPerExtraMfr: .08, reputationRankReduces: .02 };
export const HARD_CONFLICTS: { a:string; b:string; reason:string }[] = [
  { a:'hi_ripper_arm', b:'ps_veil_torso', reason:'Ripper vibration defeats the Veil weave. Hard conflict (unchanged by reputation).' },
  { a:'sig_reclaimer_ripper', b:'ps_veil_torso', reason:'Ripper vibration defeats the Veil weave. Hard conflict (unchanged by reputation).' },
  ...EXTRA_CONFLICTS,
];
export const REP_RANKS = [0, 10, 30, 60]; // points for rank 0..3
export const REP_DISCOUNT_PER_RANK = .05;

export const COMBAT = {
  playerSpeed: 5.6, playerRadius: .38, baseHp: 100,
  dodge: { cd: 1.1, dist: 3.2, time: .22, iframes: .34 },
  heat: { max:100, passiveCool: 9, overheatRecover: 35, overheatSpeedMult: .8, overheatDmgMult: .5, attackCooldownHalf:true },
  checkpointRestoreImmunity: true,
  pickupRadius: 1.7, missionSlots: 16,
  townChannel: 5.0,
  downReturnDelay: 1.5,
  bossRevealSeconds: 9,
  autoTargetRange: 9, // closest eligible enemy auto attack acquisition
  stimHeal: 45,
};

export interface EnemyDef { id:string; name:string; hp:number; speed:number; radius:number; mfr:Mfr; elite?:boolean; boss?:boolean; ranged?:boolean; static?:boolean; aggro:number; xp:number; rep:number; attacks:string[]; dmgMul?:number; summon?:string; /** batch-2 mob metadata (tier, role, shield, keep-away distance...) */ mob?:MobMeta; keep?:number; }
export const ENEMIES: Record<string,EnemyDef> = {
  ...EXTRA_ENEMIES, ...BATCH1_ENEMIES, ...BATCH2_ENEMIES,
  worker:{ id:'worker', name:'Salvage Worker', hp:10, speed:3.0, radius:.36, mfr:'MM', aggro:7, xp:6, rep:1, attacks:['swing'] },
  shooter:{ id:'shooter', name:'Security Contractor', hp:10, speed:2.6, radius:.36, mfr:'MM', ranged:true, aggro:9, xp:8, rep:1, attacks:['shot'] },
  turret:{ id:'turret', name:'Gate Turret', hp:70, speed:0, radius:.5, mfr:'HI', static:true, ranged:true, aggro:10, xp:15, rep:2, attacks:['turretshot'] },
  sawhand:{ id:'sawhand', name:'Sawhand Reclaimer', hp:420, speed:3.1, radius:.6, mfr:'HI', elite:true, aggro:9, xp:60, rep:8, attacks:['cleave','charge'] },
  foreman:{ id:'foreman', name:'Salvage Foreman', hp:300, speed:3.2, radius:.55, mfr:'MM', elite:true, aggro:9, xp:45, rep:8, attacks:['cleave'] },
  overseer:{ id:'overseer', name:'Annex Overseer', hp:2000, speed:2.8, radius:.9, mfr:'MM', boss:true, elite:true, aggro:30, xp:300, rep:25, attacks:['slam','charge','summon'] },
  warden:{ id:'warden', name:'Neural Warden', hp:1700, speed:2.4, radius:.8, mfr:'PS', boss:true, elite:true, ranged:true, aggro:30, xp:340, rep:25, attacks:['zones','volley'] },
  enforcer:{ id:'enforcer', name:'Reclamation Enforcer', hp:1900, speed:3.0, radius:.95, mfr:'HI', boss:true, elite:true, aggro:30, xp:340, rep:25, attacks:['rsweep','charge'] },
};
export const ENEMY_DMG: Record<string,number> = { swing:12, shot:10, turretshot:14, cleave:28, charge:34, slam:34, summon:0, zones:6, volley:16, rsweep:32, ...EXTRA_ENEMY_DMG, ...MOVE_DMG, ...MOB_DMG };
// balance pass (src/content/balance.ts): the four original dungeon bosses are tuned here; batch-1 bosses and batch-2 mobs apply BAL where their defs are generated
for(const k of ['overseer','teague','surgeon','stockmgr']){ const m=BAL.boss[k], d=ENEMIES[k]; if(m&&d){ d.hp=Math.round(d.hp*(m.hp??1)); d.dmgMul=(d.dmgMul??1)*(m.dmg??1); } }

// Progression placeholders (NOT a 100h curve; see README).
export const PROGRESSION = { startLevel:12, maxLevel:60, xpForLevel:(l:number)=>Math.round(60*Math.pow(l,1.45)) };
export const DUNGEON_TIER_MAX_ITEM_LEVEL = 20;
export const INSTANCE_RETENTION_HOURS = 24;
export const INSTANCE_WARN_MINUTES = 30;

// Loot tables. Personal rolls; filtered per recipient level (ineligible => no drop, NOT rerolled downward).
export interface LootEntry { item?:string; chip?:ChipId; stim?:boolean; w:number; }
export const LOOT = {
  ordinary: { chance:.16, credits:[2,9] as [number,number], pool:[
    {item:'pool_g_torso',w:6},{item:'pool_g_legs',w:6},{item:'pool_gr_face',w:5},{item:'hi_torso_green',w:3},{item:'hi_legs_l',w:3},{item:'hi_legs_r',w:3},
    {chip:'speed',w:5},{chip:'coolant',w:5},{chip:'sustain',w:5},{chip:'magnet',w:4},{chip:'stride',w:4},{chip:'power',w:4},{chip:'plating',w:4},{stim:true,w:8},
    {item:'mm_autopistol',w:1.2},{item:'pool_b_foot',w:1.2},{item:'pool_b_arm',w:1.2},{item:'pool_p_hand',w:.3},{item:'pool_o_legs',w:.05} ] as LootEntry[] },
  elite: { chance:1, credits:[30,60] as [number,number], pool:[
    {item:'hi_ripper_arm',w:2},{item:'ps_blade_arm',w:2},{item:'ps_veil_torso',w:2},{item:'ps_brain',w:2},{item:'ps_legs_l',w:2},{item:'hi_cutting_head',w:2},{item:'ps_needle_rifle',w:1.2},{item:'hi_shard_arm',w:1.2},{item:'mm_shocktack',w:1.2},
    {chip:'cutwide',w:3},{chip:'bladepat',w:3},{chip:'cloakdur',w:3},{chip:'ctrldur',w:3},{chip:'speed',w:3},{chip:'servo',w:2},{item:'pool_p_hand',w:.8},{item:'pool_p_torso',w:.6},{item:'pool_o_legs',w:.1},{stim:true,w:3} ] as LootEntry[] },
  boss: { chance:1, rolls:3, credits:[120,200] as [number,number], pool:[
    {item:'hi_torso_cool',w:3},{item:'mm_slug_hand',w:2},{item:'ps_needle_rifle',w:1},{item:'hi_shard_arm',w:1},{item:'mm_arm_l',w:2},{item:'mm_torso_defib',w:2},{item:'ps_blade_hand_r',w:2},{item:'ps_blade_hand_l',w:2},
    {chip:'cutwide',w:2},{chip:'ctrldur',w:2},{chip:'bladepat',w:2},{chip:'cloakdur',w:2},{chip:'coolant',w:2},{item:'pool_p_torso',w:1},{stim:true,w:3} ] as LootEntry[] },
  signature: { warden:{ item:'sig_audit_core', chance:.12 }, enforcer:{ item:'sig_reclaimer_ripper', chance:.12 } } as Record<string,{item:string;chance:number}>,
};

/** Baseline abilities when no installed hardware provides any (stock Standard Issue body), so a fresh character can act. */
export const STARTER_ABILITIES:AbilityId[]=['sweep','brace','reposition'];
export const STARTING = { credits:600, chips:{ speed:2, coolant:2, sustain:2, power:1 } as Partial<Record<ChipId,number>>, lockerSlots:60, lockerPerPurchase:20 };

/** Desktop UI text scale. CSS reads --fs / --fmin (set by applyUiScale on :root); canvas text reads uiFs()/minPx(). Touch stays 1 / 12px.
 *  Baseline is DESKTOP_FS (1.1x the original touch sizes) at Medium; the viewport adds at most ~10% (at 1440p). */
export const UI_SIZES={ S:.92, M:1, L:1.12, XL:1.25 } as const; export type UiSize=keyof typeof UI_SIZES;
export const DESKTOP_FS = 1.1, DESKTOP_MIN = 12;
let curSize:UiSize='M', curFs=DESKTOP_FS, curMin=DESKTOP_MIN;
export function applyUiScale(size?:UiSize){ if(size) curSize=size; const raw=typeof innerWidth==='undefined'?1:Math.max(1,Math.min(innerWidth/1280,innerHeight/720)); const vf=Math.min(1.1,1+(raw-1)*.1);
  curFs=+(DESKTOP_FS*UI_SIZES[curSize]*vf).toFixed(3); curMin=Math.round(DESKTOP_MIN*UI_SIZES[curSize]*vf*10)/10; if(typeof document!=='undefined'){ const r=document.documentElement.style; r.setProperty('--fs',String(curFs)); r.setProperty('--fmin',curMin+'px'); } }
export function uiFs(): number { return typeof document!=='undefined' && document.body && document.body.classList.contains('touch') ? 1 : curFs; }

/** Minimum canvas text size in px (desktop ~16 at Large, touch 12). Every ctx.font in the HUD layer goes through cpx(). */
export function minPx(): number { return uiFs()===1 ? 12 : curMin; }
export function cpx(n:number): number { return Math.round(Math.max(minPx(), n)); }
