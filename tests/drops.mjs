// Drop volume: DROP_RATE_SCALE cuts ground loot to roughly half; elites/bosses still drop; typical Annex run stays in a sane range. See docs/BALANCE.md.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const R = await page.evaluate(async () => {
  const g = window.__game, Cfg = await import('/src/config.ts'), real = Math.random; const out = { scale: Cfg.DROP_RATE_SCALE, runs: {} };
  const run = (scale, id, seed) => { Cfg.DROP.scale = scale; let rs = (seed * 2654435761) >>> 0 || 1; Math.random = () => { rs += 0x6D2B79F5; let t = rs; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.settings.devFreeReset = true; g.save.level = 20; if (!g.startRun(id)) return null;
    const bossN = []; for (const e of [...g.enemies]) if (e.faction === 'enemy' && !e.dead) { const n0 = g.inst.drops.length; g.killEnemy(e); if (Cfg.ENEMIES[e.type].boss) bossN.push(g.inst.drops.filter(d => d.kind !== 'credits').length); }
    const d = g.inst.drops; return { gear: d.filter(x => x.kind !== 'credits').length, piles: d.length, credits: d.filter(x => x.kind === 'credits').reduce((a, x) => a + x.amount, 0), orange: d.filter(x => x.kind === 'item' && Cfg.ITEM_BY_ID[x.inst.def].rarity === 'orange').length }; };
  for (const [k, sc] of [['before', 1], ['after', Cfg.DROP_RATE_SCALE]]) { const rows = []; for (let s = 0; s < 20; s++) rows.push(run(sc, 'annex', s + 5)); out.runs[k] = { gear: rows.reduce((a, r) => a + r.gear, 0) / 20, piles: rows.reduce((a, r) => a + r.piles, 0) / 20, credits: rows.reduce((a, r) => a + r.credits, 0) / 20, min: Math.min(...rows.map(r => r.gear)), max: Math.max(...rows.map(r => r.gear)) }; }
  // every boss kill still yields >= 2 gear drops (guaranteed rolls), every elite >= 1
  Cfg.DROP.scale = Cfg.DROP_RATE_SCALE; let bossMin = 99, eliteMin = 99;
  g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.settings.devFreeReset = true; g.save.level = 30; g.startRun('annex'); const ids = Object.keys(Cfg.ENEMIES); const bossId = ids.find(i => Cfg.ENEMIES[i].boss), eliteId = ids.find(i => Cfg.ENEMIES[i].elite && !Cfg.ENEMIES[i].boss); out.eliteMin = 99;
  for (let s = 0; s < 80; s++) { let n0 = g.inst.drops.length; g.rollLoot({ type: bossId, x: g.px, y: g.py, affix: [] }); bossMin = Math.min(bossMin, g.inst.drops.slice(n0).filter(d => d.kind !== 'credits').length); n0 = g.inst.drops.length; g.rollLoot({ type: eliteId, x: g.px, y: g.py, affix: [] }); out.eliteMin = Math.min(out.eliteMin, g.inst.drops.slice(n0).filter(d => d.kind !== 'credits').length); }
  out.bossMin = bossMin; Math.random = real; Cfg.DROP.scale = Cfg.DROP_RATE_SCALE; return out; });
const b = R.runs.before, a = R.runs.after; console.log(JSON.stringify(R));
ok(R.scale > 0 && R.scale < 0.6, 'DROP_RATE_SCALE knob exists and is a real cut: ' + R.scale);
ok(a.gear / b.gear >= 0.3 && a.gear / b.gear <= 0.55, `annex gear drops per run ${b.gear.toFixed(1)} -> ${a.gear.toFixed(1)} (ratio ${(a.gear / b.gear).toFixed(2)} within 0.30-0.55)`);
ok(a.gear >= 4 && a.max <= 14, 'annex run: ' + a.gear.toFixed(1) + ' drops avg, max ' + a.max + ' (not dozens)');
ok(a.piles < b.piles * 0.6, `ground piles incl. credits ${b.piles.toFixed(1)} -> ${a.piles.toFixed(1)}`);
ok(a.credits >= b.credits * 0.5, `credit income kept meaningful: ${b.credits.toFixed(0)} -> ${a.credits.toFixed(0)}`);
ok(R.eliteMin >= 1, 'elite always drops >= 1 gear item/chip: min ' + R.eliteMin);
ok(R.bossMin >= 2 && R.bossMin < 99, 'boss always drops >= 2 gear items/chips: min ' + R.bossMin);
ok(!errors.length, 'no page errors ' + errors.join('|'));
await browser.close(); process.exit(fails ? 1 : 0);
