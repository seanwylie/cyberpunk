import { COMBAT } from './config';
import type { Variant } from './bodyvariants';
/**
 * Sprite-sheet character animation (optional layer over the procedural character).
 * Drop-in: put public/sprites/player.json (+ PNGs it references) and the game uses it automatically.
 * If the atlas is missing/invalid/incomplete, drawPlayer() keeps using the procedural character.
 *
 * ATLAS FORMAT (public/sprites/player.json) - see docs/SPRITE_PIPELINE.md
 * Each animation is its own PNG: rows = directions, columns = frames, uniform cells of atlas.frame size.
 * dirs:8 rows = S,SW,W,NW,N,NE,E,SE.  dirs:5 rows = S,SW,W,NW,N and the east side is mirrored at draw time.
 */
export type Dir8 = 0|1|2|3|4|5|6|7; // screen-space: 0=S,1=SW,2=W,3=NW,4=N,5=NE,6=E,7=SE
export const DIR_ORDER=['S','SW','W','NW','N','NE','E','SE'] as const;
export type AnimName='idle'|'run'|'dodge'|'attack'|'cast'|'hit'|'down';
export const REQUIRED_ANIMS:AnimName[]=['idle','run','dodge','attack','cast','hit','down'];

export interface AnimDef {
  image:string;            // PNG path relative to the json
  frames:number;           // columns
  fps:number;
  loop:boolean;            // idle/run loop; others play once (down holds last frame)
  /** 8 = rows S,SW,W,NW,N,NE,E,SE.  5 = rows S,SW,W,NW,N; SE,E,NE are mirrored from SW,W,NW. */
  dirs:5|8;
  /** Loader cross-fades neighbouring frames (sub-frame interpolation) so playback is smoother than the baked frame rate. Off for fast, large-motion anims (dodge roll). */
  blend?:boolean;
  hitFrame?:number;        // frame at which damage/effect visually lands (attack/cast), for sync
  /** Optional modular body layers (one sheet per body slot, same grid as `image`). When present they are drawn
   *  instead of `image`; `order[dir][frame]` lists indices into `layers` far->near (depth sorted at bake time).
   *  Swapping a limb = replace that layer's PNG with one baked on the same rig. `image` stays as a pre-composited fallback. */
  layers?:{name:string;image:string}[];
  order?:number[][][];
}
export interface Atlas {
  version:1;
  frame:{ w:number; h:number };         // cell size in source pixels (e.g. 192x192)
  anchor:{ x:number; y:number };        // foot pivot inside the cell, source px (e.g. 96,160)
  scale:number;                         // draw scale relative to the procedural character height (1 = same ~48 world px at TW=64)
  anims:Partial<Record<AnimName,AnimDef>>;
}

export interface LoadedAtlas { base?:string; atlas:Atlas; images:Partial<Record<AnimName,HTMLImageElement>>; layerImages:Partial<Record<AnimName,HTMLImageElement[]>>; }
/** Anims not yet authored fall back to the closest authored one. */
const FALLBACK:Record<AnimName,AnimName[]>={idle:[],run:['idle'],dodge:['run','idle'],attack:['idle'],cast:['idle'],hit:['idle'],down:['idle']};

/** Convert world-space facing/velocity (x,y world axes) to one of 8 screen directions. */
export function dirFromWorld(dx:number,dy:number):Dir8{
  const sx=dx-dy, sy=(dx+dy)/2;               // iso projection
  const a=Math.atan2(sy,sx);                  // 0=screen right(E), +pi/2=screen down(S)
  const k=Math.round(a/(Math.PI/4));          // -4..4, E=0,SE=1,S=2,SW=3,W=4/-4,NW=-3,N=-2,NE=-1
  const map=[6,7,0,1,2,3,4,5]; // index by ((k%8)+8)%8 : E,SE,S,SW,W,NW,N,NE
  return map[((k%8)+8)%8] as Dir8;
}

