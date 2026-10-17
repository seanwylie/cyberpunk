// Frame sequences of Doom-style gib deaths (docs/GORE.md): a regular mob, an elite and a boss, Bloody, overkill. Writes shots/gibs/<name>_NN.png + strips.
import { launch, sleep } from '../tests/lib.mjs'; import fs from 'fs'; import { execSync } from 'child_process';
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a); fs.mkdirSync('shots/gibs', { recursive: true });
await sleep(1500);
await ev(() => { const g = window.__game; g.save.level = 34; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun('annex'); g.inst.flags.bossSpawned = true; g.enemies.splice(0); g.save.settings.gore = 'bloody'; }); await sleep(1200);
const runs = [['mob_worker_MM', 'worker', [0, 150, 300, 550, 1000, 2500]], ['mob_turret_HI', 'turret', [0, 150, 300, 550, 1000, 2500]], ['elite_sawhand_HI', 'sawhand', [0, 150, 300, 550, 1000, 2500]], ['boss_warden_PS', 'warden', [0, 400, 800, 1150, 1400, 1800, 2200, 3000]]];
for (const [name, id, times] of runs) {
  await ev(() => { const g = window.__game; g.enemies.splice(0); window.__gore.reset(); });
  const box = await ev(id => { const g = window.__game, R = window.__rend; const open = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (g.solidAt(x + dx, y + dy)) return false; return true; };
    if (!open(g.px + 1.5, g.py, 5)) { const L = g.level; outer: for (let y = 6; y < (L.h || 80) - 6; y++) for (let x = 6; x < (L.w || 80) - 6; x++) if (open(x + .5, y + .5, 5)) { g.px = x - 1; g.py = y + .5; break outer; } }
    const e = g.spawnEnemy(id, g.px + 2.5, g.py); e._rt.reveal = 0; e.alert = false; window.__e = e; return { x: R.sx(e.x, e.y), y: R.sy(e.x, e.y) }; }, id);
  await sleep(700);
  const t0 = Date.now(); await ev(() => { const g = window.__game, e = window.__e; g.curTag = 'pulse'; g.hurtEnemy(e, e.hp * 1.5, g.px, g.py, 0); g.curTag = 'auto'; });
  const W = name.startsWith('boss') ? 640 : 480, H = name.startsWith('boss') ? 440 : 340; const clip = { x: Math.max(0, Math.min(1280 - W, box.x - W / 2)), y: Math.max(0, Math.min(720 - H, box.y - H * .55)), width: W, height: H };
  for (let i = 0; i < times.length; i++) { const w = times[i] - (Date.now() - t0); if (w > 0) await sleep(w); await page.screenshot({ path: `shots/gibs/${name}_${String(i).padStart(2, '0')}.png`, clip }); }
  console.log(name, JSON.stringify(await ev(() => window.__gore.counts())));
}
console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'no page errors'); await browser.close();
execSync(`python3 - <<'PY'
from PIL import Image; import glob, os
for n in sorted({os.path.basename(p).rsplit('_',1)[0] for p in glob.glob('shots/gibs/*_[0-9][0-9].png')}):
    fr=[Image.open(p) for p in sorted(glob.glob(f'shots/gibs/{n}_[0-9][0-9].png'))]; w,h=fr[0].size; s=Image.new('RGB',(w*len(fr)//2,h//2))
    for i,f in enumerate(fr): s.paste(f.resize((w//2,h//2)),(i*w//2,0))
    s.save(f'shots/gibs/{n}_strip.png')
PY`);
