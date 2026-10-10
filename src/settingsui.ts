// Settings modal: tabbed panel (left rail) with consistent rows, switches, sliders and segmented controls.
// Kept out of ui.ts so the main UI file stays small; ui.ts only hosts the hooks (settings(), input(), click(), esc(), render()).
import { RARITY_COLOR, applyUiScale } from './config';
import { persist, wipe } from './state';
import { makeProvider, MockProvider } from './story';
import { DUNGEONS } from './content/dungeons';
import { Q } from './quality';

type UIx=any;
const esc=(s:string)=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
export const TABS:[string,string][]=[['gameplay','Gameplay'],['display','Display & UI'],['audio','Audio'],['controls','Controls'],['instance','Instance'],['story','Story AI'],['about','About & Data']];
const TAB_KEY='wv_settings_tab';
const BVG='<span class="bvg"><span>With Big Viking Games</span><img src="/brand/bvg_logo_bone.png" alt="Big Viking Games" width="64"></span>';
let savedTab='gameplay'; try{ savedTab=localStorage.getItem(TAB_KEY)||'gameplay'; }catch{}
if(!TABS.some(t=>t[0]===savedTab)) savedTab='gameplay';
export const S={ tab:savedTab, confirm:null as null|string, adv:false, focus:'' as string, scroll:0, test:'' as string, testBusy:false };

const row=(label:string,help:string,ctl:string,opts:{tag?:'label'|'div';wide?:boolean;id?:string}={})=>{ const t=opts.tag||'div';
  return `<${t} class="srow"${t==='label'&&opts.id?` for="${opts.id}"`:''}><span class="stx"><b>${label}</b><small>${help}</small></span><span class="sctl${opts.wide?' wide':''}">${ctl}</span></${t}>`; };
const sw=(k:string,on:boolean,label:string)=>`<input type="checkbox" class="sw" role="switch" id="s-${k}" data-in="${k}" aria-label="${esc(label)}" ${on?'checked':''}/>`;
const seg=(k:string,cur:string,opts:[string,string,string?][],label:string)=>`<span class="seg" role="radiogroup" aria-label="${esc(label)}">${opts.map(([v,n,c])=>`<button type="button" class="segb${v===cur?' on':''}" role="radio" aria-checked="${v===cur}" tabindex="${v===cur?0:-1}" data-act="s-seg" data-in="${k}" data-v="${v}">${c?`<i class="sdot" style="background:${c}"></i>`:''}${esc(n)}</button>`).join('')}</span>`;
const slider=(k:string,v:number,label:string)=>`<input type="range" class="rng" min="0" max="1" step=".05" value="${v}" data-in="${k}" id="s-${k}" aria-label="${esc(label)}" style="--p:${Math.round(v*100)}%"/><output id="o-${k}" for="s-${k}">${Math.round(v*100)}%</output>`;
const head=(t:string,d:string)=>`<h2 class="sh">${t}</h2><p class="sd">${d}</p>`;
const kb=(...k:string[])=>`<span class="kcaps">${k.map(x=>`<kbd>${esc(x)}</kbd>`).join('')}</span>`;
const krow=(keys:string,what:string,note='')=>`<div class="krow">${keys}<span class="kw"><b>${what}</b>${note?`<small>${note}</small>`:''}</span></div>`;

