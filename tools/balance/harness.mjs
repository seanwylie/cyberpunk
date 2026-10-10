// Headless balance harness: runs the real sim (src/sim.ts, no rendering) in a page with a simple bot AI.
// runJob(job) executes inside the page (vite dev server serves /src). See docs/BALANCE.md.
// job = { mode:'level'|'mob', id, kit:'starter'|'mid'|'purple'|'orange', level, seed, maxT, maxDeaths }
export async function runJob(job) {
  const G = window.__game;
  const [Cfg, St, Sim, Dun, B1, MobsM] = await Promise.all([import('/src/config.ts'), import('/src/state.ts'), import('/src/sim.ts'), import('/src/content/dungeons.ts'), import('/src/content/batch1_levels.ts'), import('/src/content/mobs.ts')]);
  const { ITEMS, CHIPS, SLOTS, SLOT_SOCKETS, ENEMIES, chipFits } = Cfg;
  // ---- seeded RNG (sim uses Math.random) ----
  let rs = (job.seed * 2654435761) >>> 0 || 1; const rnd = () => { rs += 0x6D2B79F5; let t = rs; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const realRandom = Math.random; Math.random = rnd;
  try {
    const g = G; const RAR = ['grey', 'green', 'blue', 'purple', 'orange'];
    // ---- fresh save + kit ----
    g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.repairBill = 0;
    g.save.cleared = {}; for (const k of Object.keys(Dun.DUNGEONS)) g.save.cleared[k] = 1; g.save.settings.devFreeReset = true; g.save.stims = 2;
    g.save.level = job.level; g.save.xp = 0; g.dbg.god = false; g.dbg.oneShot = false;
    for (const sl of SLOTS) { const st = g.save.items.find(i => i.def === 'stock_' + sl); if (st) g.save.installed[sl] = st.uid; else { const it = St.mkInst(g.save, 'stock_' + sl); g.save.items.push(it); g.save.installed[sl] = it.uid; } }
    for (const it of g.save.items) if (!it.def.startsWith('stock_')) it.chips = [];
    const kitMax = { starter: -1, mid: 2, blue: 2, purple: 3, orange: 4 }[job.kit];
    if (job.kit === 'orange') { g.recompute(); g.cheatIdkfa(); g.save.level = job.level; }
    else if (kitMax >= 0) {
      const chipMax = (job.kit === 'mid' || job.kit === 'blue') ? 2 : 3;
      for (const sl of SLOTS) {
        const cands = ITEMS.filter(i => i.slot === sl && !i.id.startsWith('stock_') && RAR.indexOf(i.rarity) <= kitMax && RAR.indexOf(i.rarity) >= 1 && i.lvl <= job.level && !/cheat|sig_/.test(i.id));
        cands.sort((a, b) => RAR.indexOf(b.rarity) - RAR.indexOf(a.rarity) || b.lvl - a.lvl || (a.id < b.id ? -1 : 1));
        for (const c of cands) { const inst = St.mkInst(g.save, c.id); const keep = g.save.installed[sl]; g.save.installed[sl] = inst.uid; g.save.items.push(inst); const L = {}; for (const s2 of SLOTS) { const u = g.save.installed[s2]; L[s2] = g.save.items.find(i => i.uid === u); }
          const bad = (() => { try { const { hardConflicts } = window.__buildmod || {}; return false; } catch { return false; } })();
          break; }
      }
      // chips: top-rarity fitting chips, sockets filled (mid: half)
      for (const sl of SLOTS) { const it = g.save.items.find(i => i.uid === g.save.installed[sl]); if (!it || it.def.startsWith('stock_')) continue; const cap = SLOT_SOCKETS[sl]; const n = job.kit === 'mid' ? Math.ceil(cap / 2) : cap;
        const list = Object.keys(CHIPS).filter(c => chipFits(c, sl) && RAR.indexOf(CHIPS[c].rarity) <= chipMax).sort((a, b) => RAR.indexOf(CHIPS[b].rarity) - RAR.indexOf(CHIPS[a].rarity) || (a < b ? -1 : 1)); it.chips = []; for (let i = 0; i < n && list.length; i++) it.chips.push(list[i % Math.min(list.length, 4)]); }
    }
    g.recompute();
    const kitInfo = () => ({ hp: Math.round(g.maxHp), dmg: +g.stat().dmg.toFixed(2), armor: +g.stat().armor.toFixed(1), atk: +g.stat().atkSpeed.toFixed(2), weapon: g.build.weapon.kind, abilities: g.build.abilities.slice() });

    // ---- instrumentation ----
    const R = { src: {}, abil: {}, mobTtk: {}, bossTtk: null, deaths: 0, dodges: 0, stims: 0, killsByType: {}, hits: [], maxHit: 0, maxHitSrc: '' };
    const origResolve = g.resolveAttack.bind(g), origBegin = g.beginAttack.bind(g), origHurt = g.hurtPlayer.bind(g), origExec = g.executeAbility.bind(g), origKill = g.killEnemy.bind(g);
    g.beginAttack = (e, a, ang, tx, ty) => { const z0 = g.zones.length; const r = origBegin(e, a, ang, tx, ty); for (let i = z0; i < g.zones.length; i++) g.zones[i].src = e.type + ':' + a; return r; };
    g.resolveAttack = (e, a, tx, ty) => { const p0 = g.projs.length, z0 = g.zones.length; const r = origResolve(e, a, tx, ty); for (let i = p0; i < g.projs.length; i++) g.projs[i].src = e.type + ':' + a; for (let i = z0; i < g.zones.length; i++) if (!g.zones[i].src) g.zones[i].src = e.type + ':' + a; return r; };
    g.hurtPlayer = (dmg, sx, sy) => { const hp0 = g.hp; const dead0 = g.downed; origHurt(dmg, sx, sy); const d = hp0 - g.hp; if (d > 0 && !dead0) { const k = g.dmgSrc || '?'; R.src[k] = (R.src[k] || 0) + d; if (d > R.maxHit) { R.maxHit = d; R.maxHitSrc = k; } } };
    g.executeAbility = c => { R.abil[c.ab.id] = (R.abil[c.ab.id] || 0) + 1; return origExec(c); };
    const firstAlert = new Map(); let simT = 0;
    g.killEnemy = e => { if (!e.dead && e.faction === 'enemy') { const t0 = firstAlert.get(e.id); const k = e.type; const def = ENEMIES[k]; if (t0 !== undefined) { (R.mobTtk[k] ||= []).push(+(simT - t0).toFixed(2)); if (def.boss) R.bossTtk = +(simT - t0).toFixed(1); } R.killsByType[k] = (R.killsByType[k] || 0) + 1; } return origKill(e); };

    // ---- navigation helpers ----
    let L = null, flow = null, flowKey = '', flowT = -9;
    const bfs = (tx, ty) => { const f = new Int16Array(L.w * L.h).fill(-1); const q = [(ty | 0) * L.w + (tx | 0)]; f[q[0]] = 0; for (let h = 0; h < q.length; h++) { const c = q[h], cx = c % L.w, cy = (c / L.w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue; const i = ny * L.w + nx; if (f[i] >= 0 || L.solid[i]) continue; f[i] = f[c] + 1; q.push(i); } } return f; };
    const mv = (wx, wy) => { const l = Math.hypot(wx, wy) || 1; wx /= l; wy /= l; g.setMove(wx - wy, (wx + wy) / 2); };
    const nav = (tx, ty) => { const key = (tx | 0) + ',' + (ty | 0); if (key !== flowKey || simT - flowT > 4) { flow = bfs(tx, ty); flowKey = key; flowT = simT; } const cx = g.px | 0, cy = g.py | 0; let best = flow[cy * L.w + cx], bx = cx, by = cy; if (best < 0) best = 1e9;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; const i = ny * L.w + nx; if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h || L.solid[i] || flow[i] < 0) continue; if (dx && dy && (L.solid[cy * L.w + nx] || L.solid[ny * L.w + cx])) continue; if (flow[i] < best) { best = flow[i]; bx = nx; by = ny; } }
      mv(bx + .5 - g.px, by + .5 - g.py); };
    const dist = (a, b, c, d) => Math.hypot(a - c, b - d);

    // ---- run setup ----
    const dt = 1 / 30; let result = { id: job.id, kit: job.kit, level: job.level, seed: job.seed, kitInfo: null };
    const maxT = job.maxT || 1100, maxDeaths = job.maxDeaths ?? 4;
    const stepSim = () => { g.update(dt); simT += dt; };
    const trackAlert = () => { for (const e of g.enemies) if (!e.dead && e.faction === 'enemy' && e.alert && !firstAlert.has(e.id) && e._rt.reveal <= 0) firstAlert.set(e.id, simT); };
    const heroLogic = (threatsOnly) => {
      // stims
      if (g.hp < g.maxHp * 0.4 && g.inst.carried.stims > 0 && !g.downed) { g.useStim(); R.stims++; }
      // dodge telegraphs by simple rule: leave telegraphed/active zones, dodge when a melee windup is close
      let fx = 0, fy = 0, flee = false;
      for (const z of g.zones) { if (z.env || z.dps <= 0) continue; const d = dist(g.px, g.py, z.x, z.y); if (d < z.r + 1.0 && (z.t < z.windup + .6 || true)) { const w = 1 / Math.max(.5, d); fx += (g.px - z.x) * w; fy += (g.py - z.y) * w; flee = true; } }
      for (const p of g.projs) { if (p.faction !== 'enemy') continue; const d = dist(g.px, g.py, p.x, p.y); if (d < 4.5) { const sp = Math.hypot(p.vx, p.vy) || 1; const rx = g.px - p.x, ry = g.py - p.y; const along = (rx * p.vx + ry * p.vy) / sp; if (along > 0 && Math.abs(rx * p.vy - ry * p.vx) / sp < .9) { if (g.dodgeCd <= 0) { g.setMove(-p.vy / sp, p.vx / sp); mv(-p.vy, p.vx); g.dodge(); R.dodges++; return 'dodge'; } fx += -p.vy / sp * 2; fy += p.vx / sp * 2; flee = true; } } }
      const tele = g.enemies.find(e => !e.dead && e.faction === 'enemy' && e._rt.st === 'tele' && dist(e.x, e.y, g.px, g.py) < 3.2 && e._rt.t > .15);
      if (tele && g.dodgeCd <= 0 && !g.revealing) { mv(g.px - tele.x, g.py - tele.y); g.dodge(); R.dodges++; return 'dodge'; }
      if (flee) { mv(fx, fy); return 'flee'; }
      return null;
    };
    const useAbilities = (near, alive) => {
      if (g.aim || g.cast || g.overheated || g.downed) return;
      for (let i = 0; i < 3; i++) { const id = g.build.abilities[i]; if (!id || g.abCd[i] > 0) continue; const d = dist(g.px, g.py, near.x, near.y); if (alive.length >= 2 ? d < 6 : (ENEMIES[near.type].boss || ENEMIES[near.type].elite) && d < 6) { try { g.beginAim(i); if (g.aim) { g.updateAim(near.x, near.y, true); g.releaseAim(); } } catch (e) {} break; } }
    };
    const ranged = () => g.build.weapon.range;
    const fight = () => {
      const alive = g.enemies.filter(e => !e.dead && e.faction === 'enemy' && e._rt.reveal <= 0 && !e.pylonLocked && dist(e.x, e.y, g.px, g.py) < (e.alert ? 10 : 6) && g.los(g.px, g.py, e.x, e.y));
      if (!alive.length) return false;
      // priority targets: pylons / boss adds that gate the boss, then support roles, then nearest
      const pri = e => (e.pylon ? 0 : /healer|mender|warder|summoner|matron/.test(e.type) ? 1 : e.bossAdd ? 2 : 3);
      alive.sort((a, b) => pri(a) - pri(b) || dist(a.x, a.y, g.px, g.py) - dist(b.x, b.y, g.px, g.py));
      const t = alive[0]; g.target = t.id;
      const d = dist(t.x, t.y, g.px, g.py), rr = ENEMIES[t.type].radius || .5, w = g.build.weapon; const want = Math.max(.8, Math.min(w.range * .8, 5)) + rr;
      if (d > want) { (d < 3 ? mv(t.x - g.px, t.y - g.py) : nav(t.x, t.y)); } else if (d < 1.0 && w.range > 2.5) mv(g.px - t.x, g.py - t.y); else g.setMove(0, 0);
      useAbilities(t, alive);
      return true;
    };

    if (job.mode === 'mob') {
      // duel arena: the Annex entry yard, a pack of N of one mob placed 8 tiles away, bot fights; reports TTK / damage / one-shot risk
      if (!g.startRun('annex')) return { error: 'startRun annex failed' };
      for (let i = 0; i < 20; i++) stepSim(); L = g.level; g.enemies.forEach(e => { e.dead = true; }); g.enemies = []; g.inst.carried.stims = 0; g.hp = g.maxHp; g.revealing = false;
      const n = job.n || 3; const spots = []; const sx = g.px, sy = g.py; for (let a = 0; a < 36 && spots.length < n; a++) { const ang = a * .55; const x = sx + Math.cos(ang) * 7, y = sy + Math.sin(ang) * 7; if (!g.solidAt(x, y) && g.los(sx, sy, x, y)) spots.push([x, y]); }
      const es = spots.map(([x, y]) => { const e = g.spawnEnemy(job.id, x, y); e.alert = true; return e; }); const hp0 = g.hp; let t = 0, hpLost = 0;
      R.kitInfo = kitInfo();
      while (t < 60 && g.enemies.some(e => !e.dead && e.faction === 'enemy' && (e.type === job.id || e.minionOf)) && !g.downed) { const hpb = g.hp; trackAlert(); const act = heroLogic(); if (!act && !fight()) g.setMove(0, 0); stepSim(); t += dt; if (g.hp < g.maxHp * .3) g.hp = g.maxHp, R.refills = (R.refills || 0) + 1; }
      return { id: job.id, kit: job.kit, level: job.level, seed: job.seed, par: job.par, n, t: +t.toFixed(1), downed: g.downed, kitInfo: R.kitInfo, src: R.src, maxHit: R.maxHit, maxHitSrc: R.maxHitSrc, mobTtk: R.mobTtk, abil: R.abil, refills: R.refills || 0, mobHp: ENEMIES[job.id].hp };
    }

    // ---- full level run ----
    if (!g.startRun(job.id)) return { error: 'startRun failed: ' + job.id };
    g.recompute(); g.hp = g.maxHp; L = g.level; result.kitInfo = kitInfo(); const nEnemies = g.enemies.length; let bossSeen = 0, stuckT = 0, lastPos = [g.px, g.py], lastCheck = 0, deathsHere = 0;
    const dd = g.dd; let phaseLog = {}; let reachCache = { key: '', t: -9, ok: true };
    while (simT < maxT && !g.inst.flags.bossDead) {
      if (g.downed) { R.deaths++; deathsHere++; if (R.deaths >= maxDeaths) break; g.returnToCheckpoint(); flowKey = ''; stuckT = 0; continue; }
      if (g.channel) g.channel = null;
      trackAlert();
      const f = g.inst.flags; const boss = g.enemies.find(e => !e.dead && ENEMIES[e.type].boss && e._rt.reveal <= 0);
      if (boss && !bossSeen) bossSeen = simT;
      if (g.revealing) { g.setMove(0, 0); stepSim(); continue; }
      const act = heroLogic(); if (job.debug && Math.floor(simT * 30) % 150 === 0) (R.trace ||= []).push([+simT.toFixed(1), +g.px.toFixed(1), +g.py.toFixed(1), act || '-', g.target, g.inputMove.x, g.inputMove.y]);
      if (!act) {
        const fought = fight();
        if (!fought) {
          g.target = null; let tx, ty;
          const guards = !f.gate1 ? g.enemies.filter(e => !e.dead && e.type === dd.gateGuard) : [];
          const elites = (f.gate1 && !f.lock2 && !f.controller) ? g.enemies.filter(e => !e.dead && e.type === dd.lockElite) : [];
          if (guards.length) { guards.sort((a, b) => dist(a.x, a.y, g.px, g.py) - dist(b.x, b.y, g.px, g.py)); tx = guards[0].x; ty = guards[0].y; if (dist(tx, ty, g.px, g.py) < 9 && !guards[0].alert) { /* approach to aggro */ } }
          else if (elites.length) { elites.sort((a, b) => dist(a.x, a.y, g.px, g.py) - dist(b.x, b.y, g.px, g.py)); tx = elites[0].x; ty = elites[0].y; }
          else if (f.controller && !f.bossSpawned) { tx = L.revealX + 2; ty = L.bossSpawn.y; }
          else { const o = g.objective(); if (o) { tx = o.x; ty = o.y; if (o.kind === 'controller' && dist(g.px, g.py, tx, ty) < 1.6 && g.prompt) { g.interact(); stepSim(); continue; } } }
          if (tx !== undefined && (guards.length || elites.length)) { const reach = (x, y) => { const f2 = bfs(x, y); return f2[(g.py | 0) * L.w + (g.px | 0)] >= 0; }; const key = 'r' + (tx | 0) + ',' + (ty | 0); if (reachCache.key !== key || simT - reachCache.t > 5) reachCache = { key, t: simT, ok: reach(tx, ty) }; if (!reachCache.ok) { const door = L.doors.find(d => d.id === (guards.length ? 'gate1' : 'lock2')); if (door && door.tiles.length) { tx = door.tiles.reduce((a, t) => a + t[0], 0) / door.tiles.length + .5; ty = door.tiles.reduce((a, t) => a + t[1], 0) / door.tiles.length + .5; } } }
          if (tx !== undefined) { if (dist(g.px, g.py, tx, ty) > 1.2) nav(tx, ty); else g.setMove(0, 0); }
          // walk toward far enemies that are holding the path (aggro by proximity) is implicit; attack when in range handled by autoAttack
        }
      }
      // stuck detection
      if (simT - lastCheck > 6) { lastCheck = simT; if (dist(g.px, g.py, lastPos[0], lastPos[1]) < 1.0 && !g.revealing) { stuckT++; flowKey = ''; if (stuckT > 4) { /* teleport nudge */ const o = g.objective(); if (o && stuckT > 8) { R.stuck = (R.stuck || 0) + 1; R.stuckAt = { pos: [+g.px.toFixed(1), +g.py.toFixed(1)], obj: o, flags: { ...f }, near: g.enemies.filter(e => !e.dead && dist(e.x, e.y, g.px, g.py) < 14).map(e => [e.type, e.alert, +dist(e.x, e.y, g.px, g.py).toFixed(1), +e.x.toFixed(1), +e.y.toFixed(1), g.los(g.px, g.py, e.x, e.y)]).slice(0, 8), guards: g.enemies.filter(e => e.type === dd.gateGuard).map(e => [e.dead, +e.x.toFixed(1), +e.y.toFixed(1)]), doors: L.doors.map(d => d.id) }; break; } } } else stuckT = 0; lastPos = [g.px, g.py]; }
      stepSim();
    }
    const cleared = !!g.inst.flags.bossDead; const bossDef = ENEMIES[dd.defaultBoss];
    const bossRun = g.enemies.find(e => ENEMIES[e.type].boss);
    return { ...result, cleared, deaths: R.deaths, t: +simT.toFixed(1), bossReached: bossSeen ? +bossSeen.toFixed(1) : null, bossTtk: R.bossTtk, bossFightT: bossSeen && cleared ? +(simT - bossSeen).toFixed(1) : null, bossHpLeft: bossRun && !cleared ? +(bossRun.hp / bossRun.maxHp).toFixed(2) : 0, boss: bossRun?.type || dd.defaultBoss, src: R.src, abil: R.abil, mobTtk: R.mobTtk, maxHit: +R.maxHit.toFixed(1), maxHitSrc: R.maxHitSrc, dodges: R.dodges, stims: R.stims, stuck: R.stuck || 0, nEnemies, kills: g.kills, tier: dd.tier || 0, maxHp: Math.round(g.maxHp), stuckAt: R.stuckAt, trace: R.trace, failWhy: cleared ? '' : (R.stuck ? 'stuck' : R.deaths >= maxDeaths ? 'deaths' : 'timeout') };
  } finally { Math.random = realRandom; }
}
