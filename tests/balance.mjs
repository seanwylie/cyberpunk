// Balance regression (loose bounds; docs/BALANCE.md). Runs the headless bot harness (tools/balance/harness.mjs) on a representative subset:
// par kit per tier must clear most runs, tiers must not get easier, over-geared kits must clear, nothing one-shots a par-kit player, bosses stay killable.
// Full sweep: node tools/balance/run.mjs ; this test takes ~1-2 minutes.
import { launch } from './lib.mjs'; import { runJob } from '../tools/balance/harness.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const SET = [['annex', 'mid', 15, 0], ['foundry', 'blue', 24, 0], ['coke_ovens', 'mid', 18, 1], ['tailings_pit', 'mid', 18, 1], ['cold_archive', 'blue', 26, 2], ['pharmacy_vault', 'blue', 26, 2], ['liquidation_floor', 'purple', 35, 3], ['night_tunnels', 'purple', 35, 3], ['recall_yard', 'purple', 44, 4]];
const res = []; for (const [id, kit, level, tier] of SET) for (let s = 0; s < 4; s++) { const r = await page.evaluate(runJob, { mode: 'level', id, kit, level, seed: 4000 + s * 53, maxT: 1100, maxDeaths: 4 }); res.push({ id, kit, tier, ...r }); }
const rate = a => a.filter(r => r.cleared).length / (a.length || 1); const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const byT = t => res.filter(r => r.tier === t);
for (const t of [0, 1, 2, 3, 4]) ok(rate(byT(t)) >= .5, `tier ${t || 'base'} par-kit clear rate >= 50% (${Math.round(rate(byT(t)) * 100)}%)`);
ok(rate(res) >= .6 && rate(res) <= .98, `overall par-kit clear rate is challenging but fair: ${Math.round(rate(res) * 100)}% (60-98%)`);
ok(avg(byT(4).map(r => r.deaths)) >= avg(byT(0).map(r => r.deaths)) - .05 && avg(byT(3).concat(byT(4)).map(r => r.t)) > avg(byT(0).concat(byT(1)).map(r => r.t)), 'difficulty rises: tier III-IV take longer than base/tier I');
ok(res.every(r => !r.error) && res.filter(r => r.stuck).length <= 2, 'bot rarely gets stuck (<=2 of ' + res.length + '): ' + res.filter(r => r.stuck).map(r => r.id).join());
ok(res.every(r => r.maxHit < r.maxHp * .5), 'no single hit takes >50% of a par-kit player\'s HP (max ' + Math.max(...res.map(r => r.maxHit / r.maxHp)).toFixed(2) + ')');
const bt = res.filter(r => r.cleared && r.bossTtk); ok(bt.length && bt.every(r => r.bossTtk > 8 && r.bossTtk < 360), `boss TTK within 8-360 s for cleared runs (min ${Math.min(...bt.map(r => r.bossTtk))}, max ${Math.max(...bt.map(r => r.bossTtk))})`);
// over-geared and under-geared references
const lo = []; for (const [id, kit, level] of [['liquidation_floor', 'starter', 35], ['recall_yard', 'starter', 44], ].slice(0, 2)) for (let s = 0; s < 2; s++) lo.push(await page.evaluate(runJob, { mode: 'level', id, kit, level, seed: 4100 + s, maxT: 700, maxDeaths: 4 }));
ok(lo.every(r => !r.cleared), 'starter kit cannot clear tier III/IV (gear matters)');
const hi = []; for (const id of ['night_tunnels', 'recall_yard']) hi.push(await page.evaluate(runJob, { mode: 'level', id, kit: 'orange', level: id === 'recall_yard' ? 44 : 35, seed: 4200, maxT: 1100, maxDeaths: 4 }));
ok(hi.every(r => r.cleared && r.deaths === 0), 'idkfa/orange kit clears tier III/IV flawlessly');
// mob duels: no mob is unkillable for its par kit, none one-shots
const mobs = []; for (const [id, kit, level] of [['bulwarktread', 'blue', 26], ['packmule', 'purple', 35], ['tagcarrier', 'purple', 44], ['longlens', 'blue', 26], ['coalheaver', 'mid', 18]]) mobs.push(await page.evaluate(runJob, { mode: 'mob', id, kit, level, seed: 77, n: 3 }));
ok(mobs.every(r => !r.downed && r.t < 59 && r.maxHit < 70), 'mob duels: par kit wins, no mob hit > 70: ' + mobs.map(r => r.id + ' ' + r.t + 's/' + Math.round(r.maxHit)).join(', '));
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
