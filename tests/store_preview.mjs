// Outfitter previews must render the character (they once pointed at splash art that never shipped and stayed blank).
// Checks hero + detail canvases have non-background pixels, turn over time, and change when another skin is picked. Shot: /workspace/outfitter_after.png (OUT env)
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const ev = (f, a) => page.evaluate(f, a);
await ev(() => { document.getElementById('splash')?.remove(); window.__game.enterTown(true); window.__ui.open('store'); });
await sleep(600);
const px = sel => ev(sel => { const c = document.querySelector(sel); if (!c || !c.width) return null; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let fg = 0, h = 0; for (let i = 0; i < d.length; i += 4) { const v = d[i] + d[i + 1] + d[i + 2]; if (v > 140) fg++; h = (h * 31 + v) | 0; } return { fg, h, n: d.length / 4 }; }, sel);
let hero = await px('#modal .sthero canvas.stprev');
ok(hero && hero.fg > hero.n * .03, `hero preview draws the character (${hero?.fg}/${hero?.n} lit px)`);
await ev(() => { const b = [...document.querySelectorAll('#modal [data-act=st-sel]')]; (b.find(x => x.closest('.spotgrid')) || b[0]).click(); }); await sleep(500);
const a = await px('#modal .wdsel canvas.stprev'); ok(a && a.fg > a.n * .03, `detail preview draws the character (${a?.fg}/${a?.n})`);
await sleep(1600); const a2 = await px('#modal .wdsel canvas.stprev'); ok(a2 && a2.h !== a.h, 'detail preview turns over time');
const id1 = await ev(() => document.querySelector('#modal .wdsel canvas.stprev').dataset.cos);
await ev(() => { const b = [...document.querySelectorAll('#modal [data-rotation] [data-act=st-sel]')]; b[b.length - 1].click(); }); await sleep(500);
const id2 = await ev(() => document.querySelector('#modal .wdsel canvas.stprev')?.dataset.cos); const b = await px('#modal .wdsel canvas.stprev');
ok(id2 && id2 !== id1 && b && b.fg > b.n * .03, `picking another skin re-renders the preview (${id1} -> ${id2})`);
await page.screenshot({ path: process.env.OUT || 'shots/store_preview.png' });
ok(!errors.length, 'no page errors ' + JSON.stringify(errors).slice(0, 300));
await browser.close(); process.exit(fails ? 1 : 0);
