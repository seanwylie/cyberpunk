// Screenshots of permanent hazards in a few dungeons (far view: floor art only; near view: danger cue). OUT=shots/hazards/<tag>
import { launch, sleep } from '../../tests/lib.mjs';
import fs from 'fs';
const out = process.env.OUT || 'shots/hazards/after'; fs.mkdirSync(out, { recursive: true });
const { browser, page } = await launch({ query: '?splash=hold', viewport: { width: 1100, height: 700 } });
for (const id of ['warehouse', 'foundry', 'clinic']) {
  await page.evaluate(id => { document.getElementById('splash')?.remove(); const g = window.__game; g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; const okr = g.startRun(id); window.__ok = okr; g.revealing = false; g.dbg.god = true; for (const e of g.enemies) e.dead = true; g.zones = g.zones.filter(z => z.env);
    const hz = g.zones.filter(z => z.env); let best = hz[0], bn = -1; for (const h of hz) { const n = hz.filter(o => Math.hypot(o.x - h.x, o.y - h.y) < 8).length; if (n > bn) { bn = n; best = h; } }
    let spot = null; for (let r = 4; r < 9 && !spot; r += .5) for (let a = 0; a < 6.28 && !spot; a += .4) { const x = best.x + Math.cos(a) * r, y = best.y + Math.sin(a) * r; if (!g.circleHits(x, y, .4) && hz.every(o => Math.hypot(o.x - x, o.y - y) > o.r + 3.6)) spot = { x, y }; } spot ||= { x: best.x + 5, y: best.y };
    g.px = spot.x; g.py = spot.y; window.__spot = spot; window.__best = { x: best.x, y: best.y }; }, id);
  console.log(id, await page.evaluate(() => [window.__ok, window.__game.mode, window.__game.zones.length])); await sleep(700); await page.screenshot({ path: `${out}/${id}_far.png` });
  await page.evaluate(() => { const g = window.__game, b = window.__best; const q = { x: b.x + 2.4, y: b.y }; if (!g.circleHits(q.x, q.y, .4)) { g.px = q.x; g.py = q.y; } else { g.px = window.__spot.x; g.py = window.__spot.y; } }); await sleep(500); await page.screenshot({ path: `${out}/${id}_near.png` });
}
await browser.close();
