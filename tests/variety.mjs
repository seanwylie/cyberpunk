// Variety pass QA: every dungeon theme has a distinct kit (floor/wall/prop/particle/grade), renders with no errors, texture memory stays in budget.
// Also writes shots/variety/env_<theme>.png (SHOTS=1 or default). Needs the dev server (URL env).
import { launch, sleep } from './lib.mjs';
import fs from 'fs';
let { browser, page, errors } = await launch({ viewport: { width: 960, height: 560 } }); let ev = (f, a) => page.evaluate(f, a); const allErr = [];
fs.mkdirSync('shots/variety', { recursive: true });
const kits = await ev(async () => { const m = await import('/src/variety_env.ts'); const l = await import('/src/content/batch1_levels.ts'); return { sigs: Object.entries(m.KITS).map(([k, v]) => [k, m.kitSignature(v), JSON.stringify(v.grade.tint)]), ids: Object.keys(l.LEVEL_BY_ID) }; });
let fail = 0; const bad = m => { console.log('FAIL', m); fail++; };
const sigs = new Map(); for (const [k, s, g] of kits.sigs) { if (sigs.has(s + g)) bad(`kit ${k} duplicates ${sigs.get(s + g)}`); sigs.set(s + g, k); }
for (const id of ['foundry', 'clinic', 'warehouse', ...kits.ids]) if (!kits.sigs.find(k => k[0] === id)) bad('no kit for theme ' + id);
console.log('kits', kits.sigs.length, 'distinct', sigs.size);
const themes = kits.sigs.map(k => k[0]); let maxMB = 0;
let n = 0; for (const id of themes) {
  if (n++ && n % 5 === 1) { allErr.push(...errors); await browser.close(); ({ browser, page, errors } = await launch({ viewport: { width: 960, height: 560 } })); ev = (f, a) => page.evaluate(f, a); } // fresh page every 5 themes keeps memory bounded
  await ev(id => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.save.level = 45; g.recompute(); g.dbg.god = true; g.startRun(id); for (let i = 0; i < 20; i++) g.update(0.016); }, id);
  const ok = await ev(() => window.__game.mode === 'run'); if (!ok) { bad('could not start ' + id); continue; }
  console.log('theme', id); const spots = await ev(() => { const L = window.__game.level; return [[L.spawn.x + 4, L.spawn.y], [L.bossSpawn.x + 6, L.bossSpawn.y]]; });
  for (let k = 0; k < 2; k++) { await ev(([x, y, k]) => { const g = window.__game; g.px = x; g.py = y; if (k === 1) { try { g.inst.flags.controller = true; g.openDoor('boss'); } catch {} } for (let i = 0; i < 30; i++) g.update(0.016); }, [...spots[k], k]); await sleep(1100); await page.screenshot({ path: `shots/variety/env_${id}_${k ? 'boss' : 'hall'}.png` }); }
  const r = await ev(() => { const R = window.__rend; return { mb: R.env ? R.env.memoryMB : -1 }; }); if (r.mb < 0) bad('no env for ' + id); if (r.mb > maxMB) maxMB = r.mb;
}
console.log('max env texture MB', maxMB.toFixed(1)); if (maxMB > 80) bad('env texture memory ' + maxMB);
allErr.push(...errors); const real = allErr.filter(e => !/favicon|404|Failed to load resource/.test(e)); if (real.length) bad('errors ' + real.slice(0, 3).join(' | '));
console.log(fail ? 'variety FAIL' : 'variety PASS'); await browser.close(); process.exit(fail ? 1 : 0);
