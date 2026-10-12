// Hazard budget (no overlaps, count cap, all dungeons x seeds) + stale-circle sweep: every ability and every boss must leave ZERO ground circles/zones/deployables/effects after its duration.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
// ---- hazard budget ----
const H = await ev(async () => { const m = await import('/src/content/dungeons.ts'), lv = await import('/src/level.ts'); const o = { cap: lv.HAZARD_CAP, bad: [], n: 0, max: 0 };
  for (const d of m.DUNGEON_LIST) for (let s = 1; s <= 8; s++) { const L = d.build(s * 1301 + 7); const h = L.hazards || []; o.n++; o.max = Math.max(o.max, h.length); if (h.length > lv.HAZARD_CAP) o.bad.push(d.id + ' cap ' + h.length); for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) if (Math.hypot(h[i].x - h[j].x, h[i].y - h[j].y) < (h[i].r + h[j].r) * lv.HAZARD_SPACING - 1e-6) o.bad.push(d.id + ' overlap'); } return o; });
ok(H.bad.length === 0, `hazard budget: ${H.n} levels, max ${H.max} <= cap ${H.cap}, no overlapping hazards ${H.bad.slice(0, 3)}`);
const prep = () => ev(async () => { const g = window.__game; g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.startRun('warehouse'); g.revealing = false; g.dbg.god = true; for (const e of g.enemies) e.dead = true; g.enemies = g.enemies.filter(e => false); window.__rend.ringLog = null; return true; });
await prep();
// rings drawn that are not hazards/checkpoints/controller/the player: must be zero when nothing is active
const probe = `(() => { const g = window.__game, rd = window.__rend; const L = g.level; const allowed = [...L.checkpoints.map(c => [c.x, c.y]), ...L.interacts.map(i => [i.x, i.y]), ...(L.hazards || []).map(h => [h.x, h.y]), ...((g.inst && g.inst.drops) || []).map(d => [d.x, d.y])]; rd.ringLog = []; let zd = 0; const od = rd.drawZone.bind(rd); rd.drawZone = z => { if (!z.env) zd++; return od(z); }; rd.draw(1 / 30); rd.drawZone = od; const rings = rd.ringLog; rd.ringLog = null;
  const stray = rings.filter(r => Math.hypot(r.x - g.px, r.y - g.py) > .01 && !allowed.some(a => Math.hypot(a[0] - r.x, a[1] - r.y) < 1.6)); const a = g.abx; return { zones: g.zones.filter(z => !z.env).length, deps: a.deps.length, delayed: a.delayed.length, projs: g.projs.length + a.projs.length, fx: g.fx.length, vfx: window.__vfx.live, zd, stray: stray.length, strayAt: stray.slice(0, 3).map(r => [+r.x.toFixed(1), +r.y.toFixed(1), +r.r.toFixed(1)]), selfRings: rings.filter(r => Math.hypot(r.x - g.px, r.y - g.py) <= .01).length }; })()`;
// ---- abilities ----
const abIds = await ev(async () => { const r = await import('/src/abilities/registry.ts'); return Object.values(r.ABILITY_BY_ID).filter(a => a.shape !== 'toggle').map(a => a.id); });
const bad = [];
for (let i = 0; i < abIds.length; i += 12) { const chunk = abIds.slice(i, i + 12); await prep();
  const res = await ev(async ([chunk, probe]) => { const g = window.__game, eng = await import('/src/abilities/engine.ts'); const out = []; for (const id of chunk) { g.clearTransients(); g.abx = null; const L = g.level; g.px = L.spawn.x; g.py = L.spawn.y; const tp = g.enemies; g.enemies = []; const e = g.spawnEnemy('worker', g.px + 3, g.py); e.hp = e.maxHp = 1e6;
      try { g.heat = 0; g.abCd = [0, 0, 0]; eng.abxCast(g, { id }, 0, { wx: e.x, wy: e.y }, { tx: e.x, ty: e.y, target: e }); } catch (er) { out.push({ id, err: String(er) }); continue; }
      for (let k = 0; k < 40 * 30; k++) { g.hp = g.maxHp; g.heat = 0; if (k === 6 * 30) { for (const x of g.enemies) x.dead = true; } g.update(1 / 30); if (k % 30 === 29) window.__rend.draw(1); }
      g.enemies = []; for (let k = 0; k < 90; k++) { g.update(1 / 30); if (k % 30 === 29) window.__rend.draw(1); } const r = eval(probe); r.id = id; out.push(r); } return out; }, [chunk, probe]);
  for (const r of res) { if (r.err) bad.push(r.id + ' threw ' + r.err.slice(0, 80)); else if (r.zones || r.deps || r.delayed || r.projs || r.fx || r.vfx || r.zd || r.stray) bad.push(r.id + ' ' + JSON.stringify(r)); } }
