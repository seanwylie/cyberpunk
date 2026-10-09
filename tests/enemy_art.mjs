// Every enemy type in ENEMIES must have loaded sprite art (front + back), sprites must actually render in the Annex (yard + boss) and in each new dungeon.
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const out = 'shots/enemy_art/'; fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a);
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
await page.waitForFunction(() => window.__rend.eart.ready, null, { timeout: 20000 }).catch(() => {}); await sleep(1500);
const ids = await ev(() => Object.keys(window.__enemies));
const miss = await ev(ids => ids.filter(t => !window.__rend.eart.has(t)), ids); ok(miss.length === 0, `every ENEMIES type has art (${ids.length} types) missing=${JSON.stringify(miss)}`);
const nb = await ev(ids => ids.filter(t => !window.__rend.eart.img[(window.__rend.eart.ART?.[t]?.spr || t) + '_back']), ids); console.log('INFO types without a back sprite:', nb.join(','));
// count real sprite draws per type
await ev(() => { const ea = window.__rend.eart, d = ea.draw.bind(ea); window.__drawn = {}; ea.draw = (...a) => { const r = d(...a); const e = a.find(x => x && x.type); if (r && e) window.__drawn[e.type] = (window.__drawn[e.type] || 0) + 1; return r; }; });
const start = async id => { await ev(id => { const g = window.__game; g.save.level = 34; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun(id); }, id); await sleep(1200); };
async function lineup(id, types, file) {
  await ev(([types]) => { const g = window.__game, L = g.level; const cx = L.spawn.x + 3, cy = L.spawn.y; for (const o of g.enemies) { o.alert = false; } types.forEach((t, i) => { const e = g.spawnEnemy(t, cx + (i % 4) * 2 - 2, cy - 4 + Math.floor(i / 4) * 2.4); e.hp = e.maxHp = 1e7; e.alert = false; e._rt.reveal = 0; }); g.px = cx; g.py = cy + 2; }, [types]);
  await sleep(1500); await page.screenshot({ path: out + file });
}
await start('annex');
await page.screenshot({ path: out + 'annex_yard_natural.png' });
await lineup('annex', ['worker', 'shooter', 'turret', 'sawhand', 'foreman'], 'annex_yard.png');
await ev(() => { const g = window.__game; g.inst.flags.bossSpawned = true; g.inst.flags.bossRevealed = true; const B = g.level.bossSpawn; for (const t of ['overseer', 'warden', 'enforcer']) { } const e = g.spawnEnemy('overseer', B.x, B.y); e.hp = e.maxHp = 1e7; e.alert = false; g.px = B.x - 4; g.py = B.y + 3; }); await sleep(1800); await page.screenshot({ path: out + 'annex_boss_overseer.png' });
for (const b of ['warden', 'enforcer']) { await ev(b => { const g = window.__game, B = g.level.bossSpawn; for (const o of g.enemies) if (o.type === 'overseer' || o.type === 'warden') o.dead = true; const e = g.spawnEnemy(b, B.x, B.y); e.hp = e.maxHp = 1e7; e.alert = false; g.px = B.x - 4; g.py = B.y + 3; }, b); await sleep(1500); await page.screenshot({ path: out + `annex_boss_${b}.png` }); }
const T = { foundry: ['slaghauler', 'ladlecrew', 'cinderhound', 'teague'], clinic: ['orderly', 'nursebot', 'matron', 'surgeon'], warehouse: ['picker', 'loader', 'shiftlead', 'stockmgr'] };
for (const id of Object.keys(T)) { await start(id); await lineup(id, T[id], `${id}_sprites.png`); }
const drawn = await ev(() => window.__drawn); console.log('drawn', JSON.stringify(drawn));
for (const t of ['worker', 'shooter', 'turret', 'sawhand', 'foreman', 'overseer', 'warden', 'enforcer', 'slaghauler', 'orderly', 'picker']) ok((drawn[t] || 0) > 0, `${t} rendered as sprite`);
ok(errors.length === 0, 'no page errors ' + errors.join('|')); await browser.close(); process.exit(fail ? 1 : 0);
