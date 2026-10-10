// Balance runner: node tools/balance/run.mjs [--out tools/balance/out/results.json] [--seeds 3] [--workers 4] [--only id,id] [--kits starter,mid,purple,orange] [--mobs]
// Needs a dev server (URL env, default http://localhost:5173/). Writes raw JSON; tools/balance/report.mjs summarises it.
import fs from 'fs'; import { launch } from '../../tests/lib.mjs'; import { runJob } from './harness.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const OUT = arg('out', 'tools/balance/out/results.json'), SEEDS = +arg('seeds', 3), WORKERS = +arg('workers', 4), KITS = String(arg('kits', 'starter,mid,blue,purple,orange')).split(','), ONLY = arg('only', '') ? String(arg('only', '')).split(',') : null, MOBS = process.argv.includes('--mobs'), LEVELS = !process.argv.includes('--no-levels');
fs.mkdirSync(OUT.replace(/[^/]*$/, ''), { recursive: true });
const probe = await launch(); const meta = await probe.page.evaluate(async () => { const D = await import('/src/content/dungeons.ts'), M = await import('/src/content/batch2_mobs.ts'); const dd = Object.values(D.DUNGEONS).map(d => ({ id: d.id, tier: d.tier || 0, min: d.minLevel, max: d.maxLevel, boss: d.defaultBoss, name: d.short })); return { dd, mobs: M.MOBS.map(m => ({ id: m.id, tier: m.tier, role: m.role })) }; }); await probe.browser.close();
export const PARKIT = d => ({ annex: 'mid', warehouse: 'mid', foundry: 'blue', clinic: 'purple' }[d.id] || { 1: 'mid', 2: 'blue', 3: 'purple', 4: 'purple' }[d.tier]);
const PAR_ONLY = process.argv.includes('--par'); const lvlFor = d => Math.round((d.min + d.max) / 2);
const jobs = [];
if (LEVELS) for (const d of meta.dd) { if (ONLY && !ONLY.includes(d.id)) continue; for (const kit of (PAR_ONLY ? [PARKIT(d)] : KITS)) for (let s = 0; s < SEEDS; s++) jobs.push({ mode: 'level', id: d.id, kit, level: lvlFor(d), seed: 1000 + s * 77 + d.id.length, maxT: 1100, maxDeaths: 4 }); }
// mob duels: 3 of one mob vs the par kit for the mob's tier (and the next kit down for reference)
const PAR = { 1: ['mid', 18], 2: ['blue', 26], 3: ['purple', 35], 4: ['purple', 44] }, DOWN = { mid: 'starter', blue: 'mid', purple: 'blue' };
if (MOBS) for (const m of meta.mobs) { if (ONLY && !ONLY.includes(m.id)) continue; const [kit, level] = PAR[m.tier]; for (const [k, lv] of [[kit, level], [DOWN[kit], level]]) if (KITS.includes(k)) for (let s = 0; s < 3; s++) jobs.push({ mode: 'mob', id: m.id, kit: k, level: lv, seed: 500 + s * 31, n: 3, tier: m.tier, par: k === kit }); }
console.error(`${jobs.length} jobs, ${WORKERS} workers`);
const results = []; let next = 0, done = 0; const t0 = Date.now();
async function worker(w) {
  let ctx = await launch({ query: '?splash=hold' }); let n = 0;
  while (true) { const i = next++; if (i >= jobs.length) break; const job = jobs[i];
    try { const r = await ctx.page.evaluate(runJob, job); results.push({ job, r }); } catch (e) { results.push({ job, err: String(e).slice(0, 300) }); try { await ctx.browser.close(); } catch {} ctx = await launch({ query: '?splash=hold' }); }
    done++; if (done % 10 === 0) console.error(`${done}/${jobs.length} ${((Date.now() - t0) / 1000) | 0}s`);
    if (++n % 12 === 0) { await ctx.browser.close(); ctx = await launch({ query: '?splash=hold' }); } // keep page memory bounded
  }
  await ctx.browser.close(); }
await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)));
fs.writeFileSync(OUT, JSON.stringify({ meta, results }, null, 1)); console.error('wrote ' + OUT);
