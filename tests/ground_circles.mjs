// No stale ground circles: long fights, death, respawn, instance reset/leave must leave zero temporary zones, deployables, projectiles, buff rings, particles; generic caps hold.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
const R = await ev(async () => { const g = window.__game, rend = window.__rend; const o = { snaps: {} };
  const snap = (label) => { const a = g.abx || {}; o.snaps[label] = { zones: g.zones.filter(z => !z.env).length, deps: (a.deps || []).length, delayed: (a.delayed || []).length, projs: g.projs.length + (a.projs || []).length, fx: g.fx.length, vfx: window.__vfx.live, buff: !!(a.shield > 0 || a.mit?.t > 0 || a.reflect?.t > 0 || a.dmg?.t > 0 || a.ambush?.t > 0 || (a.toggles && a.toggles.size)) }; };
  const drawn = () => { rend.ringLog = []; rend.draw(1 / 30); const n = rend.ringLog.length; rend.ringLog = null; return n; };
  g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.startRun('warehouse'); g.revealing = false; g.dbg.god = false;
  const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; g.px = g.level.revealX + 1.5; g.py = g.level.bossSpawn.y; const hasBoss = () => g.enemies.some(e => !e.dead && window.__enemies?.[e.type]?.boss);
  // long fight with abilities spammed: generic caps must hold
  const eng = await import('/src/abilities/engine.ts'); const ids = Object.keys((await import('/src/abilities/registry.ts')).ABILITY_BY_ID); let maxDeps = 0, maxZ = 0, maxFx = 0;
  for (let i = 0; i < 30 * 120; i++) { g.hp = g.maxHp; if (i % 45 === 0) { const a = ids[(i / 45 | 0) % ids.length]; try { g.heat = 0; g.abCd = [0, 0, 0]; eng.abxCast(g, { id: a }, 0, { wx: g.px + 2, wy: g.py }, { tx: g.px + 2, ty: g.py }); } catch {} } g.update(1 / 30); if (hasBoss()) o.hasBoss = true; const a = g.abx; maxDeps = Math.max(maxDeps, a.deps.length); maxZ = Math.max(maxZ, g.zones.filter(z => !z.env).length); maxFx = Math.max(maxFx, g.fx.length); }
  o.maxDeps = maxDeps; o.maxZ = maxZ; o.maxFx = maxFx; snap('fight');
  // push stale junk (bad lifetimes) and make sure the safety net removes it within ~1 s
  g.zones.push({ x: g.px + 3, y: g.py, r: 2, t: 0, life: Infinity, dps: 5, heat: 1, windup: .1 }, { x: g.px + 4, y: g.py, r: 2, t: 99, life: 2, dps: 5, heat: 1, windup: .1 }); g.abx.deps.push({ kind: 'aura', x: g.px, y: g.py, t: 50, life: 3, every: 1, acc: 0, r: 2, tick: [], ab: { type: 'attack', id: 'x' }, ang: 0 }); for (let i = 0; i < 40; i++) g.update(1 / 30); o.junk = g.zones.filter(z => !z.env && (!isFinite(z.life) || z.t > z.life + 1)).length + g.abx.deps.filter(d => d.t > d.life + 1).length;
  // death with active buffs/zones/deployables: transients cleared immediately, no rings while downed
  g.abx.shield = 50; g.abx.mit = { m: .5, t: 9 }; g.zones.push({ x: g.px + 2, y: g.py, r: 2, t: 0, life: 6, dps: 5, heat: 1, windup: .5 }); g.playerDown(); snap('down'); o.ringsDown = (() => { rend.ringLog = []; rend.draw(1 / 30); const pr = rend.ringLog.filter(r => Math.hypot(r.x - g.px, r.y - g.py) < 3).length; rend.ringLog = null; return pr; })();
  g.returnToCheckpoint(); for (let i = 0; i < 60; i++) g.update(1 / 30); snap('respawn');
  g.zones.push({ x: g.px + 2, y: g.py, r: 2, t: 0, life: 6, dps: 5, heat: 1, windup: .5 }); g.restartFromCheckpoint(); snap('restart');
  // defib, reset, leave
  g.playerDown(); g.zones.push({ x: g.px + 2, y: g.py, r: 2, t: 0, life: 6, dps: 5, heat: 1, windup: .5 }); g.build.passives.push('defib'); g.defibCd = 0; g.defibInPlace(); snap('defib');
  g.zones.push({ x: g.px + 2, y: g.py, r: 2, t: 0, life: 6, dps: 5, heat: 1, windup: .5 }); g.abx.deps.push({ kind: 'aura', x: g.px, y: g.py, t: 0, life: 30, every: 1, acc: 0, r: 2, tick: [], ab: { type: 'attack', id: 'x' }, ang: 0 }); g.resetInstance?.(); snap('reset');
  g.zones.push({ x: g.px + 2, y: g.py, r: 2, t: 0, life: 6, dps: 5, heat: 1, windup: .5 }); g.leaveInstance(); snap('leave'); o.townRings = drawn(); o.townZones = g.zones.length; for (let i = 0; i < 60; i++) g.update(1 / 30); o.townAfter = { zones: g.zones.length, ringsDrawn: drawn() };
  return o; });
console.log(JSON.stringify(R));
ok(R.hasBoss, 'a boss fight ran for 120 s');
ok(R.maxDeps <= 24 && R.maxZ <= 40 && R.maxFx <= 260, `caps hold over a long ability-spam fight (deps ${R.maxDeps}, zones ${R.maxZ}, fx ${R.maxFx})`);
ok(R.junk === 0, 'safety net removes zones/deployables with stale or non-finite lifetimes');
const clean = s => s && s.zones === 0 && s.deps === 0 && s.delayed === 0 && s.projs === 0 && s.vfx === 0 && !s.buff;
for (const k of ['down', 'respawn', 'restart', 'defib', 'reset', 'leave']) ok(clean(R.snaps[k]), `after ${k}: zero stale circles/zones/deployables/projectiles/buffs/particles ${JSON.stringify(R.snaps[k])}`);
ok(R.ringsDown === 0, 'no ability/buff rings drawn on the player while downed (' + R.ringsDown + ')');
ok(R.townZones === 0 && R.townAfter.zones === 0, 'town: zero zones after leaving the instance');
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
