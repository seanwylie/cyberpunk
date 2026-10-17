// Manufacturer factions (docs/FACTIONS.md): standing from rep + installed hardware, price/access, contract weighting, hunter squads.
import { createServer } from 'vite';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const vs = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' }); const L = (m) => vs.ssrLoadModule(m);
const F = await L('/src/factions.ts'), C = await L('/src/config.ts'), PC = await L('/src/pcontracts.ts'), DG = await L('/src/content/dungeons.ts');

const kit = (m, n) => { const out = []; const used = new Set(); for (const d of C.ITEMS) { if (out.length >= n) break; if (d.mfr !== m || d.id.startsWith('stock_') || used.has(d.slot)) continue; used.add(d.slot); out.push(d); } return out; };
const save = (parts, rep = { HI: 0, PS: 0, MM: 0 }, level = 20) => { const items = parts.map((d, i) => ({ uid: 'u' + i, def: d.id, chips: [] })); const installed = Object.fromEntries(parts.map((d, i) => [d.slot, 'u' + i]));
  return { level, items, installed, rep, credits: 0, humanity: 60, cleared: {}, lockouts: {}, world: { visited: {}, landmarks: {} } }; };
const fresh = save([]);
ok(F.MFRS.every(m => F.tier(fresh, m) === 'neutral'), 'fresh character is neutral with every house');
const hi6 = save(kit('HI', 6));
const S = F.standings(hi6);
ok(S.HI.tier === 'loyal' || S.HI.tier === 'trusted', 'six Heavy parts: Heavy likes you (' + S.HI.tier + ')');
ok(S.MM.tier === 'hostile', 'six Heavy parts: Mass Market (resents Heavy) is hostile (' + S.MM.tier + ')');
ok(S.PS.tier === 'neutral', 'Surgical does not care about Heavy parts');
ok(F.priceMulFor(hi6, 'HI') < 1 && F.priceMulFor(hi6, 'MM') > 1, 'prices: liked house cheaper, hostile house dearer');
ok(F.priceMulFor(fresh, 'PS') === 1, 'neutral price unchanged');
const blueMM = C.ITEMS.find(d => d.mfr === 'MM' && d.rarity === 'blue'), greenMM = C.ITEMS.find(d => d.mfr === 'MM' && d.rarity === 'green');
ok(F.shelfClosed(hi6, blueMM) && !F.shelfClosed(hi6, greenMM) && !F.shelfClosed(fresh, blueMM), 'hostile closes blue stock only; green stays (never stuck)');
ok(!F.shelfClosed(hi6, { id: 'stock_face', mfr: 'MM', rarity: 'blue' }), 'stock parts always sold');
const repped = save(kit('HI', 6), { HI: 0, PS: 0, MM: 60 });
ok(F.tier(repped, 'MM') !== 'hostile', 'earned reputation offsets resentment (' + F.tier(repped, 'MM') + ')');
// hunters
let n = 0, mm = 0; for (let sd = 1; sd <= 400; sd++) { const p = F.hunterPlan(hi6, sd); if (p) { n++; if (p.mfr === 'MM') mm++; ok(!C.ENEMIES[p.elite].boss && C.ENEMIES[p.elite].elite && p.crew.every(c => C.ENEMIES[c].mfr === p.mfr && !C.ENEMIES[c].elite), 'squad sane ' + sd) || 0; if (n > 3) break; } }
let cnt = 0; for (let sd = 1; sd <= 1000; sd++) if (F.hunterPlan(hi6, sd)) cnt++;
ok(cnt > 300 && cnt < 600, 'hostile: hunters in ~45% of runs (' + cnt + '/1000)');
ok(mm === n && n > 0, 'hunters come from the hostile house');
ok(![...Array(300).keys()].some(sd => F.hunterPlan(fresh, sd + 1)), 'neutral character: no hunters');
ok(![...Array(300).keys()].some(sd => F.hunterPlan(save(kit('HI', 6), undefined, 3), sd + 1)), 'no hunters below level 6');
ok(F.hunterPlan(hi6, 7, ['x'])?.elite === F.hunterPlan(hi6, 7, ['x'])?.elite, 'deterministic per seed');
// contracts
const all = Object.fromEntries(DG.DUNGEON_IDS.map(i => [i, 1]));
const cs = (s) => PC.candidates({ ...s, level: 25, cleared: all }, { caps: new Set(), now: Date.UTC(2026, 9, 12, 15) });
const hiC = cs(hi6); ok(hiC.some(c => c.mods.includes('patron')), 'Patron tag offered by the house you run');
ok(hiC.every(c => !PC.validateContract({ ...hi6, level: 25, cleared: all }, c, new Set(), Date.UTC(2026, 9, 12, 15)).length), 'all faction-weighted offers validate');
ok(hiC.filter(c => c.mods.includes('patron')).every(c => DG.DUNGEONS[c.tpl].mfr === 'HI'), 'Patron only on that house\u2019s sites');
ok(cs(fresh).every(c => !c.mods.includes('patron')), 'no Patron when neutral');
const strip = F.standingStrip(hi6, (x) => x.replace(/"/g, '&quot;'));
ok((strip.match(/class="repb facb/g) || []).length === 3 && /Hostile/.test(strip) && strip.length < 2000, 'compact strip: 3 chips with labels + tooltips');
const hm = /hextech|league|drug|narcotic/i; ok(!hm.test(strip + JSON.stringify(F.TIER_LABEL) + PC.MOD_LABEL.patron.tip), 'no banned terms');
await vs.close(); console.log(fails ? fails + ' FAIL' : 'ALL PASS'); process.exit(fails ? 1 : 0);
