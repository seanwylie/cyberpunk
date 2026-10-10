// Locker / vendor text-fit audit. Loads the locker with the longest item + chip names in the game (incl. batch-1 and idkfa Apex gear)
// in every slot and storage tab, plus the vendor for every slot, at 1280x720, 1920x1080, 2560x1440 and touch 844x390.
// Fails on: text clipped without (2-line clamp or fit-text) AND a hover/aria full name; overlapping text boxes; text outside its container; tooltips that
// cover the inspected element or leave the viewport. Set SHOTS=<dir> TAG=before|after for screenshots of a few key states.
import { launch, sleep } from './lib.mjs';
import fs from 'fs';
const SHOTS = process.env.SHOTS, TAG = process.env.TAG || 'after'; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const seen = new Set(); const ok = (c, m) => { if (!c && !seen.has(m)) { seen.add(m); fails++; console.log('FAIL ' + m); } };
const SIZES = (process.env.ONLY ? [process.env.ONLY.split('x').map(Number)] : [[1280, 720], [1920, 1080], [2560, 1440], [844, 390]]);

const SETUP = async () => {
  const cfg = await import('/src/config.ts'), st = await import('/src/state.ts'); const g = window.__game, s = g.save;
  const longest = (arr, n) => [...arr].sort((a, b) => b.name.length - a.name.length).slice(0, n);
  const chipIds = Object.keys(cfg.CHIPS);
  s.lockerCap = 999; s.credits = 99999; s.level = 30; s.items.length = 0; s.installed = {}; s.lockerChips = {}; for (const c of chipIds) s.lockerChips[c] = 3;
  const names = { items: longest(cfg.ITEMS, 5).map(i => i.name), chips: longest(Object.values(cfg.CHIPS), 5).map(c => c.name) };
  for (const sl of cfg.SLOTS) {
    const defs = cfg.ITEMS.filter(i => i.slot === sl); const [top, ...rest] = longest(defs, 4);
    const it = st.mkInst(s, top.id); const fit = chipIds.filter(c => cfg.chipFits(c, sl)).sort((a, b) => cfg.CHIPS[b].name.length - cfg.CHIPS[a].name.length);
    for (let i = 0; i < cfg.SLOT_SOCKETS[sl]; i++) if (fit[i]) { it.chips.push(fit[i]); s.lockerChips[fit[i]]--; }
    s.items.push(it); s.installed[sl] = it.uid; for (const d of rest) s.items.push(st.mkInst(s, d.id));
  }
  for (const d of cfg.ITEMS.filter(i => /^(idkfa|b1_)/.test(i.id) || /Apex/.test(i.name))) s.items.push(st.mkInst(s, d.id));
  return { slots: cfg.SLOTS, names };
};

