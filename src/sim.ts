import { ABILITIES, AbilityDef, AbilityId, COMBAT, ENEMIES, ENEMY_DMG, EnemyDef, ITEM_BY_ID, LOOT, LootEntry, REPAIR_COST, SLOTS, Slot, Rarity, RARITY_RANK, PROGRESSION, ChipId, Stats, WeaponDef, DUNGEON_TIER_MAX_ITEM_LEVEL, CHIPS, INSTANCE_WARN_MINUTES } from './config';
import { computeBuild, installedLayout, BuildResult } from './build';
import { buildAnnex, buildTown, Level, Interact } from './level';
import { Save, InstanceState, EnemyState, Drop, mkInst, persist, todayStr, retentionMs, Carried, Inst } from './state';
import { record, newStory } from './story';

export type Emit = (type:string, payload?:any)=>void;
export interface Proj { x:number; y:number; vx:number; vy:number; dmg:number; r:number; life:number; faction:'enemy'|'ally'; kind:'bolt'|'slug'; }
export interface Zone { x:number; y:number; r:number; t:number; life:number; dps:number; heat:number; windup:number; }
export interface Fx { kind:'slash'|'ring'|'burst'|'line'|'spark'|'blood'|'text'|'dust'|'vent'; x:number; y:number; a?:number; r?:number; t:number; life:number; text?:string; vx?:number; vy?:number; c?:string; len?:number; w?:number; }
export interface AimState { idx:number; wx:number; wy:number; hasDir:boolean; }
export interface Rt { // enemy transient runtime fields
  st:'idle'|'chase'|'tele'|'rec'|'dash'|'lost'; t:number; atk:string; acd:Record<string,number>; ang:number; tx:number; ty:number; lost:number; vuln:number; reveal:number; bornT:number; fire:number; shots:{x:number;y:number}[]; hit:number; dashed:boolean; strafe:number;
}
export type En = EnemyState & { _rt:Rt };

const dist=(ax:number,ay:number,bx:number,by:number)=>Math.hypot(ax-bx,ay-by);
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const angDiff=(a:number,b:number)=>{ let d=a-b; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2; return d; };
export const ISO = { toWorld(sx:number,sy:number,tw:number){ const a=sx/(tw/2), b=sy/(tw/4); return { x:(a+b)/2, y:(b-a)/2 }; }, vec(dx:number,dy:number){ const a=dx, b=dy*2; const x=(a+b)/2, y=(b-a)/2; const l=Math.hypot(x,y)||1; return { x:x/l, y:y/l }; } };

export class Game {
  save:Save; level:Level; mode:'town'|'run'='town'; inst:InstanceState|null=null; emit:Emit;
  enemies:En[]=[]; projs:Proj[]=[]; zones:Zone[]=[]; fx:Fx[]=[]; time=0;
  // player
  px=0; py=0; face=0; hp=100; heat=0; overheated=false; dodgeT=0; dodgeCd=0; iframes=0; dodgeDx=0; dodgeDy=0; atkCd=0; weaponOff=0; cloakT=0; braceT=0; downed=false; downT=0; defibCd=0; revealing=false;
  abCd:number[]=[0,0,0]; cast:{ idx:number; t:number; aim:AimState; ab:AbilityDef }|null=null; aim:AimState|null=null; target:number|null=null; lungeT=0; lungeDx=0; lungeDy=0; lungeHit:Set<number>=new Set();
  slideT=0; slideFx=0; slideFy=0; channel:{ kind:'town'|'hack'; t:number; dur:number; cb:()=>void }|null=null;
  inputMove={x:0,y:0}; build!:BuildResult; moving=false; prompt:Interact|null=null; musicState='traversal'; combatHold=0; toastQ:string[]=[];
  dbg={god:false,oneShot:false};
  flow:Int16Array|null=null; flowT=0; kills=0; saveT=0; sensorFlag=false; lastRoute='';
  constructor(save:Save, emit:Emit){ this.save=save; this.emit=emit; this.level=buildTown(); this.recompute(); this.enterTown(true); }

  // ---------- build / stats ----------
  recompute(){ const L=installedLayout(this.save); this.build=computeBuild(L,this.save.level,this.save.rep,this.inst?this.inst.broken:[]); const mx=this.build.stats.maxHp; if(this.hp>mx||this.hp<=0&&!this.downed) this.hp=mx; }
  get maxHp(){ return this.build.stats.maxHp; }
  toast(s:string){ this.emit('toast',s); }
  now(){ return Date.now(); }

  // ---------- mode transitions ----------
  enterTown(first=false){
    this.mode='town'; this.level=buildTown(); this.enemies=[]; this.projs=[]; this.zones=[]; this.fx=[]; this.px=this.level.spawn.x; this.py=this.level.spawn.y; this.channel=null; this.cast=null; this.aim=null; this.target=null; this.downed=false; this.revealing=false;
    this.recompute(); this.hp=this.maxHp; this.heat=0; this.overheated=false; this.cloakT=0; this.musicSet('town'); if(this.inst) persist(this.save); this.emit('mode','town'); if(!first) this.toast('Back in town. Unload loot at the locker.');
  }
  hasLiveInstance(){ return !!this.inst && this.inst.expiresAt>this.now(); }
  dailyLocked(){ return this.save.lastClearDay===todayStr(); }
  startRun(){
    const s=this.save;
    if(this.save.instance && this.save.instance.expiresAt<=this.now()){ this.expireInstance(); }
    if(this.save.instance){ this.inst=this.save.instance; this.resumeInstance(); return true; }
    if(this.dailyLocked()){ this.toast('Daily clear used. A fresh run unlocks tomorrow (dev panel can reset).'); return false; }
    const seed=(Math.random()*1e9)|0; const lv=buildAnnex();
    const inst:InstanceState={ id:'inst-'+seed, createdAt:this.now(), expiresAt:this.now()+retentionMs, seed, enemies:[], drops:[], carried:{items:[],chips:{},stims:0,credits:0},
      flags:{gate1:false,lock2:false,passageSeen:false,controller:false,armory:false,cond:null,bossKey:null,bossRevealed:false,bossSpawned:false,bossDead:false,completed:false,rewardsGranted:false,alarm:false,salvageForeman:false},
      checkpoint:{id:1,x:lv.checkpoints[0].x,y:lv.checkpoints[0].y}, px:lv.spawn.x, py:lv.spawn.y, hp:0, broken:[], protectedSlots:[], repairAdded:0, nextId:1, xpEarned:0, warned:false, kills:{}, claimed:[], elapsed:0 };
    for(const sp of lv.spawns){ inst.enemies.push({ id:inst.nextId++, type:sp.type, x:sp.x+.5, y:sp.y+.5, hp:ENEMIES[sp.type].hp, maxHp:ENEMIES[sp.type].hp, alert:false, dead:false, home:{x:sp.x+.5,y:sp.y+.5}, group:sp.group, faction:'enemy', ctrlT:0, stunT:0 }); }
    { const n=Math.min(2,s.stims); inst.carried.stims=n; s.stims-=n; }
    s.instance=inst; this.inst=inst; s.stats.runs++; this.resumeInstance(true); return true;
  }
  resumeInstance(fresh=false){
    const inst=this.inst!; this.mode='run'; this.level=buildAnnex(); this.projs=[]; this.zones=[]; this.fx=[]; this.target=null; this.cast=null; this.aim=null; this.channel=null; this.downed=false; this.revealing=false;
    this.applyDoors(); this.enemies=inst.enemies.map(e=>this.wrap(e));
    // Boss attempts always replay the full reveal: reset a living boss on (re)entry.
    this.resetBossIfAlive();
    const cp=this.level.checkpoints[0]; this.px=fresh?this.level.spawn.x:cp.x; this.py=fresh?this.level.spawn.y:cp.y;
    if(!fresh && (inst.checkpoint.id!==1)){ /* re-entry always from entry point: must run back through surviving enemies */ }
    this.recompute(); this.hp=this.maxHp; this.heat=0; this.overheated=false; this.cloakT=0; this.braceT=0; this.defibCd=0; this.abCd=[0,0,0]; this.dodgeCd=0;
    this.musicSet('traversal'); this.emit('mode','run'); this.saveNow();
    if(this.save.story && !this.save.story) {}
    this.toast(fresh?'Reclamation Annex: steal the controller, defeat the boss.':'Re-entered existing instance. Surviving enemies and loot remain.');
  }
  wrap(e:EnemyState):En{ const x=e as En; x._rt={ st:'idle',t:0,atk:'',acd:{},ang:0,tx:0,ty:0,lost:0,vuln:0,reveal:0,bornT:0,fire:0,shots:[],hit:0,dashed:false,strafe:Math.random()<.5?1:-1 }; return x; }
  expireInstance(){ const s=this.save; s.instance=null; this.inst=null; this.toast('The instance expired. Leftover loot and state are gone.'); this.emit('expired'); persist(s); }
  abandonInstance(){ this.save.instance=null; this.inst=null; persist(this.save); this.toast('Instance abandoned.'); }
  applyDoors(){ const inst=this.inst!; const f=inst.flags; const open:Record<string,boolean>={ gate1:f.gate1, lock2:f.lock2, armory:f.armory, boss:f.controller }; for(const d of this.level.doors){ if(open[d.id]) for(const [x,y] of d.tiles) this.level.solid[y*this.level.w+x]=0; } }
  openDoor(id:string){ const d=this.level.doors.find(d=>d.id===id); if(!d) return; for(const [x,y] of d.tiles) this.level.solid[y*this.level.w+x]=0; this.emit('sfx','door'); }
  resetBossIfAlive(){ const inst=this.inst; if(!inst) return; const bi=inst.enemies.findIndex(e=>ENEMIES[e.type].boss&&!e.dead); if(bi>=0){ const b=inst.enemies[bi]; inst.enemies.splice(bi,1); this.enemies=this.enemies.filter(e=>e.id!==b.id); inst.flags.bossSpawned=false; inst.flags.bossRevealed=false; } this.revealing=false; }

