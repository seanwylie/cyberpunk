// Loot-drop art tests: silhouettes per slot/rarity/mfr, toss, rarity visibility, pickup fx, Reduced FX, labels filter, perf.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1000, height: 640 } });
const ev = (fn, arg) => page.evaluate(fn, arg);
await ev(async () => { window.__M = await import('/src/lootart.ts'); window.__C = await import('/src/config.ts'); });
// 1. every slot x mfr x rarity yields a non-empty icon, and silhouettes differ per slot
let r = await ev(() => { const M = window.__M, C = window.__C; const px = cv => { const d = cv.getContext('2d').getImageData(0, 0, 96, 96).data; let n = 0, h = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) { n++; h = (h * 31 + (i >> 2)) | 0; } return { n, h }; };
  const bad = []; const sig = new Set(); for (const slot of C.SLOTS) for (const mfr of ['HI', 'PS', 'MM']) for (const rar of C.RARITIES) { const sp = { kind: 'item', slot, mfr, rar, name: 'x', sig: false, amount: 1, key: `t|${slot}|${mfr}|${rar}` }; const p = px(M.iconCanvas(sp)); if (p.n < 600) bad.push(slot + mfr + rar); if (rar === 'grey' && mfr === 'HI') sig.add(p.h); }
  for (const rar of C.RARITIES) for (const k of ['chip', 'stim', 'credits']) { const p = px(M.iconCanvas({ kind: k, rar, name: 'x', sig: false, amount: 2, key: `t|${k}|${rar}` })); if (p.n < 600) bad.push(k + rar); }
  return { bad, distinctSlotShapes: sig.size }; });
ok(r.bad.length === 0, 'all slot/mfr/rarity icons render non-empty ' + r.bad.join(','));
ok(r.distinctSlotShapes >= 9, 'slot silhouettes are distinct (' + r.distinctSlotShapes + ' distinct among 11 slots; L/R mirrors may match)');
// 2. manufacturer tint: dominant hue differs
r = await ev(() => { const M = window.__M; const avg = mfr => { const cv = M.iconCanvas({ kind: 'item', slot: 'torso', mfr, rar: 'grey', name: 'x', sig: false, amount: 1, key: 'tint|' + mfr }); const d = cv.getContext('2d').getImageData(0, 0, 96, 96).data; let R = 0, G = 0, B = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; } return [R / n, G / n, B / n]; }; return { HI: avg('HI'), PS: avg('PS'), MM: avg('MM') }; });
ok(r.HI[0] > r.HI[2] + 25 && r.PS[2] > r.PS[0] + 10 && r.MM[1] >= r.MM[2] + 15, 'icons are tinted oxide red / slate blue / olive ' + JSON.stringify(r));
// 3. toss: starts offset + airborne, settles to zero, never below ground, bounces
r = await ev(() => { const M = window.__M; let min = 1, bounce = false, prev = 0; for (let a = 0; a < 1; a += .01) { const t = M.toss(a, 77, 1); min = Math.min(min, t.z); if (a > .36 && t.z > prev + .01 && a < .6) bounce = true; prev = t.z; } const t0 = M.toss(0, 77, 1), t1 = M.toss(M.TOSS_T + .01, 77, 1); return { min, bounce, off0: Math.hypot(t0.dx, t0.dy), end: Math.hypot(t1.dx, t1.dy, t1.z), done: t1.done }; });
ok(r.min >= 0 && r.bounce && r.off0 > 10 && r.end === 0 && r.done, 'spawn toss arcs from an offset, bounces and settles exactly at the drop spot ' + JSON.stringify(r));
// 4. orange is visibly more elaborate than grey, and animates; reduced FX freezes it
r = await ev(() => { const M = window.__M; const cnv = () => { const c = document.createElement('canvas'); c.width = c.height = 200; return c; }; const snap = (rar, t, fx) => { const c = cnv(); const x = c.getContext('2d'); M.drawLoot(x, 100, 150, 2, t, { kind: 'item', slot: 'torso', mfr: 'HI', rar, name: 'x', sig: false, amount: 1, key: 'an|' + rar }, 5, { age: 99, reduced: fx === 1, fx }); return x.getImageData(0, 0, 200, 200).data; };
  const cnt = d => { let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; }; const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) > 30) n++; return n; };
  return { gOrn: cnt(snap('orange', 30, 2)), gGrey: cnt(snap('grey', 30, 2)), animO: diff(snap('orange', 30, 2), snap('orange', 31.3, 2)), animG: diff(snap('grey', 30.0, 2), snap('grey', 30.9, 2)), redO: diff(snap('orange', 30, 1), snap('orange', 31.3, 1)), animP: diff(snap('purple', 30, 2), snap('purple', 30.7, 2)) }; });
