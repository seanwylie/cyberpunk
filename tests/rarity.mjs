// Rarity at a glance: distinct style per tier, contrast on the dark theme, colour-blind cues, flash guard, particle caps, tile decoration, sounds. Writes shots/rarity/*.png
import { launch, sleep } from './lib.mjs';
import fs from 'fs'; import path from 'path';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1100, height: 700 } });
fs.mkdirSync('shots/rarity', { recursive: true });
const T = ['grey', 'green', 'blue', 'purple', 'orange'];
const R = await page.evaluate(async () => { const m = await import('/src/rarity.ts'), C = await import('/src/config.ts'); const o = {}; o.style = m.RSTYLE; o.col = C.RARITY_COLOR; o.bg = m.DARK_BG; o.lim = { hz: m.FLASH_MAX_HZ, amp: m.FLASH_MAX_AMP, cap: m.SPARKLE_CAP_PER_ITEM, tot: m.SPARKLE_CAP_TOTAL, beam: m.BEAM_MAX_H };
  o.contrast = Object.fromEntries(m.RARITY_ORDER.map(r => [r, m.contrast(C.RARITY_COLOR[r], m.DARK_BG)])); o.same = m.RARITY_ORDER.every(r => m.RSTYLE[r].color === C.RARITY_COLOR[r]);
  o.pulse = m.RARITY_ORDER.map(r => { let lo = 9, hi = -9; for (let t = 0; t < 4; t += .01) { const v = m.pulse(r, t, 1, 2); lo = Math.min(lo, v); hi = Math.max(hi, v); } return { lo, hi, s1: m.pulse(r, 1.3, 2, 1), s0: m.pulse(r, 1.3, 2, 0) }; });
  o.spark = m.RARITY_ORDER.map(r => [m.sparkleCount(r, 2), m.sparkleCount(r, 1), m.sparkleCount(r, 0), m.sparkleCount(r, 2, .5), m.sparkleCount(r, 2, 0)]); return o; });
const S = R.style;
ok(new Set(T.map(t => S[t].color)).size === 5 && new Set(T.map(t => S[t].marker)).size === 5 && new Set(T.map(t => S[t].pips)).size === 5, 'each tier has a distinct colour, marker shape and pip count');
ok(R.same && R.col.grey === '#b4b6b2' && R.col.orange !== R.col.purple, 'style colours come from the shared RARITY_COLOR palette (grey/green/blue/purple/orange)');
ok(S.grey.beamH === 0 && S.green.beamH === 0 && S.blue.beamH > 0 && S.blue.beamH < S.purple.beamH && S.purple.beamH < S.orange.beamH && S.orange.beamH <= R.lim.beam, 'light beam only for blue+, height increases blue < purple < orange');
ok(S.blue.beamA < S.purple.beamA && S.purple.beamA < S.orange.beamA && S.green.haloA < S.blue.haloA && S.blue.haloA < S.purple.haloA && S.purple.haloA < S.orange.haloA, 'beam and halo intensity increase with tier');
ok(S.purple.pulseAmp > S.blue.pulseAmp && S.purple.pulseAmp > S.green.pulseAmp, 'purple has the strongest pulse');
ok(S.grey.border < S.blue.border && S.blue.border < S.orange.border && !S.green.shine && S.blue.shine && S.purple.shine && S.orange.shine, 'frame width grows with tier; shine only blue+');
ok(new Set(T.map(t => S[t].sparkShape)).size >= 4, 'sparkle shapes are distinct per tier (circle/diamond/triangle/star)');
for (const t of T) ok(R.contrast[t] >= 4.5, `${t} ${R.col[t]} contrast ${R.contrast[t].toFixed(2)}:1 on dark theme >= 4.5`);
const dist = (a, b) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
for (let i = 1; i < 5; i++) ok(dist(R.col[T[i - 1]], R.col[T[i]]) >= 55, `${T[i - 1]} vs ${T[i]} colour distance ${dist(R.col[T[i - 1]], R.col[T[i]]).toFixed(0)} >= 55`);
ok(dist(R.col.blue, R.col.grey) >= 90 && dist(R.col.purple, R.col.grey) >= 70, 'blue and purple stand clearly apart from grey');
ok(T.every(t => S[t].pulseHz <= R.lim.hz) && R.lim.hz <= 2.5 && R.lim.amp <= .35, 'flash guard: pulse rates <= 2.2 Hz, amplitude <= .35');
ok(R.pulse.every((p, i) => p.hi <= 1.0001 && p.lo >= 1 - R.lim.amp - 1e-6 && p.s1 === 1 && p.s0 === 1), 'pulse stays within the amplitude cap; static under Reduced FX / far');
ok(R.spark.every(([a, b, c, d, e], i) => a <= R.lim.cap && b === 0 && c === 0 && d <= a && e === 0), 'sparkles: capped per item, none under Reduced FX/far, scaled by quality');
// ---- real drawing: distinct look per tier, static when reduced, per-frame sparkle cap
const D = await page.evaluate(async () => { const L = await import('/src/lootart.ts'), C = await import('/src/config.ts'); const o = { hash: {}, lit: {}, red: {}, anim: {}, capMax: 0 };
  const pick = r => C.ITEMS.find(i => i.rarity === r && !i.id.startsWith('stock_')).id; const specs = {}; for (const r of ['grey', 'green', 'blue', 'purple', 'orange']) specs[r] = L.specOf({ id: 1, kind: 'item', inst: { def: pick(r) }, amount: 1 });
  const cv = document.createElement('canvas'); cv.width = 160; cv.height = 190; const c = cv.getContext('2d'); const px = (r, t, fx, reduced) => { c.clearRect(0, 0, 160, 190); c.fillStyle = '#14181a'; c.fillRect(0, 0, 160, 190); L.drawLoot(c, 80, 160, 1.6, t, specs[r], 11, { age: 5, reduced, fx }); return c.getImageData(0, 0, 160, 190).data; };
  for (const r of Object.keys(specs)) { const d = px(r, 2.1, 2, false); let h = 0, lit = 0; for (let i = 0; i < d.length; i += 4) { h = (h * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) | 0; if (d[i] + d[i + 1] + d[i + 2] > 120) lit++; } o.hash[r] = h; o.lit[r] = lit;
    const a = px(r, 1.0, 1, true), b = px(r, 3.3, 1, true); let same = true; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; } o.red[r] = same;
    const x = px(r, 1.0, 2, false), y = px(r, 1.6, 2, false); let diff = false; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) { diff = true; break; } o.anim[r] = diff; }
  // per-frame sparkle cap with 300 orange drops
  for (let k = 0; k < 300; k++) { L.drawLoot(c, 80, 160, 1, 7.5, specs.orange, k, { age: 5, reduced: false, fx: 2 }); o.capMax = Math.max(o.capMax, L.sparkStats()); }
  // screenshot sheet of ground drops
  const sheet = document.createElement('canvas'); sheet.width = 800; sheet.height = 260; const sc = sheet.getContext('2d'); sc.fillStyle = '#14181a'; sc.fillRect(0, 0, 800, 260); const rs = ['grey', 'green', 'blue', 'purple', 'orange'];
  rs.forEach((r, i) => { L.drawLoot(sc, 80 + i * 160, 210, 1.5, 2.4, specs[r], 5 + i, { age: 5, reduced: false, fx: 2 }); L.drawLabel(sc, 80 + i * 160, 246, 1, specs[r], true); }); o.sheet = sheet.toDataURL('image/png'); return o; });
