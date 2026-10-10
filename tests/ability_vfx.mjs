// Ability VFX: every ability spawns its effect (cast + impact), particle caps hold per quality tier, Reduced FX / flash guard hold,
// and (with SHOTS=dir) writes per-ability frame strips for the before/after contact sheets.
import fs from 'fs'; import { PNG } from 'pngjs'; import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const SHOTS = process.env.SHOTS || '';
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a);
await ev(async () => { window.__abdefs = (await import('/src/config.ts')).ABILITIES; const g = window.__game; if (g.mode === 'run') g.enterTown(true); window.__ui.kit('A', true); g.recompute(); g.startRun(); g.dbg.god = true; g.revealing = false; g.save.settings.reducedFx = false; g.save.settings.damageNumbers = true; });
await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 15000 }).catch(() => {});
await sleep(300);
const IDS = ['sweep', 'bladeburst', 'pulse', 'control', 'brace', 'reposition', 'cloak', 'forcedcool', 'revive'];
const hasVfx = await ev(() => !!window.__vfx);
const setup = () => ev(() => { const g = window.__game; g.revealing = false; g.enemies.forEach(e => { e.dead = true; }); g.enemies = []; g.inst.enemies = []; g.px = g.level.spawn.x; g.py = g.level.spawn.y; g.heat = 0; g.abCd = [0, 0, 0]; g.cast = null; g.aim = null; g.braceT = 0; g.cloakT = 0; g.face = 0; g.dbg.noHitStop = true;
  const mk = (dx, dy, t = 'worker') => { const e = g.spawnEnemy(t, g.px + dx, g.py + dy); e.hp = e.maxHp = 9000; e.alert = true; e.speedMul = 0; e._rt.reveal = 0; return e; };
  mk(1.6, 0); mk(2.4, .6); mk(3.2, -.5); mk(4.4, 0); return true; });
