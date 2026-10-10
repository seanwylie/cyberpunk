import { Game } from './sim';
import { applyUiScale } from './config';
import { specOf, iconCanvas } from './lootart';
import { AudioSys } from './audio';
import { chipFits, chipFitLabel, chipReason, CHIP_FITS, SLOT_GROUP, GROUP_LABEL, ABILITIES, ABILITY_TYPE_COLOR, ABILITY_TYPE_LABEL, CHIPS, ChipId, COMBAT, ENEMIES, INSTALL_COST, ITEM_BY_ID, ITEMS, MFR, RARITY_COLOR, REP_DISCOUNT_PER_RANK, SELL_VALUE, SLOT_LABEL, SLOT_SOCKETS, SLOTS, Slot, Stats, REPAIR_COST, RARITIES, STARTING, PROGRESSION, ItemDef, WEAPONS, WEAPON_RARITY_MUL } from './config';
import { recommend, Rec, RecResult, repDiscount } from './recommend';
import { Layout, cloneLayout, computeBuild, hardConflicts, installedLayout, repRank, wouldConflict } from './build';
import { Inst, capacityUsed, lockerItems, mkInst, persist, wipe, todayStr, newSave } from './state';
import { makeProvider, runStoryStep, newStory, MockProvider, record } from './story';
import { DUNGEON_LIST, DUNGEONS, dungeonOf, inBand, unlockReason } from './content/dungeons';
import { CONTACTS, CONTACT_BY_ID, CONTRACT_BY_ID, MAX_ACTIVE_CONTRACTS, ContractDef } from './content/npcs';
import { EXTRA_ITEMS } from './content/items';
import { WEAPON_ITEMS } from './content/weapons';
import { lockDay, contractState } from './state';
import { settingsHtml, settingsAfterRender, settingsReset, settingsEsc, settingsInput, settingsClick, settingsKey } from './settingsui';

export const abIconUrl=(id:string)=>'abilities/'+id+'.webp';
const abChip=(id:keyof typeof ABILITIES)=>{ const d=ABILITIES[id]; return `<span class="abchip" style="--tc:${ABILITY_TYPE_COLOR[d.type]}" title="${esc(ABILITY_TYPE_LABEL[d.type])}: ${esc(d.desc)}"><img src="${abIconUrl(id)}" alt="">${esc(d.name)}</span>`; };
const abChips=(ids:(keyof typeof ABILITIES)[],sep=' ')=>ids.map(abChip).join(sep);


const $=(id:string)=>document.getElementById(id)!;
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
export const BUILD_KITS:Record<string,{name:string;items:Partial<Record<Slot,string>>;chips:Partial<Record<ChipId,number>>}> = {
  A:{ name:'Ripper & cooling (heavy industrial)', items:{ armR:'hi_ripper_arm', handR:'hi_cutting_head', handL:'hi_clamp', legL:'hi_legs_l', legR:'hi_legs_r', torso:'hi_torso_cool' }, chips:{ speed:2, cutwide:1, coolant:3, sustain:2, power:1, plating:1 } },
  B:{ name:'Cloak & blade (precision surgical)', items:{ armR:'ps_blade_arm', handR:'ps_blade_hand_r', handL:'ps_blade_hand_l', torso:'ps_veil_torso', legL:'ps_legs_l', legR:'ps_legs_r', face:'ps_face' }, chips:{ speed:2, bladepat:1, cloakdur:2, coolant:2, sustain:2 } },
  C:{ name:'Neural control & refurbished tools (mixed)', items:{ brain:'ps_brain', handR:'mm_slug_hand', armL:'mm_arm_l', armR:'mm_arm_r', torso:'mm_torso_defib' }, chips:{ ctrldur:2, coolant:2, sustain:2, power:2 } },
};
const STAT_L:Record<keyof Stats,string>={maxHp:'HP',dmg:'DMG',atkSpeed:'ATK',cooling:'COOL',move:'MOVE',armor:'ARM',regen:'REG',pickup:'PICK'};
const fmtN=(v:number)=>Math.abs(v)>=10?String(Math.round(v)):String(Math.round(v*100)/100);
const fmtStats=(s:Stats)=>`HP ${Math.round(s.maxHp)} · DMG ×${s.dmg.toFixed(2)} · ATK ×${s.atkSpeed.toFixed(2)} · COOL ×${s.cooling.toFixed(2)} · MOVE ×${s.move.toFixed(2)} · ARMOR ${s.armor} · REGEN ${s.regen.toFixed(1)}/s · PICKUP +${s.pickup.toFixed(1)}`;
const diff=(a:number,b:number,f=(n:number)=>n.toFixed(2))=>{ const d=b-a; if(Math.abs(d)<1e-6) return ''; return `<span class="${d>0?'up':'dn'}">${d>0?'+':''}${f(d)}</span>`; };
const rc=(r:string)=>RARITY_COLOR[r as keyof typeof RARITY_COLOR];

const BVG='<span class="bvg"><span>With Big Viking Games</span><img src="/brand/bvg_logo_bone.png" alt="Big Viking Games" width="64"></span>';
export class UI {
  modal:string|null=null; draft:Layout|null=null; sel:Slot='torso'; search=''; confirm:any=null; msg=''; storyMsg=''; liveOpen=false; bannerT=0; toastCount=0; storyBusy=false; devOpen=false; lastKey=''; showAll=false; resetAsk=false; contactSel='odalys_vane';
  constructor(private g:Game, private audio:AudioSys){
    this.bindAbilityTips(); this.bindHelp(); this.syncTray(); document.getElementById('btn-map')!.addEventListener('pointerdown',e=>{ e.preventDefault(); this.setMinimap(this.g.save.settings.minimap===false); });
    $('modal').addEventListener('click',e=>this.click(e)); $('modal').addEventListener('input',e=>this.input(e)); $('modal').addEventListener('keydown',e=>settingsKey(this,e)); $('modal').addEventListener('change',e=>this.input(e));
    document.getElementById('btn-menu')!.addEventListener('pointerdown',e=>{ e.preventDefault(); this.open('settings'); });
    document.getElementById('downpanel')!.addEventListener('click',e=>{ const a=(e.target as HTMLElement).dataset.act; if(a==='cp') g.returnToCheckpoint(); if(a==='defib') g.defibInPlace(); });
    window.addEventListener('keydown',e=>{ if(e.key==='\\'&&!(e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA/)){ g.devRestartFromStart(); this.close(); } else if(e.key==='`'){ this.devOpen=!this.devOpen; this.open(this.devOpen?'dev':null); } else if((e.key==='c'||e.key==='C')&&g.mode==='town'&&!this.modal&&(e.target as HTMLElement)?.tagName!=='INPUT'){ this.open('contacts'); } });
  }
  // ----- first-time hints: shown once per context (persisted), then fade; '?' button / Settings > Controls bring them back -----
  static HINTS:Record<string,string>={ town:'WASD move · F interact · C contacts · Space dodge', run:'WASD move · hold Q/E/R aim, release to cast · Space dodge · click enemy to target · F interact · B town · I pack · T stim · N minimap' };
  private hintSeenSet():Record<string,number>{ try{ return JSON.parse(localStorage.getItem('wv_hints')||'{}'); }catch{ return {}; } }
  hintSeen(k:string){ return !!this.hintSeenSet()[k]; }
  markHint(k:string){ const o=this.hintSeenSet(); o[k]=1; try{ localStorage.setItem('wv_hints',JSON.stringify(o)); }catch{} }
  private hintCtx=''; private hintUntil=0; private hintPeek=false;
  hintTick(){ const g=this.g, el=$('hint'), ctx=g.mode==='town'?'town':'run'; const now=performance.now();
    if(ctx!==this.hintCtx){ this.hintCtx=ctx; el.textContent=UI.HINTS[ctx]; this.hintUntil=this.hintSeen(ctx)?0:now+8000; }
    if(this.hintUntil&&now>this.hintUntil){ this.hintUntil=0; this.markHint(ctx); }
    el.classList.toggle('show',this.hintPeek||(this.hintUntil>0&&!this.modal)); }
  bindHelp(){ const b=$('btn-help'); b.addEventListener('pointerenter',()=>{ this.hintPeek=true; }); b.addEventListener('pointerleave',()=>{ this.hintPeek=false; }); b.addEventListener('focus',()=>{ this.hintPeek=true; }); b.addEventListener('blur',()=>{ this.hintPeek=false; });
    b.addEventListener('click',()=>{ this.hintPeek=true; setTimeout(()=>{ this.hintPeek=false; },6000); }); }
  /** tutorial-like toasts appear only the first time (persisted); returns false when already seen */
  tutorialToast(s:string){ const m=/^(CHECKPOINT: .*Downed\?|Locked relay|Sealed shutter|Suspended run found|Hacking rel|Dungeon layouts changed)/.exec(s); if(!m) return true; const k='toast_'+m[1].slice(0,14); if(this.hintSeen(k)) return false; this.markHint(k); return true; }
  setMinimap(on:boolean){ this.g.save.settings.minimap=on; persist(this.g.save); this.guideHud(); this.syncTray(); }
  syncTray(){ const on=this.g.save.settings.minimap!==false; const b=$('btn-map'); b.classList.toggle('on',on); b.classList.toggle('off',!on); b.setAttribute('aria-pressed',String(on)); }
  mmCache:{lv:any;cv:HTMLCanvasElement}|null=null;
  guideHud(){ const g=this.g, ob=$('objective'), mm=$('minimap') as HTMLCanvasElement; const gd=g.mode==='run'?g.guidance():null; if(!gd){ ob.style.display='none'; mm.style.display='none'; return; }
    ob.style.display='block'; (ob.firstElementChild as HTMLElement).textContent='Objective'; ob.querySelector('span')!.textContent=gd.obj.text+(gd.dist>0?' · '+Math.round(gd.dist)+'m':'');
    if(g.save.settings.minimap===false){ mm.style.display='none'; return; } mm.style.display='block'; const L=g.level; const W=mm.width, H=mm.height; const k=Math.min(W/L.w,H/L.h); const ox=(W-L.w*k)/2, oy=(H-L.h*k)/2; const c=mm.getContext('2d')!; c.clearRect(0,0,W,H);
    if(!g.seen) return; const seen=g.seen; c.fillStyle='#2b2c2e'; for(let y=0;y<L.h;y++) for(let x=0;x<L.w;x++){ if(seen[y*L.w+x]&&!L.solid[y*L.w+x]){ c.fillStyle=g.zoneAt(x+.5,y+.5)==='boss'?'#4a2d28':'#46474a'; c.fillRect(ox+x*k,oy+y*k,Math.ceil(k),Math.ceil(k)); } }
    const inst=g.inst!; for(const cp of L.checkpoints){ const done=(inst.reached||[]).includes(cp.id); c.fillStyle=done?'#8fae7f':'#9a9488'; c.fillRect(ox+cp.x*k-2,oy+cp.y*k-2,4,4); }
    for(const it of L.interacts){ if(it.kind==='controller'&&!inst.flags.controller){ c.fillStyle='#d8a24a'; c.fillRect(ox+it.x*k-2,oy+it.y*k-2,4,4); } }
    const o=gd.obj; const blink=Math.floor(performance.now()/350)%2===0; if(blink){ c.fillStyle='#e05a3a'; c.beginPath(); c.arc(ox+o.x*k,oy+o.y*k,3.2,0,7); c.fill(); }
    for(const e of g.enemies){ if(e.dead||e.faction!=='enemy'||!e.alert) continue; c.fillStyle='#b5483a'; c.fillRect(ox+e.x*k-1,oy+e.y*k-1,2,2); }
    c.fillStyle='#fff'; c.beginPath(); c.arc(ox+g.px*k,oy+g.py*k,2.4,0,7); c.fill(); }
  modalOpen(){ return !!this.modal; }
  handle(type:string,p:any){
    const g=this.g;
    if(type==='toast') this.toast(p); else if(type==='dialog') this.showDialog(p); else if(type==='open'){ const pid=String(p); if(pid.startsWith('npc_')||pid==='contacts'){ if(pid.startsWith('npc_')&&CONTACT_BY_ID[pid.slice(4)]) this.contactSel=pid.slice(4); this.open('contacts'); } else this.open(pid==='annex'||pid==='gate'||pid.startsWith('dungeon')?'gate':pid==='locker'?'locker':pid==='vendor'?'vendor':pid==='fixer'?'fixer':pid==='store'?'store':null); }
    else if(type==='reveal') this.banner(p.name, 'Damage-free emergence. Movement is available.'); else if(type==='reveal-end') this.hideBanner();
    else if(type==='boss-dead'){ this.banner('Mission complete','Boss defeated. Personal loot remains until the instance expires.',4); setTimeout(()=>{ if(g.mode==='run'&&!this.modal&&g.inst?.flags.bossDead) this.open('summary'); },4200); }
    else if(type==='zone'){ if(this.bannerT<=0||true) this.banner(p.label,p.hint||'',2.3); }
    else if(type==='checkpoint'){ this.audio?.sfx?.('objective'); }
    else if(type==='down'){ this.showDown(p); } else if(type==='revived'){ $('downpanel').style.display='none'; }
    else if(type==='dodgecancel'){ $('dialog').style.display='none'; }
    else if(type==='mode'){ this.liveOpen=false; $('livepanel').style.display='none'; $('downpanel').style.display='none'; $('dialog').style.display='none'; if(p==='town'){ this.open(null); setTimeout(()=>{ if(this.g.mode==='town'&&!this.modal) this.recNudge(); },1400); } else this.open(null); }
    else if(type==='expired') this.toast('Instance expired.'); else if(type==='filtered') this.toast('Above your level: '+p+' did not drop (no downward reroll).');
    else if(type==='hurt'){ document.body.animate([{boxShadow:'inset 0 0 60px rgba(143,59,46,.5)'},{boxShadow:'inset 0 0 0 rgba(0,0,0,0)'}],{duration:260}); }
    void g;
  }
  toast(s:string){ if(!this.tutorialToast(s)) return; const el=document.createElement('div'); el.className='toast'; el.textContent=s; const box=$('toasts'); box.appendChild(el); while(box.children.length>4) box.removeChild(box.firstChild!); setTimeout(()=>el.remove(),5600); }
  banner(t:string,sub:string,secs=4){ const b=$('banner'); b.innerHTML=esc(t)+'<small>'+esc(sub)+'</small>'; b.classList.add('show'); this.bannerT=secs; }
  hideBanner(){ $('banner').classList.remove('show'); }
  showDialog(d:{title:string;body:string;options:{label:string;cb?:()=>void}[]}){ const el=$('dialog'); el.style.display='block'; el.innerHTML=`<h4>${esc(d.title)}</h4><div>${esc(d.body)}</div>`; d.options.forEach(o=>{ const b=document.createElement('button'); b.textContent=o.label; b.onclick=()=>{ el.style.display='none'; o.cb?.(); }; el.appendChild(b); }); }
  showDown(p:{broke:string|null;defib:boolean}){ const el=$('downpanel'); el.style.display='block'; el.innerHTML=`<b>DOWN</b><div class="mut" style="margin:6px 0">${p.broke?'Hardware damaged: <b>'+esc(p.broke)+'</b> (benefits and ability offline until a checkpoint).':'No hardware could be damaged.'} Repair bill: ${this.g.save.repairBill}c</div><button data-act="cp">Return to checkpoint (restores hardware, keeps repair bill)</button>${p.defib?'<button data-act="defib">Self-defib here (hardware stays broken)</button>':''}`; }
  open(m:string|null){ if(m==='settings'&&this.modal!=='settings') settingsReset(); if(m==='locker'||m==='vendor'||m==='gate'||m==='fixer'||m==='store'||m==='contacts'){ if(this.g.mode!=='town'){ return; } } if(m==='locker'&&!this.draft) this.resetDraft(); this.modal=m; this.confirm=null; this.render(); }
  close(){ this.modal=null; this.confirm=null; if(this.g.mode==='town'||true) this.draft=null; this.render(); }
  toggleLive(){ if(this.g.mode!=='run') return; this.liveOpen=!this.liveOpen; this.renderLive(); }
  esc(){ if(this.modal==='settings'&&settingsEsc(this)) return; if(this.modal){ this.close(); } else if(this.liveOpen){ this.liveOpen=false; this.renderLive(); } else this.g.clearTarget(); }
  /** Socket a chip into the selected body part of the draft (validates fit, ownership, capacity). */
  socketChip(c:ChipId):boolean{ const s=this.g.save; const it=this.draft?.[this.sel]; if(!it) return false; const sl=this.sel;
    if(!chipFits(c,sl)){ this.g.toast(chipReason(c,sl)); return false; } if(it.chips.length>=SLOT_SOCKETS[sl]){ this.g.toast('No free sockets on '+SLOT_LABEL[sl]+'.'); return false; }
    const inst=installedLayout(s); const owned=(s.lockerChips[c]||0)+Object.values(inst).reduce((x,i)=>x+(i?.chips.filter(y=>y===c).length||0),0); const used=Object.values(this.draft!).reduce((x,i)=>x+(i?.chips.filter(y=>y===c).length||0),0);
    if(owned-used<=0){ this.g.toast('No '+CHIPS[c].name+' left in stock.'); return false; }
    it.chips.push(c); const left=owned-used-1; if(left<=0||it.chips.length>=SLOT_SOCKETS[sl]) this.chipSel=null; this.render(); return true; }
  /** Fill empty sockets with the best compatible chips in stock (rarity first, then by name). */
  bestFit(){ const s=this.g.save; const it=this.draft?.[this.sel]; if(!it) return; const inst=installedLayout(s); const sl=this.sel; let n=0;
    const av=(c:ChipId)=>(s.lockerChips[c]||0)+Object.values(inst).reduce((x,i)=>x+(i?.chips.filter(y=>y===c).length||0),0)-Object.values(this.draft!).reduce((x,i)=>x+(i?.chips.filter(y=>y===c).length||0),0);
    const list=(Object.keys(CHIPS) as ChipId[]).filter(c=>chipFits(c,sl)).sort((a,b)=>RARITIES.indexOf(CHIPS[b].rarity)-RARITIES.indexOf(CHIPS[a].rarity)||CHIPS[a].name.localeCompare(CHIPS[b].name));
    for(const c of list){ while(it.chips.length<SLOT_SOCKETS[sl]&&av(c)>0){ it.chips.push(c); n++; } } this.chipSel=null; this.render(); this.g.toast(n?`Best fit: added ${n} chip${n>1?'s':''}.`:'No compatible chips in stock.'); }
  /** Live delta preview while hovering a chip tile (does not modify the draft). */
  hoverDelta(c:ChipId|null){ const el=document.getElementById('hoverdelta'); if(!el||!this.draft) return; const s=this.g.save; const sl=this.sel; const it=this.draft[sl];
    if(!c){ el.innerHTML='<span class="mut">Hover a chip to preview its effect</span>'; return; }
    if(!it||!chipFits(c,sl)){ el.innerHTML=`<span class="bad">${esc(chipReason(c,sl))}</span>`; return; }
    if(it.chips.length>=SLOT_SOCKETS[sl]){ el.innerHTML='<span class="mut">Sockets full: remove a chip first</span>'; return; }
    const L2=cloneLayout(this.draft); L2[sl]!.chips.push(c); const a=computeBuild(this.draft,s.level,s.rep), b=computeBuild(L2,s.level,s.rep);
    const ks=(Object.keys(STAT_L) as (keyof Stats)[]).filter(k=>Math.abs((b.stats[k] as number)-(a.stats[k] as number))>1e-6);
    const mods=(Object.keys(b.mods) as (keyof typeof b.mods)[]).filter(k=>Math.abs(b.mods[k]-a.mods[k])>1e-6);
    el.innerHTML='<b>+ '+esc(CHIPS[c].name)+':</b> '+(ks.map(k=>{ const d=(b.stats[k] as number)-(a.stats[k] as number); return `<span class="pchip ${d>0?'up':'dn'}">${STAT_L[k]} <b>${fmtN(b.stats[k] as number)}</b> <i>${d>0?'▲':'▼'}${fmtN(Math.abs(d))}</i></span>`; }).join('')+mods.map(k=>`<span class="pchip up">${esc(CHIPS[c].desc)}</span>`).slice(0,1).join('')||'<span class="mut">no stat change</span>'); }
  bindChipDnD(){ const m=$('modal'); m.querySelectorAll<HTMLElement>('.ctile[draggable=true]').forEach(t=>{ t.addEventListener('dragstart',e=>{ e.dataTransfer?.setData('text/plain',t.dataset.chip!); e.dataTransfer!.effectAllowed='copy'; this.chipSel=t.dataset.chip as ChipId; }); });
    m.querySelectorAll<HTMLElement>('.sock[data-drop]').forEach(k=>{ k.addEventListener('dragover',e=>{ e.preventDefault(); k.classList.add('over'); }); k.addEventListener('dragleave',()=>k.classList.remove('over')); k.addEventListener('drop',e=>{ e.preventDefault(); const c=(e.dataTransfer?.getData('text/plain')||this.chipSel) as ChipId; if(c&&CHIPS[c]) this.socketChip(c); }); });
    m.querySelectorAll<HTMLElement>('.ctile').forEach(t=>{ t.addEventListener('pointerenter',e=>{ if(e.pointerType==='mouse'||e.pointerType==='pen') this.hoverDelta(t.dataset.chip as ChipId); }); t.addEventListener('pointerleave',()=>this.hoverDelta(null)); t.addEventListener('focus',()=>this.hoverDelta(t.dataset.chip as ChipId)); }); }
  resetDraft(){ this.draft=cloneLayout(installedLayout(this.g.save)); }

