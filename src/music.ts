// File-based adaptive music (ElevenLabs-generated tracks, see docs/AUDIO.md). State-driven with equal-power crossfades.
// Falls back to the procedural scheduler in audio.ts when files are missing (isReady() === false).
export type MState='town'|'traversal'|'combat'|'elite'|'bossreveal'|'bosscombat'|'resolution';
interface TrackDef { file:string; loop:boolean; keepPos:boolean }
const LOOPS=['harrow_forge','harrow_ember','harrow_steam','town','traversal_a','traversal_b','combat_a','combat_b','boss_fight','calm_drift','calm_rust','calm_neon','calm_vents','calm_static','elite_siege','elite_hunt','boss_overclock','boss_meltdown','boss_hydraulic','boss_lineman','boss_pitboss','boss_bellfounder','boss_cryo','boss_auditor','boss_apothecary','boss_clearance','boss_resonance','boss_liquidator','boss_courier','boss_dispatcher','boss_warrantor','boss_rattle','boss_widow','boss_recall'];
/** Ambient pack 2 + extra elite themes: lazy (never preloaded; fetched one-ahead right before use). */
export const CALM2=['town_dusk','town_market','town_neonrain','harrow_dawn','harrow_cinder','area_hi_slag','area_hi_press','area_ps_sterile','area_ps_ward','area_mm_muzak','area_mm_aisles','calm_tide','calm_ghost','calm_orbit'];
export const ELITE2=['elite_chrome','elite_voltage','elite_claw','elite_gridlock','elite_static','elite_ashfall','elite_razor','elite_cull','elite_sleet','elite_quota'];
export const LAZY=new Set([...CALM2,...ELITE2]);
const T:Record<string,TrackDef>={ boss_reveal:{file:'boss_reveal',loop:false,keepPos:false}, clear:{file:'clear',loop:false,keepPos:false} };
for(const n of [...LOOPS,...CALM2,...ELITE2]) T[n]={file:n,loop:true,keepPos:true};
/** Tracks that must load for file music to activate; the rest load best-effort and are dropped from pools when missing. */
export const CORE_TRACKS=['town','traversal_a','traversal_b','combat_a','combat_b','boss_reveal','boss_fight','clear'];
/** Per-state track pools (rotation draws from these via a shuffle bag). */
export const POOLS:Record<MState,string[]>={
  town:['town','calm_drift','calm_rust','calm_vents','town_dusk','town_market','town_neonrain'],
  traversal:['traversal_a','traversal_b','calm_neon','calm_static','calm_drift','calm_rust','calm_vents','calm_tide','calm_ghost','calm_orbit'],
  combat:['combat_a','combat_b'],
  elite:['elite_siege','elite_hunt','boss_overclock','boss_meltdown',...ELITE2],
  bossreveal:['boss_reveal'],
  bosscombat:['boss_fight','boss_overclock','boss_meltdown','boss_hydraulic','elite_siege','elite_hunt','boss_lineman','boss_pitboss','boss_bellfounder','boss_cryo','boss_auditor','boss_apothecary','boss_clearance','boss_resonance','boss_liquidator','boss_courier','boss_dispatcher','boss_warrantor','boss_rattle','boss_widow','boss_recall'],
  resolution:['clear'] };
