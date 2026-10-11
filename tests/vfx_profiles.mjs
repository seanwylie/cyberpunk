// Ability VFX/juice pass: every ability (core + augment) has a defined VFX profile that is colour-coded to its button type, every profile spawns a cast + impact
// effect, effects stay inside the particle budget on every quality tier, Reduced FX stays tiny and flash-free, hit reactions scale with ability power,
// and every element has a synth stinger (no audio assets). Run: URL=http://localhost:5173/ node tests/vfx_profiles.mjs
import fs from 'fs'; import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => { const g = window.__game; if (g.mode === 'run') g.enterTown(true); window.__ui.kit('A', true); g.recompute(); g.startRun(); g.dbg.god = true; g.revealing = false; g.save.settings.reducedFx = false; g.save.settings.damageNumbers = true; });
await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 15000 }).catch(() => {}); await sleep(300);
// 1. profile coverage + colour coding
const cov = await ev(async () => { const C = await import('/src/config.ts'); const P = await import('/src/abilities/vfxprofile.ts'); const ids = Object.keys(C.ABILITIES); const bad = []; const sigs = new Set(), elems = new Set(); let heatTyped = 0;
  for (const id of ids) { const p = P.PROFILES[id]; if (!p) { bad.push(id + ':none'); continue; } sigs.add(p.signature); elems.add(p.elem); const bt = C.ABILITIES[id].type; if (!(p.type === bt || (p.type === 'heat' && bt === 'defense') || (p.type === 'heat' && bt === 'attack'))) bad.push(id + ':type ' + p.type + '/' + bt); if (p.type === 'heat') heatTyped++; if (!(p.power > 0 && p.power <= 1 && p.shake > 0 && p.stop > 0 && p.cast && p.hit && P.ELEM_PAL[p.elem])) bad.push(id + ':fields'); }
  return { n: ids.length, bad, sigs: sigs.size, elems: [...elems], heatTyped }; });
ok(cov.n >= 70, `${cov.n} abilities defined`); ok(cov.bad.length === 0, 'every ability has a complete VFX profile, type-coded to its button' + (cov.bad.length ? ': ' + cov.bad.join(',') : ''));
ok(cov.sigs >= 60, `${cov.sigs} distinct signature looks`); ok(cov.elems.length >= 12, `${cov.elems.length} elements used (${cov.elems.join(', ')})`);
// 2. every profile spawns cast + hit effects
const spawn = await ev(async () => { const C = await import('/src/config.ts'); const V = window.__vfx, g = window.__game; const bad = []; V.reduced = false;
  for (const id of Object.keys(C.ABILITIES)) { V.reset(); const s0 = V.stats.spawned[id] || 0; g.vev.length = 0; V.event({ k: id + '.cast', x: g.px, y: g.py, a: 0, r: 3, len: 2, n: 1, x2: g.px + 2, y2: g.py }); const c = (V.stats.spawned[id] || 0) - s0; V.reset(); const s1 = V.stats.spawned[id] || 0; V.event({ k: id + '.hit', x: g.px + 2, y: g.py, a: 0 }); const h = (V.stats.spawned[id] || 0) - s1; if (c <= 0 || h <= 0) bad.push(`${id}:cast${c}/hit${h}`); } V.reset(); return bad; });
ok(spawn.length === 0, 'every ability spawns a cast and an impact effect' + (spawn.length ? ': ' + spawn.slice(0, 8).join(',') : ''));
// 3. budget: all abilities at once, every tier + reduced
const budget = await ev(async () => { const C = await import('/src/config.ts'); const V = window.__vfx, g = window.__game, Q = window.__quality; const out = {};
  for (const [tier, cap] of [['high', 700], ['medium', 260], ['low', 100]]) { Q.setPref(tier); V.reset(); V.stats.peak = 0; V.stats.dropped = 0; for (let round = 0; round < 3; round++) for (const id of Object.keys(C.ABILITIES)) { for (const ph of ['cast', 'hit', 'trail', 'arc', 'deploy', 'buff', 'pulse']) V.event({ k: id + '.' + ph, x: g.px + Math.random() * 3, y: g.py + Math.random() * 3, a: 0, r: 3, len: 2, n: round % 3, x2: g.px + 2, y2: g.py + 1 }); } out[tier] = { peak: V.stats.peak, live: V.live, cap, accent: !!V.accent }; }
  Q.setPref('high'); g.save.settings.reducedFx = true; V.reduced = true; V.reset(); V.stats.peak = 0; V.accent = null; for (const id of Object.keys(C.ABILITIES)) for (const ph of ['cast', 'hit', 'buff']) V.event({ k: id + '.' + ph, x: g.px, y: g.py, a: 0, r: 3, n: 1, x2: g.px + 2, y2: g.py }); out.reduced = { peak: V.stats.peak, accent: !!V.accent, flashes: V.stats.flashes }; g.save.settings.reducedFx = false; V.reduced = false; V.reset(); return out; });
