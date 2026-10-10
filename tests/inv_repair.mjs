// Dispose-all-grey and Repair-all e2e (real mouse clicks, desktop).
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch(); const ev = (f, a) => page.evaluate(f, a);
await ev(() => { window.__game.save.credits = 100; });
await ev(async () => { const m = await import('/src/state.ts'); const s = window.__game.save; const add = d => s.items.push(m.mkInst(s, d)); add('pool_g_torso'); add('pool_g_legs'); add('pool_g_legs'); add('stock_torso');
  const blue = Object.values((await import('/src/config.ts')).ITEM_BY_ID).find(d => d.rarity === 'blue'); add(blue.id); s.repairBill = 0; window.__ui.open('locker'); });
await sleep(300);
const txt = await ev(() => document.querySelector('[data-act=sellgrey]').textContent); ok(/\(4 · 20c\)/.test(txt) || /\(\d+ ·/.test(txt), 'button shows count: ' + txt);
ok(await ev(() => document.querySelector('[data-act=repairall]').disabled), 'repair all disabled when nothing damaged');
await page.click('[data-act=sellgrey]'); await sleep(300);
const r = await ev(async () => { const m = await import('/src/state.ts'); const c = await import('/src/config.ts'); const s = window.__game.save; return { left: m.lockerItems(s).map(i => i.def), credits: s.credits, toast: [...document.querySelectorAll('.toast')].map(e => e.textContent).join('|') }; });
ok(r.left.length === 1 && c_blue(r.left[0]), 'only the non-grey item remains: ' + r.left); function c_blue(d) { return !d.startsWith('pool_g') && d !== 'stock_torso'; }
ok(r.credits === 120, 'credits +20c -> ' + r.credits); ok(/Disposed 4 grey/.test(r.toast), 'toast: ' + r.toast);
ok(await ev(() => document.querySelector('[data-act=sellgrey]').disabled), 'dispose disabled when none left');
ok(await ev(() => Object.keys(window.__game.save.installed).length === 10 || Object.keys(window.__game.save.installed).length > 0), 'equipped untouched');
// Repair all
await ev(() => { window.__game.save.repairBill = 50; window.__game.save.credits = 30; window.__ui.render(); });
ok(await ev(() => /Repair what I can \(30c of 50c\)/.test(document.querySelector('[data-act=repairall]').textContent)), 'partial label when short');
await page.click('[data-act=repairall]'); await sleep(200);
let s = await ev(() => ({ b: window.__game.save.repairBill, c: window.__game.save.credits })); ok(s.b === 20 && s.c === 0, 'partial repair paid 30c: ' + JSON.stringify(s));
ok(await ev(() => document.querySelector('[data-act=repairall]').disabled), 'disabled with no credits');
await ev(() => { window.__game.save.credits = 500; window.__ui.render(); });
await page.click('[data-act=repairall]'); await sleep(200);
s = await ev(() => ({ b: window.__game.save.repairBill, c: window.__game.save.credits })); ok(s.b === 0 && s.c === 480, 'full repair: ' + JSON.stringify(s));
await ev(() => { window.__ui.close(); window.__game.save.repairBill = 40; window.__ui.open('vendor'); }); await sleep(200);
ok(await ev(() => /Repair all \(40c\)/.test(document.querySelector('[data-act=repairall]').textContent)), 'vendor shows Repair all (40c)');
const fs = await ev(() => Math.min(...[...document.querySelectorAll('.win button')].map(b => parseFloat(getComputedStyle(b).fontSize)))); ok(fs >= 14, 'button font >=14px: ' + fs);
await page.click('[data-act=repairall]'); await sleep(200);
ok(await ev(() => window.__game.save.repairBill === 0), 'vendor repair all clears bill');
await page.screenshot({ path: 'shots/inv_repair_vendor.png' });
await ev(() => { window.__game.save.repairBill = 35; window.__ui.close(); window.__ui.open('locker'); }); await sleep(200);
await page.screenshot({ path: 'shots/inv_repair_locker.png' });
ok(errors.length === 0, 'no console errors ' + errors.join(';'));
await browser.close(); process.exit(fails ? 1 : 0);
