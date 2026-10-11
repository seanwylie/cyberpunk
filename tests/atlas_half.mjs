// Low/Medium quality tiers load the half-res WebP enemy atlases (<anim>_h.webp); High loads the full-res ones. Both must draw (non-empty, correct frame cell).
import { launch, sleep } from './lib.mjs'; import fs from 'fs'; import { execSync } from 'child_process';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ids = JSON.parse(fs.readFileSync('public/dungeons/enemies3d/index.json', 'utf8'));
let missing = []; for (const id of ids) { const m = JSON.parse(fs.readFileSync(`public/dungeons/enemies3d/${id}.json`, 'utf8')); for (const a of Object.values(m.anims)) if (!fs.existsSync(`public/dungeons/enemies3d/${a.image.replace(/\.webp$/, '_h.webp')}`)) missing.push(a.image); }
ok(missing.length === 0, `every atlas sheet has a half-res _h.webp twin (missing ${missing.length} ${missing.slice(0, 3)})`);
const tracked = execSync('git ls-files public/dungeons/enemies3d').toString().split('\n'); ok(tracked.filter(f => f.endsWith('_h.webp')).length >= ids.length * 5, 'half-res sheets are git-tracked');
for (const q of ['high', 'medium', 'low']) {
  const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 }, query: '?q=' + q }); const ev = (f, a) => page.evaluate(f, a);
  await sleep(1500); await ev(() => { const g = window.__game; g.save.level = 20; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun('annex'); }); await sleep(1000);
  const r = await ev(async () => { const g = window.__game, B = g.level.bossSpawn; g.inst.flags.bossSpawned = true; g.enemies.splice(0); const e = g.spawnEnemy('picker', B.x - 2, B.y); e.hp = e.maxHp = 1e8; e.stunT = 1e9; g.px = B.x; g.py = B.y + 2;
    const rec = { src: '', w: 0, sw: 0, n: 0 }; const od = CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage = function (im, ...a) { if (im && im.src && im.src.includes('/enemies3d/picker_') && a.length === 8) { rec.src = im.src; rec.w = im.naturalWidth; rec.sw = a[3]; rec.n++; } return od.call(this, im, ...a); };
    await new Promise(r => setTimeout(r, 3500)); CanvasRenderingContext2D.prototype.drawImage = od; return rec; });
  const half = q !== 'high'; ok(r.n > 10, `${q}: atlas frames drawn (${r.n})`); ok(r.src.endsWith('_h.webp') === half, `${q}: loads ${half ? 'half' : 'full'}-res sheet (${r.src.split('/').pop()})`); ok(r.sw === (half ? 80 : 160), `${q}: source cell ${r.sw}px (want ${half ? 80 : 160})`);
  ok(errors.length === 0, `${q}: no page errors ${errors[0] || ''}`); await browser.close();
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
