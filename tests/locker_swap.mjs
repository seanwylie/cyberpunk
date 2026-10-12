// Locker swap UX: compatible highlighting, target slot, Equip/Swap button + deltas, double-click, drag & drop, unequip, undo, chips kept/moved,
// empty-slot hints, one-time hint, keyboard, mobile viewport. SHOTS=<dir> saves screenshots (default shots/locker_swap).
import { launch, sleep } from './lib.mjs';
import fs from 'fs';
const SHOTS = process.env.SHOTS || 'shots/locker_swap'; fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

async function setup(page) {
  await page.evaluate(async () => {
    document.getElementById('splash')?.remove();
    const cfg = await import('/src/config.ts'), st = await import('/src/state.ts'); const g = window.__game, s = g.save, u = window.__ui;
    s.level = 30; s.credits = 5000; s.lockerCap = 200; for (const c of Object.keys(cfg.CHIPS)) s.lockerChips[c] = 2;
    const pick = (slot, r) => cfg.ITEMS.find(i => i.slot === slot && i.rarity === r && !/^(idkfa|b1_)/.test(i.id));
    const add = d => { const it = st.mkInst(s, d.id); s.items.push(it); return it; };
    const out = {};
    out.greenR = add(pick('armR', 'green')).uid; out.blueR = add(pick('armR', 'blue')).uid; out.purpleR = add(pick('armR', 'purple')).uid; out.greenL = add(pick('armL', 'green')).uid; out.greenT = add(pick('torso', 'green')).uid; out.blueT = add(pick('torso', 'blue')).uid;
    out.nArmR = s.items.filter(i => cfg.ITEM_BY_ID[i.def].slot === 'armR' && !Object.values(s.installed).includes(i.uid)).length;
    window.__t = out; window.__cfg = cfg; return out;
  });
}
const open = async (page) => { await page.evaluate(() => { const u = window.__ui; u.pickUid = ''; u.lastSwap = null; u.cmpOpen = false; u.keepChips = true; u.sel = 'armR'; u.open('locker'); }); await sleep(250); };
const inst = (page, slot) => page.evaluate(sl => { const s = window.__game.save; const it = s.items.find(i => i.uid === s.installed[sl]); return it ? { uid: it.uid, def: it.def, chips: [...it.chips] } : null; }, slot);
const credits = page => page.evaluate(() => window.__game.save.credits);
const clickSel = async (page, sel) => { await page.click(sel); await sleep(120); };

