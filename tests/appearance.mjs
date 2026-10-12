// Wardrobe / appearance cosmetics: data integrity, rarity policy, stat neutrality, equip + body-variant art, UI, preview, persistence.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const clk = s => page.evaluate(q => document.querySelector(q)?.click(), s);
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const R = await page.evaluate(async () => {
  const A = await import('/src/content/appearance.ts'), Cfg = await import('/src/config.ts'), BV = await import('/src/bodyvariants.ts'), B = await import('/src/build.ts');
  const g = window.__game, out = {}; const L = A.COSMETICS;
  out.n = L.length; out.per = {}; for (const d of L) out.per[d.rarity] = (out.per[d.rarity] || 0) + 1;
  out.uniq = new Set(L.map(d => d.id)).size === L.length; out.noStats = L.every(d => !('stats' in d) && !('dmg' in d));
  out.slots = [...new Set(L.map(d => d.slot))].length; out.rar = L.every(d => Cfg.RARITIES.includes(d.rarity));
  const bosses = Object.keys(Cfg.ENEMIES).filter(k => Cfg.ENEMIES[k].boss); out.badBoss = L.filter(d => d.src.k === 'bossId' && !bosses.includes(d.src.boss)).map(d => d.id);
  out.orangeSrc = L.filter(d => d.rarity === 'orange').map(d => d.src.k); out.purpleSrc = [...new Set(L.filter(d => d.rarity === 'purple').map(d => d.src.k))];
  out.vendorPurple = L.filter(d => d.src.k === 'vendor' && Cfg.RARITY_RANK[d.rarity] >= 3).length;
  out.w = ['ordinary', 'elite', 'boss'].every(t => { const w = A.COS_RARITY_W[t]; return w.orange < w.purple && w.purple < w.green && w.orange * 10 <= w.purple; });
  out.fields = L.every(d => d.name && d.desc && d.lore && d.style && d.c && d.slot && d.src);
  // roll distribution: 40k boss kills on a fresh save each (no dupes), count rarity of first grant
  let rs = 12345; const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
  const cnt = { grey: 0, green: 0, blue: 0, purple: 0, orange: 0 }; let tot = 0; for (let i = 0; i < 40000; i++) { const s = {}; const r = A.rollCosmetic(s, 'boss', 'auditor', 3, rnd); if (r?.def) { cnt[r.def.rarity]++; tot++; } }
  out.cnt = cnt; out.tot = tot; const e = { grey: 0, green: 0, blue: 0, purple: 0, orange: 0 }; for (let i = 0; i < 40000; i++) { const r = A.rollCosmetic({}, 'ordinary', null, 0, rnd); if (r?.def) e[r.def.rarity]++; } out.ord = e;
  // stat neutrality + equip + body variant
  g.enterTown(); const s = g.save; const before = JSON.stringify(B.computeBuild(Object.fromEntries(Object.entries(s.installed).map(([k, u]) => [k, s.items.find(i => i.uid === u)])), s.level, s.rep).stats);
  const b0 = JSON.stringify(BV.bodyOf(s, null)); for (const id of ['torso_hi', 'hair_flame', 'skin_chrome', 'aura_nova', 'trail_ember', 'eyes_red']) A.grantCos(s, id); out.eqBad = A.equipCos(s, 'nope');
  for (const id of ['torso_hi', 'hair_flame', 'skin_chrome', 'aura_nova', 'trail_ember', 'eyes_red']) A.equipCos(s, id);
  const after = JSON.stringify(B.computeBuild(Object.fromEntries(Object.entries(s.installed).map(([k, u]) => [k, s.items.find(i => i.uid === u)])), s.level, s.rep).stats);
  out.statSame = before === after; out.bodyChanged = b0 !== JSON.stringify(BV.bodyOf(s, null)); out.torsoHeavy = BV.bodyOf(s, null).torso === 'heavy'; out.equipped = A.equippedCos(s).length;
  const u = A.equipCos(s, 'skin_chrome'); out.unowned = A.equipCos(s, 'skin_holo'); out.stillEq = A.equippedCos(s).length;
  // vendor
  s.credits = 100; out.buyPoor = A.buyCos(s, 'hair_mohawk').ok; s.credits = 5000; out.buy = A.buyCos(s, 'hair_mohawk').ok; out.buyTwice = A.buyCos(s, 'hair_mohawk').ok; out.buyDrop = A.buyCos(s, 'hair_frostlock').ok;
  // achievements
  s.cleared = {}; out.ach0 = A.checkAchievements(s).length; for (let i = 0; i < 24; i++) s.cleared['d' + i] = 1; out.ach = A.checkAchievements(s).map(d => d.id).sort(); out.ach2 = A.checkAchievements(s).length;
  // sim wiring: rollLoot grants cosmetics for bosses; drop volume unchanged by cosmetic path (no ground piles)
  g.save.cosmetics = A.newCos(); g.save.settings.devFreeReset = true; g.save.level = 30; g.save.lastClearDay = null; g.save.lockouts = {}; g.startRun('annex'); const ids = Object.keys(Cfg.ENEMIES); const bossId = ids.find(i => Cfg.ENEMIES[i].boss);
  const real = Math.random; Math.random = () => 0.0001; const n0 = g.inst.drops.length; g.rollCosmeticDrop('boss', 'overseer'); Math.random = real; out.simGot = Object.keys(g.save.cosmetics.owned).length; out.noPile = g.inst.drops.length === n0;
  g.enterTown(); return out; });
