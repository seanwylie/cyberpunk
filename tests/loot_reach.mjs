// Loot reachability: every drop from kills at wall-adjacent positions (and knocked back into walls) must land on a standable, reachable tile and be collectable.
// Also checks that ground loot already stuck inside a wall is re-placed on load (fixStuckDrops). Headless sim, every dungeon.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const res = await page.evaluate(async () => {
  const g = window.__game; const Dun = await import('/src/content/dungeons.ts'); const out = [];
  g.enterTown(); g.save.instance = null; g.inst = null; g.save.cleared = {}; for (const k of Object.keys(Dun.DUNGEONS)) g.save.cleared[k] = 1; g.save.settings.devFreeReset = true; g.save.lockouts = {};
  for (const id of Object.keys(Dun.DUNGEONS)) {
    g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {};
    if (!g.startRun(id)) { out.push({ id, err: 'startRun' }); continue; }
    for (let i = 0; i < 5; i++) g.update(1 / 30); g.dbg.god = true;
    const L = g.level; const W = L.w, H = L.h; const solid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || L.solid[y * W + x] === 1;
    // reachability from spawn
    const reach = new Uint8Array(W * H); const q = [(L.spawn.y | 0) * W + (L.spawn.x | 0)]; reach[q[0]] = 1; for (let h = 0; h < q.length; h++) { const c = q[h], cx = c % W, cy = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (solid(nx, ny) || reach[ny * W + nx]) continue; reach[ny * W + nx] = 1; q.push(ny * W + nx); } }
    // wall-adjacent walkable tiles, sampled
    const spots = []; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { if (solid(x, y) || !reach[y * W + x]) continue; if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) spots.push([x, y]); }
    const step = Math.max(1, Math.floor(spots.length / 36)); const pick = spots.filter((_, i) => i % step === 0);
    let bad = 0, drops = 0, uncollect = 0, badWhy = [];
    g.inst.drops = [];
    const chk = (d, why) => { drops++; const reachable = !g.solidAt(d.x, d.y) && !g.circleHits(d.x, d.y, 0.38) && reach[(d.y | 0) * W + (d.x | 0)] === 1; if (!reachable) { bad++; if (badWhy.length < 3) badWhy.push([why, +d.x.toFixed(2), +d.y.toFixed(2), g.solidAt(d.x, d.y), g.circleHits(d.x, d.y, 0.38), reach[(d.y | 0) * W + (d.x | 0)], solid((d.x|0)+1,d.y|0), solid((d.x|0)-1,d.y|0), solid(d.x|0,(d.y|0)+1), solid(d.x|0,(d.y|0)-1)]); }
      // collect: stand on the drop (clearance >= player radius) with an empty bag
      g.inst.carried.items = []; g.inst.carried.chips = {}; g.inst.carried.stims = 0; g.downed = false; g.px = d.x; g.py = d.y; const n0 = g.inst.drops.length; g.autoPickup(); if (g.inst.drops.length >= n0) { uncollect++; } };
    for (const [x, y] of pick) {
      // 1) drops from a kill hugging each wall edge (all four tile corners/edges)
      for (const [ox, oy] of [[.02, .5], [.98, .5], [.5, .02], [.5, .98], [.02, .02], [.98, .98]]) { const before = g.inst.drops.length; g.addDrop(x + ox, y + oy, { kind: 'item', inst: (await import('/src/state.ts')).mkInst(g.save, 'pool_g_torso'), amount: 1 }); chk(g.inst.drops[g.inst.drops.length - 1], 'edge'); g.inst.drops = g.inst.drops.slice(0, before); }
    }
    // 2) real kills with knockback into the wall: spawn a worker next to the wall and knock it from the open side
    let kills = 0;
    for (const [x, y] of pick.slice(0, 24)) { const e = g.spawnEnemy('worker', x + .5, y + .5); e.alert = true; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (solid(x + dx, y + dy)) { g.hurtEnemy(e, 1, e.x - dx * 2, e.y - dy * 2, 2.5); } } const before = g.inst.drops.length; const R0 = Math.random; let sd = 12345; Math.random = () => ((sd = (sd * 16807) % 2147483647) / 2147483647) * 0.3; e.hp = 0; g.killEnemy(e); Math.random = R0; kills++; for (const d of g.inst.drops.slice(before)) chk(d, 'kill'); }
    // 3) legacy loot sitting inside walls is moved on load
    const wallTiles = []; for (let y = 1; y < H - 1 && wallTiles.length < 30; y++) for (let x = 1; x < W - 1 && wallTiles.length < 30; x++) if (solid(x, y) && (!solid(x + 1, y) || !solid(x - 1, y) || !solid(x, y + 1) || !solid(x, y - 1))) wallTiles.push([x, y]);
    g.inst.drops = []; for (const [x, y] of wallTiles) g.inst.drops.push({ id: g.inst.nextId++, x: x + .5, y: y + .5, kind: 'stim', amount: 1 }); const moved = g.fixStuckDrops(); let stillBad = 0; for (const d of g.inst.drops) if (g.solidAt(d.x, d.y) || g.circleHits(d.x, d.y, .38)) stillBad++;
    out.push({ id, drops, bad, uncollect, kills, legacy: wallTiles.length, moved, stillBad, badWhy });
  }
  return out;
});
for (const r of res) { if (r.err) { ok(false, r.id + ' ' + r.err); continue; } ok(r.bad === 0 && r.uncollect === 0 && r.stillBad === 0 && r.moved === r.legacy, `${r.id}: ${r.drops} wall-edge/knockback drops all reachable & collectable, ${r.moved}/${r.legacy} legacy stuck drops re-placed` + (r.bad ? ' BAD ' + JSON.stringify(r.badWhy) : '') + (r.uncollect ? ' uncollectable ' + r.uncollect : '')); }
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
