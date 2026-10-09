import { Game, En } from './sim';
import { ENEMIES, MFR, RARITY_COLOR, COMBAT, ITEM_BY_ID, CHIPS, Slot, ABILITIES } from './config';
import { installedLayout } from './build';
import { PlayerAnimator, loadAtlas } from './sprites';
import { Env, makeEnv, S as TS, FLOOR_VARIANTS } from './envtex';
import type { Level } from './level';
import { TownArt, GP, decorDepth } from './town';
import { Organic } from './organic';

export const PAL = { concrete:'#7a7c78', soot:'#1b1c1e', bone:'#cfc6b0', oxide:'#8f3b2e', metal:'#6b5a4a', slate:'#4f6578', olive:'#6b7035', skin:'#b29b84' };
const ZCOL:Record<string,[string,string]> = { yard:['#7b7d79','#727470'], proc:['#6c6e6b','#646663'], junction:['#74777b','#6c6f73'], boss:['#5f6163','#57595b'], salvage:['#6d6b63','#656359'], corridor:['#696b69','#616361'], passage:['#55585b','#4d5053'], town:['#7c7b75','#74736d'], none:['#222','#222'] };
const hash=(x:number,y:number)=>{ let h=(x*374761393+y*668265263)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967295; };

export class Renderer {
  ctx:CanvasRenderingContext2D; w=0; h=0; dpr=1; TW=64; baseTW=64; camx=0; camy=0; shake=0;
  anim:PlayerAnimator|null=null; lastT=0; env:Env|null=null; town:TownArt|null=null; org=new Organic(); private wallCache=new WeakMap<Level,Map<number,{style:'concrete'|'steel';v:number;zone:string}>>();
  constructor(public canvas:HTMLCanvasElement, public g:Game){ this.ctx=canvas.getContext('2d')!; this.env=new URLSearchParams(location.search).has('flat')?null:makeEnv(); this.env?.warmAsync(['yard','town']); if(this.env) this.town=new TownArt(); loadAtlas().then(l=>{ if(l){ this.anim=new PlayerAnimator(l); this.anim.onImpact=k=>this.impact(k); } }); }
  resize(){ this.dpr=Math.min(window.devicePixelRatio||1,2); const w=window.innerWidth,h=window.innerHeight; this.canvas.width=w*this.dpr; this.canvas.height=h*this.dpr; this.canvas.style.width=w+'px'; this.canvas.style.height=h+'px'; this.w=w; this.h=h; this.TW=this.baseTW=Math.max(40,Math.min(92,Math.min(h/8.2,w/13))); }
  // projection
  sx(x:number,y:number){ return (x-y)*this.TW/2 + this.w/2 - this.camx; }
  sy(x:number,y:number,z=0){ return (x+y)*this.TW/4 + this.h/2 - this.camy - z*this.TW/2; }
  /** Impact emphasis (screen shake) fired exactly at the sim's hit time == sprite hitFrame. Procedural fallback uses the same edge detector. */
  impact(k:'attack'|'cast'){ if(this.g.save.settings.reducedFx) return; this.shake=Math.max(this.shake,k==='cast'?.55:.2); }
  private fbAtk=0; private fbAb=0; private fbCast=false;
  private fallbackImpacts(){ const g=this.g; const ab=g.abCd.reduce((a:number,b:number)=>a+b,0); if(g.atkCd>this.fbAtk+.01) this.impact('attack'); if(this.fbCast&&!g.cast&&ab>this.fbAb+.01) this.impact('cast'); this.fbAtk=g.atkCd; this.fbAb=ab; this.fbCast=!!g.cast; }
  screenToWorld(px:number,py:number){ const a=(px-this.w/2+this.camx)/(this.TW/2), b=(py-this.h/2+this.camy)/(this.TW/4); return { x:(a+b)/2, y:(b-a)/2 }; }
  screenVecToWorld(dx:number,dy:number){ const a=dx/(this.TW/2), b=dy/(this.TW/4); return { x:(a+b)/2, y:(b-a)/2 }; }

