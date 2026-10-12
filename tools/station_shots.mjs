// before/after screenshots of every station's label in context: node tools/station_shots.mjs <prefix>   (writes shots/station_labels/<prefix>_<town>_<station>.png)
import { launch, sleep } from '../tests/lib.mjs';
import fs from 'fs'; fs.mkdirSync('shots/station_labels', { recursive: true });
const prefix = process.argv[2] || 'now';
const { browser, page } = await launch({ viewport: { width: 1280, height: 800 }, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
for (const town of ['rustline', 'harrow']) {
  await ev(async town => { const g = window.__game; g.save.level = 30; g.checkTownUnlocks(); if (g.townId !== town) g.travel(town); window.__ui.open(null); g.save.settings.stationMarkers = false; }, town);
  await page.waitForFunction(t => window.__rend.town?.ready && window.__game.townId === t, town, { timeout: 30000 }); await sleep(1200);
  const sts = await ev(() => window.__game.level.interacts.map(i => ({ id: i.id, key: i.station, x: i.x, y: i.y })));
  for (const st of sts) {
    await ev(st => { const g = window.__game; for (const dx of [0, .6, 1.2]) for (let a = 0; a < 16; a++) { const x = st.x + Math.cos(a * Math.PI / 8) * dx, y = st.y + Math.sin(a * Math.PI / 8) * dx; if (!g.solidAt(x, y)) { g.px = x; g.py = y; for (let i = 0; i < 4; i++) g.update(.016); if (g.prompt?.id === st.id) return; } } }, st); await sleep(1800);
    const ax = await ev(st => ({ x: window.__rend.sx(st.x, st.y), y: window.__rend.sy(st.x, st.y) }), st);
    const cl = { x: Math.max(0, Math.round(ax.x - 230)), y: Math.max(0, Math.round(ax.y - 400)) }; cl.width = Math.min(1280 - cl.x, 460); cl.height = Math.min(800 - cl.y, 520);
    await page.screenshot({ path: `shots/station_labels/${prefix}_${town}_${st.key}.png`, clip: cl });
  }
}
await browser.close();