const CHECK = () => {
  const bad = []; const root = document.querySelector('.popwrap') || document.getElementById('modal'); if (!root) return ['no modal'];
  const vw = innerWidth, vh = innerHeight;
  const vis = e => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > .05 && e.getClientRects().length; };
  const desc = e => (e.id ? '#' + e.id : '') + '.' + String(typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).join('.') + ' "' + (e.textContent || '').trim().slice(0, 28) + '"';
  const hasName = e => !!e.closest('[data-tip],[title],[aria-label]');
  const clampOk = e => { const s = getComputedStyle(e); return (s.webkitLineClamp && s.webkitLineClamp !== 'none') || e.classList.contains('fit'); };
  const texts = [];
  for (const el of root.querySelectorAll('*')) {
    if (!vis(el)) continue; if (!([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))) continue;
    const rg = document.createRange(); rg.selectNodeContents(el); const rs = [...rg.getClientRects()].filter(r => r.width > .5 && r.height > .5); if (!rs.length) continue;
    const L = Math.min(...rs.map(r => r.left)), R = Math.max(...rs.map(r => r.right)), T = Math.min(...rs.map(r => r.top)), B = Math.max(...rs.map(r => r.bottom));
    // clipped by el itself (line clamp / ellipsis / overflow hidden)
    const cs = getComputedStyle(el);
    if (cs.overflow !== 'visible' || cs.overflowX !== 'visible') {
      const clipped = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
      if (clipped && !(el.matches('textarea,input') ) && !(/auto|scroll/.test(cs.overflowY) && el.scrollWidth <= el.clientWidth + 1)) { if (!(clampOk(el) && hasName(el))) bad.push('text clipped without clamp+tooltip: ' + desc(el)); }
    }
    let vr = { l: L, r: R, t: T, b: B }; let scrolls = false;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a), r = a.getBoundingClientRect();
      if (/auto|scroll/.test(s.overflowY)) scrolls = true;
      if (s.overflowX !== 'visible' && (R > r.right + 1 || L < r.left - 1)) { if (!(clampOk(el) && hasName(el))) bad.push('text clipped by ' + desc(a) + ' : ' + desc(el)); }
      if (s.overflowY === 'hidden' && (B > r.bottom + 1 || T < r.top - 1)) { if (!(clampOk(el) && hasName(el))) bad.push('text clipped (y) by ' + desc(a) + ' : ' + desc(el)); }
      if (s.overflowX !== 'visible') { vr.l = Math.max(vr.l, r.left); vr.r = Math.min(vr.r, r.right); } if (s.overflowY !== 'visible') { vr.t = Math.max(vr.t, r.top); vr.b = Math.min(vr.b, r.bottom); }
    }
    if (cs.overflowY !== 'visible') { const r = el.getBoundingClientRect(); vr.t = Math.max(vr.t, r.top); vr.b = Math.min(vr.b, r.bottom); } if (cs.overflowX !== 'visible') { const r = el.getBoundingClientRect(); vr.l = Math.max(vr.l, r.left); vr.r = Math.min(vr.r, r.right); }
    if (R > vw + 1 || L < -1) bad.push('outside viewport x: ' + desc(el));
    // element box overflowing its parent box (non-text-clip): text wider than its positioned container tile
    const tile = el.closest('.tile,.sock,.ctile,.rec,.row,.pchip,.tag,.btn,.repb,.pickbar,.hdrrow');
    if (tile && tile !== el) { const r = tile.getBoundingClientRect(); const own = { r: R, l: L, b: B }; if (own.r > r.right + 1.5 || own.l < r.left - 1.5 || (own.b > r.bottom + 1.5 && !scrolls)) bad.push('text overflows its box ' + desc(tile) + ' : ' + desc(el)); }
    if (vr.r - vr.l > 1 && vr.b - vr.t > 1) texts.push({ el, l: vr.l, r: vr.r, t: vr.t, b: vr.b });
    if (cs.overflow === 'visible' && el.scrollWidth > el.clientWidth + 1 && !cs.display.startsWith('inline')) bad.push('content overflows element: ' + desc(el));
  }
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) { const a = texts[i], b = texts[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t); if (ox > 1.5 && oy > 2.5) bad.push('text overlap: ' + desc(a.el) + ' <> ' + desc(b.el)); }
  for (const el of root.querySelectorAll('.tile .ticon,.tile')) { }
  return [...new Set(bad)];
};

const TIPCHECK = async (page, sel, max, tag, label) => {
  const n = await page.evaluate(s => document.querySelectorAll(s).length, sel);
  for (let i = 0; i < Math.min(n, max); i++) {
    const r = await page.evaluate(([s, i]) => { const el = document.querySelectorAll(s)[i]; el.scrollIntoView({ block: 'nearest' }); el.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true })); return true; }, [sel, i]);
    await sleep(260);
    const bad = await page.evaluate(([s, i]) => { const el = document.querySelectorAll(s)[i], t = document.getElementById('tiptile'); const out = []; if (!t || getComputedStyle(t).display === 'none') return ['tooltip not shown for ' + (el.dataset.tip || '').slice(0, 20)];
      const a = el.getBoundingClientRect(), b = t.getBoundingClientRect(); if (b.left < -1 || b.top < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1) out.push('tooltip off-screen');
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) out.push('tooltip covers inspected element'); if (t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1) out.push('tooltip content clipped'); return out; }, [sel, i]);
    for (const b of bad) ok(false, `${tag} ${label} [${sel} #${i}]: ${b}`);
    await page.evaluate(([s, i]) => document.querySelectorAll(s)[i].dispatchEvent(new PointerEvent('pointerleave', { bubbles: true })), [sel, i]);
  }
};

