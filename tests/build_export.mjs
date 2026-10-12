// Build export/import: round-trip encode/decode, bad-code validation, inspector matches the equipped state, ?build= read-only preview,
// old-catalog code shows "What changed" (served old snapshot) or a clear warning when the snapshot is missing. Writes shots/build/*.png
import { createServer } from 'vite'; import fs from 'node:fs';
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync('shots/build', { recursive: true });
const vs = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const B = await vs.ssrLoadModule('/src/buildcode.ts'), St = await vs.ssrLoadModule('/src/state.ts'), C = await vs.ssrLoadModule('/src/config.ts'), V = await vs.ssrLoadModule('/src/catalog_version.ts');
const s = St.newSave(); s.level = 22; const arm = C.ITEMS.find(i => i.slot === 'armR' && i.abilities?.length && i.rarity === 'blue'); const it = St.mkInst(s, arm.id); it.chips = ['power', 'speed']; s.items.push(it); s.installed.armR = it.uid;
const ex = B.exportBuild(s); ok(ex.game && ex.cat === V.CATALOG_VERSION && ex.lvl === 22 && ex.slots.armR.d === arm.id && ex.slots.armR.c.join() === 'power,speed', 'export carries game build id, catalog version, level, slots and chips');
const code = B.encodeBuild(ex); const back = B.decodeBuild(code); ok(code.startsWith('WVB1.') && code.length < 1200 && back.ok && JSON.stringify(back.build) === JSON.stringify(ex), `round trip: code (${code.length} chars) decodes to the identical build`);
const url = B.buildUrl(code, 'https://play.seanwylie.ca/'); const viaUrl = B.decodeBuild(url); ok(url.includes('?build=') && viaUrl.ok && JSON.stringify(viaUrl.build) === JSON.stringify(ex), 'round trip via ?build= link');
const txt = B.buildText(ex); ok(txt.includes('Game ' + ex.game) && txt.includes('catalog ' + ex.cat) && txt.includes(arm.name) && /Abilities: /.test(txt), 'text summary includes game + catalog version, augments, abilities');
const enc = (o) => 'WVB1.' + Buffer.from(JSON.stringify(o)).toString('base64url');
const bad = [['', 'empty'], ['hello', 'no prefix'], ['WVB1.%%%', 'bad chars'], ['WVB1.' + 'A'.repeat(4000), 'too long'], ['WVB1.bm90IGpzb24', 'not JSON'], [enc({ ...ex, v: 2 }), 'future version'], [enc({ ...ex, cat: undefined }), 'missing catalog version'], [enc({ ...ex, game: undefined }), 'missing game version'],
  [enc({ ...ex, lvl: 500 }), 'bad level'], [enc({ ...ex, slots: { nose: { d: 'x', c: [] } } }), 'unknown slot'], [enc({ ...ex, slots: { armR: { d: '<script>', c: [] } } }), 'markup id'], [enc({ ...ex, slots: { armR: { d: 'x', c: Array(9).fill('power') } } }), 'too many chips'], [enc({ ...ex, picks: [1, 2] }), 'bad picks'], [enc([1, 2]), 'array body']];
for (const [c, m] of bad) { const r = B.decodeBuild(c); ok(!r.ok && r.why, `rejects ${m}${r.ok ? '' : ' (' + r.why + ')'}`); }
await vs.close();
// ---- browser
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
await page.evaluate(() => document.getElementById('splash')?.remove());
const mine = await page.evaluate(async (armId) => { const St = await import('/src/state.ts'); const g = window.__game, s = g.save; s.level = 22; const it = St.mkInst(s, armId); it.chips = ['power', 'speed']; s.items.push(it); s.installed.armR = it.uid; g.recompute(); g.mode = 'town'; return true; }, arm.id);
await page.evaluate(() => window.__ui.open('locker')); await sleep(300); ok(await page.evaluate(() => !!document.querySelector('[data-act=bd-open]')), 'locker has a Build button');
await page.evaluate(() => document.querySelector('[data-act=bd-open]').click()); await sleep(500);
const insp = await page.evaluate(() => { const g = window.__game, s = g.save; const tiles = [...document.querySelectorAll('.bdgrid .bdt[data-def]')].map(t => [t.dataset.slot, t.dataset.def]); const eq = Object.entries(s.installed).map(([sl, u]) => [sl, s.items.find(i => i.uid === u)?.def]).filter(x => x[1]);
  const abs = [...document.querySelectorAll('.bdab')].map(x => x.textContent); return { tiles, eq, abs, gab: g.build.abilities, tot: document.querySelector('.bdtot').textContent, hp: Math.round(g.build.stats.maxHp), chipBadge: document.querySelector('.bdt[data-slot=armR] .bdchips')?.textContent, ver: document.querySelector('.bdver').textContent, wv: typeof window.wvBuild?.code }; });
