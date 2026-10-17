// Limb loss (docs/LIMBS.md): pure rules in node, then a real browser run: telegraphed Rend tears a limb, Field Patch, Repair Bay, and the NEVER STUCK guarantee.
import { build } from 'esbuild'; import fs from 'fs'; import path from 'path'; import os from 'os';
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const out=path.join(os.tmpdir(),'wv_limbs_'+process.pid+'.mjs');
fs.writeFileSync(out+'.ts',`export * as L from '${path.resolve('src/limbs.ts')}'; export * as C from '${path.resolve('src/config.ts')}'; export * as S from '${path.resolve('src/state.ts')}'; export * as A from '${path.resolve('src/altplay.ts')}'; export * as B from '${path.resolve('src/build.ts')}';`);
globalThis.localStorage={ getItem:()=>null, setItem(){}, removeItem(){} };
await build({ entryPoints:[out+'.ts'], bundle:true, platform:'node', format:'esm', outfile:out, logLevel:'error', loader:{'.png':'empty','.jpg':'empty','.json':'json'} });
const { L, C, S, A, B }=await import(out); fs.unlinkSync(out); fs.unlinkSync(out+'.ts');
const LIMB=L.LIMB_SLOTS; const pick=sl=>C.ITEMS.find(d=>d.slot===sl&&!d.id.startsWith('stock_')&&!d.id.startsWith('mmpatch_')&&d.rarity==='blue')||C.ITEMS.find(d=>d.slot===sl&&!d.id.startsWith('stock_')&&!d.id.startsWith('mmpatch_'));
const AUG=Object.fromEntries(LIMB.map(sl=>[sl,pick(sl).id]));
const fresh=()=>{ const s=S.newSave(); s.level=12; for(const sl of LIMB){ const it=S.mkInst(s,AUG[sl]); s.items.push(it); s.installed[sl]=it.uid; } return s; };
const bld=s=>B.computeBuild(B.installedLayout(s),s.level,s.rep);
{ const s=fresh(); ok(L.tearable(s).length===8,'all 8 augmented limbs are tearable'); const s2=S.newSave(); ok(L.tearable(s2).length===0,'stock limbs are never torn');
  const sl=L.tearLimb(s,'Test Elite',()=>0); const lost=L.limbState(s).lost[sl]; ok(sl&&!s.installed[sl]&&lost&&!s.items.includes(lost.inst),'tear: part leaves the build and the locker, goes on the shelf ('+sl+')');
  ok(!S.lockerItems(s).some(i=>i.def===AUG[sl]),'torn part cannot be re-equipped for free from the locker');
  const st={...bld(s).stats}; const st2={...st}; L.applyLimbStats(s,st2,false); ok(Object.keys(st).some(k=>st2[k]<st[k]),'open slot applies a debuff');
  ok(L.patchLimb(s,sl)&&C.ITEM_BY_ID[s.items.find(i=>i.uid===s.installed[sl]).def].mfr==='MM','Field Patch: free Mass-Market part fitted on the spot');
  const st3={...bld(s).stats}, st4={...st3}; L.applyLimbStats(s,st4,true); ok(Object.keys(st3).some(k=>st4[k]<st3[k]),'a jammed patch weakens that limb for a moment');
  ok(A.humanityCost(C.ITEM_BY_ID['mmpatch_'+sl])===3,'patch costs 3 humanity');
  s.credits=0; const r=L.reattach(s,sl); ok(!r.ok&&/free/.test(r.why),'reattach needs credits and points at the free option: '+r.why);
  ok(L.stockRefit(s,sl)&&s.items.find(i=>i.uid===s.installed[sl]).def==='stock_'+sl&&!s.items.some(i=>i.def==='mmpatch_'+sl),'stock refit is free at 0 credits and scraps the patch');
  const h0=A.humanityOfSave(s); s.credits=99999; const c=L.reattachCost(s,sl); const ns0=s.items.filter(i=>i.def==='stock_'+sl).length; const r2=L.reattach(s,sl); ok(r2.ok&&s.credits===99999-c&&s.items.find(i=>i.uid===s.installed[sl]).def===AUG[sl]&&s.items.filter(i=>i.def==='stock_'+sl).length===ns0-1,'reattach restores the original part for '+c+'c (stock part scrapped)');
  ok(L.limbState(s).scars===1&&A.humanityOfSave(s)<h0,'reattach leaves a scar that costs humanity'); }
{ const s=fresh(); while(L.tearLimb(s,'x')); ok(L.openSlots(s).length===8,'tear every limb');
  const b=bld(s); const st={...b.stats}; L.applyLimbStats(s,st,false); ok(b.weapon&&b.weapon.dmg>0&&st.dmg>0&&st.atkSpeed>0&&st.move>0&&b.abilities.length>0,`NEVER STUCK (rules): bare build still attacks (${b.weapon.kind}), moves (${st.move.toFixed(2)}) and has abilities`);
  s.credits=0; for(const sl of LIMB) L.stockRefit(s,sl); ok(LIMB.every(sl=>s.installed[sl]),'NEVER STUCK: every limb refit for free with 0 credits'); }