export function settingsHtml(ui:UIx):string{
  const g=ui.g, st=g.save.settings, tab=S.tab; let c='';
  if(tab==='gameplay') c=head('Gameplay','How combat looks and what the game tells you about loot.')
    +row('Replay tutorial','Walk through the first-run guide again: contracts, the locker, the vendor and your first run.',`<button type="button" class="btn" data-act="replaytut">Replay tutorial</button>`)
    +row('Gore','How much blood and debris combat leaves behind.',seg('gore',st.gore,[['off','Off'],['standard','Standard'],['bloody','Bloody']],'Gore'))
    +row('Upgrade recommendations','Show the Recommended panel and ▲ badges in the locker and vendor.',sw('rechide',st.recHidden!==true,'Upgrade recommendations'),{tag:'label',id:'s-rechide'})
    +row('Recommendations: nudge on town return','Pop a short toast about your best upgrade when you get back to town.',sw('recnudge',st.recNudge!==false,'Recommendations nudge on town return'),{tag:'label',id:'s-recnudge'})
    +row('Damage numbers','Float the damage dealt above enemies.',sw('dmgnum',!!st.damageNumbers,'Damage numbers'),{tag:'label',id:'s-dmgnum'})
    +row('Loot labels','When item names appear above dropped loot.',seg('lootlabels',st.lootLabels,[['off','Off'],['near','Near / hover'],['all','All']],'Loot labels'))
    +row('Show loot from','Hide drops below this rarity. Hidden loot is still picked up.',seg('lootmin',st.lootMin,(['grey','green','blue','purple','orange'] as const).map(r=>[r,r[0].toUpperCase()+r.slice(1),(RARITY_COLOR as any)[r]] as [string,string,string]),'Minimum loot rarity'));
  else if(tab==='display') c=head('Display & UI','Text size and screen effects. UI size also scales with your window.')
    +row('UI size','Scales all text and panels. Larger is easier to read; smaller fits more.',seg('uisize',st.uiSize||'M',[['S','S'],['M','M'],['L','L'],['XL','XL']],'UI size'))
    +row('Minimap','Show the minimap during runs. Press N to toggle it anywhere.',sw('minimap',st.minimap!==false,'Minimap'),{tag:'label',id:'s-minimap'})
    +row('Graphics quality','Auto picks for your device and adapts to keep the frame rate up. High is the full desktop look; Medium and Low trade resolution and effects for speed and battery. Now: '+Q.describe()+'.',seg('quality',st.quality||'auto',[['auto','Auto'],['high','High'],['medium','Medium'],['low','Low']],'Graphics quality'))
    +row('FPS overlay','Show frame rate and render resolution (F3 on desktop).',sw('showfps',!!st.showFps,'FPS overlay'),{tag:'label',id:'s-showfps'})
    +row('Reduced incidental effects','Tones down flashes, shake and ambient particles. Combat telegraphs stay.',sw('reduced',!!st.reducedFx,'Reduced incidental effects'),{tag:'label',id:'s-reduced'});
  else if(tab==='audio') c=head('Audio','Volumes are saved per browser. Master scales everything.')
    +row('Master volume','Overall loudness.',slider('vol',st.volume,'Master volume'),{wide:true})
    +row('Music','Turn the soundtrack on or off (M also toggles).',sw('music',!!st.music,'Music'),{tag:'label',id:'s-music'})
    +row('Music volume','Soundtrack level relative to master.',slider('musicvol',st.musicVol??1,'Music volume'),{wide:true})
    +row('Effects volume','Combat, pickups and interface sounds. Release the slider to hear a sample.',slider('sfxvol',st.sfxVol??1,'Effects volume')+`<button type="button" class="btn" data-act="s-preview">Test</button>`,{wide:true});
  else if(tab==='controls') c=head('Controls','Keyboard and mouse on desktop. Touch layout below.')
    +`<div class="kgrid">`
    +krow(kb('W','A','S','D'),'Move','Arrow keys also work')
    +krow(kb('Q','E','R'),'Aim and cast abilities','Hold to aim toward the cursor, release to cast. 1 / 2 / 3 work too')
    +krow(kb('Space'),'Dodge','Also cancels aiming, even on cooldown')
    +krow(kb('Click'),'Target an enemy','X or right-click clears the target')
    +krow(kb('X'),'Clear target')
    +krow(kb('F'),'Interact','Doors, caches, terminals')
    +krow(kb('C'),'Contacts','In town')
    +krow(kb('T'),'Use stim')
    +krow(kb('B'),'Return to town','Channelled; moving or taking damage interrupts')
    +krow(kb('I'),'Live pack','Items carried in a run')
    +krow(kb('M'),'Mute music')
    +krow(kb('N'),'Toggle minimap')
    +krow(kb('Esc'),'Close panel or clear target')
    +`</div><h3 class="sh2">Touch (landscape)</h3><div class="kgrid">`
    +krow('<span class="kcaps"><kbd>Drag</kbd></span>','Move','Joystick on the left side')
    +krow('<span class="kcaps"><kbd>Hold</kbd></span>','Aim abilities','Hold and drag an ability button, release to cast, drag far away to cancel')
    +krow('<span class="kcaps"><kbd>Tap</kbd></span>','Target an enemy')
    +`</div>`+row('Tutorial hints','Show the first-time tips again.',`<button type="button" class="btn" data-act="resethints">Show tutorial hints again</button>`)+row('Fixed joystick','Keep the touch joystick at a fixed spot instead of appearing under your thumb.',sw('joyfixed',!!st.joystickFixed,'Fixed joystick'),{tag:'label',id:'s-joyfixed'});
  else if(tab==='instance') c=head('Instance','An instance is your current dungeon run. Its map and loot are generated once and kept until it expires or you leave it.')+instanceHtml(ui);
  else if(tab==='story') c=storyHtml(ui);
  else c=aboutHtml(ui);
  const tabs=TABS.map(([id,n])=>`<button type="button" class="stab${id===tab?' on':''}" role="tab" id="stab-${id}" aria-selected="${id===tab}" aria-controls="spanel" tabindex="${id===tab?0:-1}" data-act="s-tab" data-tab="${id}">${esc(n)}</button>`).join('');
  return `<div class="stabs" role="tablist" aria-orientation="vertical" aria-label="Settings sections">${tabs}</div><div class="sbody" id="spanel" role="tabpanel" aria-labelledby="stab-${tab}" tabindex="-1">${c}</div>`;
}

