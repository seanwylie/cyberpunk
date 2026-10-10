// UI text audit: every screen at 3 desktop sizes + touch landscape. Fails if any text overflows/clips
// (text bbox outside its clipping ancestor / its own box / the viewport), if any DOM or canvas text is below the minimums
// (desktop: everything >=14px, primary text/buttons >=16px; touch >=12px) or if text/background contrast is < 4.5:1.
// Canvas text is captured at runtime by wrapping fillText/strokeText on the game canvas (decorative low-alpha floor paint is skipped).
// Set SHOTS=<dir> (and TAG=before|after) to also write screenshots.
import { launch, sleep } from './lib.mjs';
import fs from 'fs';
const SHOTS = process.env.SHOTS, TAG = process.env.TAG || 'after'; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } };
const INIT = () => {
  window.__ctxText = [];
  for (const m of ['fillText', 'strokeText']) { const o = CanvasRenderingContext2D.prototype[m];
    CanvasRenderingContext2D.prototype[m] = function (t, x, y, w) { try { if (this.canvas && this.canvas.id === 'game') { const tr = this.getTransform(); const sc = Math.hypot(tr.a, tr.b); const px = parseFloat((/(\d+(?:\.\d+)?)px/.exec(this.font) || [0, 0])[1]) * sc;
      const st = m === 'fillText' ? this.fillStyle : this.strokeStyle; window.__ctxText.push({ t: String(t).slice(0, 24), px, font: this.font, fill: typeof st === 'string' ? st : '', ga: this.globalAlpha }); } } catch (e) {} return o.call(this, t, x, y, w); }; }
};
const SIZES = [[1280, 720], [1920, 1080], [1366, 768], [2560, 1440], [844, 390]];