ok(!C.ITEMS.filter(d=>d.id.startsWith('mmpatch_')).some(d=>d.rarity!=='grey'||d.abilities?.length),'patches are plain grey parts');
// ---------- browser ----------
const { launch, sleep }=await import('./lib.mjs');
const { browser, page, errors }=await launch({}); const ev=(f,a)=>page.evaluate(f,a);
await ev(async(AUG)=>{ const g=window.__game; if(g.mode==='run') g.enterTown(true); const s=g.save; s.level=12; for(const [sl,def] of Object.entries(AUG)){ const it={uid:'t'+sl,def,chips:[]}; s.items.push(it); s.installed[sl]=it.uid; } g.recompute(); g.startRun(); g.revealing=false; g.grace=null; },AUG);
await sleep(300);
const r=await ev(async()=>{ const g=window.__game; const L=await import('/src/limbs.ts'); for(const e of g.enemies) if(!e.dead){ e.dead=true; e.hp=0; }
  const e=g.spawnEnemy('brakeman',g.px+1.2,g.py); e.alert=true; g.hp=g.maxHp; g.iframes=0;
  const ready=L.rendReady(g,{elite:true}); g.beginAttack(e,'rend',Math.atan2(g.py-e.y,g.px-e.x),g.px,g.py);
  const tele=e._rt.st==='tele'&&e._rt.atk==='rend'; for(let i=0;i<40&&e._rt.st==='tele';i++){ g.iframes=0; g.update(1/20); g.px=e.x-1.2; }
  const lost=L.lostSlots(g.save); e.dead=true; e.hp=0; return { ready, tele, lost, tears:g.inst.tears, again:L.rendReady(g,{elite:true}) }; });
ok(r.ready&&r.tele,'elite can start a telegraphed Rend'); ok(r.lost.length===1&&r.tears===1,'Rend that lands tears exactly one limb ('+r.lost+')'); ok(!r.again,'only one tear per run');
await sleep(400); ok(await ev(()=>getComputedStyle(document.getElementById('limbpanel')||document.body).display)==='block','LIMB TORN panel shows in the run');
fs.mkdirSync('shots/limbs',{recursive:true}); await page.screenshot({path:'shots/limbs/torn_panel.png'});
const d=await ev(async()=>{ const g=window.__game; const L=await import('/src/limbs.ts'); for(let i=0;i<20;i++){ g.dodgeCd=0; } const e=g.spawnEnemy('brakeman',g.px+1.2,g.py); e.alert=true; g.inst.tears=0; const n0=L.lostSlots(g.save).length; g.beginAttack(e,'rend',0,g.px,g.py); for(let i=0;i<40&&e._rt.st==='tele';i++){ g.iframes=1; g.update(1/20); } e.dead=true; e.hp=0; return L.lostSlots(g.save).length===n0; });
ok(d,'dodging Rend (i-frames) tears nothing');
await page.click('#limbpanel [data-limb="patch"]'); await sleep(100);
ok(await ev(async()=>{ const g=window.__game; const L=await import('/src/limbs.ts'); return L.openSlots(g.save).length===0&&L.patchedSlots(g.save).length===1; }),'Patch button fits a Field Patch in the run');
const jam=await ev(async()=>{ const g=window.__game; const L=await import('/src/limbs.ts'); g.combatHold=5; g._limb={jamT:0,next:.01}; const a0=g.build.stats.atkSpeed*g.build.stats.move; for(let i=0;i<3;i++){ g.combatHold=5; g.update(1/20); } const j=L.jammed(g), a1=g.build.stats.atkSpeed*g.build.stats.move; for(let i=0;i<40;i++) g.update(1/20); return { j, worse:a1<a0, back:!L.jammed(g)&&Math.abs(g.build.stats.atkSpeed*g.build.stats.move-a0)<1e-9 }; });
ok(jam.j&&jam.worse&&jam.back,'patch jams briefly, then recovers');
// NEVER STUCK: tear every limb, still fights and moves, gets home, and fixes everything free at 0 credits
const ns=await ev(async()=>{ const g=window.__game; const L=await import('/src/limbs.ts'); const s=g.save; for(const sl of L.LIMB_SLOTS){ if(s.installed[sl]&&s.items.find(i=>i.uid===s.installed[sl]).def.startsWith('mmpatch_')){ s.items=s.items.filter(i=>i.uid!==s.installed[sl]); delete s.installed[sl]; } } while(L.tearLimb(s,'test')); g.recompute();
  const out={ open:L.openSlots(s).length, move:g.build.stats.move, dmg:g.build.stats.dmg, w:g.build.weapon.kind, ab:g.build.abilities.length };
  const x0=g.px; g.inputMove={x:1,y:0}; for(let i=0;i<20;i++) g.update(1/20); g.inputMove={x:0,y:0}; out.moved=Math.abs(g.px-x0); return out; }).catch(e=>({err:String(e)}));
