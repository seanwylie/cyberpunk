// Town 2 (Harrow Reach): unlock flow, travel, stations reachable / spaced / distinct, gating of Tier III-IV, vendor + guild + bank branch, music theme, persistence, relative perf.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 }, query: '?splash=hold' });
const ev = (fn, arg) => page.evaluate(fn, arg);
await ev(async () => { document.getElementById('splash')?.remove(); window.__T = await import('/src/towns.ts'); window.__SM = await import('/src/stations.ts'); window.__D = await import('/src/content/dungeons.ts'); window.__C = await import('/src/config.ts'); window.__S = await import('/src/state.ts'); window.__BK = await import('/src/bank.ts'); window.__TU = await import('/src/townui.ts'); });
// ---- unlock flow ----
let r = await ev(() => { const g = window.__game, s = g.save, T = window.__T; g.enterTown(); s.town = undefined; s.towns = undefined; s.world = undefined; s.cleared = {}; s.level = 12; const a = T.isUnlocked(s, 'harrow'); const tc = T.travelCheck(s, 'harrow'); const n0 = g.checkTownUnlocks().length; return { a, tc, n0 }; });
ok(!r.a && !r.tc.ok && /Locked/.test(r.tc.why) && r.n0 === 0, 'Harrow starts locked at level 12 with no Tier II clear: ' + JSON.stringify(r.tc));
r = await ev(() => { const g = window.__game, s = g.save, T = window.__T; const t1 = Object.values(window.__D.DUNGEONS).find(d => d.tier === 1).id; s.cleared = { [t1]: 1 }; const n1 = g.checkTownUnlocks().filter(x => x === 'harrow').length; return { n1, t1 }; });
ok(r.n1 === 0, 'clearing only a Tier I dungeon does not unlock it');
r = await ev(() => { const g = window.__game, s = g.save, T = window.__T; const t2 = Object.values(window.__D.DUNGEONS).find(d => d.tier === 2).id; s.cleared = { [t2]: 1 }; window.__toasts = []; const o = g.toast.bind(g); g.toast = m => { window.__toasts.push(m); o(m); }; const n = g.checkTownUnlocks(); const again = g.checkTownUnlocks(); return { n, again: again.length, un: T.isUnlocked(s, 'harrow'), toast: window.__toasts.join('|'), persisted: JSON.parse(localStorage.getItem('arpg-proto-save-v1')).towns?.harrow?.unlocked }; });
ok(r.n.includes('harrow') && r.again === 0 && r.un && /Harrow Reach/.test(r.toast) && r.persisted, 'clearing a Tier II dungeon unlocks Harrow once, toasts and persists ' + JSON.stringify(r));
r = await ev(() => { const g = window.__game, s = g.save, T = window.__T; s.cleared = {}; s.towns = undefined; s.world = undefined; s.level = 20; const n = g.checkTownUnlocks(); return { n, un: T.isUnlocked(s, 'harrow') }; });
ok(r.un && r.n.includes('harrow'), 'reaching level 20 also unlocks it (and old saves backfill)');
// ---- Travel UI at the Rustline transit station ----
r = await ev(async () => { const g = window.__game; g.enterTown(); const it = g.level.interacts.find(i => i.id === 'transit'); g.px = it.x; g.py = it.y; g.update(.05); const p = g.prompt?.label; g.interact(); document.querySelector('#modal [data-act="tv-sel"][data-id="harrow"]')?.click(); const modal = window.__ui.modal; const txt = document.getElementById('modal').innerText; const btn = document.querySelector('#modal [data-act="tv-go"][data-id="harrow"]'); return { p, modal, hasBtn: !!btn && !btn.disabled, txt: /Harrow Reach/.test(txt) }; });
ok(/^Reach Line:/.test(r.p) && r.modal === 'travel' && r.hasBtn && r.txt, 'transit station prompt opens the travel screen with an enabled Harrow button: ' + r.p);
await page.click('#modal [data-act="tv-go"][data-id="harrow"]'); await sleep(150);
ok(await ev(() => !!document.getElementById('tramload') && window.__game.townId !== 'harrow'), 'travel shows the Reach Line screen first (art preloads while it is up)');
await page.waitForFunction(() => window.__game.townId === 'harrow' && !document.getElementById('tramload') || false, null, { timeout: 15000 }).catch(() => {}); await sleep(100);
ok(await ev(() => { const t = window.__rend.town2; return !!(t && t.ready && t.ground); }), 'Harrow art and baked ground are ready on arrival (no pop-in)');
r = await ev(() => { const g = window.__game, SM = window.__SM; return { id: g.townId, theme: g.level.theme, w: g.level.w, st: g.level.interacts.map(i => i.station), saved: g.save.town, modal: window.__ui.modal }; });
console.log(JSON.stringify(r));
ok(r.id === 'harrow' && r.theme === 'harrow' && r.saved === 'harrow' && r.st.includes('h_gate') && !r.st.includes('transit') && r.modal === null, 'travel loads Harrow Reach: ' + r.w + ' wide, ' + r.st.length + ' stations, registry switched');
// ---- layout: reachable, spaced, distinct, expected modals ----
r = await ev(() => { const g = window.__game, L = g.level, SM = window.__SM; const w = L.w, h = L.h, seen = new Uint8Array(w * h), q = [[Math.floor(L.spawn.x), Math.floor(L.spawn.y)]]; seen[q[0][1] * w + q[0][0]] = 1; let n = 0;
  while (q.length) { const [x, y] = q.pop(); n++; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || L.solid[ny * w + nx]) continue; seen[ny * w + nx] = 1; q.push([nx, ny]); } }
  const I = L.interacts; let minD = 99; for (let i = 0; i < I.length; i++) for (let j = i + 1; j < I.length; j++) minD = Math.min(minD, Math.hypot(I[i].x - I[j].x, I[i].y - I[j].y));
  const unreach = I.filter(i => !seen[Math.floor(i.y) * w + Math.floor(i.x)]).map(i => i.id); const cols = SM.HARROW_STATIONS.map(s => s.color); const dupCols = cols.length - new Set(cols).size; 
  const retOK = !L.solid[Math.floor(L.returnSpawn.y) * w + Math.floor(L.returnSpawn.x)] && !!seen[Math.floor(L.returnSpawn.y) * w + Math.floor(L.returnSpawn.x)];
  const opens = {}; for (const i of I) { g.px = i.x; g.py = i.y; g.update(.05); g.interact(); opens[i.station] = window.__ui.modal; window.__ui.close(); }
  return { n: I.length, minD, min: SM.MIN_STATION_DIST, unreach, dupCols, retOK, opens, walk: n, decor: L.decor.length, npcs: L.npcs.length }; });
