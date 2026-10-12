import { chromium } from 'playwright-core';
import fs from 'fs';
export const URL = process.env.URL || 'http://localhost:5173/';
export async function launch(opts = {}) {
  const exe = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 720 }, hasTouch: !!opts.touch, isMobile: !!opts.touch, deviceScaleFactor: opts.dpr || 1 });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  // hermetic story proxy: the dev middleware rate-limits (429) when many suites share one IP, and Chrome logs any 4xx as a console error. The client already falls back to authored beats on ok:false.
  if (!opts.realStory) await page.route('**/api/story-beat', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false }) }));
  // the first-run tutorial is off for every other test (it is covered by tests/tutorial.mjs); pass tutorial:true to leave it on
  // the calm-start grace (dormant enemies, unhurtable player) is off for every other test; pass grace:true to leave it on (tests/calm_start.mjs)
  if (!opts.grace) await page.addInitScript(() => { try { localStorage.setItem('wv_nograce', '1'); } catch {} });
  if (!opts.tutorial) await page.addInitScript(() => { try { localStorage.setItem('wv_notut', '1'); } catch {} });
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(URL + (opts.query || ''), { waitUntil: 'load' }); await page.waitForFunction(() => window.__game);
  return { browser, ctx, page, errors };
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