export const TOWN_POOLS:Record<string,string[]>={ rustline:['town','calm_drift','calm_rust','calm_vents','town_dusk','town_market','town_neonrain'], harrow:['harrow_forge','harrow_ember','harrow_steam','harrow_dawn','harrow_cinder'] };
/** Run areas (manufacturer of the dungeon): tracks written for an area get double weight there and are excluded elsewhere; everything else in the traversal pool is shared. */
export const AREA_TRACKS:Record<string,string[]>={ HI:['area_hi_slag','area_hi_press'], PS:['area_ps_sterile','area_ps_ward'], MM:['area_mm_muzak','area_mm_aisles'] };
/** Traversal pool for an area with weights: [track, weight]. Unknown/empty area = shared pool only. */
export function areaPool(area:string|null):[string,number][]{ const mine=(area&&AREA_TRACKS[area])||[]; const other=new Set(Object.entries(AREA_TRACKS).filter(([k])=>k!==area).flatMap(([,v])=>v)); return [...POOLS.traversal.filter(t=>!other.has(t)&&!mine.includes(t)).map(t=>[t,1] as [string,number]),...mine.map(t=>[t,2] as [string,number])]; }
/** Boss id -> fixed fight track, so each boss has its own identity (unmapped bosses draw from the pool). */
import { BOSSES } from './content/batch1_bosses';
import { Q } from './quality';
export const BOSS_MAP:Record<string,string>={ ...Object.fromEntries(BOSSES.map(b=>[b.id,b.track])), overseer:'boss_fight', warden:'boss_overclock', enforcer:'boss_meltdown', teague:'boss_hydraulic', brannoch:'boss_meltdown', ore9:'boss_fight', surgeon:'boss_overclock', autosurgeon:'boss_hydraulic', recovered:'boss_fight', stockmgr:'boss_meltdown', retrieval:'boss_overclock', reclaimer:'boss_hydraulic' };
/** Relative intensity of each hard track (1 lightest .. 4 maximum); drives playlist building and phase escalation. */
export const INTENSITY:Record<string,number>={ elite_siege:1,elite_hunt:1,boss_lineman:1,boss_pitboss:1, boss_fight:2,boss_hydraulic:2,boss_bellfounder:2,boss_cryo:2,boss_auditor:2,boss_apothecary:2,boss_clearance:2, boss_overclock:3,boss_meltdown:3,boss_resonance:3,boss_liquidator:3,boss_courier:3,boss_dispatcher:3,boss_warrantor:3,boss_rattle:3,boss_widow:3, boss_recall:4 };
const hashS=(s:string)=>{ let h=0; for(const c of s) h=(h*31+c.charCodeAt(0))>>>0; return h; };
/** Per-boss playlist: [signature, +3 others from the boss pool]. Others are the same intensity or higher (lowest first, rotated by a per-boss hash for variety); lower ones only fill the gap. */
export const BOSS_PLAYLISTS:Record<string,string[]>=Object.fromEntries(Object.entries(BOSS_MAP).map(([id,sig])=>{ const si=INTENSITY[sig]||2; const others=POOLS.bosscombat.filter(t=>t!==sig);
  const up=others.filter(t=>(INTENSITY[t]||2)>=si).sort((a,b)=>(INTENSITY[a]||2)-(INTENSITY[b]||2)||(a<b?-1:1)), down=others.filter(t=>(INTENSITY[t]||2)<si).sort((a,b)=>(INTENSITY[b]||2)-(INTENSITY[a]||2)||(a<b?-1:1));
  const h=hashS(id), rot=(a:string[],n:number)=>a.length?a.slice(n%a.length).concat(a.slice(0,n%a.length)):a; const lv=[...new Set(up.map(t=>INTENSITY[t]||2))].sort((a,b)=>a-b), groups=lv.map(L=>rot(up.filter(t=>(INTENSITY[t]||2)===L),h)); const order:string[]=[]; for(let r=0;r<8;r++) for(const g of groups) if(g[r]) order.push(g[r]); // round-robin over intensity levels, lowest first
  const pick:string[]=[]; for(const t of [...order,...down]) if(pick.length<3&&!pick.includes(t)) pick.push(t);
  return [id,[sig,...pick]]; }));