const check = () => {
  const bad = []; const vw = innerWidth, vh = innerHeight;
  const vis = e => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && e.getClientRects().length; };
  const desc = e => (e.id ? '#' + e.id : '') + '.' + String(e.className && e.className.baseVal === undefined ? e.className : '').split(' ').join('.') + '<' + e.tagName.toLowerCase() + '> "' + (e.textContent || '').trim().slice(0, 30) + '"';
  let minPx = 99, minWhat = '', touchMode = document.body.classList.contains('touch');
  const MINALL = touchMode ? 12 : 16, MINPRI = touchMode ? 12 : 18;
  const parse = c => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const over = (f, b, a) => ({ r: f.r * a + b.r * (1 - a), g: f.g * a + b.g * (1 - a), b: f.b * a + b.b * (1 - a) });
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const contrast = el => { // effective text colour (alpha*opacity chain) over layered ancestor backgrounds, base = dark canvas
    let op = 1, layers = [], skip = false;
    for (let a = el; a; a = a.parentElement) { const s = getComputedStyle(a); op *= +s.opacity; const bg = parse(s.backgroundColor); if (s.backgroundImage !== 'none' && a !== el) skip = true; if (bg && bg.a > 0) layers.push(bg); }
    if (skip) return null;
    let base = { r: 30, g: 31, b: 33 }; for (const l of layers.reverse()) base = over(l, base, l.a);
    const f = parse(getComputedStyle(el).color); if (!f) return null; const fa = f.a * op; const fg = over(f, base, fa);
    const L1 = lum(fg), L2 = lum(base); return (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); };
  const PRIMARY = '.btn,.chip-btn,#interact,#dialog,#objective span,.toast,.row,#downpanel';
  const roots = ['#hud', '#modal', '#splash'].map(s => document.querySelector(s)).filter(Boolean);
  for (const root of roots) for (const el of root.querySelectorAll('*')) {
    if (!vis(el)) continue; const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()); if (!own.length) continue;
    // skip things that are transient animation (toasts fade) or off by design
    const fsz = parseFloat(getComputedStyle(el).fontSize); if (fsz < minPx) { minPx = fsz; minWhat = desc(el); }
    if (!el.closest('.toast') || true) { if (fsz < MINALL - .01) bad.push(`font ${fsz.toFixed(1)}px < ${MINALL}: ` + desc(el)); else if (el.matches(PRIMARY) && fsz < MINPRI - .01) bad.push(`primary font ${fsz.toFixed(1)}px < ${MINPRI}: ` + desc(el)); }
    const cr = el.closest('button:disabled,.btn[disabled]') ? null : contrast(el); if (cr !== null && cr < 4.5) bad.push(`contrast ${cr.toFixed(2)} < 4.5: ` + desc(el));
    const rg = document.createRange(); rg.selectNodeContents(el); const rs = [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0); if (!rs.length) continue;
    const L = Math.min(...rs.map(r => r.left)), R = Math.max(...rs.map(r => r.right)), T = Math.min(...rs.map(r => r.top)), B = Math.max(...rs.map(r => r.bottom));
    const own_ = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (R > vw + 1 || L < -1) bad.push('outside viewport x: ' + desc(el));
    let scrollY = false;
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a); const r = a.getBoundingClientRect();
      if (a !== el && (s.overflowX !== 'visible') && (R > r.right + 1 || L < r.left - 1)) bad.push('clipped x by ' + desc(a) + ' : ' + desc(el));
      if (s.overflowY === 'auto' || s.overflowY === 'scroll') scrollY = true;
      if (s.overflowY === 'hidden' && a !== el && (B > r.bottom + 1 || T < r.top - 1)) bad.push('clipped y by ' + desc(a) + ' : ' + desc(el));
    }
    if (!scrollY && (B > vh + 1 || T < -1)) bad.push('outside viewport y: ' + desc(el));
    if (cs.overflowX !== 'visible' && cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 1) bad.push('scrollWidth>clientWidth: ' + desc(el));
    if (el.tagName === 'BUTTON' || el.classList.contains('btn') || el.classList.contains('chip-btn') || el.classList.contains('slot') || el.classList.contains('sock') || el.classList.contains('tag')) {
      if (R > own_.right + 1 || L < own_.left - 1) bad.push('text exceeds own box: ' + desc(el));
    }
  }
  // vertical centring: text inside bars/buttons/chips must sit within +-12% of box height of the box centre
  for (const el of document.querySelectorAll('.bar span,.btn,.chip-btn,#interact,.tag,.abtn .aname,.akey,#dodge .aname')) { if (!vis(el)) continue; if (el.closest('button:disabled')) continue;
    const rg = document.createRange(); rg.selectNodeContents(el); const rs = [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0); if (!rs.length) continue;
    const host = el.matches('.bar span') ? el.parentElement : el; const hb = host.getBoundingClientRect(); if (hb.height < 10) continue;
    const ty = (Math.min(...rs.map(r => r.top)) + Math.max(...rs.map(r => r.bottom))) / 2, by = (hb.top + hb.bottom) / 2; if (el.matches('.akey,.abtn .aname,#dodge .aname')) continue;
    if (Math.abs(ty - by) > hb.height * .12 + 1) bad.push(`text not vertically centred (${(ty - by).toFixed(1)}px off in ${hb.height.toFixed(0)}px box): ` + desc(el)); }
  // sibling boxes laid out in the same visual row must have equal height (and socket boxes equal width)
  for (const par of document.querySelectorAll('#modal *, #hud *')) { if (!vis(par)) continue; const kids = [...par.children].filter(k => vis(k) && k.matches('.sock,.slot,.chip-btn,.btn,.abchip,.tag')); if (kids.length < 2) continue;
    const rects = kids.map(k => [k, k.getBoundingClientRect()]);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const [a, ra] = rects[i], [b, rb] = rects[j]; if (a.className !== b.className) continue; const overlap = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top); if (overlap < Math.min(ra.height, rb.height) * .5) continue;
      if (Math.abs(ra.height - rb.height) > 1.5) bad.push(`sibling heights differ (${ra.height.toFixed(0)} vs ${rb.height.toFixed(0)}): ` + desc(a) + ' / ' + desc(b));
      if (a.matches('.sock') && Math.abs(ra.width - rb.width) > 1.5) bad.push('sibling widths differ: ' + desc(a)); } }
  // scroll containers must not scroll horizontally
  for (const el of document.querySelectorAll('#modal *, #hud *')) if (vis(el)) { const s = getComputedStyle(el); if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) bad.push('horizontal scroll: ' + desc(el)); }
  // canvas text captured since the last step
  const cv = (window.__ctxText || []).splice(0); const seen = new Set();
  for (const c of cv) { const m = /rgba?\(([^)]+)\)/.exec(c.fill); const col = m ? parse(c.fill) : null; if (col && col.a * c.ga < .5) continue; // decorative floor paint
    if (c.px < MINALL - .5 && !seen.has(c.t)) { seen.add(c.t); bad.push(`canvas text ${c.px.toFixed(1)}px < ${MINALL}: "${c.t}" (${c.font})`); }
    if (col && !seen.has('c' + c.t)) { const L1 = lum(col), L2 = lum({ r: 30, g: 31, b: 33 }); const k = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); if (k < 4.5 && c.fill !== '#000' && col.a >= 1) { seen.add('c' + c.t); bad.push(`canvas contrast ${k.toFixed(2)}: "${c.t}" ${c.fill}`); } } }
  return { bad: [...new Set(bad)], minPx, minWhat, canvasN: cv.length };
};

