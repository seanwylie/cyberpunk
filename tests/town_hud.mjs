// Town HUD: combat buttons hidden in town, shown in runs; the interact prompt appears near an interactable and overlaps no visible control.
import { launch, sleep } from './lib.mjs';
import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const VPS = [[1280, 720, 0], [1920, 1080, 0], [760, 600, 0], [844, 390, 1], [390, 844, 1]];
const COMBAT = '#abilities, .abtn, #dodge, .bar.heat, #btn-stim';
const vis = `(el)=>{const r=el.getBoundingClientRect();let e=el;while(e&&e!==document.body){const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||+s.opacity<0.05)return false;e=e.parentElement}return r.width>0&&r.height>0}`;
fs.mkdirSync('shots/townhud', { recursive: true });
for (const [w, h, t] of VPS) {
  const tag = `${w}x${h}${t ? ' touch' : ''}`;
  const { browser, page, errors } = await launch({ viewport: { width: w, height: h }, touch: !!t, query: '?splash=hold' });
  await page.evaluate(() => { document.getElementById('splash')?.remove(); document.body.classList.add('portraitok'); document.getElementById('rotate')?.remove(); });
  const probe = (sel) => page.evaluate(({ sel, visS }) => { const vis=eval(visS); return [...document.querySelectorAll(sel)].filter(vis).map(e => e.id || e.className); }, { sel, visS: vis });
  // town
  await page.evaluate(() => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; window.__ui.open(null); });
  await sleep(400);
  const inTown = await probe(COMBAT); ok(inTown.length === 0, `${tag}: town has no visible combat buttons/heat ${inTown.join(',')}`);
  const trayT = await probe('#btn-menu, #btn-help'); ok(trayT.length === 2, `${tag}: town keeps menu + help buttons`);
  // stand at an interactable
  const placed = await page.evaluate(async () => { const g = window.__game; const it = g.level?.interacts?.[0] || window.__rend?.town?.L?.interacts?.[0]; if (!it) return false; g.px = it.x; g.py = it.y; for (let i = 0; i < 5; i++) g.update(.016); return !!g.prompt; });
  await sleep(300);
  const chk = async (state) => page.evaluate(({ visS }) => { const vis = eval(visS); const ib = document.getElementById('interact'); if (!vis(ib)) return { shown: false }; const r = ib.getBoundingClientRect(); const others = [...document.querySelectorAll('#hud button, #hud canvas, #topleft, #topright, #joyfixed, #objective, #toasts > *, #banner, .bar')].filter(e => e !== ib && !ib.contains(e) && vis(e) && getComputedStyle(e).pointerEvents !== 'none' || e.id === 'topleft' || e.id === 'topright'); const hit = []; for (const e of others) { if (e === ib || !vis(e)) continue; const b = e.getBoundingClientRect(); if (b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top) hit.push(e.id || e.className); } const key = ib.querySelector('small')?.textContent; return { shown: true, hit, key, inView: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.top >= 0, cx: Math.round(r.left + r.width / 2), w: innerWidth }; }, { visS: vis });
  ok(placed, `${tag}: interactable prompt exists near interact point`);
  let c = await chk('town'); ok(c.shown && c.hit.length === 0 && c.inView && c.key === 'F', `${tag}: town prompt visible, F badge, no overlap ${JSON.stringify(c)}`);
  await page.screenshot({ path: `shots/townhud/town_${w}x${h}.png` });
  // run
  await page.evaluate(() => { const g = window.__game; g.dbg.god = true; g.save.lockouts = {}; g.save.lastClearDay = null; g.startRun(Object.keys(window.__dungeons || {})[0] || undefined); });
  await sleep(1200);
  const inRun = await page.evaluate(() => window.__game.mode); ok(inRun === 'run', `${tag}: in run`);
  const runB = await probe('#abilities, #dodge, .bar.heat'); ok(runB.includes('abilities') && runB.includes('dodge') && runB.includes('bar heat'), `${tag}: run shows combat buttons ${runB.join(',')}`);
  await page.evaluate(() => { const g = window.__game; const L = g.level; const it = L?.interacts?.[0]; if (it) { g.px = it.x; g.py = it.y; } for (let i = 0; i < 5; i++) g.update(.016); });
  await sleep(300);
  c = await chk('run'); if (c.shown) ok(c.hit.length === 0 && c.inView, `${tag}: run prompt no overlap ${JSON.stringify(c)}`);
  else console.log(`NOTE ${tag}: no interactable prompt in run`);
  await page.screenshot({ path: `shots/townhud/run_${w}x${h}.png` });
  ok(errors.length === 0, `${tag}: no page errors ${errors.slice(0, 2).join('|')}`);
  await browser.close();
}
process.exit(fails ? 1 : 0);
