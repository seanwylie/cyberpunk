// Mobile pass: device emulation (touch, DPR 2-3, UA, CPU throttle). Checks layout (no h-scroll, tap targets, clipped text), touch controls,
// quality tier selection, orientation change, PWA bits and frame-time regression ceilings. Env: QUICK=1 skips the throttled perf runs.
import { launchMobile, DEVICES, perf, sleep, URL } from './mobile_lib.mjs';
import { launch } from './lib.mjs';
import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const PANELS = ['settings', 'gate', 'locker', 'vendor', 'fixer', 'store', 'contacts'];
const toTown = p => p.evaluate(() => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; window.__ui.open(null); });
const audit = (p) => p.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; };
  const small = [], clip = [];
  for (const el of document.querySelectorAll('#modal button, #modal [role=tab], #modal [role=button], #modal select, #modal input:not([type=hidden]), #hud button, #hud [role=button]')) { if (!vis(el)) continue; if (el.closest('[hidden],#splash')) continue; if (el.tagName === 'INPUT' && el.closest('label')) { const lr = el.closest('label').getBoundingClientRect(); if (lr.height >= 43.5) continue; } const r = el.getBoundingClientRect(); if (r.width < 43.5 || r.height < 43.5) small.push((el.id || el.className || el.tagName).toString().slice(0, 30) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
  for (const el of document.querySelectorAll('#modal *, #hud *')) { if (!vis(el) || !el.childNodes.length) continue; const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!hasText) continue; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); if ((r.right > innerWidth + 1 || r.left < -1) && !el.closest('.stabs')) { clip.push('offscreen:' + (el.className || el.tagName) + ':' + el.textContent.trim().slice(0, 20)); continue; } if (el.scrollWidth > el.clientWidth + 2 && (cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && !el.dataset.tip && !el.title && cs.display !== 'inline') clip.push('clipped:' + (el.className || el.tagName) + ':' + el.textContent.trim().slice(0, 20)); }
  const modal = document.getElementById('modal'); let panelOver = false; const w = modal && modal.firstElementChild; if (w) { const r = w.getBoundingClientRect(); panelOver = r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1; }
  return { hs: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1, small: [...new Set(small)], clip: [...new Set(clip)], panelOver };
});
const touch = (cdp, type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i })) });

