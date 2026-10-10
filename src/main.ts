import { Game } from './sim';
import { Renderer } from './render';
import { Input } from './input';
import { UI } from './ui';
import { AudioSys } from './audio';
import { load, persist } from './state';
import { newStory } from './story';
import './dungeon_fx';
import { ENEMIES, applyUiScale } from './config';

try{ (document as any).fonts?.load('600 14px "Roboto Condensed"'); }catch{}
const save=load(); if(!save.story) save.story=newStory();
applyUiScale(save.settings.uiSize||'M'); const audio=new AudioSys(); audio.vol=save.settings.volume; audio.musicOn=save.settings.music;
if((save as any)._chipMigrated){ persist(save); }
let ui:UI;
const game=new Game(save,(t,p)=>{ if(t==='sfx') audio.sfx(p); else if(t==='musickey') audio.setMusicKey(p); else if(t==='music') audio.setState(p); else ui?.handle(t,p); });
ui=new UI(game,audio);
const canvas=document.getElementById('game') as HTMLCanvasElement; const rend=new Renderer(canvas,game);
const input=new Input(game,rend,audio,{ modalOpen:()=>ui.modalOpen(), onToggleInv:()=>ui.toggleLive(), onEsc:()=>ui.esc() },canvas);
const resize=()=>{ applyUiScale(); rend.resize(); }; window.addEventListener('resize',resize); resize();
// Resume an existing, unexpired instance suspended by an interruption (solo save/suspend): offer it at the gate.
if(save.instance&&save.instance.expiresAt>Date.now()){ game.inst=save.instance; setTimeout(()=>ui.toast('Suspended run found: re-enter via the Annex gate. Boss state resets; loot and kills persist.'),400); }
else if(save.instance){ save.instance=null; persist(save); }
if((save as any)._chipMigrated) setTimeout(()=>ui.toast((save as any)._chipMigrated+' chip(s) did not fit their body part and were moved back to stock.'),800);
let last=performance.now(); let acc=0, frames=0, fps=60, ft=0;
// dev FPS overlay: F3 or ?fps. One fixed DOM node, text updated once per second (no per-frame DOM work).
const fpsEl=document.createElement('div'); fpsEl.id='fpsOverlay'; fpsEl.style.cssText='position:fixed;left:6px;top:6px;z-index:9999;font:12px monospace;color:#9f9;background:rgba(0,0,0,.6);padding:2px 6px;pointer-events:none;display:none'; document.body.appendChild(fpsEl);
let fpsOn=new URLSearchParams(location.search).has('fps'); fpsEl.style.display=fpsOn?'block':'none'; let wMax=0;
window.addEventListener('keydown',e=>{ if(e.key==='F3'){ e.preventDefault(); fpsOn=!fpsOn; fpsEl.style.display=fpsOn?'block':'none'; } });
function frame(now:number){ const dt=(now-last)/1000; last=now; if(!document.hidden){ input.tick(); game.update(dt); rend.draw(dt); ui.hud(); } frames++; ft+=dt; wMax=Math.max(wMax,dt*1000); if(ft>=1){ fps=frames/ft; if(fpsOn) fpsEl.textContent=fps.toFixed(0)+' fps  worst '+wMax.toFixed(0)+'ms'; wMax=0; frames=0; ft=0; (window as any).__fps=fps; } requestAnimationFrame(frame); }
requestAnimationFrame(frame);
(window as any).__game=game; (window as any).__ui=ui; (window as any).__rend=rend; (window as any).__audio=audio; (window as any).__enemies=ENEMIES;
