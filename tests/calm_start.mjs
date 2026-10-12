// Calm start (docs/SAFE_START.md): (A) layout sweep over every dungeon x many seeds: safe entry zone, no LOS from ranged/elite/static spawns, ramped first packs,
// enemy count kept; (B) live game with the grace on: dormant enemies, unhurtable player, ends on time / first action / moving away, intro beat, re-entry,
// staggered wake-up; (C) party: shared grace started by the start event, ends for everyone on any member's first action.
import { build } from 'esbuild'; import fs from 'fs'; import path from 'path'; import os from 'os'; import { pathToFileURL } from 'url';
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// ---------------- (A) layout sweep ----------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-')); const entry = path.join(tmp, 'e.ts');
fs.writeFileSync(entry, `export * as D from '${path.resolve('src/content/dungeons.ts')}'; export * as S from '${path.resolve('src/content/safestart.ts')}'; export * as C from '${path.resolve('src/config.ts')}'; export * as M from '${path.resolve('src/content/mapgen.ts')}';`);
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: path.join(tmp, 'e.mjs'), logLevel: 'error' });
const { D, S, C, M } = await import(pathToFileURL(path.join(tmp, 'e.mjs')).href); fs.rmSync(tmp, { recursive: true, force: true });
const SEEDS = Array.from({ length: 16 }, (_, i) => 101 + i * 1237); const E = C.ENEMIES; let n = 0; const bad = { enemy: [], los: [], haz: [], cap: [], aff: [], count: [], valid: [], elite: [] }; let minD = 1e9, groupsMoved = 0;
for (const d of D.DUNGEON_LIST) for (const s of SEEDS) { const L = d.build(s); n++; const sp = L.spawn; groupsMoved += L.safeInfo?.moved || 0;
  const ex = new Set((L.safeInfo?.gateExempt || []).map(i => L.spawns[i])); // gate guards in a yard too small for calm start: progression wins (docs/PROGRESSION.md)
  for (const e of L.spawns) { if (ex.has(e)) continue; const dd = Math.hypot(e.x + .5 - sp.x, e.y + .5 - sp.y); minD = Math.min(minD, dd); if (dd < S.SAFE_R) bad.enemy.push(d.id + '@' + s + ':' + e.type); if (S.violates(L, e.type, e.x, e.y)) bad.los.push(d.id + '@' + s + ':' + e.type); }
  for (const h of L.hazards || []) if (Math.hypot(h.x - sp.x, h.y - sp.y) < S.SAFE_R) bad.haz.push(d.id + '@' + s);
  if (L.spawns.length < 40) bad.count.push(d.id + '@' + s + ':' + L.spawns.length);
  const v = M.validate(L); if (v.length) bad.valid.push(d.id + '@' + s + ':' + v[0]);
  // ramp: first three normal packs by walking distance
  const gs = new Map(); L.spawns.forEach(e => { if (e.group < 90) (gs.get(e.group) || gs.set(e.group, []).get(e.group)).push(e); });
  const w = L.w; const sol = new Uint8Array(L.solid); for (const dr of L.doors) for (const [x, y] of dr.tiles) sol[y * w + x] = 0; const dist = new Int16Array(w * L.h).fill(-1); const q = [Math.floor(sp.y) * w + Math.floor(sp.x)]; dist[q[0]] = 0; for (let k = 0; k < q.length; k++) { const c = q[k], cx = c % w, cy = (c / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= L.h) continue; const i = ny * w + nx; if (dist[i] >= 0 || sol[i]) continue; dist[i] = dist[c] + 1; q.push(i); } }
  const packs = [...gs.values()].filter(m => !m.some(e => E[e.type]?.elite || E[e.type]?.static)).map(m => { let a = 0, k = 0; for (const e of m) { const dd = dist[e.y * w + e.x]; if (dd >= 0) { a += dd; k++; } } return { m, d: k ? a / k : 1e9 }; }).sort((a, b) => a.d - b.d);
  packs.slice(0, 3).forEach((p, k) => { if (p.m.length > S.RAMP_CAPS[k]) bad.cap.push(d.id + '@' + s + ' pack' + k + '=' + p.m.length); if (k < 2 && p.m.some(e => e.affix && e.affix.length)) bad.aff.push(d.id + '@' + s); });
  // nothing elite / ranged-static inside the first rooms: nearest elite-class enemy is far
  for (const e of L.spawns) if ((E[e.type]?.elite || E[e.type]?.static) && Math.hypot(e.x + .5 - sp.x, e.y + .5 - sp.y) < 20 && S.losTiles(L, sp.x, sp.y, e.x + .5, e.y + .5)) bad.elite.push(d.id + '@' + s + ':' + e.type); }