for (const [w, h] of SIZES) {
  const touch = w < 1000; const tag = `${w}x${h}`;
  const { browser, page, errors, ctx } = await launch({ viewport: { width: w, height: h }, touch, dpr: touch ? 2 : 1, init: INIT, query: touch ? '?touch=1&splash=hold' : '?splash=hold' });
  const ev = (f, a) => page.evaluate(f, a);
  const step = async (name, prep, arg) => { if (prep) await ev(prep, arg); await sleep(350); const r = await ev(check);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${TAG}-${tag}-${name}.png` });
    for (const b of r.bad) ok(false, `${tag} ${name}: ${b}`);
    return r; };
  await page.addStyleTag({ content: '.toast{animation:none!important}' });
  await sleep(600);
  await step('01-splash');
  await ev(() => { document.getElementById('splash')?.remove(); window.__ui.kit('A', true); });
  await step('02-town');
  const open = (name, m) => step(name, m => { const u = window.__ui; u.modal = m; u.render(); }, m);
  await step('03-locker', () => { window.__ui.resetDraft(); window.__ui.modal = 'locker'; window.__ui.render(); });
  await step('04-locker-draft', () => { const u = window.__ui; u.draft.torso.chips.push('power'); u.draft.armR.chips.push('speed'); u.render(); });
  await step('04a-tile-tooltip', () => { const t = document.querySelector('.tile[data-def]'); t.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true })); const bb = [...document.querySelectorAll('.tile')].map(x => x.getBoundingClientRect()); window.__tiles = bb.map(r => [Math.round(r.width), Math.round(r.height)]); });
  { const tl = await ev(() => window.__tiles); ok(tl.length === 11 && tl.every(x => Math.abs(x[0] - x[1]) <= 1 && x[0] === tl[0][0]), `${tag} body tiles are uniform squares ${JSON.stringify(tl[0])}`); ok(await ev(() => document.querySelectorAll('.tile .pip').length > 10 && document.querySelectorAll('.tile .ticon canvas').length > 0 && document.querySelectorAll('.repb').length === 3 && getComputedStyle(document.getElementById('tiptile')).display === 'block'), `${tag} tiles show pips, icons, 3 rep badges and a hover tooltip`); await ev(() => document.querySelector('.tile').dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }))); }
  await step('04b-locker-sockets', () => { const u = window.__ui, g = window.__game; g.save.lockerChips.coolant = 3; g.save.lockerChips.gridlink = 3; u.sel = 'armR'; u.draft.armR.chips.length = 0; u.draft.armR.chips.push('coolant', 'gridlink', 'power'); u.render(); });
  await open('05-vendor', 'vendor');
  await step('05b-vendor-legs', () => { window.__ui.shopSlot = 'legL'; window.__ui.render(); });
  { const fsz = await ev(() => parseFloat(getComputedStyle(document.querySelector('#modal .win .body')).fontSize)); (globalThis.__fsz ||= {})[tag] = fsz; }
  await open('06-dungeon-select', 'gate');
  await open('07-contacts', 'contacts');
  await open('08-fixer', 'fixer');
  await open('09-store', 'store');
  await open('10-settings-about', 'settings');
  await ev(() => { window.__ui.modal = null; window.__ui.render(); window.__game.startRun(); window.__game.dbg.god = true; window.__game.revealing = false; });
  await sleep(800);
  await step('11-hud-run', () => { const u = window.__ui; u.toast('Picked up: Overclocked Servo (rare)'); u.toast('Objective updated'); u.banner('Foundry', 'Clear the floor and reach the boss', 30); });
  await step('12-hud-enemies-loot', () => { const g = window.__game; g.heat = 70; for (const t of ['worker', 'worker']) { const e = g.spawnEnemy(t, g.px + 3, g.py + 1); } });
  await step('12b-canvas-text', () => { const g = window.__game; for (const t of ['sentry', 'brute', 'scanner']) { if (window.__enemies[t]) g.spawnEnemy(t, g.px + 2 + Math.random() * 3, g.py - 2 + Math.random() * 3); } for (let i = 0; i < 4; i++) g.fx.push({ kind: 'text', x: g.px + 1 + i * .4, y: g.py + 1, t: 0, life: 3, text: String(1200 + i), c: '#d8d2bf' }); g.fx.push({ kind: 'text', x: g.px - 1, y: g.py + 1, t: 0, life: 3, text: 'CRIT 9999', c: '#d8a24a' }); g.addDrop(g.px + 1.5, g.py - 1, { kind: 'credits', amount: 40 }); g.addDrop(g.px - 1.5, g.py - 1, { kind: 'chip', chip: g.dd.cache.chips[0], amount: 1 }); });
  await sleep(300); await ev(check); await step('12c-canvas-text-2');
  await step('12d-ability-tooltip', () => { const b = document.querySelector('#dodge'); b.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true })); });
  await ev(() => document.querySelector('#dodge').dispatchEvent(new PointerEvent('pointerleave', { bubbles: true })));
  await step('12e-channel-bar', () => { const g = window.__game; g.channel = { kind: 'town', t: 1.2, dur: 99, cb: () => {} }; });
  await ev(() => { window.__game.channel = null; });
  await step('13-live-pack', () => window.__ui.toggleLive());
  await step('14-dialog', () => { window.__ui.toggleLive(); window.__ui.showDialog({ title: 'Annex security terminal', body: 'ACCESS DENIED. Requires hacking hardware.\n\nA scrawled note: the audit command selects the Neural Warden as the boss for this run.', options: [{ label: 'Close' }, { label: 'Issue the audit command (selects the Neural Warden)' }] }); });
  await step('15-down-panel', () => { document.getElementById('dialog').style.display = 'none'; window.__ui.showDown({ broke: 'armL', defib: true }); });
  await step('16-summary', () => { document.getElementById('downpanel').style.display = 'none'; const u = window.__ui; u.modal = 'summary'; u.render(); });
  ok(errors.length === 0, `${tag}: console errors ${errors.join(';')}`);
  await browser.close();
}
{ const f = globalThis.__fsz || {}; ok(f['1920x1080'] > f['1280x720'] && f['2560x1440'] > f['1920x1080'], 'UI text grows with viewport: ' + JSON.stringify(f)); ok(f['1920x1080'] >= 18 && f['2560x1440'] >= 20, 'effective body text >= 18px at 1080p / 20px at 1440p ' + JSON.stringify(f)); }
if (fails) { console.log(fails + ' font/overflow problems'); process.exit(1); } console.log('fonts ok');
