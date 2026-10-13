// Aim direction (Sean: "attacks go backwards from where your cursor is facing on mobile"): on a touch phone (landscape, DPR 3) and on desktop,
// an auto-attack at an enemy to the screen-right fires right, and an ability aimed right/up/left (touch drag on the button / mouse + key) casts that way.
// The waypoint arrow that orbits the player (it reads like an aim cursor) must be hidden while enemies are engaged.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
for (const mobile of [true, false]) {
  const tag = mobile ? 'touch' : 'desktop';
  const { browser, page, errors } = await launch(mobile ? { viewport: { width: 844, height: 390 }, touch: true, dpr: 3, query: '?splash=hold' } : { viewport: { width: 1280, height: 720 }, query: '?splash=hold' });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
  await ev(() => { const g = window.__game; g.save.level = 20; g.recompute(); g.startRun('annex'); }); await sleep(2500);
  await ev(() => { const g = window.__game; g.enemies.forEach(e => e.dead = true); g.enemies = []; g.grace = null; window.__casts = []; const o = g.executeAbility.bind(g); g.executeAbility = c => { window.__casts.push({ dx: c.aim.wx - g.px, dy: c.aim.wy - g.py }); return o(c); }; });
  // auto-attack: enemy 140 px to the screen-right
  const r = await ev(() => { const g = window.__game, R = window.__rend; const s = { x: R.sx(g.px, g.py), y: R.sy(g.px, g.py) }; const w = R.screenToWorld(s.x + 140, s.y); const e = g.spawnEnemy('worker', w.x, w.y); e.alert = true; e.hp = e.maxHp = 1e6; e.stunT = 99; g.projs = []; return true; });
  await sleep(1200);
  const a = await ev(() => { const g = window.__game; const p = g.projs.find(p => p.faction !== 'enemy'); return { proj: p ? (p.vx - p.vy) : null, face: Math.cos(g.face) - Math.sin(g.face), arrow: window.__rend.guideArrow }; });
  ok(a.proj !== null ? a.proj > 0 : a.face > 0, `${tag}: auto-attack at a screen-right enemy goes right (proj screen-x ${a.proj?.toFixed?.(1)}, facing ${a.face.toFixed(2)})`);
  ok(!a.arrow, `${tag}: waypoint arrow hidden while an enemy is engaged`);
  await ev(() => { const g = window.__game; g.enemies.forEach(e => e.dead = true); g.enemies = []; }); await sleep(300);
  ok(await ev(() => window.__rend.guideArrow), `${tag}: waypoint arrow shows again out of combat`);
  for (const [label, dx, dy, want] of [['right', 80, 0, v => v.sx > 1 && Math.abs(v.sy) < .5], ['up', 0, -80, v => v.sy < -.5 && Math.abs(v.sx) < .5], ['left', -80, 0, v => v.sx < -1 && Math.abs(v.sy) < .5]]) {
    await ev(() => { const g = window.__game; g.abCd = g.abCd.map(() => 0); g.heat = 0; g.cast = null; });
    if (mobile) { const b = await page.locator('.abtn[data-idx="0"]').boundingBox(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2; const cdp = await page.context().newCDPSession(page); const T = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] }); await T('touchStart', cx, cy); for (let k = 1; k <= 5; k++) { await T('touchMove', cx + dx * k / 5, cy + dy * k / 5); await sleep(30); } await T('touchEnd'); }
    else { const p = await ev(() => { const g = window.__game, R = window.__rend; return { x: R.sx(g.px, g.py), y: R.sy(g.px, g.py) }; }); await page.mouse.move(p.x + dx * 2, p.y + dy * 2); await page.keyboard.down('1'); await sleep(150); await page.keyboard.up('1'); }
    await sleep(900); const c = await ev(() => window.__casts.pop()); const v = c ? { sx: c.dx - c.dy, sy: (c.dx + c.dy) / 2 } : null;
    ok(!!v && want(v), `${tag}: ability aimed ${label} casts ${label} ${v ? JSON.stringify({ sx: +v.sx.toFixed(2), sy: +v.sy.toFixed(2) }) : 'no cast'}`);
  }
  ok(errors.length === 0, `${tag}: no page errors ${errors[0] || ''}`); await browser.close();
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
