// Town pedestrians walk, not stutter: continuous velocity-based movement (no snapping, bounded accel/turn rate), walk-cycle phase advances with
// DISTANCE (no foot sliding), idle<->walk behaviours, no overlaps / wall clipping, in both Rustline and Harrow Reach. Also checks the walk atlas exists.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 }, query: '?splash=hold' });
await page.evaluate(() => { document.getElementById('splash')?.remove(); });
await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 }); await sleep(1500);
const rec = (frames) => page.evaluate(async (n) => {
  const g = window.__game, R = window.__rend; const F = await import('/src/townfolk.ts'); const out = { W: [], stride: F.STRIDE_TILES, cruiseMax: F.CRUISE * 1.15, dec: F.DECEL, acc: F.ACCEL, turn: F.TURN_STILL, atlas: !!R.anim?.loaded.images.walk, active: false };
  for (let i = 0; i < 30; i++) { g.update(.016); R.draw(.016); }
  out.active = !!R.town.folkActive; const T = R.town; const walkers = () => T.folk?.walkers || []; out.n = walkers().length;
  const dt = 1 / 60; const tr = walkers().map(() => []);
  for (let i = 0; i < n; i++) { g.update(dt); R.draw(dt); walkers().forEach((w, k) => tr[k].push([w.x, w.y, w.heading, w.cyc, w.mode, w.dir, w.speed, w.state, w.stride, R.tLast])); }
  out.tr = tr; out.solid = walkers().filter(w => g.solidAt(w.x, w.y)).length; out.dt = dt; out.town = g.townId; return out; }, frames);
function analyse(o, tag) {
  ok(o.atlas, tag + ': walk atlas loaded (public/sprites/walk.webp via player.json)');
  ok(o.active && o.n >= 8 && o.town === (tag === 'Harrow' ? 'harrow' : 'rustline'), `${tag}: ${o.n} town walkers active (>=8) in ${o.town}`);
  let maxStep = 0, maxAcc = 0, maxTurn = 0, travelled = [], walkFrames = 0, slideErr = 0, slideN = 0, cycBack = 0, idleSeen = 0, walkSeen = 0, flick = 0, frameSet = []; 
  o.tr.forEach((t, k) => { let dist = 0, pv = null; const fs = new Set(); let lastDirs = [];
    for (let i = 1; i < t.length; i++) { const dx = t[i][0] - t[i - 1][0], dy = t[i][1] - t[i - 1][1], d = Math.hypot(dx, dy); dist += d; maxStep = Math.max(maxStep, d); const fdt = t[i][9] - t[i - 1][9]; if (fdt < 1e-4) continue; const v = d / fdt; if (pv !== null) maxAcc = Math.max(maxAcc, Math.abs(v - pv) / fdt); pv = v; // per real game-time step (the town sim integrates the actual frame dt)

      let dh = t[i][2] - t[i - 1][2]; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); maxTurn = Math.max(maxTurn, Math.abs(dh) / fdt);
      const dc = t[i][3] - t[i - 1][3]; if (dc < -1e-9) cycBack++;
      if (t[i][4] === 'walk' && t[i - 1][4] === 'walk') { walkFrames++; walkSeen++; if (d > 1e-5) { slideErr += Math.abs(dc * t[i][8] - d); slideN += d; } fs.add(Math.floor(((t[i][3] % 1) + 1) % 1 * 16)); } else if (t[i][4] === 'idle') idleSeen++;
      lastDirs.push(t[i][5]); if (lastDirs.length > 20) lastDirs.shift(); if (lastDirs.length === 20) { const a = lastDirs[0], b = lastDirs[10], c = lastDirs[19]; if (a === c && a !== b && lastDirs.filter(x => x === b).length < 5) flick++; } }
    travelled.push(dist); frameSet.push(fs.size); });
  ok(maxStep < o.cruiseMax * o.dt * 1.05 + 1e-4, `${tag}: no snapping - max per-frame step ${maxStep.toFixed(4)} tiles <= ${(o.cruiseMax * o.dt).toFixed(4)}`);
  ok(maxAcc < o.dec * 1.6, `${tag}: bounded acceleration (max ${maxAcc.toFixed(2)} tiles/s^2 < ${(o.dec * 1.6).toFixed(1)}) - no jerky stop/start`);
  ok(maxTurn < o.turn * 1.15, `${tag}: bounded turn rate (max ${maxTurn.toFixed(2)} rad/s) - eased turns, no direction snapping`);
  ok(cycBack === 0, `${tag}: walk-cycle phase never runs backwards`);
  ok(slideN > 3 && slideErr / slideN < .02, `${tag}: foot speed matches movement - phase*stride vs distance error ${(100 * slideErr / Math.max(slideN, 1e-9)).toFixed(2)}% (<2%, no foot sliding)`);
  const movers = travelled.filter(d => d > 6).length; ok(movers >= Math.ceil(o.n * .6), `${tag}: ${movers}/${o.n} walkers covered >6 tiles in 20s (longest ${Math.max(...travelled).toFixed(1)})`);
  const cyc = o.tr.filter((_, k) => travelled[k] > 3).map((_, k) => frameSet[k]); ok(cyc.length && cyc.every(n => n >= 12), `${tag}: walkers who travel cycle through the walk frames (distinct frames per walker >= 12: ${cyc.join(',')})`);
  ok(idleSeen > 30 && walkSeen > 300, `${tag}: mixes pause/idle (${idleSeen} idle frames) and walking (${walkSeen} walk frames)`);
  ok(flick === 0, `${tag}: no facing flip-flop (${flick})`);
  ok(o.solid === 0, `${tag}: no walker ends inside a solid tile`);
  let minSep = 9; for (let i = 0; i < o.tr[0].length; i += 5) for (let a = 0; a < o.n; a++) for (let b = a + 1; b < o.n; b++) minSep = Math.min(minSep, Math.hypot(o.tr[a][i][0] - o.tr[b][i][0], o.tr[a][i][1] - o.tr[b][i][1])); ok(minSep > .3, `${tag}: walkers avoid each other (min separation ${minSep.toFixed(2)} tiles)`);
}
analyse(await rec(1200), 'Rustline');
await page.evaluate(() => { const g = window.__game; g.save.level = 20; g.checkTownUnlocks(); g.travel('harrow'); });
await page.waitForFunction(() => window.__game.townId === 'harrow', null, { timeout: 5000 }).catch(() => {}); await sleep(3000);
analyse(await rec(1200), 'Harrow');
ok(errors.length === 0, 'no console errors ' + errors.slice(0, 2).join('|'));
await browser.close(); console.log(fails ? `FAILED ${fails}` : 'ALL PASS'); process.exit(fails ? 1 : 0);
