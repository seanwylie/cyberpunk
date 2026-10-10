// Drop-volume report: node tools/balance/drops.mjs [--seeds 12] [--scale 1] [--out tools/balance/out/drops.json]
// For every dungeon: start a run at the dungeon's max level, kill every enemy (incl. boss) on a seeded RNG, and count what lands on the ground
// (items by rarity, chips, stims, credits). Needs a dev server (URL env, default http://localhost:5173/). See docs/BALANCE.md.
import fs from 'fs'; import { launch } from '../../tests/lib.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const SEEDS = +arg('seeds', 12), SCALE = arg('scale', null), OUT = arg('out', 'tools/balance/out/drops.json');
const { browser, page } = await launch({ query: '?splash=hold' });
const res = await page.evaluate(async ({ SEEDS, SCALE }) => {
  const g = window.__game; const [Cfg, Dun, St] = await Promise.all([import('/src/config.ts'), import('/src/content/dungeons.ts'), import('/src/state.ts')]);
  if (SCALE !== null && Cfg.DROP) Cfg.DROP.scale = +SCALE;
  const out = []; const real = Math.random;
  for (const d of Object.values(Dun.DUNGEONS)) { const rows = [];
    for (let s = 0; s < SEEDS; s++) {
      let rs = (s * 2654435761 + d.id.length * 977 + 17) >>> 0 || 1; Math.random = () => { rs += 0x6D2B79F5; let t = rs; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.cleared = {}; for (const k of Object.keys(Dun.DUNGEONS)) g.save.cleared[k] = 1; g.save.settings.devFreeReset = true; g.save.level = d.maxLevel;
      if (!g.startRun(d.id)) continue; let filtered = 0; const prevEmit = g.emit.bind(g); g.emit = (t, p) => { if (t === 'filtered') filtered++; return prevEmit(t, p); };
      const mobs = g.enemies.filter(e => e.faction === 'enemy' && !e.dead).length; for (const e of [...g.enemies]) if (e.faction === 'enemy' && !e.dead) g.killEnemy(e);
      g.emit = prevEmit; const dr = g.inst.drops; const byR = { grey: 0, green: 0, blue: 0, purple: 0, orange: 0 }; let items = 0, chips = 0, stims = 0, credits = 0;
      for (const x of dr) { if (x.kind === 'item') { items++; byR[Cfg.ITEM_BY_ID[x.inst.def].rarity]++; } else if (x.kind === 'chip') chips++; else if (x.kind === 'stim') stims++; else credits += x.amount; }
      rows.push({ mobs, items, chips, stims, credits, filtered, byR }); }
    const n = rows.length || 1, avg = k => rows.reduce((a, r) => a + r[k], 0) / n; const rar = {}; for (const k of ['grey', 'green', 'blue', 'purple', 'orange']) rar[k] = rows.reduce((a, r) => a + r.byR[k], 0) / n;
    out.push({ id: d.id, tier: d.tier || 0, mobs: avg('mobs'), items: avg('items'), chips: avg('chips'), stims: avg('stims'), credits: avg('credits'), total: avg('items') + avg('chips') + avg('stims'), sell: Object.entries(rar).reduce((a, [k, v]) => a + v * Cfg.SELL_VALUE[k], 0), rar }); }
  Math.random = real; return out; }, { SEEDS, SCALE });
fs.mkdirSync(OUT.replace(/[^/]*$/, ''), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
const f = x => x.toFixed(1); console.log('dungeon        tier  mobs  items chips stims  | total  credits  | sell-all value | items by rarity g/gr/b/p/o');
for (const r of res) console.log(r.id.padEnd(14), String(r.tier).padStart(3), f(r.mobs).padStart(6), f(r.items).padStart(6), f(r.chips).padStart(5), f(r.stims).padStart(5), ' |', f(r.total).padStart(6), String(Math.round(r.credits)).padStart(8), ' |', String(Math.round(r.credits + r.sell)).padStart(7), ' |', Object.values(r.rar).map(f).join('/'));
await browser.close();
