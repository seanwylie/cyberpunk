// HUD tuning: scale baseline, hint fade-once, wrapped ability captions, minimap toggle (N / settings), tray buttons uniform + tooltips.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } };
for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  const { browser, page, errors } = await launch({ viewport: { width: w, height: h }, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a); const t = `${w}x${h}`;
  await ev(() => { localStorage.removeItem('wv_hints'); document.getElementById('splash')?.remove(); window.__game.startRun(); window.__game.dbg.god = true; window.__game.revealing = false; }); await sleep(900);
  const fs = await ev(() => parseFloat(getComputedStyle(document.querySelector('#modal')).fontSize) || 0); void fs;
  ok(await ev(() => +getComputedStyle(document.documentElement).getPropertyValue('--fs') <= 1.1 * 1.06), `${t} scale capped`);
  ok(await ev(() => document.getElementById('hint').classList.contains('show')), `${t} hint shown on first run`);
  await ev(() => { window.__ui.hintUntil = performance.now() - 1; }); await sleep(300);
  ok(await ev(() => !document.getElementById('hint').classList.contains('show')), `${t} hint fades after first time`);
  ok(await ev(() => !!JSON.parse(localStorage.getItem('wv_hints') || '{}').run), `${t} hint flag persisted`);
  await page.hover('#btn-help'); await sleep(150); ok(await ev(() => document.getElementById('hint').classList.contains('show')), `${t} hint reappears on ? hover`); await page.mouse.move(5, 300); await sleep(150);
  const ab = await ev(() => { const n = [...document.querySelectorAll('.abtn .aname')].filter(e => e.textContent); const a = document.querySelector('.abtn'); return { oneNames: n.map(e => [e.textContent, getComputedStyle(e).textOverflow, getComputedStyle(e).whiteSpace, e.scrollWidth <= e.clientWidth + 1, e.getBoundingClientRect().height]), size: a.getBoundingClientRect().width }; });
  ok(ab.size <= 66 && ab.size >= 46, `${t} ability buttons compact (${ab.size})`); for (const [nm, to, ws, fit] of ab.oneNames) { ok(to !== 'ellipsis' && ws === 'normal' && fit, `${t} caption wraps not truncates: ${nm}`); }
  ok(ab.oneNames.some(x => x[4] > 20), `${t} some caption wraps to 2 lines`);
  const tray = await ev(() => [...document.querySelectorAll('#topright .tbtn')].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return [r.width, r.height, b.querySelector('.tt')?.textContent]; }));
  ok(tray.length >= 4 && tray.every(x => Math.abs(x[0] - tray[0][0]) < 1 && Math.abs(x[1] - x[0]) < 1 && x[0] >= 36 && x[0] <= 44), `${t} tray buttons uniform 36-44px ${JSON.stringify(tray)}`);
  ok(tray.every(x => x[2] && /[A-Z?]/.test(x[2])), `${t} tray tooltips have label+hotkey`);
  await page.hover('#btn-menu'); ok(await ev(() => getComputedStyle(document.querySelector('#btn-menu .tt')).display === 'block'), `${t} tooltip on hover`); await page.mouse.move(5, 300);
  // minimap
  await sleep(200); ok(await ev(() => document.getElementById('minimap').style.display === 'block'), `${t} minimap default on`);
  await page.keyboard.press('n'); await sleep(200); ok(await ev(() => document.getElementById('minimap').style.display === 'none' && window.__game.save.settings.minimap === false), `${t} N hides minimap`);
  ok(await ev(() => document.getElementById('objective').style.display === 'block' && !!window.__game.guidance()), `${t} objective guidance still works with minimap off`);
  await page.click('#btn-map'); await sleep(200); ok(await ev(() => document.getElementById('minimap').style.display === 'block'), `${t} tray button toggles minimap`);
  await ev(() => { window.__ui.modal = 'settings'; window.__ui.render(); }); ok(await ev(() => !!document.querySelector('[data-in=minimap]') && document.querySelector('[data-in=uisize]').value === 'M'), `${t} settings has minimap toggle, UI size defaults Medium`);
  ok(errors.length === 0, `${t} errors ${errors.join(';')}`); await browser.close();
}
if (fails) { console.log(fails + ' hud problems'); process.exit(1); } console.log('hud_tune ok');