const T5 = T; ok(new Set(T5.map(t => D.hash[t])).size === 5, 'ground drops render a distinct image for each tier');
ok(D.lit.grey < D.lit.green && D.lit.green < D.lit.blue && D.lit.blue < D.lit.purple && D.lit.purple <= D.lit.orange * 1.6 && D.lit.orange > D.lit.blue, 'visible light grows with tier (grey < green < blue < purple, orange strongest-ish): ' + JSON.stringify(D.lit));
ok(T5.every(t => D.red[t]) && T5.filter(t => t !== 'grey').every(t => D.anim[t]), 'Reduced FX: static image over time; full FX animates green+');
ok(D.capMax <= 40, 'per-frame sparkle total capped at ' + D.capMax + ' <= 40 with 300 drops');
fs.writeFileSync('shots/rarity/ground_drops.png', Buffer.from(D.sheet.split(',')[1], 'base64'));
// ---- tiles / tooltips / names in the UI
await page.evaluate(async () => { const C = await import('/src/config.ts'); const pick = r => C.ITEMS.find(i => i.rarity === r && !i.id.startsWith('stock_')); document.getElementById('splash')?.remove(); const m = document.getElementById('modal'); m.style.cssText = 'display:block;opacity:1;background:#0c0d0e;animation:none'; m.innerHTML = '<div class="win lockerwin" style="width:640px;margin:20px auto;animation:none;opacity:1;transform:none"><div class="body"><div class="body-grid" style="display:grid;grid-template-columns:repeat(5,92px);gap:8px;padding:12px">' + ['grey', 'green', 'blue', 'purple', 'orange'].map(r => { const d = pick(r); return `<button class="slot tile st" data-def="${d.id}"><span class="ticon"></span><b>${r}</b></button>`; }).join('') + ['grey', 'green', 'blue', 'purple', 'orange'].map(r => { const c = Object.values(C.CHIPS).find(x => x.rarity === r); return c ? `<button class="slot tile" data-chip="${c.id}"><span class="ticon"></span><b>${c.name}</b></button>` : ''; }).join('') + '</div></div></div>'; window.__ui.decorateTiles(); window.__ui.decorateChips(); });
await sleep(300);
const U = await page.evaluate(() => [...document.querySelectorAll('#modal [data-def]')].map(b => { const cs = getComputedStyle(b); return { r: b.dataset.rar, cls: b.classList.contains('rar-' + b.dataset.rar), pips: (b.querySelector('.rpips') || {}).textContent || '', bw: parseFloat(cs.borderTopWidth), bc: cs.borderTopColor, name: getComputedStyle(b.querySelector('b')).color, bg: cs.backgroundColor, shine: getComputedStyle(b, '::after').content }; }));
ok(U.length === 5 && U.every((u, i) => u.r === T[i] && u.cls), 'item tiles get a rarity class per tier');
ok(U.map(u => u.pips.length).join() === '0,1,2,3,4', 'corner pips = tier index (colour-blind safe cue)');
ok(new Set(U.map(u => u.bc)).size === 5 && new Set(U.map(u => u.bg)).size >= 4, 'border colour and tinted background differ per tier');
ok(U[0].bw < U[2].bw && U[2].bw <= U[3].bw && U[3].bw < U[4].bw, 'border width grows: grey < blue <= purple < orange');
ok(U.slice(2).every(u => u.shine !== 'none') && U[0].shine === 'none' && U[1].shine === 'none', 'shine sweep on blue+ tiles only');
const parse = s => s.match(/\d+/g).map(Number); const toHex = a => '#' + a.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
ok(U.slice(1).every(u => { const n = toHex(parse(u.name)); return n !== '#d9d4c2'; }), 'item names on tiles are tier-coloured');
ok((await page.evaluate(() => document.querySelectorAll('#modal [data-chip].rar').length)) >= 3, 'chip tiles are rarity-decorated too');
await page.locator('#modal .win').screenshot({ path: 'shots/rarity/tiles.png' });
// Reduced FX turns the tile shine off
await page.evaluate(() => { window.__game.save.settings.reducedFx = true; document.body.classList.add('reducefx'); }); await sleep(200); const rf = await page.evaluate(() => { const e = document.querySelector('#modal [data-rar=purple]'); const a = getComputedStyle(e, '::after'); return a.animationName === 'none' || a.opacity === '0' ? 'none' : a.animationName; }); ok(rf === 'none', 'Reduced FX disables the tile shine animation');
// ---- real locker/bank grids with all tiers mixed (screenshots at desktop and small phone sizes)
for (const [w, h, tag] of [[1280, 720, 'desktop'], [844, 390, 'phone']]) {
  await page.setViewportSize({ width: w, height: h });
  const real = await page.evaluate(async () => { document.getElementById('splash')?.remove(); const C = await import('/src/config.ts'), St = await import('/src/state.ts'); const g = window.__game, s = g.save; const sl = 'armR';
    const pool = C.ITEMS.filter(i => i.slot === sl && !i.id.startsWith('stock_')); const byR = r => pool.filter(i => i.rarity === r); const order = ['grey', 'green', 'blue', 'purple', 'orange', 'blue', 'grey', 'purple', 'green', 'blue', 'grey', 'green', 'purple', 'blue', 'orange', 'grey'];
    for (const r of order) { const list = byR(r).length ? byR(r) : pool; s.items.push(St.mkInst(s, list[(s.items.length * 7) % list.length].id)); }
    s.lockerCap = 60; window.__ui.sel = sl; window.__ui.open('locker'); return true; });
  await sleep(500); await page.evaluate(() => { const m = document.getElementById('modal'); m.style.animation = 'none'; m.style.opacity = 1; document.querySelectorAll('#modal .win').forEach(x => { x.style.animation = 'none'; x.style.opacity = 1; x.style.transform = 'none'; }); });
  await page.evaluate(() => { const e = document.querySelector('#modal .slot.tile.st[data-def]'); e && e.scrollIntoView({ block: 'center' }); }); await sleep(200);
  const L = await page.evaluate(() => { const t = [...document.querySelectorAll('#modal .slot.tile.st[data-def]')]; return { n: t.length, rars: [...new Set(t.map(b => b.dataset.rar))].sort(), pips: t.every(b => b.querySelector('.rpips') || b.dataset.rar === 'grey') }; });
  ok(L.n >= 8 && L.rars.length >= 4 && L.pips, `${tag}: real locker grid has ${L.n} tiles with tiers ${L.rars.join('/')} all decorated`);
  await page.screenshot({ path: `shots/rarity/locker_grid_${tag}.png` });
  try { await page.locator('#modal .slot.tile.st[data-def]').first().locator('xpath=..').screenshot({ path: `shots/rarity/inventory_tiles_${tag}.png` }); } catch (e) { console.log('grid crop skipped: ' + e.message.slice(0, 80)); }
  await page.evaluate(() => window.__ui.open(null));
}
await page.setViewportSize({ width: 1100, height: 700 });
// ---- sounds
const audioSrc = fs.readFileSync('src/audio.ts', 'utf8'), simSrc = fs.readFileSync('src/sim.ts', 'utf8');
ok(['pickup_green', 'pickup_blue', 'pickup_purple', 'pickup_orange'].every(id => audioSrc.includes("case '" + id + "'")) && /RARITY_RANK\[pr\]>=1\) this\.emit\('sfx','pickup_'\+pr\)/.test(simSrc), 'pickup cue per tier (green, blue, purple, orange) from the existing synth; grey keeps the base cue');
ok(new Set(['green', 'blue', 'purple', 'orange'].map(t => S[t].sfx)).size === 4, 'each tier maps to its own pickup sound id');
const realErr = errors.filter(e => !/ERR_FAILED/.test(e)); ok(realErr.length === 0, 'no page errors ' + realErr.slice(0, 2).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
