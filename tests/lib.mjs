import { chromium } from 'playwright-core';
import fs from 'fs';
export const URL = process.env.URL || 'http://localhost:5173/';
export async function launch(opts = {}) {
  const exe = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 720 }, hasTouch: !!opts.touch, isMobile: !!opts.touch, deviceScaleFactor: opts.dpr || 1 });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(URL + (opts.query || ''), { waitUntil: 'load' }); await page.waitForFunction(() => window.__game);
  return { browser, ctx, page, errors };
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
