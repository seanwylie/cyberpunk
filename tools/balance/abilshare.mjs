// node tools/balance/abilshare.mjs results.json  -> ability damage share and cast counts for par-kit level runs
import fs from 'fs';
const { meta, results } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const PARKIT = d => ({ annex: 'mid', warehouse: 'mid', foundry: 'blue', clinic: 'purple' }[d.id] || { 1: 'mid', 2: 'blue', 3: 'purple', 4: 'purple' }[d.tier]);
const rs = results.filter(x => x.r && x.job.mode === 'level' && !x.r.error).map(x => x.r).filter(r => { const d = meta.dd.find(d => d.id === r.id); return d && PARKIT(d) === r.kit; });
const sum = (o, k) => o[k] || 0;
const tot = { auto: 0 }, casts = {}; let cleared = 0, tm = 0;
for (const r of rs) { for (const [k, v] of Object.entries(r.dealt || {})) tot[k] = (tot[k] || 0) + v; for (const [k, v] of Object.entries(r.abil || {})) casts[k] = (casts[k] || 0) + v; if (r.cleared) { cleared++; tm += r.t; } }
const all = Object.values(tot).reduce((a, b) => a + b, 0), ab = all - (tot.auto || 0);
const pct = x => (x * 100).toFixed(1) + '%';
const perTier = {}; for (const r of rs) { const t = r.tier || 0; const o = (perTier[t] ||= { ab: 0, all: 0, n: 0, cl: 0, casts: 0, time: 0 }); const a = Object.values(r.dealt || {}).reduce((x, y) => x + y, 0); o.all += a; o.ab += a - (r.dealt?.auto || 0); o.n++; o.cl += r.cleared ? 1 : 0; o.casts += Object.values(r.abil || {}).reduce((x, y) => x + y, 0); o.time += r.t; }
console.log(`par runs ${rs.length}, clear ${pct(cleared / rs.length)}, mean clear time ${(tm / Math.max(1, cleared)).toFixed(0)}s`);
console.log(`ability damage share ${pct(ab / all)} (auto ${pct((tot.auto || 0) / all)}); casts per run ${(Object.values(casts).reduce((a, b) => a + b, 0) / rs.length).toFixed(1)}`);
console.log('damage by source (%): ' + Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v / all)}`).join(', '));
console.log('casts per run: ' + Object.entries(casts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / rs.length).toFixed(1)}`).join(', '));
for (const t of Object.keys(perTier).sort()) { const o = perTier[t]; console.log(`  tier ${t || 'base'}: ability share ${pct(o.ab / o.all)}, clear ${pct(o.cl / o.n)}, casts/run ${(o.casts / o.n).toFixed(1)}, time ${(o.time / o.n).toFixed(0)}s`); }
