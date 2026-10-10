// Dungeon-pack tests: layouts, level filtering, per-dungeon daily lockout, replacement-boss conditions, hazards,
// signature level gating, contracts and the story provider. Driven through real game objects in headless Chrome.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch();
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = (secs) => ev(s => { const g = window.__game; for (let i = 0; i < s / 0.016; i++) g.update(0.016); }, secs);
const fresh = (id, level) => ev(([id, level]) => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; if (level) { g.save.level = level; g.recompute(); } g.dbg.god = true; g.dbg.oneShot = false; return g.startRun(id); }, [id, level]);
const caps = (cs) => ev(cs => { const g = window.__game; for (const c of cs) g.build.caps.add(c); }, cs);
const near = (id) => ev(id => { const g = window.__game; const it = g.level.interacts.find(i => i.id === id); g.px = it.x - 0.5; g.py = it.y; g.update(0.016); return g.prompt && g.prompt.id; }, id);
const clickDialog = (n) => ev(n => { const b = document.querySelectorAll('#dialog button'); b[n] && b[n].click(); }, n);

// ---- layouts ----
const lay = await ev(async () => { const m = await import('/src/content/dungeons.ts'); const out = {}; for (const d of m.DUNGEON_LIST) { const lv = d.build(); const w = lv.w; const free = (x, y) => !lv.solid[Math.floor(y) * w + Math.floor(x)]; const bad = []; for (const i of lv.interacts) if (!free(i.x, i.y)) bad.push(i.id); for (const s of lv.spawns) if (!free(s.x, s.y)) bad.push(s.type); for (const h of (lv.hazards || [])) if (!free(h.x, h.y)) bad.push('haz'); const unreachable = [...lv.interacts.map(i => i), { id: 'boss', ...lv.bossSpawn }].filter(t => !m.reachable(lv, lv.spawn, t)).map(t => t.id); out[d.id] = { bad, unreachable, n: lv.spawns.length, elites: [...new Set(lv.spawns.map(s => s.type))].length, ids: lv.interacts.map(i => i.id) }; } return out; });
for (const [id, r] of Object.entries(lay)) { ok(r.bad.length === 0, id + ': all spawns/interacts/hazards on walkable tiles'); ok(r.unreachable.length === 0, id + ': objective, conditions, cache and boss reachable (combat route always works)'); ok(r.n >= 40, id + ': enough enemies for a 5-10 minute run (' + r.n + ')'); }
ok(['foundry', 'clinic', 'warehouse'].every(id => lay[id].ids.includes('cond_A') && lay[id].ids.includes('cond_B') && lay[id].ids.includes('controller') && lay[id].ids.includes('hackproc')), 'new dungeons each have relay, objective and two replacement-boss conditions');

// ---- content rules ----
const rules = await ev(async () => { const c = await import('/src/config.ts'); const m = await import('/src/content/dungeons.ts'); const bad = []; for (const i of c.ITEMS) if (i.rarity === 'orange' && i.lvl < 20 && !i.authoredException) bad.push(i.id); const lvlViol = []; for (const d of m.DUNGEON_LIST) { if (!d.loot) continue; for (const t of ['ordinary', 'elite', 'boss']) for (const e of d.loot[t]) if (e.item && !c.ITEM_BY_ID[e.item]) lvlViol.push(e.item); } const sigBad = []; for (const d of m.DUNGEON_LIST) for (const [b, s] of Object.entries(d.signature || {})) { const it = c.ITEM_BY_ID[s.item]; if (!it || it.rarity !== 'orange' || !c.ENEMIES[b].boss || it.lvl > d.tierCap) sigBad.push(b); } const conds = m.DUNGEON_LIST.filter(d => d.id !== 'annex' && !d.tier).every(d => d.conds.length === 2 && d.conds.every(k => c.ENEMIES[k.boss] && c.ENEMIES[k.boss].boss) && c.ENEMIES[d.defaultBoss].boss && new Set(d.conds.map(k => k.boss)).size === 2); return { bad, lvlViol, sigBad, conds }; });
ok(rules.bad.length === 0, 'orange items are high-level only unless flagged authoredException: ' + (rules.bad.join() || 'ok'));
ok(rules.lvlViol.length === 0 && rules.sigBad.length === 0, 'loot pools reference real items; every signature is an orange item within its dungeon tier cap');
ok(rules.conds, 'each new dungeon: default boss + two distinct replacement bosses');

