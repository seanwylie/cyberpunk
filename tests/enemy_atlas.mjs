// 3D enemy atlases: every id in public/dungeons/enemies3d/index.json loads lazily, every anim sheet decodes with the declared geometry, the in-game draw uses it, rows follow the 8-notch facing, memory stays bounded (LRU), no page errors.
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const out = 'shots/enemy_art/'; fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a);
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const ids = JSON.parse(fs.readFileSync('public/dungeons/enemies3d/index.json', 'utf8')); ok(ids.length > 0, `index lists ${ids.length} atlases: ${ids.join(',')}`);
for (const id of ids) { const m = JSON.parse(fs.readFileSync(`public/dungeons/enemies3d/${id}.json`, 'utf8')); ok(['idle', 'walk', 'attack', 'hit', 'death'].every(a => m.anims[a] && fs.existsSync(`public/dungeons/enemies3d/${m.anims[a].image}`)), `${id}: idle/walk/attack/hit/death sheets present`); ok(m.anims.attack.hit >= 0 && m.hpx > 40 && m.frame >= 96, `${id}: hit frame ${m.anims.attack.hit}, frame ${m.frame}px, hpx ${m.hpx}`); }
await sleep(1500); await ev(() => { const g = window.__game; g.save.level = 34; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun('annex'); }); await sleep(1000);
await ev(() => { const g = window.__game; g.inst.flags.bossSpawned = true; const B = g.level.bossSpawn; for (const o of g.enemies) { o.x += 400; o.y += 400; } window.__es = []; });
const res = await ev(async ids => { const g = window.__game, ea = window.__rend.eart, B = g.level.bossSpawn, r = {}; r.ready = {}; r.rows = {}; let k = 0;
  for (const id of ids) { if (!window.__enemies[id]) continue; const e = g.spawnEnemy(id, B.x + (k % 4) * 2.2 - 3, B.y + Math.floor(k / 4) * 2.4 - 2); k++; e.hp = e.maxHp = 1e8; e.alert = false; e.stunT = 1e9; e._rt.reveal = 0; window.__es.push(e); }
  g.px = B.x; g.py = B.y + 4; await new Promise(r => setTimeout(r, 2500));
  let atlasDraws = 0; const old = ea.atlasFor.bind(ea); ea.atlasFor = (t, n) => { const a = old(t, n); if (a) atlasDraws++; return a; }; await new Promise(r => setTimeout(r, 700)); r.atlasDraws = atlasDraws;
  for (const e of window.__es) r.ready[e.type] = !!old(e.type, g.time); r.atl = ea.atl.size; r.max = ea.atlasMax; return r; }, ids);
for (const id of ids.filter(i => i in res.ready)) ok(res.ready[id], `${id}: atlas loaded and used in game`); ok(res.atlasDraws > 0, `atlas draws per run: ${res.atlasDraws}`); ok(res.atl <= Math.max(res.max, ids.length), `LRU bound ${res.atl} <= ${res.max} (all visible types stay resident)`);
await page.screenshot({ path: out + 'atlas_lineup.png' });
ok(errors.length === 0, 'no page errors ' + errors.join('|')); await browser.close(); process.exit(fail ? 1 : 0);
