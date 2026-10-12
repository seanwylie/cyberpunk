// Prestige loot economy (docs/LOOT_ECONOMY.md): seeded drop-rate stats vs targets, pity, season windows + retirement,
// target farming vs the catalog, no group exploit, old orange sources closed, and the beam / banner / loot log / announcement.
import fs from 'fs'; import { launch, sleep } from './lib.mjs'; import { runModel } from '../tools/balance/prestige_sim.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({}); // rendering on: the beam test reads the renderer
const cat = JSON.parse(fs.readFileSync('docs/catalog/augments.json', 'utf8'));

// ---- 1. unit-level: rates, pity, seasons, target farm, party
const U = await page.evaluate(async (cat) => {
  const [E, S, Cfg, Dun, A] = await Promise.all([import('/src/loot_eco.ts'), import('/src/seasons.ts'), import('/src/config.ts'), import('/src/content/dungeons.ts'), import('/src/content/appearance.ts')]);
  let rs = 12345; const rnd = () => { rs += 0x6D2B79F5; let t = rs; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const IN = Date.parse('2026-11-01T00:00:00Z'), BEFORE = Date.parse('2026-09-01T00:00:00Z'), AFTER = Date.parse('2027-02-01T00:00:00Z');
  const base = { tier: 'boss', dungeonTier: 2, level: 32, tierCap: 32, contributed: true, rnd };
  const o = {};
  { const N = 40000; let n = 0; for (let i = 0; i < N; i++) { const s = {}; if (E.rollPrestige(s, { ...base, now: AFTER })?.kind) n++; } o.rate = n / N; o.rateExp = E.LOOT_ECO.orange.boss * E.ctxMul(base); o.rateSd = Math.sqrt(o.rateExp * (1 - o.rateExp) / N); }
  o.mulT0 = E.ctxMul({ ...base, dungeonTier: 0 }); o.mulT4 = E.ctxMul({ ...base, dungeonTier: 4 }); o.mulGw = E.ctxMul({ ...base, gateway: true }); o.mulHard = E.ctxMul({ ...base, hard: true }); o.mulBase = E.ctxMul(base);
  { const s = {}; E.ecoOf(s).dry = E.LOOT_ECO.pity.hard - 1; const a = E.rollPrestige(s, { ...base, now: AFTER, rnd: () => .999999 }); o.pityForced = !!a && a.pity === true; o.pityReset = E.ecoOf(s).dry === 0;
    o.softZero = E.pityBonus(E.LOOT_ECO.pity.softStart); o.softMore = E.pityBonus(E.LOOT_ECO.pity.softStart + 100);
    const s2 = {}; E.rollPrestige(s2, { ...base, level: 5, tierCap: 5, now: AFTER, rnd: () => .99 }); o.noReachNoAdvance = E.ecoOf(s2).dry === 0;
    const s3 = {}; for (let i = 0; i < 10; i++) E.rollPrestige(s3, { ...base, now: AFTER, rnd: () => .99 }); o.dryAdv = E.ecoOf(s3).dry; }
  { const cnt = (now) => { let n = 0; for (let i = 0; i < 30000; i++) { const s = { cosmetics: { owned: {} } }; const a = E.rollPrestige(s, { ...base, now }); if (a && a.kind === 'seasonal') n++; } return n; };
    o.seasBefore = cnt(BEFORE); o.seasIn = cnt(IN); o.seasAfter = cnt(AFTER);
    const ids = S.SEASONS.flatMap(x => [...x.gear, ...x.cosmetics]); o.retiredAfter = ids.every(id => S.isRetired(id, AFTER) && !S.canGrant(id, AFTER)); o.liveIn = ids.every(id => !S.isRetired(id, IN) && S.canGrant(id, IN)); o.notBefore = ids.every(id => !S.canGrant(id, BEFORE));
    o.prov = S.provenanceLabel('s1_bloom_veil', AFTER) + ' | ' + S.provenanceLabel('s1_bloom_veil', IN);
    let leak = 0; for (let i = 0; i < 2000; i++) { const s = { cosmetics: { owned: {} } }; E.ecoOf(s).dry = 999; const a = E.rollPrestige(s, { ...base, now: AFTER }); if (a && (a.season || (a.item && S.SEASON_OF[a.item]))) leak++; } o.retiredLeak = leak;
    let gen = 0; for (let i = 0; i < 60000; i++) { const s = { cosmetics: { owned: {} } }; const r = A.rollCosmetic(s, 'boss', null, 4, rnd); if (r?.def && S.SEASON_OF[r.def.id]) gen++; } o.cosGeneric = gen; }
  { const tables = []; for (const d of Object.values(Dun.DUNGEONS)) { const t = d.id === 'annex' ? Cfg.LOOT.signature : d.signature; for (const [b, v] of Object.entries(t || {})) tables.push({ d: d.id, b, item: v.item, cap: d.tierCap, tier: d.tier || 0 }); }
    const catSig = cat.augments.flatMap(a => a.sources.filter(s => s.kind === 'signature').map(s => ({ d: s.dungeon, b: s.bossId, item: a.id })));
    o.catMatch = tables.length === catSig.length && tables.every(t => catSig.some(c => c.d === t.d && c.b === t.b && c.item === t.item)); o.sigCount = tables.length;
    o.share = {}; for (const t of tables) { const lvl = Cfg.ITEM_BY_ID[t.item].lvl; let hit = 0, tot = 0; for (let i = 0; i < 4000; i++) { const s = {}; E.ecoOf(s).dry = 999; const a = E.rollPrestige(s, { ...base, level: Math.max(lvl, 32), tierCap: Math.max(lvl, t.cap), dungeonTier: t.tier, bossSig: [t.item], now: AFTER }); if (a?.kind === 'orange') { tot++; if (a.item === t.item) hit++; } } o.share[t.item] = hit / Math.max(1, tot); }
    const sigIds = new Set(tables.map(t => t.item)); o.genHasSig = E.generalOranges(new Set(Cfg.ITEMS.filter(x => x.id.startsWith('sig_')).map(x => x.id))).filter(id => sigIds.has(id));
    let stray = 0; for (let i = 0; i < 5000; i++) { const s = {}; E.ecoOf(s).dry = 999; const a = E.rollPrestige(s, { ...base, level: 50, tierCap: 50, now: AFTER }); if (a?.item && sigIds.has(a.item)) stray++; } o.sigStray = stray;
    o.catOrangeTableDrops = cat.augments.filter(a => a.rarity === 'orange').flatMap(a => a.sources.filter(s => s.kind === 'drop' || s.kind === 'ability_drop').map(() => a.id));
    o.orangeNoPrestigeSrc = cat.augments.filter(a => a.rarity === 'orange' && !a.id.startsWith('idkfa_') && !a.sources.some(s => ['signature', 'prestige', 'seasonal'].includes(s.kind))).map(a => a.id); }
  { const s = {}; const a = E.rollPrestige(s, { ...base, contributed: false, now: AFTER, rnd: () => 0 }); o.leech = a === null && E.ecoOf(s).dry === 0 && E.ecoOf(s).kills === 0; o.party = [1, 2, 3, 4, 5].map(E.partyMul); }
  { const s = {}; const e = E.ecoOf(s); const only = 'sig_governor_core'; e.seen[only] = 1; for (const id of E.generalOranges(new Set(Cfg.ITEMS.filter(x => x.id.startsWith('sig_')).map(x => x.id)))) e.seen[id] = 1; e.dry = 999; const a = E.rollPrestige(s, { ...base, level: 28, tierCap: 28, bossSig: [only], now: AFTER, rnd: () => .0 });
    o.dupe = a; e.shards = 6; o.redeemSeasonal = E.redeemShards(s, 's1_bloom_veil').ok; o.redeemFound = E.redeemShards(s, only).ok; o.shardsLeft = e.shards; }
  return o; }, cat);
ok(Math.abs(U.rate - U.rateExp) < 4 * U.rateSd, `boss legendary rate ${U.rate.toFixed(4)} ~ target ${U.rateExp.toFixed(4)} (±4σ ${(4 * U.rateSd).toFixed(4)})`);
ok(U.mulT4 > U.mulBase && U.mulBase > U.mulT0 && U.mulGw > U.mulBase && U.mulHard > U.mulBase, `harder content farms better: tier0 ${U.mulT0} < base ${U.mulBase} < tier4 ${U.mulT4}; gateway ${U.mulGw}; hard ${U.mulHard}`);
ok(U.pityForced && U.pityReset, 'hard pity guarantees the next eligible kill and resets the counter');
ok(U.softZero === 0 && U.softMore > 0, `soft pity: 0 at softStart, ${U.softMore.toFixed(3)} 100 kills later`);
ok(U.noReachNoAdvance && U.dryAdv === 10, 'pity only advances where a legendary is reachable (' + U.dryAdv + ' after 10 dry boss kills)');
ok(U.seasBefore === 0 && U.seasIn > 0 && U.seasAfter === 0, `seasonal drops only inside the window: before ${U.seasBefore}, during ${U.seasIn}, after ${U.seasAfter}`);
ok(U.retiredAfter && U.liveIn && U.notBefore && U.retiredLeak === 0, 'retired season ids can never be granted again, even by forced pity (leaks ' + U.retiredLeak + ')');
ok(U.prov === 'Season 1 · Retired | Season 1 · Limited', 'provenance label: ' + U.prov);
ok(U.cosGeneric === 0, 'season cosmetics never come from the generic cosmetic roll');
ok(U.catMatch && U.sigCount >= 8, `catalog signature sources match the dungeon tables the roll uses (${U.sigCount})`);
ok(Object.values(U.share).every(v => v > .65 && v <= 1), 'target farm: each signature boss gives its own item most of the time ' + JSON.stringify(U.share));
ok(!U.genHasSig.length && U.sigStray === 0, 'signature items never drop from other bosses');
ok(!U.catOrangeTableDrops.length && !U.orangeNoPrestigeSrc.length, 'catalog: no orange from loot tables, every orange has a prestige/signature/seasonal source ' + JSON.stringify([U.catOrangeTableDrops, U.orangeNoPrestigeSrc]));
ok(U.leech, 'no credit (and no pity progress) for party members who did not take part');
ok(U.party.every((v, i) => i === 0 || v <= U.party[i - 1]) && U.party[3] < 1, 'per-member chance shrinks with party size ' + JSON.stringify(U.party));
ok(U.dupe?.kind === 'shard' && !U.redeemSeasonal && U.redeemFound && U.shardsLeft === 0, 'duplicates become Prism Shards; shards rebuild found oranges, never season exclusives');

const M = { in: await runModel(page, { players: 120, levels: [30, 42], seed: 11, season: true }), off: await runModel(page, { players: 120, levels: [30, 42], seed: 13, season: false }), duo: await runModel(page, { players: 120, levels: [42], seed: 17, season: false, partySize: 4 }) };
for (const r of M.in) ok(r.firstMean >= 13 && r.firstMean <= 27 && r.seasonalMean >= 18 && r.seasonalMean <= 27, `in season L${r.level}: first orange ${r.firstMean.toFixed(1)} h, first seasonal ${r.seasonalMean.toFixed(1)} h (targets 15-25 / 20-25, tol 13-27 / 18-27)`);
for (const r of M.off) ok(r.firstMean >= 11 && r.firstMean <= 25 && r.firstP90 < 40, `off season L${r.level}: first orange ${r.firstMean.toFixed(1)} h, p90 ${r.firstP90.toFixed(1)} h (pity caps the bad-luck tail)`);
ok(M.duo[0].orangePerHour <= M.off.find(r => r.level === 42).orangePerHour * 1.02, `4-player party member earns no more legendaries per hour than solo (${M.duo[0].orangePerHour.toFixed(3)} vs ${M.off.find(r => r.level === 42).orangePerHour.toFixed(3)})`);

const G = await page.evaluate(async () => {
  const g = window.__game, Cfg = await import('/src/config.ts'), E = await import('/src/loot_eco.ts'); const o = {}; const toasts = []; const em = g.emit; g.emit = (t, p) => { if (t === 'toast') toasts.push(String(p)); return em(t, p); };
  const fresh = (id, lvl) => { g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.cleared = {}; for (const k of ['annex', 'foundry', 'clinic', 'warehouse']) g.save.cleared[k] = 1; g.save.settings.devFreeReset = true; g.save.level = lvl; g.save.rep = { HI: 99999, PS: 99999, MM: 99999 }; return g.startRun(id); };
  let orange = 0, bosses = 0; for (const id of ['foundry', 'clinic']) { fresh(id, 34); const bossIds = Object.keys(Cfg.ENEMIES).filter(k => Cfg.ENEMIES[k].boss); g.contributed = false; for (let i = 0; i < 300; i++) { const n0 = g.inst.drops.length; g.rollLoot({ type: bossIds[i % bossIds.length], x: g.px, y: g.py, affix: [] }); bosses++; orange += g.inst.drops.slice(n0).filter(d => d.kind === 'item' && Cfg.ITEM_BY_ID[d.inst.def].rarity === 'orange').length; } g.contributed = true; }
  o.tableOrange = orange; o.bosses = bosses;
  g.save.lootEco = undefined; fresh('foundry', 30); const ev = []; window.addEventListener('wv-prestige', e => ev.push(e.detail)); E.ecoOf(g.save).dry = 9999;
  const f = g.inst.flags; f.controller = true; f.bossKey = 'brannoch'; g.spawnBoss(); const boss = g.enemies.find(e => Cfg.ENEMIES[e.type].boss && !e.dead); const n0 = g.inst.drops.length; g.killEnemy(boss);
  // season is live, so forced pity can pick a season exclusive; re-roll the same boss until a first ORANGE lands to check the fixer line
  for (let k = 0; k < 40 && !g.inst.drops.slice(n0).some(d => d.prestige === 'orange'); k++) { g.save.lootEco = undefined; E.ecoOf(g.save).dry = 9999; g.rollPrestigeDrop(boss, 'boss'); }
  const pd = g.inst.drops.slice(n0).find(d => d.prestige); o.prestigeDrop = pd ? { p: pd.prestige, def: pd.inst.def } : null; if (pd) { g.px = pd.x + 3; g.py = pd.y + 3; }
  o.ev = ev.length; o.evFirst = ev.filter(x => x.first).length; o.first = toasts.some(t => t.startsWith('Odalys:')); o.log = E.ecoOf(g.save).log.filter(l => l.kind === 'orange' || l.kind === 'seasonal').length;
  return o; });
// camera eases toward the player after the teleport: poll for the beam instead of a fixed wait
for (let i = 0; i < 20 && !(await page.evaluate(() => window.__rend.lastBeams >= 1)); i++) await sleep(200);
await sleep(300);
const V = await page.evaluate(() => ({ beams: window.__rend.lastBeams, banner: document.getElementById('prestigebanner')?.className || '', bannerText: document.getElementById('prestigebanner')?.textContent || '' }));
ok(G.tableOrange === 0, `regular loot tables give no oranges (${G.bosses} boss loot rolls)`);
ok(!!G.prestigeDrop, 'forced pity on a real boss kill drops a prestige item ' + JSON.stringify(G.prestigeDrop));
ok(V.beams >= 1, 'drop beam is drawn for the prestige drop (' + V.beams + ')');
ok(/on/.test(V.banner) && V.bannerText.length > 5, 'legendary banner shows: ' + V.bannerText);
ok(G.ev >= 1 && G.evFirst >= 1, 'announcement event fires for each legendary (party/town chat hook, rate-limited in net/index.ts)');
ok(G.first, 'first-orange fixer line');
ok(G.log >= 1, 'loot log records it');
await page.evaluate(() => { window.__ui.open('lootlog'); }); await sleep(200);
const LL = await page.evaluate(() => ({ rows: document.querySelectorAll('.lootlog .llrow').length, head: document.querySelector('.lootlog .llhead')?.textContent || '' }));
ok(LL.rows >= 1 && /Prism Shards/.test(LL.head), 'Loot log window lists finds and shards (' + LL.rows + ' rows)');
ok(!errors.length, 'no page errors ' + errors.join('|'));
await browser.close(); process.exit(fails ? 1 : 0);
