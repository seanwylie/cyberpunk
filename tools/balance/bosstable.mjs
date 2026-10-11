// node tools/balance/bosstable.mjs boss_skilled.json [boss_tank.json]  -> per-boss table (clear, clear with <=1 death, deaths, boss fight time, damage taken by source)
import fs from 'fs';
const load = f => JSON.parse(fs.readFileSync(f, 'utf8')); const A = load(process.argv[2]), B = process.argv[3] ? load(process.argv[3]) : null;
const group = D => { const m = {}; for (const x of D.results) if (x.r && !x.r.error) (m[x.r.id] ||= []).push(x.r); return m; };
const a = group(A), b = B ? group(B) : {}; const tier = {}; for (const d of A.meta.dd) tier[d.id] = d.tier || 0;
const pct = (n, d) => d ? Math.round(n / d * 100) + '%' : '-';
console.log('| level | tier | boss | skilled clear | <=1 death | deaths/run | boss fight (s) | top damage source | tank clear |'); console.log('|---|---|---|---|---|---|---|---|---|');
let n = 0, c = 0, c1 = 0; const T = {};
for (const id of Object.keys(a)) { const rs = a[id]; const cl = rs.filter(r => r.cleared), c1r = rs.filter(r => r.cleared && r.deaths <= 1); n += rs.length; c += cl.length; c1 += c1r.length; const t = (T[tier[id]] ||= { n: 0, c: 0 }); t.n += rs.length; t.c += c1r.length;
  const src = {}; for (const r of rs) for (const [k, v] of Object.entries(r.src || {})) src[k] = (src[k] || 0) + v; const top = Object.entries(src).sort((x, y) => y[1] - x[1])[0];
  const ft = cl.filter(r => r.bossFightT).map(r => r.bossFightT); const tk = b[id] || [];
  console.log(`| ${id} | ${tier[id] || 'base'} | ${rs[0].boss} | ${pct(cl.length, rs.length)} | ${pct(c1r.length, rs.length)} | ${(rs.reduce((s, r) => s + r.deaths, 0) / rs.length).toFixed(1)} | ${ft.length ? Math.round(ft.reduce((x, y) => x + y, 0) / ft.length) : '-'} | ${top ? top[0] : '-'} | ${tk.length ? pct(tk.filter(r => r.cleared).length, tk.length) : '-'} |`); }
console.log(`\noverall: clear ${pct(c, n)}, <=1 death ${pct(c1, n)}; per tier (<=1 death): ` + Object.entries(T).map(([t, o]) => `${t === '0' ? 'base' : t} ${pct(o.c, o.n)}`).join(', '));
