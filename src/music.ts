// File-based adaptive music (ElevenLabs-generated tracks, see docs/AUDIO.md). State-driven with equal-power crossfades.
// Falls back to the procedural scheduler in audio.ts when files are missing (isReady() === false).
export type MState='town'|'traversal'|'combat'|'elite'|'bossreveal'|'bosscombat'|'resolution';
interface TrackDef { file:string; loop:boolean; keepPos:boolean }
const LOOPS=['town','traversal_a','traversal_b','combat_a','combat_b','boss_fight','calm_drift','calm_rust','calm_neon','calm_vents','calm_static','elite_siege','elite_hunt','boss_overclock','boss_meltdown','boss_hydraulic','boss_lineman','boss_pitboss','boss_bellfounder','boss_cryo','boss_auditor','boss_apothecary','boss_clearance','boss_resonance','boss_liquidator','boss_courier','boss_dispatcher','boss_warrantor','boss_rattle','boss_widow','boss_recall'];
const T:Record<string,TrackDef>={ boss_reveal:{file:'boss_reveal',loop:false,keepPos:false}, clear:{file:'clear',loop:false,keepPos:false} };
for(const n of LOOPS) T[n]={file:n,loop:true,keepPos:true};
/** Tracks that must load for file music to activate; the rest load best-effort and are dropped from pools when missing. */
export const CORE_TRACKS=['town','traversal_a','traversal_b','combat_a','combat_b','boss_reveal','boss_fight','clear'];
/** Per-state track pools (rotation draws from these via a shuffle bag). */
export const POOLS:Record<MState,string[]>={
  town:['town','calm_drift','calm_rust','calm_vents'],
  traversal:['traversal_a','traversal_b','calm_neon','calm_static','calm_drift','calm_rust','calm_vents'],
  combat:['combat_a','combat_b'],
  elite:['elite_siege','elite_hunt','boss_overclock','boss_meltdown','combat_a','combat_b'],
  bossreveal:['boss_reveal'],
  bosscombat:['boss_fight','boss_overclock','boss_meltdown','boss_hydraulic','elite_siege','elite_hunt','boss_lineman','boss_pitboss','boss_bellfounder','boss_cryo','boss_auditor','boss_apothecary','boss_clearance','boss_resonance','boss_liquidator','boss_courier','boss_dispatcher','boss_warrantor','boss_rattle','boss_widow','boss_recall'],
  resolution:['clear'] };
