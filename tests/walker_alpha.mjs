// Town walkers must not flash: sampling each walker's drawn alpha over many walk/idle phases, opaque-pixel coverage must stay steady.
import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
await page.waitForFunction(() => window.__rend?.town?.ready && window.__rend.anim?.loaded.images.walk, null, { timeout: 60000 }); await sleep(500);
const r = await page.evaluate(async () => {
  const { drawWalker } = await import('/src/townfolk.ts'); const R = window.__rend, A = R.anim.loaded, ws = R.town.folk.walkers; const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200; const c = cv.getContext('2d', { willReadFrequently: true }); const out = [];
  for (const w of ws.slice(0, 6)) { const s0 = { cyc: w.cyc, mode: w.mode, idleT: w.idleT, prev: w.prev, fade: w.fade }; const cov = []; let mx = 0;
    for (const mode of ['walk', 'idle']) for (let i = 0; i < 120; i++) { w.mode = mode; w.prev = null; w.fade = 1; w.cyc = i / 120 * 3; w.idleT = i * .05; c.clearRect(0, 0, 200, 200); drawWalker(c, A, w, 100, 150, 1); const d = c.getImageData(0, 0, 200, 200).data; let n = 0, m = 0, any = 0; for (let k = 3; k < d.length; k += 4) { if (d[k] > 200) n++; if (d[k] > 20) any++; if (d[k] > m) m = d[k]; } cov.push(n / any); mx = Math.max(mx, m); }
    Object.assign(w, s0); const half = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; }; const walk = cov.slice(0, 120), idle = cov.slice(120);
    out.push({ mx, walkRatio: Math.min(...walk) / Math.max(...walk), idleRatio: Math.min(...idle) / Math.max(...idle), med: half(cov), minSolid: Math.min(...cov) }); }
  return out; });
let fail = 0; for (const o of r) { const ok = o.mx >= 250 && o.minSolid > .6; console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(o)); if (!ok) fail++; }
if (errors.length) { console.log(errors.slice(0, 3)); fail++; } await browser.close(); process.exit(fail ? 1 : 0);
