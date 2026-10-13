// Screenshots of every boss mechanic telegraph (warn + live) into shots/bosses/. Usage: URL=http://127.0.0.1:5391/ node tools/shots/boss_shots.mjs [mech ...]
import { launch } from '../../tests/lib.mjs'; import fs from 'fs';
const MECH = ['beam','grid','scythe','vortex','conveyor','ricochet','pylons','safe','gaze','tiles','bombs','strike','overload','buffers','shockring','shield'];
const only = process.argv.slice(2); const list = only.length ? only : MECH;
const { browser, page, errors } = await launch({ query: '?splash=hold', viewport: { width: 1280, height: 720 } });
fs.mkdirSync('shots/bosses', { recursive: true });
await page.evaluate(async () => {
  document.getElementById('splash')?.remove(); const g = window.__game; g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.startRun('coke_ovens');
  const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; f.bossKey = 'voss'; const rp = g.revealPoint(); g.px = rp.x; g.py = rp.y; g.dbg.god = true; for (let i = 0; i < 30 * 12; i++) g.update(1 / 30);
  window.__kits = await import('/src/content/boss_kits.ts'); });
for (const m of list) {
  const info = await page.evaluate(async (m) => { const g = window.__game, K = window.__kits; const e = g.enemies.find(x => !x.dead && x.type === 'voss'); if (!e) return { err: 'no boss' };
    g.zones = g.zones.filter(z => z.env); g.fx = []; e.hp = e.maxHp * .5; e.stunT = 1e4; e._rt.shield = null; e._rt.st = 'idle'; const dur = K.castMech(g, e, m); const zs = g.zones.filter(z => z.kit);
    const ar = (await import('/src/content/mechanics.ts')).arenaOf(g); g.px = ar.cx + 3; g.py = ar.cy + 2; e.x = ar.cx - 3; e.y = ar.cy - 2; e._rt.st = 'idle'; for (const z of zs) { if (z.follow) { z.x = e.x; z.y = e.y; } }
    return { dur, n: zs.length, w: Math.max(...zs.map(z => z.windup)) }; }, m);
  if (!info.err && info.dur != null && info.n === 0) { // pylons / buff nodes: no ground zone at cast time, wait for the first snipe / show the tethers
    await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 30 * 3.7; i++) { g.hp = g.maxHp; g.update(1 / 30); } window.__rend.draw(1 / 30); window.__rend.draw(1 / 30); }); await page.screenshot({ path: `shots/bosses/${m}_warn.png` });
    await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 30 * 1.5; i++) { g.hp = g.maxHp; g.update(1 / 30); } window.__rend.draw(1 / 30); }); await page.screenshot({ path: `shots/bosses/${m}_live.png` });
    console.log('shot', m, JSON.stringify(info)); await page.evaluate(() => { const g = window.__game; g.zones = g.zones.filter(z => z.env); g.enemies = g.enemies.filter(e => !e.kitBuf && !e.pylon); }); continue; }
  if (info.err || info.dur == null) { console.log(m, 'skipped', JSON.stringify(info)); continue; }
  // warn frame at ~65% of the first windup, live frame just after it
  const adv = async (t) => page.evaluate(async (t) => { const g = window.__game; g.hp = g.maxHp; const rend = window.__rend; for (let i = 0; i < Math.round(t * 30); i++) { g.hp = g.maxHp; g.update(1 / 30); } rend.draw(1 / 30); rend.draw(1 / 30); }, t);
  const w1 = await page.evaluate(() => Math.min(...window.__game.zones.filter(z => z.kit).map(z => z.windup)));
  await adv(Math.max(.2, w1 * .7)); await page.screenshot({ path: `shots/bosses/${m}_warn.png` });
  await adv(w1 * .3 + .25); await page.screenshot({ path: `shots/bosses/${m}_live.png` });
  console.log('shot', m, JSON.stringify(info));
  await page.evaluate(() => { const g = window.__game; g.zones = g.zones.filter(z => z.env); g.enemies = g.enemies.filter(e => !e.kitBuf && !e.pylon); });
}
console.log('errors', errors.slice(0, 3)); await browser.close();
