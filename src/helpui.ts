import { KEYS, key } from './config';
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'} as any)[c]);
const kb=(...k:string[])=>`<span class="kcaps">${k.map(x=>`<kbd>${esc(x)}</kbd>`).join('')}</span>`;
const row=(k:string,what:string,note='')=>`<div class="krow">${k}<span class="kw"><b>${what}</b>${note?`<small>${note}</small>`:''}</span></div>`;
/** Controls overlay (tray "?" button, H or F1). Every key cap comes from KEYS. */
export function helpHtml():string{
  return `<div class="helpbody"><p class="mut">Everything you can press. Press ${esc(key('help'))} or Esc, or click outside, to close.</p><div class="helpcols"><div><h3 class="sh2">Keyboard and mouse</h3><div class="kgrid">`
  +row(kb(KEYS.moveUp,KEYS.moveLeft,KEYS.moveDown,KEYS.moveRight),'Move','Arrow keys also work')
  +row(kb(KEYS.aim1,KEYS.aim2,KEYS.aim3),'Aim and cast abilities','Hold to aim, release to cast. 1 / 2 / 3 also work')
  +row(kb(KEYS.dodge),'Dodge')+row(kb('Click'),'Target an enemy','X or right-click clears it')
  +row(kb(KEYS.interact),'Interact','Doors, caches, terminals')+row(kb(KEYS.contacts),'Contacts','In town')
  +row(kb(KEYS.stim),'Use stim')+row(kb(KEYS.town),'Return to town','Channelled; damage or moving interrupts')
  +row(kb(KEYS.pack),'Live pack','Items carried in a run')+row(kb(KEYS.minimap),'Toggle minimap')+row(kb(KEYS.music),'Mute music')
  +row(kb(KEYS.help,'F1'),'This help')+row(kb(KEYS.menu),'Close panel / clear target')
  +`</div></div><div><h3 class="sh2">Touch</h3><div class="kgrid">`
  +row(kb('Drag'),'Move','Joystick on the left')+row(kb('Hold'),'Aim abilities','Hold and drag an ability button, release to cast, drag away to cancel')
  +row(kb('Tap'),'Target an enemy')+row(kb('Interact'),'Interact','Prompt at the bottom of the screen')
  +row(kb('Town'),'Return to town','Top-right tray')+row(kb('Menu'),'Settings','Top-right tray')
  +`</div></div></div><div class="helpact"><button type="button" class="btn primary" data-act="helpreplay">Replay tutorial</button><button type="button" class="btn" data-act="helphints">Show hints</button><button type="button" class="btn" data-act="helpsettings">All settings</button></div></div>`;
}
