// Captures an in-town GIF of trail cosmetics while the player runs a loop then stops (fade check). Usage: URL=... node tools/cos/trail_gif.mjs out_prefix id1,id2,...
import { launch, sleep } from '../../tests/lib.mjs'; import fs from 'fs'; import { execSync } from 'child_process';
const pre = process.argv[2] || '/tmp/trail'; const ids = (process.argv[3] || 'trail_sparks').split(',');
const { browser, page } = await launch({ viewport: { width: 900, height: 600 } });
for (const id of ids) {
  await page.evaluate(async (id) => { const A = await import('/src/content/appearance.ts'); const g = window.__game, s = g.save; s.cosmetics = A.newCos(); A.grantCos(s, id); A.equipCos(s, id); g.enterTown(true); window.__ui?.closeAll?.(); }, id);
  await sleep(1500); const dir = `${pre}_${id}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (let f = 0; f < 48; f++) { await page.evaluate((f) => { const g = window.__game; const a = f * .22; g.inputMove = f < 34 ? { x: Math.cos(a), y: Math.sin(a) } : { x: 0, y: 0 }; }, f);
    await sleep(70); const q = await page.evaluate(() => { const g = window.__game, r = window.__rend; return { x: r.sx(g.px, g.py), y: r.sy(g.px, g.py) }; }); await page.screenshot({ path: `${dir}/${String(f).padStart(3, '0')}.png`, clip: { x: Math.round(q.x - 120), y: Math.round(q.y - 130), width: 240, height: 180 } }); }
  execSync(`ffmpeg -loglevel error -y -framerate 14 -i ${dir}/%03d.png -vf "scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" ${dir}.gif`); fs.rmSync(dir, { recursive: true, force: true }); console.log(dir + '.gif');
}
await browser.close();
