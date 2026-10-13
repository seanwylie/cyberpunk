// Standing still in boss attacks must be lethal (docs/BALANCE.md "Stand-still rule"): for every boss (dungeon + gateway), a bot at the dungeon's par level
// in par gear walks up to the boss and then never moves, attacks, dodges or stims. It must be downed, or under 20% HP, within LIMIT seconds.
// Early bosses (minLevel < 8: the level-1 band) stay forgiving but never free: under 50% HP within their longer window.
// Covers every dungeon boss, every condition (alternate) boss and every epic gateway (gw_*) boss. Also checks the per-hit cap still holds (no one-shots).
// Usage: node tests/boss_standstill.mjs [--only id,id] [--json out.json]   (needs a dev server, URL env)
import fs from 'fs'; import { launch } from './lib.mjs'; import { runJob } from '../tools/balance/harness.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const ONLY = arg('only', '') ? String(arg('only')).split(',') : null, WORKERS = +(process.env.WORKERS || 3);
const PARKIT = d => ({ annex: 'mid', warehouse: 'mid', foundry: 'blue', clinic: 'purple' }[d.id] || { 1: 'mid', 2: 'blue', 3: 'purple', 4: 'purple' }[d.tier] || 'mid');
const LIMIT = d => d.min < 8 ? 18 : 14; // seconds
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const probe = await launch(); const dd = await probe.page.evaluate(async () => { const D = await import('/src/content/dungeons.ts'); return Object.values(D.DUNGEONS).flatMap(d => { const b = { id: d.id, tier: d.tier || 0, min: d.minLevel, max: d.maxLevel, boss: d.defaultBoss, gw: !!d.gateway }; const alt = [...(d.conds || []).map(c => c.boss), ...(d.id === 'annex' ? ['warden', 'enforcer'] : [])].filter(x => x && x !== d.defaultBoss); return [b, ...alt.map(x => ({ ...b, boss: x, alt: true }))]; }); }); await probe.browser.close();
const seen = new Set(); const jobs = []; for (const d of dd) { const key = (d.gw ? 'gw:' : '') + d.boss; if (!d.boss || seen.has(key)) continue; if (ONLY && !ONLY.includes(d.id) && !ONLY.includes(d.boss)) continue; seen.add(key); jobs.push({ d, job: { mode: 'level', id: d.id, kit: PARKIT(d), level: Math.round((d.min + d.max) / 2), seed: 4242, profile: 'still', bossOnly: true, bossKey: d.alt ? d.boss : undefined, window: LIMIT(d) + 2 } }); }
const out = []; let qi = 0;
await Promise.all(Array.from({ length: Math.min(WORKERS, jobs.length) }, async () => { const { browser, page } = await launch({ query: '?splash=hold' }); await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
  while (qi < jobs.length) { const j = jobs[qi++]; let r; try { r = await page.evaluate(runJob, j.job); } catch (e) { r = { error: String(e).slice(0, 200) }; } out.push({ ...j, r }); }
  await browser.close(); }));
out.sort((a, b) => a.d.min - b.d.min);
for (const { d, job, r } of out) { const lim = LIMIT(d); const early = d.min < 8; const t = early ? r.t50 : (r.tDown ?? r.t20); const top = Object.entries(r.src || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + '=' + Math.round(v)).join(' ');
  ok(!r.error && r.reached && r.boss === d.boss && t !== null && t <= lim, `${d.boss} (${d.id}, L${job.level} ${job.kit}): ${r.error || (t === null ? 'survived ' + lim + 's at min ' + Math.round(r.hpMin * 100) + '%' : (early ? '<50%' : r.tDown != null ? 'down' : '<20%') + ' in ' + t + 's')} (limit ${lim}s; max hit ${Math.round((r.hitCapPct || 0) * 100)}% ${r.maxHitSrc || ''}; ${top})`);
  if (!r.error) ok((r.hitCapPct || 0) <= .45, `${d.boss}: no single hit above 45% max HP (${Math.round((r.hitCapPct || 0) * 100)}%)`); }
if (arg('json', '')) fs.writeFileSync(arg('json'), JSON.stringify(out, null, 1));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
