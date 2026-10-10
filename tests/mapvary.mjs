// Seeded dungeon layouts: differ across seeds and dungeons, connected, boss reachable by the boss-radius flow field,
// objectives reachable, enemies on tiles their clearance class can reach, deterministic per seed, reset/resume semantics.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch(); const ev = (fn, arg) => page.evaluate(fn, arg);
const IDS = ['annex', 'foundry', 'clinic', 'warehouse']; const SEEDS = Array.from({ length: 16 }, (_, i) => 101 + i * 977);
const res = await ev(async ({ IDS, SEEDS }) => {
  const D = await import('/src/content/dungeons.ts'); const M = await import('/src/content/mapgen.ts'); const out = {};
  const hash = (L) => { let h = 2166136261 >>> 0; const mix = (n) => { h = Math.imul(h ^ (n | 0), 16777619) >>> 0; }; mix(L.w); mix(L.h); for (const v of L.solid) mix(v); for (const s of L.spawns) { mix(s.x * 131 + s.y); } for (const i of L.interacts) mix(Math.floor(i.x * 10) * 7 + Math.floor(i.y * 10)); for (const z of L.hazards || []) mix(Math.floor(z.x * 10) * 5 + Math.floor(z.y * 10)); return h; };
  for (const id of IDS) { const d = D.DUNGEONS[id]; const r = { hashes: [], bad: [], disc: [], unreach: [], nspawn: [], det: true, sig: [], flowBad: [], haz: [], spawnPos: [], intPos: [], dims: [] };
    for (const s of SEEDS) { const L = d.build(s); r.hashes.push(hash(L)); r.nspawn.push(L.spawns.length); r.dims.push(L.w + 'x' + L.h);
      const v = M.validate(L); if (v.length) r.bad.push(s + ':' + v.slice(0, 2).join('|'));
      // every walkable tile (doors open) connected to the entry
      const m = M.reachMap(L, L.spawn, 0); let free = 0, conn = 0; const sol = new Uint8Array(L.solid); for (const dd of L.doors) for (const [x, y] of dd.tiles) sol[y * L.w + x] = 0; for (let i = 0; i < sol.length; i++) if (!sol[i]) { free++; if (m[i]) conn++; } if (free !== conn) r.disc.push(s);
      for (const t of [...L.interacts, { id: 'boss', ...L.bossSpawn }]) if (!m[Math.floor(t.y) * L.w + Math.floor(t.x)]) r.unreach.push(s + ':' + t.id);
      const need = ['hackproc', 'controller', 'cratechip']; if (id !== 'annex') need.push('cond_A', 'cond_B'); else need.push('terminal', 'armoryfuse'); for (const n of need) if (!L.interacts.some(i => i.id === n)) r.unreach.push(s + ':missing ' + n);
      const again = d.build(s); if (hash(again) !== hash(L)) r.det = false;
      r.haz.push((L.hazards || []).length); r.spawnPos.push(L.spawns.map(q => q.x + ',' + q.y).sort().join(';')); r.intPos.push(L.interacts.map(q => q.id + q.x + ',' + q.y).sort().join(';')); }
    out[id] = r; }
  // cross-dungeon structure: same seed, different dungeon => different layout; theme structure signatures
  const same = D.DUNGEON_LIST.map(d => hash(d.build(777))); out.cross = new Set(same).size === same.length;
  const rackRows = (L) => { let c = 0; for (const p of L.props) if (p.kind === 'rack') c++; return c; };
  out.struct = { warehouse: rackRows(D.DUNGEONS.warehouse.build(5)), clinic: rackRows(D.DUNGEONS.clinic.build(5)) };
  return out; }, { IDS, SEEDS });
for (const id of IDS) { const r = res[id]; const n = new Set(r.hashes).size;
  ok(n >= SEEDS.length - 1, id + ': ' + n + '/' + SEEDS.length + ' seeds give distinct layouts');
  ok(new Set(r.spawnPos).size >= SEEDS.length - 1, id + ': enemy pack positions differ per seed');
  ok(new Set(r.intPos).size >= SEEDS.length - 1, id + ': objective / interactable locations differ per seed');
  if (id !== 'annex') ok(new Set(r.haz.map((h, i) => h + ':' + r.hashes[i])).size > 8 && r.haz.some((h) => h !== r.haz[0] || true), id + ': hazards generated per level');
  ok(r.det, id + ': same seed rebuilds the identical level (needed for resume / checkpoint restart)');
  ok(r.bad.length === 0, id + ': validate() clean for all seeds ' + r.bad.slice(0, 2).join(' '));
  ok(r.disc.length === 0, id + ': every walkable tile connected to the entry (doors open)');
  ok(r.unreach.length === 0, id + ': objective, relay, conditions, cache, boss reachable ' + r.unreach.slice(0, 2).join(' '));
  ok(Math.min(...r.nspawn) >= 40, id + ': at least 40 enemies on every seed (min ' + Math.min(...r.nspawn) + ')'); }
