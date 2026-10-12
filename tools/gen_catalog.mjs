// Augment catalog generator: everything here is derived from the REAL game data modules (nothing hand-written).
//   npm run catalog            -> writes docs/catalog/augments.json, docs/CATALOG.md, docs/catalog/index.html
//   node tools/gen_catalog.mjs --check   -> exit 1 if the committed files are stale (used by tests/catalog.mjs)
// Output is deterministic (sorted, no timestamps) so freshness can be checked by diff.
import { createServer } from 'vite'; import fs from 'node:fs';
const CHECK = process.argv.includes('--check');
const vs = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const L = (m) => vs.ssrLoadModule(m);
const C = await L('/src/config.ts'), D = await L('/src/content/dungeons.ts'), HW = await L('/src/abilities/hw.ts'), REG = await L('/src/abilities/registry.ts');
const IDK = await L('/src/content/idkfa.ts');
const VFX = await L('/src/abilities/vfxprofile.ts'), SFX = await L('/src/abilities/sfxprofile.ts'), V = await L('/src/vendor.ts');
const r2 = (x) => Math.round(x * 1000) / 1000;
const bossName = (id) => C.ENEMIES[id]?.name || id;

// ---- sources: dungeon loot pools by tier, signature drops, ability-augment conversion, vendor, starting gear
const src = {}; const addSrc = (id, s) => { (src[id] = src[id] || []).push(s); };
for (const id of D.DUNGEON_IDS) { const d = D.DUNGEONS[id]; const bosses = [...new Set([d.boss || d.defaultBoss, ...(d.conds || []).map(c => c.boss)].filter(Boolean))];
  for (const tier of ['ordinary', 'elite', 'boss']) { const pool = d.loot ? d.loot[tier] : C.LOOT[tier].pool; const tot = pool.reduce((a, e) => a + e.w, 0);
    for (const e of pool) if (e.item) addSrc(e.item, { kind: 'drop', dungeon: id, dungeonName: d.name, dungeonTier: d.tier || 0, levels: [d.minLevel, d.maxLevel], tier, share: r2(e.w / tot), ...(tier === 'boss' ? { bosses: bosses.map(bossName) } : {}) }); }
  const sig = id === 'annex' ? C.LOOT.signature : d.signature; for (const [b, s] of Object.entries(sig || {})) addSrc(s.item, { kind: 'signature', dungeon: id, dungeonName: d.name, boss: bossName(b), chance: s.chance }); }
const ACQ = HW.ABILITY_ACQ;
for (const it of HW.ABILITY_ITEMS) { const tiers = ['ordinary', 'elite', 'boss'].filter(t => (ACQ.weights[t][it.rarity] || 0) > 0 && !(it.rarity === 'orange' && ACQ.orangeBossOnly && t !== 'boss'));
  addSrc(it.id, { kind: 'ability_drop', tiers, minLevel: it.lvl, repRank: ACQ.rankGate[it.rarity], note: 'any dungeon whose level cap >= ' + it.lvl }); }
for (const it of IDK.IDKFA_ITEMS) addSrc(it.id, { kind: 'dev_cheat', note: 'IDKFA dev set only (src/content/idkfa.ts), never drops' });
for (const it of C.ITEMS) { if (it.id.startsWith('stock_')) { addSrc(it.id, { kind: 'starting_gear' }); continue; }
  const towns = [['rustline', V.VENDOR_BUY], ['harrow', V.VENDOR_BUY_HARROW]].filter(([, b]) => b[it.rarity] !== undefined).map(([t, b]) => ({ town: t, price: b[it.rarity] }));
  if (towns.length) addSrc(it.id, { kind: 'store', minLevel: it.lvl, towns }); }

// ---- abilities
const abSource = {}; for (const it of C.ITEMS) for (const a of it.abilities || []) (abSource[a] = abSource[a] || []).push(it.id);
const DATA = REG.ABILITY_BY_ID; const tags = (a) => ({ gives: a?.gives || [], uses: a?.uses || [] });
function ability(id) { const L0 = C.ABILITIES[id], d = DATA[id]; const vfx = VFX.PROFILES[id], sfx = SFX.sfxOf(id);
  const effect = d ? REG.describe(d) : (L0?.desc || '');
  return { id, name: d?.name || L0?.name || id, role: d?.role || null, type: d?.type || L0?.type || null, rarity: d?.rarity || L0?.rarity || null, maker: d?.mfr || null, slots: d?.slots || null,
    cooldown: d?.cd ?? L0?.cd ?? null, heat: d?.heat ?? L0?.heat ?? null, range: d?.range ?? L0?.range ?? null, scale: d?.scale || null, effect, ...tags(d),
    vfx: vfx ? { elem: vfx.elem, signature: vfx.signature, power: r2(vfx.power) } : null, sfx: sfx ? { family: sfx.family, layers: sfx.layers } : null,
    chipsAffecting: d ? HW.chipsFor(d).sort() : [], grantedBy: (abSource[id] || []).sort() }; }
