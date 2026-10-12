// Loot-economy audit: node tools/balance/loot_audit.mjs [--seeds 60] [--out tools/balance/out/loot_audit.json]
// Per dungeon: seeded runs at the dungeon's max level with max manufacturer rep (so every rarity gate is open), kill every enemy,
// attribute each ground drop to the enemy class (ordinary / elite / boss name). Then a farm model: a dedicated player at level L clears
// every on-level dungeon (minLevel<=L<=maxLevel) once per daily lockout, each run costing estMinutes midpoint + 1.5 min town overhead.
// Reports drops per rarity/tier/boss, expected hours to first orange and to a full orange set (all distinct oranges reachable at L). Needs a dev server (URL env).
import fs from 'fs'; import { launch } from '../../tests/lib.mjs'; import { runModel } from './prestige_sim.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const SEEDS = +arg('seeds', 60), OUT = arg('out', 'tools/balance/out/loot_audit.json');
const { browser, page } = await launch({ query: '?splash=hold' });
const res = await page.evaluate(async ({ SEEDS }) => {
  const g = window.__game; const [Cfg, Dun] = await Promise.all([import('/src/config.ts'), import('/src/content/dungeons.ts')]);
  const R = ['grey', 'green', 'blue', 'purple', 'orange']; const out = []; const real = Math.random;
  for (const d of Object.values(Dun.DUNGEONS)) { const agg = { runs: 0, byTier: { ordinary: {}, elite: {}, boss: {} }, byBoss: {}, orangeIds: {}, seasonal: 0, runsWithOrange: 0, elites: 0 };
    for (const t of Object.values(agg.byTier)) for (const r of R) t[r] = 0;
    for (let s = 0; s < SEEDS; s++) {
      let rs = (s * 2654435761 + d.id.length * 977 + 17) >>> 0 || 1; Math.random = () => { rs += 0x6D2B79F5; let t = rs; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.cleared = {}; for (const k of Object.keys(Dun.DUNGEONS)) g.save.cleared[k] = 1; g.save.settings.devFreeReset = true; g.save.level = d.maxLevel; g.save.rep = { HI: 99999, PS: 99999, MM: 99999 };
      if (s === 0) g.save.lootEco = undefined; // prestige pity carries across this dungeon's runs, like a real farm
      if (!g.startRun(d.id)) continue; agg.runs++; let gotO = false;
      // every boss option the run can offer (default + condition bosses), rotated across seeds; spawned after the trash so it is killed last
      const opts = [...new Set([d.defaultBoss, ...(d.conds || []).map(c => c.boss), ...(d.id === 'annex' ? ['warden', 'enforcer'] : [])].filter(Boolean))];
      const kills = () => [...g.enemies].filter(e => e.faction === 'enemy' && !e.dead);
      const order = kills(); g.inst.flags.controller = true; g.inst.flags.bossKey = opts[s % opts.length]; g.spawnBoss(); for (const e of kills()) if (!order.includes(e)) order.push(e);
      for (const e of order) { if (e.faction !== 'enemy' || e.dead) continue; const def = Cfg.ENEMIES[e.type]; const tier = def.boss ? 'boss' : (def.elite || e.affix?.length) ? 'elite' : 'ordinary';
        const n0 = g.inst.drops.length; if (tier === 'elite') agg.elites++; g.killEnemy(e);
        for (const x of g.inst.drops.slice(n0)) { if (x.kind !== 'item') continue; const it = Cfg.ITEM_BY_ID[x.inst.def]; agg.byTier[tier][it.rarity]++; if (x.prestige === 'seasonal') agg.seasonal++;
          if (def.boss) { const b = (agg.byBoss[def.name] = agg.byBoss[def.name] || { kills: 0, orange: 0, purple: 0 }); b[it.rarity] = (b[it.rarity] || 0) + 1; }
          if (it.rarity === 'orange') { gotO = true; agg.orangeIds[it.id] = (agg.orangeIds[it.id] || 0) + 1; } }
        if (def.boss) { const b = (agg.byBoss[def.name] = agg.byBoss[def.name] || { kills: 0, orange: 0, purple: 0 }); b.kills++; } }
      if (gotO) agg.runsWithOrange++; }
    out.push({ id: d.id, name: d.name, tier: d.tier || 0, minLevel: d.minLevel, maxLevel: d.maxLevel, est: d.estMinutes, ...agg }); }
  Math.random = real; g.enterTown(); return out; }, { SEEDS });
// ---- farm model: the SAME hidden-roll model tests/loot_economy.mjs asserts on (tools/balance/prestige_sim.mjs), so the two always agree.
// Per-dungeon drops above come from a few seeded runs each and are too sparse to time a ~0.4%-per-boss roll; the hours come from the model.
const levels = [...new Set(res.map(d => d.maxLevel))].sort((a, b) => a - b); const PLAYERS = +arg('players', 120);
const farm = { inSeason: await runModel(page, { players: PLAYERS, levels, seed: 11, season: true }), offSeason: await runModel(page, { players: PLAYERS, levels, seed: 13, season: false }) };
await browser.close();
fs.mkdirSync(OUT.replace(/[^/]*$/, ''), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify({ seeds: SEEDS, dungeons: res, farm }, null, 1));
const f = (x, n = 2) => x == null ? '-' : x.toFixed(n);
console.log('dungeon          tier lv     runs | items/run grey/green/blue/purple/orange | orange: ord/elite/boss per run | seasonal/run');
for (const d of res) { const p = per(d); console.log(d.id.padEnd(16), String(d.tier).padStart(3), (d.minLevel + '-' + d.maxLevel).padEnd(6), String(d.runs).padStart(4), '|', ['grey', 'green', 'blue', 'purple', 'orange'].map(r => f(p[r], 3)).join('/').padEnd(36), '|', ['ordinary', 'elite', 'boss'].map(t => f(d.byTier[t].orange / d.runs, 3)).join('/'), '|', f(d.seasonal / d.runs, 3)); }
console.log('\nboss                                  kills  orange/kill  purple/kill');
for (const d of res) for (const [b, v] of Object.entries(d.byBoss)) console.log((d.id + ': ' + b).slice(0, 38).padEnd(38), String(v.kills).padStart(5), f(v.orange / v.kills, 3).padStart(11), f((v.purple || 0) / v.kills, 3).padStart(12));
for (const [k, rows] of Object.entries(farm)) { console.log('\nfarm ' + k + ' (hidden prestige roll, dedicated solo player)\nlevel  dungeons  loop(min)  hrs->1st orange (mean/p90)  hrs->1st seasonal  orange/h  hrs->full set');
  for (const r of rows) console.log(String(r.level).padStart(5), String(r.dungeons).padStart(9), f(r.loopMin, 0).padStart(10), (f(r.firstMean, 1) + '/' + f(r.firstP90, 1)).padStart(26), f(r.seasonalMean, 1).padStart(18), f(r.orangePerHour, 3).padStart(9), f(r.fullMean, 1).padStart(14)); }
