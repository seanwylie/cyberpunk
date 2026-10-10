// HUD screenshots at 1280x720 and 1920x1080: node tests/hud_shots.mjs <outdir> <tag>
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const dir = process.argv[2] || '/tmp/hudshots', tag = process.argv[3] || 'after'; fs.mkdirSync(dir, { recursive: true });
for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  const { browser, page } = await launch({ viewport: { width: w, height: h }, query: '?splash=hold' });
  await page.evaluate(() => { document.getElementById('splash')?.remove(); window.__ui.kit && window.__ui.kit('A', true); window.__ui.modal = null; window.__ui.render(); window.__game.startRun(); window.__game.dbg.god = true; window.__game.revealing = false; });
  await sleep(1200);
  await page.screenshot({ path: `${dir}/${tag}-${w}x${h}.png` }); await browser.close();
}
