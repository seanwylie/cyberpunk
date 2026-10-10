// UI text audit: every screen at 3 desktop sizes + touch landscape. Fails if any text overflows/clips
// (text bbox outside its clipping ancestor / its own box / the viewport) and if desktop sizes fall below minimums.
// Set SHOTS=<dir> (and TAG=before|after) to also write screenshots.
import { launch, sleep } from './lib.mjs';
import fs from 'fs';
const SHOTS = process.env.SHOTS, TAG = process.env.TAG || 'after'; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } };
const SIZES = [[1280, 720], [1920, 1080], [1366, 768], [844, 390]];

const check = () => {
  const bad = []; const vw = innerWidth, vh = innerHeight;
  const vis = e => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && e.getClientRects().length; };
  const desc = e => (e.id ? '#' + e.id : '') + '.' + String(e.className && e.className.baseVal === undefined ? e.className : '').split(' ').join('.') + '<' + e.tagName.toLowerCase() + '> "' + (e.textContent || '').trim().slice(0, 30) + '"';
  let minPx = 99, minWhat = '';
  const roots = ['#hud', '#modal', '#splash'].map(s => document.querySelector(s)).filter(Boolean);
  for (const root of roots) for (const el of root.querySelectorAll('*')) {
    if (!vis(el)) continue; const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()); if (!own.length) continue;
    // skip things that are transient animation (toasts fade) or off by design
    if (el.closest('#abtip') === null && el.closest('.toast')) continue;
    const fsz = parseFloat(getComputedStyle(el).fontSize); if (fsz < minPx) { minPx = fsz; minWhat = desc(el); }
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
  // scroll containers must not scroll horizontally
  for (const el of document.querySelectorAll('#modal *, #hud *')) if (vis(el)) { const s = getComputedStyle(el); if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) bad.push('horizontal scroll: ' + desc(el)); }
  return { bad: [...new Set(bad)], minPx, minWhat };
};

for (const [w, h] of SIZES) {
  const touch = w < 1000; const tag = `${w}x${h}`;
  const { browser, page, errors } = await launch({ viewport: { width: w, height: h }, touch, dpr: touch ? 2 : 1, query: touch ? '?touch=1&splash=hold' : '?splash=hold' });
  const ev = (f, a) => page.evaluate(f, a);
  const step = async (name, prep, arg) => { if (prep) await ev(prep, arg); await sleep(350); const r = await ev(check);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${TAG}-${tag}-${name}.png` });
    for (const b of r.bad) ok(false, `${tag} ${name}: ${b}`);
    if (!touch) { ok(r.minPx >= 12 - 0.01, `${tag} ${name}: smallest text ${r.minPx}px (${r.minWhat}) < 12px`); }
    return r; };
  await sleep(600);
  await step('01-splash');
  await ev(() => { document.getElementById('splash')?.remove(); window.__ui.kit('A', true); });
  await step('02-town');
  const open = (name, m) => step(name, m => { const u = window.__ui; u.modal = m; u.render(); }, m);
  await step('03-locker', () => { window.__ui.resetDraft(); window.__ui.modal = 'locker'; window.__ui.render(); });
  await step('04-locker-draft', () => { const u = window.__ui; u.draft.torso.chips.push('power'); u.draft.armR.chips.push('speed'); u.render(); });
  await open('05-vendor', 'vendor');
  await open('06-dungeon-select', 'gate');
  await open('07-contacts', 'contacts');
  await open('08-fixer', 'fixer');
  await open('09-store', 'store');
  await open('10-settings-about', 'settings');
  await ev(() => { window.__ui.modal = null; window.__ui.render(); window.__game.startRun(); window.__game.dbg.god = true; window.__game.revealing = false; });
  await sleep(800);
  await step('11-hud-run', () => { const u = window.__ui; u.toast('Picked up: Overclocked Servo (rare)'); u.toast('Objective updated'); u.banner('Foundry', 'Clear the floor and reach the boss', 30); });
  await step('12-hud-enemies-loot', () => { const g = window.__game; g.heat = 70; for (const t of ['worker', 'worker']) { const e = g.spawnEnemy(t, g.px + 3, g.py + 1); } });
  await step('13-live-pack', () => window.__ui.toggleLive());
  await step('14-dialog', () => { window.__ui.toggleLive(); window.__ui.showDialog({ title: 'Annex security terminal', body: 'ACCESS DENIED. Requires hacking hardware.\n\nA scrawled note: the audit command selects the Neural Warden as the boss for this run.', options: [{ label: 'Close' }, { label: 'Issue the audit command (selects the Neural Warden)' }] }); });
  await step('15-down-panel', () => { document.getElementById('dialog').style.display = 'none'; window.__ui.showDown({ broke: 'armL', defib: true }); });
  await step('16-summary', () => { document.getElementById('downpanel').style.display = 'none'; const u = window.__ui; u.modal = 'summary'; u.render(); });
  ok(errors.length === 0, `${tag}: console errors ${errors.join(';')}`);
  await browser.close();
}
if (fails) { console.log(fails + ' font/overflow problems'); process.exit(1); } console.log('fonts ok');