const lab = Object.entries(bad).map(([k, v]) => k + ':' + v.length).join(' ');
ok(n === D.DUNGEON_LIST.length * SEEDS.length && n >= 24 * 16, 'swept ' + n + ' dungeon x seed layouts (24 dungeons incl. the 20 new levels)');
ok(bad.enemy.length === 0, 'no enemy spawns within ' + S.SAFE_R + ' tiles of the entry (closest ' + minD.toFixed(1) + ') ' + bad.enemy.slice(0, 3));
ok(bad.los.length === 0 && bad.elite.length === 0, 'no ranged / elite / static spawn with line of sight to the entry, no aggro range reaching it ' + bad.los.slice(0, 3));
ok(bad.haz.length === 0, 'no hazards inside the safe zone');
ok(bad.cap.length === 0 && bad.aff.length === 0, 'first three packs capped at ' + S.RAMP_CAPS.join('/') + ', no elite affixes in the first two ' + bad.cap.slice(0, 3));
ok(bad.count.length === 0, 'enemy count kept (>= 40 everywhere): relocation, not deletion');
ok(bad.valid.length === 0, 'relocated levels still validate (spawns reachable at their clearance class) ' + bad.valid.slice(0, 2));
console.log('  (' + groupsMoved + ' packs relocated across ' + n + ' layouts: the audit found ' + (groupsMoved / n).toFixed(1) + ' offending packs per level before the fix)');
// ---------------- (B) live game, grace on ----------------
const { browser, page, errors } = await launch({ grace: true }); const ev = (fn, a) => page.evaluate(fn, a);
await ev(() => { const g = window.__game; g.save.settings.devFreeReset = true; g.update = () => { }; /* freeze the live loop: the test steps the sim by hand */ });
const fresh = (id, seed = 777) => ev(async ([id, seed]) => { const g = window.__game; const Dn = await import('/src/content/dungeons.ts'); g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.cleared = {}; for (const k of Object.keys(Dn.DUNGEONS)) g.save.cleared[k] = 1; g.save.level = 60; g.recompute(); const o = g.startRun(id, seed); return { o, grace: !!g.grace, alert: g.enemies.filter(e => e.alert).length, n: g.enemies.length, hp: g.hp, max: g.maxHp }; }, [id, seed]);
const r0 = await fresh('annex'); ok(r0.o && r0.grace && r0.alert === 0, 'fresh run starts with the grace on and every enemy dormant');
const intro = await ev(() => document.getElementById('banner')?.textContent || ''); ok(/Annex|Objective/i.test(intro), 'intro beat: title / objective card shown (' + intro.slice(0, 60) + ')');
// forced aggression during the grace: an alerted enemy adjacent to the player and one in aggro range
const hold = await ev(() => { const g = window.__game; g.weaponOff = 999; const a = g.spawnEnemy('worker', g.px + 1, g.py); a.alert = true; a.faction = 'enemy'; const b = g.spawnEnemy('shooter', g.px + 3, g.py + 1); for (let i = 0; i < 150; i++) Object.getPrototypeOf(g).update.call(g, 0.03); return { hp: g.hp, max: g.maxHp, grace: !!g.grace, aAlert: a.alert, bAlert: b.alert, t: g.grace?.t }; });
ok(hold.hp === hold.max && hold.grace, 'no damage for the first 4.5 s without a player action (hp ' + hold.hp + '/' + hold.max + ', grace left ' + (hold.t || 0).toFixed(2) + ')');
ok(!hold.bAlert, 'an enemy standing in aggro range stays dormant during the grace');
const after = await ev(() => { const g = window.__game; for (let i = 0; i < 40; i++) Object.getPrototypeOf(g).update.call(g, 0.03); const live = g.enemies.filter(e => !e.dead && e.alert).length; return { grace: !!g.grace, live }; });
ok(!after.grace && after.live >= 1, 'grace ends on time (5 s) and enemies in range wake afterwards (alerted ' + after.live + ')');
// triggers
const trig = {}; for (const [k, fn] of [['dodge', g => g.dodge()], ['move', g => { g.px += 9; }], ['hit', g => { const e = g.spawnEnemy('worker', g.px + 1.2, g.py); g.hurtEnemy(e, 1, g.px, g.py, 0); }], ['cast', g => { g.beginAim(0); g.updateAim(g.px + 3, g.py, true); g.releaseAim(); }]]) { await fresh('foundry'); trig[k] = await ev(([k, src]) => { const g = window.__game; const f = new Function('g', 'return (' + src + ')(g)'); f(g); Object.getPrototypeOf(g).update.call(g, 0.03); return !g.grace; }, [k, fn.toString()]); }
ok(trig.dodge && trig.move && trig.hit && trig.cast, 'grace ends on first dodge, move > 8 tiles, first hit, first ability ' + JSON.stringify(trig));
// sweep: all dungeons idle for 4.8 s: never hurt, nobody wakes
const idle = await ev(async () => { const g = window.__game; const Dn = await import('/src/content/dungeons.ts'); const out = []; for (const id of Object.keys(Dn.DUNGEONS)) { g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun(id, 4321); for (let i = 0; i < 160; i++) Object.getPrototypeOf(g).update.call(g, 0.03); if (g.hp < g.maxHp || g.enemies.some(e => e.alert && !e.dead)) out.push(id); } return out; });
ok(idle.length === 0, 'all 24 dungeons: idle for the first 4.8 s = no damage, no enemy awake ' + idle.slice(0, 3));
// re-entry: surviving enemies that stand near the entry are put back home; everything dormant; grace again
const re = await ev(async () => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.startRun('warehouse', 555); g.endGrace('test'); const e = g.enemies.find(x => !x.dead && x.faction === 'enemy' && Math.hypot(x.home.x - g.level.spawn.x, x.home.y - g.level.spawn.y) > 20); e.x = g.level.spawn.x + 3; e.y = g.level.spawn.y; e.alert = true; g.saveNow(); g.resumeInstance(); const e2 = g.enemies.find(x => x.id === e.id); return { grace: !!g.grace, d: Math.hypot(e2.x - g.px, e2.y - g.py), alert: e2.alert }; });
ok(re.grace && re.d >= 12 && !re.alert, 're-entering a saved instance: grace again, wanderers sent home (' + re.d.toFixed(1) + ' tiles), all dormant');
// staggered wake
const wk = await ev(async () => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.startRun('annex', 91); g.endGrace('test'); const grp = new Map(); for (const e of g.enemies) if (e.group < 90) (grp.get(e.group) || grp.set(e.group, []).get(e.group)).push(e); const mem = [...grp.values()].find(m => m.length >= 3); const lead = mem[0]; for (const m of mem) { m.x = lead.x + (mem.indexOf(m) % 3) * .8; m.y = lead.y + Math.floor(mem.indexOf(m) / 3) * .8; } g.px = lead.x - 4; g.py = lead.y; g.hurtEnemy(lead, 1, g.px, g.py, 0); const t0 = mem.filter(m => m.alert).length; const pending = mem.filter(m => (m._rt.wake || 0) > 0).length; const ts = []; for (let i = 0; i < 70; i++) { Object.getPrototypeOf(g).update.call(g, 0.03); ts.push(mem.filter(m => m.alert).length); } return { size: mem.length, t0, pending, ts: [ts[2], ts[12], ts[40], ts[69]] }; });
ok(wk.t0 === 1 && wk.pending >= 2 && wk.ts[3] === wk.size, 'wake-up is staggered with a tell: ' + wk.t0 + ' alerted at once, ' + wk.pending + ' pending, awake over time ' + wk.ts.join('/') + ' of ' + wk.size);
// ---------------- (C) party ----------------
const pt = await ev(async () => { const P = await import('/src/core/party.ts'); const w = new P.PartyWorld('annex', 21, [{ id: 'a', name: 'A', lvl: 20 }, { id: 'b', name: 'B', lvl: 20 }], { grace: true }); const a = w.hosts.get('a'), b = w.hosts.get('b'); const gA = a.g, gB = b.g; const sp = w.level.spawn; for (const h of w.hosts.values()) h.g.weaponOff = 999; const near = w.enemies.find(e => !e.dead); near.x = sp.x + 1.5; near.y = sp.y; near.alert = true; for (let i = 0; i < 60; i++) w.step(); const mid = { both: !!gA.grace && !!gB.grace, hpA: gA.hp === gA.maxHp, hpB: gB.hp === gB.maxHp, t: w.graceT, awake: w.enemies.filter(e => e.alert && !e.dead).length };
  w.run(a, () => { gA.dodge(); }); w.step(); w.step(); const end = { none: !gA.grace && !gB.grace && w.graceT === 0 }; const w2 = new P.PartyWorld('annex', 21, [{ id: 'a', name: 'A', lvl: 20 }, { id: 'b', name: 'B', lvl: 20 }], { grace: 2 }); const same = w2.level.spawns.length === w.level.spawns.length; for (let i = 0; i < 120; i++) w2.step(); return { mid, end, tmo: w2.graceT === 0 && !w2.hosts.get('a').g.grace, same }; });
ok(pt.mid.both && pt.mid.hpA && pt.mid.hpB && pt.mid.t > 0, 'party start: every member has the same grace; an alerted enemy beside them does no damage (' + JSON.stringify(pt.mid) + ')');
ok(pt.end.none, 'any member\'s first action ends the grace for the whole party');
ok(pt.tmo && pt.same, 'party grace also ends on its own timer; same seed gives the same level for all members');
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join(' | '));
// ---------------- screenshots ----------------
fs.mkdirSync('shots/starts', { recursive: true });
for (const id of ['annex', 'foundry', 'clinic', 'coke_ovens', 'parcel_tower', 'warranty_vault']) { await fresh(id, 2468); await ev(() => { window.__game.enemies.forEach(e => { e.alert = false; }); }); await sleep(900); await page.screenshot({ path: 'shots/starts/start_' + id + '.png' }); }
await browser.close(); process.exit(fails ? 1 : 0);
