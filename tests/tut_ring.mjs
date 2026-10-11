// The tutorial spotlight (#tutspot) must exist only while a real tutorial step is active: never for returning players, and always cleared when the tutorial is skipped / done,
// across mode (town/run) and modal transitions, and it fades from HUD targets after 30 s.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ring = page => page.evaluate(() => { const s = document.getElementById('tutspot'), w = document.getElementById('tutworld'), e = document.getElementById('tutedge'); const on = x => !!x && getComputedStyle(x).display !== 'none'; return { spot: on(s), world: on(w), edge: on(e), card: on(document.getElementById('tut')) }; });
const boot = async (vet) => { const r = await launch({ tutorial: true, viewport: { width: 1280, height: 720 }, query: '?tutorial=on&splash=hold' });
  await r.page.evaluate(() => { document.getElementById('splash')?.remove(); }); await sleep(1200);
  if (vet) { const a = await r.page.evaluate(() => window.__tut.shown); await r.page.evaluate(() => { window.__game.save.stats.runs = 3; window.__game.save.stats.kills = 50; }); await sleep(600); } return r; };
// 1. returning player (has played, no tutorial record yet): no ring, no card, in town and in a run
{ const { browser, page } = await boot(true);
  const had = await page.evaluate(() => window.__tut.st.status); ok(had === 'skipped' || had === 'done', 'returning player save starts with the tutorial done (' + had + ')');
  let r = await ring(page); ok(!r.spot && !r.card, `returning player in town: no spotlight/card (${JSON.stringify(r)})`);
  await page.evaluate(() => { window.__game.startRun('annex'); }); await sleep(1500); r = await ring(page); ok(!r.spot && !r.card, `returning player in a run: no spotlight/card (${JSON.stringify(r)})`); await browser.close(); }
// 2. fresh player: ring only while a step is active; clears on skip
{ const { browser, page } = await boot(false); await sleep(1500);
  await page.evaluate(() => { window.__game.dbg.god = true; const t = window.__tut; for (const i of ['move', 'fixer', 'equip', 'socket', 'vendor', 'bank', 'gate']) { try { t.latch(i); } catch {} } window.__game.startRun('annex'); }); await sleep(1500);
  let r = await ring(page); ok(r.card && r.spot, 'fresh player on the controls step: card + HUD ring shown (' + JSON.stringify(r) + ')');
  // transitions: opening a modal / leaving the run never leaves a ring from the previous context behind
  await page.evaluate(() => window.__game.enterTown()); await sleep(800); r = await ring(page); const st = await page.evaluate(() => window.__tut.cur()?.id); const sel = await page.evaluate(() => window.__tut.view?.target?.sel || ''); ok(!r.spot || /^#/.test(sel) || !sel, `after returning to town the HUD ring is not stale (step ${st}, ring ${r.spot})`);
  // 30 s fade for HUD targets
  await page.evaluate(() => { window.__game.dbg.god = true; window.__game.startRun('annex'); }); await sleep(1200); await page.evaluate(() => { window.__tut.stepSince = performance.now() - 31000; }); await sleep(500); r = await ring(page); ok(!r.spot, `HUD spotlight fades after 30 s (${JSON.stringify(r)})`);
  await page.evaluate(() => { const t = window.__tut; t.st.status = 'skipped'; }); await sleep(500); r = await ring(page); ok(!r.spot && !r.world && !r.edge && !r.card, `skipped tutorial: everything cleared (${JSON.stringify(r)})`);
  await page.evaluate(() => { window.__game.enterTown(); window.__ui.open('locker'); }); await sleep(500); r = await ring(page); ok(!r.spot && !r.card, 'skipped tutorial stays cleared across town/modal transitions'); await browser.close(); }
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
