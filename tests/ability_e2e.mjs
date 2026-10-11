// End-to-end: press each ability button (mouse, hotkey, touch drag-aim) and assert the SIM applies the effect.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// kit -> [ability ids on Q,E,R]
const KITS = { A: ['sweep', 'brace', 'forcedcool'], B: ['bladeburst', 'cloak', 'reposition'], C: ['control', 'pulse'] };
const LOAD = { control: ['control', 'pulse', 'brace'], pulse: ['control', 'pulse', 'brace'] };
for (const [name, o] of [['desktop', {}], ['touch', { viewport: { width: 844, height: 390 }, touch: true, dpr: 2, query: '?touch=1' }]]) {
  const { browser, page, errors } = await launch(o); const ev = (f, a) => page.evaluate(f, a);
  const cdp = o.touch ? await page.context().newCDPSession(page) : null; let tid = 1;
  const setup = async (kit) => { await ev(k => { const g = window.__game; if (g.mode === 'run') g.enterTown(true); window.__ui.kit(k, true); g.recompute(); g.startRun('annex', 1001); const sp = g.level.spawn; g.px = sp.x; g.py = sp.y; g.dbg.god = true; if(!window.__toasts){ window.__toasts=[]; const em=g.emit.bind(g); g.emit=(k,v)=>{ if(k==='toast') window.__toasts.push(v); return em(k,v); }; } window.__toasts.length=0; g.revealing = false; g.heat = 0; g.abCd = [0, 0, 0]; g.overheated = false; g.cast = null; g.aim = null; g.weaponOff = 999; g.enemies.forEach(e => { e.dead = true; }); }, kit); await sleep(300); };
  const center = (i) => ev(i => { const r = document.querySelectorAll('.abtn')[i].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, i);
  // clear a spot: put player in open space, spawn dummies around
  const spawn = () => ev(() => { const g = window.__game; g.revealing = false; const out = []; const mk = (dx, dy, type = 'worker') => { const e = g.spawnEnemy(type, g.px + dx, g.py + dy); e.hp = e.maxHp = 5000; e.alert = false; e.stunT = 0; e.speedMul = 0; e._rt.reveal = 0; e.home = { x: e.x, y: e.y }; return e.id; }; return { ahead: mk(1.5, 0), ahead2: mk(2.2, .3), far: mk(4, 0), tgt: mk(3, 0) }; });
  const press = async (i, how, dir) => { // how: 'pointer' | 'key'; dir: screen offset of aim from button/player
    const [cx, cy] = await center(i);
    if (how === 'key') { const k = ['q', 'e', 'r'][i]; await ev(([dx, dy]) => { const g = window.__game; const r = window.__renderer; }, [0, 0]); await page.keyboard.down(k); await sleep(60); await page.keyboard.up(k); return; }
    if (o.touch) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: tid }] }); await sleep(60); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + dir[0], y: cy + dir[1], id: tid }] }); await sleep(60); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); tid++; }
    else { await page.mouse.move(cx, cy); await page.mouse.down(); await sleep(60); await page.mouse.move(cx + dir[0], cy + dir[1]); await sleep(60); await page.mouse.up(); }
  };
  // world->screen of an entity for mouse aiming (desktop uses mouse world pos)
  const scr = (x, y) => ev(([x, y]) => { const p = window.__game; const r = window.__renderer; return r && r.worldToScreen ? r.worldToScreen(x, y) : null; }, [x, y]);
  for (const kit of Object.keys(KITS)) for (let i0 = 0; i0 < KITS[kit].length; i0++) {
    const id = KITS[kit][i0]; await setup(kit);
    // kit C's real build only yields control+revive/defib; bind control+pulse+brace explicitly (dev) so both are testable
    if (LOAD[id]) await ev(l => { window.__game.build.abilities = l; }, LOAD[id]); await sleep(150);
    const i = LOAD[id] ? LOAD[id].indexOf(id) : i0;
    const has = await ev(i => window.__game.build.abilities[i], i); ok(has === id, `${name}/${id}: equipped in slot ${i} (got ${has})`);
    const ids = await spawn(); if (id === 'forcedcool') await ev(() => { window.__game.heat = 60; });
    const s0 = await ev(ids => { const g = window.__game; const E = k => g.enemies.find(e => e.id === ids[k]); return { px: g.px, py: g.py, hp: Object.fromEntries(Object.keys(ids).map(k => [k, E(k).hp])) }; }, ids);
    // aim: drag to the screen direction of world +x (ahead). screen vec for world(+1,0) = (+1,+.5)*k
    const RNG = { sweep: 3.2, bladeburst: 5.5, reposition: 6.5, control: 9, pulse: 8 }; const L = Math.min(90, 90 * 3 / (RNG[id] || 6)); const dir = [L * 0.894, L * 0.447];
    await ev(() => { window.__game.face = 0; });
    let r; for (let attempt = 0; attempt < 3; attempt++) {
    // desktop mouse aiming uses mouse world position: move mouse over target enemy / ground ahead
    if (!o.touch) { const t = await ev(ids => { const g = window.__game; const r = window.__rend; const e = g.enemies.find(e => e.id === ids.tgt); return [r.w/2 - r.camx + (e.x-e.y)*r.TW/2, r.h/2 - r.camy + (e.x+e.y)*r.TW/4]; }, ids); if (t) { const [cx, cy] = await center(i); await page.mouse.move(cx, cy); await page.mouse.down(); await sleep(60); await page.mouse.move(t[0], t[1]); await sleep(60); await page.mouse.up(); } else { await press(i, 'pointer', dir); } }
    else await press(i, 'pointer', dir);
    await sleep(900);
    r = await ev(ids => { const g = window.__game; const E = k => g.enemies.find(e => e.id === ids[k]); return { px: g.px, py: g.py, heat: g.heat, cd: g.abCd[0], cds: [...g.abCd], cloak: g.cloakT, brace: g.braceT, hp: Object.fromEntries(Object.keys(ids).map(k => [k, E(k).hp])), stun: Object.fromEntries(Object.keys(ids).map(k => [k, E(k).stunT])), fac: Object.fromEntries(Object.keys(ids).map(k => [k, E(k).faction])), cast: !!g.cast, aim: !!g.aim, toast: (window.__toasts||[]).slice(-3).join('|') }; }, ids);
      if (r.cds[i] > 0) break; await ev(() => { window.__game.cast = null; window.__game.aim = null; window.__game.abCd = [0, 0, 0]; }); console.log('  (retry ' + (attempt + 1) + ' ' + name + '/' + id + ')');
    }
    const moved = Math.hypot(r.px - s0.px, r.py - s0.py); const hpLost = k => s0.hp[k] - r.hp[k];
    ok(r.cds[i] > 0 || id === 'forcedcool' && r.cds[i] > 0, `${name}/${id}: cooldown set (${r.cds[i].toFixed(1)})`);
    const eff = { sweep: () => hpLost('ahead') > 0, brace: () => r.brace > 0, forcedcool: () => r.heat < 40, cloak: () => r.cloak > 0, bladeburst: () => moved > 0.3 && hpLost('ahead') > 0, reposition: () => moved > 1.5, control: () => Object.values(r.fac).some(f => f === 'ally') || Object.values(r.stun).some(v => v > 0), pulse: () => Object.values(r.stun).some(v => v > 0) };
    ok(eff[id](), `${name}/${id}: effect applied (moved ${moved.toFixed(2)}, hp lost ahead ${hpLost('ahead')}, brace ${r.brace.toFixed(1)}, cloak ${r.cloak.toFixed(1)}, stun ${JSON.stringify(r.stun)}, fac tgt ${r.fac.tgt} toast ${r.toast}, heat ${r.heat.toFixed(0)})`);
    if (id !== 'brace' && id !== 'cloak' || true) ok(r.heat > 0 || ['forcedcool', 'brace', 'reposition'].includes(id), `${name}/${id}: heat spent (${r.heat.toFixed(0)})`);
  }
  // hotkey path (desktop only): Q with aim from mouse
  if (!o.touch) { await setup('A'); await ev(() => { window.__game.recompute(); }); const ids = await spawn(); await page.keyboard.down('e'); await sleep(60); await page.keyboard.up('e'); await sleep(700); ok(await ev(() => window.__game.braceT > 0), 'desktop: hotkey E (brace, self-cast) applies'); }
  // fresh starter character (stock hardware, no kit): must have abilities, and a plain tap/click (no drag) must cast
  { const f = await launch(o); const fe = (fn, a) => f.page.evaluate(fn, a); await fe(() => { localStorage.clear(); }); await f.page.reload(); await f.page.waitForFunction(() => window.__game); /* the splash overlay (z-index 90) swallows input for ~2.5s after load; wait for it to be gone like a player would */ await f.page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 15000 }); await sleep(500);
    await fe(() => { const g = window.__game; g.startRun('annex', 1001); g.dbg.god = true; g.revealing = false; g.weaponOff = 999; g.enemies.forEach(e => { e.dead = true; }); }); await sleep(300);
    const ab = await fe(() => window.__game.build.abilities); ok(ab.length === 3, name + ': starter character has 3 abilities by default: ' + ab.join(','));
    for (let i = 0; i < 3; i++) { await fe(() => { const g = window.__game; g.revealing = false; g.heat = 0; g.abCd = [0, 0, 0]; g.cast = null; });
      const [cx, cy] = await fe(i => { const r = document.querySelectorAll('.abtn')[i].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, i);
      if (o.touch) { const c2 = await f.page.context().newCDPSession(f.page); await c2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 9 }] }); await sleep(80); await c2.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); } else { await f.page.mouse.move(cx, cy); await f.page.mouse.down(); await sleep(80); await f.page.mouse.up(); }
      await sleep(700); const r = await fe(i => ({ cd: window.__game.abCd[i], heat: window.__game.heat, brace: window.__game.braceT }), i); ok(r.cd > 0, `${name}: plain tap on ${ab[i]} casts (cd ${r.cd.toFixed(1)})`); }
    await f.browser.close(); }
  ok(errors.length === 0, name + ': no console errors ' + errors.join(';')); await browser.close();
}

