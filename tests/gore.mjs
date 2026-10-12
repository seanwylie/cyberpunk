// Blood & gore (docs/GORE.md): default Off, Mild / Bloody effects per body type (organic bleeds, robots spark/leak coolant, hybrids both, spectral nothing), caps per quality tier,
// Reduced FX, hidden in town, cleared on leave, fade-out, no gore on allies/NPCs, boss limb severing, settings persistence. Snapshots in shots/gore/.
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a); fs.mkdirSync('shots/gore', { recursive: true });
await sleep(1500);
await ev(() => { const g = window.__game; g.save.level = 34; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun('annex'); g.inst.flags.bossSpawned = true; g.enemies.splice(0); }); await sleep(800);
ok(await ev(() => window.__game.save.settings.gore === 'off'), 'default Blood & gore setting is Off');
const mk = (id, dx = 2, dy = 1) => ev(([id, dx, dy]) => { const g = window.__game; const e = g.spawnEnemy(id, g.px + dx, g.py + dy); e._rt.reveal = 0; window.__e = e; return !!e; }, [id, dx, dy]);
const kill = (dmg = 1e7, tag = 'pulse') => ev(([dmg, tag]) => { const g = window.__game; g.curTag = tag; g.hurtEnemy(window.__e, dmg, g.px, g.py, 0); g.curTag = 'auto'; return window.__gore.counts(); }, [dmg, tag]);
const set = m => ev(m => { window.__game.save.settings.gore = m; window.__game.enemies.splice(0); window.__gore.reset(); }, m);
const cnt = () => ev(() => window.__gore.counts());
// --- Off
await set('off'); await mk('worker'); let c = await kill(); ok(c.decals + c.chunks + c.drops === 0, 'Off: no gore at all ' + JSON.stringify(c));
// --- fluids per body
const F = await ev(async () => { const G = await import('/src/gore.ts'); const k = id => G.fluidsOf(id).map(f => f.kind).join('+'); return { worker: k('worker'), hound: k('cinderhound'), recovered: k('recovered'), ghost: k('hollowghost'), glitch: k('glitchshard'), sac: k('soothsac'), fung: k('rootcluster'), doll: k('fittingdoll'), jelly: k('drapejelly'), bodies: ['worker', 'cinderhound', 'recovered', 'hollowghost'].map(G.bodyOf).join() }; });
ok(F.worker.startsWith('coolant') && F.hound === 'blood' && F.recovered === 'blood+coolant' && F.ghost === '' && F.glitch === '' && F.sac === 'ichor' && F.fung === 'sap' && F.doll.startsWith('oil') && F.jelly === 'ichor', 'distinct fluids per body: ' + JSON.stringify(F));
// --- Mild
await set('mild'); await mk('cinderhound'); c = await kill(5, 'auto'); await mk('cinderhound', 2.5, 1); c = await kill(); ok(c.decals >= 1 && c.chunks === 0, 'Mild: pool + droplets, no gibs ' + JSON.stringify(c)); await sleep(500);
await page.screenshot({ path: 'shots/gore/mild.png' });
// --- Bloody: organic heavy kill = decals + gibs + dismemberment
await set('bloody'); await mk('cinderhound'); await kill(2, 'auto'); c = await kill(); ok(c.decals >= 2 && c.chunks >= 3 && c.drops >= 6, 'Bloody organic heavy kill: splatter + gibs + limbs ' + JSON.stringify(c));
await mk('worker', -2, 1); const c2 = await kill(); ok(c2.chunks > c.chunks, 'Bloody robot kill: plates/limbs too ' + JSON.stringify(c2)); await sleep(350);
await page.screenshot({ path: 'shots/gore/bloody_air.png' }); await sleep(2200); await page.screenshot({ path: 'shots/gore/bloody_settled.png' });
// --- spectral = nothing
await set('bloody'); await mk(await ev(() => (window.__enemies.hollowghost ? 'hollowghost' : 'sootwisp')) /* bestiary mobs are data-only until registered; sootwisp is the registered spectral body */); c = await kill(); ok(c.decals + c.chunks + c.drops === 0, 'Bloody: spectral/hologram entities show no gore ' + JSON.stringify(c));
// --- allies never gibbed
await set('bloody'); await ev(() => { const g = window.__game; const e = g.spawnEnemy('worker', g.px + 2, g.py); e.faction = 'ally'; window.__e = e; }); c = await kill(); ok(c.decals + c.chunks + c.drops === 0, 'allies / non-enemies are never dismembered');
// --- boss limb severing at 75/50/25
await set('bloody'); await ev(() => { const g = window.__game; g.enemies.splice(0); const b = g.spawnEnemy('overseer', g.px + 3, g.py + 1); b._rt.reveal = 0; window.__e = b; window.__mx = b.maxHp; });
const hb = async f => ev(([f]) => { const g = window.__game, b = window.__e; g.curTag = 'pulse'; g.hurtEnemy(b, Math.max(1, b.hp - b.maxHp * f), g.px, g.py, 0); g.curTag = 'auto'; return window.__gore.chunks.filter(k => k.big).length; }, [f]);
const s1 = await hb(.7), s2 = await hb(.45), s3 = await hb(.2); ok(s1 >= 2 && s2 >= 4 && s3 >= 6, `boss limb severing at 75/50/25% (big chunks ${s1}/${s2}/${s3})`);
await sleep(300); await page.screenshot({ path: 'shots/gore/boss_limb.png' });
// --- caps
await set('bloody'); await ev(() => { const g = window.__game; g.enemies.splice(0); for (let i = 0; i < 120; i++) { const e = g.spawnEnemy('worker', g.px + 2 + (i % 7) * .4, g.py + 1 + (i % 5) * .4); e._rt.reveal = 0; g.curTag = 'pulse'; g.hurtEnemy(e, 1e7, g.px, g.py, 0); g.curTag = 'auto'; } });
const cap = await ev(async () => { const G = await import('/src/gore.ts'), Qm = await import('/src/quality.ts'); const k = G.CAPS[Qm.Q.tier]; const c = window.__gore.counts(); return { c, k, tier: Qm.Q.tier }; });
ok(cap.c.decals <= cap.k.decals && cap.c.chunks <= cap.k.chunks && cap.c.drops <= cap.k.drops && cap.c.decals > 0, `caps respected on tier ${cap.tier}: ${JSON.stringify(cap.c)} <= ${JSON.stringify(cap.k)}`);
const capLow = await ev(async () => { const G = await import('/src/gore.ts'); return G.CAPS.low.decals < G.CAPS.medium.decals && G.CAPS.medium.decals < G.CAPS.high.decals && G.CAPS.low.chunks < G.CAPS.high.chunks; }); ok(capLow, 'caps shrink on medium/low tiers');
// --- Reduced FX: no airborne particles / spray
await set('bloody'); await ev(() => { window.__game.save.settings.reducedFx = true; window.__game.enemies.splice(0); }); await mk('cinderhound'); c = await kill(); const ed = await ev(() => window.__gore.edge);
ok(c.drops === 0 && ed === null && c.decals >= 1, 'Reduced FX: no airborne gore, no screen spray, floor stains only ' + JSON.stringify(c)); await ev(() => { window.__game.save.settings.reducedFx = false; });
// --- fade: decals expire on their own
await set('bloody'); await mk('cinderhound'); await kill(); await ev(() => { for (const d of window.__gore.decals) d.t0 -= 200; for (const k of window.__gore.chunks) k.t0 -= 200; }); await sleep(1800); c = await cnt(); ok(c.decals === 0 && c.chunks === 0, 'decals and chunks fade away over time ' + JSON.stringify(c));
// --- hidden in town + cleared on leave
await set('bloody'); await mk('cinderhound'); await kill(); c = await cnt(); ok(c.decals > 0, 'gore present in the run');
await ev(() => { window.__game.enterTown(); }); await sleep(400); c = await cnt(); ok(c.decals + c.chunks + c.drops === 0, 'cleared when leaving to town ' + JSON.stringify(c));
const tw = await ev(() => { const g = window.__game; const fake = { x: g.px, y: g.py, hp: 0, maxHp: 10, type: 'worker', faction: 'enemy' }; window.__gore.kill(g, fake); window.__gore.hit(g, fake, 5, true, 0, 0); return window.__gore.counts(); }); ok(tw.decals + tw.chunks + tw.drops === 0, 'town: nothing is ever spawned');
// --- re-entering an instance starts clean
await ev(() => { const g = window.__game; g.save.instance = null; g.inst = null; g.startRun('annex'); g.inst.flags.bossSpawned = true; }); await sleep(500); c = await cnt(); ok(c.decals + c.chunks + c.drops === 0, 'new instance starts clean');
// --- persistence
await ev(() => { window.__game.save.settings.gore = 'mild'; window.__persist?.(); }); 
ok(errors.length === 0, 'no page errors ' + errors.join('|')); await browser.close(); process.exit(fail ? 1 : 0);
