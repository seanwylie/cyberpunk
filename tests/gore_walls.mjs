// Gore vs walls (docs/GORE.md): Bloody kills right next to walls and in corners. Every gib path sample (the first pn samples of its pooled path buffer), every resting gib and every decal centre
// must be on a walkable tile (never a wall or wall top); gibs keep clear of wall faces; gibs are in the depth-sorted world list. Snapshot: shots/gore/walls.png
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a); fs.mkdirSync('shots/gore', { recursive: true });
await sleep(1500);
await ev(() => { const g = window.__game; g.save.level = 34; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun('annex'); g.inst.flags.bossSpawned = true; g.enemies.splice(0); g.save.settings.gore = 'bloody'; window.__gore.reset(); });
await sleep(600);
// find wall-adjacent floor cells and inside corners near the player
const spots = await ev(() => { const g = window.__game, L = g.level, S = (x, y) => g.solidAt(x + .5, y + .5); const edge = [], corner = [];
  for (let y = 2; y < L.h - 2; y++) for (let x = 2; x < L.w - 2; x++) { if (S(x, y)) continue; const n = [S(x, y - 1), S(x + 1, y), S(x, y + 1), S(x - 1, y)]; const k = n.filter(Boolean).length; if (k >= 2 && ((n[0] || n[2]) && (n[1] || n[3]))) corner.push([x, y]); else if (k === 1) edge.push([x, y]); }
  const d = p => Math.hypot(p[0] - g.px, p[1] - g.py); edge.sort((a, b) => d(a) - d(b)); corner.sort((a, b) => d(a) - d(b)); return { edge: edge.slice(0, 12), corner: corner.slice(0, 8) }; });
ok(spots.edge.length >= 6 && spots.corner.length >= 3, `found wall-side spots (${spots.edge.length}) and corners (${spots.corner.length})`);
const bad = await ev(async (spots) => { const g = window.__game, Gs = window.__gore; const all = [...spots.edge, ...spots.corner]; const types = ['worker', 'cinderhound', 'recovered']; let n = 0;
  for (let rep = 0; rep < 3; rep++) for (const [x, y] of all) { const ex = x + .5 + (Math.random() - .5) * .3, ey = y + .5 + (Math.random() - .5) * .3; const e = g.spawnEnemy(types[n++ % 3], ex, ey); e._rt.reveal = 0; g.curTag = 'pulse'; g.budgetHack = 0; g.hurtEnemy(e, 1e7, ex - 1.5 + Math.random() * 3, ey - 1.5 + Math.random() * 3, 0); g.curTag = 'auto'; g.time += .2; }
  const fl = (x, y) => !g.solidAt(x, y); const r = { chunks: Gs.chunks.length, decals: Gs.decals.length, pathBad: 0, restBad: 0, faceBad: 0, decalBad: 0 };
  for (const k of Gs.chunks) { for (let i = 0; i < (k.pn ?? k.path.length / 3) * 3; i += 3) if (!fl(k.path[i], k.path[i + 1])) r.pathBad++; if (!fl(k.fx, k.fy)) r.restBad++; const m = .15; if (!(fl(k.fx - m, k.fy) && fl(k.fx + m, k.fy) && fl(k.fx, k.fy - m) && fl(k.fx, k.fy + m))) r.faceBad++; }
  for (const d of Gs.decals) if (!fl(d.x, d.y)) r.decalBad++; return r; }, spots);
ok(bad.chunks >= 10, `gibs spawned next to walls: ${bad.chunks}, decals ${bad.decals}`);
ok(bad.pathBad === 0, `no gib flight sample is inside a wall (${bad.pathBad})`);
ok(bad.restBad === 0, `every gib rests on a walkable tile (${bad.restBad})`);
ok(bad.faceBad === 0, `gibs rest clear of wall faces (${bad.faceBad})`);
ok(bad.decalBad === 0, `no decal on a wall / wall top (${bad.decalBad})`);
// let gibs land: landing splats must also be on floor
await ev(() => { for (const k of window.__gore.chunks) k.t0 -= 5; }); await sleep(600);
const after = await ev(() => { const g = window.__game, Gs = window.__gore; return { decalBad: Gs.decals.filter(d => g.solidAt(d.x, d.y)).length, landed: Gs.chunks.filter(k => k.landed).length, n: Gs.chunks.length }; });
ok(after.decalBad === 0 && after.landed > 0, `landing splats on floor only (${JSON.stringify(after)})`);
// depth sort: gibs are injected into the renderer's world item list
const depth = await ev(() => { const Gs = window.__gore, items = []; Gs.items({ g: window.__game }, items); return items.length === Gs.chunks.length && items.every(i => typeof i.d === 'number'); });
ok(depth, 'gibs go through the isometric depth sort with walls');
// screenshot: centre on the nearest corner with fresh gore
await ev((c) => { const g = window.__game; g.px = c[0] + 1.5; g.py = c[1] + 1.5; for (const k of window.__gore.chunks) k.t0 -= 5; }, spots.corner[0]); await sleep(700);
await page.screenshot({ path: 'shots/gore/walls.png' }); ok(fs.statSync('shots/gore/walls.png').size > 50000, 'screenshot shots/gore/walls.png');
ok(errors.length === 0, 'no page errors ' + errors.join('|')); await browser.close(); process.exit(fail ? 1 : 0);
