// node tools/balance/bosssum.mjs results.json [more.json]  -> per-tier boss win/loss summary for a --boss run (tank or skilled)
import fs from 'fs';
for (const f of process.argv.slice(2)) { const { meta, results } = JSON.parse(fs.readFileSync(f, 'utf8')); const rs = results.filter(x => x.r && !x.r.error).map(x => x.r); const errs = results.filter(x => x.err || (x.r && x.r.error)).length;
  console.log(f, 'jobs', results.length, 'errors', errs); const by = {};
  for (const r of rs) (by[r.tier] ||= []).push(r);
  let all = []; for (const t of Object.keys(by).sort()) { const a = by[t]; all = all.concat(a); const win = a.filter(r => r.cleared && r.deaths <= (a[0].job?.maxDeaths ?? 1) - 1).length; console.log(`  tier ${t}: clear ${Math.round(100 * a.filter(r => r.cleared).length / a.length)}%  (n=${a.length}) avg deaths ${(a.reduce((x, r) => x + r.deaths, 0) / a.length).toFixed(2)} avg fight ${(a.reduce((x, r) => x + (r.t || 0), 0) / a.length).toFixed(0)}s`); }
  console.log(`  ALL: clear ${Math.round(100 * all.filter(r => r.cleared).length / all.length)}% (n=${all.length})`);
  const per = {}; for (const r of rs) (per[r.id] ||= []).push(r.cleared ? 1 : 0); console.log('  per dungeon win:', Object.entries(per).map(([k, v]) => k + ':' + v.join('')).join(' ')); }
