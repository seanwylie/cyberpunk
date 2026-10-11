// Heat bench: node tools/balance/heat.mjs [--secs 120] [--profile spam|skilled] [--kits starter,mid,purple,abpurple,heatmax] [--seeds 2]
// Stands the bot in front of an unkillable dummy and measures casts/min, overheats and lockout share per kit. Needs a dev server (URL env). See docs/BALANCE.md "Heat".
import { launch } from '../../tests/lib.mjs'; import { runJob } from './harness.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const secs = +arg('secs', 120), seeds = +arg('seeds', 2), kits = String(arg('kits', 'starter,mid,purple,abmid,abpurple,heatmax')).split(','), profiles = String(arg('profile', 'skilled,sloppy,spam')).split(',');
const LV = { starter: 20, mid: 20, blue: 30, purple: 34, abmid: 20, abpurple: 34, heatmax: 34 };
const ctx = await launch({ query: '?splash=hold' }); const out = [];
for (const profile of profiles) for (const kit of kits) { const rs = []; for (let s = 0; s < seeds; s++) rs.push(await ctx.page.evaluate(runJob, { mode: 'heat', id: 'annex', kit, profile, level: LV[kit] || 30, seed: 100 + s, secs, vent: +arg('vent', 0) }));
  const avg = k => rs.reduce((a, r) => a + (r.heat?.[k] ?? 0), 0) / rs.length; const row = { profile, kit, cooling: avg('cooling'), castsPerMin: +avg('castsPerMin').toFixed(1), overheatsPerMin: +(avg('overheats') * 60 / secs).toFixed(2), lockoutShare: +avg('overheatShare').toFixed(3), avgHeat: +avg('avgHeat').toFixed(1), abShare: +avg('abShare').toFixed(2), dps: +avg('dps').toFixed(1), abil: rs[0].kitInfo?.abilities };
  out.push(row); console.log(`${profile.padEnd(7)} ${kit.padEnd(9)} cool x${row.cooling} casts/min ${String(row.castsPerMin).padStart(5)} overheats/min ${String(row.overheatsPerMin).padStart(5)} lockout ${(row.lockoutShare*100).toFixed(0).padStart(3)}% avgHeat ${String(row.avgHeat).padStart(5)} abShare ${row.abShare}`); }
await ctx.browser.close(); if (arg('json', 0)) console.log(JSON.stringify(out));
