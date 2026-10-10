// Content batch 1 (docs/CONTENT_BATCH_1.md): 20 bosses + 20 levels. Data completeness, uniqueness, art/music mapping, generation (16 seeds each: connected,
// boss reachable by the boss-radius flow field, objectives reachable), mechanics toolkit behaviour and headless runs through several levels and bosses.
import fs from 'fs';
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch(); const ev = (fn, arg) => page.evaluate(fn, arg);
const SEEDS = Array.from({ length: 16 }, (_, i) => 211 + i * 1013);
// ---------------- data ----------------
const data = await ev(async () => { const B = await import('/src/content/batch1_bosses.ts'), Lv = await import('/src/content/batch1_levels.ts'), C = await import('/src/config.ts'), S = await import('/src/sim.ts'), Mu = await import('/src/music.ts'), M = await import('/src/content/boss_moves.ts'), D = await import('/src/content/dungeons.ts'), A = await import('/src/enemyart.ts');
  const bad = [];
  for (const b of B.BOSSES) { const d = C.ENEMIES[b.id]; if (!d || !d.boss) bad.push('no enemy def ' + b.id); for (const a of d?.attacks || []) if (!S.ATK[a]) bad.push(b.id + ' missing ATK ' + a); if (!A.ART[b.id]) bad.push('no ART ' + b.id); if (!Mu.BOSS_MAP[b.id]) bad.push('no music ' + b.id); if (!b.phases.length) bad.push('no phases ' + b.id); if (!b.moves.length) bad.push('no moves ' + b.id); for (const a of d?.attacks || []) if (a.includes('.') && !(a in C.ENEMY_DMG)) bad.push('no dmg ' + a); for (const ph of b.phases) for (const act of ph.acts) if ((act.k === 'pylons' || act.k === 'adds') && !C.ENEMIES[act.type]) bad.push(b.id + ' unknown add ' + act.type); if (b.summon && !C.ENEMIES[b.summon]) bad.push(b.id + ' unknown summon'); }
  const old = Object.keys(C.ENEMIES).filter(k => !B.BOSSES.some(b => b.id === k)); const dupName = B.BOSSES.length - new Set(B.BOSSES.map(b => b.name)).size;
  const sig = B.BOSSES.map(b => JSON.stringify([b.moves, b.phases, b.gimmick])); const tri = B.BOSSES.map(b => JSON.stringify([[...new Set(b.moves.map(m => m.k))].sort(), b.gimmick?.k, [...new Set(b.phases.flatMap(p => p.acts.map(a => a.k)))].sort(), b.melee.slice().sort()]));
  const fp = Lv.LEVELS.map(l => JSON.stringify([l.shapes, l.pal.motif, l.pal.light, l.haz.mode, l.roster]));
  const levelBad = []; for (const l of Lv.LEVELS) { if (!B.BOSS_BY_ID[l.boss]) levelBad.push('boss ' + l.id); if (!D.DUNGEONS[l.id]) levelBad.push('dungeon ' + l.id); for (const k of l.unlock.after) if (!D.DUNGEONS[k]) levelBad.push('unlock ' + l.id + '>' + k); for (const t of [l.gateGuard, l.lockElite, l.alarmType, ...Object.values(l.roster).flat().map(x => x[0])]) if (!C.ENEMIES[t]) levelBad.push(l.id + ' unknown enemy ' + t); if (!C.ENEMIES[l.gateGuard].static) levelBad.push(l.id + ' gateGuard not static'); if (!C.ENEMIES[l.lockElite].elite) levelBad.push(l.id + ' lockElite not elite'); }
  const hostedBy = {}; for (const l of Lv.LEVELS) hostedBy[l.boss] = (hostedBy[l.boss] || 0) + 1;
  // unlock graph acyclic and rooted in the original four
  const roots = new Set(['annex', 'foundry', 'clinic', 'warehouse']); const open = new Set(roots); let prog = true; while (prog) { prog = false; for (const l of Lv.LEVELS) if (!open.has(l.id) && l.unlock.after.every(k => open.has(k))) { open.add(l.id); prog = true; } }
  return { nb: B.BOSSES.length, nl: Lv.LEVELS.length, bad, oldClash: B.BOSSES.filter(b => old.includes(b.id) && false).length, dupName, sigU: new Set(sig).size, triU: new Set(tri).size, fpU: new Set(fp).size, levelBad, hosted: Object.keys(hostedBy).length, hostMax: Math.max(...Object.values(hostedBy)), unlockAll: open.size, moveN: Object.keys(M.MOVES).length,
    tracks: [...new Set(B.BOSSES.map(b => b.track))], ids: B.BOSSES.map(b => b.id), kinds: [...new Set(B.BOSSES.flatMap(b => b.moves.map(m => m.k)))], gim: [...new Set(B.BOSSES.map(b => b.gimmick?.k))], acts: [...new Set(B.BOSSES.flatMap(b => b.phases.flatMap(p => p.acts.map(a => a.k))))] }; });
