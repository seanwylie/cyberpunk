// Regression: killing an enemy plays collapse + fade of the REAL sprite with a brief flash, never an opaque white silhouette / pale humanoid corpse, and leaves nothing behind afterwards.
import { launch, sleep } from './lib.mjs'; import { PNG } from 'pngjs'; import fs from 'fs';
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a);
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
await sleep(1500); await ev(() => { const g = window.__game; g.save.level = 34; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun('annex'); }); await sleep(1000);
const px = async clip => PNG.sync.read(await page.screenshot({ clip })).data;
const IDS = (process.env.IDS || 'worker,shooter,sawhand,foreman,turret,overseer,warden,enforcer').split(',');
for (const id of IDS) {
  await ev(([id]) => { const g = window.__game; g.inst.flags.bossSpawned = true; const B = g.level.bossSpawn; for (const o of g.enemies) if (!o._p) { o._p = 1; o.x += 400; o.y += 400; } const e = g.spawnEnemy(id, B.x, B.y); e._p = 1; e.hp = e.maxHp = 60; e.alert = false; e.stunT = 1e9; e._rt.reveal = 0; window.__e = e; g.px = B.x - 3.5; g.py = B.y + 2.5; }, [id]); await sleep(1600);
  const p = await ev(() => { const r = window.__rend, e = window.__e; return [r.sx(e.x, e.y), r.sy(e.x, e.y)]; }); const W = 240, H = 240; const clip = { x: Math.max(0, Math.round(p[0] - W / 2)), y: Math.max(0, Math.round(p[1] - H * .75)), width: W, height: H };
  // mask out the player and any UI by comparing with the empty-arena baseline captured after the enemy is parked away (same camera)
  const live = await px(clip); await ev(() => { const g = window.__game; g.hurtEnemy(window.__e, 1e7, g.px, g.py, 0); }); const frames = []; const t0 = Date.now(); while (Date.now() - t0 < 2300) frames.push([Date.now() - t0, await px(clip)]);
  await sleep(300); const last = await px(clip);
  const white = d => { let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 250 && d[i] > 215 && d[i + 1] > 210 && d[i + 2] > 195) n++; return n; };
  const base = white(last), area = W * H; let worst = 0, worstT = 0; for (const [t, d] of frames) { const w = white(d) - base; if (w > worst) { worst = w; worstT = t; } }
  ok(worst < area * .012, `${id}: no near-white opaque blob during death (worst +${worst}px = ${(100 * worst / area).toFixed(2)}% of clip at ${worstT}ms)`);
  const dd = await ev(([id]) => { const d = window.__enemies[id]; return (d.boss ? 1.5 : d.elite ? 1.0 : .8) * 1000; }, [id]);
  const late = frames.filter(f => f[0] > dd + 300).map(f => f[1]); let maxN = 0; const bx0 = W / 2 - 50, bx1 = W / 2 + 50, by0 = H * .75 - 120, by1 = H * .75 + 15; // footprint of the enemy; animated arena rings are red, a leftover pale corpse is not
  for (const d of late) { let n = 0; for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) { const i = (y * W + x) * 4; if (Math.min(d[i], d[i + 1], d[i + 2]) > 150 && Math.abs(d[i] - last[i]) + Math.abs(d[i + 1] - last[i + 1]) + Math.abs(d[i + 2] - last[i + 2]) > 60) n++; } maxN = Math.max(maxN, n); }
  ok(late.length >= 1 && maxN < 40, `${id}: no pale corpse/ghost left once the collapse ends (${late.length} frames after ${dd + 300}ms, worst ${maxN}px)`);
  const gone = await ev(() => { const e = window.__e; return window.__rend.eart.dying(e, window.__game.time); }); ok(!gone, `${id}: death state ended`);
  if (process.env.SAVE) { fs.mkdirSync('shots/enemy_death', { recursive: true }); const o = new PNG({ width: W * 8, height: H }); for (let k = 0; k < 8; k++) { const f = frames[Math.min(frames.length - 1, Math.round(k * frames.length / 8 / 1.3))][1]; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = (y * W + x) * 4, b = (y * W * 8 + k * W + x) * 4; o.data[b] = f[a]; o.data[b + 1] = f[a + 1]; o.data[b + 2] = f[a + 2]; o.data[b + 3] = 255; } } fs.writeFileSync(`shots/enemy_death/${id}.png`, PNG.sync.write(o)); }
}
ok(errors.length === 0, 'no page errors ' + errors.join('|')); await browser.close(); process.exit(fail ? 1 : 0);
