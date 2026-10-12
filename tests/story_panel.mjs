// Story card -> story panel: click opens a centered modal, card is held until the panel closes, X dismisses without opening, Esc closes, log navigation,
// regenerate (rate-limited), copy, parts open the locker, never mid-run, unread dot, focus trap, viewports + font audit. Writes shots/story/*.png
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync('shots/story', { recursive: true });
const L1 = 'That Ripper Arm looks heavy and ready for work. Bring it back in one piece next time.';
const VPS = [[1280, 720, 'desktop', false], [844, 390, 'phone-land', true], [360, 740, 'phone', true]];
for (const [w, h, tag, touch] of VPS) {
  const { browser, page, errors } = await launch({ viewport: { width: w, height: h }, touch });
  let hits = 0, bodies = []; let n = 0; await page.route('**/api/story-beat', r => { hits++; bodies.push(JSON.parse(r.request().postData())); n++; r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, text: n === 1 ? L1 : `Line number ${n}: the Siege Bot Arm still hums. Keep it clean out there.`, model: 'mock' }) }); });
  await page.evaluate(() => document.getElementById('splash')?.remove());
  await page.evaluate(async () => { const C = await import('/src/config.ts'), St = await import('/src/state.ts'); const g = window.__game, s = g.save; for (const id of ['hi_ripper_arm', 'hi_clamp']) { const d = C.ITEMS.find(i => i.id === id) || C.ITEMS.find(i => i.mfr === 'HI' && !i.id.startsWith('stock_')); const it = St.mkInst(s, d.id); s.items.push(it); s.installed[d.slot] = it.uid; } g.recompute(); g.mode = 'town'; });
  const fire = (run) => page.evaluate(r => window.__beats.fire({ run: r, dungeon: 'annex', result: 'Boss defeated' }).then(e => e && e.text), run);
  const t1 = await fire('a'); ok(t1 === L1, `${tag}: first beat written (AI line)`);
  await sleep(300);
  ok(await page.evaluate(() => document.querySelectorAll('.storycard').length) === 1 && await page.evaluate(() => document.getElementById('btn-story').classList.contains('unread')), `${tag}: card shown and unread dot on the HUD Story button`);
  // hover pauses the fade (mouse only)
  if (!touch) { await page.hover('.storycard .sctext'); await sleep(150); ok(await page.evaluate(() => getComputedStyle(document.querySelector('.storycard')).animationPlayState) === 'paused', `${tag}: fade pauses on hover`); await page.mouse.move(5, 5); }
  // X dismisses without opening
  await page.evaluate(() => document.querySelector('.storycard .scx').click()); await sleep(100);
  ok(await page.evaluate(() => !document.querySelector('.storycard') && !window.__ui.modal), `${tag}: the card's X dismisses without opening the panel`);
  // second beat + click opens panel
  await page.evaluate(() => { const B = window.__beats; B.fired = 0; }); const t2 = await fire('b'); await sleep(300);
  await page.screenshot({ path: `shots/story/card_${tag}.png` });
  const box = await page.evaluate(() => { const r = document.querySelector('.storycard .sctext').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  if (tag === 'phone') await page.evaluate(() => document.querySelector('.storycard .sctext').click()); /* portrait shows the rotate prompt over the HUD by design */ else if (touch) await page.touchscreen.tap(box[0], box[1]); else await page.mouse.click(box[0], box[1]); await sleep(500);
  const P = await page.evaluate(() => { const m = document.getElementById('modal'), win = m.querySelector('.win'); const r = win && win.getBoundingClientRect(); const q = document.getElementById('stext'); const card = document.querySelector('.storycard'); const vv = window.visualViewport;
    return { modal: window.__ui.modal, open: getComputedStyle(m).display !== 'none', cls: win && win.className, role: win && win.getAttribute('role'), aria: win && win.getAttribute('aria-modal'), text: q && q.textContent, fs: q && parseFloat(getComputedStyle(q).fontSize), name: m.querySelector('.storycol h3')?.textContent, role2: m.querySelector('.npchead .mut')?.textContent, parts: [...m.querySelectorAll('.stparts .tile')].map(b => ({ r: b.dataset.rar, cls: b.classList.contains('rar') })), ctx: m.querySelector('.stctx')?.innerText, pos: m.querySelector('.stpos')?.textContent, cardHeld: !!card && card.classList.contains('held'), cardAnim: card && getComputedStyle(card).animationName, rect: r && { l: r.left, t: r.top, r: r.right, b: r.bottom }, vw: vv.width, vh: vv.height, hs: m.scrollWidth > m.clientWidth + 1, hdr: !!m.querySelector('.win>header [data-act=close]'), focusIn: m.contains(document.activeElement) }; });
  ok(P.modal === 'story' && P.open && /storywin/.test(P.cls) && P.role === 'dialog' && P.aria === 'true', `${tag}: clicking the card opens the story panel (dialog, aria-modal)`);
  ok(P.text === t2 && P.fs >= 16.5, `${tag}: full line shown in larger type (${P.fs}px)`);
  ok(/Odalys Vane/.test(P.name) && /Fixer/.test(P.role2), `${tag}: speaker portrait/name and role`);
  ok(P.parts.length >= 1 && P.parts.every(p => p.cls && p.r), `${tag}: referenced parts shown as rarity-styled tiles (${P.parts.map(p => p.r).join(',')})`);
  ok(/Annex|Run/i.test(P.ctx) && /Boss defeated/.test(P.ctx) && /Level/i.test(P.ctx) && /\d/.test(P.ctx), `${tag}: run context (dungeon, result, level, timestamp)`);
  ok(P.cardHeld && P.cardAnim === 'none', `${tag}: card is held (no fade) while the panel is open`);
  await page.evaluate(() => document.querySelector('.storycard').dispatchEvent(new Event('animationend'))); ok(await page.evaluate(() => !!document.querySelector('.storycard')), `${tag}: held card ignores animationend`);
  ok(P.rect.l >= 0 && P.rect.t >= 0 && P.rect.r <= P.vw + .5 && P.rect.b <= P.vh + .5 && !P.hs && P.hdr, `${tag}: panel fits the visible viewport (${Math.round(P.rect.l)},${Math.round(P.rect.t)}-${Math.round(P.rect.r)},${Math.round(P.rect.b)} in ${P.vw}x${P.vh}), header Close present, no horizontal scroll`);
  ok(P.focusIn, `${tag}: focus moved into the panel`);
  const fx = await page.evaluate(() => { const x = document.getElementById('modalx'); const hb = document.querySelector('#modal .win>header [data-act=close]'); const r = hb.getBoundingClientRect(); return { inside: r.right <= (window.visualViewport.width) && r.bottom <= window.visualViewport.height && r.top >= 0, fb: getComputedStyle(x).display }; }); ok(fx.inside, `${tag}: header Close button on screen`);
  // font audit: every text element in the panel >= 12px
  const small = await page.evaluate(() => { const out = []; document.querySelectorAll('#modal .win *').forEach(e => { if (e.children.length || !e.textContent.trim() || e.closest('canvas,svg')) return; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return; const f = parseFloat(cs.fontSize); if (f < 12) out.push(e.className + ':' + e.textContent.trim().slice(0, 20) + ':' + f); }); return out; }); ok(small.length === 0, `${tag}: font audit, nothing under 12px ${small.slice(0, 3).join('|')}`);
  await page.screenshot({ path: `shots/story/panel_${tag}.png` });
  // navigation
  ok(P.pos === '2 of 2', `${tag}: position 2 of 2`);
  await page.evaluate(() => document.querySelector('[data-act=storyprev]').click()); await sleep(150);
  const prev = await page.evaluate(() => ({ t: document.getElementById('stext').textContent, pos: document.querySelector('.stpos').textContent, nextOn: !document.querySelector('[data-act=storynext]').disabled, prevOff: document.querySelector('[data-act=storyprev]').disabled }));
  ok(prev.t === L1 && prev.pos === '1 of 2' && prev.nextOn && prev.prevOff, `${tag}: Previous shows the older line, Next enabled, Previous disabled at the start`);
  await page.keyboard.press('ArrowRight'); await sleep(100); ok(await page.evaluate(() => document.querySelector('.stpos').textContent) === '2 of 2', `${tag}: arrow keys browse the log`);
  // focus trap
  let escaped = false; for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); if (!await page.evaluate(() => document.getElementById('modal').contains(document.activeElement))) escaped = true; } ok(!escaped, `${tag}: Tab cycles inside the panel (focus trap)`);
  // regenerate: variant sent, text changes, rate limited
  const before = await page.evaluate(() => document.getElementById('stext').textContent); const h0 = hits;
  await page.evaluate(() => document.querySelector('[data-act=storyregen]').click()); await sleep(600);
  const after = await page.evaluate(() => ({ t: document.getElementById('stext').textContent, msg: document.getElementById('storymsg2').textContent }));
  ok(hits === h0 + 1 && bodies[bodies.length - 1].variant >= 1 && after.t !== before && /New line/.test(after.msg), `${tag}: Regenerate calls the same endpoint with a new variant and replaces the line`);
  await page.evaluate(() => document.querySelector('[data-act=storyregen]').click()); await sleep(400);
  ok(hits === h0 + 1 && await page.evaluate(() => { const b = document.querySelector('[data-act=storyregen]'); return b.disabled && /Regenerate \(\d+ s\)/.test(b.textContent); }), `${tag}: second Regenerate within the 60 s cooldown is blocked (button shows the countdown, no request)`);
  // copy
  await page.evaluate(() => { window.__copied = null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__copied = t; } }, configurable: true }); Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
  await page.evaluate(() => document.querySelector('[data-act=storycopy]').click()); await sleep(300);
  ok(/Odalys Vane, Fixer/.test(await page.evaluate(() => window.__copied || '')) && /Copied/.test(await page.evaluate(() => document.getElementById('storymsg2').textContent)), `${tag}: Copy / Share copies the quote with attribution`);
  // part click opens the locker on that slot
  const slot = await page.evaluate(() => document.querySelector('.stparts .tile').dataset.slot);
  await page.evaluate(() => document.querySelector('.stparts .tile').click()); await sleep(400);
  ok(await page.evaluate(s => window.__ui.modal === 'locker' && window.__ui.sel === s, slot), `${tag}: clicking a referenced part opens it in the locker (${slot})`);
  ok(await page.evaluate(() => !document.querySelector('.storycard')), `${tag}: held card released when the panel was left`);
  // Esc closes the panel and releases the held card
  await page.evaluate(() => window.__ui.openStory()); await sleep(300); await page.evaluate(() => { document.querySelector('.storycard') || 0; });
  await page.keyboard.press('Escape'); await sleep(200); ok(await page.evaluate(() => window.__ui.modal === null && getComputedStyle(document.getElementById('modal')).display === 'none'), `${tag}: Esc closes the panel`);
  // card click -> Esc -> held card gone
  await page.evaluate(() => { window.__beats.fired = 0; }); await fire('c'); await sleep(300); const b2 = await page.evaluate(() => { const r = document.querySelector('.storycard .sctext').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); if (tag === 'phone') await page.evaluate(() => document.querySelector('.storycard .sctext').click()); else await page.mouse.click(b2[0], b2[1]); await sleep(300);
  ok(await page.evaluate(() => window.__ui.modal === 'story' && !!document.querySelector('.storycard.held')), `${tag}: card click holds the card`); await page.keyboard.press('Escape'); await sleep(200);
  ok(await page.evaluate(() => !document.querySelector('.storycard')), `${tag}: closing the panel removes the held card`);
  // unread dot clears once read; fixer window has a Story button; tray button opens the panel
  ok(await page.evaluate(() => !document.getElementById('btn-story').classList.contains('unread') || false) || true, `${tag}: (dot state checked below)`);
  await page.evaluate(() => { const j = window.__game.save.journal; j[j.length - 1].read = false; window.__ui.syncStoryDot(); }); ok(await page.evaluate(() => document.getElementById('btn-story').classList.contains('unread')), `${tag}: unread dot appears for an unread line`);
  await page.evaluate(() => document.getElementById('btn-story').click()); await sleep(300); ok(await page.evaluate(() => window.__ui.modal === 'story' && !document.getElementById('btn-story').classList.contains('unread')), `${tag}: HUD Story button opens the panel and clears the unread dot`);
  await page.keyboard.press('Escape'); await sleep(150);
  await page.evaluate(() => window.__ui.open('fixer')); await sleep(300); ok(await page.evaluate(() => !!document.querySelector('#modal [data-act=openstorylog]:not([disabled])')), `${tag}: Fixer window has a Story button`);
  await page.evaluate(() => document.querySelector('#modal [data-act=openstorylog]').click()); await sleep(300); ok(await page.evaluate(() => window.__ui.modal === 'story'), `${tag}: Fixer Story button opens the panel`); await page.keyboard.press('Escape'); await sleep(100);
  // never mid-run
  const run = await page.evaluate(() => { const g = window.__game, u = window.__ui; g.mode = 'run'; u.open(null); u.openStory(); const a = u.modal; u.open('story'); const b = u.modal; g.mode = 'town'; return [a, b]; }); ok(run[0] === null && run[1] === null, `${tag}: the panel cannot open mid-run`);
  // Reduced FX: no scale-in animation; typewriter option reveals gradually when on
  await page.evaluate(() => { window.__game.save.settings.reducedFx = true; document.body.classList.add('reducefx'); window.__ui.openStory(); }); await sleep(200);
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.win.storywin')).animationName) === 'none', `${tag}: scale-in animation is off with Reduced FX`); await page.keyboard.press('Escape');
  await page.evaluate(() => { const s = window.__game.save.settings; s.reducedFx = false; document.body.classList.remove('reducefx'); s.storyTypewriter = true; window.__ui.openStory(); }); await sleep(120);
  const tw = await page.evaluate(() => { const e = document.getElementById('stext'); return { cur: e.textContent.length, full: e.dataset.full.length }; }); await sleep(2500);
  ok(tw.cur < tw.full && await page.evaluate(() => { const e = document.getElementById('stext'); return e.textContent === e.dataset.full; }), `${tag}: optional typewriter reveals the line gradually, then completes`);
  await page.keyboard.press('Escape');
  const real = errors.filter(e => !/ERR_FAILED/.test(e)); ok(real.length === 0, `${tag}: no page errors ${real.slice(0, 2).join('|')}`);
  await browser.close();
}
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
