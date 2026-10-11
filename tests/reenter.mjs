// Re-entering a saved instance: enemies restored with HP, killed stay dead, boss flags kept, no leftover temporary zones; saves made while in town (pagehide/visibility) must not wipe the instance; party (net-) instances never overwrite the solo save.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
const start = () => ev(() => { const g = window.__game; g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.startRun('warehouse'); g.revealing = false; for (let i = 0; i < 60; i++) g.update(1 / 30);
  const live = g.enemies.filter(e => !e.dead && e.faction === 'enemy'); const hurt = live[0]; hurt.hp = hurt.maxHp * .4; for (const e of live.slice(1, 4)) g.killEnemy(e); g.inst.flags.gate1 = true; for (const e of g.enemies) e.stunT = 1e4;
  g.zones.push({ x: g.px + 2, y: g.py, r: 2, t: 0, life: 20, dps: 5, heat: 1, windup: .5 }); g.abx.deps.push({ kind: 'aura', x: g.px, y: g.py, t: 0, life: 60, every: 1, acc: 0, r: 2, tick: [], ab: { type: 'attack', id: 'x' }, ang: 0 });
  return { alive: g.enemies.filter(e => !e.dead && e.faction === 'enemy').length, hurtId: hurt.id, hurtHp: hurt.hp, dead: g.enemies.filter(e => e.dead).length }; });
const inTownSaves = () => ev(() => { const g = window.__game; g.saveNow(); window.dispatchEvent(new Event('pagehide')); document.dispatchEvent(new Event('visibilitychange')); for (let i = 0; i < 90; i++) g.update(1 / 30); g.saveNow(); return { mode: g.mode, saved: g.save.instance ? g.save.instance.enemies.filter(e => !e.dead).length : -1 }; });
const reenter = () => ev(() => { const g = window.__game; const r = g.startRun('warehouse'); const live = g.enemies.filter(e => !e.dead && e.faction === 'enemy'); const h = g.enemies.find(e => e.hp < e.maxHp && !e.dead); return { r, mode: g.mode, alive: live.length, hurt: h ? [h.id, h.hp] : null, zones: g.zones.filter(z => !z.env).length, deps: g.abx.deps.length, gate1: g.inst.flags.gate1, fx: g.fx.length }; });
const paths = {
  normal: () => ev(() => { const g = window.__game; g.townReturn(); for (let i = 0; i < 20 * 30 && g.mode === 'run'; i++) { if (!g.channel) g.townReturn(); g.update(1 / 30); } return [g.mode, g.save.instance.enemies.filter(e => !e.dead && e.faction === 'enemy').length]; }),
  emergency: () => ev(() => { const g = window.__game; g.townReturn(); g.townInterrupt('x', true); g.townReturn(); for (let i = 0; i < 8.5 * 30; i++) { g.hp = g.maxHp; g.update(1 / 30); } return [g.mode, g.save.instance.enemies.filter(e => !e.dead && e.faction === 'enemy').length]; }),
  death: () => ev(() => { const g = window.__game; g.playerDown(); g.returnToCheckpoint(); g.townReturn(); for (let i = 0; i < 20 * 30 && g.mode === 'run'; i++) { if (!g.channel) g.townReturn(); g.update(1 / 30); } return [g.mode, g.save.instance.enemies.filter(e => !e.dead && e.faction === 'enemy').length]; }),
  downedExit: () => ev(() => { const g = window.__game; g.playerDown(); g.townReturn(); for (let i = 0; i < 8.5 * 30; i++) { g.hp = g.maxHp; g.update(1 / 30); } return [g.mode, g.save.instance.enemies.filter(e => !e.dead && e.faction === 'enemy').length]; }),
};
for (const [name, leave] of Object.entries(paths)) {
  const s = await start(); const [m, alive] = await leave(); s.alive = alive; const t = await inTownSaves(); const r = await reenter();
  ok(m === 'town' && t.saved === s.alive, `${name}: left to town; saves made in town keep the roster (${t.saved}/${s.alive})`);
  ok(r.r && r.mode === 'run' && r.alive === s.alive, `${name}: re-entry restores ${r.alive}/${s.alive} living enemies (killed stay dead)`);
  ok(r.hurt && r.hurt[0] === s.hurtId && Math.abs(r.hurt[1] - s.hurtHp) < 1, `${name}: damaged enemy keeps its HP`);
  ok(r.zones === 0 && r.deps === 0 && r.fx === 0 && r.gate1, `${name}: no leftover temporary zones/deployables/fx; flags kept (${JSON.stringify({ z: r.zones, d: r.deps, fx: r.fx })})`);
}
// abandon: instance gone, next entry is a fresh full roster
{ const s = await start(); const r = await ev(() => { const g = window.__game; g.leaveInstance(); const had = !!g.save.instance; g.saveNow(); const x = g.startRun('warehouse'); return { had, x, alive: g.enemies.filter(e => !e.dead && e.faction === 'enemy').length, zones: g.zones.filter(z => !z.env).length }; });
  ok(!r.had && r.x && r.alive > 20 && r.zones === 0, 'abandon: instance cleared, fresh run has a full roster and no leftover zones: ' + JSON.stringify(r)); }
