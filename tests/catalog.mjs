// Augment catalog: freshness (regenerate + diff vs committed), data gaps, versioning, and old-version build diffs (What changed).
import { execFileSync } from 'node:child_process'; import fs from 'node:fs';
import { createServer } from 'vite';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
let fresh = true, out = ''; try { out = execFileSync('node', ['tools/gen_catalog.mjs', '--check'], { encoding: 'utf8' }); } catch (e) { fresh = false; out = String(e.stdout || ''); }
ok(fresh, 'catalog is fresh (docs/catalog, docs/CATALOG.md, src/catalog_version.ts, public/catalog match game data) ' + (fresh ? '' : out.split('\n').find(l => /STALE/.test(l))));
const cat = JSON.parse(fs.readFileSync('docs/catalog/augments.json', 'utf8'));
for (const [k, v] of Object.entries(cat.gaps)) ok(v.length === 0, `no data gap: ${k}${v.length ? ' -> ' + v.join(', ') : ''}`);
ok(cat.augments.every(a => a.slot && a.maker && a.rarity && a.stats && Array.isArray(a.chips) && Array.isArray(a.sources)), 'every augment has slot, maker, rarity, stats, chip list and sources');
ok(cat.augments.filter(a => a.abilities.length).every(a => a.abilities.every(x => x.effect && x.cooldown != null && x.vfx && x.sfx)), 'every granted ability lists effect, cooldown, VFX and SFX');
ok(cat.augments.some(a => a.chips.some(c => c.affects.length)) && cat.augments.some(a => a.synergies.length) && cat.augments.some(a => a.sources.some(s => s.kind === 'store')) && cat.augments.some(a => a.sources.some(s => s.bosses)), 'chip interactions, synergies, store and boss sources are populated');
const idx = JSON.parse(fs.readFileSync('public/catalog/index.json', 'utf8'));
ok(idx.current === cat.catalogVersion && idx.versions.includes(cat.catalogVersion) && idx.versions.every(v => fs.existsSync(`public/catalog/v/${v}.json`)), 'every catalog version listed in public/catalog/index.json keeps its snapshot');
ok(fs.readFileSync('src/catalog_version.ts', 'utf8').includes(cat.catalogVersion), 'CATALOG_VERSION in the client matches the catalog');
// old-version build diffs
const vs = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const S = await vs.ssrLoadModule('/src/catalog_snap.ts');
const curSnap = S.snapshot(); const old = JSON.parse(JSON.stringify(curSnap));
const ab = Object.values(cat.augments).find(a => a.abilities.length && a.chips.length >= 2 && a.sockets >= 2);
const plain = cat.augments.find(a => a.id !== ab.id && a.slot !== ab.slot && !a.abilities.length && !a.id.startsWith('stock_'));
const chipA = ab.chips[0].id, chipB = ab.chips[1].id; const abilityId = ab.abilities[0].id;
// craft the OLD catalog: different stats, old name, a since-removed item, a chip that used to fit elsewhere, ability cd change, more sockets, a combo that existed
old.items[ab.id].st = { ...old.items[ab.id].st, maxHp: (old.items[ab.id].st.maxHp || 0) + 25 }; old.items[ab.id].n = 'Old ' + old.items[ab.id].n;
old.items.gone_item = { n: 'Retired Widget', s: plain.slot, m: 'HI', r: 'blue', l: 5, st: {}, ab: [] };
old.abilities[abilityId] = { ...old.abilities[abilityId], cd: (old.abilities[abilityId].cd || 1) + 2 };
old.chips.gone_chip = { n: 'Retired Chip', st: { dmg: .1 }, f: ['hand'] };
const notFit = Object.keys(curSnap.chips).find(c => !curSnap.chips[c].f.includes(cat.augments.find(a => a.id === plain.id).group)); old.chips[notFit] = { ...old.chips[notFit], f: [...old.chips[notFit].f, cat.augments.find(a => a.id === plain.id).group] };
old.sockets[ab.slot] = curSnap.sockets[ab.slot] + 2;
const [x, y] = Object.keys(curSnap.abilities).slice(0, 2); old.abilities[x] = { ...old.abilities[x], g: ['Marked'] }; old.abilities[y] = { ...old.abilities[y], u: ['Marked'] }; curSnap.abilities[x].g = curSnap.abilities[x].g.filter(t => t !== 'Marked'); curSnap.abilities[y].u = (curSnap.abilities[y].u || []).filter(t => t !== 'Marked');
const xItem = Object.keys(curSnap.items).find(i => curSnap.items[i].ab.includes(x)), yItem = Object.keys(curSnap.items).find(i => curSnap.items[i].ab.includes(y) && curSnap.items[i].s !== curSnap.items[xItem]?.s);
const slots = { [ab.slot]: { d: ab.id, c: [chipA, chipB, ...Array(curSnap.sockets[ab.slot] - 1).fill(chipA)] }, [plain.slot]: { d: 'gone_item', c: [] } };
const third = cat.augments.find(a => ![ab.slot, plain.slot].includes(a.slot) && a.group === cat.augments.find(q => q.id === plain.id).group) || cat.augments.find(a => ![ab.slot, plain.slot].includes(a.slot));
slots[third.slot] = { d: third.id, c: ['gone_chip', ...(curSnap.chips[notFit].f.includes(third.group) ? [] : [notFit])] };
const d = S.diffBuild(old, curSnap, slots); const kinds = new Set(d.map(c => c.kind));
const has = (k, inc) => d.some(c => c.kind === k && c.incompatible === inc);
ok(has('stats', false) && d.find(c => c.kind === 'stats').text.includes('maxHp'), 'old build: stat change reported');
ok(has('renamed', false), 'old build: rename reported');
ok(has('ability', false) && /cooldown/.test(d.find(c => c.kind === 'ability').text), 'old build: ability cooldown change reported');
ok(has('removed', true), 'old build: removed augment reported as incompatible');
ok(has('chip_removed', true), 'old build: removed chip reported as incompatible');
ok(!slots[third.slot].c.includes(notFit) || has('chip_fit', true), 'old build: chip that no longer fits its slot reported as incompatible');
ok(has('sockets', true), 'old build: socket count drop reported as incompatible');
{ const cs = { [curSnap.items[xItem].s]: { d: xItem, c: [] } }; if (yItem) cs[curSnap.items[yItem].s] = { d: yItem, c: [] }; const dc = S.diffBuild(old, curSnap, cs); ok(!yItem || dc.some(c => c.kind === 'combo' && c.incompatible), 'old build: lost combo (tag no longer applied) reported as incompatible'); }
{ const c2 = JSON.parse(JSON.stringify(S.snapshot())); const [a, b] = [ab.id, third.id]; c2.conflicts.push([a, b, 'test conflict']); const dc = S.diffBuild(S.snapshot(), c2, { [ab.slot]: { d: a, c: [] }, [third.slot]: { d: b, c: [] } }); ok(dc.some(c => c.kind === 'conflict' && c.incompatible), 'old build: new hard conflict reported as incompatible'); }
ok(S.diffBuild(S.snapshot(), S.snapshot(), slots).every(c => c.kind === 'removed' || c.kind === 'chip_removed' || c.kind === 'sockets' || c.kind === 'chip_fit'), 'same catalog: no stat/ability/rename noise');
console.log('  catalog ' + cat.catalogVersion + ' · ' + JSON.stringify(cat.stats.gaps) + ' · ' + kinds.size + ' change kinds exercised');
await vs.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
