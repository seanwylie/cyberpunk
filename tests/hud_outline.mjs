// No stray outlined overlay may wrap the HUD. The tutorial spotlight (#tutspot) must hug ONE target, never a union of far-apart HUD parts
// (objective bar + top-right tray + minimap once produced one giant yellow rectangle). Checked in the dungeon and in town at several sizes.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const VPS = [[760, 600, 0], [1024, 768, 0], [1280, 720, 0], [1920, 1080, 0], [2560, 1440, 0], [844, 390, 1], [390, 844, 1]];
for (const [w, h, touch] of VPS) for (const mode of ['run', 'town']) {
  const tag = `${w}x${h}${touch ? 't' : ''} ${mode}`;
  const { browser, page, errors } = await launch({ viewport: { width: w, height: h }, touch: !!touch, tutorial: true });
  await page.evaluate(() => { document.getElementById('splash')?.remove(); document.getElementById('rotate')?.remove(); document.body.classList.add('portraitok'); }); await sleep(300);
  await page.evaluate(({ mode }) => { const g = window.__game, t = window.__tut, ui = window.__ui; if (mode === 'run') { g.dbg.god = true; g.startRun(Object.keys(window.__dungeons || {})[0] || undefined); }
    ui.open(null); // park the tutorial on the dungeon controls step (the one that points at the objective + minimap) with its flags satisfied
    const ids = ['move', 'contract', 'equip', 'chip', 'vendor', 'bank', 'gate']; for (const i of ids) { try { t.latch(i); } catch {} } t.flags.cast = true; t.flags.dodge = true; }, { mode });
  await sleep(1200);
  const r = await page.evaluate(() => {
    const vis = e => { const s = getComputedStyle(e), b = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
    const R = sel => { const e = document.querySelector(sel); if (!e || !vis(e)) return null; const b = e.getBoundingClientRect(); return b; };
    const out = []; const hud = ['#objective', '#minimap', '#btn-menu', '#btn-map', '#btn-town'].map(R).filter(Boolean);
    // every visible fixed/absolute, pointer-transparent, outlined box that is not a known tutorial marker
    for (const e of document.querySelectorAll('body *')) { if (!vis(e)) continue; const s = getComputedStyle(e); if (s.position !== 'fixed' && s.position !== 'absolute') continue; if (e.id === 'tutspot' || e.id === 'tutworld' || e.closest('#tutworld,#tutspot,#tutedge,canvas')) continue;
      const bw = parseFloat(s.borderTopWidth) + parseFloat(s.borderLeftWidth); const b = e.getBoundingClientRect(); if (bw >= 2 && s.pointerEvents === 'none' && b.width * b.height > 0.05 * innerWidth * innerHeight) out.push((e.id || e.className) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height)); }
    const sp = document.getElementById('tutspot'); const sb = sp && sp.style.display !== 'none' ? sp.getBoundingClientRect() : null;
    const covered = sb ? hud.filter(b => b.left >= sb.left - 1 && b.right <= sb.right + 1 && b.top >= sb.top - 1 && b.bottom <= sb.bottom + 1).length : 0;
    return { stray: out, spot: sb && { w: Math.round(sb.width), h: Math.round(sb.height) }, covered, vw: innerWidth, vh: innerHeight, step: window.__tut.cur()?.id };
  });
  ok(r.stray.length === 0, `${tag}: no stray outlined overlay (${r.stray.join(', ') || 'none'})`);
  ok(r.covered <= 1, `${tag}: spotlight (${r.spot ? r.spot.w + 'x' + r.spot.h : 'off'}, step ${r.step}) wraps at most one HUD element (wraps ${r.covered})`);
  ok(!r.spot || r.spot.w * r.spot.h < 0.3 * r.vw * r.vh, `${tag}: spotlight is not screen-sized`);
  ok(errors.length === 0, `${tag}: no console errors ${errors[0] || ''}`);
  await browser.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