function confirmBox(id:string,msg:string,go:string,label:string,danger=true){ if(S.confirm!==id) return ''; return `<div class="sconf${danger?' danger':''}" role="alertdialog" aria-label="Confirm"><p>${msg}</p><span class="sbtns"><button type="button" class="btn ${danger?'dng':'primary'}" data-act="${go}">${label}</button><button type="button" class="btn" data-act="s-cancel">Cancel</button></span></div>`; }

function instanceHtml(ui:UIx):string{ const g=ui.g, i=g.resetInfo(); const run=g.mode==='run';
  if(!i.has) return `<div class="scard"><b>No active instance</b><small>Enter a dungeon from the gate in town to start one. Nothing to reset right now.</small></div>`;
  const d=DUNGEONS[i.id]; let h=`<div class="scard"><b>${esc(d?.name||i.id)}</b><small>${esc(i.why)}</small></div>`;
  h+=row('Reset instance',`Throw this run away and roll a fresh map. ${i.lost?i.lost+' uncollected loot item(s) are lost. ':''}Your repair bill is kept.${i.dev?' (prototype override active)':''}`,`<button type="button" class="btn${i.allowed?'':' dim'}" data-act="s-ask" data-c="reset" ${i.allowed?'':'disabled'}>Reset instance</button>`);
  h+=confirmBox('reset',`Reset ${esc(d?.short||i.id)}? ${run?'You restart at the entry immediately.':'You can then start a fresh run.'}`,'s-reset-go','Yes, reset');
  if(run) h+=row('Restart from checkpoint','Return to your last checkpoint in this same map.',`<button type="button" class="btn" data-act="restart-cp">Restart from checkpoint</button>`);
  if(!run){ h+=row('Abandon instance','Close it and forfeit remaining loot. No new run until the daily lockout allows.',`<button type="button" class="btn" data-act="s-ask" data-c="abandon">Abandon</button>`);
    h+=confirmBox('abandon','Abandon this instance and forfeit its loot? This cannot be undone.','s-abandon-go','Yes, abandon'); }
  return h; }

