import { Game } from './sim';
import { Renderer } from './render';
import { AudioSys } from './audio';

export interface InputOpts { modalOpen:()=>boolean; onToggleInv:()=>void; onEsc:()=>void; }
/** Keyboard/mouse + touch. Desktop: WASD, hold Q/E/R (or 1/2/3) to aim at cursor and release to cast, Space dodge, F interact, T stim, B town. */
export class Input {
  keys=new Set<string>(); mouse={x:0,y:0}; heldAbility:number|null=null; joy:{id:number;ox:number;oy:number;x:number;y:number}|null=null; touchMode=false; aimBtn:{id:number;idx:number;cx:number;cy:number}|null=null;
  joyEl:HTMLElement; knobEl:HTMLElement; fixedZone:HTMLElement;
  constructor(private g:Game, private r:Renderer, private audio:AudioSys, private opts:InputOpts, private canvas:HTMLCanvasElement){
    this.joyEl=document.getElementById('joy')!; this.knobEl=document.getElementById('joyknob')!; this.fixedZone=document.getElementById('joyfixed')!;
    const q=new URLSearchParams(location.search); this.touchMode=matchMedia('(pointer:coarse)').matches||q.has('touch'); document.body.classList.toggle('touch',this.touchMode);
    window.addEventListener('keydown',e=>this.kd(e)); window.addEventListener('keyup',e=>this.ku(e)); window.addEventListener('blur',()=>{ this.keys.clear(); this.g.cancelAim(); this.heldAbility=null; });
    window.addEventListener('mousemove',e=>{ this.mouse.x=e.clientX; this.mouse.y=e.clientY; });
    canvas.addEventListener('contextmenu',e=>{ e.preventDefault(); this.g.clearTarget(); });
    canvas.addEventListener('pointerdown',e=>this.pd(e)); canvas.addEventListener('pointermove',e=>this.pm(e)); canvas.addEventListener('pointerup',e=>this.pu(e)); canvas.addEventListener('pointercancel',e=>this.pu(e));
    this.bindButtons();
    document.addEventListener('visibilitychange',()=>{ if(document.hidden){ this.g.saveNow(); this.keys.clear(); this.g.setMove(0,0); this.g.cancelAim(); } });
    window.addEventListener('pagehide',()=>this.g.saveNow());
  }
  abilityKey(k:string){ return k==='q'||k==='1'?0:k==='e'||k==='2'?1:k==='r'||k==='3'?2:-1; }
  cheatBuf=''; 
  kd(e:KeyboardEvent){ const tg=(e.target as HTMLElement)?.tagName; if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT'||(e.target as HTMLElement)?.isContentEditable) return; this.audio.resume(); const k=e.key.toLowerCase();
    if(!e.repeat&&k.length===1){ this.cheatBuf=(this.cheatBuf+k).slice(-5); if(this.cheatBuf==='idkfa'){ this.cheatBuf=''; this.g.cheatIdkfa(); return; } } if(e.repeat&&k!==' ') { if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault(); return; }
    if(k==='escape'){ this.opts.onEsc(); return; }
    if(this.opts.modalOpen()&&k!==' ') return;
    this.keys.add(k);
    const ai=this.abilityKey(k); if(ai>=0&&this.heldAbility===null){ this.heldAbility=ai; this.g.beginAim(ai); this.updateAimFromMouse(); e.preventDefault(); }
    else if(k===' '){ this.g.dodge(); this.heldAbility=null; e.preventDefault(); }
    else if(k==='f'||k==='enter'&&false) this.g.interact();
    else if(k==='b') this.g.townReturn();
    else if(k==='i'||k==='tab'){ this.opts.onToggleInv(); e.preventDefault(); }
    else if(k==='x') this.g.clearTarget();
    else if(k==='t') this.g.useStim();
    else if(k==='m'){ const s=this.g.save.settings; s.music=!s.music; this.audio.setMusicOn(s.music); }
    this.updateMove(); }
  ku(e:KeyboardEvent){ const k=e.key.toLowerCase(); this.keys.delete(k); const ai=this.abilityKey(k); if(ai>=0&&this.heldAbility===ai){ this.updateAimFromMouse(); this.g.releaseAim(); this.heldAbility=null; } this.updateMove(); }
  updateAimFromMouse(){ if(this.heldAbility===null||!this.g.aim) return; const w=this.r.screenToWorld(this.mouse.x,this.mouse.y); const d=Math.hypot(w.x-this.g.px,w.y-this.g.py); this.g.updateAim(w.x,w.y,d>.7); }
  updateMove(){ if(this.joy) return; let x=0,y=0; const K=this.keys; if(K.has('w')||K.has('arrowup')) y-=1; if(K.has('s')||K.has('arrowdown')) y+=1; if(K.has('a')||K.has('arrowleft')) x-=1; if(K.has('d')||K.has('arrowright')) x+=1; const l=Math.hypot(x,y); this.g.setMove(l?x/l:0,l?y/l:0); }
  tick(){ if(this.heldAbility!==null) this.updateAimFromMouse(); }
  // ---- pointers on canvas: floating joystick (touch), tap/click to target ----
  pd(e:PointerEvent){ this.audio.resume(); (document.activeElement as HTMLElement)?.blur?.(); const isTouch=e.pointerType==='touch'||e.pointerType==='pen'&&false; const fixed=this.g.save.settings.joystickFixed;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId); (this as any)['t'+e.pointerId]={x:e.clientX,y:e.clientY,t:performance.now(),moved:0};
    if(this.opts.modalOpen()) return;
    if(isTouch&&!this.joy){ const leftZone=e.clientX<window.innerWidth*.46; if(leftZone){ const R=this.joyR(); let ox=e.clientX, oy=e.clientY; if(fixed){ const b=this.fixedZone.getBoundingClientRect(); ox=b.left+b.width/2; oy=b.top+b.height/2; } this.joy={id:e.pointerId,ox,oy,x:e.clientX,y:e.clientY}; this.showJoy(R); this.applyJoy(); } }
  }
  joyR(){ return Math.max(44,Math.min(70,window.innerHeight*.11)); }
  showJoy(R:number){ this.joyEl.style.display='block'; this.joyEl.style.width=this.joyEl.style.height=R*2+'px'; this.joyEl.style.left=this.joy!.ox-R+'px'; this.joyEl.style.top=this.joy!.oy-R+'px'; }
  applyJoy(){ const j=this.joy!; const R=this.joyR(); let dx=j.x-j.ox, dy=j.y-j.oy; const l=Math.hypot(dx,dy); const k=l>R?R/l:1; dx*=k; dy*=k; this.knobEl.style.transform=`translate(${dx}px,${dy}px)`; const m=Math.min(1,l/R); this.g.setMove(l>6?dx/(R)*(l>R?1:1)*(1):0,l>6?dy/R:0); void m; }
  pm(e:PointerEvent){ const t=(this as any)['t'+e.pointerId]; if(t) t.moved=Math.max(t.moved,Math.hypot(e.clientX-t.x,e.clientY-t.y)); if(this.joy&&this.joy.id===e.pointerId){ this.joy.x=e.clientX; this.joy.y=e.clientY; this.applyJoy(); } }
  pu(e:PointerEvent){ const t=(this as any)['t'+e.pointerId]; delete (this as any)['t'+e.pointerId];
    if(this.joy&&this.joy.id===e.pointerId){ this.joy=null; this.joyEl.style.display=this.g.save.settings.joystickFixed?'block':'none'; this.knobEl.style.transform=''; this.g.setMove(0,0); this.updateMove(); if(this.g.save.settings.joystickFixed) this.showFixed(); }
    if(t&&t.moved<10&&performance.now()-t.t<350&&!this.opts.modalOpen()){ const w=this.r.screenToWorld(e.clientX,e.clientY); this.g.tapEnemy(w.x,w.y); } }
  showFixed(){ const R=this.joyR(); const b=this.fixedZone.getBoundingClientRect(); this.joyEl.style.display='block'; this.joyEl.style.width=this.joyEl.style.height=R*2+'px'; this.joyEl.style.left=b.left+b.width/2-R+'px'; this.joyEl.style.top=b.top+b.height/2-R+'px'; this.joyEl.style.opacity='.5'; }
  // ---- HUD ability buttons: press & drag-aim, release to cast, drag far away to cancel ----
  bindButtons(){
    document.querySelectorAll<HTMLElement>('.abtn').forEach(btn=>{ const idx=+btn.dataset.idx!; let cx=0,cy=0,pid=-1;
      btn.addEventListener('pointerdown',e=>{ if(this.opts.modalOpen()) return; this.audio.resume(); e.preventDefault(); btn.setPointerCapture(e.pointerId); pid=e.pointerId; const b=btn.getBoundingClientRect(); cx=b.left+b.width/2; cy=b.top+b.height/2; this.g.beginAim(idx); this.aimBtn={id:pid,idx,cx,cy}; btn.classList.add('aiming'); this.aimMove(e.clientX,e.clientY,cx,cy,e.pointerType); });
      btn.addEventListener('pointermove',e=>{ if(e.pointerId!==pid||!this.g.aim) return; this.aimMove(e.clientX,e.clientY,cx,cy,e.pointerType); });
      const end=(e:PointerEvent,cancel:boolean)=>{ if(e.pointerId!==pid) return; pid=-1; btn.classList.remove('aiming'); const far=e.pointerType!=='mouse'&&Math.hypot(e.clientX-cx,e.clientY-cy)>170; if(cancel||far) this.g.cancelAim(); else this.g.releaseAim(); this.aimBtn=null; };
      btn.addEventListener('pointerup',e=>end(e,false)); btn.addEventListener('pointercancel',e=>end(e,true)); });
    const dodge=document.getElementById('dodge')!; dodge.addEventListener('pointerdown',e=>{ this.audio.resume(); e.preventDefault(); this.g.dodge(); dodge.classList.add('pressed'); }); const up=()=>dodge.classList.remove('pressed'); dodge.addEventListener('pointerup',up); dodge.addEventListener('pointercancel',up);
    const bind=(id:string,fn:()=>void)=>{ const el=document.getElementById(id)!; el.addEventListener('pointerdown',e=>{ e.preventDefault(); this.audio.resume(); fn(); }); };
    bind('interact',()=>this.g.interact()); bind('btn-town',()=>this.g.townReturn()); bind('btn-stim',()=>this.g.useStim()); bind('btn-inv',()=>this.opts.onToggleInv());
  }
  aimMove(px:number,py:number,cx:number,cy:number,ptype:string){ const g=this.g; const id=g.build.abilities[this.aimBtn?.idx??0]; if(ptype==='mouse'){ const w=this.r.screenToWorld(px,py); g.updateAim(w.x,w.y,Math.hypot(w.x-g.px,w.y-g.py)>.7); return; }
    const dx=px-cx, dy=py-cy, L=Math.hypot(dx,dy); const v=this.r.screenVecToWorld(dx,dy); const vl=Math.hypot(v.x,v.y)||1; const range=id?(({sweep:3.2,bladeburst:5.5,reposition:6.5,control:9,pulse:8} as any)[id]||6):6; const k=Math.min(1,L/90); g.updateAim(g.px+v.x/vl*range*k,g.py+v.y/vl*range*k,L>16); }
}
