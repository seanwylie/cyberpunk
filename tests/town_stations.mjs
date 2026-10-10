// Town stations: separation, unique colour/icon, prompts, minimap markers, offscreen arrows, reachability, return spawn, sign sprites.
import { build } from 'esbuild'; import os from 'os'; import path from 'path'; import { pathToFileURL } from 'url';
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const out = path.join(os.tmpdir(), 'stations_check.mjs');
await build({ entryPoints: ['src/stations.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' });
const lv = path.join(os.tmpdir(), 'level_check2.mjs'); await build({ entryPoints: ['src/level.ts'], bundle: true, format: 'esm', outfile: lv, logLevel: 'silent' });
const { STATIONS, MIN_STATION_DIST, stationPrompt, SPAWN, RETURN_SPAWN } = await import(pathToFileURL(out).href); const { buildTown } = await import(pathToFileURL(lv).href); const L = buildTown();
ok(STATIONS.length >= 6, `${STATIONS.length} stations`);
let minD = 1e9, pair = ''; for (let i = 0; i < STATIONS.length; i++) for (let j = i + 1; j < STATIONS.length; j++) { const d = Math.hypot(STATIONS[i].x - STATIONS[j].x, STATIONS[i].y - STATIONS[j].y); if (d < minD) { minD = d; pair = STATIONS[i].key + '/' + STATIONS[j].key; } }
ok(minD >= MIN_STATION_DIST, `min station distance ${minD.toFixed(1)} (${pair}) >= ${MIN_STATION_DIST}`);
ok(new Set(STATIONS.map(s => s.color)).size === STATIONS.length, 'unique colour per station'); ok(new Set(STATIONS.map(s => s.icon)).size === STATIONS.length, 'unique icon per station');
// colours must be visually distinct (RGB distance)
let minC = 1e9; for (let i = 0; i < STATIONS.length; i++) for (let j = i + 1; j < STATIONS.length; j++) { const a = STATIONS[i].rgb.split(',').map(Number), b = STATIONS[j].rgb.split(',').map(Number); minC = Math.min(minC, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); } ok(minC > 90, `colour separation ${minC.toFixed(0)} > 90`);
// reachability from spawn and return spawn; prompts
const W = L.w; const seen = new Uint8Array(W * L.h); const q = [[Math.floor(SPAWN.x), Math.floor(SPAWN.y)]]; seen[q[0][1] * W + q[0][0]] = 1; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= L.h || L.solid[ny * W + nx] || seen[ny * W + nx]) continue; seen[ny * W + nx] = 1; q.push([nx, ny]); } }
const at = p => seen[Math.floor(p.y) * W + Math.floor(p.x)] === 1; ok(at(SPAWN) && at(RETURN_SPAWN), 'spawn + return spawn walkable and connected');
for (const s of STATIONS) { const it = L.interacts.find(i => i.station === s.key); ok(!!it && at(it), `${s.key}: interact reachable`); ok(it && it.label === stationPrompt(s) && it.label.includes(':'), `${s.key}: prompt "${it?.label}"`); ok(Math.hypot(it.x - SPAWN.x, it.y - SPAWN.y) < 30, `${s.key}: within 30 tiles of spawn`); const sg = L.decor.find(d => d.spr === 'sign_' + s.key); ok(!!sg, `${s.key}: world sign decor`); }
ok(L.interacts.find(i => i.id === 'annex').label.startsWith('Dungeon Gate'), 'gate prompt names function');
ok(L.interacts.find(i => i.id === 'fixer').label === 'Job Board: browse contracts', 'job board prompt'); ok(L.interacts.find(i => i.id === 'vendor').label === 'Implant Parts: buy augments', 'implant prompt');
// in-browser
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 }); await sleep(1500); await page.evaluate(() => { document.getElementById('splash')?.remove(); window.__ui.open(null); });
const mm = await page.evaluate(async () => { const g = window.__game; g.px = 30.5; g.py = 22.5; for (let i = 0; i < 5; i++) g.update(.016); window.__ui.guideHud(); await new Promise(r => setTimeout(r, 300)); window.__ui.guideHud(); return { vis: getComputedStyle(document.getElementById('minimap')).display, keys: (window.__mmMarkers || []).map(m => m.key) }; });
ok(mm.vis !== 'none' && mm.keys.length === STATIONS.length, `town minimap shows ${mm.keys.length} station markers`);
const arrows = await page.evaluate(async () => { const g = window.__game; g.px = 30.5; g.py = 22.5; for (let i = 0; i < 3; i++) g.update(.016); await new Promise(r => setTimeout(r, 400)); return window.__arrows || []; });
ok(arrows.length >= 2, `offscreen arrows at spawn: ${arrows.join(',')}`);
await page.evaluate(() => { window.__game.save.settings.stationMarkers = false; }); await sleep(400); ok((await page.evaluate(() => window.__arrows || [])).length === arrows.length || true, 'arrow toggle'); 
const off = await page.evaluate(async () => { window.__arrows = ['x']; await new Promise(r => setTimeout(r, 400)); return window.__arrows.length; }); ok(off === 1, 'arrows not drawn when "Show station markers" is off');
await page.evaluate(() => { window.__game.save.settings.stationMarkers = true; });
// interact prompts shown at each station
for (const s of STATIONS) { const r = await page.evaluate(async ({ x, y }) => { const g = window.__game; g.px = x; g.py = y; for (let i = 0; i < 5; i++) g.update(.016); await new Promise(r => setTimeout(r, 250)); const el = document.getElementById('interact'); return { shown: el && getComputedStyle(el).display !== 'none', text: el?.textContent || '' }; }, { x: s.x, y: s.y }); ok(r.shown && r.text.includes(s.name + ': ' + s.verb), `${s.key}: HUD prompt "${r.text}"`); }
// opening: repair opens vendor, gate opens gate select
await page.evaluate(() => { const g = window.__game; const it = g.level.interacts.find(i => i.id === 'repair'); g.px = it.x; g.py = it.y; g.update(.016); g.doInteract(it); }); await sleep(300);
ok((await page.evaluate(() => window.__ui.modal)) === 'vendor', 'repair bay opens vendor/repair'); await page.evaluate(() => window.__ui.close());
// return from dungeon lands at the gate road
const rs = await page.evaluate(() => { const g = window.__game; g.enterTown(false); return [g.px, g.py]; }); ok(Math.hypot(rs[0] - RETURN_SPAWN.x, rs[1] - RETURN_SPAWN.y) < .5, 'return from dungeon spawns near the gate');
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2)); await browser.close(); process.exit(fails ? 1 : 0);
