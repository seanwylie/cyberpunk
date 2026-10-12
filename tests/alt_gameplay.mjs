// Alt gameplay: hacking + speech + humanity (docs/ALT_GAMEPLAY.md, docs/HUMANITY.md).
// Node part: pure rules. Browser part (needs dev server at URL): real Sim payoffs, T0 mini-game, onboarding once, no hard block at hack off / humanity 0 and 100.
import { build } from 'esbuild'; import fs from 'fs'; import path from 'path'; import os from 'os';
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const out=path.join(os.tmpdir(),'wv_alt_'+process.pid+'.mjs');
fs.writeFileSync(out+'.ts',`export * as A from '${path.resolve('src/altplay.ts')}'; export * as S from '${path.resolve('src/traitstate.ts')}'; export * as T from '${path.resolve('src/traits.ts')}'; export * as C from '${path.resolve('src/config.ts')}'; export { snapshot, diffBuild } from '${path.resolve('src/catalog_snap.ts')}';`);
await build({ entryPoints:[out+'.ts'], bundle:true, platform:'node', format:'esm', outfile:out, logLevel:'error', loader:{'.png':'empty','.jpg':'empty','.json':'json'} });
const { A, S, T, C, snapshot, diffBuild }=await import(out); fs.unlinkSync(out); fs.unlinkSync(out+'.ts');
const I=C.ITEM_BY_ID; const ctx=(o={})=>({ caps:new Set(), abilities:[], traits:{}, rep:{HI:0,PS:0,MM:0}, mfr:'PS', humanity:100, credits:0, ...o });
// humanity computation
ok(A.humanityCost(I.stock_torso)===0,'stock gear costs 0 humanity');
ok(A.humanityCost(I.sig_audit_core)>A.humanityCost(I.idkfa_foot_l)&&A.humanityCost(I.sig_audit_core)>=14,'orange brain costs more than an orange foot ('+A.humanityCost(I.sig_audit_core)+')');
const orange=C.ITEMS.filter(i=>i.rarity==='orange'), purple=C.ITEMS.filter(i=>i.rarity==='purple'), green=C.ITEMS.filter(i=>i.rarity==='green');
const avg=a=>a.reduce((x,i)=>x+A.humanityCost(i),0)/a.length; ok(avg(orange)>avg(purple)&&avg(purple)>avg(green),`cost scales with rarity (orange ${avg(orange).toFixed(1)} > purple ${avg(purple).toFixed(1)} > green ${avg(green).toFixed(1)})`);
ok(A.humanityOfDefs([])===100&&A.humanityOfDefs(orange)===0,'humanity is 100 bare, clamps at 0');
const three=['sig_audit_core','sig_lazarus_rack','sig_anvil_arm'].map(x=>I[x]); const h3=A.humanityOfDefs(three); ok(h3<70&&h3>=35,'3 orange pieces drop you out of Human ('+h3+'): a real choice');
// tooltip deltas
const dl=A.humanityDelta(I.stock_brain,I.sig_audit_core,100); ok(dl.d<0&&/^−\d+ Humanity: persuasion odds down$/.test(dl.text),'equip delta text: "'+dl.text+'"');
ok(A.humanityDelta(I.sig_audit_core,I.stock_brain,40).text.startsWith('+'),'removing chrome shows a + delta');
// speech odds scaling + NPC reactions
const p=h=>A.speechOptions(ctx({humanity:h})).find(o=>o.payoff==='standdown')?.chance; const im=h=>A.speechOptions(ctx({humanity:h})).find(o=>o.payoff==='flee').chance;
ok(p(100)>p(60)&&p(60)>p(40),`talk-down odds rise with humanity (${p(100)} > ${p(60)} > ${p(40)})`); ok(im(5)>im(50)&&im(50)>im(100),`intimidate odds rise as humanity falls (${im(5)} > ${im(50)} > ${im(100)})`);
ok(!A.speechOptions(ctx({humanity:5})).some(o=>o.payoff==='standdown'||o.payoff==='switch')&&/Terrify/.test(A.speechOptions(ctx({humanity:5})).find(o=>o.payoff==='flee').label),'cyberpsycho: talk/persuade gone, Terrify unlocked');
ok(A.speechOptions(ctx({humanity:80})).some(o=>o.payoff==='switch')&&!A.speechOptions(ctx({humanity:40})).some(o=>o.payoff==='switch'),'persuade option needs humanity >= 50');
ok(A.speechOptions(ctx()).every(o=>o.chance>0&&o.chance<=1),'every option shows its odds');
ok(A.vendorTerms(90).mul<1&&A.vendorTerms(20,'aldane_spire').mul>A.vendorTerms(20).mul&&A.vendorTerms(5,'aldane_spire').refuse&&!A.vendorTerms(5,'rustline').refuse,'vendors: human discount, chrome surcharge (more in Aldane Spire), cyberpsycho refused only in Aldane Spire');
ok(A.psychoDmg(0)>0&&A.psychoDmg(50)===0,'dark bonus only at low humanity');
// tier gating
ok(A.tierOf('hack',ctx())===0,'hack T0 with no sources'); ok(A.tierOf('hack',ctx({caps:new Set(['hack'])}))===1,'hack augment -> T1');
ok(A.tierOf('hack',ctx({caps:new Set(['hack']),traits:{l10:'netrunner',l20:'rootkit'}}))===3,'augment + hacker traits -> T3');
ok(A.tierOf('speech',ctx({caps:new Set(['speech'])}))===1&&A.tierOf('speech',ctx({rep:{PS:99},caps:new Set(['speech'])}))===2&&A.tierOf('speech',ctx({traits:{l10:'face'}}))===1,'speech tiers: augment, faction rep, Face trait');
ok(!A.canUse('turret',0)&&A.canUse('turret',1)&&!A.canUse('shield',1)&&A.canUse('shield',2)&&A.canUse('shortcut',0)&&!A.canUse('sitout',2),'node gating: relay T0, turret T1, shield T2, sit-out T3');
ok(/^Hack T1\+ · You T0 · /.test(A.tooltip('turret',0)),'tooltip shows requirement, your tier, reward: "'+A.tooltip('turret',0)+'"');
// T0 mini-game
const m=A.miniFor(0,7); ok(m.w>0&&m.start>0&&m.start+m.w<1,'mini-game zone inside the bar'); ok(A.miniHit(m,m.start+m.w/2)&&!A.miniHit(m,m.start-.05)&&!A.miniHit(m,-1),'hit inside, miss outside / timeout');
let tHit=-1; for(let t=0;t<3;t+=.01) if(A.miniHit(m,A.cursorAt(m,t))){ tHit=t; break; } ok(tHit>=0&&tHit<2,'zone reachable within a few seconds ('+tHit.toFixed(2)+'s)');
// onboarding once
const sv={}; ok(A.firstSeen(sv,'hack')&&!A.firstSeen(sv,'hack')&&A.firstSeen(sv,'speech'),'teach prompt fires once per style');
// signals
const s1={level:12}; S.recordHack(s1); S.recordSpeech(s1,'standdown'); S.recordSpeech(s1,'intimidate'); const sc=S.scores(s1).sig; ok(sc.hack>0&&sc.social>0&&sc.chrome>0,'hack / speech / intimidate feed hack, social, chrome signals');
const face={level:12}; for(let i=0;i<40;i++){ S.recordSpeech(face,'standdown'); S.recordHumanity(face,95); if(i%5===4) S.closeRun(face); } ok(S.refreshOffer(face).ids[0]==='face','talkers with high humanity are offered Face first');
const chr={level:12}; for(let i=0;i<40;i++){ S.recordHumanity(chr,0); S.addSig(chr,{chrome:1},3); if(i%5===4) S.closeRun(chr); } ok(S.refreshOffer(chr).ids[0]==='chromed','low humanity leans Full Chrome');
const con={level:12}; for(let i=0;i<40;i++){ S.recordSpeech(con,'standdown'); S.recordHack(con); if(i%5===4) S.closeRun(con); } ok(S.refreshOffer(con).ids.includes('conartist'),'hack + talk produces the Con Artist hybrid');
ok(!T.TRAIT_ERRORS.length,'trait data valid: '+T.TRAIT_ERRORS.join('; '));
// catalog carries humanity + "What changed"
const sn=snapshot(); ok(sn.items.sig_audit_core.h===A.humanityCost(I.sig_audit_core),'catalog snapshot carries humanity cost');
const old=JSON.parse(JSON.stringify(sn)); delete old.items.sig_audit_core.h; const ch=diffBuild(old,sn,{brain:{d:'sig_audit_core',c:[]}}); ok(ch.some(c=>c.kind==='humanity'),'old build link reports the new humanity cost');
const aug=JSON.parse(fs.readFileSync('docs/catalog/augments.json','utf8')); ok(aug.augments.every(a=>typeof a.humanity==='number'),'catalog lists humanity for every augment');