async function suite(label, opts) {
  const { browser, page, errors } = await launch({ viewport: opts.viewport, touch: opts.touch, query: '?splash=hold' });
  await sleep(500); await setup(page); const T = await page.evaluate(() => window.__t);
  await open(page);

  // ---- first-run hint (once)
  ok(await page.evaluate(() => !!document.querySelector('.lkhint')), `${label}: first-run hint is shown once`);
  if (opts.shot) await page.screenshot({ path: `${SHOTS}/${opts.shot}_1_first_open.png` });
  await clickSel(page, '[data-act=hintok]'); ok(await page.evaluate(() => !document.querySelector('.lkhint')), `${label}: hint dismissed with Got it`);
  await open(page); ok(await page.evaluate(() => !document.querySelector('.lkhint')), `${label}: hint does not return on next open`);

  // ---- compatible highlighting (selected slot = armR)
  const H = await page.evaluate(() => { const fits = [...document.querySelectorAll('.stgrid .st.fits')], off = [...document.querySelectorAll('.stgrid .st.off')]; return { fits: fits.length, off: off.length, offOp: off[0] ? +getComputedStyle(off[0].querySelector('.ticon')).opacity : 1, fitOp: fits[0] ? +getComputedStyle(fits[0]).opacity : 0, fitsFirst: [...document.querySelectorAll('.stgrid .st')].slice(0, fits.length).every(x => x.classList.contains('fits')), hint: document.querySelector('.slotact .hint')?.textContent || '' }; });
  ok(H.fits === 3 && H.off >= 3, `${label}: armR selected -> ${H.fits} compatible highlighted, ${H.off} dimmed`); ok(H.offOp < .5 && H.fitOp === 1 && H.fitsFirst, `${label}: dimmed tiles opacity ${H.offOp}, fits listed first`); ok(/pick one/i.test(H.hint), `${label}: slot hint explains next step ("${H.hint}")`);

  // ---- select storage item in another slot -> target slot highlighted, Equip button
  await clickSel(page, `[data-act=pick][data-uid="${T.greenL}"]`);
  const P = await page.evaluate(() => ({ tgt: document.querySelector('.body-grid .target')?.dataset.slot, glow: getComputedStyle(document.querySelector('.body-grid .target')).outlineStyle === 'solid', btn: document.querySelector('.pickbar .eqbtn')?.textContent.trim(), primary: document.querySelector('.pickbar .eqbtn')?.classList.contains('primary'), go: !!document.querySelector('.pickbar [data-act=gosel]') }));
  ok(P.tgt === 'armL' && P.glow, `${label}: picked part highlights its target slot (${P.tgt})`); ok(P.primary && /^Equip/.test(P.btn), `${label}: primary button "${P.btn}"`);

  // ---- stat deltas green/red, occupied -> "Swap with"
  await clickSel(page, `[data-act=pick][data-uid="${T.blueR}"]`);
  const D = await page.evaluate(() => ({ btn: document.querySelector('.pickbar .eqbtn')?.textContent.trim(), up: [...document.querySelectorAll('.pickbar .dchip.up')].map(x => x.textContent), dn: [...document.querySelectorAll('.pickbar .dchip.dn')].map(x => x.textContent), colors: [...document.querySelectorAll('.pickbar .dchip')].map(x => getComputedStyle(x).color) }));
  ok(D.up.length + D.dn.length > 0 && D.up.every(x => x.includes('▲')) && D.dn.every(x => x.includes('▼')), `${label}: before/after deltas shown (${D.up.concat(D.dn).join(' ')})`);
  await clickSel(page, '[data-act=cmp]'); ok(await page.evaluate(() => document.querySelectorAll('.cmpinline .crow').length >= 8), `${label}: Compare expands full before/after table`); if (opts.shot) await page.screenshot({ path: `${SHOTS}/${opts.shot}_2_pick_compare.png` }); await clickSel(page, '[data-act=cmp]');

  // ---- equip via button -> confirm -> undo (credits refunded)
  const c0 = await credits(page); const before = await inst(page, 'armR');
  await clickSel(page, '.pickbar [data-act=replace]'); ok(await page.evaluate(() => !!document.querySelector('.pop [data-act=confirm-replace]')), `${label}: Equip opens confirm`);
  ok(await page.evaluate(() => document.activeElement?.dataset?.act === 'confirm-replace'), `${label}: confirm focuses the Install button (Enter confirms)`);
  if (opts.shot) await page.screenshot({ path: `${SHOTS}/${opts.shot}_3_confirm.png` });
  await clickSel(page, '[data-act=confirm-replace]');
  const flashed = await page.evaluate(() => !!document.querySelector('.body-grid .eqflash'));
  let a = await inst(page, 'armR'); ok(flashed, `${label}: equip animation class on the slot`); ok(a.uid === T.blueR, `${label}: equip installs the picked part`); ok(await page.evaluate(() => !!document.querySelector('.undobar [data-act=undo]')), `${label}: Undo bar appears`);
  ok(await page.evaluate(() => !!document.querySelector('.toast')), `${label}: toast shown`);
  const c1 = await credits(page); ok(c1 <= c0, `${label}: credits ${c0} -> ${c1}`);
  if (opts.shot) await page.screenshot({ path: `${SHOTS}/${opts.shot}_4_equipped_undo.png` });
  await clickSel(page, '[data-act=undo]'); a = await inst(page, 'armR'); ok((a?.uid || '') === (before?.uid || ''), `${label}: undo restores the previous part`); ok((await credits(page)) === c0, `${label}: undo refunds credits`);

  // ---- chips move with a swap (default), can be returned to stock, undo restores
  await page.evaluate(({ uid }) => { const s = window.__game.save; s.installed.armR = uid; const it = s.items.find(i => i.uid === uid); const cfg = window.__cfg; const c = Object.keys(cfg.CHIPS).find(c => cfg.chipFits(c, 'armR')); it.chips = [c]; s.lockerChips[c]--; }, { uid: T.blueR });
  await open(page); await page.evaluate(u => { window.__ui.pickUid = u; window.__ui.render(); }, T.greenR);
  const lc0 = await page.evaluate(() => JSON.stringify(window.__game.save.lockerChips)); const oldUid = (await inst(page, 'armR')).uid;
  await clickSel(page, '.pickbar [data-act=replace]');
  ok(await page.evaluate(() => !!document.querySelector('.keepchips input:checked')) && await page.evaluate(() => /move to the new part/i.test(document.querySelector('.pop').textContent)), `${label}: confirm offers "move chips" (checked) with explanation`);
  await clickSel(page, '[data-act=confirm-replace]'); a = await inst(page, 'armR'); ok(a.uid === T.greenR && a.chips.length === 1, `${label}: chips moved with the swap (${a.chips.length})`);
  ok(await page.evaluate(() => JSON.stringify(window.__game.save.lockerChips)) === lc0, `${label}: chip stock unchanged when chips move`);
  await clickSel(page, '[data-act=undo]'); a = await inst(page, 'armR'); ok(a.uid === oldUid && a.chips.length === 1 && (await page.evaluate(() => JSON.stringify(window.__game.save.lockerChips))) === lc0, `${label}: undo puts chips back exactly`);
  await page.evaluate(u => { window.__ui.pickUid = u; window.__ui.render(); }, T.greenR); await clickSel(page, '.pickbar [data-act=replace]'); await clickSel(page, '.keepchips input');
  ok(await page.evaluate(() => /return to locker stock|back to locker stock/i.test(document.querySelector('.pop').textContent)), `${label}: unticking warns chips return to stock`);
  await clickSel(page, '[data-act=confirm-replace]'); a = await inst(page, 'armR'); ok(a.uid === T.greenR && a.chips.length === 0, `${label}: chips returned to stock when unticked`);
  await clickSel(page, '[data-act=undo]'); ok((await inst(page, 'armR')).chips.length === 1, `${label}: undo after chip return restores chips`);
  await page.evaluate(() => { window.__ui.keepChips = true; });

  // ---- free equip by double-click / double-tap (torso: Standard Issue -> green is free)
  await page.evaluate(() => { window.__ui.sel = 'torso'; window.__ui.render(); });
  const tsel = `[data-act=pick][data-uid="${T.greenT}"]`;
  if (opts.touch) { await page.tap(tsel); await page.tap(tsel); } else await page.dblclick(tsel); await sleep(250);
  a = await inst(page, 'torso'); ok(a.uid === T.greenT, `${label}: ${opts.touch ? 'double-tap' : 'double-click'} equips a free swap immediately`);
  await clickSel(page, '[data-act=undo]'); ok((await inst(page, 'torso')).uid !== T.greenT, `${label}: undo after quick equip`);

  // ---- paid swap by double-click shows the confirm first (blue torso over stock: free; so use armR green->blue paid)
  await page.evaluate(() => { window.__ui.sel = 'armR'; window.__ui.render(); }); const bsel = `[data-act=pick][data-uid="${T.greenR}"]`;
  if (opts.touch) { await page.tap(bsel); await page.tap(bsel); } else await page.dblclick(bsel); await sleep(250);
  ok(await page.evaluate(() => !!document.querySelector('.pop [data-act=confirm-replace]')), `${label}: double-click on a paid swap shows the confirm`); if (!(await page.evaluate(() => !!document.querySelector('.pop')))) console.log('DBG', await page.evaluate(() => JSON.stringify({ inst: window.__game.save.installed.armR, pick: window.__ui.pickUid, toasts: [...document.querySelectorAll('.toast')].map(x => x.textContent), cost: window.__ui.confirm })));
  await clickSel(page, '[data-act=cancel-confirm]'); ok((await inst(page, "armR")).uid !== T.greenR, `${label}: cancel leaves the slot unchanged`);

  // ---- unequip
  await open(page); const cu = await credits(page); const cur = await inst(page, 'armR');
  ok(await page.evaluate(() => !!document.querySelector('[data-act=unequip]')), `${label}: Unequip button on an equipped slot`);
  await clickSel(page, '[data-act=unequip]');
  if (await page.evaluate(() => !!document.querySelector('.pop'))) await clickSel(page, '[data-act=confirm-replace]'); await sleep(150);
  a = await inst(page, 'armR'); ok(a.def === 'stock_armR', `${label}: unequip installs Standard Issue (${a.def})`);
  ok(await page.evaluate(({ uid }) => window.__game.save.items.some(i => i.uid === uid), { uid: cur.uid }), `${label}: unequipped part is in storage`);
  ok(!(await page.evaluate(() => document.querySelector('[data-act=unequip]'))), `${label}: no Unequip on Standard Issue`);
  ok(await page.evaluate(() => /Standard Issue/.test(document.querySelector('.slotact .hint').textContent)), `${label}: Standard Issue hint`);
  await clickSel(page, '[data-act=undo]'); ok((await inst(page, 'armR')).uid === cur.uid && (await credits(page)) === cu, `${label}: undo unequip restores part and credits`);

  // ---- empty-slot hint
  await page.evaluate(() => { const s = window.__game.save; delete s.installed.face; window.__ui.resetDraft(); window.__ui.sel = 'face'; window.__ui.render(); });
  ok(await page.evaluate(() => /Empty - pick a part from storage/.test(document.querySelector('.slotact .hint').textContent) && /Empty - pick a part from storage/.test(document.querySelector('.body-grid [data-slot=face]').dataset.tip)), `${label}: empty slot hint`);
  await page.evaluate(() => { const s = window.__game.save; const st = s.items.find(i => i.def === 'stock_face'); if (st) s.installed.face = st.uid; window.__ui.resetDraft(); window.__ui.sel = 'armR'; window.__ui.render(); });

  // ---- keyboard: tab/arrows move, Enter picks, E equips, Enter confirms, Z undoes
  await open(page); await page.evaluate(() => { document.querySelector('.stgrid .st.fits').focus(); });
  await page.keyboard.press('ArrowRight'); ok(await page.evaluate(() => document.activeElement?.matches('.stgrid .st')), `${label}: arrow keys move between storage tiles`);
  await page.keyboard.press('Enter'); await sleep(150); ok(await page.evaluate(() => !!document.querySelector('.pickbar .eqbtn')) && await page.evaluate(() => document.activeElement?.matches('.stgrid .st')), `${label}: Enter picks and focus stays on the tile`);
  const kb0 = (await inst(page, 'armR')).uid; await page.keyboard.press('e'); await sleep(150); ok(await page.evaluate(() => !!document.querySelector('.pop [data-act=confirm-replace]')), `${label}: E opens the equip confirm`);
  await page.keyboard.press('Enter'); await sleep(250); ok((await inst(page, 'armR')).uid !== kb0, `${label}: Enter confirms`); await page.keyboard.press('z'); await sleep(150); ok((await inst(page, 'armR')).uid === kb0, `${label}: Z undoes`);
  await page.keyboard.press('u'); await sleep(150); if (await page.evaluate(() => !!document.querySelector('.pop'))) { await page.keyboard.press('Escape'); await sleep(100); ok(await page.evaluate(() => !document.querySelector('.pop') && !!document.querySelector('.lockerwin')), `${label}: Esc closes the confirm only`); }

  // ---- drag & drop (desktop)
  if (!opts.touch) {
    await page.evaluate(u => { const s = window.__game.save; s.installed.armR = u; }, T.blueR); await open(page); const before2 = (await inst(page, 'armR')).uid;
    await page.dragAndDrop(`.stgrid [data-uid="${T.greenR}"]`, '.body-grid [data-slot=armL]'); await sleep(200); ok((await inst(page, 'armR')).uid === before2, `${label}: dropping on the wrong slot does nothing`);
    await page.evaluate(() => { const s = window.__game.save; const st = s.items.find(i => i.def === 'stock_torso'); s.installed.torso = st.uid; window.__ui.sel = 'torso'; window.__ui.render(); });
    await page.dragAndDrop(`.stgrid [data-uid="${T.greenT}"]`, '.body-grid [data-slot=torso]'); await sleep(250); ok((await inst(page, 'torso')).uid === T.greenT, `${label}: drag a part onto its slot equips it`);
    await clickSel(page, '[data-act=undo]');
    await page.evaluate(() => { window.__ui.sel = 'armR'; window.__ui.render(); });
    await page.dragAndDrop('.body-grid [data-slot=armR]', '.stgrid'); await sleep(250); if (await page.evaluate(() => !!document.querySelector('.pop'))) await clickSel(page, '[data-act=confirm-replace]'); await sleep(200);
    ok((await inst(page, 'armR')).def === 'stock_armR', `${label}: drag an equipped slot onto storage unequips it`); await clickSel(page, '[data-act=undo]');
  }

  // ---- layout / viewport
  await open(page); await page.evaluate(u => { window.__ui.pickUid = u; window.__ui.render(); }, T.blueT);
  const V = await page.evaluate(() => { const vw = innerWidth, vh = innerHeight; const bad = []; for (const e of document.querySelectorAll('#modal .pickbar, #modal .pickbar *, #modal .slotact, #modal .slotact *, #modal .undobar *')) { if (!e.getClientRects().length) continue; const r = e.getBoundingClientRect(); if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) bad.push(e.className + ' x'); } const eb = document.querySelector('.pickbar .eqbtn'); const r = eb.getBoundingClientRect(); const fs = parseFloat(getComputedStyle(eb).fontSize); const dc = [...document.querySelectorAll('.dchip')].map(x => parseFloat(getComputedStyle(x).fontSize)); const body = document.querySelector('#modal .body'); return { bad, btnH: r.height, fs, minDc: Math.min(...dc, 99), scrollX: document.documentElement.scrollWidth > vw + 1, bodyX: body.scrollWidth > body.clientWidth + 1 }; });
  ok(V.bad.length === 0 && !V.scrollX && !V.bodyX, `${label}: no horizontal overflow / clipping (${V.bad.join(',')})`); ok(V.fs >= 11 && V.minDc >= 10.5, `${label}: readable fonts (btn ${V.fs}px, chip ${V.minDc}px)`); ok(V.btnH >= (opts.touch ? 32 : 24), `${label}: Equip target size ${Math.round(V.btnH)}px`);
  // pickbar reachable (scroll container) and close button usable
  ok(await page.evaluate(() => { const x = document.getElementById('modalx'), h = document.querySelector('#modal .win>header [data-act=close]'); const vis = e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; }; return vis(h) || (x.classList.contains('on') && vis(x)); }), `${label}: a close button stays on screen`);
  if (opts.shot) { await page.screenshot({ path: `${SHOTS}/${opts.shot}_5_full.png` }); await page.evaluate(() => document.querySelector('.pickbar').scrollIntoView({ block: 'end' })); await page.screenshot({ path: `${SHOTS}/${opts.shot}_6_pickbar.png` }); }
  ok(errors.length === 0, `${label}: no page errors ${errors.slice(0, 2).join(' | ')}`);
  await browser.close();
}
await suite('1280x720', { viewport: { width: 1280, height: 720 }, shot: 'desktop' });
await suite('1920x1080', { viewport: { width: 1920, height: 1080 } });
await suite('844x390 touch', { viewport: { width: 844, height: 390 }, touch: true, shot: 'mobile' });
await suite('667x375 touch', { viewport: { width: 667, height: 375 }, touch: true });
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
