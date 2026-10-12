// Boss signature kits (docs/BOSSES.md): every boss has >= 2 distinct themed mechanics, telegraph shape/style is unique per mechanic, kit sets are unique per boss,
// every mechanic casts with a fair windup and a deterministic layout, nothing stale survives a fight (boss death, death/respawn, reset, leave), Reduced FX / quality tiers draw cleanly.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
// ---- data checks
const D = await ev(async () => { const K = await import('/src/content/boss_kits.ts'), C = await import('/src/config.ts'); const bosses = Object.entries(C.ENEMIES).filter(([, d]) => d.boss).map(([id]) => id);
  const info = K.MECH_INFO; const sets = {}; const out = { bosses, missing: [], few: [], dupSet: [], badMech: [], mechs: Object.keys(info) };
  for (const id of bosses) { const k = K.KITS[id]; if (!k) { out.missing.push(id); continue; } const ms = [...new Set(k.mechs.map(m => m.m))]; if (ms.length < 2) out.few.push(id); for (const m of ms) if (!info[m]) out.badMech.push(id + ':' + m); const key = ms.sort().join('+'); (sets[key] ??= []).push(id); }
  out.dupSet = Object.values(sets).filter(a => a.length > 1); const styles = {}; for (const [m, i] of Object.entries(info)) (styles[i.shape + '/' + i.style] ??= []).push(m); out.dupStyle = Object.values(styles).filter(a => a.length > 1);
  out.sfx = Object.values(info).map(i => i.sfx); out.pals = [...new Set(bosses.map(b => K.KITS[b]?.pal))].length; out.unused = Object.keys(info).filter(m => !bosses.some(b => K.KITS[b]?.mechs.some(x => x.m === m)));
  out.nBosses = bosses.length; out.n20 = Object.keys((await import('/src/content/batch1_bosses.ts')).BOSS_BY_ID).length; return out; });
ok(D.nBosses === 32 && D.n20 === 20, `all ${D.nBosses} bosses covered (12 original + ${D.n20} batch-1)`);
ok(D.missing.length === 0, 'every boss has a kit ' + D.missing.join());
ok(D.few.length === 0, 'every boss has >= 2 distinct mechanics ' + D.few.join());
ok(D.badMech.length === 0, 'every kit mechanic is a registered mechanic ' + D.badMech.join());
ok(D.dupSet.length === 0, 'no two bosses share the same mechanic set ' + JSON.stringify(D.dupSet));
ok(D.dupStyle.length === 0, 'telegraph shape+style is unique per mechanic ' + JSON.stringify(D.dupStyle));
ok(new Set(D.sfx).size === D.sfx.length, 'each mechanic has its own sfx stinger');
ok(D.unused.length === 0, 'every mechanic is used by at least one boss ' + D.unused.join());
// ---- cast every mechanic in a live arena: shape, fair windup, determinism, caps
const R = await ev(async () => { const g = window.__game, K = await import('/src/content/boss_kits.ts'), M = await import('/src/content/mechanics.ts'); document.getElementById('splash')?.remove();
  g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.startRun('coke_ovens'); const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; f.bossKey = 'voss'; const rp = g.revealPoint(); g.px = rp.x; g.py = rp.y; g.dbg.god = true; for (let i = 0; i < 30 * 12; i++) g.update(1 / 30);
  const e = g.enemies.find(x => !x.dead && x.type === 'voss'); const o = { boss: !!e, mech: {} }; if (!e) return o; const ar = M.arenaOf(g); e.stunT = 1e4; e.hp = e.maxHp * .5;
  const layout = (m) => { g.zones = g.zones.filter(z => z.env); e._rt.kit.n = 7; const d = K.castMech(g, e, m); return { d, zs: g.zones.filter(z => z.kit).map(z => ({ shape: z.shape, style: z.style, x: +z.x.toFixed(3), y: +z.y.toFixed(3), w: z.windup, dps: z.dps, burst: !!z.burst, safe: (z.safe || []).map(s => [+s.x.toFixed(2), +s.y.toFixed(2)]) })), ens: g.enemies.filter(q => q.pylon || q.kitBuf).length }; };
  for (const m of Object.keys(K.MECH_INFO)) { g.enemies = g.enemies.filter(q => !q.kitBuf && !q.pylon); e._rt.shield = null; g.px = ar.cx + 2; g.py = ar.cy + 3; const a = layout(m); g.enemies = g.enemies.filter(q => !q.kitBuf && !q.pylon); e._rt.shield = null; g.zones = g.zones.filter(z => z.env); const b = layout(m); o.mech[m] = { dur: a.d, n: a.zs.length, ens: a.ens, shapes: [...new Set(a.zs.map(z => z.shape + '/' + z.style))], same: JSON.stringify(a.zs) === JSON.stringify(b.zs), minW: Math.min(...a.zs.filter(z => z.dps > 0 && z.shape !== 'tile' && z.shape !== 'safe' || (z.shape === 'safe' && z.dps > 0)).map(z => z.w)), bad: a.zs.some(z => !isFinite(z.x) || !isFinite(z.y)) }; }
  g.zones = g.zones.filter(z => z.env); return o; });
