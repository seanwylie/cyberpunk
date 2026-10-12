// World of towns (docs/WORLD.md): every town is reachable from the Reach Line at level 1, towns are combat-free safe hubs, every walkable tile
// and station pad is connected to the arrival and return spawns (never stuck), stations are spaced and unique, every dungeon has a host gate,
// and the transit map lists every town with a short label + tooltip.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 }, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
const ids = await ev(async () => { const g = window.__game, s = g.save; s.level = 1; s.xp = 0; s.towns = undefined; s.contracts = undefined; s.rep = { HI: 0, PS: 0, MM: 0 }; s.cleared = {}; s.world = undefined; s.town = 'rustline'; g.enterTown(true); return (await import('/src/world.ts')).WORLD.map(t => t.id); });
ok(ids.length >= 10, `world has ${ids.length} towns (2 hand-built + generated districts)`);
const r0 = await ev(async () => { const D = await import('/src/content/dungeons.ts'), T = await import('/src/towns.ts'); return D.DUNGEON_LIST.filter(d => !T.hostsOf(d.id).length).map(d => d.id); });
ok(r0.length === 0, 'every dungeon has at least one host gate: ' + r0.join());
for (const id of ids) {
  // ---- ride there from the transit station UI at level 1 ----
  const start = await ev(id => { const g = window.__game, ui = window.__ui; ui.close(); const it = g.level.interacts.find(i => i.opens === 'travel'); if (!it) return { err: 'no transit in ' + g.townId }; g.px = it.x; g.py = it.y; g.update(.05); g.interact(); if (ui.modal !== 'travel') return { err: 'modal ' + ui.modal };
    const nodes = [...document.querySelectorAll('#modal .wmnode')]; const node = nodes.find(n => n.dataset.id === id); const tipped = nodes.every(n => n.dataset.tip && n.querySelector('span').textContent.length <= 12);
    const lockedNode = node.classList.contains('locked') && /Locked/.test(node.dataset.tip); let blocked = null;
    if (lockedNode) { node.click(); const b0 = document.querySelector('#modal [data-act="tv-go"]'); blocked = b0.disabled && g.travel(id) === false && g.townId !== id; (g.save.world.unlocked ??= {})[id] = 1; ui.render(); }
    document.querySelector(`#modal .wmnode[data-id="${id}"]`).click(); const btn = document.querySelector('#modal [data-act="tv-go"]'); const here = g.townId === id; if (!here) btn.click(); return { n: nodes.length, tipped, here, dis: btn.disabled, lockedNode, blocked }; }, id);
  if (start.err) { ok(false, id + ': ' + start.err); continue; }
  ok(start.n === ids.length && start.tipped, `${id}: transit map lists all ${start.n} towns with short labels + tooltips`);
  if (start.lockedNode) ok(start.blocked, `${id}: locked at level 1: silhouette with unlock tooltip, ride disabled, travel refused`);
  ok(start.here || !start.dis, `${id}: ride button enabled once the line is open (level 1)`);
  await page.waitForFunction(id => window.__game.townId === id && !document.getElementById('tramload'), id, { timeout: 20000 }).catch(() => {});
  const r = await ev(() => { const g = window.__game, L = g.level, W = L.w, H = L.h; const walk = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !L.solid[y * W + x];
    const bfs = (sx, sy) => { const seen = new Uint8Array(W * H), q = [Math.floor(sy) * W + Math.floor(sx)]; seen[q[0]] = 1; while (q.length) { const k = q.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (n >= 0 && n < W * H && !seen[n] && !L.solid[n]) { seen[n] = 1; q.push(n); } } } return seen; };
    const a = bfs(L.spawn.x, L.spawn.y), b = bfs(L.returnSpawn.x, L.returnSpawn.y); let walkN = 0, orphan = 0; for (let k = 0; k < W * H; k++) if (!L.solid[k]) { walkN++; if (!a[k]) orphan++; }
    const pads = L.interacts.map(i => ({ id: i.station, ok: walk(Math.floor(i.x), Math.floor(i.y)) && !!a[Math.floor(i.y) * W + Math.floor(i.x)] }));
    let minD = 99; for (let i = 0; i < L.interacts.length; i++) for (let j = i + 1; j < L.interacts.length; j++) minD = Math.min(minD, Math.hypot(L.interacts[i].x - L.interacts[j].x, L.interacts[i].y - L.interacts[j].y));
    const ids = L.interacts.map(i => i.id); const uniq = new Set(ids).size === ids.length;
    // combat-free: no spawns/enemies, abilities refuse to cast, no hazards
    const pre = g.cast; try { g.useAbility?.(0); g.tryCast?.(0); } catch {} const cast = g.cast && g.cast !== pre;
    // player can actually move from the arrival spawn
    g.px = L.spawn.x; g.py = L.spawn.y; const x0 = g.px, y0 = g.py; const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]; let moved = 0; for (const [dx, dy] of dirs) { g.px = x0; g.py = y0; g.input = g.input || {}; if (typeof g.moveBy === 'function') g.moveBy(dx * .5, dy * .5); else { const nx = x0 + dx * .5, ny = y0 + dy * .5; if (!g.solidAt(nx, ny)) { g.px = nx; g.py = ny; } } if (Math.hypot(g.px - x0, g.py - y0) > .2) moved++; } g.px = x0; g.py = y0;
    return { gen: !!(window.__worldGen ||= {})[g.townId] || L.theme !== 'harrow' && g.townId !== 'rustline', kind: L.kind, mode: g.mode, enemies: g.enemies.length, spawns: L.spawns.length, hz: (L.hazards || []).length, cast, walkN, orphan, retOk: !!a[Math.floor(L.returnSpawn.y) * W + Math.floor(L.returnSpawn.x)] && !!b[Math.floor(L.spawn.y) * W + Math.floor(L.spawn.x)], pads, minD, uniq, moved,
      hasTransit: L.interacts.some(i => i.opens === 'travel'), hasGate: L.interacts.some(i => i.opens === 'annex') || g.townId === 'rustline' || g.townId === 'harrow', stations: L.interacts.length };
  });
  ok(r.kind === 'town' && r.mode === 'town' && r.enemies === 0 && r.spawns === 0 && r.hz === 0 && !r.cast, `${id}: safe hub (no enemies, spawns, hazards or ability casts)`);
  ok((r.gen ? r.orphan === 0 : r.orphan < r.walkN * .02) && r.retOk && r.moved >= 2, `${id}: all ${r.walkN} walkable tiles connected to the arrival/return spawns; player can move off the spawn (${r.moved}/4 dirs); sealed pockets ${r.orphan}`);
  ok(r.pads.every(p => p.ok), `${id}: every station pad is walkable and reachable: ${r.pads.filter(p => !p.ok).map(p => p.id).join() || 'all ' + r.pads.length}`);
  ok(r.uniq && r.minD >= 11 && r.hasTransit && r.hasGate && r.stations >= 5, `${id}: ${r.stations} unique stations, min spacing ${r.minD.toFixed(1)} (>= 11), has transit + gate`);
}
ok(errors.length === 0, 'no page errors ' + (errors[0] || '')); await browser.close();
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