// ---------- layout + controls per device ----------
const devs = process.env.QUICK ? ['phoneL', 'phoneP'] : ['phoneL', 'phoneP', 'androidL', 'tabletP'];
for (const k of devs) {
  const d = DEVICES[k]; const { browser, page, cdp, errors } = await launchMobile(d, { query: '?splash=hold' }); await sleep(800);
  ok(await page.evaluate(() => document.body.classList.contains('touch')), `${k}: touch mode detected (pointer:coarse)`);
  await page.evaluate(() => { document.body.classList.add('portraitok'); window.__game.dbg.god = true; });
  await toTown(page); let a = await audit(page); ok(!a.hs, `${k}: no horizontal scroll in game view`);
  for (const pn of PANELS) {
    await toTown(page); await page.evaluate(n => window.__ui.open(n), pn); await sleep(150);
    const open = await page.evaluate(() => window.__ui.modal); if (!open) { console.log(`  (skip ${pn}: not openable)`); continue; }
    a = await audit(page);
    ok(!a.hs && !a.panelOver, `${k}/${pn}: panel fits viewport, no h-scroll`);
    ok(a.small.length === 0, `${k}/${pn}: tap targets >=44px ${a.small.slice(0, 6).join('; ')}`);
    ok(a.clip.length === 0, `${k}/${pn}: no clipped/offscreen text ${a.clip.slice(0, 5).join('; ')}`);
    if (pn === 'settings' || pn === 'locker') { // panel must scroll with a touch swipe
      const sc = await page.evaluate(() => { const els = [...document.querySelectorAll('#modal *')].filter(e => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)); const e = els.sort((x, y) => y.scrollHeight - x.scrollHeight)[0]; if (!e) return null; const r = e.getBoundingClientRect(); e.scrollTop = 0; e.id = e.id || '__sc'; return { id: e.id, x: r.left + r.width / 2, y: r.top + r.height * .7, y2: r.top + r.height * .2 }; });
      if (sc) { await touch(cdp, 'touchStart', [[sc.x, sc.y]]); for (let y = sc.y; y > sc.y2; y -= 10) { await touch(cdp, 'touchMove', [[sc.x, y]]); await sleep(16); } await touch(cdp, 'touchEnd', []); await sleep(400); const top = await page.evaluate(id => document.getElementById(id).scrollTop, sc.id); ok(top > 20, `${k}/${pn}: touch-swipe scrolls the panel (scrollTop ${top})`); }
    }
  }
  await page.evaluate(() => { window.__ui.open(null); });
  if (d.w > d.h) { // controls (landscape)
    await page.evaluate(() => { const g = window.__game; g.enterTown(); window.__ui.open(null); });
    // floating joystick: drag on the left half moves, release stops
    await touch(cdp, 'touchStart', [[120, d.h * .6]]); await touch(cdp, 'touchMove', [[190, d.h * .6]]); await sleep(120);
    let mv = await page.evaluate(() => ({ ...window.__game.inputMove, vis: getComputedStyle(document.getElementById('joy')).display }));
    ok(mv.x > .5 && mv.vis === 'block', `${k}: floating joystick drag moves right (${mv.x.toFixed(2)})`);
    // multi-touch: while holding the joystick, press-drag an ability button with a second finger
    const ab = await page.evaluate(() => { const b = document.querySelector('.abtn:not(.empty)') || document.querySelector('.abtn'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; });
    ok(ab.w >= 44 && ab.h >= 44, `${k}: ability buttons thumb-sized (${Math.round(ab.w)}x${Math.round(ab.h)})`);
    await touch(cdp, 'touchStart', [[190, d.h * .6, 0], [ab.x, ab.y, 1]]); await touch(cdp, 'touchMove', [[190, d.h * .6, 0], [ab.x - 30, ab.y - 30, 1]]); await sleep(100);
    const st = await page.evaluate(() => ({ aim: !!window.__game.aim, mx: window.__game.inputMove.x }));
    ok(st.mx > .3, `${k}: joystick keeps moving while a second finger works an ability (multi-touch)`);
    await touch(cdp, 'touchEnd', []); await sleep(100);
    mv = await page.evaluate(() => ({ ...window.__game.inputMove, vis: getComputedStyle(document.getElementById('joy')).display }));
    ok(Math.abs(mv.x) < .01 && Math.abs(mv.y) < .01, `${k}: releasing stops movement`);
    // dodge button via touch
    const dd = await page.evaluate(() => { const r = document.getElementById('dodge').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; });
    ok(dd[2] >= 56, `${k}: dodge button >=56px (${Math.round(dd[2])})`);
    // no page scroll / zoom: touch-action + overscroll on root
    const css = await page.evaluate(() => ({ ta: getComputedStyle(document.body).touchAction, ob: getComputedStyle(document.documentElement).overscrollBehaviorY, us: getComputedStyle(document.body).userSelect, vp: document.querySelector('meta[name=viewport]').content }));
    ok(css.ta === 'none' && css.ob === 'none' && css.us === 'none' && /user-scalable=no/.test(css.vp) && /viewport-fit=cover/.test(css.vp), `${k}: scroll/zoom/selection suppressed (touch-action ${css.ta}, overscroll ${css.ob})`);
    // controls inside safe area / viewport
    const inb = await page.evaluate(() => [...document.querySelectorAll('#controls button, #topright button, #topleft')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1); }).length);
    ok(inb === 0, `${k}: HUD controls all on-screen`);
  } else { // portrait: rotate prompt (clean) and 'play anyway'
    await page.evaluate(() => document.body.classList.remove('portraitok'));
    const r = await page.evaluate(() => { const e = document.getElementById('rotate'); return { disp: getComputedStyle(e).display, btn: !!e.querySelector('button'), txt: e.textContent }; });
    ok(r.disp === 'flex' && r.btn && /landscape/i.test(r.txt), `${k}: portrait shows rotate prompt with 'play anyway'`);
    await page.evaluate(() => document.body.classList.add('portraitok'));
  }
  ok(errors.length === 0, `${k}: no console errors ${errors[0] || ''}`);
  await browser.close();
}

// ---------- orientation change ----------
{ const { browser, page } = await launchMobile(DEVICES.phoneL, { query: '?splash=hold' }); await sleep(500);
  const c0 = await page.evaluate(() => [window.__rend.w, window.__rend.h]);
  await page.setViewportSize({ width: 390, height: 844 }); await sleep(500);
  const c1 = await page.evaluate(() => ({ w: window.__rend.w, h: window.__rend.h, cw: window.__rend.canvas.style.width, portrait: document.body.classList.contains('portrait'), hs: document.documentElement.scrollWidth > innerWidth }));
  ok(c0[0] === 844 && c1.w === 390 && c1.h === 844 && c1.portrait && !c1.hs, `orientation change: canvas resizes ${c0.join('x')} -> ${c1.w}x${c1.h}, portrait class set`);
  await page.setViewportSize({ width: 844, height: 390 }); await sleep(500);
  const c2 = await page.evaluate(() => ({ w: window.__rend.w, portrait: document.body.classList.contains('portrait') })); ok(c2.w === 844 && !c2.portrait, 'orientation change back to landscape'); await browser.close(); }