function badgeHtml(l:any):string{ const real=l.enabled&&l.url&&l.key; return real?`<span class="sbadge ok">Real provider active</span>`:l.enabled?`<span class="sbadge warn">Incomplete: using mock</span>`:`<span class="sbadge">Offline mock</span>`; }
function storyHtml(ui:UIx):string{ const st=ui.g.save.settings, l=st.llm; const p=makeProvider(l).name;
  const badge=badgeHtml(l);
  return head('Story AI','The fixer and contacts get new story beats from a provider. It never touches bosses, drops or access.')
  +`<div class="scard"><b>Status ${badge}</b><small>Active provider: ${esc(p)}. The offline mock needs no setup and sends nothing anywhere. A real provider is any OpenAI-compatible chat-completions endpoint; it is called only when a story update runs outside combat.</small></div>`
  +row('Use a real provider','Off = offline mock. Needs a URL and key below.',sw('llmon',!!l.enabled,'Use a real provider'),{tag:'label',id:'s-llmon'})
  +`<div class="sfields${l.enabled?'':' off'}"><label class="sf"><b>Endpoint URL</b><input type="text" data-in="llmurl" placeholder="https://…/v1/chat/completions" value="${esc(l.url)}" autocomplete="off" spellcheck="false" ${l.enabled?'':'disabled'}/></label>`
  +`<label class="sf"><b>API key</b><input type="password" data-in="llmkey" placeholder="API key" value="${esc(l.key)}" autocomplete="off" ${l.enabled?'':'disabled'}/></label>`
  +`<label class="sf"><b>Model id</b><input type="text" data-in="llmmodel" placeholder="model id" value="${esc(l.model)}" autocomplete="off" spellcheck="false" ${l.enabled?'':'disabled'}/></label></div>`
  +`<div class="srow"><span class="stx"><b>Test connection</b><small>${(l.enabled&&l.url&&l.key)?'Sends one tiny request to your endpoint.':'Checks the offline mock (always available).'}</small></span><span class="sctl"><button type="button" class="btn" data-act="s-test" ${S.testBusy?'disabled':''}>${S.testBusy?'Testing…':'Test connection'}</button></span></div>`
  +`<div class="stest" role="status" aria-live="polite">${esc(S.test)}</div><p class="sd">Stored only in this browser's localStorage and sent only to the endpoint you enter.</p>`; }

function aboutHtml(ui:UIx):string{ const st=ui.g.save.settings;
  return head('About & Data','')
  +`<div class="scard"><b>Warranty Void</b><small>An isometric cyberpunk loot-ARPG prototype. Void where prohibited.</small><span class="abt">${BVG}</span></div>`
  +`<h3 class="sh2">Save data</h3>`
  +row('Wipe save','Permanently deletes your character, gear, credits and story progress from this browser, then reloads.',`<button type="button" class="btn dng" data-act="s-ask" data-c="wipe1">Wipe save…</button>`)
  +confirmBox('wipe1','This deletes <b>everything</b> saved in this browser. Continue?','s-wipe-2','Continue')
  +confirmBox('wipe2','<b>Last chance.</b> Your save cannot be recovered after this.','s-wipe-go','Yes, wipe everything and reload')
  +`<button type="button" class="sadv" data-act="s-adv" aria-expanded="${S.adv}" aria-controls="sadv"><span class="car">${S.adv?'▾':'▸'}</span> Advanced</button>`
  +`<div id="sadv" ${S.adv?'':'hidden'}>`
  +row('<b>PROTOTYPE:</b> allow resetting cleared dungeons','Refunds the daily lockout when you reset. The spec forbids this; prototype only.',sw('devreset',!!st.devFreeReset,'Prototype: allow resetting cleared dungeons'),{tag:'label',id:'s-devreset'})
  +row('DEV tools','Grant kits, set level, credits. Test shortcuts (also the ` key).',`<button type="button" class="btn" data-act="dev">Open DEV tools</button>`)
  +`</div>`; }

/** called by UI after every modal render */
export function settingsAfterRender(ui:UIx){ if(ui.modal!=='settings') return; const sb=document.querySelector<HTMLElement>('.sbody'); if(sb) sb.scrollTop=S.scroll;
  if(S.focus){ try{ (document.querySelector(S.focus) as HTMLElement|null)?.focus({preventScroll:true}); }catch{} } }
export function settingsReset(){ S.confirm=null; S.test=''; S.testBusy=false; S.focus='#stab-'+S.tab; S.scroll=0; }
/** Esc inside Settings: dismiss a pending confirmation first. Returns true when consumed. */
export function settingsEsc(ui:UIx):boolean{ if(S.confirm){ S.confirm=null; keep(ui); return true; } return false; }

