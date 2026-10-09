import { MusicManager, type MState } from './music';
// Procedural WebAudio fallback + file-based music manager (music.ts). Fully procedural WebAudio: original synthesis only (no samples, no reference audio copied).
// Music states: town, traversal (lo-fi trance/techno), combat (drum & bass), bossreveal (breather + motif), bosscombat, resolution.
export class AudioSys {
  ctx:AudioContext|null=null; master!:GainNode; musicBus!:GainNode; sfxBus!:GainNode; noiseBuf!:AudioBuffer; state='town'; pending='town'; step=0; nextT=0; timer:any=null; vol=.6; musicOn=true; last:Record<string,number>={}; barCount=0; revealT=0; playing=0; stateStart=0; fileBus!:GainNode; music:MusicManager|null=null; useFiles=false; musicBase='audio/music/';
  init(){ if(this.ctx) return; try{ const AC=(window as any).AudioContext||(window as any).webkitAudioContext; if(!AC) return; this.ctx=new AC(); const c=this.ctx!; this.master=c.createGain(); this.master.gain.value=this.vol; const comp=c.createDynamicsCompressor(); comp.threshold.value=-14; comp.ratio.value=5; this.master.connect(comp); comp.connect(c.destination); this.musicBus=c.createGain(); this.musicBus.gain.value=.55; this.musicBus.connect(this.master); this.fileBus=c.createGain(); this.fileBus.gain.value=.6; this.fileBus.connect(this.master); this.sfxBus=c.createGain(); this.sfxBus.gain.value=.8; this.sfxBus.connect(this.master);
      const n=c.sampleRate*1; this.noiseBuf=c.createBuffer(1,n,c.sampleRate); const d=this.noiseBuf.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
      this.nextT=c.currentTime+.1; this.timer=setInterval(()=>this.schedule(),25); this.music=new MusicManager(c,this.fileBus,this.musicBase); this.music.onReady=()=>{ this.useFiles=true; this.applyBus(); this.music!.setState(this.pending as MState); }; this.applyBus(); this.music.load(); }catch(e){ console.warn('audio init failed',e); } }
  resume(){ this.init(); if(this.ctx&&this.ctx.state==='suspended') this.ctx.resume(); }
  setVolume(v:number){ this.vol=v; if(this.master) this.master.gain.value=v; }
  applyBus(){ if(!this.musicBus) return; const c=this.ctx!, t=c.currentTime; const f=this.useFiles&&this.musicOn?.6:0, p=!this.useFiles&&this.musicOn?.55:0; this.fileBus.gain.setTargetAtTime(f*this.musicVol,t,.3); this.musicBus.gain.setTargetAtTime(p*this.musicVol,t,.3); }
  musicVol=1; setMusicVolume(v:number){ this.musicVol=v; this.applyBus(); } // music-only volume hook (0..1), independent of master
  setMusicOn(on:boolean){ this.musicOn=on; this.applyBus(); }
  setState(s:string){ if(s===this.pending) return; this.pending=s; if(!this.ctx) return; if(this.useFiles){ this.music!.setState(s as MState); return; } if(s==='bossreveal'){ this.state='bossreveal'; this.stateStart=this.ctx.currentTime; this.step=0; this.nextT=this.ctx.currentTime+.05; this.revealMotif(); }
    else if(this.state==='bossreveal'&&s==='bosscombat'){ this.state='bosscombat'; this.step=0; this.nextT=this.ctx.currentTime+.05; this.hit(.9); }
    else if(s==='combat'||s==='bosscombat'){ // punctuated transition: brief dropout + mechanical accent, then new arrangement
      this.state=s; this.step=0; this.nextT=this.ctx.currentTime+.25; this.thunk(70,.5); this.noise(.25,.2,1800,.35); }
    else if(s==='resolution'){ this.state=s; this.step=0; this.nextT=this.ctx.currentTime+.1; this.thunk(55,.8); }
    else { this.state=s; this.step=0; } }
  // --- primitives ---
  osc(type:OscillatorType,f:number,t:number,dur:number,g:number,bus:GainNode,lp?:number,fEnd?:number){ const c=this.ctx!; const o=c.createOscillator(); o.type=type; o.frequency.setValueAtTime(f,t); if(fEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20,fEnd),t+dur); const gn=c.createGain(); gn.gain.setValueAtTime(0,t); gn.gain.linearRampToValueAtTime(g,t+.008); gn.gain.exponentialRampToValueAtTime(.0001,t+dur); let n:AudioNode=o; if(lp){ const f2=c.createBiquadFilter(); f2.type='lowpass'; f2.frequency.value=lp; o.connect(f2); n=f2; } n.connect(gn); gn.connect(bus); o.start(t); o.stop(t+dur+.05); }
  noiseAt(t:number,dur:number,g:number,f:number,bus:GainNode,type:BiquadFilterType='bandpass',q=1){ const c=this.ctx!; const s=c.createBufferSource(); s.buffer=this.noiseBuf; const fl=c.createBiquadFilter(); fl.type=type; fl.frequency.value=f; fl.Q.value=q; const gn=c.createGain(); gn.gain.setValueAtTime(g,t); gn.gain.exponentialRampToValueAtTime(.0001,t+dur); s.connect(fl); fl.connect(gn); gn.connect(bus); s.start(t,Math.random()*.5); s.stop(t+dur+.05); }
  noise(dur:number,g:number,f:number,delay=0){ if(!this.ctx) return; this.noiseAt(this.ctx.currentTime+delay,dur,g,f,this.sfxBus); }
  thunk(f:number,g:number){ if(!this.ctx) return; this.osc('sine',f*2.2,this.ctx.currentTime,.3,g,this.sfxBus,undefined,f); }
  hit(g:number){ if(!this.ctx) return; const t=this.ctx.currentTime; this.osc('sine',160,t,.3,g*.9,this.musicBus,undefined,38); this.noiseAt(t,.2,g*.3,2500,this.musicBus); }
  // --- music scheduler ---
  schedule(){ const c=this.ctx; if(!c||c.state!=="running"||this.useFiles) return; const spb=(s:string)=>s==='combat'||s==='bosscombat'?60/174/4:60/112/4; while(this.nextT<c.currentTime+.12){ this.playStep(this.nextT,this.step); this.nextT+=spb(this.state); this.step++; } }
  playStep(t:number,st:number){
    const c=this.ctx!; const B=this.musicBus; const s=this.state; const bar=Math.floor(st/16), p=st%16;
    const A=55; const note=(semi:number,oct=0)=>A*Math.pow(2,(semi)/12+oct);
    if(s==='traversal'||s==='town'){
      const chord=[[0,3,7],[ -4,0,3],[-2,2,5],[ -5,-2,2]][Math.floor(bar/2)%4];
      if(p===0&&bar%2===0){ for(const i of chord){ this.osc('sawtooth',note(i,2),t,60/112*7.5,.045,B,700); this.osc('sawtooth',note(i,2)*1.007,t,60/112*7.5,.03,B,600); } }
      if(s==='traversal'){ if(p%4===0) this.osc('sine',90,t,.18,.22,B,undefined,42); if(p%4===2) this.noiseAt(t,.04,.04,7000,B,'highpass'); const arp=[0,7,12,7,3,10,12,10][p%8]; if(p%2===0) this.osc('triangle',note(arp+chord[0],3),t,.14,.035,B,1400); if(p===0) this.osc('sawtooth',note(chord[0],0),t,60/112*1.8,.09,B,240); }
      else { if(p%8===4) this.noiseAt(t,.03,.025,6000,B,'highpass'); }
    } else if(s==='combat'||s==='bosscombat'){
      const boss=s==='bosscombat'; const root=boss?-2:0;
      if(p===0||p===10||(boss&&p===7)) this.osc('sine',150,t,.22,.5,B,undefined,38); if(p===4||p===12){ this.noiseAt(t,.16,.2,1900,B); this.osc('triangle',210,t,.1,.18,B,undefined,120); } if(p%2===0) this.noiseAt(t,.025,.05,8500,B,'highpass'); if(p===14&&boss) this.noiseAt(t,.05,.06,8500,B,'highpass');
      const bassp=boss?[0,-1,0,3,0,-1,5,3]:[0,0,3,0,-2,0,3,5]; const n=bassp[(p>>1)%8]+root; if(p%2===0||p===3){ this.osc('sawtooth',note(n,0)*1.0,t,.2,.2,B,420+(bar%4)*120); this.osc('sine',note(n,-1)*2,t,.2,.28,B); }
      if(boss&&(p===0||p===3||p===8)) this.osc('square',note([12,15,10][p===0?0:p===3?1:2]+root,2),t,.3,.07,B,1500); // boss motif layer
      if(p===0&&bar%4===0) this.noiseAt(t,.5,.05,3000,B,'bandpass',3);
    } else if(s==='bossreveal'){ // drum-free breather; drone + motif handled in revealMotif
      if(p===0) this.osc('sine',note(-2,0),t,2.2,.18,B); if(p%8===0) this.noiseAt(t,.5,.02,300,B,'lowpass');
    } else if(s==='resolution'){ if(p===0&&bar%2===0){ for(const i of [0,3,7]) this.osc('sawtooth',note(i,2),t,3,.03,B,500); } if(p%8===0) this.osc('sine',80,t,.3,.1,B,undefined,50); }
  }
  revealMotif(){ const c=this.ctx!; const t=c.currentTime; const B=this.musicBus; this.osc('sine',46,t,9,.28,B); this.noiseAt(t,6,.05,200,B,'lowpass'); // rising unease
    const m=[55,65.4,49,77.8]; m.forEach((f,i)=>{ const tt=t+1.6+i*1.25; this.osc('sawtooth',f*2,tt,1.1,.12,B,500); this.osc('sine',f,tt,1.3,.2,B); this.noiseAt(tt,.12,.1,900,B); });
    this.osc('sawtooth',220,t+7.4,1.4,.1,B,800,60); this.hit(1.1); }
  // --- sfx ---
  sfx(name:string){ const c=this.ctx; if(!c||c.state!=='running') return; const now=c.currentTime; const gap:Record<string,number>={ hit:.05,enemy_swing:.08,pickup:.05,coin:.05,atk_ripper:.09,atk_blade:.06,atk_fist:.08,atk_slug:.1,atk_popper:.05,atk_autopistol:.04,atk_burst:.03,atk_shard:.08,atk_arc:.08,death_MM:.05,death_HI:.06,death_PS:.06,telegraph_basic:.15,hurt:.1,enemy_shot:.08,alert:.2 }; const g=gap[name]??.02; if(this.last[name]&&now-this.last[name]<g) return; this.last[name]=now; if(this.playing>14) return; const B=this.sfxBus; const t=now; this.playing++; setTimeout(()=>this.playing--,300);
    switch(name){
      case 'hit': this.noiseAt(t,.06,.2,2400,B); this.osc('sine',140,t,.1,.25,B,undefined,60); break;
      case 'atk_ripper': this.noiseAt(t,.14,.16,1400,B,'bandpass',4); this.osc('sawtooth',95,t,.14,.1,B,500,70); break;
      case 'atk_blade': this.noiseAt(t,.09,.12,6500,B,'highpass'); this.osc('triangle',1800,t,.08,.05,B,undefined,900); break;
      case 'atk_fist': this.noiseAt(t,.06,.12,900,B); break;
      case 'atk_popper': this.osc('square',520,t,.05,.1,B,undefined,260); break;
      case 'atk_autopistol': this.noiseAt(t,.04,.14,2600,B,'bandpass',3); this.osc('square',300,t,.04,.1,B,undefined,120); break;
      case 'atk_burst': this.osc('sawtooth',900,t,.04,.09,B,undefined,500); this.noiseAt(t,.03,.08,5000,B,'highpass'); break;
      case 'atk_shard': this.noiseAt(t,.12,.2,3200,B,'bandpass',2); this.osc('triangle',240,t,.1,.2,B,undefined,90); break;
      case 'atk_arc': this.noiseAt(t,.12,.14,4200,B,'highpass'); this.osc('sawtooth',700,t,.12,.12,B,undefined,160); break;
      case 'atk_slug': this.osc('sine',180,t,.16,.35,B,undefined,50); this.noiseAt(t,.1,.2,1800,B); break;
      case 'enemy_swing': this.noiseAt(t,.12,.1,1100,B); break;
      case 'enemy_shot': this.osc('square',420,t,.1,.06,B,1200,200); break;
      case 'slam': this.osc('sine',120,t,.5,.5,B,undefined,32); this.noiseAt(t,.3,.2,500,B,'lowpass'); break;
      case 'dodge': this.noiseAt(t,.16,.16,2600,B,'bandpass',.8); break;
      case 'telegraph_basic': this.osc('square',740,t,.05,.035,B); break;
      case 'telegraph_elite': this.osc('square',520,t,.09,.09,B); this.osc('square',520,t+.14,.09,.09,B); break;
      case 'alert': this.osc('square',300,t,.07,.03,B); break;
      case 'alarm': for(let i=0;i<4;i++) this.osc('square',i%2?640:480,t+i*.2,.18,.1,B,2000); break;
      case 'hurt': this.osc('sawtooth',110,t,.2,.25,B,400,60); this.noiseAt(t,.1,.18,700,B); break;
      case 'down': this.osc('sawtooth',160,t,1.1,.3,B,500,35); this.osc('sine',60,t,1.2,.35,B); break;
      case 'overheat': this.noiseAt(t,.8,.2,3500,B,'highpass'); this.osc('square',240,t,.5,.08,B,undefined,120); break;
      case 'cooled': this.osc('sine',520,t,.2,.08,B); break;
      case 'pickup': this.osc('triangle',900,t,.06,.07,B); break;
      case 'coin': this.osc('triangle',1300,t,.05,.05,B); break;
      case 'select': this.osc('triangle',600,t,.06,.07,B); break;
      case 'cancel': this.osc('triangle',300,t,.12,.07,B,undefined,200); break;
      case 'deny': this.osc('square',150,t,.15,.08,B,600); break;
      case 'door': this.osc('sine',70,t,.4,.4,B,undefined,35); this.noiseAt(t,.35,.15,400,B,'lowpass'); break;
      case 'objective': this.osc('triangle',330,t,.4,.12,B); this.osc('triangle',495,t+.1,.5,.12,B); break;
      case 'heal': this.osc('sine',440,t,.3,.08,B,undefined,660); break;
      case 'channel': this.osc('sine',200,t,1,.05,B,undefined,300); break;
      case 'windup': this.osc('sawtooth',90,t,.2,.05,B,300,200); break;
      case 'boss_reveal': break;
      case 'loot_purple': this.osc('sine',523,t,.7,.07,B); this.osc('sine',784,t+.08,.7,.06,B); break;
      case 'loot_orange': [392,523,659,784].forEach((f,i)=>{ this.osc('sine',f,t+i*.09,1.1,.07,B); this.osc('triangle',f*2,t+i*.09,.6,.025,B); }); this.osc('sine',65,t,1.4,.2,B); break;
      // Death cues: short, distinctive, unsettling; separate from the impact (X-COM-inspired emotional shape, original synthesis).
      case 'death_MM': { const o=this.ctx!.createOscillator(); o.type='square'; o.frequency.setValueAtTime(330,t+.04); o.frequency.exponentialRampToValueAtTime(70,t+.45); const lfo=this.ctx!.createOscillator(); lfo.frequency.value=28; const lg=this.ctx!.createGain(); lg.gain.value=40; lfo.connect(lg); lg.connect(o.frequency); const gn=this.ctx!.createGain(); gn.gain.setValueAtTime(.1,t+.04); gn.gain.exponentialRampToValueAtTime(.0001,t+.5); const f=this.ctx!.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1400; o.connect(f); f.connect(gn); gn.connect(B); o.start(t+.04); lfo.start(t+.04); o.stop(t+.55); lfo.stop(t+.55); break; }
      case 'death_HI': this.osc('sawtooth',210,t+.03,.7,.2,B,600,38); this.noiseAt(t+.03,.4,.18,300,B,'lowpass'); break;
      case 'death_PS': this.osc('sine',1100,t+.03,.5,.1,B,undefined,420); this.osc('sine',1113,t+.03,.5,.08,B,undefined,300); this.noiseAt(t+.05,.06,.1,6000,B,'highpass'); break;
      case 'death_elite': this.osc('sawtooth',260,t+.03,1,.22,B,700,30); this.osc('sine',70,t+.03,1,.4,B,undefined,28); break;
      case 'death_boss': this.osc('sawtooth',300,t+.05,2,.25,B,800,24); this.osc('sine',90,t+.05,2.2,.5,B,undefined,26); this.noiseAt(t+.1,1.2,.15,200,B,'lowpass'); break;
    }
  }
}
