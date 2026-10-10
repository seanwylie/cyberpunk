// Mobile device emulation helpers (touch, DPR, UA, optional CPU throttle).
import { chromium } from 'playwright-core';
import fs from 'fs';
export const URL = process.env.URL || 'http://localhost:5173/';
export const DEVICES = {
  phoneL: { w: 844, h: 390, dpr: 3, name: 'phone landscape 844x390' },
  phoneP: { w: 390, h: 844, dpr: 3, name: 'phone portrait 390x844' },
  androidL: { w: 915, h: 412, dpr: 2.625, name: 'android landscape 915x412' },
  tabletP: { w: 768, h: 1024, dpr: 2, name: 'tablet portrait 768x1024' },
};
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
export async function launchMobile(dev, o = {}) {
  const exe = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: dev.w, height: dev.h }, screen: { width: dev.w, height: dev.h }, deviceScaleFactor: dev.dpr, hasTouch: true, isMobile: true, userAgent: UA });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  if (o.init) await page.addInitScript(o.init);
  await page.goto(URL + (o.query || ''), { waitUntil: 'load' }); await page.waitForFunction(() => window.__game, null, { timeout: 60000 }); if (!o.keepSplash) await page.evaluate(() => document.getElementById('splash')?.remove());
  const cdp = await ctx.newCDPSession(page); if (o.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: o.cpu });
  return { browser, ctx, page, cdp, errors };
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
// Measures Renderer.draw() (+forced raster) while walking; town or a dungeon.
export async function perf(page, where = 'town', n = 120) {
  return page.evaluate(async ({ where, n }) => {
    const g = window.__game, R = window.__rend;
    if (where === 'town') { await new Promise(r => { const t = setInterval(() => { if (R.town?.ready) { clearInterval(t); r(); } }, 100); setTimeout(r, 20000); }); }
    else { g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.dbg.god = true; g.startRun(where); await new Promise(r => setTimeout(r, 1500)); for (let i = 0; i < 200; i++) g.update(.016); }
    const T = [], S = []; let frames = 0; const raf = []; let last = performance.now();
    for (let i = 0; i < 30; i++) { g.update(.016); R.draw(.016); }
    await new Promise(res => { const f = () => { const now = performance.now(); raf.push(now - last); last = now; const a = performance.now(); g.setMove(Math.cos(frames / 40), Math.sin(frames / 40)); g.update(.016); R.draw(.016); S.push(performance.now() - a); R.ctx.getImageData(0, 0, 1, 1); T.push(performance.now() - a); if (++frames < n) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    g.setMove(0, 0);
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1); };
    return { med: q(T, .5), p95: q(T, .95), submitP95: q(S, .95), rafMed: q(raf.slice(5), .5), rafP95: q(raf.slice(5), .95), canvas: R.canvas.width + 'x' + R.canvas.height, tier: window.__quality?.tier };
  }, { where, n });
}
