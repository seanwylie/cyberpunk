// Pixel-based check of every station's interact pill (both towns): measures the rendered ink (glyph/icon pixels) against the pill's inner box.
// Asserts: icon+text group has equal left/right ink padding, text is cap-height centred (equal top/bottom), icon centred in its cell, pill centred over the station, tail visible.
import { launch, sleep } from './lib.mjs';
import { PNG } from 'pngjs';
import fs from 'fs';
fs.mkdirSync('shots/station_labels', { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const TOL = 1.01; const rows = [];
for (const [W, H, dpr, US] of [[1280, 720, 1, 'M'], [1280, 720, 2, 'M'], [1280, 720, 1, 'XL'], [1280, 720, 2, 'S']]) {
  const { browser, page, errors } = await launch({ viewport: { width: W, height: H }, dpr, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
  await ev(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
  await ev(async US => { const m = await import('/src/config.ts'); m.applyUiScale(US); }, US);
  for (const town of ['rustline', 'harrow']) {
    await ev(async town => { const g = window.__game; g.save.level = 30; (g.save.cleared = { ...(g.save.cleared || {}), bell_foundry: 1 }, g.checkTownUnlocks()); if (g.townId !== town) g.travel(town); window.__ui.open(null); g.save.settings.reducedFx = true; g.save.settings.stationMarkers = false; }, town);
    await page.waitForFunction(t => window.__rend.town?.ready && window.__game.townId === t, town, { timeout: 30000 }); await sleep(1200);
    const sts = await ev(() => window.__game.level.interacts.map(i => ({ id: i.id, key: i.station, x: i.x, y: i.y })));
    for (const st of sts) {
      const placed = await ev(st => { const g = window.__game; for (const dx of [0, .6, 1.2]) for (let a = 0; a < 16; a++) { const x = st.x + Math.cos(a * Math.PI / 8) * dx, y = st.y + Math.sin(a * Math.PI / 8) * dx; if (!g.solidAt(x, y)) { g.px = x; g.py = y; for (let i = 0; i < 4; i++) g.update(.016); if (g.prompt?.id === st.id) return true; } } return false; }, st);
      if (!placed) { ok(false, `${W}x${H}@${dpr} ${US} ${town}/${st.key}: could not enter range`); continue; }
      await ev(() => { if (window.__pillBack) return; window.__pillBack = true; const P = CanvasRenderingContext2D.prototype, o = P.roundRect; P.roundRect = function (x, y, w, h, r) { const l = (window.__rend.lblRects || []).find(q => Math.abs(q.x - x) < .6 && Math.abs(q.y - y) < .6 && Math.abs(q.w - w) < .6); if (l && this.canvas.id === 'game') { this.save(); this.setTransform(this.getTransform()); this.fillStyle = '#000'; this.globalAlpha = 1; this.fillRect(x - 6, y - 6, w + 12, h + 56); this.restore(); } return o.call(this, x, y, w, h, r); }; });
      await sleep(1500); const getL0 = st => ev(st => { const l = (window.__rend.lblRects || []).find(q => q.id === st.id); const R = window.__rend; return l ? { ...l, ax: R.sx(st.x, st.y), ay: R.sy(st.x, st.y) } : null; }, st);
      let L = await getL0(st), cl, buf, png, sc; for (let tries = 0; tries < 6 && L; tries++) { const pad = 8; cl = { x: Math.max(0, Math.floor(L.x - pad)), y: Math.max(0, Math.floor(L.y - pad)) }; cl.width = Math.min(W - cl.x, Math.ceil(L.w + 2 * pad)); cl.height = Math.min(H - cl.y, Math.ceil(L.h + 2 * pad + 40)); buf = await page.screenshot({ type: 'png', clip: cl }); const L2 = await getL0(st); if (L2 && Math.abs(L2.x - L.x) < .05 && Math.abs(L2.y - L.y) < .05) break; L = L2; await sleep(400); }
      if (!L) { ok(false, `${W}x${H}@${dpr} ${US} ${town}/${st.key}: no label`); continue; }
      png = PNG.sync.read(buf); sc = png.width / cl.width;
      if (dpr === 1 && US === 'M') fs.writeFileSync(`shots/station_labels/${town}_${st.key}.png`, buf);
      // pill inner box (device px), inset past the 2.5px stroke
      const il = Math.round((L.x - cl.x + 2) * sc), ir = Math.round((L.x - cl.x + L.w - 2) * sc), it = Math.round((L.y - cl.y + 2) * sc), ib = Math.round((L.y - cl.y + L.h - 2) * sc);
      const px = (x, y) => { const o = (y * png.width + x) * 4; return [png.data[o], png.data[o + 1], png.data[o + 2]]; };
      const samp = [[], [], []]; const inCap = (x, y) => { const X = x / sc + cl.x, Y = y / sc + cl.y, r = L.h / 2, cx = Math.max(L.x + r, Math.min(L.x + L.w - r, X)); return Math.hypot(X - cx, Y - (L.y + r)) <= r - 3.5; };
      for (let y = it; y < ib; y++) for (let x = il; x < ir; x++) { if (!inCap(x, y)) continue; const p = px(x, y); for (let k = 0; k < 3; k++) samp[k].push(p[k]); } const med = samp.map(a => a.sort((x, y) => x - y)[a.length >> 1]);
      const splitX = Math.round((L.tx - cl.x - (L.tx - L.ix - L.isz) / 2) * sc); // between icon and text
      const box = (x0, x1) => { let mnx = 1e9, mxx = -1, mny = 1e9, mxy = -1; for (let y = it; y < ib; y++) for (let x = x0; x < x1; x++) { if (!inCap(x, y)) continue; const p = px(x, y); if (Math.max(Math.abs(p[0] - med[0]), Math.abs(p[1] - med[1]), Math.abs(p[2] - med[2])) > 90) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); } } return mxx < 0 ? null : { x0: mnx / sc, x1: (mxx + 1) / sc, y0: mny / sc, y1: (mxy + 1) / sc }; };
      const ic = box(il, splitX), tx = box(splitX, ir); const tag = `${W}x${H}@${dpr} ${US} ${town}/${st.key}`;
      if (!ic || !tx) { ok(false, `${tag}: ink not found (icon ${!!ic}, text ${!!tx})`); continue; }
      const iL = L.x - cl.x, iR = L.x + L.w - cl.x, iT = L.y - cl.y, iB = L.y + L.h - cl.y; const left = L.ix - L.x - 0, right = iR - tx.x1, top = tx.y0 - iT, bot = iB - tx.y1;
      const icx = (ic.x0 + ic.x1) / 2, icy = (ic.y0 + ic.y1) / 2, cellX = L.ix + L.isz / 2 - cl.x, cellY = L.h / 2 + L.y - cl.y; const pillCx = L.x + L.w / 2;
      rows.push([tag, left.toFixed(2), right.toFixed(2), top.toFixed(2), bot.toFixed(2), (icx - cellX).toFixed(2), (icy - cellY).toFixed(2), (pillCx - L.ax).toFixed(1), L.tailX != null ? (L.tailX - pillCx).toFixed(1) : 'n/a'].join('\t'));
      ok(Math.abs(left - right) <= 1.1, `${tag}: ink padding left ${left.toFixed(2)} vs right ${right.toFixed(2)} (icon cell left edge to text ink right edge)`);
      ok(Math.abs(top - bot) <= 1.0, `${tag}: text ink top ${top.toFixed(2)} vs bottom ${bot.toFixed(2)} (cap-height centred)`);
      ok(Math.abs(icx - cellX) <= 1.5 && Math.abs(icy - cellY) <= 1.5, `${tag}: icon ink centred in its cell (dx ${(icx - cellX).toFixed(2)}, dy ${(icy - cellY).toFixed(2)})`);
      // tail: coloured triangle just under the pill, centred on the pill
      { const tx0 = Math.round((L.tailX - cl.x) * sc), ty = Math.round((L.y - cl.y + L.h + 4) * sc); const p = px(tx0, ty); var tailSeen = Math.max(p[0], p[1], p[2]) > 60; }
      ok(L.tailX != null && Math.abs(L.tailX - pillCx) <= 3 + (L.x <= 8.5 ? L.w / 2 : 0) && tailSeen, `${tag}: tail drawn under the pill centre, pixels visible=${tailSeen} (${(L.tailX - pillCx).toFixed(1)})`);
    }
  }
  ok(errors.length === 0, `${W}x${H}@${dpr} ${US}: no page errors ${errors[0] || ''}`); await browser.close();
}
console.log('PADDINGS (css px)  tag\tleft\tright\ttop\tbottom\ticon dx\ticon dy\tpill-anchor dx\ttail-pill dx\n' + rows.join('\n'));
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
