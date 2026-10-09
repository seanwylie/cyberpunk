// 8-way facing: unit tests of src/facing.ts (bundled with esbuild) + in-game check that moving enemies pick the intended direction and never pop.
import { build } from 'esbuild'; import { launch, sleep } from './lib.mjs';
await build({ entryPoints: ['src/facing.ts'], bundle: true, format: 'esm', outfile: '/tmp/facing_test.mjs', logLevel: 'silent' });
const F = await import('/tmp/facing_test.mjs?' + Date.now()); let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const NAMES = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const sv = k => [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)];
for (let k = 0; k < 8; k++) { const [x, y] = sv(k); ok(F.dirIndex(x, y) === k, `screen vector -> ${NAMES[k]}`); }
const di = (wx, wy) => { const s = F.toScreen(wx, wy); return F.dirIndex(s.sx, s.sy); };
ok(di(1, 1) === F.S, 'world(1,1) is screen DOWN (S / front)'); ok(di(-1, -1) === F.N, 'world(-1,-1) is screen UP (N / back)');
ok(di(1, -1) === F.E && di(-1, 1) === F.W, 'world(1,-1)/(-1,1) are screen RIGHT/LEFT'); ok(di(1, 0) === F.SE && di(0, 1) === F.SW && di(-1, 0) === F.NW && di(0, -1) === F.NE, 'world axes are the screen diagonals');
for (const rate of [90, 360, 1440, 4000]) { let cur = F.S, held = 9, last = -99, maxStep = 0, minGap = 1e9, frames = 0, changes = 0; const dt = 1 / 60;
  for (let t = 0; t < 720 / rate; t += dt) { const a = (t * rate) * Math.PI / 180; held += dt; const nd = F.stepDir(cur, Math.cos(a), Math.sin(a), held, .1); if (nd !== cur) { maxStep = Math.max(maxStep, Math.abs(F.notchDiff(cur, nd))); if (last >= 0) minGap = Math.min(minGap, frames - last); last = frames; cur = nd; held = 0; changes++; } frames++; }
  ok(maxStep <= 1, `turn rate ${rate}deg/s: never skips a notch (max step ${maxStep}, ${changes} changes)`); ok(minGap >= 5, `turn rate ${rate}deg/s: >=6 frames between notch changes (min gap ${minGap})`); }
{ let cur = F.S, flips = 0, held = 9; for (let i = 0; i < 600; i++) { const a = (67.5 + (i % 2 ? 12 : -12)) * Math.PI / 180; held += 1 / 60; const nd = F.stepDir(cur, Math.cos(a), Math.sin(a), held); if (nd !== cur) { flips++; cur = nd; held = 0; } } ok(flips <= 1, `boundary jitter causes <=1 flip (${flips})`); }
const none = {}; ok(F.variantFor(F.N, none).dark && F.variantFor(F.N, none).kind === 'front' && F.variantFor(F.N, none).xs === 1, 'N without back art -> darkened front (no squash)'); ok(F.variantFor(F.N, { back: true }).kind === 'back' && !F.variantFor(F.N, { back: true }).dark, 'N with back art -> back sprite');
ok([0,1,2,3,4,5,6,7].every(d => F.variantFor(d, none).xs === 1 && F.variantFor(d, none).skew === 0), 'fallback never squashes or skews'); ok(F.variantFor(F.E, { side: true }).kind === 'side' && F.variantFor(F.W, { side: true }).flip === -1, 'side art used for E/W when present');
ok(F.variantFor(F.S, { tfront: true }).kind === 'tfront', 'true-front art used for S when present'); ok(F.variantFor(F.NE, { back: true }).flip === -F.variantFor(F.NW, { back: true }).flip, 'NE/NW mirror each other');
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a);
await sleep(1500); await ev(() => { const g = window.__game; g.save.level = 34; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun('annex'); }); await sleep(1000);
await ev(() => { const g = window.__game; g.inst.flags.bossSpawned = true; const L = g.level; for (const o of g.enemies) { o.x += 400; o.y += 400; } const B = L.bossSpawn; const e = g.spawnEnemy('worker', B.x, B.y); e.hp = e.maxHp = 1e8; e.alert = false; e.stunT = 1e9; window.__e = e; g.px = B.x; g.py = B.y + 7; });
const res = await ev(async () => { const e = window.__e, ea = window.__rend.eart; const out = {}, trace = [];
  const want = { E: 0, SE: 1, S: 2, SW: 3, W: 4, NW: 5, N: 6, NE: 7 }; const dirs = { E: [1, -1], SE: [1, 0], S: [1, 1], SW: [0, 1], W: [-1, 1], NW: [-1, 0], N: [-1, -1], NE: [0, -1] }; const cx = e.x, cy = e.y;
  for (const [name, [dx, dy]] of Object.entries(dirs)) { const n = Math.hypot(dx, dy); let hold = 0, pos = 0, ok = 0;
    await new Promise(res => { const step = () => { hold++; pos += .02; e.x = cx + dx / n * pos; e.y = cy + dy / n * pos; e.alert = false; const s = ea.st.get(e.id); if (s) trace.push(s.dir); if (s && s.dir === want[name]) ok++; else ok = 0; if (ok < 12 && hold < 150) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
    trace.push(-9); const s = ea.st.get(e.id); out[name] = s ? s.dir : -1; e.x = cx; e.y = cy; await new Promise(r => setTimeout(r, 400)); }
  let maxJump = 0; for (let i = 1; i < trace.length; i++) { if (trace[i] === -9) continue; let d = trace[i - 1] === -9 ? 0 : Math.abs(trace[i] - trace[i - 1]); d = Math.min(d, 8 - d); maxJump = Math.max(maxJump, d); } return { out, maxJump }; });
const want = { E: 0, SE: 1, S: 2, SW: 3, W: 4, NW: 5, N: 6, NE: 7 };
for (const [k, v] of Object.entries(want)) ok(res.out[k] === v, `in-game enemy moving ${k} faces ${NAMES[res.out[k]]}`);
ok(res.maxJump <= 1, `in-game: facing never jumps more than one notch per frame (max ${res.maxJump})`); ok(errors.length === 0, 'no page errors ' + errors.join('|')); await browser.close(); process.exit(fail ? 1 : 0);