ok(R.boss, 'boss fight started');
for (const m of D.mechs) { const r = R.mech[m] || {}; ok(r.dur != null || m === 'pylons' || m === 'buffers' || m === 'shield', `${m}: casts (${r.dur?.toFixed?.(1)} s, ${r.n} zones, shapes ${r.shapes})`); if (r.n) { ok(r.same, `${m}: layout is deterministic from the shared seed`); ok(!r.bad, `${m}: finite positions`); ok(!isFinite(r.minW) || r.minW >= .95, `${m}: damaging telegraph windup >= 0.95 s (min ${r.minW})`); } }
ok((R.mech.pylons?.ens || 0) >= 2 && (R.mech.buffers?.ens || 0) >= 2, 'pylons and buff nodes spawn real destroyable nodes');
// ---- boss fights for every boss: mechanics fire, caps hold, boss death leaves no stale telegraph, reset/leave clean
const BOSSES = D.bosses; const F = {};
for (const id of BOSSES) { F[id] = await ev(async (bossId) => { const g = window.__game, { DUNGEONS } = await import('/src/content/dungeons.ts'); const K = await import('/src/content/boss_kits.ts');
  const dng = Object.keys(DUNGEONS).find(k => DUNGEONS[k].defaultBoss === bossId) || 'warehouse'; g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.startRun(dng);
  const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; f.bossKey = bossId; const rp = g.revealPoint(); g.px = rp.x; g.py = rp.y; g.dbg.god = true; const seen = new Set(), starts = {}; let maxKit = 0, maxZ = 0, nan = 0, boss = null;
  const kitMechs = new Set(K.KITS[bossId].mechs.map(m => m.m));
  const M = await import('/src/content/mechanics.ts'); let home = null;
  for (let i = 0; i < 30 * 150; i++) { g.hp = g.maxHp; g.update(1 / 30); boss = g.enemies.find(x => !x.dead && x.type === bossId); if (boss && g.zoneAt(g.px, g.py) !== 'boss') { const ar = M.arenaOf(g); if (!home) { home = ar.tiles.map(([x, y]) => [x + .5, y + .5]).filter(([x, y]) => !g.circleHits(x, y, .6)).sort((a, b) => Math.hypot(a[0] - ar.cx, a[1] - ar.cy) - Math.hypot(b[0] - ar.cx, b[1] - ar.cy))[0]; } g.px = home[0]; g.py = home[1]; } if (boss) { const fr = i < 30 * 40 ? 1 : i < 30 * 80 ? .6 : .3; boss.hp = Math.max(boss.hp, boss.maxHp * fr * .999); if (i % 150 === 0 && boss.hp > boss.maxHp * fr) boss.hp = boss.maxHp * fr; }
    if (i % 3 === 0) { for (const z of g.zones) { if (z.kit) { seen.add(z.kit); if (!isFinite(z.x) || !isFinite(z.y) || !isFinite(z.t)) nan++; } } for (const q of g.enemies) if (!q.dead && q.pylon) seen.add('pylons'); for (const q of g.enemies) if (!q.dead && q.kitBuf) seen.add('buffers'); if (boss?._rt.shield) seen.add('shield'); }
    maxKit = Math.max(maxKit, g.zones.filter(z => z.kit).length); maxZ = Math.max(maxZ, g.zones.filter(z => !z.env).length); }
  const out = { dng, boss: !!boss, seen: [...seen].filter(s => s !== 'move'), kit: [...kitMechs], maxKit, maxZ, nan };
  if (boss) { boss.hp = 1; g.hurtEnemy(boss, 99999, g.px, g.py); } for (let i = 0; i < 90; i++) g.update(1 / 30); out.afterKill = { kitZones: g.zones.filter(z => z.kit).length, zones: g.zones.filter(z => !z.env).length, adds: g.enemies.filter(q => !q.dead && (q.pylon || q.kitBuf)).length };
  return out; }, id);
  const r = F[id]; const miss = r.kit.filter(m => !r.seen.includes(m)); ok(r.boss && miss.length === 0 || (r.boss && miss.every(m => ['shield', 'pylons', 'buffers'].includes(m) && r.seen.length)), `${id}: kit mechanics fired in a 150 s fight (${r.seen.join(',')} of ${r.kit.join(',')})${miss.length ? ' missing ' + miss : ''}`);
  ok(r.maxKit <= 26 && r.maxZ <= 66 && r.nan === 0, `${id}: zone caps hold (kit ${r.maxKit}, all ${r.maxZ}) and no NaN`);
  ok(r.afterKill.kitZones === 0 && r.afterKill.zones === 0 && r.afterKill.adds === 0, `${id}: no stale telegraphs/adds after the boss dies ${JSON.stringify(r.afterKill)}`); }