ok(bad.length === 0, `${abIds.length} abilities: zero stale circles/zones/deployables/effects 40 s after casting ${bad.slice(0, 4).join(' | ')}`);
// ---- bosses ----
const bosses = await ev(async () => { const c = await import('/src/config.ts'); return Object.keys(c.ENEMIES).filter(k => c.ENEMIES[k].boss); });
const bbad = [];
for (let i = 0; i < bosses.length; i += 6) { const chunk = bosses.slice(i, i + 6); await prep();
  const res = await ev(async ([chunk, probe]) => { const g = window.__game; const out = []; for (const id of chunk) { g.clearTransients(); g.abx = null; g.playerDown = () => {}; const L = g.level; g.px = L.spawn.x; g.py = L.spawn.y; g.enemies = []; const b = g.spawnEnemy(id, g.px + 4, g.py); b._rt.reveal = 0; b.alert = true; b.hp = b.maxHp = 1e7;
      for (let k = 0; k < 60 * 30; k++) { g.hp = g.maxHp; g.update(1 / 30); if (k % 30 === 29) window.__rend.draw(1); } b.hp = 1; g.killEnemy(b); for (const x of g.enemies) x.dead = true; g.enemies = []; for (let k = 0; k < 8 * 30; k++) { g.update(1 / 30); if (k % 30 === 29) window.__rend.draw(1); } const r = eval(probe); r.id = id; out.push(r); } return out; }, [chunk, probe]);
  for (const r of res) if (r.zones || r.projs || r.fx || r.vfx || r.zd || r.stray) bbad.push(r.id + ' ' + JSON.stringify(r)); }
ok(bbad.length === 0, `${bosses.length} bosses: zero stale ground circles/zones after a 60 s fight + death ${bbad.slice(0, 4).join(' | ')}`);
// ---- no dashed outlines for permanent hazards unless the player is near (all dungeon themes) ----
{ const D = await ev(async () => { const g = window.__game, rd = window.__rend, m = await import('/src/dungeon_env.ts'); const out = { far: 0, near: 0, zones: 0 };
    for (const id of ['warehouse', 'foundry', 'clinic']) { g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.startRun(id); g.revealing = false; g.dbg.god = true; g.enemies = []; const hz = g.zones.filter(z => z.env); out.zones += hz.length;
      const ctx = rd.ctx, od = ctx.setLineDash.bind(ctx); let dashes = 0; ctx.setLineDash = d => { if (d && d.length) dashes++; return od(d); };
      const draw = () => { dashes = 0; for (const z of hz) { (rd.dart && rd.dart.zone(rd, z)) || rd.drawZone(z); } return dashes; };
      g.px = g.level.spawn.x; g.py = g.level.spawn.y; const far = hz.filter(z => Math.hypot(z.x - g.px, z.y - g.py) > z.r + 4); const nearList = hz.filter(z => Math.hypot(z.x - g.px, z.y - g.py) <= z.r + 4);
      // draw only the far ones
      dashes = 0; for (const z of far) { (rd.dart && rd.dart.zone(rd, z)) || rd.drawZone(z); } out.far += dashes;
      if (hz[0]) { g.px = hz[0].x; g.py = hz[0].y; dashes = 0; (rd.dart && rd.dart.zone(rd, hz[0])) || rd.drawZone(hz[0]); out.near += dashes; } ctx.setLineDash = od; }
    return out; });
  ok(D.zones > 10 && D.far === 0, `permanent hazards far from the player draw no dashed outlines (${D.far} dashes over ${D.zones} zones)`);
  ok(D.near > 0, 'the danger outline/glyph appears when the player is near (' + D.near + ')'); }
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
