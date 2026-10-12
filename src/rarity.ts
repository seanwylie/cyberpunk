// One place that defines how each rarity tier LOOKS and SOUNDS, so it reads at a glance everywhere (ground, labels, tiles, tooltips, minimap, pickup).
// Colour is never the only cue: every tier also has its own shape (marker), frame style, pip count and beam height.
import type { Rarity } from './config';
import { RARITY_COLOR } from './config';

export type MarkerShape = 'dot'|'circle'|'diamond'|'triangle'|'star';
export interface RStyle {
  tier:Rarity; rank:number; name:string; color:string;
  /** ground halo radius (px at scale 1) and alpha; 0 = none */ halo:number; haloA:number;
  /** light beam height (px at scale 1) and alpha; 0 = none (blue+ only, increasing) */ beamH:number; beamA:number;
  /** pulse amplitude (fraction of alpha) and rate (Hz). Rate is capped by FLASH_MAX_HZ and amplitude by FLASH_MAX_AMP (flash guard). */ pulseAmp:number; pulseHz:number;
  /** sparkle count per item (animated tier only) and shape */ sparkles:number; sparkShape:MarkerShape;
  /** corner pip count on tiles and shape marker for labels/minimap (colour-blind safe) */ pips:number; marker:MarkerShape;
  /** CSS frame style: border width px, whether it has a shine sweep */ border:number; shine:boolean;
  /** pickup sound id (existing synth cues in src/audio.ts) */ sfx:string;
}
export const FLASH_MAX_HZ=2.2, FLASH_MAX_AMP=.35, SPARKLE_CAP_PER_ITEM=5, SPARKLE_CAP_TOTAL=40, BEAM_MAX_H=150;
const S=(tier:Rarity,rank:number,name:string,o:Omit<RStyle,'tier'|'rank'|'name'|'color'>):RStyle=>({tier,rank,name,color:RARITY_COLOR[tier],...o});
export const RSTYLE:Record<Rarity,RStyle>={
  grey:  S('grey',0,'Common',  { halo:0,  haloA:0,   beamH:0,   beamA:0,   pulseAmp:0,   pulseHz:0,   sparkles:0, sparkShape:'dot',      pips:0, marker:'dot',      border:1, shine:false, sfx:'pickup' }),
  green: S('green',1,'Uncommon',{ halo:16, haloA:.22, beamH:0,   beamA:0,   pulseAmp:.15, pulseHz:1.0, sparkles:1, sparkShape:'circle',   pips:1, marker:'circle',   border:1, shine:false, sfx:'pickup_green' }),
  blue:  S('blue',2,'Rare',     { halo:22, haloA:.32, beamH:56,  beamA:.5, pulseAmp:.2,  pulseHz:1.4, sparkles:2, sparkShape:'diamond',  pips:2, marker:'diamond',  border:2, shine:true,  sfx:'pickup_blue' }),
  purple:S('purple',3,'Epic',   { halo:28, haloA:.42, beamH:96,  beamA:.62, pulseAmp:.32, pulseHz:1.9, sparkles:3, sparkShape:'triangle', pips:3, marker:'triangle', border:2, shine:true,  sfx:'pickup_purple' }),
  orange:S('orange',4,'Signature',{ halo:34, haloA:.5, beamH:140, beamA:.74, pulseAmp:.28, pulseHz:1.2, sparkles:5, sparkShape:'star',     pips:4, marker:'star',     border:3, shine:true,  sfx:'pickup_orange' }),
};
export const RARITY_ORDER:Rarity[]=['grey','green','blue','purple','orange'];
/** Number of sparkles actually drawn: animated tier only (fx 2), none under Reduced FX/far, scaled down by quality, never above the caps. */
export const sparkleCount=(r:Rarity,fx:0|1|2,qualityScale=1)=>fx<2?0:Math.min(SPARKLE_CAP_PER_ITEM,Math.round(RSTYLE[r].sparkles*Math.max(0,Math.min(1,qualityScale))));
/** Pulse multiplier in [1-amp, 1], at most FLASH_MAX_HZ and FLASH_MAX_AMP (WCAG-style flash guard); static (1) unless fx is animated. */
export const pulse=(r:Rarity,t:number,seed:number,fx:0|1|2)=>{ const s=RSTYLE[r]; if(fx<2||!s.pulseAmp) return 1; const hz=Math.min(s.pulseHz,FLASH_MAX_HZ), amp=Math.min(s.pulseAmp,FLASH_MAX_AMP); return 1-amp*(.5+.5*Math.sin(t*hz*6.283+seed)); };
const lin=(v:number)=>{ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); };
export const luminance=(hex:string)=>{ const n=parseInt(hex.slice(1),16); return .2126*lin(n>>16&255)+.7152*lin(n>>8&255)+.0722*lin(n&255); };
export const contrast=(a:string,b:string)=>{ const x=luminance(a),y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
export const DARK_BG='#14181a';
/** Draws a tier marker shape (colour-blind safe cue) centred at x,y with radius r. */
export function drawMarker(c:CanvasRenderingContext2D,shape:MarkerShape,x:number,y:number,r:number,color:string,outline='rgba(0,0,0,.8)'){
  c.save(); c.beginPath();
  if(shape==='dot'){ c.arc(x,y,r*.55,0,7); } else if(shape==='circle'){ c.arc(x,y,r,0,7); }
  else if(shape==='diamond'){ c.moveTo(x,y-r*1.15); c.lineTo(x+r,y); c.lineTo(x,y+r*1.15); c.lineTo(x-r,y); c.closePath(); }
  else if(shape==='triangle'){ c.moveTo(x,y-r*1.1); c.lineTo(x+r*1.05,y+r*.85); c.lineTo(x-r*1.05,y+r*.85); c.closePath(); }
  else { for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr=i%2?r*.5:r*1.2; c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr); } c.closePath(); }
  c.fillStyle=color; c.fill(); c.lineWidth=1; c.strokeStyle=outline; c.stroke(); c.restore();
}