const sel=(el:HTMLElement)=>{ const d=el.dataset; let s=el.tagName.toLowerCase(); if(d.act) s+=`[data-act="${d.act}"]`; if(d.in) s+=`[data-in="${d.in}"]`; if(d.v) s+=`[data-v="${d.v}"]`; if(d.tab) s+=`[data-tab="${d.tab}"]`; if(d.c) s+=`[data-c="${d.c}"]`; return s; };
function keep(ui:UIx,focusEl?:HTMLElement|null,reset=false){ const sb=document.querySelector<HTMLElement>('.sbody'); S.scroll=reset?0:(sb?sb.scrollTop:0); S.focus=focusEl?sel(focusEl):''; ui.render(); }
function setTab(ui:UIx,id:string,focus=true){ if(!TABS.some(t=>t[0]===id)) return; S.tab=id; S.confirm=null; try{ localStorage.setItem(TAB_KEY,id); }catch{} S.focus=focus?'#stab-'+id:''; S.scroll=0; ui.render(); }

const KEYS=new Set(['quality','showfps','gore','dmgnum','lootlabels','lootmin','uisize','reduced','rechide','recnudge','minimap','joyfixed','music','vol','musicvol','sfxvol','llmon','llmurl','llmkey','llmmodel','devreset']);
/** returns true if handled. v is the new value (string for selects/ranges/text, boolean for switches) */
function apply(ui:UIx,k:string,v:any,final=true){ const g=ui.g, s=g.save, st=s.settings;
  switch(k){
    case 'gore': st.gore=v; break; case 'dmgnum': st.damageNumbers=!!v; break; case 'lootlabels': st.lootLabels=v; break; case 'lootmin': st.lootMin=v; break;
    case 'uisize': st.uiSize=v; applyUiScale(v); break; case 'reduced': st.reducedFx=!!v; document.body.classList.toggle('reducefx',!!v); break; case 'joyfixed': st.joystickFixed=!!v; break;
    case 'music': st.music=!!v; ui.audio.setMusicOn(!!v); break;
    case 'vol': st.volume=+v; ui.audio.setVolume(st.volume); if(final) preview(ui); break;
    case 'musicvol': st.musicVol=+v; ui.audio.setMusicVolume(st.musicVol); break;
    case 'sfxvol': st.sfxVol=+v; ui.audio.setSfxVolume(st.sfxVol); if(final) preview(ui); break;
    case 'llmon': st.llm.enabled=!!v; break; case 'llmurl': st.llm.url=v; break; case 'llmkey': st.llm.key=v; break; case 'llmmodel': st.llm.model=v; break;
    case 'rechide': st.recHidden=!v; break; case 'recnudge': st.recNudge=!!v; break;
    case 'quality': st.quality=v; Q.setPref(v); break; case 'showfps': st.showFps=!!v; Q.showFps=!!v; break;
    case 'minimap': ui.setMinimap(!!v); return;
    case 'devreset': st.devFreeReset=!!v; break; }
  persist(s); }
function preview(ui:UIx){ ui.audio.resume(); setTimeout(()=>{ ui.audio.sfx('pickup'); ui.audio.sfx('hit'); },30); }

export function settingsInput(ui:UIx,e:Event):boolean{ if(ui.modal!=='settings') return false; const t=e.target as HTMLInputElement; const k=t.dataset?.in; if(!k||!KEYS.has(k)) return false;
  if(t.type==='range'){ const v=+t.value; t.style.setProperty('--p',Math.round(v*100)+'%'); const o=document.getElementById('o-'+k); if(o) o.textContent=Math.round(v*100)+'%'; apply(ui,k,v,e.type==='change'); return true; }
  if(t.type==='checkbox'){ apply(ui,k,t.checked); if(k==='llmon'||k==='devreset'||k==='reduced'||k==='music'||k==='dmgnum'||k==='joyfixed'){ if(k==='llmon'||k==='devreset') keep(ui,t); } return true; }
  apply(ui,k,t.value); if(k.startsWith('llm')){ const b=document.querySelector('.sbadge'); if(b) b.outerHTML=badgeHtml(ui.g.save.settings.llm); } return true; }