for (const t of ['high', 'medium', 'low']) ok(budget[t].peak <= budget[t].cap && budget[t].live <= budget[t].cap, `${t}: peak ${budget[t].peak} <= cap ${budget[t].cap} with all abilities firing`);
ok(budget.reduced.peak <= 36 && !budget.reduced.accent, `reduced FX: peak ${budget.reduced.peak} <= 36, no screen accent`);
// 4. frame cost under heavy load (all abilities overlapping) stays reasonable, and idle cost is unchanged by the pass (nothing live = no work)
const perf = await ev(async () => { const C = await import('/src/config.ts'); const V = window.__vfx, g = window.__game; V.reset(); const t0 = performance.now(); for (let i = 0; i < 200; i++) V.update(.016); const idle = (performance.now() - t0) / 200;
  const frames = n => new Promise(res => { const d = []; let last = performance.now(); const f = now => { d.push(now - last); last = now; if (d.length < n) requestAnimationFrame(f); else res(d); }; requestAnimationFrame(f); });
  const stat = d => { d = d.slice(3).sort((a, b) => a - b); return { avg: d.reduce((a, b) => a + b, 0) / d.length, p95: d[Math.floor(d.length * .95)] }; };
  const base = stat(await frames(60)); const ids = Object.keys(C.ABILITIES); let k = 0; const fire = () => { for (let i = 0; i < 5; i++) { const id = ids[k++ % ids.length]; V.event({ k: id + '.cast', x: g.px, y: g.py, a: 0, r: 3, n: 2 }); V.event({ k: id + '.hit', x: g.px + 2, y: g.py, a: 0 }); } };
  const iv = setInterval(fire, 100); const load = stat(await frames(90)); clearInterval(iv); const peak = V.stats.peak; V.reset(); return { idle, base, load, peak }; });
ok(perf.idle < .05, `idle VFX update costs ${perf.idle.toFixed(4)} ms per frame (nothing live = no work)`);
ok(perf.load.avg < Math.max(perf.base.avg * 2.2, 45) && perf.load.p95 < Math.max(perf.base.p95 * 2.5, 80), `frame time under heavy ability spam (peak ${perf.peak} particles): avg ${perf.load.avg.toFixed(1)} ms vs ${perf.base.avg.toFixed(1)} ms baseline, p95 ${perf.load.p95.toFixed(1)} ms`);
// 5. hit reactions scale with ability power: bigger number, longer flash, shake/hit-stop for rare abilities, none under Reduced FX
const hit = await ev(async () => { const g = window.__game; g.dbg.noHitStop = false; const mk = () => { g.enemies.forEach(e => { e.dead = true; }); g.enemies = []; g.inst.enemies = []; const e = g.spawnEnemy('worker', g.px + 2, g.py); e.hp = e.maxHp = 90000; e.alert = true; e.speedMul = 0; e._rt.reveal = 0; return e; };
  const run = (tag, red) => { g.save.settings.reducedFx = red; const e = mk(); g.fx.length = 0; g.kick = 0; g.hitStop = 0; g.lastStop = -9; g.curTag = tag; g.hurtEnemy(e, 300, g.px, g.py, 0); g.curTag = 'auto'; const t = g.fx.find(f => f.kind === 'text'); return { s: t?.s || 1, pop: t?.pop || 0, hit: e._rt.hit, kick: g.kick, stop: g.hitStop, rc: e._rt.rcM || 0 }; };
  const low = run('piston_jab', false), high = run('orbital_strike', false), red = run('orbital_strike', true); g.save.settings.reducedFx = false; g.dbg.noHitStop = true; return { low, high, red }; });
ok(hit.high.s > hit.low.s, `damage number scales with ability power (${hit.low.s.toFixed(2)} -> ${hit.high.s.toFixed(2)})`); ok(hit.high.pop === 1, 'epic ability hits crit-pop the number');
ok(hit.high.hit > hit.low.hit && hit.high.kick > hit.low.kick && hit.high.stop >= hit.low.stop && hit.high.stop > 0, `flash ${hit.low.hit.toFixed(2)}->${hit.high.hit.toFixed(2)}, shake ${hit.low.kick.toFixed(2)}->${hit.high.kick.toFixed(2)}, hit-stop ${hit.low.stop}->${hit.high.stop}`);
ok(hit.high.rc > hit.low.rc, 'enemy recoil is larger for rare abilities'); ok(hit.red.kick === 0 && hit.red.stop === 0 && hit.red.rc === 0 && hit.red.pop === 0, 'Reduced FX: no shake, hit-stop, recoil or number pop');
// 6. audio: each element has cast + hit stingers synthesised in audio.ts (no asset files), flash guard still limits accents
const src = fs.readFileSync(new URL('../src/audio.ts', import.meta.url), 'utf8'); const elems = cov.elems;
ok(elems.every(e => src.includes(`'abc_${e}'`) && src.includes(`'abh_${e}'`)), 'every element has a synth cast + hit stinger'); ok(src.includes("'abx_big'"), 'rare/epic casts add a low swell');
const fg = await ev(() => { const V = window.__vfx; V.reset(); V.accent = null; V.event({ k: 'orbital_strike.cast', x: 0, y: 0, a: 0, r: 3, n: 2 }); const a = V.accent ? { a: V.accent.a } : null; return a; });
ok(!fg || fg.a <= .2, `screen accent alpha capped (${fg ? fg.a.toFixed(2) : 'skipped by flash guard'} <= .2)`);
ok(errors.filter(e => !/429/.test(e)).length === 0, 'no page errors ' + errors.filter(e => !/429/.test(e)).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