/** Shuffle bag: every item once per cycle (weight n = n slots per cycle), never the same item twice in a row (also across cycle refills and, with a storage key, across sessions: bag contents + last track persist in localStorage). */
export class ShuffleBag{ private bag:string[]=[]; last:string|null=null; items:string[]; private w:Record<string,number>={};
  constructor(items:string[]|[string,number][], private rnd:()=>number=Math.random, private storeKey:string|null=null){ this.items=[]; for(const it of items){ const [n,w]=Array.isArray(it)?it:[it,1]; this.items.push(n); this.w[n]=w; } this.restore(); }
  private store(){ const ls:any=(globalThis as any).localStorage; return ls||null; }
  private restore(){ if(!this.storeKey) return; try{ const raw=this.store()?.getItem(this.storeKey); if(!raw) return; const d=JSON.parse(raw); if(Array.isArray(d.bag)) this.bag=d.bag.filter((x:any)=>this.items.includes(x)); if(typeof d.last==='string') this.last=d.last; }catch{} }
  private save(){ if(!this.storeKey) return; try{ this.store()?.setItem(this.storeKey,JSON.stringify({bag:this.bag,last:this.last})); }catch{} }
  private fill(items:string[]){ const slots:string[]=[]; for(const n of items) for(let k=0;k<(this.w[n]||1);k++) slots.push(n);
    for(let tries=0;tries<40;tries++){ for(let i=slots.length-1;i>0;i--){ const j=Math.floor(this.rnd()*(i+1)); [slots[i],slots[j]]=[slots[j],slots[i]]; } let bad=false; if(slots[slots.length-1]===this.last) bad=true; for(let i=1;i<slots.length&&!bad;i++) if(slots[i]===slots[i-1]) bad=true; if(!bad) break; } // pop() takes from the end, so the end must not equal last
    this.bag=slots; }
  next(avail?:(n:string)=>boolean):string{ const items=avail?this.items.filter(avail):this.items; if(!items.length) return this.items[0]; if(items.length===1){ this.last=items[0]; return items[0]; }
    this.bag=this.bag.filter(x=>items.includes(x));
    if(!this.bag.length) this.fill(items);
    let n=this.bag.pop()!; if(n===this.last){ const k=this.bag.findIndex(x=>x!==this.last); if(k>=0){ const o=this.bag.splice(k,1)[0]; this.bag.push(n); n=o; } else { const o=items.find(x=>x!==this.last)!; this.bag.push(n); n=o; } }
    this.last=n; this.save(); return n; } }
export interface FadeEvent { t:number; from:string|null; to:string|null; dur:number; state:MState }
interface Live { name:string; src:AudioBufferSourceNode; gain:GainNode; startedAt:number; offset:number; ending:boolean }

