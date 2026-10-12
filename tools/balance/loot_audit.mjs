// Loot-economy audit: node tools/balance/loot_audit.mjs [--seeds 60] [--out tools/balance/out/loot_audit.json]
// Per dungeon: seeded runs at the dungeon's max level with max manufacturer rep (so every rarity gate is open), kill every enemy,
// attribute each ground drop to the enemy class (ordinary / elite / boss name). Then a farm model: a dedicated player at level L clears
// every on-level dungeon (minLevel<=L<=maxLevel) once per daily lockout, each run costing estMinutes midpoint + 1.5 min town overhead.
// Reports drops per rarity/tier/boss, expected hours to first orange and to a full orange set (all distinct oranges reachable at L). Needs a dev server (URL env).
import fs from 'fs'; import { launch } from '../../tests/lib.mjs';
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
        for (const x of g.inst.drops.slice(n0)) { if (x.kind !== 'item') continue; const it = Cfg.ITEM_BY_ID[x.inst.def]; agg.byTier[tier][it.rarity]++; if (x.inst.season) agg.seasonal++;
          if (def.boss) { const b = (agg.byBoss[def.name] = agg.byBoss[def.name] || { kills: 0, orange: 0, purple: 0 }); b[it.rarity] = (b[it.rarity] || 0) + 1; }
          if (it.rarity === 'orange') { gotO = true; agg.orangeIds[it.id] = (agg.orangeIds[it.id] || 0) + 1; } }
        if (def.boss) { const b = (agg.byBoss[def.name] = agg.byBoss[def.name] || { kills: 0, orange: 0, purple: 0 }); b.kills++; } }
      if (gotO) agg.runsWithOrange++; }
    out.push({ id: d.id, name: d.name, tier: d.tier || 0, minLevel: d.minLevel, maxLevel: d.maxLevel, est: d.estMinutes, ...agg }); }
  Math.random = real; g.enterTown(); return out; }, { SEEDS });
await browser.close();
// ---- farm model
const OVERHEAD = 1.5; const mins = d => (d.est[0] + d.est[1]) / 2 + OVERHEAD;
const per = d => { const o = {}; for (const r of ['grey', 'green', 'blue', 'purple', 'orange']) o[r] = (d.byTier.ordinary[r] + d.byTier.elite[r] + d.byTier.boss[r]) / d.runs; return o; };
const levels = [...new Set(res.flatMap(d => [d.maxLevel]))].sort((a, b) => a - b);
const farm = levels.map(L => { const ds = res.filter(d => d.minLevel <= L && L <= d.maxLevel && d.runs); const minutes = ds.reduce((a, d) => a + mins(d), 0); const orangePerDay = ds.reduce((a, d) => a + per(d).orange, 0);
  // P(no orange in a run) from observed runsWithOrange; first-orange hours = expected minutes of play until a run yields one (geometric over the daily loop)
  const pNone = ds.reduce((a, d) => a * (1 - d.runsWithOrange / d.runs), 1); const loops = 1 / Math.max(1e-9, 1 - pNone);
  // full set: distinct orange ids seen in these dungeons, coupon collector by Monte Carlo on per-run per-id rates
  const rate = {}; for (const d of ds) for (const [id, n] of Object.entries(d.orangeIds)) rate[id] = (rate[id] || 0) + n / d.runs;
  const ids = Object.keys(rate); let full = null; if (ids.length) { let tot = 0; const T = 400; for (let t = 0; t < T; t++) { const got = new Set(); let k = 0; while (got.size < ids.length && k < 1e5) { k++; for (const id of ids) if (Math.random() < Math.min(1, rate[id])) got.add(id); } tot += k; } full = tot / T * minutes / 60; }
  return { level: L, dungeons: ds.map(d => d.id), loopMinutes: minutes, orangePerLoop: orangePerDay, hoursFirstOrange: loops * minutes / 60, distinctOranges: ids.length, hoursFullSet: full }; });
fs.mkdirSync(OUT.replace(/[^/]*$/, ''), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify({ seeds: SEEDS, dungeons: res, farm }, null, 1));
const f = (x, n = 2) => x == null ? '-' : x.toFixed(n);
console.log('dungeon          tier lv     runs | items/run grey/green/blue/purple/orange | orange: ord/elite/boss per run | seasonal/run');
for (const d of res) { const p = per(d); console.log(d.id.padEnd(16), String(d.tier).padStart(3), (d.minLevel + '-' + d.maxLevel).padEnd(6), String(d.runs).padStart(4), '|', ['grey', 'green', 'blue', 'purple', 'orange'].map(r => f(p[r], 3)).join('/').padEnd(36), '|', ['ordinary', 'elite', 'boss'].map(t => f(d.byTier[t].orange / d.runs, 3)).join('/'), '|', f(d.seasonal / d.runs, 3)); }
console.log('\nboss                                  kills  orange/kill  purple/kill');
for (const d of res) for (const [b, v] of Object.entries(d.byBoss)) console.log((d.id + ': ' + b).slice(0, 38).padEnd(38), String(v.kills).padStart(5), f(v.orange / v.kills, 3).padStart(11), f((v.purple || 0) / v.kills, 3).padStart(12));
console.log('\nfarm @level  dungeons  loop(min)  orange/loop  hrs->1st orange  distinct  hrs->full set');
for (const r of farm) console.log(String(r.level).padStart(11), String(r.dungeons.length).padStart(9), f(r.loopMinutes, 0).padStart(10), f(r.orangePerLoop, 3).padStart(12), f(r.hoursFirstOrange, 1).padStart(16), String(r.distinctOranges).padStart(9), f(r.hoursFullSet, 1).padStart(14));
