// Label position is a fixed function of the station anchor: walking the player from far away, through the interact radius, to the pad centre never moves the pill
// (offset from the station's screen anchor constant within 1px) and the idle pin is centred exactly where the pill will appear. One label per station at every step.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1920, height: 1080 }, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
for (const town of ['rustline', 'harrow']) {
  await ev(async town => { const g = window.__game; g.save.level = 30; g.checkTownUnlocks(); if (g.townId !== town) g.travel(town); window.__ui.open(null); g.save.settings.stationMarkers = false; }, town);
  await page.waitForFunction(t => window.__rend.town?.ready && window.__game.townId === t, town, { timeout: 30000 }); await sleep(1200);
  const sts = await ev(() => window.__game.level.interacts.map(i => ({ id: i.id, key: i.station, x: i.x, y: i.y, r: i.r })));
  for (const st of sts) {
    const dists = [20, 16, 13, 11.5, 9, 6, 3.5, 2, 1, .4, 0];
    const ang = await ev(([st, dists]) => { const g = window.__game; for (let a = 0; a < 32; a++) { const t = a * Math.PI / 16; if (dists.every(d => !g.solidAt(st.x + Math.cos(t) * d, st.y + Math.sin(t) * d))) return t; } return null; }, [st, dists]);
    if (ang == null) { ok(true, `${town}/${st.key}: no clear straight approach (skipped)`); continue; }
    const rec = [];
    for (const d of dists) { await ev(([st, d, ang]) => { const g = window.__game; g.px = st.x + Math.cos(ang) * d; g.py = st.y + Math.sin(ang) * d; for (let i = 0; i < 4; i++) g.update(.016); }, [st, d, ang]); await sleep(700);
      rec.push({ d, ...(await ev(st => { const R = window.__rend, g = window.__game; const l = (R.lblRects || []).filter(q => q.id === st.id), c = (R.chipRects || []).filter(q => q.id === st.id); const ax = R.sx(st.x, st.y), ay = R.sy(st.x, st.y); return { ready: g.prompt?.id === st.id, n: l.length, chips: c.length, dx: l[0] ? l[0].x - ax : null, dy: l[0] ? l[0].y - ay : null, w: l[0]?.w, h: l[0]?.h, cdx: c[0] ? c[0].cx - ax : null, cdy: c[0] ? c[0].cy - ay : null, cclamped: c[0]?.clamped, lcx: l[0] ? l[0].x + l[0].w / 2 - ax : null, lcy: l[0] ? l[0].y + l[0].h / 2 - ay : null, clamped: l[0] ? (l[0].x <= 8.5 || l[0].x + l[0].w >= innerWidth - 8.5 || l[0].y <= 8.5 || l[0].y + l[0].h >= innerHeight - 8.5) : false }; }, st)) }); }
    const rd = rec.filter(r => r.ready && r.n === 1 && !r.clamped), ch = rec.filter(r => r.chips === 1 && !r.ready && !r.cclamped);
    ok(rd.length >= 2, `${town}/${st.key}: pill shown at ${rd.length} positions inside the radius`);
    if (rd.length >= 2) { const ref = rd[0]; const dev = Math.max(...rd.map(r => Math.max(Math.abs(r.dx - ref.dx), Math.abs(r.dy - ref.dy)))); ok(dev <= 1, `${town}/${st.key}: pill offset from station anchor stable across the radius (max deviation ${dev.toFixed(2)}px over ${rd.length} positions)`);
      if (ch.length) { const cd = Math.max(...ch.map(r => Math.max(Math.abs(r.cdx - ref.lcx), Math.abs(r.cdy - ref.lcy)))); ok(cd <= 1.5, `${town}/${st.key}: idle pin centred on the pill's centre (max ${cd.toFixed(2)}px)`); } }
    ok(rec.every(r => r.n + (r.n ? 0 : 0) <= 1 && !(r.n === 1 && r.chips === 1)), `${town}/${st.key}: never a pill and a pin together`);
  }
}
ok(errors.length === 0, 'no page errors ' + (errors[0] || '')); await browser.close();
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
