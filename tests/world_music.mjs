// Per-town music (docs/WORLD.md): every generated district has its own pool of >= 6 generated tracks (no track shared with another town), every
// file exists, travelling switches the town pool, and the shuffle bag rotates through the pool without repeats.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const r = await page.evaluate(async () => { const M = await import('/src/music.ts'), W = await import('/src/world.ts'); const g = window.__game, mm = window.__audio?.music; const out = [];
  const owner = {}; for (const [t, p] of Object.entries(M.TOWN_POOLS)) for (const n of p) (owner[n] ??= []).push(t);
  for (const t of W.WORLD) { const pool = M.TOWN_POOLS[t.id] || []; const shared = pool.filter(n => owner[n].length > 1);
    const miss = []; for (const n of pool) { const r = await fetch('/audio/music/' + n + '.mp3', { method: 'HEAD' }); if (!r.ok || !/audio|mpeg/.test(r.headers.get('content-type') || '')) miss.push(n); }
    const w = (g.save.world ??= { visited: {}, landmarks: {} }); (w.unlocked ??= {})[t.id] = 1; if (g.townId !== t.id) g.travel(t.id);
    const synced = mm ? (mm.setTownTheme(t.id), M.POOLS.town.join() === pool.join()) : true;
    let draws = []; if (mm) { const bag = mm.bagFor('town'); for (let i = 0; i < pool.length; i++) draws.push(bag.next()); }
    out.push({ id: t.id, gen: !!t.gen, n: pool.length, shared, miss, synced, distinct: new Set(draws).size, draws: draws.length }); }
  return out; });
for (const t of r) { if (!t.gen) { ok(t.n >= 6, `${t.id}: ${t.n} town tracks`); continue; }
  ok(t.n >= 6 && t.shared.length === 0, `${t.id}: own pool of ${t.n} tracks, none shared ${t.shared.join()}`);
  ok(t.miss.length === 0, `${t.id}: all track files present ${t.miss.join()}`);
  ok(t.synced && t.distinct === t.draws, `${t.id}: travel switches the music pool; a full bag cycle plays ${t.distinct}/${t.draws} distinct tracks`); }
ok(errors.length === 0, 'no page errors ' + (errors[0] || '')); await browser.close();
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
