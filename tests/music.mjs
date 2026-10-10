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
let L = await log(); ok(L.length && L[L.length - 1].state === 'town' && /^(town|calm_)/.test(L[L.length - 1].to), 'initial town track');
await m('traversal'); L = await log(); let e = L[L.length - 1]; ok(e.state === 'traversal' && /^(traversal_|calm_)/.test(e.to) && e.from === 'town' && e.dur >= 2.5, 'town->traversal crossfade with long fade-in: ' + JSON.stringify(e));
await m('combat'); L = await log(); e = L[L.length - 1]; ok(e.state === 'combat' && /^combat_/.test(e.to) && e.dur >= 1.5 && e.dur <= 3, 'traversal->combat crossfade');
const n = L.length; await m('traversal'); await sleep(500); await m('combat'); await m('traversal'); L = await log(); ok(L.length === n, 'combat exit hysteresis: no flapping');
await ev(() => { const mm = window.__audio.music; mm.COMBAT_MIN = 0; mm.COMBAT_EXIT_HOLD = 0.5; }); await sleep(900); await ev(() => window.__audio.music.tick()); L = await log(); ok(L[L.length - 1].state === 'traversal', 'combat->traversal after hold');
await m('bossreveal'); await m('bosscombat'); L = await log(); ok(L.slice(-2)[0].to === 'boss_reveal' && /^boss_/.test(L[L.length - 1].to) && L[L.length - 1].state === 'bosscombat', 'boss reveal -> boss fight');
await m('resolution'); await m('traversal'); L = await log(); ok(L.slice(-2)[0].to === 'clear' && L[L.length - 1].state === 'traversal', 'resolution -> traversal');
await m('town'); L = await log(); ok(L[L.length - 1].state === 'town' && L[L.length - 1].dur >= 3, 'return to town: slow fade-out/in');
ok(await ev(() => window.__audio.music.live.filter(l => !l.ending).length === 1), 'exactly one active (non-fading) track');
// --- rotation logic + asset existence (variety pack) ---
import fs from 'fs';
const M = await ev(async () => { const m = await import('/src/music.ts'); return { pools: m.POOLS, boss: m.BOSS_MAP, core: m.CORE_TRACKS }; });
const files = new Set(fs.readdirSync('public/audio/music').map(f => f.replace(/\.mp3$/, '')));
const used = [...new Set([...Object.values(M.pools).flat(), ...Object.values(M.boss), ...M.core])];
ok(used.every(n => files.has(n)), 'every pooled track has an mp3: missing ' + used.filter(n => !files.has(n)).join());
ok([...files].every(n => used.includes(n)), 'no orphan mp3s: ' + [...files].filter(n => !used.includes(n)).join());
ok(fs.readdirSync('public/audio/music').every(f => fs.statSync('public/audio/music/' + f).size < 1.3e6), 'each track < 1.3 MB');
ok(M.pools.town.length >= 3 && M.pools.traversal.length >= 5 && M.pools.elite.length >= 4 && M.pools.bosscombat.length >= 4, 'pool sizes');
ok(Object.values(M.boss).every(n => M.pools.bosscombat.includes(n)) && new Set(Object.values(M.boss)).size >= 4, 'boss map uses boss pool, >=4 distinct tracks');
const bag = await ev(async () => { const { ShuffleBag } = await import('/src/music.ts'); const out = {};
  for (const n of [2, 3, 4, 7]) { const items = Array.from({ length: n }, (_, i) => 't' + i); const b = new ShuffleBag(items); const seq = []; for (let i = 0; i < n * 50; i++) seq.push(b.next());
    let rep = 0; for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) rep++; let fair = true; for (let c = 0; c < 50; c++) if (new Set(seq.slice(c * n, c * n + n)).size !== n) fair = false; out[n] = { rep, fair: fair || n > 1 && rep === 0 }; }
  const b1 = new ShuffleBag(['a']); out.one = b1.next() === 'a' && b1.next() === 'a'; const b2 = new ShuffleBag(['a', 'b', 'c']); b2.next(); const sub = []; for (let i = 0; i < 20; i++) sub.push(b2.next(x => x !== 'c')); out.avail = !sub.includes('c'); return out; });
