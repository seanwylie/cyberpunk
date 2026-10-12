// Screenshots of every town (docs/WORLD.md): shots/world/<town>.png at desktop size, player at the plaza.
import { launch, sleep } from './lib.mjs';
import fs from 'node:fs';
fs.mkdirSync('shots/world', { recursive: true });
const only = process.argv[2];
const { browser, page, errors } = await launch({ viewport: { width: 1600, height: 900 }, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
const ids = await ev(async () => (await import('/src/world.ts')).WORLD.map(t => t.id));
for (const id of ids) { if (only && only !== id) continue;
  await ev(id => { const g = window.__game; window.__ui.open(null); if (g.townId !== id) g.travel(id); }, id);
  await page.waitForFunction(t => window.__rend.town?.ready && window.__game.townId === t, id, { timeout: 30000 });
  await ev(() => { const g = window.__game, L = g.level; const h = L.landmark; if (h) { g.px = (L.spawn.x + h.x) / 2; g.py = (L.spawn.y + h.y) / 2; if (g.solidAt(g.px, g.py)) { g.px = L.spawn.x; g.py = L.spawn.y; } } }); await sleep(1500);
  await page.screenshot({ path: `shots/world/${id}.png` }); console.log('shot', id); }
console.log(errors.length ? 'ERRORS ' + errors.slice(0, 5).join(' | ') : 'no page errors'); await browser.close();
