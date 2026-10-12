// Boss-only A/B for the signature kit pass: same seeds, boss fights only, par kit per level. Usage: URL=http://127.0.0.1:5391/ node tools/balance/bosskits_ab.mjs out.json [seeds=4] [id,id,...]
// Compare two builds by running it once against each dev server (docs/BOSSES.md "Balance check").
import { launch } from '../../tests/lib.mjs'; import { runJob } from './harness.mjs'; import fs from 'fs';
const SET = [['annex', 'mid', 15], ['foundry', 'blue', 24], ['coke_ovens', 'mid', 18], ['tailings_pit', 'mid', 18], ['cold_archive', 'blue', 26], ['pharmacy_vault', 'blue', 26], ['liquidation_floor', 'purple', 35], ['night_tunnels', 'purple', 35], ['recall_yard', 'purple', 44]];
const out = process.argv[2] || '/tmp/ab.json', seeds = +(process.argv[3] || 4), only = (process.argv[4] || '').split(',').filter(Boolean);
const res = [];
for (const [id, kit, level] of SET) { if (only.length && !only.includes(id)) continue; for (let s = 0; s < seeds; s++) { const f = await launch({ query: '?splash=hold' }); if (process.env.NOKIT) await f.page.evaluate(async () => { const K = await import(performance.getEntriesByType('resource').map(r => r.name).find(n => /boss_kits\.ts/.test(n))); for (const k of Object.keys(K.KITS)) delete K.KITS[k]; });
  try { const r = await f.page.evaluate(runJob, { mode: 'level', id, kit, level, seed: 4000 + s * 53, bossOnly: true, maxDeaths: 4 }); res.push({ id, seed: s, cleared: r.cleared, deaths: r.deaths, t: r.t, bossTtk: r.bossTtk, maxHit: r.maxHit, maxHp: r.maxHp, dmg: r.dmgBy || r.dmgSrc || null }); } catch (e) { res.push({ id, seed: s, error: String(e).slice(0, 120) }); } finally { await f.browser.close(); }
  fs.writeFileSync(out, JSON.stringify(res)); console.log(id, s, JSON.stringify(res[res.length - 1]).slice(0, 200)); } }
const by = {}; for (const r of res) { (by[r.id] ??= []).push(r); }
for (const [id, a] of Object.entries(by)) console.log(id.padEnd(18), 'clear', a.filter(r => r.cleared).length + '/' + a.length, 'deaths/run', (a.reduce((x, r) => x + (r.deaths || 0), 0) / a.length).toFixed(2), 'ttk', Math.round(a.reduce((x, r) => x + (r.bossTtk || 0), 0) / a.length));
console.log('TOTAL clear', res.filter(r => r.cleared).length + '/' + res.length, 'deaths/run', (res.reduce((x, r) => x + (r.deaths || 0), 0) / res.length).toFixed(2));
