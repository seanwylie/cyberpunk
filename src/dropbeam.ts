// Prestige drop beam (docs/LOOT_ECONOMY.md "Meaningful moments"). Painterly, stylized, restrained style (docs/RARITY_FX.md art direction):
// one soft, hand-painted light column with a brushed base flare and a slow sway, a short rising entrance, and at most three
// drifting motes. No particle spam, no scanlines. Orange = warm gold/amber, seasonal = teal into violet.
type C=CanvasRenderingContext2D;
export const BEAM_COL={ orange:['#fff2c8','#ffb347','#ff7a1a'], seasonal:['#e8fbff','#7fe0ff','#b46bff'] } as const;
export const BEAM_INTRO=1.1;
const sm=(x:number)=>{ x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); };
export function drawPrestigeBeam(c:C,x:number,y:number,s:number,t:number,kind:'orange'|'seasonal',age:number,reduced:boolean,seed=0){
  const [core,mid,edge]=BEAM_COL[kind]; const grow=reduced?1:sm(age/BEAM_INTRO); const H=(190+(kind==='seasonal'?20:0))*s*grow; const W=(13+2*Math.sin(t*1.3+seed))*s;
  c.save(); c.globalCompositeOperation='lighter';
  // brushed base flare (two offset soft ellipses read as a painted stroke)
  for(let i=0;i<2;i++){ const g=c.createRadialGradient(x,y,0,x,y,(34+i*14)*s); g.addColorStop(0,mid+(i?'55':'88')); g.addColorStop(1,edge+'00'); c.fillStyle=g; c.globalAlpha=(reduced?.5:.75)*(i?.6:1); c.beginPath(); c.ellipse(x+(i?3:-2)*s,y+i*1.5*s,(34+i*14)*s,(13+i*5)*s,(i?.08:-.05),0,7); c.fill(); }
  if(H>2){ // the column: wide soft outer wash, tapered painted core, gentle sway at the top
    const sway=reduced?0:Math.sin(t*.9+seed)*5*s;
    const wash=c.createLinearGradient(x,y,x,y-H); wash.addColorStop(0,mid+'aa'); wash.addColorStop(.55,edge+'44'); wash.addColorStop(1,edge+'00'); c.fillStyle=wash; c.globalAlpha=reduced?.35:.55;
    c.beginPath(); c.moveTo(x-W*1.9,y); c.quadraticCurveTo(x-W*1.2,y-H*.5,x-W*.5+sway,y-H); c.lineTo(x+W*.5+sway,y-H); c.quadraticCurveTo(x+W*1.2,y-H*.5,x+W*1.9,y); c.closePath(); c.fill();
    const cg=c.createLinearGradient(x,y,x,y-H*.85); cg.addColorStop(0,core+'ff'); cg.addColorStop(.4,core+'aa'); cg.addColorStop(1,mid+'00'); c.fillStyle=cg; c.globalAlpha=reduced?.45:.8;
    c.beginPath(); c.moveTo(x-W*.45,y); c.quadraticCurveTo(x-W*.3,y-H*.45,x+sway*.6,y-H*.85); c.quadraticCurveTo(x+W*.3,y-H*.45,x+W*.45,y); c.closePath(); c.fill(); }
  if(!reduced){ // entrance ring, then three slow motes
    if(age<BEAM_INTRO){ const u=age/BEAM_INTRO; c.strokeStyle=core; c.lineWidth=3*s*(1-u); c.globalAlpha=(1-u)*.9; c.beginPath(); c.ellipse(x,y,(12+u*46)*s,(5+u*18)*s,0,0,7); c.stroke(); }
    c.fillStyle=core; for(let i=0;i<3;i++){ const u=((t*.22+i/3+seed*.13)%1); c.globalAlpha=.7*Math.sin(u*Math.PI)*grow; c.beginPath(); c.arc(x+Math.sin(u*6+i*2)*W*.9,y-u*H*.9,(1.6+i*.4)*s,0,7); c.fill(); } }
  c.restore(); }
export function isPrestigeDrop(d:{kind:string;prestige?:string;inst?:{def:string;prov?:{season:string}}},rarityOf:(id:string)=>string):'orange'|'seasonal'|null{
  if(d.kind!=='item'||!d.inst) return null; if(d.prestige==='seasonal'||d.inst.prov?.season) return 'seasonal'; if(d.prestige==='orange'||rarityOf(d.inst.def)==='orange') return 'orange'; return null; }
