// Ability acquisition curve (docs/ABILITIES.md): runs the real loot code for many simulated runs and reports median runs to the first new ability,
// share of ability-bearing augments by rarity per progression stage, and that overall drop volume is not inflated (DROP_RATE_SCALE respected).
import { launch } from './lib.mjs';
import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const R = await page.evaluate(async () => {
  const g = window.__game, Cfg = await import('/src/config.ts'), HW = await import('/src/abilities/hw.ts'), real = Math.random;
  const seeded = seed => { let rs = (seed * 2654435761) >>> 0 || 1; Math.random = () => { rs += 0x6D2B79F5; let t = rs; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  g.addXp = () => {}; // harness: no level-ups while killing, so each stage keeps its level
  const tiers = Object.keys(Cfg.ENEMIES).length; const out = { stages: {}, first: [] };
  const fresh = (level, rank) => { localStorage.setItem('wv_notut', '1'); g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.save.level = level; g.save.rep = { HI: rank * 30, PS: rank * 30, MM: rank * 30 }; g.save.cleared = Object.fromEntries((window.__ids || []).map(i => [i, 1])); g.save.codex = undefined; g.save.abAcq = { total: 0, dry: 0 }; g.save.items = g.save.items.filter(i => i.def.startsWith('stock_')); g.recompute(); g.codexScan(); };
  window.__ids = (await import('/src/content/dungeons.ts')).DUNGEON_IDS; const stage = (name, level, rank, dungeon, n, seed0) => {
    fresh(level, rank); const rarCount = { grey: 0, green: 0, blue: 0, purple: 0, orange: 0 }; let gear = 0, abItems = 0, newFound = 0; const firstRuns = []; let runsToFirst = null; const perRun = [];
    for (let r = 0; r < n; r++) { seeded(seed0 + r); g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; if (!g.startRun(dungeon)) throw new Error('no run ' + dungeon); g.revealing = false;
      for (const e of [...g.enemies]) if (e.faction === 'enemy' && !e.dead) g.killEnemy(e);
      g.rollLoot({ type: g.dd.defaultBoss, x: g.px + 1, y: g.py, affix: [] }); // a full clear also kills the boss (it spawns after the objective)
      let abThis = 0, gThis = 0; for (const d of [...g.inst.drops]) { if (d.kind === 'credits') continue; gThis++; g.px = d.x; g.py = d.y; g.autoPickup(); const c = g.inst.carried; if (d.kind === 'item') { const def = Cfg.ITEM_BY_ID[d.inst.def]; if (def.abilities?.length) { abThis++; rarCount[def.rarity]++; } } if (c.items.length > 10) { g.save.items.push(...c.items.splice(0)); } }
      g.save.items.push(...g.inst.carried.items.splice(0)); gear += gThis; abItems += abThis; perRun.push(abThis);
      const before = Object.keys(g.save.codex || {}).length; g.codexScan(); const nf = Object.keys(g.save.codex || {}).length - before; if (nf > 0 && runsToFirst === null) runsToFirst = r + 1; newFound += Math.max(0, nf); g.enterTown(); }
    Math.random = real; return { name, runs: n, gear: gear / n, abItems: abItems / n, share: gear ? abItems / gear : 0, rarCount, newFound, runsToFirst, runsWithAb: perRun.filter(x => x > 0).length, perRun }; };
  // many seeds for "runs to first ability" on a brand-new save (level 1, no reputation)
  const firsts = []; for (let k = 0; k < 25; k++) { const s = stage('first' + k, 1, 0, 'annex', 6, 1000 + k * 17); firsts.push(s.runsToFirst ?? 99); } out.firsts = firsts;
  out.stages.early = stage('early (L1, rep 0, Annex)', 1, 0, 'annex', 50, 11);
  const ids = Object.keys((await import('/src/content/dungeons.ts')).DUNGEONS || {}); out.dungeons = ids;
  const DM = await import('/src/content/dungeons.ts'); g.save.cleared = Object.fromEntries(DM.DUNGEON_IDS.map(i => [i, 1]));
  out.stages.mid = stage('mid (L24, rank 1, Foundry)', 24, 1, 'foundry', 100, 111);
  out.stages.late = stage('late (L40, rank 3, tier IV)', 40, 3, DM.DUNGEON_IDS.filter(i => !DM.DUNGEONS[i].gateway).at(-1) /* top regular dungeon; gateways are longer, so extra trash dilutes the rare share */, 100, 211);
  out.knob = Cfg.DROP_RATE_SCALE; out.acq = JSON.parse(JSON.stringify(HW.ABILITY_ACQ)); return out; });
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const e = R.stages.early, m = R.stages.mid, l = R.stages.late; console.log(JSON.stringify({ firsts: R.firsts, early: { ...e, perRun: undefined }, mid: { ...m, perRun: undefined }, late: { ...l, perRun: undefined } }));
ok(med(R.firsts) <= 1, `median runs to first NEW ability on a fresh save: ${med(R.firsts)} (max ${Math.max(...R.firsts)}) over 25 fresh saves`);
ok(Math.max(...R.firsts) <= 2, 'every fresh save finds an ability augment within 2 runs (pity)');
ok(e.runsWithAb >= 30, `early: ${e.runsWithAb}/50 runs yield an ability-bearing augment`);
const ec = e.rarCount; const eTot = Object.values(ec).reduce((a, b) => a + b, 0);
ok((ec.grey + ec.green) / eTot >= .6, `early ability augments are mostly common: ${(100 * (ec.grey + ec.green) / eTot).toFixed(0)}% grey/green`);
ok(ec.purple + ec.orange <= eTot * .08 && ec.orange === 0, `early: purple+orange rare (${ec.purple}+${ec.orange} of ${eTot}), no orange at rank 0`);
const mc = m.rarCount, mTot = Object.values(mc).reduce((a, b) => a + b, 0), lc = l.rarCount, lTot = Object.values(lc).reduce((a, b) => a + b, 0);
ok(mc.blue / mTot > ec.blue / eTot, `blue share grows mid-game: ${(100 * ec.blue / eTot).toFixed(0)}% -> ${(100 * mc.blue / mTot).toFixed(0)}%`);
ok((lc.purple + lc.orange) / lTot > (mc.purple + mc.orange) / mTot && (lc.purple + lc.orange) / lTot >= .06, `late-game rares: ${(100 * (lc.purple + lc.orange) / lTot).toFixed(0)}% purple+orange (still a minority: ${((lc.grey + lc.green) / lTot * 100).toFixed(0)}% common)`);
ok(lc.purple + lc.orange < lTot * .5, 'rare abilities stay a minority even late');
ok(e.gear <= 9 && e.gear >= 3, `volume respected: ${e.gear.toFixed(1)} gear drops/run at DROP_RATE_SCALE ${R.knob} (ability augments ${e.abItems.toFixed(1)} of them, ${(100 * e.share).toFixed(0)}%)`);
ok(e.share >= .2, 'ability-bearing augments are a high share of early drops (>=20%)');
fs.mkdirSync('tools/balance/out', { recursive: true }); fs.writeFileSync('tools/balance/out/ability_acq.json', JSON.stringify({ firsts: R.firsts, medianRunsToFirst: med(R.firsts), stages: Object.fromEntries(Object.entries(R.stages).map(([k, v]) => [k, { ...v, perRun: undefined }])), acq: R.acq }, null, 1));
ok(!errors.length, 'no page errors ' + errors.join('|'));
await browser.close(); process.exit(fails ? 1 : 0);
