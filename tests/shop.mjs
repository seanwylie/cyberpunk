// Vendor hardware shop: lists parts for every one of the 11 slots, shows compare + price, purchase works (credits, locker, level gate).
import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ viewport: { width: 1920, height: 1080 }, query: '?splash=hold' });
const ev = (f, a) => page.evaluate(f, a); let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
await sleep(600); await ev(() => { document.getElementById('splash')?.remove(); window.__ui.kit('A', true); window.__game.save.level = 20; window.__game.save.credits = 5000; window.__ui.modal = 'vendor'; window.__ui.render(); });
const slots = ['face', 'brain', 'torso', 'handL', 'handR', 'armL', 'armR', 'legL', 'legR', 'footL', 'footR'];
for (const sl of slots) { await ev(sl => { window.__ui.shopSlot = sl; window.__ui.render(); }, sl); const r = await ev(() => ({ rows: document.querySelectorAll('.shoprow').length, canv: document.querySelectorAll('.shoprow canvas').length, btn: document.querySelectorAll('.shoprow button[data-act=buyhw]').length, tabs: document.querySelectorAll('.shoptabs .tile').length, vs: !!document.querySelector('.shoprow .vs') }));
  ok(r.rows > 0 && r.btn === r.rows && r.canv === r.rows && r.tabs === 11 && r.vs, `shop lists parts for ${sl}: ${r.rows} rows, icons ${r.canv}`); }
await ev(() => { window.__ui.shopSlot = 'armR'; window.__ui.render(); });
const b = await ev(() => { const g = window.__game, s = g.save; const btn = [...document.querySelectorAll('.shoprow button[data-act=buyhw]:not([disabled])')][0]; const id = btn.dataset.id; const n0 = s.items.length, c0 = s.credits; btn.click(); return { id, dn: s.items.length - n0, spent: c0 - s.credits, has: s.items.some(i => i.def === id) }; });
ok(b.dn === 1 && b.spent > 0 && b.has, 'purchase adds hardware to locker and deducts credits ' + JSON.stringify(b));
const lock = await ev(() => { window.__game.save.level = 1; window.__ui.render(); const hi = [...document.querySelectorAll('.shoprow button[data-act=buyhw]')].filter(x => x.disabled); return hi.length; }); ok(lock > 0, 'level-gated parts are disabled');
const broke = await ev(() => { const s = window.__game.save; s.level = 30; s.credits = 0; window.__ui.render(); const n0 = s.items.length; const btns = [...document.querySelectorAll('.shoprow button[data-act=buyhw]')]; btns.forEach(x => x.click()); return { allDis: btns.every(x => x.disabled), same: s.items.length === n0 }; }); ok(broke.allDis && broke.same, 'cannot buy without credits');
ok(errors.length === 0, 'no console errors ' + errors.join(';'));
await browser.close(); if (fails) process.exit(1); console.log('shop ok');
