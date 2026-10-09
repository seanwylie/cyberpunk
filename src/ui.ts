import { Game } from './sim';
import { AudioSys } from './audio';
import { ABILITIES, CHIPS, ChipId, COMBAT, ENEMIES, INSTALL_COST, ITEM_BY_ID, ITEMS, MFR, RARITY_COLOR, REP_DISCOUNT_PER_RANK, SELL_VALUE, SLOT_LABEL, SLOT_SOCKETS, SLOTS, Slot, Stats, REPAIR_COST, RARITIES, STARTING, PROGRESSION, ItemDef } from './config';
import { Layout, cloneLayout, computeBuild, hardConflicts, installedLayout, repRank, wouldConflict } from './build';
import { Inst, capacityUsed, lockerItems, mkInst, persist, wipe, todayStr, newSave } from './state';
import { makeProvider, runStoryStep, newStory, MockProvider, record } from './story';

const $=(id:string)=>document.getElementById(id)!;
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
export const BUILD_KITS:Record<string,{name:string;items:Partial<Record<Slot,string>>;chips:Partial<Record<ChipId,number>>}> = {
  A:{ name:'Ripper & cooling (heavy industrial)', items:{ armR:'hi_ripper_arm', handR:'hi_cutting_head', handL:'hi_clamp', legL:'hi_legs_l', legR:'hi_legs_r', torso:'hi_torso_cool' }, chips:{ speed:2, cutwide:1, coolant:3, sustain:2, power:1, plating:1 } },
  B:{ name:'Cloak & blade (precision surgical)', items:{ armR:'ps_blade_arm', handR:'ps_blade_hand_r', handL:'ps_blade_hand_l', torso:'ps_veil_torso', legL:'ps_legs_l', legR:'ps_legs_r', face:'ps_face' }, chips:{ speed:2, bladepat:1, cloakdur:2, coolant:2, sustain:2 } },
  C:{ name:'Neural control & refurbished tools (mixed)', items:{ brain:'ps_brain', handR:'mm_slug_hand', armL:'mm_arm_l', armR:'mm_arm_r', torso:'mm_torso_defib' }, chips:{ ctrldur:2, coolant:2, sustain:2, power:2 } },
};
const fmtStats=(s:Stats)=>`HP ${Math.round(s.maxHp)} · DMG ×${s.dmg.toFixed(2)} · ATK ×${s.atkSpeed.toFixed(2)} · COOL ×${s.cooling.toFixed(2)} · MOVE ×${s.move.toFixed(2)} · ARMOR ${s.armor} · REGEN ${s.regen.toFixed(1)}/s · PICKUP +${s.pickup.toFixed(1)}`;
const diff=(a:number,b:number,f=(n:number)=>n.toFixed(2))=>{ const d=b-a; if(Math.abs(d)<1e-6) return ''; return `<span class="${d>0?'up':'dn'}">${d>0?'+':''}${f(d)}</span>`; };
const rc=(r:string)=>RARITY_COLOR[r as keyof typeof RARITY_COLOR];

export class UI {
  modal:string|null=null; draft:Layout|null=null; sel:Slot='torso'; search=''; confirm:any=null; msg=''; liveOpen=false; bannerT=0; toastCount=0; storyBusy=false; devOpen=false; lastKey='';
  constructor(private g:Game, private audio:AudioSys){
    $('modal').addEventListener('click',e=>this.click(e)); $('modal').addEventListener('input',e=>this.input(e)); $('modal').addEventListener('change',e=>this.input(e));
    document.getElementById('btn-menu')!.addEventListener('pointerdown',e=>{ e.preventDefault(); this.open('settings'); });
    document.getElementById('downpanel')!.addEventListener('click',e=>{ const a=(e.target as HTMLElement).dataset.act; if(a==='cp') g.returnToCheckpoint(); if(a==='defib') g.defibInPlace(); });
    window.addEventListener('keydown',e=>{ if(e.key==='`'){ this.devOpen=!this.devOpen; this.open(this.devOpen?'dev':null); } });
  }
  modalOpen(){ return !!this.modal; }
  handle(type:string,p:any){
    const g=this.g;
    if(type==='toast') this.toast(p); else if(type==='dialog') this.showDialog(p); else if(type==='open') this.open(p==='annex'?'gate':p==='locker'?'locker':p==='vendor'?'vendor':p==='fixer'?'fixer':p==='store'?'store':null);
    else if(type==='reveal') this.banner(p.name, 'Damage-free emergence. Movement is available.'); else if(type==='reveal-end') this.hideBanner();
    else if(type==='boss-dead') this.banner('Mission complete','Boss defeated. Personal loot remains until the instance expires.',4);
    else if(type==='down'){ this.showDown(p); } else if(type==='revived'){ $('downpanel').style.display='none'; }
    else if(type==='dodgecancel'){ $('dialog').style.display='none'; }
    else if(type==='mode'){ this.liveOpen=false; $('livepanel').style.display='none'; $('downpanel').style.display='none'; $('dialog').style.display='none'; if(p==='town'){ this.open(null); } else this.open(null); }
    else if(type==='expired') this.toast('Instance expired.'); else if(type==='filtered') this.toast('Above your level: '+p+' did not drop (no downward reroll).');
    else if(type==='hurt'){ document.body.animate([{boxShadow:'inset 0 0 60px rgba(143,59,46,.5)'},{boxShadow:'inset 0 0 0 rgba(0,0,0,0)'}],{duration:260}); }
    void g;
  }
  toast(s:string){ const el=document.createElement('div'); el.className='toast'; el.textContent=s; const box=$('toasts'); box.appendChild(el); while(box.children.length>4) box.removeChild(box.firstChild!); setTimeout(()=>el.remove(),5600); }
  banner(t:string,sub:string,secs=7){ const b=$('banner'); b.innerHTML=esc(t)+'<small>'+esc(sub)+'</small>'; b.classList.add('show'); this.bannerT=secs; }
  hideBanner(){ $('banner').classList.remove('show'); }
  showDialog(d:{title:string;body:string;options:{label:string;cb?:()=>void}[]}){ const el=$('dialog'); el.style.display='block'; el.innerHTML=`<h4>${esc(d.title)}</h4><div>${esc(d.body)}</div>`; d.options.forEach(o=>{ const b=document.createElement('button'); b.textContent=o.label; b.onclick=()=>{ el.style.display='none'; o.cb?.(); }; el.appendChild(b); }); }
  showDown(p:{broke:string|null;defib:boolean}){ const el=$('downpanel'); el.style.display='block'; el.innerHTML=`<b>DOWN</b><div class="mut" style="margin:6px 0">${p.broke?'Hardware damaged: <b>'+esc(p.broke)+'</b> (benefits and ability offline until a checkpoint).':'No hardware could be damaged.'} Repair bill: ${this.g.save.repairBill}c</div><button data-act="cp">Return to checkpoint (restores hardware, keeps repair bill)</button>${p.defib?'<button data-act="defib">Self-defib here (hardware stays broken)</button>':''}`; }
  open(m:string|null){ if(m==='locker'||m==='vendor'||m==='gate'||m==='fixer'||m==='store'){ if(this.g.mode!=='town'){ return; } } if(m==='locker'&&!this.draft) this.resetDraft(); this.modal=m; this.confirm=null; this.render(); }
  close(){ this.modal=null; this.confirm=null; if(this.g.mode==='town'||true) this.draft=null; this.render(); }
  toggleLive(){ if(this.g.mode!=='run') return; this.liveOpen=!this.liveOpen; this.renderLive(); }
  esc(){ if(this.modal){ this.close(); } else if(this.liveOpen){ this.liveOpen=false; this.renderLive(); } else this.g.clearTarget(); }
  resetDraft(){ this.draft=cloneLayout(installedLayout(this.g.save)); }