const SLOTS_ALL = ['face', 'brain', 'torso', 'handL', 'handR', 'armL', 'armR', 'legL', 'legR', 'footL', 'footR'];
// fresh browser per group of slots: repeated 3D icon renders under software GL can crash a long-lived page
async function session(w, h, work) {
  const touch = w < 1000, tag = `${w}x${h}`;
  const { browser, page, errors } = await launch({ viewport: { width: w, height: h }, touch, dpr: touch ? 2 : 1, query: touch ? '?touch=1&splash=hold' : '?splash=hold' });
  try {
    await sleep(500); await page.evaluate(() => { document.getElementById('splash')?.remove(); window.__ui.kit && window.__ui.kit('A', true); });
    await page.evaluate(SETUP);
    const step = async (name, prep, shot, arg) => { if (prep) await page.evaluate(prep, arg); await sleep(100); const bad = await page.evaluate(CHECK); for (const b of bad) ok(false, `${tag} ${name}: ${b}`);
      if (SHOTS && shot) await page.screenshot({ path: `${SHOTS}/${TAG}-${tag}-${name}.png` }); };
    await page.evaluate(() => { const u = window.__ui; u.resetDraft(); u.modal = 'locker'; u.chipShowAll = true; u.stTab = 'all'; u.render(); });
    await work({ page, step, tag });
    ok(errors.length === 0, `${tag}: console errors ${errors.join(';')}`);
  } catch (e) { ok(false, `${tag}: audit crashed (${String(e.message).split('\n')[0]})`); }
  await browser.close();
}
for (const [w, h] of SIZES) {
  for (let i = 0; i < SLOTS_ALL.length; i += 3) await session(w, h, async ({ page, step, tag }) => {
    for (const sl of SLOTS_ALL.slice(i, i + 3)) {
      await step('locker-' + sl, sl => { const u = window.__ui; u.sel = sl; u.pickUid = null; u.stTab = 'all'; u.render(); }, sl === 'torso' || sl === 'handR', sl);
      await step('locker-pick-' + sl, () => { const t = [...document.querySelectorAll('.stgrid .tile')].find(x => !x.classList.contains('off')) || document.querySelector('.stgrid .tile'); t && t.click(); }, sl === 'torso');
      await step('locker-replace-' + sl, () => { const b = document.querySelector('[data-act=replace]'); b && b.click(); });
      await page.evaluate(() => { const u = window.__ui; u.confirm = null; u.render(); });
      await step('vendor-' + sl, sl => { const u = window.__ui; u.confirm = null; u.modal = 'vendor'; u.shopSlot = sl; u.render(); }, sl === 'torso', sl);
      await page.evaluate(() => { const u = window.__ui; u.modal = 'locker'; u.render(); });
    }
  });
  await session(w, h, async ({ page, step, tag }) => {
    const tabs = await page.evaluate(() => [...document.querySelectorAll('[data-act=sttab]')].map(b => b.dataset.tab));
    for (const t of tabs) await step('locker-tab-' + t, t => { const u = window.__ui; u.stTab = t; u.render(); }, false, t);
    await page.evaluate(() => { const u = window.__ui; u.stTab = 'all'; u.sel = 'torso'; u.render(); });
    await TIPCHECK(page, '.body-grid .tile', 11, tag, 'locker');
    await TIPCHECK(page, '.sock.full', 3, tag, 'locker'); await TIPCHECK(page, '.ctile', 3, tag, 'locker'); await TIPCHECK(page, '.selhead', 1, tag, 'locker'); await TIPCHECK(page, '.stgrid .tile', 3, tag, 'locker'); await TIPCHECK(page, '.rec', 2, tag, 'locker');
    await page.evaluate(() => { const u = window.__ui; u.modal = 'vendor'; u.shopSlot = 'torso'; u.render(); });
    await TIPCHECK(page, '.shoprow', 2, tag, 'vendor'); await TIPCHECK(page, '.shoptabs .tile', 4, tag, 'vendor');
  });
}
if (fails) { console.log(fails + ' locker fit problems'); process.exit(1); } console.log('locker_fit ok');