// ---- dungeon select: level filter ----
await ev(() => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.level = 12; window.__ui.showAll = false; window.__ui.open('gate'); });
let txt = await ev(() => document.getElementById('modal').textContent);
ok(/Reclamation Annex/.test(txt) && /Kestrel Distribution Hub 9/.test(txt) && !/Foundry Line 7/.test(txt) && !/Ward 9 Clinic/.test(txt), 'level 12: select shows Annex + Hub 9 only (level-band filter)');
await ev(() => { window.__ui.showAll = true; window.__ui.render(); }); txt = await ev(() => document.getElementById('modal').textContent);
ok(/Foundry Line 7/.test(txt) && /Ward 9 Clinic/.test(txt) && /Under-level/.test(txt), 'show-all lists every dungeon with an under-level warning');
await ev(() => { window.__game.save.level = 24; window.__ui.showAll = false; window.__ui.render(); }); txt = await ev(() => document.getElementById('modal').textContent);
ok(/Foundry Line 7/.test(txt) && /Ward 9 Clinic/.test(txt) && !/<b>Kestrel Distribution Hub 9/.test(await ev(() => document.getElementById('modal').innerHTML)), 'level 24: filter moves to Foundry + Clinic (+Annex out of band)');
await ev(() => window.__ui.close());

// ---- per-dungeon run flow ----
const flows = { foundry: { guard: 'slagcannon', elite: 'brakeman', cap: { A: 'force', B: 'hack' }, bosses: ['teague', 'brannoch', 'ore9'] }, clinic: { guard: 'sentry', elite: 'matron', cap: { A: 'hack', B: 'cloak' }, bosses: ['surgeon', 'autosurgeon', 'recovered'] }, warehouse: { guard: 'camgun', elite: 'shiftlead', cap: { A: 'hack', B: 'defib' }, bosses: ['stockmgr', 'retrieval', 'reclaimer'] } };
for (const [id, f] of Object.entries(flows)) {
  ok(await fresh(id, 30), id + ': fresh run starts');
  ok(await ev(() => window.__game.save.instance.dungeon), id + ': instance records its dungeon');
  ok(await ev(([g1]) => window.__game.enemies.some(e => e.type === g1), [f.guard]), id + ': gate guards present');
  await step(0.3);
  await ev(([g1]) => { const g = window.__game; g.enemies.filter(e => e.type === g1).forEach(e => g.killEnemy(e)); }, [f.guard]); await step(0.2);
  ok(await ev(() => window.__game.inst.flags.gate1), id + ': gate opens when guards die');
  await ev(([el]) => { const g = window.__game; g.enemies.filter(e => e.type === el).forEach(e => g.killEnemy(e)); }, [f.elite]);
  ok(await ev(() => window.__game.inst.flags.lock2), id + ': named elite kill releases the lock (combat route)');
  // no caps: conditions denied, no selection
  await ev(() => { const g = window.__game; for (const c of ['hack', 'force', 'cloak', 'defib']) g.build.caps.delete(c); });
  await near('cond_A'); await ev(() => window.__game.interact()); ok(await ev(() => /ACCESS DENIED|Needs|Seal ignores|dead|Requires/i.test(document.getElementById('dialog').textContent)), id + ': condition A denied without the right augment');
  ok(await ev(() => window.__game.inst.flags.cond) === null, id + ': denied condition selects nothing'); await clickDialog(0);
  // condition A
  await caps([f.cap.A]); await near('cond_A'); await ev(() => window.__game.interact()); await clickDialog(0); await step(1.7);
  let st = await ev(() => ({ cond: window.__game.inst.flags.cond, boss: window.__game.inst.flags.bossKey }));
  ok(st.cond === 'A' && st.boss === f.bosses[1], id + ': condition A (' + f.cap.A + ') selects ' + f.bosses[1] + ' (got ' + st.boss + ')');
  await near('cond_B'); await caps([f.cap.B]); await ev(() => window.__game.interact()); ok(await ev(() => /locked/i.test(document.getElementById('dialog').textContent)), id + ': second selector is locked (arbitration)'); await clickDialog(0);
  await near('controller'); await ev(() => window.__game.interact()); ok(await ev(() => window.__game.inst.flags.controller), id + ': objective secured');
  await ev(() => { const g = window.__game; g.px = g.level.revealX + 1; g.py = g.level.bossSpawn.y; g.update(0.016); }); await step(0.3);
  ok(await ev(() => window.__game.revealing && window.__game.enemies.some(e => e.type === window.__game.inst.flags.bossKey)), id + ': boss reveal plays for ' + f.bosses[1]);
  // boss AI smoke: run the fight with god mode and make sure patterns/telegraphs run without errors
  await step(9.5); const zonesSeen = await ev(async () => { const g = window.__game; let maxZ = 0; for (let i = 0; i < 1500; i++) { const b = g.enemies.find(e => e.type === g.inst.flags.bossKey && !e.dead); if (b && i % 30 === 0) { g.px = g.level.bossSpawn.x - 2; g.py = g.level.bossSpawn.y + (i % 60 ? 3 : -3); } g.update(0.016); maxZ = Math.max(maxZ, g.zones.filter(z => !z.env).length); } return maxZ; });
  ok(true, id + ': 24s boss AI soak ran (max pattern zones ' + zonesSeen + ')');
  // kill the boss, check lockout is per-dungeon
  await ev(() => { const g = window.__game; const b = g.enemies.find(e => e.type === g.inst.flags.bossKey && !e.dead); g.killEnemy(b); });
  st = await ev(() => { const g = window.__game; return { done: g.inst.flags.completed, lock: g.dailyLocked(g.inst.dungeon), annexLock: g.dailyLocked('annex'), xp: g.inst.xpEarned }; });
  ok(st.done && st.lock && !st.annexLock, id + ': boss kill consumes only this dungeon\'s daily clear');
  await ev(() => window.__game.enterTown());
  ok(!(await ev(() => { const g = window.__game; g.save.instance = null; g.inst = null; return g.startRun(g.save.lockouts ? Object.keys(g.save.lockouts)[0] : 'x'); })), id + ': fresh run blocked while locked out');
  // default and condition B bosses
  for (const [cond, bossId] of [['B', f.bosses[2]], [null, f.bosses[0]]]) {
    await fresh(id, 30); await ev(() => { window.__game.inst.flags.lock2 = true; window.__game.inst.flags.gate1 = true; });
    if (cond) { await caps([f.cap.B]); await near('cond_B'); await ev(() => window.__game.interact()); await clickDialog(0); await step(1.7); }
    await near('controller'); await ev(() => window.__game.interact()); await ev(() => { const g = window.__game; g.px = g.level.revealX + 1; g.py = g.level.bossSpawn.y; g.update(0.016); });
    ok(await ev(() => window.__game.enemies.some(e => !e.dead && e.type === window.__game.inst.flags.bossKey)) && await ev(() => window.__game.inst.flags.bossKey) === bossId, id + ': ' + (cond ? 'condition B (' + f.cap.B + ')' : 'no condition') + ' selects ' + bossId);
  }
}

