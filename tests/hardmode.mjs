// Hard mode: a tank-and-spank bot (stands next to the boss, auto-attacks, no dodge/abilities) must lose >80% of boss fights; the skilled bot clears 40-85% (target 50-70%) with par kits.
import { launch } from './lib.mjs'; import { runJob } from '../tools/balance/harness.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const SET = [['annex', 'mid', 15], ['foundry', 'blue', 24], ['coke_ovens', 'mid', 18], ['cold_archive', 'blue', 26], ['pharmacy_vault', 'blue', 26], ['liquidation_floor', 'purple', 35], ['night_tunnels', 'purple', 35], ['recall_yard', 'purple', 44]];
const tank = [], skill = [];
for (const [id, kit, level] of SET) for (let s = 0; s < 5; s++) { tank.push(await page.evaluate(runJob, { mode: 'level', id, kit, level, seed: 7000 + s * 41, bossOnly: true, profile: 'tank', maxDeaths: 1 })); skill.push(await page.evaluate(runJob, { mode: 'level', id, kit, level, seed: 7100 + s * 41, bossOnly: true, profile: 'skilled', maxDeaths: 2 })); }
const rate = a => a.filter(r => r.cleared).length / a.length;
ok(1 - rate(tank) > .8, `tank-and-spank loses ${Math.round((1 - rate(tank)) * 100)}% of boss fights (>80%)`);
ok(rate(skill) >= .4 && rate(skill) <= .85, `skilled bot clears ${Math.round(rate(skill) * 100)}% (40-85%)`);
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
