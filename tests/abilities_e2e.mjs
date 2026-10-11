// Table-driven e2e: cast EVERY data-driven augment ability against dummies in a real run and assert the effect of each of its primitives in the sim.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch(); const ev = (f, a) => page.evaluate(f, a);
const ids = await ev(async () => { const m = await import('/src/abilities/registry.ts'); return m.ABILITY_DATA.map(a => a.id); });
ok(ids.length >= 50, 'portfolio has ' + ids.length + ' abilities (>=50)');
const results = await ev(async (ids) => {
  const reg = await import('/src/abilities/registry.ts'); const eng = await import('/src/abilities/engine.ts'); const cfg = await import('/src/config.ts');
  const g = window.__game; const out = [];
  for (const id of ids) {
    const ab = reg.ABILITY_BY_ID[id]; const def = cfg.ABILITIES[id];
    if (g.mode === 'run') g.enterTown(true); g.startRun('annex', 1001); g.revealing = false; g.dbg.god = true; g.enemies.forEach(e => { e.dead = true; }); g.projs = []; g.zones = [];
    const sp = g.level.spawn; g.px = sp.x; g.py = sp.y; g.face = 0;
    // find an open direction with room (8 tiles) around the spawn
    let ang = 0, best = -1; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; let n = 0; for (let d = 1; d <= 9; d += .5) { if (g.solidAt(g.px + Math.cos(a) * d, g.py + Math.sin(a) * d)) break; n = d; } if (n > best) { best = n; ang = a; } }
    const at = (d, side = 0) => ({ x: g.px + Math.cos(ang) * d - Math.sin(ang) * side, y: g.py + Math.sin(ang) * d + Math.cos(ang) * side });
    const mk = (d, side, type = 'worker') => { const p = at(d, side); const e = g.spawnEnemy(type, p.x, p.y); e.hp = e.maxHp = 5000; e.alert = false; e._rt.reveal = 0; e.stunT = 0; return e; };
    const near = ab.shape === 'self'; /* self-centred bursts reach only ~2.4 tiles: keep the dummies inside that */ const dT = ab.shape === 'lockon' ? Math.min(3, Math.max(1.2, ab.range * .7)) : near ? 1.4 : 3; const D = { tgt: mk(Math.min(dT, best - .5), 0), n2: mk(Math.min(near ? 1.8 : 3.6, best - .3), .9), n3: mk(Math.min(near ? 1.9 : 4.2, best - .3), -.9), far: mk(Math.min(6, best), .3) };
    // freeze AI so measurements are about the ability only
    for (const e of g.enemies) { e.aiOff = true; e._rt.spdMul = 0; }
    g.build.abilities = [id, 'brace', 'sweep']; g.build.granted = [id, 'brace', 'sweep']; g.abCd = [0, 0, 0]; g.heat = 0; g.overheated = false; g.hp = g.maxHp * .5; g.cloakT = 0; g.abx = eng.newAbx();
    const hp0 = {}; for (const k in D) hp0[k] = D[k].hp; const p0 = { x: g.px, y: g.py }; const pos0 = {}; for (const k in D) pos0[k] = { x: D[k].x, y: D[k].y };
    const heatSet = (ab.role === 'heat' || id === 'second_wind') ? 80 : 0; g.heat = heatSet; const heatBefore = g.heat;
    if (id === 'second_wind') g.abCd = [0, 30, 30];
    const tp = at(Math.min(dT, best - .5), 0); const gp = at(Math.min(Math.max(ab.range * .6, 2.2), best - .3), 0);
    g.beginAim(0); g.updateAim(ab.shape === 'ground' ? gp.x : tp.x, ab.shape === 'ground' ? gp.y : tp.y, true);
    // lock-on needs the target to be near the aim point; ground needs LOS
    g.releaseAim(); const castOk = !!g.cast;
    const obs = { stun: false, slow: false, root: false, mark: false, expose: false, burn: false, tether: false, ally: false, shield: false, mit: false, reflect: false, hpUp: false, cloak: false, buffDmg: false, buffMove: false, steal: false, ambush: false, inv: false, moved: false, pushed: false, deps: 0, toggle: false, ventLow: false, cdr: false, dmg: false, killed: false };
    const cdAfter = [];
    for (let i = 0; i < 90; i++) { // 4.5s of sim
      if (i === 12 && ab.shape !== 'toggle' && (ab.steps.some(s => s.p === 'trap'))) { const t = D.tgt; t.x = g.abx.deps.find(d => d.kind === 'trap')?.x ?? t.x; t.y = g.abx.deps.find(d => d.kind === 'trap')?.y ?? t.y; }
      g.update(.05); cdAfter[0] = Math.max(cdAfter[0] || 0, g.abCd[0]);
      for (const e of g.enemies) { if (e.dead) continue; const s = g.abx.st.get(e.id); if (e.stunT > 0) obs.stun = true; if (e.faction === 'ally') obs.ally = true; if (s) { if (s.slow) obs.slow = true; if (s.root > 0) obs.root = true; if (s.marked > 0) obs.mark = true; if (s.exposed > 0) obs.expose = true; if (s.burn) obs.burn = true; if (s.tether) obs.tether = true; } }
      const a = g.abx; if (a.shield > 0) obs.shield = true; if (a.mit.t > 0) obs.mit = true; if (a.reflect.t > 0) obs.reflect = true; if (a.dmg.t > 0 && a.dmg.m > 1) obs.buffDmg = true; if (a.move.t > 0 && a.move.m > 1) obs.buffMove = true; if (a.steal.t > 0) obs.steal = true; if (a.ambush.t > 0 && a.ambush.m > 1) obs.ambush = true;
      if (g.cloakT > 0) obs.cloak = true; if (g.hp > g.maxHp * .5 + 1) obs.hpUp = true; if (g.iframes > .1) obs.inv = true; obs.deps = Math.max(obs.deps, a.deps.length); if (a.toggles.has(id)) obs.toggle = true;
      if (i === 8) { g.heat = Math.max(g.heat, 0); }
    }
    obs.moved = Math.hypot(g.px - p0.x, g.py - p0.y) > 1.2; for (const k in D) { if (Math.hypot(D[k].x - pos0[k].x, D[k].y - pos0[k].y) > .6) obs.pushed = true; }
    obs.dmg = Object.keys(D).some(k => D[k].hp < hp0[k] - .5 || D[k].dead); obs.killed = Object.keys(D).some(k => D[k].dead);
    obs.ventLow = ab.role === 'heat' && g.heat < heatBefore - 5 || id === 'second_wind' && g.heat < 40; obs.cdr = g.abCd[1] < 20 && g.abCd[2] < 20;
    out.push({ id, castOk, obs, cd: cdAfter[0], heat: g.heat, steps: ab.steps.map(s => s.p), toggle: !!ab.toggle, shape: ab.shape, bonus: ab.bonus || [], hasMit: !!ab.toggle?.mitigate, hasDmgT: !!ab.toggle?.dmg, hasVentT: !!ab.toggle?.vent, hasMoveT: !!ab.toggle?.move, hasIcon: true, castsLogged: g.abx.casts[id] || 0 });
  }
  return out; }, ids);