// ---- hazards ----
await fresh('foundry', 30); const hz = await ev(() => { const g = window.__game; const env = g.zones.filter(z => z.env).length; const z = g.zones.find(z => z.env); g.dbg.god = false; g.px = z.x; g.py = z.y; g.hp = g.maxHp; g.iframes = 0; for (let i = 0; i < 200; i++) { g.px = z.x; g.py = z.y; g.update(0.016); } return { env, hp: g.hp, max: g.maxHp, heat: g.heat }; });
ok(hz.env >= 10 && hz.hp < hz.max, 'foundry: slag/press/furnace hazards are persistent zones that hurt (' + hz.env + ' hazards, hp ' + Math.round(hz.hp) + '/' + Math.round(hz.max) + ')');

// ---- signature level gating & tier cap ----
const gate = await ev(() => { const g = window.__game; g.dbg.god = true; const out = {}; g.save.level = 12; let n = 0; for (let i = 0; i < 50; i++) g.dropEntry({ item: 'sig_anvil_arm', w: 1 }, g.px, g.py); out.low = g.inst.drops.filter(d => d.inst && d.inst.def === 'sig_anvil_arm').length; g.save.level = 40; g.dropEntry({ item: 'sig_anvil_arm', w: 1 }, g.px, g.py); out.hi = g.inst.drops.filter(d => d.inst && d.inst.def === 'sig_anvil_arm').length; return out; });
ok(gate.low === 0 && gate.hi === 1, 'orange signature: level-12 recipient never gets the level-28 Anvil-Arm (no downward reroll); level-40 can');
await fresh('warehouse', 40); const wh = await ev(() => { const g = window.__game; g.dropEntry({ item: 'sig_governor_core', w: 1 }, g.px, g.py); g.dropEntry({ item: 'sig_lazarus_rack', w: 1 }, g.px, g.py); return g.inst.drops.map(d => d.inst && d.inst.def); });
ok(!wh.includes('sig_governor_core') && wh.includes('sig_lazarus_rack'), 'warehouse tier cap blocks lvl-28 gear even for a level-40 character; the authored Lazarus Rack Easter egg (lvl 14) can drop');
await fresh('warehouse', 12); const ez = await ev(() => { const g = window.__game; let drops = 0; for (let i = 0; i < 300; i++) g.dropEntry({ item: 'sig_lazarus_rack', w: 1 }, g.px, g.py); return g.inst.drops.length; });
ok(ez === 0, 'authored-exception orange (lvl 14) is still level-gated: level-12 recipient gets ' + ez + '/300');

