// Ground zones/telegraphs: finite lifetime, capped, removed on boss death / leaving the run / reset; no unbounded growth over a 3+ minute boss fight; hostile zones are drawn red/orange.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
const nonEnv = () => ev(() => window.__game.zones.filter(z => !z.env).length);
for (const id of ['warehouse', 'foundry']) {
  // ---- a long boss fight: sample zone counts and drawn discs ----
  const r = await ev(async id => { const g = window.__game; g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.cleared = {}; g.save.lastClearDay = null; g.checkTownUnlocks(); g.travel('harrow'); if (!g.startRun(id)) return { err: 'startRun failed ' + id }; g.revealing = false; const L = g.level; for (let i = 0; i < 20; i++) g.update(1 / 30);
    const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; g.dbg.god = true; { const rp = g.revealPoint(); g.px = rp.x; g.py = rp.y; }
    let drawn = 0; const rend = window.__rend; const od = rend.drawZone.bind(rend); rend.drawZone = z => { drawn++; return od(z); };
    let maxZ = 0, maxNon = 0, maxDrawn = 0, samples = []; const T = 200;
    for (let i = 0; i < T * 30; i++) { g.hp = g.maxHp; g.update(1 / 30); if (i % 6 === 0) { drawn = 0; rend.draw(1 / 30); maxDrawn = Math.max(maxDrawn, drawn); } maxZ = Math.max(maxZ, g.zones.length); maxNon = Math.max(maxNon, g.zones.filter(z => !z.env).length); if (i % 900 === 0) samples.push(g.zones.length); }
    // every non-env zone still alive has a finite life
    const bad = g.zones.filter(z => !z.env && !(isFinite(z.life) && z.life < 100)).length; const envN = g.zones.filter(z => z.env).length;
    // boss death removes temporary zones
    const boss = g.enemies.find(e => !e.dead && g.isBoss?.(e)) || g.enemies.find(e => !e.dead && window.__enemies[e.type]?.boss); if (boss) { boss.hp = 0; g.killEnemy(boss); } for (let i = 0; i < 5; i++) g.update(1 / 30);
    const afterBoss = g.zones.filter(z => !z.env).length; g.enterTown(true);
    return { maxZ, maxNon, maxDrawn, samples, bad, envN, afterBoss, afterLeave: g.zones.length, hadBoss: !!boss, bossSeen: g.enemies.length }; }, id);
  console.log(id, JSON.stringify(r)); if (r.err) { ok(false, r.err); continue; }
  ok(r.maxNon <= 40 && r.maxZ <= 40 + r.envN, `${id}: zone count stays bounded over 200s of boss fight (max ${r.maxZ}, temporary ${r.maxNon})`);
  ok(r.bad === 0, `${id}: every live temporary zone has a finite lifetime`);
  ok(r.maxDrawn <= 60, `${id}: drawn zone discs per frame stay bounded (${r.maxDrawn})`);
  ok(r.afterBoss === 0, `${id}: temporary zones are gone right after the boss dies (${r.afterBoss})`);
  ok(r.afterLeave === 0, `${id}: no zones remain after leaving the run (${r.afterLeave})`);
}
// ---- expiry: pushed zones disappear after life; env hazard zones are tagged and hostile ones drawn red/orange ----
const e = await ev(() => { const g = window.__game; g.enterTown(true); g.startRun('annex'); g.revealing = false; g.zones = g.zones.filter(z => z.env); for (let i = 0; i < 6; i++) g.zones.push({ x: g.px + 3, y: g.py + 3, r: 2, t: 0, life: 2 + i * .1, dps: 5, heat: 1, windup: .5 }); const n0 = g.zones.filter(z => !z.env).length; g.dbg.god = true; for (let i = 0; i < 30 * 4; i++) g.update(1 / 30); return { n0, n1: g.zones.filter(z => !z.env).length }; });
ok(e.n0 === 6 && e.n1 === 0, 'temporary zones expire after their lifetime (' + e.n0 + ' -> ' + e.n1 + ')');
const col = await ev(() => { const g = window.__game, rend = window.__rend; g.zones.push({ x: g.px + 2, y: g.py + 2, r: 2, t: 1, life: 6, dps: 8, heat: 1, windup: .5 }); const fills = []; const op = rend.poly.bind(rend); rend.poly = (pts, f, s, a, lw) => { fills.push(f); return op(pts, f, s, a, lw); }; rend.drawZone(g.zones[g.zones.length - 1]); rend.poly = op; return fills; });
ok(col.length && col.every(f => /^#(c|d|f)/i.test(f)), 'hostile zones are drawn red/orange: ' + col.join(','));
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
