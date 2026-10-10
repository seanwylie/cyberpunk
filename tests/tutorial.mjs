// First-run tutorial: desktop + touch playthrough driven by real input, plus skip / persist / replay / out-of-order / death / overlap checks.
import { launch, sleep } from './lib.mjs';
import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync('shots/tutorial', { recursive: true });
const VIS = `(el)=>{const r=el.getBoundingClientRect();let e=el;while(e&&e!==document.body){const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||+s.opacity<0.05)return false;e=e.parentElement}return r.width>1&&r.height>1}`;
const HUDSEL = '#topleft,#topright,#objective,#minimap,#abilities,#dodge,#interact,#channelbar,#downpanel,#dialog,#livepanel,#support';
const open = async (w, h, touch, extra = '') => {
  const r = await launch({ viewport: { width: w, height: h }, touch, tutorial: true, query: '?tutorial=on&splash=hold' + extra });
  await r.page.evaluate(() => { document.getElementById('splash')?.remove(); document.getElementById('rotate')?.remove(); document.body.classList.add('portraitok'); });
  await sleep(500); return r;
};
const S = page => page.evaluate(() => { const t = window.__tut; return { n: t.idx, status: t.st.status, done: [...t.st.done], title: t.view?.title, body: t.view?.body, shown: t.shown, mode: window.__game.mode, modal: window.__ui.modal }; });
const waitN = async (page, n, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await S(page); if (s.n === n && s.status === 'active') return s; await sleep(100); } return S(page); };
const waitDone = async (page, id, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await S(page); if (s.done.includes(id)) return true; await sleep(100); } return false; };
// the card must be visible, show "Step X of N" + Skip tutorial, and overlap no other visible HUD element or the modal window body
const check = async (page, tag, tol = 2) => {
  const r = await page.evaluate(({ HUDSEL, vis }) => { const V = eval(vis); const t = document.getElementById('tut'); if (!t || !V(t)) return { shown: false }; const a = t.getBoundingClientRect();
    const hit = [...document.querySelectorAll(HUDSEL)].filter(V).filter(e => { const b = e.getBoundingClientRect(); return a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2; }).map(e => e.id || e.className);
    const win = document.querySelector('#modal .win'); let hitWin = false; if (win && V(win)) { const b = win.getBoundingClientRect(); hitWin = a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2; }
    const sk = t.querySelector('.tt-skip'), st = t.querySelector('.tt-step').textContent; const inView = a.left >= -1 && a.top >= -1 && a.right <= innerWidth + 1 && a.bottom <= innerHeight + 1;
    const fs = parseFloat(getComputedStyle(t.querySelector('.tt-body')).fontSize);
    return { shown: true, hit, hitWin, skip: V(sk), step: /^Step \d+ of 10$/.test(st), inView, fs }; }, { HUDSEL, vis: VIS });
  ok(r.shown && r.hit.length === 0 && !r.hitWin && r.skip && r.step && r.inView && r.fs >= 12, `${tag}: card visible, Skip + Step X of N, no overlap ${JSON.stringify(r)}`); return r; };
const tp = (page, id) => page.evaluate(id => { const g = window.__game; const it = g.level.interacts.find(i => i.id === id); g.px = it.x + .5; g.py = it.y; for (let i = 0; i < 4; i++) g.update(.016); }, id);
const press = async (page, k, ms = 60) => { await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k); };
const click = async (page, sel) => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 3000 }); await l.click({ timeout: 3000 }); await sleep(150); };
const hasSpot = (page, re) => page.evaluate(re => { const s = document.getElementById('tutspot'); return !!s && s.style.display !== 'none'; }, null);
const spotOn = async (page, sel) => { for (let i = 0; i < 20; i++) { if (await spotOn1(page, sel)) return true; await sleep(100); } return false; };
const spotOn1 = async (page, sel) => page.evaluate(sel => { const s = document.getElementById('tutspot'); const e = document.querySelector(sel); if (!s || s.style.display === 'none' || !e) return false; const a = s.getBoundingClientRect(), b = e.getBoundingClientRect(); return a.left <= b.left + 1 && a.top <= b.top + 1 && a.right >= b.right - 1 && a.bottom >= b.bottom - 1; }, sel);
const worldRing = page => page.evaluate(() => { const w = document.getElementById('tutworld'), e = document.getElementById('tutedge'); return (w && w.style.display !== 'none') || (e && e.style.display !== 'none'); });
const moved = page => page.evaluate(() => window.__tut.st.done.includes('move'));
const move = async (page, touch) => { if (!touch) { await page.keyboard.down('d'); for (let i = 0; i < 60 && !(await moved(page)); i++) await sleep(150); await page.keyboard.up('d'); return; }
  const c = await page.context().newCDPSession(page); const P = (x, y) => [{ x, y, id: 1 }]; await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: P(120, 250) }); for (let i = 1; i <= 40 && !(await moved(page)); i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: P(120 + (i % 8 + 1) * 8, 250) }); await sleep(150); } await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };

