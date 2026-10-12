import { progressTick, objectiveStep, unstuck } from './progress';
import { PROFILES } from './abilities/vfxprofile';
import { GORE } from './gore';
import { SFX } from './abilities/sfxprofile';
import { VFX } from './vfx';
import { AB, key, ABILITIES, AbilityDef, AbilityId, COMBAT, ENEMIES, ENEMY_DMG, EnemyDef, ITEM_BY_ID, LOOT, LootEntry, REPAIR_COST, SLOTS, Slot, Rarity, RARITY_RANK, PROGRESSION, ChipId, Stats, WeaponDef, DUNGEON_TIER_MAX_ITEM_LEVEL, SELL_VALUE, CHIPS, INSTANCE_WARN_MINUTES , DROP, DROP_RATE_SCALE, STARTING, STARTER_ABILITIES} from './config';
import { HEAT, effCooling, heatCost, cdAfter, throttle, dissipation } from './heat';
import { counterFor, hintText } from './content/abilfx';
import { bankOverflowItem, bankOverflowChip } from './bank';
import { computeBuild, installedLayout, BuildResult, abPickRef, repRank } from './build';
import { abxCast, abxTick, abxReset, abxIncoming, abxOutgoing, abxSpeedMul, abxPlayerSpeed, newAbx, Abx } from './abilities/engine';
import { ABILITY_BY_ID } from './abilities/registry';
import { ABILITY_ACQ, ABILITY_ITEMS, pickAbilityItem, pickCommonAbilityItem } from './abilities/hw';
import { buildTownLevel, stationsOf } from './worldtowns';
import { WORLD_BY_ID } from './world';
import { visitTown, landmarkNear, outOfDepth, FACTION_MFR, FIRST_VISIT_REP } from './discovery';
import { currentTown, refreshUnlocks, travelCheck, TOWN_INFO, townsOf, type TownId } from './towns';
import { setTownStations, TOWN_STATIONS } from './stations';
import { buildTown, Level, Interact } from './level';
import { dungeonOf, DungeonDef, unlockReason } from './content/dungeons';
import { MOVES, MOVE_ATK } from './content/boss_moves';
import { BOSS_BY_ID } from './content/batch1_bosses';
import { HARD, applyHard } from './content/hardmode';
import { rollCosmetic, checkAchievements, COS_SLOT_LABEL } from './content/appearance';
import { DUNGEONS } from './content/dungeons';
import { kitTick, KITS, palOf } from './content/boss_kits';
import { tickZone, endZones } from './content/zoneshape';
import type { ZX } from './content/zoneshape';
import { movePattern, resolveMove, bossTick, filterDamage, clearBossAdds } from './content/mechanics';
import { mobTick, mobDeath, mobAfterHit, resolveMobAttack, mobPattern, MOB_COND } from './content/mobs';
import { MOB_ATK } from './content/batch2_mobs';
import { CONTRACT_BY_ID, Goal } from './content/npcs';
import { LAYOUT_V, Save, InstanceState, EnemyState, Drop, mkInst, persist, todayStr, retentionMs, Carried, Inst, lockDay, setLockDay, contractState, capacityUsed } from './state';
import { idkfaActive, idkfaEnable, idkfaDisable } from './idkfa_toggle';
import { BAL } from './content/balance';
import { record, newStory, EventKind } from './story';

export const TOWN_KEY=key('town');
export type Emit = (type:string, payload?:any)=>void;
export interface Proj { x:number; y:number; vx:number; vy:number; dmg:number; r:number; life:number; faction:'enemy'|'ally'; kind:'bolt'|'slug'|'pop'|'pistol'|'needle'|'shard'; c?:string; }
export interface Zone extends ZX { x:number; y:number; r:number; t:number; life:number; dps:number; heat:number; windup:number; env?:boolean; }
export interface Fx { kind:'slash'|'ring'|'burst'|'line'|'spark'|'blood'|'text'|'dust'|'vent'|'ability'; x:number; y:number; a?:number; r?:number; t:number; life:number; text?:string; vx?:number; vy?:number; c?:string; len?:number; w?:number; s?:number; pop?:number; }
export interface AimState { idx:number; wx:number; wy:number; hasDir:boolean; }
export interface Rt { wake?:number; hardDmg?:number; taunt?:number; rcA?:number; rcM?:number; rcT?:number; // enemy transient runtime fields
  /** content batch 1 boss mechanics (src/content/mechanics.ts) */ spdMul?:number; cdMul?:number; shield?:any; gim?:any; gimT?:number; q?:any[]; pylPrev?:number; tl?:number;
  st:'idle'|'chase'|'tele'|'rec'|'dash'|'lost'; t:number; atk:string; acd:Record<string,number>; ang:number; tx:number; ty:number; lost:number; vuln:number; hack:number; abHitAt:number; reveal:number; bornT:number; fire:number; shots:{x:number;y:number}[]; hit:number; fkT?:number; fkN?:number; flankSide?:number; flanker?:boolean; wpT?:number; wp?:{x:number;y:number}|null; sx?:number; sy?:number; sT?:number; unstick?:number; side?:number; dashed:boolean; strafe:number; chained?:boolean;
}
export type En = EnemyState & { _rt:Rt };

const dist=(ax:number,ay:number,bx:number,by:number)=>Math.hypot(ax-bx,ay-by);
/** calm start tuning (docs/SAFE_START.md) */ export const GRACE={ seconds:5, moveR:8, reentryR:12, staggerUntil:180, wakeBase:.25, wakeStep:.3, wakeMax:1.5 };
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const angDiff=(a:number,b:number)=>{ let d=a-b; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2; return d; };
export const ISO = { toWorld(sx:number,sy:number,tw:number){ const a=sx/(tw/2), b=sy/(tw/4); return { x:(a+b)/2, y:(b-a)/2 }; }, vec(dx:number,dy:number){ const a=dx, b=dy*2; const x=(a+b)/2, y=(b-a)/2; const l=Math.hypot(x,y)||1; return { x:x/l, y:y/l }; } };

const LOOT_CLEAR=.42;
applyHard(ENEMIES,DUNGEONS);
export class Game {
  save:Save; level:Level; mode:'town'|'run'='town'; inst:InstanceState|null=null; emit:Emit;
  enemies:En[]=[]; projs:Proj[]=[]; zones:Zone[]=[]; fx:Fx[]=[]; time=0; pickFx:{id:number;x:number;y:number;kind:Drop['kind'];inst?:Drop['inst'];chip?:Drop['chip'];amount:number;t0:number}[]=[];
  // player
  bankedOverflow=0; px=0; py=0; face=0; hp=100; heat=0; overheated=false; overheats=0; vents=0; ohT=0; ventCd=0; ventLock=0; heatSoak=0; dodgeT=0; dodgeCd=0; iframes=0; dodgeDx=0; dodgeDy=0; atkCd=0; weaponOff=0; cloakT=0; braceT=0; slowT=0; downed=false; downT=0; defibCd=0; revealing=false;
  /** ability power pass: damage dealt per source tag ('auto' or ability id), cast counts, synergy state */ kick=0; lastStop=-9; _band='ok'; curTag='auto'; dealt:Record<string,number>={}; casts:Record<string,number>={}; comboN=0; comboT=0; lastAb=''; ovT=0; hitStop=0; sinceAb=0; nudgeCd=0;
  abx:Abx=newAbx(); codexT=0;
  abCd:number[]=[0,0,0]; cast:{ idx:number; t:number; aim:AimState; ab:AbilityDef }|null=null; aim:AimState|null=null; target:number|null=null; lungeT=0; lungeDx=0; lungeDy=0; lungeHit:Set<number>=new Set();
  slideT=0; slideFx=0; slideFy=0; channel:{ kind:'town'|'hack'; t:number; dur:number; cb:()=>void; hard?:boolean }|null=null; townFails=0;
  inputMove={x:0,y:0}; build!:BuildResult; moving=false; prompt:Interact|null=null; musicState='traversal'; combatHold=0; eliteEng=0; toastQ:string[]=[];
  dbg:{god:boolean;oneShot:boolean;noHitStop:boolean;noGrace?:boolean}={god:false,oneShot:false,noHitStop:false};
  /** calm start (docs/SAFE_START.md): while set, enemies are dormant and the player cannot be hurt. Ends on time, first attack/ability/dodge, or moving GRACE.moveR tiles. `ext`: ended by an owner (party world) instead of this Game. */
  grace:{t:number;x:0|number;y:number;acted:boolean;ext:boolean}|null=null;
  flow:Int16Array|null=null; flows:(Int16Array|null)[]=[null,null,null]; clr:(Uint8Array|null)[]=[null,null,null]; clrLevel:Level|null=null; q:Int32Array|null=null; frame=0; flowT=0; kills=0; saveT=0; sensorFlag=false; lastRoute='';
  constructor(save:Save, emit:Emit){ this.save=save; this.emit=emit; this.level=buildTown(); this.migrateInstance(); this.recompute(); this.enterTown(true); }

  // ---------- build / stats ----------
  recompute(){ const L=installedLayout(this.save); abPickRef.v=this.save.abPick||null; this.build=computeBuild(L,this.save.level,this.save.rep,this.inst?this.inst.broken:[]); const mx=this.build.stats.maxHp; if(this.hp>mx||this.hp<=0&&!this.downed) this.hp=mx; }
  get maxHp(){ return this.build.stats.maxHp; }
  toast(s:string){ this.emit('toast',s); }
  now(){ return Date.now(); }

