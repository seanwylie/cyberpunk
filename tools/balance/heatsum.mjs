// node tools/balance/heatsum.mjs results.json  -> clear / deaths / overheats / casts for par runs (heat metrics come from the harness 'heat' field)
import fs from 'fs';
const { meta, results } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const rs = results.filter(x => x.r && x.job.mode === 'level' && !x.r.error).map(x => x.r);
const n = rs.length, pct = x => (x * 100).toFixed(0) + '%', avg = f => rs.reduce((a, r) => a + f(r), 0) / n;
const clear = rs.filter(r => r.cleared); const tierC = {}; for (const r of rs) { const o = (tierC[r.tier || 0] ||= { n: 0, c: 0 }); o.n++; o.c += r.cleared ? 1 : 0; }
console.log(`runs ${n}, clear ${pct(clear.length / n)}, deaths/run ${avg(r => r.deaths).toFixed(2)}, mean clear time ${(clear.reduce((a, r) => a + r.t, 0) / Math.max(1, clear.length)).toFixed(0)}s`);
console.log(`overheats/run ${avg(r => r.heat?.overheats ?? 0).toFixed(1)}, overheats per min ${(avg(r => (r.heat?.overheats ?? 0) / (r.t / 60))).toFixed(2)}, lockout ${pct(avg(r => (r.heat?.overheatT ?? 0) / r.t))} of time, avg heat ${avg(r => r.heat?.avgHeat ?? 0).toFixed(0)}, casts/min ${avg(r => (r.heat?.casts ?? 0) / (r.t / 60)).toFixed(1)}`);
console.log('clear by tier: ' + Object.entries(tierC).map(([t, o]) => `${t || 'base'} ${pct(o.c / o.n)}`).join(', '));
