// Station title pill (bright/ready state) and interact prompt share ONE trigger: the pill is in its ready state iff the player is inside the station's interact radius (same check as the F prompt, small hysteresis). Both towns. Contact sheet in shots/stations/.
import { launch, sleep } from './lib.mjs'; import fs from 'fs'; import { execSync } from 'child_process';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const out = process.env.SHOTS || 'shots/stations'; fs.mkdirSync(out, { recursive: true });
const [VW, VH, VT] = (process.env.VP || '1280x720').split(/[x,]/); const { browser, page, errors } = await launch({ viewport: { width: +VW, height: +VH }, touch: !!VT, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove());
await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
await ev(() => { window.__texts = []; const o = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { if (this.canvas && this.canvas.id === 'game') window.__texts.push(String(t)); return o.call(this, t, ...r); }; window.__ui.open(null);
  // count world-sign draws per station (scaled() returns the cached canvas; tag it with its sprite name)
  const t = window.__rend.town, os = t.scaled.bind(t); window.__signs = new WeakMap(); window.__signDraws = {}; t.scaled = (n, ...r) => { const v = os(n, ...r); if (v && n.startsWith('sign_')) window.__signs.set(v.cv || v, n); return v; };
  const od = CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage = function (im, ...r) { const n = window.__signs.get(im); if (n && this.globalAlpha > .05) window.__signDraws[n] = (window.__signDraws[n] || 0) + 1; return od.call(this, im, ...r); }; });
const names = [];
for (const town of ['rustline', 'harrow']) {
  await ev(async town => { const g = window.__game; g.save.level = 30; g.checkTownUnlocks(); if (g.townId !== town) g.travel(town); window.__ui.open(null); }, town);
  await page.waitForFunction(t => window.__rend.town?.ready && window.__game.townId === t, town, { timeout: 30000 }); await sleep(1500);
  const sts = await ev(() => window.__game.level.interacts.map(i => ({ id: i.id, key: i.station, x: i.x, y: i.y, r: i.r, name: i.label.split(':')[0].toUpperCase() })));
  const nm = await ev(async () => { const S = await import('/src/stations.ts'); return Object.fromEntries(S.STATIONS.map(s => [s.key, s.name.toUpperCase()])); });
  for (const st of sts) for (const [lab, dx] of [['far', 8], ['edge_out', st.r + .6], ['edge_in', st.r - .5], ['on', 0]]) {
    // approach from a walkable side
    const pos = await ev(([st, dx]) => { const g = window.__game; for (let a = 0; a < 16; a++) { const ang = a * Math.PI / 8; const x = st.x + Math.cos(ang) * dx, y = st.y + Math.sin(ang) * dx; if (!g.solidAt(x, y) && g.los(x, y, st.x, st.y)) { g.px = x; g.py = y; break; } } g.prompt = null; for (let i = 0; i < 4; i++) g.update(.016); return { d: Math.hypot(g.px - st.x, g.py - st.y) }; }, [st, dx]);
    if (Math.abs(pos.d - dx) > .3 && dx > 0) continue; // no clear spot at that distance
    await ev(() => { window.__texts.length = 0; window.__signDraws = {}; }); await sleep(500);
    const r = await ev(([st, name]) => { const g = window.__game; const inside = Math.hypot(g.px - st.x, g.py - st.y) < st.r; return { sign: window.__signDraws['sign_' + st.key] || 0, dbg: window.__texts.slice(0, 6).join('|') + ' want ' + name, shown: (window.__rend.lblRects || []).some(q => q.id === st.id && q.ready), prompt: g.prompt?.id === st.id, inside }; }, [st, st.name]);
    ok(r.shown === r.prompt && r.prompt === r.inside, `${town}/${st.key} ${lab} (d=${pos.d.toFixed(1)}, r=${st.r}): title ${r.shown} [${r.dbg}], prompt ${r.prompt}, inside ${r.inside}`);
    ok(r.sign === 0, `${town}/${st.key} ${lab}: the world sign sprite is never drawn (${r.sign} draws); the single pill is the only label`);
    if (lab === 'far' || lab === 'edge_in') { await sleep(400); await page.screenshot({ path: `${out}/${town}_${st.key}_${lab}.png` }); names.push(`${town}_${st.key}_${lab}`); }
  }
}
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close();
try { fs.writeFileSync(`${out}/names.json`, JSON.stringify(names)); execSync(`python3 - <<'PY'\nfrom PIL import Image\nimport json\nn=json.load(open('${out}/names.json'))\nims=[Image.open('${out}/'+x+'.png').resize((480,270)) for x in n]\ncols=4;rows=(len(ims)+cols-1)//cols\nsh=Image.new('RGB',(480*cols,270*rows))\nfor i,im in enumerate(ims): sh.paste(im,((i%cols)*480,(i//cols)*270))\nsh.save('${out}/contact.png')\nPY`); } catch (e) { console.log('contact sheet failed', e.message); }
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
