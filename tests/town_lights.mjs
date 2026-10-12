// Town lighting pulses smoothly: slow sinusoid (period 2.5-5.2 s), amplitude <= 20 %, per-light phase, no frame-to-frame jumps, static under Reduced FX.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 }, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
// 1. the pulse function itself
const pure = await ev(() => { const f = window.__lightPulse; let maxStep = 0, lo = 9, hi = 0; const phases = new Set(); const pers = [];
  for (let seed = 0; seed < 300; seed++) { let prev = f(0, seed, false, .18), cross = [], pv = prev; phases.add(prev.toFixed(3)); for (let k = 1; k <= 60 * 24; k++) { const T = k / 60, v = f(T, seed, false, .18); maxStep = Math.max(maxStep, Math.abs(v - pv)); lo = Math.min(lo, v); hi = Math.max(hi, v); if ((pv - 1) * (v - 1) < 0 && v > pv) cross.push(T); pv = v; } if (cross.length > 2) pers.push((cross[cross.length - 1] - cross[0]) / (cross.length - 1)); }
  return { maxStep, lo, hi, distinct: phases.size, pmin: Math.min(...pers), pmax: Math.max(...pers), still: f(3.3, 5, true, .18), over: f(1, 1, false, 5) }; });
ok(pure.maxStep < .01, `pulse max frame-to-frame step at 60 fps = ${pure.maxStep.toFixed(4)} (< 0.01)`);
ok(pure.lo >= .8 - 1e-6 && pure.hi <= 1.2 + 1e-6, `pulse amplitude within +-20 % (${pure.lo.toFixed(3)}..${pure.hi.toFixed(3)}), amp request 5 is capped (${pure.over.toFixed(3)})`);
ok(pure.pmin >= 2.5 && pure.pmax <= 5.2, `pulse period within 2.5-5.2 s (${pure.pmin.toFixed(2)}..${pure.pmax.toFixed(2)})`);
ok(pure.distinct > 150, `per-light phase offsets differ (${pure.distinct} distinct start values of 300)`);
ok(pure.still === 1, 'Reduced FX pulse is static');
// 2. real rendered frames: alpha of every additive glow draw, per draw index, stationary player
for (const town of ['rustline', 'harrow']) for (const reduced of [false, true]) {
  await ev(async ([town, reduced]) => { const g = window.__game; g.save.level = 30; (g.save.cleared = { ...(g.save.cleared || {}), gw_bell_foundry: 1 }, g.checkTownUnlocks()); if (g.townId !== town) g.travel(town); window.__ui.open(null); g.save.settings.reducedFx = reduced; }, [town, reduced]);
  await page.waitForFunction(t => window.__rend.town?.ready && window.__game.townId === t, town, { timeout: 30000 }); await sleep(1200);
  await ev(() => { window.__lg = { frames: [], cur: null }; const P = CanvasRenderingContext2D.prototype, od = P.drawImage; const L = window.__lg;
    P.drawImage = function (...a) { if (this.canvas.id === 'game' && this.globalCompositeOperation === 'lighter' && L.cur) L.cur.push(this.globalAlpha); return od.apply(this, a); };
    const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => raf(t => { if (L.cur) L.frames.push({ t: window.__game.time, a: L.cur }); L.cur = []; cb(t); }); P.__od = od; });
  await sleep(15500);
  const r = await ev(() => { const F = window.__lg.frames.filter(f => f.a.length); const n = Math.min(...F.map(f => f.a.length)); let maxRate = 0, varying = 0, maxRel = 0; const pers = [];
    for (let i = 0; i < n; i++) { const s = F.map(f => f.a[i]), t = F.map(f => f.t); const mean = s.reduce((x, y) => x + y, 0) / s.length; if (Math.max(...s) - Math.min(...s) > 1e-4) varying++; maxRel = Math.max(maxRel, (Math.max(...s) - Math.min(...s)) / Math.max(1e-6, mean));
      for (let k = 1; k < s.length; k++) { const dt = t[k] - t[k - 1]; if (dt > 0) maxRate = Math.max(maxRate, Math.abs(s[k] - s[k - 1]) / Math.max(1e-6, mean) / dt); }
      const cr = []; for (let k = 1; k < s.length; k++) if ((s[k - 1] - mean) < 0 && (s[k] - mean) >= 0) cr.push(t[k]); if (cr.length >= 3) pers.push((cr[cr.length - 1] - cr[0]) / (cr.length - 1)); }
    return { frames: F.length, draws: n, varying, maxRate, maxRel, pmin: pers.length ? Math.min(...pers) : null, pmax: pers.length ? Math.max(...pers) : null, np: pers.length }; });
  const tag = `${town}${reduced ? ' (Reduced FX)' : ''}`;
  ok(r.frames > 20 && r.draws > 3, `${tag}: sampled ${r.frames} frames, ${r.draws} additive glow draws`);
  if (reduced) ok(r.varying === 0, `${tag}: glows static under Reduced FX (${r.varying} varying)`);
  else { ok(r.varying > 0, `${tag}: ${r.varying} glow draws pulse`); ok(r.maxRate <= .7, `${tag}: max relative intensity change ${r.maxRate.toFixed(2)} /s (<= 0.7, no abrupt jumps)`); ok(r.maxRel <= .5, `${tag}: peak-to-peak <= 50 % of mean (${(r.maxRel * 100).toFixed(0)} %; incl. distance fades)`); if (r.np) ok(r.pmin >= 2.4 && r.pmax <= 5.5, `${tag}: measured periods ${r.pmin.toFixed(2)}-${r.pmax.toFixed(2)} s over ${r.np} lights`); }
  await ev(() => { CanvasRenderingContext2D.prototype.drawImage = CanvasRenderingContext2D.prototype.__od; });
}

