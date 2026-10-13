import { launch } from '../../tests/lib.mjs';
const sizes = [[1280, 720], [1024, 700], [390, 760]];
for (const [w, h] of sizes) {
  const { browser, page } = await launch({ viewport: { width: w, height: h }, touch: w < 600, query: '?splash=hold' });
  await page.evaluate(() => { document.getElementById('splash')?.remove(); document.getElementById('rotate')?.remove(); document.body.classList.add('portraitok'); });
  await page.evaluate(async () => { const g = window.__game; g.enterTown(); const B = await import('/src/bank.ts'), C = await import('/src/config.ts'), S = await import('/src/state.ts'); const s = g.save; s.credits = 2400; s.level = 40; const ds = Object.values(C.ITEM_BY_ID).filter(d => !d.id.startsWith('stock_')); for (let i = 0; i < 70; i++) { const it = S.mkInst(s, ds[(i * 7) % ds.length].id); s.items.push(it); if (i < 52) B.depositItem(s, it.uid, i < 40 ? 0 : 1); } s.lockerChips = { speed: 6, coolant: 4, power: 3, sustain: 5 }; B.depositChip(s, 'speed', 4); B.bankOf(s).credits = 1200; window.__ui.open('bank'); });
  await page.waitForTimeout(600); await page.evaluate(() => document.getElementById('splash')?.remove()); await page.waitForTimeout(100); await page.screenshot({ path: `shots/bank/bank_${w}x${h}.png` });
  const ov = await page.evaluate(() => { const win = document.querySelector('#modal .win'); const bad = [...document.querySelectorAll('#modal [data-bank] button, #modal [data-bank] select')].filter(b => { const r = b.getBoundingClientRect(), wr = win.getBoundingClientRect(); return r.width > 0 && (r.right > wr.right + 1 || r.left < wr.left - 1); }).length; return bad + (win ? 0 : 999); });
  console.log(w + 'x' + h, 'controls outside panel:', ov); await browser.close();
}