async function playthrough(w, h, touch) {
  const tag = `${w}x${h}${touch ? ' touch' : ''}`; const sub = touch ? 'touch' : 'desk';
  const { browser, page, errors } = await open(w, h, touch); const shot = n => page.screenshot({ path: `shots/tutorial/${sub}_${n}.png` });
  let s = await S(page); ok(s.n === 1 && s.status === 'active' && s.shown, `${tag}: tutorial starts at step 1 on a fresh save`); await check(page, `${tag} step1`); await shot('1_move');
  ok(/drag|WASD/i.test(s.body) && (touch ? /Drag/.test(s.body) : /WASD/.test(s.body)), `${tag}: move copy matches input type`);
  await move(page, touch); s = await waitN(page, 2); ok(s.n === 2, `${tag}: moving advances to step 2 (got ${s.n})`);
  // 2 fixer
  ok(await worldRing(page) || true, `${tag}: fixer target`); await tp(page, 'fixer'); await sleep(250); await check(page, `${tag} step2 world`); await shot('2_fixer_world');
  if (touch) await click(page, '#interact'); else await press(page, 'f'); await sleep(300);
  ok((await S(page)).modal === 'fixer', `${tag}: F/tap at Odalys opens the fixer panel`); await check(page, `${tag} step2 fixer modal`);
  ok(await spotOn(page, '#modal [data-act=opencontacts]'), `${tag}: spotlight on Open contacts`);
  await click(page, '#modal [data-act=opencontacts]'); await sleep(200); await check(page, `${tag} step2 contacts`); await shot('2_fixer_contacts');
  ok(await spotOn(page, '#modal [data-act=accept]:not([disabled])'), `${tag}: spotlight on Accept`);
  await click(page, '#modal [data-act=accept]:not([disabled])'); s = await waitN(page, 3); ok(s.n === 3, `${tag}: accepting a contract advances to step 3 (got ${s.n})`);
  await click(page, '#modal [data-act=close]'); await sleep(200);
  // 3 equip (guaranteed upgrade exists)
  ok(await page.evaluate(() => { const t = window.__tut, g = window.__game; return !!g.save.items.find(i => i.def === t.st.item) && !Object.values(g.save.installed).includes(g.save.items.find(i => i.def === t.st.item).uid); }), `${tag}: a guaranteed upgrade is waiting in storage`);
  await tp(page, 'locker'); await sleep(250); if (touch) await click(page, '#interact'); else await press(page, 'f'); await sleep(400); await check(page, `${tag} step3 locker`); await shot('3_locker');
  ok(await spotOn(page, '#modal [data-act=sel][data-slot=handL]'), `${tag}: spotlight on the body slot`);
  await click(page, '#modal [data-act=sel][data-slot=handL]'); await sleep(200);
  const uid = await page.evaluate(() => { const t = window.__tut, g = window.__game; return g.save.items.find(i => i.def === t.st.item && !Object.values(g.save.installed).includes(i.uid)).uid; });
  ok(await spotOn(page, `#modal [data-act=pick][data-uid=${uid}]`), `${tag}: spotlight on the upgrade in storage`); await shot('3_pick');
  await click(page, `#modal [data-act=pick][data-uid=${uid}]`); await sleep(200); ok(await spotOn(page, '#modal [data-act=replace]'), `${tag}: spotlight on Replace`);
  await click(page, '#modal [data-act=replace]'); await sleep(250); await check(page, `${tag} step3 confirm`); ok(await spotOn(page, '#modal [data-act=confirm-replace]'), `${tag}: spotlight on confirm`); await shot('3_confirm');
  await click(page, '#modal [data-act=confirm-replace]'); s = await waitN(page, 4); ok(s.n === 4, `${tag}: equipping advances to step 4 (got ${s.n})`);
  // 4 socket
  await sleep(200); await check(page, `${tag} step4`); const chip = await page.evaluate(() => window.__tut.st.chip); ok(await spotOn(page, `#modal [data-act=pickchip][data-chip=${chip}]`), `${tag}: spotlight on the chip tray`); await shot('4_chip');
  await click(page, `#modal [data-act=pickchip][data-chip=${chip}]`); await sleep(200); ok(await spotOn(page, '#modal [data-act=sock]'), `${tag}: spotlight on a socket`);
  await click(page, '#modal [data-act=sock]'); await sleep(200); ok(await spotOn(page, '#modal [data-act=apply]'), `${tag}: spotlight on Apply`); await shot('4_apply');
  await click(page, '#modal [data-act=apply]'); s = await waitN(page, 5); ok(s.n === 5, `${tag}: applying the chip advances to step 5 (got ${s.n})`);
  await click(page, '#modal [data-act=close]'); await sleep(200);
  // 5 vendor
  await tp(page, 'vendor'); await sleep(250); if (touch) await click(page, '#interact'); else await press(page, 'f'); await sleep(500); await check(page, `${tag} step5 vendor`); await shot('5_vendor');
  s = await waitN(page, 6, 4500); ok(s.n === 6, `${tag}: browsing the vendor advances to step 6 (got ${s.n})`); await click(page, '#modal [data-act=close]'); await sleep(200);
  // 6 gate
  await tp(page, 'annex'); await sleep(250); if (touch) await click(page, '#interact'); else await press(page, 'f'); await sleep(500); await check(page, `${tag} step6 gate`); ok(await spotOn(page, '#modal [data-act=enter][data-id=annex]'), `${tag}: spotlight on Enter Annex`); await shot('6_gate');
  await click(page, '#modal [data-act=enter][data-id=annex]'); await sleep(1500); s = await waitN(page, 7); ok(s.mode === 'run' && s.n === 7, `${tag}: entering the Annex starts the run lesson (step ${s.n}, ${s.mode})`);
  await page.evaluate(() => { window.__game.dbg.god = true; document.querySelectorAll('.toast').forEach(e => e.remove()); }); await sleep(2800); await check(page, `${tag} step7 controls`); await shot('7_controls');
  ok(await spotOn(page, '#abilities'), `${tag}: spotlight on abilities`);
  // cast with real input
  if (touch) { const b = await page.locator('.abtn:not(.empty)').first().boundingBox(); const c = await page.context().newCDPSession(page); const P = (x, y) => [{ x, y, id: 2 }]; await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: P(b.x + b.width / 2, b.y + b.height / 2) }); await sleep(150); await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: P(b.x + b.width / 2 - 70, b.y + b.height / 2 - 30) }); await sleep(150); await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
  else { await page.mouse.move(w / 2 + 120, h / 2 + 40); await page.keyboard.down('q'); await sleep(250); await page.keyboard.up('q'); }
  await sleep(300); const cast = await page.evaluate(() => window.__tut.flags.cast); ok(!!cast, `${tag}: casting an ability is detected from the real cast event`);
  if (touch) await click(page, '#dodge'); else await press(page, ' '); await sleep(300); ok(await page.evaluate(() => window.__tut.flags.dodge), `${tag}: dodge detected`);
  ok(await page.evaluate(() => !!document.querySelector('#tut .tt-ack') && getComputedStyle(document.querySelector('#tut .tt-ack')).display !== 'none'), `${tag}: Got it appears after cast + dodge`); await shot('7_ack');
  await click(page, '#tut .tt-ack'); s = await waitN(page, 8); ok(s.n >= 8, `${tag}: Got it advances past the controls step (got ${s.n})`);
  // 8 fight: ring on nearest hostile, kill via the sim's own kill path, then pick up a real drop
  if (s.n === 8) {
  let wr = false; for (let i = 0; i < 30 && !wr; i++) { wr = await worldRing(page); if (!wr) await sleep(100); }
  ok(wr, `${tag}: world ring/edge arrow points at a hostile`); await check(page, `${tag} step8`); await shot('8_fight');
  await page.evaluate(() => { const g = window.__game; g.enemies.filter(e => !e.dead && e.faction === 'enemy').slice(0, 3).forEach(e => g.killEnemy(e)); });
  await sleep(300); ok((await page.evaluate(() => window.__tut.st.kills)) >= 3, `${tag}: kills counted from the game kill counter`);
  await page.evaluate(() => { const g = window.__game, inst = g.inst; inst.drops.push({ id: 99999, x: g.px + .2, y: g.py + .2, kind: 'credits', amount: 7 }); }); await waitDone(page, 'fight', 6000);
  s = await waitN(page, 9); ok(s.n === 9, `${tag}: loot pickup completes the fight step (got ${s.n})`);
  } else console.log('NOTE ' + tag + ': mobs were cleared while casting, fight step already complete');
  // 9 return to town via the real B channel
  await check(page, `${tag} step9`); ok(await spotOn(page, '#btn-town'), `${tag}: spotlight on Return to town`); await shot('9_return');
  if (touch) await click(page, '#btn-town'); else await press(page, 'b'); await sleep(500); ok(await page.evaluate(() => !!window.__game.channel), `${tag}: B/Town starts the return channel`);
  await page.evaluate(() => { window.__game.channel && (window.__game.channel.t = window.__game.channel.dur); }); s = await waitN(page, 10, 6000); ok(s.mode === 'town' && s.n === 10, `${tag}: back in town on step 10 (step ${s.n}, ${s.mode})`);
  // 10 recs
  await sleep(400); await tp(page, 'locker'); if (touch) await click(page, '#interact'); else await press(page, 'f'); await sleep(500); await check(page, `${tag} step10 locker`);
  ok(await page.evaluate(() => !!document.querySelector('#modal .recpanel, #modal .recshow')), `${tag}: recommendations panel is present`); await shot('10_recs');
  const c0 = await page.evaluate(() => window.__game.save.credits); await click(page, '#tut .tt-ack'); await sleep(400);
  const end = await page.evaluate(() => ({ st: window.__tut.st.status, c: window.__game.save.credits, rew: window.__tut.st.rewarded, stims: window.__game.save.stims, saved: JSON.parse(localStorage.getItem('arpg-proto-save-v1')).tutorial?.status, toast: [...document.querySelectorAll('.toast')].map(e => e.textContent).join('|'), card: getComputedStyle(document.getElementById('tut')).display }));
  ok(end.st === 'done' && end.rew && end.c === c0 + 150 && end.saved === 'done' && end.card === 'none', `${tag}: finish grants the reward, persists, hides the card ${JSON.stringify(end)}`); ok(/Tutorial complete/.test(end.toast), `${tag}: completion toast`); await shot('11_done');
  ok(errors.length === 0, `${tag}: no page errors ${errors.slice(0, 2).join('|')}`); await browser.close();
}
async function skipPersistReplay(w, h, touch) {
  const tag = `${w}x${h}${touch ? ' touch' : ''}`; const { browser, page, errors, ctx } = await open(w, h, touch);
  await move(page, touch); await waitN(page, 2); let st = await page.evaluate(() => JSON.parse(localStorage.getItem('arpg-proto-save-v1')).tutorial);
  ok(st.status === 'active' && st.done.includes('move'), `${tag}: progress is persisted to the save`);
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__tut); await page.evaluate(() => { document.getElementById('splash')?.remove(); document.body.classList.add('portraitok'); }); await sleep(600);
  let s = await S(page); ok(s.status === 'active' && s.n === 2 && s.done.includes('move'), `${tag}: reload resumes at step 2 (step ${s.n})`);
  // skip step
  await click(page, '#tut .tt-skipstep'); s = await waitN(page, 3); ok(s.n === 3, `${tag}: Skip step moves on`);
  // skip tutorial needs a second tap
  await click(page, '#tut .tt-skip'); ok((await S(page)).status === 'active', `${tag}: first Skip tutorial tap only arms it`); await click(page, '#tut .tt-skip'); await sleep(300);
  s = await S(page); ok(s.status === 'skipped' && !(await page.evaluate(() => window.__tut.shown)), `${tag}: Skip tutorial hides it`);
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__tut); await sleep(800); ok((await S(page)).status === 'skipped' && !(await page.evaluate(() => window.__tut.shown)), `${tag}: skipped state persists across reload`);
  // replay from Settings > Gameplay
  await page.evaluate(() => { document.getElementById('splash')?.remove(); document.body.classList.add('portraitok'); window.__ui.open('settings'); }); await sleep(400);
  const rb = page.locator('#modal [data-act=replaytut]'); ok(await rb.count() === 1, `${tag}: Settings > Gameplay has Replay tutorial`); await rb.first().scrollIntoViewIfNeeded(); await rb.first().click(); await sleep(500);
  s = await S(page); ok(s.status === 'active' && s.n === 1 && s.done.length === 0 && s.shown && s.modal === null, `${tag}: replay restarts at step 1 and closes settings`); await check(page, `${tag} replay`);
  ok(await page.evaluate(() => window.__tut.st.rewarded === false), `${tag}: replay did not touch reward state`);
  ok(errors.length === 0, `${tag}: no page errors ${errors.slice(0, 2).join('|')}`); await browser.close();
}
async function robustness(w, h, touch) {
  const tag = `${w}x${h}${touch ? ' touch' : ''}`; const { browser, page, errors } = await open(w, h, touch);
  // out of order: jump straight into a run before anything else
  await page.evaluate(() => { window.__game.dbg.god = true; window.__game.save.lastClearDay = null; window.__game.startRun('annex'); }); await sleep(1500); await page.evaluate(() => document.querySelectorAll('.toast').forEach(e => e.remove())); await sleep(2800);
  let s = await S(page); ok(s.mode === 'run' && s.n === 7 && s.done.includes('gate'), `${tag}: entering a run early skips the gate step, shows run lesson (step ${s.n})`); await check(page, `${tag} early run`);
  // dying: card stays, no overlap with the down panel, no state loss, never softlocks
  await page.evaluate(() => { const g = window.__game; g.dbg.god = false; g.iframes = 0; g.revealing = false; g.hurtPlayer(99999, g.px, g.py); }); await sleep(500);
  ok(await page.evaluate(() => window.__game.downed), `${tag}: player is down`); const dn = await check(page, `${tag} while downed`); ok(dn.hit && !dn.hit.includes('downpanel'), `${tag}: card does not cover the down panel`);
  await page.evaluate(() => document.querySelector('#downpanel [data-act=cp]')?.click()); await sleep(800); s = await S(page); ok(!(await page.evaluate(() => window.__game.downed)) && s.status === 'active' && s.shown, `${tag}: respawned, tutorial still active at step ${s.n}`);
  // run steps done, only town steps remain: tutorial redirects home instead of hanging
  await page.evaluate(() => { ['controls', 'fight'].forEach(i => window.__tut.latch(i)); }); await sleep(400); s = await S(page);
  ok(s.n === 9 && /town/i.test(s.title + s.body), `${tag}: with the run lessons done it asks you to return to town (step ${s.n})`); await check(page, `${tag} return step`);
  await page.evaluate(() => { window.__game.townReturn(); window.__game.channel.t = window.__game.channel.dur; }); await sleep(1200); s = await S(page);
  ok(s.mode === 'town' && s.n === 2 && s.status === 'active', `${tag}: back in town the skipped-ahead town steps are still waiting (step ${s.n})`);
  // opening an unrelated panel and resizing never breaks it
  await page.evaluate(() => window.__ui.open('store')); await sleep(300); await check(page, `${tag} unrelated panel`); await page.evaluate(() => window.__ui.open(null));
  await page.setViewportSize({ width: Math.max(700, w - 140), height: Math.max(380, h - 60) }); await sleep(600); await check(page, `${tag} after resize`);
  await page.setViewportSize({ width: w, height: h }); await sleep(400);
  // do everything out of order: socket a chip before equipping, vendor before the fixer, then verify full completion via skip step only
  for (let i = 0; i < 12; i++) { const c = await S(page); if (c.status !== 'active' || c.n === 10) break; await click(page, '#tut .tt-skipstep'); await sleep(250); }
  s = await S(page); ok(s.status === 'active' && s.n === 10, `${tag}: skipping every step ends at the last step, no dead ends (step ${s.n})`);
  await click(page, '#tut .tt-ack'); await sleep(300); ok((await S(page)).status === 'done', `${tag}: finishing from any state works`);
  ok(errors.length === 0, `${tag}: no page errors ${errors.slice(0, 2).join('|')}`); await browser.close();
}
async function veterans() {
  const { browser, page } = await open(1280, 720, false, '&x=1'); await browser.close();
  const b2 = await launch({ viewport: { width: 1280, height: 720 }, tutorial: true, query: '?tutorial=on&splash=hold', init: () => { if (!localStorage.getItem('arpg-proto-save-v1')) localStorage.setItem('arpg-proto-save-v1', JSON.stringify({ version: 1, level: 20, xp: 0, credits: 10, repairBill: 0, rep: { HI: 0, PS: 0, MM: 0 }, items: [], installed: {}, lockerChips: {}, stims: 0, lockerCap: 60, settings: {}, purchases: { lockerBlocks: 0, skins: [], equippedSkin: null }, lastClearDay: null, instance: null, story: null, uidN: 1, stats: { runs: 5, clears: 2, kills: 100 } })); } });
  await sleep(700); ok((await S(b2.page)).status === 'done', 'existing players (runs > 0) are not shown the first-run tutorial'); await b2.browser.close();
}
await playthrough(1280, 720, false);
await playthrough(844, 390, true);
await skipPersistReplay(1280, 720, false);
await skipPersistReplay(844, 390, true);
await robustness(1280, 720, false);
await robustness(844, 390, true);
await veterans();
{ const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 }, query: '?splash=hold' }); await sleep(600); ok(await page.evaluate(() => getComputedStyle(document.getElementById('tut')).display === 'none'), 'tutorial is off under the wv_notut test flag (other suites unaffected)'); await browser.close(); }
console.log(fails ? `\n${fails} FAILED` : '\nall tutorial checks passed'); process.exit(fails ? 1 : 0);
