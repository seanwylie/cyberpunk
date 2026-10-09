// End-to-end: press each ability button (mouse, hotkey, touch drag-aim) and assert the SIM applies the effect.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// kit -> [ability ids on Q,E,R]
const KITS = { A: ['sweep', 'brace', 'forcedcool'], B: ['bladeburst', 'cloak', 'reposition'], C: ['control', 'pulse'] };
const LOAD = { control: ['control', 'pulse', 'brace'], pulse: ['control', 'pulse', 'brace'] };
for (const [name, o] of [['desktop', {}], ['touch', { viewport: { width: 844, height: 390 }, touch: true, dpr: 2, query: '?touch=1' }]]) {
  const { browser, page, errors } = await launch(o); const ev = (f, a) => page.evaluate(f, a);
  const cdp = o.touch ? await page.context().newCDPSession(page) : null; let tid = 1;
  const setup = async (kit) => { await ev(k => { const g = window.__game; if (g.mode === 'run') g.enterTown(true); window.__ui.kit(k, true); g.recompute(); g.startRun(); const sp = g.level.spawn; g.px = sp.x; g.py = sp.y; g.dbg.god = true; if(!window.__toasts){ window.__toasts=[]; const em=g.emit.bind(g); g.emit=(k,v)=>{ if(k==='toast') window.__toasts.push(v); return em(k,v); }; } window.__toasts.length=0; g.revealing = false; g.heat = 0; g.abCd = [0, 0, 0]; g.overheated = false; g.cast = null; g.aim = null; g.weaponOff = 999; g.enemies.forEach(e => { e.dead = true; }); }, kit); await sleep(300); };
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
    if (id !== 'brace' && id !== 'cloak' || true) ok(r.heat > 0 || id === 'forcedcool' || id === 'brace' && false, `${name}/${id}: heat spent (${r.heat.toFixed(0)})`);
  }
  // hotkey path (desktop only): Q with aim from mouse
  if (!o.touch) { await setup('A'); await ev(() => { window.__game.recompute(); }); const ids = await spawn(); await page.keyboard.down('e'); await sleep(60); await page.keyboard.up('e'); await sleep(700); ok(await ev(() => window.__game.braceT > 0), 'desktop: hotkey E (brace, self-cast) applies'); }
  // fresh starter character (stock hardware, no kit): must have abilities, and a plain tap/click (no drag) must cast
  { const f = await launch(o); const fe = (fn, a) => f.page.evaluate(fn, a); await fe(() => { localStorage.clear(); }); await f.page.reload(); await f.page.waitForFunction(() => window.__game); await sleep(500);
    await fe(() => { const g = window.__game; g.startRun(); g.dbg.god = true; g.revealing = false; g.weaponOff = 999; g.enemies.forEach(e => { e.dead = true; }); }); await sleep(300);
    const ab = await fe(() => window.__game.build.abilities); ok(ab.length === 3, name + ': starter character has 3 abilities by default: ' + ab.join(','));
    for (let i = 0; i < 3; i++) { await fe(() => { const g = window.__game; g.revealing = false; g.heat = 0; g.abCd = [0, 0, 0]; g.cast = null; });
      const [cx, cy] = await fe(i => { const r = document.querySelectorAll('.abtn')[i].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, i);
      if (o.touch) { const c2 = await f.page.context().newCDPSession(f.page); await c2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 9 }] }); await sleep(80); await c2.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); } else { await f.page.mouse.move(cx, cy); await f.page.mouse.down(); await sleep(80); await f.page.mouse.up(); }
      await sleep(700); const r = await fe(i => ({ cd: window.__game.abCd[i], heat: window.__game.heat, brace: window.__game.braceT }), i); ok(r.cd > 0, `${name}: plain tap on ${ab[i]} casts (cd ${r.cd.toFixed(1)})`); }
    await f.browser.close(); }
  ok(errors.length === 0, name + ': no console errors ' + errors.join(';')); await browser.close();
}
if (fails) { console.log(fails + ' FAILED'); process.exit(1); } console.log('ability e2e ok');
