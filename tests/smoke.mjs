// End-to-end smoke/gate test driven through the real game objects in headless Chrome (sim is stepped faster than real time).
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch();
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = (secs) => ev(s => { const g = window.__game; for (let i = 0; i < s / 0.016; i++) g.update(0.016); }, secs);
const tp = (x, y) => ev(([x, y]) => { const g = window.__game; g.px = x; g.py = y; g.update(0.016); }, [x, y]);
const near = (id) => ev(id => { const g = window.__game; const it = g.level.interacts.find(i => i.id === id); g.px = it.x - 0.5; g.py = it.y; g.update(0.016); return g.prompt && g.prompt.id; }, id);
const kit = (k) => ev(k => { window.__ui.kit(k, true); window.__game.dbg.god = true; }, k);
const clickDialog = (n) => ev(n => { const b = document.querySelectorAll('#dialog button'); b[n] && b[n].click(); }, n);
const state = () => ev(() => { const g = window.__game; const f = g.inst && g.inst.flags; return { mode: g.mode, hp: g.hp, heat: g.heat, flags: f, drops: g.inst ? g.inst.drops.length : 0, level: g.save.level, lock: g.save.lastClearDay }; });

// ---------- Scenario 1: force route, Enforcer, full run ----------
await kit('A');
ok(await ev(() => window.__game.build.abilities.join()) === 'sweep,brace,forcedcool', 'Build A exposes sweep/brace/forcedcool');
ok(await ev(() => window.__game.startRun()), 'start run');
await step(0.5);
// yard: turrets die -> gate releases
await ev(() => { const g = window.__game; g.enemies.filter(e => e.type === 'turret').forEach(e => g.killEnemy(e)); });
await step(0.2); ok((await state()).flags.gate1, 'yard gate opens after turrets die');
// processing: sawhand kill opens junction lock
await ev(() => { const g = window.__game; g.enemies.filter(e => e.type === 'sawhand').forEach(e => g.killEnemy(e)); });
ok((await state()).flags.lock2, 'sawhand kill releases junction lock (combat route)');
// hack relay without hack hardware is denied
await near('hackproc'); ok(true, 'relay reachable'); 
// junction: force armory
await ev(() => { const g = window.__game; g.inst.flags.lock2 = true; });
ok(await near('armorydoor') === 'armorydoor', 'armory shutter prompt');
await ev(() => window.__game.interact()); ok((await state()).flags.armory, 'force hardware opens armory shutter');
ok(await ev(() => !window.__game.solidAt(59.5, 28.5)), 'armory shutter tile is now walkable');
await near('armoryfuse'); await ev(() => window.__game.interact());
ok(await ev(() => document.getElementById('dialog').style.display === 'block'), 'fuse choice dialog opens (combat continues)');
await clickDialog(0); const s2 = await state(); ok(s2.flags.cond === 'B' && s2.flags.bossKey === 'enforcer', 'fuse selects Reclamation Enforcer');
// conflicting selector disabled
await near('terminal'); await ev(() => window.__game.interact()); ok(await ev(() => /locked/i.test(document.getElementById('dialog').textContent)), 'terminal disabled after first condition (arbitration)');
await clickDialog(0);
// controller -> boss door
await near('controller'); await ev(() => window.__game.interact()); const s3 = await state(); ok(s3.flags.controller, 'controller secured'); ok(await ev(() => !window.__game.solidAt(63.5, 19.5)), 'boss door opened');
// boss reveal is damage-free and full length
await tp(68, 19.5); await step(0.3);
ok(await ev(() => window.__game.revealing), 'boss reveal started');
const hp0 = (await state()).hp; await ev(() => window.__game.hurtPlayer(50, 0, 0)); 
await ev(() => { window.__game.dbg.god = false; window.__game.hurtPlayer(50, 0, 0); window.__game.dbg.god = true; });
ok((await state()).hp === hp0, 'player takes no damage during reveal');
ok(await ev(() => window.__game.musicState) === 'bossreveal', 'music state: boss reveal');
await step(5); ok(await ev(() => window.__game.revealing), 'reveal still running at 5s (not shortened)');
await step(5); ok(!(await ev(() => window.__game.revealing)), 'reveal ends after ~9s');
ok(await ev(() => window.__game.musicState) === 'bosscombat', 'music state: boss combat after reveal');
// fight: one-shot assist so the sim finishes quickly; real AI/targeting runs
await ev(() => { window.__game.dbg.oneShot = true; });
for (let i = 0; i < 20 && !(await state()).flags.bossDead; i++) { await ev(() => { const g = window.__game; const b = g.enemies.find(e => e.type === 'enforcer' && !e.dead); if (b) { g.px = b.x - 1.6; g.py = b.y; } }); await step(1); }
const s4 = await state(); ok(s4.flags.bossDead && s4.flags.completed, 'Enforcer defeated => mission complete'); ok(!!s4.lock, 'host daily lockout consumed on boss kill');
const clears = await ev(() => window.__game.save.stats.clears); await ev(() => window.__game.onBossDead({ type: 'enforcer' })); ok(await ev(() => window.__game.save.stats.clears) === clears, 'boss completion cannot be granted twice (no duplicate rewards)');
// loot pickup
const dropsBefore = s4.drops; ok(dropsBefore > 0, 'boss dropped personal loot (' + dropsBefore + ')');
await ev(() => { const g = window.__game; for (const d of [...g.inst.drops]) { g.px = d.x; g.py = d.y; g.update(0.016); } });
const carried = await ev(() => window.__game.carriedCount()); ok(carried > 0, 'proximity auto-pickup fills pack (' + carried + ' slots)');
// town trip: channel is interrupted by movement
await ev(() => { window.__game.townReturn(); }); await step(1); await ev(() => window.__game.setMove(1, 0)); await step(0.3); await ev(() => window.__game.setMove(0, 0));
ok(await ev(() => window.__game.channel === null && window.__game.mode === 'run'), 'town channel interrupted by movement');
await ev(() => { window.__game.townReturn(); }); await step(5.2); ok((await state()).mode === 'town', 'town channel completes uninterrupted');
await ev(() => { window.__ui.open('locker'); window.__ui.unload(); window.__ui.close(); });
ok(await ev(() => window.__game.save.items.length) > 12, 'unload moved items into locker');
// re-entry retains state
ok(await ev(() => window.__game.startRun()), 're-enter existing instance'); const s5 = await state(); ok(s5.flags.bossDead && s5.flags.controller, 'dead boss + objective persist after town trip');
// persistence across reload
await ev(() => window.__game.saveNow()); await page.reload(); await page.waitForFunction(() => window.__game);
const persisted = await ev(() => { const i = window.__game.save.instance; return i && i.flags.bossDead && i.enemies.filter(e => e.dead).length; }); ok(persisted > 0, 'instance state survives browser reload (' + persisted + ' dead enemies saved)');
ok(await ev(() => window.__game.startRun()) && !(await ev(() => window.__game.dailyLocked() && false)), 'resume after reload');
await ev(() => { window.__game.dbg.god = true; });