if(!process.argv.includes('--node-only')){
  const { launch, URL }=await import('./lib.mjs'); let up=false; try{ up=(await fetch(URL)).ok; }catch{}
  if(!up) console.log('SKIP browser part: dev server not running at '+URL);
  else { const { browser, page, errors }=await launch(); const ev=(f,a)=>page.evaluate(f,a); await ev(()=>document.getElementById('splash')?.remove());
    const start=(id,seed,o={})=>ev(([id,seed,o])=>{ const g=window.__game; g.enterTown(); g.save.instance=null; g.inst=null; g.save.lockouts={}; g.save.level=30; g.save.settings.devFreeReset=true; g.save.alt=o.alt??g.save.alt; g.recompute(); g.dbg.god=true; g.dbg.noHack=!!o.noHack; return g.startRun(id,seed); },[id,seed,o]);
    // T0 relay: miss -> alarm, not locked; retry hit -> lock open
    ok(await start('warehouse',3,{noHack:true,alt:{}}),'run starts (hack tier 0)');
    const r=await ev(async()=>{ const g=window.__game; const AS=await import('/src/altsim.ts'); const dlg=[]; const off=g.on?.('dialog',d=>dlg.push(d.title)); const out={};
      const relay=g.level.interacts.find(i=>i.id==='hackproc'); g.doInteract(relay); out.mini=!!g.altMini; out.teach=g.save.alt.seen.hack>0; const n0=g.enemies.filter(e=>!e.dead).length;
      AS.miniResolve(g,-1); out.lockAfterMiss=g.inst.flags.lock2; out.alarm=g.inst.flags.alarm; out.wave=g.enemies.filter(e=>!e.dead).length-n0; g.doInteract(relay); out.cooldown=!g.altMini;
      g.time+=10; g.doInteract(relay); out.mini2=!!g.altMini; const M=g.altMini.m; AS.miniResolve(g,M.start+M.w/2); out.lock=g.inst.flags.lock2; out.n=g.save.alt.n.hack; out.hackSig=(await import('/src/traitstate.ts')).scores(g.save).sig.hack;
      return out; });
    ok(r.mini,'T0: anyone gets the timing mini-game'); ok(r.teach,'first hack shows the onboarding prompt');
    ok(!r.lockAfterMiss&&r.alarm&&r.wave>0,'T0 miss: alarm + wave ('+r.wave+'), lock stays closed'); ok(r.cooldown,'short retry cooldown'); ok(r.mini2&&r.lock,'retry and hit: relay opens the lock (never locked out)'); ok(r.n>=1&&r.hackSig>0,'hack recorded into traits signal');
    const t2=await ev(async()=>{ const g=window.__game; const before=g.save.alt.seen.hack; const AS=await import('/src/altsim.ts'); g.doInteract(g.level.interacts.find(i=>i.id==='hackproc')); return { same:g.save.alt.seen.hack===before }; }); ok(t2.same,'onboarding prompt appears once');
    // payoffs with tiers
    const pay=await ev(async()=>{ const g=window.__game; const AS=await import('/src/altsim.ts'); g.dbg.noHack=false; const out={};
      g.build.caps.delete('hack'); const tur=g.spawnEnemy('turret',g.px+1,g.py); g.prompt=null; g.updatePrompt(); out.prompt=g.prompt?.id||''; out.tip=AS.promptTip(g,g.prompt)||''; g.doInteract(g.prompt); g.channel?.cb?.(); out.deniedT0=tur.faction==='enemy';
      g.build.caps.add('hack'); g.doInteract({id:'alt:turret:'+tur.id}); g.channel.cb(); g.channel=null; out.turret=tur.faction==='ally';
      const d0=g.inst.drops.length; AS.applyPayoff(g,'cache'); out.cache=g.inst.drops.length>d0;
      const boss=g.spawnEnemy(g.dd.defaultBoss,g.px+2,g.py); boss._rt.reveal=0; AS.applyPayoff(g,'shield',boss); out.shield=boss._rt.vuln>0&&g.inst.flags.shieldHacked;
      AS.applyPayoff(g,'lights'); out.lights=!!g.inst.flags.lightsOut; boss.dead=true; tur.dead=true; return out; });
    ok(/^alt:turret:/.test(pay.prompt)&&/Hack T1\+ · You T0/.test(pay.tip),'turret prompt + tooltip: '+pay.tip); ok(pay.deniedT0,'T0 cannot turn a turret'); ok(pay.turret,'T1: turret turned'); ok(pay.cache,'cache payoff drops a bonus chip'); ok(pay.shield,'shield payoff: boss vulnerable'); ok(pay.lights,'lights payoff');
    // speech
    ok(await start('coke_ovens',5,{alt:{}}),'run starts (speech)');
    const sp=await ev(async()=>{ const g=window.__game; const AS=await import('/src/altsim.ts'); const C=await import('/src/config.ts'); const out={}; g.save.credits=1e5;
      const crew=g.enemies.filter(e=>!e.dead&&!C.ENEMIES[e.type].static&&!C.ENEMIES[e.type].boss&&e.type!==g.dd.lockElite); out.n=crew.length;
      for(const e of g.enemies) if(C.ENEMIES[e.type].static) e.dead=true; const e0=crew[0]; e0.alert=false; g.px=e0.x+1; g.py=e0.y; g.prompt=null; g.updatePrompt(); out.prompt=g.prompt?.id||''; out.icon=AS.promptIcon(g.prompt); for(const e of g.enemies) if(C.ENEMIES[e.type].static&&e.type===g.dd.gateGuard) e.dead=false;
      out.std=AS.speak(g,crew[0],'standdown',0); out.std0=crew[0].dead&&crew[0].fled; out.fail=!AS.speak(g,crew[1],'standdown',.999)&&crew[1].alert&&!crew[1].dead; out.retry=!AS.speak(g,crew[1],'standdown',0);
      { const c=g.save.credits; AS.speak(g,crew[2],'bribe',.5); out.bribe=crew[2].dead&&g.save.credits<c; }
      g.build.caps.add('speech'); AS.speak(g,crew[3],'switch',0); out.sw=crew[3].faction==='ally';
      const le=g.enemies.find(e=>!e.dead&&e.type===g.dd.lockElite); for(const e of g.enemies) if(!e.dead&&e.type===g.dd.gateGuard) g.killEnemy(e); g.update(.05); out.gate=g.inst.flags.gate1; if(le){ le.alert=false; AS.speak(g,le,'standdown',0); out.lock=g.inst.flags.lock2; }
      const pack=crew.slice(4).filter(e=>!e.dead); if(pack[0]){ AS.speak(g,pack[0],'flee',0); out.flee=pack[0].dead; }
      out.sig=(await import('/src/traitstate.ts')).scores(g.save).sig.social; return out; });
    ok(sp.lock!==false,'talking the lock elite down opens the lock');
    ok(/^alt:talk:/.test(sp.prompt)&&sp.icon==='❝','talkable guard gets the talk prompt + icon ('+sp.prompt+')'); ok(sp.std&&sp.std0,'talk down: guard stands down'); ok(sp.fail===undefined||sp.fail,'failed talk = fight, guard alerted'); ok(sp.retry===undefined||sp.retry,'one talk per guard; combat route remains');
    ok(sp.bribe===undefined||sp.bribe,'bribe costs credits and works'); ok(sp.sw===undefined||sp.sw,'persuade: guard switches sides'); ok(sp.gate,'gate opens with talked/turned/killed guards'); ok(sp.flee!==false,'intimidate: pack flees'); ok(sp.sig>0,'speech feeds the social signal');
    // no hard block at hack off with humanity 0 and 100: clear by combat only
    for(const hum of [0,100]){ ok(await start('clinic',11,{noHack:true}),'clinic starts (hack off, humanity '+hum+')');
      const nb=await ev(async(hum)=>{ const g=window.__game; const AS=await import('/src/altsim.ts'); g.dbg.hum=hum; const h=AS.humanity(g);
        for(const k of ['gateGuard','lockElite']){ for(const e of g.enemies) if(!e.dead&&e.type===g.dd[k]) g.killEnemy(e); g.update(.05); }
        const c=g.level.interacts.find(i=>i.id==='controller'); g.doInteract(c); const out={ g1:g.inst.flags.gate1, l2:g.inst.flags.lock2, boss:g.inst.flags.controller, tier:AS.hackTier(g), h }; delete g.dbg.hum; return out; },hum);
      ok(nb.h===hum&&nb.tier===0&&nb.g1&&nb.l2&&nb.boss,'humanity '+hum+', hack off: gate, lock and boss door all open by combat'); }
    ok(!errors.length,'no page errors '+errors.slice(0,3).join(' | ')); await browser.close(); } }
console.log(fails?fails+' FAIL':'ALL PASS'); process.exit(fails?1:0);
