import { COMBAT } from './config';
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

export interface LoadedAtlas { atlas:Atlas; images:Partial<Record<AnimName,HTMLImageElement>>; layerImages:Partial<Record<AnimName,HTMLImageElement[]>>; }
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
    return { atlas, images, layerImages };
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
export class PlayerAnimator {
  /** current frame index + the anim's hitFrame (-1 if none); `atHitFrame` is true on the frame where damage/effect should visually land. */
  frame=0; hitFrame=-1; get atHitFrame(){ return this.hitFrame>=0&&this.frame===this.hitFrame; }
  anim:AnimName='idle'; t=0; dir:Dir8=0; impacts=0; lastImpact:{kind:ImpactKind;anim:AnimName;frame:number;hitFrame:number}|null=null; onImpact?:(k:ImpactKind)=>void;
  private lastHp=-1; private hitT=0; private atkT=0; private followT=0; private lastAtkCd=0; private lastAbSum=0; private wasCast=false; private lastDown=false;
  constructor(public loaded:LoadedAtlas){}
  private def(n:AnimName){ const a=this.loaded.atlas.anims; return a[n]?a[n]!:undefined; }
  private resolve(n:AnimName):AnimName{ const a=this.loaded.atlas.anims; return a[n]?n:(FALLBACK[n].find(k=>a[k])||'idle'); }
  private sample(){ const d=this.def(this.resolve(this.anim)); if(!d){ this.frame=0; this.hitFrame=-1; return; } let f=Math.floor(this.t*d.fps+1e-6); f=d.loop?f%d.frames:Math.max(0,Math.min(f,d.frames-1)); this.frame=f; this.hitFrame=d.hitFrame??-1; }
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
    if(next!==this.anim){ this.anim=next; this.t=0; } else this.t+=dt;
    if(driven!=null) this.t=driven; else if(executed&&next==='cast') this.t=hitTime('cast'); else if(attackStart&&next==='attack') this.t=hitTime('attack');
    if(g.downed&&!this.lastDown){ this.anim='down'; this.t=0; } this.lastDown=g.downed;
    const fx=next==='dodge'?g.dodgeDx:g.moving&&next==='run'?g.inputMove.x:Math.cos(g.face), fy=next==='dodge'?g.dodgeDy:g.moving&&next==='run'?g.inputMove.y:Math.sin(g.face);
    if(Math.hypot(fx,fy)>0.05) this.dir=dirFromWorld(fx,fy);
    this.sample();
    if(executed&&next==='cast') this.impact('cast','cast'); else if(attackStart&&next==='attack') this.impact('attack','attack');
  }
  /** Draw with feet at (x,y) in screen px. unit = TW/64. Returns false if anim missing (caller falls back). */
  draw(c:CanvasRenderingContext2D,x:number,y:number,unit:number):boolean{
    const a=this.loaded.atlas; const an=this.resolve(this.anim);
    const d=a.anims[an], im=this.loaded.images[an], lay=this.loaded.layerImages[an]; if(!d||(!im&&!lay)) return false;
    this.sample(); const f=this.frame;
    let row:number=this.dir, mirror=false; if(d.dirs===5&&this.dir>4){ row=8-this.dir; mirror=true; } // SE(7)->SW(1), E(6)->W(2), NE(5)->NW(3)
    const W=a.frame.w,H=a.frame.h,s=unit*a.scale*(48/ (H*0.6)) ; // normalise: character ~60% of cell height ≈ 48 procedural px
    c.save(); c.translate(x,y); if(mirror) c.scale(-1,1); c.imageSmoothingEnabled=true;
    if(lay&&d.order){ for(const li of d.order[row][f]) c.drawImage(lay[li],f*W,row*H,W,H,-a.anchor.x*s,-a.anchor.y*s,W*s,H*s); }
    else c.drawImage(im!,f*W,row*H,W,H,-a.anchor.x*s,-a.anchor.y*s,W*s,H*s); c.restore(); return true;
  }
}
