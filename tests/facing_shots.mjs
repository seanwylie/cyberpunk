// 8-direction preview: each enemy driven along E,SE,S,SW,W,NW,N,NE in game -> /tmp/facing/<id>_<dir>.png (tools/dungeons/facing_sheet.py assembles docs/art/dungeons/enemy_facing_8way.png)
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const ids = (process.env.IDS || 'worker,sawhand,overseer,cinderhound,teague,ore9').split(','); fs.mkdirSync('/tmp/facing', { recursive: true });
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a);
await sleep(1500); await ev(() => { const g = window.__game; g.save.level = 34; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun('annex'); }); await sleep(1000);
const names = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
for (const id of ids) {
  await ev(([id]) => { const g = window.__game; g.inst.flags.bossSpawned = true; const B = g.level.bossSpawn; for (const o of g.enemies) { if (!o._p) { o._p = 1; o.x += 400; o.y += 400; } } const e = g.spawnEnemy(id, B.x, B.y); e._p = 1; e.hp = e.maxHp = 1e8; e.alert = false; e.stunT = 1e9; e._rt.reveal = 0; window.__e = e; g.px = B.x; g.py = B.y + 7; }, [id]); await sleep(800);
  for (let d = 0; d < 8; d++) {
    await ev(([d]) => new Promise(res => { const e = window.__e, ea = window.__rend.eart; const V = [[1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]][d]; const n = Math.hypot(...V), cx = e.x, cy = e.y; let pos = 0, ok = 0, h = 0; const st = () => { pos += .02; e.x = cx + V[0] / n * pos; e.y = cy + V[1] / n * pos; const s = ea.st.get(e.id); ok = s && s.dir === d ? ok + 1 : 0; if (ok < 12 && ++h < 200) requestAnimationFrame(st); else res(); }; requestAnimationFrame(st); }), [d]);
    // stop moving; hold the facing; settle the cross-fade
    await sleep(350); const p = await ev(() => { const r = window.__rend, e = window.__e; return [r.sx(e.x, e.y), r.sy(e.x, e.y)]; });
    const W = 260, H = 260; const x = Math.max(0, Math.min(1280 - W, Math.round(p[0] - W / 2))), y = Math.max(0, Math.min(720 - H, Math.round(p[1] - H * .72)));
    await page.screenshot({ path: `/tmp/facing/${id}_${d}.png`, clip: { x, y, width: W, height: H } });
  }
}
console.log('errors', errors); await browser.close();
