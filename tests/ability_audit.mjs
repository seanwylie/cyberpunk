// Per-ability audit: casts EVERY ability (10 core + 68 augment) in a real run against dummies/mobs and records what actually changed in the sim (damage, statuses,
// shield, heal, deployables, taunt redirects, movement, heat/cooldown) plus the VFX it spawned. Fails on any ability with no measurable gameplay effect, no visible
// effect, or that is not viable (docs/ABILITIES_AUDIT.md). Also asserts the Decoy Projector behaviour. Run: URL=http://localhost:5173/ node tests/ability_audit.mjs
// AUDIT_OUT=path.json writes the raw table (tools/balance/audit_table.mjs turns it into docs/ABILITIES_AUDIT.md).
import fs from 'fs'; import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch(); const ev = (f, a) => page.evaluate(f, a);
const ids = await ev(async () => { const c = await import('/src/config.ts'); return Object.keys(c.ABILITIES); });
ok(ids.length >= 78, `${ids.length} abilities in the portfolio (10 core + 68 augment)`);
const rows = await ev(async (ids) => {
  const reg = await import('/src/abilities/registry.ts'); const eng = await import('/src/abilities/engine.ts'); const cfg = await import('/src/config.ts'); const V = window.__vfx;
  const g = window.__game; const out = [];
  const reset = () => { if (g.mode === 'run') g.enterTown(true); g.startRun('annex', 1001); g.revealing = false; g.dbg.god = true; g.dbg.noHitStop = true; g.save.settings.reducedFx = false; V.reduced = false; g.enemies.forEach(e => { e.dead = true; }); g.projs = []; g.zones = []; g.fx = []; g.vev.length = 0; V.reset(); };
  // baseline: how much damage one second of auto-attack does (the thing an ability has to beat per unit of time)
  const w = g.build.weapon; const autoDps = w.dmg * cfg.AB.autoDmgMul * w.rate * g.stat().dmg, autoHps = w.heat * cfg.AB.autoHeatMul * w.rate;
  for (const id of ids) {
    const ab = reg.ABILITY_BY_ID[id]; const def = cfg.ABILITIES[id]; const core = !ab; const shape = ab ? ab.shape : ({ direction: 'cone', ground: 'ground', target: 'lockon', self: 'self', ally: 'self' })[def.aim];
    const steps = ab ? ab.steps.map(s => s.p) : [id]; const hasDecoy = !!ab && ab.steps.some(s => s.p === 'summon' && s.kind === 'decoy');
    if (id === 'defib') { reset(); g.dbg.god = false; g.build.passives = ['defib']; g.defibCd = 0; g.hp = 5; g.playerDown(); g.build.passives = ['defib']; const wasDown = g.downed; g.defibInPlace(); const saved = wasDown && !g.downed && g.hp > 0; out.push({ id, core, passive: true, name: def.name, type: def.type, heat: 0, cd: 0, windup: 0, range: 0, castOk: true, fx: saved ? ['revive-in-place'] : [], vfx: { cast: 1, hit: 1, total: 1 }, entity: false, dmg: 0 }); g.dbg.god = true; continue; }
    reset(); const sp = g.level.spawn; g.px = sp.x; g.py = sp.y; g.face = 0;
    let ang = 0, best = -1; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; let n = 0; for (let d = 1; d <= 9; d += .5) { if (g.solidAt(g.px + Math.cos(a) * d, g.py + Math.sin(a) * d)) break; n = d; } if (n > best) { best = n; ang = a; } }
    const at = (d, side = 0) => ({ x: g.px + Math.cos(ang) * d - Math.sin(ang) * side, y: g.py + Math.sin(ang) * d + Math.cos(ang) * side });
    const mk = (d, side, type = 'worker') => { const p = at(d, side); const e = g.spawnEnemy(type, p.x, p.y); e.hp = e.maxHp = 5000; e.alert = false; e._rt.reveal = 0; e.stunT = 0; return e; };
    const near = shape === 'self'; const dT = shape === 'lockon' ? Math.min(3, Math.max(1.2, def.range * .7)) : near ? 1.4 : 3;
    const D = { tgt: mk(Math.min(dT, best - .5), 0), n2: mk(Math.min(near ? 1.8 : 3.6, best - .3), .9), n3: mk(Math.min(near ? 1.9 : 4.2, best - .3), -.9), far: mk(Math.min(6, best), .3) };
    for (const e of g.enemies) { e.aiOff = true; e._rt.spdMul = 0; }
    if (hasDecoy) for (const e of g.enemies) { e.aiOff = false; e.alert = true; e._rt.spdMul = 1; e.hp = e.maxHp = 5000; }
    g.build.abilities = [id, 'brace', 'sweep']; g.build.granted = [id, 'brace', 'sweep']; g.abCd = [0, 0, 0]; g.heat = 0; g.overheated = false; g.hp = g.maxHp * .5; g.cloakT = 0; g.abx = eng.newAbx();
    const role = ab?.role; const heatSet = (role === 'heat' || id === 'second_wind' || id === 'forcedcool') ? 80 : 0; g.heat = heatSet; if (id === 'second_wind' || id === 'forcedcool') g.abCd = [0, 30, 30];
    for (let i = 0; i < 10; i++) { g.atkCd = 99; g.update(.05); } g.heat = heatSet; g.hp = g.maxHp * .5; /* let the dummies settle so spawn separation is not counted as an effect */
    const hp0 = {}, pos0 = {}; for (const k in D) { hp0[k] = D[k].hp; pos0[k] = { x: D[k].x, y: D[k].y }; } const p0 = { x: g.px, y: g.py }; const php0 = g.hp; const spawned0 = V.stats.spawned[id] || 0;
    const tp = at(Math.min(dT, best - .5), 0); const gp = tp; /* ground casts land on the dummy group */
    const aimGround = shape === 'ground'; g.beginAim(0); g.updateAim(aimGround ? gp.x : tp.x, aimGround ? gp.y : tp.y, true); g.releaseAim(); const castOk = !!g.cast;
    const o = {}; const set = k => { o[k] = true; }; let heatPeak = 0, cdPeak = 0, depKinds = new Set(), tauntMax = 0, dmgTot = 0, maxAllies = 0, projPeak = 0, zonePeak = 0, shieldPeak = 0, healPeak = 0;
    const vevKinds = new Set(); let dropped = 0;
    for (let i = 0; i < 170; i++) {
      if (i === 12 && ab?.steps.some(s => s.p === 'trap')) { const tr = g.abx.deps.find(d => d.kind === 'trap'); if (tr) { D.tgt.x = tr.x; D.tgt.y = tr.y; } }
      g.atkCd = 99; g.update(.05); for (const ev of g.vev.splice(0)) { vevKinds.add(String(ev.k).split('.').pop()); V.event(ev); } V.update(.05); heatPeak = Math.max(heatPeak, g.heat); cdPeak = Math.max(cdPeak, g.abCd[0]);
      let taunt = 0; for (const e of g.enemies) { if (e.dead) continue; const s = g.abx.st.get(e.id); if (e.stunT > 0) set('stun'); if (e._rt.taunt) taunt++; if (e._rt.hack > 0) set('hacked'); if (e.faction === 'ally') { set('ally'); } if (s) { if (s.slow) set('slow'); if (s.root > 0) set('root'); if (s.marked > 0) set('mark'); if (s.exposed > 0) set('expose'); if (s.burn) set('burn'); if (s.tether) set('tether'); } }
      tauntMax = Math.max(tauntMax, taunt); const a = g.abx; if (a.shield > 0) { set('shield'); shieldPeak = Math.max(shieldPeak, a.shield); } if (a.mit.t > 0) set('mitigate'); if (a.reflect.t > 0) set('reflect'); if (a.dmg.t > 0 && a.dmg.m > 1) set('dmg-buff'); if (a.move.t > 0 && a.move.m > 1) set('speed-buff'); if (a.steal.t > 0) set('lifesteal'); if (a.ambush.t > 0 && a.ambush.m > 1) set('ambush');
      if (g.cloakT > 0) set('cloak'); if (g.hp > php0 + 1) { set('heal'); healPeak = Math.max(healPeak, g.hp - php0); } if (g.iframes > .1) set('invuln'); for (const d of a.deps) depKinds.add(d.kind); if (a.toggles.has(id)) set('toggle'); if (g.braceT > 0) set('brace'); if (g.overclockT > 0 || g.ovT > 0) set('overclock');
      projPeak = Math.max(projPeak, g.projs.length + a.projs.length); zonePeak = Math.max(zonePeak, g.zones.length); maxAllies = Math.max(maxAllies, g.enemies.filter(e => e.faction === 'ally' && !e.dead).length); if (a.delayed.length) set('delayed');
    }
    for (const k in D) { if (Math.hypot(D[k].x - pos0[k].x, D[k].y - pos0[k].y) > .6 && (core || /pull|push|knock/.test(steps.join()) || ['sweep', 'pulse', 'revive'].includes(id))) set('displaced'); dmgTot += Math.max(0, hp0[k] - (D[k].dead ? 0 : D[k].hp)); }
    if (Math.hypot(g.px - p0.x, g.py - p0.y) > 1.2) set('moved'); if (dmgTot > .5) set('damage'); if (Object.values(D).some(e => e.dead)) set('kill');
    if ((role === 'heat' || id === 'forcedcool') && g.heat < heatSet - 5 || id === 'second_wind' && g.heat < 40) set('vent'); if (g.abCd[1] < 20 && g.abCd[2] < 20 && (id === 'second_wind' || id === 'forcedcool' || steps.includes('cdr'))) set('cdr');
    for (const k of depKinds) set('deploy:' + k); if (tauntMax) set('taunt'); if (g.abx.toggles.has(id)) set('toggle'); if (g.save && g.abx.casts[id] === undefined && !core) { /* engine never ran */ }
    const spawned = (V.stats.spawned[id] || 0) - spawned0; const castFx = vevKinds.has('cast') || vevKinds.has('pulse') || vevKinds.has('buff') || vevKinds.has('hit') || spawned > 0;
    const entity = depKinds.size > 0 || maxAllies > 0 || projPeak > 0 || zonePeak > 0 || o.delayed || o.cloak || o.shield || o.mitigate || o.reflect || o['dmg-buff'] || o['speed-buff'] || o.ambush || o.brace; // a world-visible entity / ring drawn by abx_render or sim fx
    out.push({ id, core, name: def.name, type: def.type, rarity: def.rarity || 'core', heat: def.heat, cd: def.cd, windup: def.windup, range: def.range, shape, steps, castOk, cdMeasured: cdPeak, heatPeak, fx: Object.keys(o), dmg: Math.round(dmgTot), shieldPeak: Math.round(shieldPeak), heal: Math.round(healPeak), taunt: tauntMax, vfx: { events: [...vevKinds], total: spawned, cast: castFx ? 1 : 0, hit: vevKinds.has('hit') || spawned > 0 ? 1 : 0 }, entity, passive: false, autoDps, autoHps });
  }
  return out; }, ids);
