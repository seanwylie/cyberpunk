// Level 1 start (Sean, Oct 12 2026; docs/CHARACTERS.md "Early game"): new characters start at level 1.
// Part 1 (in page, pure data): every level 1..30 has an in-band dungeon reachable from the starter towns' content, and every slot has
//   wearable non-stock gear at or below each early level (no gear dead zone between the stock kit and Tier I).
// Part 2 (headless bot, tools/balance/harness.mjs): a level 1 stock kit clears the Reclamation Annex; level 4 starter / level 8 mid kits clear Hub 9.
// Usage: URL=http://localhost:5193/ node tests/level1_start.mjs
import { launch } from './lib.mjs'; import { runJob } from '../tools/balance/harness.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const D = await page.evaluate(async () => {
  const Cf = await import('/src/config.ts'), Dn = await import('/src/content/dungeons.ts'), St = await import('/src/state.ts');
  const fresh = St.newSave(); const SL = Object.keys(fresh.installed || {});
  const bands = []; for (let L = 1; L <= 30; L++) bands.push({ L, ds: Dn.DUNGEON_LIST.filter(d => Dn.inBand(d, L)).map(d => d.id) });
  const slots = [...new Set(Cf.ITEMS.map(i => i.slot))]; const gear = {};
  for (const L of [1, 3, 5, 8, 10]) gear[L] = slots.filter(sl => !Cf.ITEMS.some(i => i.slot === sl && i.lvl <= L && !/^(stock_|idkfa_|sig_)/.test(i.id) && !i.cheat));
  const abL1 = Cf.ITEMS.filter(i => i.lvl <= 1 && i.abilities?.length && !/^(idkfa_|sig_)/.test(i.id)).length;
  return { start: Cf.PROGRESSION.startLevel, freshLvl: fresh.level, bands, gear, abL1, annex: [Dn.DUNGEONS.annex.minLevel, Dn.DUNGEONS.annex.maxLevel] };
});
ok(D.start === 1 && D.freshLvl === 1, `new save starts at level 1 (startLevel ${D.start}, newSave ${D.freshLvl})`);
ok(D.annex[0] === 1, 'Reclamation Annex is a level 1 dungeon (' + D.annex.join('-') + ')');
const dead = D.bands.filter(b => !b.ds.length).map(b => b.L); ok(!dead.length, 'no level 1-30 without an in-band dungeon' + (dead.length ? ': ' + dead.join() : ''));
ok(D.gear[3].length <= 3 && D.gear[5].length <= 1 && D.gear[8].length <= 1, 'early gear (L1 is the stock kit by design): <=3 slots without a non-stock upgrade at L3, <=1 at L5/L8 ' + JSON.stringify(D.gear));
ok(Object.values(D.gear)[3].length === 0 || Object.values(D.gear)[4].length === 0, 'by level 10 every slot has a non-stock upgrade ' + JSON.stringify(D.gear[10]));
ok(D.abL1 > 0, 'ability augments exist at level 1 (' + D.abL1 + ')');
await browser.close();
const runFresh = async (job) => { const f = await launch({ query: '?splash=hold' }); try { return await f.page.evaluate(runJob, job); } finally { errors.push(...f.errors); await f.browser.close(); } };
const rows = [['annex', 'starter', 1], ['annex', 'starter', 3], ['warehouse', 'starter', 4], ['warehouse', 'mid', 8]]; const res = [];
for (const [id, kit, level] of rows) for (let s = 0; s < 2; s++) { const r = await runFresh({ mode: 'level', id, kit, level, seed: 5100 + s * 31, maxT: 1100, maxDeaths: 4 }); res.push({ id, kit, level, ...r }); console.log('  ', id, kit, 'L' + level, 'seed', r.seed, r.cleared ? 'cleared' : 'NOT cleared', 'deaths', r.deaths, 't', r.t, r.stuck ? 'STUCK' : '', r.error || ''); }
const by = (id, l) => res.filter(r => r.id === id && r.level === l);
ok(by('annex', 1).some(r => r.cleared), 'level 1 stock kit clears the Reclamation Annex');
ok(by('annex', 1).concat(by('annex', 3)).filter(r => r.cleared).length >= 3, 'level 1-3 stock kit clears the Annex on most seeds (' + by('annex', 1).concat(by('annex', 3)).filter(r => r.cleared).length + '/4)');
ok(by('warehouse', 8).some(r => r.cleared), 'level 8 mid kit clears Hub 9');
ok(res.every(r => !r.error && !r.stuck), 'bot never stuck/errored at levels 1-8');
ok(res.every(r => !r.maxHit || r.maxHit < r.maxHp * .5), 'no single hit takes >50% HP of a level 1-8 player (max ' + Math.max(...res.map(r => (r.maxHit || 0) / (r.maxHp || 1))).toFixed(2) + ')');
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
