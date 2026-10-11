// Ring / circle geometry audit: every drawn ring and zone circle must be centred on its sim position and be the iso projection of a circle with the sim radius.
// ring() logs {x,y,r, drawn cx,cy,rx,ry}; poly() polygons for zones are inverse-projected back to world space and compared with the zone.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const R = await page.evaluate(async () => {
  const g = window.__game, rd = window.__rend; const Cfg = await import('/src/config.ts'); const out = { rings: [], zones: [], named: {} };
  g.enterTown(); g.save.cleared = {}; g.save.settings.devFreeReset = true; g.save.lockouts = {}; g.save.instance = null; g.inst = null; g.save.settings.reducedFx = false; g.startRun('annex'); for (let i = 0; i < 5; i++) g.update(1 / 30); g.dbg.god = true;
  const e = g.spawnEnemy('worker', g.px + 3, g.py + 1); e.alert = true; g.target = e.id; g.braceT = 3; g.cloakT = 2;
  for (const z of [{ x: g.px + 2, y: g.py - 2, r: 2.1, t: 0, life: 6, dps: 6, heat: 0, windup: 1.5 }, { x: g.px - 4, y: g.py + 3, r: 3.3, t: 1.6, life: 6, dps: 6, heat: 0, windup: 1.5 }]) g.zones.push(z);
  for (const kind of ['sweep', 'pulse']) { /* aim previews */ }
  for (const TW of [64, 90]) { rd.baseTW = TW; rd.ringLog = []; const polys = []; const op = rd.poly.bind(rd); rd.poly = (pts, ...a) => { polys.push(pts.map(p => p.slice())); return op(pts, ...a); };
    for (let i = 0; i < 60; i++) rd.draw(0.05); rd.ringLog = []; polys.length = 0; rd.draw(0.016); rd.poly = op; const log = rd.ringLog; rd.ringLog = null;
    for (const r of log) { // a point on the drawn ellipse maps back to world distance r from the centre
      let worst = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const w = rd.screenToWorld(r.cx + Math.cos(a) * r.rx, r.cy + Math.sin(a) * r.ry); worst = Math.max(worst, Math.abs(Math.hypot(w.x - r.x, w.y - r.y) - r.r)); }
      const c = rd.screenToWorld(r.cx, r.cy); out.rings.push({ TW, x: r.x, y: r.y, r: r.r, cen: Math.hypot(c.x - r.x, c.y - r.y), rad: worst, aspect: r.rx / r.ry }); }
    // player rings (brace/cloak/etc) must be centred on the player; target ring on the target; zones match their sim circle
    out.named['player' + TW] = log.filter(r => Math.hypot(r.x - g.px, r.y - g.py) < 1e-6).length; out.named['target' + TW] = log.filter(r => Math.hypot(r.x - e.x, r.y - e.y) < 1e-6 && Math.abs(r.r - (Cfg.ENEMIES[e.type].radius + .35)) < 1e-6).length;
    for (const z of g.zones) { let found = false; for (const pts of polys) { if (pts.length < 8) continue; const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length; if (Math.hypot(cx - z.x, cy - z.y) < .02) { const rr = pts.map(p => Math.hypot(p[0] - z.x, p[1] - z.y)); if (rr.every(v => Math.abs(v - z.r) < .02 || Math.abs(v - z.r * Math.max(0, Math.min(1, z.t / z.windup))) < .02)) found = true; } } out.zones.push({ TW, found, r: z.r }); }
  }
  rd.baseTW = 64; return out; });
ok(R.rings.length >= 6, `${R.rings.length} rings audited at 2 zoom levels`);
ok(R.rings.every(r => r.cen < 1e-6), 'every ring is centred on its world position (max error ' + Math.max(...R.rings.map(r => r.cen)).toExponential(1) + ' tiles)');
ok(R.rings.every(r => r.rad < 1e-6), 'every ring is the iso projection of a circle with its sim radius (max radius error ' + Math.max(...R.rings.map(r => r.rad)).toExponential(1) + ' tiles)');
ok(R.rings.every(r => Math.abs(r.aspect - 2) < 1e-9), 'ring aspect is exactly 2:1 (iso)');
ok(R.named.player64 >= 2 && R.named.player90 >= 2, 'brace/cloak/player rings centred on the player');
ok(R.named.target64 >= 1 && R.named.target90 >= 1, 'target ring centred on target with radius = body radius + .35');
ok(R.zones.length >= 4 && R.zones.every(z => z.found), 'zone circles drawn at sim centre/radius: ' + R.zones.filter(z => z.found).length + '/' + R.zones.length);
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