// ---- assertions
const bad = []; const table = [];
for (const r of rows) {
  const why = [];
  if (!r.passive && !r.castOk) why.push('cast did not start');
  if (!r.fx.length) why.push('no measurable gameplay effect');
  if (!r.passive && r.vfx.total < 10) why.push('barely visible: ' + r.vfx.total + ' particles');
  if (!r.passive && !r.vfx.cast) why.push('no cast VFX');
  // viability: attack-role abilities must beat what the same time spent auto-attacking deals; everything else must be affordable and available
  let via = 100; const ah = r.autoDps / r.autoHps; // damage per heat of plain auto-attacks: a damage ability must clearly beat it
  if (!r.passive) { const ctl = r.fx.some(f => /taunt|deploy|stun|slow|root|expose|mark|displaced|ambush|dmg-buff|moved|speed-buff|cloak|hacked|ally|burn|toggle|lifesteal|vent|heal|shield|delayed/.test(f));
    if (r.dmg > 0 && r.heat > 0) { const ratio = (r.dmg / r.heat) / ah; via = Math.max(0, Math.min(100, Math.round(25 + 40 * Math.min(ratio, 1.9) + (ctl ? 12 : 0)))); } else if (r.type === 'attack' && !ctl) via = 20;
    if (r.heat > 40) via -= 10; if (r.cd > 25) via -= 10; if (r.windup > .8) via -= 10; if (r.cd > 0 && r.fx.length === 1 && r.fx[0] === 'toggle') via -= 0; }
  r.via = via; if (via < 40) why.push('not viable (score ' + via + ')');
  r.bad = why; table.push(r); ok(why.length === 0, `${r.id} [${r.type}] effects: ${r.fx.join(', ') || 'NONE'} | dmg ${r.dmg} | vfx ${r.vfx.total} | via ${via}${why.length ? ' <- ' + why.join('; ') : ''}`);
}
if (process.env.AUDIT_OUT) fs.writeFileSync(process.env.AUDIT_OUT, JSON.stringify(table, null, 1));
// ---- Decoy Projector behaviour
const dc = await ev(async () => {
  const reg = await import('/src/abilities/registry.ts'); const eng = await import('/src/abilities/engine.ts'); const cfg = await import('/src/config.ts'); const g = window.__game; const V = window.__vfx;
  if (g.mode === 'run') g.enterTown(true); g.startRun('annex', 1001); g.revealing = false; g.dbg.god = false; g.dbg.noHitStop = true; g.enemies.forEach(e => { e.dead = true; }); g.projs = []; g.zones = []; V.reset();
  const sp = g.level.spawn; g.px = sp.x; g.py = sp.y; let ang = 0, best = -1; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; let n = 0; for (let d = 1; d <= 9; d += .5) { if (g.solidAt(g.px + Math.cos(a) * d, g.py + Math.sin(a) * d)) break; n = d; } if (n > best) { best = n; ang = a; } }
  const at = (d, side = 0) => ({ x: g.px + Math.cos(ang) * d - Math.sin(ang) * side, y: g.py + Math.sin(ang) * d + Math.cos(ang) * side });
  g.build.abilities = ['decoy_projector', 'brace', 'sweep']; g.build.granted = [...g.build.abilities]; g.abCd = [0, 0, 0]; g.heat = 0; g.hp = g.maxHp; g.abx = eng.newAbx(); g.cloakT = 0;
  // 3 hostile workers + a boss-class dummy, all alerted and chasing; they start between 3.5 and 5 tiles from the decoy spot, player stands 4 tiles from them on the other side
  const spot = at(Math.min(5, best - .5)); const mkE = (type, x, y) => { const e = g.spawnEnemy(type, x, y); e.hp = e.maxHp = 3000; e.alert = true; e._rt.reveal = 0; e.stunT = 0; return e; };
  const E = [mkE('worker', spot.x + .8, spot.y + .9), mkE('worker', spot.x - .6, spot.y + 1.2), mkE('slaghauler', spot.x + 1.2, spot.y - .8)].filter(Boolean);
  g.beginAim(0); g.updateAim(spot.x, spot.y, true); g.releaseAim(); for (let i = 0; i < 8; i++) { g.update(.05); }
  const dep = g.abx.deps.find(d => d.kind === 'decoy'); const info = { spawned: !!dep, life0: dep?.life, r: dep?.r };
  let taunted = 0, closer = 0, hpLoss = 0; const hp0 = g.hp; const dist0 = E.map(e => Math.hypot(e.x - spot.x, e.y - spot.y)); let hitsOnDecoy = 0, sawExpiry = false; let aliveAt3 = 0;
  for (let i = 0; i < 60; i++) { g.update(.05); if (i === 40) { aliveAt3 = g.abx.deps.filter(d => d.kind === 'decoy').length; } for (const e of E) if (e._rt.taunt) taunted = Math.max(taunted, E.filter(x => x._rt.taunt).length); }
  hitsOnDecoy = dep?.hits || 0; hpLoss = hp0 - g.hp; const dist1 = E.map(e => Math.hypot(e.x - spot.x, e.y - spot.y)); closer = dist1.filter((d, i) => d < dist0[i] + .2).length;
  // after expiry the taunt ends and the end-burst should have hurt/stunned something
  for (let i = 0; i < 120; i++) g.update(.05); const gone = g.abx.deps.filter(d => d.kind === 'decoy').length === 0; const tauntAfter = E.filter(e => !e.dead && e._rt.taunt).length;
  const dmg = E.reduce((s, e) => s + (e.maxHp - e.hp), 0);
  const spawnedVfx = V.stats.spawned['decoy_projector'] || 0;
  // projectile absorption: an enemy shot flying at the player behind the decoy lands on the decoy instead
  g.abx = eng.newAbx(); g.abx.deps.push({ kind: 'decoy', x: g.px + 1.5, y: g.py, t: 0, life: 5, every: .5, acc: 0, r: 6, tick: [], ab: reg.ABILITY_BY_ID['decoy_projector'], ang: 0 }); g.projs.push({ x: g.px + 4, y: g.py, vx: -9, vy: 0, life: 2, r: .2, dmg: 30, faction: 'enemy' }); const php = g.hp; for (let i = 0; i < 20; i++) g.update(.05); const absorbed = g.hp === php && g.abx.deps[0] && g.abx.deps[0].life < 5;
  return { ...info, taunted, closer, aliveAt3, gone, tauntAfter, dmg, hitsOnDecoy, hpLoss, spawnedVfx, absorbed, n: E.length };
});
console.log(JSON.stringify(dc));
ok(dc.spawned && dc.r >= 5, 'Decoy Projector spawns a decoy deployable with a >=5 tile taunt radius');
ok(dc.taunted >= 2, `alerted enemies target the decoy instead of the player (${dc.taunted}/${dc.n} taunted)`);
ok(dc.closer >= 2, 'enemies actually close in on the decoy position'); ok(dc.hitsOnDecoy >= 1 || dc.hpLoss === 0, `enemy attacks land on the decoy (${dc.hitsOnDecoy} hits) and the player is spared (lost ${Math.round(dc.hpLoss)} HP)`);
ok(dc.absorbed, 'an enemy projectile aimed through the decoy is absorbed by it'); ok(dc.gone && dc.tauntAfter === 0, 'decoy expires and the taunt ends with it'); ok(dc.dmg > 0, `expiry burst damages the enemies around it (${Math.round(dc.dmg)} total)`);
ok(dc.spawnedVfx > 0, 'decoy VFX spawned');
ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''));
await browser.close(); console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
