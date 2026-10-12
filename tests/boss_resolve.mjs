// Boss attack audit (docs/BOSSES.md "Resolution audit"): instruments every ground telegraph of every boss during a live fight and flags
//  (a) orphan telegraphs: no area that can ever hurt/affect, or removed before its windup finished (cancelled), or never resolves (life <= windup)
//  (b) hits without a tell: damaging zones with (almost) no windup
//  (c) too brief to read: windup < 0.6 s for damaging zones
//  (d) negligible effect: at resolution a probe target standing inside takes < 3% max HP / no heat / no push-pull / no onFire effect
// Each telegraph is resolved by calling the real tickZone on a clone with a probe target inside it and measuring the effect.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
const ids = (process.env.ONLY ? process.env.ONLY.split(',') : null) || await ev(async () => { const C = await import('/src/config.ts'); return Object.entries(C.ENEMIES).filter(([, d]) => d.boss).map(([id]) => id); });
const all = {}; const flags = [];
for (const id of ids) {
  const r = await ev(async (bossId) => { const g = window.__game, { DUNGEONS } = await import('/src/content/dungeons.ts'), M = await import('/src/content/mechanics.ts');
    const ZS = await import(performance.getEntriesByType('resource').map(x => x.name).find(n => /zoneshape\.ts/.test(n)));
    const dng = Object.keys(DUNGEONS).find(k => DUNGEONS[k].defaultBoss === bossId) || 'warehouse'; g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.startRun(dng);
    const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; f.bossKey = bossId; const rp = g.revealPoint(); g.px = rp.x; g.py = rp.y; g.dbg.god = true;
    const tracked = new Map(), seenP = new WeakSet(); const kinds = {}; let home = null, boss = null; const mhp = g.maxHp;
    const probe = (z) => { // find a point inside the damaging shape, apply the real tick, measure
      const R = Math.max(z.R || 0, z.r || 0, z.len || 0, 6) + 2; let pt = null;
      for (let k = 0; k < 400 && !pt; k++) { const a = k * 2.399, d = Math.sqrt(k / 400) * R; const x = z.x + Math.cos(a) * d, y = z.y + Math.sin(a) * d; if (ZS.zoneInside(z, x, y, 0)) pt = [x, y]; }
      if (!pt && z.shape !== 'safe') for (let k = 0; k < 360 && !pt; k++) { const a = k / 360 * 6.283; for (const d of [.5, 1, 2, 3, 5, 8]) { const x = z.x + Math.cos(a) * d, y = z.y + Math.sin(a) * d; if (ZS.zoneInside(z, x, y, 0)) { pt = [x, y]; break; } } }
      if (z.shape === 'ring' && z.grow) { const ga = (z.gapA || 0) + Math.PI, dd = ((z.r0 || 0) + z.r) / 2 + 1.5; pt = [z.x + Math.cos(ga) * dd, z.y + Math.sin(ga) * dd]; }
      if (!pt) return { area: false };
      const c = Object.assign({}, z, { hitSet: new Set(), fired: true, t: (z.windup || 0) + .1, rt2: 0 }); let dmg = 0; const tg = { px: pt[0], py: pt[1], g: { heat: 0, zoneTick: 9, px: pt[0], py: pt[1], moveCircle: (x, y, mx, my) => ({ x: x + mx, y: y + my }) }, hurt: (d) => { dmg += d; } };
      for (let s = 0; s < (z.grow ? 30 : 6); s++) { try { ZS.tickZone(g, c, .1, [tg], 100, .4); } catch (e) { return { area: true, err: e.message }; } }
      const moved = Math.hypot(tg.g.px - pt[0], tg.g.py - pt[1]);
      return { area: true, dmg, heat: tg.g.heat, moved, hook: !!(z.onFire || z.onEnd) }; };
    for (let i = 0; i < 30 * 110; i++) { g.hp = g.maxHp; g.update(1 / 30); boss = g.enemies.find(x => !x.dead && x.type === bossId);
      if (boss && g.zoneAt(g.px, g.py) !== 'boss') { const ar = M.arenaOf(g); if (!home) home = ar.tiles.map(([x, y]) => [x + .5, y + .5]).filter(([x, y]) => !g.circleHits(x, y, .6)).sort((a, b) => Math.hypot(a[0] - ar.cx, a[1] - ar.cy) - Math.hypot(b[0] - ar.cx, b[1] - ar.cy))[0]; g.px = home[0]; g.py = home[1]; }
      if (boss) { const fr = i < 30 * 40 ? 1 : i < 30 * 75 ? .6 : .3; boss.hp = Math.max(boss.hp, boss.maxHp * fr * .999); if (i % 150 === 0 && boss.hp > boss.maxHp * fr) boss.hp = boss.maxHp * fr; }
      for (const pr of g.projs) if (!seenP.has(pr)) { seenP.add(pr); for (const [z, o] of tracked) if (o.resolved && !o.gone && z.t - z.windup < .7) o.spawned = (o.spawned || 0) + 1; }
      const live = new Set(g.zones);
      for (const z of g.zones) { if (z.env) continue; if (!tracked.has(z)) tracked.set(z, { key: (z.kit || z.src || '?') + ':' + (z.style || z.shape || 'disc'), spawnT: i, windup: z.windup, life: z.life, dps: z.dps, burst: !!z.burst, ghost: z.shape === 'ghost', probe: null, resolved: false }); const o = tracked.get(z); o.t = z.t; if (!o.resolved && z.t >= z.windup) { o.resolved = true; if (!o.ghost) o.probe = probe(z); else o.probe = { ghost: true }; } o.heatOnly = !!z.heatOnly; o.follow = !!z.follow; }
      for (const [z, o] of tracked) if (!live.has(z) && !o.gone) { o.gone = true; o.goneEarly = !o.resolved && boss && !boss.dead; if (o.goneEarly && (kinds._dbg ||= []).length < 4) kinds._dbg.push([i, o.t, z.t, z.windup, z.life, boss.hp / boss.maxHp, g.zones.length, g.downed, g.revealing]); } }
    delete kinds._dbg0; for (const [z, o] of tracked) { const k = o.key; const a = kinds[k] ||= { n: 0, orphan: 0, cancelled: 0, noTell: 0, brief: 0, weak: 0, noRes: 0, minW: 99, maxDmg: 0, heat: 0, moved: 0, hook: 0, ghost: 0, dmgZones: 0 };
      a.n++; a.minW = Math.min(a.minW, o.windup || 0); if (o.ghost) { a.ghost++; continue; } if (o.goneEarly) a.cancelled++; if (!(o.life > o.windup)) a.noRes++;
      const p = o.probe; if (!p) { if (!o.gone) { /* still in windup at end of run: not judged */ } continue; } if (!p.area) { a.orphan++; continue; }
      if (o.dps > 0 && !o.heatOnly) { a.dmgZones++; a.maxDmg = Math.max(a.maxDmg, p.dmg / mhp); if ((o.windup || 0) < .3 && !o.follow) a.noTell++; else if ((o.windup || 0) < .6) a.brief++; if (p.dmg < .03 * mhp) a.weak++; }
      else { if (o.spawned > 0) a.hook++; if (p.heat > 0) a.heat++; if (p.moved > 0) a.moved++; if (p.hook) a.hook++; if (!(p.heat > 0 || p.moved > 0 || p.hook || o.spawned > 0)) a.orphan++; } }
    const dbg = kinds._dbg; delete kinds._dbg; return { dng, boss: !!boss, kinds, n: tracked.size, dbg }; }, id);
  all[id] = r; if (r.dbg) console.log('DBG', id, JSON.stringify(r.dbg)); ok(r.boss, `${id}: boss fight ran (${r.n} telegraphs observed)`);
  for (const [k, a] of Object.entries(r.kinds)) { const bad = []; if (a.orphan) bad.push('orphan x' + a.orphan); if (a.cancelled) bad.push('cancelled-before-resolve x' + a.cancelled); if (a.noRes) bad.push('never resolves x' + a.noRes); if (a.noTell) bad.push('no tell x' + a.noTell); if (a.brief) bad.push('too brief x' + a.brief); if (a.weak) bad.push('negligible damage x' + a.weak);
    if (bad.length) { flags.push({ boss: id, key: k, bad, a }); } }
}
console.log('\nTelegraph kinds audited:', Object.values(all).reduce((n, r) => n + Object.keys(r.kinds).length, 0), 'flagged:', flags.length);
for (const f of flags) console.log('FLAG', f.boss, f.key, f.bad.join('; '), 'minW', f.a.minW.toFixed?.(2), 'maxDmg%', (f.a.maxDmg * 100).toFixed(1));
const by = {}; for (const f of flags) for (const b of f.bad) (by[b.split(' x')[0]] ||= []).push(f.boss + ':' + f.key);
ok(!(by['orphan'] || []).length, 'no orphan telegraphs (no area / no effect) ' + JSON.stringify(by['orphan'] || []).slice(0, 400));
ok(!(by['cancelled-before-resolve'] || []).length, 'no telegraph vanishes before it resolves ' + JSON.stringify(by['cancelled-before-resolve'] || []).slice(0, 400));
ok(!(by['never resolves'] || []).length, 'every telegraph outlives its windup ' + JSON.stringify(by['never resolves'] || []).slice(0, 300));
ok(!(by['no tell'] || []).length, 'no damaging zone without a tell ' + JSON.stringify(by['no tell'] || []).slice(0, 300));
ok(!(by['too brief'] || []).length, 'every damaging telegraph is readable (>= 0.6 s) ' + JSON.stringify(by['too brief'] || []).slice(0, 300));
ok(!(by['negligible damage'] || []).length, 'no pointless attacks (damage >= 3% max HP) ' + JSON.stringify(by['negligible damage'] || []).slice(0, 500));
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 3).join('|'));
import fs from 'fs'; fs.writeFileSync(process.env.OUT || '/tmp/boss_resolve.json', JSON.stringify({ all, flags }));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
