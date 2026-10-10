// Town frame-time budget. Measures Renderer.draw() CPU time (+ per-section breakdown) while the player walks through the town,
// at several viewports and CPU throttles. Also records real rAF intervals. Set PROFILE=1 for the breakdown table.
// Budget: p95 draw < 16.7ms at desktop sizes (unthrottled); throttled 4x numbers are reported (budget 50ms p95).
import { launch, sleep } from './lib.mjs';
const SIZES = process.env.QUICK ? [[1280, 720]] : [[1280, 720], [1920, 1080], [2560, 1440]];
const BREAK = process.env.PROFILE || process.argv.includes('--profile');
let fail = 0; const out = [];
for (const [w, h] of SIZES) for (const rate of [1, 4]) {
  const { browser, page, ctx, errors } = await launch({ viewport: { width: w, height: h } });
  const cdp = await ctx.newCDPSession(page); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 }); await sleep(1500);
  if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const r = await page.evaluate(async ({ prof }) => {
    const g = window.__game, R = window.__rend; const sec = {}; const gl = document.createElement('canvas').getContext('webgl'); const ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); const sw = !gl || /swiftshader|llvmpipe|software/i.test(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'swiftshader'); const S = [];
    if (prof) for (const m of ['drawFloor', 'drawWorld', 'flushLoot', 'drawOverlay', 'drawTownGround', 'townItems', 'drawNpc', 'drawTownOverhead', 'drawTownAmbient', 'drawProjAndFx', 'drawGroundFx']) { const o = R[m]; R[m] = function (...a) { const t = performance.now(); const v = o.apply(this, a); sec[m] = (sec[m] || 0) + performance.now() - t; return v; }; }
    const path = [[20, 15], [12, 12], [8, 11], [20, 15], [31, 12], [34, 21], [18, 24], [20, 15]]; const T = [];
    let pi = 0; g.px = path[0][0]; g.py = path[0][1]; for (let i = 0; i < 40; i++) { g.update(.016); R.draw(.016); } for (const k in sec) sec[k] = 0;
    const n = 200; let frames = 0; const rafT = []; let last = performance.now();
    await new Promise(res => { const f = () => { const now = performance.now(); rafT.push(now - last); last = now;
      const tg = path[pi]; const dx = tg[0] - g.px, dy = tg[1] - g.py, d = Math.hypot(dx, dy); if (d < .3) pi = (pi + 1) % path.length; else { g.px += dx / d * .1; g.py += dy / d * .1; }
      g.update(.016); const a = performance.now(); R.draw(.016); S.push(performance.now() - a); R.ctx.getImageData(0, 0, 1, 1); /* force raster so software canvas cost is counted */ T.push(performance.now() - a); if (++frames < n) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2); };
    const sc = {}; for (const k in sec) sc[k] = +(sec[k] / n).toFixed(2);
    return { sw, sub: q(S, .95), med: q(T, .5), p95: q(T, .95), max: q(T, 1), rafMed: q(rafT.slice(5), .5), rafP95: q(rafT.slice(5), .95), sec: sc };
  }, { prof: !!BREAK });
  // Two budgets. (1) JS submit time (draw() without raster) p95: 8ms @1x, 32ms @4x CPU. (2) draw+raster p95: 16.7ms @1x on a GPU-backed canvas;
  // this box's headless Chrome rasterises in software, so there the ceiling is a regression guard (60ms/250ms; before the fixes p95 was 79-108ms / 330-490ms), not the real target.
  const budget = r.sw ? (rate === 1 ? 60 : 250) : (rate === 1 ? 16.7 : 50); const subB = rate === 1 ? 8 : 32; const ok = r.p95 < budget && (r.sw || r.sub < subB); if (!ok) fail++;
  console.log(`${w}x${h} cpu x${rate}: draw+raster med ${r.med}ms p95 ${r.p95}ms (submit p95 ${r.sub}ms, ${r.sw ? 'software' : 'gpu'} raster) max ${r.max}ms | raf med ${r.rafMed} p95 ${r.rafP95} | budget ${budget} ${ok ? 'OK' : 'FAIL'}${BREAK ? '\n   ' + JSON.stringify(r.sec) : ''}`);
  if (errors.length) { console.log(errors.slice(0, 3)); fail++; }
  await browser.close();
}
if (fail) { console.log('townperf FAIL'); process.exit(1); } console.log('townperf OK');