ok(data.nb === 20 && data.nl === 20, '20 bosses and 20 levels defined');
ok(data.bad.length === 0, 'every boss: enemy def, ATK entries, damage, ART entry, music mapping, phases, valid adds: ' + (data.bad.slice(0, 5).join('; ') || 'ok'));
ok(data.dupName === 0, 'boss names are unique');
ok(data.sigU === 20, 'all 20 boss signatures (moves + phases + gimmick) are unique: ' + data.sigU);
ok(data.triU >= 19, 'mechanic kind combinations differ across bosses (' + data.triU + '/20 distinct kind-sets)');
ok(data.fpU === 20, 'all 20 level fingerprints (shapes, motif, light, hazard mode, roster) are unique');
ok(data.levelBad.length === 0, 'levels reference real bosses, enemies, gate guards (static), lock elites (elite), unlock ids: ' + (data.levelBad.slice(0, 4).join('; ') || 'ok'));
ok(data.hosted === 20 && data.hostMax === 1, 'each of the 20 bosses is hosted by exactly one level');
ok(data.unlockAll === 24, 'unlock graph is acyclic and reaches all 24 dungeons from the original four (' + data.unlockAll + ')');
ok(data.tracks.length >= 5 && data.kinds.length >= 9 && data.gim.length >= 6 && data.acts.length >= 5, 'toolkit variety: ' + data.tracks.length + ' tracks, ' + data.kinds.length + ' move kinds, ' + data.gim.length + ' gimmicks, ' + data.acts.length + ' phase actions');
for (const t of data.tracks) ok(fs.existsSync(`public/audio/music/${t}.mp3`), 'music track exists: ' + t);
// atlases (art): index + json + all five sheets
const idx = JSON.parse(fs.readFileSync('public/dungeons/enemies3d/index.json', 'utf8')); const missing = [];
for (const id of data.ids) { if (!idx.includes(id)) { missing.push(id); continue; } const j = JSON.parse(fs.readFileSync(`public/dungeons/enemies3d/${id}.json`, 'utf8')); for (const a of ['idle', 'walk', 'attack', 'hit', 'death']) if (!j.anims[a] || !fs.existsSync('public/dungeons/enemies3d/' + j.anims[a].image)) missing.push(id + ':' + a); if (!(j.hpx > 40)) missing.push(id + ':hpx'); }
ok(missing.length === 0, 'every boss has a complete 8-direction atlas (idle, walk, attack, hit, death): ' + (missing.slice(0, 6).join(', ') || 'ok'));
// ---------------- generation ----------------
const gen = await ev(async ({ SEEDS }) => { const D = await import('/src/content/dungeons.ts'), M = await import('/src/content/mapgen.ts'), Lv = await import('/src/content/batch1_levels.ts'), C = await import('/src/config.ts'); const out = {};
  const hash = L => { let h = 2166136261 >>> 0; const mix = n => { h = Math.imul(h ^ (n | 0), 16777619) >>> 0; }; mix(L.w); mix(L.h); for (const v of L.solid) mix(v); for (const s of L.spawns) mix(s.x * 131 + s.y); return h; };
  for (const sp of Lv.LEVELS) { const d = D.DUNGEONS[sp.id]; const r = { bad: [], disc: [], unreach: [], hashes: [], det: true, n: [], haz: [], bossFlow: 0, theme: true, att: [], w: [], noBoss: 0 };
    for (const s of SEEDS) { const L = d.build(s); r.hashes.push(hash(L)); r.n.push(L.spawns.length); r.haz.push((L.hazards || []).length); r.w.push(L.w + 'x' + L.h); r.att.push(L.attempt || 0);
      const v = M.validate(L); if (v.length) r.bad.push(s + ':' + v.slice(0, 2).join('|'));
      const m = M.reachMap(L, L.spawn, 0), m2 = M.reachMap(L, L.spawn, 2); const sol = new Uint8Array(L.solid); for (const dd of L.doors) for (const [x, y] of dd.tiles) sol[y * L.w + x] = 0; let free = 0, conn = 0; for (let i = 0; i < sol.length; i++) if (!sol[i]) { free++; if (m[i]) conn++; } if (free !== conn) r.disc.push(s);
      for (const t of L.interacts) if (!m[Math.floor(t.y) * L.w + Math.floor(t.x)]) r.unreach.push(s + ':' + t.id); for (const n of ['hackproc', 'controller', 'cratechip']) if (!L.interacts.some(i => i.id === n)) r.unreach.push(s + ':missing ' + n);
      if (m2[Math.floor(L.bossSpawn.y) * L.w + Math.floor(L.bossSpawn.x)]) r.bossFlow++; if (L.theme !== sp.theme) r.theme = false;
      for (const dn of ['gate1', 'lock2', 'boss']) if (!L.doors.some(x => x.id === dn)) r.unreach.push(s + ':door ' + dn);
      if (!L.spawns.some(q => q.type === sp.gateGuard) || !L.spawns.some(q => q.type === sp.lockElite)) r.unreach.push(s + ':guard/elite missing');
      const again = d.build(s); if (hash(again) !== hash(L)) r.det = false; }
    out[sp.id] = r; } return out; }, { SEEDS });