  saveNow(){ if(this.inst){ this.inst.px=this.px; this.inst.py=this.py; this.inst.hp=this.hp; this.inst.enemies=this.enemies as EnemyState[]; } this.save.instance=this.inst; persist(this.save); }

  // ---------- helpers ----------
  solidAt(x:number,y:number){ const L=this.level; const ix=Math.floor(x), iy=Math.floor(y); if(ix<0||iy<0||ix>=L.w||iy>=L.h) return true; return L.solid[iy*L.w+ix]===1; }
  moveCircle(x:number,y:number,dx:number,dy:number,r:number){ let nx=x+dx, ny=y; if(this.circleHits(nx,ny,r)) nx=x; ny=y+dy; if(this.circleHits(nx,ny,r)) ny=y; return {x:nx,y:ny}; }
  circleHits(x:number,y:number,r:number){ return this.solidAt(x-r,y-r)||this.solidAt(x+r,y-r)||this.solidAt(x-r,y+r)||this.solidAt(x+r,y+r); }
  los(ax:number,ay:number,bx:number,by:number){ const d=dist(ax,ay,bx,by); const n=Math.ceil(d/.4); for(let i=1;i<n;i++){ const t=i/n; if(this.solidAt(ax+(bx-ax)*t,ay+(by-ay)*t)) return false; } return true; }
  zoneAt(x:number,y:number){ const L=this.level; const ix=Math.floor(x), iy=Math.floor(y); if(ix<0||iy<0||ix>=L.w||iy>=L.h) return 'none'; return L.zoneNames[L.zone[iy*L.w+ix]]; }
  stat(){ return this.build.stats; }

