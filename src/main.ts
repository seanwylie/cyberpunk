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
function frame(now:number){ const dt=(now-last)/1000; last=now; if(!document.hidden){ input.tick(); game.update(dt); rend.draw(dt); ui.hud(); } frames++; ft+=dt; if(ft>=1){ fps=frames/ft; frames=0; ft=0; (window as any).__fps=fps; } requestAnimationFrame(frame); }
requestAnimationFrame(frame);
(window as any).__game=game; (window as any).__ui=ui; (window as any).__rend=rend; (window as any).__audio=audio; (window as any).__enemies=ENEMIES;