for (const [id, r] of Object.entries(gen)) {
  ok(r.bad.length === 0 && r.disc.length === 0 && r.unreach.length === 0, id + ': 16 seeds valid, fully connected, objectives/doors reachable, guard+elite present' + (r.bad.length + r.disc.length + r.unreach.length ? ' :: ' + [...r.bad, ...r.disc, ...r.unreach].slice(0, 3).join(' / ') : ''));
  ok(r.bossFlow === SEEDS.length, id + ': boss spawn reachable on the boss-radius flow field in all seeds (' + r.bossFlow + '/16)');
  ok(new Set(r.hashes).size >= SEEDS.length - 1 && r.det && r.theme, id + ': ' + new Set(r.hashes).size + '/16 distinct layouts, deterministic per seed, theme tag set; ' + Math.min(...r.n) + '+ enemies, ' + Math.min(...r.haz) + '+ hazards, retries max ' + Math.max(...r.att));
  ok(Math.min(...r.n) >= 40, id + ': at least 40 enemies (' + Math.min(...r.n) + ')'); }
const cross = await ev(async () => { const D = await import('/src/content/dungeons.ts'); const hs = D.BATCH1_IDS.map(i => { const L = D.DUNGEONS[i].build(777); let h = 0; for (let k = 0; k < L.solid.length; k++) h = (h * 31 + L.solid[k]) >>> 0; return h + ':' + L.w + 'x' + L.h; }); return new Set(hs).size; });
ok(cross === 20, 'same seed gives 20 different layouts across the 20 levels (' + cross + ')');
// ---------------- mechanics toolkit (pure + in-sim) ----------------
const mech = await ev(async () => { const Mu = await import('/src/content/mechanics.ts'); const out = {}; const rnd = () => 0.37; const ctx = { ox: 20, oy: 20, aim: 0, tx: 26, ty: 20, w: 1.2, rnd };
  for (const [k, p] of [['marks', {}], ['ring', { gaps: 2 }], ['spokes', { n: 7, len: 8, sweep: 150 }], ['cross', {}], ['lanes', { n: 5, gap: 1 }], ['spiral', {}], ['rain', {}]]) { const z = Mu.patternZones(k, p, ctx); out[k] = z.length; if (k === 'spokes') { out.sweepStagger = new Set(z.map(q => q.windup.toFixed(2))).size; } if (k === 'ring') out.ringN = z.length; if (k === 'lanes') out.lanes = z.length; }
  return out; });