ok(r.unreach.length === 0 && r.retOK, 'every Harrow station and the gate-return spawn are reachable from spawn (' + r.walk + ' walkable tiles)');
ok(r.minD >= r.min && r.n === 8, 'Harrow stations are at least ' + r.min + ' tiles apart (closest ' + r.minD.toFixed(1) + ')');
ok(r.dupCols === 0, 'Harrow station colours are unique');
const want = { h_transit: 'travel', h_jobs: 'fixer', h_bank: 'bank', h_parts: 'vendor', h_gate: 'gate', h_repair: 'vendor', h_locker: 'locker', h_guild: 'guild' };
ok(Object.entries(want).every(([k, m]) => r.opens[k] === m), 'each Harrow station opens its screen: ' + JSON.stringify(r.opens));
// ---- Rustline layout with the new bank + transit stations ----
const rl = await ev(() => { const g = window.__game; g.travel('rustline'); const L = g.level, SM = window.__SM; const I = L.interacts; let minD = 99; for (let i = 0; i < I.length; i++) for (let j = i + 1; j < I.length; j++) minD = Math.min(minD, Math.hypot(I[i].x - I[j].x, I[i].y - I[j].y)); return { id: g.townId, n: I.length, minD, theme: L.theme, keys: L.interacts.map(i => i.station) }; });
ok(rl.id === 'rustline' && rl.keys.includes('bank') && rl.keys.includes('transit') && rl.minD >= 11, 'Rustline keeps 8 stations 11+ tiles apart after bank + transit were added (' + rl.minD.toFixed(1) + ')');
// ---- gating of Tier III/IV ----
r = await ev(() => { const g = window.__game, s = g.save, T = window.__T, D = window.__D; const t3 = Object.values(D.DUNGEONS).find(d => d.tier === 3).id, t4 = Object.values(D.DUNGEONS).find(d => d.tier === 4)?.id, t1 = Object.values(D.DUNGEONS).find(d => d.tier === 1).id;
  g.enterTown(); const rust = { t3: T.dungeonAccess(t3, 'rustline').ok, t4: t4 ? T.dungeonAccess(t4, 'rustline').ok : false, t1: T.dungeonAccess(t1, 'rustline').ok, annex: T.dungeonAccess('annex', 'rustline').ok };
  const har = { t3: T.dungeonAccess(t3, 'harrow').ok, t4: t4 ? T.dungeonAccess(t4, 'harrow').ok : true };
  s.level = 40; window.__ui.open('gate'); window.__ui.showAll = true; window.__ui.render(); const rustBtns = [...document.querySelectorAll('#modal .draftbar b')].map(b => b.textContent); window.__ui.close();
  g.travel('harrow'); window.__ui.open('gate'); window.__ui.showAll = true; window.__ui.render(); const harBtns = [...document.querySelectorAll('#modal .draftbar b')].map(b => b.textContent); window.__ui.close();
  return { rust, har, t3, t4, rustHas3: rustBtns.includes(D.DUNGEONS[t3].name), harHas3: harBtns.includes(D.DUNGEONS[t3].name), harHas4: t4 ? harBtns.includes(D.DUNGEONS[t4].name) : true, nR: rustBtns.length, nH: harBtns.length }; });
