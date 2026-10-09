// Screenshots the town and a few annex rooms: node tests/town_shot.mjs <outdir> [query]
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const out = process.argv[2] || 'shots/env'; const q = process.argv[3] || ''; fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 }, query: q });
const ev = (f, a) => page.evaluate(f, a); await sleep(2500);
const go = async (name, x, y, wait = 900) => { await ev(([x, y]) => { const g = window.__game; g.dbg && (g.dbg.god = true); g.px = x; g.py = y; }, [x, y]); await sleep(wait); await page.screenshot({ path: `${out}/${name}.png` }); };
await go('town_plaza', 20.5, 16.5, 2500); await go('town_fixer', 9, 14.5); await go('town_vendor', 27.5, 11); await go('town_south', 17, 22.5);
await ev(() => { const g = window.__game; g.save.instance = null; g.inst = null; window.__ui.kit('B', true); g.startRun(); }); await sleep(1500);
await go('annex_yard', 12, 19.5, 1500); await go('annex_yard_corner', 4.5, 13.5); await go('annex_proc', 36, 19.5, 1200); await go('annex_proc_edge', 30, 10, 900);
await ev(() => { const g = window.__game; g.inst.flags.gate1 = true; g.openDoor('gate1'); g.inst.flags.lock2 = true; g.openDoor('lock2'); }); await go('annex_junction', 56, 19.5, 1200);
await ev(() => { const g = window.__game; g.inst.flags.controller = true; g.openDoor('boss'); }); await go('annex_boss', 70, 19.5, 1500);
console.log('errors', errors.slice(0, 5)); await browser.close();
