// Dungeon layout variety (docs/MAP_GENERATION.md "Archetypes"): every dungeon x several seeds is structurally valid and solvable (doors gate the chain,
// everything reachable, boss arena fits the boss), and layouts really differ: pairwise layout-difference metric across all dungeons and across seeds
// stays above a threshold. Also writes the contact sheet to shots/mapvary/. Pure node (generators bundled with esbuild), no browser.
import { build } from 'esbuild'; import fs from 'fs'; import path from 'path'; import os from 'os'; import { pathToFileURL } from 'url'; import { execFileSync } from 'child_process';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mv2-')); const entry = path.join(tmp, 'e.ts');
fs.writeFileSync(entry, `export * as D from '${path.resolve('src/content/dungeons.ts')}'; export * as M from '${path.resolve('src/content/mapgen.ts')}'; export * as A from '${path.resolve('src/content/mapgen_arch.ts')}';`);
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: path.join(tmp, 'e.mjs'), logLevel: 'error' });
const { D, M, A } = await import(pathToFileURL(path.join(tmp, 'e.mjs')).href);
const SEEDS = [3, 101, 1078, 4242, 31337, 777777]; const ALL = D.DUNGEON_LIST.map(d => d.id); const B1 = D.BATCH1_IDS;
const lv = {}; for (const id of ALL) lv[id] = SEEDS.map(s => D.DUNGEONS[id].build(s));
ok(ALL.length >= 24 && ALL.length === Object.keys(D.DUNGEONS).length, 'every dungeon under test (' + ALL.length + ' of ' + Object.keys(D.DUNGEONS).length + ')'); // was a hard 24; gateways brought it to 32
// ---- solvability: every dungeon x seed ----
let bad = [], nlv = 0, fb = [];
for (const id of ALL) lv[id].forEach((L, i) => { nlv++; const v = M.validate(L); if (v.length) bad.push(id + '@' + SEEDS[i] + ':' + v[0]); if (B1.includes(id)) { const c = A.archCheck(L); if (c.length) bad.push(id + '@' + SEEDS[i] + ':' + c[0]); if ((L.attempt || 0) > 25) fb.push(id); } });
ok(bad.length === 0, 'validate() clean + staged-door solvability + boss arena check for ' + nlv + ' dungeon x seed layouts ' + bad.slice(0, 3).join(' '));
{ // gates really gate: with all doors closed, the controller / boss / control room are unreachable; stage by stage they open
  let n = 0, wrong = [];
  for (const id of B1) lv[id].forEach((L, i) => { n++; const w = L.w; const at = p => Math.floor(p.y) * w + Math.floor(p.x); const reach = open => { const s = new Uint8Array(L.solid); for (const d of L.doors) if (open.includes(d.id)) for (const [x, y] of d.tiles) s[y * w + x] = 0; const seen = new Uint8Array(s.length); const q = [at(L.spawn)]; seen[q[0]] = 1; for (let h = 0; h < q.length; h++) { const c = q[h], cx = c % w, cy = (c / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= L.h) continue; const k = ny * w + nx; if (!seen[k] && !s[k]) { seen[k] = 1; q.push(k); } } } return seen; };
    const ctl = L.interacts.find(x => x.id === 'controller'), rel = L.interacts.find(x => x.id === 'hackproc'); const r0 = reach([]), r1 = reach(['gate1']), r2 = reach(['gate1', 'lock2']), r3 = reach(['gate1', 'lock2', 'boss']);
    if (!(!r0[at(rel)] && r1[at(rel)] && !r1[at(ctl)] && r2[at(ctl)] && !r2[at(L.bossSpawn)] && r3[at(L.bossSpawn)])) wrong.push(id + '@' + SEEDS[i]); });
  ok(wrong.length === 0, 'door chain gates progress: relay needs gate1, controller needs lock2, boss needs the boss door (' + n + ' layouts) ' + wrong.slice(0, 3).join(' ')); }