  // ---------- input API (called by input.ts) ----------
  setMove(x:number,y:number){ this.inputMove.x=x; this.inputMove.y=y; }
  beginAim(idx:number){ if(this.downed||this.mode!=='run'&&this.mode!=='town') return; const ab=this.build.abilities[idx]; if(!ab) return; this.aim={ idx, wx:this.px+Math.cos(this.face), wy:this.py+Math.sin(this.face), hasDir:false }; }
  updateAim(wx:number,wy:number,hasDir:boolean){ if(this.aim){ this.aim.wx=wx; this.aim.wy=wy; this.aim.hasDir=hasDir; } }
  cancelAim(){ this.aim=null; }
  releaseAim(){ const a=this.aim; this.aim=null; if(!a||this.downed) return; const id=this.build.abilities[a.idx]; if(!id) return; const def=ABILITIES[id];
    const v=this.validateAim(def,a); if(!v.valid){ this.emit('sfx','cancel'); this.toast('Cancelled: '+v.why); return; }
    if(this.overheated){ this.toast('Overheated: abilities offline'); this.emit('sfx','deny'); return; }
    if(this.abCd[a.idx]>0){ this.toast(def.name+' is cooling down'); return; }
    if(this.cast) return; if(this.weaponOff>0&&def.id!=='forcedcool'&&false) return;
    this.cast={ idx:a.idx, t:0, aim:{...a}, ab:def }; this.emit('sfx','windup'); }
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
    this.aim=null; const hadCast=!!this.cast; this.cast=null; if(this.channel&&this.channel.kind==='hack') this.channel=null; this.emit('dodgecancel'); // always cancels aiming/execution, even on cooldown
    if(this.dodgeCd>0){ if(hadCast) this.toast('Cast cancelled'); return; }
    let dx=this.inputMove.x, dy=this.inputMove.y; if(Math.hypot(dx,dy)<.1){ dx=Math.cos(this.face); dy=Math.sin(this.face); }
    const l=Math.hypot(dx,dy)||1; this.dodgeDx=dx/l; this.dodgeDy=dy/l; this.dodgeT=COMBAT.dodge.time; this.iframes=Math.max(this.iframes,COMBAT.dodge.iframes); this.dodgeCd=COMBAT.dodge.cd; this.emit('sfx','dodge'); this.fx.push({kind:'dust',x:this.px,y:this.py,t:0,life:.4});
    if(this.channel&&this.channel.kind==='town'){ this.channel=null; this.toast('Town return interrupted'); }
  }
  interact(){ if(!this.prompt||this.downed) return; this.doInteract(this.prompt); }
  townReturn(){ if(this.mode!=='run'||this.downed) return; if(this.channel&&this.channel.kind==='town'){ this.channel=null; this.toast('Town return cancelled'); return; } this.channel={kind:'town',t:0,dur:COMBAT.townChannel,cb:()=>{ this.saveNow(); this.enterTown(); }}; this.toast('Returning to town... movement or damage interrupts. No invulnerability.'); this.emit('sfx','channel'); }
  useStim(){ const c=this.inst?.carried; if(!c||this.downed){ if(this.mode==='town'&&this.save.stims>0){ this.save.stims--; this.hp=Math.min(this.maxHp,this.hp+COMBAT.stimHeal); } return; } if(c.stims>0&&this.hp<this.maxHp){ c.stims--; this.hp=Math.min(this.maxHp,this.hp+COMBAT.stimHeal); this.emit('sfx','heal'); this.fx.push({kind:'text',x:this.px,y:this.py,t:0,life:.8,text:'+'+COMBAT.stimHeal,c:'#9fb98a'}); } else if(c.stims<=0 && this.save.stims>0 && false){} }
  musicSet(s:string){ if(this.musicState!==s){ this.musicState=s; this.emit('music',s); } }

  // ---------- main update ----------
  update(dtRaw:number){
    const dt=Math.min(dtRaw,.05); this.time+=dt;
    if(this.mode==='run'&&this.inst){ this.inst.elapsed+=dt; const rem=this.inst.expiresAt-this.now(); if(rem<=0){ this.expireInstance(); this.enterTown(); return; } if(!this.inst.warned&&rem<INSTANCE_WARN_MINUTES*60000){ this.inst.warned=true; this.toast('Instance expires in under '+INSTANCE_WARN_MINUTES+' minutes. Retrieve loot.'); } }
    this.updatePlayer(dt);
    if(this.mode==='run'){ this.updateEnemies(dt); this.updateProjs(dt); this.updateZones(dt); this.autoPickup(); this.updateRun(dt); this.updateMusic(dt); this.saveT+=dt; if(this.saveT>4){ this.saveT=0; this.saveNow(); } }
    this.updatePrompt(); this.updateFx(dt);
  }
  updateFx(dt:number){ for(const f of this.fx){ f.t+=dt; if(f.vx){ f.x+=f.vx*dt; f.y+=(f.vy||0)*dt; } } this.fx=this.fx.filter(f=>f.t<f.life); if(this.fx.length>260) this.fx.splice(0,this.fx.length-260); }
  updatePlayer(dt:number){
    const st=this.stat(); const revealLock=this.revealing;
    if(this.dodgeCd>0) this.dodgeCd-=dt; if(this.iframes>0) this.iframes-=dt; if(this.atkCd>0) this.atkCd-=dt; if(this.weaponOff>0) this.weaponOff-=dt; if(this.defibCd>0) this.defibCd-=dt;
    for(let i=0;i<3;i++) if(this.abCd[i]>0) this.abCd[i]-=dt;
    if(this.cloakT>0){ this.cloakT-=dt; } if(this.braceT>0) this.braceT-=dt;
    // heat
    const cool=(COMBAT.heat.passiveCool)*st.cooling*(this.overheated?1.3:1); this.heat=Math.max(0,this.heat-cool*dt);
    if(this.overheated&&this.heat<=COMBAT.heat.overheatRecover){ this.overheated=false; this.emit('sfx','cooled'); }
    if(this.heat>=COMBAT.heat.max&&!this.overheated){ this.heat=COMBAT.heat.max; this.overheated=true; this.cast=null; this.aim=null; this.emit('sfx','overheat'); this.toast('OVERHEATED: abilities offline until cooled'); }
    if(this.hp<this.maxHp&&!this.downed&&st.regen>0) this.hp=Math.min(this.maxHp,this.hp+st.regen*dt*(this.mode==='town'?4:1));
    if(this.downed){ this.downT+=dt; this.cast=null; this.aim=null; return; }
    // movement
    let mx=0,my=0; const mag=Math.min(1,Math.hypot(this.inputMove.x,this.inputMove.y)); if(mag>.12){ const v=ISO.vec(this.inputMove.x,this.inputMove.y); mx=v.x*mag; my=v.y*mag; }
    let speed=COMBAT.playerSpeed*st.move*(this.overheated?COMBAT.heat.overheatSpeedMult:1)*(this.cast?.6:1);
    if(this.dodgeT>0){ this.dodgeT-=dt; const sp=COMBAT.dodge.dist/COMBAT.dodge.time; const p=this.moveCircle(this.px,this.py,this.dodgeDx*sp*dt,this.dodgeDy*sp*dt,COMBAT.playerRadius); this.px=p.x; this.py=p.y; this.moving=true; }
    else if(this.lungeT>0){ this.lungeT-=dt; const sp=this.lungeDx; const p=this.moveCircle(this.px,this.py,this.lungeDx*dt,this.lungeDy*dt,COMBAT.playerRadius); this.px=p.x; this.py=p.y; this.lungeBladeHit(); }
    else if(this.slideT>0){ this.slideT-=dt; const p=this.moveCircle(this.px,this.py,this.slideFx*dt,this.slideFy*dt,COMBAT.playerRadius); this.px=p.x; this.py=p.y; }
    else { const p=this.moveCircle(this.px,this.py,mx*speed*dt,my*speed*dt,COMBAT.playerRadius); this.px=p.x; this.py=p.y; this.moving=mag>.12; if(this.moving) this.face=Math.atan2(my,mx); }
    if(this.moving&&mag>.3){ if(this.channel){ if(this.channel.kind==='town'){ this.toast('Town return interrupted by movement'); } this.channel=null; } }
    if(this.channel){ this.channel.t+=dt; if(this.channel.t>=this.channel.dur){ const cb=this.channel.cb; this.channel=null; cb(); } }
    // aim face
    if(this.aim){ this.face=Math.atan2(this.aim.wy-this.py,this.aim.wx-this.px); }
    // cast
    if(this.cast){ const c=this.cast; c.t+=dt; if(this.aim==null||true){ /* aim keeps tracking only while held */ } if(c.t>=c.ab.windup){ this.cast=null; this.executeAbility(c); } }
    this.autoAttack(dt);
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
    const st=this.stat(); const rate=w.rate*st.atkSpeed*(this.overheated?.5:1); this.atkCd=1/rate;
    this.face=Math.atan2(t.y-this.py,t.x-this.px);
    let dmg=w.dmg*st.dmg*(this.overheated?COMBAT.heat.overheatDmgMult:1); if(w.kind==='ripper') dmg*=1+(st.atkSpeed-1)*.6;
    if(this.cloakT>0){ dmg*=2; this.cloakT=0; this.toast('Cloak broken: first strike'); }
    this.heat+=w.heat; this.emit('sfx','atk_'+w.kind);
    if(w.proj){ this.projs.push({x:this.px,y:this.py,vx:Math.cos(this.face)*18,vy:Math.sin(this.face)*18,dmg,r:.25,life:.6,faction:'ally',kind:'slug'}); this.fx.push({kind:'spark',x:this.px+Math.cos(this.face)*.6,y:this.py+Math.sin(this.face)*.6,t:0,life:.15}); }
    else { this.fx.push({kind:'slash',x:this.px,y:this.py,a:this.face,r:w.range,t:0,life:.18,w:w.arc}); for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||e._rt.reveal>0) continue; const dd=dist(this.px,this.py,e.x,e.y)-ENEMIES[e.type].radius; if(dd<=w.range&&Math.abs(angDiff(Math.atan2(e.y-this.py,e.x-this.px),this.face))<=w.arc/2&&this.los(this.px,this.py,e.x,e.y)) this.hurtEnemy(e,dmg,this.px,this.py,.6); } }
  }
  // ---------- abilities ----------
  executeAbility(c:{ idx:number; aim:AimState; ab:AbilityDef }){
    const def=c.ab; const st=this.stat(); const m=this.build.mods;
    const v=this.validateAim(def,c.aim); if(!v.valid&&def.aim!=='self'){ this.toast('Cancelled: '+v.why); return; } // re-validate at effect start; still free
    // resource commitment point: effect start
    this.heat+=def.heat; this.abCd[c.idx]=def.cd; this.emit('sfx','ab_'+def.id); const ang=Math.atan2(c.aim.wy-this.py,c.aim.wx-this.px); const dmgM=st.dmg*(this.overheated?COMBAT.heat.overheatDmgMult:1);
    switch(def.id){
      case 'sweep': { const arc=Math.PI*.75*(1+m.arc); this.face=ang; this.fx.push({kind:'slash',x:this.px,y:this.py,a:ang,r:def.range,t:0,life:.3,w:arc}); for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||e._rt.reveal>0) continue; const d=dist(this.px,this.py,e.x,e.y)-ENEMIES[e.type].radius; if(d<=def.range&&Math.abs(angDiff(Math.atan2(e.y-this.py,e.x-this.px),ang))<=arc/2) this.hurtEnemy(e,34*dmgM,this.px,this.py,2); } break; }
      case 'brace': this.braceT=3; this.fx.push({kind:'ring',x:this.px,y:this.py,r:1.4,t:0,life:.5,c:'#b0a58c'}); break;
      case 'forcedcool': this.heat=Math.max(0,this.heat-70); this.weaponOff=2; this.overheated=this.heat>=COMBAT.heat.max; this.fx.push({kind:'vent',x:this.px,y:this.py,t:0,life:1.2}); if(this.overheated===false) {} break;
      case 'cloak': this.cloakT=5+m.cloakDur; for(const e of this.enemies){ if(e.faction==='enemy'&&dist(e.x,e.y,this.px,this.py)>1.6&&!ENEMIES[e.type].boss){ e._rt.st=e.alert?'lost':e._rt.st; } } break;
      case 'bladeburst': { const len=def.range+m.burstLen; this.face=ang; const sp=len/.18; this.lungeDx=Math.cos(ang)*sp; this.lungeDy=Math.sin(ang)*sp; this.lungeT=.18; this.iframes=Math.max(this.iframes,.2); this.lungeHit=new Set(); (this as any)._lungeDmg=30*dmgM; this.fx.push({kind:'line',x:this.px,y:this.py,a:ang,len,t:0,life:.35,w:.8}); break; }
      case 'reposition': { const tx=v.tx!, ty=v.ty!; const d=dist(this.px,this.py,tx,ty); this.slideFx=(tx-this.px)/.12; this.slideFy=(ty-this.py)/.12; this.slideT=.12; this.iframes=Math.max(this.iframes,.14); void d; this.fx.push({kind:'dust',x:this.px,y:this.py,t:0,life:.4}); break; }
      case 'control': { const e=v.target!; if(ENEMIES[e.type].elite){ e.stunT=1.5; this.toast(ENEMIES[e.type].name+' resists control: stunned'); } else { e.faction='ally'; e.ctrlT=8+m.ctrlDur; e.alert=true; this.toast('Enemy control: '+ENEMIES[e.type].name+' turned'); } this.fx.push({kind:'ring',x:e.x,y:e.y,r:1,t:0,life:.6,c:'#8aa0b0'}); break; }
      case 'pulse': { const tx=v.tx!, ty=v.ty!; this.fx.push({kind:'ring',x:tx,y:ty,r:2.8,t:0,life:.5,c:'#9aa7b0'}); for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||e._rt.reveal>0) continue; if(dist(tx,ty,e.x,e.y)<=2.8+ENEMIES[e.type].radius){ this.hurtEnemy(e,22*dmgM,tx,ty,.5); e.stunT=Math.max(e.stunT,ENEMIES[e.type].boss?.5:1.2); } } break; }
      default: break;
    }
  }
  lungeBladeHit(){ const dm=(this as any)._lungeDmg||20; for(const e of this.enemies){ if(e.dead||e.faction!=='enemy'||this.lungeHit.has(e.id)||e._rt.reveal>0) continue; if(dist(this.px,this.py,e.x,e.y)<1.2+ENEMIES[e.type].radius){ this.lungeHit.add(e.id); this.hurtEnemy(e,dm,this.px,this.py,.8); } } }

  // ---------- damage ----------
  hurtEnemy(e:En,dmg:number,sx:number,sy:number,knock=0){
    if(e.dead||e._rt.reveal>0) return; if(this.dbg.oneShot) dmg*=60; if(e._rt.vuln>0) dmg*=1.5; e.hp-=dmg; e.alert=true; e._rt.hit=.12; if(!ENEMIES[e.type].boss) e._rt.lost=0;
    this.emit('sfx','hit'); this.combatHold=3;
    if(this.save.settings.damageNumbers) this.fx.push({kind:'text',x:e.x,y:e.y,t:0,life:.7,text:String(Math.round(dmg)),c:'#d8d2bf'});
    if(knock&&!ENEMIES[e.type].boss){ const a=Math.atan2(e.y-sy,e.x-sx); const p=this.moveCircle(e.x,e.y,Math.cos(a)*knock,Math.sin(a)*knock,ENEMIES[e.type].radius); e.x=p.x; e.y=p.y; }
    if(e.hp<=0) this.killEnemy(e);
    else this.alertGroup(e);
  }
  alertGroup(e:En){ for(const o of this.enemies){ if(!o.dead&&o.faction==='enemy'&&!o.alert&&(o.group===e.group||dist(o.x,o.y,e.x,e.y)<6)&&this.los(o.x,o.y,e.x,e.y)) o.alert=true; } }
  hurtPlayer(dmg:number,sx:number,sy:number){
    if(this.downed||this.iframes>0||this.revealing||this.mode!=='run'||this.dbg.god) return;
    const st=this.stat(); dmg=Math.max(1,dmg-st.armor); if(this.braceT>0) dmg*=.4; this.hp-=dmg; this.emit('sfx','hurt'); this.emit('hurt',dmg); this.combatHold=3;
    if(this.channel){ if(this.channel.kind==='town') this.toast('Town return interrupted by damage'); this.channel=null; }
    this.fx.push({kind:'blood',x:this.px,y:this.py,t:0,life:.6,c:'#7a2f26'});
    if(this.hp<=0) this.playerDown();
  }
  playerDown(){
    this.hp=0; this.downed=true; this.downT=0; this.cast=null; this.aim=null; this.channel=null; this.emit('sfx','down');
    const inst=this.inst!; const cand=SLOTS.filter(s=>!inst.broken.includes(s)&&!inst.protectedSlots.includes(s)&&this.save.installed[s]&&!ITEM_BY_ID[this.save.items.find(i=>i.uid===this.save.installed[s])!.def].id.startsWith('stock_'));
    let broke:Slot|null=null; if(cand.length){ broke=cand[Math.floor(Math.random()*cand.length)]; inst.broken.push(broke); const it=this.save.items.find(i=>i.uid===this.save.installed[broke!])!; const cost=REPAIR_COST[ITEM_BY_ID[it.def].rarity]; this.save.repairBill+=cost; inst.repairAdded+=cost; }
    const hasDefib=this.build.passives.includes('defib')&&this.defibCd<=0;
    this.recompute(); this.hp=0; this.emit('down',{ broke:broke&&ITEM_BY_ID[this.save.items.find(i=>i.uid===this.save.installed[broke!])!.def].name, defib:hasDefib });
  }
  returnToCheckpoint(){ if(!this.downed||!this.inst) return; const inst=this.inst; for(const s of inst.broken) if(!inst.protectedSlots.includes(s)) inst.protectedSlots.push(s); inst.broken=[]; this.downed=false; this.px=inst.checkpoint.x; this.py=inst.checkpoint.y; this.recompute(); this.hp=this.maxHp; this.heat=0; this.overheated=false; this.iframes=1.5; this.resetBossIfAlive(); this.enemies=this.enemies.filter(e=>true); this.projs=[]; this.emit('revived','checkpoint'); this.toast('Checkpoint recovery: hardware restored. Repair bill kept ('+this.save.repairBill+'c).'); }
  defibInPlace(){ if(!this.downed||!this.build.passives.includes('defib')) return; this.downed=false; this.hp=this.maxHp*.5; this.iframes=1.5; this.defibCd=90; this.emit('revived','defib'); this.toast('Defib: back up. Broken hardware stays broken until a checkpoint.'); }

  // ---------- run logic ----------
  updateRun(dt:number){
    const inst=this.inst!; const f=inst.flags; const L=this.level;
    // checkpoints
    for(const cp of L.checkpoints){ if(dist(this.px,this.py,cp.x,cp.y)<1.8){ if(inst.checkpoint.id!==cp.id){ inst.checkpoint={id:cp.id,x:cp.x,y:cp.y}; this.toast('Checkpoint: '+cp.label); this.saveNow(); }
      if(inst.broken.length&&!this.downed){ for(const s of inst.broken) inst.protectedSlots.push(s); inst.broken=[]; this.recompute(); this.toast('Checkpoint restored your hardware (repair bill kept).'); } } }
    // sensors (cloak route)
    const sn=L.sensors; if(this.px>=sn.x0&&this.px<=sn.x1+1&&this.py>=sn.y0&&this.py<=sn.y1+1){ if(this.cloakT<=0&&!f.alarm){ f.alarm=true; this.toast('SENSOR ALARM: security responding'); this.emit('sfx','alarm'); for(let i=0;i<4;i++){ const e=this.spawnEnemy('worker',this.px+(i<2?-3:3)+(i%2)*.6,this.py+.5+(i%2)*.7); e.alert=true; } } else if(this.cloakT>0&&!this.sensorFlag){ this.sensorFlag=true; record(this.story(),'route_used','cloak'); } }
    // zone based doors
    if(!f.gate1&&this.enemies.filter(e=>e.type==='turret'&&!e.dead).length===0){ f.gate1=true; this.openDoor('gate1'); this.toast('Security gate released'); }
    // boss reveal trigger
    if(f.controller&&!f.bossSpawned&&!f.bossDead&&this.px>=L.revealX&&this.zoneAt(this.px,this.py)==='boss') this.spawnBoss();
    // reveal timer
    const boss=this.enemies.find(e=>ENEMIES[e.type].boss&&!e.dead);
    if(boss&&boss._rt.reveal>0){ boss._rt.reveal-=dt; this.revealing=true; this.projs=[]; this.zones=this.zones.filter(z=>false); if(boss._rt.reveal<=0){ boss._rt.reveal=0; this.revealing=false; boss.alert=true; this.emit('reveal-end'); this.toast('Fight!'); } }
    else if(!boss) this.revealing=false;
    // boss leash: reset if player left the boss room for >6s
    if(boss&&!this.revealing){ if(this.zoneAt(this.px,this.py)!=='boss'){ boss._rt.lost+=dt; if(boss._rt.lost>6){ this.resetBossIfAlive(); this.toast('Boss reset. It will emerge again.'); } } else boss._rt.lost=0; }
    // ally expiry
    for(const e of this.enemies){ if(e.faction==='ally'){ e.ctrlT-=dt; if(e.ctrlT<=0){ e.faction='enemy'; } } if(e.stunT>0) e.stunT-=dt; }
  }
  story(){ if(!this.save.story) this.save.story=newStory(); return this.save.story; }
  spawnEnemy(type:string,x:number,y:number):En{ const inst=this.inst!; const d=ENEMIES[type]; const e=this.wrap({ id:inst.nextId++,type,x,y,hp:d.hp,maxHp:d.hp,alert:false,dead:false,home:{x,y},group:99,faction:'enemy',ctrlT:0,stunT:0 }); inst.enemies.push(e); this.enemies.push(e); return e; }
  spawnBoss(){
    const inst=this.inst!; const f=inst.flags; if(!f.bossKey){ f.bossKey='overseer'; } // arbitration: first confirmed condition wins; none => Overseer
    f.bossSpawned=true; f.bossRevealed=true; const b=this.spawnEnemy(f.bossKey!,this.level.bossSpawn.x,this.level.bossSpawn.y); b._rt.reveal=COMBAT.bossRevealSeconds; b.alert=false; this.revealing=true; this.projs=[]; this.emit('reveal',{ key:f.bossKey, name:ENEMIES[f.bossKey!].name }); this.toast(ENEMIES[f.bossKey!].name+' emerges. You are safe during the reveal.'); this.emit('sfx','boss_reveal');
    for(const e of this.enemies){ if(e!==b&&!e.dead&&this.zoneAt(e.x,e.y)==='boss') e.dead=true; }
  }
  doInteract(it:Interact){
    const inst=this.inst; const f=inst?.flags; const b=this.build;
    if(this.mode==='town'){ this.emit('open',it.id); return; }
    if(!inst||!f) return;
    const need=(cap:string,msg:string)=>{ if(!b.caps.has(cap)){ this.toast(msg); this.emit('sfx','deny'); return false; } return true; };
    switch(it.id){
      case 'hackproc': if(f.lock2){ this.toast('Locks already rerouted.'); return; } if(!need('hack','Locked relay. Needs hacking hardware (a combat route is always available).')) return;
        this.channel={kind:'hack',t:0,dur:1.5,cb:()=>{ f.lock2=true; this.openDoor('lock2'); this.toast('Security rerouted: junction lock open'); record(this.story(),'route_used','hack'); }}; this.toast('Hacking relay... (vulnerable; damage or dodge interrupts)'); break;
      case 'terminal': {
        const story=this.story(); const clue=story.clues.A||story.clues.general||'Terminal records: audit logs, nothing actionable.';
        if(f.cond){ this.emit('dialog',{ title:'Annex security terminal', body:'Boss selection is locked: '+ENEMIES[f.bossKey!].name+'. Conflicting selectors are disabled.', options:[{label:'Close'}] }); return; }
        if(!b.caps.has('hack')){ this.emit('dialog',{ title:'Annex security terminal', body:'ACCESS DENIED. Requires hacking hardware.\n\n'+clue, options:[{label:'Close'}] }); return; }
        this.emit('dialog',{ title:'Annex security terminal', body:clue+'\n\nIssue the audit command? Selects the Neural Warden as the boss for this run (disruption zones, ranged pressure). Combat continues while this is open.', options:[
          {label:'Issue audit command (Neural Warden)', cb:()=>{ if(f.cond) return; this.channel={kind:'hack',t:0,dur:1.5,cb:()=>{ if(f.cond) return; f.cond='A'; f.bossKey='warden'; record(this.story(),'condition_used','A'); record(this.story(),'route_used','hack'); this.toast('Audit command confirmed: Neural Warden selected'); this.saveNow(); }}; }},
          {label:'Cancel'} ] }); break; }
      case 'armorydoor': if(f.armory){ this.toast('Shutter already open.'); return; } if(!need('force','Sealed shutter. Needs force hardware (e.g. a ripper arm).')) return; f.armory=true; this.openDoor('armory'); record(this.story(),'route_used','force'); this.toast('Armory shutter forced open'); break;
      case 'armoryfuse': { const story=this.story(); if(f.cond){ this.emit('dialog',{title:'Command fuse',body:'Boss selection is locked: '+ENEMIES[f.bossKey!].name+'.',options:[{label:'Close'}]}); return; }
        this.emit('dialog',{ title:'Sealed armory: command fuse', body:(story.clues.B?story.clues.B+'\n\n':'Replacement-part markings line the rack.\n\n')+'Remove the command fuse? Selects the Reclamation Enforcer (ripper sweep, charge, recovery openings).', options:[
          {label:'Remove fuse (Reclamation Enforcer)', cb:()=>{ if(f.cond) return; f.cond='B'; f.bossKey='enforcer'; record(this.story(),'condition_used','B'); this.toast('Fuse removed: Reclamation Enforcer selected'); this.saveNow(); }},{label:'Cancel'} ] }); break; }
      case 'controller': if(f.controller){ this.toast('Controller already secured.'); return; } f.controller=true; this.openDoor('boss'); this.toast('Integration controller secured. Boss chamber door open.'); this.emit('sfx','objective'); this.saveNow(); break;
      case 'cratechip': if(f.salvageForeman||inst.claimed.includes('cratechip')){ this.toast('Cache already looted.'); return; } inst.claimed.push('cratechip'); this.addDrop(it.x,it.y+.8,{kind:'chip',chip:'cutwide',amount:1}); this.addDrop(it.x+.8,it.y+.6,{kind:'chip',chip:'ctrldur',amount:1}); this.toast('Chip cache opened'); break;
    }
  }
  updatePrompt(){ const L=this.level; const inst=this.inst; const f=inst?.flags; let best:Interact|null=null,bd=1e9;
    for(const it of L.interacts){ if(this.mode==='run'&&f){ if(it.id==='hackproc'&&f.lock2) continue; if(it.id==='armorydoor'&&f.armory) continue; if(it.id==='controller'&&f.controller) continue; if(it.id==='cratechip'&&inst!.claimed.includes('cratechip')) continue; }
      const d=dist(this.px,this.py,it.x,it.y); if(d<it.r&&d<bd){ bd=d; best=it; } }
    if(this.prompt?.id!==best?.id) this.prompt=best; }

  // ---------- enemies ----------
  flowField(){ const L=this.level; if(!this.flow||this.flow.length!==L.w*L.h) this.flow=new Int16Array(L.w*L.h); const fl=this.flow; fl.fill(-1); const sx=clamp(Math.floor(this.px),0,L.w-1), sy=clamp(Math.floor(this.py),0,L.h-1); const q=new Int32Array(L.w*L.h); let h=0,tl=0; q[tl++]=sy*L.w+sx; fl[sy*L.w+sx]=0;
    while(h<tl){ const c=q[h++]; const cx=c%L.w, cy=(c/L.w)|0; const d=fl[c]; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=L.w||ny>=L.h) continue; const ni=ny*L.w+nx; if(fl[ni]>=0||L.solid[ni]) continue; fl[ni]=d+1; q[tl++]=ni; } } }
  flowDir(e:En):{x:number;y:number}|null{ const L=this.level; const fl=this.flow; if(!fl) return null; const cx=Math.floor(e.x), cy=Math.floor(e.y); let best=fl[cy*L.w+cx]; if(best<0) return null; let bx=cx,by=cy;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy) continue; const nx=cx+dx,ny=cy+dy; if(nx<0||ny<0||nx>=L.w||ny>=L.h) continue; const ni=ny*L.w+nx; if(L.solid[ni]||fl[ni]<0) continue; if(dx&&dy&&(L.solid[cy*L.w+nx]||L.solid[ny*L.w+cx])) continue; if(fl[ni]<best){ best=fl[ni]; bx=nx; by=ny; } }
    if(bx===cx&&by===cy) return null; return { x:bx+.5, y:by+.5 }; }
  opponents(faction:'enemy'|'ally'):{x:number;y:number;r:number;hurt:(d:number,sx:number,sy:number)=>void}[]{
    if(faction==='enemy'){ const out:any[]=[]; if(!this.downed) out.push({x:this.px,y:this.py,r:COMBAT.playerRadius,hurt:(d:number,sx:number,sy:number)=>this.hurtPlayer(d,sx,sy)}); for(const a of this.enemies) if(a.faction==='ally'&&!a.dead) out.push({x:a.x,y:a.y,r:ENEMIES[a.type].radius,hurt:(d:number,sx:number,sy:number)=>this.hurtEnemy(a,d*.7,sx,sy)}); return out; }
    return this.enemies.filter(e=>e.faction==='enemy'&&!e.dead&&e._rt.reveal<=0).map(e=>({x:e.x,y:e.y,r:ENEMIES[e.type].radius,hurt:(d:number,sx:number,sy:number)=>this.hurtEnemy(e,d,sx,sy,.4)})); }
  updateEnemies(dt:number){
    this.flowT-=dt; if(this.flowT<=0){ this.flowT=.35; this.flowField(); }
    const alive=this.enemies.filter(e=>!e.dead);
    for(const e of alive){ const rt=e._rt; for(const k in rt.acd) rt.acd[k]-=dt; if(rt.hit>0) rt.hit-=dt; if(rt.vuln>0) rt.vuln-=dt; if(rt.reveal>0) continue; this.updateEnemy(e,dt); }
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
    const d=dist(e.x,e.y,tx,ty); const cloaked=tgtIsPlayer&&this.cloakT>0;
    if(!e.alert){ const rad=def.aggro*(cloaked?.18:1); if(e.faction==='enemy'&&tgtIsPlayer&&d<rad&&this.los(e.x,e.y,tx,ty)){ e.alert=true; this.alertGroup(e); this.emit('sfx','alert'); } else return; }
    if(cloaked&&d>1.7&&rt.st!=='tele'&&rt.st!=='dash'){ rt.lost+=dt; if(rt.lost>1.5){ e.alert=false; rt.lost=0; rt.st='idle'; } return; }
    const speed=def.speed*(this.zoneSlow(e)?.7:1);
    const ang=Math.atan2(ty-e.y,tx-e.x);
    // state machine
    if(rt.st==='tele'){ rt.t+=dt; const A=ATK[rt.atk]; if(rt.t<A.w*.6||!A.lock) rt.ang=ang; if(rt.t>=A.w){ this.resolveAttack(e,rt.atk,tx,ty); if(rt.st==='tele'){ rt.st='rec'; rt.t=0; } } return; }
    if(rt.st==='rec'){ rt.t+=dt; if(rt.t>=(ATK[rt.atk]?.rec??.5)) rt.st='chase'; return; }
    if(rt.st==='dash'){ this.dashStep(e,dt); return; }
    rt.st='chase';
    // attack choice
    if(rt.st==='chase'){
      const choices=def.attacks.filter(a=>{ const A=ATK[a]; if((rt.acd[a]||0)>0) return false; if(d<A.min||d>A.max) return false; if(A.ranged&&!this.los(e.x,e.y,tx,ty)) return false; if(def.boss&&a==='summon'&&this.enemies.filter(o=>!o.dead&&o.faction==='enemy'&&!ENEMIES[o.type].boss).length>8) return false; return true; });
      if(choices.length){ const a=choices[Math.floor(Math.random()*choices.length)]; this.beginAttack(e,a,ang,tx,ty); return; }
    }
    // movement
    let mx=0,my=0; const wantKeep=def.ranged&&!def.static?(def.boss?7:5.5):0;
    if(def.static) { rt.ang=ang; return; }
    if(e.faction==='ally'&&d<1.2) return;
    if(wantKeep&&d<wantKeep-1&&this.los(e.x,e.y,tx,ty)){ mx=-Math.cos(ang); my=-Math.sin(ang); const sd=rt.strafe; mx+= -Math.sin(ang)*sd*.5; my+= Math.cos(ang)*sd*.5; }
    else if(wantKeep&&d<wantKeep+1.5&&this.los(e.x,e.y,tx,ty)){ mx=-Math.sin(ang)*rt.strafe*.4; my=Math.cos(ang)*rt.strafe*.4; }
    else if(d>(def.ranged?wantKeep:1.0)){ if(this.los(e.x,e.y,tx,ty)||d<3||!tgtIsPlayer){ mx=Math.cos(ang); my=Math.sin(ang); } else { const fd=this.flowDir(e); if(fd){ const a2=Math.atan2(fd.y-e.y,fd.x-e.x); mx=Math.cos(a2); my=Math.sin(a2); } else { mx=Math.cos(ang); my=Math.sin(ang); } } }
    const l=Math.hypot(mx,my); if(l>0){ const p=this.moveCircle(e.x,e.y,mx/l*speed*dt,my/l*speed*dt,def.radius*.85); e.x=p.x; e.y=p.y; rt.ang=Math.atan2(my,mx); }
    else rt.ang=ang;
  }
  zoneSlow(e:En){ return false; }
  beginAttack(e:En,a:string,ang:number,tx:number,ty:number){
    const rt=e._rt; const A=ATK[a]; rt.st='tele'; rt.atk=a; rt.t=0; rt.ang=ang; rt.acd[a]=A.cd*(.85+Math.random()*.3); rt.shots=[]; this.emit('sfx','telegraph_'+(ENEMIES[e.type].elite?'elite':'basic'));
    if(a==='zones'){ // three ground zones around the player's position (readable, lingering)
      for(let i=0;i<3;i++){ const aa=Math.random()*Math.PI*2, rr=i===0?0:2.4+Math.random()*1.6; const zx=tx+Math.cos(aa)*rr, zy=ty+Math.sin(aa)*rr; if(!this.solidAt(zx,zy)){ rt.shots.push({x:zx,y:zy}); this.zones.push({x:zx,y:zy,r:2.1,t:0,life:6,dps:ENEMY_DMG.zones,heat:12,windup:1.5}); } }
    }
  }
  resolveAttack(e:En,a:string,tx:number,ty:number){
    const def=ENEMIES[e.type]; const rt=e._rt; const fac=e.faction; const ang=rt.ang; const dmg=ENEMY_DMG[a]*(fac==='ally'?1.2:1);
    const cone=(r:number,arc:number)=>{ this.fx.push({kind:'slash',x:e.x,y:e.y,a:ang,r,t:0,life:.25,w:arc,c:'#b8b09a'}); for(const o of this.opponents(fac)){ if(dist(e.x,e.y,o.x,o.y)-o.r<=r&&Math.abs(angDiff(Math.atan2(o.y-e.y,o.x-e.x),ang))<=arc/2) o.hurt(dmg,e.x,e.y); } this.emit('sfx','enemy_swing'); };
    const proj=(aa:number,speed:number)=>{ this.projs.push({x:e.x+Math.cos(aa)*.6,y:e.y+Math.sin(aa)*.6,vx:Math.cos(aa)*speed,vy:Math.sin(aa)*speed,dmg,r:.22,life:1.6,faction:fac==='ally'?'ally':'enemy',kind:'bolt'}); this.emit('sfx','enemy_shot'); };
    switch(a){
      case 'swing': cone(1.5,Math.PI*.6); break; case 'cleave': cone(2.6,Math.PI*.75); break; case 'rsweep': cone(3.8,Math.PI*.85); break;
      case 'slam': this.fx.push({kind:'ring',x:e.x,y:e.y,r:3.4,t:0,life:.4,c:'#b8b09a'}); for(const o of this.opponents(fac)) if(dist(e.x,e.y,o.x,o.y)-o.r<=3.4) o.hurt(dmg,e.x,e.y); this.emit('sfx','slam'); break;
      case 'shot': case 'turretshot': proj(Math.atan2(ty-e.y,tx-e.x),a==='shot'?11:13); break;
      case 'volley': for(const o of [-.25,0,.25]) proj(rt.ang+o,10); break;
      case 'summon': for(let i=0;i<3;i++){ const aa=Math.random()*6.28; const p={x:e.x+Math.cos(aa)*2.5,y:e.y+Math.sin(aa)*2.5}; if(!this.solidAt(p.x,p.y)){ const w=this.spawnEnemy('worker',p.x,p.y); w.alert=true; } } this.fx.push({kind:'ring',x:e.x,y:e.y,r:2.5,t:0,life:.5,c:'#8f8a74'}); break;
      case 'zones': break;
      case 'charge': rt.st='dash'; rt.t=0; rt.dashed=false; rt.hit=0; (rt as any).hitP=false; return;
    }
  }
  dashStep(e:En,dt:number){
    const def=ENEMIES[e.type]; const rt=e._rt; const sp=17; const dx=Math.cos(rt.ang)*sp*dt, dy=Math.sin(rt.ang)*sp*dt; const p=this.moveCircle(e.x,e.y,dx,dy,def.radius*.8); const moved=dist(p.x,p.y,e.x,e.y); e.x=p.x; e.y=p.y; rt.t+=dt;
    for(const o of this.opponents(e.faction)){ if(dist(e.x,e.y,o.x,o.y)<def.radius+o.r+.2&&!(rt as any).hitP){ (rt as any).hitP=true; o.hurt(ENEMY_DMG.charge,e.x,e.y); } }
    if(moved<sp*dt*.5||rt.t>.6){ rt.st='rec'; rt.atk='charge'; rt.t=0; rt.vuln=def.boss?2.8:1.8; this.fx.push({kind:'dust',x:e.x,y:e.y,t:0,life:.5}); this.emit('sfx','slam'); }
  }
  updateProjs(dt:number){
    for(const p of this.projs){ p.life-=dt; const nx=p.x+p.vx*dt, ny=p.y+p.vy*dt; if(this.solidAt(nx,ny)){ p.life=0; this.fx.push({kind:'spark',x:p.x,y:p.y,t:0,life:.2}); continue; } p.x=nx; p.y=ny;
      if(p.faction==='enemy'){ for(const o of this.opponents('enemy')) if(dist(p.x,p.y,o.x,o.y)<o.r+p.r){ o.hurt(p.dmg,p.x-p.vx,p.y-p.vy); p.life=0; break; } }
      else { for(const o of this.opponents('ally')) if(dist(p.x,p.y,o.x,o.y)<o.r+p.r){ o.hurt(p.dmg,p.x-p.vx,p.y-p.vy); this.fx.push({kind:'spark',x:p.x,y:p.y,t:0,life:.2}); p.life=0; break; } } }
    this.projs=this.projs.filter(p=>p.life>0);
  }
  updateZones(dt:number){ for(const z of this.zones){ z.t+=dt; if(z.t>=z.windup&&!this.downed&&!this.revealing&&dist(z.x,z.y,this.px,this.py)<z.r){ this.zoneTick=(this.zoneTick||0)+dt; this.heat=Math.min(COMBAT.heat.max,this.heat+z.heat*dt); if(this.zoneTick>.5){ this.zoneTick=0; this.hurtPlayer(z.dps,z.x,z.y); } } } this.zones=this.zones.filter(z=>z.t<z.life); }
  zoneTick=0;

  // ---------- death, loot, XP ----------
  killEnemy(e:En){
    if(e.dead) return; const def=ENEMIES[e.type]; e.dead=true; e.hp=0; this.kills++; this.save.stats.kills++; const inst=this.inst!; inst.kills[e.type]=(inst.kills[e.type]||0)+1; this.combatHold=3;
    this.emit('sfx','death_'+(def.boss?'boss':def.elite?'elite':def.mfr)); const gore=this.save.settings.gore; const n=gore==='off'?0:gore==='standard'?4:14;
    for(let i=0;i<n;i++){ const a=Math.random()*6.28,s=1+Math.random()*(gore==='bloody'?5:2.5); this.fx.push({kind:'blood',x:e.x,y:e.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:0,life:.5+Math.random()*.5,c:def.mfr==='PS'?'#8a8f94':'#6e2a22'}); }
    this.fx.push({kind:'burst',x:e.x,y:e.y,t:0,life:.3});
    if(e.faction==='ally') { return; }
    this.addXp(def.xp); inst.xpEarned+=def.xp; this.save.rep[def.mfr]+=def.rep; record(this.story(),'kill_mfr',def.mfr);
    this.rollLoot(e);
    if(e.type==='sawhand'&&!inst.flags.lock2){ inst.flags.lock2=true; this.openDoor('lock2'); this.toast('Sawhand down: junction lock released'); }
    if(def.boss) this.onBossDead(e);
  }
  addXp(n:number){ const s=this.save; s.xp+=n; while(s.level<PROGRESSION.maxLevel&&s.xp>=PROGRESSION.xpForLevel(s.level)){ s.xp-=PROGRESSION.xpForLevel(s.level); s.level++; this.toast('Level up! Level '+s.level); this.recompute(); } }
  pickEntry(pool:LootEntry[]):LootEntry{ const tot=pool.reduce((a,b)=>a+b.w,0); let r=Math.random()*tot; for(const e of pool){ r-=e.w; if(r<=0) return e; } return pool[0]; }
  rollLoot(e:En){
    const def=ENEMIES[e.type]; const inst=this.inst!; const T=def.boss?LOOT.boss:def.elite?LOOT.elite:LOOT.ordinary; const rolls=def.boss?LOOT.boss.rolls:def.elite?2:1;
    const cr=T.credits; if(Math.random()<(def.boss||def.elite?1:.5)) this.addDrop(e.x,e.y,{kind:'credits',amount:Math.round(cr[0]+Math.random()*(cr[1]-cr[0]))});
    for(let i=0;i<rolls;i++){ if(Math.random()>T.chance) continue; this.dropEntry(this.pickEntry(T.pool),e.x,e.y); }
    const sig=def.boss?LOOT.signature[e.type]:null; if(sig&&Math.random()<sig.chance) this.dropEntry({item:sig.item,w:1},e.x,e.y);
  }
  /** Personal loot, filtered against the recipient level. Ineligible items are NOT rerolled downward (spec). */
  dropEntry(en:LootEntry,x:number,y:number){
    if(en.item){ const d=ITEM_BY_ID[en.item]; if(d.lvl>this.save.level||d.lvl>DUNGEON_TIER_MAX_ITEM_LEVEL){ this.emit('filtered',d.name); return; } this.addDrop(x,y,{kind:'item',inst:mkInst(this.save,en.item),amount:1}); }
    else if(en.chip) this.addDrop(x,y,{kind:'chip',chip:en.chip,amount:1}); else if(en.stim) this.addDrop(x,y,{kind:'stim',amount:1});
  }
  addDrop(x:number,y:number,d:Partial<Drop>&{kind:Drop['kind']}){ const inst=this.inst!; const a=Math.random()*6.28, r=.3+Math.random()*.8; let px=x+Math.cos(a)*r, py=y+Math.sin(a)*r; if(this.solidAt(px,py)){ px=x; py=y; } const dr:Drop={ id:inst.nextId++, x:px, y:py, kind:d.kind, inst:d.inst, chip:d.chip, amount:d.amount||1 }; inst.drops.push(dr); const rar=this.dropRarity(dr); if(RARITY_RANK[rar]>=3) this.emit('sfx','loot_'+rar); return dr; }
  dropRarity(d:Drop):Rarity{ if(d.kind==='item') return ITEM_BY_ID[d.inst!.def].rarity; if(d.kind==='chip') return CHIPS[d.chip!].rarity; if(d.kind==='stim') return 'green'; return 'grey'; }
  carriedCount(){ const c=this.inst!.carried; return c.items.length+Object.values(c.chips).filter(v=>v&&v>0).length+(c.stims>0?1:0); }
  autoPickup(){
    const inst=this.inst!; if(this.downed) return; const rad=COMBAT.pickupRadius+this.stat().pickup; const near=inst.drops.filter(d=>dist(d.x,d.y,this.px,this.py)<rad);
    near.sort((a,b)=>RARITY_RANK[this.dropRarity(b)]-RARITY_RANK[this.dropRarity(a)]); const c=inst.carried;
    for(const d of near){ if(d.kind==='credits'){ c.credits+=d.amount; this.rm(d); this.emit('sfx','coin'); continue; }
      const stacksOk=(d.kind==='chip'&&(c.chips[d.chip!]||0)>0)||(d.kind==='stim'&&c.stims>0); const fits=stacksOk||this.carriedCount()<COMBAT.missionSlots;
      if(!fits){ if(!d.marker){ d.marker=true; this.toast('Inventory full: item left on the ground (marked).'); } continue; }
      if(d.kind==='item') c.items.push(d.inst!); else if(d.kind==='chip') c.chips[d.chip!]=(c.chips[d.chip!]||0)+1; else if(d.kind==='stim') c.stims++;
      this.rm(d); this.emit('pickup',d); this.emit('sfx','pickup'); }
  }
  rm(d:Drop){ const inst=this.inst!; inst.drops=inst.drops.filter(x=>x.id!==d.id); }
  onBossDead(e:En){
    const inst=this.inst!; const f=inst.flags; if(f.bossDead) return; f.bossDead=true; f.completed=true; this.projs=[]; this.zones=[];
    if(!f.rewardsGranted){ f.rewardsGranted=true; this.save.lastClearDay=todayStr(); this.save.stats.clears++; this.addXp(250); record(this.story(),'boss_defeated',e.type); record(this.story(),'run_cleared',f.cond||'none'); this.toast('MISSION COMPLETE. Daily clear consumed. Collect loot; the instance persists until it expires.'); }
    this.emit('boss-dead'); this.resPending=5; this.saveNow();
  }
  resPending=0;
  updateMusic(dt:number){
    let st='traversal'; if(this.combatHold>0) this.combatHold-=dt; const boss=this.enemies.find(e=>ENEMIES[e.type].boss&&!e.dead&&e._rt.reveal<=0&&this.inst!.flags.bossSpawned);
    const bossRev=this.enemies.some(e=>ENEMIES[e.type].boss&&!e.dead&&e._rt.reveal>0);
    if(this.resPending>0){ this.resPending-=dt; st='resolution'; } else if(bossRev) st='bossreveal'; else if(boss) st='bosscombat'; else { const engaged=this.enemies.some(e=>!e.dead&&e.faction==='enemy'&&e.alert&&dist(e.x,e.y,this.px,this.py)<12&&!ENEMIES[e.type].static); if(engaged||this.combatHold>0) st='combat'; }
    this.musicSet(st);
  }
}
export interface AtkDef { w:number; rec:number; cd:number; min:number; max:number; lock?:boolean; ranged?:boolean }
export const ATK:Record<string,AtkDef> = {
  swing:{w:.55,rec:.5,cd:1.1,min:0,max:1.4}, shot:{w:.8,rec:.6,cd:2.6,min:0,max:9,lock:true,ranged:true}, turretshot:{w:1.1,rec:.4,cd:2.8,min:0,max:10,lock:true,ranged:true},
  cleave:{w:.9,rec:.7,cd:2.2,min:0,max:2.6}, charge:{w:1.1,rec:1.4,cd:7,min:3.2,max:10,lock:true}, slam:{w:1.1,rec:.9,cd:5,min:0,max:3.4}, summon:{w:.9,rec:.8,cd:26,min:0,max:40},
  zones:{w:.7,rec:.9,cd:8,min:0,max:16,ranged:true}, volley:{w:1.0,rec:.8,cd:3.4,min:3,max:13,lock:true,ranged:true}, rsweep:{w:1.0,rec:.9,cd:3,min:0,max:3.8},
};
