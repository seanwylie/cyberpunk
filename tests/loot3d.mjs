// 3D loot atlas tests: manifest/size budget, coverage of every slot x mfr x rarity + sig ids, frames non-empty & animated, mirror, fallback, draw path.
import { launch } from './lib.mjs'; import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const man = JSON.parse(fs.readFileSync('public/loot/manifest.json', 'utf8'));
const bytes = fs.readdirSync('public/loot').reduce((a, f) => a + fs.statSync('public/loot/' + f).size, 0);
ok(bytes < 8e6, `public/loot total ${(bytes / 1e6).toFixed(2)} MB < 8 MB`);
const { browser, page, errors } = await launch({ viewport: { width: 900, height: 600 } });
const ev = (fn, a) => page.evaluate(fn, a);
await ev(async () => { window.__M = await import('/src/lootart.ts'); window.__C = await import('/src/config.ts'); await window.__M.ensureAtlas(); });
ok(await ev(() => window.__M.atlasStatus() === 'ready'), 'atlas lazy-loads (status ready)');
let r = await ev(() => { const M = window.__M, C = window.__C; const bad = [], miss = [];
  const px = cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n; };
  for (const slot of C.SLOTS) for (const mfr of ['HI', 'PS', 'MM']) for (const rar of C.RARITIES) { const sp = { kind: 'item', slot, mfr, rar, name: 'x', sig: false, amount: 1, key: `t|${slot}|${mfr}|${rar}` }; if (!M.isAtlas(sp)) { miss.push(slot + mfr + rar); continue; } if (px(M.iconAt(sp, 1, 3, 2)) < 900) bad.push(slot + mfr + rar); }
  for (const k of ['chip', 'stim', 'credits']) for (const rar of C.RARITIES) { const sp = { kind: k, rar, name: 'x', sig: false, amount: 2, key: `t|${k}|${rar}` }; if (!M.isAtlas(sp)) miss.push(k + rar); else if (px(M.iconAt(sp, 1, 3, 2)) < 700) bad.push(k + rar); }
  return { bad, miss }; });
ok(r.miss.length === 0, 'every slot/mfr/rarity + chip/stim/credits resolves to an atlas sprite ' + r.miss.join(','));
ok(r.bad.length === 0, 'atlas frames are non-empty ' + r.bad.join(','));
r = await ev(() => { const M = window.__M, C = window.__C; const out = []; const orange = C.ITEMS ? C.ITEMS.filter(i => i.rarity === 'orange') : []; const all = Object.values(C.ITEM_BY_ID).filter(i => i.rarity === 'orange');
  for (const it of all) { const sp = M.specOf({ id: 1, kind: 'item', inst: { def: it.id }, amount: 1 }); const sig = M.atlasRef(sp); out.push([it.id, sig && sig.name, sig && sig.orange]); } return out; });
ok(r.length >= 9 && r.every(x => x[1] && x[2]), 'every orange item (' + r.length + ') has an orange atlas model: ' + r.map(x => x[1]).join(','));
ok(r.filter(x => x[1].startsWith('sig_')).length >= 9, 'all 9 signature items map to their own sig_ model');
r = await ev(() => { const M = window.__M; const diff = (a, b) => { const x = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, y = b.getContext('2d').getImageData(0, 0, b.width, b.height).data; let n = 0; for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) > 40) n++; return n; };
  const sp = rar => ({ kind: 'item', slot: 'armR', mfr: 'HI', rar, name: 'x', sig: false, amount: 1, key: 'an|' + rar });
  const L = { kind: 'item', slot: 'armL', mfr: 'HI', rar: 'grey', name: 'x', sig: false, amount: 1, key: 'an|L' };
  return { o: diff(M.iconAt(sp('orange'), 10, 1, 2), M.iconAt(sp('orange'), 10.4, 1, 2)), p: diff(M.iconAt(sp('purple'), 10, 1, 2), M.iconAt(sp('purple'), 10.4, 1, 2)), still: diff(M.iconAt(sp('grey'), 10, 1, 2), M.iconAt(sp('grey'), 12, 1, 2)), red: diff(M.iconAt(sp('orange'), 10, 1, 1), M.iconAt(sp('orange'), 12, 1, 1)), mir: diff(M.iconAt(sp('grey'), 1, 1, 0), M.iconAt(L, 1, 1, 0)) }; });
ok(r.o > 400 && r.p > 200, 'orange/purple frames animate ' + JSON.stringify({ o: r.o, p: r.p }));
ok(r.still === 0 && r.red === 0, 'grey is static; Reduced FX (fx=1) is a still frame');
ok(r.mir > 300, 'left slots are mirrored from right-hand models (' + r.mir + ' px differ)');
// draw path + fallback
r = await ev(() => { const M = window.__M; const cnt = fx => { const c = document.createElement('canvas'); c.width = c.height = 240; const x = c.getContext('2d'); const sp = { id: 'sig_anvil_arm', kind: 'item', slot: 'armR', mfr: 'HI', rar: 'orange', name: 'x', sig: true, amount: 1, key: 'dr|' + fx }; M.drawLoot(x, 120, 190, 2, 30, sp, 5, { age: 99, reduced: false, fx }); const d = x.getImageData(0, 0, 240, 240).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; };
  const a = cnt(2); M.useAtlas(false); const sp = { kind: 'item', slot: 'torso', mfr: 'PS', rar: 'purple', name: 'x', sig: false, amount: 1, key: 'fb' }; const fb = M.isAtlas(sp); const procN = (() => { const c = M.iconCanvas(sp); return c.width; })(); M.useAtlas(true); return { a, fb, procN, back: M.isAtlas(sp) }; });
ok(r.a > 3000, 'drawLoot with atlas draws orange sig (' + r.a + ' px)');
ok(!r.fb && r.procN === 96 && r.back, 'procedural fallback works when atlas disabled and re-enables');
// perf
r = await ev(() => { const M = window.__M; const x = document.createElement('canvas').getContext('2d'); const R = ['grey', 'green', 'blue', 'purple', 'orange']; const sp = i => ({ kind: 'item', slot: 'armR', mfr: 'PS', rar: R[i % 5], name: 'x', sig: false, amount: 1, key: 'perf|' + (i % 5) }); const t0 = performance.now(); const N = 200; for (let f = 0; f < N; f++) for (let i = 0; i < 40; i++) M.drawLoot(x, 50 + i * 3, 100, 1, 10 + f / 60, sp(i), i, { age: 99, reduced: false, fx: i < 14 ? 2 : 0 }); return (performance.now() - t0) / N; });
ok(r < 10, `40 atlas drops/frame cost ${r.toFixed(2)} ms (headless software)`);
ok(errors.length === 0, 'no console errors ' + errors.slice(0, 2).join(' | '));
await browser.close(); process.exit(fails ? 1 : 0);
