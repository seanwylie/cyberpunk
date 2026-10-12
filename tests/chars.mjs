// Multiple characters (docs/CHARACTERS.md): legacy save migrates to character 1 untouched; create/switch/delete; per-character isolation
// (level, items, rep, story, idkfa); account-wide cosmetics, locker purchases, store and settings shared; 10-character cap; selector on load.
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync('shots/chars', { recursive: true });
// a pre-update single save (no roster yet)
const { browser, page, errors } = await launch({ init: () => { if (!localStorage.getItem('wv_roster_v1') && !sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('arpg-proto-save-v1', JSON.stringify({ __legacy: true })); } } });
// the seed above is invalid -> replace with a real legacy save built by the game, then wipe the roster to simulate the pre-update state
await page.evaluate(async () => { window.__wvNoPersist = true; const St = await import('/src/state.ts'); const s = St.newSave(); s.level = 17; s.xp = 42; s.credits = 777; s.rep.HI = 55; s.purchases.lockerBlocks = 2; s.cosmetics = { owned: { hat_x: 1 }, equipped: {}, seen: {} }; s.items.push(St.mkInst(s, s.items[0].def)); s.story = { marker: 'legacy' };
  localStorage.clear(); localStorage.setItem('wv_notut', '1'); localStorage.setItem('wv_nograce', '1'); localStorage.setItem('arpg-proto-save-v1', JSON.stringify(s)); window.__legacyN = s.items.length; sessionStorage.setItem('legacyN', String(s.items.length)); });
const reload = async (q = '') => { await page.goto(process.env.URL.replace(/\/$/, '') + '/' + q, { waitUntil: 'load' }); await page.waitForFunction(() => window.__game); await page.evaluate(() => document.getElementById('splash')?.remove()); await sleep(300); };
await reload();
const m = await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('wv_roster_v1')); const s = window.__game.save; return { n: r.chars.length, lvl: s.level, xp: s.xp, cr: s.credits, rep: s.rep.HI, items: s.items.length, story: s.story?.marker, lb: r.account.purchases.lockerBlocks, own: !!r.account.cosOwned?.hat_x, legacyN: +sessionStorage.getItem('legacyN'), charRaw: !!localStorage.getItem('wv_char_' + r.active) }; });
ok(m.n === 1 && m.lvl === 17 && m.xp === 42 && m.cr === 777 && m.rep === 55 && m.items === m.legacyN && m.story === 'legacy' && m.charRaw, 'migration: existing save becomes character 1 with level/xp/credits/rep/items/story intact');
ok(m.lb === 2 && m.own, 'migration: purchases and cosmetic unlocks lifted to the account');
ok(await page.evaluate(() => window.__ui.modal !== 'chars'), 'one character: no selector blocking the load');
// create a second character via the UI
await page.evaluate(() => window.__ui.open('chars')); await sleep(150);
await page.click('[data-act="cs-new"]'); await page.fill('#csname', 'Wren'); await page.evaluate(() => document.getElementById('splash')?.remove()); await page.screenshot({ path: 'shots/chars/create.png' });
await Promise.all([page.waitForEvent('load'), page.click('[data-act="cs-create"]')]); await page.waitForFunction(() => window.__game); await page.evaluate(() => document.getElementById('splash')?.remove()); await sleep(400);
const c2 = await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('wv_roster_v1')); const s = window.__game.save; return { n: r.chars.length, name: r.chars.find(c => c.id === r.active).name, lvl: s.level, cr: s.credits, rep: s.rep.HI, story: s.story?.marker, lb: s.purchases.lockerBlocks, own: !!s.cosmetics?.owned?.hat_x, modal: window.__ui.modal }; });
ok(c2.n === 2 && c2.name === 'Wren' && c2.lvl === 12 && c2.rep === 0 && c2.story !== 'legacy', 'create: free new character starts fresh (start level 12, no rep, own story)');
ok(c2.lb === 2 && c2.own, 'account-wide: locker purchases and cosmetic unlocks shared with the new character');
ok(c2.modal === 'chars', '2+ characters: selector shown on load');
await page.evaluate(() => document.getElementById('splash')?.remove()); await page.screenshot({ path: 'shots/chars/select_desktop.png' });
// isolation: change Wren, switch back to Runner 1
await page.evaluate(() => { const s = window.__game.save; s.level = 5; s.credits = 5; s.cosmetics.owned.glove_y = 1; s.settings.volume = .33; window.__ui.close(); window.__game.saveNow?.(); });
await page.evaluate(async () => { (await import('/src/state.ts')).persist(window.__game.save); });
await page.evaluate(() => window.__ui.open('chars')); await sleep(100);
const r1id = await page.evaluate(() => JSON.parse(localStorage.getItem('wv_roster_v1')).chars[0].id);
await Promise.all([page.waitForEvent('load'), page.click(`[data-act="cs-play"][data-id="${r1id}"]`)]); await page.waitForFunction(() => window.__game); await page.evaluate(() => document.getElementById("splash")?.remove()); await sleep(300);
const b = await page.evaluate(() => { const s = window.__game.save; return { lvl: s.level, cr: s.credits, own: !!s.cosmetics?.owned?.glove_y, vol: s.settings.volume }; });
ok(b.lvl === 17 && b.cr === 777, 'switch: character 1 keeps its own level and credits (isolation)');
ok(b.own && Math.abs(b.vol - .33) < 1e-6, 'account-wide: cosmetic bought on Wren and settings visible on character 1');
// cap of 10 (direct API)
const cap = await page.evaluate(async () => { const C = await import('/src/chars.ts'), St = await import('/src/state.ts'); const res = []; for (let i = 0; i < 9; i++) res.push(C.createChar('X' + i, St.newSave)); return { okN: res.filter(r => r.ok).length, last: res[res.length - 1], n: C.ensureRoster().chars.length, lim: C.CHAR_LIMIT }; });
ok(cap.lim === 10 && cap.n === 10 && cap.okN === 8 && !cap.last.ok, 'cap: 10 characters max, 11th create refused with a reason');
await page.evaluate(() => window.__ui.open('chars')); await sleep(150); await page.evaluate(() => document.getElementById('splash')?.remove()); await page.screenshot({ path: 'shots/chars/select_full.png' });
ok(await page.evaluate(() => !document.querySelector('[data-act="cs-new"]')), 'full roster: no New slot offered');
// delete with confirm (non-active)
const victim = await page.evaluate(() => JSON.parse(localStorage.getItem('wv_roster_v1')).chars[9].id);
await page.click(`[data-act="cs-del"][data-id="${victim}"]`); await sleep(80);
ok(await page.evaluate(v => !!document.querySelector(`[data-act="cs-delgo"][data-id="${v}"]`) && JSON.parse(localStorage.getItem('wv_roster_v1')).chars.length === 10, victim), 'delete asks for confirmation first');
await page.click(`[data-act="cs-delgo"][data-id="${victim}"]`); await sleep(80);
ok(await page.evaluate(v => { const r = JSON.parse(localStorage.getItem('wv_roster_v1')); return r.chars.length === 9 && !localStorage.getItem('wv_char_' + v) && window.__game.save.level === 17; }, victim), 'delete: roster and save removed, active character untouched');
// phone screenshot
await page.setViewportSize({ width: 844, height: 390 }); await sleep(200); await page.evaluate(() => document.getElementById('splash')?.remove()); await page.screenshot({ path: 'shots/chars/select_phone.png' });
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|')); await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