// boss state survives leaving mid-fight (boss resets to a fresh reveal, kills stay)
{ await start(); const r = await ev(() => { const g = window.__game; const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; g.px = g.level.revealX + 1.5; g.py = g.level.bossSpawn.y; let had0 = false; for (let i = 0; i < 900; i++) { g.hp = g.maxHp; g.update(1 / 30); if (g.enemies.some(e => !e.dead && window.__enemies?.[e.type]?.boss)) { had0 = true; break; } } const had = had0 || g.enemies.some(e => !e.dead && window.__enemies?.[e.type]?.boss);
    g.leaveInstance === undefined; g.townReturn(); g.townInterrupt('x', true); g.townReturn(); for (let i = 0; i < 9 * 30; i++) { g.hp = g.maxHp; g.update(1 / 30); } g.saveNow(); const mode = g.mode; g.startRun('warehouse'); return { had, mode, ctrl: g.inst.flags.controller, zones: g.zones.filter(z => !z.env).length, alive: g.enemies.filter(e => !e.dead).length }; });
  ok(r.mode === 'town' && r.ctrl && r.zones === 0 && r.alive > 0, 'boss fight: emergency exit and re-entry keep flags, enemies present, no stale zones: ' + JSON.stringify(r)); }
// repair: an instance whose roster was wiped by the old save-in-town bug is rebuilt on entry
{ await start(); const r = await ev(() => { const g = window.__game; g.townReturn(); for (let i = 0; i < 20 * 30 && g.mode === 'run'; i++) { if (!g.channel) g.townReturn(); g.update(1 / 30); } g.save.instance.enemies = []; const x = g.startRun('warehouse'); return { x, alive: g.enemies.filter(e => !e.dead && e.faction === 'enemy').length }; });
  ok(r.x && r.alive > 20, 'wiped roster is repaired on re-entry (' + r.alive + ' enemies)'); }
// party: a net- instance is never written into the solo save, and the solo instance survives
{ await start(); const r = await ev(() => { const g = window.__game; const solo = g.save.instance; const soloAlive = solo.enemies.filter(e => !e.dead).length; const keepInst = g.inst; const net = { ...JSON.parse(JSON.stringify({ ...keepInst, enemies: [] })), id: 'net-123' }; g.inst = net; g.saveNow(); const same = g.save.instance === solo; g.inst = keepInst; g.saveNow(); return { same, id: g.save.instance.id, soloAlive, after: g.save.instance.enemies.filter(e => !e.dead).length }; });
  ok(r.same && r.id !== 'net-123' && r.after === r.soloAlive, 'party (net-) instance never replaces the solo save: ' + JSON.stringify(r)); }
// env hazards render as dashed outlines (not telegraph discs)
{ const r = await ev(() => { const g = window.__game, rd = window.__rend; g.startRun('warehouse'); const z = g.zones.find(z => z.env); const fills = []; const op = rd.poly.bind(rd); rd.poly = (pts, f, s, a, lw) => { fills.push([f, s, a]); return op(pts, f, s, a, lw); }; rd.drawZone(z); rd.poly = op; return fills; });
  ok(r.length === 2 && r[0][2] <= .12 && r[1][0] === undefined, 'level hazards: faint fill + dashed rim ' + JSON.stringify(r)); }
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