// ---- special attacks: blink/riposte chain ----
await fresh('clinic', 30); const bl = await ev(() => { const g = window.__game; const e = g.spawnEnemy('matron', g.px + 6, g.py); e.alert = true; g.beginAttack(e, 'blink', 0, g.px, g.py); const seen = new Set(); for (let i = 0; i < 200; i++) { g.update(0.016); seen.add(e._rt.atk + ':' + e._rt.st); } return { seen: [...seen], dist: Math.hypot(e.x - g.px, e.y - g.py) }; });
ok(bl.seen.some(x => x.startsWith('riposte')), 'blink chains into a telegraphed riposte (' + bl.seen.slice(0, 4).join(',') + ')');

// ---- contracts ----
await ev(() => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.level = 20; g.save.credits = 0; g.save.contracts = { active: {}, done: [], doneDay: {} }; window.__ui.open('contacts'); });
await ev(() => document.querySelector('[data-act=accept]').click());
ok(await ev(() => 'od_floor_sweep' in window.__game.save.contracts.active), 'contract accepted from Odalys');
await ev(() => { const g = window.__game; g.inst = { dungeon: 'annex' }; for (let i = 0; i < 25; i++) g.contractEvent('kill_mfr', 'MM'); g.inst = null; window.__ui.render(); });
ok(await ev(() => window.__game.save.contracts.active.od_floor_sweep) === 25, 'kills advance the contract (capped at goal)');
await ev(() => document.querySelector('[data-act=claim]').click());
ok(await ev(() => window.__game.save.credits) === 180 && await ev(() => window.__game.save.contracts.doneDay.od_floor_sweep) !== undefined, 'claim pays fixed credits and locks the daily contract for today');
ok(await ev(() => window.__game.story().events.some(e => e.kind === 'contract_done')), 'contract completion is recorded as a story event');
await ev(() => { window.__ui.contactSel = 'ten_hallowell'; window.__ui.render(); }); ok(await ev(() => /Silence Line 7/.test(document.getElementById('modal').textContent) && /Lv 18\+/.test(document.getElementById('modal').textContent)), 'faction fixer lists level-gated contracts');
await ev(() => window.__ui.close());
// contract progress hooks through real gameplay events
await fresh('foundry', 30); await ev(() => { const g = window.__game; g.save.contracts.active = { th_foundry_clear: 0, th_tyrant: 0, ld_reclaim: 0 }; });
await caps(['force']); await ev(() => { const g = window.__game; g.inst.flags.lock2 = true; });
await near('cond_A'); await ev(() => window.__game.interact()); await clickDialog(0); await step(1.7);
ok(await ev(() => window.__game.save.contracts.active.ld_reclaim) === 1, 'force route in a dungeon advances the Dunmore reclaim contract');
await ev(() => { const g = window.__game; g.inst.flags.controller = true; g.openDoor('boss'); g.px = g.level.revealX + 1; g.py = g.level.bossSpawn.y; g.update(0.016); const b = g.enemies.find(e => e.type === 'brannoch'); g.killEnemy(b); });
const cp = await ev(() => window.__game.save.contracts.active); ok(cp.th_tyrant === 1 && cp.th_foundry_clear === 1, 'Brannoch kill completes boss + clear contracts');

// ---- story provider ----
const story = await ev(async () => { const m = await import('/src/story.ts'); const g = window.__game; const st = g.story(); st.dclues = {}; m.record(st, 'route_used', 'foundry:force'); m.record(st, 'condition_used', 'foundry:A'); const msg = await m.runStoryStep(st, new m.MockProvider()); const dc = st.dclues.foundry; m.record(st, 'route_used', 'hack'); const bad = await m.runStoryStep(st, { name: 'x', propose: async () => ({ arc: 'quiet_trade', facts_used: [], clue: { condition: null, text: 'Something happened somewhere.', source: 'terminal', dungeon: 'moonbase' }, town: { contact: 'odalys_vane', text: 'hi there', options: [{ id: 'a', label: 'a', boosts: 'quiet_trade' }] }, edges: [] }) }); return { msg, dc: dc && dc.A, arc: st.arc, bad }; });
ok(/accepted/.test(story.msg) && /BRANNOCH/.test(story.dc || '') && story.arc === 'foundry_unrest', 'mock provider gives the Foundry force clue (Brannoch) after force route/condition: ' + story.msg);
ok(/rejected/.test(story.bad), 'validator rejects an unknown dungeon id');
console.log('console errors:', errors); ok(errors.filter(e => !/favicon|404/.test(e)).length === 0, 'no page errors');
await browser.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