const abilities = Object.fromEntries([...new Set([...Object.keys(C.ABILITIES), ...Object.keys(DATA)])].sort().map(id => [id, ability(id)]));
// synergies: an ability that applies a tag another one exploits
const synergy = {}; for (const a of Object.values(abilities)) { synergy[a.id] = Object.values(abilities).filter(b => b.id !== a.id && a.gives.some(t => b.uses.includes(t))).map(b => b.id).sort(); }
for (const a of Object.values(abilities)) a.combosInto = synergy[a.id];

// ---- chips
const chips = Object.fromEntries(Object.keys(C.CHIPS).sort().map(id => { const c = C.CHIPS[id]; const fits = C.CHIP_FITS[id] || [];
  return [id, { id, name: c.name, rarity: c.rarity, desc: c.desc, stats: c.stats, mod: c.mod || null, abilityMods: HW.CHIP_AB_MODS[id] || {}, fits, slots: C.SLOTS.filter(s => C.chipFits(id, s)) }]; }));

// ---- augments
const conflicts = C.HARD_CONFLICTS;
const augments = [...C.ITEMS].sort((a, b) => a.slot.localeCompare(b.slot) || a.id.localeCompare(b.id)).map(it => {
  const sockets = C.SLOT_SOCKETS[it.slot]; const fitChips = Object.keys(chips).filter(c => C.chipFits(c, it.slot));
  return { id: it.id, name: it.name, slot: it.slot, slotLabel: C.SLOT_LABEL[it.slot], group: C.SLOT_GROUP[it.slot], maker: it.mfr, makerName: C.MFR[it.mfr].name, rarity: it.rarity, level: it.lvl,
    stats: it.stats, statRolls: 'fixed (no random rolls)', weapon: it.weapon ? { kind: it.weapon, ...C.WEAPONS[it.weapon], rarityMul: C.WEAPON_RARITY_MUL[it.rarity] } : null, caps: it.caps || [],
    abilities: (it.abilities || []).map(a => ({ id: a, name: abilities[a]?.name, effect: abilities[a]?.effect, cooldown: abilities[a]?.cooldown, vfx: abilities[a]?.vfx?.elem || null, sfx: abilities[a]?.sfx?.family || null })),
    sockets, chips: fitChips.map(c => ({ id: c, name: chips[c].name, stats: chips[c].stats, abilityMods: chips[c].abilityMods, affects: (it.abilities || []).filter(a => abilities[a]?.chipsAffecting.includes(c)) })),
    conflicts: conflicts.filter(x => x.a === it.id || x.b === it.id).map(x => ({ with: x.a === it.id ? x.b : x.a, reason: x.reason })),
    makerSet: it.id.startsWith('stock_') ? 'stock (neutral)' : `mixing makers costs ${C.MIX_PENALTY.coolingPerExtraMfr * 100}% cooling per extra maker (-${C.MIX_PENALTY.reputationRankReduces * 100}% per rep rank)`,
    synergies: [...new Set((it.abilities || []).flatMap(a => synergy[a] || []))].sort(),
    sources: src[it.id] || [], blurb: it.blurb || '' }; });

// ---- gaps
const gaps = { augmentNoSource: augments.filter(a => !a.sources.length).map(a => a.id),
  abilityNoEffect: Object.values(abilities).filter(a => a.grantedBy.length && (!a.effect || !a.vfx || /^Generic/.test(a.vfx.signature || ''))).map(a => a.id),
  abilityNotGranted: Object.values(abilities).filter(a => !a.grantedBy.length).map(a => a.id),
  chipFitsNothing: Object.values(chips).filter(c => !c.slots.length || !augments.some(a => a.chips.some(x => x.id === c.id) && a.sockets > 0)).map(c => c.id) };