const cast = id => ev(id => { const g = window.__game; g.build.abilities = [id, 'brace', 'sweep']; g.abCd = [0, 0, 0]; g.heat = 0; const t = g.enemies[3]; g.beginAim(0); if (id === 'reposition') { for (let a = 0; a < 12; a++) { g.updateAim(g.px + Math.cos(a * .52) * 4, g.py + Math.sin(a * .52) * 4, true); if (g.validateAim(window.__abdefs.reposition, g.aim).valid) break; } } else g.updateAim(t.x, t.y, true); g.releaseAim(); return true; }, id);
const stats = () => ev(() => window.__vfx ? JSON.parse(JSON.stringify(window.__vfx.stats)) : { spawned: {}, events: {}, flashes: 0 });
const crop = async (name) => { if (!SHOTS) return null; const b = await ev(() => { const r = window.__rend; const g = window.__game; return { x: r.w / 2 - r.camx + (g.px - g.py) * r.TW / 2, y: r.h / 2 - r.camy + (g.px + g.py) * r.TW / 4 }; }); const clip = { x: Math.max(0, Math.round(b.x - 200)), y: Math.max(0, Math.round(b.y - 190)), width: 400, height: 300 }; return PNG.sync.read(await page.screenshot({ clip })); };
for (const id of IDS) {
  await setup(); const s0 = await stats(); const frames = [];
  if (SHOTS) frames.push(await crop(id));
  await cast(id);
  for (const ms of [90, 150, 220]) { await sleep(ms); if (SHOTS) frames.push(await crop(id)); }
  await sleep(300); const s1 = await stats();
  const evs = Object.keys(s1.events).filter(k => k.startsWith(id + '.')); const n = (s1.spawned[id] || 0) - (s0.spawned[id] || 0);
  if (hasVfx) { ok(n > 0, `${id}: effect spawned ${n} particles (${evs.join(', ')})`); ok(evs.some(k => /cast|fire/.test(k)), `${id}: has a cast event`); }
  else ok(true, `${id}: no vfx module on this build (baseline run)`);
  if (SHOTS) { const W = frames.length * 400, out = new PNG({ width: W, height: 300 }); frames.forEach((f, i) => PNG.bitblt(f, out, 0, 0, 400, 300, i * 400, 0)); fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(`${SHOTS}/${id}.png`, PNG.sync.write(out)); }
}
if (hasVfx) {
  // impact events: sweep/bladeburst/pulse hit real enemies and emit *.hit; pulse on a shielded enemy shatters
  await setup(); await ev(() => { const g = window.__game; g.enemies[0]._rt.shield = { hp: 40, max: 40, t: 99 }; }); const s0 = await stats();
  await ev(() => { const g = window.__game; g.build.abilities = ['pulse', 'sweep', 'bladeburst']; g.abCd = [0, 0, 0]; const e = g.enemies[0]; g.beginAim(0); g.updateAim(e.x, e.y, true); g.releaseAim(); }); await sleep(700);
  const s1 = await stats(); ok((s1.events['pulse.shatter'] || 0) > (s0.events['pulse.shatter'] || 0), 'pulse: shield-shatter shards on a shielded enemy'); ok((s1.events['pulse.hit'] || 0) > (s0.events['pulse.hit'] || 0), 'pulse: impact event on hit enemies');
  await ev(() => { const g = window.__game; g.abCd = [0, 0, 0]; g.px = g.level.spawn.x; g.py = g.level.spawn.y; g.beginAim(1); g.updateAim(g.px + 3, g.py, true); g.releaseAim(); }); await sleep(500);
  ok(((await stats()).events['sweep.hit'] || 0) > 0, 'sweep: impact sparks/debris on hit');
  // status indicators: stun / hacked / controlled / staggered flags exist on affected enemies
  await setup(); await ev(() => { const g = window.__game; g.build.abilities = ['control', 'pulse', 'sweep']; g.abCd = [0, 0, 0]; const e = g.enemies[0]; g.beginAim(0); g.updateAim(e.x, e.y, true); g.releaseAim(); }); await sleep(600);
  const st = await ev(() => { const g = window.__game; return g.enemies.map(e => ({ stun: e.stunT > 0, hack: e._rt.hack > 0, ally: e.faction === 'ally' })); });
  ok(st.some(x => x.ally) && st.some(x => x.stun && x.hack), 'control: controlled enemy + stunned/hacked neighbours (status indicators)');
  // caps per tier
  for (const [tier, cap] of [['high', 700], ['medium', 260], ['low', 100]]) { await ev(t => { window.__quality.setPref(t); window.__vfx.reset(); const g = window.__game; for (let i = 0; i < 300; i++) g.vfx(['sweep.cast', 'pulse.shatter', 'forcedcool.cast', 'reposition.cast', 'bladeburst.cast'][i % 5], g.px, g.py, { a: i, r: 3, len: 4, x2: g.px, y2: g.py }); }, tier); await sleep(120); const live = await ev(() => window.__vfx.live); ok(live > 0 && live <= cap, `cap ${tier}: ${live} live <= ${cap}`); }
  await ev(() => window.__quality.setPref('high'));
  // flash guard: rapid blooms never exceed 3 per second; Reduced FX has none at all
  await ev(() => { window.__vfx.reset(); window.__vfx.reduced = false; });
  const fl0 = (await stats()).flashes; await ev(() => { const g = window.__game; for (let i = 0; i < 40; i++) g.vfx('cloak.ambush', g.px, g.py, { a: i }); }); await sleep(60); const fl = (await stats()).flashes - fl0; await sleep(1100);
  ok(fl <= 3, `flash guard: ${fl} local blooms from 40 rapid events (flashAllowed limits to 3/s)`);
  await ev(() => { window.__game.save.settings.reducedFx = true; window.__vfx.reset(); }); await sleep(80); const f0 = (await stats()).flashes;
  await ev(() => { const g = window.__game; for (let i = 0; i < 60; i++) g.vfx(['cloak.ambush', 'sweep.cast', 'pulse.shatter', 'defib.fire', 'bladeburst.hit'][i % 5], g.px, g.py, { a: i, r: 3, len: 3 }); }); await sleep(120);
  const r1 = await ev(() => ({ s: window.__vfx.stats.flashes, live: window.__vfx.live, add: window.__vfx.pool.filter(p => p.on && p.add && p.k === 'glow').length })); ok(r1.s === f0 && r1.add === 0, `Reduced FX: no blooms/flashes (flashes ${r1.s - f0}, additive glows ${r1.add})`); ok(r1.live <= 36, `Reduced FX: particle cap ${r1.live} <= 36`);
  await ev(() => { window.__game.save.settings.reducedFx = false; });
  // defib passive: arc + glow
  await setup(); const d0 = await stats(); await ev(() => { const g = window.__game; g.dbg.god = false; g.defibCd = 0; g.inst.protectedSlots = Object.keys(g.save.installed); g.iframes = 0; g.hp = 1; g.hurtPlayer(50, g.px + 1, g.py); g.build.passives = ['defib']; g.defibInPlace(); window.__dd = [g.downed, g.build.passives.slice()]; g.dbg.god = true; }); await sleep(200);
  ok(((await stats()).spawned.defib || 0) > (d0.spawned.defib || 0), 'defib: electric arc + revive glow on self-defib');
}
ok(errors.length === 0, 'no console errors ' + errors.join(';'));
await browser.close(); if (fails) { console.log(fails + ' FAILED'); process.exit(1); } console.log('ability vfx ok');