  // ================= HUD =================
  private abPrev:number[]=[0,0,0]; private abKey=['','',''];
  /** Round medallion ability buttons: type ring, radial cooldown sweep, heat pips, ready pulse, state marks. */
  abilityButtons(){
    const g=this.g, HMAX=COMBAT.heat.max; document.body.classList.toggle('reducefx',!!g.save.settings.reducedFx);
    document.querySelectorAll<HTMLElement>('.abtn').forEach(btn=>{
      const i=+btn.dataset.idx!; const id=g.build.abilities[i]; const def=id?ABILITIES[id]:null; btn.classList.toggle('empty',!def);
      const img=btn.querySelector('.aicon') as HTMLImageElement, nm=btn.querySelector('.aname') as HTMLElement;
      if(this.abKey[i]!==(id||'')){ this.abKey[i]=id||''; if(def){ img.src=abIconUrl(def.id); btn.style.setProperty('--tc',ABILITY_TYPE_COLOR[def.type]); btn.dataset.type=def.type; btn.querySelector('.heatpips')!.innerHTML='<b></b>'.repeat(Math.min(6,Math.max(0,Math.ceil(def.heat/10)))); } else { img.removeAttribute('src'); delete btn.dataset.type; } nm.textContent=def?def.name:''; }
      if(!def){ return; }
      const cdn=Math.max(0,g.abCd[i]/def.cd); (btn.querySelector('.cdsweep') as HTMLElement).style.setProperty('--cd',(cdn*360).toFixed(1)+'deg');
      if(this.abPrev[i]>0&&g.abCd[i]<=0){ btn.classList.remove('ready'); void btn.offsetWidth; btn.classList.add('ready'); setTimeout(()=>btn.classList.remove('ready'),700); }
      this.abPrev[i]=g.abCd[i];
      const offline=g.overheated, short=!offline&&def.heat>0&&g.heat+def.heat>HMAX;
      btn.classList.toggle('off',offline); btn.classList.toggle('hot',short); btn.classList.toggle('cd',g.abCd[i]>0);
      (btn.querySelector('.mark') as HTMLElement).textContent=offline?'\u2715':short?'!':'';
      (btn.querySelector('.mark') as HTMLElement).title=offline?'Offline: overheated':short?'Would overheat':'';
    });
    const dd=$('dodge'); (dd.querySelector('.cdsweep') as HTMLElement).style.setProperty('--cd',(Math.max(0,g.dodgeCd/COMBAT.dodge.cd)*360).toFixed(1)+'deg'); dd.classList.toggle('cd',g.dodgeCd>0);
    if(this.dodgePrev>0&&g.dodgeCd<=0){ dd.classList.remove('ready'); void dd.offsetWidth; dd.classList.add('ready'); setTimeout(()=>dd.classList.remove('ready'),700); } this.dodgePrev=g.dodgeCd;
  }
  private dodgePrev=0;
  /** Hover (desktop) / long-press (touch) tooltip for HUD ability buttons. */
  bindAbilityTips(){
    const tip=$('abtip'); const show=(btn:HTMLElement)=>{ const i=+(btn.dataset.idx??-1); const id=btn.id==='dodge'?null:this.g.build.abilities[i]; const d=id?ABILITIES[id]:null;
      if(btn.id==='dodge') tip.innerHTML=`<b>Dodge</b> <i style="color:${ABILITY_TYPE_COLOR.mobility}">Mobility</i><br>Quick roll with brief invulnerability. Cooldown ${COMBAT.dodge.cd}s.`;
      else if(d) tip.innerHTML=`<b>${esc(d.name)}</b> <i style="color:${ABILITY_TYPE_COLOR[d.type]}">${ABILITY_TYPE_LABEL[d.type]}</i><br>${esc(d.desc)}<br><span class="mut">Heat ${d.heat} · Cooldown ${d.cd}s${d.range?' · Range '+d.range:''}</span>`; else tip.innerHTML=`<b>Empty ability slot</b><br>Abilities come from installed hardware. Equip arms, torso, legs or brain with abilities in the Body workspace.`;
      const r=btn.getBoundingClientRect(); tip.style.display='block'; tip.style.setProperty('--tc',d?ABILITY_TYPE_COLOR[d.type]:ABILITY_TYPE_COLOR.mobility); const w=tip.offsetWidth; tip.style.left=Math.max(6,Math.min(innerWidth-w-6,r.left+r.width/2-w/2))+'px'; tip.style.bottom=(innerHeight-r.top+8)+'px'; };
    const hide=()=>{ tip.style.display='none'; };
    document.querySelectorAll<HTMLElement>('.abtn,#dodge').forEach(btn=>{ let timer=0,sx=0,sy=0;
      btn.addEventListener('pointerenter',e=>{ if(e.pointerType==='mouse') show(btn); }); btn.addEventListener('pointerleave',()=>{ clearTimeout(timer); hide(); });
      btn.addEventListener('pointerdown',e=>{ sx=e.clientX; sy=e.clientY; if(e.pointerType!=='mouse'){ clearTimeout(timer); timer=window.setTimeout(()=>show(btn),450); } else hide(); });
      btn.addEventListener('pointermove',e=>{ if(timer&&Math.hypot(e.clientX-sx,e.clientY-sy)>10){ clearTimeout(timer); timer=0; } });
      const up=()=>{ clearTimeout(timer); timer=0; setTimeout(hide,1400); }; btn.addEventListener('pointerup',up); btn.addEventListener('pointercancel',()=>{ clearTimeout(timer); hide(); }); });
  }