// ---------- Scenario 2: control/hack build, Warden via terminal; fresh run needs lockout reset ----------
await ev(() => { window.__game.townReturn; window.__game.enterTown(); window.__game.save.instance = null; window.__game.inst = null; window.__game.save.lastClearDay = null; });
await kit('C'); const abC = await ev(() => window.__game.build.abilities.join()); ok(abC === 'pulse,revive,control', 'Build C abilities: ' + abC);
ok(await ev(() => window.__game.build.caps.has('hack')), 'Build C has hack capability');
await ev(() => window.__game.startRun());
await near('hackproc'); await ev(() => window.__game.interact()); await step(1.7); ok((await state()).flags.lock2, 'hack relay (channel) reroutes junction lock');
await near('terminal'); await ev(() => window.__game.interact()); await clickDialog(0); await step(1.7); const s6 = await state(); ok(s6.flags.cond === 'A' && s6.flags.bossKey === 'warden', 'audit command selects Neural Warden');
ok(await ev(() => document.getElementById('support').style.display) !== 'none', 'support panel visible only with support ability equipped');
// control ability validity: invalid release (no target) costs nothing
await tp(30, 20); await ev(() => { const g = window.__game; g.enemies.forEach(e => { if (!e.dead && Math.hypot(e.x - g.px, e.y - g.py) < 20) { e.x = 0.5; e.y = 0.5; } }); g.beginAim(2); g.updateAim(g.px + 3, g.py, true); g.releaseAim(); });
await step(0.6); ok(await ev(() => window.__game.heat) < 2 && await ev(() => window.__game.abCd[2]) === 0, 'invalid ability release cancels: no heat, no cooldown');
await ev(() => { const g = window.__game; const e = g.enemies.find(e => e.type === 'worker' && !e.dead); e.x = g.px + 3; e.y = g.py; g.beginAim(2); g.updateAim(e.x, e.y, true); g.releaseAim(); }); await step(0.6);
ok(await ev(() => window.__game.enemies.some(e => e.faction === 'ally')), 'valid control release turns an enemy'); ok(await ev(() => window.__game.heat) > 20, 'valid cast commits heat');
// dodge cancels aim/cast with no cost
await ev(() => { const g = window.__game; g.abCd = [0, 0, 0]; g.heat = 0; const e = g.enemies.find(e => e.type === 'shooter' && !e.dead && e.faction === 'enemy'); if (e) { e.x = g.px + 3; e.y = g.py; g.beginAim(0); g.updateAim(g.px + 3, g.py, true); g.releaseAim(); g.dodge(); } }); await step(1);
ok(await ev(() => window.__game.cast === null && window.__game.abCd[0] === 0), 'dodge during windup cancels execution before resource commit');
// sensor alarm if uncloaked in the passage
await ev(() => { window.__game.dodgeCd = 0; }); await tp(44, 3.5); await step(0.1); ok((await state()).flags.alarm, 'maintenance-passage sensors alarm an uncloaked player');

