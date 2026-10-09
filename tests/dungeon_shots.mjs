// Captures a screenshot of each dungeon (entry, mid-hall, boss arena) plus the dungeon select and contacts screens.
import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
const ev = (f, a) => page.evaluate(f, a); const out = 'shots/dungeons/';
await ev(() => { const g = window.__game; g.save.level = 34; g.dbg.god = true; window.__ui.showAll = true; window.__ui.open('gate'); }); await sleep(300); await page.screenshot({ path: out + 'select.png' });
await ev(() => { window.__ui.close(); window.__ui.contactSel = 'ten_hallowell'; window.__ui.open('contacts'); }); await sleep(300); await page.screenshot({ path: out + 'contacts.png' });
for (const id of ['foundry', 'clinic', 'warehouse']) {
  await ev(id => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun(id); }, id); await sleep(500); await page.screenshot({ path: out + id + '_entry.png' });
  await ev(() => { const g = window.__game; g.px = g.level.checkpoints[1].x; g.py = g.level.checkpoints[1].y; }); await sleep(500); await page.screenshot({ path: out + id + '_control.png' });
  await ev(() => { const g = window.__game; g.inst.flags.controller = true; g.px = g.level.revealX + 3; g.py = g.level.bossSpawn.y; }); await sleep(12000); await page.screenshot({ path: out + id + '_boss.png' });
}
console.log('errors', errors); await browser.close();
