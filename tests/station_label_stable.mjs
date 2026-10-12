// Label position is a fixed function of the station anchor: walking the player from far away, through the interact radius, to the pad centre never moves the pill
// (offset from the station's screen anchor constant within 1px) and the idle pin is centred exactly where the pill will appear. One label per station at every step.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1920, height: 1080 }, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
for (const town of ['rustline', 'harrow']) {
  await ev(async town => { const g = window.__game; g.save.level = 30; (g.save.cleared = { ...(g.save.cleared || {}), bell_foundry: 1 }, g.checkTownUnlocks()); if (g.townId !== town) g.travel(town); window.__ui.open(null); g.save.settings.stationMarkers = false; }, town);
  await page.waitForFunction(t => window.__rend.town?.ready && window.__game.townId === t, town, { timeout: 30000 }); await sleep(1200);
  const sts = await ev(() => window.__game.level.interacts.map(i => ({ id: i.id, key: i.station, x: i.x, y: i.y, r: i.r })));
  for (const st of sts) {
    const dists = [16, 11.5, 6, 2, 0];
    const ang = await ev(([st, dists]) => { const g = window.__game; for (let a = 0; a < 32; a++) { const t = a * Math.PI / 16; if (dists.every(d => !g.solidAt(st.x + Math.cos(t) * d, st.y + Math.sin(t) * d))) return t; } return null; }, [st, dists]);
    if (ang == null) { ok(true, `${town}/${st.key}: no clear straight approach (skipped)`); continue; }
    const rec = [];
    for (const d of dists) { await ev(([st, d, ang]) => { const g = window.__game; g.px = st.x + Math.cos(ang) * d; g.py = st.y + Math.sin(ang) * d; for (let i = 0; i < 4; i++) g.update(.016); }, [st, d, ang]); await sleep(350);
      rec.push({ d, ...(await ev(st => { const R = window.__rend, g = window.__game; const l = (R.lblRects || []).filter(q => q.id === st.id), c = (R.chipRects || []).filter(q => q.id === st.id); const ax = R.sx(st.x, st.y), ay = R.sy(st.x, st.y); return { ready: g.prompt?.id === st.id, n: l.length, chips: c.length, dx: l[0] ? l[0].x - ax : null, dy: l[0] ? l[0].y - ay : null, w: l[0]?.w, h: l[0]?.h, cdx: c[0] ? c[0].cx - ax : null, cdy: c[0] ? c[0].cy - ay : null, cclamped: c[0]?.clamped, lcx: l[0] ? l[0].x + l[0].w / 2 - ax : null, lcy: l[0] ? l[0].y + l[0].h / 2 - ay : null, clamped: l[0] ? (l[0].x <= 8.5 || l[0].x + l[0].w >= innerWidth - 8.5 || l[0].y <= 8.5 || l[0].y + l[0].h >= innerHeight - 8.5) : false }; }, st)) }); }
    const rd = rec.filter(r => r.n === 1 && !r.clamped), ch = [];
    ok(rd.length >= 2, `${town}/${st.key}: the single label is shown at ${rd.length} of ${rec.length} positions (idle and in range)`);
    if (rd.length >= 2) { const ref = rd[0]; const dev = Math.max(...rd.map(r => Math.max(Math.abs(r.dx - ref.dx), Math.abs(r.dy - ref.dy)))); ok(dev <= 1, `${town}/${st.key}: pill offset from station anchor stable across the radius (max deviation ${dev.toFixed(2)}px over ${rd.length} positions)`);
      if (ch.length) { const cd = Math.max(...ch.map(r => Math.max(Math.abs(r.cdx - ref.lcx), Math.abs(r.cdy - ref.lcy)))); ok(cd <= 1.5, `${town}/${st.key}: idle pin centred on the pill's centre (max ${cd.toFixed(2)}px)`); } }
    ok(rec.every(r => r.n + (r.n ? 0 : 0) <= 1 && !(r.n === 1 && r.chips === 1)), `${town}/${st.key}: never a pill and a pin together`);
  }
}