ok(mech.marks >= 5 && mech.ring === 8 && mech.spokes > 20 && mech.cross >= 20 && mech.lanes > 20 && mech.spiral >= 15 && mech.rain >= 8, 'zone pattern generators produce telegraphed patterns (ring leaves its 2 gaps: ' + mech.ring + ' pools)');
ok(mech.sweepStagger >= 6, 'beam sweep (spokes) staggers windups so the beam rotates (' + mech.sweepStagger + ' distinct windups)');
// ---------------- headless runs ----------------
const fresh = id => ev(id => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.cleared = {}; g.save.level = 45; g.recompute(); g.dbg.god = true; g.dbg.oneShot = false; g.save.settings.devFreeReset = true; return g.startRun(id); }, id);
const step = secs => ev(s => { const g = window.__game; for (let i = 0; i < s / 0.016; i++) g.update(0.016); }, secs);
// unlock gating (without bypass)
const lock = await ev(() => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.cleared = {}; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = false; const a = g.startRun('recall_yard'); g.save.cleared = { breaker_yard: 1, radio_mast: 1, warranty_vault: 1 }; const b = g.startRun('recall_yard'); g.enterTown(); g.save.instance = null; g.inst = null; g.save.cleared = {}; const c = g.startRun('coke_ovens'); g.save.lastClearDay = '2020-1-1'; g.enterTown(); g.save.instance = null; g.inst = null; const d = g.startRun('coke_ovens'); return { a, b, c, d }; });
ok(lock.a === false && lock.b === true && lock.c === false && lock.d === true, 'unlock gating: Recall Yard needs 3 clears, Coke Ovens needs the Annex (a previous Annex clear counts)');
const PICK = ['coke_ovens', 'bell_foundry', 'cold_archive', 'freight_depot', 'night_tunnels', 'recall_yard'];
for (const id of PICK) {
  ok(await fresh(id), id + ': fresh run starts'); await step(0.3);
  const info = await ev(() => { const g = window.__game; return { n: g.enemies.length, guard: g.dd.gateGuard, boss: g.dd.defaultBoss, theme: g.level.theme }; });
  ok(info.n >= 40 && info.theme, id + ': enemies spawned (' + info.n + '), theme ' + info.theme);
  // clear gate guard + lock elite + controller via debug, walk to the boss arena and fight
  const r = await ev(async () => { const g = window.__game; const dd = g.dd; for (const e of g.enemies) if (e.type === dd.gateGuard || e.type === dd.lockElite) { e.hp = 0; g.killEnemy(e); } for (let i = 0; i < 40; i++) g.update(0.016); const ctrl = g.level.interacts.find(i => i.id === 'controller'); g.inst.flags.controller = true; g.openDoor('boss'); const L = g.level; g.px = L.revealX + 1.5; g.py = L.bossSpawn.y; for (let i = 0; i < 40; i++) g.update(0.016);
    const boss = g.enemies.find(e => e.type === dd.defaultBoss); return { spawned: !!boss, name: boss && boss.type, reveal: boss && boss._rt.reveal }; });
  ok(r.spawned && r.name === (await ev(() => window.__game.dd.defaultBoss)), id + ': boss spawns on entering the arena (' + r.name + ')');
  const f = await ev(async () => { const g = window.__game; const b = g.enemies.find(e => e.type === g.dd.defaultBoss); for (let i = 0; i < 700; i++) g.update(0.016); b.alert = true; let zones = 0, projs = 0, adds = 0, atk = new Set(), phase0 = b.phase || 0; g.dbg.god = true; g.dbg.oneShot = false;
    const L = g.level; g.px = b.x - 5; g.py = b.y; for (let i = 0; i < 60 * 40; i++) { g.px = Math.max(L.revealX + 1, b.x - 6); g.py = b.y + Math.sin(i / 40) * 2; g.update(0.016); zones = Math.max(zones, g.zones.filter(z => !z.env).length); projs = Math.max(projs, g.projs.length); adds = Math.max(adds, g.enemies.filter(e => e.bossAdd && !e.dead).length); if (b._rt.atk) atk.add(b._rt.atk); if (i === 60 * 12) { b.hp = b.maxHp * 0.4; } if (i === 60 * 24) b.hp = b.maxHp * 0.1; }
    return { zones, projs, adds, atk: [...atk], phase: b.phase || 0, hpFrac: b.hp / b.maxHp, dead: b.dead, st: b._rt.st }; });
  ok(f.zones > 0 || f.projs > 0 || f.adds > 0, id + ': boss fight produced telegraphed zones/projectiles/adds (zones ' + f.zones + ', projs ' + f.projs + ', adds ' + f.adds + ', attacks used: ' + f.atk.join(',') + ')');
  ok(f.phase > 0, id + ': phase transitions fired (phase ' + f.phase + ')');
  const kill = await ev(async () => { const g = window.__game; const b = g.enemies.find(e => e.type === g.dd.defaultBoss); g.dbg.oneShot = true; b.hp = 1; g.hurtEnemy(b, 10, g.px, g.py, 0); for (let i = 0; i < 120; i++) g.update(0.016); return { dead: b.dead, adds: g.enemies.filter(e => e.bossAdd && !e.dead).length, done: g.inst.flags.bossDead, cleared: !!g.save.cleared[g.dd.id] }; });
  ok(kill.dead && kill.adds === 0 && kill.done && kill.cleared, id + ': boss dies, tether/adds cleaned up, run completes and records the clear for unlock');
}
// shield + tether semantic checks
const sem = await ev(async () => { const D = await import('/src/content/dungeons.ts'); const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.save.level = 45; g.recompute(); g.dbg.god = true; g.startRun('substation_12'); for (let i = 0; i < 30; i++) g.update(0.016);
  g.inst.flags.controller = true; g.openDoor('boss'); g.px = g.level.revealX + 1.5; g.py = g.level.bossSpawn.y; for (let i = 0; i < 20; i++) g.update(0.016); const b = g.enemies.find(e => e.type === 'lineman'); for (let i = 0; i < 700; i++) g.update(0.016); b.alert = true; g.dbg.oneShot = false;
  b.hp = b.maxHp * 0.6; for (let i = 0; i < 30; i++) g.update(0.016); const pyl = g.enemies.filter(e => e.pylon && !e.dead).length; const hp0 = b.hp; g.hurtEnemy(b, 100, g.px, g.py, 0); const taken = hp0 - b.hp; for (const p of g.enemies.filter(e => e.pylon)) { p.hp = 0; g.killEnemy(p); } for (let i = 0; i < 30; i++) g.update(0.016); const hp1 = b.hp; g.hurtEnemy(b, 100, g.px, g.py, 0); const taken2 = hp1 - b.hp;
  return { pyl, taken, taken2, vuln: b._rt.vuln }; });
