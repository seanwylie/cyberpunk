// In-game screenshots: 3 seeds per dungeon, framed on the second hall (shows layout structure) -> shots/mapvary/<dungeon>_<seed>.png
import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ viewport: { width: 1100, height: 640 } }); const ev = (f, a) => page.evaluate(f, a);
for (const id of ['annex', 'foundry', 'clinic', 'warehouse']) for (const S of [111, 222, 333]) {
  await ev(([id, S]) => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.level = 40; g.recompute(); g.dbg.god = true; const r = Math.random; Math.random = () => S / 1e9; g.startRun(id); Math.random = r; const L = g.level; const hall = L.checkpoints[1]; g.px = hall.x - 14; g.py = hall.y; g.enemies = []; g.update(0.016); }, [id, S]);
  await sleep(2500); await page.screenshot({ path: `shots/mapvary/${id}_${S}.png` }); }
console.log('errors', errors); await browser.close();
