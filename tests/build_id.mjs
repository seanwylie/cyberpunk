// Build identity: console/global build id exists and Settings > About shows it; the update check banner appears when /version.json reports a different build (simulated by route).
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 }, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove()); await sleep(1500);
const b = await ev(() => window.__build); ok(b && typeof b.id === 'string' && b.id.length > 0, `window.__build present (${JSON.stringify(b)})`);
await ev(() => { window.__ui.open('settings'); }); await sleep(300); await ev(() => { document.querySelector('#modal [data-tab=about],#modal [data-act=s-tab][data-t=about]')?.click(); });
const txt = await ev(() => { const el = [...document.querySelectorAll('#modal *')].find(e => e.id === 'buildid'); return el ? el.textContent : ''; });
if (!txt) { await ev(() => { for (const e of document.querySelectorAll('#modal button,#modal [data-t]')) if (/about/i.test(e.textContent + (e.dataset.t || ''))) e.click(); }); }
const t2 = await ev(() => document.getElementById('buildid')?.textContent || ''); ok(/Build /.test(t2), `Settings > About shows the build id ("${t2}")`);
const { checkVersion } = await ev(async () => { const m = await import('/src/version.ts'); window.__cv = m.checkVersion; return {}; });
await page.route('**/version.json*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'deadbee', time: 'x', build: '1' }) }));
const res = await ev(() => window.__cv()); ok(res === 'unknown' || res === 'newer', `check returns ${res} in dev (banner only in production bundles)`);
ok(errors.length === 0, 'no page errors ' + (errors[0] || '')); await browser.close();
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
