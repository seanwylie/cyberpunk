// Reset-instance, ranged weapons and dungeon guidance tests (headless Chrome, real game objects).
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch();
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = (secs) => ev(s => { const g = window.__game; for (let i = 0; i < s / 0.016; i++) g.update(0.016); }, secs);
const fresh = (id, level) => ev(([id, level]) => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.settings.devFreeReset = false; if (level) { g.save.level = level; g.recompute(); } g.dbg.god = true; return g.startRun(id); }, [id, level]);

// ---- reset instance ----
ok(await fresh('annex', 12), 'fresh run starts');
let r = await ev(() => { const g = window.__game; const id0 = g.inst.id; g.inst.carried.items.push({ uid: 'x1', def: 'mm_autopistol', chips: [] }); const info = g.resetInfo(); const okr = g.resetInstance(); return { id0, id1: g.inst && g.inst.id, info, okr, mode: g.mode, items: g.inst.carried.items.length }; });
ok(r.info.allowed && !r.info.completed && r.okr && r.id1 !== r.id0 && r.mode === 'run' && r.items === 0, 'reset of an unfinished instance is free, discards carried loot and restarts fresh in the same dungeon');
r = await ev(() => { const g = window.__game; g.inst.flags.rewardsGranted = true; g.inst.flags.completed = true; g.inst.flags.bossDead = true; g.save.lastClearDay = (new Date()).getFullYear() + '-' + ((new Date()).getMonth() + 1) + '-' + (new Date()).getDate(); const info = g.resetInfo(); const okr = g.resetInstance(); return { info, okr }; });
ok(!r.info.allowed && r.info.completed && !r.okr, 'completed (lockout consumed) instance cannot be freely reset (spec)');
r = await ev(() => { const g = window.__game; g.save.settings.devFreeReset = true; const info = g.resetInfo(); const id0 = g.inst.id; const okr = g.resetInstance(); return { info, okr, fresh: g.inst && g.inst.id !== id0 && !g.inst.flags.bossDead, locked: g.dailyLocked('annex') }; });
ok(r.info.allowed && r.info.dev && r.okr && r.fresh && !r.locked, 'prototype toggle allows resetting a cleared dungeon and refunds the lockout');
r = await ev(() => { const g = window.__game; g.save.settings.devFreeReset = false; const inst = g.inst; inst.checkpoint = { id: 2, x: g.level.checkpoints[1].x, y: g.level.checkpoints[1].y }; g.px = 3; g.py = 3; g.restartFromCheckpoint(); return Math.hypot(g.px - inst.checkpoint.x, g.py - inst.checkpoint.y) < .01; });
ok(r, 'restart from checkpoint returns to the last checkpoint without wiping state');
await ev(() => { const g = window.__game; g.enterTown(); window.__ui.resetAsk = false; window.__ui.open('gate'); });
let t = await ev(() => document.getElementById('modal').textContent);
ok(/Reset instance/.test(t), 'dungeon select shows Reset instance for a live instance');
await ev(() => { document.querySelector('#modal [data-act="reset-ask"]').click(); }); t = await ev(() => document.getElementById('modal').textContent);
ok(/Confirm reset/.test(t) && /Cancel/.test(t), 'reset asks for confirmation');
await ev(() => { document.querySelector('#modal [data-act="reset-go"]').click(); });
ok(await ev(() => window.__game.save.instance === null), 'confirm reset abandons the instance from the gate');
await ev(() => { window.__ui.open('settings'); document.getElementById('stab-about').click(); }); t = await ev(() => document.getElementById('modal').textContent);
ok(/PROTOTYPE:/.test(t), 'settings has the clearly-labelled prototype reset toggle');
await fresh('annex', 12); await ev(() => { window.__ui.open('settings'); document.getElementById('stab-instance').click(); }); t = await ev(() => document.getElementById('modal').textContent);
ok(/Reset instance/.test(t) && /Restart from checkpoint/.test(t), 'in-run menu offers Reset instance and Restart from checkpoint');
await ev(() => { window.__game.devRestartFromStart(); }); ok(await ev(() => window.__game.mode === 'run' && window.__game.inst.elapsed < 1), 'dev restart-from-start works');

