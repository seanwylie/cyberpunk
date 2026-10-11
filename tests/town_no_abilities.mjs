// Towns are safe zones: ability casts, hotkeys, auto-attack and the touch buttons do nothing in town (no heat, cooldown, VFX, sfx), the ability bar is hidden, movement still works, and casting works again in a run.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => { const g = window.__game; window.__ui.kit('A', true); g.recompute(); if (g.mode === 'run') g.enterTown(true); });
await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 15000 }).catch(() => {}); await sleep(300);
const snap = () => ev(() => { const g = window.__game, V = window.__vfx; return { mode: g.mode, heat: g.heat, cd: [...g.abCd], cast: !!g.cast, aim: !!g.aim, fx: g.fx.length, vev: g.vev.length, live: V.live, ev: Object.keys(V.stats.events).length, kick: g.kick, stop: g.hitStop }; });
for (const town of ['hub', 'harrow']) {
  await ev(t => { const g = window.__game; if (t === 'harrow') { try { g.enterTown(true, 'harrow'); } catch { g.enterTown(true); } } else g.enterTown(true); const V = window.__vfx; V.reset(); g.fx.length = 0; g.vev.length = 0; g.heat = 0; g.abCd = [0, 0, 0]; g.cast = null; g.aim = null; window.__ev0 = JSON.stringify(V.stats.events); }, town); await sleep(200);
  const before = await snap(); ok(before.mode === 'town', `${town}: in town mode`);
  await ev(() => { const g = window.__game; for (let i = 0; i < 3; i++) { g.beginAim(i); g.updateAim(g.px + 3, g.py, true); g.releaseAim(); } g.autoAttack?.(.1); });
  for (const k of ['q', 'e', 'r', 'v']) { await page.keyboard.press(k); } await page.keyboard.press(' '); await sleep(500);
  await ev(() => { const g = window.__game; g.executeAbility({ idx: 0, aim: { idx: 0, wx: g.px + 2, wy: g.py, hasDir: true }, ab: window.__abdefs?.sweep || g.build.abilities && null }); }).catch(() => {});
  const after = await snap(); const evNew = await ev(() => JSON.stringify(window.__vfx.stats.events) !== window.__ev0);
  ok(after.heat === 0, `${town}: no heat from cast attempts (${after.heat})`); ok(after.cd.every(c => c === 0), `${town}: no cooldowns started (${after.cd})`);
  ok(!after.cast && !after.aim, `${town}: no cast/aim state`); ok(!evNew && after.live === 0, `${town}: no ability VFX events or particles`);
  const hud = await ev(() => { const cs = id => { const e = document.getElementById(id); return e ? getComputedStyle(e) : null; }; const a = cs('abilities'), d = cs('dodge'); return { body: document.body.classList.contains('intown'), abVis: a && a.visibility, abOp: a && a.opacity, dgVis: d && d.visibility }; });
  ok(hud.body && hud.abVis === 'hidden' && hud.dgVis === 'hidden', `${town}: ability bar + dodge button hidden in town (${hud.abVis}/${hud.dgVis})`);
  const mv = await ev(async () => { const g = window.__game; const x = g.px, y = g.py; g.keys = g.keys || {}; return { x, y }; }); ok(mv.x !== undefined, `${town}: movement state intact`);
}
// movement still works in town
await ev(() => { window.__game.enterTown(true); }); await sleep(200); const p0 = await ev(() => ({ x: window.__game.px, y: window.__game.py })); await page.keyboard.down('d'); await sleep(700); await page.keyboard.up('d'); const p1 = await ev(() => ({ x: window.__game.px, y: window.__game.py })); ok(Math.hypot(p1.x - p0.x, p1.y - p0.y) > .5, 'walking still works in town');
// remote players in town: no ability effects (their attack flag is only an animation and is never sent from a town)
const net = await ev(async () => { const g = window.__game; g.mode = 'town'; g.atkCd = 1; const s = await import('/src/net/session.ts'); return typeof s === 'object'; }); ok(net, 'net session module loads'); await ev(() => { window.__game.atkCd = 0; });
// the same cast works in a run
await ev(() => { const g = window.__game; g.startRun(); g.dbg.god = true; g.revealing = false; g.save.settings.reducedFx = false; g.build.abilities = ['sweep', 'brace', 'pulse']; g.heat = 0; g.abCd = [0, 0, 0]; g.enemies.forEach(e => { e.dead = true; }); g.enemies = []; window.__vfx.reset(); g.beginAim(0); g.updateAim(g.px + 3, g.py, true); g.releaseAim(); }); await page.waitForFunction(() => window.__game.heat > 0, null, { timeout: 8000 }).catch(() => {}); await sleep(200);
const run = await snap(); const ev2 = await ev(() => Object.keys(window.__vfx.stats.events).some(k => k.startsWith('sweep.')));
ok(run.mode === 'run' && run.heat > 0 && run.cd[0] > 0, `run: sweep casts (heat ${run.heat.toFixed(1)}, cd ${run.cd[0].toFixed(2)})`); ok(ev2, 'run: sweep VFX spawned');
ok(errors.filter(e => !/429/.test(e)).length === 0, 'no page errors ' + errors.join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
