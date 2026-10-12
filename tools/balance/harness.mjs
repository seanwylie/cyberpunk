// Headless balance harness: runs the real sim (src/sim.ts, no rendering) in a page with a simple bot AI.
// runJob(job) executes inside the page (vite dev server serves /src). See docs/BALANCE.md.
// job = { mode:'level'|'mob', id, kit:'starter'|'mid'|'purple'|'orange', level, seed, maxT, maxDeaths }
export async function runJob(job) {
  const G = window.__game;
  const [Cfg, St, Sim, Dun, B1, MobsM, ZS] = await Promise.all([import('/src/config.ts'), import('/src/state.ts'), import('/src/sim.ts'), import('/src/content/dungeons.ts'), import('/src/content/batch1_levels.ts'), import('/src/content/mobs.ts'), import('/src/content/zoneshape.ts')]);
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
    // abmid/abpurple: same rarity ceiling as mid/purple, but hardware is the augment-ability set (src/abilities/hw.ts) so abilities are exercised
    const HEATMAX = job.kit === 'heatmax'; const AB = job.kit === 'abmid' || job.kit === 'abpurple' || HEATMAX; const kitMax = { starter: -1, mid: 2, blue: 2, purple: 3, orange: 4, abmid: 2, abpurple: 3, heatmax: 3 }[job.kit];
    if (job.kit === 'orange') { g.recompute(); g.cheatIdkfa(); g.save.level = job.level; }
    else if (kitMax >= 0) {
      const chipMax = HEATMAX ? 3 : (job.kit === 'mid' || job.kit === 'blue' || job.kit === 'abmid') ? 2 : 3;
      for (const sl of SLOTS) {
        const cands = ITEMS.filter(i => i.slot === sl && !i.id.startsWith('stock_') && RAR.indexOf(i.rarity) <= kitMax && RAR.indexOf(i.rarity) >= 1 && i.lvl <= job.level && !/cheat|sig_/.test(i.id) && (AB ? true : !i.id.startsWith('ab_')));
        if (HEATMAX) cands.sort((a, b) => ((b.stats?.cooling || 0) - (a.stats?.cooling || 0)) || (+b.id.startsWith('ab_') - +a.id.startsWith('ab_')) || RAR.indexOf(b.rarity) - RAR.indexOf(a.rarity) || (a.id < b.id ? -1 : 1)); else if (AB) cands.sort((a, b) => (+b.id.startsWith('ab_') - +a.id.startsWith('ab_')) || RAR.indexOf(b.rarity) - RAR.indexOf(a.rarity) || (b.abilities?.length || 0) - (a.abilities?.length || 0) || b.lvl - a.lvl || (a.id < b.id ? -1 : 1)); else cands.sort((a, b) => RAR.indexOf(b.rarity) - RAR.indexOf(a.rarity) || b.lvl - a.lvl || (a.id < b.id ? -1 : 1));
        for (const c of cands) { const inst = St.mkInst(g.save, c.id); const keep = g.save.installed[sl]; g.save.installed[sl] = inst.uid; g.save.items.push(inst); const L = {}; for (const s2 of SLOTS) { const u = g.save.installed[s2]; L[s2] = g.save.items.find(i => i.uid === u); }
          const bad = (() => { try { const { hardConflicts } = window.__buildmod || {}; return false; } catch { return false; } })();
          break; }
      }
      // chips: top-rarity fitting chips, sockets filled (mid: half)
      for (const sl of SLOTS) { const it = g.save.items.find(i => i.uid === g.save.installed[sl]); if (!it || it.def.startsWith('stock_')) continue; const cap = SLOT_SOCKETS[sl]; const n = (job.kit === 'mid' || job.kit === 'abmid') ? Math.ceil(cap / 2) : cap;
        const list = Object.keys(CHIPS).filter(c => chipFits(c, sl) && RAR.indexOf(CHIPS[c].rarity) <= chipMax && (!HEATMAX || /^(coolant|quench)$/.test(c))).sort((a, b) => RAR.indexOf(CHIPS[b].rarity) - RAR.indexOf(CHIPS[a].rarity) || (a < b ? -1 : 1)); it.chips = []; for (let i = 0; i < n && list.length; i++) it.chips.push(list[i % Math.min(list.length, 4)]); }
    }
    g.recompute();
    const kitInfo = () => ({ hp: Math.round(g.maxHp), dmg: +g.stat().dmg.toFixed(2), armor: +g.stat().armor.toFixed(1), atk: +g.stat().atkSpeed.toFixed(2), weapon: g.build.weapon.kind, abilities: g.build.abilities.slice() });

    // ---- instrumentation ----
    g.dealt = {}; g.casts = {}; g.dbg.noHitStop = true;
    const R = { src: {}, abil: {}, mobTtk: {}, bossTtk: null, deaths: 0, dodges: 0, stims: 0, killsByType: {}, hits: [], maxHit: 0, maxHitSrc: '' };
    const origResolve = g.resolveAttack.bind(g), origBegin = g.beginAttack.bind(g), origHurt = g.hurtPlayer.bind(g), origExec = g.executeAbility.bind(g), origKill = g.killEnemy.bind(g);
    g.beginAttack = (e, a, ang, tx, ty) => { const z0 = g.zones.length; const r = origBegin(e, a, ang, tx, ty); for (let i = z0; i < g.zones.length; i++) g.zones[i].src = e.type + ':' + a; return r; };
    g.resolveAttack = (e, a, tx, ty) => { const p0 = g.projs.length, z0 = g.zones.length; const r = origResolve(e, a, tx, ty); for (let i = p0; i < g.projs.length; i++) g.projs[i].src = e.type + ':' + a; for (let i = z0; i < g.zones.length; i++) if (!g.zones[i].src) g.zones[i].src = e.type + ':' + a; return r; };
    g.hurtPlayer = (dmg, sx, sy) => { const hp0 = g.hp; const dead0 = g.downed; origHurt(dmg, sx, sy); const d = hp0 - g.hp; if (d > 0 && !dead0) { const k = g.dmgSrc || '?'; R.src[k] = (R.src[k] || 0) + d; if (d > R.maxHit) { R.maxHit = d; R.maxHitSrc = k; } } };
    g.executeAbility = c => { R.abil[c.ab.id] = (R.abil[c.ab.id] || 0) + 1; H.casts++; const p = g.curTag; g.curTag = c.ab.id; try { return origExec(c); } finally { g.curTag = p; } };
    { const lb = g.lungeBladeHit.bind(g); g.lungeBladeHit = () => { const p = g.curTag; g.curTag = 'bladeburst'; try { return lb(); } finally { g.curTag = p; } }; }
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
    const maxT = job.maxT || (job.bossOnly ? 420 : 1100), maxDeaths = job.maxDeaths ?? 4;
    const H = { over: 0, overT: 0, heatSum: 0, n: 0, was: false, casts: 0 };
    const stepSim = () => { g.update(dt); simT += dt; H.n++; H.heatSum += g.heat; if (g.overheated) { H.overT += dt; if (!H.was) H.over++; } H.was = g.overheated; };
    const trackAlert = () => { for (const e of g.enemies) if (!e.dead && e.faction === 'enemy' && e.alert && !firstAlert.has(e.id) && e._rt.reveal <= 0) firstAlert.set(e.id, simT); };
    const SPAM = job.profile === 'spam' || job.profile === 'sloppy', VENTER = job.profile === 'sloppy' || (job.profile !== 'spam' && !!job.vent !== false && job.mode === 'heat'); /* heat bench: casts every ready ability regardless of heat (only the overheat lockout stops it) */
    const TANK = job.profile === 'tank'; // tank-and-spank: stands next to its target, auto-attacks only: never dodges, never uses abilities, never repositions (stims only)
    const heroLogic = (threatsOnly) => {
      // stims
      if (g.hp < g.maxHp * 0.4 && g.inst.carried.stims > 0 && !g.downed && !(g.stimCd > 0)) { const s0 = g.inst.carried.stims; g.useStim(); if (g.inst.carried.stims < s0) R.stims++; }
      if (TANK) return null;
      // vent: the heat-management skill. Vent when overheated, or when hot and not mid-dodge (12 s cooldown)
      if (job.noVent !== true && g.ventNow && g.ventCd <= 0 && g.ventLock <= 0 && !g.downed && (g.overheated || g.heat >= 90)) g.ventNow();
      // dodge telegraphs by simple rule: leave telegraphed/active zones, dodge when a melee windup is close
      let fx = 0, fy = 0, flee = false;
      // shaped boss telegraphs (lines, cones, gapped rings, tiles, safe circles): a skilled player reads the shape, so the bot samples nearby points and walks to one that is outside every shape about to fire; for safe-zone mechanics it walks into (and holds) the nearest safe circle
      { const look = (z, dt) => { const c = Object.assign({}, z); const live = Math.max(0, Math.min(dt, z.t + dt - z.windup)); if (z.spin) c.a = (z.a || 0) + z.spin * live; if (z.grow) { c.r = z.r + z.grow * live; if (z.r0 !== undefined) c.r0 = z.r0 + z.grow * live; } if (z.vx || z.vy) { c.x = z.x + z.vx * live; c.y = z.y + z.vy * live; } return c; };
        const sz = g.zones.find(z => !z.env && z.shape === 'safe' && z.t < z.life && ((z.dps > 0 && z.t > z.windup - 2.6) || (z.heatOnly && z.t > z.windup - 1 && g.heat > 62)));
        if (sz && !g.revealing) { let best = null, bd = 1e9; for (const h of sz.safe) { const d = dist(g.px, g.py, h.x, h.y); if (d < bd) { bd = d; best = h; } } if (best) { if (bd > best.r * .45) mv(best.x - g.px, best.y - g.py); else g.setMove(0, 0); return 'safe'; } }
        const dz = g.zones.filter(z => !z.env && z.shape && z.shape !== 'ghost' && z.shape !== 'safe' && z.dps > 0 && z.t < z.life && z.t > z.windup - .75);
        if (dz.length) { const bad = (x, y) => dz.some(z => ZS.zoneInside(look(z, 0), x, y, .3) || ZS.zoneInside(look(z, .25), x, y, .3)); const rem = z => z.t < z.windup;
          if (bad(g.px, g.py)) { { const zz = dz.find(z => ZS.zoneInside(look(z, 0), g.px, g.py, .3) || ZS.zoneInside(look(z, .25), g.px, g.py, .3)); const key = (zz?.kit || zz?.src || '?') + ':' + (zz?.style || zz?.shape); (R.fleeBy ||= {})[key] = (R.fleeBy[key] || 0) + 1; } let bx = null, bdist = 1e9; for (let rr = 1; rr <= 7; rr += 1) for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, x = g.px + Math.cos(a) * rr, y = g.py + Math.sin(a) * rr; if (g.circleHits(x, y, .45) || bad(x, y)) continue; if (rr < bdist) { bdist = rr; bx = [x, y]; } } if (bx) { fx += (bx[0] - g.px) * 6; fy += (bx[1] - g.py) * 6; flee = true; } } } }
      for (const z of g.zones) { if (z.env || z.dps <= 0 || (z.shape && z.shape !== 'disc')) continue; const d = dist(g.px, g.py, z.x, z.y); if (d < z.r + 1.0 && (z.t < z.windup + .6 || true)) { { const key = 'disc:' + (z.style || '-') + ':' + (z.src || ''); (R.fleeBy ||= {})[key] = (R.fleeBy[key] || 0) + 1; } const w = 1 / Math.max(.5, d); fx += (g.px - z.x) * w; fy += (g.py - z.y) * w; flee = true; } }
      for (const p of g.projs) { if (p.faction !== 'enemy') continue; const d = dist(g.px, g.py, p.x, p.y); if (d < 4.5) { const sp = Math.hypot(p.vx, p.vy) || 1; const rx = g.px - p.x, ry = g.py - p.y; const along = (rx * p.vx + ry * p.vy) / sp; if (along > 0 && Math.abs(rx * p.vy - ry * p.vx) / sp < .9) { if (g.dodgeCd <= 0) { g.setMove(-p.vy / sp, p.vx / sp); mv(-p.vy, p.vx); g.dodge(); R.dodges++; return 'dodge'; } fx += -p.vy / sp * 2; fy += p.vx / sp * 2; flee = true; } } }
      const tele = g.enemies.find(e => !e.dead && e.faction === 'enemy' && e._rt.st === 'tele' && dist(e.x, e.y, g.px, g.py) < 3.2 && e._rt.t > .15);
      if (tele && g.dodgeCd <= 0 && !g.revealing) { mv(g.px - tele.x, g.py - tele.y); g.dodge(); R.dodges++; return 'dodge'; }
      if (flee) { mv(fx, fy); return 'flee'; }
      return null;
    };
    const useAbilities = (near, alive) => {
      if (TANK) return;
      if (g.aim || g.cast || g.overheated || g.downed) return;
      const AB = g.build.abilities; const has = id => AB.indexOf(id); const BUD = (ENEMIES[near.type].boss || ENEMIES[near.type].elite) ? 106 : 96; /* greedy burst: against bosses/elites the bot will push into overheat */ const hc = id => Cfg.ABILITIES[id].heat * (1 - Math.min(.3, 0)); const rdy = id => { const i = has(id); return i >= 0 && g.abCd[i] <= 0 && (SPAM || g.heat + hc(id) <= BUD) ? i : -1; };
      const fire = (i, tx, ty) => { try { g.beginAim(i); if (g.aim) { g.updateAim(tx, ty, true); g.releaseAim(); return true; } } catch (e) {} return false; };
      const d = dist(g.px, g.py, near.x, near.y); const near8 = alive.filter(e => dist(e.x, e.y, g.px, g.py) < 8);
      const shielded = near8.find(e => e._rt.shield && e._rt.shield.hp > 0), healer = near8.find(e => /healer|mender|warder|summoner|matron|relay/.test(e.type));
      const tele = alive.find(e => e._rt.st === 'tele' && dist(e.x, e.y, g.px, g.py) < 3.5);
      // smart-ish rotation: counters first, then attack abilities on cooldown, defence when threatened
      let i;
      if (g.bot_mode !== 'auto_only') {
        if ((i = rdy('cloak')) >= 0 && (near.boss || ENEMIES[near.type].boss || ENEMIES[near.type].elite) && d < 9 && g.cloakT <= 0 && rdy('bladeburst') >= 0) { if (fire(i, g.px, g.py)) return; }
        if ((i = rdy('pulse')) >= 0 && (shielded || near8.length >= 2) && d < 7.5) { const t = shielded || near; if (fire(i, t.x, t.y)) return; }
        if ((i = rdy('control')) >= 0 && (healer || ENEMIES[near.type].elite || near8.length >= 2) && d < 8.5) { const t = healer || near; if (fire(i, t.x, t.y)) return; }
        if ((i = rdy('reposition')) >= 0 && (tele || g.zones.some(z => !z.env && z.dps > 0 && z.t < z.windup + .2 && dist(z.x, z.y, g.px, g.py) < z.r + 1)) ) { const a = Math.atan2(g.py - near.y, g.px - near.x); if (fire(i, g.px + Math.cos(a) * 4, g.py + Math.sin(a) * 4)) return; }
        if ((i = rdy('revive')) >= 0 && (g.hp < g.maxHp * .6 || near8.filter(e => dist(e.x, e.y, g.px, g.py) < 3).length >= 2) && d < 3.2) { if (fire(i, g.px, g.py)) return; }
        if ((i = rdy('reposition')) >= 0 && d > 2.2 && d < 6 && !tele && has('sweep') < 0 && has('bladeburst') < 0) { const a = Math.atan2(near.y - g.py, near.x - g.px); if (fire(i, near.x + Math.cos(a) * 1.2, near.y + Math.sin(a) * 1.2)) return; }
        if ((i = rdy('brace')) >= 0 && (tele || g.hp < g.maxHp * .6) && d < 3.5) { if (fire(i, g.px, g.py)) return; }
        if ((i = rdy('sweep')) >= 0 && d < 3.4) { if (fire(i, near.x, near.y)) return; }
        if ((i = rdy('bladeburst')) >= 0 && d < 5.5) { if (fire(i, near.x, near.y)) return; }
        if ((i = rdy('forcedcool')) >= 0 && g.heat > (SPAM ? 101 : 55)) { if (fire(i, g.px, g.py)) return; }
        // data-driven augment abilities (src/abilities): defence/self when hurt or crowded, everything else at the target when in range
        for (let k = 0; k < AB.length; k++) { const def = Cfg.ABILITIES[AB[k]]; if (!def || !def.ext || g.abCd[k] > 0 || (!SPAM && g.heat + def.heat > BUD)) continue; const self = def.aim === 'self' || def.aim === 'toggle'; if (def.type === 'defense' && !(g.hp < g.maxHp * .7 || near8.length >= 2)) continue; if (self ? d > 6 : d > Math.min(def.range + 1, 9)) continue; if (fire(k, near.x, near.y)) return; }
      }
    };
    const ranged = () => g.build.weapon.range;
    const fight = () => {
      const alive = g.enemies.filter(e => !e.dead && e.faction === 'enemy' && e._rt.reveal <= 0 && !e.pylonLocked && dist(e.x, e.y, g.px, g.py) < (e.alert ? 10 : 6) && g.los(g.px, g.py, e.x, e.y));
      if (!alive.length) return false;
      // priority targets: pylons / boss adds that gate the boss, then support roles, then nearest
      const pri = e => (e.pylon ? 0 : /healer|mender|warder|summoner|matron/.test(e.type) ? 1 : e.bossAdd ? 2 : 3);
      alive.sort((a, b) => pri(a) - pri(b) || dist(a.x, a.y, g.px, g.py) - dist(b.x, b.y, g.px, g.py));
      if (TANK) { const b = alive.find(e => ENEMIES[e.type].boss); if (b) alive.unshift(b); }
      const t = alive[0]; g.target = t.id;
      const d = dist(t.x, t.y, g.px, g.py), rr = ENEMIES[t.type].radius || .5, w = g.build.weapon; const abR = g.build.abilities.includes('sweep') ? 2.8 : g.build.abilities.includes('bladeburst') ? 4.2 : 99; const want = TANK ? .9 + rr : Math.min(Math.max(.8, Math.min(w.range * .8, 5)), abR) + rr; /* ability-centric play: close to ability range */
      if (d > want) { (d < 3 ? mv(t.x - g.px, t.y - g.py) : nav(t.x, t.y)); } else if (!TANK && d < 1.0 && w.range > 2.5) mv(g.px - t.x, g.py - t.y); else g.setMove(0, 0);
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
      return { id: job.id, kit: job.kit, level: job.level, seed: job.seed, par: job.par, n, t: +t.toFixed(1), downed: g.downed, kitInfo: R.kitInfo, src: R.src, maxHit: R.maxHit, maxHitSrc: R.maxHitSrc, mobTtk: R.mobTtk, abil: R.abil, dealt: { ...g.dealt }, refills: R.refills || 0, mobHp: ENEMIES[job.id].hp };
    }


    if (job.mode === 'heat') {
      // heat bench: stand in front of an unkillable dummy (god mode) for job.secs seconds, bot spams everything it can; measures casts/min, overheat count and lockout share
      if (!g.startRun('annex')) return { error: 'startRun annex failed' };
      for (let i = 0; i < 20; i++) stepSim(); L = g.level; g.enemies.forEach(e => { e.dead = true; }); g.enemies = []; g.inst.carried.stims = 0; g.revealing = false; g.dbg.god = true;
      const e0 = g.spawnEnemy(job.dummy || 'slaghauler', g.px + 1.5, g.py); e0.alert = true; e0.hp = e0.maxHp = 1e8; R.kitInfo = kitInfo();
      Object.assign(H, { over: 0, overT: 0, heatSum: 0, n: 0, casts: 0, was: g.overheated }); for (const k of Object.keys(R.abil)) delete R.abil[k]; for (const k of Object.keys(g.dealt)) delete g.dealt[k]; let t = 0; let castsIn = 0;
      const secs = job.secs || 120; while (t < secs) { g.hp = g.maxHp; if (e0.dead) break; trackAlert(); g.setMove(0, 0); const alive = [e0]; g.target = e0.id; if (!g.aim && !g.cast && !g.overheated && !g.downed) { for (let k = 0; k < g.build.abilities.length; k++) { const def = Cfg.ABILITIES[g.build.abilities[k]]; if (!def || def.id === 'defib' || g.abCd[k] > 0 || (!SPAM && g.heat + def.heat > 96)) continue; try { g.beginAim(k); if (g.aim) { g.updateAim(e0.x, e0.y, true); g.releaseAim(); } } catch (e) {} break; } } if (VENTER && g.ventNow && g.ventCd <= 0 && (g.overheated || (job.profile !== 'sloppy' && g.heat >= 90))) g.ventNow(); stepSim(); t += dt; e0.x = g.px + 1.5; e0.y = g.py; e0.hp = e0.maxHp; }
      const dmg = { ...g.dealt }; const tot = Object.values(dmg).reduce((a, b) => a + b, 0), auto = dmg.auto || 0;
      return { id: job.id, kit: job.kit, profile: job.profile, level: job.level, seed: job.seed, secs, kitInfo: R.kitInfo, heat: { overheats: H.over, overheatT: +H.overT.toFixed(1), overheatShare: +(H.overT / secs).toFixed(3), avgHeat: +(H.heatSum / Math.max(1, H.n)).toFixed(1), casts: H.casts, castsPerMin: +(H.casts * 60 / secs).toFixed(1), cooling: +g.build.stats.cooling.toFixed(2), abShare: tot ? +((tot - auto) / tot).toFixed(3) : 0, dps: +(tot / secs).toFixed(1) }, abil: { ...R.abil } };
    }

    // ---- full level run ----
    if (!g.startRun(job.id)) return { error: 'startRun failed: ' + job.id };
    g.recompute(); g.hp = g.maxHp; L = g.level; result.kitInfo = kitInfo();
    if (job.bossOnly) { /* skip the dungeon: stand at the boss door with the gates open and a few stims, fight starts at the reveal */ for (let i = 0; i < 20; i++) stepSim(); const f0 = g.inst.flags; f0.gate1 = f0.lock2 = f0.controller = true; g.inst.carried.stims = job.stims ?? 3; { const rp = g.revealPoint(); g.px = rp.x; g.py = rp.y; } g.hp = g.maxHp; } const nEnemies = g.enemies.length; let bossSeen = 0, stuckT = 0, lastPos = [g.px, g.py], lastCheck = 0, deathsHere = 0;
    const dd = g.dd; let phaseLog = {}; let reachCache = { key: '', t: -9, ok: true };
    while (simT < maxT && !g.inst.flags.bossDead) {
      if (g.downed) { R.deaths++; deathsHere++; if (R.deaths >= maxDeaths) break; g.returnToCheckpoint(); if (job.bossOnly) { g.inst.carried.stims = Math.max(g.inst.carried.stims, job.stims ?? 3); { const rp = g.revealPoint(); g.px = rp.x; g.py = rp.y; } } flowKey = ''; stuckT = 0; continue; }
      if (g.channel) g.channel = null;
      trackAlert();
      const f = g.inst.flags; const boss = g.enemies.find(e => !e.dead && ENEMIES[e.type].boss && e._rt.reveal <= 0);
      if (boss && !bossSeen) bossSeen = simT;
      if (g.revealing) { g.setMove(0, 0); stepSim(); continue; }
      const act = heroLogic(); if (job.debug && Math.floor(simT * 30) % (job.traceEvery || 150) === 0) (R.trace ||= []).push([+simT.toFixed(1), +g.px.toFixed(1), +g.py.toFixed(1), act || '-', g.target, g.inputMove.x, g.inputMove.y]);
      if (!act) {
        const fought = fight();
        if (!fought) {
          g.target = null; let tx, ty;
          const guards = !f.gate1 ? g.enemies.filter(e => !e.dead && e.type === dd.gateGuard) : [];
          const elites = (f.gate1 && !f.lock2 && !f.controller) ? g.enemies.filter(e => !e.dead && e.type === dd.lockElite) : [];
          if (guards.length) { guards.sort((a, b) => dist(a.x, a.y, g.px, g.py) - dist(b.x, b.y, g.px, g.py)); tx = guards[0].x; ty = guards[0].y; if (dist(tx, ty, g.px, g.py) < 9 && !guards[0].alert) { /* approach to aggro */ } }
          else if (elites.length) { elites.sort((a, b) => dist(a.x, a.y, g.px, g.py) - dist(b.x, b.y, g.px, g.py)); tx = elites[0].x; ty = elites[0].y; }
          else if (f.controller && !f.bossSpawned) { { const rp = g.revealPoint(); tx = rp.x; ty = rp.y; } }
          else { const o = g.objective(); if (o) { tx = o.x; ty = o.y; if (o.kind === 'controller' && dist(g.px, g.py, tx, ty) < 1.6 && g.prompt) { g.interact(); stepSim(); continue; } } }
          if (tx !== undefined && (guards.length || elites.length)) { const reach = (x, y) => { const f2 = bfs(x, y); return f2[(g.py | 0) * L.w + (g.px | 0)] >= 0; }; const key = 'r' + (tx | 0) + ',' + (ty | 0); if (reachCache.key !== key || simT - reachCache.t > 5) reachCache = { key, t: simT, ok: reach(tx, ty) }; if (!reachCache.ok) { const door = L.doors.find(d => d.id === (guards.length ? 'gate1' : 'lock2')); if (door && door.tiles.length) { tx = door.tiles.reduce((a, t) => a + t[0], 0) / door.tiles.length + .5; ty = door.tiles.reduce((a, t) => a + t[1], 0) / door.tiles.length + .5; } } }
          if (tx !== undefined) { if (dist(g.px, g.py, tx, ty) > 1.2) nav(tx, ty); else g.setMove(0, 0); }
          // walk toward far enemies that are holding the path (aggro by proximity) is implicit; attack when in range handled by autoAttack
        }
      }
      // stuck detection
      if (simT - lastCheck > 6) { lastCheck = simT; if (dist(g.px, g.py, lastPos[0], lastPos[1]) < 1.0 && !g.revealing && !g.enemies.some(e => !e.dead && e.faction === 'enemy' && e.alert && e._rt.reveal <= 0 && dist(e.x, e.y, g.px, g.py) < 9)) { stuckT++; flowKey = ''; if (stuckT > 4) { /* teleport nudge */ const o = g.objective(); if (o && stuckT > 8) { R.stuck = (R.stuck || 0) + 1; R.stuckAt = { pos: [+g.px.toFixed(1), +g.py.toFixed(1)], obj: o, flags: { ...f }, near: g.enemies.filter(e => !e.dead && dist(e.x, e.y, g.px, g.py) < 14).map(e => [e.type, e.alert, +dist(e.x, e.y, g.px, g.py).toFixed(1), +e.x.toFixed(1), +e.y.toFixed(1), g.los(g.px, g.py, e.x, e.y)]).slice(0, 8), guards: g.enemies.filter(e => e.type === dd.gateGuard).map(e => [e.dead, +e.x.toFixed(1), +e.y.toFixed(1)]), doors: L.doors.map(d => d.id) }; break; } } } else stuckT = 0; lastPos = [g.px, g.py]; }
      stepSim();
    }
    const cleared = !!g.inst.flags.bossDead; const bossDef = ENEMIES[dd.defaultBoss];
    const bossRun = g.enemies.find(e => ENEMIES[e.type].boss);
    return { ...result, fleeBy: R.fleeBy, cleared, deaths: R.deaths, t: +simT.toFixed(1), bossReached: bossSeen ? +bossSeen.toFixed(1) : null, bossTtk: R.bossTtk, bossFightT: bossSeen && cleared ? +(simT - bossSeen).toFixed(1) : null, bossHpLeft: bossRun && !cleared ? +(bossRun.hp / bossRun.maxHp).toFixed(2) : 0, boss: bossRun?.type || dd.defaultBoss, heat: { overheats: H.over, overheatT: +H.overT.toFixed(1), avgHeat: +(H.heatSum / Math.max(1, H.n)).toFixed(1), casts: H.casts, mult: g.build.stats.cooling }, src: R.src, abil: R.abil, dealt: { ...g.dealt }, mobTtk: R.mobTtk, maxHit: +R.maxHit.toFixed(1), maxHitSrc: R.maxHitSrc, dodges: R.dodges, stims: R.stims, stuck: R.stuck || 0, nEnemies, kills: g.kills, tier: dd.tier || 0, maxHp: Math.round(g.maxHp), stuckAt: R.stuckAt, trace: R.trace, failWhy: cleared ? '' : (R.stuck ? 'stuck' : R.deaths >= maxDeaths ? 'deaths' : 'timeout') };
  } finally { Math.random = realRandom; }
}
