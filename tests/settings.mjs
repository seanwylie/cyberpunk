// Settings modal e2e: tabs, remembered tab, keyboard nav + Esc, every control persists (across reload) and takes effect,
// destructive actions need confirmation, and the panel never clips at desktop and touch sizes.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('ok   ' + m); };

for (const [w, h, touch] of [[1280, 720, 0], [1920, 1080, 0], [844, 390, 1]]) {
  const tag = `${w}x${h}`;
  const { browser, page, errors } = await launch({ viewport: { width: w, height: h }, touch: !!touch, dpr: touch ? 2 : 1, query: touch ? '?touch=1&splash=hold' : '?splash=hold' });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { document.getElementById('splash')?.remove(); window.__game.enterTown(); });
  const st = () => ev(() => JSON.parse(JSON.stringify(window.__game.save.settings)));
  const open = async () => { await ev(() => window.__ui.open('settings')); await sleep(150); };
  const tab = async id => { await page.click(`#stab-${id}`); await sleep(100); };
  const seg = async (k, v) => { await page.click(`[data-act="s-seg"][data-in="${k}"][data-v="${v}"]`); await sleep(80); };
  const tog = async k => { await page.click(`label[for="s-${k}"]`); await sleep(80); };
  const range = async (k, v) => { await ev(([k, v]) => { const el = document.getElementById('s-' + k); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [k, v]); await sleep(80); };
  const noClip = async name => { const bad = await ev(() => { const out = []; const win = document.querySelector('.settingswin'); if (!win) return ['no window']; const wr = win.getBoundingClientRect(); if (wr.bottom > innerHeight + 1 || wr.right > innerWidth + 1 || wr.left < -1 || wr.top < -1) out.push('window outside viewport'); const sb = document.querySelector('.sbody'); const sr = sb.getBoundingClientRect();
      for (const el of sb.querySelectorAll('*')) { const cs = getComputedStyle(el); if (cs.display === 'none' || !el.getClientRects().length) continue; const r = el.getBoundingClientRect(); if (r.width && r.right > sr.right + 1) out.push('overflows right: ' + el.className + ' ' + (el.textContent || '').slice(0, 30)); if (cs.overflowX === 'visible' && el.scrollWidth > el.clientWidth + 1 && el.children.length === 0 && el.tagName !== 'INPUT') out.push('text wider than box: ' + el.className + ' ' + (el.textContent || '').slice(0, 30)); if (el.tagName === 'BUTTON' && r.height < 28) out.push('tiny hit area ' + Math.round(r.height) + 'px: ' + el.textContent.slice(0, 20)); }
      if (sb.scrollWidth > sb.clientWidth + 1) out.push('horizontal scroll'); return out; }); ok(bad.length === 0, `${tag} ${name}: no clipping / hit areas ok ${bad.join('; ')}`); };

  await open();
  const tabs = await ev(() => [...document.querySelectorAll('[role=tab]')].map(t => t.textContent));
  ok(JSON.stringify(tabs) === JSON.stringify(['Gameplay', 'Display & UI', 'Audio', 'Controls', 'Instance', 'Story AI', 'About & Data']), `${tag} tab rail has the 7 sections`);
  await noClip('gameplay');

  // ---- Gameplay ----
  await seg('gore', 'bloody'); await seg('lootlabels', 'all'); await seg('lootmin', 'purple'); await tog('dmgnum'); await tog('recnudge'); await tog('rechide');
  let s = await st(); ok(s.gore === 'bloody' && s.lootLabels === 'all' && s.lootMin === 'purple' && s.damageNumbers === true && s.recNudge === false && s.recHidden === true, `${tag} gameplay controls update settings`);
  ok(await ev(() => document.querySelector('[data-in=gore][data-v=bloody]').getAttribute('aria-checked') === 'true' && document.getElementById('s-dmgnum').checked), `${tag} controls reflect state after re-render`);
  await seg('gore', 'off'); await seg('lootlabels', 'near'); await seg('lootmin', 'grey'); await tog('dmgnum'); await tog('recnudge'); await tog('rechide');

  // ---- Display ----
  await tab('display'); await noClip('display');
  const fs0 = await ev(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs')));
  await seg('uisize', 'XL'); const fs1 = await ev(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs')));
  await seg('uisize', 'S'); const fs2 = await ev(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs')));
  ok((touch || (fs1 > fs0 && fs2 < fs0)) && (await st()).uiSize === 'S', `${tag} UI size changes the type scale (${fs2} < ${fs0} < ${fs1})`);
  await noClip('display at S'); await seg('uisize', 'XL'); await noClip('display at XL'); await seg('uisize', 'M');
  await tog('minimap'); ok((await st()).minimap === false, `${tag} minimap switch persists`); await tog('minimap');
  await tog('reduced'); ok((await st()).reducedFx === true && await ev(() => document.body.classList.contains('reducefx')), `${tag} reduced effects persists and applies`); await tog('reduced');

  // ---- Audio ----
  await tab('audio'); await noClip('audio');
  await range('vol', .35); await range('musicvol', .4); await range('sfxvol', .25);
  s = await st(); ok(s.volume === .35 && s.musicVol === .4 && s.sfxVol === .25, `${tag} three volume sliders persist (${s.volume}/${s.musicVol}/${s.sfxVol})`);
  ok(await ev(() => ['vol', 'musicvol', 'sfxvol'].map(k => document.getElementById('o-' + k).textContent).join() === '35%,40%,25%'), `${tag} sliders show value readouts`);
  const au = await ev(() => { const a = window.__audio; return { vol: a.vol, mv: a.musicVol, sv: a.sfxVol, sg: a.sfxBus ? +a.sfxBus.gain.value.toFixed(3) : null, mg: a.master ? +a.master.gain.value.toFixed(3) : null }; });
  ok(au.vol === .35 && au.mv === .4 && au.sv === .25 && (au.sg === null || Math.abs(au.sg - .2) < .01) && (au.mg === null || Math.abs(au.mg - .35) < .01), `${tag} volumes reach the audio engine ${JSON.stringify(au)}`);
  await tog('music'); s = await st(); ok(s.music === false && await ev(() => window.__audio.musicOn === false), `${tag} music switch mutes`); await tog('music');
  await page.click('[data-act="s-preview"]');

  // ---- Controls ----
  await tab('controls'); await noClip('controls');
  const caps = await ev(() => [...document.querySelectorAll('.krow kbd')].map(k => k.textContent).join(' '));
  ok(/W A S D/.test(caps) && /Q E R/.test(caps) && /Space/.test(caps) && /\bF\b/.test(caps) && /\bC\b/.test(caps) && /\bT\b/.test(caps) && /\bB\b/.test(caps) && /\bI\b/.test(caps) && /\bX\b/.test(caps), `${tag} controls tab lists key caps`);
  await tog('joyfixed'); ok((await st()).joystickFixed === true, `${tag} fixed joystick persists`); await tog('joyfixed');

  // ---- Story AI ----
  await tab('story'); await noClip('story');
  ok(/Offline mock/.test(await ev(() => document.querySelector('.sbadge').textContent)), `${tag} story tab shows mock status`);
  ok(await ev(() => document.querySelector('[data-in=llmurl]').disabled), `${tag} provider fields disabled until enabled`);
  await page.click('[data-act="s-test"]'); await sleep(120); ok(/Mock: OK/.test(await ev(() => document.querySelector('.stest').textContent)), `${tag} test connection works for the mock`);
  await tog('llmon'); await page.fill('[data-in=llmurl]', 'http://127.0.0.1:59999/v1/chat/completions'); await page.fill('[data-in=llmkey]', 'k-test'); await page.fill('[data-in=llmmodel]', 'm1');
  s = await st(); ok(s.llm.enabled && s.llm.url.includes('127.0.0.1') && s.llm.key === 'k-test' && s.llm.model === 'm1', `${tag} provider fields persist while typing (focus kept)`);
  ok(/Real provider active/.test(await ev(() => document.querySelector('.sbadge').textContent)), `${tag} badge flips to real provider`);
  await page.click('[data-act="s-test"]'); await page.waitForFunction(() => /Could not reach|HTTP/.test(document.querySelector('.stest').textContent), null, { timeout: 15000 }); ok(true, `${tag} test connection reports failure for a dead endpoint`);
  await page.fill('[data-in=llmurl]', ''); await page.fill('[data-in=llmkey]', ''); await page.fill('[data-in=llmmodel]', ''); await tog('llmon');

  // ---- Instance ----
  await ev(() => { const g = window.__game; g.save.settings.devFreeReset = false; g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.level = 12; g.startRun('annex'); window.__ui.open(null); g.enterTown(); }); await sleep(100);
  const hasInst = await ev(() => !!window.__game.save.instance);
  await open(); await tab('instance'); await noClip('instance');
  if (hasInst) {
    await page.click('[data-act="s-ask"][data-c="reset"]'); ok(await ev(() => !!document.querySelector('.sconf [data-act="s-reset-go"]')) && !!(await ev(() => window.__game.save.instance)), `${tag} reset asks to confirm and does nothing yet`);
    await page.keyboard.press('Escape'); ok(await ev(() => !document.querySelector('.sconf') && window.__ui.modal === 'settings'), `${tag} Esc cancels the confirmation first`);
    await page.click('[data-act="s-ask"][data-c="abandon"]'); await page.click('[data-act="s-cancel"]'); ok(!!(await ev(() => window.__game.save.instance)), `${tag} cancel keeps the instance`);
    await page.click('[data-act="s-ask"][data-c="abandon"]'); await page.click('[data-act="s-abandon-go"]'); ok(await ev(() => !window.__game.save.instance), `${tag} confirmed abandon ends the instance`);
  } else ok(false, `${tag} could not start an instance for the test`);

  // ---- About & Data ----
  await tab('about'); await noClip('about');
  ok(await ev(() => document.getElementById('sadv').hidden), `${tag} Advanced is collapsed by default`);
  await page.click('[data-act="s-adv"]'); ok(await ev(() => !document.getElementById('sadv').hidden && document.querySelector('.sadv').getAttribute('aria-expanded') === 'true'), `${tag} Advanced expands`);
  await noClip('about advanced open');
  await tog('devreset'); ok((await st()).devFreeReset === true && /PROTOTYPE:/.test(await ev(() => document.getElementById('modal').textContent)), `${tag} prototype toggle lives in Advanced and persists`); await tog('devreset');
  await page.click('[data-act="s-ask"][data-c="wipe1"]'); ok(await ev(() => !!document.querySelector('[data-act="s-wipe-2"]') && !document.querySelector('[data-act="s-wipe-go"]')), `${tag} wipe needs a first confirm`);
  await page.click('[data-act="s-wipe-2"]'); ok(await ev(() => !!document.querySelector('[data-act="s-wipe-go"]')), `${tag} wipe needs a second confirm`);
  await page.keyboard.press('Escape'); ok(await ev(() => !document.querySelector('[data-act="s-wipe-go"]') && localStorage.length > 0), `${tag} Esc backs out of the wipe, save intact`);

  // ---- keyboard + remembered tab ----
  await tab('gameplay'); await page.focus('#stab-gameplay'); await page.keyboard.press('ArrowDown'); await sleep(80);
  ok(await ev(() => document.activeElement.id === 'stab-display' && document.querySelector('.stab.on').id === 'stab-display'), `${tag} arrow keys move through tabs`);
  await page.keyboard.press('End'); await sleep(80); ok(await ev(() => document.querySelector('.stab.on').id === 'stab-about'), `${tag} End goes to last tab`);
  await tab('gameplay'); await page.focus('[data-in=gore][data-v=standard]'); await page.keyboard.press('ArrowRight'); await sleep(80);
  ok((await st()).gore === 'bloody' && await ev(() => document.activeElement.dataset.v === 'bloody'), `${tag} arrow keys move through a segmented control and keep focus`); await seg('gore', 'standard');
  await tab('audio'); await ev(() => window.__ui.close()); await open(); ok(await ev(() => document.querySelector('.stab.on').id === 'stab-audio'), `${tag} last tab is remembered`);
  await page.keyboard.press('Escape'); ok(await ev(() => window.__ui.modal === null), `${tag} Esc closes Settings`);

  // ---- persistence across reload ----
  await open(); await tab('gameplay'); await seg('gore', 'bloody'); await tab('audio'); await range('sfxvol', .5); await ev(() => window.__ui.close());
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__game); await ev(() => document.getElementById('splash')?.remove());
  s = await st(); ok(s.gore === 'bloody' && s.sfxVol === .5 && s.volume === .35 && s.musicVol === .4, `${tag} settings survive a reload`);
  ok(await ev(() => window.__audio.sfxVol === .5 && window.__audio.musicVol === .4), `${tag} saved volumes applied to audio on boot`);
  const errs = errors.filter(e => !/ERR_CONNECTION_REFUSED/.test(e)); ok(errs.length === 0, `${tag} no console errors ${errs.join(';')}`);
  await browser.close();
}
if (fails) { console.log(fails + ' settings failures'); process.exit(1); } console.log('settings ok');