// ---- ranged weapons ----
const wp = await ev(async () => { const c = await import('/src/config.ts'); const g = window.__game; const out = {}; out.def = g.build.weapon.kind; out.defRange = g.build.weapon.range; out.defStationary = !!g.build.weapon.stationary; const ids = ['mm_autopistol', 'ps_needle_rifle', 'hi_shard_arm', 'ps_arc_caster', 'hi_slug_cannon', 'mm_shocktack']; out.items = ids.map(i => !!c.ITEM_BY_ID[i]); return out; });
ok(wp.def === 'popper' && wp.defRange >= 4 && !wp.defStationary, 'default hardware has a weak, mobile ranged option (range ' + wp.defRange + ')');
ok(wp.items.every(Boolean), 'all new ranged weapon items exist');
const fire = (id) => ev(async (id) => { const c = await import('/src/config.ts'); const m = await import('/src/state.ts'); const g = window.__game; g.enterTown(); g.save.level = 30; g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.dbg.god = true; const stk = g.save.items.find(i => i.def === 'stock_handR'); g.save.installed.handR = stk.uid; const it = id === 'stock_handR' ? stk : m.mkInst(g.save, id); if (it !== stk) g.save.items.push(it); g.save.installed[c.ITEM_BY_ID[id].slot] = it.uid; g.recompute(); g.startRun('annex'); const L = g.level; g.px = L.spawn.x; g.py = L.spawn.y; for (const e of g.enemies) e.dead = true; const e = g.spawnEnemy('worker', g.px + 4.5, g.py); e.alert = false; e.hp = e.maxHp = 100000; g.target = e.id; g.heat = 0; const hp0 = e.hp; g.moving = true; for (let i = 0; i < 125; i++) { g.inputMove.x = 0; g.inputMove.y = 0; g.update(0.016); } return { dealt: hp0 - e.hp, heat: g.heat, kind: g.build.weapon.kind, moving: g.build.weapon.stationary }; }, id);
for (const id of ['stock_handR', 'mm_autopistol', 'ps_needle_rifle', 'hi_shard_arm', 'ps_arc_caster', 'hi_slug_cannon']) { const o = await fire(id); ok(o.dealt > 0, id + ' (' + o.kind + ') deals damage at range 4.5 (' + Math.round(o.dealt) + ' in 2s, heat ' + Math.round(o.heat) + ')'); }
const mv = await ev(async () => { const c = await import('/src/config.ts'); const g = window.__game; const out = {}; for (const k of ['popper', 'autopistol', 'burst', 'shard', 'arc']) out[k] = !c.WEAPONS[k].stationary; out.slug = !!c.WEAPONS.slug.stationary; out.mul = c.WEAPON_RARITY_MUL; return out; });
ok(mv.popper && mv.autopistol && mv.burst && mv.shard && mv.arc && mv.slug, 'light ranged weapons fire while moving; slug driver stays stationary');
ok(mv.mul.grey < mv.mul.green && mv.mul.green < mv.mul.blue && mv.mul.blue < mv.mul.purple && mv.mul.purple < mv.mul.orange, 'rarity scales weapon damage');
const loot = await ev(async () => { const m = await import('/src/content/dungeons.ts'); const c = await import('/src/config.ts'); const W = ['mm_autopistol', 'ps_needle_rifle', 'hi_shard_arm', 'ps_arc_caster', 'hi_slug_cannon', 'mm_shocktack']; const out = {}; for (const d of m.DUNGEON_LIST) { const pools = d.loot ? Object.values(d.loot).flat() : Object.values(c.LOOT).filter(x => x.pool).flatMap(x => x.pool); out[d.id] = pools.some(e => e.item && W.includes(e.item)); } return out; });
ok(Object.values(loot).every(Boolean), 'every dungeon has ranged weapons in its loot pools: ' + JSON.stringify(loot));

// ---- guidance / summary ----
await fresh('foundry', 24);
const gd = await ev(() => { const g = window.__game; g.pathT = 0; const x = g.guidance(); return x && { text: x.obj.text, d: x.dist, wp: !!x.wp }; });
ok(gd && gd.wp && gd.d > 5 && /Secure/.test(gd.text), 'objective guidance gives a pathed waypoint and text: ' + (gd && gd.text));
await step(1); ok(await ev(() => { const u = document.getElementById('objective'); const m = document.getElementById('minimap'); return u.style.display !== 'none' && m.style.display !== 'none' && /Secure/.test(u.textContent); }), 'objective strip and minimap are shown in the run');
await ev(() => { const g = window.__game; g.inst.flags.bossDead = true; g.inst.flags.completed = true; window.__ui.open('summary'); });
t = await ev(() => document.getElementById('modal').textContent);
ok(/Loot recap/.test(t) && /Return to town/.test(t) && /re-run/i.test(t), 'end-of-run summary shows loot recap, return to town and re-run buttons');
ok(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
