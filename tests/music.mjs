// Headless check: file-based music manager loads, crossfades on state change, applies hysteresis, falls back when files missing.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch();
const ev = (f, a) => page.evaluate(f, a);
await ev(() => { const a = window.__audio; a.resume(); });
await page.waitForFunction(() => window.__audio.useFiles, null, { timeout: 20000 }).catch(() => {});
ok(await ev(() => window.__audio.useFiles), 'music files loaded; manager active');
const log = () => ev(() => window.__audio.music.log.map(l => ({ from: l.from, to: l.to, dur: l.dur, state: l.state })));
const m = (s) => ev(s => window.__audio.setState(s), s);
await m('town'); await sleep(300);
let L = await log(); ok(L.length && L[L.length - 1].to === 'town', 'initial town track');
await m('traversal'); L = await log(); let e = L[L.length - 1]; ok(e.state === 'traversal' && /^traversal_/.test(e.to) && e.from === 'town' && e.dur >= 2.5, 'town->traversal crossfade with long fade-in: ' + JSON.stringify(e));
await m('combat'); L = await log(); e = L[L.length - 1]; ok(e.state === 'combat' && /^combat_/.test(e.to) && e.dur >= 1.5 && e.dur <= 3, 'traversal->combat crossfade');
const n = L.length; await m('traversal'); await sleep(500); await m('combat'); await m('traversal'); L = await log(); ok(L.length === n, 'combat exit hysteresis: no flapping');
await ev(() => { const mm = window.__audio.music; mm.COMBAT_MIN = 0; mm.COMBAT_EXIT_HOLD = 0.5; }); await sleep(900); await ev(() => window.__audio.music.tick()); L = await log(); ok(L[L.length - 1].state === 'traversal', 'combat->traversal after hold');
await m('bossreveal'); await m('bosscombat'); L = await log(); ok(L.slice(-2).map(x => x.to).join() === 'boss_reveal,boss_fight', 'boss reveal -> boss fight');
await m('resolution'); await m('traversal'); L = await log(); ok(L.slice(-2).map(x => x.to).join().startsWith('clear,traversal'), 'resolution -> traversal');
await m('town'); L = await log(); ok(L[L.length - 1].to === 'town' && L[L.length - 1].dur >= 3, 'return to town: slow fade-out/in');
ok(await ev(() => window.__audio.music.live.filter(l => !l.ending).length === 1), 'exactly one active (non-fading) track');
ok(!errors.length, 'no page errors ' + errors.join('|'));
// fallback: block music files
const b2 = await launch({ query: '' }); await b2.page.route('**/audio/music/*', r => r.abort());
await b2.page.reload(); await b2.page.waitForFunction(() => window.__game); await b2.page.evaluate(() => window.__audio.resume()); await sleep(1500);
ok(!(await b2.page.evaluate(() => window.__audio.useFiles)), 'fallback to procedural when files missing');
await browser.close(); await b2.browser.close(); process.exit(fails ? 1 : 0);
