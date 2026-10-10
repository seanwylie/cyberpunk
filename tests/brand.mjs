import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const out = process.argv[2] || 'shots/brand'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok', m); };
for (const [name, o] of [['desktop', { viewport: { width: 1280, height: 720 } }], ['mobile', { viewport: { width: 844, height: 390 }, touch: true }]]) {
  const { browser, page, errors } = await launch({ ...o, query: '?splash=hold' });
  await sleep(300); await page.screenshot({ path: `${out}/${name}_splash.png` });
  ok(await page.evaluate(() => !!document.querySelector('#splash .bvg img')), name + ' splash logo');
  const r = await page.evaluate(() => { const b = document.querySelector('#splash .bvg img').getBoundingClientRect(); return [b.width, innerWidth, innerHeight, b.right, b.bottom, document.querySelector('#splash .bvg').getBoundingClientRect().left]; });
  ok(r[0] >= 56 && r[0] <= 72 && r[5] >= 0 && r[5] < 40 && r[4] <= r[2], name + ' logo size/in-bounds ' + r[0]);
  await page.evaluate(() => { document.getElementById('splash').remove(); }); await sleep(800);
  await page.screenshot({ path: `${out}/${name}_game.png` }); ok(await page.evaluate(() => !document.querySelector('#hud .bvg, canvas ~ .bvg')), name + ' no logo in HUD');
  ok(await page.evaluate(() => { const m=document.getElementById('bvgmark'); const h=document.getElementById('hud'); return getComputedStyle(m).pointerEvents==='none' && (m.compareDocumentPosition(h) & 4)>0 && +getComputedStyle(m).zIndex===0; }), name + ' mark inert, behind HUD');
  await page.evaluate(() => { window.__ui.open('settings'); document.getElementById('stab-about').click(); }); await sleep(400);
  await page.screenshot({ path: `${out}/${name}_settings.png` });
  ok(await page.evaluate(() => document.querySelectorAll('#modal .bvg img').length >= 1), name + ' about logo');
  ok(errors.length === 0, name + ' no errors ' + errors.slice(0, 2));
  await browser.close();
}
process.exit(fail ? 1 : 0);
