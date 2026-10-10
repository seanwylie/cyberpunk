// Flash / photosensitivity safety: after each triggering event the screen brightness must not oscillate, flashes are rate-limited (<=3/s),
// Reduced FX disables them, the canvas is never resized needlessly, and dynamic resolution has hysteresis.
import { launch, sleep } from './lib.mjs';
import { PNG } from 'pngjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const MAX_FLASHES_PER_SEC = 3, OSC_AMP = 2.5, OSC_REVERSALS = 6; // mean-luma units (0..255); reversals of >=OSC_AMP within the window

const luma = async (page) => { const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 640, height: 360 } }); const p = PNG.sync.read(buf); let s = 0, n = 0; for (let i = 0; i < p.data.length; i += 16) { s += .2126 * p.data[i] + .7152 * p.data[i + 1] + .0722 * p.data[i + 2]; n++; } return s / n; };
/** sample mean luminance for ms; count amplitude-qualified direction reversals (a smooth one-shot fade has <=1) */
async function sample(page, ms) { const xs = []; const t0 = Date.now(); while (Date.now() - t0 < ms) xs.push(await luma(page)); let rev = 0, dir = 0, ext = xs[0], maxSwing = 0;
  for (const v of xs) { if (dir >= 0 && v < ext - OSC_AMP) { if (dir === 1) rev++; dir = -1; ext = v; } else if (dir <= 0 && v > ext + OSC_AMP) { if (dir === -1) rev++; dir = 1; ext = v; } else if ((dir >= 0 && v > ext) || (dir <= 0 && v < ext)) ext = v; }
  return { rev, range: Math.max(...xs) - Math.min(...xs), n: xs.length }; }

const { browser, page, errors } = await launch({ viewport: { width: 640, height: 360 }, query: '?splash=hold', tutorial: true });
await page.evaluate(() => { document.getElementById('splash')?.remove(); document.getElementById('rotate')?.remove(); });
await page.evaluate(() => { const g = window.__game; g.save.settings.reducedFx = false; g.save.lockouts = {}; g.save.lastClearDay = null; g.startRun(Object.keys(window.__dungeons || {})[0] || undefined); });
await sleep(1500);
const inRun = await page.evaluate(() => window.__game.mode === 'run'); ok(inRun, 'in a run');

// 1. static: no infinite animation may pulse a large layer (the old tutorial dim backdrop pulsed the whole screen)
ok(await page.evaluate(() => !!document.getElementById('tutspot')), 'tutorial spotlight element exists');
await page.evaluate(() => { const s = document.getElementById('tutspot'); if (s) { Object.assign(s.style, { display: 'block', left: '200px', top: '150px', width: '120px', height: '40px' }); s.classList.add('dim'); } });
await sleep(300);
const big = await page.evaluate(() => document.getAnimations().filter(a => { const t = a.effect?.target; if (!t || a.effect.getTiming().iterations !== Infinity) return false; const own = a.effect.pseudoElement ? 0 : 1; const cs = getComputedStyle(t, a.effect.pseudoElement); const sh = cs.boxShadow; const spread = /\b(\d{3,})px\b/.test(sh) || /0px 0px 0px \d{3,}px/.test(sh); const props = a.effect.getKeyframes().flatMap(k => Object.keys(k)); const pulsesOpacity = props.includes('opacity') || props.includes('boxShadow'); return pulsesOpacity && (spread || t.querySelector?.(':scope')===null && false || (t.getBoundingClientRect().width * t.getBoundingClientRect().height > .25 * innerWidth * innerHeight)); }).map(a => a.effect.target.id || a.effect.target.className));
ok(big.length === 0, `no infinite opacity/shadow pulse on a screen-sized layer ${big.join(',')}`);
const dimShadowPulses = await page.evaluate(() => { const s = document.getElementById('tutspot'); if (!s) return false; return s.getAnimations({ subtree: false }).some(a => a.effect.getKeyframes().some(k => 'opacity' in k)); });
ok(!dimShadowPulses, 'tutorial spotlight (with dim backdrop) does not pulse opacity');
{ const r = await sample(page, 3000); ok(r.rev < OSC_REVERSALS, `tutorial dim spotlight: no luminance oscillation (reversals ${r.rev}, range ${r.range.toFixed(1)})`); }
await page.evaluate(() => { const s = document.getElementById('tutspot'); if (s) s.style.display = 'none'; });