export function settingsClick(ui:UIx,el:HTMLElement,a:string):boolean{ const g=ui.g; ui.audio.resume();
  switch(a){
    case 's-tab': setTab(ui,el.dataset.tab!); return true;
    case 's-seg': apply(ui,el.dataset.in!,el.dataset.v!); keep(ui,el); return true;
    case 's-preview': preview(ui); return true;
    case 's-ask': S.confirm=el.dataset.c!; keep(ui,null); { const b=document.querySelector<HTMLElement>('.sconf .btn'); b?.focus(); S.focus=b?sel(b):''; } return true;
    case 's-cancel': { const c=S.confirm; S.confirm=null; keep(ui,null); const b=document.querySelector<HTMLElement>(c?`[data-act="s-ask"][data-c="${c}"]`:'.sbody .btn'); b?.focus(); return true; }
    case 's-reset-go': S.confirm=null; if(g.resetInstance()&&g.mode==='run') ui.close(); else keep(ui); return true;
    case 's-abandon-go': S.confirm=null; g.abandonInstance(); keep(ui); return true;
    case 's-wipe-2': S.confirm='wipe2'; keep(ui,null); { const b=document.querySelector<HTMLElement>('.sconf .btn'); b?.focus(); S.focus=b?sel(b):''; } return true;
    case 's-wipe-go': wipe(); location.reload(); return true;
    case 's-adv': S.adv=!S.adv; keep(ui,el); return true;
    case 's-test': void testConnection(ui); return true; }
  return false; }

async function testConnection(ui:UIx){ const l=ui.g.save.settings.llm; S.testBusy=true; S.test='Testing…'; keep(ui,document.querySelector<HTMLElement>('[data-act="s-test"]'));
  const t0=performance.now();
  try{
    if(!(l.enabled&&l.url&&l.key)){ await new MockProvider(); S.test=l.enabled?'Real provider is enabled but the URL or key is missing, so the offline mock is used. Mock: OK.':'Offline mock is active. Mock: OK (no network used).'; }
    else { const ctl=new AbortController(); const to=setTimeout(()=>ctl.abort(),10000);
      try{ const r=await fetch(l.url,{method:'POST',signal:ctl.signal,headers:{'Content-Type':'application/json','Authorization':'Bearer '+l.key},body:JSON.stringify({model:l.model||'gpt',max_tokens:1,messages:[{role:'user',content:'ping'}]})}); const ms=Math.round(performance.now()-t0); S.test=r.ok?`Connected: HTTP ${r.status} in ${ms} ms.`:`Endpoint answered HTTP ${r.status} (${ms} ms). Check the URL, key and model id.`; } finally { clearTimeout(to); } }
  }catch(err:any){ S.test='Could not reach the endpoint: '+(err?.name==='AbortError'?'timed out after 10 s':'network or CORS error')+'.'; }
  S.testBusy=false; if(ui.modal==='settings') keep(ui,document.querySelector<HTMLElement>('[data-act="s-test"]')); }

/** keyboard on the modal: Esc, arrow navigation for the tab rail and segmented controls, Space/Enter kept from reaching the game */
export function settingsKey(ui:UIx,e:KeyboardEvent){ if(ui.modal!=='settings') return; const t=e.target as HTMLElement;
  if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); ui.esc(); return; }
  if(e.key===' ') e.stopPropagation();
  const grp=t.closest?.('[role=tablist],[role=radiogroup]') as HTMLElement|null; if(!grp) return;
  const tabs=grp.getAttribute('role')==='tablist'; const items=Array.from(grp.querySelectorAll<HTMLElement>(tabs?'[role=tab]':'[role=radio]')); const i=items.indexOf(t); if(i<0) return;
  let n=-1; const fwd=tabs?['ArrowDown','ArrowRight']:['ArrowRight','ArrowDown'], back=tabs?['ArrowUp','ArrowLeft']:['ArrowLeft','ArrowUp'];
  if(fwd.includes(e.key)) n=(i+1)%items.length; else if(back.includes(e.key)) n=(i-1+items.length)%items.length; else if(e.key==='Home') n=0; else if(e.key==='End') n=items.length-1; if(n<0) return;
  e.preventDefault(); e.stopPropagation(); items[n].focus(); items[n].click(); }