  hud(){
    const g=this.g, st=g.build.stats; $('hpfill').style.width=Math.max(0,g.hp/g.maxHp*100)+'%'; $('hptxt').textContent=Math.ceil(Math.max(0,g.hp))+' / '+Math.round(g.maxHp);
    $('heatfill').style.width=Math.min(100,g.heat)+'%'; document.querySelector('.bar.heat')!.classList.toggle('over',g.overheated); $('heattxt').textContent=g.overheated?'OVERHEATED':'HEAT';
    const s=g.save; $('lvl').title='Level, credits, repair bill'; $('lvl').textContent=`Lv ${s.level} · ${s.credits}c`+(s.repairBill>0?` · fix ${s.repairBill}c`:'');
    const inst=g.inst; if(g.mode==='run'&&inst){ const rem=Math.max(0,inst.expiresAt-Date.now()); const h=Math.floor(rem/3600000), m=Math.floor(rem%3600000/60000); $('timer').textContent='Instance '+h+'h'+String(m).padStart(2,'0')+'m'+(rem<1800000?' ⚠':''); $('carry').textContent=`Pack ${g.carriedCount()}/${COMBAT.missionSlots} · +${inst.carried.credits}c`; $('stimn').textContent=String(inst.carried.stims); } else { $('timer').textContent=g.hasLiveInstance()?'Instance live':''; $('carry').textContent=''; $('stimn').textContent=String(s.stims); }
    this.guideHud();
    const run=g.mode==='run'; $('btn-town').style.display=run?'':'none'; $('btn-inv').style.display=run?'':'none';
    this.abilityButtons();
    const pr=g.prompt; const ib=$('interact'); ib.style.display=pr&&!this.modal&&!g.downed?'':'none'; if(pr) ib.innerHTML='<span class="ilabel">'+esc(pr.label)+'</span><small>F</small>'; if(pr) ib.title=pr.label;
    const ch=$('channelbar'); if(g.channel){ ch.style.display='block'; (ch.querySelector('.track>div') as HTMLElement).style.width=g.channel.t/g.channel.dur*100+'%'; ch.querySelector('span')!.textContent=g.channel.kind==='town'?'Returning to town…':'Hacking…'; } else ch.style.display='none';
    // conditional support panel: only when relevant ability equipped
    const sup=g.build.abilities.includes('revive'); const sp=$('support'); sp.style.display=sup&&g.mode==='run'?'flex':'none'; if(sup&&!sp.innerHTML) sp.innerHTML='<span class="mut">Support</span><div class="portrait">P1</div><div class="portrait">P2</div><div class="portrait">P3</div><div class="portrait">P4</div><div class="portrait guest">G5</div><span class="mut">no teammates (solo)</span>'; if(!sup) sp.innerHTML='';
    if(this.bannerT>0){ this.bannerT-=1/60; if(this.bannerT<=0) this.hideBanner(); }
    this.hintTick();
    if(this.liveOpen&&g.mode==='run'){ const k=g.inst!.carried.items.length+':'+JSON.stringify(g.inst!.carried.chips)+g.inst!.carried.stims; if(k!==this.lastKey){ this.lastKey=k; this.renderLive(); } }
  }
  renderLive(){ const el=$('livepanel'); if(!this.liveOpen||this.g.mode!=='run'){ el.style.display='none'; return; } const g=this.g, c=g.inst!.carried; el.style.display='block'; const L=installedLayout(g.save);
    let h=`<h4>Pack (live: combat continues) ${g.carriedCount()}/${COMBAT.missionSlots}</h4><div class="mut">Hardware and chips are locked mid-run. Compare, then return to town to install. Items stay on the ground until the instance expires.</div>`;
    for(const it of c.items){ const d=ITEM_BY_ID[it.def]; const cur=L[d.slot]?ITEM_BY_ID[L[d.slot]!.def]:null; const bl=computeBuild(this.layoutWith(L,d.slot,it),g.save.level,g.save.rep).stats, b0=g.build.stats;
      h+=`<div class="lp-item" style="border-color:${rc(d.rarity)}"><b style="color:${rc(d.rarity)}">${esc(d.name)}</b> <span class="tag">${SLOT_LABEL[d.slot]}</span><small>${MFR[d.mfr].short} · req Lv ${d.lvl}${d.lvl>g.save.level?' <span class="bad">(too high)</span>':''}${d.abilities?' · '+abChips(d.abilities):''}</small><small>vs ${cur?esc(cur.name):'empty'}: HP ${diff(b0.maxHp,bl.maxHp,n=>n.toFixed(0))} DMG ${diff(b0.dmg,bl.dmg)} ATK ${diff(b0.atkSpeed,bl.atkSpeed)} COOL ${diff(b0.cooling,bl.cooling)}</small></div>`; }
    for(const [k,v] of Object.entries(c.chips)) if(v) h+=`<div class="lp-item"><b>${CHIPS[k as ChipId].name}</b> ×${v} <span class="tag">${chipFitLabel(k as ChipId)}</span><small>${CHIPS[k as ChipId].desc}</small></div>`;
    if(c.stims) h+=`<div class="lp-item"><b>Stim</b> ×${c.stims}</div>`; if(!c.items.length&&!Object.keys(c.chips).length&&!c.stims) h+='<div class="mut" style="margin-top:6px">Empty. Loot is picked up by proximity.</div>';
    el.innerHTML=h; }
  layoutWith(L:Layout,slot:Slot,inst:Inst):Layout{ const o=cloneLayout(L); o[slot]={...inst,chips:[]}; return o; }

