// Environment texture cost: first-draw (generation) hitch, steady-state draw time, texture memory. Throttled CPU approximates a mid phone.
import { launch, sleep } from './lib.mjs';
for (const [name, rate, q] of [['desktop', 1, ''], ['cpu x4 (phone-ish)', 4, ''], ['flat fallback x4', 4, '?flat']]) {
  const { browser, page, ctx } = await launch({ viewport: { width: 844, height: 390 }, dpr: 2, query: q });
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate }); await sleep(rate > 1 ? 14000 : 4000); // background warm-up (as during the town/menu)
  const r = await page.evaluate(async () => { const g = window.__game, R = window.__rend; g.startRun(); g.dbg.god = true; const t = []; const pts = [[8, 19], [30, 19], [55, 19], [75, 19]];
    for (const [x, y] of pts) { g.px = x; g.py = y; g.update(.016); const a = performance.now(); R.draw(.016); t.push(performance.now() - a); }
    const s = []; for (let i = 0; i < 60; i++) { const a = performance.now(); R.draw(.016); s.push(performance.now() - a); } s.sort((a, b) => a - b);
    return { firstDrawMs: t.map(v => +v.toFixed(0)), steadyMedianMs: +s[30].toFixed(1), steadyP95Ms: +s[57].toFixed(1), texMB: R.env ? +R.env.memoryMB.toFixed(1) : 0 }; });
  console.log(name, JSON.stringify(r)); await browser.close();
}