// ---------- quality tiers ----------
{ const sel = async (o, q = '?splash=hold') => { const r = await launchMobile(o.dev, { query: q, init: o.init }); await sleep(500); const v = await r.page.evaluate(() => ({ tier: window.__quality.tier, pref: window.__quality.pref, dpr: window.__rend.dpr, w: window.__rend.canvas.width, h: window.__rend.canvas.height, cssw: window.innerWidth })); await r.browser.close(); return v; };
  const m = await sel({ dev: DEVICES.phoneL }); ok(m.tier === 'medium' && m.dpr <= 1.5 && m.dpr >= 1, `auto on phone (8 cores): medium, dpr ${m.dpr.toFixed(2)} (device 3)`);
  const l = await sel({ dev: DEVICES.phoneL, init: () => { Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 }); } }); ok(l.tier === 'low' && l.dpr <= 1, `auto on 2GB device: low, dpr ${l.dpr.toFixed(2)}`);
  const f = await sel({ dev: DEVICES.phoneL }, '?splash=hold&q=low'); ok(f.tier === 'low', 'override ?q=low forces low');
  const t = await sel({ dev: DEVICES.tabletP }); ok(t.w * t.h <= 2.7e6, `tablet 768x1024@2: canvas capped at ${(t.w * t.h / 1e6).toFixed(2)}MP (iOS canvas memory)`);
  const { browser, page } = await launch({ viewport: { width: 1280, height: 720 }, dpr: 2, query: '?splash=hold' }); await sleep(500);
  const dsk = await page.evaluate(() => ({ tier: window.__quality.tier, dpr: window.__rend.dpr, dyn: window.__quality.dynamic, fx: window.__quality.fx })); await browser.close();
  ok(dsk.tier === 'high' && dsk.dpr === 2 && !dsk.dyn && dsk.fx === 0, 'desktop (fine pointer, dpr 2): HIGH, dpr 2, no dynamic scaling, all fx (unchanged path)');
  const { browser: b2, page: p2 } = await launchMobile(DEVICES.phoneL, { query: '?splash=hold' }); await sleep(400);
  await p2.evaluate(() => { window.__quality.setPref('high'); }); const h = await p2.evaluate(() => ({ dpr: window.__rend.dpr, tier: window.__quality.tier })); ok(h.tier === 'high' && h.dpr === 2, 'Settings: High on a phone restores dpr 2');
  await p2.evaluate(() => { const q = window.__quality; q.setPref('auto'); q.warm = 0; for (let i = 0; i < 40; i++) q.sample(60); });
  const dyn = await p2.evaluate(() => ({ tier: window.__quality.tier, res: window.__quality.resScale, steps: window.__quality.steps })); ok(dyn.steps.length > 0 && dyn.res < 1, `dynamic scaling reacts to slow frames: ${dyn.steps.join(', ')}`);
  await p2.evaluate(() => { window.__ui.open('settings'); }); await p2.evaluate(() => document.querySelector('#stab-display')?.click()); await sleep(200);
  ok(await p2.evaluate(() => /Graphics quality/.test(document.getElementById('modal').textContent)), 'Settings > Display has Graphics quality'); await b2.close(); }

// ---------- PWA ----------
{ const m = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8')); const html = fs.readFileSync('index.html', 'utf8');
  ok(m.icons.length >= 3 && m.icons.every(i => fs.existsSync('public/' + i.src)) && m.icons.some(i => i.purpose === 'maskable') && /fullscreen|standalone/.test(m.display) && m.orientation === 'landscape', 'manifest: icons exist (incl. maskable), fullscreen, landscape');
  ok(/viewport-fit=cover/.test(html) && /theme-color/.test(html) && /apple-mobile-web-app-capable/.test(html) && /apple-touch-icon/.test(html), 'index.html: viewport-fit, theme-color, apple web-app meta + touch icon');
  ok(fs.existsSync('public/sw.js') && /wv-/.test(fs.readFileSync('public/sw.js', 'utf8')), 'service worker present with versioned cache'); }

// ---------- frame-time regression ceilings (software raster here; ceilings are loose guards, real devices have GPUs) ----------
if (!process.env.QUICK) for (const [k, where, ceil] of [['phoneL', 'town', 160], ['phoneL', 'annex', 240]]) {
  const { browser, page } = await launchMobile(DEVICES[k], { cpu: 4, query: '?splash=hold' }); await sleep(2000); const r = await perf(page, where, 100); await browser.close();
  console.log(`  ${k} ${where} cpu x4 [${r.tier}] ${r.canvas}: draw+raster med ${r.med} p95 ${r.p95}ms (submit p95 ${r.submitP95}) raf med ${r.rafMed}`);
  ok(r.p95 < ceil, `${k} ${where} @4x throttle: p95 ${r.p95}ms < ${ceil}ms`);
}
if (fails) { console.log('mobile FAIL (' + fails + ')'); process.exit(1); } console.log('mobile OK');
