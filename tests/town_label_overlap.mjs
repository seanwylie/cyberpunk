// Every town interaction label (every town in WORLD), at several UI scales and DPRs, plus a cold start with the web font delayed (font-load race):
// the text ink box (re-measured fresh after the font is loaded) must sit right of the icon cell with a gap, and inside the pill's inner box. Saves crops to shots/town_labels.
import { launch, sleep } from './lib.mjs';
import fs from 'fs';
fs.mkdirSync('shots/town_labels', { recursive: true });
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { console.log('FAIL ' + m); fails++; } };
const CFG = process.env.COLD ? [[1, 'M', 4000]] : process.env.QUICK ? [[1, 'M', 0]] : process.env.ONLY ? [JSON.parse(process.env.ONLY)] : [[1, 'M', 4000], [1.25, 'M', 0], [1.5, 'S', 0], [2, 'XL', 0], [1, 'XL', 0], [2, 'S', 0]];
for (const [dpr, US, delay] of CFG) {
  const route = delay ? p => p.route('**/fonts/RobotoCondensed.woff', async r => { await sleep(delay); r.continue(); }) : null;
  const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 }, dpr, query: '?splash=hold', route }); const ev = (f, a) => page.evaluate(f, a);
  await ev(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 120000 });
  await ev(async US => { const m = await import('/src/config.ts'); m.applyUiScale(US); }, US);
  const towns = await ev(async () => (await import('/src/world.ts')).WORLD.map(t => t.id));
  for (const town of towns) {
    await ev(async town => { const g = window.__game; g.save.level = 30; g.checkTownUnlocks(); const w = (g.save.world ??= { visited: {}, landmarks: {} }); (w.unlocked ??= {})[town] = 1; if (g.townId !== town) g.travel(town); window.__ui.open(null); g.save.settings.reducedFx = true; g.save.settings.stationMarkers = false; }, town);
    await page.waitForFunction(t => window.__rend.town?.ready && window.__game.townId === t, town, { timeout: 60000 }); await sleep(600);
    const sts = await ev(() => window.__game.level.interacts.filter(i => i.station).map(i => ({ id: i.id, key: i.station, x: i.x, y: i.y })));
    ok(sts.length > 0, `${town}: has stations`);
    for (const st of sts) {
      await ev(st => { const g = window.__game; for (const dx of [0, .6, 1.2]) for (let a = 0; a < 16; a++) { const x = st.x + Math.cos(a * Math.PI / 8) * dx, y = st.y + Math.sin(a * Math.PI / 8) * dx; if (!g.solidAt(x, y)) { g.px = x; g.py = y; return; } } }, st);
      await sleep(delay && st === sts[0] && town === towns[0] ? 300 : 700); // cold run: first label is measured while the font is still loading
      if (delay && st === sts[0] && town === towns[0]) await sleep(delay + 1500);
      const L = await ev(async id => { await document.fonts.ready; const R = window.__rend; const l = (R.lblRects || []).filter(q => q.id === id).pop(); if (!l) return null; return { ...l, fontOk: document.fonts.check('700 16px "Roboto Condensed"') }; }, st.id);
      const tag = `dpr${dpr} ${US}${delay ? ' cold-font' : ''} ${town}/${st.key}`;
      if (!L) { ok(false, `${tag}: no label drawn`); continue; }
      // fresh ink measurement with the loaded font, independent of the renderer's cache
      const fresh = await ev(({ txt, h }) => { const R = window.__rend; const FS = h; const k = [...R.inkCache.keys()].findLast(k => k.endsWith('|' + txt + '|' + R.dpr)); const font = k ? k.split('|')[0] : null; if (!font) return null; const c = document.createElement('canvas').getContext('2d'); c.font = font; const m = c.measureText(txt); return { w: m.actualBoundingBoxRight + m.actualBoundingBoxLeft, font }; }, { txt: L.text, h: L.h });
      ok(L.fontOk, `${tag}: web font loaded`);
      if (!fresh) { ok(false, `${tag}: label ink not cached after font load (still measuring against fallback?)`); continue; }
      const iconR = L.ix + L.isz, textL = L.tx, textR = L.tx + Math.max(L.tw, fresh.w), padIn = 3;
      ok(textL - iconR >= 2, `${tag}: text starts ${(textL - iconR).toFixed(1)}px right of the icon (>=2)`);
      ok(L.ix >= L.x + padIn, `${tag}: icon inside pill (${(L.ix - L.x).toFixed(1)})`);
      ok(textR <= L.x + L.w - padIn, `${tag}: text right ${textR.toFixed(1)} inside pill ${(L.x + L.w - padIn).toFixed(1)} (cached ink ${L.tw}, fresh ${fresh.w.toFixed(1)})`);
      ok(Math.abs(L.tw - fresh.w) <= 2.5, `${tag}: cached ink width ${L.tw} matches loaded-font width ${fresh.w.toFixed(1)}`);
      if (dpr !== 1.5) { const clip = { x: Math.max(0, L.x - 6), y: Math.max(0, L.y - 6), width: L.w + 12, height: L.h + 12 }; await page.screenshot({ path: `shots/town_labels/${town}_${st.key}_dpr${dpr}_${US}${delay ? '_cold' : ''}.png`, clip }).catch(() => {}); }
    }
  }
  ok(errors.length === 0, `dpr${dpr} ${US}: no page errors ${errors[0] || ''}`); await browser.close();
}
console.log(`${checks} checks, ` + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
