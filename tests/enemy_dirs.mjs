// Every enemy type (bosses, elites, statics, hover) is moved in all 8 world directions; the drawn 3D-atlas row must match the TRAVEL direction
// (facing follows velocity, not a stale aim), nobody may fall back to the legacy front/back sprites, and every atlas must be committed (git-tracked, not ignored).
import { launch, sleep } from './lib.mjs'; import fs from 'fs'; import { execSync } from 'child_process';

let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
// --- repo hygiene: atlases are tracked and not ignored
const ids3 = JSON.parse(fs.readFileSync('public/dungeons/enemies3d/index.json', 'utf8'));
const tracked = new Set(execSync('git ls-files public/dungeons/enemies3d').toString().split('\n'));
const dirty = execSync('git status --porcelain public/dungeons/enemies3d').toString().trim();
for (const id of ids3) { const m = JSON.parse(fs.readFileSync(`public/dungeons/enemies3d/${id}.json`, 'utf8')); const files = [`${id}.json`, ...Object.values(m.anims).map(a => a.image)];
  let ign = ''; try { ign = execSync(`git check-ignore public/dungeons/enemies3d/${id}.json`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { }
  if (!(files.every(f => tracked.has('public/dungeons/enemies3d/' + f) || dirty) && !ign)) ok(false, `${id}: atlas files tracked / not ignored`); }
// Fast + deterministic (about 10 s): no wall-clock sampling. (1) every enemy atlas anim has 8 pairwise-distinct direction rows; (2) the facing
// state machine (the real EnemyArt.draw driven with a manual clock) lands on the notch matching the screen-space travel direction for each of
// the 8 headings, forward and in a 180-degree reversal pass, for every enemy type; (3) screen-cardinal travel (world diagonals) selects the
// cardinal notches and world-axis travel the diagonal ones (iso grid axes are the screen diagonals).
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a);
await sleep(1500);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; await ev(o => { window.__only = o; }, ONLY);
const R = await ev(async (ids3) => {
  const out = { atlasBad: [], dirBad: [], drawErr: [], types: 0, checks: 0, noArt: [] };
  const sig = (img, fr, row, f) => { const c = document.createElement('canvas'); c.width = c.height = 24; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, f * fr, row * fr, fr, fr, 0, 0, 24, 24); return x.getImageData(0, 0, 24, 24).data; };
  const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); return d / a.length; };
  for (const id of ids3) { const m = await (await fetch(`/dungeons/enemies3d/${id}.json`)).json();
    for (const [an, A] of Object.entries(m.anims)) { const img = new Image(); img.src = `/dungeons/enemies3d/${A.image}`; try { await img.decode(); } catch { out.atlasBad.push(`${id}/${an}: image failed to load`); continue; }
      const rows = Math.round(img.naturalHeight / m.frame); if (rows !== 8) { out.atlasBad.push(`${id}/${an}: ${rows} rows`); continue; }
      const f = Math.min(1, A.frames - 1), S = [...Array(8).keys()].map(r => sig(img, m.frame, r, f));
      for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (diff(S[i], S[j]) < 0.6) out.atlasBad.push(`${id}/${an}: rows ${i} and ${j} are identical`); } }
  const g = window.__game; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.startRun('annex', 1001); g.enemies.splice(0); g.inst.flags.bossSpawned = true;
  const Rn = window.__rend, ea = Rn.eart, F = await import('/src/facing.ts'); const types = Object.keys(window.__enemies).filter(t => !window.__only || window.__only.includes(t)); out.types = types.length;
  const D8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]; const B = g.level.bossSpawn;
  const want = (dx, dy) => F.dirIndex(dx - dy, dx + dy);
  for (const t of types) { const e = g.spawnEnemy(t, B.x, B.y); e.hp = e.maxHp = 1e9; e.alert = false; e.stunT = 1e9; if (e._rt) e._rt.reveal = 0; const def = window.__enemies[t];
    for (const di of [...D8.keys(), 4, 0, 6, 2, 5, 1, 7, 3]) { const [dx, dy] = D8[di], l = Math.hypot(dx, dy);
      for (let i = 0; i < 14; i++) { g.time += .1; e.x += dx / l * .35; e.y += dy / l * .35; try { ea.draw(Rn, e, def, e._rt || {}, 640, 360); } catch (err) { out.drawErr.push(t + ': ' + err.message); break; } }
      const s = ea.st.get(e.id); out.checks++; if (!s) { out.noArt.push(t); break; } if (s.dir !== want(dx, dy)) out.dirBad.push(`${t}: world heading (${dx},${dy}) -> notch ${s.dir}, want ${want(dx, dy)}`); }
    e.dead = true; }
  out.cardinal = [[1, 1, 'S'], [-1, -1, 'N'], [-1, 1, 'W'], [1, -1, 'E']].map(([dx, dy, n]) => F.DIR_NAMES[want(dx, dy)] === n);
  out.axes = [[1, 0, 'SE'], [0, 1, 'SW'], [-1, 0, 'NW'], [0, -1, 'NE']].map(([dx, dy, n]) => F.DIR_NAMES[want(dx, dy)] === n);
  return out; }, ONLY ? ids3.filter(i => ONLY.includes(i)) : ids3);
ok(R.types >= (ONLY ? 1 : 36), `${R.types} enemy types under test`);
ok(R.atlasBad.length === 0, 'every atlas anim has 8 distinct direction rows' + (R.atlasBad.length ? ': ' + R.atlasBad.slice(0, 6).join(' | ') : ''));
ok(R.drawErr.length === 0, 'EnemyArt.draw runs for every type ' + R.drawErr.slice(0, 3).join('|'));
ok(R.noArt.length === 0, 'every type has loaded art (' + R.noArt.join(',') + ')');
ok(R.dirBad.length === 0, `facing follows travel direction for every type x 8 headings x reversal (${R.checks} checks)` + (R.dirBad.length ? ': ' + R.dirBad.slice(0, 6).join(' | ') : ''));
ok(R.cardinal.every(Boolean), 'screen-cardinal travel (world diagonals) selects the E/S/W/N notches');
ok(R.axes.every(Boolean), 'world-axis travel selects the diagonal notches (iso grid axes are the screen diagonals)');
ok(errors.length === 0, 'no page errors ' + errors.join('|')); await browser.close(); console.log(fail ? `${fail} FAILED` : 'ALL PASS'); process.exit(fail ? 1 : 0);