// every enemy, interactable, checkpoint on a reachable tile at its own clearance class is covered by validate(); boss arena by archCheck. Check the objective set is complete:
ok(B1.every(id => lv[id].every(L => ['hackproc', 'controller', 'cratechip'].every(k => L.interacts.some(i => i.id === k)) && L.checkpoints.length === 2 && L.doors.length === 3 && L.spawns.length >= 40)), 'every batch level has relay, controller, cache, 2 checkpoints, 3 doors and >=40 enemies on every seed');
ok(B1.every(id => lv[id].every(L => L.reveal && L.reveal.r > 0 && L.zoneNames[L.zone[Math.floor(L.reveal.y) * L.w + Math.floor(L.reveal.x)]] === 'boss')), 'boss reveal trigger sits inside the boss arena on every layout');
// ---- layout difference metric ----
const G = 40; // normalised occupancy grid; walkable fraction per cell (doors open), aspect ratio preserved, centred
const grid = L => { const g = new Float32Array(G * G), n = new Float32Array(G * G); const sc = G / Math.max(L.w, L.h), ox = (G - L.w * sc) / 2, oy = (G - L.h * sc) / 2; const s = new Uint8Array(L.solid); for (const d of L.doors) for (const [x, y] of d.tiles) s[y * L.w + x] = 0; for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) { const gx = Math.min(G - 1, Math.floor(ox + (x + .5) * sc)), gy = Math.min(G - 1, Math.floor(oy + (y + .5) * sc)); n[gy * G + gx]++; if (!s[y * L.w + x]) g[gy * G + gx]++; } for (let i = 0; i < g.length; i++) g[i] = n[i] ? g[i] / n[i] : 0; return g; };
const feat = L => { const zi = z => L.zoneNames.indexOf(z); const cnt = z => { let c = 0; for (let i = 0; i < L.zone.length; i++) if (!L.solid[i] && L.zone[i] === zi(z)) c++; return c; }; const cx = (a) => a.x / L.w, cy = a => a.y / L.h; return { asp: Math.log(L.w / L.h), wall: L.solid.reduce((a, v) => a + v, 0) / L.solid.length, cor: cnt('corridor') / (L.w * L.h), pas: cnt('passage') / (L.w * L.h), boss: [cx(L.bossSpawn) - cx(L.spawn), cy(L.bossSpawn) - cy(L.spawn)], haz: (L.hazards || []).length / 30, size: Math.sqrt(L.w * L.h) / 100 }; };
/** 0 = identical, 1 = nothing in common: 0.65*(1 - weighted Jaccard of the normalised walkable maps) + 0.35*structural features (aspect, wall density, corridor/wing share, direction to the boss, size) */
const diff = (a, b) => { let mn = 0, mx = 0; for (let i = 0; i < a.g.length; i++) { mn += Math.min(a.g[i], b.g[i]); mx += Math.max(a.g[i], b.g[i]); } const bm = 1 - mn / Math.max(1e-6, mx); const fa = a.f, fb = b.f; const sd = Math.min(1, (Math.abs(fa.asp - fb.asp) * .5 + Math.abs(fa.wall - fb.wall) * 2 + Math.abs(fa.cor - fb.cor) * 6 + Math.abs(fa.pas - fb.pas) * 6 + Math.hypot(fa.boss[0] - fb.boss[0], fa.boss[1] - fb.boss[1]) * .6 + Math.abs(fa.size - fb.size) * 1.5)); return .65 * bm + .35 * sd; };
const GF = {}; for (const id of ALL) GF[id] = lv[id].map(L => ({ g: grid(L), f: feat(L) }));
// (1) across dungeons: same seed, every pair of the 24
let minD = 9, sumD = 0, nD = 0, worst = ''; const lowPairs = [];
for (const sIdx of [0, 3]) for (let i = 0; i < ALL.length; i++) for (let j = i + 1; j < ALL.length; j++) { const d = diff(GF[ALL[i]][sIdx], GF[ALL[j]][sIdx]); sumD += d; nD++; if (d < minD) { minD = d; worst = ALL[i] + ' vs ' + ALL[j]; } if (d < .22) lowPairs.push(ALL[i] + '/' + ALL[j] + ' ' + d.toFixed(2)); }
console.log('  across dungeons: mean ' + (sumD / nD).toFixed(3) + ' min ' + minD.toFixed(3) + ' (' + worst + ')' + (lowPairs.length ? ' low: ' + lowPairs.slice(0, 6).join(', ') : ''));
ok(sumD / nD >= .5, 'mean pairwise layout difference across the 24 dungeons >= 0.50 (' + (sumD / nD).toFixed(3) + ')');
ok(minD >= .2, 'no two dungeons are near-identical: min pairwise difference >= 0.20 (' + minD.toFixed(3) + ' ' + worst + ')');
// (2) across seeds of one dungeon
let sMin = 9, sSum = 0, sN = 0, sWorst = ''; const perD = {};
for (const id of ALL) { let ms = 9, ss = 0, nn = 0; for (let i = 0; i < SEEDS.length; i++) for (let j = i + 1; j < SEEDS.length; j++) { const d = diff(GF[id][i], GF[id][j]); ss += d; nn++; ms = Math.min(ms, d); } perD[id] = [ss / nn, ms]; sSum += ss; sN += nn; if (ms < sMin) { sMin = ms; sWorst = id; } }
console.log('  across seeds: mean ' + (sSum / sN).toFixed(3) + ' min ' + sMin.toFixed(3) + ' (' + sWorst + ')');
ok(B1.every(id => perD[id][0] >= .35), 'every generated dungeon: mean seed-to-seed layout difference >= 0.35 (min dungeon ' + Math.min(...B1.map(id => perD[id][0])).toFixed(3) + ')');
ok(B1.every(id => perD[id][1] >= .15), 'every generated dungeon: no two seeds near-identical, min >= 0.15 (' + Math.min(...B1.map(id => perD[id][1])).toFixed(3) + ')');
ok(ALL.filter(id => !B1.includes(id)).every(id => perD[id][0] >= .15), 'original four dungeons still vary per seed (' + ALL.filter(id => !B1.includes(id)).map(id => perD[id][0].toFixed(2)).join('/') + ')');
// (3) macro archetypes: all 7 appear, each level's primary archetype is the one declared, and archetype choices differ across the 20 levels
const archs = new Set(), prim = {}; for (const id of B1) { const cnt = {}; for (let s = 0; s < 40; s++) { const L = D.DUNGEONS[id].build(s * 131 + 5); const a = L.arch.name; cnt[a] = (cnt[a] || 0) + 1; archs.add(a); } prim[id] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]; }
ok(archs.size === 7, 'all 7 macro archetypes are used (' + [...archs].join(',') + ')');
ok(B1.every(id => prim[id] === A.ARCH_OF[id][0]), 'each level keeps its identity: its declared primary archetype is the most common one');
ok(new Set(B1.map(id => A.ARCH_OF[id][0])).size >= 6, 'primary archetypes are spread across the levels (' + new Set(B1.map(id => A.ARCH_OF[id][0])).size + ' distinct)');
{ const pre = {}; for (const id of B1) { const L = lv[id][0]; const c = L.arch.rooms.length; pre[id] = c; } ok(new Set(Object.values(pre)).size >= 3, 'room counts differ between dungeons (' + [...new Set(Object.values(pre))].sort().join('/') + ')'); }
ok(new Set(B1.flatMap(id => lv[id].map(L => L.arch.arena))).size >= 6, 'boss arena shapes vary (' + new Set(B1.flatMap(id => lv[id].map(L => L.arch.arena))).size + ' kinds)');
// determinism + speed
{ let same = true; for (const id of B1.slice(0, 6)) { const a = D.DUNGEONS[id].build(999), b = D.DUNGEONS[id].build(999); if (Buffer.compare(Buffer.from(a.solid), Buffer.from(b.solid)) || JSON.stringify(a.spawns) !== JSON.stringify(b.spawns) || JSON.stringify(a.interacts) !== JSON.stringify(b.interacts)) same = false; } ok(same, 'same seed rebuilds the identical level (resume / checkpoint restart)'); }
{ const t = performance.now(); let n = 0; for (const id of B1) for (let s = 1; s <= 3; s++) { D.DUNGEONS[id].build(s * 31); n++; } const ms = (performance.now() - t) / n; ok(ms < 120, 'archetype level generation + checks is fast (' + ms.toFixed(1) + ' ms per level)'); }
// contact sheet
try { execFileSync('node', ['tools/mapsheet.mjs', 'shots/mapvary'], { stdio: 'inherit' }); ok(fs.existsSync('shots/mapvary/contact_all_dungeons.png'), 'contact sheet written to shots/mapvary/contact_all_dungeons.png'); } catch (e) { ok(false, 'contact sheet: ' + e.message); }
fs.rmSync(tmp, { recursive: true, force: true }); process.exit(fails ? 1 : 0);