const ns2=await ev(async()=>{ const g=window.__game; const L=await import('/src/limbs.ts'); const s=g.save; for(const e of g.enemies){ e.dead=true; e.hp=0; }
  const m=g.spawnEnemy('worker',g.px+.9,g.py); m.alert=true; const hp0=m.hp; g.target=m; for(let i=0;i<200&&!m.dead;i++){ g.hp=g.maxHp; g.face=Math.atan2(m.y-g.py,m.x-g.px); g.autoAttack?.(m); g.update(1/20); }
  const hurt=m.dead||m.hp<hp0; m.dead=true; m.hp=0; g.enterTown(); s.credits=0; const town=g.mode==='town'; for(const sl of L.lostSlots(s)) L.stockRefit(s,sl); g.recompute();
  return { open:L.openSlots(s).length, town, hurt, filled:L.LIMB_SLOTS.every(sl=>!!s.installed[sl]), canRun:(()=>{ try{ g.startRun(); return g.mode==='run'; }catch(e){ return String(e); } })() }; });
console.log(JSON.stringify(ns),JSON.stringify(ns2));
ok(!ns.err&&ns.open===8&&ns.move>0&&ns.dmg>0&&ns.ab>0,`NEVER STUCK: all 8 limbs gone, still moves (${ns.move?.toFixed?.(2)}), weapon ${ns.w}, ${ns.ab} abilities`);
ok(ns2.hurt,'NEVER STUCK: with no limbs the player still damages a mob');
ok(ns2.town&&ns2.filled&&ns2.open===0&&ns2.canRun===true,'NEVER STUCK: back in town with 0 credits, free stock refit for every limb, can start the next run');
await ev(()=>{ const g=window.__game; if(g.mode==='run') g.enterTown(true); });
const vend=await ev(async()=>{ const g=window.__game; const L=await import('/src/limbs.ts'); const s=g.save; const sl='armR'; const it={uid:'tv',def:'mmpatch_armR',chips:[]}; s.items=s.items.filter(i=>i.uid!==s.installed[sl]); s.items.push({uid:'tz',def:'hi_ripper_arm',chips:[]}); s.installed[sl]='tz'; s.level=12; L.tearLimb(s,'Brakeman Orsolya Kade',()=>0); s.credits=5000; g.recompute(); window.__ui.modal='vendor'; window.__ui.render(); return !!s.installed[sl]; });
await sleep(400); const html=await ev(()=>document.body.innerHTML); ok(/Ripperdoc/.test(html)&&/Reattach \d+c/.test(html)&&/Stock refit/.test(html),'Repair Bay shows the Ripperdoc section with Reattach and Stock refit');
await page.screenshot({path:'shots/limbs/ripperdoc.png'});
ok(!errors.filter(e=>!/favicon|404/.test(e)).length,'no page errors '+errors.slice(0,3).join(' | '));
await browser.close(); process.exit(fails?1:0);
