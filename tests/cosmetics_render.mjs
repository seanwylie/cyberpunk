// Every cosmetic must actually render (docs/COSMETIC_TRAILS.md). Fails if any owned cosmetic paints nothing:
//  1) pixels: each cosmetic drawn offscreen through the real draw paths (wardrobe overlays, trail ribbon, pet/weapon, emote/recall moments,
//     body/variant art) must change pixels vs the bare model;
//  2) in game: each cosmetic is equipped and must issue canvas draws in town while moving, in a dungeon, on a remote player and in the
//     dressing room preview (cosAudit counters in src/cosmetics.ts + src/pmfx.ts).
// Shots: shots/cosmetics_render/*.png
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync('shots/cosmetics_render', { recursive: true });
const { browser, page, errors } = await launch({ viewport: { width: 1100, height: 700 }, init: () => { window.__WV_PERF_TEST = 1; } });
const ev = (f, a) => page.evaluate(f, a);
await page.waitForFunction(() => window.__rend?.anim && window.__rend?.town?.ready, null, { timeout: 120000 }).catch(() => {});
// ---------- 1) offscreen pixels
const px = await ev(async () => {
  const A = await import('/src/content/appearance.ts'), C = await import('/src/cosmetics.ts'), P = await import('/src/pmfx.ts'), F = await import('/src/cosfx.ts'), B = await import('/src/bodyvariants.ts');
  F.setReducedFx(false); const R = window.__rend, an = R.anim; const W = 220, H = 220, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d', { willReadFrequently: true });
  const base0 = B.bodyOf({ ...window.__game.save, cosmetics: A.newCos() }, null);
  const own = list => ({ cosmetics: { owned: Object.fromEntries(list.map(d => [d.id, 1])), equipped: Object.fromEntries(list.map(d => [d.slot, d.id])) } });
  const frame = (list, t, dir = 2) => { c.clearRect(0, 0, W, H); c.fillStyle = '#3a3630'; c.fillRect(0, 0, W, H); const k = { c, x: 110, y: 170, u: 2.4, t, moving: true, face: 0, id: 'px' };
    const tr = list.find(d => d.slot === 'trail'); if (tr) { const pts = []; for (let i = 0; i < 20; i++) pts.push({ x: 110 - (19 - i) * 4, y: 170 + Math.sin(i * .4) * 3, t: t - (19 - i) * .03 }); C.drawTrail(c, pts, t, k.u, tr, { x: 110, y: 170 }); }
    C.drawCosmetics(k, list, 'back'); if (an) { try { an.setBody(B.applyCosmeticVariants(base0, own(list)), list.map(d => d.id)); an.anim = 'idle'; an.t = 1; an.dir = dir; an.draw(c, 110, 170, k.u); } catch {} } C.drawCosmetics(k, list, 'front');
    return c.getImageData(0, 0, W, H).data; };
  const bare = { 2: frame([], 3, 2), 6: frame([], 3, 6) }; const bad = [], counts = {};
  const L = await import('/src/coslayers.ts'); for (const d of A.COSMETICS) { if (d.variant || d.body || L.hasCosArt(d.id)) { an.setBody(B.applyCosmeticVariants(base0, own([d])), [d.id]); for (let w = 0; w < 60 && !an.bodyReady.has(an.bodyKey); w++) await new Promise(r => setTimeout(r, 50)); }
    let n = 0; for (const dir of [2, 6]) { P.resetPm(); if (d.slot === 'emote') P.playEmote([d], 'px', false); if (d.slot === 'recall') P.playRecall([d], 'px', false); frame([d], 2.6, dir); const img = frame([d], 3, dir), b0 = bare[dir]; let m = 0; for (let i = 0; i < img.length; i += 4) if (Math.abs(img[i] - b0[i]) + Math.abs(img[i + 1] - b0[i + 1]) + Math.abs(img[i + 2] - b0[i + 2]) > 24) m++; n = Math.max(n, m); } counts[d.id] = n; if (n < 25) bad.push(d.id + '(' + d.slot + ':' + n + ')'); }
  return { n: A.COSMETICS.length, bad, counts };
});
ok(px.bad.length === 0, `pixels: all ${px.n} cosmetics change the rendered model${px.bad.length ? ' - nothing drawn: ' + px.bad.join(', ') : ''}`);
// ---------- 2) in game
await ev(() => { const c = window.__rend.ctx; window.__ops = 0; for (const m of ['drawImage', 'fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'putImageData']) { const o = c[m]; c[m] = function (...a) { window.__ops++; return o.apply(this, a); }; } });
const ids = await ev(async () => { const L = await import('/src/coslayers.ts'); return (await import('/src/content/appearance.ts')).COSMETICS.map(d => [d.id, d.slot, !!(d.variant || d.body), L.hasCosArt(d.id)]); });
const runCase = async (where) => { const miss = []; for (let i = 0; i < ids.length; i += 25) miss.push(...await runChunk(where, ids.slice(i, i + 25), i === 0)); return miss; };
const runChunk = (where, ids, first) => ev(async ([where, ids, first]) => {
  const A = await import('/src/content/appearance.ts'), RR = await import('/src/net/remote_render.ts'), P = await import('/src/pmfx.ts'), B = await import('/src/bodyvariants.ts');
  const g = window.__game, R = window.__rend, s = g.save; const dt = 1 / 60; g.dbg.god = true;
  if (!first) {} else if (where === 'dungeon') { g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.settings.devFreeReset = true; g.startRun('foundry', 4242); await new Promise(r => setTimeout(r, 3000)); for (const e of g.enemies) e.dead = true; } else g.enterTown(true);
  const dr = new RR.RemoteDrawer(R); const remote = { id: 'aud', name: 'Auditor', x: g.px + 1.2, y: g.py + .4, face: 0, moving: true, look: { cos: [] }, lvl: 30, em: 0 };
  const prev = R.netItems; R.netItems = items => { prev?.(items); if (where === 'town') items.push({ d: remote.x + remote.y, f: () => dr.draw(remote, { x: g.px, y: g.py }, false) }); };
  const miss = [];
  for (const [id, slot, body, art] of ids) { s.cosmetics = A.newCos(); s.cosmetics.owned[id] = Date.now(); A.equipCos(s, id); remote.look = { cos: [id] }; P.resetPm(); dr.forget('aud'); window.__cosAudit = {};
    for (let f = 0; f < 12; f++) { const a = Math.floor(f / 6) * 1.6; g.inputMove = { x: Math.cos(a), y: Math.sin(a) }; if (f === 3) { if (slot === 'emote') { g.emote(); remote.em++; } if (slot === 'recall') P.playRecall(A.equippedCos(s)); } remote.x += Math.cos(a) * .05; remote.y += Math.sin(a) * .05; g.update(dt); R.draw(dt); }
    g.inputMove = { x: 0, y: 0 }; const au = window.__cosAudit; window.__cosAudit = undefined;
    const hit = (owner) => Object.entries(au).some(([k, v]) => v > 0 && k.startsWith(owner + '|') && (k.split('|')[2] === id || k.split('|')[2].split('+').includes(id) || (k.split('|')[1] === 'rarityfx')));
    const isBody = body && JSON.stringify(B.bodyOf(s, null)) !== JSON.stringify(B.bodyOf({ ...s, cosmetics: A.newCos() }, null));
    const meOk = hit('me') || isBody || (art && R.anim.bodyKey.split('|')[1]?.split(',').includes(id)), netOk = where !== 'town' || hit('net:aud') || body || art;  // model-layer pieces are baked into the body sheet (src/coslayers.ts)
    if (!meOk) miss.push(id + ':me'); if (!netOk) miss.push(id + ':remote'); }
  R.netItems = prev; return miss;
}, [where, ids, first]);
const town = await runCase('town'); ok(town.length === 0, `town (moving) + remote player: every cosmetic draws${town.length ? ' - missing: ' + town.join(', ') : ''}`);
await page.screenshot({ path: 'shots/cosmetics_render/town.png' });
await page.reload(); await page.waitForFunction(() => window.__rend?.anim && window.__rend?.town?.ready, null, { timeout: 120000 }).catch(() => {}); await ev(() => { const c = window.__rend.ctx; window.__ops = 0; for (const m of ['drawImage', 'fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'putImageData']) { const o = c[m]; c[m] = function (...a) { window.__ops++; return o.apply(this, a); }; } });
const dun = await runCase('dungeon'); ok(dun.length === 0, `dungeon (moving): every cosmetic draws${dun.length ? ' - missing: ' + dun.join(', ') : ''}`);
await page.screenshot({ path: 'shots/cosmetics_render/dungeon.png' });
// ---------- 3) dressing room preview uses the same renderers
const drMiss = await ev(async (ids) => { const A = await import('/src/content/appearance.ts'); if (!window.__protoOps) { window.__protoOps = 1; const P = CanvasRenderingContext2D.prototype; for (const m of ['drawImage', 'fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'putImageData']) { const o = P[m]; P[m] = function (...a) { window.__ops = (window.__ops || 0) + 1; return o.apply(this, a); }; } } const g = window.__game, s = g.save; g.enterTown(true); s.cosmetics = A.newCos(); for (const [id] of ids) s.cosmetics.owned[id] = Date.now(); window.__ui.open('wardrobe'); await new Promise(r => setTimeout(r, 400)); const miss = [];
  for (const [id, slot, body, art] of ids) { if (body || art) continue; const el = document.querySelector(`#modal [data-act=wd-sel][data-id="${id}"]`); if (!el) { miss.push(id + ':notile'); continue; } el.click(); await new Promise(r => setTimeout(r, 60)); if (slot === 'emote' || slot === 'recall') { const pl = document.querySelector(`#modal [data-act=wd-play][data-id="${id}"]`); pl?.click(); }
    window.__cosAudit = {}; await new Promise(r => setTimeout(r, 200)); const au = window.__cosAudit; window.__cosAudit = undefined; if (!Object.entries(au).some(([k, v]) => v > 0 && k.startsWith('dr|') && (k.includes(id) || k.split('|')[1] === 'rarityfx'))) miss.push(id); }
  window.__ui.closeAll?.(); return miss; }, ids);
ok(drMiss.length === 0, `dressing room preview draws every cosmetic${drMiss.length ? ' - missing: ' + drMiss.join(', ') : ''}`);
ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close(); if (fails) { console.log(fails + ' FAIL'); process.exit(1); } console.log('ALL PASS');