// 2. damage storm: hits every 100ms for 3s -> flashes capped, no strobe
await page.evaluate(() => { const g = window.__game; g.dbg.god = false; g.hp = g.maxHp = 1e6; g.iframes = 0; g.revealing = false; window.__flashes = 0; });
const t0 = Date.now(); let burstMax = 0; const stamps = [];
const hitter = page.evaluate(async () => { const g = window.__game; for (let i = 0; i < 30; i++) { g.iframes = 0; g.hurtPlayer(5, g.px + 1, g.py); await new Promise(r => setTimeout(r, 100)); } });
const r2 = await sample(page, 3200); await hitter; const fl = await page.evaluate(() => window.__flashes);
ok(fl <= MAX_FLASHES_PER_SEC * 3.4, `damage storm (30 hits/3s) produced ${fl} flashes (<= ${Math.floor(MAX_FLASHES_PER_SEC * 3.4)})`);
ok(r2.rev < OSC_REVERSALS, `damage storm: no strobe (reversals ${r2.rev}, range ${r2.range.toFixed(1)})`);
// rolling-window rate check on the guard itself
const rate = await page.evaluate(async () => { const m = await import('/src/flashguard.ts'); let n = 0; const base = 1e6; for (let i = 0; i < 100; i++) if (m.flashAllowed(false, base + i * 10)) n++; return { n, cap: m.FLASH_ALPHA_CAP }; });
ok(rate.n <= 3, `flash guard allows at most 3 per second (${rate.n} of 100 attempts in 1s)`); ok(rate.cap <= .4, `flash alpha capped (${rate.cap})`);
// reduced FX: zero flashes, zero shake
await page.evaluate(() => { const g = window.__game; g.save.settings.reducedFx = true; window.__flashes = 0; window.__rend.shake = 5; for (let i = 0; i < 10; i++) { g.iframes = 0; g.hurtPlayer(5, g.px + 1, g.py); } });
await sleep(300); ok((await page.evaluate(() => window.__flashes)) === 0, 'Reduced FX: no hit flash'); ok((await page.evaluate(() => window.__rend.shake)) === 0, 'Reduced FX: no screen shake (boss/phase shake included)');
await page.evaluate(() => { window.__game.save.settings.reducedFx = false; window.__rend.shake = 9; }); await sleep(200);
ok((await page.evaluate(() => window.__rend.shake)) <= .6, 'screen shake amplitude capped');

// 3. down state: panel appears once and the screen settles
await page.evaluate(() => { const g = window.__game; g.save.settings.reducedFx = false; g.hp = 1; g.iframes = 0; g.maxHp = 100; g.hurtPlayer(1e5, g.px + 1, g.py); });
{ const r = await sample(page, 2500); ok(r.rev < OSC_REVERSALS, `down state: settles (reversals ${r.rev})`); }
await page.evaluate(() => { const g = window.__game; g.save.checkpointResume?.(); try { g.cp?.(); } catch {} document.getElementById('downpanel').style.display = 'none'; g.downed = false; g.hp = g.maxHp; });

// 4. zone banner jitter: standing on a zone border must not re-flash the banner every frame
const bn = await page.evaluate(async () => { const g = window.__game, ui = window.__ui; const zs = Object.keys(g.dd.zoneLabels || {}); let shown = 0; const b = document.getElementById('banner'); const obs = new MutationObserver(() => shown++); obs.observe(b, { childList: true, subtree: true });
  const orig = g.zoneAt.bind(g); let k = 0; g.zoneAt = () => (k++ % 2 ? zs[0] : zs[1] || zs[0]); g.lastZone = zs[0]; await new Promise(r => setTimeout(r, 3000)); g.zoneAt = orig; obs.disconnect(); return { shown, zs: zs.length }; });
ok(bn.zs < 2 || bn.shown <= 4, `zone border jitter re-triggered the banner ${bn.shown}x in 3s (<=4)`);

// 5. canvas never resized without a real size change
const rs = await page.evaluate(async () => { const r = window.__rend; const before = window.__canvasResizes || 0; for (let i = 0; i < 40; i++) { window.dispatchEvent(new Event('resize')); r.resize(); } return (window.__canvasResizes || 0) - before; });
ok(rs === 0, `40 redundant resize events cause ${rs} canvas backing-store resets (0)`);
await page.setViewportSize({ width: 700, height: 400 }); await sleep(200); await page.setViewportSize({ width: 640, height: 360 }); await sleep(200);
ok((await page.evaluate(() => window.__rend.canvas.width)) === 640, 'canvas follows a real resize');

// 6. dynamic resolution hysteresis: slow/fast alternating frame times must not flip resolution back and forth
const dyn = await page.evaluate(() => { const Q = window.__quality; Q.pref = 'auto'; Object.defineProperty(Q, 'dynamic', { get: () => true, configurable: true }); Q.resScale = 1; Q.steps.length = 0; const origPerf = performance.now.bind(performance); let fake = origPerf(); performance.now = () => fake; let t = 0;
  // 10 minutes of simulated frames: slow (35ms) at full res, fast (10ms) when scaled down -> the classic oscillation
  for (let i = 0; i < 600 * 60; i++) { const ms = Q.resScale < 1 ? 10 : 35; fake += ms; Q.sample(ms); }
  performance.now = origPerf; return { steps: Q.steps.length, last: Q.steps.slice(-4) }; });
ok(dyn.steps <= 10, `dynamic resolution: ${dyn.steps} changes in 10 simulated minutes of worst-case flapping load (<=14, backed off)`);

ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close(); process.exit(fails ? 1 : 0);