const stats = { augments: augments.length, abilityAugments: augments.filter(a => a.abilities.length).length, abilities: Object.keys(abilities).length, chips: Object.keys(chips).length, dungeons: D.DUNGEON_IDS.length,
  bySlot: Object.fromEntries(C.SLOTS.map(s => [s, augments.filter(a => a.slot === s).length])), byRarity: Object.fromEntries(['grey', 'green', 'blue', 'purple', 'orange'].map(r => [r, augments.filter(a => a.rarity === r).length])),
  gaps: Object.fromEntries(Object.entries(gaps).map(([k, v]) => [k, v.length])) };
const json = JSON.stringify({ version: 1, generatedBy: 'tools/gen_catalog.mjs', stats, gaps, augments, abilities, chips, conflicts, mixPenalty: C.MIX_PENALTY, vendor: { rustline: V.VENDOR_BUY, harrow: V.VENDOR_BUY_HARROW } }, null, 1) + '\n';

// ---- markdown
const fmtStats = (s) => Object.entries(s || {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${r2(v)}`).join(', ') || 'none';
const fmtSrc = (s) => s.kind === 'drop' ? `${s.dungeonName} ${s.tier}${s.bosses ? ' (' + s.bosses.join(' / ') + ')' : ''} ${Math.round(s.share * 100)}%` : s.kind === 'signature' ? `${s.boss} signature ${Math.round(s.chance * 100)}%` : s.kind === 'ability_drop' ? `ability drop (${s.tiers.join('/')}, Lv ${s.minLevel}+${s.repRank ? ', rep rank ' + s.repRank : ''})` : s.kind === 'store' ? `store ${s.towns.map(t => t.town + ' ' + t.price + 'c').join(', ')}` : s.kind === 'dev_cheat' ? 'dev cheat only' : 'starting gear';
let md = `# Augment catalog\n\nGenerated by \`tools/gen_catalog.mjs\` from game data. Do not edit by hand: run \`npm run catalog\`. Machine-readable: [catalog/augments.json](catalog/augments.json), browsable: [catalog/index.html](catalog/index.html).\n\n`;
md += `**${stats.augments} augments** (${stats.abilityAugments} with abilities), **${stats.abilities} abilities**, **${stats.chips} chips**, ${stats.dungeons} dungeons.\n\n`;
md += `## Data gaps\n\n` + Object.entries(gaps).map(([k, v]) => `- **${k}** (${v.length}): ${v.length ? v.map(x => '`' + x + '`').join(', ') : 'none'}`).join('\n') + '\n\n';
md += `## Rules\n\n- Stats are fixed per augment (no random rolls). Weapons scale by rarity: ${Object.entries(C.WEAPON_RARITY_MUL).map(([k, v]) => k + ' x' + v).join(', ')}.\n- Maker sets: ${augments[0] ? augments.find(a => !a.id.startsWith('stock_')).makerSet : ''}.\n- Hard conflicts: ${conflicts.map(c => `\`${c.a}\` + \`${c.b}\` (${c.reason})`).join('; ') || 'none'}.\n\n`;
md += `## Chips\n\n| Chip | Rarity | Fits | Stats | Ability mods |\n|---|---|---|---|---|\n` + Object.values(chips).map(c => `| ${c.name} | ${c.rarity} | ${c.fits.join(', ')} | ${fmtStats(c.stats)} | ${fmtStats(c.abilityMods)} |`).join('\n') + '\n\n';
for (const sl of C.SLOTS) { const list = augments.filter(a => a.slot === sl); md += `## ${C.SLOT_LABEL[sl]} (${list.length}, ${C.SLOT_SOCKETS[sl]} sockets)\n\n| Augment | Maker | Rarity | Lv | Stats | Abilities | Sources |\n|---|---|---|---|---|---|---|\n`;
  md += list.map(a => `| ${a.name.replace(/\|/g, '/')} | ${a.maker} | ${a.rarity} | ${a.level} | ${fmtStats(a.stats)}${a.weapon ? '; weapon ' + a.weapon.kind : ''} | ${a.abilities.map(x => `${x.name} (cd ${x.cooldown}s)`).join('<br>') || '-'} | ${a.sources.slice(0, 4).map(fmtSrc).join('<br>')}${a.sources.length > 4 ? '<br>+' + (a.sources.length - 4) + ' more' : ''} |`).join('\n') + '\n\n'; }
