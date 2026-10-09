// Renders loot-drop previews (per-rarity grids, spawn toss, pickup) as frame PNGs, then tools/loot/make_gifs.py assembles GIFs.
import { launch } from './lib.mjs'; import fs from 'fs';
const out = 'docs/art/loot/frames'; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ viewport: { width: 900, height: 700 } });
await page.evaluate(async () => { window.__M = await import('/src/lootart.ts'); });
const FPS = 24;
const CELLS = [['item','face','HI'],['item','brain','PS'],['item','torso','MM'],['item','armR','HI'],['item','handR','PS','popper'],['item','legL','MM'],['item','footL','HI'],['item','handL','MM'],['chip'],['stim'],['credits'],['item','armL','PS']];
const NAMES = { orange: 'orange', purple: 'purple', blue: 'blue', green: 'green', grey: 'grey' };
async function grid(rar, secs, fx) {
  const frames = await page.evaluate(async ([rar, secs, CELLS, FPS, fx]) => {
    const M = window.__M; const W = 4 * 170, H = 3 * 170, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); const res = [];
    const specs = CELLS.map(([k, slot, mfr, weapon], i) => ({ kind: k, slot, mfr, rar, weapon, name: k + i, sig: false, amount: 3, key: `${k}|${slot}|${mfr}|${rar}|${weapon}|${i}` }));
    for (let f = 0; f < secs * FPS; f++) { const t = 20 + f / FPS; c.fillStyle = '#1a1b1c'; c.fillRect(0, 0, W, H);
      specs.forEach((sp, i) => { const x = (i % 4) * 170 + 85, y = ((i / 4) | 0) * 170 + 128; c.save(); c.beginPath(); c.rect((i % 4) * 170, ((i / 4) | 0) * 170, 170, 170); c.clip(); c.fillStyle = '#24262a'; c.fillRect((i % 4) * 170 + 2, ((i / 4) | 0) * 170 + 2, 166, 166); M.drawLoot(c, x, y, 2.3, t, sp, i * 977 + 13, { age: 99, reduced: fx === 1, fx }); c.restore(); });
      res.push(cv.toDataURL('image/png').slice(22)); }
    return res; }, [rar, secs, CELLS, FPS, fx]);
  const dir = `${out}/${fx === 1 ? 'reduced_' : ''}${rar}`; fs.mkdirSync(dir, { recursive: true }); frames.forEach((b, i) => fs.writeFileSync(`${dir}/${String(i).padStart(3, '0')}.png`, Buffer.from(b, 'base64')));
}
for (const r of ['grey', 'green', 'blue', 'purple', 'orange']) await grid(r, 4, 2);
await grid('orange', 2, 1);
// spawn toss: one item per rarity
const sp = await page.evaluate(async (FPS) => { const M = window.__M; const W = 5 * 170, H = 190, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); const res = [];
  const R = ['grey', 'green', 'blue', 'purple', 'orange']; const specs = R.map((r, i) => ({ kind: 'item', slot: 'torso', mfr: ['MM', 'MM', 'PS', 'HI', 'HI'][i], rar: r, name: r, sig: false, amount: 1, key: 'spawn|' + r }));
  for (let f = 0; f < 2.2 * FPS; f++) { const age = f / FPS; c.fillStyle = '#24262a'; c.fillRect(0, 0, W, H); specs.forEach((sp, i) => M.drawLoot(c, i * 170 + 85, 150, 2.3, 30 + age, sp, 101 * (i + 3), { age, reduced: false, fx: 2 })); res.push(cv.toDataURL('image/png').slice(22)); } return res; }, FPS);
fs.mkdirSync(`${out}/spawn`, { recursive: true }); sp.forEach((b, i) => fs.writeFileSync(`${out}/spawn/${String(i).padStart(3, '0')}.png`, Buffer.from(b, 'base64')));
const pk = await page.evaluate(async (FPS) => { const M = window.__M; const W = 5 * 170, H = 190, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); const res = [];
  const R = ['grey', 'green', 'blue', 'purple', 'orange']; const specs = R.map((r, i) => ({ kind: 'item', slot: ['armR', 'face', 'brain', 'legL', 'torso'][i], mfr: ['MM', 'MM', 'PS', 'HI', 'HI'][i], rar: r, name: r, sig: false, amount: 1, key: 'pick|' + r }));
  for (let f = 0; f < 1.6 * FPS; f++) { const tt = f / FPS; c.fillStyle = '#24262a'; c.fillRect(0, 0, W, H); specs.forEach((sp, i) => { const ox = i * 170; if (tt < .5) M.drawLoot(c, ox + 40, 150, 2.3, 30 + tt, sp, 5 + i, { age: 99, reduced: false, fx: 2 }); M.drawPickup(c, ox + 40, 150, ox + 125, 130, 2.3, (tt - .5) / M.PICK_T, sp, i, false); c.fillStyle = '#7a7568'; c.fillRect(ox + 118, 100, 14, 32); }); res.push(cv.toDataURL('image/png').slice(22)); } return res; }, FPS);
fs.mkdirSync(`${out}/pickup`, { recursive: true }); pk.forEach((b, i) => fs.writeFileSync(`${out}/pickup/${String(i).padStart(3, '0')}.png`, Buffer.from(b, 'base64')));
console.log('errors', errors); await browser.close();
