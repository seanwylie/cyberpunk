// Production build (npm run build && vite preview --port 5602, URL=http://localhost:5602/): service worker registers + activates, versioned cache fills,
// offline reload still boots the game from cache, and pagehide / visibility-hidden persist the save.
import { chromium } from 'playwright-core'; import fs from 'fs';
const URL = process.env.URL || 'http://localhost:5602/'; let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const exe = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=swiftshader'] }); const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message)); await page.addInitScript(() => { try { localStorage.setItem('wv_notut', '1'); } catch {} });
await page.goto(URL, { waitUntil: 'load' }); await page.waitForFunction(() => window.__game || true, null, { timeout: 60000 });
const prod = await page.evaluate(() => ({ dev: !!window.__game, scripts: [...document.scripts].map(s => s.src).filter(Boolean) })); ok(prod.scripts.some(s => /assets\/index-.*\.js/.test(s)), 'serves the hashed production bundle: ' + prod.scripts.join(','));
await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready, null, { timeout: 20000 }).catch(() => {});
const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { scope: r.scope, state: r.active?.state, url: r.active?.scriptURL }; }); ok(reg.state === 'activated' && /sw\.js\?v=/.test(reg.url), `service worker active (${reg.url}, ${reg.state})`);
await page.reload({ waitUntil: 'load' }); await new Promise(r => setTimeout(r, 6000));
const cacheN = await page.evaluate(async () => { const ks = (await caches.keys()).filter(k => k.startsWith('wv-')); let n = 0; for (const k of ks) n += (await (await caches.open(k)).keys()).length; return { ks, n }; }); ok(cacheN.ks.length === 1 && cacheN.n > 10, `one versioned cache (${cacheN.ks}) with ${cacheN.n} entries`);
await ctx.setOffline(true); await page.reload({ waitUntil: 'load' }).catch(e => errs.push('offline reload: ' + e.message)); await new Promise(r => setTimeout(r, 4000));
const off = await page.evaluate(() => ({ title: document.title, canvas: !!document.getElementById('game'), body: document.body.innerText.slice(0, 80) })); ok(off.canvas, `offline reload boots the game from cache (title "${off.title}")`);
await ctx.setOffline(false); await page.reload({ waitUntil: 'load' }); await new Promise(r => setTimeout(r, 3000));
// pagehide / visibility save: the prod build exposes no __game, so poke the save through localStorage keys before/after
const key = await page.evaluate(() => Object.keys(localStorage).find(k => /arpg|save|wv/i.test(k) && k !== 'wv_notut')); ok(!!key, 'save key present: ' + key);
const before = await page.evaluate(k => localStorage.getItem(k), key);
await page.evaluate(k => { const o = JSON.parse(localStorage.getItem(k) || '{}'); o.__probe = 1; }, key);
await page.evaluate(k => localStorage.removeItem(k), key); await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
const after = await page.evaluate(k => localStorage.getItem(k), key); ok(!!after && after.length > 50, `pagehide re-writes the save (${before?.length} -> ${after?.length} bytes)`);
await page.evaluate(k => localStorage.removeItem(k), key); await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
const after2 = await page.evaluate(k => localStorage.getItem(k), key); ok(!!after2 && after2.length > 50, 'visibilitychange(hidden) re-writes the save');
ok(errs.length === 0, 'no page errors ' + errs.slice(0, 2).join('|')); await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