  draw(dt:number){
    const g=this.g, c=this.ctx; this.TW=this.baseTW*(g.level.kind==='town'?.68:1); c.setTransform(this.dpr,0,0,this.dpr,0,0); if(!this.anim) this.fallbackImpacts(); const sh=this.shake>0?this.shake*7:0; if(sh) c.translate((Math.random()*2-1)*sh,(Math.random()*2-1)*sh);
    const tx=(g.px-g.py)*this.TW/2, ty=(g.px+g.py)*this.TW/4; this.camx+= (tx-this.camx)*Math.min(1,dt*8); this.camy+=(ty-this.camy)*Math.min(1,dt*8);
    if(this.shake>0) this.shake=Math.max(0,this.shake-dt*3);
    c.fillStyle=PAL.soot; c.fillRect(0,0,this.w,this.h);
    this.drawFloor(); this.drawWorld(); this.drawOverlay();
  }
  tile(x:number,y:number,col:string){ const c=this.ctx; const a=this.sx(x,y), b=this.sy(x,y); const hw=this.TW/2, hh=this.TW/4; c.fillStyle=col; c.beginPath(); c.moveTo(a,b); c.lineTo(a+hw,b+hh); c.lineTo(a,b+2*hh); c.lineTo(a-hw,b+hh); c.closePath(); c.fill(); }
  drawFloor(){
    const g=this.g, L=g.level, c=this.ctx; if(L.kind==='town'&&this.town?.ready){ this.drawTownGround(); return; }
    const R=Math.ceil(Math.max(this.w,this.h)/this.TW*1.1)+3; const x0=Math.max(0,Math.floor(g.px-R)), x1=Math.min(L.w-1,Math.ceil(g.px+R)), y0=Math.max(0,Math.floor(g.py-R)), y1=Math.min(L.h-1,Math.ceil(g.py+R));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){ const i=y*L.w+x; if(L.solid[i]&&!this.isDoorTile(x,y)) continue; const z=L.zoneNames[L.zone[i]]; const pal=ZCOL[z]||ZCOL.yard; const hv=hash(x,y); if(this.env){ this.floorTile(x,y,z,i); continue; } this.tile(x,y,pal[(x+y)&1]); if(hv>.86){ c.fillStyle='rgba(20,20,22,.16)'; const a=this.sx(x+.5,y+.5), b=this.sy(x+.5,y+.5); c.beginPath(); c.ellipse(a,b,this.TW*.12*(.5+hv),this.TW*.05*(.5+hv),0,0,7); c.fill(); }
      if(hv<.04){ c.strokeStyle='rgba(30,30,30,.25)'; c.lineWidth=1; c.beginPath(); c.moveTo(this.sx(x+.2,y+.3),this.sy(x+.2,y+.3)); c.lineTo(this.sx(x+.7,y+.8),this.sy(x+.7,y+.8)); c.stroke(); }
      if((z==='proc')&&(x%8===0)&&hv>.2){ this.tile(x,y,'rgba(143,59,46,.10)'); } }
    if(this.env){ this.drawDecals(); this.org.drawFloorOverlay(this,L); }
    for(const cp of L.checkpoints){ const done=this.g.mode==='run'&&(this.g.inst?.reached||[]).includes(cp.id); const cur=this.g.mode==='run'&&this.g.inst?.checkpoint.id===cp.id; this.ring(cp.x,cp.y,1.1,done?'#8fae7f':PAL.bone,done?.9:.6,true); if(cur) this.ring(cp.x,cp.y,1.5+.12*Math.sin(this.g.time*4),'#8fae7f',.8); }
    if(g.mode==='run'&&g.inst){ const f=g.inst.flags; if(!f.controller){ const it=L.interacts.find(i=>i.id==='controller')!; this.ring(it.x,it.y,.9,'#d8d2bf',.45,true); } }
  }
  // ---- textured environment (see envtex.ts); every method is only called when this.env is set ----
  // Baked blits: each (texture, affine, shade) is rasterised once at the current device scale into a small canvas, then drawn 1:1 per frame
  // (no per-frame affine resampling of large textures; this is what keeps phones fast). Cache is dropped when TW/dpr change.
  private bakeKey=''; private bakes=new Map<string,{cv:HTMLCanvasElement;mx:number;my:number;w:number;h:number}>(); private ids=new WeakMap<HTMLCanvasElement,number>(); private idN=0;
  private tid(img:HTMLCanvasElement){ let i=this.ids.get(img); if(!i){ i=++this.idN; this.ids.set(img,i); } return i; }
  bakeBlit(img:HTMLCanvasElement,sx0:number,sy0:number,sw:number,sh:number,a:number,b:number,cc:number,d:number,ox:number,oy:number,shade:number,pad=.5){
    const bk=this.TW.toFixed(2)+'|'+this.dpr; if(bk!==this.bakeKey){ this.bakeKey=bk; this.bakes.clear(); }
    const key=`${this.tid(img)}|${sx0|0},${sy0|0},${sw|0},${sh|0}|${a.toFixed(3)},${b.toFixed(3)},${cc.toFixed(3)},${d.toFixed(3)}|${shade}`; let e=this.bakes.get(key);
    if(!e){ const xs=[0,sw*a,sh*cc,sw*a+sh*cc], ys=[0,sw*b,sh*d,sw*b+sh*d]; const mnx=Math.min(...xs)-1, mxx=Math.max(...xs)+1, mny=Math.min(...ys)-1, mxy=Math.max(...ys)+1; const w=Math.ceil(mxx-mnx), h=Math.ceil(mxy-mny);
      const cv=document.createElement('canvas'); cv.width=Math.ceil(w*this.dpr); cv.height=Math.ceil(h*this.dpr); const x=cv.getContext('2d')!; x.scale(this.dpr,this.dpr); x.translate(-mnx,-mny); x.transform(a,b,cc,d,0,0); x.drawImage(img,sx0,sy0,sw,sh,-pad,-pad,sw+pad*2,sh+pad*2);
      if(shade>0){ x.globalCompositeOperation='source-atop'; x.fillStyle=`rgba(6,6,9,${shade})`; x.fillRect(-pad,-pad,sw+pad*2,sh+pad*2); } e={cv,mx:mnx,my:mny,w,h}; this.bakes.set(key,e); }
    const q=this.dpr; this.ctx.drawImage(e.cv,Math.round((ox+e.mx)*q)/q,Math.round((oy+e.my)*q)/q,e.w,e.h); }
  private isoTex(img:HTMLCanvasElement,x:number,y:number,z:number,w:number,d:number){ const k=this.TW/TS; this.bakeBlit(img,0,0,TS,TS,w*k/2,w*k/4,-d*k/2,d*k/4,this.sx(x,y),this.sy(x,y,z),0); }
  /** +y facing face (screen-left) */
  private faceY(img:HTMLCanvasElement,x:number,y:number,w:number,d:number,h:number,shade:number){ const k=this.TW/TS; const sw=Math.min(TS,w*TS), sh=Math.min(img.height,h*TS); this.bakeBlit(img,0,img.height-sh,sw,sh,k/2,k/4,0,k/2,this.sx(x,y+d),this.sy(x,y+d,h),shade,0); }
  /** +x facing face (screen-right) */
  private faceX(img:HTMLCanvasElement,x:number,y:number,w:number,d:number,h:number,shade:number){ const k=this.TW/TS; const sw=Math.min(TS,d*TS), sh=Math.min(img.height,h*TS); this.bakeBlit(img,0,img.height-sh,sw,sh,k/2,-k/4,0,k/2,this.sx(x+w,y+d),this.sy(x+w,y+d,h),shade,0); }
  private texBox(x:number,y:number,w:number,d:number,h:number,side:HTMLCanvasElement,top:HTMLCanvasElement,sl=.1,sr=.34){ this.faceY(side,x,y,w,d,h,sl); this.faceX(side,x,y,w,d,h,sr); this.isoTex2(top,x,y,h,w,d); }
  private isoTex2(img:HTMLCanvasElement,x:number,y:number,z:number,w:number,d:number){ this.isoTex(img,x,y,z,w,d); }
  floorTile(x:number,y:number,zone:string,i:number){ const e=this.env!, L=this.g.level, W=L.w; const hv=hash(x*7+3,y*3+1); const v=[0,0,0,0,0,0,1,2,3,4,0,5][(hv*12)|0];
    this.isoTex(e.floor(zone,v),x,y,0,1,1);
    const sol=(xx:number,yy:number)=>xx<0||yy<0||xx>=W||yy>=L.h||!!L.solid[yy*W+xx]; if(sol(x-1,y)) this.isoTex(e.ao(0),x,y,0,1,1); if(sol(x+1,y)) this.isoTex(e.ao(1),x,y,0,1,1); if(sol(x,y-1)) this.isoTex(e.ao(2),x,y,0,1,1); if(sol(x,y+1)) this.isoTex(e.ao(3),x,y,0,1,1); void i; }
  private wallInfo(x:number,y:number){ const L=this.g.level; let m=this.wallCache.get(L); if(!m){ m=new Map(); this.wallCache.set(L,m); } const k=y*L.w+x; let r=m.get(k); if(r) return r;
    let zn='yard'; for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){ const nx=x+dx,ny=y+dy; if(nx>=0&&ny>=0&&nx<L.w&&ny<L.h&&!L.solid[ny*L.w+nx]){ zn=L.zoneNames[L.zone[ny*L.w+nx]]; break; } }
    const style:'concrete'|'steel'=(zn==='yard'||zn==='town'||zn==='corridor'||zn==='salvage')?'concrete':'steel'; const h=hash(x*13+5,y*11+2); const v=h<.4?0:1+Math.min(4,Math.floor((h-.4)/.12)); r={style,v,zone:zn}; m.set(k,r); return r; }
  wallBox(x:number,y:number){ const e=this.env!; const wi=this.wallInfo(x,y); const img=e.wall(wi.style,wi.v,wi.zone); const L=this.g.level; const town=L.kind==='town';
    // varying wall heights (smooth noise) + chamfered/caved-in corners so the room outline stops reading as a rectangle
    const o=this.org.wallShape(L,x,y); if(o.rubble){ this.org.drawRubble(this,x,y,o.rubble); return; }
    const H=o.h; const sh0=town?.62:0; this.faceStretch(img,x,y+1,0,H,.06+sh0,false); this.faceStretch(img,x,y,1,H,.30+sh0,true); this.isoTex(e.cap(wi.style==='steel'?1:0),x,y,H,1,1); if(o.broken&&!town) this.org.drawBreak(this,x,y,H); }
  /** like faceY/faceX but stretches the full texture height to H world units (so walls can vary in height) */
  private faceStretch(img:HTMLCanvasElement,x:number,yy:number,d:number,H:number,shade:number,xface:boolean){ const k=this.TW/TS; const sy=H/ (img.height/TS);
    if(!xface) this.bakeBlit(img,0,0,TS,img.height,k/2,k/4,0,k/2*sy,this.sx(x,yy),this.sy(x,yy,H),shade,0);
    else this.bakeBlit(img,0,0,TS,img.height,k/2,-k/4,0,k/2*sy,this.sx(x+1,yy+d),this.sy(x+1,yy+d,H),shade,0); }
  doorBox(x:number,y:number){ const e=this.env!; const img=e.wall('door',0,'x'); this.faceY(img,x,y,1,1,1.5,.05); this.faceX(img,x,y,1,1,1.5,.3); this.isoTex(e.cap(2),x,y,1.5,1,1); }
  propShadow(x:number,y:number,w:number,d:number){ this.poly([[x-.08,y-.08],[x+w+.12,y-.08],[x+w+.12,y+d+.12],[x-.08,y+d+.12]],'#050506',undefined,.38); }
  texProp(p:{x:number;y:number;kind:string;h:number}){ const e=this.env!, k=p.kind, g=this.g, L=g.level; const hv=hash(p.x*5+1,p.y*9+4); const hh=Math.round(p.h*10)/10;
    if(k==='crate'){ const v=(hv*5)|0; const hc=hh*.9; this.propShadow(p.x+.05,p.y+.05,.9,.9); this.texBox(p.x+.05,p.y+.05,.9,.9,hc,e.crateFace('crate',v,hc),e.top('crate',v)); return; }
    this.propShadow(p.x,p.y,1,1); const v=k==='machine'?((hv*3)|0):0;
    if(k==='conveyor'){ const isC=(xx:number,yy:number)=>L.props.some(q=>q.kind==='conveyor'&&q.x===xx&&q.y===yy); const ax=isC(p.x-1,p.y)||isC(p.x+1,p.y); const side=e.crateFace('conveyor',0,hh); this.faceY(side,p.x,p.y,1,1,hh,.1); this.faceX(side,p.x,p.y,1,1,hh,.34);
      const ph=Math.floor(((g.time*.55)%1)*6)%6; const bt=e.belt(ph), kk=this.TW/TS; if(ax) this.bakeBlit(bt,0,0,TS,TS,kk/2,kk/4,-kk/2,kk/4,this.sx(p.x,p.y),this.sy(p.x,p.y,hh),0); else this.bakeBlit(bt,0,0,TS,TS,-kk/2,kk/4,kk/2,kk/4,this.sx(p.x,p.y),this.sy(p.x,p.y,hh),0); return; }
    this.texBox(p.x+(k==='pillar'?.1:0),p.y+(k==='pillar'?.1:0),k==='pillar'?.8:1,k==='pillar'?.8:1,hh,e.crateFace(k,v,hh),e.top(k,v)); }
  /** large painted floor markings in world space (cheap vector ops under an isometric transform) */
  drawDecals(){ const g=this.g, L=g.level, c=this.ctx; const k=this.TW/2; const near=(x:number,y:number,r:number)=>Math.hypot(g.px-x,g.py-y)<r;
    const iso=()=>{ c.save(); c.transform(k,k/2,-k,k/2,this.sx(0,0),this.sy(0,0)); };
    const dash=(x0:number,y0:number,x1:number,y1:number,col:string,w=.06,d=[.5,.4])=>{ c.strokeStyle=col; c.lineWidth=w; c.setLineDash(d); c.beginPath(); c.moveTo(x0,y0); c.lineTo(x1,y1); c.stroke(); c.setLineDash([]); };
    const stripes=(x:number,y:number,w:number,h:number,al=.4)=>{ c.save(); c.beginPath(); c.rect(x,y,w,h); c.clip(); c.fillStyle=`rgba(20,20,20,${al+.2})`; c.fillRect(x,y,w,h); c.fillStyle=`rgba(176,150,70,${al})`; const st=.35; for(let i=-h;i<w+h;i+=st*2){ c.beginPath(); c.moveTo(x+i,y+h); c.lineTo(x+i+st,y+h); c.lineTo(x+i+st+h,y); c.lineTo(x+i+h,y); c.fill(); } c.restore(); };
    const text=(t:string,x:number,y:number,sz:number,col:string,rot=0)=>{ c.save(); c.translate(x,y); c.rotate(rot); c.font=`bold ${sz}px "Arial Narrow",Impact,sans-serif`; c.textAlign='center'; c.textBaseline='middle'; c.fillStyle=col; c.fillText(t,0,0); c.restore(); };
    if(L.w===88){
      if(near(12,19,22)){ iso(); dash(3,19.5,21,19.5,'rgba(207,198,176,.22)',.07,[.6,.5]); stripes(21,17,.5,5,.3); stripes(22.6,17,.5,5,.3); text('CAUTION',13,22.2,1.15,'rgba(143,59,46,.38)'); text('STAND CLEAR',13,23.4,.55,'rgba(143,59,46,.34)'); text('LOADING ONLY',6.5,14.3,.5,'rgba(207,198,176,.2)'); for(const [tx,ty] of [[22,14],[22,25]]){ c.strokeStyle='rgba(143,59,46,.3)'; c.lineWidth=.08; c.beginPath(); c.arc(tx+.5,ty+.5,2.4,0,7); c.stroke(); } c.restore(); }
      if(near(37,19,24)){ iso(); dash(27,19.5,47,19.5,'rgba(207,198,176,.18)',.08,[.7,.6]); text('→ LINE 3 →',33,19.5,.5,'rgba(207,198,176,.2)'); stripes(26.2,17.6,.35,3.8,.25); stripes(46.5,17.6,.35,3.8,.25); for(const yy of [11.45,13.1,25.45,27.1]) stripes(30,yy,8,.22,.3); text('PLATFORM 2',36,30.2,.5,'rgba(207,198,176,.18)'); c.restore(); }
      if(near(57,19,18)){ iso(); c.strokeStyle='rgba(79,101,120,.4)'; c.lineWidth=.09; c.strokeRect(55.2,16.4,5.6,5.2); for(const [bx,by,sx2,sy2] of [[55.2,16.4,1,1],[60.8,16.4,-1,1],[55.2,21.6,1,-1],[60.8,21.6,-1,-1]]){ c.strokeStyle='rgba(207,198,176,.3)'; c.lineWidth=.12; c.beginPath(); c.moveTo(bx+sx2*.9,by); c.lineTo(bx,by); c.lineTo(bx,by+sy2*.9); c.stroke(); } text('INTEGRATION CONTROLLER',57.5,15.6,.4,'rgba(207,198,176,.22)'); dash(51,19.5,56,19.5,'rgba(79,101,120,.35)',.08,[.5,.4]); c.restore(); }
      if(near(75,19.5,26)){ iso(); const cx=75.2,cy=19.5; for(const [r,col,w] of [[8.6,'rgba(143,59,46,.28)',.14],[6.2,'rgba(207,198,176,.14)',.05],[3.6,'rgba(143,59,46,.30)',.1],[1.8,'rgba(207,198,176,.18)',.06]] as [number,string,number][]){ c.strokeStyle=col; c.lineWidth=w; c.beginPath(); c.arc(cx,cy,r,0,7); c.stroke(); }
        c.save(); c.strokeStyle='rgba(8,8,10,.32)'; c.lineWidth=.18; for(let a=0;a<8;a++){ const an=a*Math.PI/4+Math.PI/8; c.beginPath(); c.moveTo(cx+Math.cos(an)*1.9,cy+Math.sin(an)*1.9); c.lineTo(cx+Math.cos(an)*8.5,cy+Math.sin(an)*8.5); c.stroke(); } c.restore(); c.strokeStyle='rgba(176,150,70,.22)'; c.lineWidth=.22; c.setLineDash([.45,.45]); c.beginPath(); c.arc(cx,cy,9.7,0,7); c.stroke(); c.setLineDash([]); text('RECLAMATION BAY',cx,cy-10.9,.5,'rgba(207,198,176,.2)'); c.restore(); }
      if(near(11,37,16)){ iso(); stripes(4.2,41.2,15.6,.35,.28); text('SALVAGE — SORT / STRIP / SCRAP',11.5,32.8,.42,'rgba(207,198,176,.2)'); c.restore(); }
    } else if(L.w===30){ iso(); c.fillStyle='rgba(79,101,120,.13)'; c.fillRect(21,6.2,5.6,3.6); c.fillStyle='rgba(143,59,46,.13)'; c.fillRect(12.4,3.6,5,3.2); c.fillStyle='rgba(107,112,53,.13)'; c.fillRect(3.4,6.4,4.4,3.4); c.fillStyle='rgba(176,150,70,.09)'; c.fillRect(3.4,13,4.4,3.6);
      c.strokeStyle='rgba(207,198,176,.16)'; c.lineWidth=.07; c.setLineDash([.5,.5]); c.strokeRect(9.5,7.5,10,7); c.setLineDash([]); text('SAFE ZONE',14.5,11,.5,'rgba(207,198,176,.18)'); stripes(21.4,13.4,4.6,.35,.3); stripes(21.4,17.4,4.6,.35,.3); text('ANNEX GATE',23.7,16,.4,'rgba(207,198,176,.2)'); text('REPAIR MARKET',14.5,17.6,.5,'rgba(143,59,46,.26)'); c.restore(); }
    void L; }
  isDoorTile(x:number,y:number){ return this.g.level.doors.some(d=>d.tiles.some(t=>t[0]===x&&t[1]===y)); }
  ring(x:number,y:number,r:number,col:string,alpha=1,filled=false){ const c=this.ctx; c.save(); c.globalAlpha=alpha; c.strokeStyle=col; c.fillStyle=col; c.lineWidth=2; c.beginPath(); c.ellipse(this.sx(x,y),this.sy(x,y),r*this.TW/2*Math.SQRT2*.7,r*this.TW/4*Math.SQRT2*.7,0,0,7); if(filled){ c.globalAlpha=alpha*.25; c.fill(); c.globalAlpha=alpha; } c.stroke(); c.restore(); }
  poly(pts:[number,number][],fill?:string,stroke?:string,alpha=1,lw=2){ const c=this.ctx; c.save(); c.globalAlpha=alpha; c.beginPath(); pts.forEach(([x,y],i)=>{ const a=this.sx(x,y), b=this.sy(x,y); i?c.lineTo(a,b):c.moveTo(a,b); }); c.closePath(); if(fill){ c.fillStyle=fill; c.fill(); } if(stroke){ c.strokeStyle=stroke; c.lineWidth=lw; c.stroke(); } c.restore(); }
  sector(x:number,y:number,a:number,r:number,arc:number,n=14):[number,number][]{ const p:[number,number][]=[[x,y]]; for(let i=0;i<=n;i++){ const aa=a-arc/2+arc*i/n; p.push([x+Math.cos(aa)*r,y+Math.sin(aa)*r]); } return p; }
  circle(x:number,y:number,r:number,n=20):[number,number][]{ const p:[number,number][]=[]; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2; p.push([x+Math.cos(a)*r,y+Math.sin(a)*r]); } return p; }
  rect(x:number,y:number,a:number,len:number,w:number):[number,number][]{ const ca=Math.cos(a), sa=Math.sin(a); const nx=-sa*w/2, ny=ca*w/2; return [[x+nx,y+ny],[x+ca*len+nx,y+sa*len+ny],[x+ca*len-nx,y+sa*len-ny],[x-nx,y-ny]]; }
  box(x:number,y:number,w:number,d:number,h:number,top:string,left:string,right:string){ const c=this.ctx; const z=h; const p=(px:number,py:number,pz:number)=>[this.sx(px,py),this.sy(px,py,pz)]; const A=p(x,y,z),B=p(x+w,y,z),C=p(x+w,y+d,z),D=p(x,y+d,z), B0=p(x+w,y,0),C0=p(x+w,y+d,0),D0=p(x,y+d,0);
    c.fillStyle=left; c.beginPath(); c.moveTo(D[0],D[1]); c.lineTo(C[0],C[1]); c.lineTo(C0[0],C0[1]); c.lineTo(D0[0],D0[1]); c.fill();
    c.fillStyle=right; c.beginPath(); c.moveTo(C[0],C[1]); c.lineTo(B[0],B[1]); c.lineTo(B0[0],B0[1]); c.lineTo(C0[0],C0[1]); c.fill();
    c.fillStyle=top; c.beginPath(); c.moveTo(A[0],A[1]); c.lineTo(B[0],B[1]); c.lineTo(C[0],C[1]); c.lineTo(D[0],D[1]); c.fill(); }

  drawWorld(){
    const g=this.g, L=g.level, c=this.ctx; const items:{d:number;f:()=>void}[]=[]; const R=Math.ceil(Math.max(this.w,this.h)/this.TW*1.1)+3;
    const x0=Math.max(0,Math.floor(g.px-R)), x1=Math.min(L.w-1,Math.ceil(g.px+R)), y0=Math.max(0,Math.floor(g.py-R)), y1=Math.min(L.h-1,Math.ceil(g.py+R));
    const propAt=new Map<number,typeof L.props[0]>(); for(const p of L.props) propAt.set(p.y*L.w+p.x,p);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){ const i=y*L.w+x; if(!L.solid[i]) continue; if(L.hide&&L.hide[i]) continue; const pr=propAt.get(i);
      if(pr){ items.push({d:x+y+.5,f:()=>{ const dd=(x+y)-(g.px+g.py), sd=(x-g.px)-(y-g.py); const fade=dd>0&&dd<4.5&&Math.abs(sd)<2.2&&pr.h>1.2; c.save(); if(fade) c.globalAlpha=.4; this.drawProp(pr); c.restore(); }}); continue; }
      let near=false; for(let dy=-1;dy<=1&&!near;dy++)for(let dx=-1;dx<=1;dx++){ const nx=x+dx,ny=y+dy; if(nx>=0&&ny>=0&&nx<L.w&&ny<L.h&&!L.solid[ny*L.w+nx]){ near=true; break; } }
      if(!near) continue; const door=L.doors.find(d=>d.tiles.some(t=>t[0]===x&&t[1]===y));
      items.push({d:x+y+.5,f:()=>{ const dd=(x+y)-(g.px+g.py), sd=(x-g.px)-(y-g.py); const fade=dd>0&&dd<4.5&&Math.abs(sd)<2.8; c.save(); if(fade) c.globalAlpha=.3; if(this.env){ if(door) this.doorBox(x,y); else this.wallBox(x,y); } else if(door){ this.box(x,y,1,1,1.5,'#4a4c4e','#3a3c3e','#2d2f31'); this.hazard(x,y); } else this.box(x,y,1,1,1.6,'#46484a','#303234','#232426'); c.restore(); }}); }
    if(L.kind==='town'&&this.town?.ready) this.townItems(items);
    for(const it of L.interacts){ if(!this.interactVisible(it.id)) continue; items.push({d:it.x+it.y,f:()=>this.drawInteract(it)}); }
    for(const dr of (g.inst&&g.mode==='run'?g.inst.drops:[])) items.push({d:dr.x+dr.y,f:()=>this.drawDrop(dr)});
    for(const e of g.enemies){ if(e.dead){ continue; } items.push({d:e.x+e.y,f:()=>this.drawEnemy(e)}); }
    if(!g.downed||true) items.push({d:g.px+g.py,f:()=>this.drawPlayer()});
    items.sort((a,b)=>a.d-b.d);
    // ground-level telegraphs/zones go under actors
    this.drawGroundFx();
    for(const it of items) it.f();
    this.drawProjAndFx(); this.drawGuidance(); if(L.kind==='town'&&this.town?.ready) this.drawTownOverhead(); if(L.kind==='town'&&this.town?.ready) this.drawTownAmbient();
  }
  interactVisible(id:string){ const g=this.g; if(g.mode!=='run'||!g.inst) return true; const f=g.inst.flags; if(id==='controller') return false; if(id==='hackproc') return !f.lock2; return true; }
  hazard(x:number,y:number){ const c=this.ctx; c.save(); c.strokeStyle=PAL.oxide; c.lineWidth=3; c.globalAlpha=.8; const a=this.sx(x+.5,y+.5), b=this.sy(x+.5,y+.5,.8); c.beginPath(); c.moveTo(a-this.TW*.25,b-this.TW*.1); c.lineTo(a+this.TW*.25,b+this.TW*.1); c.moveTo(a-this.TW*.25,b+this.TW*.1); c.lineTo(a+this.TW*.25,b-this.TW*.1); c.stroke(); c.restore(); }
  drawProp(p:{x:number;y:number;kind:string;h:number}){ if(this.env){ this.texProp(p); return; } const k=p.kind; if(k==='crate') this.box(p.x+.05,p.y+.05,.9,.9,p.h*.9,'#8a6b4e','#6b5239','#554230'); else if(k==='conveyor') this.box(p.x,p.y,1,1,p.h,'#4f5256','#3d4043','#2f3235'); else if(k==='machine') this.box(p.x,p.y,1,1,p.h,'#5f666b','#464c50','#383d41'); else if(k==='rack') this.box(p.x,p.y,1,1,p.h,'#574f47','#443d37','#352f2a'); else this.box(p.x+.1,p.y+.1,.8,.8,p.h,'#7b7c79','#5d5e5c','#49494a');
    if(k==='conveyor'){ const c=this.ctx; c.fillStyle='rgba(168,150,90,.5)'; const a=this.sx(p.x+.5,p.y+.5), b=this.sy(p.x+.5,p.y+.5,p.h); c.fillRect(a-3,b-2,6,3); } }
  drawInteract(it:{id:string;x:number;y:number;kind:string;label:string}){ const c=this.ctx; const a=this.sx(it.x,it.y), b=this.sy(it.x,it.y); const s=this.TW/64;
    if(this.g.level.kind==='town'&&this.town?.ready){ this.townMarker(it,a,b,s); return; }
    if(it.id==='annex'){ this.box(it.x-1,it.y-1,2,2,.12,'#5a5d5f','#444','#333'); }
    c.save(); c.fillStyle='#3a3d40'; c.fillRect(a-9*s,b-22*s,18*s,22*s); c.fillStyle='#cfc6b0'; c.globalAlpha=.8; c.fillRect(a-6*s,b-19*s,12*s,8*s); c.globalAlpha=1; c.fillStyle=it.kind==='hack'||it.kind==='terminal'?PAL.slate:PAL.oxide; c.fillRect(a-9*s,b-5*s,18*s,3*s); c.restore();
    if(Math.hypot(this.g.px-it.x,this.g.py-it.y)<7){ c.save(); c.font=`${Math.max(10,11*s*1.3)}px system-ui,sans-serif`; c.textAlign='center'; c.fillStyle='rgba(15,15,16,.7)'; const tw=c.measureText(it.label).width; c.fillRect(a-tw/2-4,b-44*s,tw+8,15*s*1.3); c.fillStyle='#d8d2bf'; c.fillText(it.label,a,b-32*s); c.restore(); } }
  drawDrop(d:import('./state').Drop){ const g=this.g; const c=this.ctx; const a=this.sx(d.x,d.y), b=this.sy(d.x,d.y); const s=this.TW/64; let col='#cfc6b0'; let rar='grey'; if(d.kind==='item'){ rar=ITEM_BY_ID[d.inst!.def].rarity; col=RARITY_COLOR[rar as keyof typeof RARITY_COLOR]; } else if(d.kind==='chip'){ col=RARITY_COLOR[CHIPS[d.chip!].rarity]; rar=CHIPS[d.chip!].rarity; } else if(d.kind==='stim'){ col='#8fae7f'; } else col='#b8a46a';
    const t=g.time; c.save(); c.fillStyle='rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(a,b,9*s,4.5*s,0,0,7); c.fill();
    if(rar==='orange'){ c.strokeStyle=col; c.lineWidth=2; for(let k=0;k<2;k++){ c.beginPath(); c.ellipse(a,b-8*s,(11+k*4)*s,(5+k*2)*s,0,t*(k?-1.5:2),t*(k?-1.5:2)+4.2); c.stroke(); } }
    else if(rar==='purple'){ c.strokeStyle=col; c.globalAlpha=.7; c.lineWidth=1.5; c.beginPath(); c.ellipse(a,b-8*s,12*s,5.5*s,0,t,t+4); c.stroke(); c.globalAlpha=1; }
    else if(rar==='blue'||rar==='green'){ c.strokeStyle=col; c.globalAlpha=rar==='blue'?.5:.3; c.beginPath(); c.moveTo(a,b-2); c.lineTo(a,b-24*s); c.stroke(); c.globalAlpha=1; }
    const bob=Math.sin(t*3+d.id)*1.5*s; c.fillStyle=col; if(d.kind==='item'){ c.fillRect(a-7*s,b-14*s+bob,14*s,10*s); c.fillStyle='#222'; c.fillRect(a-4*s,b-11*s+bob,8*s,4*s); } else if(d.kind==='chip'){ c.fillRect(a-5*s,b-11*s+bob,10*s,7*s); c.fillStyle='#222'; c.fillRect(a-2*s,b-9*s+bob,4*s,3*s); } else if(d.kind==='stim'){ c.fillRect(a-3*s,b-13*s+bob,6*s,10*s); } else { c.beginPath(); c.arc(a,b-7*s+bob,4*s,0,7); c.fill(); }
    if(d.marker){ c.fillStyle='#d8d2bf'; c.beginPath(); c.moveTo(a,b-28*s); c.lineTo(a-5*s,b-35*s); c.lineTo(a+5*s,b-35*s); c.fill(); }
    c.restore(); }
  // ----- actors -----
  limb(x1:number,y1:number,x2:number,y2:number,w:number,col:string){ const c=this.ctx; c.strokeStyle=col; c.lineWidth=w; c.lineCap='round'; c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke(); }
  drawPlayer(){
    const g=this.g, c=this.ctx; const s=this.TW/64; const a=this.sx(g.px,g.py), b=this.sy(g.px,g.py); const L=installedLayout(g.save); const broken=g.inst?.broken||[];
    c.save(); c.fillStyle='rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(a,b,13*s,6*s,0,0,7); c.fill();
    if(this.anim){ const now=g.time, dtp=Math.min(.1,Math.max(0,now-this.lastT)); this.lastT=now; this.anim.update(g as any,dtp); if(g.cloakT>0) c.globalAlpha=.32; else if(g.iframes>0&&g.dodgeT>0) c.globalAlpha=.55; if(this.anim.draw(c,a,b,s)){ c.restore(); if(g.save.settings.reducedFx===false&&g.braceT>0) this.ring(g.px,g.py,.7,'#d8d2bf',.8); return; } }
    if(g.downed){ c.translate(a,b-6*s); c.rotate(-1.4); }
    else { c.translate(a,b); }
    if(g.cloakT>0) c.globalAlpha=.32; if(g.iframes>0&&g.dodgeT>0) c.globalAlpha=.55;
    const col=(sl:Slot)=>{ const inst=L[sl]; if(!inst) return PAL.skin; const d=ITEM_BY_ID[inst.def]; if(d.id.startsWith('stock_')) return sl==='torso'?'#5c5f5a':PAL.skin; if(broken.includes(sl)) return '#3a3a3a'; return MFR[d.mfr].color; };
    const acc=(sl:Slot)=>{ const inst=L[sl]; if(!inst) return null; const d=ITEM_BY_ID[inst.def]; if(d.id.startsWith('stock_')) return null; return MFR[d.mfr].accent; };
    const dir=Math.sin(g.face-Math.PI/4)>=0?1:-1; // rough facing flip
    const bob=g.moving?Math.sin(g.time*14)*1.5*s:0;
    // legs
    const lw=6*s; this.limb(-4*s,-14*s,-5*s+bob,-1,lw,col('legL')); this.limb(4*s,-14*s,5*s-bob,-1,lw,col('legR'));
    c.fillStyle=col('footL'); c.fillRect(-9*s,-3*s,8*s,3*s); c.fillStyle=col('footR'); c.fillRect(1*s,-3*s,8*s,3*s);
    // torso
    c.fillStyle=col('torso'); c.fillRect(-8*s,-30*s,16*s,17*s); const ta=acc('torso'); if(ta){ c.fillStyle=ta; c.fillRect(-8*s,-22*s,16*s,3*s); }
    if(L.torso&&!ITEM_BY_ID[L.torso.def].id.startsWith('stock_')){ c.fillStyle='rgba(0,0,0,.25)'; c.fillRect(-2*s,-30*s,4*s,17*s); }
    // arms (arm slot) and hands
    this.limb(-9*s,-28*s,-14*s,-17*s,5*s,col('armL')); this.limb(9*s,-28*s,14*s,-17*s,5*s,col('armR'));
    c.fillStyle=col('handL'); c.fillRect(-17*s,-19*s,6*s,5*s); c.fillStyle=col('handR'); c.fillRect(11*s,-19*s,6*s,5*s);
    const R=L.armR; if(R&&!ITEM_BY_ID[R.def].id.startsWith('stock_')&&!broken.includes('armR')){ const d=ITEM_BY_ID[R.def]; c.fillStyle=MFR[d.mfr].accent; if(d.abilities?.includes('sweep')){ c.beginPath(); c.arc(17*s,-24*s,6*s,0,7); c.fill(); c.strokeStyle='#d0cbbb'; c.lineWidth=1; for(let k=0;k<8;k++){ const aa=k*.785+g.time*8; c.beginPath(); c.moveTo(17*s+Math.cos(aa)*6*s,-24*s+Math.sin(aa)*6*s); c.lineTo(17*s+Math.cos(aa)*8*s,-24*s+Math.sin(aa)*8*s); c.stroke(); } } else { c.beginPath(); c.moveTo(14*s,-18*s); c.lineTo(24*s,-26*s); c.lineTo(15*s,-14*s); c.fill(); } }
    // head
    const fc=col('face'), br=col('brain'); c.fillStyle=L.face&&!ITEM_BY_ID[L.face.def].id.startsWith('stock_')?fc:PAL.skin; c.beginPath(); c.arc(0,-37*s,6.5*s,0,7); c.fill(); if(L.brain&&!ITEM_BY_ID[L.brain.def].id.startsWith('stock_')){ c.fillStyle=br; c.fillRect(-6*s,-45*s,12*s,4*s); }
    c.fillStyle='rgba(0,0,0,.35)'; c.fillRect((dir>0?1:-5)*s,-38*s,4*s,2*s);
    c.restore();
    if(g.save.settings.reducedFx===false && g.braceT>0){ this.ring(g.px,g.py,.7,'#d8d2bf',.8); }
    // weapon swing direction hint
  }
  drawEnemy(e:En){
    const g=this.g, c=this.ctx; const def=ENEMIES[e.type]; const s=this.TW/64*(def.boss?1.8:def.elite?1.35:1); const a=this.sx(e.x,e.y), b=this.sy(e.x,e.y); const rt=e._rt; const mf=MFR[def.mfr];
    const rev=rt.reveal>0?Math.max(0,1-rt.reveal/COMBAT.bossRevealSeconds):1; if(rt.reveal>0){ c.save(); c.beginPath(); c.rect(a-80*s,b-120*s,160*s,120*s+2); c.clip(); }
    c.save(); c.fillStyle='rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(a,b,13*s,6*s,0,0,7); c.fill();
    c.translate(a,b+(rt.reveal>0?(1-rev)*70*s:0)); if(e.faction==='ally'){ c.globalAlpha=.9; }
    const flash=rt.hit>0; const body=flash?'#e8e1cf':e.faction==='ally'?'#8aa0b0':mf.color; const accent=mf.accent; const fa=Math.atan2(Math.sin(rt.ang),Math.cos(rt.ang)); const sxd=Math.cos(fa)-Math.sin(fa); const dirx=Math.sign(sxd)||1; const bob=rt.st==='chase'?Math.sin(g.time*10+e.id)*1.2*s:0;
    if(e.type==='turret'){ c.fillStyle='#3c3f42'; c.fillRect(-11*s,-14*s,22*s,14*s); c.fillStyle=body; c.fillRect(-8*s,-26*s,16*s,12*s); c.fillStyle=accent; c.fillRect(-8*s,-18*s,16*s,3*s); const ba=rt.ang; const px=(Math.cos(ba)-Math.sin(ba))*.5, py=(Math.cos(ba)+Math.sin(ba))*.25; c.strokeStyle='#222'; c.lineWidth=5*s; c.beginPath(); c.moveTo(0,-20*s); c.lineTo(px*28*s,-20*s+py*28*s*2); c.stroke(); }
    else {
      const big=def.boss?1:def.elite?1:0; const lw=(big?8:5)*s; this.limb(-4*s*(1+big),-14*s,-5*s*(1+big)+bob,0,lw,flash?body:'#44464a'); this.limb(4*s*(1+big),-14*s,5*s*(1+big)-bob,0,lw,flash?body:'#44464a');
      c.fillStyle=body; const tw=(big?22:14)*s, th=(big?22:16)*s; c.fillRect(-tw/2,-14*s-th,tw,th); c.fillStyle=accent; c.fillRect(-tw/2,-14*s-th*.45,tw,3*s);
      c.fillStyle=def.mfr==='MM'?'#9a9a82':def.mfr==='PS'?'#e0dac8':'#4c3f38'; c.beginPath(); c.arc(0,-14*s-th-5*s,(big?7:5.5)*s,0,7); c.fill(); if(def.mfr==='PS'&&def.boss){ c.fillStyle=body; c.beginPath(); c.arc(0,-14*s-th-5*s,7*s,0,7); c.fill(); }
      // weapon arm
      const wx=dirx*(tw/2+4*s), wy=-14*s-th*.7;
      if(e.type==='sawhand'||e.type==='enforcer'||e.type==='overseer'||e.type==='foreman'){ c.fillStyle='#2e2e2f'; c.beginPath(); c.arc(wx+dirx*6*s,wy,(def.boss?10:7)*s,0,7); c.fill(); c.strokeStyle='#d0c7b0'; c.lineWidth=1.2; for(let k=0;k<10;k++){ const aa=k*.63+g.time*(rt.st==='tele'?18:5); const r0=(def.boss?10:7)*s; c.beginPath(); c.moveTo(wx+dirx*6*s+Math.cos(aa)*r0,wy+Math.sin(aa)*r0); c.lineTo(wx+dirx*6*s+Math.cos(aa)*(r0+3*s),wy+Math.sin(aa)*(r0+3*s)); c.stroke(); } }
      else if(e.type==='shooter'||e.type==='warden'){ this.limb(wx-dirx*4*s,wy,wx+dirx*14*s,wy-2*s,4*s,'#2a2b2d'); }
      else { this.limb(wx,wy,wx+dirx*9*s,wy+5*s,4*s,'#6e6a5e'); }
    }
    c.restore(); if(rt.reveal>0) c.restore();
    // dust on emergence
    if(rt.reveal>0&&Math.random()<.5) g.fx.push({kind:'dust',x:e.x+(Math.random()-.5)*2,y:e.y+(Math.random()-.5)*2,t:0,life:.6});
    // health bar only for elites and bosses
    if(def.elite&&rt.reveal<=0){ const w=(def.boss?64:44)*(this.TW/64); const hx=a-w/2, hy=b-(def.boss?118:70)*(this.TW/64); c.fillStyle='rgba(10,10,10,.75)'; c.fillRect(hx-1,hy-1,w+2,7); c.fillStyle=def.boss?'#a2523f':'#b08a4a'; c.fillRect(hx,hy,w*Math.max(0,e.hp/e.maxHp),5); if(rt.vuln>0){ c.fillStyle='#d8d2bf'; c.font='10px system-ui'; c.textAlign='center'; c.fillText('OPENING',a,hy-4); } }
    if(g.target===e.id){ const r=def.radius+.35; this.ring(e.x,e.y,r,'#d8d2bf',.95); const c2=this.ctx; c2.save(); c2.strokeStyle='#d8d2bf'; c2.lineWidth=2; const bx=a, by=b-(def.boss?100:def.elite?60:42)*(this.TW/64); c2.beginPath(); c2.moveTo(bx-6,by-8); c2.lineTo(bx,by); c2.lineTo(bx+6,by-8); c2.stroke(); c2.restore(); }
    if(e.stunT>0){ c.fillStyle='#d8d2bf'; c.font='11px system-ui'; c.textAlign='center'; c.fillText('✕',a,b-60*(this.TW/64)); }
  }
  drawGuidance(){ const g=this.g; if(g.mode!=='run'||g.downed) return; const gd=g.guidance(); if(!gd) return; const c=this.ctx, s=this.TW/64;
    const px=this.sx(g.px,g.py), py=this.sy(g.px,g.py,.5); const wx=this.sx(gd.wp.x,gd.wp.y), wy=this.sy(gd.wp.x,gd.wp.y,.5); const a=Math.atan2(wy-py,wx-px); const far=gd.dist>4;
    if(far&&!g.revealing){ const R=62*s, bob=Math.sin(g.time*5)*3*s; const cx=px+Math.cos(a)*(R+bob), cy=py+Math.sin(a)*(R+bob)*.62+8*s; c.save(); c.translate(cx,cy); c.rotate(a); c.globalAlpha=.85; c.fillStyle='#e05a3a'; c.strokeStyle='#1b1c1e'; c.lineWidth=2; c.beginPath(); c.moveTo(11*s,0); c.lineTo(-7*s,-8*s); c.lineTo(-3*s,0); c.lineTo(-7*s,8*s); c.closePath(); c.fill(); c.stroke(); c.restore(); }
    // objective beacon: screen-edge marker when off screen, pulse ring when on screen
    const ox=this.sx(gd.obj.x,gd.obj.y), oy=this.sy(gd.obj.x,gd.obj.y,.5); const m=26; if(ox<m||ox>this.w-m||oy<m||oy>this.h-m){ const ex=Math.max(m,Math.min(this.w-m,ox)), ey=Math.max(m+40,Math.min(this.h-m,oy)); c.save(); c.fillStyle='#e05a3a'; c.globalAlpha=.55+.3*Math.sin(g.time*6); c.beginPath(); c.arc(ex,ey,7*s,0,7); c.fill(); c.restore(); } else { this.ring(gd.obj.x,gd.obj.y,1.2+.2*Math.sin(g.time*4),'#e05a3a',.75); c.save(); c.fillStyle='#e05a3a'; c.globalAlpha=.8; c.beginPath(); c.moveTo(ox,oy-34*s+Math.sin(g.time*5)*3*s); c.lineTo(ox-7*s,oy-46*s+Math.sin(g.time*5)*3*s); c.lineTo(ox+7*s,oy-46*s+Math.sin(g.time*5)*3*s); c.closePath(); c.fill(); c.restore(); } }
  drawGroundFx(){
    const g=this.g, c=this.ctx;
    for(const z of g.zones){ const warn=z.t<z.windup; const p=warn?z.t/z.windup:1; this.poly(this.circle(z.x,z.y,z.r),warn?'#b5483a':'#4f5f78',warn?'#d8d2bf':'#9aa8b8',warn?.18+.25*p:.38,2); if(warn) this.poly(this.circle(z.x,z.y,z.r*p),'#b5483a',undefined,.35); }
    for(const e of g.enemies){ if(e.dead||e._rt.st!=='tele') continue; const rt=e._rt, A=ATKD[rt.atk]; if(!A) continue; const p=Math.min(1,rt.t/ (A.w||1)); const def=ENEMIES[e.type]; const fill=p>.7?'#d2503a':'#b5483a', edge=p>.7&&Math.sin(g.time*34)>0?'#ffffff':'#d8d2bf'; const A0=.26+.14*p; { const sc=this.TW/64; const ex=this.sx(e.x,e.y), ey=this.sy(e.x,e.y,0)-(def.boss?110:def.elite?66:48)*sc; c.save(); c.fillStyle=def.boss||def.elite?'#e0a040':'#e05a3a'; c.font='bold '+Math.round((14+6*p)*sc)+'px system-ui'; c.textAlign='center'; c.globalAlpha=.95; c.fillText('!',ex,ey); c.restore(); }
      if(A.shape==='cone') { this.poly(this.sector(e.x,e.y,rt.ang,A.r,A.arc),fill,edge,A0,2); this.poly(this.sector(e.x,e.y,rt.ang,A.r*p,A.arc),fill,undefined,.38); }
      else if(A.shape==='circle'){ this.poly(this.circle(e.x,e.y,A.r),fill,edge,A0,2); this.poly(this.circle(e.x,e.y,A.r*p),fill,undefined,.38); }
      else if(A.shape==='line'){ const len=A.r; const wd=(A as any).wid; this.poly(this.rect(e.x,e.y,rt.ang,len,wd),fill,edge,A0,2); this.poly(this.rect(e.x,e.y,rt.ang,len*p,wd),fill,undefined,.38); }
      else if(A.shape==='fan'){ for(const o of [-.25,0,.25]) this.poly(this.rect(e.x,e.y,rt.ang+o,A.r,.18),fill,edge,.4,1); }
      else if(A.shape==='aim'){ this.poly(this.rect(e.x,e.y,rt.ang,A.r,.12+.1*p),fill,edge,.45+.3*p,1); }
      void def; }
    // aim preview
    const aim=g.aim; if(aim){ const idx=aim.idx; const id=g.build.abilities[idx]; if(id){ const def=ABILITIES[id]; const v=g.validateAim(def,aim); const col=v.valid?'#d8d2bf':'#a0443a'; const ang=Math.atan2(aim.wy-g.py,aim.wx-g.px); const al=v.valid?.8:.55;
      if(def.aim==='direction'){ if(aim.hasDir){ if(def.id==='sweep') this.poly(this.sector(g.px,g.py,ang,def.range,Math.PI*.75*(1+g.build.mods.arc)),col,col,.18,2); else this.poly(this.rect(g.px,g.py,ang,def.range+g.build.mods.burstLen,.9),col,col,.2,2); } else this.ring(g.px,g.py,1,col,.5); }
      else if(def.aim==='ground'){ this.ring(g.px,g.py,def.range*.7,col,.2); if(v.tx!==undefined){ this.poly(this.circle(v.tx,v.ty!,def.id==='pulse'?2.8:.7),col,col,.2,2); } else this.ring(aim.wx,aim.wy,.6,col,.5); }
      else if(def.aim==='target'){ this.ring(g.px,g.py,def.range*.7,col,.15); if(v.target) this.ring(v.target.x,v.target.y,1.1,col,.95); else this.ring(aim.wx,aim.wy,.8,col,.5); }
      else this.ring(g.px,g.py,1.3,col,al); } }
    // town channel
    if(g.channel){ const p=g.channel.t/g.channel.dur; this.ring(g.px,g.py,1.3,'#d8d2bf',.9); this.ring(g.px,g.py,1.3*p,'#8fae7f',.8,true); }
  }
  drawProjAndFx(){
    const g=this.g,c=this.ctx; const s=this.TW/64;
    for(const p of g.projs){ const a=this.sx(p.x,p.y), b=this.sy(p.x,p.y,.5); const ally=p.faction==='ally'; const col=ally?(p.c||'#d8d2bf'):'#d8c27a'; const k=p.kind;
      const tl=k==='needle'?.07:k==='pistol'?.05:k==='shard'?.03:.04; const rad=(k==='slug'?5:k==='pop'?3:k==='shard'?2.6:k==='needle'?2.4:k==='pistol'?3:4)*s;
      c.strokeStyle=col; c.globalAlpha=.4; c.lineWidth=(k==='needle'?1.6:2.4)*s; c.beginPath(); c.moveTo(a,b); c.lineTo(this.sx(p.x-p.vx*tl*(k==='needle'?2:1),p.y-p.vy*tl*(k==='needle'?2:1)),this.sy(p.x-p.vx*tl*(k==='needle'?2:1),p.y-p.vy*tl*(k==='needle'?2:1),.5)); c.stroke(); c.globalAlpha=1;
      c.fillStyle=col; c.beginPath(); if(k==='shard'){ c.moveTo(a,b-rad*1.4); c.lineTo(a+rad,b); c.lineTo(a,b+rad*1.4); c.lineTo(a-rad,b); c.closePath(); } else c.arc(a,b,rad,0,7); c.fill(); if(ally){ c.fillStyle='#fff'; c.globalAlpha=.7; c.beginPath(); c.arc(a,b,rad*.4,0,7); c.fill(); c.globalAlpha=1; } }
    const red=g.save.settings.reducedFx;
    for(const f of g.fx){ const k=f.t/f.life; const a=this.sx(f.x,f.y), b=this.sy(f.x,f.y);
      switch(f.kind){
        case 'slash': this.poly(this.sector(f.x,f.y,f.a!,f.r!,f.w!,10),f.c||'#d8d2bf',undefined,(1-k)*.45); break;
        case 'ring': this.ring(f.x,f.y,f.r!*(.3+k),f.c||'#d8d2bf',1-k); break;
        case 'burst': if(!red){ c.fillStyle=`rgba(216,210,176,${.5*(1-k)})`; c.beginPath(); c.arc(a,b-10*s,(10+20*k)*s,0,7); c.fill(); } break;
        case 'spark': c.fillStyle=f.c||'#e6d7a0'; c.globalAlpha=1-k; c.beginPath(); c.arc(a,b-8*s,(3+4*k)*s,0,7); c.fill(); c.globalAlpha=1; break;
        case 'blood': c.fillStyle=f.c||'#6e2a22'; c.globalAlpha=1-k*.6; c.beginPath(); c.ellipse(a,b-6*s*(1-k),3*s,2*s,0,0,7); c.fill(); c.globalAlpha=1; break;
        case 'dust': if(!red){ c.fillStyle=`rgba(150,145,130,${.4*(1-k)})`; c.beginPath(); c.arc(a,b-6*s-k*10*s,(8+10*k)*s,0,7); c.fill(); } break;
        case 'vent': for(let i=0;i<5;i++){ c.fillStyle=`rgba(200,205,205,${.4*(1-k)})`; c.beginPath(); c.arc(a+(i-2)*6*s,b-20*s-k*30*s-i*3,(5+8*k)*s,0,7); c.fill(); } break;
        case 'line': this.poly(this.rect(f.x,f.y,f.a!,f.len!,f.w!),f.c||'#d8d2bf',undefined,(1-k)*(f.c?.9:.4)); break;
        case 'text': c.fillStyle=f.c||'#d8d2bf'; c.font=`bold ${12*s*1.2}px system-ui`; c.textAlign='center'; c.globalAlpha=1-k; c.fillText(f.text||'',a,b-30*s-k*20); c.globalAlpha=1; break;
      } }
  }

  // ---------- illustrated town ----------
  private groundBuilt:HTMLCanvasElement|null=null;
  private drawTownGround(){ const t=this.town!, L=this.g.level; if(!t.ground) t.buildGround(L); const gr=t.ground!; const CH=5, kk=this.TW/GP; const R=Math.ceil(Math.max(this.w,this.h)/this.TW*1.1)+4; const g=this.g;
    const cx0=Math.max(0,Math.floor((g.px-R)/CH)), cx1=Math.min(Math.ceil(L.w/CH)-1,Math.floor((g.px+R)/CH)), cy0=Math.max(0,Math.floor((g.py-R)/CH)), cy1=Math.min(Math.ceil(L.h/CH)-1,Math.floor((g.py+R)/CH));
    for(let cy=cy0;cy<=cy1;cy++)for(let cx=cx0;cx<=cx1;cx++){ const sw=Math.min(CH*GP,gr.width-cx*CH*GP), sh=Math.min(CH*GP,gr.height-cy*CH*GP); if(sw<=0||sh<=0) continue; this.bakeBlit(gr,cx*CH*GP,cy*CH*GP,sw,sh,kk/2,kk/4,-kk/2,kk/4,this.sx(cx*CH,cy*CH),this.sy(cx*CH,cy*CH),0,1); } }
  private townItems(items:{d:number;f:()=>void}[]){ const t=this.town!, L=this.g.level, c=this.ctx, g=this.g; t.update(Math.min(.1,Math.max(0,g.time-this.tLast)||0),L,g.time,g.px,g.py); this.tLast=g.time;
    for(const d of L.decor||[]){ items.push({d:decorDepth(d),f:()=>{ const w=d.sw*this.TW; const sp=t.scaled(d.spr,w,this.dpr); if(!sp) return; const cx=this.sx(d.x+d.fw/2,d.y+d.fd/2); const base=this.sy(d.x+d.fw,d.y+d.fd); const ay=d.ay??.9; const X=cx-sp.w/2, Y=base-sp.h*ay;
        let al=1; const pa=this.sx(g.px,g.py), pb=this.sy(g.px,g.py); if(g.px+g.py<decorDepth(d)-.2&&pa>X&&pa<X+sp.w&&pb>Y&&pb<Y+sp.h*.9&&d.spr!=='lamp'&&sp.h>this.TW*1.6) al=.5;
        c.save(); c.globalAlpha=al; c.drawImage(sp.cv,Math.round(X*this.dpr)/this.dpr,Math.round(Y*this.dpr)/this.dpr,sp.w,sp.h); c.restore(); }}); }
    (L.npcs||[]).forEach((n,i)=>{ const s=t.npcPos[i]||{x:n.x,y:n.y,flip:false,moving:false}; items.push({d:s.x+s.y,f:()=>this.drawNpc(n,s)}); }); }
  private tLast=0;
  private drawNpc(n:{spr:string;ph:number;h?:number},s:{x:number;y:number;flip:boolean;moving:boolean}){ const t=this.town!, c=this.ctx, g=this.g; const im=t.img[n.spr]; if(!im) return; const hpx=this.TW*(n.h??1.25); const wpx=hpx*im.width/im.height; const sp=t.scaled(n.spr,wpx,this.dpr); if(!sp) return;
    const a=this.sx(s.x,s.y), b=this.sy(s.x,s.y); const T=g.time+n.ph*3; const breathe=Math.sin(T*1.7)*.012, sway=Math.sin(T*.7)*.015, step=s.moving?Math.abs(Math.sin(T*5))*this.TW*.035:0;
    c.save(); c.fillStyle='rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(a,b,sp.w*.32,sp.w*.11,0,0,7); c.fill();
    c.translate(a,b-step); if(s.flip) c.scale(-1,1); c.transform(1,0,sway+(s.moving?Math.sin(T*5)*.03:0),1+breathe,0,0); c.drawImage(sp.cv,-sp.w/2,-sp.h*.97,sp.w,sp.h); c.restore(); }
  private townMarker(it:{id:string;x:number;y:number;label:string},a:number,b:number,s:number){ const c=this.ctx, g=this.g; const near=Math.hypot(g.px-it.x,g.py-it.y)<7; const bob=Math.sin(g.time*2.2+it.x)*2*s; const lift=(it.id==='annex'?64:it.id==='locker'?44:52)*s;
    c.save(); c.globalAlpha=near?.95:.55; c.fillStyle='#cfc6b0'; c.strokeStyle='rgba(10,10,12,.7)'; c.lineWidth=1.5; c.beginPath(); c.moveTo(a,b-lift+8*s+bob); c.lineTo(a-6*s,b-lift+bob); c.lineTo(a+6*s,b-lift+bob); c.closePath(); c.fill(); c.stroke(); c.restore();
    if(near){ c.save(); c.font=`${Math.max(10,11*s*1.3)}px system-ui,sans-serif`; c.textAlign='center'; c.fillStyle='rgba(15,15,16,.72)'; const tw=c.measureText(it.label).width; c.fillRect(a-tw/2-5,b-lift-22*s,tw+10,16*s*1.3); c.fillStyle='#d8d2bf'; c.fillText(it.label,a,b-lift-9*s); c.restore(); } }
  /** overhead dressing (awnings, lantern swags, bulb strings, rag lines): drawn after actors, fades while the player is under it; glow anchors are saved for the light pass */
  private ovGlows:{x:number;y:number;r:number;a:number;c:string;ph:number}[]=[];
  private drawTownOverhead(){ const t=this.town!, L=this.g.level, c=this.ctx, g=this.g; this.ovGlows.length=0; const pa=this.sx(g.px,g.py), pb=this.sy(g.px,g.py)-this.TW*.6;
    for(const o of L.overhead||[]){ const w=o.sw*this.TW; const sp=t.scaled(o.spr,w,this.dpr); if(!sp) continue; const X=this.sx(o.x,o.y)-sp.w/2, Y=this.sy(o.x,o.y,o.z)-sp.h*.5; if(X>this.w||X+sp.w<0||Y>this.h||Y+sp.h<0) continue;
      const under=pa>X-6&&pa<X+sp.w+6&&pb>Y-this.TW*.3&&pb<Y+sp.h+this.TW*1.2; const key=o.spr+o.x+','+o.y; const cur=this.ovA.get(key)??1; const tgt=under?.28:o.glow?.95:.92; const na=cur+(tgt-cur)*.18; this.ovA.set(key,na);
      c.save(); c.globalAlpha=na; c.drawImage(sp.cv,Math.round(X*this.dpr)/this.dpr,Math.round(Y*this.dpr)/this.dpr,sp.w,sp.h); c.restore();
      if(o.glow==='lanterns') for(const u of [.13,.37,.62,.88]) this.ovGlows.push({x:X+sp.w*u,y:Y+sp.h*.74,r:this.TW*1.5,a:.3*na,c:'warm',ph:u*9+X});
      else if(o.glow==='bulbs') for(let i=0;i<14;i++){ const u=.04+i*.069; this.ovGlows.push({x:X+sp.w*u,y:Y+sp.h*(.62+Math.sin(u*9)*.06),r:this.TW*.8,a:.16*na,c:'warm',ph:i*1.7}); } } }
  private ovA=new Map<string,number>();
  private drawTownAmbient(){ const t=this.town!, L=this.g.level, c=this.ctx, g=this.g; const T=g.time; const red=g.save.settings.reducedFx;
    // particles (steam/embers/dust)
    for(const p of t.parts){ const k=p.t/p.life; const a=this.sx(p.x,p.y), b=this.sy(p.x,p.y,p.z); if(p.k==='steam'){ const r=p.s*this.TW; c.globalAlpha=.3*(1-k)*Math.min(1,p.t*2); c.drawImage(t.glows.puff,a-r*1.4,b-r*1.4,r*2.8,r*2.8); c.globalAlpha=1; } else if(p.k==='ember'){ c.fillStyle=`rgba(255,150,70,${1-k})`; c.fillRect(a,b,2,2); } else if(!red){ c.fillStyle=`rgba(200,190,170,${.25*Math.sin(Math.PI*k)})`; c.fillRect(a,b,1.6,1.6); } }
    // additive light pools with flicker
    c.save(); c.globalCompositeOperation='lighter'; for(let i=0;i<(L.lights||[]).length;i++){ const l=L.lights![i]; const a=this.sx(l.x,l.y), b=this.sy(l.x,l.y,l.z); if(a<-300||a>this.w+300||b<-300||b>this.h+300) continue; const fl=l.flick?1+Math.sin(T*(9+i)+i*2.1)*l.flick*.6+Math.sin(T*23+i*5)*l.flick*.4:1; const r=l.r*this.TW*.5*(l.c==='cool'?1:.9+fl*.1); c.globalAlpha=Math.max(0,l.a*fl*(l.c==='cool'?1:.8)); c.drawImage(t.glows[l.c],a-r,b-r*.62,r*2,r*1.24); }
    for(const gl of this.ovGlows){ const fl=1+Math.sin(T*8+gl.ph)*.08+Math.sin(T*21+gl.ph*2)*.05; c.globalAlpha=gl.a*fl; c.drawImage(t.glows[gl.c],gl.x-gl.r,gl.y-gl.r,gl.r*2,gl.r*2); } c.restore(); }
  drawOverlay(){ const c=this.ctx; if(this.g.level.kind==='town'){ c.fillStyle='rgba(10,12,20,.2)'; c.fillRect(0,0,this.w,this.h); } else if(this.env) this.org.drawFogAndVignette(this); const gr=c.createRadialGradient(this.w/2,this.h/2,Math.min(this.w,this.h)*.35,this.w/2,this.h/2,Math.max(this.w,this.h)*.75); gr.addColorStop(0,'rgba(10,10,12,0)'); gr.addColorStop(1,this.g.level.kind==='town'?'rgba(6,7,10,.72)':'rgba(10,10,12,.6)'); c.fillStyle=gr; c.fillRect(0,0,this.w,this.h); }
}
export const ATKD:Record<string,{shape:'cone'|'circle'|'line'|'fan'|'aim';r:number;arc:number;w:number;w_?:number}&{w:number}> = {} as any;
// telegraph geometry mirrors ATK/resolveAttack in sim.ts
import { ATK } from './sim';
const geo:Record<string,any>={ swing:{shape:'cone',r:1.5,arc:Math.PI*.6}, cleave:{shape:'cone',r:2.6,arc:Math.PI*.75}, rsweep:{shape:'cone',r:3.8,arc:Math.PI*.85}, slam:{shape:'circle',r:3.4,arc:0}, charge:{shape:'line',r:9,arc:0,w:1.4}, shot:{shape:'aim',r:10,arc:0}, turretshot:{shape:'aim',r:11,arc:0}, volley:{shape:'fan',r:13,arc:0} };
for(const k of Object.keys(geo)) (ATKD as any)[k]={ ...geo[k], w:ATK[k].w, wid:geo[k].w };