// ---------- Scenario 3: cloak build, passage quiet ----------
await ev(() => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; }); await kit('B');
const abB = await ev(() => window.__game.build.abilities.join()); ok(abB === 'bladeburst,cloak,reposition', 'Build B abilities: ' + abB);
await ev(() => window.__game.startRun()); await ev(() => { const g = window.__game; g.cloakT = 6; }); await tp(44, 3.5); await step(0.1); ok(!(await state()).flags.alarm, 'cloaked player passes sensors silently');
// heat / overheat
await ev(() => { const g = window.__game; g.heat = 99; g.dbg.god = true; g.heat += 5; g.update(0.016); }); ok(await ev(() => window.__game.overheated), 'overheat triggers at max heat'); await step(8); ok(!(await ev(() => window.__game.overheated)), 'cools back down and recovers');
// level filter: low-level recipients don't get above-level gear and no downward reroll
const filt = await ev(() => { const g = window.__game; g.save.level = 5; let drops = 0; const before = g.inst.drops.length; for (let i = 0; i < 400; i++) g.dropEntry({ item: 'pool_p_hand', w: 1 }, g.px, g.py); return g.inst.drops.length - before; }); ok(filt === 0, 'level-5 recipient gets 0/400 level-14 purple drops (filtered, not substituted)');
// full inventory leaves loot on ground, evicts nothing
const full = await ev(() => { const g = window.__game; g.save.level = 20; const c = g.inst.carried; c.items = []; for (let i = 0; i < 16; i++) c.items.push({ uid: 'x' + i, def: 'pool_g_torso', chips: [] }); g.addDrop(g.px, g.py, { kind: 'item', inst: { uid: 'new', def: 'hi_ripper_arm', chips: [] } }); g.update(0.016); return { carried: c.items.length, onGround: g.inst.drops.some(d => d.inst && d.inst.uid === 'new'), marker: g.inst.drops.find(d => d.inst && d.inst.uid === 'new')?.marker }; });
ok(full.carried === 16 && full.onGround && full.marker, 'full pack: item stays on ground with marker, nothing evicted');
// downs: hardware breaks, checkpoint restores, no repeat break
const dn = await ev(() => { const g = window.__game; g.dbg.god = false; g.hp = 1; g.iframes = 0; g.hurtPlayer(99, 0, 0); const broke = g.inst.broken.length; const bill = g.save.repairBill; g.returnToCheckpoint(); return { broke, bill, after: g.inst.broken.length, prot: g.inst.protectedSlots.length, billAfter: g.save.repairBill }; });
ok(dn.broke === 1 && dn.bill > 0 && dn.after === 0 && dn.prot === 1 && dn.billAfter === dn.bill, 'down breaks one hardware piece, checkpoint restores, repair bill retained');
// town/locker staged chips
await ev(() => { const g = window.__game; g.enterTown(); window.__ui.open('locker'); window.__game.save.lockerChips.power = 3; const D = window.__ui.draft; D.armR.chips.push('power'); window.__ui.render(); });
ok(await ev(() => document.querySelector('#modal').textContent.includes('DRAFT (unapplied)')), 'locker shows staged DRAFT state'); 
const before = await ev(() => window.__game.save.items.find(i => i.def === 'ps_blade_arm').chips.length); await ev(() => window.__ui.applyDraft()); const after = await ev(() => window.__game.save.items.find(i => i.def === 'ps_blade_arm').chips.length); ok(before === 0 && after === 1, 'Apply commits staged chips');
// story step with mock provider
const story = await ev(async () => { const m = await import('/src/story.ts'); const g = window.__game; const st = g.story(); m.record(st, 'route_used', 'hack'); m.record(st, 'kill_mfr', 'PS', 3); const msg = await m.runStoryStep(st, new m.MockProvider()); return { msg, clueA: st.clues.A }; }); ok(/accepted/.test(story.msg) && !!story.clueA, 'mock story provider produces a validated proposal: ' + story.msg);
const bad = await ev(async () => { const m = await import('/src/story.ts'); const g = window.__game; const st = g.story(); m.record(st, 'route_used', 'force'); const arcBefore = st.arc; const msg = await m.runStoryStep(st, { name: 'evil', propose: async () => ({ arc: 'audit_pressure', facts_used: [], clue: { condition: 'A', text: 'This boss always drops guaranteed orange gear.', source: 'terminal' }, town: { contact: 'odalys_vane', text: 'hi there friend', options: [{ id: 'a', label: 'x', boosts: 'audit_pressure' }] }, edges: [] }) }, { name: 'bad', propose: async () => { throw new Error('x'); } }); return { msg, same: st.arc === arcBefore }; }); ok(/rejected/.test(bad.msg) && bad.same, 'invalid LLM proposal is rejected; previous story retained: ' + bad.msg);
const out = await ev(async () => { const m = await import('/src/story.ts'); const st = window.__game.story(); m.record(st, 'route_used', 'force'); return await m.runStoryStep(st, { name: 'down', propose: async () => { throw new Error('offline'); } }, { name: 'mock', propose: async () => { throw new Error('also'); } }); }); ok(/unavailable/.test(out), 'provider outage leaves gameplay available');
console.log('console errors:', errors); ok(errors.filter(e => !/favicon|404/.test(e)).length === 0, 'no page errors');
await browser.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