export async function loadAtlas(url='sprites/player.json'):Promise<LoadedAtlas|null>{
  try{
    const r=await fetch(url,{cache:'no-cache'}); if(!r.ok) return null;
    const ct=r.headers.get('content-type')||''; if(ct.includes('text/html')) return null; // SPA fallback => no atlas
    const atlas=await r.json() as Atlas; const err=validateAtlas(atlas); if(err){ console.warn('[sprites] atlas rejected:',err); return null; }
    const wantLayers=typeof location!=='undefined'&&/[?&]layers=1/.test(location.search); // modular layer sheets are only loaded on demand (memory); the flat composite is the default
    const base=url.slice(0,url.lastIndexOf('/')+1); const images:LoadedAtlas['images']={}; const layerImages:LoadedAtlas['layerImages']={};
    const loadImg=(src:string,a:AnimDef,what:string)=>new Promise<HTMLImageElement>((res,rej)=>{ const im=new Image(); im.onload=()=>{ if(im.naturalWidth<atlas.frame.w*a.frames||im.naturalHeight<atlas.frame.h*a.dirs) rej(new Error(what+' image smaller than frames*dirs*frame size')); else res(im); }; im.onerror=()=>rej(new Error('failed '+src)); im.src=base+src; });
    await Promise.all(Object.entries(atlas.anims).map(async([n,a])=>{ const d=a!; if(wantLayers&&d.layers&&d.order){ layerImages[n as AnimName]=await Promise.all(d.layers.map(l=>loadImg(l.image,d,n+'/'+l.name))); } else images[n as AnimName]=await loadImg(d.image,d,n); }));
    return { base, atlas, images, layerImages };
  }catch(e){ console.warn('[sprites] falling back to procedural character:',e); return null; }
}
export function validateAtlas(a:Atlas):string|null{
  if(!a||a.version!==1) return 'version must be 1'; if(!a.frame||a.frame.w<=0||a.frame.h<=0) return 'bad frame size'; if(!a.anchor) return 'no anchor';
  for(const n of REQUIRED_ANIMS){ const d=a.anims?.[n]; if(!d){ if(n==='idle'||n==='run') return 'missing anim '+n; continue; } if(!d.image||d.frames<1||d.fps<=0||(d.dirs!==5&&d.dirs!==8)) return 'bad anim '+n; }
  return null;
}

/** Per-frame animation state chosen from game state. The sim stays authoritative: playback is time-scaled/offset so the
 *  anim's hitFrame is shown exactly when the sim applies the hit (auto-attack: same tick; cast: when windup ends; dodge: spans COMBAT.dodge.time). */
