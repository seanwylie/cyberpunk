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
}
export interface Atlas {
  version:1;
  frame:{ w:number; h:number };         // cell size in source pixels (e.g. 192x192)
  anchor:{ x:number; y:number };        // foot pivot inside the cell, source px (e.g. 96,160)
  scale:number;                         // draw scale relative to the procedural character height (1 = same ~48 world px at TW=64)
  anims:Partial<Record<AnimName,AnimDef>>;
}

export interface LoadedAtlas { atlas:Atlas; images:Partial<Record<AnimName,HTMLImageElement>>; }

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
    const base=url.slice(0,url.lastIndexOf('/')+1); const images:LoadedAtlas['images']={};
    await Promise.all(Object.entries(atlas.anims).map(([n,a])=>new Promise<void>((res,rej)=>{ const im=new Image(); im.onload=()=>{ const need=a!.dirs; if(im.naturalWidth<atlas.frame.w*a!.frames||im.naturalHeight<atlas.frame.h*need) rej(new Error(n+' image smaller than frames*dirs*frame size')); else { images[n as AnimName]=im; res(); } }; im.onerror=()=>rej(new Error('failed '+a!.image)); im.src=base+a!.image; })));
    return { atlas, images };
  }catch(e){ console.warn('[sprites] falling back to procedural character:',e); return null; }
}
export function validateAtlas(a:Atlas):string|null{
  if(!a||a.version!==1) return 'version must be 1'; if(!a.frame||a.frame.w<=0||a.frame.h<=0) return 'bad frame size'; if(!a.anchor) return 'no anchor';
  for(const n of REQUIRED_ANIMS){ const d=a.anims?.[n]; if(!d) return 'missing anim '+n; if(!d.image||d.frames<1||d.fps<=0||(d.dirs!==5&&d.dirs!==8)) return 'bad anim '+n; }
  return null;
}

/** Per-frame animation state chosen from game state (no sim changes needed). */
export class PlayerAnimator {
  anim:AnimName='idle'; t=0; dir:Dir8=0; private lastHp=-1; private hitT=0; private lastDown=false; private atkT=0; private lastCastIdx=-1; private lastAtkCd=0;
  constructor(public loaded:LoadedAtlas){}
  update(g:{hp:number;downed:boolean;moving:boolean;dodgeT:number;cast:any;atkCd:number;face:number;inputMove:{x:number;y:number};dodgeDx:number;dodgeDy:number},dt:number){
    const L=this.loaded.atlas.anims; let next:AnimName='idle';
    if(this.lastHp>=0&&g.hp<this.lastHp-0.5) this.hitT=(1/(L.hit?.fps||12))*(L.hit?.frames||4); this.lastHp=g.hp; this.hitT=Math.max(0,this.hitT-dt);
    if(g.atkCd>this.lastAtkCd+0.01) this.atkT=(L.attack?.frames||6)/(L.attack?.fps||16); this.lastAtkCd=g.atkCd; this.atkT=Math.max(0,this.atkT-dt);
    if(g.downed) next='down'; else if(g.dodgeT>0) next='dodge'; else if(g.cast) next='cast'; else if(this.hitT>0) next='hit'; else if(this.atkT>0) next='attack'; else if(g.moving) next='run';
    if(next!==this.anim){ this.anim=next; this.t=0; } else this.t+=dt;
    const fx=next==='dodge'?g.dodgeDx:g.moving&&next==='run'?g.inputMove.x:Math.cos(g.face), fy=next==='dodge'?g.dodgeDy:g.moving&&next==='run'?g.inputMove.y:Math.sin(g.face);
    if(Math.hypot(fx,fy)>0.05) this.dir=dirFromWorld(fx,fy);
  }
  /** Draw with feet at (x,y) in screen px. unit = TW/64. Returns false if anim missing (caller falls back). */
  draw(c:CanvasRenderingContext2D,x:number,y:number,unit:number):boolean{
    const a=this.loaded.atlas, d=a.anims[this.anim], im=this.loaded.images[this.anim]; if(!d||!im) return false;
    let f=Math.floor(this.t*d.fps); f=d.loop?f%d.frames:Math.min(f,d.frames-1);
    let row:number=this.dir, mirror=false; if(d.dirs===5&&this.dir>4){ row=8-this.dir; mirror=true; } // SE(7)->SW(1), E(6)->W(2), NE(5)->NW(3)
    const W=a.frame.w,H=a.frame.h,s=unit*a.scale*(48/ (H*0.6)) ; // normalise: character ~60% of cell height ≈ 48 procedural px
    c.save(); c.translate(x,y); if(mirror) c.scale(-1,1); c.imageSmoothingEnabled=true;
    c.drawImage(im,f*W,row*H,W,H,-a.anchor.x*s,-a.anchor.y*s,W*s,H*s); c.restore(); return true;
  }
}