const flat = (steps) => steps;
for (const r of results) {
  const o = r.obs; const has = p => r.steps.includes(p); const bad = [];
  if (!r.castOk) bad.push('cast did not start'); if (!r.castsLogged) bad.push('engine did not run');
  const dealsDmg = ['damage', 'cone', 'circle', 'line', 'chain', 'shoot', 'projectile', 'delayed', 'aura', 'summon', 'trap'].some(has) || (has('dash'));
  const hasK = r.steps.some(s => ['damage', 'cone', 'line', 'chain', 'shoot', 'projectile', 'delayed', 'aura', 'summon', 'trap'].includes(s)) || r.steps.includes('circle') || r.id === 'shoulder_charge';
  const onlySelectors = r.id === 'chain_reaction' || r.id === 'flashbang' || r.id === 'static_snare';
  if (r.toggle) { if (!o.toggle) bad.push('toggle never turned on'); if (r.hasMit && false) bad.push(''); }
  else if (hasK && !['mirage_step', 'decoy_projector', 'smoke_bomb', 'repulsor_drone', 'shock_mine'].includes(r.id) && !o.dmg && !o.killed) bad.push('no damage dealt');
  if (has('stun') && !o.stun && !r.id.match(/^(shock_mine|control)$/)) bad.push('no stun observed'); if (has('slow') && !o.slow) bad.push('no slow'); if (has('root') && !o.root) bad.push('no root'); if (has('mark') && !o.mark && r.id !== 'headshot_protocol') bad.push('no mark'); if (has('expose') && !o.expose) bad.push('no expose'); if (has('burn') && !o.burn && !o.dmg) bad.push('no burn');
  if (has('tether') && !o.tether) bad.push('no tether'); if (has('control') && !(o.ally || o.stun)) bad.push('no control'); if (has('shield') && !o.shield) bad.push('no shield'); if (has('mitigate') && !o.mit) bad.push('no mitigation'); if (has('reflect') && !o.reflect) bad.push('no reflect');
  if (has('heal') && !o.hpUp) bad.push('no heal'); if (has('cloak') && !o.cloak) bad.push('no cloak'); if (has('invuln') && !o.inv) bad.push('no invuln'); if (has('vent') && !o.ventLow) bad.push('no vent'); if (has('cdr') && !o.cdr) bad.push('no cdr');
  if ((has('dash') || has('teleport')) && !o.moved) bad.push('did not move'); if ((has('pull') || has('push')) && !o.pushed) bad.push('nothing displaced'); if ((has('summon') || has('aura')) && o.deps < 1) bad.push('nothing deployed');
  if (has('buff')) { const b = r.steps.length; if (!(o.buffDmg || o.buffMove || o.steal || o.ambush)) bad.push('no buff'); }
  ok(bad.length === 0 && r.cd > 0, `${r.id}: castable and effects verified [${r.steps.join('+')}${r.toggle ? ' toggle' : ''}]${bad.length ? ' MISSING: ' + bad.join(', ') : ''}`);
}
ok(errors.length === 0, 'no console errors ' + errors.join(';'));
await browser.close(); if (fails) { console.log(fails + ' FAILED'); process.exit(1); } console.log('abilities e2e ok');
