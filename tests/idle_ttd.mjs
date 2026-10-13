// Idle time-to-death (regular mobs are a threat): a par-kit player who stands still (autos only, no abilities/moves) next to a pack of 4 of the
// dungeon's own regular mobs must go down within a sane window at every level band (BAL.g.armorK percentage armor). Uses tools/balance/harness.mjs idle mode.
import { launch } from './lib.mjs'; import { runJob } from '../tools/balance/harness.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page } = await launch({ query: '?splash=hold' });
for (const [id, level, kit, lo, hi] of [['annex', 1, 'starter', 6, 30], ['warehouse', 10, 'mid', 6, 30], ['bell_foundry', 20, 'blue', 6, 30], ['audit_tower', 26, 'blue', 6, 35], ['radio_mast', 38, 'purple', 6, 35], ['recall_yard', 44, 'purple', 6, 35]]) {
  const r = await page.evaluate(runJob, { mode: 'idle', id, level, kit, seed: 7, maxT: 90 }); const t = r.ttd ?? 999;
  ok(t >= lo && t <= hi, `${id} L${level} ${kit}: idle player down in ${r.ttd ?? '>90'} s (${lo}-${hi} s) ${r.error || ''}`);
}
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