ok(r.rust.t1 && r.rust.annex && !r.rust.t3 && !r.rust.t4 && r.har.t3 && r.har.t4, 'Tier III-IV are blocked at the Rustline gate and allowed at Harrow');
ok(!r.rustHas3 && r.harHas3 && r.harHas4 && r.nH > r.nR, 'dungeon select lists Tier III-IV only at Harrow (' + r.nR + ' vs ' + r.nH + ' dungeons)');
r = await ev(() => { const g = window.__game; g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.level = 40; g.save.settings.devFreeReset = true; const ok = g.startRun(window.__D.DUNGEON_LIST.find(d => d.tier === 3).id); const mode = g.mode; g.enterTown(); return { ok, mode, back: g.townId }; });
ok(r.ok && r.mode === 'run' && r.back === 'harrow', 'a Tier III run starts from Harrow and returning from a run lands back in Harrow');
// ---- Heavy Works Parts (purple stock), Guild, Bank branch ----
r = await ev(() => { const g = window.__game, s = g.save, ui = window.__ui; g.save.instance = null; g.inst = null; g.enterTown(); const purp = () => { ui.open('vendor'); const n = window.__C.ITEMS.filter(d => d.rarity === 'purple' && ui.shopList(d.slot).includes(d) && ui.buyPrice(d) > 0).length; ui.close(); return n; };
  const buyH = ui.buyPrice(window.__C.ITEMS.find(d => d.rarity === 'purple')); const har = purp(); g.travel('rustline'); const buyR = ui.buyPrice(window.__C.ITEMS.find(d => d.rarity === 'purple')); g.travel('harrow'); return { buyH, buyR, har }; });