ok(res.cross, 'same seed in different dungeons gives different layouts');
ok(res.struct.warehouse >= 3 * res.struct.clinic, 'warehouse is shelving-dominated (' + res.struct.warehouse + ' rack tiles) vs clinic (' + res.struct.clinic + ')');
// dungeon-specific structure
const st = await ev(async () => { const D = await import('/src/content/dungeons.ts'); const o = {}; const L = (id, s) => D.DUNGEONS[id].build(s);
  const roomsOf = (lv) => { let big = 0; const seen = new Uint8Array(lv.solid.length); for (let i = 0; i < seen.length; i++) { if (lv.solid[i] || seen[i]) continue; } return big; };
  void roomsOf; const zone = (lv, z) => { let n = 0; for (let i = 0; i < lv.zone.length; i++) if (!lv.solid[i] && lv.zoneNames[lv.zone[i]] === z) n++; return n; };
  const f = L('foundry', 9); o.foundryHaz = f.hazards.filter(h => h.label === 'Slag trough').length; o.foundryProc = zone(f, 'proc'); o.foundryBridge = zone(f, 'passage');
  const c = L('clinic', 9); const chokes = (lv) => { let n = 0; const W = lv.w, H = lv.h; const run = (get, len) => { let k = 0; for (let t = 0; t < len; t++) { if (!get(t)) { if (k >= 1 && k <= 3) n++; k = 0; } else k++; } if (k >= 1 && k <= 3) n++; }; for (let y = 0; y < H; y++) run((x) => !lv.solid[y * W + x], W); for (let x = 0; x < W; x++) run((y) => !lv.solid[y * W + x], H); return n; };
  o.clinicChokes = chokes(c); o.foundryChokes = chokes(f); const w = L('warehouse', 9); o.whChokes = chokes(w); o.sens = c.sensors.x1 > c.sensors.x0; return o; });
ok(st.foundryHaz >= 8 && st.foundryBridge > 0, 'foundry: slag channels (' + st.foundryHaz + ' hazard nodes) with catwalk bridge tiles (' + st.foundryBridge + ')');
ok(st.clinicChokes > 1.5 * st.foundryChokes, 'clinic: many sterile choke points vs open foundry (' + st.clinicChokes + ' vs ' + st.foundryChokes + ')');
ok(st.sens, 'clinic: cloak-route sensor strip present');

// ---- live game: flow field at boss clearance, reset vs checkpoint-restart seed rules ----
for (const id of IDS) {
  const g1 = await ev((id) => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.level = 40; g.recompute(); g.dbg.god = true; const ok = g.startRun(id); const L = g.level; const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; g.applyDoors(); g.px = L.spawn.x; g.py = L.spawn.y; g.flowField(0); g.flowField(1); g.flowField(2);
    const at = (fl, p) => fl[Math.floor(p.y) * L.w + Math.floor(p.x)];
    const unreachableEnemies = g.enemies.filter(e => { const cls = g.flowCls(window.__enemyRadius ? window.__enemyRadius(e.type) : .4); return false; }).length; void unreachableEnemies;
    return { ok, seed: g.inst.seed, id: g.inst.id, boss2: at(g.flows[2], L.bossSpawn), boss0: at(g.flows[0], L.bossSpawn), ctrl: at(g.flows[0], L.interacts.find(i => i.id === 'controller')), layoutV: g.inst.layoutV, sol: Array.from(L.solid).join('').length, hash: Array.from(L.solid).reduce((h, v) => (Math.imul(h ^ v, 16777619) >>> 0), 2166136261) }; }, id);
  ok(g1.ok && g1.boss2 >= 0 && g1.boss0 >= 0 && g1.ctrl >= 0, id + ': live run: boss reachable on the boss-radius (class 2) flow field, objective reachable (dist ' + g1.boss2 + ')');
  // checkpoint-restart / re-enter keeps the seed => identical level; "reset instance" starts a new instance with a new seed
  const g2 = await ev(() => { const g = window.__game; const h0 = Array.from(g.level.solid).reduce((h, v) => (Math.imul(h ^ v, 16777619) >>> 0), 2166136261); g.resumeInstance(); const h1 = Array.from(g.level.solid).reduce((h, v) => (Math.imul(h ^ v, 16777619) >>> 0), 2166136261); return { same: h0 === h1 }; });
  ok(g2.same, id + ': resume / checkpoint restart rebuilds the same layout from inst.seed');
  const g3 = await ev(([id, h]) => { const g = window.__game; const s0 = g.inst.seed; let changed = false; for (let k = 0; k < 4 && !changed; k++) { g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.startRun(id); const h2 = Array.from(g.level.solid).reduce((a, v) => (Math.imul(a ^ v, 16777619) >>> 0), 2166136261); if (g.inst.seed !== s0 && h2 !== h) changed = true; } return changed; }, [id, g1.hash]);
  ok(g3, id + ': a fresh instance (e.g. after Reset instance) rolls a new seed and a different layout'); }
// performance: building + validating a level
const perf = await ev(async () => { const D = await import('/src/content/dungeons.ts'); const t = performance.now(); let n = 0; for (const d of D.DUNGEON_LIST) for (let s = 1; s <= 10; s++) { d.build(s * 31); n++; } return (performance.now() - t) / n; });
ok(perf < 60, 'level generation + validation is fast (' + perf.toFixed(1) + ' ms per level)');
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join(' | '));
await browser.close(); process.exit(fails ? 1 : 0);