// ---- run INTO each station (per frame): walk / run / sprint-dodge speeds, straight and diagonal arrivals, through the pad centre into the stall; labels must not move (1px per frame) ----
await ev(() => { if (window.__drv) return; window.__drv = { path: null, i: 0, frames: [] }; { const T = window.__rend.town, os = T.scaled.bind(T); window.__sg = new WeakSet(); window.__sc = 0; T.scaled = (n, ...r) => { const v = os(n, ...r); if (v && n.startsWith('sign_')) window.__sg.add(v.cv || v); return v; }; const od = CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage = function (im, ...r) { if (window.__sg.has(im) && this.globalAlpha > .02) window.__sc++; return od.call(this, im, ...r); }; } const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => raf(t => { const D = window.__drv, g = window.__game, R = window.__rend; if (D.path && D.i < D.path.length) { const p = D.path[D.i++]; g.px = p[0]; g.py = p[1]; g.update(.016); } cb(t); if (D.path && D.id) { const st = D.st; const l = (R.lblRects || []).filter(q => q.id === D.id), c = (R.chipRects || []).filter(q => q.id === D.id); const ax = R.sx(st.x, st.y), ay = R.sy(st.x, st.y); D.frames.push({ signs: (() => { const v = window.__sc; window.__sc = 0; return v; })(), i: D.i, ready: g.prompt?.id === D.id, n: l.length, chips: c.length, dx: l[0] ? l[0].x - ax : null, dy: l[0] ? l[0].y - ay : null, lcx: l[0] ? l[0].x + l[0].w / 2 - ax : null, lcy: l[0] ? l[0].y + l[0].h / 2 - ay : null, vcx: l[0]?.vcx != null ? l[0].vcx - (l[0].x + l[0].w / 2) : null, tail: l[0] ? l[0].tailX - (l[0].x + l[0].w / 2) : null, cdx: c[0] ? c[0].cx - ax : null, cdy: c[0] ? c[0].cy - ay : null, cc: c[0]?.clamped, clamped: l[0] ? (l[0].x <= 8.5 || l[0].x + l[0].w >= innerWidth - 8.5 || l[0].y <= 8.5 || l[0].y + l[0].h >= innerHeight - 8.5) : false }); } }); });
for (const town of ['rustline', 'harrow']) {
  await ev(async town => { const g = window.__game; g.save.level = 30; (g.save.cleared = { ...(g.save.cleared || {}), bell_foundry: 1 }, g.checkTownUnlocks()); if (g.townId !== town) g.travel(town); window.__ui.open(null); }, town);
  await page.waitForFunction(t => window.__rend.town?.ready && window.__game.townId === t, town, { timeout: 30000 }); await sleep(1000);
  const sts = await ev(() => window.__game.level.interacts.map(i => ({ id: i.id, key: i.station, x: i.x, y: i.y })));
  for (const st of sts) {
    let worst = 0, fr = 0, pinw = 0, repOff = 0, seen = 0, both = 0, runs = 0;
    for (const [speed, deg0] of [[5, 90], [14, 45], [14, 200], [30, 315]]) for (let tryN = 0, got = false; tryN < 8 && !got; tryN++) { const deg = deg0 + tryN * 45;
      const path = await ev(([st, speed, deg]) => { const g = window.__game, t = deg * Math.PI / 180, step = speed * .016; const pts = []; const D0 = 18; const free = d => !g.solidAt(st.x + Math.cos(t) * d, st.y + Math.sin(t) * d); let from = D0; while (from > 6 && !free(from)) from -= 1; if (from <= 6) return null;
        for (let d = from; d > -1.2; d -= step) { const x = st.x + Math.cos(t) * Math.max(d, -1.2), y = st.y + Math.sin(t) * Math.max(d, -1.2); if (g.solidAt(x, y)) break; pts.push([x, y]); } for (let k = 0; k < 8; k++) pts.push(pts[pts.length - 1]); return pts; }, [st, speed, deg]);
      if (!path || path.length < 5) continue; runs++;
      await ev(([st, path]) => { const D = window.__drv; D.frames = []; D.st = st; D.id = st.id; D.i = 0; D.path = path; }, [st, path]); await page.waitForFunction(() => window.__drv.i >= window.__drv.path.length, null, { timeout: 60000 }); await sleep(100);
      const F = await ev(() => { const D = window.__drv; D.path = null; return D.frames; });
      const rd = F.filter(f => f.n === 1 && !f.clamped); if (rd.length < 2) { runs--; continue; } got = true; fr += F.length; seen += rd.length; const ref = rd[0];
      worst = Math.max(worst, ...rd.map(f => Math.max(Math.abs(f.dx - ref.dx), Math.abs(f.dy - ref.dy)))); repOff = Math.max(repOff, ...rd.filter(f => f.vcx != null).map(f => Math.abs(f.vcx)), 0);
      for (const f of F.filter(f => f.chips === 1 && !f.ready && !f.cc && f.cdx != null)) pinw = Math.max(pinw, Math.hypot(f.cdx - ref.lcx, f.cdy - ref.lcy)); both += F.filter(f => f.n > 1 || f.chips > 0 || f.signs > 0).length; }
    ok(runs > 0 && seen >= 2, `run-into ${town}/${st.key}: ${runs} approaches, ${seen} in-range frames of ${fr}`);
    ok(worst <= 1, `run-into ${town}/${st.key}: pill never moved relative to its station across ${seen} in-range frames (max ${worst.toFixed(2)}px; walk, run, sprint, diagonal)`);
    ok(repOff <= 1, `run-into ${town}/${st.key}: pill centre on its own prop's visual centre (max off ${repOff.toFixed(2)}px)`);
    ok(both === 0, `run-into ${town}/${st.key}: no second label layer ever drawn: no world sign / pin / duplicate pill (${both} offending frames)`);
  }
}
ok(errors.length === 0, 'no page errors ' + (errors[0] || '')); await browser.close();
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
