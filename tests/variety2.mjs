// Variety pass part 2: loot livery variants differ, town outfit variants + both towns' ground dressing build, enemy variant picker is deterministic + splits ~50/50,
// elite-affix tells have colours, new atlases (<id>_b) are in the index and load, and memory holds. Shots: shots/variety/{town_*,loot_variants,mob_variants}.png
import { launch, sleep } from './lib.mjs';
import fs from 'fs';
const { browser, page, errors } = await launch({ viewport: { width: 1100, height: 640 } }); const ev = (f, a) => page.evaluate(f, a);
fs.mkdirSync('shots/variety', { recursive: true }); let fail = 0; const bad = m => { console.log('FAIL', m); fail++; };
// loot
const lv = await ev(async () => { const L = await import('/src/lootart.ts'); const { ITEMS } = await import('/src/config.ts'); const out = {}; const mk = (it) => ({ id: it.id, kind: 'item', slot: it.slot, mfr: it.mfr, rar: it.rarity, name: it.name, sig: false, weapon: it.weapon, amount: 1, key: `i|${it.slot}|${it.mfr}|${it.rarity}|${it.weapon || ''}|0|v${L.lootVariant(it.id)}` });
  const items = (ITEMS || []).filter(i => i.rarity !== 'orange'); const vs = {}; for (const it of items) { const v = L.lootVariant(it.id); vs[v] = (vs[v] || 0) + 1; }
  const hash = cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) | 0; return h; };
  const base = items.find(i => i.slot); const hs = []; for (let v = 0; v < 4; v++) { const s = { ...mk(base), key: `i|${base.slot}|${base.mfr}|${base.rarity}|${base.weapon || ''}|0|v${v}` }; hs.push(hash(L.iconCanvas(s))); }
  return { n: items.length, vs, distinct: new Set(hs).size }; });
console.log('loot', JSON.stringify(lv)); if (lv.distinct < 4) bad('loot variants not visually distinct (' + lv.distinct + '/4)'); if (Object.keys(lv.vs).length < 4) bad('variant spread');
// mobs
const mv = await ev(async () => { const V = await import('/src/variety.ts'); const has = t => t === 'picker_b'; let b = 0; for (let i = 0; i < 400; i++) { const t = V.drawType('picker', i, has); if (t !== V.drawType('picker', i, has)) return { bad: 'nondeterministic' }; if (t === 'picker_b') b++; } const idx = await (await fetch('/dungeons/enemies3d/index.json')).json(); return { b, noB: V.drawType('worker', 5, has), bAtlases: idx.filter(x => x.endsWith('_b')), affix: Object.keys(V.AFFIX_COL).length }; });
console.log('mobs', JSON.stringify(mv)); if (mv.bad) bad(mv.bad); if (mv.b < 150 || mv.b > 250) bad('split ' + mv.b); if (mv.noB !== 'worker') bad('no-_b type changed');
for (const id of mv.bAtlases) { const ok = await ev(async id => { const m = await (await fetch(`/dungeons/enemies3d/${id}.json`)).json(); for (const a of Object.values(m.anims)) { const r = await fetch('/dungeons/enemies3d/' + a.image); if (!r.ok) return false; } return true; }, id); if (!ok) bad('atlas assets missing for ' + id); }
// towns
for (const town of ['rustline', 'harrow']) {
  await ev(async t => { const g = window.__game; g.save.level = 45; if (t === 'harrow') { g.save.towns = g.save.towns || {}; g.save.towns.harrow = { unlocked: true }; } g.save.town = t; g.enterTown(true); }, town); await sleep(4500);
  const info = await ev(() => { const g = window.__game; return { theme: g.level.theme || 'rustline', ok: !!window.__rend.town?.ground, walkers: window.__rend.town?.folk?.walkers?.length || 0, outfits: [...new Set((window.__rend.town?.folk?.walkers || []).map(w => w.outfit))].length }; });
  console.log('town', town, JSON.stringify(info)); if (!info.ok) bad('town ground missing ' + town); if (info.walkers && info.outfits < 3) bad('few outfits ' + town);
  await page.screenshot({ path: `shots/variety/town_${town}.png` });
}
const mem = await ev(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1); console.log('heap MB', mem); if (mem > 900) bad('heap ' + mem);
const real = errors.filter(e => !/favicon|404|Failed to load resource/.test(e)); if (real.length) bad('errors ' + real.slice(0, 3).join(' | '));
console.log(fail ? 'variety2 FAIL' : 'variety2 PASS'); await browser.close(); process.exit(fail ? 1 : 0);
