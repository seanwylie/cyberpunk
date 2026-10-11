// Station title pill and interact prompt share ONE trigger: the title is drawn iff the player is inside the station's interact radius (same check as the F prompt, small hysteresis). Both towns. Contact sheet in shots/stations/.
import { launch, sleep } from './lib.mjs'; import fs from 'fs'; import { execSync } from 'child_process';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const out = process.env.SHOTS || 'shots/stations'; fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove());
await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
await ev(() => { window.__texts = []; const o = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { if (this.canvas && this.canvas.id === 'game') window.__texts.push(String(t)); return o.call(this, t, ...r); }; window.__ui.open(null); });
const names = [];
for (const town of ['rustline', 'harrow']) {
  await ev(async town => { const g = window.__game; g.save.level = 30; g.checkTownUnlocks(); if (g.townId !== town) g.travel(town); window.__ui.open(null); }, town);
  await page.waitForFunction(t => window.__rend.town?.ready && window.__game.townId === t, town, { timeout: 30000 }); await sleep(1500);
  const sts = await ev(() => window.__game.level.interacts.map(i => ({ id: i.id, key: i.station, x: i.x, y: i.y, r: i.r, name: window.__SM_names?.[i.station] })));
  const nm = await ev(async () => { const S = await import('/src/stations.ts'); return Object.fromEntries(S.STATIONS.map(s => [s.key, s.name.toUpperCase()])); });
  for (const st of sts) for (const [lab, dx] of [['far', 8], ['edge_out', st.r + .6], ['edge_in', st.r - .5], ['on', 0]]) {
    // approach from a walkable side
    const pos = await ev(([st, dx]) => { const g = window.__game; for (let a = 0; a < 16; a++) { const ang = a * Math.PI / 8; const x = st.x + Math.cos(ang) * dx, y = st.y + Math.sin(ang) * dx; if (!g.solidAt(x, y) && g.los(x, y, st.x, st.y)) { g.px = x; g.py = y; break; } } g.prompt = null; for (let i = 0; i < 4; i++) g.update(.016); return { d: Math.hypot(g.px - st.x, g.py - st.y) }; }, [st, dx]);
    if (Math.abs(pos.d - dx) > .3 && dx > 0) continue; // no clear spot at that distance
    await ev(() => { window.__texts.length = 0; }); await sleep(120);
    const r = await ev(([st, name]) => { const g = window.__game; const inside = Math.hypot(g.px - st.x, g.py - st.y) < st.r; return { shown: window.__texts.includes(name), prompt: g.prompt?.id === st.id, inside }; }, [st, nm[st.key]]);
    ok(r.shown === r.prompt && r.prompt === r.inside, `${town}/${st.key} ${lab} (d=${pos.d.toFixed(1)}, r=${st.r}): title ${r.shown}, prompt ${r.prompt}, inside ${r.inside}`);
    if (lab === 'far' || lab === 'edge_in') { await sleep(400); await page.screenshot({ path: `${out}/${town}_${st.key}_${lab}.png` }); names.push(`${town}_${st.key}_${lab}`); }
  }
}
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close();
try { fs.writeFileSync(`${out}/names.json`, JSON.stringify(names)); execSync(`python3 - <<'PY'\nfrom PIL import Image\nimport json\nn=json.load(open('${out}/names.json'))\nims=[Image.open('${out}/'+x+'.png').resize((480,270)) for x in n]\ncols=4;rows=(len(ims)+cols-1)//cols\nsh=Image.new('RGB',(480*cols,270*rows))\nfor i,im in enumerate(ims): sh.paste(im,((i%cols)*480,(i//cols)*270))\nsh.save('${out}/contact.png')\nPY`); } catch (e) { console.log('contact sheet failed', e.message); }
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