  // ================= modals =================
  render(){ const m=$('modal'); if(!this.modal){ m.style.display='none'; m.innerHTML=''; return; } m.style.display='flex'; const g=this.g; this.recompute();
    const body=this.modal==='locker'?this.locker():this.modal==='vendor'?this.vendor():this.modal==='gate'?this.gate():this.modal==='fixer'?this.fixer():this.modal==='contacts'?this.contacts():this.modal==='store'?this.store():this.modal==='settings'?this.settings():this.modal==='dev'?this.dev():this.modal==='summary'?this.summary():'';
    const titles:Record<string,string>={locker:'Body workspace & locker',vendor:'Vendor & repair',gate:'Dungeon select',contacts:'Contacts & contracts',fixer:'Fixer: Odalys Vane',store:'Outfitter (simulated purchases)',settings:'Settings',dev:'DEV tools (prototype only)',summary:'Run summary'};
    m.innerHTML=`<div class="win${this.modal==='settings'?' settingswin':''}" role="dialog" aria-modal="true" aria-label="${titles[this.modal]||''}"><header><span>${titles[this.modal]||''}</span><span><button data-act="close">Close</button></span></header><div class="body">${body}</div><footer class="bvgf">${BVG}</footer></div>`; void g; if(this.modal==='settings') settingsAfterRender(this); this.decorateTiles(); this.decorateChips(); this.bindTips(); this.bindChipDnD(); }
  decorateTiles(){ document.querySelectorAll<HTMLElement>('#modal [data-def]').forEach(b=>{ const ic=b.querySelector('.ticon'); if(!ic||!b.dataset.def) return; try{ const sp=specOf({id:0,kind:'item',inst:{def:b.dataset.def},amount:1}); const src=iconCanvas(sp); const cv=document.createElement('canvas'); cv.width=src.width; cv.height=src.height; cv.getContext('2d')!.drawImage(src,0,0); ic.appendChild(cv); }catch{} }); }
  decorateChips(){ document.querySelectorAll<HTMLElement>('#modal [data-chip]').forEach(b=>{ const ic=b.querySelector('.ticon'); const id=b.dataset.chip; if(!ic||!id||!(CHIPS as any)[id]) return; try{ const src=iconCanvas(specOf({id:0,kind:'chip',chip:id,amount:1})); const cv=document.createElement('canvas'); cv.width=src.width; cv.height=src.height; cv.getContext('2d')!.drawImage(src,0,0); ic.appendChild(cv); }catch{} }); }
  /** hover (mouse) or long-press (touch) tooltips for any element carrying data-tip html */
  bindTips(){ let tip=document.getElementById('tiptile'); if(!tip){ tip=document.createElement('div'); tip.id='tiptile'; document.body.appendChild(tip); } const t=tip; const hide=()=>{ t.style.display='none'; };
    const show=(el:HTMLElement)=>{ t.innerHTML=el.dataset.tip||''; t.style.display='block'; const r=el.getBoundingClientRect(); const w=t.offsetWidth,h=t.offsetHeight; t.style.left=Math.max(6,Math.min(innerWidth-w-6,r.right+8>innerWidth-w-6?r.left-w-8:r.right+8))+'px'; t.style.top=Math.max(6,Math.min(innerHeight-h-6,r.top))+'px'; };
    document.querySelectorAll<HTMLElement>('#modal [data-tip]').forEach(el=>{ let timer=0; el.addEventListener('pointerenter',e=>{ if(e.pointerType==='mouse') show(el); }); el.addEventListener('pointerleave',()=>{ clearTimeout(timer); hide(); }); el.addEventListener('focus',()=>show(el)); el.addEventListener('blur',hide);
      el.addEventListener('pointerdown',e=>{ if(e.pointerType!=='mouse'){ clearTimeout(timer); timer=window.setTimeout(()=>show(el),420); } }); const up=()=>{ clearTimeout(timer); setTimeout(hide,1600); }; el.addEventListener('pointerup',up); el.addEventListener('pointercancel',()=>{ clearTimeout(timer); hide(); }); }); }
  // ----- Locker -----
  locker():string{
    const g=this.g, s=g.save; if(!this.draft) this.resetDraft(); const D=this.draft!; const inst=installedLayout(s);
    const cur=computeBuild(inst,s.level,s.rep), prev=computeBuild(D,s.level,s.rep); const dirty=JSON.stringify(Object.entries(D).map(([k,v])=>[k,v?.chips]))!==JSON.stringify(Object.entries(inst).map(([k,v])=>[k,v?.chips]));
    const SHORT:Record<Slot,string>={face:'FACE',brain:'BRAIN',torso:'TORSO',handL:'L HAND',handR:'R HAND',armL:'L ARM',armR:'R ARM',legL:'L LEG',legR:'R LEG',footL:'L FOOT',footR:'R FOOT'};
    const slotBtn=(sl:Slot)=>{ const it=D[sl]; const d=it?ITEM_BY_ID[it.def]:null; const changed=JSON.stringify(it?.chips)!==JSON.stringify(inst[sl]?.chips); const n=SLOT_SOCKETS[sl];
      const pips=Array.from({length:n},(_,i)=>{ const ch=it?.chips[i]; return ch?`<i class="pip full" style="--pc:${RARITY_COLOR[CHIPS[ch].rarity]}"></i>`:'<i class="pip"></i>'; }).join('');
      const tip=d?`<b style="color:${rc(d.rarity)}">${esc(d.name)}</b><br>${esc(SLOT_LABEL[sl])} · ${d.rarity} · ${esc(MFR[d.mfr].short)} · req Lv ${d.lvl}<br>`+(it!.chips.length?it!.chips.map(c=>'▪ '+esc(CHIPS[c].name)+' <span class="mut">'+esc(CHIPS[c].desc)+'</span>').join('<br>'):'<span class="mut">No chips</span>')+`<br><span class="mut">Chips ${it!.chips.length}/${n}${changed?' · staged':''}</span>`:`<b>${esc(SLOT_LABEL[sl])}</b><br><span class="mut">Empty · ${n} chip socket${n===1?'':'s'}</span>`;
      return `<button class="slot tile ${this.sel===sl?'sel':''} ${changed?'staged':''}" data-act="sel" data-slot="${sl}" ${d?`data-def="${d.id}"`:''} data-tip="${esc(tip+this.recTip(sl))}" aria-label="${esc(SLOT_LABEL[sl]+': '+(d?d.name:'empty'))}" style="border-color:${d?rc(d.rarity):'#555'}"><b>${SHORT[sl]}</b><span class="ticon">${d?'':'<span class="tempty">—</span>'}</span><span class="pips">${pips}</span><i class="sc" title="Sockets used / total">${it?it.chips.length:0}/${n}</i>${d?`<span class="mf" style="background:${MFR[d.mfr].accent}"></span>`:''}${this.recBadge(sl)}</button>`; };
    const sp='<div class="sp"></div>';
    const grid=`<div class="body-grid">${sp}${slotBtn('face')}${sp}${slotBtn('handL')}${slotBtn('brain')}${slotBtn('handR')}${slotBtn('armL')}${slotBtn('torso')}${slotBtn('armR')}${slotBtn('legL')}${sp}${slotBtn('legR')}${slotBtn('footL')}${sp}${slotBtn('footR')}</div>`;
    const sl=this.sel; const di=D[sl]; const dd=di?ITEM_BY_ID[di.def]:null;
    const owned=(c:ChipId)=>(s.lockerChips[c]||0)+Object.values(inst).reduce((a,i)=>a+(i?.chips.filter(x=>x===c).length||0),0); const used=(c:ChipId)=>Object.values(D).reduce((a,i)=>a+(i?.chips.filter(x=>x===c).length||0),0);
    const chipShort=(c:ChipId)=>CHIPS[c].name.replace(/ Chip$/,'');
    const chipTip=(c:ChipId)=>esc('<b>'+esc(CHIPS[c].name)+'</b><br><span class="mut">'+esc(CHIPS[c].desc)+'</span>');
    // (e) sockets: icon slots for the selected body part (empty = dashed +). Click chip then socket, drag & drop, or one click to remove.
    const csel=this.chipSel&&chipFits(this.chipSel,sl)?this.chipSel:null; const avail=(c:ChipId)=>owned(c)-used(c);
    const GL:Record<string,string>={hand:'HD',arm:'AR',leg:'LG',foot:'FT',torso:'TR',face:'FC',brain:'BR'};
    const stags=(c:ChipId)=>'<span class="stags">'+CHIP_FITS[c].map(g=>`<i class="stag ${g===SLOT_GROUP[sl]?'on':''}" title="${esc(GROUP_LABEL[g])}">${GL[g]}</i>`).join('')+'</span>';
    let socks=''; if(di){ for(let i=0;i<SLOT_SOCKETS[sl];i++){ const ch=di.chips[i]; socks+=ch?`<button class="sock full" data-act="unsock" data-i="${i}" data-chip="${ch}" data-tip="${chipTip(ch)}<br>Click to remove" aria-label="${esc(CHIPS[ch].name)} (remove)" style="border-color:${RARITY_COLOR[CHIPS[ch].rarity]}"><span class="ticon"></span><b>${esc(chipShort(ch))}</b></button>`:`<button class="sock empty ${csel?'ready':''}" data-act="sock" data-i="${i}" data-drop="1" data-tip="${esc(csel?'<b>Empty socket</b><br>Click to socket '+esc(CHIPS[csel].name):'<b>Empty socket</b><br>Pick a chip below, then click here (or drag it here)')}" aria-label="Empty socket"><span class="plus">+</span></button>`; } }
    const byRar=(a:ChipId,b:ChipId)=>RARITIES.indexOf(CHIPS[b].rarity)-RARITIES.indexOf(CHIPS[a].rarity)||CHIPS[a].name.localeCompare(CHIPS[b].name);
    const allC=Object.keys(CHIPS) as ChipId[];
    const fitList=allC.filter(c=>chipFits(c,sl)&&avail(c)>0).sort(byRar); const unfitList=this.chipShowAll?allC.filter(c=>!chipFits(c,sl)&&avail(c)>0).sort(byRar):[];
    const tile=(c:ChipId,ok:boolean)=>`<button class="ctile ${ok?'':'dim'} ${csel===c?'sel':''}" ${ok?`data-act="pickchip" draggable="true"`:`data-act="noop" aria-disabled="true"`} data-chip="${c}" data-tip="${esc('<b style="color:'+RARITY_COLOR[CHIPS[c].rarity]+'">'+CHIPS[c].name+'</b><br>'+CHIPS[c].desc+'<br><span class="mut">Fits: '+chipFitLabel(c)+'</span>'+(ok?'':'<br><span class="bad">'+chipReason(c,sl)+'</span>'))}" style="border-color:${RARITY_COLOR[CHIPS[c].rarity]}"><span class="ticon"></span><b>${esc(chipShort(c))}</b><i class="cnt">×${avail(c)}</i>${stags(c)}</button>`;
    const free=di?SLOT_SOCKETS[sl]-di.chips.length:0;
    const chipStock=`<div class="trayhead"><h3>Compatible chips <span class="mut">for ${esc(SLOT_LABEL[sl])}</span></h3><span class="trayctl"><button class="btn" data-act="bestfit" ${free>0&&fitList.length?'':'disabled'} data-tip="${esc('Fill empty sockets with the best compatible chips in stock')}">Best fit</button><button class="btn" data-act="clearchips" ${di&&di.chips.length?'':'disabled'}>Clear</button><button class="btn ${this.chipShowAll?'primary':''}" data-act="chipshowall" aria-pressed="${this.chipShowAll}">Show all</button></span></div>`
      +(fitList.length?`<div class="chipstock tray">${fitList.map(c=>tile(c,true)).join('')}</div>`:'<div class="mut empty">No compatible chips in stock</div>')
      +(unfitList.length?`<div class="mut" style="margin-top:4px">Does not fit ${esc(SLOT_LABEL[sl])}:</div><div class="chipstock tray">${unfitList.map(c=>tile(c,false)).join('')}</div>`:'');
    const chipList='';
    // (a) storage: uniform icon tiles + tabs + search + one action bar
    const TABS:[string,string,(d:ItemDef)=>boolean][]=[['all','All',()=>true],['face','Face',d=>d.slot==='face'],['brain','Brain',d=>d.slot==='brain'],['torso','Torso',d=>d.slot==='torso'],['arm','Arms',d=>d.slot==='armL'||d.slot==='armR'],['hand','Hands',d=>d.slot==='handL'||d.slot==='handR'],['leg','Legs',d=>d.slot==='legL'||d.slot==='legR'],['foot','Feet',d=>d.slot==='footL'||d.slot==='footR']];
    const tab=this.stTab; const tf=TABS.find(t=>t[0]===tab)?.[2]||(()=>true);
    const q=this.search.toLowerCase(); const storage=lockerItems(s).filter(i=>{ const d=ITEM_BY_ID[i.def]; return tf(d)&&(!q||d.name.toLowerCase().includes(q)||SLOT_LABEL[d.slot].toLowerCase().includes(q)); }).sort((a,b)=>RARITIES.indexOf(ITEM_BY_ID[b.def].rarity)-RARITIES.indexOf(ITEM_BY_ID[a.def].rarity));
    const cap=s.lockerCap+s.purchases.lockerBlocks*STARTING.lockerPerPurchase;
    const curDef=(x:Slot)=>inst[x]?ITEM_BY_ID[inst[x]!.def]:null;
    const itemTip=(d:ItemDef,fits:boolean)=>{ const c=curDef(d.slot); const dl=(['maxHp','dmg','atkSpeed','cooling','move','armor','regen','pickup'] as (keyof Stats)[]).map(k=>{ const v=(d.stats[k]||0)-(c?.stats[k]||0); return v?`<span class="${v>0?'up':'dn'}">${STAT_L[k]} ${v>0?'▲':'▼'}${fmtN(Math.abs(v))}</span>`:''; }).filter(Boolean).join(' '); return esc('<b style="color:'+rc(d.rarity)+'">'+esc(d.name)+'</b><br>'+esc(SLOT_LABEL[d.slot])+' · '+d.rarity+' · '+esc(MFR[d.mfr].name)+' · req Lv '+d.lvl+(d.abilities?'<br>Abilities: '+d.abilities.map(a=>esc(ABILITIES[a].name)).join(', '):'')+(d.weapon?'<br>Weapon: '+esc(WEAPONS[d.weapon]?.label||d.weapon):'')+'<br><span class="mut">vs installed'+(c?' ('+esc(c.name)+')':'')+':</span> '+(dl||'same')+'<br><span class="mut">'+(fits?'Fits the selected slot: Replace…':'Fits '+esc(SLOT_LABEL[d.slot])+': click, then Go to slot')+'</span>'); };
    const tiles=storage.map(i=>{ const d=ITEM_BY_ID[i.def]; const fits=d.slot===sl; return `<button class="slot tile st ${this.pickUid===i.uid?'sel':''} ${fits?'':'off'}" data-act="pick" data-uid="${i.uid}" data-def="${d.id}" data-tip="${itemTip(d,fits)}" aria-label="${esc(d.name)}" style="border-color:${rc(d.rarity)}"><span class="lvb ${d.lvl>s.level?'bad':''}">L${d.lvl}</span><span class="ticon"></span><span class="mf" style="background:${MFR[d.mfr].accent}"></span></button>`; }).join('')||'<div class="mut">Nothing here</div>';
    const picked=storage.find(i=>i.uid===this.pickUid)||null; const pd=picked?ITEM_BY_ID[picked.def]:null;
    const actbar=`<div class="pickbar">${pd?`<b style="color:${rc(pd.rarity)}">${esc(pd.name)}</b>${pd.slot===sl?`<button class="btn primary" data-act="replace" data-uid="${picked!.uid}">Replace…</button>`:`<button class="btn" data-act="gosel" data-slot="${pd.slot}">Go to slot</button>`}`:'<span class="mut">Select a part to see actions</span>'}</div>`;
    const abPrevIds=prev.abilities, abNowIds=cur.abilities;
    const carried=g.inst?.carried; const hasCarry=!!carried&&(carried.items.length||Object.keys(carried.chips).length||carried.stims||carried.credits);
    const conf=this.confirm?this.confirmHtml():'';
    // (c) preview: compact chips of changed values only
    const SKS:(keyof Stats)[]=['maxHp','dmg','atkSpeed','cooling','move','armor','regen','pickup'];
    const changed=SKS.filter(k=>Math.abs((prev.stats[k] as number)-(cur.stats[k] as number))>1e-6);
    const pchip=(k:keyof Stats)=>{ const a=prev.stats[k] as number, b=cur.stats[k] as number; const d=a-b; const good=k==='maxHp'||k==='dmg'||k==='atkSpeed'||k==='move'||k==='armor'||k==='regen'||k==='pickup'?d>0:d>0; return `<span class="pchip ${d>0?'up':'dn'}">${STAT_L[k]} <b>${fmtN(a)}</b> <i>${d>0?'▲':'▼'}${fmtN(Math.abs(d))}</i></span>`; void good; };
    const fullTip=esc('<b>Preview</b><br>'+fmtStats(prev.stats)+'<br><span class="mut">Installed: '+fmtStats(cur.stats)+'</span><br>Capabilities: '+([...prev.caps].join(', ')||'none')+'<br>Heat: cooling ×'+prev.stats.cooling.toFixed(2)+' ('+(9*prev.stats.cooling).toFixed(1)+'/s passive); ability heat '+(prev.abilities.map(a=>ABILITIES[a].heat).join(' / ')||'-'));
    const mixTip=esc('<b>Manufacturer mixing</b><br>'+(prev.mix.mfrs.map(m=>MFR[m].name).join(' + ')||'baseline')+(prev.mix.coolingPenalty>0?'<br>Mixing penalty −'+(prev.mix.coolingPenalty*100).toFixed(0)+'% cooling (reduced by reputation rank).':'<br>No penalty.'));
    const help=esc('<b>How this works</b><br>Chip swapping is free. Hardware replacement is a separate, explicit, paid action. No presets, no readiness checks: you can enter the Annex with whatever is installed.');
    const stripRight=`<div class="strip" data-tip="${fullTip}" tabindex="0">${changed.length?changed.map(pchip).join(''):'<span class="mut">No stat changes</span>'}</div>
      <div class="strip2">${abPrevIds.map(a=>abChip(a)).join('')||'<span class="mut">No abilities</span>'}<span class="pchip" data-tip="${fullTip}">⚔ ${esc(prev.weapon.kind)}${prev.weapon.stationary?' (stationary)':''}</span>${prev.mix.coolingPenalty>0?`<span class="pchip warnb" data-tip="${mixTip}" tabindex="0">⚠ Mix −${(prev.mix.coolingPenalty*100).toFixed(0)}% cool</span>`:`<span class="pchip mut" data-tip="${mixTip}" tabindex="0">${prev.mix.mfrs.map(m=>MFR[m].short.split(' ')[0]).join('+')||'Base'}</span>`}${abPrevIds.join()!==abNowIds.join()?`<span class="pchip" data-tip="${esc('Installed abilities: '+(abNowIds.map(a=>ABILITIES[a].name).join(', ')||'none'))}">changed</span>`:''}</div>
      ${prev.extraAbilities.length?`<div class="warn">Only 3 abilities are bound (by slot priority). Unbound: ${abChips(prev.extraAbilities)}</div>`:''}
      ${prev.conflicts.map(c=>`<div class="bad">Hard conflict: ${esc(c)}</div>`).join('')}`;
    return `<div class="col narrow"><h3>Body (11 slots)</h3>${grid}${this.recPanel()}<div class="repbar">${(['HI','PS','MM'] as const).map(m=>`<span class="repb" data-tip="${esc('<b>'+MFR[m].short+'</b><br>Reputation rank '+repRank(s.rep[m])+' (rep '+Math.round(s.rep[m])+')')}" style="--ac:${MFR[m].accent}">${MFR[m].short.split(' ')[0]} <b>${repRank(s.rep[m])}</b></span>`).join('')}</div></div>
    <div class="col">
      <div class="hdrrow ${dirty?'dirty':''}">${hasCarry?`<span class="pack">Pack ${carried!.items.length}▪ ${Object.values(carried!.chips).reduce((a,b)=>a+(b||0),0)}◈ ${carried!.stims}✚ ${carried!.credits}c</span><button class="btn" data-act="unload">Unload</button><i class="sep"></i>`:''}<b>${dirty?'DRAFT (unapplied)':'No staged changes'}</b>${dirty?`<span class="warnb" data-tip="${esc('Leaving the workspace or entering a mission discards the draft.')}" tabindex="0">⚠</span>`:''}<button class="btn primary" data-act="apply" ${dirty?'':'disabled'}>Apply</button><button class="btn" data-act="discard" ${dirty?'':'disabled'}>Discard</button><span class="help" data-tip="${help}" tabindex="0">?</span></div>
      ${conf}
      <h3 class="selhead" ${dd?`data-tip="${esc('<b>'+esc(dd.name)+'</b><br>'+esc(MFR[dd.mfr].name)+' · req Lv '+dd.lvl+(dd.weapon?'<br>Weapon: '+esc(WEAPONS[dd.weapon]?.label||dd.weapon)+' ('+WEAPONS[dd.weapon].dmg+' dmg ×'+WEAPON_RARITY_MUL[dd.rarity]+', range '+WEAPONS[dd.weapon].range+', heat '+WEAPONS[dd.weapon].heat+')':'')+(dd.caps?'<br>Capability: '+dd.caps.join(', '):'')+(dd.blurb?'<br><span class="mut">'+esc(dd.blurb)+'</span>':''))}"`:''}>${SLOT_LABEL[sl]}: ${dd?esc(dd.name):'empty'} ${dd?`<span class="tag" style="border-color:${rc(dd.rarity)}">${dd.rarity}</span>`:''}${dd?' <span class="mut hov">ⓘ</span>':''}</h3>
      <div class="sockrow">${socks}</div><div class="sockinfo mut">${di?di.chips.length+'/'+SLOT_SOCKETS[sl]+' sockets · accepts '+Object.entries(CHIP_FITS).filter(([c])=>chipFits(c as ChipId,sl)).length+' chip types':''}</div>
      ${chipStock}
      <h3>Storage ${capacityUsed(s)}/${cap}</h3>
      <div class="sttabs">${TABS.map(t=>`<button class="btn tabb ${tab===t[0]?'primary':''}" data-act="sttab" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div>
      <input type="search" placeholder="Search storage (name, slot)…" value="${esc(this.search)}" data-in="search" />
      <div class="stgrid">${tiles}</div>${actbar}
      <div class="actrow">${(()=>{ const gl=this.greyDisposable(); return `<button class="btn" data-act="sellgrey" ${gl.length?'':'disabled'}>Dispose grey (${gl.length})</button>`; })()}${this.repairBtn(true)}</div></div>
    <div class="col previewcol"><h3>Preview</h3><div class="strip hoverd" id="hoverdelta"><span class="mut">Hover a chip to preview its effect</span></div>${stripRight}</div>`;
  }
  confirmHtml():string{ const c=this.confirm; if(c.type!=='replace') return ''; const SKS:(keyof Stats)[]=['maxHp','dmg','atkSpeed','cooling','move','armor','regen','pickup']; const broke=c.cost>this.g.save.credits;
    const rows=SKS.map(k=>{ const a=c.before[k] as number, b=c.after[k] as number, d=b-a; return `<div class="crow"><span>${STAT_L[k]}</span><span>${fmtN(a)}</span><i class="${d>0?'up':d<0?'dn':'mut'}">${d>0?'▲':d<0?'▼':'='}</i><span class="${d>0?'up':d<0?'dn':''}">${fmtN(b)}</span></div>`; }).join('');
    const ic=(ids:string[])=>ids.length?ids.map(a=>abChip(a as any)).join(''):'<span class="mut">none</span>';
    return `<div class="popwrap"><div class="pop" role="dialog" aria-label="Confirm hardware replacement"><b>Confirm hardware replacement</b><div class="swap">${esc(c.text)}</div><div class="cmp"><div class="crow head"><span></span><span>Now</span><i></i><span>After</span></div>${rows}</div><div class="abdiff"><span>Lost</span>${ic(c.lostIds)}<span>Gained</span>${ic(c.gainedIds)}</div><div class="${broke?'bad':''}">Cost <b>${c.cost}c</b> <span class="mut">(you have ${this.g.save.credits}c${c.disc?` · rep discount ${(c.disc*100).toFixed(0)}%`:''})</span></div><div class="mut small2" data-tip="${esc(c.lines.join('<br>'))}" tabindex="0">${esc(c.lines[3]||'')}</div>${c.block?`<div class="bad">${esc(c.block)}</div>`:''}<div class="popbtns"><button class="btn primary" data-act="confirm-replace" ${c.block||broke?'disabled':''}>Install (${c.cost}c)</button><button class="btn" data-act="cancel-confirm">Cancel</button></div></div></div>`; }
  prepareReplace(uid:string){ const g=this.g, s=g.save; const inst=s.items.find(i=>i.uid===uid)!; const nd=ITEM_BY_ID[inst.def]; const sl=nd.slot; const old=installedLayout(s)[sl]; const od=old?ITEM_BY_ID[old.def]:null; const base=od?INSTALL_COST[od.rarity]:0; const disc=Math.min(.15,repRank(s.rep[nd.mfr])*REP_DISCOUNT_PER_RANK); const cost=Math.round(base*(1-disc));
    const L=installedLayout(s); const L2=cloneLayout(L); L2[sl]={...inst,chips:[]}; const b0=computeBuild(L,s.level,s.rep), b1=computeBuild(L2,s.level,s.rep); const lost=b0.abilities.filter(a=>!b1.abilities.includes(a)).map(a=>ABILITIES[a].name), gained=b1.abilities.filter(a=>!b0.abilities.includes(a)).map(a=>ABILITIES[a].name);
    const lines=[`Abilities lost: ${lost.join(', ')||'none'}`,`Abilities gained: ${gained.join(', ')||'none'}`,`Compatibility: ${b1.mix.mfrs.map(m=>MFR[m].short).join(' + ')||'baseline'}${b1.mix.coolingPenalty>b0.mix.coolingPenalty?` (mixing penalty −${(b1.mix.coolingPenalty*100).toFixed(0)}% cooling)`:''}`, old&&old.chips.length?`Chips on the old hardware (${old.chips.length}) return to locker stock (they are not transferred; re-socket afterwards).`:'No chips affected.'];
    let block=''; if(nd.lvl>s.level) block=`Requires level ${nd.lvl} (you are ${s.level}).`; const hc=wouldConflict(L,sl,nd.id); if(hc) block=hc;
    this.confirm={type:'replace',uid,cost,disc,lines,block,before:b0.stats,after:b1.stats,lostIds:b0.abilities.filter(a=>!b1.abilities.includes(a)),gainedIds:b1.abilities.filter(a=>!b0.abilities.includes(a)),text:`${od?od.name:'empty slot'} → ${nd.name} (${nd.rarity})`}; }
  doReplace(){ const g=this.g,s=g.save; const c=this.confirm; const inst=s.items.find(i=>i.uid===c.uid)!; const nd=ITEM_BY_ID[inst.def]; if(c.block||s.credits<c.cost) return; const old=installedLayout(s)[nd.slot]; s.credits-=c.cost; if(old){ for(const ch of old.chips) s.lockerChips[ch]=(s.lockerChips[ch]||0)+1; old.chips=[]; } s.installed[nd.slot]=inst.uid; persist(s); g.recompute(); this.confirm=null; this.resetDraft(); this.msg='Installed '+nd.name; g.toast('Installed '+nd.name+' ('+c.cost+'c)'); }
  applyDraft(){ const g=this.g,s=g.save; const D=this.draft!; const inst=installedLayout(s); const owned:Record<string,number>={}; for(const c of Object.keys(CHIPS)) owned[c]=(s.lockerChips[c as ChipId]||0)+Object.values(inst).reduce((a,i)=>a+(i?.chips.filter(x=>x===c).length||0),0);
    const used:Record<string,number>={}; for(const sl of SLOTS){ const it=D[sl]; if(!it) continue; if(it.chips.length>SLOT_SOCKETS[sl]){ g.toast('Over socket capacity on '+SLOT_LABEL[sl]); return; } for(const c of it.chips){ if(!chipFits(c,sl)){ g.toast(chipReason(c,sl)); return; } used[c]=(used[c]||0)+1; } }
    for(const c in used) if(used[c]>owned[c]){ g.toast('Not enough '+CHIPS[c as ChipId].name+' chips'); return; }
    for(const sl of SLOTS){ const it=D[sl]; const real=inst[sl]; if(it&&real) real.chips=[...it.chips]; } for(const c in owned) s.lockerChips[c as ChipId]=owned[c]-(used[c]||0); persist(s); g.recompute(); this.resetDraft(); g.toast('Chip configuration applied.'); }
  /** Unequipped grey items (excludes installed; keeps one Standard Issue per slot when a non-stock part is installed so you can always revert). */
  greyDisposable():Inst[]{ const s=this.g.save; const keep=new Set<string>(); for(const sl of SLOTS){ const cur=s.items.find(i=>i.uid===s.installed[sl]); if(cur&&!ITEM_BY_ID[cur.def].id.startsWith('stock_')){ const st=lockerItems(s).find(i=>i.def==='stock_'+sl); if(st) keep.add(st.uid); } }
    return lockerItems(s).filter(i=>ITEM_BY_ID[i.def].rarity==='grey'&&!keep.has(i.uid)); }
  disposeGrey(){ const g=this.g,s=g.save; const list=this.greyDisposable(); if(!list.length){ g.toast('No unequipped grey items to dispose.'); return; } let v=0; const ids=new Set(list.map(i=>i.uid)); for(const i of list){ v+=SELL_VALUE.grey; for(const c of i.chips) s.lockerChips[c]=(s.lockerChips[c]||0)+1; } s.items=s.items.filter(x=>!ids.has(x.uid)); s.credits+=v; persist(s); this.resetDraft(); g.toast(`Disposed ${list.length} grey item${list.length>1?'s':''} for ${v}c`); }
  repairAll(){ const g=this.g,s=g.save; if(s.repairBill<=0){ g.toast('Nothing needs repair.'); return; } if(s.credits<=0){ g.toast('Not enough credits to repair.'); return; } const pay=Math.min(s.credits,s.repairBill); s.credits-=pay; s.repairBill-=pay; persist(s); g.toast(s.repairBill>0?`Partial repair: paid ${pay}c, ${s.repairBill}c still owed.`:`Repaired everything for ${pay}c`); }
  repairBtn(compact=false):string{ const s=this.g.save; const b=s.repairBill; const why=b<=0?'No repairs needed':s.credits<=0?'No credits':''; const lbl=b<=0?'Repair all':s.credits>=b?`Repair all (${b}c)`:`Repair what I can (${s.credits}c of ${b}c)`; return `<button class="btn primary" data-act="repairall" title="${why}" ${why?'disabled':''}>${lbl}</button>${why&&!compact?`<span class="mut stat">${why}</span>`:''}`; }

  buyHw(id:string){ const g=this.g, s=g.save; const d=ITEM_BY_ID[id]; const price=d?this.buyPrice(d):undefined; const cap=s.lockerCap+s.purchases.lockerBlocks*STARTING.lockerPerPurchase; if(d&&UI.BUY[d.rarity]!==undefined&&d.lvl<=s.level&&s.credits>=price!&&capacityUsed(s)<cap){ s.credits-=price!; s.items.push(mkInst(s,d.id)); persist(s); g.toast('Bought '+d.name+' ('+price+'c)'); } this.recCache=null; this.render(); }
  // ----- Recommendations (src/recommend.ts is the pure engine; this is glue + rendering) -----
  recDismissed=new Set<string>(); recNudged=new Set<string>(); recCache:RecResult|null=null;
  buyPrice(d:ItemDef):number{ const b=UI.BUY[d.rarity]; return b===undefined?0:Math.round(b*(1-repDiscount(this.g.save.rep,d.mfr))); }
  recompute():RecResult{ const s=this.g.save; const town=this.g.mode==='town'; const cap=s.lockerCap+s.purchases.lockerBlocks*STARTING.lockerPerPurchase;
    const stock=town?SLOTS.flatMap(sl=>this.shopList(sl)):[];
    this.recCache=recommend({ items:s.items, installed:s.installed, lockerChips:s.lockerChips, credits:s.credits, level:s.level, rep:s.rep, repairBill:s.repairBill, vendorStock:stock, vendorPrice:d=>UI.BUY[d.rarity]||0, lockerFree:cap-capacityUsed(s), greyCount:this.greyDisposable().length, broken:this.g.inst?.broken||[] });
    return this.recCache; }
  recs():RecResult{ return this.recCache||this.recompute(); }
  /** recs the player has not dismissed; at most one chip row (the rest ride on "Apply all chip suggestions") */
  recTop(n=3):Rec[]{ const r=this.recs(); const out:Rec[]=[]; let chip=0; for(const x of r.recs){ if(this.recDismissed.has(x.id)) continue; if(x.kind==='chip'){ if(chip++>0) continue; } out.push(x); if(out.length>=n) break; } return out; }
  recSlots():Set<Slot>{ return new Set(this.recs().recs.filter(x=>x.slot&&!this.recDismissed.has(x.id)).map(x=>x.slot!)); }
  recBadge(sl:Slot):string{ if(this.g.save.settings.recHidden||!this.recSlots().has(sl)) return ''; return '<i class="recb" aria-label="Upgrade available">▲</i>'; }
  recTip(sl:Slot):string{ if(this.g.save.settings.recHidden) return ''; const r=this.recs().recs.filter(x=>x.slot===sl&&!this.recDismissed.has(x.id)); return r.length?'<br><span class="up">▲ Upgrade: '+esc(r[0].title)+' ('+esc(r[0].deltas.slice(0,2).map(d=>(d.pct>0?'+':'')+d.pct+'% '+d.k).join(', '))+')</span>':''; }
  recRow(r:Rec):string{ const s=this.g.save; const ic=r.kind==='chip'?`<span class="tile mini ro" data-chip="${r.chip}" style="border-color:${RARITY_COLOR[CHIPS[r.chip!].rarity]}"><span class="ticon"></span></span>`:`<span class="tile mini ro" data-def="${r.defId}" style="border-color:${rc(ITEM_BY_ID[r.defId!].rarity)}"><span class="ticon"></span></span>`;
    const SHORT:Record<Slot,string>={face:'FACE',brain:'BRAIN',torso:'TORSO',handL:'L HAND',handR:'R HAND',armL:'L ARM',armR:'R ARM',legL:'L LEG',legR:'R LEG',footL:'L FOOT',footR:'R FOOT'};
    const dl=r.deltas.slice(0,3).map(d=>`<i class="${d.pct>0?'up':'dn'}">${d.pct>0?'+':''}${d.pct}% ${d.k}</i>`).join('')+r.gained.slice(0,1).map(a=>`<i class="up">+${esc(ABILITIES[a].name)}</i>`).join('')+r.lost.slice(0,1).map(a=>`<i class="dn">−${esc(ABILITIES[a].name)}</i>`).join('');
    const lbl=r.action==='buy'?'Buy':r.action==='install'?'Install':'Socket'; const price=r.cost>0?`<span class="rc ${r.needed?'bad':''}">${r.cost}c</span>`:'<span class="rc">free</span>';
    const tip=esc('<b>Why?</b><br>'+r.why.map(esc).join('<br>')); void s;
    const name=r.kind==='chip'?esc(CHIPS[r.chip!].name.replace(/ Chip$/,'')):esc(r.title);
    return `<div class="rec" data-rec="${esc(r.id)}" data-tip="${tip}" tabindex="0"><span class="rtop">${ic}<span class="ri"><b>${name}</b><span class="tag">${SHORT[r.slot!]}</span><span class="rd">${dl}</span></span></span><span class="ract">${price}<button class="btn primary sm" data-act="rec-go" data-id="${esc(r.id)}">${lbl}</button><button class="x" data-act="rec-dismiss" data-id="${esc(r.id)}" aria-label="Dismiss" title="Dismiss">×</button></span></div>`; }
  recPanel():string{ const s=this.g.save; const R=this.recs(); const top=this.recTop(3); const chipsN=R.chipMoves.filter(x=>!this.recDismissed.has(x.id)).length; const save=R.saveUp.filter(x=>!this.recDismissed.has(x.id))[0]; const mt=R.maintenance;
    const n=top.length+(save?1:0)+mt.length; if(s.settings.recHidden) return n?`<button class="recshow" data-act="rec-show" aria-label="Show recommendations">▲ ${n} recommended</button>`:'';
    if(!n) return `<div class="recpanel empty"><div class="rhead"><b>Recommended</b><button class="x" data-act="rec-hide" aria-label="Hide recommendations" title="Hide">×</button></div><div class="mut">Nothing to upgrade right now.</div></div>`;
    const sv=save?`<div class="recsave" data-tip="${esc('<b>Why?</b><br>'+save.why.map(esc).join('<br>'))}" tabindex="0">Save up: <b>${esc(save.title)}</b> ${save.deltas.slice(0,2).map(d=>`<i class="up">${d.pct>0?'+':''}${d.pct}% ${d.k}</i>`).join('')} <span class="bad">${save.needed}c more</span></div>`:'';
    const mn=mt.map(m=>`<div class="recmaint">${m.kind==='repair'?'🔧 '+m.why[0].replace(/ \(.*/,''):esc(m.why[0])}<button class="btn sm" data-act="rec-go" data-id="${m.id}">${m.kind==='repair'?'Repair':'Dispose'}</button></div>`).join('');
    return `<div class="recpanel"><div class="rhead"><b>Recommended</b>${chipsN>1?`<button class="btn sm" data-act="rec-chips-all" data-tip="${esc('Socket every suggested chip move ('+chipsN+') in one go. Free; chips come from stock.')}">Apply all chips (${chipsN})</button>`:''}<button class="x" data-act="rec-hide" aria-label="Hide recommendations" title="Hide">×</button></div>${top.map(r=>this.recRow(r)).join('')}${sv}${mn}</div>`; }
  /** apply one chip move directly to the installed hardware (validates fit, stock and capacity) */
  applyChipRec(r:Rec):boolean{ const s=this.g.save; const sl=r.slot!, c=r.chip!; const it=s.items.find(i=>i.uid===s.installed[sl]); if(!it||!chipFits(c,sl)||(s.lockerChips[c]||0)<=0) return false;
    if(r.replaces){ if(it.chips[r.socket!]!==r.replaces) return false; it.chips[r.socket!]=c; s.lockerChips[r.replaces]=(s.lockerChips[r.replaces]||0)+1; } else { if(it.chips.length>=SLOT_SOCKETS[sl]) return false; it.chips.push(c); }
    s.lockerChips[c]=(s.lockerChips[c]||0)-1; return true; }
  recGo(id:string){ const g=this.g, s=g.save; const R=this.recs(); const r=[...R.recs,...R.maintenance].find(x=>x.id===id); if(!r) return;
    if(r.action==='install'){ this.sel=r.slot!; this.pickUid=r.uid!; this.prepareReplace(r.uid!); this.render(); return; }
    if(r.action==='buy'){ this.buyHw(r.defId!); return; }
    if(r.action==='repair'){ this.repairAll(); this.recCache=null; this.render(); return; } if(r.action==='dispose'){ this.disposeGrey(); this.recCache=null; this.render(); return; }
    if(this.applyChipRec(r)){ persist(s); g.recompute(); this.resetDraft(); g.toast(`Socketed ${CHIPS[r.chip!].name} on ${SLOT_LABEL[r.slot!]}`); } else g.toast('That chip move is no longer valid.'); this.recCache=null; this.render(); }
  recChipsAll(){ const g=this.g, s=g.save; let n=0; for(const r of this.recs().chipMoves){ if(this.recDismissed.has(r.id)) continue; if(this.applyChipRec(r)) n++; else break; } if(n){ persist(s); g.recompute(); this.resetDraft(); g.toast(`Applied ${n} chip suggestion${n>1?'s':''}`); } this.recCache=null; this.render(); }
  /** subtle nudge when entering town with a significant upgrade available (once per recommendation per session) */
  recNudge(){ const s=this.g.save; if(s.settings.recHidden||s.settings.recNudge===false) return; const R=this.recompute(); const r=R.significant; if(!r||this.recNudged.has(r.id)) return; this.recNudged.add(r.id);
    this.g.toast(`Upgrade available: ${r.title} (${r.deltas.slice(0,2).map(d=>(d.pct>0?'+':'')+d.pct+'% '+d.k).join(', ')}). Check the ${r.kind==='buy'?'vendor':'locker'}.`); }
  // ----- Vendor -----
  shopSlot:Slot='armR'; chipSel:ChipId|null=null; chipShowAll=false; stTab='all'; pickUid='';
  /** hardware for sale: grey/green/blue only (purple/orange are loot-only). */
  static BUY:Record<string,number>={ grey:15, green:60, blue:300 };
  shopList(sl:Slot){ return ITEMS.filter(d=>d.slot===sl&&!d.id.startsWith('stock_')&&UI.BUY[d.rarity]!==undefined).sort((a,b)=>a.lvl-b.lvl||UI.BUY[a.rarity]-UI.BUY[b.rarity]||a.name.localeCompare(b.name)); }
  shop():string{ const s=this.g.save; const sl=this.shopSlot; const inst=installedLayout(s); const cur=inst[sl]?ITEM_BY_ID[inst[sl]!.def]:null; const cap=s.lockerCap+s.purchases.lockerBlocks*STARTING.lockerPerPurchase; const full=capacityUsed(s)>=cap;
    const SH:Record<Slot,string>={face:'FACE',brain:'BRAIN',torso:'TORSO',handL:'L HAND',handR:'R HAND',armL:'L ARM',armR:'R ARM',legL:'L LEG',legR:'R LEG',footL:'L FOOT',footR:'R FOOT'};
    const tabs=SLOTS.map(x=>{ const d=inst[x]?ITEM_BY_ID[inst[x]!.def]:null; return `<button class="slot tile mini ${x===sl?'sel':''}" data-act="shopslot" data-slot="${x}" ${d?`data-def="${d.id}"`:''} data-tip="${esc('<b>'+esc(SLOT_LABEL[x])+'</b><br>'+(d?esc(d.name):'empty')+this.recTip(x))}" style="border-color:${d?rc(d.rarity):'#555'}"><b>${SH[x]}</b><span class="ticon">${d?'':'<span class="tempty">—</span>'}</span>${this.recBadge(x)}</button>`; }).join('');
    const SK:[keyof Stats,string][]=[['maxHp','HP'],['dmg','DMG'],['atkSpeed','ATK'],['cooling','COOL'],['move','MOVE'],['pickup','PICK'],['regen','REG'],['armor','ARM']];
    const delta=(d:ItemDef)=>SK.map(([k,l])=>{ const v=(d.stats[k]||0)-(cur?.stats[k]||0); if(!v) return ''; const f=Math.abs(v)<10?(Math.round(v*100)/100):Math.round(v); return `<span class="${v>0?'up':'dn'}">${l} ${v>0?'+':''}${f}</span>`; }).filter(Boolean).join(' ')||'<span class="mut">same stats</span>';
    const rows=this.shopList(sl).map(d=>{ const price=this.buyPrice(d); const lock=d.lvl>s.level; const why=lock?'Req Lv '+d.lvl:s.credits<price?'Need '+price+'c':full?'Locker full':'';
      const ab=(d.abilities||[]).map(a=>ABILITIES[a]?.name).filter(Boolean).join(', ');
      const tip='<b style="color:'+rc(d.rarity)+'">'+esc(d.name)+'</b><br>'+esc(MFR[d.mfr].name)+' · '+d.rarity+' · req Lv '+d.lvl+'<br>'+SK.filter(([k])=>d.stats[k]).map(([k,l])=>l+' '+d.stats[k]).join(' · ')+(ab?'<br>Abilities: '+esc(ab):'')+(d.weapon?'<br>Weapon: '+d.weapon:'')+(d.blurb?'<br><span class="mut">'+esc(d.blurb)+'</span>':'')+'<br><span class="mut">vs equipped'+(cur?' ('+esc(cur.name)+')':' (empty)')+':</span> '+delta(d);
      return `<div class="row shoprow" data-tip="${esc(tip)}" style="border-color:${rc(d.rarity)}"><span class="tile mini ro" data-def="${d.id}" style="border-color:${rc(d.rarity)}"><span class="ticon"></span></span><span class="si"><b style="color:${rc(d.rarity)}">${esc(d.name)}</b><span class="tag" style="border-color:${MFR[d.mfr].accent}">${esc(MFR[d.mfr].short)}</span><span class="tag ${lock?'bad':''}">Lv ${d.lvl}</span><span class="vs">${delta(d)}</span></span><button class="btn ${why?'':'primary'}" data-act="buyhw" data-id="${d.id}" ${why?'disabled':''}>${why?esc(why):'Buy '+price+'c'}</button></div>`; }).join('')||'<div class="row mut">No hardware for this slot</div>';
    return `<div class="col shopcol"><h3>Hardware for sale · ${esc(SLOT_LABEL[sl])}</h3><div class="shoptabs">${tabs}</div><div class="list shoplist">${rows}</div><div class="mut">Compared with ${cur?esc(cur.name):'nothing installed'}. Purple and orange hardware is loot-only. ${capacityUsed(s)}/${cap} locker.</div></div>`; }
  vendor():string{ const s=this.g.save; const items=lockerItems(s).filter(i=>!ITEM_BY_ID[i.def].id.startsWith('stock_')||true);
    return (this.confirm?this.confirmHtml():'')+this.shop()+`<div class="col">${this.recPanel()}<h3>Repairs</h3><div>Repair bill: <b>${s.repairBill}c</b> · Credits: <b>${s.credits}c</b></div>${this.repairBtn()}
      <div class="mut">Downs add random hardware damage and a repair bill; checkpoints restore function but the bill stays until paid here.</div><h3>Consumables</h3><button class="btn" data-act="buystim" ${s.credits>=30?'':'disabled'}>Buy stim (30c)</button> Locker stims: ${s.stims}</div>
      <div class="col"><h3>Sell hardware from storage</h3><div class="list">${items.map(i=>{ const d=ITEM_BY_ID[i.def]; return `<div class="row" style="border-color:${rc(d.rarity)}"><span>${esc(d.name)} <span class="tag">${d.rarity}</span></span><button class="btn" data-act="sell" data-uid="${i.uid}">Sell ${SELL_VALUE[d.rarity]}c</button></div>`; }).join('')||'<div class="row mut">Nothing to sell</div>'}</div><div class="mut">Convenience sales are storage-only (no remote vendor mid-run).</div></div>`; }
  // ----- Gate -----
  gate():string{ const g=this.g, s=g.save, inst=s.instance; const live=!!inst&&inst.expiresAt>Date.now(); const cur=live?(inst!.dungeon||'annex'):null;
    const all=DUNGEON_LIST; const shown=all.filter(d=>this.showAll||inBand(d,s.level)||cur===d.id);
    let h=`<div class="col wide"><h3>Dungeon select</h3><div class="mut">Level ${s.level}. Each dungeon has its own daily clear (boss completion consumes it; entry alone does not). One live instance at a time. Hardware is locked once you enter.</div>
      <label><input type="checkbox" data-in="dshowall" ${this.showAll?'checked':''}/> Show all dungeons (${all.length-all.filter(d=>inBand(d,s.level)).length} outside your level band)</label>`;
    if(!shown.length) h+='<div class="row mut">No dungeons in your level band. Tick "Show all".</div>';
    for(const d of shown){ const locked=g.dailyLocked(d.id); const isLive=cur===d.id; const lowL=s.level<d.minLevel, hiL=s.level>d.maxLevel; const mf=MFR[d.mfr];
      h+=`<div class="draftbar" style="margin-top:8px;border-color:${mf.accent}"><b>${esc(d.name)}</b> <span class="tag" style="border-color:${mf.accent}">${mf.short}</span> <span class="tag">${esc(d.district)}</span> ${d.tier?`<span class="tag" title="Content tier">Tier ${['','I','II','III','IV'][d.tier]}</span>`:''}<span class="tag">Lv ${d.minLevel}–${d.maxLevel}</span> <span class="tag">~${d.estMinutes[0]}–${d.estMinutes[1]} min</span>
        <div>${esc(d.blurb)}</div><div class="mut">Areas: ${Object.entries(d.zoneLabels).filter(([k])=>!['passage','salvage'].includes(k)).map(([,v])=>esc(v)).join(' → ')} · item level cap ${d.tierCap}</div>
        ${lowL?'<div class="warn">Under-level: gear above your level will not drop (no downward reroll). XP is the main reward.</div>':''}${hiL?'<div class="mut">Above this dungeon\'s recommended band.</div>':''}`;
      if(isLive){ const f=inst!.flags; const rem=Math.max(0,inst!.expiresAt-Date.now()); h+=`<div style="margin-top:6px"><b>Existing instance</b> · expires in ${Math.floor(rem/3600000)}h ${Math.floor(rem%3600000/60000)}m<br>Boss: ${f.bossDead?'defeated':f.bossSpawned?'alive':'not yet met'} · Objective: ${f.controller?'secured':'not secured'} · Loot on ground: ${inst!.drops.length} · Selected boss: ${f.bossKey?esc(ENEMIES[f.bossKey].name):'none yet'}<br>You re-enter at the entry and must run back through surviving enemies.</div><button class="btn primary" data-act="enter" data-id="${d.id}">${f.completed?'Re-enter to retrieve loot':'Re-enter instance'}</button>${this.resetBlock()}`; }
      else if(unlockReason(s,d.id,!!s.settings.devFreeReset)) h+=`<div class="warn" style="margin-top:6px">${esc(unlockReason(s,d.id,!!s.settings.devFreeReset)!)}</div><button class="btn" disabled>Locked</button>`;
      else h+=`<div style="margin-top:6px">${locked?'<span class="warn">Daily clear already used. A fresh run unlocks at tomorrow\'s reset (local midnight; timer anchor is an open spec decision).</span>':'Daily clear available.'}</div><button class="btn primary" data-act="enter" data-id="${d.id}" ${locked||cur?'disabled':''}>${cur?'Finish or abandon your other instance first':'Start fresh run'}</button>`;
      h+='</div>'; }
    h+=`<div class="mut" style="margin-top:8px">Party, QR/code fifth guest and co-op networking are not implemented in this prototype (see README and docs/UNIVERSE.md roadmap).</div></div>`; return h; }
  resetBlock(fromMenu=false):string{ const g=this.g, i=g.resetInfo(); if(!i.has) return ''; const d=DUNGEONS[i.id]; const run=g.mode==='run';
    let h=`<div class="draftbar" style="margin-top:6px;border-color:${i.allowed?'var(--oxide)':'#555'}"><b>Reset instance</b> <span class="mut">(${esc(d?.short||i.id)})</span><div class="mut">${esc(i.why)}</div>`;
    if(this.resetAsk&&i.allowed) h+=`<div class="warn">Abandon this instance${i.lost?' and discard '+i.lost+' uncollected loot item(s)':''}? ${run?'You restart at the entry immediately.':'You can then start a fresh run.'} The repair bill is kept.</div><button class="btn primary" data-act="reset-go">Confirm reset</button><button class="btn" data-act="reset-cancel">Cancel</button>`;
    else h+=`<button class="btn ${i.allowed?'':'dim'}" data-act="reset-ask" ${i.allowed?'':'disabled'}>Reset instance${i.dev?' (prototype)':''}</button>`;
    if(run) h+=` <button class="btn" data-act="restart-cp">Restart from checkpoint</button>`;
    if(!fromMenu||!run) h+=` <button class="btn" data-act="abandon" title="Close the instance and forfeit remaining loot; no new run until the lockout allows">Abandon only</button>`;
    return h+'</div>'; }
  summary():string{ const g=this.g, r=g.runSummary(); if(!r) return '<div class="col">No instance.</div>'; const mm=Math.floor(r.time/60), ss=Math.floor(r.time%60); const info=g.resetInfo();
    const col=(x:string)=>RARITY_COLOR[x as 'grey']||'#ccc';
    return `<div class="col wide"><h3>${esc(r.dungeon)} — ${r.cleared?'CLEARED':'in progress'}</h3>
      <div class="sumgrid"><span>Time in instance</span><b>${mm}m ${String(ss).padStart(2,'0')}s</b><span>Enemies defeated</span><b>${r.kills}</b><span>Boss</span><b>${esc(r.boss||'—')}</b><span>Route</span><b>${esc(String(r.route))}</b><span>XP earned</span><b>${r.xp}</b><span>Credits in pack</span><b>${r.credits}c</b><span>Repair bill added</span><b>${r.repair}c</b></div>
      <h3>Loot recap</h3><div>In your pack (${g.carriedCount()}/${COMBAT.missionSlots}): ${r.carried.length?r.carried.map(i=>`<span class="tag" style="border-color:${col(i.rarity)};color:${col(i.rarity)}">${esc(i.name)}</span>`).join(' '):'<span class="mut">no hardware</span>'}${Object.entries(r.chips).map(([k,v])=>` <span class="tag">${esc(CHIPS[k as ChipId]?.name||k)} ×${v}</span>`).join('')}${r.stims?` <span class="tag">stims ×${r.stims}</span>`:''}</div>
      <div style="margin-top:4px">${r.ground?`<span class="warn">${r.ground} item(s) still on the ground</span> ${Object.entries(r.groundByRarity).map(([k,v])=>`<span class="tag" style="border-color:${col(k)}">${v} ${k}</span>`).join(' ')}`:'<span class="mut">Nothing left on the ground.</span>'}</div>
      <div class="mut" style="margin-top:6px">Loot is personal and stays until the instance expires. Unload at the town locker (pack slots are limited).</div>
      <div style="margin-top:10px"><button class="btn primary" data-act="sum-town">Return to town</button> <button class="btn" data-act="close">Keep looting</button>
      <button class="btn" data-act="reset-go" ${info.allowed?'':'disabled'} title="${esc(info.why)}">${info.dev?'Re-run (prototype reset)':'Quick re-run (fresh instance)'}</button></div>
      ${info.allowed?'':'<div class="mut">Quick re-run is unavailable: '+esc(info.why)+'</div>'}</div>`; }
  // ----- Contacts & contracts -----
  contractRow(k:ContractDef):string{ const s=this.g.save, cs=contractState(s); const act=k.id in cs.active; const prog=cs.active[k.id]||0; const doneOnce=cs.done.includes(k.id), doneToday=cs.doneDay[k.id]===todayStr(); const low=s.level<k.minLevel;
    const rw=`${k.reward.credits}c${k.reward.rep?' · rep '+Object.entries(k.reward.rep).map(([m,v])=>MFR[m as 'HI'].short.split(' ')[0]+' +'+v).join(', '):''}`;
    let btn=''; if(doneOnce) btn='<span class="tag good">completed</span>'; else if(doneToday) btn='<span class="tag good">done today</span>'; else if(act){ btn=prog>=k.goal.n?`<button class="btn primary" data-act="claim" data-id="${k.id}">Claim ${k.reward.credits}c</button>`:`<span class="tag">${prog}/${k.goal.n}</span> <button class="btn" data-act="dropk" data-id="${k.id}">Drop</button>`; } else btn=`<button class="btn" data-act="accept" data-id="${k.id}" ${low||Object.keys(cs.active).length>=MAX_ACTIVE_CONTRACTS?'disabled':''}>Accept</button>`;
    return `<div class="row"><span><b>${esc(k.title)}</b> <span class="tag">${k.repeat}</span> <span class="tag">Lv ${k.minLevel}+</span><br><span class="mut">${esc(k.text)} Reward: ${rw}.</span>${low?'<br><span class="warn">Requires level '+k.minLevel+'.</span>':''}</span><span>${btn}</span></div>`; }
  contacts():string{ const s=this.g.save, cs=contractState(s); const c=CONTACT_BY_ID[this.contactSel]||CONTACTS[0];
    const list=CONTACTS.map(x=>`<button class="slot ${x.id===c.id?'sel':''}" data-act="dsel" data-id="${x.id}" style="width:100%;text-align:left"><b>${esc(x.name)}</b> <span class="mut">${x.role} · ${x.faction==='independent'?'independent':MFR[x.faction].short}</span></button>`).join('');
    return `<div class="col narrow"><h3>Contacts</h3>${list}<div class="mut" style="margin-top:6px">Active contracts ${Object.keys(cs.active).length}/${MAX_ACTIVE_CONTRACTS}.</div></div>
      <div class="col"><h3>${esc(c.name)}</h3><div class="mut">${c.role} · ${c.faction==='independent'?'independent':esc(MFR[c.faction].name)} · ${esc(c.district)}</div><div style="margin:6px 0">${esc(c.bio)}</div><div><i>${esc(c.greeting)}</i></div>
      ${c.id==='odalys_vane'?'<button class="btn" data-act="openstory">Talk to Odalys</button>':''}
      <h3>Contracts</h3><div class="mut">Fixed goals with set credit and reputation rewards.</div>${c.contracts.map(k=>this.contractRow(k)).join('')}</div>`; }
  // ----- Fixer / story -----
  fixer():string{ const g=this.g; const st=g.story(); const clue=st.clues; const t=st.town; const c=CONTACT_BY_ID['odalys_vane'];
    const quote=t?t.text:c.greeting.replace(/^"|"$/g,'');
    const found=[clue.A,clue.B,clue.general].filter(Boolean).length; const dl=Object.entries(st.dclues||{});
    const lead=t?'Pick one of Odalys\'s offers below, then run a dungeon to follow it up.':found>0?'Use what you have learned: check the terminal, armory markings or announcements on your next Annex run.':'Run the Annex and look for terminals, armory markings and announcements. Come back with news.';
    const row=(icon:string,label:string,val:string|null)=>`<div class="clue ${val?'':'locked'}"><span class="ci" aria-hidden="true">${val?icon:'?'}</span><span class="cl"><b>${label}</b>${val?esc(val):'<span class="mut">Not found yet</span>'}</span></div>`;
    const humanEvent=(e:{kind:string;key:string;n:number})=>{ const mf=(MFR as any)[e.key]; const dn=(DUNGEONS as any)[e.key]?.short||e.key; switch(e.kind){ case 'kill_mfr': return 'Defeated '+e.n+' '+(mf?mf.short:e.key)+' enemies'; case 'boss_defeated': return 'Defeated boss: '+e.key.replace(/_/g,' '); case 'condition_used': return 'Used boss condition '+e.key; case 'route_used': return 'Took route '+e.key.replace(/_/g,' '); case 'run_cleared': return 'Cleared '+dn+(e.n>1?' ×'+e.n:''); case 'town_choice': return 'Chose: '+e.key.replace(/_/g,' '); case 'contract_done': return 'Finished contract: '+(CONTRACT_BY_ID[e.key]?.title||e.key.replace(/_/g,' ')); default: return e.kind.replace(/_/g,' ')+' '+e.key; } };
    const nm=(id:string)=>CONTACT_BY_ID[id]?.name||(MFR as any)[id]?.short||(id==='player'?'You':id);
    const dev=g.save.settings.devFreeReset?`<details class="devd"><summary>Developer details</summary><div class="devbody"><h3>Relationships</h3>${st.edges.map(e=>`<div class="mut">${esc(nm(e.from))} → ${esc(nm(e.to))}: ${esc(e.roles.join(', '))} (weight ${e.w})</div>`).join('')}<h3>Recent events</h3>${st.events.filter(e=>e.id>st.lastProposalEvent).slice(-8).map(e=>`<div class="mut" data-tip="${esc('Event #'+e.id+' '+e.kind+':'+e.key)}">${esc(humanEvent(e))}</div>`).join('')||'<div class="mut">none</div>'}<h3>Generation log</h3><div class="mut">Provider: ${esc(makeProvider(g.save.settings.llm).name)}</div>${st.log.slice(-6).reverse().map(l=>`<div class="${l.ok?'good':'bad'}">${esc(l.provider)} ${l.ok?'ok':'failed'} (${l.ms} ms): ${esc(l.note)}</div>`).join('')||'<div class="mut">none</div>'}</div></details>`:'';
    return `<div class="col fixcol"><div class="npchead"><span class="avatar" aria-hidden="true">OV</span><div><h3 style="margin:0">${esc(c.name)}</h3><div class="mut">Fixer · ${esc(c.district)}</div></div></div>
      <blockquote class="quote">“${esc(quote)}”</blockquote>
      <div class="lead"><b>Next:</b> ${esc(lead)}</div>
      ${t?`<div class="offers">${t.options.map(o=>`<button class="btn primary" data-act="townchoice" data-id="${o.id}" data-boost="${o.boosts}">${esc(o.label)}</button>`).join('')}</div>`:''}
      <h3>Clues (${found}/3)</h3>
      ${row('🔓','Hack clue',clue.A)}${row('💪','Force clue',clue.B)}${row('📌','General lead',clue.general)}
      ${dl.length?`<h3>Dungeon leads</h3>${dl.map(([d,v])=>row('📍',esc(DUNGEONS[d]?.short||d),[v.A,v.B,v.general].filter(Boolean).join(' / ')||null)).join('')}`:''}
      <h3>Story <span class="help" data-tip="${esc('<b>How story updates work</b><br>Provider: '+esc(makeProvider(g.save.settings.llm).name)+'. Runs outside combat; invalid or failed output keeps the previous story. Bosses, drops and access never depend on it.')}" tabindex="0">?</span></h3>
      <div class="mut">Odalys reviews your recent runs and may share new leads.</div>
      <div class="actrow"><button class="btn primary" data-act="story" ${this.storyBusy?'disabled':''}>${this.storyBusy?'Requesting…':'Ask for a story update'}</button><button class="btn" data-act="opencontacts">Contracts</button></div>
      <div id="storymsg" class="mut">${esc(this.storyMsg)}</div>${dev}</div>`; }
  // ----- Store -----
  store():string{ const s=this.g.save; const skins=[['salvage_grey','Salvage Grey finish'],['ivory_ward','Ivory Ward finish'],['oxide_work','Oxide Workwear']]; return `<div class="col"><h3>Simulated entitlements</h3><div class="mut">No real checkout. Only skins and permanent account-wide locker capacity are sold. Purchases persist across seasons.</div>
    <div style="margin-top:8px"><b>Locker capacity</b>: ${s.lockerCap+s.purchases.lockerBlocks*STARTING.lockerPerPurchase} slots (bought blocks: ${s.purchases.lockerBlocks})<br><button class="btn primary" data-act="buylocker">Buy +${STARTING.lockerPerPurchase} slots (simulated)</button></div>
    <h3>Skins</h3>${skins.map(([id,n])=>`<div class="row"><span>${n} ${s.purchases.skins.includes(id)?'<span class="tag good">owned</span>':''}</span>${s.purchases.skins.includes(id)?`<button class="btn" data-act="skin" data-id="${id}">${s.purchases.equippedSkin===id?'Unequip':'Equip'}</button>`:`<button class="btn" data-act="buyskin" data-id="${id}">Buy (simulated)</button>`}</div>`).join('')}<div class="mut">Skins are entitlement records only in this prototype (no skin art yet).</div></div>`; }
  // ----- Settings -----
  settings():string{ return settingsHtml(this); }
  dev():string{ return `<div class="col"><h3>Prototype helpers</h3><div class="mut">Grants items into the locker for testing the three example builds. These are test shortcuts, not saved loadout presets.</div>
    ${Object.entries(BUILD_KITS).map(([k,b])=>`<div class="row"><span>Build ${k}: ${b.name}</span><span><button class="btn" data-act="kit" data-k="${k}">Grant kit</button><button class="btn" data-act="equipkit" data-k="${k}">Grant + equip (free)</button></span></div>`).join('')}
    <h3>Ranged weapons (grant + equip free)</h3>${WEAPON_ITEMS.map(w=>`<button class="btn" data-act="wequip" data-id="${w.id}">${esc(w.name)} <span class="mut">[${w.rarity}]</span></button>`).join('')}<button class="btn" data-act="wequip" data-id="stock_handR">Default pop pistol</button>
    <h3>State</h3><button class="btn" data-act="lvl" data-d="-6">Level −6</button><button class="btn" data-act="lvl" data-d="6">Level +6</button><button class="btn" data-act="credits">+1000c</button><button class="btn" data-act="resetlock">Reset daily lockout</button><button class="btn" data-act="expire">Expire instance now</button><button class="btn" data-act="devrestart">Restart from start (\\)</button><button class="btn" data-act="rep">+30 rep all</button><br><button class="btn" data-act="grantnew">Grant all dungeon-pack hardware (incl. orange)</button> Set level: ${[12,20,26,30,34].map(l=>`<button class="btn" data-act="setlvl" data-d="${l}">${l}</button>`).join('')}</div>
    <div class="col"><h3>Current</h3><div>Level ${this.g.save.level} · ${this.g.save.credits}c · repair ${this.g.save.repairBill}c · lockout day: ${this.g.save.lastClearDay||'none'} (today ${todayStr()})</div><div class="mut">Press ${'`'} to toggle this panel.</div></div>`; }

  // ================= events =================
  input(e:Event){ if(settingsInput(this,e)) return; const t=e.target as HTMLInputElement; const k=t.dataset.in; if(!k) return; const s=this.g.save, st=s.settings;
    if(k==='search'){ this.search=t.value; this.render(); const el=document.querySelector<HTMLInputElement>('[data-in=search]'); el?.focus(); el?.setSelectionRange(t.value.length,t.value.length); return; }
    if(k==='dshowall'){ this.showAll=t.checked; this.render(); return; }
    if(k==='uisize'){ st.uiSize=t.value as any; applyUiScale(st.uiSize); this.render(); } else if(k==='minimap'){ this.setMinimap(t.checked); } else if(k==='gore') st.gore=t.value as any; else if(k==='dmgnum') st.damageNumbers=t.checked; else if(k==='reduced') st.reducedFx=t.checked; else if(k==='lootlabels') st.lootLabels=t.value as any; else if(k==='lootmin') st.lootMin=t.value as any; else if(k==='devreset'){ st.devFreeReset=t.checked; this.resetAsk=false; persist(s); this.render(); return; } else if(k==='joyfixed'){ st.joystickFixed=t.checked; }
    else if(k==='music'){ st.music=t.checked; this.audio.setMusicOn(t.checked); } else if(k==='vol'){ st.volume=+t.value; this.audio.setVolume(st.volume); }
    else if(k==='llmon') st.llm.enabled=t.checked; else if(k==='llmurl') st.llm.url=t.value; else if(k==='llmkey') st.llm.key=t.value; else if(k==='llmmodel') st.llm.model=t.value; persist(s); }
  click(e:MouseEvent){ const el=(e.target as HTMLElement).closest('[data-act]') as HTMLElement|null; if(!el) return; const a=el.dataset.act!; const g=this.g, s=g.save; this.audio.resume(); if(a.startsWith('s-')&&settingsClick(this,el,a)) return;
    switch(a){
      case 'close': this.close(); return;
      case 'sel': this.sel=el.dataset.slot as Slot; this.chipSel=null; this.render(); return;
      case 'pick': this.pickUid=el.dataset.uid!; this.render(); return;
      case 'sttab': this.stTab=el.dataset.tab!; this.render(); return;
      case 'gosel': this.sel=el.dataset.slot as Slot; this.render(); return;
      case 'sock': if(this.chipSel){ this.socketChip(this.chipSel); } else this.g.toast('Pick a compatible chip below, then click a socket.'); return;
      case 'unsock': { const it=this.draft![this.sel]; if(it) it.chips.splice(+el.dataset.i!,1); this.render(); return; }
      case 'pickchip': { const c=el.dataset.chip as ChipId; this.chipSel=this.chipSel===c?null:c; this.render(); return; }
      case 'noop': return;
      case 'chipshowall': this.chipShowAll=!this.chipShowAll; this.render(); return;
      case 'clearchips': { const it=this.draft![this.sel]; if(it) it.chips=[]; this.render(); return; }
      case 'bestfit': this.bestFit(); return;
      case 'apply': this.applyDraft(); this.render(); return; case 'discard': this.resetDraft(); this.render(); return;
      case 'replace': this.prepareReplace(el.dataset.uid!); this.render(); return; case 'cancel-confirm': this.confirm=null; this.render(); return; case 'confirm-replace': this.doReplace(); this.render(); return;
      case 'unload': this.unload(); this.render(); return;
      case 'sellgrey': this.disposeGrey(); this.render(); return;
      case 'repairall': this.repairAll(); this.render(); return;
      case 'repair': { const pay=Math.min(s.credits,s.repairBill); s.credits-=pay; s.repairBill-=pay; persist(s); this.render(); return; }
      case 'rec-go': this.recGo(el.dataset.id!); return; case 'rec-chips-all': this.recChipsAll(); return;
      case 'rec-dismiss': this.recDismissed.add(el.dataset.id!); this.render(); return; case 'rec-hide': s.settings.recHidden=true; persist(s); this.render(); return; case 'rec-show': s.settings.recHidden=false; persist(s); this.render(); return;
      case 'shopslot': this.shopSlot=el.dataset.slot as Slot; this.render(); return;
      case 'buyhw': this.buyHw(el.dataset.id!); return;
      case 'buystim': if(s.credits>=30){ s.credits-=30; s.stims++; persist(s); } this.render(); return;
      case 'sell': { const i=s.items.find(x=>x.uid===el.dataset.uid); if(i&&!Object.values(s.installed).includes(i.uid)){ s.credits+=SELL_VALUE[ITEM_BY_ID[i.def].rarity]; for(const c of i.chips) s.lockerChips[c]=(s.lockerChips[c]||0)+1; s.items=s.items.filter(x=>x!==i); persist(s); } this.render(); return; }
      case 'enter': { if(g.startRun(el.dataset.id||'annex')){ this.close(); } else this.render(); return; }
      case 'opencontacts': this.open('contacts'); return; case 'dsel': this.contactSel=el.dataset.id!; this.render(); return; case 'openstory': this.open('fixer'); return;
      case 'accept': { const k=CONTRACT_BY_ID[el.dataset.id!]; const cs=contractState(s); if(k&&s.level>=k.minLevel&&Object.keys(cs.active).length<MAX_ACTIVE_CONTRACTS&&!cs.done.includes(k.id)&&cs.doneDay[k.id]!==todayStr()){ cs.active[k.id]=0; persist(s); } this.render(); return; }
      case 'dropk': { const cs=contractState(s); delete cs.active[el.dataset.id!]; persist(s); this.render(); return; }
      case 'claim': { const k=CONTRACT_BY_ID[el.dataset.id!]; const cs=contractState(s); if(k&&(cs.active[k.id]||0)>=k.goal.n){ s.credits+=k.reward.credits; for(const [m,v] of Object.entries(k.reward.rep||{})) s.rep[m as 'HI']+=v as number; delete cs.active[k.id]; if(k.repeat==='once') cs.done.push(k.id); else cs.doneDay[k.id]=todayStr(); record(g.story(),'contract_done',k.id); g.toast('Contract complete: '+k.title+' (+'+k.reward.credits+'c)'); persist(s); } this.render(); return; }
      case 'setlvl': s.level=Math.max(1,Math.min(PROGRESSION.maxLevel,+el.dataset.d!)); g.recompute(); persist(s); this.render(); return;
      case 'grantnew': { for(const d of [...EXTRA_ITEMS,...WEAPON_ITEMS]){ if(!s.items.some(i=>i.def===d.id)) s.items.push(mkInst(s,d.id)); } for(const c of ['ablative','fineedge','quench','overdrive','gridlink'] as ChipId[]) s.lockerChips[c]=(s.lockerChips[c]||0)+3; s.lockerCap=Math.max(s.lockerCap,120); persist(s); g.toast('Granted all dungeon-pack hardware (dev)'); this.render(); return; }
      case 'abandon': g.abandonInstance(); this.resetAsk=false; this.render(); return;
      case 'wequip': { const id=el.dataset.id!; let it=s.items.find(i=>i.def===id); if(!it){ it=mkInst(s,id); s.items.push(it); } s.installed[ITEM_BY_ID[id].slot]=it.uid; s.lockerCap=Math.max(s.lockerCap,120); persist(s); g.recompute(); g.toast('Equipped '+ITEM_BY_ID[id].name+' (dev)'); this.render(); return; }
      case 'reset-ask': this.resetAsk=true; this.render(); return; case 'reset-cancel': this.resetAsk=false; this.render(); return;
      case 'reset-go': this.resetAsk=false; if(g.resetInstance()&&g.mode==='run') this.close(); else this.render(); return;
      case 'sum-town': this.close(); g.townReturn(); return;
      case 'restart-cp': g.restartFromCheckpoint(); this.close(); return;
      case 'devrestart': g.devRestartFromStart(); this.devOpen=false; this.close(); return;
      case 'townchoice': { const st=g.story(); record(st,'town_choice',el.dataset.boost!); st.arc=el.dataset.boost!; const ed=st.edges.find(x=>x.from==='player'&&x.to==='odalys_vane'); if(ed) ed.w+=1; st.town=null; persist(s); this.msg='Odalys will push the "'+el.dataset.boost+'" lead.'; this.render(); return; }
      case 'story': this.runStory(); return;
      case 'buylocker': s.purchases.lockerBlocks++; persist(s); this.render(); return; case 'buyskin': s.purchases.skins.push(el.dataset.id!); persist(s); this.render(); return; case 'skin': s.purchases.equippedSkin=s.purchases.equippedSkin===el.dataset.id?null:el.dataset.id!; persist(s); this.render(); return;
      case 'resethints': try{ localStorage.removeItem('wv_hints'); }catch{} this.hintCtx=''; this.toast('Tutorial hints will show again.'); return;
      case 'wipe': wipe(); location.reload(); return; case 'dev': this.open('dev'); return;
      case 'kit': case 'equipkit': this.kit(el.dataset.k!,a==='equipkit'); this.render(); return;
      case 'lvl': s.level=Math.max(1,Math.min(PROGRESSION.maxLevel,s.level+ +el.dataset.d!)); g.recompute(); persist(s); this.render(); return;
      case 'credits': s.credits+=1000; persist(s); this.render(); return; case 'resetlock': s.lastClearDay=null; s.lockouts={}; persist(s); this.render(); return;
      case 'expire': if(s.instance){ s.instance.expiresAt=Date.now()-1; } g.inst=s.instance; if(g.mode==='town'){ s.instance=null; g.inst=null; } persist(s); this.render(); return; case 'rep': s.rep.HI+=30; s.rep.PS+=30; s.rep.MM+=30; persist(s); this.render(); return;
    } }
  unload(){ const g=this.g,s=g.save,c=g.inst?.carried; if(!c) return; const cap=s.lockerCap+s.purchases.lockerBlocks*STARTING.lockerPerPurchase; s.credits+=c.credits; c.credits=0; const rest:Inst[]=[]; for(const it of c.items){ if(capacityUsed(s)<cap) s.items.push(it); else rest.push(it); } c.items=rest;
    for(const [k,v] of Object.entries(c.chips)){ const kk=k as ChipId; if((s.lockerChips[kk]||0)>0||capacityUsed(s)<cap){ s.lockerChips[kk]=(s.lockerChips[kk]||0)+(v||0); delete c.chips[kk]; } } s.stims+=c.stims; c.stims=0; persist(s); if(rest.length||Object.keys(c.chips).length) g.toast('Locker full: some items stayed in your pack. Sell or buy capacity.'); else g.toast('Unloaded into locker.'); }
  kit(k:string,equip:boolean){ const g=this.g,s=g.save; const kit=BUILD_KITS[k]; if(equip){ for(const sl of SLOTS){ const st=s.items.find(i=>i.def==='stock_'+sl); if(st) s.installed[sl]=st.uid; } } for(const [sl,id] of Object.entries(kit.items)){ const it=mkInst(s,id!); s.items.push(it); if(equip) s.installed[sl as Slot]=it.uid; } for(const [c,n] of Object.entries(kit.chips)) s.lockerChips[c as ChipId]=(s.lockerChips[c as ChipId]||0)+(n||0);
    if(equip){ // auto-socket a sensible chip set so the build has its stated plan
      const L=installedLayout(s); const put=(sl:Slot,chips:ChipId[])=>{ const it=L[sl]; if(!it) return; for(const c of chips){ if(chipFits(c,sl)&&(s.lockerChips[c]||0)>0&&it.chips.length<SLOT_SOCKETS[sl]){ it.chips.push(c); s.lockerChips[c]!--; } } };
      if(k==='A'){ put('handR',['speed','cutwide']); put('handL',['power']); put('torso',['coolant','coolant','coolant','sustain','sustain','plating']); } if(k==='B'){ put('handR',['speed','bladepat']); put('torso',['cloakdur','cloakdur','coolant','coolant','sustain','sustain']); } if(k==='C'){ put('brain',['ctrldur','ctrldur','coolant','coolant']); put('handR',['power','power']); put('torso',['sustain','sustain']); } }
    persist(s); g.recompute(); this.resetDraft(); g.toast('Granted build '+k+(equip?' and equipped (dev)':'')); }
  async runStory(){ const g=this.g; this.storyBusy=true; this.storyMsg='Requesting a bounded proposal…'; this.render(); const st=g.story(); this.storyMsg=await runStoryStep(st,makeProvider(g.save.settings.llm)); this.storyBusy=false; persist(g.save); this.render(); }
}
