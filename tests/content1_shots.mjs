// Screenshots of the 20 batch-1 levels (entry hall, control gantry, boss arena) -> shots/content1/<id>_{a,b,c}.png (+ contact sheet via tools/content/sheet.py)
import fs from 'fs'; import { launch, sleep } from './lib.mjs';
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const { browser, page } = await launch({ viewport: { width: 960, height: 540 } }); const ev = (fn, a) => page.evaluate(fn, a); fs.mkdirSync('shots/content1', { recursive: true });
const ids = await ev(async () => (await import('/src/content/dungeons.ts')).BATCH1_IDS);
for (const id of ids) { if (only.length && !only.includes(id)) continue;
  await ev(id => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.save.level = 45; g.recompute(); g.dbg.god = true; g.startRun(id); for (let i = 0; i < 20; i++) g.update(0.016); window.__ui && window.__ui.close && window.__ui.close(); }, id);
  const spots = await ev(() => { const g = window.__game, L = g.level; const P = L.interacts.find(i => i.id === 'hackproc'), C = L.interacts.find(i => i.id === 'controller'); return [[L.spawn.x + 4, L.spawn.y], [P.x, P.y + 1.5], [L.bossSpawn.x + 6, L.bossSpawn.y]]; });
  for (let k = 0; k < 3; k++) { await ev(([x, y, k]) => { const g = window.__game; g.px = x; g.py = y; if (k === 2) { g.inst.flags.controller = true; g.openDoor('boss'); } for (let i = 0; i < 30; i++) g.update(0.016); }, [...spots[k], k]); await sleep(900); await page.screenshot({ path: `shots/content1/${id}_${'abc'[k]}.png` }); }
  console.log('shot', id); }
await browser.close();
