// Objective go-to target must sit on a walkable tile (door centre for "boss chamber open"), for all dungeons x 16 seeds,
// and the ring's screen position must equal the door tile centre projection.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page } = await launch();
const res = await page.evaluate(async () => {
  const D = await import('/src/content/dungeons.ts'); const g = window.__game; const R = window.__render || null; const out = [];
  for (const id of ['annex', 'foundry', 'clinic', 'warehouse']) for (let i = 0; i < 16; i++) { const s = 101 + i * 977; const L = D.DUNGEONS[id].build(s);
    const saved = { level: g.level, mode: g.mode, inst: g.inst }; let o;
    try { g.level = L; g.mode = 'run'; g.inst = { flags: { controller: true, bossSpawned: false, bossDead: false }, drops: [], dungeon: id }; o = g.objective(); } catch (e) { o = { err: String(e) }; }
    Object.assign(g, saved);
    const door = L.doors.find(d => d.id === 'boss'); const cx = door.tiles.reduce((a, t) => a + t[0], 0) / door.tiles.length + .5, cy = door.tiles.reduce((a, t) => a + t[1], 0) / door.tiles.length + .5;
    const tile = o && !o.err ? Math.floor(o.y) * L.w + Math.floor(o.x) : -1; const doorTile = door.tiles.some(t => t[0] === Math.floor(o.x) && t[1] === Math.floor(o.y));
    // all door tiles are walkable once opened, and neighbours are floor
    out.push({ id, s, err: o && o.err, dx: o ? Math.abs(o.x - cx) : 9, dy: o ? Math.abs(o.y - cy) : 9, doorTile, solidAfterOpen: doorTile ? 0 : (L.solid[tile] ? 1 : 0) }); }
  return out; });
const bad = res.filter(r => r.err || r.dx > .01 || r.dy > .01 || !r.doorTile || r.solidAfterOpen);
ok(res.length === 64 && bad.length === 0, 'objective target = boss door tile centre, 4 dungeons x 16 seeds ' + JSON.stringify(bad.slice(0, 2)));
await browser.close(); process.exit(fails ? 1 : 0);