md += `## Abilities\n\n| Ability | Role | Rarity | CD | Effect | VFX / SFX | Chips that change it | Combos into |\n|---|---|---|---|---|---|---|---|\n` + Object.values(abilities).map(a => `| ${a.name} | ${a.role || a.type || '-'} | ${a.rarity || '-'} | ${a.cooldown ?? '-'} | ${(a.effect || '').replace(/\|/g, '/')} | ${a.vfx ? a.vfx.elem : '-'} / ${a.sfx ? a.sfx.family : '-'} | ${a.chipsAffecting.join(', ') || '-'} | ${a.combosInto.slice(0, 6).join(', ') || '-'} |`).join('\n') + '\n';

// ---- html (static, self-contained, reads the embedded JSON)
const html = `<!doctype html><meta charset="utf-8"><title>Warranty Void augment catalog</title><style>body{font:14px system-ui;background:#111;color:#ddd;margin:20px}input,select{background:#222;color:#ddd;border:1px solid #444;padding:4px}table{border-collapse:collapse;width:100%;margin-top:10px}td,th{border-bottom:1px solid #333;padding:4px 6px;text-align:left;vertical-align:top}.grey{color:#b4b6b2}.green{color:#7fd35a}.blue{color:#4aa8ff}.purple{color:#b56dff}.orange{color:#ff9a2e}small{color:#888}</style>
<h1>Augment catalog</h1><p><small>Generated by tools/gen_catalog.mjs. ${stats.augments} augments, ${stats.abilities} abilities, ${stats.chips} chips.</small></p>
<input id=q placeholder="search name / ability / dungeon" size=40> <select id=sl><option value="">all slots</option>${C.SLOTS.map(s => `<option>${s}</option>`).join('')}</select> <select id=rr><option value="">all rarities</option>${['grey', 'green', 'blue', 'purple', 'orange'].map(r => `<option>${r}</option>`).join('')}</select>
<table><thead><tr><th>Augment<th>Slot<th>Maker<th>Lv<th>Stats<th>Abilities<th>Chips<th>Sources</thead><tbody id=tb></tbody></table>
<script id=data type="application/json">${JSON.stringify(augments.map(a => ({ n: a.name, s: a.slot, m: a.maker, r: a.rarity, l: a.level, st: fmtStats(a.stats), ab: a.abilities.map(x => x.name + ': ' + x.effect).join('; '), ch: a.chips.map(c => c.name + (c.affects.length ? '*' : '')).join(', '), so: a.sources.map(fmtSrc).join('; ') }))).replace(/</g, '\\u003c')}</script>
<script>const A=JSON.parse(document.getElementById('data').textContent),e=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));function r(){const q=document.getElementById('q').value.toLowerCase(),sl=document.getElementById('sl').value,rr=document.getElementById('rr').value;document.getElementById('tb').innerHTML=A.filter(a=>(!sl||a.s===sl)&&(!rr||a.r===rr)&&(!q||JSON.stringify(a).toLowerCase().includes(q))).map(a=>'<tr><td class='+a.r+'>'+e(a.n)+'<td>'+a.s+'<td>'+a.m+'<td>'+a.l+'<td>'+e(a.st)+'<td>'+e(a.ab)+'<td><small>'+e(a.ch)+'</small><td><small>'+e(a.so)+'</small>').join('')}['q','sl','rr'].forEach(i=>document.getElementById(i).oninput=r);r();</script>
<p><small>* chip visibly changes one of the augment's abilities.</small></p>\n`;

const files = { 'docs/catalog/augments.json': json, 'docs/CATALOG.md': md, 'docs/catalog/index.html': html };
let stale = [];
for (const [f, c] of Object.entries(files)) { const u = new URL('../' + f, import.meta.url); const cur = fs.existsSync(u) ? fs.readFileSync(u, 'utf8') : null; if (cur !== c) { stale.push(f); if (!CHECK) fs.writeFileSync(u, c); } }
await vs.close();
console.log(JSON.stringify(stats));
if (CHECK) { if (stale.length) { console.log('STALE: ' + stale.join(', ') + ' (run npm run catalog)'); process.exit(1); } console.log('catalog fresh'); }
else console.log(stale.length ? 'wrote ' + stale.join(', ') : 'catalog unchanged');
