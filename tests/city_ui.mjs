// Living city in the browser (offline, no server): rule effects applied in town (vendor prices, guards, faction signage, banner, bounties),
// news panel from the local sim (canned, real numbers), street chatter, feature flags off = no panel/no chatter, privacy toggle. Shots: shots/city/
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; }; fs.mkdirSync('shots/city', { recursive: true });
const { browser, page, errors } = await launch({ query: '?splash=hold' });
await page.evaluate(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__city, null, { timeout: 15000 });
ok(await page.evaluate(() => window.__city.CITY_C.src === 'local' && Object.keys(window.__city.CITY_C.s.dist).length === 11), 'offline: local city simulation running (no server)');
// Neon Mile, calm vs hot
const town = async (t) => page.evaluate(async t => { const g = window.__game; g.save.town = t; g.enterTown(true); await new Promise(r => setTimeout(r, 300)); }, t);
await town('neon_mile');
const setT = (d, v, ctrl) => page.evaluate(([d, v, ctrl]) => { const s = window.__city.CITY_C.s; s.dist[d].tension = v; if (ctrl != null) s.dist[d].ctrl = ctrl; for (const f of window.__city.CITY_C.listeners) f(); }, [d, v, ctrl]);
await setT('neon_mile', 20, 1); const calm = await page.evaluate(() => ({ buy: window.__ui.BUY(), e: window.__city.cityEffects('neon_mile') }));
await setT('neon_mile', 88, 1); const hot = await page.evaluate(() => ({ buy: window.__ui.BUY(), e: window.__city.cityEffects('neon_mile') }));
ok(hot.buy.blue > calm.buy.blue && calm.buy.blue <= 300, `vendor prices follow the city (blue ${calm.buy.blue}c -> ${hot.buy.blue}c)`);
ok(hot.e.events.some(e => /Kestrel lockdown in Neon Mile/.test(e.label)) && hot.e.bounties.length > 0, 'hot Kestrel district: lockdown event + bounties');
const guards = await page.evaluate(async () => { const W = await import('/src/worldtowns.ts'); const n = () => (W.buildTownLevel('neon_mile').npcs || W.buildTownLevel('neon_mile').townNpcs || []).filter(x => /np_guard/.test(x.spr)).length; const s = window.__city.CITY_C.s; s.dist.neon_mile.tension = 20; const a = n(); s.dist.neon_mile.tension = 88; const b = n(); return [a, b]; });
ok(guards[1] > guards[0], `guards on the plaza follow the city (${guards[0]} -> ${guards[1]})`);
const neon = await page.evaluate(async () => { const T = await import('/src/towngen.ts'); const s = window.__city.CITY_C.s; s.dist.neon_mile.ctrl = 0; const a = T.genCfg('neon_mile').neon.map(x => x[0]); s.dist.neon_mile.ctrl = 1; const b = T.genCfg('neon_mile').neon.map(x => x[0]); return [a, b]; });
ok(neon[0][0] === 'COMPACT' && neon[1][0] !== 'COMPACT', `decoration: Compact-held Neon Mile flies Compact signage (${neon[0].slice(0, 3).join(',')})`);
await setT('neon_mile', 88, 1); await sleep(2200); const ban = await page.evaluate(() => { const b = document.getElementById('citybanner'); return b && { t: b.textContent, vis: getComputedStyle(b).display !== 'none', tip: b.dataset.tip }; });
ok(ban && ban.vis && /Kestrel/.test(ban.t) && /Lockdown/.test(ban.t), `town banner shows the holder + event ("${ban?.t}")`);
await page.screenshot({ path: 'shots/city/town_banner_hot.png' });
// news panel (local, canned, real numbers)
await page.evaluate(() => { const C = window.__city; for (let i = 0; i < 3; i++) window.__game.emit?.('noop'); const s = C.CITY_C.s; s.week.dist.neon_mile = { clear: 7, hack: 3 }; C.NEWS.feed = null; window.__ui.open('news'); });
await page.waitForFunction(() => document.querySelector('.cnitem'), null, { timeout: 5000 }).catch(() => {}); await sleep(300);
const news = await page.evaluate(() => ({ items: [...document.querySelectorAll('.cnitem')].map(x => x.textContent), head: document.querySelector('.cnhead')?.textContent, src: document.querySelector('.cnsrc')?.textContent }));
ok(news.items.length > 0 && news.items.some(t => /7 clears/.test(t) && /3 hacks/.test(t)), `news panel reports the real local numbers (${news.items[0]})`);
ok(/Kestrel/.test(news.head) && /Tension 88/.test(news.head) && /Offline/.test(news.src), 'news header: holder, tension, offline source');
await page.screenshot({ path: 'shots/city/news_desktop.png' }); await page.evaluate(() => window.__ui.close());
// chatter
await page.evaluate(() => window.__city.bark()); await sleep(100); const bark = await page.evaluate(() => document.querySelector('.cbark')?.textContent || ''); ok(bark.length > 4, `street chatter bark: ${bark}`); await page.screenshot({ path: 'shots/city/chatter.png' });
// privacy setting default off
ok(await page.evaluate(() => !window.__game.save.settings.cityPublic), 'privacy: not named in city news by default');
// perf: effects are cheap and nothing runs per frame
const ms = await page.evaluate(() => { const t = performance.now(); for (let i = 0; i < 2000; i++) window.__city.cityEffects('neon_mile'); return performance.now() - t; }); ok(ms < 150, `2000 effect lookups take ${ms.toFixed(1)} ms`);
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|')); await browser.close();
// flags off
{ const { browser, page, errors } = await launch({ query: '?splash=hold', init: () => { localStorage.setItem('wv_ff_city_news', '0'); localStorage.setItem('wv_ff_city_chatter', '0'); } });
  await page.evaluate(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__city, null, { timeout: 15000 });
  await page.evaluate(() => { document.getElementById('citybanner')?.click(); }); await sleep(200); ok(await page.evaluate(() => window.__ui.modal !== 'news'), 'flag off: banner does not open the news');
  await page.evaluate(() => window.__ui.open('news')); await sleep(200); ok(await page.evaluate(() => /switched off/.test(document.getElementById('modal')?.textContent || '') && !window.__city.NEWS.feed), 'flag off: panel shows switched off, nothing fetched');
  await page.evaluate(() => { window.__ui.close(); window.__city.bark(); }); await sleep(100); ok(await page.evaluate(() => !document.querySelector('.cbark')), 'flag off: no street chatter');
  ok(errors.length === 0, 'flags off: no page errors'); await browser.close(); }
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
