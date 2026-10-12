// No entity ever stands on a non-walkable tile: every dungeon archetype x several seeds, spawn/restore validation plus bot runs with aggro, knockback, dashes, charges, death and re-entry.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
const ids = await ev(async () => (await import('/src/content/dungeons.ts')).DUNGEON_LIST.map(d => d.id));
const SEEDS = +process.env.SEEDS || 3, TICKS = +process.env.TICKS || 1500;
const run = (id) => ev(async ([id, TICKS]) => { const g = window.__game; const out = { id, viol: [], spawnBad: 0, n: 0, rescued: 0 };
  g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; try { (g.save.cleared = { ...(g.save.cleared || {}), bell_foundry: 1 }, g.checkTownUnlocks()); g.save.town = 'harrow'; } catch {} 
  if (!g.startRun(id)) { out.err = 'startRun failed'; return out; } g.revealing = false; g.dbg.god = true; const L = g.level;
  const walk = (x, y, r = 0) => !g.solidAt(x, y) && (r === 0 || !g.circleHits(x, y, r));
  for (const e of g.enemies) if (!walk(e.x, e.y, .2)) out.spawnBad++; if (!walk(g.px, g.py, .2)) out.spawnBad++;
  // BFS field over walkable tiles for the bot
  const cells = []; for (let y = 1; y < L.h - 1; y++) for (let x = 1; x < L.w - 1; x++) if (!L.solid[y * L.w + x]) cells.push([x + .5, y + .5]);
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; let tgt = cells[(rnd() * cells.length) | 0]; let sw = 0;
  const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; try { g.applyDoors(); } catch {}
  const check = (tag) => { out.n++; const bad = []; if (g.stranded(g.px, g.py, .3)) bad.push('player'); for (const e of g.enemies) { if (e.dead && e._rt?.reveal > 0) continue; if (g.stranded(e.x, e.y, window.__enemies?.[e.type]?.radius || .4)) bad.push(e.type); } if (bad.length && out.viol.length < 6) out.viol.push(tag + ':' + bad.join(',') + '@' + g.px.toFixed(1)); };
  for (let i = 0; i < TICKS; i++) { g.hp = g.maxHp; if (g.downed) { g.returnToCheckpoint(); }
    const dx = tgt[0] - g.px, dy = tgt[1] - g.py; if (Math.hypot(dx, dy) < 1 || ++sw > 240) { tgt = cells[(rnd() * cells.length) | 0]; sw = 0; } const l = Math.hypot(dx, dy) || 1; g.setMove((dx - dy) / l, (dx + dy) / 2 / l);
    if (i % 40 === 0) g.dodge(); if (i % 90 === 0) { const e = g.enemies.find(x => !x.dead && x.faction === 'enemy' && Math.hypot(x.x - g.px, x.y - g.py) < 8); if (e) g.hurtEnemy(e, 1, g.px, g.py, 3); }
    if (i % 400 === 399) { // death + re-entry restore path
      g.playerDown(); g.returnToCheckpoint(); }
    g.update(1 / 30); if (i % 5 === 0) check('t' + i); }
  // save/restore path: leave and re-enter, then verify again
  g.townReturn(); g.townInterrupt('x', true); g.townReturn(); for (let i = 0; i < 9 * 30 && g.mode === 'run'; i++) { g.hp = g.maxHp; g.update(1 / 30); } g.saveNow(); g.startRun(id); check('reenter'); for (const e of g.enemies) if (g.solidAt(e.x, e.y)) out.spawnBad++;
  return out; }, [id, TICKS]);
// ---- injected corruption: the safety net, restore snapping, spawn snapping and A* recovery ----
const inj = await ev(async () => { const g = window.__game; const o = {}; g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.startRun('warehouse'); g.revealing = false; g.dbg.god = true; const L = g.level;
  const wall = () => { for (let y = 2; y < L.h - 2; y++) for (let x = 2; x < L.w - 2; x++) if (L.solid[y * L.w + x] && L.solid[y * L.w + x + 1] && L.solid[(y + 1) * L.w + x] && L.solid[(y + 1) * L.w + x + 1] && !L.solid[y * L.w + x - 1]) return [x + .8, y + .5]; return null; }; const w = wall(); o.haveWall = !!w;
  // safety net: enemies + player dropped in a wall are rescued within a second
  const live = g.enemies.filter(e => !e.dead && e.faction === 'enemy').slice(0, 5); for (const e of live) { e.x = w[0]; e.y = w[1]; } g.px = w[0]; g.py = w[1]; for (let i = 0; i < 40; i++) g.update(1 / 30); o.rescuedAll = live.every(e => !g.stranded(e.x, e.y, .3)) && !g.stranded(g.px, g.py, .3); o.rescuedCount = g.rescued;
  // NaN positions
  live[0].x = NaN; g.px = NaN; for (let i = 0; i < 40; i++) g.update(1 / 30); o.nan = isFinite(live[0].x) && isFinite(g.px); o.nanv = [live[0].x, g.px, g.mode, live.length];
  // A*: flow field with the player inside a wall still reaches walkable cells; enemies path to the snapped player
  g.px = w[0]; g.py = w[1]; g.flowField(0); let reach = 0; for (const v of g.flow) if (v >= 0) reach++; o.flowReach = reach;
  // restore from a corrupted saved instance (player + enemies inside walls)
  g.townReturn(); g.townInterrupt('x', true); g.townReturn(); for (let i = 0; i < 9 * 30 && g.mode === 'run'; i++) { g.hp = g.maxHp; g.update(1 / 30); } for (const e of g.save.instance.enemies.slice(0, 6)) { e.x = w[0]; e.y = w[1]; e.home = { x: w[0], y: w[1] }; } g.save.instance.px = w[0]; g.save.instance.py = w[1];
  g.startRun('warehouse'); o.restored = g.enemies.every(e => e.dead || !g.stranded(e.x, e.y, window.__enemies?.[e.type]?.radius || .4)) && !g.stranded(g.px, g.py, .3);
  // spawnEnemy into a wall
  const e = g.spawnEnemy(g.enemies.find(x => !x.dead).type, w[0], w[1]); o.spawned = !g.stranded(e.x, e.y, .3) && e.home.x === e.x;
  return o; });
ok(inj.haveWall && inj.rescuedAll && inj.rescuedCount >= 6, 'safety net rescues the player and enemies placed inside walls: ' + JSON.stringify({ n: inj.rescuedCount }));
ok(inj.nan, 'NaN positions are rescued ' + JSON.stringify(inj));
ok(inj.flowReach > 200, 'A*/flow field recovers when the player tile is non-walkable (reaches ' + inj.flowReach + ' cells)');
ok(inj.restored, 'saved-instance restore snaps corrupt player/enemy positions onto walkable tiles');
ok(inj.spawned, 'spawnEnemy into a wall snaps to walkable ground and resets home');
let bad = 0, tot = 0;
for (const id of ids) for (let s = 0; s < SEEDS; s++) { const r = await run(id); tot++; if (r.err || r.viol.length || r.spawnBad) { bad++; ok(false, `${id}#${s}: ${r.err || ''} spawnBad=${r.spawnBad} viol=${r.viol.join(' | ')}`); } }
ok(bad === 0, `${tot} runs over ${ids.length} dungeons: no entity ever on a non-walkable tile`);
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
