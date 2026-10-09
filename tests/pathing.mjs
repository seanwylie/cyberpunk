// Enemy navigation: bosses placed behind pillars/props in every dungeon boss arena must reach the player; charges must not wedge.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch();
const ev = (fn, arg) => page.evaluate(fn, arg);
const DUN = { annex: 'overseer', foundry: 'teague', clinic: 'surgeon', warehouse: 'retrieval' };
for (const [id, boss] of Object.entries(DUN)) {
  const r = await ev(async ([id, boss]) => {
    const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.level = 40; g.recompute(); g.dbg.god = true;
    if (!g.startRun(id)) return { err: 'no start' };
    const L = g.level; const c = await import('/src/config.ts'); const rad = c.ENEMIES[boss].radius;
    const f = g.inst.flags; f.gate1 = f.lock2 = true; for (const e of g.enemies) e.dead = true;
    const bs = L.bossSpawn; const out = []; const walk = (x, y) => !g.circleHits(x, y, rad * .85);
    // every pillar/prop in the boss zone: put boss on one side, player on the opposite side, with the prop between
    const props = L.props.filter(p => g.zoneAt(p.x + .5, p.y + .5) === 'boss' && (p.kind === 'pillar' || p.kind === 'machine' || p.kind === 'crate'));
    const tried = new Set();
    for (const p of props) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const bx = p.x + .5 + dx * (rad + 1.1), by = p.y + .5 + dy * (rad + 1.1), px = p.x + .5 - dx * (rad + 1.1), py = p.y + .5 - dy * (rad + 1.1);
        const key = Math.round(bx) + ',' + Math.round(by) + ',' + Math.round(px) + ',' + Math.round(py); if (tried.has(key)) continue; tried.add(key);
        if (!walk(bx, by) || !walk(px, py)) continue;
        if (g.clearFor(bx, by, px, py, rad * .85)) continue; // must actually be blocked
        const b = g.spawnEnemy(boss, bx, by); b.alert = true; b._rt.reveal = 0; g.px = px; g.py = py; g.flowT = 0;
        let t = 0, reached = false; const hold = { x: px, y: py };
        while (t < 12) { g.px = hold.x; g.py = hold.y; g.hp = g.maxHp; g.update(.016); t += .016; if (Math.hypot(b.x - px, b.y - py) < rad + 2.6) { reached = true; break; } }
        out.push({ reached, t: +t.toFixed(2), at: [p.x, p.y, dx, dy] }); b.dead = true; g.update(.016);
      }
    }
    return { n: out.length, fail: out.filter(o => !o.reached).slice(0, 5), max: Math.max(0, ...out.map(o => o.t)) };
  }, [id, boss]);
  ok(!r.err && r.n >= 4 && r.fail.length === 0, id + ' boss arena (' + boss + '): ' + r.n + ' pillar/prop-blocked cases all reached player in <12s, worst ' + r.max + 's' + (r.fail && r.fail.length ? ' FAILS ' + JSON.stringify(r.fail) : ''));
}
// charge never ends inside a collider and does not tunnel
const ch = await ev(async () => {
  const g = window.__game; const c = await import('/src/config.ts'); const bad = [];
  for (const id of ['annex', 'foundry', 'clinic', 'warehouse']) {
    g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.level = 40; g.recompute(); g.dbg.god = true; g.startRun(id);
    for (const e of g.enemies) e.dead = true; const L = g.level; const boss = { annex: 'enforcer', foundry: 'brannoch', clinic: 'recovered', warehouse: 'retrieval' }[id]; const rad = c.ENEMIES[boss].radius;
    for (let k = 0; k < 24; k++) {
      const b = g.spawnEnemy(boss, L.bossSpawn.x + (k % 6) - 3, L.bossSpawn.y + Math.floor(k / 6) * 2 - 3); if (g.circleHits(b.x, b.y, rad * .8)) { b.dead = true; continue; }
      b.alert = true; b._rt.reveal = 0; b._rt.st = 'dash'; b._rt.t = 0; b._rt.ang = k * 0.9; b._rt.hitP = false;
      for (let i = 0; i < 80; i++) { g.px = b.x + 30; g.py = b.y; g.update(.016); if (b._rt.st !== 'dash') break; }
      if (g.circleHits(b.x, b.y, rad * .8)) bad.push(id + ':' + boss + '@' + b.x.toFixed(1) + ',' + b.y.toFixed(1)); b.dead = true; g.update(.016);
    }
  }
  return bad;
});
ok(ch.length === 0, 'boss charges stop at colliders and never end wedged inside one' + (ch.length ? ' ' + ch.slice(0, 4) : ''));
// stuck-detection soak across annex: normal mobs chase from far; none stay pinned
const soak = await ev(async () => {
  const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.level = 40; g.recompute(); g.dbg.god = true; g.startRun('annex');
  g.inst.flags.gate1 = g.inst.flags.lock2 = true; g.openDoor('gate1'); g.openDoor('lock2'); const L = g.level; for (const e of g.enemies) { if (!e.dead && e.type === 'worker') e.alert = true; }
  const ws = g.enemies.filter(e => !e.dead && e.type === 'worker'); g.px = L.spawn.x; g.py = L.spawn.y; const t0 = performance.now(); const pos = ws.map(e => [e.x, e.y]);
  for (let i = 0; i < 1500; i++) { g.hp = g.maxHp; g.update(.016); } const ms = (performance.now() - t0) / 1500;
  const near = ws.filter(e => Math.hypot(e.x - g.px, e.y - g.py) < 3).length;
  return { n: ws.length, near, ms };
});
ok(soak.near >= soak.n * .8, 'annex worker packs path to the player from across the map (' + soak.near + '/' + soak.n + ' arrived; ' + soak.ms.toFixed(2) + 'ms/tick)');
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close(); process.exit(fails ? 1 : 0);
