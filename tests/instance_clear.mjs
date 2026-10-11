// Instance completion flow: for every dungeon, killing the boss completes the instance immediately, never blocks another
// dungeon (lockout only on the cleared one), survives reload, is migrated when stuck, and needs no Abandon.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch();
const ev = (fn, arg) => page.evaluate(fn, arg);
const ids = await ev(async () => (await import('/src/content/dungeons.ts')).DUNGEON_LIST.map(d => d.id));
ok(ids.length >= 24, 'dungeon list has ' + ids.length + ' dungeons');
// start dungeon `id` fresh, spawn + kill its boss through the sim; returns state
const clear = (id) => ev(async (id) => {
  const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.level = 40; g.save.settings.devFreeReset = false;
  const started = g.startRun(id); if (!started) return { started };
  const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; g.applyDoors();
  { const rp = g.revealPoint(); g.px = rp.x; g.py = rp.y; } for (let i = 0; i < 600 && !g.enemies.some(e => e.type === f.bossKey && !e.dead); i++) g.update(0.016);
  const boss = g.enemies.find(e => !e.dead && e.type === f.bossKey); if (!boss) return { started, noBoss: true, key: f.bossKey };
  window.__events = []; const old = g.emit; g.emit = (t, p) => { window.__events.push(t); return old(t, p); };
  g.drops = g.inst.drops; g.killEnemy(boss); g.emit = old;
  return { started, flags: { ...g.inst.flags }, ev: window.__events.slice(), lock: g.save.lockouts[id] || (id === 'annex' ? g.save.lastClearDay : null), drops: g.inst.drops.length };
}, id);
for (const id of ids) {
  const r = await clear(id);
  ok(r.started && !r.noBoss, id + ': boss spawns and dies' + (r.noBoss ? ' (no boss ' + r.key + ')' : ''));
  if (!r.flags) continue;
  ok(r.flags.bossDead && r.flags.completed && r.flags.rewardsGranted, id + ': boss defeat marks instance cleared immediately');
  ok(r.ev.includes('boss-dead') && !!r.lock, id + ': clear event emitted + lockout recorded for this dungeon');
  // summary acknowledgement shows
  await ev(() => { window.__ui.close(); window.__ui.open('summary'); });
  const t = await ev(() => document.getElementById('modal').textContent);
  ok(/CLEARED/.test(t) && /Return to town/.test(t), id + ': summary panel shows CLEARED + Return to town');
  await ev(() => window.__ui.close());
  // another dungeon can be entered without abandoning; lockout applies only to the cleared one
  const other = ids.find(x => x !== id);
  const o = await ev(([other, id]) => { const g = window.__game; g.enterTown(); const hadInst = !!g.save.instance; let ok2 = g.startRun(other); if (!ok2 && g.save.instance) ok2 = g.startRun(other); /* confirm repeat */ const inOther = g.save.instance?.dungeon === other && g.mode === 'run';
    g.enterTown(); g.save.instance = null; g.inst = null; return { hadInst, inOther, lockedCleared: g.dailyLocked(id), lockedOther: g.dailyLocked(other) }; }, [other, id]);
  ok(o.inOther, id + ': can enter another dungeon after the clear (no abandon needed)');
  ok(o.lockedCleared && !o.lockedOther, id + ': lockout only on the cleared dungeon');
}
// ---- return paths on the first and a late dungeon ----
for (const id of [ids[0], ids[ids.length - 1]]) {
  // B / channel path with loot on ground: auto-collect and instance retired or retained correctly
  await clear(id);
  const a = await ev(() => { const g = window.__game; const inst = g.inst; inst.drops.push({ id: 9001, kind: 'credits', amount: 50, x: g.px, y: g.py }); g.enemies.forEach(e => { e.dead = true; }); g.townReturn(); for (let i = 0; i < 600 && g.mode === 'run'; i++) g.update(0.016); return { mode: g.mode, inst: !!g.save.instance, credits: g.save.credits }; });
  ok(a.mode === 'town', id + ': return to town (channel) completes after clear');
  ok(!a.inst, id + ': finished instance retired on return (ground loot auto-collected, pack banked)');
  const again = await ev((id) => { const g = window.__game; return { locked: g.dailyLocked(id), rs: g.resetInfo().has }; }, id);
  ok(again.locked && !again.rs, id + ': no stuck instance; dungeon locked for today');
  // exit path / reload mid-completion
  await clear(id);
  await ev(() => { const g = window.__game; g.inst.drops.push({ id: 9200, kind: 'stim', x: g.level.spawn.x, y: g.level.spawn.y }); g.saveNow(); });
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__game);
  const rl = await ev(() => { const g = window.__game; const i = g.save.instance; return { inst: !!i, done: !!i?.flags.bossDead, mode: g.mode }; });
  ok(rl.inst && rl.done, id + ': reload mid-completion keeps the cleared instance (flags persisted)');
  const rl2 = await ev((id) => { const g = window.__game; const other = id === 'annex' ? 'foundry' : 'annex'; g.save.level = 40; const r = g.startRun(other) || g.startRun(other); const res = { entered: r && g.save.instance?.dungeon === other }; g.enterTown(); g.save.instance = null; g.inst = null; return res; }, id);
  ok(rl2.entered, id + ': after reload another dungeon can be started');
}
// ---- left-over loot warning: first Start warns and keeps instance, confirm discards ----
await clear(ids[0]);
const w = await ev((other) => { const g = window.__game; g.inst.drops.push({ id: 9100, kind: 'stim', x: g.px, y: g.py }); for (let i = 0; i < 12; i++) g.inst.carried.items.push(g.inst.carried.items[0] || { uid: 'x' + i, def: 'stock_arms' }); g.enterTown(); const first = g.startRun(other); const kept = !!g.save.instance; const second = g.startRun(other); return { first, kept, second, now: g.save.instance?.dungeon }; }, ids[1]);
ok(!w.first && w.kept && w.second && w.now === ids[1], 'leftover loot: first Start warns (instance kept), confirm repeats and starts');
// ---- migration: stuck live instance whose boss enemy is dead but flags never set ----
await clear(ids[2]);
const m = await ev(async (id) => { const g = window.__game; const i = g.save.instance; i.drops.push({ id: 9201, kind: 'stim', x: g.level.spawn.x, y: g.level.spawn.y }); i.flags.bossDead = false; i.flags.completed = false; i.flags.rewardsGranted = false; g.save.lockouts = {}; g.save.lastClearDay = null; const { Game } = await import('/src/sim.ts'); const g2 = new Game(g.save, () => {}); return { done: g2.save.instance?.flags.bossDead, lock: g2.dailyLocked(id) }; }, ids[2]);
ok(m.done && m.lock, 'migration: stuck instance with a dead boss is marked cleared and lockout applied');
// ---- objective text states ----
await clear(ids[0]);
const ob = await ev(() => { const g = window.__game; const inst = g.inst; inst.drops.length = 0; const x = g.px, y = g.py; inst.drops.push({ id: 9300, kind: 'stim', x, y }, { id: 9301, kind: 'credits', amount: 5, x, y }); const a = g.objective(); inst.drops.length = 0; const b = g.objective(); g.inst.flags.bossDead = false; g.inst.flags.bossSpawned = false; g.inst.flags.controller = true; const c = g.objective(); return [a, b, c]; });
ok(/^Boss defeated! Pick up your loot \(2 nearby\), then press B to return to town$/.test(ob[0].text) && ob[0].kind === 'loot', 'objective after boss: loot nearby text + loot arrow target');
ok(ob[1].text === 'Dungeon cleared. Press B to return to town.', 'objective when loot gone: Dungeon cleared');
ok(/^Enter the open boss chamber$/.test(ob[2].text) && !/\(T\)/.test(ob.map(o => o.text).join()), 'objective strings are verb-first and never mention (T)');
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
