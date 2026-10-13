// Screenshots of the new town: plaza hub + a close-up of every station, then a contact sheet (shots/townlayout/contact.png).
import { launch, sleep } from '../../tests/lib.mjs'; import fs from 'fs'; import { execSync } from 'child_process';
const out = 'shots/townlayout'; fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 }); await sleep(2500);
await page.evaluate(() => { document.getElementById('splash')?.remove(); window.__ui.open(null); });
const go = async (name, x, y, w = 1400) => { await page.evaluate(([x, y]) => { const g = window.__game; g.px = x; g.py = y; for (let i = 0; i < 5; i++) g.update(.016); }, [x, y]); await sleep(w); await page.screenshot({ path: `${out}/${name}.png` }); };
await go('00_spawn', 30.5, 22.5, 2500);
const st = await page.evaluate(() => window.__game.level.interacts.map(i => [i.station, i.x, i.y]));
for (const [k, x, y] of st) await go('st_' + k, x, y);
await go('overview_gate_road', 44, 22.5);
console.log('errors', errors.slice(0, 5)); await browser.close();
const names = ['00_spawn', ...st.map(s => 'st_' + s[0])];
execSync(`python3 - <<'PY'\nfrom PIL import Image, ImageDraw\nn=${JSON.stringify(names)}\nims=[Image.open('${out}/'+x+'.png').resize((640,360)) for x in n]\ncols=3;rows=(len(ims)+2)//3\nsh=Image.new('RGB',(640*cols,360*rows))\nd=ImageDraw.Draw(sh)\nfor i,im in enumerate(ims):\n  sh.paste(im,((i%cols)*640,(i//cols)*360)); d.text(((i%cols)*640+8,(i//cols)*360+6),n[i],fill=(255,255,255))\nsh.save('${out}/contact.png')\nPY`);