// ---- ability power pass: synergies and counters, asserted straight on the sim (docs/ABILITIES.md) ----
{
  const { browser, page, errors } = await launch({}); const ev = (f, a) => page.evaluate(f, a);
  await ev(async () => { const g = window.__game; window.__C = await import('/src/config.ts'); if (g.mode === 'run') g.enterTown(true); window.__ui.kit('A', true); g.recompute(); g.startRun('annex', 1001); g.revealing = false; g.dbg.god = false; g.dbg.noHitStop = true; });
  const world = () => ev(() => { const g = window.__game; g.revealing = false; g.enemies.forEach(e => { e.dead = true; }); g.enemies = []; g.inst.enemies = []; g.px = g.level.spawn.x; g.py = g.level.spawn.y; g.hp = g.maxHp; g.heat = 0; g.abCd = [0, 0, 0]; g.cast = null; g.aim = null; g.braceT = 0; g.cloakT = 0; g.ovT = 0; g.comboN = 0; g.comboT = 0; g.zones = []; g.projs = []; g.iframes = 0; g.stunT = 0; g.dealt = {};
    // the layouts vary per seed, so pick an open direction from the spawn and rotate every test offset into it
    let ang = 0; for (let k = 0; k < 16; k++) { const aa = k * Math.PI / 8; const ok2 = [1.5, 3, 5, 7].every(d => { const x = g.px + Math.cos(aa) * d, y = g.py + Math.sin(aa) * d; return !g.solidAt(x, y) && g.los(g.px, g.py, x, y); }); if (ok2) { ang = aa; break; } }
    window.__ang = ang; window.__rot = (dx, dy) => [dx * Math.cos(ang) - dy * Math.sin(ang), dx * Math.sin(ang) + dy * Math.cos(ang)]; g.face = ang;
    window.__mk = (dx, dy, t = 'worker', hp = 9000) => { [dx, dy] = window.__rot(dx, dy); const e = g.spawnEnemy(t, g.px + dx, g.py + dy); e.hp = e.maxHp = hp; e.alert = true; e.speedMul = 0; e._rt.reveal = 0; e.stunT = 0; return e; }; return true; });
  const cast = (ids, i, tgt) => ev(([ids, i, tgt]) => { const g = window.__game; g.build.abilities = ids; g.abCd = g.abCd.map((c, k) => k === i ? 0 : c); const t = tgt === 'self' ? { x: g.px, y: g.py } : tgt.rel ? (([rx, ry]) => ({ x: g.px + rx, y: g.py + ry }))(window.__rot(tgt.x, tgt.y)) : tgt; g.beginAim(i); g.updateAim(t.x, t.y, true); g.releaseAim(); g.cast && (g.cast.t = 99); g.update(.05); g.update(.05); return true; }, [ids, i, tgt]);
  const A = ['sweep', 'bladeburst', 'pulse'];
  // 1 sweep: hits the pack, staggers (stun), more damage than one auto-attack
  await world(); await ev(() => { window.__mk(1.5, 0); window.__mk(2, .8); window.__mk(2, -.8); }); await cast(A, 0, { x: 5, y: 0, rel: true }); await ev(() => {}); 
  let r = await ev(() => { const g = window.__game; return { stun: g.enemies.filter(e => e.stunT > 0).length, hit: g.enemies.filter(e => e.hp < 9000).length, d: g.dealt.sweep || 0, cd: g.abCd[0] }; });
  ok(r.hit >= 2 && r.stun >= 2, `sweep clears/staggers the pack (hit ${r.hit}, staggered ${r.stun})`); ok(r.cd <= 2.01 && r.cd > 1.2, `sweep cooldown is short (${r.cd.toFixed(2)}s)`);
  const autoDmg = await ev(() => { const g = window.__game; const w = g.build.weapon; return w.dmg * window.__C.AB.autoDmgMul * g.build.weaponMul * g.stat().dmg; }); ok(r.d / Math.max(1, r.hit) > autoDmg * 4, `sweep hit (${(r.d / r.hit).toFixed(0)}) >> one auto hit (${autoDmg.toFixed(1)})`);
  // 2 pulse breaks a shield outright and staggers
  await world(); await ev(() => { const e = window.__mk(2, 0, 'worker', 200); e._rt.shield = { hp: 60, max: 60, t: 99 }; }); await cast(['pulse', 'sweep', 'bladeburst'], 0, { x: 5, y: 0, rel: true });
  r = await ev(() => { const e = window.__game.enemies[0]; return { sh: !!(e._rt.shield && e._rt.shield.hp > 0), vuln: e._rt.vuln, stun: e.stunT }; }); ok(!r.sh && r.vuln > 0 && r.stun > 0, `pulse shield-break: shield gone, staggered (vuln ${r.vuln.toFixed(1)}s), stunned ${r.stun.toFixed(1)}s`);
  // autos bounce off shields
  await world(); const sh = await ev(() => { const g = window.__game; const e = window.__mk(2, 0, 'worker', 500); e._rt.shield = { hp: 100, max: 100, t: 99 }; g.curTag = 'auto'; g.hurtEnemy(e, 10, g.px, g.py); return e._rt.shield.hp; }); ok(sh > 90, `autos are weak against shields (shield ${sh.toFixed(1)}/100 after a 10-damage auto)`);
  // 3 control: turns a mob, mass-stuns and hacks neighbours (+40% damage)
  await world(); await ev(() => { window.__mk(3, 0, 'worker', 300); window.__mk(3.8, .6, 'worker', 300); window.__mk(3.5, -.7, 'worker', 300); }); await cast(['control', 'pulse', 'sweep'], 0, await ev(() => { const e = window.__game.enemies[0]; return { x: e.x, y: e.y }; }));
  r = await ev(() => { const g = window.__game; const t = g.enemies[0]; const o = g.enemies.slice(1); return { ally: t.faction === 'ally', stun: o.filter(e => e.stunT > 0).length, hack: o.filter(e => e._rt.hack > 0).length, ovl: g.dealt.control || 0 }; }); ok(r.ally && r.stun === 2 && r.hack === 2, `control: target turned, ${r.stun} neighbours mass-stunned and ${r.hack} hacked`); ok(r.ovl > 0, `control: overload damage to stunned (${r.ovl.toFixed(0)})`);
  const hk = await ev(() => { const g = window.__game; const e = g.enemies[1]; const h0 = e.hp; e._rt.hack = 5; g.curTag = 'auto'; g.hurtEnemy(e, 10, g.px, g.py); const d1 = h0 - e.hp; e._rt.hack = 0; const h1 = e.hp; g.hurtEnemy(e, 10, g.px, g.py); return [d1, h1 - e.hp]; }); ok(hk[0] > hk[1] * 1.3, `hacked enemies take bonus damage (${hk[0].toFixed(1)} vs ${hk[1].toFixed(1)})`);
  // 4 brace: -75% damage, reflect to attacker, counter-stun a charger
  await world(); const br = await ev(() => { const g = window.__game; const e = window.__mk(1.2, 0, 'worker', 5000); g.braceT = 3; g.dmgSrc = 'worker:swing'; const hp0 = g.hp, eh = e.hp; g.hurtPlayer(40, e.x, e.y); return { took: hp0 - g.hp, refl: eh - e.hp }; }); ok(br.took <= 40 * .26 + 1.5 && br.refl > 20, `brace: took ${br.took.toFixed(1)} of 40, reflected ${br.refl.toFixed(0)} to the attacker`);
  await world(); const ch = await ev(() => { const g = window.__game; const e = window.__mk(1.2, 0, 'scrapram', 5000); g.braceT = 3; g.dmgSrc = 'scrapram:charge'; g.hurtPlayer(30, e.x, e.y); return e.stunT; }); ok(ch > 1, `brace counter-stuns a charger (${ch.toFixed(1)}s)`);
  // 5 cloak: ambush auto x3, ambush ability x2.5, and the sim's cloak breaks
  await world(); const cl = await ev(() => { const g = window.__game; const e = window.__mk(1.5, 0, 'worker', 9000); g.build.abilities = ['cloak', 'sweep', 'bladeburst']; g.cloakT = 5; g.atkCd = 0; g.weaponOff = 0; g.target = e.id; const d0 = e.hp; g.autoAttack(.02); const d1 = d0 - e.hp; return { d1, broken: g.cloakT <= 0, tag: g.dealt.cloak || 0 }; }); ok(cl.broken && cl.d1 > 0 && cl.tag > 0, `cloak: ambush auto crit (${cl.d1.toFixed(1)}), cloak broken, damage credited to Cloak`);
  await world(); await ev(() => { window.__mk(1.5, 0); }); await ev(() => { window.__game.cloakT = 5; }); await cast(A, 0, { x: 5, y: 0, rel: true }); const cl2 = await ev(() => ({ cloak: window.__game.cloakT, d: window.__game.dealt.sweep })); ok(cl2.cloak <= 0 && cl2.d > 85 * 2, `cloak + ability: AMBUSH x2.5 sweep (${cl2.d.toFixed(0)} dmg), cloak consumed`);
  // 6 reposition: dash-strike damage + perfect evade into a telegraph
  await world(); await ev(() => { const g = window.__game; g.zones.push({ x: g.px + 1, y: g.py, r: 2.5, t: 0, life: 3, dps: 20, heat: 0, windup: 1 }); }); const pe = await ev(() => { const g = window.__game; g.build.abilities = ['reposition', 'sweep', 'brace']; g.heat = 30; g.abCd = [0, 0, 0]; for (let a = 0; a < 12; a++) { g.beginAim(0); g.updateAim(g.px + Math.cos(a * .52 + 3) * 4, g.py + Math.sin(a * .52 + 3) * 4, true); if (g.validateAim(window.__C.ABILITIES.reposition, g.aim).valid) break; } g.releaseAim(); g.cast && (g.cast.t = 99); g.update(.05); g.update(.05); return { cd: g.abCd[0], ov: g.ovT, heat: g.heat }; }); ok(pe.cd <= 1.5 && pe.ov > 0, `reposition into a telegraph = PERFECT EVADE (cooldown ${pe.cd.toFixed(2)}s, abilities +30% for ${pe.ov.toFixed(1)}s, heat ${pe.heat.toFixed(0)})`);
  // 7 forced cooling: vent, overclock, other cooldowns drop
  await world(); const fc = await ev(() => { const g = window.__game; g.build.abilities = ['forcedcool', 'sweep', 'brace']; g.heat = 90; g.abCd = [0, 5, 5]; g.beginAim(0); g.releaseAim(); g.cast && (g.cast.t = 99); g.update(.05); g.update(.05); return { heat: g.heat, ov: g.ovT, c1: g.abCd[1] }; }); ok(fc.heat < 30 && fc.ov > 0 && fc.c1 < 3.2, `forced cooling: vented to ${fc.heat.toFixed(0)}, overclock ${fc.ov.toFixed(1)}s, other cooldown 5 -> ${fc.c1.toFixed(1)}`);
  // 8 combo + charged + kill cooldown refund
  await world(); await ev(() => { window.__mk(1.5, 0); }); await cast(A, 0, { x: 5, y: 0, rel: true }); await cast(A, 1, await ev(() => { const e = window.__game.enemies[0]; return { x: e.x, y: e.y }; })); const co = await ev(() => ({ n: window.__game.comboN })); ok(co.n >= 1, `combo chain: second different ability within 3s stacks (x${co.n + 1})`);
  await world(); const kr = await ev(() => { const g = window.__game; const e = window.__mk(1.2, 0, 'worker', 5); g.abCd = [0, 6, 6]; g.curTag = 'sweep'; g.hurtEnemy(e, 50, g.px, g.py); g.curTag = 'auto'; return g.abCd[1]; }); ok(kr < 5.5, `ability kill refunds cooldowns (6 -> ${kr.toFixed(1)})`);
  // 9 revive (solo rally) heals and shocks
  await world(); const rv = await ev(() => { const g = window.__game; window.__mk(1.8, 0, 'worker', 9000); g.hp = g.maxHp * .4; g.build.abilities = ['revive', 'sweep', 'brace']; g.beginAim(0); g.releaseAim(); g.cast && (g.cast.t = 99); g.update(.05); g.update(.05); const e = g.enemies[0]; return { hp: g.hp / g.maxHp, stun: e.stunT, dmg: 9000 - e.hp }; }); ok(rv.hp >= .65 && rv.stun > 0 && rv.dmg > 0, `revive solo: rally heal to ${(rv.hp * 100).toFixed(0)}% HP + shockwave stun`);
  // 10 heat: autos build heat faster than cooling when spammed; abilities cost far less per damage than autos
  const ht = await ev(() => { const g = window.__game; const w = g.build.weapon; const C = window.__C; const autoDps = w.dmg * C.AB.autoDmgMul * w.rate * g.stat().dmg, autoHps = w.heat * C.AB.autoHeatMul * w.rate; const s = C.ABILITIES.sweep; return { dpsPerHeatAuto: autoDps / autoHps, dpsPerHeatSweep: C.AB.sweepDmg * g.stat().dmg / s.heat }; }); ok(ht.dpsPerHeatSweep > ht.dpsPerHeatAuto * 1.3, `damage per heat: sweep ${ht.dpsPerHeatSweep.toFixed(1)} vs auto ${ht.dpsPerHeatAuto.toFixed(1)}`);
  // 11 hints: a shield triggers "Shield: use Pulse" once; counter icons resolve
  await world(); const hint = await ev(() => { const g = window.__game; g.hintSeen = {}; const toasts = []; const em = g.emit.bind(g); g.emit = (k, v) => { if (k === 'toast') toasts.push(v); return em(k, v); }; const e = window.__mk(3, 0, 'worker', 100); e._rt.shield = { hp: 50, max: 50, t: 99 }; g.mode === 'run'; g.abilityHints(.1); g.abilityHints(.1); return toasts.filter(t => /Shield: use Pulse/.test(t)).length; }); ok(hint === 1, `first shield shows "Shield: use Pulse" exactly once (${hint})`);
  ok(errors.length === 0, 'power block: no console errors ' + errors.join(';')); await browser.close();
}
if (fails) { console.log(fails + ' FAILED'); process.exit(1); } console.log('ability e2e ok');