ok(r.gOrn > r.gGrey * 1.5, 'orange footprint is much larger than grey (' + r.gOrn + ' vs ' + r.gGrey + ')');
ok(r.animO > 300 && r.animP > 100 && r.animG < r.animO / 2, 'orange/purple animate; grey nearly static ' + JSON.stringify({ o: r.animO, p: r.animP, g: r.animG }));
ok(r.redO === 0, 'Reduced FX gives a static (non-animated) orange drop');
// 5. performance: 40 mixed drops per frame (icons cached)
r = await ev(() => { const M = window.__M; const x = document.createElement('canvas').getContext('2d'); const R = ['grey', 'green', 'blue', 'purple', 'orange']; const sp = i => ({ kind: 'item', slot: 'armR', mfr: 'PS', rar: R[i % 5], name: 'x', sig: false, amount: 1, key: 'perf|' + (i % 5) }); for (let i = 0; i < 5; i++) M.iconCanvas(sp(i)); const t0 = performance.now(); const N = 200; for (let f = 0; f < N; f++) for (let i = 0; i < 40; i++) M.drawLoot(x, 50 + i * 3, 100, 1, 10 + f / 60, sp(i), i, { age: 99, reduced: false, fx: i < 14 ? 2 : 0 }); return (performance.now() - t0) / N; });
ok(r < 8, 'drawing 40 drops (14 fully animated) costs ' + r.toFixed(2) + ' ms/frame in headless software canvas');
// 6. in-game: drops, label filter, pickup fx, no errors
await ev(() => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.level = 20; g.recompute(); g.dbg.god = true; g.startRun('annex'); });
r = await ev(() => { const g = window.__game, C = window.__C; const ids = Object.values(C.ITEM_BY_ID); const or = ids.find(i => i.rarity === 'orange'), gr = ids.find(i => i.rarity === 'grey'); g.save.settings.reducedFx = false; g.save.settings.lootLabels = 'all'; g.save.settings.lootMin = 'grey';
  for (let i = 0; i < 4; i++) g.addDrop(g.px + 1 + i * .3, g.py + 1, { kind: 'item', inst: { uid: 'q' + i, def: i % 2 ? or.id : gr.id, chips: [] } }); g.addDrop(g.px - 1, g.py - 1, { kind: 'stim' }); g.addDrop(g.px - 1.4, g.py - 1, { kind: 'credits', amount: 80 });
  const dr = g.inst.drops; const bornOk = dr.every(d => typeof d.born === 'number'); for (let i = 0; i < 90; i++) { g.update(.016); window.__rend.draw(.016); } const n = dr.length;
  const red = window.__rend; return { n, bornOk, labels: red.lootLabels.length }; });
ok(r.n === 6 && r.bornOk, 'drops carry spawn time and render without errors (' + r.n + ')');
await ev(() => { const g = window.__game; g.save.settings.lootLabels = 'all'; g.save.settings.lootMin = 'purple'; window.__cap = 0; const rend = window.__rend; const orig = rend.lootLabels; });
r = await ev(() => { const g = window.__game, rend = window.__rend; const names = []; const proto = Object.getPrototypeOf(rend); const o = window.__M; const ctxFill = rend.ctx.fillText.bind(rend.ctx); rend.ctx.fillText = (t, ...a) => { names.push(t); return ctxFill(t, ...a); }; for (let i = 0; i < 5; i++) { g.update(.016); rend.draw(.016); } const C = window.__C; const orName = Object.values(C.ITEM_BY_ID).find(i => i.rarity === 'orange').name, grName = Object.values(C.ITEM_BY_ID).find(i => i.rarity === 'grey').name; rend.ctx.fillText = ctxFill; return { names, hasO: names.includes(orName), hasG: names.includes(grName) }; });
ok(r.hasO && !r.hasG, 'label rarity filter: only purple+ labels drawn when min=purple');
r = await ev(() => { const g = window.__game; g.save.settings.lootMin = 'grey'; g.save.settings.lootLabels = 'off'; const d = g.inst.drops[0]; g.px = d.x; g.py = d.y; const before = g.inst.drops.length; g.update(.05); g.update(.05); return { before, after: g.inst.drops.length, fx: g.pickFx.length }; });
ok(r.after < r.before && r.fx >= 1, 'pickup removes the drop and queues a pickup animation (' + r.fx + ')');
r = await ev(() => { const g = window.__game, rend = window.__rend; for (let i = 0; i < 6; i++) { g.update(.016); rend.draw(.016); } const q = g.pickFx.length; for (let i = 0; i < 40; i++) { g.update(.016); rend.draw(.016); } return { q, left: g.pickFx.length }; });
ok(r.left === 0, 'pickup animation queue drains after it plays');
ok(errors.length === 0, 'no page errors ' + errors.join(' | ').slice(0, 300));
await browser.close(); if (fails) { console.log(fails + ' FAILED'); process.exit(1); } console.log('loot tests passed');
