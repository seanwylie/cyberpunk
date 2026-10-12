// Screenshots of Harrow Reach stations (evidence for prop / landmark visibility fixes): node tests/harrow_shots.mjs [outdir]
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const out = process.argv[2] || 'shots/harrow'; fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 }); await sleep(1500);
await page.evaluate(() => { document.getElementById('splash')?.remove(); const g = window.__game; g.save.level = 20; (g.save.cleared = { ...(g.save.cleared || {}), gw_bell_foundry: 1 }, g.checkTownUnlocks()); g.travel('harrow'); window.__ui.open(null); });
await sleep(4000);
const st = await page.evaluate(() => window.__game.level.interacts.map(i => [i.station, i.x, i.y]));
for (const [k, x, y] of st) { await page.evaluate(([x, y]) => { const g = window.__game; g.px = x; g.py = y; for (let i = 0; i < 5; i++) g.update(.016); }, [x, y]); await sleep(1500); await page.screenshot({ path: `${out}/st_${k}.png` }); }
// approach forge from the plaza side too
await page.evaluate(() => { const g = window.__game; g.px = 55; g.py = 38; for (let i = 0; i < 5; i++) g.update(.016); }); await sleep(1500); await page.screenshot({ path: `${out}/forge_approach.png` });
console.log('errors', errors.slice(0, 5)); await browser.close();
