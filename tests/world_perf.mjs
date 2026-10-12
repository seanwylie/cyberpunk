// World performance (docs/WORLD.md): townperf frame budget in every generated district (QUICK: 1280x720, 1x + 4x CPU), then a memory check that
// visiting every town keeps at most two generated art sets alive and the JS heap within budget (lazy per-town assets).
import { execFileSync } from 'node:child_process';
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const ids = (process.env.TOWNS || 'neon_mile,the_stacks,salt_harbor,dust_yard,under_bazaar,aldane_spire,signal_heights,kestrel_plaza,tether_base').split(',');
for (const t of ids) { try { const o = execFileSync('node', ['tests/townperf.mjs'], { env: { ...process.env, QUICK: '1', TOWN: t }, encoding: 'utf8' }); console.log(o.trim().split('\n').filter(l => /cpu x/.test(l)).join('\n')); ok(/townperf OK/.test(o), t + ': townperf within budget'); } catch (e) { console.log(String(e.stdout || e)); ok(false, t + ': townperf'); } }
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
const heap0 = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
for (const t of ['rustline', ...ids, 'harrow', 'rustline']) { await page.evaluate(t => { const w = (window.__game.save.world ??= { visited: {}, landmarks: {} }); (w.unlocked ??= {})[t] = 1; window.__game.travel(t); }, t); await page.waitForFunction(t => window.__game.townId === t && window.__rend.town?.ready, t, { timeout: 60000 }).catch(() => {}); await sleep(600); }
const r = await page.evaluate(() => ({ arts: Object.keys(window.__rend.townArts || {}), heap: performance.memory?.usedJSHeapSize || 0 }));
ok(r.arts.length <= 2, `generated town art sets alive after touring every town: ${r.arts.length} (<= 2: ${r.arts.join(', ')})`);
ok(!r.heap || r.heap < 700e6, `JS heap after the tour ${(r.heap / 1e6).toFixed(0)} MB (start ${(heap0 / 1e6).toFixed(0)} MB, budget 700 MB)`);
ok(errors.length === 0, 'no page errors ' + (errors[0] || '')); await browser.close();
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
