// First-run tutorial: a step-based state machine that OBSERVES game state (it never drives the game), so players can skip ahead,
// do things out of order, die, open other panels or resize without breaking it. See docs/TUTORIAL.md.
//  - Progress is a set of latched facts (state.done). A step is complete once its fact is latched. The current step is the first
//    incomplete step that fits where the player is (town / run); if only steps for the other place remain, a redirect is shown.
//  - Every step has "Skip step"; the card always has "Skip tutorial" and "Step X of N". Persisted in save.tutorial.
import type { Game } from './sim';
import type { UI } from './ui';
import type { Renderer } from './render';
import { persist } from './state';
import { ITEMS, ITEM_BY_ID, SLOT_LABEL, CHIPS, ChipId, chipFits, RARITY_RANK, SLOTS, Slot } from './config';
import { contractState } from './state';

export interface TutState { status:'active'|'done'|'skipped'; done:string[]; skipped:string[]; slot:Slot; item:string; chip:ChipId; rankBase:number; chipBase:number; kills:number; rewarded:boolean; v:number; }
export type StepId='move'|'fixer'|'equip'|'socket'|'vendor'|'gate'|'controls'|'fight'|'return'|'recs';
interface StepDef { id:StepId; ctx:'any'|'town'|'run'; title:string; }
export const STEPS:StepDef[]=[
  {id:'move',ctx:'any',title:'Walk the market'},{id:'fixer',ctx:'town',title:'Get a contract'},{id:'equip',ctx:'town',title:'Install an upgrade'},
  {id:'socket',ctx:'town',title:'Socket a chip'},{id:'vendor',ctx:'town',title:'Vendor and repair'},{id:'gate',ctx:'town',title:'Enter the Annex'},
  {id:'controls',ctx:'run',title:'Your combat kit'},{id:'fight',ctx:'run',title:'Clear the pack'},{id:'return',ctx:'run',title:'Back to town'},{id:'recs',ctx:'town',title:'Spend it'} ];
export const REWARD={ credits:150, stims:1 };
const KILLS_NEEDED=3;
const CANDIDATES=['hi_clamp'];

interface Target { sel?:string; world?:{x:number;y:number;r?:number;col?:string}; dim?:boolean; }
interface View { title:string; body:string; list?:{t:string;ok:boolean}[]; target?:Target; ack?:string; redirect?:boolean; }

const $=(id:string)=>document.getElementById(id) as HTMLElement;
const isVis=(e:Element|null):e is HTMLElement=>{ if(!e) return false; const r=(e as HTMLElement).getBoundingClientRect(); if(r.width<=0||r.height<=0) return false; let n:HTMLElement|null=e as HTMLElement; while(n&&n!==document.body){ const s=getComputedStyle(n); if(s.display==='none'||s.visibility==='hidden'||+s.opacity<.05) return false; n=n.parentElement; } return true; };