  // ================= HUD =================
  hud(){
    const g=this.g, st=g.build.stats; $('hpfill').style.width=Math.max(0,g.hp/g.maxHp*100)+'%'; $('hptxt').textContent=Math.ceil(Math.max(0,g.hp))+' / '+Math.round(g.maxHp);
    $('heatfill').style.width=Math.min(100,g.heat)+'%'; document.querySelector('.bar.heat')!.classList.toggle('over',g.overheated); $('heattxt').textContent=g.overheated?'OVERHEATED':'HEAT';
    const s=g.save; $('lvl').textContent=`Lv ${s.level}  ·  ${s.credits}c  ·  repair ${s.repairBill}c`;
    const inst=g.inst; if(g.mode==='run'&&inst){ const rem=Math.max(0,inst.expiresAt-Date.now()); const h=Math.floor(rem/3600000), m=Math.floor(rem%3600000/60000); $('timer').textContent='Instance '+h+'h'+String(m).padStart(2,'0')+'m'+(rem<1800000?' ⚠':''); $('carry').textContent=`Pack ${g.carriedCount()}/${COMBAT.missionSlots} · +${inst.carried.credits}c`; $('stimn').textContent=String(inst.carried.stims); } else { $('timer').textContent=g.hasLiveInstance()?'Instance live':''; $('carry').textContent=''; $('stimn').textContent=String(s.stims); }
    const run=g.mode==='run'; $('btn-town').style.display=run?'':'none'; $('btn-inv').style.display=run?'':'none';
    document.querySelectorAll<HTMLElement>('.abtn').forEach(btn=>{ const i=+btn.dataset.idx!; const id=g.build.abilities[i]; const def=id?ABILITIES[id]:null; btn.classList.toggle('empty',!def); (btn.querySelector('.aname') as HTMLElement).textContent=def?def.name:'—'; const fill=btn.querySelector('.cdfill') as HTMLElement; const cd=def?Math.max(0,g.abCd[i]/def.cd):0; fill.style.height=(g.overheated&&def?100:cd*100)+'%'; btn.classList.toggle('off',!!def&&g.overheated); });
    const dd=$('dodge'); (dd.querySelector('.cdfill') as HTMLElement).style.height=Math.max(0,g.dodgeCd/COMBAT.dodge.cd*100)+'%'; dd.classList.toggle('cd',g.dodgeCd>0);
    const pr=g.prompt; const ib=$('interact'); ib.style.display=pr&&!this.modal&&!g.downed?'':'none'; if(pr) ib.innerHTML=esc(pr.label.length>26?pr.label.slice(0,24)+'…':pr.label)+' <small>Space</small>';
    const ch=$('channelbar'); if(g.channel){ ch.style.display='block'; (ch.firstElementChild as HTMLElement).style.width=g.channel.t/g.channel.dur*100+'%'; ch.querySelector('span')!.textContent=g.channel.kind==='town'?'Returning to town…':'Hacking…'; } else ch.style.display='none';
    // conditional support panel: only when relevant ability equipped
    const sup=g.build.abilities.includes('revive'); const sp=$('support'); sp.style.display=sup&&g.mode==='run'?'flex':'none'; if(sup&&!sp.innerHTML) sp.innerHTML='<span class="mut">Support</span><div class="portrait">P1</div><div class="portrait">P2</div><div class="portrait">P3</div><div class="portrait">P4</div><div class="portrait guest">G5</div><span class="mut">no teammates (solo)</span>'; if(!sup) sp.innerHTML='';
    if(this.bannerT>0){ this.bannerT-=1/60; if(this.bannerT<=0) this.hideBanner(); }
    if(g.mode==='town') $('hint').textContent='WASD move · Space interact · F dodge'; else $('hint').textContent='WASD move · hold Q/E/R aim, release to cast · F dodge · click enemy to target · Space interact · T town · I pack · H stim';
    if(this.liveOpen&&g.mode==='run'){ const k=g.inst!.carried.items.length+':'+JSON.stringify(g.inst!.carried.chips)+g.inst!.carried.stims; if(k!==this.lastKey){ this.lastKey=k; this.renderLive(); } }
  }
  renderLive(){ const el=$('livepanel'); if(!this.liveOpen||this.g.mode!=='run'){ el.style.display='none'; return; } const g=this.g, c=g.inst!.carried; el.style.display='block'; const L=installedLayout(g.save);
    let h=`<h4>Pack (live: combat continues) ${g.carriedCount()}/${COMBAT.missionSlots}</h4><div class="mut">Hardware and chips are locked mid-run. Compare, then return to town to install. Items stay on the ground until the instance expires.</div>`;
    for(const it of c.items){ const d=ITEM_BY_ID[it.def]; const cur=L[d.slot]?ITEM_BY_ID[L[d.slot]!.def]:null; const bl=computeBuild(this.layoutWith(L,d.slot,it),g.save.level,g.save.rep).stats, b0=g.build.stats;
      h+=`<div class="lp-item" style="border-color:${rc(d.rarity)}"><b style="color:${rc(d.rarity)}">${esc(d.name)}</b> <span class="tag">${SLOT_LABEL[d.slot]}</span><small>${MFR[d.mfr].short} · req Lv ${d.lvl}${d.lvl>g.save.level?' <span class="bad">(too high)</span>':''}${d.abilities?' · '+d.abilities.map(a=>ABILITIES[a].name).join(', '):''}</small><small>vs ${cur?esc(cur.name):'empty'}: HP ${diff(b0.maxHp,bl.maxHp,n=>n.toFixed(0))} DMG ${diff(b0.dmg,bl.dmg)} ATK ${diff(b0.atkSpeed,bl.atkSpeed)} COOL ${diff(b0.cooling,bl.cooling)}</small></div>`; }
    for(const [k,v] of Object.entries(c.chips)) if(v) h+=`<div class="lp-item"><b>${CHIPS[k as ChipId].name}</b> ×${v}<small>${CHIPS[k as ChipId].desc}</small></div>`;
    if(c.stims) h+=`<div class="lp-item"><b>Stim</b> ×${c.stims}</div>`; if(!c.items.length&&!Object.keys(c.chips).length&&!c.stims) h+='<div class="mut" style="margin-top:6px">Empty. Loot is picked up by proximity.</div>';
    el.innerHTML=h; }
  layoutWith(L:Layout,slot:Slot,inst:Inst):Layout{ const o=cloneLayout(L); o[slot]={...inst,chips:[]}; return o; }

