import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const out = process.argv[2] || 'shots/town2'; fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); await sleep(3500);
const go = async (name, x, y, w = 1200) => { await page.evaluate(([x, y]) => { const g = window.__game; g.px = x; g.py = y; }, [x, y]); await sleep(w); await page.screenshot({ path: `${out}/${name}.png` }); };
await go('plaza', 20.5, 16.5, 2500); await go('west', 8, 15.5); await go('east', 29, 12); await go('north', 22, 9); await go('south', 20, 21.5); await go('gate', 31, 21);
console.log('errors', errors.slice(0, 5)); await browser.close();
