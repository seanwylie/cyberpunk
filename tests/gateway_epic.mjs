// Epic gateways (docs/WORLD.md): every gateway is a longer variant of its base dungeon (bigger rooms, more packs, a set-piece ambush at the objective,
// a boss with +30% HP and an extra final phase), tuned to the destination town's entry level, and the headless bot clears it at matching gear.
// Usage: node tests/gateway_epic.mjs [--quick]   (bot runs ~10-20 min; --quick skips them)
import { launch } from './lib.mjs'; import { runJob } from '../tools/balance/harness.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const quick = process.argv.includes('--quick');
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const S = await page.evaluate(async () => { const { DUNGEONS } = await import('/src/content/dungeons.ts'); const { GATEWAYS, WORLD_BY_ID } = await import('/src/world.ts'); const { BOSS_BY_ID } = await import('/src/content/batch1_bosses.ts');
  const g = window.__game; const out = [];
  for (const gw of GATEWAYS) { const d = DUNGEONS[gw.dungeon], b = DUNGEONS[gw.dungeon.slice(3)]; let area = 0, barea = 0, sp = 0, bsp = 0, set = 0;
    for (const s of [1, 77, 901]) { const L = d.build(s), B = b.build(s); const fl = x => x.solid.reduce((a, v) => a + (v ? 0 : 1), 0); area += fl(L); barea += fl(B); sp += L.spawns.length; bsp += B.spawns.length; set = Math.min(set || 9, L.setPiece?.n || 0); }
    // boss: +HP and an extra phase in a real gateway run
    g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.cleared = {}; g.dbg.god = true; g.recompute(); g.startRun(gw.dungeon); g.revealing = false;
    g.spawnBoss(); const boss = g.enemies.find(e => e.type === d.defaultBoss); let ph = 0, hpMul = 0;
    if (boss) { const hp0 = boss.maxHp; boss.alert = true; boss._rt.reveal = 0; g.px = boss.x + 3; g.py = boss.y; for (let i = 0; i < 3; i++) g.update(1 / 30); hpMul = boss.maxHp / hp0; for (const f of [.7, .5, .35, .2, .1]) { boss.hp = boss.maxHp * f; for (let i = 0; i < 4; i++) g.update(1 / 30); } ph = boss.phase; }
    g.enterTown(true);
    out.push({ id: gw.dungeon, to: gw.to, floor: WORLD_BY_ID[gw.to].band[0], min: d.minLevel, area, barea, sp, bsp, set, ph, basePh: BOSS_BY_ID[d.defaultBoss]?.phases.length, hpMul, est: d.estMinutes, best: b.estMinutes, gate: d.gateway }); }
  return out; });
for (const r of S) {
  ok(r.min === r.floor && r.gate === r.to, `${r.id}: tuned to ${r.to} entry level ${r.floor} (minLevel ${r.min})`);
  ok(r.area > r.barea * 1.3 && r.sp > r.bsp * 1.3 && r.est[0] > r.best[0], `${r.id}: longer than its base (floor ${r.area}/${r.barea}, spawns ${r.sp}/${r.bsp}, est ${r.est}/${r.best} min)`);
  ok(r.set >= 3, `${r.id}: set-piece ambush at the objective (${r.set} extra foes)`);
  ok(r.hpMul > 1.25 && r.ph > r.basePh, `${r.id}: boss gets +HP (x${r.hpMul.toFixed(2)}) and an extra phase (${r.ph} vs ${r.basePh})`);
}
await browser.close();
if (!quick) {
  const kitFor = f => f < 20 ? 'mid' : f < 28 ? 'blue' : 'purple'; const only = process.env.ONLY ? process.env.ONLY.split(',') : null; const res = [];
  const fresh = async job => { const f = await launch({ query: '?splash=hold' }); try { return await f.page.evaluate(runJob, job); } finally { errors.push(...f.errors); await f.browser.close(); } };
  for (const r of S.filter(r => !only || only.includes(r.id))) { const kit = kitFor(r.floor), level = r.floor + 2;
    for (let s = 0; s < 2; s++) { const j = await fresh({ mode: 'level', id: r.id, kit, level, seed: 6100 + s * 71, maxT: 1800, maxDeaths: 5 }); res.push({ ...j, gw: r.id }); console.log(`  bot ${r.id} kit=${kit} L${level} seed ${s}: ${j.cleared ? 'CLEARED' : 'not cleared'} in ${Math.round(j.t || 0)}s, ${j.deaths} deaths, boss ${j.bossReached != null ? 'reached at ' + Math.round(j.bossReached) + 's' + (j.bossHpLeft != null ? ', ' + Math.round(j.bossHpLeft * 100) + '% HP left' : '') : 'not reached'}${j.error ? ' ERR ' + j.error : ''}`); }
    const b = await fresh({ mode: 'level', id: r.id.slice(3), kit, level, seed: 6100, maxT: 1800, maxDeaths: 5 }); res.push({ ...b, base: r.id }); console.log(`  base ${r.id.slice(3)}: ${b.cleared ? 'CLEARED' : 'not cleared'} in ${Math.round(b.t || 0)}s`); }
  const gws = res.filter(x => x.gw), rate = gws.filter(x => x.cleared).length / gws.length;
  ok(rate >= .5, `bot clears gateways at matching gear: ${Math.round(rate * 100)}% of ${gws.length} runs (>= 50%)`);
  ok(S.filter(r => !only || only.includes(r.id)).every(r => gws.some(x => x.gw === r.id && x.cleared)), 'every gateway cleared at least once at matching gear: ' + S.filter(r => (!only || only.includes(r.id)) && !gws.some(x => x.gw === r.id && x.cleared)).map(r => r.id).join());
  const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1); const gt = avg(gws.filter(x => x.cleared).map(x => x.t)), bt = avg(res.filter(x => x.base && x.cleared).map(x => x.t));
  ok(gt > bt * 1.2, `gateway runs take longer than their base dungeons (${Math.round(gt)}s vs ${Math.round(bt)}s avg)`);
  ok(gws.every(x => !x.error) && gws.filter(x => x.stuck).length <= 1, 'bot never errors and rarely gets stuck: ' + gws.filter(x => x.stuck).map(x => x.gw).join());
}
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
