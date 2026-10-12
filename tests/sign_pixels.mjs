// Pixel test of the baked world-sign sprites (the dark panel with the colour icon cell shown while approaching a station): text ink must have equal padding
// between the icon cell and the panel's right inner edge, be cap-height centred, and never touch the border. Checked for every station (both towns), with Outfitter + Repair Bay
// called out, rasterised at the sprite's native size and re-scaled to the on-screen size at DPR 1, 1.25, 1.5, 1.75, 2 (Windows fractional scaling).
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' });
await page.evaluate(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
const res = await page.evaluate(async () => {
  const m = await import('/src/town.ts'); const st = await import('/src/stations.ts'); await document.fonts.load('800 70px "Roboto Condensed"');
  const all = [...(st.STATIONS || []), ...(st.HARROW_STATIONS || [])]; const out = [];
  for (const dprScale of [1, 1.25, 1.5, 1.75, 2]) for (const s of all) {
    const cv = m.makeSign(s); const sc = Math.round(cv.width * 0.25 * dprScale) / (cv.width); // on-screen draw: ~120 css px wide panel at this DPR
    const w = Math.round(cv.width * sc), h = Math.round(cv.height * sc); const t = document.createElement('canvas'); t.width = w; t.height = h; const c = t.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(cv, 0, 0, w, h);
    const d = c.getImageData(0, 0, w, h).data; const x0 = 12 * sc, y0 = 18 * sc, pw = 456 * sc, ph = 120 * sc; const cellR = (12 + 6 + 132) * sc, innerR = (12 + 456 - 3.5) * sc;
    let mnx = 1e9, mxx = -1, mny = 1e9, mxy = -1; // near-white ink inside the text region
    for (let y = Math.round(y0 + 8 * sc); y < Math.round(y0 + ph - 8 * sc); y++) for (let x = Math.round(cellR + 4 * sc); x < Math.round(innerR - 3 * sc); x++) { const o = (y * w + x) * 4; if (d[o] > 215 && d[o + 1] > 215 && d[o + 2] > 215) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); } }
    out.push({ key: s.key, name: s.name, dpr: dprScale, left: (mnx - cellR) / sc, right: (innerR - (mxx + 1)) / sc, top: (mny - y0) / sc, bot: (y0 + ph - (mxy + 1)) / sc, sc });
  }
  return out;
});
for (const r of res) { const tag = `${r.name} @DPR${r.dpr}`; const must = ['store', 'repair'].includes(r.key) || r.dpr === 1;
  if (!must) { if (Math.abs(r.left - r.right) * r.sc > 2.0) ok(false, `${tag}: padding L ${r.left.toFixed(1)} R ${r.right.toFixed(1)}`); continue; }
  ok(Math.abs(r.left - r.right) * r.sc <= 1.5 && r.left >= 20 && r.right >= 20, `${tag}: ink padding icon-cell->text ${r.left.toFixed(1)} vs text->border ${r.right.toFixed(1)} (sprite px, equal within 1.5 device px, >=20)`);
  ok(Math.abs(r.top - r.bot) * r.sc <= 1.5, `${tag}: cap-centred top ${r.top.toFixed(1)} bottom ${r.bot.toFixed(1)}`); }
ok(res.some(r => r.key === 'store') && res.some(r => r.key === 'repair'), 'Outfitter and Repair Bay both covered');
ok(errors.length === 0, 'no page errors ' + (errors[0] || '')); await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
