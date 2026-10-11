// Ability SFX player: windup / cast / travel / impact layers per ability (profiles in sfxprofile.ts). Uses a lazily loaded generated sample per family+layer
// (public/audio/sfx/<family>_<layer>.mp3, tools/gen_sfx.py) when it exists, else a synth fallback tuned per family. Pitch/filter per ability, random spread per cast,
// a global voice cap with power priority and per-layer gaps keep it cheap. Silent in town (the sim never emits there) and trimmed under Reduced FX.
import { sfxOf, SAMPLE_LAYERS, type Family, type Layer, type SfxProfile } from './sfxprofile';
type Audio=any;
export const MAX_VOICES=8; const GAP:Record<Layer,number>={ windup:.18, cast:.07, travel:.14, impact:.045 };
export class AbilitySfx {
  buf=new Map<string,AudioBuffer|null|'loading'>(); voices:{end:number;pri:number}[]=[]; last=new Map<string,number>();
  stats={ played:0, sample:0, synth:0, dropped:0, peak:0, loaded:0, missing:0 };
  constructor(private A:Audio, public base='audio/sfx/'){}
  /** start loading the samples of the abilities the player has equipped (no sound) */
  warm(ids:string[]){ for(const id of ids){ const p=sfxOf(id); if(!p) continue; for(const l of p.layers) if(SAMPLE_LAYERS[p.family].includes(l)) this.load(p.family,l); } }
  load(f:Family,l:Layer){ const k=f+'_'+l; if(this.buf.has(k)||!this.A.ctx) return; this.buf.set(k,'loading'); fetch(this.base+k+'.mp3').then(r=>{ if(!r.ok) throw new Error('missing'); return r.arrayBuffer(); }).then(b=>this.A.ctx.decodeAudioData(b)).then(d=>{ this.buf.set(k,d); this.stats.loaded++; }).catch(()=>{ this.buf.set(k,null); this.stats.missing++; }); }
  /** play one layer of an ability. red = Reduced FX (cast + impact only, no windup/travel, quieter) */
  play(id:string,layer:Layer,red=false):boolean{ const A=this.A, c=A.ctx; if(!c||c.state!=='running'||A.sfxVol<=0) return false; const p=sfxOf(id); if(!p||!p.layers.includes(layer)) return false; if(red&&(layer==='windup'||layer==='travel')) return false;
    const now=c.currentTime, key=id+':'+layer; if(now-(this.last.get(key)||-9)<GAP[layer]) return false; const dur=layer==='cast'?.9:layer==='windup'?.55:layer==='travel'?.25:.6;
    this.voices=this.voices.filter(v=>v.end>now); const pri=p.power+(layer==='cast'?.3:layer==='impact'?.1:0);
    if(this.voices.length>=MAX_VOICES){ const low=Math.min(...this.voices.map(v=>v.pri)); if(pri<=low){ this.stats.dropped++; return false; } this.voices.sort((a,b)=>a.pri-b.pri); this.voices.shift(); /* the quietest voice is left to finish, but no longer counted: effective cap stays small */ }
    this.last.set(key,now); this.voices.push({end:now+dur,pri}); this.stats.played++; if(this.voices.length>this.stats.peak) this.stats.peak=this.voices.length;
    const rate=p.rate*(1+(Math.random()*2-1)*p.vary), g=(layer==='windup'?p.windup:p.gain)*(red?.6:1)*(layer==='travel'?.55:1);
    const smp=SAMPLE_LAYERS[p.family].includes(layer)?this.buf.get(p.family+'_'+layer):null; if(smp===undefined) this.load(p.family,layer);
    if(smp&&smp!=='loading'){ const s=c.createBufferSource(); s.buffer=smp; s.playbackRate.value=rate; const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=p.lp; const gn=c.createGain(); gn.gain.value=g*.9; s.connect(f); f.connect(gn); gn.connect(A.sfxBus); s.start(now); this.stats.sample++; }
    else { this.synth(p,layer,now,rate,g); this.stats.synth++; }
    if(layer==='cast'&&p.sub&&!red){ A.osc('sine',70*rate,now,.5,.14*p.gain,A.sfxBus,undefined,38); A.noiseAt(now,.3,.05*p.gain,300,A.sfxBus,'lowpass'); }
    return true; }
  /** synth fallback: a small recipe per family and layer */
  synth(p:SfxProfile,layer:Layer,t:number,r:number,g:number){ const A=this.A, B=A.sfxBus, o=(ty:OscillatorType,f:number,d:number,v:number,fe?:number)=>A.osc(ty,f*r,t,d,v*g,B,p.lp,fe?fe*r:undefined), n=(d:number,v:number,f:number,ty:BiquadFilterType='bandpass',q=1,dl=0)=>A.noiseAt(t+dl,d,v*g,Math.min(p.lp*1.4,f*r),B,ty,q);
    const W=layer==='windup', C=layer==='cast', T=layer==='travel';
    switch(p.family){
      case 'servo': if(W){ o('sawtooth',90,.4,.1,220); n(.4,.08,900); } else if(C){ o('sine',120,.18,.28,45); o('square',210,.07,.1,160); n(.12,.18,1400); n(.05,.12,3200,'highpass',1,.1); } else { o('sine',95,.14,.3,40); n(.08,.2,2200); o('triangle',640,.09,.1,260); } break;
      case 'blade': if(W){ n(.3,.1,5000,'highpass'); o('triangle',1500,.3,.05,2400); } else if(C){ n(.16,.2,6000,'highpass'); o('triangle',2200,.35,.06,1500); o('sine',3100,.4,.03); } else { n(.07,.2,3800); o('triangle',2600,.3,.07,1200); } break;
      case 'optic': if(W){ o('sine',500,.45,.07,2200); o('sine',750,.45,.04,3300); } else if(C){ o('sawtooth',2800,.14,.09,380); n(.05,.12,7000,'highpass'); } else if(T){ o('sawtooth',1500,.2,.04,1700); } else { n(.12,.14,4500,'bandpass',3); o('square',1200,.08,.06,300); } break;
      case 'arc': if(W){ n(.5,.08,4500,'highpass'); o('sawtooth',90,.5,.05,300); } else if(C){ n(.25,.2,5500,'highpass'); o('square',1200,.14,.08,160); o('sawtooth',300,.2,.06,90); } else if(T){ n(.15,.08,6000,'highpass'); } else { n(.1,.18,6500,'highpass'); o('square',900,.09,.08,200); } break;
      case 'fire': if(W){ n(.5,.1,600,'bandpass',1.5); o('sawtooth',70,.5,.05,260); } else if(C){ n(.4,.2,1100,'bandpass',1.3); o('sawtooth',130,.35,.1,50); n(.2,.08,5000,'highpass',1,.05); } else if(T){ n(.22,.1,900,'bandpass',1.2); } else { n(.3,.18,1500); o('sine',90,.22,.2,45); n(.15,.08,6000,'highpass',1,.08); } break;
      case 'vent': if(W){ n(.5,.08,3500,'highpass'); } else if(C){ n(.7,.2,5000,'highpass'); o('sine',220,.3,.05,120); } else { n(.18,.12,4500,'highpass'); o('sine',2200,.1,.03,1400); } break;
      case 'drone': if(W){ o('square',500,.3,.05,900); o('square',700,.3,.04,1100); } else if(C){ o('square',900,.06,.08,1300); o('square',1300,.06,.07,1700); n(.1,.06,3200); } else if(T){ o('sawtooth',160,.2,.04,200); } else { o('square',1500,.05,.07,700); n(.04,.1,3500); } break;
      case 'shield': if(W){ o('sine',200,.5,.07,420); o('triangle',402,.5,.04,800); } else if(C){ o('sine',330,.8,.11,330); o('triangle',496,.8,.07,500); o('sine',165,.8,.08,165); } else { o('triangle',620,.12,.09,280); n(.05,.1,3000); } break;
      case 'kinetic': if(W){ o('sine',70,.5,.1,120); n(.4,.07,300,'lowpass'); } else if(C){ o('sine',110,.4,.3,32); n(.4,.22,500,'lowpass'); n(.2,.1,2500); } else if(T){ n(.2,.1,700); o('sine',90,.2,.07,70); } else { o('sine',130,.2,.28,48); n(.12,.2,1800); } break;
      case 'gravity': if(W){ o('sine',300,.6,.08,90); } else if(C){ o('sine',260,.7,.2,38); o('sine',130,.7,.12,30); n(.5,.08,500,'lowpass'); } else { o('sine',210,.25,.2,60); n(.2,.08,800,'lowpass'); } break;
      case 'heal': if(W){ o('sine',500,.4,.05,900); } else if(C){ o('sine',523,.2,.08); A.osc('sine',659*r,t+.07,.2,.08*g,B,p.lp); A.osc('sine',784*r,t+.14,.4,.07*g,B,p.lp); n(.3,.04,7000,'highpass'); } else { o('sine',880,.12,.06,1200); } break;
      case 'blink': if(W){ n(.3,.07,2500,'bandpass',2); o('sine',300,.3,.05,800); } else if(C){ o('sine',260,.14,.1,1500); n(.15,.12,3500,'highpass'); } else { o('sine',900,.08,.07,380); } break;
      case 'stealth': if(W){ n(.4,.05,500,'lowpass'); } else if(C){ o('sine',200,.6,.1,80); n(.5,.06,700,'lowpass'); n(.3,.04,4000,'highpass',1,.1); } else { o('sine',150,.12,.1,70); n(.05,.08,900,'lowpass'); } break;
      case 'sonic': if(W){ n(.4,.08,1200,'bandpass',1.5); o('sine',180,.4,.06,380); } else if(C){ o('sine',500,.3,.14,180); n(.2,.2,2800); o('sine',3600,.5,.03); } else { o('sine',380,.16,.12,150); n(.1,.14,2200); } break;
      case 'hack': if(W){ for(let i=0;i<4;i++) A.osc('square',(700+i*180)*r,t+i*.07,.05,.05*g,B,p.lp); } else if(C){ for(let i=0;i<4;i++) A.osc('square',(500+i*240)*r,t+i*.04,.05,.07*g,B,p.lp); n(.12,.1,5000,'highpass'); } else { o('square',1800,.05,.07,600); n(.06,.1,6500,'highpass'); } break;
      case 'blast': if(W){ for(let i=0;i<5;i++) A.osc('square',(600+i*80)*r,t+i*.09,.04,.06*g,B,p.lp); } else if(C){ o('sine',90,.7,.3,28); n(.7,.25,700,'lowpass'); n(.3,.12,4000,'highpass'); } else { o('sine',100,.35,.3,40); n(.3,.22,1400); } break;
      case 'summon': if(W){ for(let i=0;i<4;i++) A.noiseAt(t+i*.1,.04,.12*g,2500*r,B,'bandpass',3); } else if(C){ o('sine',100,.25,.3,50); n(.1,.2,1800); o('square',600,.2,.07,900); } else if(T){ A.noiseAt(t,.03,.1*g,3000*r,B,'bandpass',3); } else { o('square',1400,.04,.08,500); n(.04,.12,4500); } break;
    } void T; void C; }
}
