// Prestige-economy farm model: node tools/balance/prestige_sim.mjs [--players 400] [--out tools/balance/out/prestige_sim.json]
// Drives the REAL src/loot_eco.ts roll (oranges and season exclusives come from nowhere else) for simulated dedicated players.
// A player at level L loops every on-level dungeon (minLevel<=L<=maxLevel) once per daily lockout: one boss + ELITES elites per run,
// each run costing estMinutes midpoint + 1.5 min town overhead. Reports hours to the first orange, to every orange reachable at L
// (full set, shard rebuilds counted), and pity usage. Needs a dev server (URL env). Exported runModel() is shared with tests/loot_economy.mjs.
import fs from 'fs'; import { launch } from '../../tests/lib.mjs';
export const MODEL_SRC = async ({ players, levels, seed, season, elites, partySize, gatewayOnly }) => {
  const [E, Dun, W, Cfg] = await Promise.all([import('/src/loot_eco.ts'), import('/src/content/dungeons.ts'), import('/src/world.ts'), import('/src/config.ts')]);
  let rs = seed >>> 0 || 1; const rnd = () => { rs += 0x6D2B79F5; let t = rs; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const now = season ? Date.parse('2026-11-01T00:00:00Z') : Date.parse('2027-06-01T00:00:00Z');
  const D = Object.values(Dun.DUNGEONS); const sigOf = d => { const t = d.id === 'annex' ? Cfg.LOOT.signature : d.signature; return t ? Object.entries(t).map(([b, v]) => ({ boss: b, item: v.item })) : []; };
  const out = [];
  for (const L of levels) { const ds = D.filter(d => d.minLevel <= L && L <= d.maxLevel && (!gatewayOnly || W.GATEWAY_BY_DUNGEON[d.id])); if (!ds.length) continue;
    const loopMin = ds.reduce((a, d) => a + (d.estMinutes[0] + d.estMinutes[1]) / 2 + 1.5, 0);
    const reach = new Set(); for (const d of ds) { for (const s of sigOf(d)) if (Cfg.ITEM_BY_ID[s.item].lvl <= Math.min(L, d.tierCap)) reach.add(s.item); for (const id of E.generalOranges(new Set(Cfg.ITEMS.filter(x => x.id.startsWith('sig_')).map(x => x.id)))) if (Cfg.ITEM_BY_ID[id].lvl <= Math.min(L, d.tierCap)) reach.add(id); }
    const first = [], full = [], seasonal = [], pityHits = []; let orangeTot = 0, killsTot = 0, minutesTot = 0, shardTot = 0, seasTot = 0;
    for (let p = 0; p < players; p++) { const save = { level: L, cosmetics: { owned: {} } }; let min = 0, tFirst = null, tFull = null, tSeas = null, pity = 0; const have = new Set();
      for (let loop = 0; loop < 4000 && (tFull === null || tFirst === null || (season && tSeas === null)); loop++) for (const d of ds) { min += (d.estMinutes[0] + d.estMinutes[1]) / 2 + 1.5; const sigs = sigOf(d);
        const kills = [...Array(elites).fill('elite'), 'boss'];
        for (const tier of kills) { const b = tier === 'boss' && sigs.length ? sigs[Math.floor(rnd() * sigs.length)] : null; killsTot += tier === 'boss' ? 1 : 0;
          const a = E.rollPrestige(save, { tier, dungeonTier: d.tier || 0, gateway: !!W.GATEWAY_BY_DUNGEON[d.id], party: partySize || 1, contributed: true, level: L, tierCap: d.tierCap, bossSig: b ? [b.item] : [], now, rnd });
          if (!a) continue; if (a.pity) pity++;
          if (a.kind === 'orange') { orangeTot++; have.add(a.item); if (tFirst === null) tFirst = min; }
          else if (a.kind === 'seasonal') { seasTot++; if (tSeas === null) tSeas = min; }
          else shardTot++;
          const e = E.ecoOf(save); while (e.shards >= E.LOOT_ECO.shardCost) { const miss = [...reach].find(id => !have.has(id)); if (!miss) break; e.shards -= E.LOOT_ECO.shardCost; e.seen[miss] = now; have.add(miss); }
          if (tFull === null && [...reach].every(id => have.has(id))) tFull = min; } }
      minutesTot += min; first.push(tFirst / 60); if (tFull !== null) full.push(tFull / 60); if (tSeas !== null) seasonal.push(tSeas / 60); pityHits.push(pity); }
    const med = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; }; const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; const pct = (a, q) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length * q)] : null; };
    out.push({ level: L, dungeons: ds.length, loopMin, reach: reach.size, firstMean: mean(first), firstMed: med(first), firstP90: pct(first, .9), fullMean: mean(full), fullMed: med(full), seasonalMean: mean(seasonal), orangePerHour: orangeTot / (minutesTot / 60), seasonalPerHour: seasTot / (minutesTot / 60), shardPerHour: shardTot / (minutesTot / 60), pityPerPlayer: mean(pityHits), bossKillsPerOrange: killsTot / Math.max(1, orangeTot) }); }
  return out; };
export async function runModel(page, o) { return page.evaluate(MODEL_SRC, { players: 300, levels: [20, 24, 30, 34, 42, 50], seed: 7, season: true, elites: 4, partySize: 1, gatewayOnly: false, ...o }); }
if (import.meta.url === 'file://' + process.argv[1]) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] ?? true); };
  const { browser, page } = await launch({ query: '?splash=hold' }); const players = +arg('players', 400);
  const res = { inSeason: await runModel(page, { players, season: true }), offSeason: await runModel(page, { players, season: false }) };
  await browser.close(); const OUT = arg('out', 'tools/balance/out/prestige_sim.json'); fs.mkdirSync(OUT.replace(/[^/]*$/, ''), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  const f = (x, n = 1) => x == null ? '-' : x.toFixed(n);
  for (const [k, rows] of Object.entries(res)) { console.log('\n' + k + ' (dedicated solo player, every on-level dungeon once per lockout)');
    console.log('lvl  dgns loop(min) reach | 1st orange h: mean/med/p90 | full set h mean | 1st seasonal h | orange/h  seasonal/h shards/h | pity/player boss-kills/orange');
    for (const r of rows) console.log(String(r.level).padStart(3), String(r.dungeons).padStart(5), f(r.loopMin, 0).padStart(9), String(r.reach).padStart(5), '|', [r.firstMean, r.firstMed, r.firstP90].map(x => f(x)).join('/').padStart(24), '|', f(r.fullMean).padStart(14), '|', f(r.seasonalMean).padStart(14), '|', f(r.orangePerHour, 3).padStart(8), f(r.seasonalPerHour, 3).padStart(10), f(r.shardPerHour, 3).padStart(8), '|', f(r.pityPerPlayer, 2).padStart(11), f(r.bossKillsPerOrange, 0).padStart(17)); } }
