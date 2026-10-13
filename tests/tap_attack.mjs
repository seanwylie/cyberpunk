// Touch aim (Sean's phone video: every sweep cone went up-left whatever he pointed at). On a touch phone, dragging from an ability button out
// onto the floor must aim at the floor point under the finger (the button sits bottom-right, so the old button-relative vector always read up-left),
// and a tap on empty floor followed by a plain tap on the button casts toward the tapped point - both with no enemies and with a far off-screen enemy.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 844, height: 390 }, touch: true, dpr: 3, query: '?splash=hold' });
const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
await ev(() => { const g = window.__game; g.save.level = 20; g.recompute(); g.startRun('annex'); }); await sleep(2500);
await ev(() => { const g = window.__game; g.grace = null; window.__casts = []; const o = g.executeAbility.bind(g); g.executeAbility = c => { window.__casts.push({ dx: c.aim.wx - g.px, dy: c.aim.wy - g.py }); return o(c); }; });
const cdp = await page.context().newCDPSession(page);
const T = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const dirs = [['right', 150, 0], ['left', -150, 0], ['up', 0, -110], ['down', 0, 110]];
const match = (v, dx, dy) => { const L = Math.hypot(v.sx, v.sy), M = Math.hypot(dx, dy); return L > 0 && (v.sx * dx + v.sy * dy) / (L * M) > 0.8; };
for (const far of [false, true]) {
  const tag = far ? 'far enemy' : 'no enemy';
  for (const [label, dx, dy] of dirs) {
    for (const mode of ['drag', 'tap']) {
      await ev((far) => { const g = window.__game; g.enemies.forEach(e => e.dead = true); g.enemies = []; g.target = null; g.abCd = g.abCd.map(() => 0); g.heat = 0; g.cast = null; g.tapAimT = -1e9;
        if (far) { const e = g.spawnEnemy('worker', g.px - 8, g.py + 0.5); if (e) { e.alerted = true; e.frozen = 99; } } window.__casts = []; }, far);
      const p = await ev(() => { const g = window.__game, R = window.__rend; return { x: R.sx(g.px, g.py), y: R.sy(g.px, g.py) }; });
      const b = await page.locator('.abtn[data-idx="0"]').boundingBox(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const tx = p.x + dx, ty = p.y + dy;
      if (mode === 'drag') { await T('touchStart', cx, cy); for (let k = 1; k <= 6; k++) { await T('touchMove', cx + (tx - cx) * k / 6, cy + (ty - cy) * k / 6); await sleep(30); } await T('touchEnd'); }
      else { await T('touchStart', tx, ty); await sleep(60); await T('touchEnd'); await sleep(120); await T('touchStart', cx, cy); await sleep(60); await T('touchEnd'); }
      await sleep(700); const c = await ev(() => window.__casts.pop()); const v = c ? { sx: c.dx - c.dy, sy: (c.dx + c.dy) / 2 } : null;
      ok(!!v && match(v, dx, dy), `${tag}, ${mode} ${label}: cast goes ${label} ${v ? JSON.stringify({ sx: +v.sx.toFixed(2), sy: +v.sy.toFixed(2) }) : 'no cast'}`);
    }
  }
}
ok(errors.length === 0, `no page errors ${errors[0] || ''}`); await browser.close();
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