ok(r.buyH > 0 && r.buyR === 0, 'Heavy Works Parts sells purple hardware (' + r.buyH + 'c); Rustline vendor does not');
r = await ev(() => { const g = window.__game, s = g.save, TU = window.__TU; g.enterTown(); const chips = TU.guildStock(); const c = chips.find(c => window.__C.CHIPS[c].rarity === 'blue'); s.credits = 1000; s.lockerChips = {}; window.__ui.open('guild'); const tiles = document.querySelectorAll('#modal [data-act="gd-buy"]').length; document.querySelector(`#modal [data-act="gd-buy"][data-chip="${c}"]`).click(); return { tiles, n: s.lockerChips[c], cr: s.credits, price: TU.GUILD_PRICE.blue }; });
ok(r.tiles >= 4 && r.n === 1 && r.cr === 1000 - r.price, 'Guild Counter sells reclaimed chips (' + r.tiles + ' offers), debits credits, adds to the locker');
r = await ev(() => { const g = window.__game, s = g.save, B = window.__BK; window.__ui.close(); const it = g.level.interacts.find(i => i.station === 'h_bank'); g.px = it.x; g.py = it.y; g.update(.05); g.interact(); const before = B.bankOf(s).credits; s.credits = 500; document.querySelector('#modal [data-act="bk-cdep"][data-n="all"]').click(); return { modal: window.__ui.modal, vault: B.bankOf(s).credits - before }; });
ok(r.modal === 'bank' && r.vault === 500, 'Harrow bank branch is the same shared bank (vault +500)');
await ev(() => window.__ui.close());
// ---- music theme + persistence + art ----
r = await ev(() => { const g = window.__game; const ev = []; const o = g.emit; g.emit = (t, p) => { ev.push(t + ':' + p); return o.call(g, t, p); }; g.travel('rustline'); g.travel('harrow'); g.emit = o; return ev.filter(e => e.startsWith('towntheme')); });
ok(r.join() === 'towntheme:rustline,towntheme:harrow', 'travel emits the town music theme: ' + r.join());
const files = await ev(async () => { const out = {}; for (const n of ['harrow_forge', 'harrow_ember', 'harrow_steam']) { const rs = await fetch('/audio/music/' + n + '.mp3'); out[n] = rs.ok ? (await rs.arrayBuffer()).byteLength : 0; } const M = await import('/src/music.ts'); out.pool = M.TOWN_POOLS.harrow.length; return out; });
ok(files.harrow_forge > 5e5 && files.harrow_ember > 5e5 && files.harrow_steam > 5e5 && files.pool >= 12, 'the calm Harrow tracks exist and are mapped to the Harrow pool (12 incl. dawn, cinder, smelter ...)');
await ev(() => window.__S.persist(window.__game.save)); await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__game); await ev(() => document.getElementById('splash')?.remove()); await sleep(1500);
r = await ev(() => ({ id: window.__game.townId, theme: window.__game.level.theme, ready: window.__rend.town?.ready, un: window.__game.save.towns?.harrow?.unlocked }));
ok(r.id === 'harrow' && r.theme === 'harrow' && r.un, 'current town and unlock persist across reload (loads straight into Harrow)');
await sleep(2500); r = await ev(() => ({ ready: window.__rend.town?.ready, n: Object.keys(window.__rend.town?.img || {}).length, ground: !!window.__rend.town?.gimg?.slag }));
ok(r.ready && r.ground && r.n > 40, 'Harrow art set loaded (slag ground + ' + r.n + ' sprites)');
// ---- relative perf: Harrow vs Rustline draw cost ----
const perf = await ev(async () => { const g = window.__game, R = window.__rend; const run = (town, path) => { g.save.town = town; g.enterTown(true); const T = []; let pi = 0; g.px = path[0][0]; g.py = path[0][1]; for (let i = 0; i < 30; i++) { g.update(.016); R.draw(.016); }
    for (let f = 0; f < 120; f++) { const tg = path[pi]; const dx = tg[0] - g.px, dy = tg[1] - g.py, d = Math.hypot(dx, dy); if (d < .3) pi = (pi + 1) % path.length; else { g.px += dx / d * .12; g.py += dy / d * .12; } g.update(.016); const a = performance.now(); R.draw(.016); R.ctx.getImageData(0, 0, 1, 1); T.push(performance.now() - a); } T.sort((a, b) => a - b); return { med: T[60], p95: T[114] }; };
  await new Promise(r => setTimeout(r, 1500)); const rust = run('rustline', [[30.5, 22.5], [15, 13], [41.5, 12], [52, 22.5], [30, 35]]); await new Promise(r => setTimeout(r, 1500)); const har = run('harrow', [[38, 27], [22, 12], [54, 12], [64, 27], [38, 46]]); return { rust, har }; });
ok(perf.har.med <= perf.rust.med * 1.6 + 6 && perf.har.p95 <= perf.rust.p95 * 1.8 + 15, `Harrow draw cost vs Rustline: median ${perf.har.med.toFixed(1)} vs ${perf.rust.med.toFixed(1)} ms, p95 ${perf.har.p95.toFixed(1)} vs ${perf.rust.p95.toFixed(1)} ms`);
ok(errors.length === 0, 'no console errors ' + errors.slice(0, 3).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
