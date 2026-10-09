// File-based adaptive music (ElevenLabs-generated tracks, see docs/AUDIO.md). State-driven with equal-power crossfades.
// Falls back to the procedural scheduler in audio.ts when files are missing (isReady() === false).
export type MState='town'|'traversal'|'combat'|'bossreveal'|'bosscombat'|'resolution';
interface TrackDef { file:string; loop:boolean; keepPos:boolean }
const T:Record<string,TrackDef>={
  town:{file:'town',loop:true,keepPos:true}, traversal_a:{file:'traversal_a',loop:true,keepPos:true}, traversal_b:{file:'traversal_b',loop:true,keepPos:true},
  combat_a:{file:'combat_a',loop:true,keepPos:true}, combat_b:{file:'combat_b',loop:true,keepPos:true},
  boss_reveal:{file:'boss_reveal',loop:false,keepPos:false}, boss_fight:{file:'boss_fight',loop:true,keepPos:true}, clear:{file:'clear',loop:false,keepPos:false} };
const FAMILY:Record<MState,string[]>={ town:['town'], traversal:['traversal_a','traversal_b'], combat:['combat_a','combat_b'], bossreveal:['boss_reveal'], bosscombat:['boss_fight'], resolution:['clear'] };
export interface FadeEvent { t:number; from:string|null; to:string|null; dur:number; state:MState }
interface Live { name:string; src:AudioBufferSourceNode; gain:GainNode; startedAt:number; offset:number; ending:boolean }

export class MusicManager {
  buffers:Record<string,AudioBuffer>={}; ready=false; loading=false; live:Live[]=[]; pos:Record<string,number>={};
  state:MState|null=null; want:MState='town'; cur:string|null=null; variant:Record<string,string>={}; fromTown=true;
  enteredAt=0; leaveSince=-1; log:FadeEvent[]=[]; timer:any=null; onReady:(()=>void)|null=null;
  COMBAT_MIN=6; COMBAT_EXIT_HOLD=4; // hysteresis (seconds)
  constructor(private ctx:AudioContext, private out:AudioNode, private base='audio/music/'){}
  isReady(){ return this.ready; }
  async load(){ if(this.loading||this.ready) return; this.loading=true;
    try{ await Promise.all(Object.values(T).map(async d=>{ const r=await fetch(this.base+d.file+'.mp3'); if(!r.ok) throw new Error(d.file+' '+r.status); const ab=await r.arrayBuffer(); this.buffers[d.file]=await this.ctx.decodeAudioData(ab); }));
      this.ready=true; this.timer=setInterval(()=>this.tick(),250); this.onReady?.(); }
    catch(e){ console.warn('music files unavailable, using procedural fallback',e); this.loading=false; } }
  now(){ return this.ctx.currentTime; }
  // Game-facing: request a state. Hysteresis is applied in tick().
  setState(s:MState){ this.want=s; this.tick(); }
  private fam(s:MState){ const f=FAMILY[s]; if(f.length===1) return f[0]; const prev=this.variant[s]; // keep a variant per run with a 35% chance to swap on re-entry
    if(!prev) this.variant[s]=f[Math.floor(Math.random()*f.length)]; else if(Math.random()<.35) this.variant[s]=f.find(x=>x!==prev)!; return this.variant[s]; }
  tick(){ if(!this.ready) return; const t=this.now(); let tgt=this.want;
    if(this.state==='combat'&&tgt==='traversal'){ // hold combat music: min dwell + sustained calm before dropping out
      if(this.leaveSince<0) this.leaveSince=t; if(t-this.enteredAt<this.COMBAT_MIN||t-this.leaveSince<this.COMBAT_EXIT_HOLD) tgt='combat'; }
    else this.leaveSince=-1;
    if(tgt===this.state) return; if(tgt==='town') this.variant={};
    this.enter(tgt); }
  private enter(s:MState){ const prev=this.state; const t=this.now(); this.state=s; this.enteredAt=t; this.leaveSince=-1; const name=this.fam(s);
    let dur=2; if(s==='traversal'&&(prev===null||prev==='town')) dur=3; else if(s==='town') dur=3; else if(s==='bossreveal') dur=2.5; else if(s==='bosscombat') dur=prev==='bossreveal'?.6:1.5; else if(s==='resolution') dur=.5; else if(s==='combat') dur=1.5; else if(prev==='resolution') dur=2.5;
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
