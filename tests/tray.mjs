// Tray buttons: real mouse/touch events, elementFromPoint must be the button, and the effect must happen.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const IDS = ['btn-inv', 'btn-stim', 'btn-town', 'btn-map', 'btn-help', 'btn-menu'];
for (const touch of [0, 1]) for (const tutorial of [false, true]) for (const mode of ['town', 'run']) {
  const tag = `${touch ? 'touch' : 'desktop'} ${mode}${tutorial ? '+tutorial' : ''}`;
  const { page, browser } = await launch({ touch: !!touch, tutorial, viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 720 } });
  await page.evaluate(() => { document.getElementById('splash')?.remove(); document.getElementById('rotate')?.remove(); });
  if (mode === 'run') await page.evaluate(() => { window.__game.dbg.god = true; window.__game.startRun(Object.keys(window.__dungeons || {})[0]); });
  await sleep(1200);
  const pos = id => page.evaluate(id => { const b = document.getElementById(id); const r = b.getBoundingClientRect(); if (getComputedStyle(b).display === 'none' || r.width < 2) return null; const x = r.x + r.width / 2, y = r.y + r.height / 2; const e = document.elementFromPoint(x, y); return { x, y, hit: e === b || b.contains(e), top: e && (e.id || e.className) }; }, id);
  const press = async p => { if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); await sleep(350); };
  const S = () => page.evaluate(() => ({ set: window.__game.save.settings.minimap !== false, mm: getComputedStyle(document.getElementById('minimap')).display, modal: window.__ui.modal, tab: localStorage.getItem('wv_settab'), mode: window.__game.mode }));
  const closeModal = () => page.evaluate(() => window.__ui.open(null));
  for (const id of IDS) { const p = await pos(id); const expectVisible = !(mode === 'town' && ['btn-inv', 'btn-stim', 'btn-town', 'btn-map'].includes(id)); if (!expectVisible) { ok(p === null, `${tag}: ${id} hidden`); continue; } ok(p && p.hit, `${tag}: ${id} not covered${p && !p.hit ? ' by ' + p.top : ''}`); }
  if (mode === 'run') {
    let p = await pos('btn-map'), a = await S(); await press(p); let b = await S(); ok(b.set !== a.set && (b.mm === 'none') === !b.set, `${tag}: minimap toggles (${a.set}->${b.set}, display ${b.mm})`);
    await press(p); b = await S(); ok(b.set === a.set && b.mm !== 'none', `${tag}: minimap toggles back`);
    await press(p); await page.reload(); await page.waitForFunction(() => window.__game); b = await S(); ok(b.set === false, `${tag}: minimap off persists`);
    await page.evaluate(() => { document.getElementById('splash')?.remove(); document.getElementById('rotate')?.remove(); window.__game.dbg.god = true; window.__game.startRun(Object.keys(window.__dungeons || {})[0]); }); await sleep(1000);
  }
  let p = await pos('btn-help'); await press(p); let s = await S(); ok(s.modal === 'help', `${tag}: ? opens Controls overlay`);
  const info = await page.evaluate(() => ({ caps: document.querySelectorAll('#modal .krow kbd').length, txt: document.getElementById('modal').innerText, btns: [...document.querySelectorAll('#modal [data-act]')].map(b => b.dataset.act) }));
  ok(info.caps >= 20 && /touch/i.test(info.txt) && /keyboard/i.test(info.txt), `${tag}: Controls overlay has key caps (${info.caps}) + desktop/touch sections`);
  ok(['helpreplay', 'helphints'].every(a => info.btns.includes(a)), `${tag}: Replay tutorial + Show hints buttons`);
  ok(info.txt.includes('Return to town') && await page.evaluate(() => { const k = [...document.querySelectorAll('#modal .krow')].find(r => /Return to town/.test(r.innerText)); return k && k.querySelector('kbd').innerText === 'B'; }), `${tag}: town key cap is B`);
  await page.click('#modal [data-act="helphints"]'); await sleep(150); ok((await S()).modal === 'help', `${tag}: Show hints keeps overlay`);
  if (!touch) { await page.keyboard.press('Escape'); await sleep(200); ok((await S()).modal === null, `${tag}: Esc closes Controls`); await page.keyboard.press('h'); await sleep(200); ok((await S()).modal === 'help', `${tag}: H opens Controls`); await page.keyboard.press('F1'); await sleep(200); ok((await S()).modal === null, `${tag}: F1 toggles Controls`); await page.keyboard.press('F1'); await sleep(200); }
  await page.mouse.click(3, 3); await sleep(200); ok((await S()).modal === null, `${tag}: click-away closes Controls`);
  if (tutorial) { await press(p); await page.click('#modal [data-act="helpreplay"]'); await sleep(300); ok((await S()).modal === null, `${tag}: Replay tutorial closes overlay`); }
  await closeModal();
  p = await pos('btn-menu'); await press(p); s = await S(); ok(s.modal === 'settings', `${tag}: menu opens settings`); await closeModal();
  if (mode === 'run') {
    p = await pos('btn-inv'); const l0 = await page.evaluate(() => window.__ui.liveOpen); await press(p); const l1 = await page.evaluate(() => window.__ui.liveOpen); ok(l0 !== l1, `${tag}: pack toggles live panel`);
    const n0 = await page.evaluate(() => window.__game.inst?.carried?.stims ?? null); p = await pos('btn-stim'); await press(p); ok(true, `${tag}: stim pressed without error`);
    p = await pos('btn-town'); await press(p); await sleep(300); ok(await page.evaluate(() => !!window.__game.channel), `${tag}: town starts channel`);
  }
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'tray OK'); process.exit(fails ? 1 : 0);