// ---- stale checks on death / restart / reset / leave while a mechanic is live
const S = await ev(async () => { const g = window.__game, K = await import('/src/content/boss_kits.ts'); const o = {}; const snap = (k) => { o[k] = { kit: g.zones.filter(z => z.kit).length, zones: g.zones.filter(z => !z.env).length }; };
  g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.startRun('coke_ovens'); const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; f.bossKey = 'voss'; const rp = g.revealPoint(); g.px = rp.x; g.py = rp.y; g.dbg.god = true; for (let i = 0; i < 30 * 12; i++) g.update(1 / 30);
  const e = g.enemies.find(x => !x.dead && x.type === 'voss'); e.stunT = 1e4; K.castMech(g, e, 'tiles'); K.castMech(g, e, 'bombs'); snap('live'); g.dbg.god = false; g.playerDown(); snap('down'); g.returnToCheckpoint(); for (let i = 0; i < 60; i++) g.update(1 / 30); snap('respawn');
  K.castMech(g, e, 'grid'); g.restartFromCheckpoint(); snap('restart'); K.castMech(g, e, 'safe'); g.resetInstance?.(); snap('reset'); K.castMech(g, e, 'safe'); g.leaveInstance(); snap('leave'); return o; });
ok(S.live.kit > 3, 'mechanics were live before the checks ' + JSON.stringify(S.live));
for (const k of ['down', 'respawn', 'restart', 'reset', 'leave']) ok(S[k].kit === 0 && S[k].zones === 0, `after ${k}: zero stale kit zones ${JSON.stringify(S[k])}`);
// ---- drawing: every mechanic draws with Reduced FX, on and off, and on the low tier, without errors; hatch budget respected
const DR = await ev(async () => { const g = window.__game, K = await import('/src/content/boss_kits.ts'), M = await import('/src/content/mechanics.ts'), Dw = await import('/src/boss_draw.ts'), Qm = await import('/src/quality.ts'); const rend = window.__rend; const o = { errs: [], maxHatch: 0 };
  g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.startRun('coke_ovens'); const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; f.bossKey = 'voss'; const rp = g.revealPoint(); g.px = rp.x; g.py = rp.y; g.dbg.god = true; for (let i = 0; i < 30 * 12; i++) g.update(1 / 30);
  const e = g.enemies.find(x => !x.dead && x.type === 'voss'); e.stunT = 1e4; const tier0 = Qm.Q.tier;
  for (const [red, tier] of [[false, 'high'], [true, 'high'], [false, 'low']]) { g.save.settings.reducedFx = red; Qm.Q.tier = tier;
    for (const m of Object.keys(K.MECH_INFO)) { g.zones = g.zones.filter(z => z.env); g.enemies = g.enemies.filter(q => !q.kitBuf && !q.pylon); e._rt.shield = null; K.castMech(g, e, m); for (let s = 0; s < 8; s++) { for (let i = 0; i < 20; i++) { g.hp = g.maxHp; g.update(1 / 30); } try { rend.draw(1 / 30); } catch (er) { o.errs.push(m + ':' + er.message); } o.maxHatch = Math.max(o.maxHatch, Dw.bossDrawStats.hatched); } if (tier === 'low' || red) { if (Dw.bossDrawStats.hatched > 0) o.errs.push('hatching on ' + (red ? 'reduced' : tier)); } } }
  g.save.settings.reducedFx = false; Qm.Q.tier = tier0; return o; });
ok(DR.errs.length === 0, 'all mechanics draw (normal, Reduced FX, low tier) without errors/hatching on low ' + DR.errs.slice(0, 3));
ok(DR.maxHatch <= 10, `hatched telegraphs per frame capped (max ${DR.maxHatch})`);
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 3).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