  // ================= modals =================
  render(){ const m=$('modal'); if(!this.modal){ m.style.display='none'; m.innerHTML=''; return; } m.style.display='flex'; const g=this.g;
    const body=this.modal==='locker'?this.locker():this.modal==='vendor'?this.vendor():this.modal==='gate'?this.gate():this.modal==='fixer'?this.fixer():this.modal==='store'?this.store():this.modal==='settings'?this.settings():this.modal==='dev'?this.dev():'';
    const titles:Record<string,string>={locker:'Body workspace & locker',vendor:'Vendor & repair',gate:'Reclamation Annex gate',fixer:'Fixer: Odalys Vane',store:'Outfitter (simulated purchases)',settings:'Settings',dev:'DEV tools (prototype only)'};
    m.innerHTML=`<div class="win"><header><span>${titles[this.modal]||''}</span><span><button data-act="close">Close</button></span></header><div class="body">${body}</div></div>`; void g; }
  // ----- Locker -----
  locker():string{
    const g=this.g, s=g.save; if(!this.draft) this.resetDraft(); const D=this.draft!; const inst=installedLayout(s);
    const cur=computeBuild(inst,s.level,s.rep), prev=computeBuild(D,s.level,s.rep); const dirty=JSON.stringify(Object.entries(D).map(([k,v])=>[k,v?.chips]))!==JSON.stringify(Object.entries(inst).map(([k,v])=>[k,v?.chips]));
    const slotBtn=(sl:Slot)=>{ const it=D[sl]; const d=it?ITEM_BY_ID[it.def]:null; const changed=JSON.stringify(it?.chips)!==JSON.stringify(inst[sl]?.chips); return `<button class="slot ${this.sel===sl?'sel':''} ${changed?'staged':''}" data-act="sel" data-slot="${sl}" style="border-color:${d?rc(d.rarity):'#555'}"><b>${SLOT_LABEL[sl]}</b>${d?esc(d.name):'empty'}${d?`<span class="mf" style="background:${MFR[d.mfr].accent}"></span>`:''}<br><span class="mut">chips ${it?.chips.length||0}/${SLOT_SOCKETS[sl]}</span></button>`; };
    const sp='<div class="sp"></div>';
    const grid=`<div class="body-grid">${sp}${slotBtn('face')}${sp}${slotBtn('handL')}${slotBtn('brain')}${slotBtn('handR')}${slotBtn('armL')}${slotBtn('torso')}${slotBtn('armR')}${slotBtn('legL')}${sp}${slotBtn('legR')}${slotBtn('footL')}${sp}${slotBtn('footR')}</div>`;
    const sl=this.sel; const di=D[sl]; const dd=di?ITEM_BY_ID[di.def]:null;
    const owned=(c:ChipId)=>(s.lockerChips[c]||0)+Object.values(inst).reduce((a,i)=>a+(i?.chips.filter(x=>x===c).length||0),0); const used=(c:ChipId)=>Object.values(D).reduce((a,i)=>a+(i?.chips.filter(x=>x===c).length||0),0);
    let socks=''; if(di){ for(let i=0;i<SLOT_SOCKETS[sl];i++){ const ch=di.chips[i]; socks+=`<div class="sock ${ch?'full':''}" data-act="${ch?'unsock':'sock'}" data-i="${i}">${ch?esc(CHIPS[ch].name)+'<br><span class="mut">tap to remove</span>':'<span class="mut">empty socket<br>tap to add</span>'}</div>`; } }
    const chipPick=(this as any).chipPick===true; let chipList=''; if(chipPick){ chipList='<h3>Choose chip</h3><div class="list">'+(Object.keys(CHIPS) as ChipId[]).map(c=>{ const av=owned(c)-used(c); return `<div class="row" data-act="addchip" data-chip="${c}" style="${av<=0?'opacity:.4':''}"><span><b>${CHIPS[c].name}</b> <span class="mut">${CHIPS[c].desc}</span></span><span>×${av}</span></div>`; }).join('')+'</div>'; }
    const q=this.search.toLowerCase(); const storage=lockerItems(s).filter(i=>!q||ITEM_BY_ID[i.def].name.toLowerCase().includes(q)||SLOT_LABEL[ITEM_BY_ID[i.def].slot].toLowerCase().includes(q)).sort((a,b)=>RARITIES.indexOf(ITEM_BY_ID[b.def].rarity)-RARITIES.indexOf(ITEM_BY_ID[a.def].rarity));
    const cap=s.lockerCap+s.purchases.lockerBlocks*STARTING.lockerPerPurchase;
    const rows=storage.map(i=>{ const d=ITEM_BY_ID[i.def]; const fits=d.slot===sl; return `<div class="row" style="border-color:${rc(d.rarity)};${fits?'':'opacity:.78'}"><span><b style="color:${rc(d.rarity)}">${esc(d.name)}</b><span class="tag">${SLOT_LABEL[d.slot]}</span><span class="tag">${MFR[d.mfr].short}</span><span class="tag">Lv ${d.lvl}</span>${d.abilities?`<span class="tag">${d.abilities.map(a=>ABILITIES[a].name).join('+')}</span>`:''}</span>${fits?`<button class="btn" data-act="replace" data-uid="${i.uid}">Replace…</button>`:`<button class="btn" data-act="gosel" data-slot="${d.slot}">Go to slot</button>`}</div>`; }).join('')||'<div class="row mut">Storage empty</div>';
    const chipStock=(Object.keys(CHIPS) as ChipId[]).filter(c=>(s.lockerChips[c]||0)>0).map(c=>`${CHIPS[c].name} ×${s.lockerChips[c]}`).join(' · ')||'none';
    const abNow=cur.abilities.map(a=>ABILITIES[a].name), abPrev=prev.abilities.map(a=>ABILITIES[a].name);
    const carried=g.inst?.carried; const hasCarry=!!carried&&(carried.items.length||Object.keys(carried.chips).length||carried.stims||carried.credits);
    const conf=this.confirm?this.confirmHtml():'';
    return `<div class="col narrow"><h3>Body (11 slots)</h3>${grid}<div class="mut" style="margin-top:6px">Reputation: ${(['HI','PS','MM'] as const).map(m=>MFR[m].short.split(' ')[0]+' rank '+repRank(s.rep[m])).join(' · ')}</div></div>
    <div class="col">
      ${hasCarry?`<div class="draftbar">Mission pack: ${carried!.items.length} items, ${Object.values(carried!.chips).reduce((a,b)=>a+(b||0),0)} chips, ${carried!.stims} stims, ${carried!.credits}c <button class="btn primary" data-act="unload">Unload into locker</button></div>`:''}
      ${conf}
      <h3>${SLOT_LABEL[sl]}: ${dd?esc(dd.name):'empty'} ${dd?`<span class="tag" style="border-color:${rc(dd.rarity)}">${dd.rarity}</span>`:''}</h3>
      ${dd?`<div class="mut">${MFR[dd.mfr].name} · req Lv ${dd.lvl}${dd.abilities?' · abilities: '+dd.abilities.map(a=>ABILITIES[a].name).join(', '):''}${dd.weapon?' · weapon: '+dd.weapon:''}${dd.caps?' · capability: '+dd.caps.join(', '):''}</div><div class="mut">${esc(dd.blurb||'')}</div>`:''}
      <div>${socks}</div>${chipList}
      <h3>Storage ${capacityUsed(s)}/${cap}</h3><input type="search" placeholder="Search storage (name, slot)…" value="${esc(this.search)}" data-in="search" /><div class="mut">Chips in stock: ${chipStock}</div>
      <div class="list">${rows}</div>
      <div style="margin-top:6px"><button class="btn" data-act="sellgrey">Dispose of all grey in storage (sell)</button> <span class="mut">free organization tool, explicit</span></div></div>
    <div class="col"><div class="draftbar"><b>${dirty?'DRAFT (unapplied)':'No staged changes'}</b> ${dirty?'<span class="warn">Leaving the workspace or entering a mission discards it.</span>':''}<div><button class="btn primary" data-act="apply" ${dirty?'':'disabled'}>Apply chip configuration</button><button class="btn" data-act="discard" ${dirty?'':'disabled'}>Discard</button></div></div>
      <h3>Preview</h3><div>${fmtStats(prev.stats)}</div><div class="mut" style="margin-top:4px">Installed: ${fmtStats(cur.stats)}</div>
      <div style="margin-top:6px">Abilities: <b>${abPrev.join(', ')||'none'}</b>${abPrev.join()!==abNow.join()?` <span class="mut">(installed: ${abNow.join(', ')||'none'})</span>`:''}</div>
      ${prev.extraAbilities.length?`<div class="warn">Only 3 abilities are bound (by slot priority). Unbound: ${prev.extraAbilities.map(a=>ABILITIES[a].name).join(', ')}</div>`:''}<div>Capabilities: ${[...prev.caps].join(', ')||'none'} · Basic attack: <b>${prev.weapon.kind}</b>${prev.weapon.stationary?' (stationary)':''}</div>
      <div>Heat: cooling ×${prev.stats.cooling.toFixed(2)} (${(9*prev.stats.cooling).toFixed(1)}/s passive); ability heat ${prev.abilities.map(a=>ABILITIES[a].heat).join(' / ')||'-'}</div>
      <div class="${prev.mix.coolingPenalty>0?'warn':'mut'}">Manufacturers: ${prev.mix.mfrs.map(m=>MFR[m].short).join(' + ')||'baseline'}${prev.mix.coolingPenalty>0?' · mixing penalty −'+(prev.mix.coolingPenalty*100).toFixed(0)+'% cooling (reduced by reputation rank)':''}</div>
      ${prev.conflicts.map(c=>`<div class="bad">Hard conflict: ${esc(c)}</div>`).join('')}
      <div class="mut" style="margin-top:8px">Chip swapping is free. Hardware replacement is a separate, explicit, paid action. No presets, no readiness checks: you can enter the Annex with whatever is installed.</div></div>`;
  }
  confirmHtml():string{ const c=this.confirm; if(c.type!=='replace') return ''; return `<div class="draftbar" style="border-color:var(--oxide)"><b>Confirm hardware replacement</b><div>${esc(c.text)}</div><div class="${c.cost>this.g.save.credits?'bad':''}">Cost: <b>${c.cost}c</b> (you have ${this.g.save.credits}c)${c.disc?` · reputation discount ${(c.disc*100).toFixed(0)}%`:''}</div><div class="mut">${c.lines.join('<br>')}</div>${c.block?`<div class="bad">${esc(c.block)}</div>`:''}<button class="btn primary" data-act="confirm-replace" ${c.block||c.cost>this.g.save.credits?'disabled':''}>Install (${c.cost}c)</button><button class="btn" data-act="cancel-confirm">Cancel</button></div>`; }
  prepareReplace(uid:string){ const g=this.g, s=g.save; const inst=s.items.find(i=>i.uid===uid)!; const nd=ITEM_BY_ID[inst.def]; const sl=nd.slot; const old=installedLayout(s)[sl]; const od=old?ITEM_BY_ID[old.def]:null; const base=od?INSTALL_COST[od.rarity]:0; const disc=Math.min(.15,repRank(s.rep[nd.mfr])*REP_DISCOUNT_PER_RANK); const cost=Math.round(base*(1-disc));
    const L=installedLayout(s); const L2=cloneLayout(L); L2[sl]={...inst,chips:[]}; const b0=computeBuild(L,s.level,s.rep), b1=computeBuild(L2,s.level,s.rep); const lost=b0.abilities.filter(a=>!b1.abilities.includes(a)).map(a=>ABILITIES[a].name), gained=b1.abilities.filter(a=>!b0.abilities.includes(a)).map(a=>ABILITIES[a].name);
    const lines=[`Abilities lost: ${lost.join(', ')||'none'}`,`Abilities gained: ${gained.join(', ')||'none'}`,`Compatibility: ${b1.mix.mfrs.map(m=>MFR[m].short).join(' + ')||'baseline'}${b1.mix.coolingPenalty>b0.mix.coolingPenalty?` (mixing penalty −${(b1.mix.coolingPenalty*100).toFixed(0)}% cooling)`:''}`, old&&old.chips.length?`Chips on the old hardware (${old.chips.length}) return to locker stock (they are not transferred; re-socket afterwards).`:'No chips affected.'];
    let block=''; if(nd.lvl>s.level) block=`Requires level ${nd.lvl} (you are ${s.level}).`; const hc=wouldConflict(L,sl,nd.id); if(hc) block=hc;
    this.confirm={type:'replace',uid,cost,disc,lines,block,text:`${od?od.name:'empty slot'} → ${nd.name} (${nd.rarity})`}; }
  doReplace(){ const g=this.g,s=g.save; const c=this.confirm; const inst=s.items.find(i=>i.uid===c.uid)!; const nd=ITEM_BY_ID[inst.def]; if(c.block||s.credits<c.cost) return; const old=installedLayout(s)[nd.slot]; s.credits-=c.cost; if(old){ for(const ch of old.chips) s.lockerChips[ch]=(s.lockerChips[ch]||0)+1; old.chips=[]; } s.installed[nd.slot]=inst.uid; persist(s); g.recompute(); this.confirm=null; this.resetDraft(); this.msg='Installed '+nd.name; g.toast('Installed '+nd.name+' ('+c.cost+'c)'); }
  applyDraft(){ const g=this.g,s=g.save; const D=this.draft!; const inst=installedLayout(s); const owned:Record<string,number>={}; for(const c of Object.keys(CHIPS)) owned[c]=(s.lockerChips[c as ChipId]||0)+Object.values(inst).reduce((a,i)=>a+(i?.chips.filter(x=>x===c).length||0),0);
    const used:Record<string,number>={}; for(const sl of SLOTS){ const it=D[sl]; if(!it) continue; if(it.chips.length>SLOT_SOCKETS[sl]){ g.toast('Over socket capacity on '+SLOT_LABEL[sl]); return; } for(const c of it.chips) used[c]=(used[c]||0)+1; }
    for(const c in used) if(used[c]>owned[c]){ g.toast('Not enough '+CHIPS[c as ChipId].name+' chips'); return; }
    for(const sl of SLOTS){ const it=D[sl]; const real=inst[sl]; if(it&&real) real.chips=[...it.chips]; } for(const c in owned) s.lockerChips[c as ChipId]=owned[c]-(used[c]||0); persist(s); g.recompute(); this.resetDraft(); g.toast('Chip configuration applied.'); }
  // ----- Vendor -----
  vendor():string{ const s=this.g.save; const items=lockerItems(s).filter(i=>!ITEM_BY_ID[i.def].id.startsWith('stock_')||true);
    return `<div class="col"><h3>Repairs</h3><div>Repair bill: <b>${s.repairBill}c</b> · Credits: <b>${s.credits}c</b></div><button class="btn primary" data-act="repair" ${s.repairBill>0&&s.credits>0?'':'disabled'}>Pay repair bill${s.repairBill>s.credits?' (partial)':''}</button>
      <div class="mut">Downs add random hardware damage and a repair bill; checkpoints restore function but the bill stays until paid here.</div><h3>Consumables</h3><button class="btn" data-act="buystim" ${s.credits>=30?'':'disabled'}>Buy stim (30c)</button> Locker stims: ${s.stims}</div>
      <div class="col"><h3>Sell hardware from storage</h3><div class="list">${items.map(i=>{ const d=ITEM_BY_ID[i.def]; return `<div class="row" style="border-color:${rc(d.rarity)}"><span>${esc(d.name)} <span class="tag">${d.rarity}</span></span><button class="btn" data-act="sell" data-uid="${i.uid}">Sell ${SELL_VALUE[d.rarity]}c</button></div>`; }).join('')||'<div class="row mut">Nothing to sell</div>'}</div><div class="mut">Convenience sales are storage-only (no remote vendor mid-run).</div></div>`; }
  // ----- Gate -----
  gate():string{ const g=this.g, inst=g.save.instance; const live=!!inst&&inst.expiresAt>Date.now(); const rem=live?Math.max(0,inst!.expiresAt-Date.now()):0; const locked=g.dailyLocked();
    let h='<div class="col"><h3>Reclamation Annex</h3><div>Steal the sealed integration controller and defeat the boss. Yard → processing floor → control junction → boss chamber. Hardware is locked once you enter.</div>';
    if(live){ const f=inst!.flags; h+=`<div class="draftbar" style="margin-top:8px"><b>Existing instance</b> · expires in ${Math.floor(rem/3600000)}h ${Math.floor(rem%3600000/60000)}m<br>Boss: ${f.bossDead?'defeated':f.bossSpawned?'alive':'not yet met'} · Controller: ${f.controller?'secured':'not secured'} · Uncollected loot on ground: ${inst!.drops.length} · Selected boss: ${f.bossKey?ENEMIES[f.bossKey].name:'none yet'}<br>You re-enter at the entry and must run back through surviving enemies.</div><button class="btn primary" data-act="enter">${f.completed?'Re-enter to retrieve loot':'Re-enter instance'}</button><button class="btn" data-act="abandon">Abandon instance</button>`; }
    else h+=`<div style="margin-top:8px">${locked?'<span class="warn">Daily clear already used. A fresh run unlocks at tomorrow\'s reset (local midnight; timer anchor is an open spec decision). Existing instances can still be re-entered until they expire.</span>':'Daily clear available.'}</div><button class="btn primary" data-act="enter" ${locked?'disabled':''}>Start fresh run</button>`;
    h+=`<div class="mut" style="margin-top:8px">Party, QR/code fifth guest and co-op networking are not implemented in this prototype (see README).</div></div>`; return h; }
  // ----- Fixer / story -----
  fixer():string{ const g=this.g; const st=g.story(); const clue=st.clues; const t=st.town;
    return `<div class="col"><h3>Odalys Vane</h3><div>${t?esc(t.text):'"Run the Annex and I will know. Come back with news."'}</div>${t?t.options.map(o=>`<button class="btn primary" data-act="townchoice" data-id="${o.id}" data-boost="${o.boosts}">${esc(o.label)}</button>`).join(''):''}
      <h3>Known clues</h3><div class="mut">Terminal/armory clue (hack): ${esc(clue.A||'—')}<br><br>Force clue: ${esc(clue.B||'—')}<br><br>General: ${esc(clue.general||'—')}</div>
      <h3>Story development</h3><button class="btn" data-act="story" ${this.storyBusy?'disabled':''}>${this.storyBusy?'Requesting…':'Ask for a story update'}</button> <div class="mut">Provider: ${makeProvider(g.save.settings.llm).name}. Runs outside combat; invalid or failed output keeps the previous story. Bosses, drops and access never depend on it.</div><div id="storymsg">${esc(this.msg)}</div></div>
      <div class="col"><h3>Relationship graph</h3>${st.edges.map(e=>`<div class="mut">${e.from} → ${e.to} [${e.roles.join(', ')}] weight ${e.w}</div>`).join('')}<h3>Recorded events (since last proposal)</h3>${st.events.filter(e=>e.id>st.lastProposalEvent).slice(-8).map(e=>`<div class="mut">#${e.id} ${e.kind}:${e.key} ×${e.n}</div>`).join('')||'<div class="mut">none</div>'}<h3>Generation log</h3>${st.log.slice(-6).reverse().map(l=>`<div class="${l.ok?'good':'bad'}">${l.provider} ${l.ok?'ok':'fail'} ${l.ms}ms — ${esc(l.note)}</div>`).join('')||'<div class="mut">none</div>'}</div>`; }
  // ----- Store -----
  store():string{ const s=this.g.save; const skins=[['salvage_grey','Salvage Grey finish'],['ivory_ward','Ivory Ward finish'],['oxide_work','Oxide Workwear']]; return `<div class="col"><h3>Simulated entitlements</h3><div class="mut">No real checkout. Only skins and permanent account-wide locker capacity are sold. Purchases persist across seasons.</div>
    <div style="margin-top:8px"><b>Locker capacity</b>: ${s.lockerCap+s.purchases.lockerBlocks*STARTING.lockerPerPurchase} slots (bought blocks: ${s.purchases.lockerBlocks})<br><button class="btn primary" data-act="buylocker">Buy +${STARTING.lockerPerPurchase} slots (simulated)</button></div>
    <h3>Skins</h3>${skins.map(([id,n])=>`<div class="row"><span>${n} ${s.purchases.skins.includes(id)?'<span class="tag good">owned</span>':''}</span>${s.purchases.skins.includes(id)?`<button class="btn" data-act="skin" data-id="${id}">${s.purchases.equippedSkin===id?'Unequip':'Equip'}</button>`:`<button class="btn" data-act="buyskin" data-id="${id}">Buy (simulated)</button>`}</div>`).join('')}<div class="mut">Skins are entitlement records only in this prototype (no skin art yet).</div></div>`; }
  // ----- Settings -----
  settings():string{ const t=this.g.save.settings; return `<div class="col"><h3>Display & feel</h3>
    <label>Gore <select data-in="gore"><option value="off" ${t.gore==='off'?'selected':''}>Off</option><option value="standard" ${t.gore==='standard'?'selected':''}>Standard</option><option value="bloody" ${t.gore==='bloody'?'selected':''}>Bloody Mess</option></select></label>
    <label><input type="checkbox" data-in="dmgnum" ${t.damageNumbers?'checked':''}/> Damage numbers (default off)</label><br><label><input type="checkbox" data-in="reduced" ${t.reducedFx?'checked':''}/> Reduced incidental effects</label><br><label><input type="checkbox" data-in="joyfixed" ${t.joystickFixed?'checked':''}/> Fixed joystick (default floating)</label><br>
    <label><input type="checkbox" data-in="music" ${t.music?'checked':''}/> Music</label><label>Volume <input type="range" min="0" max="1" step=".05" value="${t.volume}" data-in="vol"/></label>
    <h3>Save</h3><button class="btn" data-act="wipe">Wipe save & reload</button> <button class="btn" data-act="dev">DEV tools</button></div>
    <div class="col"><h3>Story LLM provider (optional)</h3><div class="mut">Default is the offline mock. To try a real model, enable an OpenAI-compatible chat-completions endpoint. Stored only in this browser's localStorage; never sent anywhere else.</div>
    <label><input type="checkbox" data-in="llmon" ${t.llm.enabled?'checked':''}/> Use real provider</label><input type="text" placeholder="https://…/v1/chat/completions" value="${esc(t.llm.url)}" data-in="llmurl"/><input type="password" placeholder="API key" value="${esc(t.llm.key)}" data-in="llmkey"/><input type="text" placeholder="model id" value="${esc(t.llm.model)}" data-in="llmmodel"/>
    <h3>Controls</h3><div class="mut">Desktop: WASD move · hold Q/E/R (or 1/2/3) to aim toward cursor, release to cast (release on invalid aim cancels, no heat/cooldown) · F dodge (also cancels aiming/casting, even on cooldown) · click enemy to target (X / right-click clears) · Space interact · T town return channel · I live pack · H stim.<br>Touch (landscape): floating joystick on left; hold &amp; drag ability buttons to aim, release to cast, drag far away to cancel; tap an enemy to target.</div></div>`; }
  dev():string{ return `<div class="col"><h3>Prototype helpers</h3><div class="mut">Grants items into the locker for testing the three example builds. These are test shortcuts, not saved loadout presets.</div>
    ${Object.entries(BUILD_KITS).map(([k,b])=>`<div class="row"><span>Build ${k}: ${b.name}</span><span><button class="btn" data-act="kit" data-k="${k}">Grant kit</button><button class="btn" data-act="equipkit" data-k="${k}">Grant + equip (free)</button></span></div>`).join('')}
    <h3>State</h3><button class="btn" data-act="lvl" data-d="-6">Level −6</button><button class="btn" data-act="lvl" data-d="6">Level +6</button><button class="btn" data-act="credits">+1000c</button><button class="btn" data-act="resetlock">Reset daily lockout</button><button class="btn" data-act="expire">Expire instance now</button><button class="btn" data-act="rep">+30 rep all</button></div>
    <div class="col"><h3>Current</h3><div>Level ${this.g.save.level} · ${this.g.save.credits}c · repair ${this.g.save.repairBill}c · lockout day: ${this.g.save.lastClearDay||'none'} (today ${todayStr()})</div><div class="mut">Press ${'`'} to toggle this panel.</div></div>`; }

  // ================= events =================
  input(e:Event){ const t=e.target as HTMLInputElement; const k=t.dataset.in; if(!k) return; const s=this.g.save, st=s.settings;
    if(k==='search'){ this.search=t.value; this.render(); const el=document.querySelector<HTMLInputElement>('[data-in=search]'); el?.focus(); el?.setSelectionRange(t.value.length,t.value.length); return; }
    if(k==='gore') st.gore=t.value as any; else if(k==='dmgnum') st.damageNumbers=t.checked; else if(k==='reduced') st.reducedFx=t.checked; else if(k==='joyfixed'){ st.joystickFixed=t.checked; }
    else if(k==='music'){ st.music=t.checked; this.audio.setMusicOn(t.checked); } else if(k==='vol'){ st.volume=+t.value; this.audio.setVolume(st.volume); }
    else if(k==='llmon') st.llm.enabled=t.checked; else if(k==='llmurl') st.llm.url=t.value; else if(k==='llmkey') st.llm.key=t.value; else if(k==='llmmodel') st.llm.model=t.value; persist(s); }
  click(e:MouseEvent){ const el=(e.target as HTMLElement).closest('[data-act]') as HTMLElement|null; if(!el) return; const a=el.dataset.act!; const g=this.g, s=g.save; this.audio.resume();
    switch(a){
      case 'close': this.close(); return;
      case 'sel': this.sel=el.dataset.slot as Slot; (this as any).chipPick=false; this.render(); return;
      case 'gosel': this.sel=el.dataset.slot as Slot; this.render(); return;
      case 'sock': (this as any).chipPick=true; (this as any).sockI=+el.dataset.i!; this.render(); return;
      case 'unsock': { const it=this.draft![this.sel]; if(it) it.chips.splice(+el.dataset.i!,1); this.render(); return; }
      case 'addchip': { const it=this.draft![this.sel]; const c=el.dataset.chip as ChipId; if(!it) return; const inst=installedLayout(s); const owned=(s.lockerChips[c]||0)+Object.values(inst).reduce((x,i)=>x+(i?.chips.filter(y=>y===c).length||0),0); const used=Object.values(this.draft!).reduce((x,i)=>x+(i?.chips.filter(y=>y===c).length||0),0); if(owned-used<=0||it.chips.length>=SLOT_SOCKETS[this.sel]) return; it.chips.push(c); (this as any).chipPick=false; this.render(); return; }
      case 'apply': this.applyDraft(); this.render(); return; case 'discard': this.resetDraft(); this.render(); return;
      case 'replace': this.prepareReplace(el.dataset.uid!); this.render(); return; case 'cancel-confirm': this.confirm=null; this.render(); return; case 'confirm-replace': this.doReplace(); this.render(); return;
      case 'unload': this.unload(); this.render(); return;
      case 'sellgrey': { let n=0,v=0; for(const i of lockerItems(s)){ const d=ITEM_BY_ID[i.def]; if(d.rarity==='grey'&&!d.id.startsWith('stock_')){ s.items=s.items.filter(x=>x.uid!==i.uid); v+=SELL_VALUE.grey; n++; } } s.credits+=v; persist(s); g.toast(`Sold ${n} grey items for ${v}c`); this.render(); return; }
      case 'repair': { const pay=Math.min(s.credits,s.repairBill); s.credits-=pay; s.repairBill-=pay; persist(s); this.render(); return; }
      case 'buystim': if(s.credits>=30){ s.credits-=30; s.stims++; persist(s); } this.render(); return;
      case 'sell': { const i=s.items.find(x=>x.uid===el.dataset.uid); if(i&&!Object.values(s.installed).includes(i.uid)){ s.credits+=SELL_VALUE[ITEM_BY_ID[i.def].rarity]; for(const c of i.chips) s.lockerChips[c]=(s.lockerChips[c]||0)+1; s.items=s.items.filter(x=>x!==i); persist(s); } this.render(); return; }
      case 'enter': { if(g.startRun()){ this.close(); } else this.render(); return; }
      case 'abandon': g.abandonInstance(); this.render(); return;
      case 'townchoice': { const st=g.story(); record(st,'town_choice',el.dataset.boost!); st.arc=el.dataset.boost!; const ed=st.edges.find(x=>x.from==='player'&&x.to==='odalys_vane'); if(ed) ed.w+=1; st.town=null; persist(s); this.msg='Odalys will push the "'+el.dataset.boost+'" lead.'; this.render(); return; }
      case 'story': this.runStory(); return;
      case 'buylocker': s.purchases.lockerBlocks++; persist(s); this.render(); return; case 'buyskin': s.purchases.skins.push(el.dataset.id!); persist(s); this.render(); return; case 'skin': s.purchases.equippedSkin=s.purchases.equippedSkin===el.dataset.id?null:el.dataset.id!; persist(s); this.render(); return;
      case 'wipe': wipe(); location.reload(); return; case 'dev': this.open('dev'); return;
      case 'kit': case 'equipkit': this.kit(el.dataset.k!,a==='equipkit'); this.render(); return;
      case 'lvl': s.level=Math.max(1,Math.min(PROGRESSION.maxLevel,s.level+ +el.dataset.d!)); g.recompute(); persist(s); this.render(); return;
      case 'credits': s.credits+=1000; persist(s); this.render(); return; case 'resetlock': s.lastClearDay=null; persist(s); this.render(); return;
      case 'expire': if(s.instance){ s.instance.expiresAt=Date.now()-1; } g.inst=s.instance; if(g.mode==='town'){ s.instance=null; g.inst=null; } persist(s); this.render(); return; case 'rep': s.rep.HI+=30; s.rep.PS+=30; s.rep.MM+=30; persist(s); this.render(); return;
    } }
  unload(){ const g=this.g,s=g.save,c=g.inst?.carried; if(!c) return; const cap=s.lockerCap+s.purchases.lockerBlocks*STARTING.lockerPerPurchase; s.credits+=c.credits; c.credits=0; const rest:Inst[]=[]; for(const it of c.items){ if(capacityUsed(s)<cap) s.items.push(it); else rest.push(it); } c.items=rest;
    for(const [k,v] of Object.entries(c.chips)){ const kk=k as ChipId; if((s.lockerChips[kk]||0)>0||capacityUsed(s)<cap){ s.lockerChips[kk]=(s.lockerChips[kk]||0)+(v||0); delete c.chips[kk]; } } s.stims+=c.stims; c.stims=0; persist(s); if(rest.length||Object.keys(c.chips).length) g.toast('Locker full: some items stayed in your pack. Sell or buy capacity.'); else g.toast('Unloaded into locker.'); }
  kit(k:string,equip:boolean){ const g=this.g,s=g.save; const kit=BUILD_KITS[k]; if(equip){ for(const sl of SLOTS){ const st=s.items.find(i=>i.def==='stock_'+sl); if(st) s.installed[sl]=st.uid; } } for(const [sl,id] of Object.entries(kit.items)){ const it=mkInst(s,id!); s.items.push(it); if(equip) s.installed[sl as Slot]=it.uid; } for(const [c,n] of Object.entries(kit.chips)) s.lockerChips[c as ChipId]=(s.lockerChips[c as ChipId]||0)+(n||0);
    if(equip){ // auto-socket a sensible chip set so the build has its stated plan
      const L=installedLayout(s); const put=(sl:Slot,chips:ChipId[])=>{ const it=L[sl]; if(!it) return; for(const c of chips){ if((s.lockerChips[c]||0)>0&&it.chips.length<SLOT_SOCKETS[sl]){ it.chips.push(c); s.lockerChips[c]!--; } } };
      if(k==='A'){ put('handR',['speed','cutwide']); put('torso',['coolant','coolant','coolant','sustain','sustain','plating','power']); } if(k==='B'){ put('handR',['speed','bladepat']); put('torso',['cloakdur','cloakdur','coolant','coolant','sustain','sustain']); } if(k==='C'){ put('brain',['ctrldur','ctrldur','coolant','coolant']); put('torso',['sustain','sustain','power','power']); } }
    persist(s); g.recompute(); this.resetDraft(); g.toast('Granted build '+k+(equip?' and equipped (dev)':'')); }
  async runStory(){ const g=this.g; this.storyBusy=true; this.msg='Requesting a bounded proposal…'; this.render(); const st=g.story(); this.msg=await runStoryStep(st,makeProvider(g.save.settings.llm)); this.storyBusy=false; persist(g.save); this.render(); }
}
