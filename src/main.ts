import { idkfaActive } from './idkfa_toggle';
import { viewCode } from './buildui';
import './memtrack';
import { Game } from './sim';
import { Renderer } from './render';
import { Input } from './input';
import { UI } from './ui';
import { AudioSys } from './audio';
import { load, persist } from './state';
import { newStory } from './story';
import { StoryBeats, showStoryCard } from './story_beats';
import './dungeon_fx';
import { ENEMIES, applyUiScale } from './config';
import { Q } from './quality';
import { initMobile, registerSW } from './mobile';
import { Tutorial } from './tutorial';
import { initNet } from './net';
import { showCharsOnLoad } from './charselui';
import { cityEvent, cityInit } from './cityclient';

try{ (document as any).fonts?.load('600 14px "Roboto Condensed"'); }catch{}
import { buildTownLevel } from './worldtowns';
const save=load(); if(!save.story) save.story=newStory();
applyUiScale(save.settings.uiSize||'M'); const audio=new AudioSys(); audio.vol=save.settings.volume; audio.musicOn=save.settings.music; audio.musicVol=save.settings.musicVol??1; audio.sfxVol=save.settings.sfxVol??1;
if((save as any)._chipMigrated){ persist(save); }
Q.setPref(save.settings.quality||'auto'); Q.showFps=!!save.settings.showFps;
let ui:UI; let tut:Tutorial|undefined; let beats:StoryBeats|undefined;
cityInit();
const game=new Game(save,(t,p)=>{ tut?.event(t,p); cityEvent(game,t,p); if(t==='sfx') audio.sfx(p); else if(t==='musickey') audio.setMusicKey(p); else if(t==='musicretry') audio.noteMusicRetry(); else if(t==='musicphase') audio.setMusicPhase(p); else if(t==='stinger') audio.stinger(p); else if(t==='musicnudge') audio.nudgeMusic(); else if(t==='musicarea') audio.setMusicArea(p); else if(t==='towntheme') audio.setTownTheme(p); else if(t==='music') audio.setState(p); else if(t==='beat') beats?.fire(p); else ui?.handle(t,p); });
ui=new UI(game,audio);
beats=new StoryBeats(()=>game.save); ui.beats=beats; beats.onEntry=e=>{ ui.syncStoryDot(); showStoryCard(e,()=>game.mode==='town'&&!ui.modal&&!(tut&&!tut.disabled&&game.save.tutorial?.status==='active'),document.getElementById('toasts'),en=>ui.openStory(en)); if(ui.modal==='fixer') ui.render(); }; (window as any).__beats=beats;
const canvas=document.getElementById('game') as HTMLCanvasElement; const rend=new Renderer(canvas,game);
tut=new Tutorial(game,ui,rend); ui.tut=tut; try{ initNet(game,rend); }catch(e){ console.warn('multiplayer init failed (solo unaffected)',e); }
game.townPreload=async id=>{ if(id!=='rustline') await rend.preloadTown(id,buildTownLevel(id)); };
const input=new Input(game,rend,audio,{ modalOpen:()=>ui.modalOpen(), onToggleInv:()=>ui.toggleLive(), onEsc:()=>ui.esc() },canvas);
const resize=()=>{ applyUiScale(); rend.resize(); (ui as any).fitModal?.(); }; window.visualViewport?.addEventListener('resize',()=>(ui as any).fitModal?.()); window.visualViewport?.addEventListener('scroll',()=>(ui as any).fitModal?.()); window.addEventListener('resize',resize); Q.onChange=()=>{ rend.resize(); }; resize();
registerSW();
// memory-pressure watchdog: JS heap near its limit (or a very low-memory device) -> free idle decoded music and step the quality tier down (Auto only).
setInterval(()=>{ try{ if(document.hidden) return; const pm=(performance as any).memory; if(pm&&pm.jsHeapSizeLimit&&pm.usedJSHeapSize/pm.jsHeapSizeLimit>.7){ audio.music?.dropIdle(); Q.lowMem('js heap '+Math.round(pm.usedJSHeapSize/1048576)+'MB'); } }catch{} },5000); initMobile(game,audio,()=>{ applyUiScale(); rend.resize(); });
// Resume an existing, unexpired instance suspended by an interruption (solo save/suspend): offer it at the gate.
if(save.instance&&save.instance.expiresAt>Date.now()){ game.inst=save.instance; setTimeout(()=>ui.toast('Suspended run found: re-enter via the Annex gate. Boss state resets; loot and kills persist.'),400); }
else if(save.instance){ save.instance=null; persist(save); }
if((save as any)._chipMigrated) setTimeout(()=>ui.toast((save as any)._chipMigrated+' chip(s) did not fit their body part and were moved back to stock.'),800);
let last=performance.now(); let acc=0, frames=0, fps=60, ft=0;
// dev FPS overlay: F3 or ?fps. One fixed DOM node, text updated once per second (no per-frame DOM work).
const fpsEl=document.createElement('div'); fpsEl.id='fpsOverlay'; fpsEl.style.cssText='position:fixed;left:6px;top:6px;z-index:9999;font:12px monospace;color:#9f9;background:rgba(0,0,0,.6);padding:2px 6px;pointer-events:none;display:none'; document.body.appendChild(fpsEl);
let fpsOn=new URLSearchParams(location.search).has('fps'); fpsEl.style.display=fpsOn?'block':'none'; let wMax=0;
window.addEventListener('keydown',e=>{ if(e.key==='F3'){ e.preventDefault(); Q.showFps=!Q.showFps; save.settings.showFps=Q.showFps; persist(save); } });
function frame(now:number){ const dt=(now-last)/1000; last=now; Q.sample(dt*1000); const fo=fpsOn||Q.showFps; if(fo!==(fpsEl.style.display==='block')) fpsEl.style.display=fo?'block':'none'; if(!document.hidden){ input.tick(); game.update(dt); rend.draw(dt); ui.hud(); tut?.tick(); } frames++; ft+=dt; wMax=Math.max(wMax,dt*1000); if(ft>=1){ fps=frames/ft; if(fo) fpsEl.textContent=fps.toFixed(0)+' fps  worst '+wMax.toFixed(0)+'ms  '+rend.canvas.width+'x'+rend.canvas.height+'  '+Q.tier+(Q.pref==='auto'?'*':''); wMax=0; frames=0; ft=0; (window as any).__fps=fps; } requestAnimationFrame(frame); }
requestAnimationFrame(frame);
import('./version').then(v=>v.startVersionWatch());
// living city UI (faction banner, news panel, street chatter): lazy, after first paint; news + chatter are behind feature flags inside
setTimeout(()=>{ import('./cityui').then(m=>m.initCityUi(game,ui)).catch(e=>console.warn('city ui failed (game unaffected)',e)); },2500);
(window as any).__game=game; (window as any).__ui=ui; { const sync=()=>{ const b=document.getElementById('idkfabadge'); if(b) b.style.display=idkfaActive(game.save)?'inline-block':'none'; }; sync(); setInterval(sync,500); } if(showCharsOnLoad()) setTimeout(()=>{ if(!ui.modal) ui.open('chars'); },50); { const bc=new URLSearchParams(location.search).get('build'); if(bc) setTimeout(()=>viewCode(ui,bc),800); } (window as any).__tut=tut; (window as any).__rend=rend; (window as any).__audio=audio; (window as any).__enemies=ENEMIES;