export type ImpactKind='attack'|'cast';
interface PlayState { anim:AnimName; f:number; nf:number; frac:number; dir:Dir8; }
/** Continuous direction index in the iso ring (E=0,SE=1,S=2,SW=3,W=4,NW=5,N=6,NE=7), from a world vector. */
function ringPos(dx:number,dy:number):number{ const sx=dx-dy, sy=(dx+dy)/2; return Math.atan2(sy,sx)/(Math.PI/4); }
/** inputMove is SCREEN-space (W = screen up). Same transform as sim's ISO.vec, so sprite facing follows the on-screen movement direction (W/S/A/D face N/S/W/E; the 8 baked directions are screen-aligned). */
const screenToWorld=(dx:number,dy:number)=>{ const a=dx,b=dy*2; return { x:(a+b)/2, y:(b-a)/2 }; };
const ringToDir=(k:number):Dir8=>((((k-2)%8)+8)%8) as Dir8;
const ringDiff=(a:number,b:number)=>{ let d=((a-b)%8+8)%8; return d>4?d-8:d; };
export class PlayerAnimator {
  /** current frame index + the anim's hitFrame (-1 if none); `atHitFrame` is true on the frame where damage/effect should visually land. */
  frame=0; frac=0; hitFrame=-1; get atHitFrame(){ return this.hitFrame>=0&&this.frame===this.hitFrame; }
  anim:AnimName='idle'; t=0; dir:Dir8=0; impacts=0; lastImpact:{kind:ImpactKind;anim:AnimName;frame:number;hitFrame:number}|null=null; onImpact?:(k:ImpactKind)=>void;
  /** smooth turning: `dir` steps one 45deg notch at a time toward the target (with hysteresis) and each notch / anim change cross-fades from the previous sprite */
  private tk=2; private dk=2; private stepT=0; private prev:{anim:AnimName;t:number;dir:Dir8}|null=null; private fade=1; private fadeDur=.1; private prevAnim:AnimName='idle'; private prevT=0; private prevDir:Dir8=0;
  private lastHp=-1; private hitT=0; private atkT=0; private followT=0; private lastAtkCd=0; private lastAbSum=0; private wasCast=false; private lastDown=false;
  constructor(public loaded:LoadedAtlas){}
  private def(n:AnimName){ const a=this.loaded.atlas.anims; return a[n]?a[n]!:undefined; }
  private resolve(n:AnimName):AnimName{ const a=this.loaded.atlas.anims; return a[n]?n:(FALLBACK[n].find(k=>a[k])||'idle'); }
  /** frame position of anim `n` at time t: integer frame, next frame and the sub-frame fraction (0 when the anim does not blend) */
  private pos(n:AnimName,t:number):{f:number;nf:number;frac:number}{ const d=this.def(this.resolve(n)); if(!d) return {f:0,nf:0,frac:0}; const p=Math.max(0,t)*d.fps+1e-6; let f=Math.floor(p); let frac=p-f;
    if(d.loop){ f=f%d.frames; } else if(f>=d.frames-1){ f=d.frames-1; frac=0; }
    let nf=d.loop?(f+1)%d.frames:Math.min(f+1,d.frames-1); if(!d.blend||nf===f||frac<.004) frac=0; if(frac>.996){ frac=0; f=nf; } return {f,nf,frac}; }
  private sample(){ const d=this.def(this.resolve(this.anim)); if(!d){ this.frame=0; this.frac=0; this.hitFrame=-1; return; } const p=this.pos(this.anim,this.t); this.frame=p.f; this.frac=p.frac; this.hitFrame=d.hitFrame??-1; }
  private impact(k:ImpactKind,n:AnimName){ this.impacts++; this.sample(); this.lastImpact={kind:k,anim:this.anim,frame:this.frame,hitFrame:this.hitFrame}; this.onImpact?.(k); }
  update(g:{hp:number;downed:boolean;moving:boolean;dodgeT:number;cast:any;atkCd:number;abCd?:number[];face:number;inputMove:{x:number;y:number};dodgeDx:number;dodgeDy:number},dt:number){
    const L=this.loaded.atlas.anims; const dur=(n:AnimName)=>{ const d=L[n]; return d?d.frames/d.fps:0; }; const hitTime=(n:AnimName)=>{ const d=L[n]; return d&&d.hitFrame!=null?d.hitFrame/d.fps:0; };
    if(this.lastHp>=0&&g.hp<this.lastHp-0.5&&!g.downed) this.hitT=dur('hit')||.3; this.lastHp=g.hp; this.hitT=Math.max(0,this.hitT-dt);
    // auto-attack: the sim deals damage on the tick atkCd is set, so start playback AT the hit frame (anticipation is skipped; follow-through plays)
    let attackStart=false; if(g.atkCd>this.lastAtkCd+0.01&&!g.downed){ attackStart=true; this.atkT=Math.max(.001,dur('attack')-hitTime('attack')); } this.lastAtkCd=g.atkCd; this.atkT=Math.max(0,this.atkT-dt);
    // ability cast: playback is scaled so hitFrame lands exactly when windup completes (sim executes the ability); then follow-through at normal speed
    const abSum=(g.abCd||[]).reduce((a,b)=>a+b,0); const executed=this.wasCast&&!g.cast&&abSum>this.lastAbSum+0.01&&!g.downed&&g.dodgeT<=0; this.lastAbSum=abSum; this.wasCast=!!g.cast;
    if(executed) this.followT=Math.max(.001,dur('cast')-hitTime('cast')); this.followT=Math.max(0,this.followT-dt);
    if(g.cast) this.followT=0;
    let next:AnimName='idle'; let driven:number|null=null;
    if(g.downed) next='down'; else if(g.dodgeT>0){ next='dodge'; const dd=L.dodge; if(dd) driven=Math.min(1,Math.max(0,1-g.dodgeT/COMBAT.dodge.time))*dd.frames/dd.fps*0.9999; }
    else if(g.cast){ next='cast'; const c=g.cast, w=Math.max(.001,c.ab?.windup??.2); driven=Math.min(1,c.t/w)*hitTime('cast'); }
    else if(this.followT>0) next='cast'; else if(this.hitT>0) next='hit'; else if(this.atkT>0) next='attack'; else if(g.moving) next='run';
    // remember what was on screen so the change can be cross-faded instead of popping
    const oldAnim=this.anim, oldT=this.t, oldDir=this.dir;
    // facing: target direction with hysteresis; displayed direction walks the ring one notch at a time (snaps for dodge / down)
    const fx=next==='dodge'?g.dodgeDx:g.moving&&next==='run'?screenToWorld(g.inputMove.x,g.inputMove.y).x:Math.cos(g.face), fy=next==='dodge'?g.dodgeDy:g.moving&&next==='run'?screenToWorld(g.inputMove.x,g.inputMove.y).y:Math.sin(g.face);
    if(Math.hypot(fx,fy)>0.05){ const kf=ringPos(fx,fy); if(Math.abs(ringDiff(kf,this.tk))>0.5+0.18||this.tk<0) this.tk=((Math.round(kf)%8)+8)%8; }
    const snap=next==='dodge'||next==='down'||(g.dodgeT>0);
    if(snap){ this.dk=this.tk; this.stepT=0; } else if(this.dk!==this.tk){ this.stepT-=dt; if(this.stepT<=0){ const d=ringDiff(this.tk,this.dk); const bigTurn=Math.abs(d)>=3; this.dk=(((this.dk+(d>0?1:-1))%8)+8)%8; this.stepT=(next==='attack'||next==='cast'?.035:.05)*(bigTurn?.8:1); } } else this.stepT=0;
    this.dir=ringToDir(this.dk);
    if(next!==this.anim){ this.anim=next; this.t=0; } else this.t+=dt;
    if(driven!=null) this.t=driven; else if(executed&&next==='cast') this.t=hitTime('cast'); else if(attackStart&&next==='attack') this.t=hitTime('attack');
    if(g.downed&&!this.lastDown){ this.anim='down'; this.t=0; } this.lastDown=g.downed;
    const animChanged=this.anim!==oldAnim, dirChanged=this.dir!==oldDir;
    if(this.fade<1){ this.fade=Math.min(1,this.fade+dt/this.fadeDur); if(this.prev) this.prev.t+=dt; }
    if(animChanged||dirChanged){ this.prev={anim:oldAnim,t:oldT+dt,dir:oldDir}; this.fade=0; this.fadeDur=this.anim==='dodge'?.03:this.anim==='down'?.08:animChanged?(this.anim==='hit'?.04:this.anim==='attack'||this.anim==='cast'?.07:.13):.07; if(this.resolve(oldAnim)===this.resolve(this.anim)&&!dirChanged) this.fade=1; }
    this.sample();
    if(executed&&next==='cast') this.impact('cast','cast'); else if(attackStart&&next==='attack') this.impact('attack','attack');
  }
  // ---- body variants: per-slot alternate layer sets composited into one flat sheet per anim (lazy, cached, memory-bounded) ----
  private bodySig='base'; private bodyCur:Partial<Record<AnimName,HTMLCanvasElement>>|null=null; private bodyCache=new Map<string,Partial<Record<AnimName,HTMLCanvasElement>>>();
  /** signature -> true once every anim has been composited */ bodyReady=new Set<string>(); bodyStats={composites:0,ms:0,loaded:0};
  get bodyKey(){ return this.bodySig; }
  /** Select which variant each body slot uses. Cheap to call every frame (no-ops while unchanged). All-base uses the original flat sheets. */
  setBody(b:Record<string,Variant>){
    const names=this.loaded.atlas.anims.idle?.layers?.map(l=>l.name); if(!names||!this.loaded.base) return;
    const sig=names.map(n=>b[n]||'base').join(','); if(sig===this.bodySig) return; this.bodySig=sig;
    if(names.every(n=>(b[n]||'base')==='base')){ this.bodyCur=null; return; }
    let c=this.bodyCache.get(sig);
    if(!c){ c={}; this.bodyCache.set(sig,c); while(this.bodyCache.size>2){ const k=this.bodyCache.keys().next().value as string; if(k===sig) break; this.bodyCache.delete(k); } void this.composeBody(sig,names,names.map(n=>b[n]||'base'),c); }
    this.bodyCur=c;
  }
  private async composeBody(sig:string,names:string[],vars:string[],out:Partial<Record<AnimName,HTMLCanvasElement>>){
    const A=this.loaded.atlas, base=this.loaded.base!, W=A.frame.w, H=A.frame.h; const t0=performance.now();
    const order:AnimName[]=['idle','run','attack','dodge','cast','hit','down'];
    const load=(src:string)=>new Promise<HTMLImageElement|null>(res=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=()=>res(null); im.src=src; });
    for(const an of order){
      const d=A.anims[an]; if(!d||!d.layers||!d.order) continue; if(this.bodySig!==sig&&!this.bodyCache.has(sig)) return;
      const ims=await Promise.all(d.layers.map(async(l,i)=>{ const v=vars[names.indexOf(l.name)]||'base'; let im:HTMLImageElement|null=null;
        if(v!=='base'){ const ext=l.image.slice(l.image.lastIndexOf('.')); im=await load(`${base}v/${v}/${an}_${l.name}${ext}`); if(im) this.bodyStats.loaded++; }
        return im||await load(base+l.image); }));
      if(ims.some(i=>!i)) continue;
      const cv=document.createElement('canvas'); cv.width=W*d.frames; cv.height=H*d.dirs; const x=cv.getContext('2d')!;
      for(let row=0;row<d.dirs;row++) for(let f=0;f<d.frames;f++) for(const li of d.order[row][f]) x.drawImage(ims[li]!,f*W,row*H,W,H,f*W,row*H,W,H);
      out[an]=cv; this.bodyStats.composites++;
      await new Promise(r=>setTimeout(r,0));
    }
    this.bodyStats.ms=Math.round(performance.now()-t0); this.bodyReady.add(sig);
  }
  private blit(c:CanvasRenderingContext2D,st:PlayState,alpha:number,s:number){
    const a=this.loaded.atlas; const an=this.resolve(st.anim); const bi=this.bodyCur?.[an]; const d=a.anims[an], im:CanvasImageSource|undefined=bi||this.loaded.images[an], lay=bi?undefined:this.loaded.layerImages[an]; if(!d||(!im&&!lay)||alpha<=0) return;
    let row:number=st.dir, mirror=false; if(d.dirs===5&&st.dir>4){ row=8-st.dir; mirror=true; } // SE(7)->SW(1), E(6)->W(2), NE(5)->NW(3)
    const W=a.frame.w,H=a.frame.h; c.save(); if(mirror) c.scale(-1,1);
    const one=(f:number,al:number)=>{ c.globalAlpha=al; if(lay&&d.order){ for(const li of d.order[row][f]) c.drawImage(lay[li],f*W,row*H,W,H,-a.anchor.x*s,-a.anchor.y*s,W*s,H*s); } else c.drawImage(im as CanvasImageSource,f*W,row*H,W,H,-a.anchor.x*s,-a.anchor.y*s,W*s,H*s); };
    const g0=c.globalAlpha; one(st.f,g0*alpha); if(st.frac>0) one(st.nf,g0*alpha*st.frac); c.restore();
  }
  /** Draw with feet at (x,y) in screen px. unit = TW/64. Returns false if anim missing (caller falls back). */
  draw(c:CanvasRenderingContext2D,x:number,y:number,unit:number):boolean{
    const a=this.loaded.atlas; const an=this.resolve(this.anim);
    const bi=this.bodyCur?.[an]; const d=a.anims[an], im:CanvasImageSource|undefined=bi||this.loaded.images[an], lay=bi?undefined:this.loaded.layerImages[an]; if(!d||(!im&&!lay)) return false;
    this.sample(); const W=a.frame.w,H=a.frame.h,s=unit*a.scale*(48/ (H*0.6)) ; // normalise: character ~60% of cell height ≈ 48 procedural px
    c.save(); c.translate(x,y); c.imageSmoothingEnabled=true; c.imageSmoothingQuality='high';
    const cur:PlayState={anim:this.anim,f:this.frame,nf:0,frac:this.frac,dir:this.dir}; { const p=this.pos(this.anim,this.t); cur.nf=p.nf; }
    if(this.prev&&this.fade<1){ const pp=this.pos(this.prev.anim,this.prev.t); this.blit(c,{anim:this.prev.anim,f:pp.f,nf:pp.nf,frac:pp.frac,dir:this.prev.dir},1,s); this.blit(c,cur,this.fade*this.fade*(3-2*this.fade),s); }
    else this.blit(c,cur,1,s);
    c.restore(); return true;
  }
}
