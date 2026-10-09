// Enemy animation strip: windup -> strike (lunge) -> hit flash -> death collapse for one ordinary enemy and a boss, saved as a contact strip. Output: shots/dungeons_art/anim_*.png
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const out = 'shots/dungeons_art/'; fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => { const g = window.__game; g.save.level = 34; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun('foundry'); }); await sleep(800);
async function strip(type, name, frames) {
  await ev(([type]) => { const g = window.__game; for (const o of g.enemies) o.dead = true; g.px = 14; g.py = 39; const e = g.spawnEnemy(type, g.px + 2.2, g.py + .8); window.__e = e; e.alert = true; e.hp = e.maxHp = 1e7; }, [type]); await sleep(1800);
  const shots = []; for (let i = 0; i < frames; i++) { if (i === 8) await ev(() => { const g = window.__game, e = window.__e; e._rt.hit = .12; }); if (i === 10) await ev(() => { const g = window.__game; g.hurtEnemy(window.__e, 2e7, g.px, g.py, 0); }); shots.push(await page.screenshot({ clip: { x: 470, y: 240, width: 320, height: 240 } })); await sleep(i < 10 ? 110 : 90); }
  const { default: sharp } = await import('sharp').catch(() => ({ default: null })); return shots; }
const fs2 = await strip('slaghauler', 'a', 16);
fs2.forEach((b, i) => fs.writeFileSync(`/tmp/anim_${i}.png`, b));
console.log('errors', errors); await browser.close();