export class Tutorial {
  st:TutState; view:View|null=null; idx=0; shown=false; private dist=0; private lx=0; private ly=0; private lk=0; private lastMode=''; private lastDodge=0; private flags:Record<string,boolean>={};
  private el!:HTMLElement; private spot!:HTMLElement; private world!:HTMLElement; private edge!:HTMLElement; private lastSel=''; private lastSelModal:string|null=null; private scrollT=0; private skipArm=0; private key=''; private placeKey=''; private openedAt=0; private lastModal:string|null=null; private lastStims=-1;
  disabled=false;
  constructor(private g:Game, private ui:UI, private rend:Renderer){
    const q=new URLSearchParams(location.search); let off=false; try{ off=localStorage.getItem('wv_notut')==='1'; }catch{} if(q.get('tutorial')==='off') off=true; if(q.get('tutorial')==='on') off=false; this.disabled=off;
    const s=g.save; if(!s.tutorial){ const vet=s.stats.runs>0||s.stats.kills>0||Object.keys(s.cleared||{}).length>0||s.level>12||!!s.cheated; s.tutorial=this.fresh(); if(vet||off) s.tutorial.status='done'; if(!off||vet) persist(s); }
    this.st=s.tutorial as TutState; if(this.st.status==='active') this.ensureKit();
    this.build(); this.lx=g.px; this.ly=g.py; this.lk=g.kills; this.lastMode=g.mode;
    window.addEventListener('keydown',e=>{ if(g.mode==='run'&&this.st.status==='active'){ const k=e.key.toLowerCase(); if(k==='f') this.flags.interact=true; } });
    window.addEventListener('resize',()=>{ this.placeKey=''; });
  }
  private fresh():TutState{ return { status:'active', done:[], skipped:[], slot:'handL', item:'', chip:'power' as ChipId, rankBase:0, chipBase:0, kills:0, rewarded:false, v:1 }; }
  /** Settings > Gameplay > Replay tutorial. */
  replay(){ const s=this.g.save; const rewarded=this.st.rewarded; this.st=s.tutorial=this.fresh() as any; this.st.rewarded=rewarded; this.flags={}; this.dist=0; this.key=''; this.placeKey='';
    s.lastClearDay=null; if(s.lockouts) delete s.lockouts['annex']; this.ensureKit(); persist(s); this.ui.toast('Tutorial restarted.'); }
  private rankSum(){ const s=this.g.save; let n=0; for(const sl of SLOTS){ const u=s.installed[sl]; const it=u&&s.items.find(i=>i.uid===u); if(it) n+=RARITY_RANK[ITEM_BY_ID[it.def].rarity]; } return n; }
  private chipSum(){ const s=this.g.save; let n=0; for(const sl of SLOTS){ const u=s.installed[sl]; const it=u&&s.items.find(i=>i.uid===u); if(it) n+=it.chips.length; } return n; }
  /** Guarantee a completable upgrade (an unequipped item that beats what is installed) and a chip that fits it. */
  ensureKit(){ const s=this.g.save, st=this.st; st.rankBase=this.rankSum(); st.chipBase=this.chipSum();
    const better=(d:{slot:Slot;rarity:string})=>{ const cur=s.items.find(i=>i.uid===s.installed[d.slot]); return !cur||RARITY_RANK[ITEM_BY_ID[cur.def].rarity]<RARITY_RANK[d.rarity as 'grey']; };
    const stash=(id:string)=>s.items.find(i=>i.def===id&&!Object.values(s.installed).includes(i.uid));
    let pick=CANDIDATES.map(id=>ITEM_BY_ID[id]).find(d=>d&&better(d)&&s.level>=d.lvl);
    if(!pick){ pick=ITEMS.find(d=>d.rarity==='green'&&!d.id.startsWith('stock_')&&!d.abilities?.length&&!d.weapon&&!d.caps?.length&&d.lvl<=s.level&&better(d)&&!!ITEM_BY_ID[d.id]); }
    if(pick){ st.slot=pick.slot; st.item=pick.id; if(!stash(pick.id)){ s.items.push({uid:'u'+(s.uidN++),def:pick.id,chips:[]}); } if(s.credits<60) s.credits=60; }
    else { st.item=''; }
    const slot=st.slot; const have=(Object.keys(CHIPS) as ChipId[]).filter(c=>chipFits(c,slot)&&(s.lockerChips[c]||0)>0);
    if(have.length) st.chip=have.includes('power' as ChipId)?'power' as ChipId:have[0]; else { const c=(Object.keys(CHIPS) as ChipId[]).find(c=>chipFits(c,slot)&&CHIPS[c].rarity==='green')||(Object.keys(CHIPS) as ChipId[]).find(c=>chipFits(c,slot))!; s.lockerChips[c]=(s.lockerChips[c]||0)+1; st.chip=c; }
    persist(s); }
  // ---------- DOM ----------
  private build(){
    const mk=(tag:string,id:string,html='')=>{ let e=document.getElementById(id); if(!e){ e=document.createElement(tag); e.id=id; document.body.appendChild(e); } e.innerHTML=html; return e; };
    this.el=mk('div','tut',`<div class="tt-head"><span class="tt-step"></span><b class="tt-title"></b></div><div class="tt-body"></div><ul class="tt-list"></ul><div class="tt-btns"><button type="button" class="tt-ack" style="display:none"></button><button type="button" class="tt-skipstep">Skip step</button><button type="button" class="tt-skip">Skip tutorial</button></div>`);
    this.el.setAttribute('role','region'); this.el.setAttribute('aria-label','Tutorial'); this.el.setAttribute('aria-live','polite'); this.el.style.display='none';
    this.spot=mk('div','tutspot','<i class="tt-arrow"></i>'); this.world=mk('div','tutworld','<i class="tt-wring"></i><i class="tt-warrow"></i>'); this.edge=mk('div','tutedge','<i></i>');
    this.spot.style.display=this.world.style.display=this.edge.style.display='none';
    this.el.addEventListener('click',e=>{ const t=(e.target as HTMLElement).closest('button'); if(!t) return; (t as HTMLElement).blur();
      if(t.classList.contains('tt-skip')){ if(performance.now()<this.skipArm){ this.finish('skipped'); } else { this.skipArm=performance.now()+3500; t.textContent='Tap again to skip'; setTimeout(()=>{ if(t.textContent==='Tap again to skip') t.textContent='Skip tutorial'; this.skipArm=0; },3500); } return; }
      if(t.classList.contains('tt-skipstep')){ this.skipStep(); return; }
      if(t.classList.contains('tt-ack')) this.ack(); });
  }
  // ---------- state transitions ----------
  isDone(id:string){ return this.st.done.includes(id); }
  latch(id:string){ if(!this.st.done.includes(id)){ this.st.done.push(id); persist(this.g.save); this.key=''; } }
  private skipStep(){ const v=this.cur(); if(!v) return; this.st.skipped.push(v.id); this.latch(v.id); if(v.id==='gate'||v.id==='controls'||v.id==='fight') { /* run steps re-prompt nothing */ } }
  private ack(){ const v=this.cur(); if(!v) return; if(v.id==='controls') this.flags.ctrlack=true; if(v.id==='recs'){ this.latch('recs'); return; } }
  private finish(how:'done'|'skipped'){ const s=this.g.save; this.st.status=how; if(how==='done'&&!this.st.rewarded){ this.st.rewarded=true; s.credits+=REWARD.credits; s.stims+=REWARD.stims; this.ui.toast(`Tutorial complete: +${REWARD.credits}c, +${REWARD.stims} stim. Replay it any time in Settings > Gameplay.`); }
    else if(how==='done') this.ui.toast('Tutorial complete. Replay it any time in Settings > Gameplay.'); else this.ui.toast('Tutorial skipped. Replay it any time in Settings > Gameplay.'); persist(s); this.hideAll(); }
  /** Called for every game event (before the UI sees it). */
  event(t:string,p:any){ if(this.st.status!=='active') return;
    if(t==='sfx'&&typeof p==='string'&&p.startsWith('ab_')&&this.g.mode==='run'){ this.flags.cast=true; }
    else if(t==='pickup'||(t==='sfx'&&p==='coin'&&this.g.mode==='run')){ this.flags.loot=true; } /* credit drops emit only the coin sfx */
    else if(t==='mode'&&p==='town'&&this.lastMode==='run'){ if(this.isDone('gate')||this.flags.entered) this.latch('return'); }
  }
  // ---------- observation ----------
  private observe(){ const g=this.g, s=g.save, st=this.st; const ui=this.ui as any;
    // movement (cumulative distance, ignoring teleports/mode changes)
    const d=Math.hypot(g.px-this.lx,g.py-this.ly); if(d<2&&g.mode===this.lastMode) this.dist+=d; this.lx=g.px; this.ly=g.py; if(this.dist>=4) this.latch('move');
    if(g.mode==='run'){ this.flags.entered=true; this.latch('move'); if(g.kills>this.lk&&this.lk>=0) st.kills+=g.kills-this.lk; if(g.dodgeT>0&&this.lastDodge<=0) this.flags.dodge=true; const sc=g.inst?.carried.stims??-1; if(this.lastStims>=0&&sc>=0&&sc<this.lastStims) this.flags.stim=true; this.lastStims=sc; } else this.lastStims=-1;
    this.lk=g.kills; this.lastDodge=g.dodgeT; if(g.mode!==this.lastMode){ if(g.mode==='run') { this.latch('gate'); this.latch('move'); } this.lastMode=g.mode; this.key=''; }
    if(g.mode==='run'&&g.hp<g.maxHp&&this.flags.cast===undefined) { /* nothing */ }
    // facts from the save
    const cs=contractState(s); if(Object.keys(cs.active).length||cs.done.length||Object.keys(cs.doneDay).length) this.latch('fixer');
    if(!st.item) { this.latch('equip'); } else if(this.rankSum()>st.rankBase) this.latch('equip');
    if(!this.isDone('socket')){ const cn=this.chipSum(); if(cn<st.chipBase) st.chipBase=cn; if(cn>st.chipBase) this.latch('socket'); }
    if(ui.modal!==this.lastModal){ this.lastModal=ui.modal; this.openedAt=performance.now(); this.key=''; }
    if(ui.modal==='vendor'&&performance.now()-this.openedAt>2500) this.latch('vendor');
    if(this.flags.cast&&this.flags.dodge&&this.flags.ctrlack) this.latch('controls');
    if(st.kills>=KILLS_NEEDED&&this.flags.loot) this.latch('fight');
  }
  /** first incomplete step that fits the current place, else a redirect for the first incomplete step */
  cur():(StepDef&{redirect:boolean;n:number})|null{ const mode=this.g.mode; const pend=STEPS.map((s,i)=>({s,i})).filter(x=>!this.isDone(x.s.id)); if(!pend.length) return null;
    const fit=pend.find(x=>x.s.ctx==='any'||x.s.ctx===mode); if(fit) return {...fit.s,redirect:false,n:fit.i+1};
    // nothing fits here: if in run, bring them home (return step is a run step so this is only when it is latched); if in town only run steps remain, send them to the gate
    const x=pend[0]; return {...x.s,redirect:true,n:x.i+1}; }
  // ---------- copy / targets ----------
  private touch(){ return document.body.classList.contains('touch'); }
  private W(id:string){ const l=this.g.level.interacts.find(i=>i.id===id); return l?{x:l.x,y:l.y,r:1.3,col:'#e0c070'}:undefined; }
  private compute(c:StepDef&{redirect:boolean}):View{ const g=this.g, s=g.save, st=this.st, ui=this.ui as any, t=this.touch(); const modal:string|null=ui.modal; const slotName=SLOT_LABEL[st.slot];
    const item=ITEM_BY_ID[st.item]; const itemName=item?.name||'the new part';
    const T=(sel:string,dim=false):Target=>({sel,dim});
    if(c.redirect){ if(g.mode==='run') return { title:'Back to town', body:t?'Tap the Town button (top right) to channel a return. Some steps are waiting in town.':'Press B to channel a return to town. Some steps are waiting there.', target:T('#btn-town',true), redirect:true };
      return { title:'Back to the gate', body:'You still have field lessons left. Walk to the Annex gate and press F.', target:{world:this.W('annex')}, redirect:true }; }
    switch(c.id){
      case 'move': return { title:c.title, body:t?'Drag on the left half of the screen to move. The market is not going anywhere. Neither are you, yet.':'WASD to move. Take a lap of the market. Nobody checks your paperwork until you leave.', list:[{t:'Walk a few steps',ok:this.dist>=4}] };
      case 'fixer': {
        if(modal==='fixer') return { title:c.title, body:'Odalys sells Annex work out of a tarp stall. Open her contacts and take a job.', target:T('#modal [data-act=opencontacts]') };
        if(modal==='contacts'){ const sel=document.querySelector('#modal [data-act=accept]:not([disabled])'); const own=ui.contactSel==='odalys_vane'||!ui.contactSel; if(!own) return { title:c.title, body:'Pick Odalys Vane in the contact list.', target:T('#modal [data-act=dsel][data-id=odalys_vane]') };
          return { title:c.title, body:sel?'Accept a contract. Floor sweep is the easy one. Progress counts while you are in the field.':'Accept any contract that is not locked.', target:T(sel?'#modal [data-act=accept]:not([disabled])':'#modal') }; }
        return { title:c.title, body:t?'Walk to Odalys Vane, the fixer, and tap the prompt. Or open Contacts any time.':'Walk to Odalys Vane, the fixer, and press F. Or press C for contacts from anywhere in town.', target:{world:this.W('fixer')} }; }
      case 'equip': {
        if(modal!=='locker') return { title:c.title, body:`Upgrades live in the locker. Your body is eleven slots of Standard Issue. Visit the body shop and fit the ${itemName} we set aside.`, target:{world:this.W('locker')} };
        if(ui.confirm?.type==='replace') return { title:c.title, body:'Before and after, plus what it costs. Confirm the swap.', target:T('#modal [data-act=confirm-replace]') };
        if(ui.sel!==st.slot) return { title:c.title, body:`Each tile is a body slot. Pick your ${slotName.toLowerCase()}.`, target:T(`#modal [data-act=sel][data-slot=${st.slot}]`) };
        const inst=s.items.find(i=>i.def===st.item&&!Object.values(s.installed).includes(i.uid));
        if(inst&&ui.pickUid!==inst.uid) return { title:c.title, body:`Storage holds spare parts. Pick the ${itemName}.`, target:T(`#modal [data-act=pick][data-uid=${inst.uid}]`) };
        return { title:c.title, body:`${itemName} beats Standard Issue. Press Replace.`, target:T('#modal [data-act=replace]') }; }
      case 'socket': {
        if(modal!=='locker') return { title:c.title, body:'Chips add stats, but each body part only takes the chips that fit it. Open the locker again.', target:{world:this.W('locker')} };
        if(ui.sel!==st.slot) return { title:c.title, body:`Select your ${slotName.toLowerCase()} again to see its sockets.`, target:T(`#modal [data-act=sel][data-slot=${st.slot}]`) };
        const used=ui.draft?.[st.slot]?.chips?.length||0; const cn=CHIPS[st.chip].name;
        if(this.chipSum()>st.chipBase||used>0){ const dirty=document.querySelector('#modal [data-act=apply]:not([disabled])'); return { title:c.title, body:'Chip in place. Changes are staged until you apply them.', target:T(dirty?'#modal [data-act=apply]':'#modal') }; }
        if(ui.chipSel===st.chip) return { title:c.title, body:'Now click an empty socket on the part.', target:T('#modal [data-act=sock]') };
        return { title:c.title, body:`Sockets take chips. Pick the ${cn}. Click it, then a socket${t?' (or tap, tap)':', or drag it in'}.`, target:T(`#modal [data-act=pickchip][data-chip=${st.chip}]`) }; }
      case 'vendor': return modal==='vendor'?{ title:c.title, body:'Hardware by slot, with stat comparisons. Repair all fixes breakage. Look around, then close.', target:T('#modal [data-act=shopslot]') }
        :{ title:c.title, body:'Parts and repairs. Walk to the vendor stall and open it. Browsing is free.', target:{world:this.W('vendor')} };
      case 'gate': { if(modal==='gate') return { title:c.title, body:'Dungeons unlock in tiers. Pick the Reclamation Annex and enter.', target:T('#modal [data-act=enter][data-id=annex]') };
        return { title:c.title, body:t?'Walk to the Annex gate and tap the prompt.':'Walk to the Annex gate and press F to pick a dungeon.', target:{world:this.W('annex')} }; }
      case 'controls': { const f=this.flags, all=!!(f.cast&&f.dodge);
        const list=[{t:t?'Cast: hold an ability, drag to aim, release':'Cast: hold Q, E or R, aim, release',ok:!!f.cast},{t:t?'Dodge: tap the Dodge button':'Dodge: Space',ok:!!f.dodge},{t:t?'Stim: tap the stim button (optional)':'Stim: T (optional)',ok:!!f.stim},{t:t?'Interact: tap the prompt (optional)':'Interact: F (optional)',ok:!!f.interact}];
        if(all) return { title:c.title, body:'The Objective tracker and minimap point the way. Press N to toggle the minimap.', list, target:T('#objective, #minimap, #btn-map'), ack:'Got it' };
        return { title:c.title, body:t?'Long-press an ability to read it.':'Hover an ability to read it.', list, target:T(f.cast?'#dodge':'#abilities') }; }
      case 'fight': { const left=Math.max(0,KILLS_NEEDED-st.kills); const en=g.enemies.filter(e=>!e.dead&&e.faction==='enemy').sort((a,b)=>Math.hypot(a.x-g.px,a.y-g.py)-Math.hypot(b.x-g.px,b.y-g.py))[0];
        const dr=(g.inst?.drops||[]).filter(d=>!d.marker).sort((a,b)=>Math.hypot(a.x-g.px,a.y-g.py)-Math.hypot(b.x-g.px,b.y-g.py))[0];
        const list=[{t:`Defeat ${KILLS_NEEDED} hostiles (${Math.min(KILLS_NEEDED,st.kills)}/${KILLS_NEEDED})`,ok:st.kills>=KILLS_NEEDED},{t:'Pick up a drop (walk over it)',ok:!!this.flags.loot}];
        const world=st.kills>=KILLS_NEEDED||!en?(dr&&!this.flags.loot?{x:dr.x,y:dr.y,r:.8,col:'#9fb98a'}:undefined):{x:en.x,y:en.y,r:1,col:'#c0503a'};
        return { title:c.title, body:left>0?'Hostiles ahead. Click one to target it, then use your abilities. Heat builds, so watch the bar.':'Loot drops where they fall. Walk over it to pick it up.', list, target:{world} }; }
      case 'return': return { title:c.title, body:t?'Tap the Town button to channel a return. Damage or movement interrupts it, so stand still.':'Press B to channel a return to town. Damage or movement interrupts it, so stand still.', target:T('#btn-town',true) };
      case 'recs': { const rp=document.querySelector('#modal .recpanel, #modal .recshow'); return { title:c.title, body:modal==='locker'||modal==='vendor'?(rp?'Recommended shows the best swaps, what changes and what it costs. Check it after every run.':'Recommendations show up here when you have something worth upgrading.'):'Open the locker or vendor to see Recommended: the best upgrades for your credits. Run, loot, upgrade, repeat.', target:rp?T('#modal .recpanel, #modal .recshow'):(modal?undefined:{world:this.W('locker')}), ack:'Finish and claim reward' }; }
    } return { title:c.title, body:'' }; }
  // ---------- per-frame ----------
  tick(){ if(this.disabled||this.st.status!=='active'){ if(this.shown) this.hideAll(); return; }
    const g=this.g, ui=this.ui as any; if(document.getElementById('splash')){ return; }
    this.observe();
    const c=this.cur(); if(!c){ this.finish('done'); return; }
    const hide=ui.modal==='settings'||ui.modal==='dev'||(()=>{ const r=document.getElementById('rotate'); return !!r&&getComputedStyle(r).display!=='none'; })();
    if(hide){ if(this.shown) this.hideAll(); return; }
    // downed: do not stack a spotlight on the death panel; keep the card (it explains what to do)
    const v=g.downed&&g.mode==='run'?{title:c.title,body:'You are down. Pick Return to checkpoint on the panel. Hardware breaks, but the lesson stays.',redirect:false} as View:this.compute(c); this.view=v; this.idx=c.n;
    this.shown=true; this.render(c,v); }
  private hideAll(){ this.shown=false; this.el.style.display=this.spot.style.display=this.world.style.display=this.edge.style.display='none'; document.body.classList.remove('tutdock'); document.body.style.removeProperty('--tutdock'); }
  private render(c:StepDef&{n:number},v:View){ const el=this.el, ui=this.ui as any; const dock=!!ui.modal;
    const key=[c.id,c.n,v.title,v.body,v.ack||'',JSON.stringify(v.list||[]),this.touch()].join('|');
    if(key!==this.key){ this.key=key; el.querySelector('.tt-step')!.textContent=`Step ${c.n} of ${STEPS.length}`; el.querySelector('.tt-title')!.textContent=v.title; el.querySelector('.tt-body')!.textContent=v.body;
      const ul=el.querySelector('.tt-list') as HTMLElement; ul.innerHTML=(v.list||[]).map(x=>`<li class="${x.ok?'ok':''}"><span class="tt-box">${x.ok?'✓':''}</span>${x.t}</li>`).join(''); ul.style.display=v.list?.length?'':'none';
      const a=el.querySelector('.tt-ack') as HTMLElement; a.style.display=v.ack?'':'none'; a.textContent=v.ack||''; this.placeKey=''; }
    el.style.display=dock?'grid':'block'; el.classList.toggle('dock',dock); document.body.classList.toggle('tutdock',dock);
    const pk=[dock,innerWidth,innerHeight,key,ui.modal,this.g.downed,!!document.getElementById('downpanel')?.style.display].join('|');
    if(pk!==this.placeKey||!dock&&performance.now()%500<20){ this.placeKey=pk; this.place(dock); }
    this.target(v.target); }
  private rect(sel:string):DOMRect|null{ const es=Array.from(document.querySelectorAll(sel)).filter(isVis); if(!es.length) return null; let r=es[0].getBoundingClientRect(); let x0=r.left,y0=r.top,x1=r.right,y1=r.bottom; for(const e of es.slice(1)){ const q=e.getBoundingClientRect(); x0=Math.min(x0,q.left);y0=Math.min(y0,q.top);x1=Math.max(x1,q.right);y1=Math.max(y1,q.bottom); } return new DOMRect(x0,y0,x1-x0,y1-y0); }
  private place(dock:boolean){ const el=this.el; el.style.left=el.style.top=el.style.right=el.style.bottom=''; el.style.transform='';
    if(dock){ el.style.left='50%'; el.style.transform='translateX(-50%)'; el.style.bottom='max(6px,env(safe-area-inset-bottom))'; el.style.top='auto'; const h=Math.ceil(el.getBoundingClientRect().height)+10+8; document.body.style.setProperty('--tutdock',h+'px'); return; }
    document.body.style.removeProperty('--tutdock');
    const avoid=['#topleft','#topright','#objective','#minimap','#abilities','#dodge','#interact','#channelbar','#downpanel','#dialog','#livepanel','#support','#joyfixed'].map(s=>this.rect(s)).filter(Boolean) as DOMRect[];
    const w=el.getBoundingClientRect().width, h=el.getBoundingClientRect().height, M=10;
    const tl=this.rect('#topleft'); const cands:[number,number][]=[[M,(tl?tl.bottom:60)+8]];
    const mm=this.rect('#minimap'), tr=this.rect('#topright'); cands.push([innerWidth-w-M,(mm?mm.bottom:(tr?tr.bottom:60))+8]); cands.push([M,innerHeight-h-M-70]); cands.push([M,innerHeight-h-M]); { const dp=this.rect('#downpanel'); if(dp){ cands.unshift([M,Math.min(innerHeight-h-M,dp.bottom+6)]); cands.push([dp.right+8,M+60]); } } cands.push([innerWidth/2-w/2,innerHeight*.5]);
    const hit=(x:number,y:number)=>avoid.reduce((n,r)=>n+(x<r.right+4&&x+w>r.left-4&&y<r.bottom+4&&y+h>r.top-4?1:0),0);
    let best=cands[0],bs=1e9; for(const c of cands){ const sc=hit(c[0],c[1])+(c[1]+h>innerHeight||c[0]<0||c[0]+w>innerWidth?5:0); if(sc<bs){ bs=sc; best=c; if(sc===0) break; } }
    el.style.left=Math.max(0,best[0])+'px'; el.style.top=Math.max(0,best[1])+'px'; }
  private target(t?:Target){ const sp=this.spot, wd=this.world, ed=this.edge; let spOn=false, wOn=false, edOn=false; const ui=this.ui as any;
    if(t?.sel){ if(t.sel!==this.lastSel||ui.modal!==this.lastSelModal){ this.lastSel=t.sel; this.lastSelModal=ui.modal; this.scrollT=0; } if(performance.now()>this.scrollT&&ui.modal){ const te=Array.from(document.querySelectorAll(t.sel)).find(isVis); if(te){ const q=te.getBoundingClientRect(), win=document.querySelector('#modal .win')?.getBoundingClientRect(); if(win&&(q.top<win.top+40||q.bottom>win.bottom-4)) { te.scrollIntoView({block:'center',inline:'nearest'}); this.scrollT=performance.now()+1500; } } }
      const r=this.rect(t.sel); if(r){ spOn=true; const pad=6; Object.assign(sp.style,{left:r.left-pad+'px',top:r.top-pad+'px',width:r.width+pad*2+'px',height:r.height+pad*2+'px'}); sp.classList.toggle('dim',!!t.dim&&!ui.modal&&!isVis(document.getElementById('interact'))&&!this.g.downed); sp.classList.toggle('below',r.top<90); } }
    if(t?.world&&!ui.modal){ const w=t.world, rd=this.rend; if(rd){ const sx=rd.sx(w.x,w.y), sy=rd.sy(w.x,w.y); const rx=(w.r||1)*rd.TW/2*1.0, ry=rx/2; const on=sx>0&&sx<innerWidth&&sy>0&&sy<innerHeight; wd.style.setProperty('--c',w.col||'#e0c070');
        if(on){ wOn=true; Object.assign(wd.style,{left:sx-rx+'px',top:sy-ry+'px',width:rx*2+'px',height:ry*2+'px'}); } else { edOn=true; const cx=innerWidth/2, cy=innerHeight/2, a=Math.atan2(sy-cy,sx-cx); const k=Math.min((innerWidth/2-46)/Math.abs(Math.cos(a)||1e-6),(innerHeight/2-46)/Math.abs(Math.sin(a)||1e-6)); ed.style.left=cx+Math.cos(a)*k-14+'px'; ed.style.top=cy+Math.sin(a)*k-14+'px'; ed.style.setProperty('--a',a+'rad'); ed.style.setProperty('--c',w.col||'#e0c070'); } } }
    sp.style.display=spOn?'block':'none'; wd.style.display=wOn?'block':'none'; ed.style.display=edOn?'block':'none'; }
}