ok(insp.eq.length === insp.tiles.length && insp.eq.every(([sl, d]) => insp.tiles.some(t => t[0] === sl && t[1] === d)), `inspector tiles match the equipped augments (${insp.tiles.length} slots)`);
ok(insp.abs.length === insp.gab.length && insp.tot.includes('HP ' + insp.hp) && insp.chipBadge === '2', 'inspector abilities, totals (HP) and chip count match the live build');
ok(/game .+ · catalog [a-f0-9]{12}/.test(insp.ver) && insp.wv === 'function', 'shows game + catalog version; window.wvBuild console helper installed');
const overflow = await page.evaluate(() => [...document.querySelectorAll('#modal .win *')].filter(e => { const cs = getComputedStyle(e); return e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && cs.overflowX === 'hidden' && cs.textOverflow !== 'ellipsis'; }).length); ok(overflow === 0, 'no clipped text in the inspector');
await page.screenshot({ path: 'shots/build/inspector_desktop.png' });
const liveCode = await page.evaluate(() => window.wvBuild.code()); const dec = await page.evaluate(c => window.wvBuild.decode(c), liveCode); ok(dec.ok && dec.build.slots.armR.d === arm.id, 'in-game code round-trips');
// copy text / link
await page.evaluate(() => { window.__copied = null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__copied = t; } }, configurable: true }); });
await page.evaluate(() => document.querySelector('[data-act=bd-link]').click()); await sleep(200); ok(/\?build=WVB1\./.test(await page.evaluate(() => window.__copied || '')), 'Copy link puts a ?build= URL on the clipboard');
await page.evaluate(() => document.querySelector('[data-act=bd-text]').click()); await sleep(200); ok(/catalog [a-f0-9]{12}/.test(await page.evaluate(() => window.__copied || '')), 'Copy text includes the catalog version');
// read-only preview of another build (same catalog): nothing granted
const other = { v: 1, game: 'friend-build', cat: V.CATALOG_VERSION, lvl: 30, slots: { torso: { d: C.ITEMS.find(i => i.slot === 'torso' && i.rarity === 'purple').id, c: ['plating'] } } };
const n0 = await page.evaluate(() => window.__game.save.items.length);
await page.evaluate(c => window.wvBuild.view(c), enc(other)); await sleep(500);
const pv = await page.evaluate(() => ({ mode: document.querySelector('.bdmode')?.textContent || '', torso: document.querySelector('.bdt[data-slot=torso]')?.dataset.def, n: window.__game.save.items.length }));
ok(/read-only/.test(pv.mode) && pv.torso === other.slots.torso.d && pv.n === n0, 'shared build opens as a read-only preview and grants nothing');
// old catalog: serve a fake old snapshot where the torso had different stats and a chip that is gone
const oldCat = 'deadbeef0001'; const snapNow = await page.evaluate(async () => (await import('/src/catalog_snap.ts')).snapshot());
const oldSnap = JSON.parse(JSON.stringify(snapNow)); const tId = other.slots.torso.d; oldSnap.items[tId].st = { ...oldSnap.items[tId].st, maxHp: (oldSnap.items[tId].st.maxHp || 0) + 40 }; oldSnap.chips.old_chip = { n: 'Old Chip', st: {}, f: ['torso'] };
await page.route('**/catalog/v/' + oldCat + '.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(oldSnap) }));
await page.evaluate(c => window.wvBuild.view(c), enc({ ...other, cat: oldCat, slots: { torso: { d: tId, c: ['plating', 'old_chip'] } } })); await sleep(700);
const wc = await page.evaluate(() => { const n = document.querySelector('.bdnotice'); return { txt: n?.textContent || '', kinds: [...document.querySelectorAll('.bdnotice li')].map(l => l.dataset.kind), inc: document.querySelectorAll('.bdnotice li.bdinc').length }; });
ok(/What changed/.test(wc.txt) && wc.kinds.includes('stats') && wc.kinds.includes('chip_removed') && wc.inc >= 1, `old build link: "What changed" lists stat change + removed chip as incompatible (${wc.kinds.join(',')})`);
await page.screenshot({ path: 'shots/build/what_changed_desktop.png' });
await page.evaluate(c => window.wvBuild.view(c), enc({ ...other, cat: 'abcdef999999' })); await sleep(700);
ok(/can't find/.test(await page.evaluate(() => document.querySelector('.bdnotice')?.textContent || '')), 'unknown catalog version: clear warning instead of silently different stats');
// invalid code message
await page.evaluate(() => { document.getElementById('bdin').value = 'WVB1.garbage!!'; document.querySelector('[data-act=bd-view]').click(); }); await sleep(300);
ok(/Not a valid build code/.test(await page.evaluate(() => document.getElementById('bdmsg').textContent)), 'invalid pasted code shows a validation message');
await browser.close();
// ?build= on load + phone layout
{ const { browser, page } = await launch({ viewport: { width: 360, height: 740 }, touch: true, query: '?build=' + encodeURIComponent(enc(other)) }); await page.evaluate(() => document.getElementById('splash')?.remove()); await sleep(1500);
  ok(await page.evaluate(() => window.__ui.modal === 'build' && /read-only/.test(document.querySelector('.bdmode')?.textContent || '')), '?build= link opens the read-only preview on load'); await page.screenshot({ path: 'shots/build/preview_phone.png' }); await browser.close(); }
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
