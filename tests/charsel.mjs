// Character select (docs/CHARACTERS.md): boot shows the selector; a first-time player goes straight to naming; live previews;
// create a second character, switch between them, delete one with a typed name, 10-character cap; menu "Switch character" is town only.
// URL=http://localhost:5461/ node tests/charsel.mjs
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const OUT = '/workspace/shots_charsel'; fs.mkdirSync(OUT, { recursive: true });
const { browser, page, errors } = await launch({ chars: true });
const clean = () => page.evaluate(() => document.getElementById('splash')?.remove());
const reload = async () => { await page.goto(process.env.URL.replace(/\/$/, '') + '/', { waitUntil: 'load' }); await page.waitForFunction(() => window.__game); await clean(); await sleep(600); };
const roster = () => page.evaluate(() => JSON.parse(localStorage.getItem('wv_roster_v1')));
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('wv_notut', '1'); localStorage.setItem('wv_nograce', '1'); localStorage.setItem('wv_city_neutral', '1'); window.__wvNoPersist = true; });
await reload();
ok(await page.evaluate(() => window.__ui.modal === 'chars' && !!document.getElementById('csname') && !document.querySelector('.csgrid')), 'first-time player: boot lands in naming');
await page.fill('#csname', 'Vex'); await page.screenshot({ path: OUT + '/first_time.png' });
await page.click('[data-act="cs-create"]'); await sleep(200);
let r = await roster(); ok(r.chars.length === 1 && r.chars[0].name === 'Vex' && !r.chars[0].fresh && await page.evaluate(() => window.__ui.modal !== 'chars' && window.__game.save.level === 1), 'first character named, level 1, in game');
await page.evaluate(async () => { const s = window.__game.save; s.level = 9; (await import('/src/state.ts')).persist(s); });
await reload();
ok(await page.evaluate(() => window.__ui.modal === 'chars' && !!document.querySelector('.csgrid')), 'boot shows the selector for a returning player (1 character)');
// + New -> second character
await page.click('[data-act="cs-new"]'); await page.fill('#csname', 'Wren');
await Promise.all([page.waitForEvent('load'), page.click('[data-act="cs-create"]')]); await page.waitForFunction(() => window.__game); await clean(); await sleep(800);
r = await roster(); const wren = r.chars.find(c => c.name === 'Wren'), vex = r.chars.find(c => c.name === 'Vex');
ok(r.chars.length === 2 && r.active === wren.id && await page.evaluate(() => window.__game.save.level) === 1, 'create: second character starts at level 1 and is active');
ok(await page.evaluate(() => document.querySelectorAll('canvas.csprev').length) === 2, 'one live preview per character');
await sleep(400);
const painted = await page.evaluate(() => [...document.querySelectorAll('canvas.csprev')].every(cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 180) n++; return n > 20; }));
ok(painted, 'previews draw the character model');
ok(await page.evaluate(() => /Lv 9/.test(document.querySelector('.csgrid').textContent)), 'card shows level and town');
await page.screenshot({ path: OUT + '/select.png' });
// switch to Vex
await Promise.all([page.waitForEvent('load'), page.click(`[data-act="cs-play"][data-id="${vex.id}"]`)]); await page.waitForFunction(() => window.__game); await clean(); await sleep(500);
r = await roster(); ok(r.active === vex.id && await page.evaluate(() => window.__game.save.level) === 9, 'switch: back to Vex with level 9 intact');
// delete Wren with typed confirm
await page.click(`[data-act="cs-del"][data-id="${wren.id}"]`); await page.fill('#csdelname', 'nope'); await page.click('[data-act="cs-delgo"]'); await sleep(150);
ok((await roster()).chars.length === 2, 'delete: wrong name does nothing');
ok(await page.evaluate(() => !!document.getElementById('csdelname')), 'delete: confirm stays open after a wrong name'); await page.fill('#csdelname', 'Wren'); await page.screenshot({ path: OUT + '/delete_confirm.png' });
await page.click('[data-act="cs-delgo"]'); await sleep(150);
r = await roster(); ok(r.chars.length === 1 && r.chars[0].id === vex.id, 'delete: typed name removes the character');
// cap
const cap = await page.evaluate(async () => { const C = await import('/src/chars.ts'), S = await import('/src/state.ts'); let made = 0, last; for (let i = 0; i < 12; i++) { last = C.createChar('X' + i, S.newSave); if (last.ok) made++; } return { made, n: C.ensureRoster().chars.length, why: last.ok ? '' : last.why }; });
ok(cap.n === 10 && cap.made === 9 && /limit/i.test(cap.why), 'cap: 10 characters max');
await page.evaluate(() => window.__ui.render()); await sleep(300);
ok(await page.evaluate(() => !document.querySelector('[data-act="cs-new"]')), 'full roster: no + New slot');
await page.screenshot({ path: OUT + '/full_roster.png' });
// menu: Switch character, town only
await page.evaluate(() => { window.__ui.close(); window.__ui.open('settings'); }); await sleep(150);
ok(await page.evaluate(() => { const b = document.querySelector('.sswitch'); return b && !b.disabled; }), 'menu: Switch character enabled in town');
await page.screenshot({ path: OUT + '/menu_town.png' });
await page.click('.sswitch'); await sleep(150); ok(await page.evaluate(() => window.__ui.modal === 'chars'), 'menu: Switch character opens the selector');
await page.evaluate(() => { window.__ui.close(); window.__game.startRun('annex'); window.__ui.open('settings'); }); await sleep(300);
ok(await page.evaluate(() => { const b = document.querySelector('.sswitch'); return b && b.disabled; }), 'menu: Switch character disabled in a run');
await page.evaluate(() => window.__ui.open('chars')); ok(await page.evaluate(() => window.__ui.modal !== 'chars'), 'selector refuses to open in a run');
ok(!errors.length, 'no page errors ' + errors.slice(0, 3).join(' | '));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