// 3. source audit: no per-frame random alpha and no fast (period < 2.5 s) time-driven sin in the town render paths
{ const fs = await import('fs'); const src = fs.readFileSync('src/render.ts', 'utf8').split('\n'); const A = src.findIndex(l => /private drawTownGround\(\)/.test(l)), B = src.findIndex(l => /private townOverlay\(\)/.test(l)); const seg = src.slice(A, B).join('\n'); const tw = fs.readFileSync('src/town.ts', 'utf8');
  const bad = []; for (const m of seg.matchAll(/Math\.sin\(\s*(?:T|g\.time)\s*\*\s*([0-9.]+)/g)) { const k = +m[1]; if (k > 2.5 && !/s\.moving\?Math\.sin\(T\*5\)|Math\.abs\(Math\.sin\(T\*5\)\)/.test(seg.slice(m.index - 40, m.index + 60))) bad.push(m[0]); }
  ok(bad.length === 0, `town render paths: no time-driven sin with period < 2.5 s (walk cycle excepted)${bad.length ? ': ' + bad.join(', ') : ''}`);
  ok(!/Math\.random/.test(seg), 'town render paths: no Math.random');
  const lens = [...tw.matchAll(/k: 'ember'[^}]*|life: ([0-9.]+)[^}]*k: 'ember'/g)].map(m => m[0]); const short = [...tw.matchAll(/life: ([.0-9]+)(?: \+ R\(\) \* ([.0-9]+))?, k: 'ember'/g)].filter(m => +m[1] < 1.4); ok(short.length === 0, `ember particles live >= 1.4 s with smooth fade (no blinking sparks) (${short.length} short)`); }
// 4. whole-frame luminance in each town: no abrupt steps from any animated source
const luma = async () => { const { PNG } = await import('pngjs'); const p = PNG.sync.read(await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 640, height: 360 } })); let sum = 0; for (let i = 0; i < p.data.length; i += 4) sum += .2126 * p.data[i] + .7152 * p.data[i + 1] + .0722 * p.data[i + 2]; return sum / (p.data.length / 4); };
for (const town of ['rustline', 'harrow']) {
  await ev(async town => { const g = window.__game; g.save.level = 30; (g.save.cleared = { ...(g.save.cleared || {}), gw_bell_foundry: 1 }, g.checkTownUnlocks()); if (g.townId !== town) g.travel(town); window.__ui.open(null); g.save.settings.reducedFx = false; }, town);
  await page.waitForFunction(t => window.__rend.town?.ready && window.__game.townId === t, town, { timeout: 30000 }); await sleep(1200);
  const xs = [], t0 = Date.now(); while (Date.now() - t0 < 9000) { xs.push(await luma()); } let step = 0; for (let i = 1; i < xs.length; i++) step = Math.max(step, Math.abs(xs[i] - xs[i - 1]));
  ok(step < 1.5, `${town}: whole-frame mean luma max step ${step.toFixed(2)} over ${xs.length} frames (< 1.5, range ${(Math.max(...xs) - Math.min(...xs)).toFixed(2)})`); }
ok(errors.length === 0, 'no page errors ' + (errors[0] || '')); await browser.close();
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
