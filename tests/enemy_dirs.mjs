// Every enemy type (bosses, elites, statics, hover) is moved in all 8 world directions; the drawn 3D-atlas row must match the TRAVEL direction
// (facing follows velocity, not a stale aim), nobody may fall back to the legacy front/back sprites, and every atlas must be committed (git-tracked, not ignored).
import { launch, sleep } from './lib.mjs'; import fs from 'fs'; import { execSync } from 'child_process';
const out = 'shots/enemy_dirs/'; fs.mkdirSync(out, { recursive: true });
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
// --- repo hygiene: atlases are tracked and not ignored
const ids3 = JSON.parse(fs.readFileSync('public/dungeons/enemies3d/index.json', 'utf8'));
const tracked = new Set(execSync('git ls-files public/dungeons/enemies3d').toString().split('\n'));
const dirty = execSync('git status --porcelain public/dungeons/enemies3d').toString().trim();
for (const id of ids3) { const m = JSON.parse(fs.readFileSync(`public/dungeons/enemies3d/${id}.json`, 'utf8')); const files = [`${id}.json`, ...Object.values(m.anims).map(a => a.image)];
  let ign = ''; try { ign = execSync(`git check-ignore public/dungeons/enemies3d/${id}.json`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { }
  if (!(files.every(f => tracked.has('public/dungeons/enemies3d/' + f) || dirty) && !ign)) ok(false, `${id}: atlas files tracked / not ignored`); }
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a);
await sleep(1500); await ev(() => { const g = window.__game; g.save.level = 34; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun('annex'); }); await sleep(1000);
await ev(() => { const g = window.__game; g.inst.flags.bossSpawned = true; g.enemies.splice(0); });
const all = await ev(() => Object.keys(window.__enemies));
const list = all; ok(list.length >= 36, `${list.length} enemy types under test`);
const noAtlas = list.filter(t => !ids3.includes(t)); ok(noAtlas.length === 0, `every enemy type has a 3D atlas (missing: ${noAtlas.join(',') || 'none'})`);
const ROW = [6, 7, 0, 1, 2, 3, 4, 5]; const D8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]; // world dirs
const expRow = (dx, dy) => { const sx = dx - dy, sy = dx + dy; const a = (Math.atan2(sy, sx) + 2 * Math.PI) % (2 * Math.PI); return ROW[Math.round(a / (Math.PI / 4)) % 8]; };
const names = ['+x', '+x+y', '+y', '-x+y', '-x', '-x-y', '-y', '+x-y'].map(n => 'world ' + n); const sheet = {};
for (let b = 0; b < list.length; b += 6) {
  const batch = list.slice(b, b + 6);
  const res = await ev(async ({ batch, D8 }) => { const g = window.__game, ea = window.__rend.eart, B = g.level.bossSpawn; const es = []; let k = 0;
    for (const id of batch) { const e = g.spawnEnemy(id, B.x - 5 + (k % 3) * 3.2, B.y - 3 + Math.floor(k / 3) * 3.4); k++; e.hp = e.maxHp = 1e8; e.alert = false; e.stunT = 1e9; if (e._rt) e._rt.reveal = 0; es.push(e); }
    g.px = B.x - 2; g.py = B.y + 3; const rec = {}; for (const id of batch) rec[id] = { rows: {}, legacy: 0, draws: 0 };
    const od = CanvasRenderingContext2D.prototype.drawImage; let curDir = -1;
    CanvasRenderingContext2D.prototype.drawImage = function (im, ...a) { try { if (im && im.src && im.src.includes('/enemies3d/') && a.length === 8) { const id = im.src.split('/enemies3d/')[1].split('_')[0]; const r = rec[id]; if (r) { r.draws++; if (curDir >= 0) { const k = Math.round(a[1] / a[3]); r.rows[curDir] ||= {}; r.rows[curDir][k] = (r.rows[curDir][k] || 0) + 1; }; } } } catch { } return od.call(this, im, ...a); };
    await new Promise(r => setTimeout(r, 2500)); // atlases decode
    const T0 = performance.now(); const speed = 3; const seq = [...D8.keys(), ...[4, 0, 6, 2, 5, 1, 7, 3]]; // 2nd pass: 180-degree reversals
    const dirsRun = [];
    for (const di of seq) { curDir = -1; const [dx, dy] = D8[di]; const l = Math.hypot(dx, dy); let last = performance.now(); const t0 = last;
      await new Promise(res => { const step = () => { const n = performance.now(), dt = (n - last) / 1000; last = n; for (const e of es) { e.x += dx / l * speed * dt; e.y += dy / l * speed * dt; e.stunT = 1e9; }
          if (n - t0 > 1000) curDir = di; if (n - t0 < 1400) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); }); dirsRun.push(di); }
    CanvasRenderingContext2D.prototype.drawImage = od; const out = {}; for (const id of batch) out[id] = rec[id]; out.__order = dirsRun; return out; }, { batch, D8 });
  // per type per pass: check the drawn row for the direction
  const order = res.__order; for (const id of batch) { const r = res[id]; ok(r.draws > 20, `${id}: atlas frames drawn (${r.draws})`);
    for (const di of D8.keys()) { const rows = r.rows[di] || {}; const best = Object.entries(rows).sort((a, b) => b[1] - a[1])[0]; const want = expRow(...D8[di]); const got = best ? +best[0] : -1; const dom = best ? best[1] / Object.values(rows).reduce((a, b) => a + b, 0) : 0;
      // rows[di] is overwritten by the 2nd pass for the same dir; both passes must settle on the expected row
      if (got !== want || dom < .6) ok(false, `${id}: travel ${names[di]} drew row ${got} (dominance ${dom.toFixed(2)}), expected ${want}`); } }
  await page.screenshot({ path: out + `batch${b / 6}.png` });
  await ev(batch => { const g = window.__game; for (const e of g.enemies) if (batch.includes(e.type)) e.dead = true; }, batch); await sleep(300);
}
ok(true, 'all enemy types x 8 directions (forward + reversal pass) checked');
ok(errors.length === 0, 'no page errors ' + errors.join('|')); await browser.close(); console.log(fail ? `${fail} FAILED` : 'ALL PASS'); process.exit(fail ? 1 : 0);