console.log(JSON.stringify(R));
ok(R.n >= 80, 'at least 80 cosmetics: ' + R.n + ' ' + JSON.stringify(R.per));
ok(R.uniq && R.noStats && R.rar && R.fields, 'unique ids, no stat fields, known rarities, all fields filled');
ok(R.slots >= 12, 'covers 12 slots: ' + R.slots);
ok(!R.badBoss.length, 'every boss-specific source is a real boss ' + R.badBoss);
ok(R.orangeSrc.every(k => k === 'event' || k === 'ach') && R.per.orange <= 8 && R.per.orange >= 4, 'orange only from events/achievements and few: ' + R.orangeSrc);
ok(R.purpleSrc.every(k => k === 'boss' || k === 'bossId' || k === 'ach'), 'purple only from bosses/achievements: ' + R.purpleSrc);
ok(R.vendorPurple === 0, 'no purple/orange sold by the vendor');
ok(R.w, 'rarity weights: orange <= purple/10 < green in every tier');
ok(R.cnt.orange < R.cnt.purple && R.cnt.purple > 0 && R.cnt.purple > R.cnt.green * 0.1, 'boss rolls: purple common enough to be top practical tier, orange rarest ' + JSON.stringify(R.cnt));
ok(R.cnt.orange / R.tot < 0.01, 'orange share of boss cosmetic rolls < 1%: ' + (R.cnt.orange / R.tot * 100).toFixed(3) + '%');
ok(R.ord.purple + R.ord.orange <= R.ord.blue && R.ord.grey > R.ord.green, 'ordinary mobs: mostly grey/green ' + JSON.stringify(R.ord));
ok(R.statSame, 'equipping cosmetics does not change build stats');
ok(R.bodyChanged && R.torsoHeavy, 'torso cosmetic swaps the body layer to real Harrow art via bodyvariants');
ok(!R.eqBad && R.equipped === 6, 'unknown id refused; 6 equipped'); ok(!R.unowned && R.stillEq === 6, 'cannot equip unowned');
ok(!R.buyPoor && R.buy && !R.buyTwice && !R.buyDrop, 'vendor: poor refused, buy ok, no double-buy, non-vendor refused');
ok(R.ach0 === 0 && R.ach.join() === 'head_cowl,tat_stamp' && R.ach2 === 0, 'achievements grant once: ' + R.ach);
ok(R.simGot >= 1 && R.noPile, 'sim rollCosmeticDrop grants into wardrobe with no ground pile');
// UI
await page.evaluate(() => { const g = window.__game; g.enterTown(); const A = window.__A; });
await page.evaluate(async () => { const A = await import('/src/content/appearance.ts'), g = window.__game, s = g.save; s.cosmetics = A.newCos(); for (const id of ['hair_buzz', 'hair_mohawk', 'head_visor', 'back_cape', 'skin_veins', 'trail_sparks', 'aura_foundry', 'torso_ps']) A.grantCos(s, id); window.__ui.open('locker'); });
await page.evaluate(() => document.getElementById('splash')?.remove()); await sleep(300);
ok(await page.evaluate(() => !!document.querySelector('[data-act="wd-open"]')), 'locker has a Wardrobe button');
await clk('[data-act="wd-open"]'); await sleep(300);
ok(await page.evaluate(() => !!document.querySelector('#wdprev') && document.querySelectorAll('.wdgrid .tile').length > 0), 'wardrobe modal shows preview canvas + icon grid');
const ownedTiles = await page.evaluate(() => document.querySelectorAll('.wdgrid .tile:not(.off)').length); ok(ownedTiles >= 8, 'owned tiles shown: ' + ownedTiles);
ok(await page.evaluate(() => [...document.querySelectorAll('.wdgrid .tile')].every(t => t.dataset.tip)), 'every tile has hover details');
const hidden = await page.evaluate(() => document.querySelector('.wdgrid').textContent); ok(!/Heartstar|Warrantor/.test(hidden), 'undiscovered items are not spoiled');
await clk('[data-act="wd-show"][data-show="all"]'); await sleep(150);
const allN = await page.evaluate(() => document.querySelectorAll('.wdgrid .tile').length); ok(allN >= 100, 'Show all lists everything: ' + allN);
const unk = await page.evaluate(() => { const t = document.querySelector('.wdgrid .tile.off .cosw.unk'); return !!t; }); ok(unk, 'undiscovered tiles are mystery icons');
await clk('[data-act="wd-show"][data-show="owned"]'); await sleep(100);
await clk('[data-act="wd-tab"][data-tab="hair"]'); await sleep(100);
await clk('.wdgrid .tile[data-id="hair_mohawk"]'); await sleep(250);
const before = await page.evaluate(() => document.getElementById('wdprev').toDataURL().length);
await page.screenshot({ path: '/tmp/wd_preview.png' });
ok(await page.evaluate(() => window.__game.save.cosmetics.equipped.hair !== 'hair_mohawk'), 'selecting only previews (dressing room)');
await clk('[data-act="wd-apply"]'); await sleep(150); ok(await page.evaluate(() => window.__game.save.cosmetics.equipped.hair === 'hair_mohawk'), 'Apply equips');
await clk('[data-act="wd-tab"][data-tab="skin"]'); await clk('.wdgrid .tile[data-id="skin_veins"]'); await sleep(150); await clk('[data-act="wd-apply"]'); await sleep(100);
await clk('[data-act="wd-tab"][data-tab="torso"]'); await clk('.wdgrid .tile[data-id="torso_ps"]'); await sleep(150); await clk('[data-act="wd-apply"]'); await sleep(250);
await page.screenshot({ path: '/tmp/wd_equipped.png' });
const painted = await page.evaluate(() => { const c = document.getElementById('wdprev'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 120 && d[i] > d[i + 2] + 40) n++; return n; }); ok(painted > 80, 'preview draws the equipped look: ' + painted + ' warm pixels');
await clk('[data-act="wd-buy"]').catch(() => {}); 
await clk('[data-act="wd-back"]'); await sleep(200); ok(await page.evaluate(() => window.__ui.modal) === 'locker', 'back returns to the locker');
// persistence + in-world render
await page.evaluate(() => { window.__ui.close(); window.__game.saveNow?.(); });
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('arpg-proto-save-v1')).cosmetics); ok(stored && stored.equipped.hair === 'hair_mohawk' && stored.equipped.torso === 'torso_ps', 'equipped look persisted in the save');
await sleep(800); await page.screenshot({ path: '/tmp/wd_world.png' });
await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__game); await sleep(500);
ok(await page.evaluate(() => window.__game.save.cosmetics?.equipped.hair === 'hair_mohawk'), 'look survives reload');
// renders every style without throwing (all 104 equipped one slot at a time)
const bad = await page.evaluate(async () => { const A = await import('/src/content/appearance.ts'), C = await import('/src/cosmetics.ts'); const cv = document.createElement('canvas'); cv.width = 200; cv.height = 240; const c = cv.getContext('2d'); const errs = []; for (const d of A.COSMETICS) { try { const k = { c, x: 100, y: 200, u: 3.4, t: 1.3, moving: true, face: 1 }; C.drawCosmetics(k, [d], 'back'); C.drawCosmetics(k, [d], 'front'); if (d.slot === 'trail') C.drawTrail(c, [{ x: 90, y: 200, t: 1.2 }, { x: 80, y: 201, t: 1.0 }], 1.3, 3.4, d); } catch (e) { errs.push(d.id + ':' + e.message); } } const unhandled = A.COSMETICS.filter(d => d.slot !== 'trail' && !d.variant).filter(d => { const cv2 = document.createElement('canvas'); cv2.width = 200; cv2.height = 240; const c2 = cv2.getContext('2d'); C.drawCosmetics({ c: c2, x: 100, y: 200, u: 3.4, t: 1.3, moving: false, face: 0 }, [d], 'back'); C.drawCosmetics({ c: c2, x: 100, y: 200, u: 3.4, t: 1.3, moving: false, face: 0 }, [d], 'front'); const px = c2.getImageData(0, 0, 200, 240).data; for (let i = 3; i < px.length; i += 4) if (px[i]) return false; return true; }).map(d => d.id); return { errs, unhandled }; });
ok(!bad.errs.length, 'every cosmetic draws without error ' + bad.errs); ok(!bad.unhandled.length, 'every non-variant cosmetic style actually paints pixels ' + bad.unhandled);
ok(!errors.length, 'no page errors ' + errors.join('|'));
await browser.close(); process.exit(fails ? 1 : 0);