  // ---------- mode transitions ----------
  enterTown(first=false){
    const wasRun=this.mode==='run'; this.settleCompleted();
    if(this.mode==='run'&&this.inst){ const aq=(this.save.abAcq=this.save.abAcq||{total:0,dry:0}); if((this.inst as any).abGot) aq.dry=0; else aq.dry++; } abxReset(this); this.clearTransients();
    const tid=currentTown(this.save); this.townId=tid; setTownStations(stationsOf(tid)); this.mode='town'; this.level=buildTownLevel(tid); this.enemies=[]; this.projs=[]; this.zones=[]; this.fx=[]; { const sp=(!first&&this.level.returnSpawn)||this.level.spawn; this.px=sp.x; this.py=sp.y; } this.channel=null; this.townFails=0; this.cast=null; this.aim=null; this.target=null; this.downed=false; this.revealing=false;
    this.recompute(); this.hp=this.maxHp; this.heat=0; this.overheated=false; this.cloakT=0; this.musicSet('town'); this.emit('towntheme',tid); this.checkTownUnlocks(); if(this.inst) persist(this.save); this.emit('mode','town'); this.worldArrive(); if(!first) this.toast('Back in town. Unload loot at the locker.'); if(!first&&wasRun) this.emit('beat',{dungeon:this.save.instance?.dungeon||undefined,run:this.save.instance?.id,result:this.save.instance?.flags?.bossDead?'Boss defeated':'Left the run early'});
  }
  townId:TownId='rustline';
  /** world discovery (src/discovery.ts): first-visit XP + faction nod, the fixer's out-of-depth line, landmark log */
  worldArrive(){ const id=this.townId, t=WORLD_BY_ID[id]; if(!t) return; const xp=visitTown(this.save,id); if(xp){ this.addXp(xp); const m=FACTION_MFR[t.faction]; if(m) this.save.rep[m]+=FIRST_VISIT_REP; this.toast(`Discovered ${t.name}: +${xp} XP${m?' · '+t.faction+' noticed you':''}.`); persist(this.save); }
    const line=outOfDepth(this.save.level,id); if(line) this.emit('toast','Odalys: '+line); }
  worldScan(){ const L:any=this.level; const xp=landmarkNear(this.save,this.townId,this.px,this.py,L.landmark); if(xp){ this.addXp(xp); this.toast(`Landmark logged: ${L.landmark.name} (+${xp} XP).`); persist(this.save); } }
  /** Unlock towns whose condition is newly met (clears, level ups, load). Returns the ids unlocked now. */
  checkTownUnlocks():TownId[]{ const n=refreshUnlocks(this.save); for(const id of n){ this.toast(`New destination: ${TOWN_INFO[id].name}. Take the Reach Line at the plaza tram stop.`); persist(this.save); } return n; }
  /** Ride the Reach Line to another town (free, instant; town only). */
  /** station key of the vendor screen last opened in town (Forge Repair gives Heavy Works discounts) */
  vendorStation=''; 
  /** repair price multiplier: Forge Repair (Harrow) takes 20% off, plus 5% per installed Heavy Works (HI) part, capped at 50% off */
  repairRate():number{ if(this.townId!=='harrow'||this.vendorStation!=='h_repair') return 1; let hi=0; for(const u of Object.values(this.save.installed)){ const it=this.save.items.find(i=>i.uid===u); if(it&&ITEM_BY_ID[it.def]?.mfr==='HI') hi++; } return 1-Math.min(.5,.2+.05*hi); }
  repairCost(bill=this.save.repairBill):number{ return Math.ceil(bill*this.repairRate()); }
  /** set by main.ts: warms the destination town's art (used by the travel screen) */
  townPreload?:(id:TownId)=>Promise<void>;
  travel(id:TownId):boolean{ if(this.mode!=='town') return false; const c=travelCheck(this.save,id); if(!c.ok){ this.toast(c.why); return false; } this.save.town=id; persist(this.save); this.enterTown(true); this.toast(`Arrived at ${TOWN_INFO[id].name}.`); return true; }
  hasLiveInstance(){ return !!this.inst && this.inst.expiresAt>this.now(); }
  dailyLocked(id='annex'){ return lockDay(this.save,id)===todayStr(); }
  get dd():DungeonDef{ return dungeonOf(this.inst?.dungeon); }
  envZones():Zone[]{ return this.mode==='run'?(this.level.hazards||[]).map(h=>({x:h.x,y:h.y,r:h.r,t:0,life:1e9,dps:h.dps,heat:h.heat,windup:0,env:true})):[]; }
  startRun(id='annex',fixedSeed?:number){
    const s=this.save;
    if(s.instance && s.instance.expiresAt<=this.now()){ this.expireInstance(); }
    if(s.instance&&s.instance.layoutV!==LAYOUT_V&&s.instance.expiresAt>this.now()){ this.expireInstance(); this.toast('Dungeon layouts changed: your old instance was discarded.'); }
    if(s.instance&&this.instDone(s.instance)&&(s.instance.dungeon||'annex')!==id){ if(!this.retireForNew(id)) return false; }
    if(s.instance){ const cur=s.instance.dungeon||'annex'; if(cur!==id){ this.toast('You have a live instance in '+dungeonOf(cur).name+'. Re-enter or abandon it before starting another.'); return false; } this.inst=s.instance; this.resumeInstance(); return true; }
    { const lk=unlockReason(this.save,id,!!this.save.settings.devFreeReset); if(lk){ this.toast(lk); return false; } }
    if(this.dailyLocked(id)){ this.toast('Daily clear used for '+dungeonOf(id).name+'. A fresh run unlocks tomorrow (dev panel can reset).'); return false; }
    const dd=dungeonOf(id); const seed=fixedSeed!==undefined?fixedSeed:(Math.random()*1e9)|0; const lv=dd.build(seed);
    const inst:InstanceState={ id:'inst-'+seed, dungeon:id, layoutV:LAYOUT_V, createdAt:this.now(), expiresAt:this.now()+retentionMs, seed, enemies:[], drops:[], carried:{items:[],chips:{},stims:0,credits:0},
      flags:{gate1:false,lock2:false,passageSeen:false,controller:false,armory:false,cond:null,bossKey:null,bossRevealed:false,bossSpawned:false,bossDead:false,completed:false,rewardsGranted:false,alarm:false,salvageForeman:false},
      checkpoint:{id:1,x:lv.checkpoints[0].x,y:lv.checkpoints[0].y}, px:lv.spawn.x, py:lv.spawn.y, hp:0, broken:[], protectedSlots:[], repairAdded:0, nextId:1, xpEarned:0, warned:false, kills:{}, claimed:[], elapsed:0 };
    for(const sp of lv.spawns){ inst.enemies.push({ id:inst.nextId++, type:sp.type, x:sp.x+.5, y:sp.y+.5, hp:ENEMIES[sp.type].hp*this.hpMul(), maxHp:ENEMIES[sp.type].hp*this.hpMul(), alert:false, dead:false, home:{x:sp.x+.5,y:sp.y+.5}, group:sp.group, faction:'enemy', ctrlT:0, stunT:0, ...((sp as any).affix?{affix:(sp as any).affix}:{}) }); }
    { const n=Math.min(2,s.stims); inst.carried.stims=n; s.stims-=n; }
    s.instance=inst; this.inst=inst; s.stats.runs++; this.resumeInstance(true); if(s.level<dd.minLevel-2) this.toast('Warning: '+dd.name+' is recommended for Lv '+dd.minLevel+'+ (you are Lv '+s.level+'). Press '+key('town')+' any time to leave, or use Abandon in the menu.'); return true;
  }
  resumeInstance(fresh=false){
    const inst=this.inst!; abxReset(this); this.clearTransients(); this.mode='run'; this.level=dungeonOf(inst.dungeon).build(inst.seed); this.projs=[]; this.zones=this.envZones(); this.fx=[]; this.target=null; this.cast=null; this.aim=null; this.channel=null; this.townFails=0; this.downed=false; this.revealing=false;
    this.lastZone=''; this.zoneShown={}; this.zoneAnyAt=-1e9; this.pathWp=null; this.applyDoors(); this.progT=0; this.progKey=''; this.progPulled=false; this.progScan=0;
    if(!fresh&&!inst.enemies.length&&!this.instDone(inst)&&!inst.flags.bossDead&&!inst.flags.bossSpawned){ /* repair an instance whose enemy list was wiped by an old save-in-town bug: respawn the roster */ const lv=this.level; inst.enemies=[]; for(const sp of lv.spawns){ inst.enemies.push({ id:inst.nextId++, type:sp.type, x:sp.x+.5, y:sp.y+.5, hp:ENEMIES[sp.type].hp*this.hpMul(), maxHp:ENEMIES[sp.type].hp*this.hpMul(), alert:false, dead:false, home:{x:sp.x+.5,y:sp.y+.5}, group:sp.group, faction:'enemy', ctrlT:0, stunT:0, ...((sp as any).affix?{affix:(sp as any).affix}:{}) }); } }
    this.enemies=inst.enemies.map(e=>this.wrap(e));
    for(const e of this.enemies){ const r=ENEMIES[e.type]?.radius||.4; this.snapWalkable(e,r); if(e.home&&this.stranded(e.home.x,e.home.y,r)) e.home={x:e.x,y:e.y}; }
    // Boss attempts always replay the full reveal: reset a living boss on (re)entry.
    this.resetBossIfAlive(); this.fixStuckDrops();
    const cp=this.level.checkpoints[0]; this.px=fresh?this.level.spawn.x:cp.x; this.py=fresh?this.level.spawn.y:cp.y; { const me={x:this.px,y:this.py}; if(this.snapWalkable(me,COMBAT.playerRadius)){ this.px=me.x; this.py=me.y; } }
    if(!fresh && (inst.checkpoint.id!==1)){ /* re-entry always from entry point: must run back through surviving enemies */ }
    this.recompute(); this.hp=this.maxHp; this.heat=0; this.overheated=false; this.cloakT=0; this.braceT=0; this.defibCd=0; this.abCd=[0,0,0]; this.dodgeCd=0;
    this.musicSet('traversal'); this.emit('mode','run'); this.emit('sfx','abwarm:'+this.build.abilities.filter(Boolean).join(',')); this.saveNow();
    if(this.save.story && !this.save.story) {}
    if(!fresh){ /* re-entry: nothing that wandered near the entry stays there; everything is dormant again */ for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||ENEMIES[e.type]?.boss) continue; e.alert=false; if(dist(e.x,e.y,this.px,this.py)<GRACE.reentryR&&e.home&&dist(e.home.x,e.home.y,this.px,this.py)>=GRACE.reentryR){ e.x=e.home.x; e.y=e.home.y; } } }
    this.toast(fresh?this.dd.intro:'Re-entered existing instance. Surviving enemies and loot remain.');
    this.autoGrace(); this.introBeat(fresh);
  }
  /** global enemy HP multiplier by dungeon tier (ability power pass: autos are weaker, enemy HP is retuned here) */ hpMul(){ return BAL.g.tier[(this.dd as any)?.tier||0]??BAL.g.hp; }
  wrap(e:EnemyState):En{ const x=e as En; x._rt={ st:'idle',t:0,atk:'',acd:{},ang:0,tx:0,ty:0,lost:0,vuln:0,hack:0,abHitAt:-99,reveal:0,bornT:0,fire:0,shots:[],hit:0,dashed:false,strafe:Math.random()<.5?1:-1 }; return x; }
  /** True when the saved instance's boss is dead (a finished run). A finished instance never blocks starting another dungeon. */
  instDone(i:InstanceState|null=this.save.instance):boolean{ return !!i&&(!!i.flags.bossDead||!!i.flags.completed&&!!i.flags.rewardsGranted); }
  /** Save migration: an instance whose boss is dead (dead boss enemy but flags unset, or half-set flags) is marked completed, its rewards and per-dungeon lockout are applied, so it is never stuck "live". */
  migrateInstance(){ const i=this.save.instance; if(!i) return; const id=i.dungeon||'annex'; const bossDead=i.flags.bossDead||i.enemies.some(e=>e.dead&&ENEMIES[e.type]?.boss&&e.faction!=='ally');
    if(!bossDead) return; i.flags.bossDead=true; i.flags.completed=true; if(!i.flags.rewardsGranted){ i.flags.rewardsGranted=true; } if(lockDay(this.save,id)!==todayStr()) setLockDay(this.save,id,todayStr()); persist(this.save); }
  /** Move carried credits/stims/items/chips into the locker as capacity allows. Returns how many carried entries did not fit. */
  bankCarried():number{ const s=this.save, c=s.instance?.carried; if(!c) return 0; const cap=s.lockerCap+s.purchases.lockerBlocks*STARTING.lockerPerPurchase; s.credits+=c.credits; c.credits=0; const rest:Inst[]=[]; for(const it of c.items){ if(capacityUsed(s)<cap) s.items.push(it); else if(bankOverflowItem(s,it)) this.bankedOverflow++; else rest.push(it); } c.items=rest;
    for(const [k,v] of Object.entries(c.chips)){ const kk=k as ChipId; if((s.lockerChips[kk]||0)>0||capacityUsed(s)<cap){ s.lockerChips[kk]=(s.lockerChips[kk]||0)+(v||0); delete c.chips[kk]; } else if(bankOverflowChip(s,kk,v||0)){ this.bankedOverflow+=v||0; delete c.chips[kk]; } } s.stims+=c.stims; c.stims=0; persist(s); return c.items.length+Object.keys(c.chips).length; }
  /** Finished instance on arrival in town: bank the pack; retire the instance when nothing is left in it (otherwise it stays for loot retrieval but never blocks other dungeons). */
  settleCompleted(){ const s=this.save; const i=s.instance; if(!i||!this.instDone(i)) return; const left=this.bankCarried(); if(!left&&!i.drops.length){ s.instance=null; this.inst=null; persist(s); } }
  /** Leaving a finished instance for another dungeon: bank what fits; leftover pack items or ground loot need one confirming repeat (within 30 s). */
  retireForNew(id:string):boolean{ const s=this.save, i=s.instance!; const left=this.bankCarried(); const lost=left+i.drops.length;
    if(lost>0&&!(this.retireArm&&this.retireArm.id===id&&Date.now()-this.retireArm.t<30000)){ this.retireArm={id,t:Date.now()}; this.toast(lost+' item(s) from your cleared '+dungeonOf(i.dungeon||'annex').name+' instance will be discarded. Press Start again to confirm, or re-enter it first to pick them up.'); return false; }
    s.stims+=i.carried.stims; s.instance=null; this.inst=null; this.retireArm=null; persist(s); return true; }
  retireArm:{id:string;t:number}|null=null;
  /** Pick up everything on the ground that fits (credits always) so a finished run does not leave loot behind by accident. */
  autoCollectAll(){ const inst=this.inst; if(!inst) return 0; const c=inst.carried; let n=0; for(const d of [...inst.drops]){ if(d.kind==='credits'){ c.credits+=d.amount; this.rm(d); n++; continue; } const stacksOk=(d.kind==='chip'&&(c.chips[d.chip!]||0)>0)||(d.kind==='stim'&&c.stims>0); if(!stacksOk&&this.carriedCount()>=COMBAT.missionSlots) continue; if(d.kind==='item') c.items.push(d.inst!); else if(d.kind==='chip') c.chips[d.chip!]=(c.chips[d.chip!]||0)+1; else if(d.kind==='stim') c.stims++; this.rm(d); n++; } return n; }
  expireInstance(){ const s=this.save; s.instance=null; this.inst=null; this.toast('The instance expired. Leftover loot and state are gone.'); this.emit('expired'); persist(s); }
  /** What a reset would do and whether the spec allows it. Spec (Instances & lockouts): entry alone never consumes the daily clear; boss completion does, and a completed instance never grants a new boss kill. So an unfinished instance can be reset freely; a completed one only with the clearly-labelled prototype toggle (Settings). */
  resetInfo(){ const inst=this.save.instance; if(!inst||inst.expiresAt<=this.now()) return {has:false,allowed:false,dev:false,completed:false,id:'',lost:0,why:'No live instance.'};
    const id=inst.dungeon||'annex'; const completed=!!inst.flags.rewardsGranted||this.dailyLocked(id)&&inst.flags.completed; const devOn=!!this.save.settings.devFreeReset; const lost=inst.drops.length+inst.carried.items.length+Object.keys(inst.carried.chips).length;
    if(!completed) return {has:true,allowed:true,dev:false,completed:false,id,lost,why:'Unfinished instance: no clear has been consumed, so a fresh run is free.'};
    if(devOn) return {has:true,allowed:true,dev:true,completed:true,id,lost,why:'PROTOTYPE reset: this clear is already consumed. Resetting also refunds today\'s lockout (not allowed in the real game).'};
    return {has:true,allowed:false,dev:false,completed:true,id,lost,why:'Boss clear already consumed today\'s lockout; a completed instance cannot grant a new boss kill. Enable "Prototype: allow resetting cleared dungeons" in Settings to bypass for testing, or abandon it to give up its loot.'}; }
  /** Abandon the live instance and (when in a run) immediately start a fresh one. Carried-but-not-unloaded loot is lost; carried stims are refunded; the repair bill is kept. */
  resetInstance(){ const info=this.resetInfo(); if(!info.has||!info.allowed){ this.toast(info.why); return false; } const s=this.save, inst=s.instance!; const wasRun=this.mode==='run';
    s.stims+=inst.carried.stims; inst.carried.stims=0; if(info.dev) setLockDay(s,info.id,null);
    s.instance=null; this.inst=null; persist(s); this.toast('Instance reset'+(info.lost?' ('+info.lost+' uncollected item(s) discarded)':'')+'.');
    if(wasRun){ if(!this.startRun(info.id)) this.enterTown(); } return true; }
  /** Dev: wipe the instance and any lockout for the dungeon and restart immediately from the entry point. */
  devRestartFromStart(){ const id=this.inst?.dungeon||this.save.instance?.dungeon||'annex'; const s=this.save; if(s.instance){ s.stims+=s.instance.carried.stims; } s.instance=null; this.inst=null; setLockDay(s,id,null); persist(s); this.toast('[dev] restart from start'); if(this.mode==='run') this.enterTown(true); return this.startRun(id); }
  /** Voluntary: go back to the last checkpoint (no hardware restore, no state wipe). */
  restartFromCheckpoint(){ if(this.mode!=='run'||!this.inst) return false; const inst=this.inst; this.channel=null; this.cast=null; this.aim=null; this.downed=false; this.px=inst.checkpoint.x; this.py=inst.checkpoint.y; this.recompute(); this.hp=this.maxHp; this.heat=0; this.overheated=false; this.iframes=1.5; this.resetBossIfAlive(); this.clearTransients(); this.zones=this.envZones(); this.toast('Back at checkpoint: '+(this.level.checkpoints.find(c=>c.id===inst.checkpoint.id)?.label||'start')+'. Enemies and loot are unchanged.'); this.saveNow(); return true; }
  abandonInstance(){ const wasRun=this.mode==='run'; this.save.instance=null; this.inst=null; persist(this.save); this.toast('Instance abandoned.'); if(wasRun){ this.channel=null; this.enterTown(); } }
  applyDoors(){ const inst=this.inst!; const f=inst.flags; const open:Record<string,boolean>={ gate1:f.gate1, lock2:f.lock2, armory:f.armory, boss:f.controller }; for(const d of this.level.doors){ if(open[d.id]) for(const [x,y] of d.tiles) this.level.solid[y*this.level.w+x]=0; } }
  openDoor(id:string){ const d=this.level.doors.find(d=>d.id===id); if(!d) return; for(const [x,y] of d.tiles) this.level.solid[y*this.level.w+x]=0; this.emit('sfx','door'); }
  resetBossIfAlive(){ const inst=this.inst; if(!inst) return; clearBossAdds(this); const bi=inst.enemies.findIndex(e=>ENEMIES[e.type].boss&&!e.dead); if(bi>=0){ const b=inst.enemies[bi]; inst.enemies.splice(bi,1); this.enemies=this.enemies.filter(e=>e.id!==b.id); inst.flags.bossSpawned=false; inst.flags.bossRevealed=false; this.emit('musicretry',null); } this.revealing=false; }

  saveNow(){ if(this.inst&&this.mode==='run'){ /* only snapshot while actually in the run: in town this.enemies is empty and would wipe the saved instance (pagehide/visibility saves in town) */ this.inst.px=this.px; this.inst.py=this.py; this.inst.hp=this.hp; this.inst.enemies=this.enemies.slice() as EnemyState[]; /* a copy: sharing the array made spawnEnemy list late adds twice (updated and hit twice) */ } if(!this.inst||!this.inst.id.startsWith('net-')) this.save.instance=this.inst; /* a party (net-) instance is never written into the player's own save */ persist(this.save); }

  // ---------- helpers ----------
  solidAt(x:number,y:number){ const L=this.level; const ix=Math.floor(x), iy=Math.floor(y); if(ix<0||iy<0||ix>=L.w||iy>=L.h) return true; return L.solid[iy*L.w+ix]===1; }
  moveCircle(x:number,y:number,dx:number,dy:number,r:number){ const n=Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/.3); if(n>1){ /* sub-step so large knockbacks/dashes can never tunnel through a thin wall */ let cx=x, cy=y; for(let i=0;i<n;i++){ const p=this.moveCircle1(cx,cy,dx/n,dy/n,r); cx=p.x; cy=p.y; } return {x:cx,y:cy}; } return this.moveCircle1(x,y,dx,dy,r); }
  moveCircle1(x:number,y:number,dx:number,dy:number,r:number){ let nx=x+dx, ny=y; if(this.circleHits(nx,ny,r)) nx=x; ny=y+dy; if(this.circleHits(nx,ny,r)) ny=y; return {x:nx,y:ny}; }
  circleHits(x:number,y:number,r:number){ const x0=Math.floor(x-r), x1=Math.floor(x+r), y0=Math.floor(y-r), y1=Math.floor(y+r); for(let iy=y0;iy<=y1;iy++)for(let ix=x0;ix<=x1;ix++){ if(!this.solidAt(ix+.5,iy+.5)) continue; const cx=clamp(x,ix,ix+1), cy=clamp(y,iy,iy+1); const dx=x-cx, dy=y-cy; if(dx*dx+dy*dy<r*r-1e-6) return true; } return false; }
  /** Swept circle clearance between two points (used for wide-LOS and path smoothing). */
  clearFor(ax:number,ay:number,bx:number,by:number,r:number){ const d=dist(ax,ay,bx,by); const n=Math.max(1,Math.ceil(d/.3)); for(let i=1;i<=n;i++){ const t=i/n; if(this.circleHits(ax+(bx-ax)*t,ay+(by-ay)*t,r)) return false; } return true; }
  /** Nearest tile centre (spiral search) where a circle of radius r fits; null only if the level has no walkable tile within 20 tiles. */
  nearestWalkable(x:number,y:number,r=.2):{x:number;y:number}|null{ const L=this.level; if(!isFinite(x)||!isFinite(y)){ x=L.spawn.x; y=L.spawn.y; } const cx=clamp(Math.floor(x),0,L.w-1), cy=clamp(Math.floor(y),0,L.h-1); let best:{x:number;y:number}|null=null, bd=1e9;
    for(let ring=0;ring<=20&&!best;ring++){ for(let dy=-ring;dy<=ring;dy++)for(let dx=-ring;dx<=ring;dx++){ if(Math.max(Math.abs(dx),Math.abs(dy))!==ring) continue; const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=L.w||ny>=L.h||L.solid[ny*L.w+nx]) continue; const px=nx+.5, py=ny+.5; if(r>0&&this.circleHits(px,py,r)) continue; const d=(px-x)**2+(py-y)**2; if(d<bd){ bd=d; best={x:px,y:py}; } } }
    return best; }
  stranded(x:number,y:number,r:number){ return !isFinite(x)||!isFinite(y)||this.solidAt(x,y)||this.circleHits(x,y,r*.5); }
  /** Move an entity standing on a non-walkable spot to the nearest walkable one. Returns true when it was moved. */
  snapWalkable(o:{x:number;y:number},r:number):boolean{ if(!this.stranded(o.x,o.y,r)) return false; const p=this.nearestWalkable(o.x,o.y,r*.5)||this.nearestWalkable(o.x,o.y,0); if(!p) return false; o.x=p.x; o.y=p.y; this.rescued++; return true; }
  rescued=0; resT=0;
  /** Safety net (runs ~2x/s in a run): rescue any entity found on a non-walkable tile (spawn, restore, knockback, dash, teleport, party start). */
  rescueStranded(){ if(this.mode!=='run') return; const me={x:this.px,y:this.py}; if(this.snapWalkable(me,COMBAT.playerRadius)){ this.px=me.x; this.py=me.y; this.toast('Repositioned onto walkable ground.'); }
    for(const e of this.enemies){ if(e.dead||e._rt.reveal>0) continue; const r=ENEMIES[e.type]?.radius||.4; if(this.snapWalkable(e,r)&&e.home&&this.stranded(e.home.x,e.home.y,r)){ e.home={x:e.x,y:e.y}; } } }
  /** Push an entity out of any collider it ended up inside (dash end, knockback, spawn). */
  unwedge(o:{x:number;y:number},r:number){ if(!this.circleHits(o.x,o.y,r)) return; for(let ring=1;ring<=12;ring++){ const rr=ring*.15; for(let k=0;k<8;k++){ const a=k*Math.PI/4; const nx=o.x+Math.cos(a)*rr, ny=o.y+Math.sin(a)*rr; if(!this.circleHits(nx,ny,r)){ o.x=nx; o.y=ny; return; } } } }
  los(ax:number,ay:number,bx:number,by:number){ const d=dist(ax,ay,bx,by); const n=Math.ceil(d/.4); for(let i=1;i<n;i++){ const t=i/n; if(this.solidAt(ax+(bx-ax)*t,ay+(by-ay)*t)) return false; } return true; }
  /** where the boss reveal triggers (just inside the boss door); tests and dev tools use this instead of assuming the boss room is east */ revealPoint(){ const L=this.level; return L.reveal?{x:L.reveal.x,y:L.reveal.y}:{x:L.revealX+1,y:L.bossSpawn.y}; }
  zoneAt(x:number,y:number){ const L=this.level; const ix=Math.floor(x), iy=Math.floor(y); if(ix<0||iy<0||ix>=L.w||iy>=L.h) return 'none'; return L.zoneNames[L.zone[iy*L.w+ix]]; }
  stat(){ return this.build.stats; }

  // ---------- input API (called by input.ts) ----------
  setMove(x:number,y:number){ this.inputMove.x=x; this.inputMove.y=y; }
  beginAim(idx:number){ if(this.downed||this.mode!=='run') return; /* abilities are run-only: towns are safe zones */ const ab=this.build.abilities[idx]; if(!ab) return; this.aim={ idx, wx:this.px+Math.cos(this.face), wy:this.py+Math.sin(this.face), hasDir:false }; }
  updateAim(wx:number,wy:number,hasDir:boolean){ if(this.aim){ this.aim.wx=wx; this.aim.wy=wy; this.aim.hasDir=hasDir; } }
  cancelAim(){ this.aim=null; }
  /** Tap / click without dragging: aim at the current target or nearest enemy, else along facing, so a plain press still casts. */
  quickAim(a:AimState){ if(a.hasDir) return; const t=this.pickTarget(); if(t){ a.wx=t.x; a.wy=t.y; } else { a.wx=this.px+Math.cos(this.face)*3; a.wy=this.py+Math.sin(this.face)*3; } a.hasDir=true; }
  releaseAim(){ const a=this.aim; this.aim=null; if(!a||this.downed||this.mode!=='run') return; if(this.grace) this.grace.acted=true; const id=this.build.abilities[a.idx]; if(!id) return; const def=ABILITIES[id]; if(def.aim!=='self') this.quickAim(a);
    const v=this.validateAim(def,a); if(!v.valid){ this.emit('sfx','cancel'); this.toast('Cancelled: '+v.why); return; }
    if(this.overheated){ this.toast('Overheated: abilities offline'); this.emit('sfx','deny'); return; }
    if(this.ventLock>0){ this.toast('Venting...'); this.emit('sfx','deny'); return; }
    if(this.abCd[a.idx]>0){ this.toast(def.name+' is cooling down'); return; }
    if(this.cast) return; if(this.weaponOff>0&&def.id!=='forcedcool'&&false) return;
    this.cast={ idx:a.idx, t:0, aim:{...a}, ab:def }; this.emit('sfx','windup'); this.abSfx(def.id,'windup'); }
  validateAim(def:AbilityDef, a:AimState):{valid:boolean;why:string;tx?:number;ty?:number;target?:En}{
    switch(def.aim){
      case 'self': return {valid:true,why:''};
      case 'direction': return a.hasDir?{valid:true,why:''}:{valid:false,why:'no direction aimed'};
      case 'ground': { let dx=a.wx-this.px, dy=a.wy-this.py; const d=Math.hypot(dx,dy); if(d<.6) return {valid:false,why:'no ground target'}; const k=Math.min(1,def.range/d); const tx=this.px+dx*k, ty=this.py+dy*k; if(this.solidAt(tx,ty)||!this.los(this.px,this.py,tx,ty)) return {valid:false,why:'invalid ground location'}; return {valid:true,why:'',tx,ty}; }
      case 'target': { const t=this.enemyNear(a.wx,a.wy,1.6); if(!t) return {valid:false,why:'no enemy at aim point'}; if(dist(this.px,this.py,t.x,t.y)>def.range||!this.los(this.px,this.py,t.x,t.y)) return {valid:false,why:'target out of range'}; return {valid:true,why:'',target:t}; }
      case 'ally': return {valid:false,why:'no teammate to target (solo)'};
    }
  }
  enemyNear(x:number,y:number,r:number){ let best:En|null=null,bd=r; for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||e._rt.reveal>0) continue; const d=dist(x,y,e.x,e.y)-ENEMIES[e.type].radius*.6; if(d<bd){bd=d;best=e;} } return best; }
  tapEnemy(wx:number,wy:number){ const e=this.enemyNear(wx,wy,1.1); if(e){ this.target=e.id; this.emit('sfx','select'); return true; } return false; }
  clearTarget(){ this.target=null; }
  dodge(){
    if(this.downed||this.channel&&this.channel.kind==='hack'&&false) return;
    if(this.grace) this.grace.acted=true; this.aim=null; const hadCast=!!this.cast; this.cast=null; if(this.channel&&this.channel.kind==='hack') this.channel=null; this.emit('dodgecancel'); // always cancels aiming/execution, even on cooldown
    if(this.dodgeCd>0){ if(hadCast) this.toast('Cast cancelled'); return; }
    let dx=this.inputMove.x, dy=this.inputMove.y; if(Math.hypot(dx,dy)<.1){ dx=Math.cos(this.face); dy=Math.sin(this.face); }
    if(Math.hypot(this.inputMove.x,this.inputMove.y)>=.1){ const v=ISO.vec(this.inputMove.x,this.inputMove.y); dx=v.x; dy=v.y; } /* input is screen-space; convert to world */ const l=Math.hypot(dx,dy)||1; this.dodgeDx=dx/l; this.dodgeDy=dy/l; this.dodgeT=COMBAT.dodge.time; this.iframes=Math.max(this.iframes,COMBAT.dodge.iframes); this.dodgeCd=COMBAT.dodge.cd; this.emit('sfx','dodge'); this.fx.push({kind:'dust',x:this.px,y:this.py,t:0,life:.4});
    this.townInterrupt('Town return interrupted');
  }
  interact(){ if(!this.prompt||this.downed) return; this.doInteract(this.prompt); }
  /** Interrupts a normal (soft) town-return channel; after the first interruption the next press starts the uninterruptible emergency exit. */
  townInterrupt(msg:string,byDamage=false){ const c=this.channel; if(!c||c.kind!=='town'||c.hard) return; this.channel=null; if(byDamage){ this.townFails++; this.toast(msg+'. Press '+key('town')+' again for an emergency exit (8 s, cannot be interrupted) or use Abandon in the menu.'); } else this.toast(msg); }
  /** Instant guaranteed exit: abandons the instance (loot forfeited unless the run is cleared; repair bill kept) and returns to town. Works at any time in a run, incl. downed, mid-boss, enemies near. */
  leaveInstance(){ if(this.mode!=='run') return false; this.channel=null; this.cast=null; this.aim=null; this.downed=false; if(this.inst&&this.instDone(this.inst)){ this.saveNow(); this.enterTown(); return true; } this.abandonInstance(); return true; }
  townReturn(){ if(this.mode!=='run') return; if(this.channel&&this.channel.kind==='town'){ if(this.channel.hard){ this.toast('Emergency exit in progress: cannot be cancelled'); return; } this.channel=null; this.toast('Town return cancelled'); return; }
    const hard=this.townFails>0||this.downed; const done0=()=>{ this.townFails=0; const done=this.instDone(this.inst); let got=0; if(done&&!this.downed) got=this.autoCollectAll(); const left=this.inst?this.inst.drops.length:0; this.downed=false; this.saveNow(); this.enterTown(); if(done&&got) this.toast('Auto-collected '+got+' drop(s) on the way out.'); if(done&&left&&this.save.instance) this.toast(left+' item(s) left in the cleared instance (pack full). Re-enter to pick them up; starting another dungeon discards them.'); };
    this.channel={kind:'town',t:0,dur:hard?8:COMBAT.townChannel,hard,cb:done0}; this.toast(hard?'EMERGENCY EXIT: 8 s, cannot be interrupted. You stay vulnerable.':this.instDone(this.inst)&&this.inst!.drops.length?'Returning to town... loot on the ground is auto-collected if it fits.':'Returning to town... movement or damage interrupts. No invulnerability.'); this.emit('sfx','channel'); }
  /** Dev cheat (typed "idkfa"), a TOGGLE (src/idkfa_toggle.ts). ON: snapshot the real state, then orange hardware + best chips in every slot, stims/credits
   *  top-up, full heal. OFF: restore the snapshot exactly, strip cheat items, keep real loot picked up meanwhile. Snapshot persists in the save. */
  cheatIdkfa(){ const s=this.save; const inst=this.inst as any;
    if(idkfaActive(s)){ const r=idkfaDisable(s,{inst:inst||null}); this.recompute(); if(!this.downed){ this.hp=Math.min(this.maxHp,r.hp!=null&&inst?r.hp:this.hp); if(this.hp<=0) this.hp=1; } this.emit('inv'); this.emit('idkfa',false); this.toast('IDKFA OFF: your gear is back'); this.saveNow(); return false; }
    idkfaEnable(s,{hp:inst?this.hp:null,inst:inst||null});
    this.recompute(); this.hp=this.maxHp; this.heat=0; this.overheated=false; this.downed=false; this.emit('inv'); this.emit('idkfa',true); this.toast('IDKFA ON: best gear equipped (type idkfa again to revert)'); this.saveNow(); return true; }
  stimCd=0;
  /** Manual vent (V / tap the heat bar). Channel: abilities and autos offline for vent.lockT, slower movement; dumps heat (more when already hot). Works while overheated: recovers faster, still needs the lockout window. */
  ventNow(){ if(this.mode!=='run'||this.downed||this.revealing||this.ventCd>0||this.ventLock>0){ if(this.mode==='run'&&this.ventCd>0&&!this.downed) this.toast(`Vent recharging (${Math.ceil(this.ventCd)}s)`); return false; } if(this.heat<10&&!this.overheated){ this.toast('Heat is already low'); return false; }
    const V=HEAT.vent; const hot=this.heat>=V.hotAt; const amt=V.amount+(hot?V.hotBonus:0); this.cast=null; this.aim=null; this.heat=Math.max(0,this.heat-amt); this.ventCd=V.cd; this.ventLock=V.lockT; this.weaponOff=Math.max(this.weaponOff,V.lockT); this.heatSoak=0; this.vents=(this.vents||0)+1;
    if(this.overheated&&this.heat<=COMBAT.heat.overheatRecover&&this.ohT<=0){ this.overheated=false; this.emit('sfx','cooled'); }
    this.popup(this.px,this.py-1,hot?'HOT VENT -'+amt:'VENT -'+amt,'#e8c46a'); this.emit('sfx','cooled'); this.fx.push({kind:'ring',x:this.px,y:this.py,r:1.8,t:0,life:.45,c:'#e8c46a'}); return true; }
  useStim(){ if(this.stimCd>0) return; const c=this.inst?.carried; if(!c||this.downed){ if(this.mode==='town'&&this.save.stims>0){ this.save.stims--; this.hp=Math.min(this.maxHp,this.hp+COMBAT.stimHeal); } return; } if(c.stims>0&&this.hp<this.maxHp){ c.stims--; this.stimCd=HARD.stimCd; this.hp=Math.min(this.maxHp,this.hp+COMBAT.stimHeal); this.heat=Math.max(0,this.heat-HEAT.stimVent); this.emit('sfx','heal'); this.fx.push({kind:'text',x:this.px,y:this.py,t:0,life:.8,text:'+'+COMBAT.stimHeal,c:'#9fb98a'}); } else if(c.stims<=0 && this.save.stims>0 && false){} }
  musicSet(s:string){ if(this.musicState!==s){ this.musicState=s; if(s!=='town') this.emit('musicarea',this.inst?dungeonOf(this.inst.dungeon).mfr:null); this.emit('music',s); } }

  // ---------- main update ----------
  /** multiplayer hook (src/net/session.ts): when set and it returns true, the party instance owns this frame */ netHook?:(dt:number)=>boolean;
  update(dtRaw:number){
    if(this.netHook&&this.netHook(dtRaw)) return;
    if(this.hitStop>0){ this.hitStop-=dtRaw; this.updateFx(dtRaw*.25); return; }
    const dt=Math.min(dtRaw,.05); this.time+=dt;
    if(this.mode==='run'&&this.inst){ this.inst.elapsed+=dt; const rem=this.inst.expiresAt-this.now(); if(rem<=0){ this.expireInstance(); this.enterTown(); return; } if(!this.inst.warned&&rem<INSTANCE_WARN_MINUTES*60000){ this.inst.warned=true; this.toast('Instance expires in under '+INSTANCE_WARN_MINUTES+' minutes. Retrieve loot.'); } }
    if(this.grace&&this.mode==='run') this.tickGrace(dt); else if(this.grace) this.grace=null;
    this.updatePlayer(dt); abxTick(this,dt); this.codexT-=dt; if(this.codexT<=0){ this.codexT=1; this.codexScan(); if(this.mode==='town') this.worldScan(); }
    if(this.mode==='run'){ if((this.sanT-=dt)<=0){ this.sanT=1; this.sanitizeGround(); } if((this.resT-=dt)<=0){ this.resT=.5; this.rescueStranded(); } this.updateEnemies(dt); this.updateProjs(dt); this.updateZones(dt); this.autoPickup(); this.updateRun(dt); this.updateMusic(dt); this.abilityHints(dt); this.saveT+=dt; if(this.saveT>4){ this.saveT=0; this.saveNow(); } }
    this.updatePrompt(); this.updateFx(dt);
  }
  updateFx(dt:number){ for(const f of this.fx){ f.t+=dt; if(f.vx){ f.x+=f.vx*dt; f.y+=(f.vy||0)*dt; } } this.fx=this.fx.filter(f=>f.t<f.life); if(this.fx.length>260) this.fx.splice(0,this.fx.length-260); }
  updatePlayer(dt:number){
    const st=this.stat(); const revealLock=this.revealing;
    if(this.stimCd>0) this.stimCd-=dt; if(this.dodgeCd>0) this.dodgeCd-=dt; if(this.iframes>0) this.iframes-=dt; if(this.atkCd>0) this.atkCd-=dt; if(this.weaponOff>0) this.weaponOff-=dt; if(this.defibCd>0) this.defibCd-=dt;
    for(let i=0;i<3;i++) if(this.abCd[i]>0){ this.abCd[i]-=dt; if(this.abCd[i]<=0&&this.mode==='run'&&this.combatHold>0&&this.build.abilities[i]) this.emit('sfx','ab_ready_'+(ABILITIES[this.build.abilities[i]]?.type||'attack')); }
    if(this.comboT>0){ this.comboT-=dt; if(this.comboT<=0) this.comboN=0; } if(this.ovT>0) this.ovT-=dt;
    if(this.cloakT>0){ this.cloakT-=dt; } if(this.braceT>0) this.braceT-=dt; if(this.slowT>0) this.slowT-=dt;
    // heat
    if(this.ventCd>0) this.ventCd-=dt; if(this.ventLock>0) this.ventLock-=dt; if(this.ohT>0) this.ohT-=dt; if(this.heatSoak>0) this.heatSoak-=dt;
    this.heat=Math.max(0,this.heat-dissipation(st.cooling,this.overheated,this.heatSoak)*dt);   // slower baseline, capped by effCooling; halved-ish while overheated; paused briefly after each cast
    if(this.overheated&&this.heat<=COMBAT.heat.overheatRecover&&this.ohT<=0){ this.overheated=false; this.emit('sfx','cooled'); this.toast('Heat nominal: abilities online'); }
    { const band=this.heat>=COMBAT.heat.max*.85?'hot':this.heat>=COMBAT.heat.max*.7?'warm':'ok'; if(this.mode==='run'&&band==='hot'&&this._band!=='hot'&&!this.overheated) this.emit('sfx','amb_hot'); this._band=band; }
    if(this.heat>=COMBAT.heat.max&&!this.overheated){ this.heat=COMBAT.heat.max; this.overheated=true; this.ohT=HEAT.overheat.lockT; this.cast=null; this.aim=null; this.ventLock=0; this.overheats=(this.overheats||0)+1; this.emit('sfx','overheat'); this.toast(`OVERHEATED: abilities offline, +${Math.round((HEAT.overheat.takenMul-1)*100)}% damage taken. Vent (${key('vent')}) to recover faster`); }
    if(this.hp<this.maxHp&&!this.downed&&st.regen>0) this.hp=Math.min(this.maxHp,this.hp+st.regen*dt*(this.mode==='town'?4:HARD.runRegen));
    if(this.downed){ this.downT+=dt; this.cast=null; this.aim=null; if(this.channel){ this.channel.t+=dt; if(this.channel.t>=this.channel.dur){ const cb=this.channel.cb; this.channel=null; cb(); } } return; }
    // movement
    let mx=0,my=0; const mag=Math.min(1,Math.hypot(this.inputMove.x,this.inputMove.y)); if(mag>.12){ const v=ISO.vec(this.inputMove.x,this.inputMove.y); mx=v.x*mag; my=v.y*mag; }
    let speed=COMBAT.playerSpeed*st.move*(this.overheated?COMBAT.heat.overheatSpeedMult:1)*(this.ventLock>0?HEAT.vent.moveMul:1)*(this.cast?.6:1)*(this.slowT>0?BAL.p.hexSlowMul:1)*abxPlayerSpeed(this);
    if(this.dodgeT>0){ this.dodgeT-=dt; const sp=COMBAT.dodge.dist/COMBAT.dodge.time; const p=this.moveCircle(this.px,this.py,this.dodgeDx*sp*dt,this.dodgeDy*sp*dt,COMBAT.playerRadius); this.px=p.x; this.py=p.y; this.moving=true; }
    else if(this.lungeT>0){ this.lungeT-=dt; const sp=this.lungeDx; const p=this.moveCircle(this.px,this.py,this.lungeDx*dt,this.lungeDy*dt,COMBAT.playerRadius); this.px=p.x; this.py=p.y; this.lungeBladeHit(); }
    else if(this.slideT>0){ this.slideT-=dt; const p=this.moveCircle(this.px,this.py,this.slideFx*dt,this.slideFy*dt,COMBAT.playerRadius); this.px=p.x; this.py=p.y; }
    else { const p=this.moveCircle(this.px,this.py,mx*speed*dt,my*speed*dt,COMBAT.playerRadius); this.px=p.x; this.py=p.y; this.moving=mag>.12; if(this.moving) this.face=Math.atan2(my,mx); }
    if(this.moving&&mag>.3){ if(this.channel&&!this.channel.hard){ this.townInterrupt('Town return interrupted by movement'); this.channel=null; } }
    if(this.channel){ this.channel.t+=dt; if(this.channel.t>=this.channel.dur){ const cb=this.channel.cb; this.channel=null; cb(); } }
    // aim face
    if(this.aim){ this.face=Math.atan2(this.aim.wy-this.py,this.aim.wx-this.px); }
    // cast
    if(this.cast){ const c=this.cast; c.t+=dt; if(this.aim==null||true){ /* aim keeps tracking only while held */ } if(c.t>=c.ab.windup){ this.cast=null; this.executeAbility(c); } }
    this.updateBurst(dt); this.autoAttack(dt);
  }
  // ---------- auto attack ----------
  pickTarget():En|null{
    const w=this.build.weapon; const range=w.range; let t:En|undefined;
    if(this.target!=null){ t=this.enemies.find(e=>e.id===this.target); if(!t||t.dead||t.faction!=='enemy'||t._rt.reveal>0){ this.target=null; t=undefined; } else return t; }
    let best:En|null=null,bd=COMBAT.autoTargetRange;
    for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||e._rt.reveal>0) continue; const d=dist(this.px,this.py,e.x,e.y); if(d<bd&&this.los(this.px,this.py,e.x,e.y)){ bd=d; best=e; } }
    return best;
  }
  autoAttack(dt:number){
    if(this.mode!=='run'||this.cast||this.dodgeT>0||this.weaponOff>0||this.lungeT>0||this.slideT>0||this.revealing) return;
    const w=this.build.weapon; const t=this.pickTarget(); if(!t) return;
    const d=dist(this.px,this.py,t.x,t.y)-ENEMIES[t.type].radius; if(d>w.range) return;
    if(w.stationary&&this.moving) return; if(this.atkCd>0) return; if(this.aim) return;
    const st=this.stat(); const rate=w.rate*st.atkSpeed*(this.overheated?.5:1); this.atkCd=1/rate; if(this.grace) this.grace.acted=true;
    this.face=Math.atan2(t.y-this.py,t.x-this.px);
    let dmg=w.dmg*AB.autoDmgMul*this.build.weaponMul*st.dmg*(this.overheated?COMBAT.heat.overheatDmgMult:1); if(w.kind==='ripper') dmg*=1+(st.atkSpeed-1)*.6;
    let tag='auto'; if(this.cloakT>0){ dmg*=AB.cloakAuto; this.cloakT=0; tag='cloak'; this.popup(this.px,this.py,'AMBUSH x'+AB.cloakAuto,'#e8c46a'); this.vfx('cloak.ambush',this.px,this.py,{a:this.face}); }
    this.heat+=w.heat*AB.autoHeatMul*(this.overheated?HEAT.overheat.autoHeatMul:1); this.curTag=tag; this.emit('sfx','atk_'+w.kind);
    if(w.kind==='arc') this.fireArc(t,w,dmg);
    else if(w.proj){ this.fireProj(w,dmg,this.face); if(tag!=='auto') for(const pj of this.projs.slice(-(w.pellets||1))) (pj as any).tag=tag; if(w.burst){ this.burstLeft=w.burst-1; this.burstT=w.burstGap||.07; this.burstDmg=dmg; this.atkCd+=(w.burst-1)*(w.burstGap||.07); } }
    else { this.fx.push({kind:'slash',x:this.px,y:this.py,a:this.face,r:w.range,t:0,life:.18,w:w.arc}); for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||e._rt.reveal>0) continue; const dd=dist(this.px,this.py,e.x,e.y)-ENEMIES[e.type].radius; if(dd<=w.range&&Math.abs(angDiff(Math.atan2(e.y-this.py,e.x-this.px),this.face))<=w.arc/2&&this.los(this.px,this.py,e.x,e.y)) this.hurtEnemy(e,dmg,this.px,this.py,.6); } }
    this.curTag='auto';
  }
  burstLeft=0; burstT=0; burstDmg=0;
  weaponColor():string{ const m=this.build.weaponMfr; return m==='HI'?'#d0623a':m==='PS'?'#bfe0ea':m==='MM'?'#c4cf7a':'#d8d2bf'; }
  fireProj(w:WeaponDef,dmg:number,ang:number){
    const n=w.pellets||1, sp=w.spread||0, kind:Proj['kind']=w.kind==='slug'?'slug':w.kind==='popper'?'pop':w.kind==='autopistol'?'pistol':w.kind==='burst'?'needle':w.kind==='shard'?'shard':'slug';
    const v=w.pspeed||18, c=this.weaponColor();
    for(let i=0;i<n;i++){ const a=ang+(n>1?(i/(n-1)-.5)*sp:0)+(n===1&&w.kind!=='slug'?(Math.random()-.5)*.04:0); this.projs.push({x:this.px,y:this.py,vx:Math.cos(a)*v,vy:Math.sin(a)*v,dmg:dmg/(n>1?n*.6:1)*(n>1?1:1),r:.25,life:w.plife||.6,faction:'ally',kind,c}); }
    this.fx.push({kind:'spark',x:this.px+Math.cos(ang)*.6,y:this.py+Math.sin(ang)*.6,t:0,life:.15,c});
  }
  fireArc(t:En,w:WeaponDef,dmg:number){
    const c=this.weaponColor(); const hit=new Set<number>(); let cur:{x:number;y:number}={x:this.px,y:this.py}; let tgt:En|null=t; let d=dmg;
    for(let i=0;i<(w.chain||1)&&tgt;i++){ hit.add(tgt.id); const a=Math.atan2(tgt.y-cur.y,tgt.x-cur.x), L=dist(cur.x,cur.y,tgt.x,tgt.y); this.fx.push({kind:'line',x:cur.x,y:cur.y,a,len:L,w:.12,t:0,life:.16,c}); this.fx.push({kind:'spark',x:tgt.x,y:tgt.y,t:0,life:.2,c}); this.hurtEnemy(tgt,d,cur.x,cur.y,.3); d*=.7; cur={x:tgt.x,y:tgt.y};
      let best:En|null=null,bd=w.chainR||3; for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||e._rt.reveal>0||hit.has(e.id)) continue; const dd=dist(cur.x,cur.y,e.x,e.y); if(dd<bd&&this.los(cur.x,cur.y,e.x,e.y)){ bd=dd; best=e; } } tgt=best; }
  }
  updateBurst(dt:number){ if(this.burstLeft<=0) return; if(this.mode!=='run'||this.cast||this.dodgeT>0||this.revealing||this.downed){ this.burstLeft=0; return; } this.burstT-=dt; if(this.burstT<=0){ const w=this.build.weapon; this.burstLeft--; this.burstT=w.burstGap||.07; const t=this.pickTarget(); if(t) this.face=Math.atan2(t.y-this.py,t.x-this.px); this.heat+=w.heat*AB.autoHeatMul*(this.overheated?HEAT.overheat.autoHeatMul:1); this.emit('sfx','atk_'+w.kind); this.fireProj(w,this.burstDmg,this.face); } }
  // ---------- abilities ----------
  /** Cast graphic only. Numbers (damage, heat, cooldown) stay on the ability itself. */
  private castLook(id:string, x:number, y:number, o:Partial<Fx>={}){
    const red=!!this.save.settings.reducedFx;
    const base=id==='sweep'?.58:id==='bladeburst'?.46:id==='pulse'?.68:id==='brace'?.72:id==='forcedcool'?.95:id==='control'?.8:id==='reposition'?.42:.52;
    this.fx.push({ ...o, kind:'ability', text:id, x, y, t:0, life:red?Math.min(.36,base*.55):base });
  }
  /** visual-effect events consumed by the renderer's particle system (src/vfx.ts); capped so headless runs never grow it */
  vev:{k:string;x:number;y:number;a?:number;r?:number;len?:number;x2?:number;y2?:number;n?:number}[]=[];
  vfx(k:string,x:number,y:number,o:{a?:number;r?:number;len?:number;x2?:number;y2?:number;n?:number}={}){ if(this.vev.length>160) this.vev.shift(); this.vev.push({k,x,y,...o});
    /* augment-specific ability sfx layers (audio.ts -> abilities/sfxplay.ts): cast / travel / impact; windup is emitted when the cast starts. Run mode only (towns never cast). */
    const dot=k.indexOf('.'); if(dot>0){ const ph=k.slice(dot+1); const L=ph==='trail'?'travel':ph==='hit'||ph==='arc'||ph==='shatter'?'impact':(ph==='cast'||ph==='fire'||ph==='deploy'||ph==='buff')?'cast':''; if(L) this.abSfx(k.slice(0,dot),L as any); } }
  abSfx(id:string,layer:'windup'|'cast'|'travel'|'impact'){ if(this.mode!=='run'||!SFX[id]) return; this.emit('sfx','ab:'+id+':'+layer+(this.save.settings.reducedFx?':r':'')); }  popup(x:number,y:number,text:string,c='#e8c46a'){ this.fx.push({kind:'text',x,y,t:0,life:1.1,text,c}); }
  /** nearby telegraph the player is about to be hit by (zone windup/active, enemy wind-up, incoming enemy shot): Reposition into it is a PERFECT EVADE */
  dangerNear():boolean{ for(const z of this.zones){ if(z.env||z.dps<=0) continue; if(z.t<z.windup+.25&&Math.hypot(z.x-this.px,z.y-this.py)<z.r+1.2) return true; }
    for(const e of this.enemies){ if(!e.dead&&e.faction==='enemy'&&e._rt.st==='tele'&&Math.hypot(e.x-this.px,e.y-this.py)<4.2) return true; }
    for(const p of this.projs){ if(p.faction==='enemy'&&Math.hypot(p.x-this.px,p.y-this.py)<3.2) return true; } return false; }
  executeAbility(c:{ idx:number; aim:AimState; ab:AbilityDef }){ if(this.mode!=='run'){ this.cast=null; return; }
    const def=c.ab; const st=this.stat(); const m=this.build.mods;
    const v=this.validateAim(def,c.aim); if(!v.valid&&def.aim!=='self'){ this.toast('Cancelled: '+v.why); return; } // re-validate at effect start; still free
    // synergies read state BEFORE the cast pays its heat
    const chargedB=Math.min(AB.chargedMax,this.heat*AB.chargedPerHeat); const danger=def.id==='reposition'&&this.dangerNear();
    // resource commitment point: effect start
    this.heat+=heatCost(def.heat,this.build.abMods.heat); this.heatSoak=HEAT.soakT; this.abCd[c.idx]=cdAfter(def.cd,this.build.abMods.cdr); this.emit('sfx','ab_'+def.id); this.casts[def.id]=(this.casts[def.id]||0)+1; this.sinceAb=0; const ang=Math.atan2(c.aim.wy-this.py,c.aim.wx-this.px);
    // combo chain: a different ability within comboT of the last stacks +15% each (max 3)
    if(this.comboT>0&&this.lastAb!==def.id) this.comboN=Math.min(AB.comboMax,this.comboN+1); else if(this.comboT<=0) this.comboN=0; this.lastAb=def.id; this.comboT=AB.comboT;
    const comboB=this.comboN*AB.comboStep; if(this.comboN>=1){ this.popup(this.px,this.py-.6,'COMBO x'+(this.comboN+1)+' +'+Math.round(comboB*100)+'%','#9fd8c8'); this.emit('sfx','combo'); }
    if(chargedB>=.15) this.popup(this.px,this.py-1.1,'CHARGED +'+Math.round(chargedB*100)+'%','#e08a4a');
    const ovB=this.ovT>0?AB.ovMul-1:0; const dmgingId=def.id==='sweep'||def.id==='bladeburst'||def.id==='pulse'||def.id==='reposition';
    let ambushB=0; if(this.cloakT>0&&dmgingId){ ambushB=AB.cloakMul-1; this.cloakT=0; this.popup(this.px,this.py-1.6,'AMBUSH x'+AB.cloakMul,'#e8c46a'); }
    const dmgM=st.dmg*throttle(this.build.abMods.heat,st.cooling)*(this.overheated?COMBAT.heat.overheatDmgMult:1)*(1+chargedB+comboB+ovB+ambushB);
    if(ABILITY_BY_ID[def.id]){ abxCast(this,def,c.idx,c.aim,v); return; } // data-driven augment abilities (src/abilities)
    this.curTag=def.id;
    try{ switch(def.id){
      case 'sweep': { const arc=Math.PI*.75*(1+m.arc); this.face=ang; this.castLook('sweep',this.px,this.py,{a:ang,r:def.range,w:arc,c:'#c4543c'}); this.vfx('sweep.cast',this.px,this.py,{a:ang,r:def.range,len:arc}); let n=0; for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||e._rt.reveal>0) continue; const d=dist(this.px,this.py,e.x,e.y)-ENEMIES[e.type].radius; if(d<=def.range&&Math.abs(angDiff(Math.atan2(e.y-this.py,e.x-this.px),ang))<=arc/2){ n++; this.hurtEnemy(e,AB.sweepDmg*dmgM,this.px,this.py,2.2); if(!e.dead&&!ENEMIES[e.type].boss) e.stunT=Math.max(e.stunT,AB.sweepStun); } } if(n>=3) this.popup(this.px+Math.cos(ang)*2,this.py+Math.sin(ang)*2,'CLEAR x'+n,'#e8a07a'); break; }
      case 'brace': { this.braceT=AB.braceT; this.slowT=0; this.castLook('brace',this.px,this.py,{r:1.5,c:'#e4dcc8'}); this.vfx('brace.cast',this.px,this.py); for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||e._rt.reveal>0) continue; if(dist(this.px,this.py,e.x,e.y)-ENEMIES[e.type].radius<1.8) this.hurtEnemy(e,0,this.px,this.py,1.6); } break; }
      case 'forcedcool': { this.heat=Math.max(0,this.heat-70); this.weaponOff=1.2; this.overheated=this.heat>=COMBAT.heat.max; this.ovT=AB.ovT; for(let k=0;k<3;k++) if(k!==c.idx) this.abCd[k]=Math.max(0,this.abCd[k]-2); this.castLook('forcedcool',this.px,this.py,{r:1.6,c:'#d5e4e6'}); this.vfx('forcedcool.cast',this.px,this.py); this.popup(this.px,this.py-1.1,'OVERCLOCK +'+Math.round((AB.ovMul-1)*100)+'% abilities','#d5e4e6'); break; }
      case 'cloak': this.cloakT=5+m.cloakDur; this.castLook('cloak',this.px,this.py,{r:1.5,c:'#8a9a62'}); this.vfx('cloak.cast',this.px,this.py); for(const e of this.enemies){ if(e.faction==='enemy'&&dist(e.x,e.y,this.px,this.py)>1.6&&!ENEMIES[e.type].boss){ e._rt.st=e.alert?'lost':e._rt.st; } } break;
      case 'bladeburst': { const len=def.range+m.burstLen; this.face=ang; const sp=len/.18; this.lungeDx=Math.cos(ang)*sp; this.lungeDy=Math.sin(ang)*sp; this.lungeT=.18; this.iframes=Math.max(this.iframes,.3); this.lungeHit=new Set(); (this as any)._lungeDmg=AB.burstDmg*dmgM; this.castLook('bladeburst',this.px,this.py,{a:ang,len,w:1.15,c:'#c4543c'}); this.vfx('bladeburst.cast',this.px,this.py,{a:ang,len}); break; }
      case 'reposition': { const tx=v.tx!, ty=v.ty!; const ox=this.px, oy=this.py; const d=dist(ox,oy,tx,ty); this.slideFx=(tx-ox)/.12; this.slideFy=(ty-oy)/.12; this.slideT=.12; this.iframes=Math.max(this.iframes,.32); this.castLook('reposition',ox,oy,{a:Math.atan2(ty-oy,tx-ox),len:d,c:'#a8b87a'}); this.vfx('reposition.cast',ox,oy,{a:Math.atan2(ty-oy,tx-ox),len:d});
        // dash-strike: everything near the path takes damage
        for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||e._rt.reveal>0) continue; const L2=(tx-ox)**2+(ty-oy)**2||1; const tt=Math.max(0,Math.min(1,((e.x-ox)*(tx-ox)+(e.y-oy)*(ty-oy))/L2)); const dd=dist(e.x,e.y,ox+(tx-ox)*tt,oy+(ty-oy)*tt)-ENEMIES[e.type].radius; if(dd<1.1){ this.hurtEnemy(e,AB.repoDmg*dmgM,ox,oy,.6); if(!e.dead&&!ENEMIES[e.type].boss) e.stunT=Math.max(e.stunT,AB.repoStun); } }
        if(danger){ this.abCd[c.idx]=AB.evadeCd; this.heat=Math.max(0,this.heat-AB.evadeHeat); this.ovT=Math.max(this.ovT,AB.evadeBonusT); this.popup(this.px,this.py-1,'PERFECT EVADE','#a8d87a'); this.vfx('reposition.evade',tx,ty); this.emit('sfx','combo'); this.fx.push({kind:'ring',x:tx,y:ty,r:2.2,t:0,life:.5,c:'#a8d87a'}); } break; }
      case 'control': { const e=v.target!; const def0=ENEMIES[e.type];
        if(def0.boss||(e as any).pylon||def0.static){ e.stunT=Math.max(e.stunT,1); e._rt.hack=AB.hackT; this.toast(def0.name+' resists control: stunned'); }
        else if(def0.elite||(e as any).affix?.length){ e.stunT=Math.max(e.stunT,AB.ctrlResistStun); e._rt.hack=AB.hackT; this.toast(def0.name+' resists control: stunned and hacked'); }
        else { e.faction='ally'; e.ctrlT=8+m.ctrlDur; e.alert=true; e._rt.hack=AB.hackT; this.toast('Enemy control: '+def0.name+' turned'); }
        this.castLook('control',e.x,e.y,{r:1.35,c:'#7f9bb8'}); this.vfx('control.cast',e.x,e.y,{r:AB.ctrlR,x2:this.px,y2:this.py});
        // mass stun: everything near the target is pulled in, stunned and hacked
        let n=0; for(const o of this.enemies){ if(o===e||o.dead||o.faction!=='enemy'||o._rt.reveal>0) continue; const dd=dist(e.x,e.y,o.x,o.y); if(dd>AB.ctrlR) continue; n++; this.hurtEnemy(o,AB.ctrlDmg*dmgM,e.x,e.y,0); if(o.dead) continue; if(!ENEMIES[o.type].boss&&!(o as any).pylon&&!ENEMIES[o.type].static){ const a2=Math.atan2(e.y-o.y,e.x-o.x); const pull=Math.min(1.4,Math.max(0,dd-.9)); const pp=this.moveCircle(o.x,o.y,Math.cos(a2)*pull,Math.sin(a2)*pull,ENEMIES[o.type].radius); o.x=pp.x; o.y=pp.y; o.stunT=Math.max(o.stunT,AB.ctrlStun); } o._rt.hack=AB.hackT; o.alert=true; this.vfx('control.hit',o.x,o.y); }
        this.fx.push({kind:'ring',x:e.x,y:e.y,r:AB.ctrlR,t:0,life:.5,c:'#7f9bb8'}); if(n>=2) this.popup(e.x,e.y,'MASS STUN x'+(n+1),'#8fb8d8'); break; }
      case 'pulse': { const tx=v.tx!, ty=v.ty!; this.castLook('pulse',tx,ty,{r:AB.pulseR,c:'#6d90b0'}); this.vfx('pulse.cast',tx,ty,{r:AB.pulseR}); let broke=0; for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||e._rt.reveal>0) continue; if(dist(tx,ty,e.x,e.y)<=AB.pulseR+ENEMIES[e.type].radius){ const had=!!(e._rt.shield&&e._rt.shield.hp>0); this.hurtEnemy(e,AB.pulseDmg*dmgM,tx,ty,.5); if(had&&!(e._rt.shield&&e._rt.shield.hp>0)) broke++; if(!e.dead) e.stunT=Math.max(e.stunT,ENEMIES[e.type].boss?.8:AB.pulseStun); } } if(broke) this.vfx('pulse.shatter',tx,ty); if(broke) this.popup(tx,ty,'SHIELD BREAK'+(broke>1?' x'+broke:''),'#e8d890'); break; }
      case 'revive': { this.hp=Math.min(this.maxHp,this.hp+this.maxHp*.3); this.castLook('brace',this.px,this.py,{r:2.2,c:'#9fd0f0'}); this.vfx('revive.fire',this.px,this.py); for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||e._rt.reveal>0) continue; if(dist(this.px,this.py,e.x,e.y)-ENEMIES[e.type].radius<3){ this.hurtEnemy(e,60*dmgM,this.px,this.py,1.8); if(!e.dead&&!ENEMIES[e.type].boss) e.stunT=Math.max(e.stunT,1.2); } } this.popup(this.px,this.py-1,'RALLY +30% HP','#9fd0f0'); this.onTeamRevive?.(); break; }
      default: break;
    } } finally{ this.curTag='auto'; }
  }
  lungeBladeHit(){ const dm=(this as any)._lungeDmg||20; const prev=this.curTag; this.curTag='bladeburst'; for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||this.lungeHit.has(e.id)||e._rt.reveal>0) continue; if(dist(this.px,this.py,e.x,e.y)<1.2+ENEMIES[e.type].radius){ this.lungeHit.add(e.id); this.hurtEnemy(e,dm,this.px,this.py,.8); if(!e.dead&&!ENEMIES[e.type].boss) e.stunT=Math.max(e.stunT,AB.burstStun); } } this.curTag=prev; }

  // ---------- damage ----------
  hurtEnemy(e:En,dmg:number,sx:number,sy:number,knock=0){
    if(e.dead||e._rt.reveal>0) return; if(this.grace&&e.faction==='enemy') this.grace.acted=true; if(this.dbg.oneShot) dmg*=60; if(e._rt.vuln>0) dmg*=1.5; dmg=abxOutgoing(this,e,dmg); const rt=e._rt, tag=this.curTag;
    if(rt.hack>0) dmg*=AB.hackMul;
    const hadShield=!!(rt.shield&&rt.shield.hp>0);
    if(hadShield&&dmg>0){ if(tag==='pulse') dmg=Math.max(dmg*AB.pulseShield,(rt.shield.max||rt.shield.hp)*AB.pulseShieldFrac); else if(tag==='auto') dmg*=AB.shieldAuto; else dmg*=AB.shieldAbility; }
    if(tag!=='auto') rt.abHitAt=this.time;
    { const pre=e.hp+(hadShield?rt.shield.hp:0); this.dealt[tag]=(this.dealt[tag]||0)+Math.min(dmg,pre); } dmg=filterDamage(this,e,dmg); e.hp-=dmg; e.alert=true; e._rt.hit=.12; if(!ENEMIES[e.type].boss) e._rt.lost=0; if(dmg>0&&this.save.settings.gore!=='off'){ const P0=PROFILES[tag]; GORE.hit(this,e,dmg,((P0?P0.power:.3)>=.75)||dmg/Math.max(1,e.maxHp)>=.12,sx,sy); }
    this.emit('sfx','hit'); this.combatHold=3; if(!ENEMIES[e.type].boss&&this.isElite(e)) this.eliteExchange();
    const broke=hadShield&&!(rt.shield&&rt.shield.hp>0);
    if(tag!=='auto'&&dmg>0){ const P=PROFILES[tag]; const pw=P?P.power:.3; const frac=dmg/Math.max(1,e.maxHp); const heavy=pw>=.75||frac>=.12; const red=!!this.save.settings.reducedFx; // damage numbers scale with the hit; heavy hits pop (crit-style)
      this.fx.push({kind:'text',x:e.x,y:e.y,t:0,life:heavy?1.05:.85,text:String(Math.round(dmg))+(heavy?'!!':'!'),c:heavy?'#ffd27a':tag==='pulse'||tag==='control'?'#8fb8d8':tag==='brace'?'#e4dcc8':tag==='reposition'?'#a8d87a':'#e8a07a',s:red?1:Math.min(2.1,1+pw*.5+Math.min(.6,frac*3)),pop:heavy&&!red?1:0});
      if(!red){ rt.hit=.12+.12*pw; /* longer white flash on big hits */ const ra=Math.atan2(e.y-sy,e.x-sx); rt.rcA=ra; rt.rcM=(4+10*pw)*(ENEMIES[e.type].boss?.4:1); rt.rcT=this.time; /* visual-only recoil */ this.kick=Math.max(this.kick,P?P.shake*.55:.1); if(P&&pw>=.5&&!this.dbg.noHitStop&&this.time-this.lastStop>.4){ this.hitStop=Math.max(this.hitStop,P.stop); this.lastStop=this.time; } } }
    else if(this.save.settings.damageNumbers&&dmg>0) this.fx.push({kind:'text',x:e.x,y:e.y,t:0,life:.7,text:String(Math.round(dmg)),c:'#d8d2bf'});
    if(tag!=='auto'&&tag!=='brace'&&dmg>=0) this.vfx(tag+'.hit',e.x,e.y,{a:Math.atan2(e.y-sy,e.x-sx)});
    if(broke){ this.kick=Math.max(this.kick,.6); this.emit('sfx','combo'); }
    if(knock&&!ENEMIES[e.type].boss){ const a=Math.atan2(e.y-sy,e.x-sx); const p=this.moveCircle(e.x,e.y,Math.cos(a)*knock,Math.sin(a)*knock,ENEMIES[e.type].radius); e.x=p.x; e.y=p.y; }
    if(e.hp<=0){ this.killEnemy(e); if(tag!=='auto'){ for(let k=0;k<3;k++) this.abCd[k]=Math.max(0,this.abCd[k]-AB.killCdRefund); this.kick=Math.max(this.kick,.35); if(!this.save.settings.reducedFx&&!this.dbg.noHitStop&&this.time-this.lastStop>.4){ this.hitStop=.05; this.lastStop=this.time; } } }
    else { this.alertGroup(e); if(broke&&!this.save.settings.reducedFx&&!this.dbg.noHitStop&&this.time-this.lastStop>.4){ this.hitStop=.06; this.lastStop=this.time; } }
  }
  /** calm intro beat: dungeon title + objective card (UI fades them in), camera/fade settle, calm music (traversal state) */ introBeat(fresh:boolean){ const o=this.objective(); this.emit('intro',{ name:this.dd.name, zone:(this.dd.zoneLabels as any)[this.zoneAt(this.px,this.py)]||'', objective:o?o.text:'', fresh, grace:!!this.grace }); }
  /** begin the calm-start grace period (no-op when disabled: bots, headless tests, dbg.noGrace). */
  beginGrace(dur=GRACE.seconds,ext=false){ if(this.dbg.noGrace||(globalThis as any).__WV_NOGRACE) return false; this.grace={t:dur,x:this.px,y:this.py,acted:false,ext}; for(const e of this.enemies){ if(e.faction==='enemy'&&!ENEMIES[e.type]?.boss){ e.alert=false; e._rt.wake=0; } } this.emit('grace',dur); return true; }
  endGrace(why:string){ if(!this.grace) return; this.grace=null; this.emit('grace-end',why); }
  /** browser games get the grace automatically (tests opt out through localStorage wv_nograce; node sims opt in explicitly) */
  autoGrace(dur=GRACE.seconds){ if(typeof window==='undefined') return; try{ if(localStorage.getItem('wv_nograce')==='1') return; }catch{} this.beginGrace(dur); }
  private tickGrace(dt:number){ const g=this.grace; if(!g||g.ext) return; g.t-=dt; if(g.acted) this.endGrace('action'); else if(dist(this.px,this.py,g.x,g.y)>GRACE.moveR) this.endGrace('moved'); else if(g.t<=0) this.endGrace('time'); }
  alertGroup(e:En){ const stag=!!this.inst&&this.inst.elapsed<GRACE.staggerUntil; let k=0; const cand:En[]=[]; for(const o of this.enemies){ if(!o.dead&&o.faction==='enemy'&&!o.alert&&!((o._rt.wake||0)>0)&&((o.group!=null&&o.group===e.group&&dist(o.x,o.y,e.x,e.y)<16)||(dist(o.x,o.y,e.x,e.y)<HARD.packAggroR&&this.los(o.x,o.y,e.x,e.y)))) cand.push(o); }
    cand.sort((a,b)=>dist(a.x,a.y,e.x,e.y)-dist(b.x,b.y,e.x,e.y)); for(const o of cand){ if(stag&&!ENEMIES[o.type]?.boss){ k++; o._rt.wake=Math.min(GRACE.wakeMax,GRACE.wakeBase+GRACE.wakeStep*k); o._rt.hit=Math.max(o._rt.hit||0,.16); /* tell: white flash when it notices */ } else o.alert=true; } }
  hurtPlayer(dmg:number,sx:number,sy:number){
    if(this.downed||this.iframes>0||this.revealing||this.mode!=='run'||this.dbg.god||this.grace) return;
    const st=this.stat(); dmg=abxIncoming(this,dmg,sx,sy); if(dmg<=.01) return; dmg=Math.max(1,dmg-st.armor); if(this.overheated) dmg*=HEAT.overheat.takenMul; let reflectDmg=0; if(this.braceT>0){ reflectDmg=dmg*AB.reflect; dmg*=AB.braceMul; this.vfx('brace.hit',this.px,this.py,{a:Math.atan2(sy-this.py,sx-this.px)}); } this.hp-=dmg; if(reflectDmg>0) this.braceReflect(reflectDmg,sx,sy); this.emit('sfx','hurt'); this.emit('hurt',dmg); this.combatHold=3; { const k=String(this.dmgSrc).split(':')[0]; if(ENEMIES[k]&&!ENEMIES[k].boss&&this.enemies.some(o=>!o.dead&&o.type===k&&this.isElite(o)&&dist(o.x,o.y,this.px,this.py)<24)) this.eliteExchange(); }
    if(this.channel&&!this.channel.hard){ this.townInterrupt('Town return interrupted by damage',true); this.channel=null; }
    this.fx.push({kind:'blood',x:this.px,y:this.py,t:0,life:.6,c:'#7a2f26'});
    if(this.hp<=0) this.playerDown();
  }
  /** Bracing: the attacker takes a share of what it dealt; a charging attacker is counter-stunned. */
  braceReflect(dmg:number,sx:number,sy:number){
    const k=String(this.dmgSrc).split(':')[0], act=String(this.dmgSrc).split(':')[1]||''; let t:En|null=null, bd=1e9;
    for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||e._rt.reveal>0) continue; let d=dist(e.x,e.y,sx,sy); if(e.type===k) d-=3; if(d<bd){ bd=d; t=e; } }
    if(!t||bd>3.5) return; const prev=this.curTag; this.curTag='brace'; const boss=ENEMIES[t.type].boss;
    this.vfx('brace.reflect',t.x,t.y,{x2:this.px,y2:this.py}); this.hurtEnemy(t,Math.min(AB.reflectCap,dmg)*(boss?.5:1),this.px,this.py,0);
    const role=ENEMIES[t.type].mob?.role; if(!t.dead&&!boss&&(role==='charger'||/charge|rush|dash|blink/.test(act))){ t.stunT=Math.max(t.stunT,AB.counterStun); t._rt.hack=AB.hackT; this.popup(t.x,t.y,'COUNTER STUN','#e4dcc8'); }
    else if(!t.dead&&this.time-(this._refT||0)>.8){ this._refT=this.time; this.popup(this.px,this.py-.6,'REFLECT','#e4dcc8'); }
    this.curTag=prev; }
  _refT=0; hintSeen:Record<string,number>=(()=>{ try{ return JSON.parse(localStorage.getItem('wv_abhints')||'{}'); }catch{ return {}; } })();
  /** In-run ability nudges: first time an enemy trait needs an ability ("Shield: use Pulse"), and a reminder when you only auto-attack. */
  abilityHints(dt:number){
    if(this.mode!=='run'||this.downed||this.revealing) return;
    if(this.nudgeCd>0) this.nudgeCd-=dt;
    for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||!e.alert||e._rt.reveal>0||dist(e.x,e.y,this.px,this.py)>11) continue; const c=counterFor(e); if(!c||this.hintSeen[c.kind]) continue;
      this.hintSeen[c.kind]=1; try{ localStorage.setItem('wv_abhints',JSON.stringify(this.hintSeen)); }catch{} this.toast(hintText(c,this.build.abilities)); this.nudgeCd=Math.max(this.nudgeCd,8); break; }
    if(this.combatHold>0){ this.sinceAb+=dt; if(this.sinceAb>16&&this.nudgeCd<=0&&!this.overheated){ const i=this.build.abilities.findIndex((a,k)=>a&&this.abCd[k]<=0&&ABILITIES[a].heat+this.heat<=COMBAT.heat.max); if(i>=0){ this.nudgeCd=40; this.sinceAb=0; this.emit('nudge',i); this.toast(`Abilities are ready: ${ABILITIES[this.build.abilities[i]!].name} [${['Q','E','R'][i]}] hits far harder than auto-attacks.`); } } } else this.sinceAb=0;
  }
  playerDown(){
    this.hp=0; this.downed=true; this.emit('stinger','death'); this.downT=0; this.cast=null; this.aim=null; this.channel=null; this.clearTransients(); this.emit('sfx','down');
    const inst=this.inst!; const cand=SLOTS.filter(s=>!inst.broken.includes(s)&&!inst.protectedSlots.includes(s)&&this.save.installed[s]&&!ITEM_BY_ID[this.save.items.find(i=>i.uid===this.save.installed[s])!.def].id.startsWith('stock_'));
    let broke:Slot|null=null; if(cand.length){ broke=cand[Math.floor(Math.random()*cand.length)]; inst.broken.push(broke); const it=this.save.items.find(i=>i.uid===this.save.installed[broke!])!; const cost=Math.round(REPAIR_COST[ITEM_BY_ID[it.def].rarity]*HARD.death.repairMul); this.save.repairBill+=cost; inst.repairAdded+=cost; }
    { const lost=Math.floor(inst.carried.credits*HARD.death.creditLoss); if(lost>0){ inst.carried.credits-=lost; this.toast('Downed: lost '+lost+' carried credits.'); } }
    const hasDefib=this.build.passives.includes('defib')&&this.defibCd<=0;
    this.recompute(); this.hp=0; this.emit('down',{ broke:broke&&ITEM_BY_ID[this.save.items.find(i=>i.uid===this.save.installed[broke!])!.def].name, defib:hasDefib });
  }
  returnToCheckpoint(){ if(!this.downed||!this.inst) return; const inst=this.inst; for(const s of inst.broken) if(!inst.protectedSlots.includes(s)) inst.protectedSlots.push(s); inst.broken=[]; this.downed=false; this.px=inst.checkpoint.x; this.py=inst.checkpoint.y; this.recompute(); this.hp=this.maxHp; this.heat=0; this.overheated=false; this.iframes=1.5; this.resetBossIfAlive(); this.clearTransients(); this.emit('revived','checkpoint'); this.toast('Checkpoint recovery: hardware restored. Repair bill kept ('+this.save.repairBill+'c).'); }
  defibInPlace(){ if(!this.downed||!this.build.passives.includes('defib')) return; this.downed=false; this.hp=this.maxHp*.5; this.iframes=1.5; this.defibCd=90; this.clearTransients(); this.vfx('defib.fire',this.px,this.py); this.emit('revived','defib'); this.toast('Defib: back up. Broken hardware stays broken until a checkpoint.'); }

  // ---------- run logic ----------
  updateRun(dt:number){
    const inst=this.inst!; const f=inst.flags; const L=this.level;
    // checkpoints
    for(const cp of L.checkpoints){ if(dist(this.px,this.py,cp.x,cp.y)<1.8){ inst.reached=inst.reached||[]; const first=!inst.reached.includes(cp.id); if(first&&!this.downed){ inst.reached.push(cp.id); this.hp=Math.min(this.maxHp,this.hp+this.maxHp*.4); this.heat=0; this.overheated=false; this.emit('checkpoint',cp.label); this.fx.push({kind:'ring',x:cp.x,y:cp.y,r:1.1,t:0,life:.8}); }
      if(inst.checkpoint.id!==cp.id){ inst.checkpoint={id:cp.id,x:cp.x,y:cp.y}; this.toast('CHECKPOINT: '+cp.label+(first?' · +40% HP, heat vented. Downed? you return here. Menu: Restart from checkpoint.':' · respawn point set.')); this.saveNow(); }
      if(inst.broken.length&&!this.downed){ for(const s of inst.broken) inst.protectedSlots.push(s); inst.broken=[]; this.recompute(); this.toast('Checkpoint restored your hardware (repair bill kept).'); } } }
    { const zn=this.zoneAt(this.px,this.py); if(zn!==this.lastZone){ if(this.lastZone!==''&&zn!=='none') this.emit('musicnudge',null); const lab=(this.dd.zoneLabels as any)[zn]; if(lab&&this.lastZone!==''&&zn!=='none'){ const nowT=performance.now(); const last=this.zoneShown[zn]||-1e9; if(nowT-last>20000&&nowT-this.zoneAnyAt>3000){ this.zoneShown[zn]=nowT; this.zoneAnyAt=nowT; this.emit('zone',{label:lab,zone:zn,hint:this.objective()?.text||''}); } } this.lastZone=zn; } this.seenT-=dt; if(this.seenT<=0){ this.seenT=.25; this.markSeen(); } }
    // sensors (cloak route)
    const sn=L.sensors; if(this.px>=sn.x0&&this.px<=sn.x1+1&&this.py>=sn.y0&&this.py<=sn.y1+1){ if(this.cloakT<=0&&!f.alarm){ f.alarm=true; this.toast('SENSOR ALARM: security responding'); this.emit('sfx','alarm'); for(let i=0;i<4;i++){ const e=this.spawnEnemy(this.dd.alarmType,this.px+(i<2?-3:3)+(i%2)*.6,this.py+.5+(i%2)*.7); e.alert=true; } } else if(this.cloakT>0&&!this.sensorFlag){ this.sensorFlag=true; this.note('route_used','cloak'); } }
    // boss reveal trigger
    if(f.controller&&!f.bossSpawned&&!f.bossDead&&(L.reveal?dist(L.reveal.x,L.reveal.y,this.px,this.py)<=L.reveal.r:this.px>=L.revealX)&&this.zoneAt(this.px,this.py)==='boss') this.spawnBoss();
    this.updateWorldRun(dt,this.zoneAt(this.px,this.py)==='boss');
  }
  /** Instance-wide run logic that must tick once per world (not once per player): gate release, boss reveal timer, boss leash, ally expiry. inBoss = some living player is in the boss zone. */
  updateWorldRun(dt:number,inBoss:boolean){
    const f=this.inst!.flags;
    // zone based doors
    if(!f.gate1&&this.enemies.filter(e=>e.type===this.dd.gateGuard&&!e.dead).length===0){ f.gate1=true; this.openDoor('gate1'); this.toast('Security gate released'); }
    progressTick(this,dt);
    // reveal timer
    const boss=this.enemies.find(e=>ENEMIES[e.type].boss&&!e.dead);
    if(boss&&boss._rt.reveal>0){ boss._rt.reveal-=dt; this.revealing=true; this.projs=[]; this.zones=this.zones.filter(z=>z.env); if(boss._rt.reveal<=0){ boss._rt.reveal=0; this.revealing=false; boss.alert=true; this.emit('reveal-end'); this.toast('Fight!'); } }
    else if(!boss) this.revealing=false;
    // boss leash: reset if player left the boss room for >6s
    if(boss&&!this.revealing){ if(!inBoss){ boss._rt.lost+=dt; if(boss._rt.lost>6){ this.resetBossIfAlive(); this.toast('Boss reset. It will emerge again.'); } } else boss._rt.lost=0; }
    // ally expiry
    for(const e of this.enemies){ if(e.faction==='ally'){ e.ctrlT-=dt; if(e.ctrlT<=0){ e.faction='enemy'; } } if(e.stunT>0) e.stunT-=dt; }
  }
  /** Record a story event (dungeon-prefixed outside the Annex) and advance matching contracts. */
  note(kind:EventKind,key:string){ const id=this.inst?.dungeon||'annex'; record(this.story(),kind,id==='annex'?key:id+':'+key); this.contractEvent(kind,key); }
  contractEvent(kind:string,key:string){ const cs=contractState(this.save); const did=this.inst?.dungeon||'annex';
    for(const id of Object.keys(cs.active)){ const c=CONTRACT_BY_ID[id]; if(!c) continue; const g:Goal=c.goal; if(g.dungeon&&g.dungeon!==did) continue;
      const ok=(g.kind==='kill_mfr'&&kind==='kill_mfr'&&g.key===key)||(g.kind==='kill_type'&&kind==='kill_type'&&g.key===key)||(g.kind==='clear'&&kind==='run_cleared')||(g.kind==='condition'&&kind==='condition_used'&&(!g.key||g.key===key))||(g.kind==='route'&&kind==='route_used'&&g.key===key)||(g.kind==='pickup'&&kind==='pickup')||(g.kind==='boss'&&kind==='boss_defeated'&&g.key===key);
      if(ok) cs.active[id]=Math.min(g.n,(cs.active[id]||0)+1); } }
  /** Dungeon-specific replacement-boss interaction (augment-gated). The first confirmed condition wins; the other selector locks. */
  doCond(id:'A'|'B'){ const dd=this.dd, f=this.inst!.flags, c=dd.conds.find(x=>x.id===id); if(!c) return; const story=this.story(); const dc=story.dclues?.[dd.id]; const clue=dc?.[id]||dc?.general||dd.generalClue;
    if(f.cond){ this.emit('dialog',{ title:c.title, body:'Boss selection is locked: '+ENEMIES[f.bossKey!].name+'. Conflicting selectors are disabled.', options:[{label:'Close'}] }); return; }
    if(!this.build.caps.has(c.cap)){ this.emit('sfx','deny'); this.emit('dialog',{ title:c.title, body:c.denied+'\n\n'+clue, options:[{label:'Close'}] }); return; }
    this.emit('dialog',{ title:c.title, body:clue+'\n\n'+c.body+' Combat continues while this is open.', options:[
      { label:c.confirm, cb:()=>{ if(f.cond) return; this.channel={kind:'hack',t:0,dur:1.5,cb:()=>{ if(f.cond) return; f.cond=id; f.bossKey=c.boss; this.note('condition_used',id); this.note('route_used',c.cap); this.toast(c.toast); this.saveNow(); }}; }},{label:'Cancel'} ] }); }
  story(){ if(!this.save.story) this.save.story=newStory(); return this.save.story; }
  spawnEnemy(type:string,x:number,y:number):En{ const inst=this.inst!; const d=ENEMIES[type]; const e=this.wrap({ id:inst.nextId++,type,x,y,hp:d.hp*this.hpMul(),maxHp:d.hp*this.hpMul(),alert:false,dead:false,home:{x,y},group:99,faction:'enemy',ctrlT:0,stunT:0 }); this.snapWalkable(e,d.radius); e.home={x:e.x,y:e.y}; inst.enemies.push(e); this.enemies.push(e); return e; }
  spawnBoss(){
    const inst=this.inst!; const f=inst.flags; if(!f.bossKey){ f.bossKey=this.dd.defaultBoss; } // arbitration: first confirmed condition wins; none => Overseer
    f.bossSpawned=true; f.bossRevealed=true; const b=this.spawnEnemy(f.bossKey!,this.level.bossSpawn.x,this.level.bossSpawn.y); b._rt.reveal=COMBAT.bossRevealSeconds; b.alert=false; this.revealing=true; this.projs=[]; this.emit('reveal',{ key:f.bossKey, name:ENEMIES[f.bossKey!].name }); this.toast(ENEMIES[f.bossKey!].name+' emerges. You are safe during the reveal.'); this.emit('sfx','boss_reveal');
    for(const e of this.enemies){ if(e!==b&&!e.dead&&this.zoneAt(e.x,e.y)==='boss') e.dead=true; }
  }
  doInteract(it:Interact){
    const inst=this.inst; const f=inst?.flags; const b=this.build;
    if(this.mode==='town'){ this.vendorStation=it.station||''; this.emit('open',it.opens||it.id); return; }
    if(!inst||!f) return;
    const need=(cap:string,msg:string)=>{ if(!b.caps.has(cap)){ this.toast(msg); this.emit('sfx','deny'); return false; } return true; };
    switch(it.id){
      case 'hackproc': if(f.lock2){ this.toast('Locks already rerouted.'); return; } if(!need('hack','Locked relay. Needs hacking hardware (a combat route is always available).')) return;
        this.channel={kind:'hack',t:0,dur:1.5,cb:()=>{ f.lock2=true; this.openDoor('lock2'); this.toast('Security rerouted: junction lock open'); this.note('route_used','hack'); }}; this.toast('Hacking relay... (vulnerable; damage or dodge interrupts)'); break;
      case 'terminal': {
        const story=this.story(); const clue=story.clues.A||story.clues.general||'Terminal records: audit logs, nothing actionable.';
        if(f.cond){ this.emit('dialog',{ title:'Annex security terminal', body:'Boss selection is locked: '+ENEMIES[f.bossKey!].name+'. Conflicting selectors are disabled.', options:[{label:'Close'}] }); return; }
        if(!b.caps.has('hack')){ this.emit('dialog',{ title:'Annex security terminal', body:'ACCESS DENIED. Requires hacking hardware.\n\n'+clue, options:[{label:'Close'}] }); return; }
        this.emit('dialog',{ title:'Annex security terminal', body:clue+'\n\nIssue the audit command? Selects the Neural Warden as the boss for this run (disruption zones, ranged pressure). Combat continues while this is open.', options:[
          {label:'Issue audit command (Neural Warden)', cb:()=>{ if(f.cond) return; this.channel={kind:'hack',t:0,dur:1.5,cb:()=>{ if(f.cond) return; f.cond='A'; f.bossKey='warden'; this.note('condition_used','A'); this.note('route_used','hack'); this.toast('Audit command confirmed: Neural Warden selected'); this.saveNow(); }}; }},
          {label:'Cancel'} ] }); break; }
      case 'armorydoor': if(f.armory){ this.toast('Shutter already open.'); return; } if(!need('force','Sealed shutter. Needs force hardware (e.g. a ripper arm).')) return; f.armory=true; this.openDoor('armory'); this.note('route_used','force'); this.toast('Armory shutter forced open'); break;
      case 'armoryfuse': { const story=this.story(); if(f.cond){ this.emit('dialog',{title:'Command fuse',body:'Boss selection is locked: '+ENEMIES[f.bossKey!].name+'.',options:[{label:'Close'}]}); return; }
        this.emit('dialog',{ title:'Sealed armory: command fuse', body:(story.clues.B?story.clues.B+'\n\n':'Replacement-part markings line the rack.\n\n')+'Remove the command fuse? Selects the Reclamation Enforcer (ripper sweep, charge, recovery openings).', options:[
          {label:'Remove fuse (Reclamation Enforcer)', cb:()=>{ if(f.cond) return; f.cond='B'; f.bossKey='enforcer'; this.note('condition_used','B'); this.toast('Fuse removed: Reclamation Enforcer selected'); this.saveNow(); }},{label:'Cancel'} ] }); break; }
      case 'controller': if(f.controller){ this.toast('Controller already secured.'); return; } f.controller=true; this.openDoor('boss'); this.toast(this.dd.objectiveToast); this.emit('sfx','objective'); this.saveNow(); break;
      case 'cond_A': case 'cond_B': this.doCond(it.id==='cond_A'?'A':'B'); break;
      case 'cratechip': if(f.salvageForeman||inst.claimed.includes('cratechip')){ this.toast('Cache already looted.'); return; } inst.claimed.push('cratechip'); this.addDrop(it.x,it.y+.8,{kind:'chip',chip:this.dd.cache.chips[0],amount:1}); this.addDrop(it.x+.8,it.y+.6,{kind:'chip',chip:this.dd.cache.chips[1],amount:1}); this.toast('Chip cache opened'); break;
    }
  }
  updatePrompt(){ const L=this.level; const inst=this.inst; const f=inst?.flags; let best:Interact|null=null,bd=1e9;
    for(const it of L.interacts){ if(this.mode==='run'&&f){ if(it.id==='hackproc'&&f.lock2) continue; if(it.id==='armorydoor'&&f.armory) continue; if(it.id==='controller'&&f.controller) continue; if(it.id==='cratechip'&&inst!.claimed.includes('cratechip')) continue; }
      const d=dist(this.px,this.py,it.x,it.y); const rr=it.r+(this.prompt?.id===it.id?.35:0) /* small hysteresis: no flicker at the edge */; if(d<rr&&d<bd){ bd=d; best=it; } }
    if(this.prompt?.id!==best?.id) this.prompt=best; }

  // ---------- enemies ----------
  /** Flow field toward the player on the tile grid. cls 0 = plain walkable tiles; 1/2 = tiles with clearance for radius .7 / 1.1 (so wide bosses path around pillars instead of wedging). */
  static FLOW_R=[0,.7,1.1];
  flowCls(r:number){ return r<=.5?0:r<=.72?1:2; }
  flowField(cls=0){ const L=this.level; const n=L.w*L.h; if(!this.flows[cls]||this.flows[cls]!.length!==n) this.flows[cls]=new Int16Array(n); const fl=this.flows[cls]!; fl.fill(-1); const R=Game.FLOW_R[cls]; if(cls===0) this.flow=fl;
    if(!this.clr[cls]||this.clr[cls]!.length!==n||this.clrLevel!==L){ if(this.clrLevel!==L){ this.clrLevel=L; this.clr=[null,null,null]; } const m=new Uint8Array(n); for(let y=0;y<L.h;y++)for(let x=0;x<L.w;x++) m[y*L.w+x]=(!L.solid[y*L.w+x]&&(R===0||!this.circleHits(x+.5,y+.5,R)))?1:0; this.clr[cls]=m; }
    const ok=this.clr[cls]!; let sx=clamp(Math.floor(this.px),0,L.w-1), sy=clamp(Math.floor(this.py),0,L.h-1); if(L.solid[sy*L.w+sx]){ const np=this.nearestWalkable(this.px,this.py,0); if(np){ sx=Math.floor(np.x); sy=Math.floor(np.y); } } /* A* start on a non-walkable tile: snap to the nearest walkable one */ if(!this.q||this.q.length!==n) this.q=new Int32Array(n); const q=this.q; let h=0,tl=0; q[tl++]=sy*L.w+sx; fl[sy*L.w+sx]=0;
    while(h<tl){ const c=q[h++]; const cx=c%L.w, cy=(c/L.w)|0; const d=fl[c]; for(let k=0;k<4;k++){ const nx=cx+(k===0?1:k===1?-1:0), ny=cy+(k===2?1:k===3?-1:0); if(nx<0||ny<0||nx>=L.w||ny>=L.h) continue; const ni=ny*L.w+nx; if(fl[ni]>=0||L.solid[ni]) continue; if(!ok[ni]&&!(Math.abs(nx-sx)<=2&&Math.abs(ny-sy)<=2)) continue; fl[ni]=d+1; q[tl++]=ni; } } }
  flowDir(e:En,cls=0):{x:number;y:number}|null{ const L=this.level; const fl=this.flows[cls]; if(!fl) return null; const r=ENEMIES[e.type].radius*.85; let cx=clamp(Math.floor(e.x),0,L.w-1), cy=clamp(Math.floor(e.y),0,L.h-1); const val=(x:number,y:number)=>fl[y*L.w+x];
    // step greedily down the field, keeping the farthest waypoint that is still swept-clear for this radius
    let best=val(cx,cy); let wp:{x:number;y:number}|null=null; let lastClear:{x:number;y:number}|null=null;
    for(let step=0;step<8;step++){ let bx=cx,by=cy,bv=best<0?1e9:best; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy) continue; const nx=cx+dx,ny=cy+dy; if(nx<0||ny<0||nx>=L.w||ny>=L.h) continue; const v=val(nx,ny); if(v<0||L.solid[ny*L.w+nx]) continue; if(dx&&dy&&(L.solid[cy*L.w+nx]||L.solid[ny*L.w+cx])) continue; if(v<bv){ bv=v; bx=nx; by=ny; } }
      if(bx===cx&&by===cy) break; cx=bx; cy=by; best=bv; wp={x:cx+.5,y:cy+.5}; if(step===0||this.clearFor(e.x,e.y,wp.x,wp.y,r)) lastClear=wp; else break; if(best===0) break; }
    if(!lastClear&&best<0&&!wp){ // inside a clearance-blocked tile: look two rings out for any field cell
      let bv=1e9,bp:{x:number;y:number}|null=null; const ex=Math.floor(e.x), ey=Math.floor(e.y); for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){ const nx=ex+dx,ny=ey+dy; if(nx<0||ny<0||nx>=L.w||ny>=L.h) continue; const v=val(nx,ny); if(v>=0&&v<bv&&!L.solid[ny*L.w+nx]){ bv=v; bp={x:nx+.5,y:ny+.5}; } } return bp; }
    return lastClear; }
  /** Move with obstacle-avoidance: try the desired heading, then fan out +-45/90/135 degrees; returns distance moved. */
  steerMove(e:En,mx:number,my:number,speed:number,dt:number,r:number){ const step=speed*dt; const ox=e.x, oy=e.y; const base=Math.atan2(my,mx);
    for(const off of [0,.6,-.6,1.2,-1.2,1.9,-1.9]){ const a=base+(off*(((e.id|0)&1)?1:-1)); const p=this.moveCircle(e.x,e.y,Math.cos(a)*step,Math.sin(a)*step,r); const mv=dist(p.x,p.y,ox,oy); if(mv>=step*.6||off===1.9){ e.x=p.x; e.y=p.y; return mv; } }
    return 0; }
  opponents(faction:'enemy'|'ally'):{x:number;y:number;r:number;hurt:(d:number,sx:number,sy:number)=>void}[]{
    if(faction==='enemy'){ const out:any[]=[]; if(!this.downed) out.push({x:this.px,y:this.py,r:COMBAT.playerRadius,hurt:(d:number,sx:number,sy:number)=>this.hurtPlayer(d,sx,sy)}); for(const a of this.enemies) if(a.faction==='ally'&&!a.dead) out.push({x:a.x,y:a.y,r:ENEMIES[a.type].radius,hurt:(d:number,sx:number,sy:number)=>this.hurtEnemy(a,d*.7,sx,sy)});
      /* holographic decoys (Decoy Projector / Mirage Step) are hittable targets: melee, projectiles and charges land on them and shorten their life */
      for(const d of ((this.abx as any)?.deps||[])) if(d.kind==='decoy'&&d.t<d.life) out.push({x:d.x,y:d.y,r:.6,hurt:(dm:number)=>{ d.life-=Math.min(.8,.25+dm/Math.max(1,this.maxHp*.4)); d.hits=(d.hits||0)+1; this.vfx(d.ab.id+'.hit',d.x,d.y,{a:0}); this.emit('sfx','hit'); }}); return out; }
    return this.enemies.filter(e=>e.faction==='enemy'&&!e.dead&&e._rt.reveal<=0).map(e=>({x:e.x,y:e.y,r:ENEMIES[e.type].radius,hurt:(d:number,sx:number,sy:number)=>this.hurtEnemy(e,d,sx,sy,.4)})); }
  /** Party hooks (src/core/party.ts): re-aim the shared enemy AI at the player an enemy is fighting, and keep one flow field per player. Undefined in solo. */
  bindTarget?:(e:En)=>void; flowHook?:()=>void; onTeamRevive?:()=>void;
  updateEnemies(dt:number){
    this.frame++; this.flowT-=dt; if(this.flowHook) this.flowHook(); else if(this.flowT<=0){ this.flowT=.35; const need=[false,false,false]; for(const e of this.enemies){ if(!e.dead&&e.faction==='enemy'&&e.alert&&!ENEMIES[e.type].static) need[this.flowCls(ENEMIES[e.type].radius)]=true; } need[0]=true; for(let c=0;c<3;c++){ if(need[c]) this.flowField(c); } }
    const alive=this.enemies.filter(e=>!e.dead);
    for(const e of alive){ const rt=e._rt; for(const k in rt.acd) rt.acd[k]-=dt; if(rt.hit>0) rt.hit-=dt; if(rt.vuln>0) rt.vuln-=dt; if(rt.hack>0) rt.hack-=dt; if(rt.reveal>0) continue; this.bindTarget?.(e); if(BOSS_BY_ID[e.type]) bossTick(this,e,dt); else mobTick(this,e,dt); if(KITS[e.type]) kitTick(this,e,dt); this.updateEnemy(e,dt); }
    // separation
    for(let i=0;i<alive.length;i++){ const a=alive[i]; if(ENEMIES[a.type].static) continue; for(let j=i+1;j<alive.length;j++){ const b=alive[j]; const dx=b.x-a.x, dy=b.y-a.y; const d2=dx*dx+dy*dy; const rr=(ENEMIES[a.type].radius+ENEMIES[b.type].radius)*.9; if(d2<rr*rr&&d2>1e-4){ const d=Math.sqrt(d2), push=(rr-d)*.5; const nx=dx/d, ny=dy/d; if(!ENEMIES[b.type].static){ const pb=this.moveCircle(b.x,b.y,nx*push,ny*push,ENEMIES[b.type].radius*.8); b.x=pb.x; b.y=pb.y; } const pa=this.moveCircle(a.x,a.y,-nx*push,-ny*push,ENEMIES[a.type].radius*.8); a.x=pa.x; a.y=pa.y; } } }
    this.enemies=this.enemies.filter(e=>!e.dead||e._rt.bornT>-1); // keep dead for persistence
  }
  updateEnemy(e:En,dt:number){
    const def=ENEMIES[e.type]; const rt=e._rt; const player=this.downed?null:{x:this.px,y:this.py};
    if(e.stunT>0){ rt.st=rt.st==='tele'?'idle':rt.st; return; }
    // choose target
    let tx=0,ty=0,tgtIsPlayer=true,tgtEnemy:En|null=null;
    if(e.faction==='ally'){ let bd=14; for(const o of this.enemies){ if(o.dead||o.faction!=='enemy'||o._rt.reveal>0) continue; const d=dist(e.x,e.y,o.x,o.y); if(d<bd){bd=d;tgtEnemy=o;} } if(tgtEnemy){ tx=tgtEnemy.x; ty=tgtEnemy.y; tgtIsPlayer=false; } else if(player){ tx=player.x; ty=player.y; } else return; }
    else { if(!player&&!this.enemies.some(a=>a.faction==='ally'&&!a.dead)) return; tx=this.px; ty=this.py; let bd=dist(e.x,e.y,tx,ty); if(!player) bd=1e9; for(const a of this.enemies){ if(a.faction==='ally'&&!a.dead){ const d=dist(e.x,e.y,a.x,a.y); if(d<bd-1&&d<8){ bd=d; tx=a.x; ty=a.y; tgtIsPlayer=false; } } } }
    rt.taunt=0; if(e.faction==='enemy'&&e.alert&&!def.boss){ let bd=1e9, bx=0, by=0; for(const dc of ((this.abx as any)?.deps||[])){ if(dc.kind!=='decoy'||dc.t>=dc.life) continue; const dd=dist(e.x,e.y,dc.x,dc.y); if(dd<dc.r+1&&dd<bd){ bd=dd; bx=dc.x; by=dc.y; } } if(bd<1e9){ tx=bx; ty=by; tgtIsPlayer=false; rt.taunt=1; } } /* taunt: alerted non-boss enemies within the decoy's radius go for it */
    const d=dist(e.x,e.y,tx,ty); const cloaked=tgtIsPlayer&&this.cloakT>0;
    if((rt.wake||0)>0){ rt.wake=rt.wake!-dt; if(rt.wake>0) return; rt.wake=0; e.alert=true; rt.hit=Math.max(rt.hit||0,.12); this.emit('sfx','alert'); }
    if(!e.alert){ if(this.grace&&e.faction==='enemy'&&!def.boss) return; const rad=def.aggro*(cloaked?.18:1); if(e.faction==='enemy'&&tgtIsPlayer&&d<rad&&this.los(e.x,e.y,tx,ty)){ e.alert=true; this.alertGroup(e); this.emit('sfx','alert'); } else return; }
    if(cloaked&&d>1.7&&rt.st!=='tele'&&rt.st!=='dash'){ rt.lost+=dt; if(rt.lost>1.5){ e.alert=false; rt.lost=0; rt.st='idle'; } return; }
    const speed=def.speed*(this.zoneSlow(e)?.7:1)*(rt.spdMul||1)*abxSpeedMul(this,e);
    const ang=Math.atan2(ty-e.y,tx-e.x);
    // state machine
    if(rt.st==='tele'){ rt.t+=dt; const A=ATK[rt.atk]; if(rt.t<A.w*.6||!A.lock) rt.ang=ang; if(rt.t>=A.w){ const hp0=this.hp; this.resolveAttack(e,rt.atk,tx,ty); mobAfterHit(this,e,hp0); if(rt.st==='tele'&&!rt.chained){ rt.st='rec'; rt.t=0; } rt.chained=false; } return; }
    if(rt.st==='rec'){ rt.t+=dt; if(rt.t>=(ATK[rt.atk]?.rec??.5)) rt.st='chase'; return; }
    if(rt.st==='dash'){ this.dashStep(e,dt); return; }
    rt.st='chase';
    // attack choice
    if(rt.st==='chase'){
      const choices=def.attacks.filter(a=>{ const A=ATK[a]; if((rt.acd[a]||0)>0) return false; if(d<A.min||d>A.max) return false; if(A.ranged&&!this.los(e.x,e.y,tx,ty)) return false; if(MOB_COND[a]&&!MOB_COND[a](this,e)) return false; if(def.boss&&a==='summon'&&this.enemies.filter(o=>!o.dead&&o.faction==='enemy'&&!ENEMIES[o.type].boss).length>8) return false; return true; });
      if(choices.length){ const a=choices[Math.floor(Math.random()*choices.length)]; this.beginAttack(e,a,ang,tx,ty); return; }
    }
    // movement
    let mx=0,my=0; const wantKeep=def.ranged&&!def.static?(def.keep??(def.boss?7:5.5)):0;
    if(def.static) { rt.ang=ang; return; }
    if(e.faction==='ally'&&d<1.2) return;
    if(wantKeep&&d<wantKeep-1&&this.los(e.x,e.y,tx,ty)){ mx=-Math.cos(ang); my=-Math.sin(ang); const sd=rt.strafe; mx+= -Math.sin(ang)*sd*.5; my+= Math.cos(ang)*sd*.5; }
    else if(wantKeep&&d<wantKeep+1.5&&this.los(e.x,e.y,tx,ty)){ mx=-Math.sin(ang)*rt.strafe*.4; my=Math.cos(ang)*rt.strafe*.4; }
    else if(d>(def.ranged?wantKeep:1.0)){ const rr=def.radius*.85; if(d<2.2&&this.clearFor(e.x,e.y,tx,ty,rr)||!tgtIsPlayer&&this.clearFor(e.x,e.y,tx,ty,rr)||this.clearFor(e.x,e.y,tx,ty,rr)&&d<14){ mx=Math.cos(ang); my=Math.sin(ang); rt.wp=null; } else { rt.wpT=(rt.wpT||0)-dt; if(rt.wpT<=0||!rt.wp){ rt.wpT=.15+((e.id|0)%4)*.03; rt.wp=this.flowDir(e,this.flowCls(def.radius)); } const w=rt.wp; if(w){ const a2=Math.atan2(w.y-e.y,w.x-e.x); mx=Math.cos(a2); my=Math.sin(a2); if(dist(e.x,e.y,w.x,w.y)<.35) rt.wpT=0; } else { mx=Math.cos(ang); my=Math.sin(ang); } } }
    // flanking: melee pack members (3+ alerted in the group) fan out and arc in from the sides instead of queueing behind each other
    if((mx||my)&&!rt.wp&&this.flankOn(e,def,d,tgtIsPlayer,dt)){ const ph=(rt.flankSide||1)*Math.min(HARD.flank.maxAng,(d-HARD.flank.closeIn)*HARD.flank.gain); const ca=Math.cos(ph), sa=Math.sin(ph); const nx=mx*ca-my*sa, ny=mx*sa+my*ca; if(this.clearFor(e.x,e.y,e.x+nx*2.2,e.y+ny*2.2,def.radius*.85)){ mx=nx; my=ny; } }
    // stuck detection: no real progress while trying to move => sidestep + repath
    if(rt.unstick&&rt.unstick>0){ rt.unstick-=dt; const pa=Math.atan2(my,mx)+(rt.side||1)*Math.PI/2; const lm=Math.hypot(mx,my)||1; mx=mx/lm*.5+Math.cos(pa)*.8; my=my/lm*.5+Math.sin(pa)*.8; }
    const l=Math.hypot(mx,my); if(l>0){ this.unwedge(e,def.radius*.85); this.steerMove(e,mx/l,my/l,speed,dt,def.radius*.85); rt.ang=Math.atan2(my,mx);
      rt.sT=(rt.sT||0)+dt; if(rt.sx===undefined){ rt.sx=e.x; rt.sy=e.y; rt.sT=0; } else if(rt.sT>=.5){ const prog=dist(e.x,e.y,rt.sx!,rt.sy!); if(prog<speed*.5*.3&&d>1.5){ rt.unstick=.7; rt.side=-(rt.side||((e.id|0)&1?1:-1)); rt.wp=null; rt.wpT=0; } rt.sx=e.x; rt.sy=e.y; rt.sT=0; } }
    else rt.ang=ang;
  }
  /** true when this melee enemy should arc around the player: pack of 3+ alerted group members, not a boss/ranged/static, still outside close range. Side/role is stable per enemy (about 2/3 of a pack flanks, the rest hold the front). */
  flankOn(e:En,def:any,d:number,tgtIsPlayer:boolean,dt:number):boolean{ const rt=e._rt; if(def.boss||def.ranged||def.static||!tgtIsPlayer||e.faction!=='enemy'||d<=HARD.flank.closeIn||d>HARD.flank.maxD) return false;
    rt.fkT=(rt.fkT||0)-dt; if(rt.fkT===undefined||rt.fkT<=0||rt.fkN===undefined){ rt.fkT=.5; let n=0; for(const o of this.enemies) if(!o.dead&&o.alert&&o.group===e.group&&o.faction==='enemy'&&dist(o.x,o.y,e.x,e.y)<14&&!ENEMIES[o.type].ranged) n++; rt.fkN=n; rt.flankSide=(e.id&1)?1:-1; rt.flanker=(e.id%3)!==0; }
    return !!rt.flanker&&(rt.fkN||0)>=HARD.flank.minPack; }
  zoneSlow(e:En){ return false; }
  beginAttack(e:En,a:string,ang:number,tx:number,ty:number){
    const rt=e._rt; const A=ATK[a]; rt.st='tele'; rt.atk=a; rt.t=0; rt.ang=ang; rt.acd[a]=A.cd*(.85+Math.random()*.3); rt.shots=[]; this.emit('sfx','telegraph_'+(ENEMIES[e.type].elite?'elite':'basic'));
    const zp=this.zonePattern(e,a,tx,ty); if(zp) rt.shots=zp;
    if(a==='zones'){ // three ground zones around the player's position (readable, lingering)
      for(let i=0;i<3;i++){ const aa=Math.random()*Math.PI*2, rr=i===0?0:2.4+Math.random()*1.6; const zx=tx+Math.cos(aa)*rr, zy=ty+Math.sin(aa)*rr; if(!this.solidAt(zx,zy)){ rt.shots.push({x:zx,y:zy}); this.zones.push({x:zx,y:zy,r:2.1,t:0,life:6,dps:ENEMY_DMG.zones,heat:12,windup:1.5}); } }
    }
  }
  /** Boss/elite ground-pattern attacks added by dungeon content. Reuses the lingering-zone system (telegraphed windup, then damaging). */
  zonePattern(e:En,a:string,tx:number,ty:number):{x:number;y:number}[]|null{
    const def=ENEMIES[e.type]; const dps=(ENEMY_DMG[a]||0)*(def.dmgMul||1); const out:{x:number;y:number}[]=[]; const aim=Math.atan2(ty-e.y,tx-e.x); if(MOB_ATK[a]) return mobPattern(this,e,a,tx,ty);
    const pal=palOf(e.type); const add=(x:number,y:number,r:number,windup:number,life:number,heat:number,style='pool')=>{ if(this.solidAt(x,y)) return; out.push({x,y}); this.zones.push({x,y,r,t:0,life,dps,heat,windup,style,pal}); };
    switch(a){
      case 'slagpool': for(let i=0;i<4;i++) add(e.x+Math.cos(aim)*(3+i*2),e.y+Math.sin(aim)*(3+i*2),1.6,1.2,7,14,'pool'); break;
      case 'gasvent': for(let i=0;i<3;i++){ const aa=Math.random()*6.28, rr=i===0?0:2.6; add(tx+Math.cos(aa)*rr,ty+Math.sin(aa)*rr,2.3,1.3,8,22,'gas'); } break;
      case 'ringpools': { const g=Math.floor(Math.random()*10); const gc=((g+.5)/10)*Math.PI*2; this.zones.push({x:e.x,y:e.y,r:7,r0:4,shape:'ring',style:'toll',gapA:gc,gapW:Math.max(.6,3/10*Math.PI*2-2*1.5/5.5),pal,t:0,life:7,dps,heat:14,windup:1.6}); out.push({x:e.x,y:e.y}); break; }
      case 'sawlanes': for(let lane=0;lane<2;lane++){ const cx=tx+Math.cos(aim)*lane*3.6, cy=ty+Math.sin(aim)*lane*3.6; const gapI=lane?2:0; for(const [i0,i1] of [[-3.5,gapI-.5],[gapI+.5,3.5]]){ if(i1-i0<.6) continue; const x=cx-Math.sin(aim)*i0*2.2, y=cy+Math.cos(aim)*i0*2.2; const al=aim+Math.PI/2; if(this.solidAt(x,y)) continue; out.push({x,y}); this.zones.push({x,y,r:1,a:al,len:(i1-i0)*2.2,w:2.4,shape:'line',style:'saw',pal,t:0,life:5,dps,heat:12,windup:1.5}); } } break;
      case 'cratefall': add(tx,ty,1.7,1.3,1.9,8,'drop'); for(let i=0;i<6;i++){ const aa=Math.random()*6.28, rr=1.5+Math.random()*4; add(tx+Math.cos(aa)*rr,ty+Math.sin(aa)*rr,1.7,1.3,1.9,8,'drop'); } break;
      default: return movePattern(this,e,a,tx,ty,dps,ATK[a]?.w||1);
    }
    return out; }
  resolveAttack(e:En,a:string,tx:number,ty:number){
    const def=ENEMIES[e.type]; const rt=e._rt; const fac=e.faction; const ang=rt.ang; const dmg0=ENEMY_DMG[a]*(fac==='ally'?1.2:1)*(def.dmgMul||1)*(rt.hardDmg||1); const dmg=def.boss&&fac==='enemy'?Math.min(dmg0,BOSS_HIT_CAP*this.maxHp):dmg0; /* docs/BALANCE.md: no boss melee/projectile hit takes more than BOSS_HIT_CAP of max HP */ this.dmgSrc=e.type+':'+a;
    const cone=(r:number,arc:number)=>{ this.fx.push({kind:'slash',x:e.x,y:e.y,a:ang,r,t:0,life:.25,w:arc,c:'#b8b09a'}); for(const o of this.opponents(fac)){ if(dist(e.x,e.y,o.x,o.y)-o.r<=r&&Math.abs(angDiff(Math.atan2(o.y-e.y,o.x-e.x),ang))<=arc/2) o.hurt(dmg,e.x,e.y); } this.emit('sfx','enemy_swing'); };
    const proj=(aa:number,speed:number)=>{ this.projs.push({x:e.x+Math.cos(aa)*.6,y:e.y+Math.sin(aa)*.6,vx:Math.cos(aa)*speed,vy:Math.sin(aa)*speed,dmg,r:.22,life:1.6,faction:fac==='ally'?'ally':'enemy',kind:'bolt'}); this.emit('sfx','enemy_shot'); };
    if(MOB_ATK[a]){ resolveMobAttack(this,e,a,tx,ty,dmg); return; }
    if(MOVES[a]){ resolveMove(this,e,a,tx,ty,dmg); return; }
    switch(a){
      case 'swing': cone(1.5,Math.PI*.6); break; case 'cleave': cone(2.6,Math.PI*.75); break; case 'rsweep': cone(3.8,Math.PI*.85); break;
      case 'slam': this.fx.push({kind:'ring',x:e.x,y:e.y,r:3.4,t:0,life:.4,c:'#b8b09a'}); for(const o of this.opponents(fac)) if(dist(e.x,e.y,o.x,o.y)-o.r<=3.4) o.hurt(dmg,e.x,e.y); this.emit('sfx','slam'); break;
      case 'shot': case 'turretshot': proj(Math.atan2(ty-e.y,tx-e.x),a==='shot'?11:13); break;
      case 'volley': for(const o of [-.25,0,.25]) proj(rt.ang+o,10); break;
      case 'summon': for(let i=0;i<3;i++){ const aa=Math.random()*6.28; const p={x:e.x+Math.cos(aa)*2.5,y:e.y+Math.sin(aa)*2.5}; if(!this.solidAt(p.x,p.y)){ const w=this.spawnEnemy(def.summon||'worker',p.x,p.y); w.alert=true; } } this.fx.push({kind:'ring',x:e.x,y:e.y,r:2.5,t:0,life:.5,c:'#8f8a74'}); break;
      case 'zones': break;
      case 'bite': cone(1.3,Math.PI*.5); break; case 'chainsweep': cone(4.6,Math.PI*.95); break; case 'riposte': cone(2.4,Math.PI*.7); break;
      case 'slagshot': proj(Math.atan2(ty-e.y,tx-e.x),10); break; case 'dart': proj(Math.atan2(ty-e.y,tx-e.x),12); break;
      case 'scalpelfan': for(const o of [-.4,-.2,0,.2,.4]) proj(rt.ang+o,12); break;
      case 'slagpool': case 'gasvent': case 'ringpools': case 'sawlanes': case 'cratefall': break; // zone patterns spawn at telegraph start
      case 'blink': { const fa=fac==='enemy'?this.face:Math.atan2(ty-e.y,tx-e.x); for(const dd of [2.2,1.5,1]){ const nx=tx-Math.cos(fa)*dd, ny=ty-Math.sin(fa)*dd; if(!this.circleHits(nx,ny,def.radius*.85)){ this.fx.push({kind:'dust',x:e.x,y:e.y,t:0,life:.4}); e.x=nx; e.y=ny; break; } } rt.ang=Math.atan2(ty-e.y,tx-e.x); rt.chained=true; rt.st='tele'; rt.atk='riposte'; rt.t=0; this.emit('sfx','slam'); return; }
      case 'charge': rt.st='dash'; rt.t=0; rt.dashed=false; rt.hit=0; (rt as any).hitP=false; return;
    }
  }
  dashStep(e:En,dt:number){
    const def=ENEMIES[e.type]; const rt=e._rt; this.dmgSrc=e.type+':charge'; const sp=17; const R=def.radius*.8; const want=sp*dt; const n=Math.max(1,Math.ceil(want/.25)); let moved=0;
    for(let i=0;i<n;i++){ const sdt=dt/n; const dx=Math.cos(rt.ang)*sp*sdt, dy=Math.sin(rt.ang)*sp*sdt; // full-vector move only: a charge stops at a collider instead of sliding/wedging along it
      if(this.circleHits(e.x+dx,e.y+dy,R)) break; e.x+=dx; e.y+=dy; moved+=Math.hypot(dx,dy); }
    rt.t+=dt;
    for(const o of this.opponents(e.faction)){ if(dist(e.x,e.y,o.x,o.y)<def.radius+o.r+.2&&!(rt as any).hitP){ (rt as any).hitP=true; o.hurt(ENEMY_DMG.charge,e.x,e.y); } }
    if(moved<want*.95||rt.t>.6){ this.unwedge(e,R); rt.sx=undefined; rt.unstick=0; rt.st='rec'; rt.atk='charge'; rt.t=0; rt.vuln=def.boss?2.8:1.8; this.fx.push({kind:'dust',x:e.x,y:e.y,t:0,life:.5}); this.emit('sfx','slam'); }
  }
  updateProjs(dt:number){
    for(const p of this.projs){ this.dmgSrc=(p as any).src||'proj'; p.life-=dt; const nx=p.x+p.vx*dt, ny=p.y+p.vy*dt; if(this.solidAt(nx,ny)){ p.life=0; this.fx.push({kind:'spark',x:p.x,y:p.y,t:0,life:.2}); continue; } p.x=nx; p.y=ny;
      if(p.faction==='enemy'){ for(const o of this.opponents('enemy')) if(dist(p.x,p.y,o.x,o.y)<o.r+p.r){ o.hurt(p.dmg,p.x-p.vx,p.y-p.vy); p.life=0; break; } }
      else { for(const o of this.opponents('ally')) if(dist(p.x,p.y,o.x,o.y)<o.r+p.r){ this.curTag=(p as any).tag||'auto'; o.hurt(p.dmg,p.x-p.vx,p.y-p.vy); this.curTag='auto'; this.fx.push({kind:'spark',x:p.x,y:p.y,t:0,life:.2}); p.life=0; break; } } }
    this.projs=this.projs.filter(p=>p.life>0);
  }
  /** Drops every temporary ground/overlay thing tied to the current fight: hostile zones, projectiles, deployables, delayed casts, buff rings, particles. Env hazards (z.env) stay. */
  clearTransients(){ this.zones=this.zones.filter(z=>z.env); this.projs=[]; this.fx=[]; this.vev=[]; try{ VFX.reset(); }catch{} const a:any=this.abx; if(a){ a.deps=[]; a.delayed=[]; a.projs=[]; a.shield=0; a.shieldT=0; a.mit={m:1,t:0}; a.reflect={f:0,t:0}; a.dmg={m:1,t:0}; a.move={m:1,t:0}; a.ambush={m:1,t:0}; a.steal={f:0,t:0}; a.toggles=new Set(); } this.cast=null; this.aim=null; this.cloakT=0; this.braceT=0; }
  /** Generic safety net (runs ~1/s in a run): expire stale/non-finite zones, cap zones, deployables and fx so nothing can pile up or stick. */
  sanitizeGround(){ this.zones=this.zones.filter(z=>z.env||(isFinite(z.life)&&z.t<z.life+1)); { let drop=this.zones.filter(z=>!z.env).length-64; if(drop>0){ /* never cancel a telegraph that has not resolved yet: shed the already-fired zones first (oldest first), unresolved ones only as a last resort */ for(const z of this.zones) if(drop>0&&!z.env&&z.t>=z.windup){ (z as any)._shed=1; drop--; } for(const z of this.zones) if(drop>0&&!z.env&&!(z as any)._shed){ (z as any)._shed=1; drop--; } this.zones=this.zones.filter(z=>!(z as any)._shed); } }
    const a:any=this.abx; if(a){ a.deps=a.deps.filter((d:any)=>isFinite(d.life)&&d.t<d.life+1); if(a.deps.length>24) a.deps.splice(0,a.deps.length-24); if(a.delayed.length>40) a.delayed.splice(0,a.delayed.length-40); if(a.projs.length>80) a.projs.splice(0,a.projs.length-80); }
    this.fx=this.fx.filter(f=>isFinite(f.life)&&f.t<f.life+1); if(this.fx.length>260) this.fx.splice(0,this.fx.length-260); }
  sanT=0;
  updateZones(dt:number){ const tg=(!this.downed&&!this.revealing)?[{px:this.px,py:this.py,g:this as any,hurt:(d:number,sx:number,sy:number)=>this.hurtPlayer(d,sx,sy)}]:[]; for(const z of this.zones){ this.dmgSrc=(z as any).src||(z.env?'env':'zone'); tickZone(this,z,dt,tg,COMBAT.heat.max,COMBAT.playerRadius); } const old=this.zones; this.zones=this.zones.filter(z=>z.t<z.life); if(old.length!==this.zones.length) endZones(this,old); const MAXZ=48; { let drop=this.zones.filter(z=>!z.env&&!(z as any).kit).length-MAXZ; if(drop>0){ /* shed already-fired zones first so a telegraph is never cancelled before it resolves */ for(const z of this.zones) if(drop>0&&!z.env&&!(z as any).kit&&z.t>=z.windup){ (z as any)._shed=1; drop--; } for(const z of this.zones) if(drop>0&&!z.env&&!(z as any).kit&&!(z as any)._shed){ (z as any)._shed=1; drop--; } this.zones=this.zones.filter(z=>!(z as any)._shed); } } }
  zoneTick=0;
  /** balance instrumentation only: label of whatever is currently damaging the player (tools/balance) */ dmgSrc='';

  // ---------- death, loot, XP ----------
  killEnemy(e:En){
    if(e.dead) return; const def=ENEMIES[e.type]; e.dead=true; e.hp=0; mobDeath(this,e); this.combatHold=3;
    this.emit('sfx','death_'+(def.boss?'boss':def.elite?'elite':def.mfr)); GORE.kill(this,e);
    this.fx.push({kind:'burst',x:e.x,y:e.y,t:0,life:.3});
    if(e.faction==='ally') { return; }
    this.grantKill(e); const inst=this.inst!;
    if(e.type===this.dd.lockElite&&!inst.flags.lock2){ inst.flags.lock2=true; this.openDoor('lock2'); this.toast(def.name+' down: lock released'); }
    if(def.boss) this.onBossDead(e);
  }
  /** Per-player kill rewards: counters, XP, reputation, contract credit and this player's OWN loot/cosmetic/ability rolls. Solo calls it once; a party calls it once per participating member (each with their own save, pity timers and rng). */
  grantKill(e:En){ const def=ENEMIES[e.type]; const inst=this.inst!; this.kills++; this.save.stats.kills++; inst.kills[e.type]=(inst.kills[e.type]||0)+1;
    { const xpv=def.xp*((e as any).affix?.length?2.5:1); this.addXp(xpv); inst.xpEarned+=xpv; } this.save.rep[def.mfr]+=def.rep; record(this.story(),'kill_mfr',def.mfr); this.contractEvent('kill_mfr',def.mfr); this.contractEvent('kill_type',e.type);
    this.rollLoot(e); }
  addXp(n:number){ const s=this.save; s.xp+=n; while(s.level<PROGRESSION.maxLevel&&s.xp>=PROGRESSION.xpForLevel(s.level)){  s.xp-=PROGRESSION.xpForLevel(s.level); s.level++; this.emit('musicnudge',null); this.emit('stinger','levelup'); this.toast('Level up! Level '+s.level); this.recompute(); } this.checkTownUnlocks(); }
  pickEntry(pool:LootEntry[]):LootEntry{ const tot=pool.reduce((a,b)=>a+b.w,0); let last=pool[0];
    for(let tries=0;tries<10;tries++){ let r=Math.random()*tot, pick=pool[0]; for(const e of pool){ r-=e.w; if(r<=0){ pick=e; break; } } last=pick;
      const rar:Rarity=pick.item?ITEM_BY_ID[pick.item].rarity:pick.chip?CHIPS[pick.chip].rarity:'green'; if(Math.random()<(HARD.rarityKeep[rar]??1)) return pick; } /* slower power curve: rarer rarities are re-rolled away; orange is signature-only */
    return pool.find(e=>(e.item?ITEM_BY_ID[e.item].rarity:'grey')==='grey'||e.stim)||last; }
  rollLoot(e:En){
    const def=ENEMIES[e.type]; const inst=this.inst!; const tier=def.boss?'boss':(def.elite||(e as any).affix?.length)?'elite':'ordinary'; const T=LOOT[tier]; const pool=this.dd.loot?this.dd.loot[tier]:T.pool; const rolls=def.boss?LOOT.boss.rolls:def.elite?2:1;
    const sc=DROP.scale*(HARD.dropTier[this.dd.tier||0]||1), ord=tier==='ordinary', pile=ord?Math.min(1,DROP.creditPile*sc):1, cm=ord?(sc>=1?1:Math.min(8,DROP.creditKeep/sc)):1;
    const cr=T.credits.map(c=>c*this.dd.creditMul*cm) as [number,number]; if(Math.random()<pile) this.addDrop(e.x,e.y,{kind:'credits',amount:Math.round(cr[0]+Math.random()*(cr[1]-cr[0]))});
    const affixOnly=tier==='elite'&&!def.elite, guar=def.boss?DROP.bossGuaranteed:def.elite?DROP.eliteGuaranteed:0, extra=def.boss?DROP.bossExtra:tier==='elite'?DROP.eliteExtra:0;
    for(let i=0;i<rolls;i++){ const ch=ord?T.chance*Math.min(1,sc):i<guar?1:affixOnly&&i===0?HARD.affixChance:Math.min(1,extra*(sc/DROP_RATE_SCALE)); if(Math.random()>ch) continue; let pl=pool; if(def.boss&&i===1&&Math.random()<HARD.bossSecondNonItem){ const alt=pool.filter(x=>!x.item); if(alt.length) pl=alt; } this.dropEntry(this.abConvert(this.pickEntry(pl),tier),e.x,e.y); }
    const sig=def.boss?(this.dd.id==='annex'?LOOT.signature[e.type]:this.dd.signature?.[e.type]):null; if(sig&&Math.random()<sig.chance) this.dropEntry({item:sig.item,w:1},e.x,e.y);
    this.rollCosmeticDrop(tier,def.boss?e.type:null);
  }
  /** Cosmetic (appearance-only) drop: goes straight to the wardrobe, never a ground pile, so DROP_RATE_SCALE volume is untouched. */
  rollCosmeticDrop(tier:'ordinary'|'elite'|'boss',bossId:string|null){ const r=rollCosmetic(this.save,tier,bossId,this.dd.tier||0); if(!r) return;
    if(r.def){ this.toast('Wardrobe: new '+r.def.rarity+' '+COS_SLOT_LABEL[r.def.slot].toLowerCase()+' found: '+r.def.name+'. Equip it in the locker Wardrobe.'); this.emit('cosmeticFound',r.def.id); }
    else if(r.dupeCredits){ this.save.credits+=r.dupeCredits; this.toast('Duplicate cosmetic salvaged for '+r.dupeCredits+'c'); } }
  /** Acquisition curve: a rolled item/chip is swapped for an ability-bearing augment (never an extra drop, so DROP_RATE_SCALE still bounds volume). Pity: the first run and any run after a dry one force one common ability augment. */
  abConvert(en:LootEntry,tier:'ordinary'|'elite'|'boss'):LootEntry{
    const s=this.save, inst=this.inst as any, A=ABILITY_ACQ; if(en.stim&&tier==='ordinary') { /* stims convert too, they are the most common roll */ }
    if(en.item&&ITEM_BY_ID[en.item]?.abilities?.length){ inst.abForced=true; return en; }
    const aq=s.abAcq=s.abAcq||{total:0,dry:0}; const rank:any={}; for(const m of ['HI','PS','MM'] as const) rank[m]=repRank(s.rep[m]);
    const env={ level:s.level, tierCap:this.dd.tierCap, rank, discovered:s.codex, rnd:Math.random };
    const forced=!inst.abForced&&((A.firstRunGuarantee&&aq.total===0)||aq.dry>=A.pityRuns);
    if(forced){ const it=pickCommonAbilityItem(env); if(it){ inst.abForced=true; return { item:it.id, w:1 }; } }
    if(Math.random()<A.convert[tier]*A.scale){ const it=pickAbilityItem({ ...env, tier }); if(it){ inst.abForced=true; return { item:it.id, w:1 }; } }
    return en; }
  /** Abilities codex: first time hardware granting an ability shows up in storage / the run bag, toast it and record it. The first scan of a save only seeds (no toast spam). */
  codexScan(){ const s=this.save; const seen:Record<string,string>={}; const add=(defId:string)=>{ const d=ITEM_BY_ID[defId]; if(d) for(const a of d.abilities||[]) seen[a]=seen[a]||d.rarity; };
    for(const it of s.items) add(it.def); if(this.inst) for(const it of this.inst.carried.items) add(it.def);
    if(!s.codex){ s.codex={}; for(const a of [...Object.keys(seen),...STARTER_ABILITIES]) s.codex[a]=0; return; }
    for(const a of Object.keys(seen)){ if(s.codex[a]!==undefined) continue; s.codex[a]=Date.now(); const def=ABILITIES[a]; if(!def) continue; this.toast('New ability discovered: '+def.name+' ('+(def.rarity||seen[a])+'). See Abilities codex.'); this.emit('abilityDiscovered',a); } }
  /** Quick-swap: cycle which granted ability sits on button i (skips ones already bound elsewhere). */
  cycleAbility(i:number,dir=1):boolean{ const gr=this.build.granted; const cur=[...this.build.abilities]; if(gr.length<=cur.length&&gr.length<=1||i>=Math.max(cur.length,1)) return false; const free=gr.filter(a=>!cur.includes(a)||a===cur[i]); if(free.length<2) return false;
    const nx=free[(free.indexOf(cur[i])+dir+free.length)%free.length]; return this.setAbilityPick(i,nx); }
  setAbilityPick(i:number,id:string|null):boolean{ if(i<0||i>2) return false; const gr=this.build.granted; if(id&&!gr.includes(id)) return false; const cur=[...this.build.abilities]; while(cur.length<3) cur.push(null as any);
    const j=id?cur.indexOf(id):-1; if(j>=0&&j!==i){ cur[j]=cur[i]; } cur[i]=id as any; this.save.abPick=cur.slice(0,3) as (string|null)[]; this.abCd[i]=Math.max(this.abCd[i],.6); if(j>=0&&j!==i) this.abCd[j]=Math.max(this.abCd[j],.6); this.recompute(); this.emit('abilityPick',i); return true; }
  /** Personal loot, filtered against the recipient level. Ineligible items are NOT rerolled downward (spec). */
  dropEntry(en:LootEntry,x:number,y:number){
    if(en.item){ const d=ITEM_BY_ID[en.item]; if(d.lvl>this.save.level||d.lvl>this.dd.tierCap){ this.emit('filtered',d.name); return; } this.addDrop(x,y,{kind:'item',inst:mkInst(this.save,en.item),amount:1}); }
    else if(en.chip) this.addDrop(x,y,{kind:'chip',chip:en.chip,amount:1}); else if(en.stim) this.addDrop(x,y,{kind:'stim',amount:1});
  }
  /** Nearest spot to (x,y) the player can actually stand on and collect: clear of walls/props for LOOT_CLEAR, and visible from the origin (no tossing through walls). */
  lootSpot(x:number,y:number,prefer?:number):{x:number;y:number}{ const C=LOOT_CLEAR; const okAt=(px:number,py:number,ox:number,oy:number)=>!this.solidAt(px,py)&&!this.circleHits(px,py,C)&&this.los(ox,oy,px,py);
    let ox=x, oy=y; if(this.circleHits(ox,oy,C)){ let best:{x:number;y:number}|null=null, bd=1e9; for(let r=.25;r<=4&&!best;r+=.25) for(let k=0;k<16;k++){ const a=k/16*6.2832, qx=x+Math.cos(a)*r, qy=y+Math.sin(a)*r; if(!this.solidAt(qx,qy)&&!this.circleHits(qx,qy,C)){ const d=r; if(d<bd){ bd=d; best={x:qx,y:qy}; } } } if(best){ ox=best.x; oy=best.y; } }
    const a0=prefer??Math.random()*6.2832; for(const r of [.3+Math.random()*.8,.6,.9,.4,1.2,.2]) for(let k=0;k<12;k++){ const a=a0+k*.5236; const px=ox+Math.cos(a)*r, py=oy+Math.sin(a)*r; if(okAt(px,py,ox,oy)) return {x:px,y:py}; }
    return {x:ox,y:oy}; }
  /** Existing ground loot that ended up inside a wall/prop edge (older saves, knockback tosses) is moved to the nearest reachable spot. Returns how many moved. */
  fixStuckDrops():number{ const inst=this.inst; if(!inst) return 0; let n=0; for(const d of inst.drops){ if(this.solidAt(d.x,d.y)||this.circleHits(d.x,d.y,LOOT_CLEAR*.9)){ const p=this.lootSpot(d.x,d.y); d.x=p.x; d.y=p.y; n++; } } return n; }
  addDrop(x:number,y:number,d:Partial<Drop>&{kind:Drop['kind']}){ const inst=this.inst!; const sp=this.lootSpot(x,y); const px=sp.x, py=sp.y; const dr:Drop={ id:inst.nextId++, x:px, y:py, kind:d.kind, inst:d.inst, chip:d.chip, amount:d.amount||1, born:this.time }; inst.drops.push(dr); const rar=this.dropRarity(dr); if(RARITY_RANK[rar]>=3) this.emit('sfx','loot_'+rar); return dr; }
  dropRarity(d:Drop):Rarity{ if(d.kind==='item') return ITEM_BY_ID[d.inst!.def].rarity; if(d.kind==='chip') return CHIPS[d.chip!].rarity; if(d.kind==='stim') return 'green'; return 'grey'; }
  carriedCount(){ const c=this.inst!.carried; return c.items.length+Object.values(c.chips).filter(v=>v&&v>0).length+(c.stims>0?1:0); }
  autoPickup(){
    const inst=this.inst!; if(this.downed) return; const rad=COMBAT.pickupRadius+this.stat().pickup; const near=inst.drops.filter(d=>dist(d.x,d.y,this.px,this.py)<rad);
    near.sort((a,b)=>RARITY_RANK[this.dropRarity(b)]-RARITY_RANK[this.dropRarity(a)]); const c=inst.carried;
    for(const d of near){ if(d.kind!=='credits'&&d.inst){ const rr=this.dropRarity(d); if(rr==='purple'||rr==='orange') this.emit('stinger','rare'); } this.pickFx.push({id:d.id,x:d.x,y:d.y,kind:d.kind,inst:d.inst,chip:d.chip,amount:d.amount,t0:this.time}); if(this.pickFx.length>24) this.pickFx.shift(); if(d.kind==='credits'){ c.credits+=d.amount; this.rm(d); this.emit('sfx','coin'); continue; }
      if(d.kind==='item'&&HARD.autoSellGrey&&this.save.settings.autoSellGrey!==false&&ITEM_BY_ID[d.inst!.def].rarity==='grey'){ const v=SELL_VALUE.grey; c.credits+=v; this.rm(d); this.emit('sfx','coin'); this.fx.push({kind:'text',x:this.px,y:this.py,t:0,life:.9,text:'sold junk +'+v+'c',c:'#c9b87a'}); continue; }
      const stacksOk=(d.kind==='chip'&&(c.chips[d.chip!]||0)>0)||(d.kind==='stim'&&c.stims>0); const fits=stacksOk||this.carriedCount()<COMBAT.missionSlots;
      if(!fits){ if(!d.marker){ d.marker=true; this.toast('Inventory full: item left on the ground (marked).'); } continue; }
      if(d.kind==='item') c.items.push(d.inst!); else if(d.kind==='chip') c.chips[d.chip!]=(c.chips[d.chip!]||0)+1; else if(d.kind==='stim') c.stims++;
      if(d.kind==='item'&&ITEM_BY_ID[d.inst!.def]?.abilities?.length){ (inst as any).abGot=true; const aq=(this.save.abAcq=this.save.abAcq||{total:0,dry:0}); aq.total++; } this.rm(d); this.contractEvent('pickup',''); this.emit('pickup',d); this.emit('sfx','pickup'); { const pr=this.dropRarity(d); if(RARITY_RANK[pr]>=1) this.emit('sfx','pickup_'+pr); } }
  }
  rm(d:Drop){ const inst=this.inst!; inst.drops=inst.drops.filter(x=>x.id!==d.id); }
  onBossDead(e:En){
    const inst=this.inst!; const f=inst.flags; if(!f.bossDead){ f.bossDead=true; f.completed=true; this.projs=[]; this.zones=[]; clearBossAdds(this); } this.grantClear(e); }
  /** Per-player clear rewards (clear XP, lockout, contracts, achievements). */
  grantClear(e:En){ const inst=this.inst!; const f=inst.flags; if((inst as any)._cg) return; (inst as any)._cg=true; f.completed=true; this.save.cleared={...(this.save.cleared||{}),[this.dd.id]:Date.now()};
    if(!f.rewardsGranted){ f.rewardsGranted=true; setLockDay(this.save,this.dd.id,todayStr()); this.save.stats.clears++; this.addXp(this.dd.clearXp); this.note('boss_defeated',e.type); this.note('run_cleared',f.cond||'none'); this.toast('MISSION COMPLETE ('+this.dd.short+'). Daily clear consumed. Return to town any time: your pack is banked and you can start another dungeon.'); }
    for(const d of checkAchievements(this.save)) this.toast('Wardrobe unlocked: '+d.name+' ('+d.rarity+')'); this.emit('boss-dead'); this.emit('stinger','complete'); this.resPending=5; this.saveNow();
  }
  /** Settings > Unstuck (docs/PROGRESSION.md) */ unstuck(){ const m=unstuck(this); this.toast(m); return m; }
  progT=0; progKey=''; progScan=0; progPulled=false; progFixed=0; progForced=0;
  resPending=0; zoneShown:Record<string,number>={}; zoneAnyAt=-1e9; lastZone=''; seenT=0; seen:Uint8Array|null=null; seenFor:Level|null=null; pathT=0; pathWp:{x:number;y:number}|null=null; pathLen=0;
  markSeen(){ const L=this.level; if(this.seenFor!==L||!this.seen){ this.seen=new Uint8Array(L.w*L.h); this.seenFor=L; } const R=9; const px=Math.floor(this.px), py=Math.floor(this.py); for(let y=Math.max(0,py-R);y<=Math.min(L.h-1,py+R);y++) for(let x=Math.max(0,px-R);x<=Math.min(L.w-1,px+R);x++) if((x-px)**2+(y-py)**2<=R*R) this.seen[y*L.w+x]=1; }
  /** Current dungeon objective (text + world target) derived from instance flags; used by the HUD arrow, minimap and zone banners. */
  objective():{text:string;x:number;y:number;kind:string}|null{ const inst=this.inst; if(this.mode!=='run'||!inst) return null; const f=inst.flags, L=this.level, dd=this.dd; const it=(id:string)=>L.interacts.find(i=>i.id===id);
    if(f.bossDead){ let best:Drop|null=null,bd=1e9; for(const d of inst.drops){ const k=dist(this.px,this.py,d.x,d.y); if(k<bd){ bd=k; best=d; } } const near=inst.drops.filter(d=>dist(this.px,this.py,d.x,d.y)<=16).length; if(best) return {text:'Boss defeated! Pick up your loot ('+(near||inst.drops.length)+(near?' nearby':' left')+'), then press '+TOWN_KEY+' to return to town',x:best.x,y:best.y,kind:'loot'}; return {text:'Dungeon cleared. Press '+TOWN_KEY+' to return to town.',x:L.spawn.x,y:L.spawn.y,kind:'exit'}; }
    if(f.bossSpawned&&!f.bossDead){ const b=this.enemies.find(e=>ENEMIES[e.type].boss&&!e.dead); return {text:'Defeat the boss',x:b?b.x:L.bossSpawn.x,y:b?b.y:L.bossSpawn.y,kind:'boss'}; }
    if(f.controller){ const bd=L.doors.find(d=>d.id==='boss'); if(bd&&bd.tiles.length){ let sx=0,sy=0; for(const [tx,ty] of bd.tiles){ sx+=tx; sy+=ty; } return {text:'Enter the open boss chamber',x:sx/bd.tiles.length+.5,y:sy/bd.tiles.length+.5,kind:'boss'}; } return {text:'Enter the open boss chamber',x:L.bossSpawn.x,y:L.bossSpawn.y,kind:'boss'}; }
    { const st=objectiveStep(this); if(st) return st; }
    const c=it('controller'); if(c) return {text:(f.lock2?'Secure the ':'Break through the locked gate, then secure the ')+dd.objectiveLabel,x:c.x,y:c.y,kind:'controller'}; return null; }
  /** BFS next-waypoint toward a world target so the arrow follows walkable routes rather than pointing through walls. */
  guidance(){ const o=this.objective(); if(!o) return null; this.pathT-=1/60; if(this.pathT<=0||!this.pathWp){ this.pathT=.4; const L=this.level, w=L.w, h=L.h; const sx0=Math.floor(this.px), sy0=Math.floor(this.py), tx=Math.floor(o.x), ty=Math.floor(o.y); const prev=new Int32Array(w*h).fill(-1); const q=[sy0*w+sx0]; prev[sy0*w+sx0]=sy0*w+sx0; let found=-1; for(let qi=0;qi<q.length;qi++){ const cur=q[qi], cx=cur%w, cy=(cur/w)|0; if(Math.abs(cx-tx)<=1&&Math.abs(cy-ty)<=1){ found=cur; break; } for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h) continue; const ni=ny*w+nx; if(prev[ni]>=0||L.solid[ni]) continue; prev[ni]=cur; q.push(ni); } }
      if(found<0){ this.pathWp={x:o.x,y:o.y}; this.pathLen=dist(this.px,this.py,o.x,o.y); } else { const path:number[]=[]; let c=found; while(c!==sy0*w+sx0){ path.push(c); c=prev[c]; } path.reverse(); this.pathLen=path.length; const wp=path[Math.min(path.length-1,5)]; this.pathWp=path.length?{x:(wp%w)+.5,y:((wp/w)|0)+.5}:{x:o.x,y:o.y}; } }
    return {obj:o,wp:this.pathWp!,dist:this.pathLen}; }
  runSummary(){ const inst=this.inst; if(!inst) return null; const dd=this.dd; const byR:Record<string,number>={}; for(const d of inst.drops) if(d.inst){ const r=ITEM_BY_ID[d.inst.def].rarity; byR[r]=(byR[r]||0)+1; }
    return { dungeon:dd.name, id:dd.id, cleared:inst.flags.bossDead, boss:inst.flags.bossKey?ENEMIES[inst.flags.bossKey]?.name:null, time:inst.elapsed, kills:Object.values(inst.kills).reduce((a,b)=>a+b,0), killTypes:inst.kills, xp:inst.xpEarned, credits:inst.carried.credits, repair:inst.repairAdded, carried:inst.carried.items.map(i=>({name:ITEM_BY_ID[i.def].name,rarity:ITEM_BY_ID[i.def].rarity})), chips:{...inst.carried.chips}, stims:inst.carried.stims, ground:inst.drops.length, groundByRarity:byR, route:inst.flags.cond||'combat' }; }
  /** Elite engagement: every exchange engages immediately (hard music must always fade in); the exit side is what has hysteresis (8 s hold here + 10 s exit hold in MusicManager). */
  eliteExchange(){ this.eliteEng=8; }
  isElite(e:En){ return !!(ENEMIES[e.type].elite||(e as any).affix?.length); }
  /** Music state (docs/AUDIO.md): only 'traversal' (calm pool), 'elite' (hit/hurt by an elite in the last 8 s), 'bossreveal'/'bosscombat' (boss encounter) and 'resolution'. Ordinary mobs, proximity, alert and map position never change it. */
  lastKey=''; lastPh=0; updateMusic(dt:number){
    let st='traversal'; if(this.combatHold>0) this.combatHold-=dt; if(this.eliteEng>0) this.eliteEng-=dt; const boss=this.enemies.find(e=>ENEMIES[e.type].boss&&!e.dead&&e._rt.reveal<=0&&this.inst!.flags.bossSpawned);
    const bossRev=this.enemies.some(e=>ENEMIES[e.type].boss&&!e.dead&&e._rt.reveal>0);
    if(this.resPending>0){ this.resPending-=dt; st='resolution'; } else if(bossRev) st='bossreveal'; else if(boss) st='bosscombat'; else if(this.eliteEng>0&&this.enemies.some(e=>!e.dead&&e.faction==='enemy'&&this.isElite(e)&&!ENEMIES[e.type].boss)) st='elite';
    if(st==='bosscombat'&&boss&&this.lastKey!==boss.type){ this.lastKey=boss.type; this.emit('musickey',boss.type); this.lastPh=0; }
    if(st==='bosscombat'&&boss){ const ph=(boss as any).phase||0; if(ph!==this.lastPh){ this.lastPh=ph; this.emit('musicphase',ph); } }
    this.musicSet(st);
  }
}
export interface AtkDef { w:number; rec:number; cd:number; min:number; max:number; lock?:boolean; ranged?:boolean }
/** largest share of the player's max HP a single boss attack may take (riposte x hard-mode reached 60%) */
export const BOSS_HIT_CAP=.42;
export const ATK:Record<string,AtkDef> = {
  swing:{w:.55,rec:.5,cd:1.1,min:0,max:1.4}, shot:{w:.8,rec:.6,cd:2.6,min:0,max:9,lock:true,ranged:true}, turretshot:{w:1.1,rec:.4,cd:2.8,min:0,max:10,lock:true,ranged:true},
  cleave:{w:.9,rec:.7,cd:2.2,min:0,max:2.6}, charge:{w:1.1,rec:1.4,cd:7,min:3.2,max:10,lock:true}, slam:{w:1.1,rec:.9,cd:5,min:0,max:3.4}, summon:{w:.9,rec:.8,cd:26,min:0,max:40},
  bite:{w:.4,rec:.4,cd:1.0,min:0,max:1.3}, slagshot:{w:.9,rec:.6,cd:2.8,min:0,max:10,lock:true,ranged:true}, dart:{w:.7,rec:.5,cd:2.0,min:0,max:10,lock:true,ranged:true}, scalpelfan:{w:.9,rec:.8,cd:3.2,min:2,max:12,lock:true,ranged:true}, chainsweep:{w:1.1,rec:1.0,cd:3.5,min:0,max:4.6}, blink:{w:.8,rec:.2,cd:6.5,min:2.5,max:14}, riposte:{w:.55,rec:.9,cd:0,min:0,max:99}, slagpool:{w:.8,rec:.9,cd:7,min:0,max:16,ranged:true}, gasvent:{w:.8,rec:.9,cd:8,min:0,max:14,ranged:true}, ringpools:{w:1.0,rec:1.0,cd:10,min:0,max:16}, sawlanes:{w:1.0,rec:1.0,cd:9,min:0,max:16,ranged:true}, cratefall:{w:.8,rec:.9,cd:7,min:0,max:16,ranged:true},
  zones:{w:.7,rec:.9,cd:8,min:0,max:16,ranged:true}, volley:{w:1.0,rec:.8,cd:3.4,min:3,max:13,lock:true,ranged:true}, rsweep:{w:1.0,rec:.9,cd:3,min:0,max:3.8},
};
Object.assign(ATK,MOVE_ATK,MOB_ATK); // content batch 1 boss moves (src/content/boss_moves.ts)
