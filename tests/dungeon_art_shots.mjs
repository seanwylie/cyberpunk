// Art QA captures: hazard close-ups per dungeon, a lineup of every enemy/boss sprite, and an attack/hit/death animation strip. Output: shots/dungeons_art/
import { launch, sleep } from './lib.mjs';
import fs from 'fs';
const out = 'shots/dungeons_art/'; fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
const ev = (f, a) => page.evaluate(f, a);
const IDS = { foundry: ['slaghauler', 'ladlecrew', 'cinderhound', 'slagcannon', 'brakeman', 'quenchpriest', 'teague', 'brannoch', 'ore9'], clinic: ['orderly', 'nursebot', 'gurneyrunner', 'sentry', 'matron', 'anesthetist', 'surgeon', 'autosurgeon', 'recovered'], warehouse: ['picker', 'loader', 'forkbot', 'scanner', 'camgun', 'shiftlead', 'hobbs', 'stockmgr', 'retrieval', 'reclaimer'] };
for (const id of ['foundry', 'clinic', 'warehouse']) {
  await ev(id => { const g = window.__game; g.save.level = 34; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun(id); }, id); await sleep(800);
  // hazards: first of each label
  const labels = await ev(() => { const g = window.__game, seen = {}; for (const h of (g.level.hazards||[])) if (!seen[h.label]) seen[h.label] = [h.x, h.y]; return seen; });
  for (const [lab, [x, y]] of Object.entries(labels)) { await ev(([x, y]) => { const g = window.__game; g.px = x + 2.2; g.py = y + 1.2; }, [x, y]); await sleep(900); await page.screenshot({ path: `${out}${id}_haz_${lab.replace(/[^a-z]/gi, '_')}.png` }); }
  // enemy lineup in the yard, frozen
  const ids = IDS[id]; await ev(([ids]) => { const g = window.__game; const L = g.level; let cx = L.spawn.x + 6, cy = L.spawn.y; g.px = cx - 6; g.py = cy; g.camx = 1e9; ids.forEach((t, i) => { const e = g.spawnEnemy(t, cx + (i % 5) * 2.2 - 3, cy + Math.floor(i / 5) * 2.4 - 1.2); e.stunT = 999; e._rt.hit = 0; }); }, [ids]); await sleep(1200);
  await ev(() => { const g = window.__game; g.px += 5.5; }); await sleep(900); await page.screenshot({ path: `${out}${id}_lineup.png` });
}
console.log('errors', errors); await browser.close();