export class MusicManager {
  buffers:Record<string,AudioBuffer>={}; ready=false; loading=false; live:Live[]=[]; pos:Record<string,number>={};
  state:MState|null=null; want:MState='town'; cur:string|null=null; bags:Partial<Record<MState,ShuffleBag>>={}; key:string|null=null; fromTown=true; ROTATE_LOOPS=1; ROTATE_FADE=3; area:string|null=null; nextUp:Record<string,string>={};
  enteredAt=0; lastSwitchAt=0; phase=0; PHASE_MIN=20; leaveSince=-1; log:FadeEvent[]=[]; timer:any=null; onReady:(()=>void)|null=null;
  HARD_MIN=45; HARD_EXIT_HOLD=10; CALM_MIN=140; HARD_ROTATE=90; counts={calm:0,hard:0,phase:0,total:0,entries:0}; resetCounts(){ this.counts={calm:0,hard:0,phase:0,total:0,entries:0}; } // hysteresis (seconds): min time on a hard track; calm required before leaving it; min time on a calm track before it rotates
  constructor(private ctx:AudioContext, private out:AudioNode, private base='audio/music/'){}
  isReady(){ return this.ready; }
  private getTrack:((d:TrackDef)=>Promise<void>)|null=null; private asked=new Set<string>();
  /** constrained devices skip the preload of variety tracks (decoded PCM is ~10x the mp3); fetch just the track that is about to be needed */
  ensure(file:string){ const d=Object.values(T).find(x=>x.file===file); if(!d||this.buffers[file]||this.asked.has(file)||!this.getTrack) return; this.asked.add(file); this.getTrack(d).catch(()=>this.asked.delete(file)); }
  async load(){ if(this.loading||this.ready) return; this.loading=true;
    try{ const get=async(d:TrackDef)=>{ const r=await fetch(this.base+d.file+'.mp3'); if(!r.ok) throw new Error(d.file+' '+r.status); const ab=await r.arrayBuffer(); this.buffers[d.file]=await this.ctx.decodeAudioData(ab); };
      await Promise.all(Object.values(T).filter(d=>CORE_TRACKS.includes(d.file)).map(get));
      this.getTrack=get; this.ready=true; this.timer=setInterval(()=>this.tick(),250); this.onReady?.(); if(Q.p.musicVariety) Promise.all(Object.values(T).filter(d=>!CORE_TRACKS.includes(d.file)&&!LAZY.has(d.file)).map(d=>get(d).catch(()=>{}))); } // variety tracks stream in after start
    catch(e){ console.warn('music files unavailable, using procedural fallback',e); this.loading=false; } }
  now(){ return this.ctx.currentTime; }
  // Game-facing: request a state. Hysteresis is applied in tick().
  setState(s:MState,key?:string|null){ this.want=s; if(key!==undefined){ this.key=key; if(key&&BOSS_MAP[key]&&!Q.p.musicVariety) this.ensure(BOSS_MAP[key]); } if(!Q.p.musicVariety&&(s==='combat'||s==='elite'||s==='traversal')){ for(const f of POOLS[s].slice(0,2)) this.ensure(f); } this.tick(); }
  /** Pick the next track for a state: boss key mapping if known, else the state's shuffle bag (no immediate repeat). */
  playlist():string[]{ const k=this.key&&BOSS_PLAYLISTS[this.key]; return k||POOLS.bosscombat; }
  /** Shuffle-bag key per state (persisted in localStorage, so rotation order survives reloads/sessions). */
  bagKey(s:MState){ return s==='town'?'town:'+this.townId:s==='traversal'?'trav:'+(this.area||'-'):s; }
  bagFor(s:MState):ShuffleBag{ const k=this.bagKey(s); let b=this.bags[k as MState]; if(!b){ const items=s==='traversal'?areaPool(this.area):POOLS[s]; b=this.bags[k as MState]=new ShuffleBag(items,Math.random,'wv_music_bag:'+k); } return b; }
  pick(s:MState):string{ const have=(n:string)=>!!this.buffers[n];
    if(s==='bosscombat'){ const pl=this.playlist(); const sig=this.key&&BOSS_MAP[this.key]; if(sig){ this.fightBag=new ShuffleBag(pl); this.fightBag.last=sig; return sig; } }
    const pool=POOLS[s]; if(pool.length===1) return pool[0];
    if(s==='elite'){ const nu=this.nextUp.elite; if(nu&&have(nu)){ delete this.nextUp.elite; return nu; } return this.bagFor(s).next(have); } // hard entry is never gated: only decoded tracks are picked (lazy ones are prefetched in the background during runs)
    const calm=s==='town'||s==='traversal'; if(calm){ const k=this.bagKey(s), nu=this.nextUp[k]; if(nu&&have(nu)){ delete this.nextUp[k]; return nu; } }
    return this.bagFor(s).next(have); }
  /** Pick (and start fetching) the track that follows the current calm one so a rotation never waits on the network. */
  private prefetch(s:MState){ if(s!=='town'&&s!=='traversal'&&s!=='elite') return; const k=this.bagKey(s); if(this.nextUp[k]&&this.nextUp[k]!==this.cur) { this.ensure(this.nextUp[k]); return; } const n=this.bagFor(s).next(x=>x!==this.cur); this.nextUp[k]=n; this.ensure(n); }
  /** Set the run area (dungeon manufacturer HI/PS/MM) for per-area weighting of the exploration pool; applies to the next pick. */
  setArea(a:string|null){ if(a===this.area) return; this.area=a; }
  fightBag:ShuffleBag|null=null;
  townId='rustline';
  /** Switch the calm town pool (Rustline vs Harrow Reach). Crossfades immediately when currently in town. */
  setTownTheme(id:string){ if(id===this.townId) return; this.townId=id; const pool=TOWN_POOLS[id]||TOWN_POOLS.rustline; POOLS.town.splice(0,POOLS.town.length,...pool); delete this.bags['town:'+id as MState]; delete this.nextUp['town:'+id]; if(!this.ready) return; for(const f of pool) if(!LAZY.has(f)) this.ensure(f);
    if(this.state==='town'||this.want==='town'){ const t=this.now(); const nx=this.pick('town'); this.lastSwitchAt=t; this.enteredAt=t; if(this.buffers[nx]) this.crossfade(nx,3,'town'); else if(this.state==='town') this.pend={name:nx,dur:3,s:'town',at:t}; } }
  /** Boss phase change / enrage: switch to a more intense track from the boss playlist (after PHASE_MIN s on the current one). */
  onPhase(n:number){ if(n<=this.phase){ this.phase=n; return; } this.phase=n; if(this.state!=='bosscombat'||!this.ready) return; const t=this.now(); if(t-this.lastSwitchAt<this.PHASE_MIN) return;
    const have=(x:string)=>!!this.buffers[x]&&x!==this.cur; const ci=INTENSITY[this.cur||'']||2; const pl=this.playlist().filter(have);
    const higher=pl.filter(x=>(INTENSITY[x]||2)>ci), pool=higher.length?higher:pl.filter(x=>(INTENSITY[x]||2)>=ci); if(!pool.length) return;
    const nx=pool.sort((a,b)=>(INTENSITY[a]||2)-(INTENSITY[b]||2))[0]; this.lastSwitchAt=t; this.counts.phase++; this.counts.hard++; this.counts.total++; this.crossfade(nx,1.5,'bosscombat'); if(this.fightBag) this.fightBag.last=nx; }
  tick(){ if(!this.ready) return; const t=this.now(); this.flushPending(t); let tgt=this.want;
    const hard=(s:MState|null)=>s==='elite'||s==='bosscombat'||s==='combat';
    if(hard(this.state)&&tgt==='traversal'){ // (town return is explicit and not held) hold hard music: min dwell + sustained calm (exit delay) before fading back to calm
      if(this.leaveSince<0) this.leaveSince=t; if(t-this.enteredAt<this.HARD_MIN||t-this.leaveSince<this.HARD_EXIT_HOLD) tgt=this.state!; }
    else this.leaveSince=-1;
    if(tgt===this.state){ const k=this.state==='town'||this.state==='traversal'?this.bagKey(this.state):null; if(k&&this.nextUp[k]) this.ensure(this.nextUp[k]); this.maybeRotate(t); return; }
    if(tgt==='bosscombat'&&this.state!=='bossreveal') this.phase=0; // new fight (a reveal->fight handoff keeps the phase)
    this.enter(tgt); }
  /** Calm states rotate to the next pool track after ROTATE_LOOPS full loops; the fade starts so it lands on the loop boundary. */
  private maybeRotate(t:number){ const hard=this.state==='elite'||this.state==='bosscombat'; if(!hard&&this.state!=='town'&&this.state!=='traversal') return;
    if(hard? t-this.lastSwitchAt<this.HARD_ROTATE : (t-this.lastSwitchAt<this.CALM_MIN||t-this.enteredAt<this.CALM_MIN)) return; if(!hard&&(this.want!==this.state||this.leaveSince>=0)) return; const l=this.live.find(x=>!x.ending); if(!l) return; const b=this.buffers[l.name]; if(!b) return;
    const loops=hard?1:Math.max(this.ROTATE_LOOPS,Math.ceil(this.CALM_MIN/b.duration)); const played=l.offset+(t-l.startedAt); if(played<b.duration*loops-this.ROTATE_FADE) return;
    if(!hard){ const k=this.bagKey(this.state!); if(!this.nextUp[k]) this.prefetch(this.state!); if(!this.buffers[this.nextUp[k]]) return; }
    let n:string; if(this.state==='bosscombat'){ const have=(x:string)=>!!this.buffers[x]; this.fightBag??=new ShuffleBag(this.playlist()); n=this.fightBag.next(have); } else n=this.pick(this.state!);
    if(n===l.name) return; this.lastSwitchAt=t; this.counts.total++; if(hard) this.counts.hard++; else this.counts.calm++; this.crossfade(n,this.ROTATE_FADE,this.state!); }
  pend:{name:string;dur:number;s:MState;at:number}|null=null;
  /** Entering hard music is never gated by dwell/cooldowns. If the wanted track isn't decoded yet it is fetched and started the moment it loads (any decoded hard track after 4 s). */
  private flushPending(t:number){ const p=this.pend; if(!p) return; if(this.state!==p.s){ this.pend=null; return; } let n=p.name; if(!this.buffers[n]){ if(t-p.at<4){ this.ensure(n); return; } const alt=POOLS[p.s].find(x=>this.buffers[x]); if(!alt) return; n=alt; } this.pend=null; this.counts.entries++; this.crossfade(n,p.dur,p.s); }
  private enter(s:MState){ const prev=this.state; const t=this.now(); this.state=s; this.enteredAt=t; this.lastSwitchAt=t; this.leaveSince=-1; this.pend=null; const name=this.pick(s);
    let dur=2; if(s==='traversal'&&(prev===null||prev==='town')) dur=3; else if(s==='town') dur=3; else if(s==='bossreveal') dur=2.5; else if(s==='bosscombat') dur=1.5; else if(s==='resolution') dur=.5; else if(s==='combat'||s==='elite') dur=1.5; else if(prev==='resolution') dur=2.5;
    if(!this.buffers[name]&&(s==='elite'||s==='bosscombat')){ this.ensure(name); this.pend={name,dur,s,at:t}; return; }
    if(s==='elite'||s==='bosscombat') this.counts.entries++; this.crossfade(name,dur,s); }
  crossfade(name:string|null,dur:number,s:MState){ const t=this.now(); const out=this.live.filter(l=>!l.ending);
    for(const l of out){ l.ending=true; this.savePos(l,t); const g=l.gain.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value,t); this.curve(g,g.value,0,t,dur); l.src.stop(t+dur+.05); setTimeout(()=>{ this.live=this.live.filter(x=>x!==l); this.evict(l.name); },(dur+.2)*1000); }
    if(name&&!this.buffers[name]){ this.pend={name,dur,s,at:t}; return; } // track not decoded yet: start it the moment it is
    this.log.push({t,from:this.cur,to:name,dur,state:s}); this.cur=name; if(!name) return;
    const d=T[name], buf=this.buffers[name]; const src=this.ctx.createBufferSource(); src.buffer=buf; src.loop=d.loop; const gain=this.ctx.createGain(); gain.gain.value=0; src.connect(gain); gain.connect(this.out);
    let off=d.keepPos?(this.pos[name]||0):0; if(off>=buf.duration-1) off=0; src.start(t,off); this.curve(gain.gain,0,1,t,dur);
    const l:Live={name,src,gain,startedAt:t,offset:off,ending:false}; this.live.push(l); if(s==='town'||s==='traversal'||s==='elite'){ this.prefetch(s); if(s==='traversal') this.prefetch('elite'); } }
  /** Lazy tracks are decoded PCM (~50 MB each): drop them once faded out unless they are current or queued next (re-fetched from the HTTP cache when needed). */
  private evict(n:string){ if(!LAZY.has(n)||n===this.cur||this.live.some(x=>x.name===n)||Object.values(this.nextUp).includes(n)||this.pend?.name===n) return; delete this.buffers[n]; this.asked.delete(n); }
  private savePos(l:Live,t:number){ const d=T[l.name]; if(!d.keepPos) return; const b=this.buffers[l.name]; this.pos[l.name]=(l.offset+(t-l.startedAt))%b.duration; }
  // equal-power (cos/sin) fade curve
  private curve(p:AudioParam,a:number,b:number,t:number,dur:number){ const n=32, c=new Float32Array(n); for(let i=0;i<n;i++){ const x=i/(n-1); c[i]=a<b?Math.sin(x*Math.PI/2)*(b-a)+a:Math.cos(x*Math.PI/2)*(a-b)+b; } try{ p.setValueCurveAtTime(c,t,dur); }catch{ p.linearRampToValueAtTime(b,t+dur); } }
  stopAll(dur=1){ this.state=null; this.crossfade(null,dur,'town'); }
}
