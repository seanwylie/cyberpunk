// In-game animation previews for every dungeon enemy/boss: approach/idle/attack/hit then death collapse -> /tmp/gif_<id>/NN.png (assembled into docs/art/dungeons/anim/<id>.gif by tools/dungeons/make_gifs.py)
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const ids = (process.env.IDS || 'slaghauler,ladlecrew,cinderhound,slagcannon,brakeman,quenchpriest,teague,brannoch,ore9,orderly,nursebot,gurneyrunner,sentry,matron,anesthetist,surgeon,autosurgeon,recovered,picker,loader,forkbot,scanner,camgun,shiftlead,hobbs,stockmgr,retrieval,reclaimer').split(',');
const SIDE = process.env.SIDE || 'front'; const SG = SIDE === 'back' ? -1 : 1;
const BIG = new Set(['teague', 'brannoch', 'ore9', 'surgeon', 'autosurgeon', 'recovered', 'stockmgr', 'retrieval', 'reclaimer']);
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => { const g = window.__game; g.save.level = 34; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun('foundry'); }); await sleep(800);
for (const id of ids) {
  const dir = `/tmp/gif_${id}_${SIDE}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  await ev(([id, SG]) => { const g = window.__game; for (const o of g.enemies) { if (!o._parked) { o._parked = 1; o.x += 300; o.y += 300; o.alert = false; } } g.inst.flags.bossSpawned = true; g.inst.flags.bossRevealed = true; const B = g.level.bossSpawn; const SGN = SG; g.px = B.x + 3 * SGN; g.py = B.y + 3 * SGN; const e = g.spawnEnemy(id, B.x, B.y); window.__e = e; e.alert = true; e.hp = e.maxHp = 1e7; g.dbg.oneShot = false; e._parked = 1; window.__ui.closeAll?.(); }, [id, SG]); await sleep(1500);
  console.log(id, SIDE, 'away=', await ev(() => { const r = window.__rend, e = window.__e; return r.eart.st.get(e.id)?.away; }));
  const big = BIG.has(id); const W = big ? 460 : 300, H = big ? 400 : 280;
  for (let i = 0; i < 40; i++) {
    if (i === 20) await ev(() => { const e = window.__e; e._rt.hit = .12; });
    if (i === 25) await ev(() => { const g = window.__game; window.__e.hp = 0; window.__e.dead = true; });
    const p = await ev(() => { const r = window.__rend, e = window.__e; return [r.sx(e.x, e.y), r.sy(e.x, e.y)]; });
    const x = Math.max(0, Math.min(1280 - W, Math.round(p[0] - W / 2))), y = Math.max(0, Math.min(720 - H, Math.round(p[1] - H * .66)));
    await page.screenshot({ path: `${dir}/${String(i).padStart(2, '0')}.png`, clip: { x, y, width: W, height: H } }); await sleep(70);
  }
  await ev(() => { const g = window.__game; const e = window.__e; e.x += 300; e.y += 300; e.dead = true; });
}
console.log('errors', errors); await browser.close();