ok([2, 3, 4, 7].every(n => bag[n].rep === 0), 'shuffle bag: no immediate repeat (2,3,4,7 items): ' + JSON.stringify(bag));
ok(bag.one && bag.avail, 'shuffle bag: single item ok, availability filter respected');
// manager-level: elite pool, boss mapping, calm rotation at loop boundary
const mgr = await ev(async () => { const a = window.__audio, mm = a.music; await new Promise(r => { const f = () => Object.keys(mm.buffers).length >= 31 ? r() : setTimeout(f, 200); f(); setTimeout(r, 15000); });
  const r = {}; mm.setState('town'); mm.setState('traversal'); mm.setState('elite'); r.elite = mm.cur; mm.setState('bosscombat', 'warden'); r.boss = mm.cur; mm.setState('bossreveal'); mm.state = null; mm.setState('bosscombat', 'unknownboss'); r.boss2 = mm.cur;
  mm.state = null; mm.want = 'town'; mm.setState('town'); r.town0 = mm.cur; const live = mm.live.find(l => !l.ending); const d = mm.buffers[live.name].duration; mm.ROTATE_LOOPS = 1; live.startedAt = mm.now() - (d - 1); mm.tick(); r.rot = mm.cur; r.rotLog = mm.log[mm.log.length - 1];
  return r; });
ok(['elite_siege', 'elite_hunt', 'boss_overclock', 'boss_meltdown', 'combat_a', 'combat_b'].includes(mgr.elite), 'elite state picks elite/boss pool: ' + mgr.elite);
ok(mgr.boss === 'boss_overclock', 'warden maps to its boss track: ' + mgr.boss);
ok(M.pools.bosscombat.includes(mgr.boss2), 'unmapped boss draws from boss pool: ' + mgr.boss2);
{ const B = await ev(async () => { const b = await import('/src/content/batch1_bosses.ts'), m = await import('/src/music.ts'); return b.BOSSES.map(x => ({ id: x.id, tier: x.tier, faction: x.faction, track: m.BOSS_MAP[x.id] })); });
  const tr = B.map(b => b.track), uniq = new Set(tr);
  ok(B.length === 20 && uniq.size >= 18, `20 batch-1 bosses have unique or near-unique themes (${uniq.size} distinct)`);
  const cnt = {}; for (const t of tr) cnt[t] = (cnt[t] || 0) + 1; ok(Math.max(...Object.values(cnt)) <= 2, 'no boss track shared by more than 2 bosses');
  const NEW = tr.filter(t => /^boss_/.test(t) && fs.existsSync('public/audio/music/' + t + '.mp3') && !['boss_fight', 'boss_overclock', 'boss_meltdown', 'boss_hydraulic'].includes(t)); ok(NEW.length >= 15, '15 new boss tracks are mapped (' + NEW.length + ')');
  const t4 = B.filter(b => b.tier === 4); ok(t4.every(b => cnt[b.track] === 1 && /^boss_/.test(b.track)), 'tier IV bosses have their own dedicated tracks');
  const lowTier = B.filter(b => b.tier === 1).map(b => b.track); ok(lowTier.some(t => /^elite_|^boss_(lineman|pitboss)$/.test(t)), 'tier I themes are the lighter ones');
  ok(fs.statSync('public/audio/music/boss_recall.mp3').size < 1.3e6 && B.every(b => fs.existsSync('public/audio/music/' + b.track + '.mp3')), 'every boss theme file exists, ~1 MB each'); }
ok(mgr.rot && mgr.rot !== mgr.town0 && mgr.rotLog.state === 'town' && mgr.rotLog.dur >= 3, 'calm state rotates near loop end with long crossfade: ' + mgr.town0 + ' -> ' + mgr.rot);
ok(!errors.length, 'no page errors ' + errors.join('|'));
// fallback: block music files
const b2 = await launch({ query: '' }); await b2.page.route('**/audio/music/*', r => r.abort());
await b2.page.reload(); await b2.page.waitForFunction(() => window.__game); await b2.page.evaluate(() => window.__audio.resume()); await sleep(1500);
ok(!(await b2.page.evaluate(() => window.__audio.useFiles)), 'fallback to procedural when files missing');
await browser.close(); await b2.browser.close(); process.exit(fails ? 1 : 0);
