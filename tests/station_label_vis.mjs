// Every station label (interact pill) in both towns: full text visible, inside the screen, not covered by anything drawn after it, one label per station.
// Labels are queued and drawn in the overlay pass above all props/NPCs/signs; we verify by hooking the draw calls that happen AFTER the label text.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
for (const [W, H, T] of [[1280, 720, 0], [800, 600, 0], [844, 390, 1]]) {
  const { browser, page, errors } = await launch({ viewport: { width: W, height: H }, touch: !!T, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
  await ev(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
  // after fillText of a pill label, any later canvas drawing in the same frame that intersects the label rect counts as occlusion
  await ev(() => { window.__occ = []; window.__lbl = null; const P = CanvasRenderingContext2D.prototype; const oi = P.drawImage, of = P.fillText, ofr = P.fill;
    const hit = (ctx, x, y, w, h) => { const L = window.__lbl; if (!L || ctx.canvas.id !== 'game') return; const t = ctx.getTransform(); const dpr = window.__rend.dpr; const X = (t.e + x * t.a) / dpr, Y = (t.f + y * t.d) / dpr, Wd = w * t.a / dpr, Hd = h * t.d / dpr; if (X < L.x + L.w - 2 && X + Wd > L.x + 2 && Y < L.y + L.h - 2 && Y + Hd > L.y + 2 && Wd * Hd > 4) window.__occ.push(L.id); };
    P.drawImage = function (im, ...a) { if (a.length === 8) hit(this, a[4], a[5], a[6], a[7]); else if (a.length === 4) hit(this, a[0], a[1], a[2], a[3]); return oi.call(this, im, ...a); };
    P.fillText = function (t, ...r) { if (this.canvas.id === 'game') { const L = (window.__rend.lblRects || []).find(q => q.text === String(t)); if (L) window.__lbl = L; } return of.call(this, t, ...r); }; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => raf(t => { window.__lbl = null; cb(t); }); window.__ui.open(null); });
  for (const town of ['rustline', 'harrow']) {
    await ev(async town => { const g = window.__game; g.save.level = 30; g.checkTownUnlocks(); if (g.townId !== town) g.travel(town); window.__ui.open(null); }, town);
    await page.waitForFunction(t => window.__rend.town?.ready && window.__game.townId === t, town, { timeout: 30000 }); await sleep(1500);
    const sts = await ev(() => window.__game.level.interacts.map(i => ({ id: i.id, key: i.station, x: i.x, y: i.y, r: i.r })));
    for (const st of sts) {
      const placed = await ev(st => { const g = window.__game; for (const dx of [0, .6, 1.2]) for (let a = 0; a < 16; a++) { const x = st.x + Math.cos(a * Math.PI / 8) * dx, y = st.y + Math.sin(a * Math.PI / 8) * dx; if (!g.solidAt(x, y)) { g.px = x; g.py = y; for (let i = 0; i < 4; i++) g.update(.016); if (g.prompt?.id === st.id) return true; } } return false; }, st);
      if (!placed) { ok(false, `${W}x${H} ${town}/${st.key}: could not enter interact range`); continue; }
      await ev(() => { window.__occ = []; window.__lbl = null; }); await sleep(700);
      const r = await ev(st => { const R = (window.__rend.lblRects || []).filter(q => q.id === st.id); const g = window.__game; return { n: R.length, r: R[0], occ: window.__occ.filter(x => x === st.id).length, vw: innerWidth, vh: innerHeight, name: window.__game.level.interacts.find(i => i.id === st.id)?.label }; }, st);
      const L = r.r; const inside = L && L.x >= 0 && L.y >= 0 && L.x + L.w <= r.vw && L.y + L.h <= r.vh;
      ok(r.n === 1 && !!L && L.text.length >= 3 && inside && r.occ === 0, `${W}x${H} ${town}/${st.key}: one label "${L?.text}" fully on screen=${inside}, occluding draws after label=${r.occ}`);
    }
  }
  ok(errors.length === 0, `${W}x${H}: no page errors ${errors[0] || ''}`); await browser.close();
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