/** Boss id -> fixed fight track, so each boss has its own identity (unmapped bosses draw from the pool). */
import { BOSSES } from './content/batch1_bosses';
import { Q } from './quality';
export const BOSS_MAP:Record<string,string>={ ...Object.fromEntries(BOSSES.map(b=>[b.id,b.track])), overseer:'boss_fight', warden:'boss_overclock', enforcer:'boss_meltdown', teague:'boss_hydraulic', brannoch:'boss_meltdown', ore9:'boss_fight', surgeon:'boss_overclock', autosurgeon:'boss_hydraulic', recovered:'boss_fight', stockmgr:'boss_meltdown', retrieval:'boss_overclock', reclaimer:'boss_hydraulic' };
/** Shuffle bag: every item once per cycle, never the same item twice in a row (including across cycle refills). */
export class ShuffleBag{ private bag:string[]=[]; last:string|null=null;
  constructor(public items:string[], private rnd:()=>number=Math.random){}
  next(avail?:(n:string)=>boolean):string{ const items=avail?this.items.filter(avail):this.items; if(!items.length) return this.items[0]; if(items.length===1){ this.last=items[0]; return items[0]; }
    this.bag=this.bag.filter(x=>items.includes(x));
    if(!this.bag.length){ const b=items.slice(); for(let i=b.length-1;i>0;i--){ const j=Math.floor(this.rnd()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; } if(b[b.length-1]===this.last){ [b[0],b[b.length-1]]=[b[b.length-1],b[0]]; } this.bag=b; } // pop() takes from the end, so the end must not equal last
    let n=this.bag.pop()!; if(n===this.last&&this.bag.length){ const o=this.bag.pop()!; this.bag.push(n); n=o; }
    this.last=n; return n; } }
export interface FadeEvent { t:number; from:string|null; to:string|null; dur:number; state:MState }
interface Live { name:string; src:AudioBufferSourceNode; gain:GainNode; startedAt:number; offset:number; ending:boolean }

export class MusicManager {
  buffers:Record<string,AudioBuffer>={}; ready=false; loading=false; live:Live[]=[]; pos:Record<string,number>={};
  state:MState|null=null; want:MState='town'; cur:string|null=null; bags:Partial<Record<MState,ShuffleBag>>={}; key:string|null=null; fromTown=true; ROTATE_LOOPS=2; ROTATE_FADE=3;
  enteredAt=0; leaveSince=-1; log:FadeEvent[]=[]; timer:any=null; onReady:(()=>void)|null=null;
  COMBAT_MIN=6; COMBAT_EXIT_HOLD=4; // hysteresis (seconds)
  constructor(private ctx:AudioContext, private out:AudioNode, private base='audio/music/'){}
  isReady(){ return this.ready; }
  private getTrack:((d:TrackDef)=>Promise<void>)|null=null; private asked=new Set<string>();
  /** constrained devices skip the preload of variety tracks (decoded PCM is ~10x the mp3); fetch just the track that is about to be needed */
  ensure(file:string){ const d=Object.values(T).find(x=>x.file===file); if(!d||this.buffers[file]||this.asked.has(file)||!this.getTrack) return; this.asked.add(file); this.getTrack(d).catch(()=>this.asked.delete(file)); }
  async load(){ if(this.loading||this.ready) return; this.loading=true;
    try{ const get=async(d:TrackDef)=>{ const r=await fetch(this.base+d.file+'.mp3'); if(!r.ok) throw new Error(d.file+' '+r.status); const ab=await r.arrayBuffer(); this.buffers[d.file]=await this.ctx.decodeAudioData(ab); };
      await Promise.all(Object.values(T).filter(d=>CORE_TRACKS.includes(d.file)).map(get));
      this.ready=true; this.timer=setInterval(()=>this.tick(),250); this.onReady?.();
      this.getTrack=get; if(Q.p.musicVariety) Promise.all(Object.values(T).filter(d=>!CORE_TRACKS.includes(d.file)).map(d=>get(d).catch(()=>{}))); } // variety tracks stream in after start
    catch(e){ console.warn('music files unavailable, using procedural fallback',e); this.loading=false; } }
  now(){ return this.ctx.currentTime; }
  // Game-facing: request a state. Hysteresis is applied in tick().
  setState(s:MState,key?:string|null){ this.want=s; if(key!==undefined){ this.key=key; if(key&&BOSS_MAP[key]&&!Q.p.musicVariety) this.ensure(BOSS_MAP[key]); } if(!Q.p.musicVariety&&(s==='combat'||s==='elite'||s==='traversal')){ for(const f of POOLS[s].slice(0,2)) this.ensure(f); } this.tick(); }
  /** Pick the next track for a state: boss key mapping if known, else the state's shuffle bag (no immediate repeat). */
  pick(s:MState):string{ const have=(n:string)=>!!this.buffers[n];
    if(s==='bosscombat'&&this.key&&BOSS_MAP[this.key]&&have(BOSS_MAP[this.key])) return BOSS_MAP[this.key];
    const pool=POOLS[s]; if(pool.length===1) return pool[0]; const bag=(this.bags[s]??=new ShuffleBag(pool)); return bag.next(have); }
  tick(){ if(!this.ready) return; const t=this.now(); let tgt=this.want;
    if((this.state==='combat'||this.state==='elite')&&tgt==='traversal'){ // hold combat music: min dwell + sustained calm before dropping out
      if(this.leaveSince<0) this.leaveSince=t; if(t-this.enteredAt<this.COMBAT_MIN||t-this.leaveSince<this.COMBAT_EXIT_HOLD) tgt=this.state; }
    else this.leaveSince=-1;
    if(tgt===this.state){ this.maybeRotate(t); return; }
    this.enter(tgt); }
  /** Calm states rotate to the next pool track after ROTATE_LOOPS full loops; the fade starts so it lands on the loop boundary. */
  private maybeRotate(t:number){ if(this.state!=='town'&&this.state!=='traversal') return; const l=this.live.find(x=>!x.ending); if(!l) return; const b=this.buffers[l.name]; if(!b) return;
    const played=l.offset+(t-l.startedAt); if(played<b.duration*this.ROTATE_LOOPS-this.ROTATE_FADE) return;
    const n=this.pick(this.state); if(n===l.name) return; this.crossfade(n,this.ROTATE_FADE,this.state); }
  private enter(s:MState){ const prev=this.state; const t=this.now(); this.state=s; this.enteredAt=t; this.leaveSince=-1; const name=this.pick(s);
    let dur=2; if(s==='traversal'&&(prev===null||prev==='town')) dur=3; else if(s==='town') dur=3; else if(s==='bossreveal') dur=2.5; else if(s==='bosscombat') dur=prev==='bossreveal'?.6:1.5; else if(s==='resolution') dur=.5; else if(s==='combat'||s==='elite') dur=1.5; else if(prev==='resolution') dur=2.5;
    this.crossfade(name,dur,s); }
  crossfade(name:string|null,dur:number,s:MState){ const t=this.now(); const out=this.live.filter(l=>!l.ending);
    for(const l of out){ l.ending=true; this.savePos(l,t); const g=l.gain.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value,t); this.curve(g,g.value,0,t,dur); l.src.stop(t+dur+.05); setTimeout(()=>{ this.live=this.live.filter(x=>x!==l); },(dur+.2)*1000); }
    this.log.push({t,from:this.cur,to:name,dur,state:s}); this.cur=name; if(!name) return;
    const d=T[name], buf=this.buffers[name]; const src=this.ctx.createBufferSource(); src.buffer=buf; src.loop=d.loop; const gain=this.ctx.createGain(); gain.gain.value=0; src.connect(gain); gain.connect(this.out);
    let off=d.keepPos?(this.pos[name]||0):0; if(off>=buf.duration-1) off=0; src.start(t,off); this.curve(gain.gain,0,1,t,dur);
    const l:Live={name,src,gain,startedAt:t,offset:off,ending:false}; this.live.push(l); }
  private savePos(l:Live,t:number){ const d=T[l.name]; if(!d.keepPos) return; const b=this.buffers[l.name]; this.pos[l.name]=(l.offset+(t-l.startedAt))%b.duration; }
  // equal-power (cos/sin) fade curve
  private curve(p:AudioParam,a:number,b:number,t:number,dur:number){ const n=32, c=new Float32Array(n); for(let i=0;i<n;i++){ const x=i/(n-1); c[i]=a<b?Math.sin(x*Math.PI/2)*(b-a)+a:Math.cos(x*Math.PI/2)*(a-b)+b; } try{ p.setValueCurveAtTime(c,t,dur); }catch{ p.linearRampToValueAtTime(b,t+dur); } }
  stopAll(dur=1){ this.state=null; this.crossfade(null,dur,'town'); }
}
