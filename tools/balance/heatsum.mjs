// node tools/balance/heatsum.mjs results.json [--all]  -> clear / deaths / overheats / casts for par runs. Runs where the bot got stuck on a layout (bot navigation limit, not balance) are excluded unless --all.
import fs from 'fs';
const { results } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const ALL = process.argv.includes('--all');
const all = results.filter(x => x.r && x.job.mode === 'level' && !x.r.error).map(x => x.r), rs = ALL ? all : all.filter(r => !(r.stuck > 0));
const n = rs.length, pct = x => (x * 100).toFixed(0) + '%', avg = f => rs.reduce((a, r) => a + f(r), 0) / n;
const clear = rs.filter(r => r.cleared); const tierC = {}; for (const r of rs) { const o = (tierC[r.tier || 0] ||= { n: 0, c: 0 }); o.n++; o.c += r.cleared ? 1 : 0; }
console.log(`runs ${n}/${all.length}${ALL ? '' : ' (stuck excluded)'}, clear ${pct(clear.length / n)}, clear with <=1 death ${pct(rs.filter(r => r.cleared && r.deaths <= 1).length / n)}, deaths/run ${avg(r => r.deaths).toFixed(2)}, mean clear time ${(clear.reduce((a, r) => a + r.t, 0) / Math.max(1, clear.length)).toFixed(0)}s`);
console.log(`overheats per min ${(avg(r => (r.heat?.overheats ?? 0) / (r.t / 60))).toFixed(2)}, lockout ${pct(avg(r => (r.heat?.overheatT ?? 0) / r.t))} of time, avg heat ${avg(r => r.heat?.avgHeat ?? 0).toFixed(0)}, casts/min ${avg(r => (r.heat?.casts ?? 0) / (r.t / 60)).toFixed(1)}`);
let dealt = 0, auto = 0; for (const r of rs) for (const [k, v] of Object.entries(r.dealt || {})) { dealt += v; if (k === 'auto') auto += v; } console.log(`ability damage share ${pct(1 - auto / dealt)}`);
console.log('clear by tier: ' + Object.entries(tierC).map(([t, o]) => `${t || 'base'} ${pct(o.c / o.n)}`).join(', '));