ok(sem.pyl === 3 && sem.taken <= 10.5 && sem.taken2 >= 140, 'tether: 3 pylons spawn at 70%, boss takes 90% less damage while they live (' + sem.taken.toFixed(1) + '), then is staggered for 1.5x (' + sem.taken2.toFixed(0) + ')');
const sh = await ev(async () => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.save.level = 45; g.recompute(); g.dbg.god = true; g.startRun('bell_foundry'); for (let i = 0; i < 30; i++) g.update(0.016);
  g.inst.flags.controller = true; g.openDoor('boss'); g.px = g.level.revealX + 1.5; g.py = g.level.bossSpawn.y; for (let i = 0; i < 20; i++) g.update(0.016); const b = g.enemies.find(e => e.type === 'bellfounder'); for (let i = 0; i < 700; i++) g.update(0.016); b.alert = true; g.dbg.oneShot = false;
  b.hp = b.maxHp * 0.49; for (let i = 0; i < 10; i++) g.update(0.016); const sh = b._rt.shield && b._rt.shield.hp; const h0 = b.hp; g.hurtEnemy(b, 50, g.px, g.py, 0); const t1 = h0 - b.hp; g.hurtEnemy(b, b.maxHp, g.px, g.py, 0); const hp2 = b.hp; g.hurtEnemy(b, 100, g.px, g.py, 0); return { sh, t1, brokenStagger: b._rt.vuln, t3: hp2 - b.hp, shieldLeft: !!b._rt.shield }; });
ok(sh.sh > 0 && sh.t1 === 0 && !sh.shieldLeft && sh.brokenStagger > 0, 'shield: absorbs damage (boss HP untouched), breaking it staggers the boss');
ok(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
