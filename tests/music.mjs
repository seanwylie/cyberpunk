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
// --- redesigned state logic: hard music only on elite/boss engagement, with dwell + exit delay (fake clock) ---
await ev(() => { const mm = window.__audio.music; clearInterval(mm.timer); mm.__off = 0; const real = mm.now.bind(mm); mm.now = () => real() + mm.__off; });
const adv = s => ev(s => { const mm = window.__audio.music; mm.__off += s; mm.tick(); }, s);
const hardTrack = /^(elite_|boss_)/;
await m('traversal'); await adv(1); L = await log(); const trk0 = L[L.length - 1].to; const n0 = L.length;
for (let i = 0; i < 20; i++) { await m('traversal'); await adv(1); } L = await log(); ok(L.length === n0, 'repeated traversal requests (zone changes) never change the track');
await m('elite'); L = await log(); e = L[L.length - 1]; ok(e.state === 'elite' && hardTrack.test(e.to) && e.dur >= 1.5, 'elite engagement -> hard elite pool: ' + e.to);
const n1 = L.length; await m('traversal'); await adv(2); await m('elite'); await m('traversal'); await adv(3); L = await log(); ok(L.length === n1, 'min dwell + exit delay: no flapping while disengaging (<15 s)');
await adv(15); L = await log(); ok(L.length === n1 + 1 && L[L.length - 1].state === 'traversal' && !hardTrack.test(L[L.length - 1].to), 'disengage returns to calm after dwell and ~4 s delay');
await m('traversal'); await adv(1); await m('elite'); await adv(16); await m('traversal'); await adv(1); L = await log(); ok(L[L.length - 1].state === 'elite', 'exit delay: still hard 1 s after calm resumes');
await adv(4); L = await log(); ok(L[L.length - 1].state === 'traversal', 'exit delay: calm after ~4 s');
await m('bossreveal'); await m('bosscombat'); L = await log(); ok(L.slice(-2)[0].to === 'boss_reveal' && /^(boss_|elite_)/.test(L[L.length - 1].to) && L[L.length - 1].state === 'bosscombat', 'boss reveal -> boss fight ' + JSON.stringify(L.slice(-3)));
await m('resolution'); await m('traversal'); L = await log(); ok(L.slice(-2)[0].to === 'clear' && L[L.length - 1].state === 'traversal', 'resolution -> traversal');
await m('town'); L = await log(); ok(L[L.length - 1].state === 'town' && L[L.length - 1].dur >= 3, 'return to town: slow fade-out/in');
ok(await ev(() => window.__audio.music.live.filter(l => !l.ending).length === 1), 'exactly one active (non-fading) track');
// --- sim-driven: which events produce which music state ---
const S = await ev(async () => { const g = window.__game, { ENEMIES } = await import('/src/config.ts'); g.save.settings.minimap ??= true; g.startRun('annex'); const out = { log: [] }; const set = () => { g.updateMusic(.016); return g.musicState; };
  const ids = Object.keys(ENEMIES); const ord = ids.find(i => !ENEMIES[i].elite && !ENEMIES[i].boss && !ENEMIES[i].static), eli = ids.find(i => ENEMIES[i].elite && !ENEMIES[i].boss);
  const e = g.enemies.find(x => !x.dead && x.faction === 'enemy'); e.type = ord; e.alert = true; e.affix = undefined;
  let prev = set(); const sw = []; g.onMusic = null; const rec = () => { const s = set(); if (s !== prev) { sw.push(prev + '>' + s); prev = s; } return s; };
  // walk the player across every walkable region with the mob alerted nearby: nothing changes
  const L = g.level; let moved = 0; for (let y = 2; y < L.h - 2; y += 6) for (let x = 2; x < L.w - 2; x += 6) if (!L.solid[y * L.w + x]) { g.px = x + .5; g.py = y + .5; e.x = x + 3.5; e.y = y + .5; e.alert = true; rec(); moved++; }
  out.moved = moved; out.walk = rec(); out.walkSw = sw.length;
  g.hurtEnemy(e, 1, g.px, g.py, 0); out.ordHit = rec(); g.hurtPlayer(1, e.x, e.y); out.ordHurt = rec();
  e.hp = e.maxHp = 9999; e.type = eli; e.dead = false; e.alert = true; e.x = g.px + 8; e.y = g.py; out.eliProx = (g.eliteEng = 0, rec());
  g.hurtEnemy(e, 1, g.px, g.py, 0); out.eliHit = rec(); for (let i = 0; i < 60 * 9; i++) g.updateMusic(1 / 60); out.eliAfter = rec();
  g.dmgSrc = eli + ':swing'; e.x = g.px + 1; g.hurtPlayer(1, e.x, e.y); out.eliHurt = rec(); out.eli = eli; out.ord = ord; return out; });
ok(S.moved > 5 && S.walk === 'traversal' && S.walkSw === 0, 'sim: walking through ' + S.moved + ' map zones with an alerted mob nearby never leaves traversal');
ok(S.ordHit === 'traversal' && S.ordHurt === 'traversal', 'sim: ordinary mob combat (' + S.ord + ') stays on the calm track');
ok(S.eliProx === 'traversal', 'sim: alerted elite in proximity does not trigger hard music');
ok(S.eliHit === 'elite' && S.eliAfter === 'traversal', 'sim: first hit on elite (' + S.eli + ') -> elite; back to traversal ~8 s after last exchange');
ok(S.eliHurt === 'elite', 'sim: being hit by an elite -> elite');
// --- boss / elite rotation (fake clock) ---
const R = await ev(async () => { const mm = window.__audio.music, mod = await import('/src/music.ts'); const B = mod.BOSS_PLAYLISTS, MAP = mod.BOSS_MAP, I = mod.INTENSITY; const off = s => { mm.__off += s; mm.tick(); };
  await new Promise(r => { const f = () => [...new Set([...Object.values(mod.POOLS).flat(), ...Object.values(B).flat()])].every(n => mm.buffers[n]) ? r() : setTimeout(f, 200); f(); setTimeout(r, 30000); });
  const o = { ids: Object.keys(B).length, sizes: [...new Set(Object.values(B).map(p => p.length))], sig: Object.keys(B).every(k => B[k][0] === MAP[k]), uniq: Object.values(B).every(p => new Set(p).size === p.length), pool: Object.values(B).flat().every(x => mod.POOLS.bosscombat.includes(x)), notLower: Object.keys(B).every(k => B[k].slice(1).filter(x => (I[x] || 2) >= (I[MAP[k]] || 2)).length >= Math.min(3, mod.POOLS.bosscombat.filter(x => x !== MAP[k] && (I[x] || 2) >= (I[MAP[k]] || 2)).length)) };
  const fight = (key, fn) => { mm.setState('traversal', null); off(40); mm.state = 'traversal'; mm.want = 'traversal'; mm.setState('bossreveal', key); off(3); mm.setState('bosscombat', key); return fn(); };
  const loop = () => { const l = mm.live.find(x => !x.ending); off(mm.buffers[l.name].duration - (l.offset + (mm.now() - l.startedAt)) - 1); off(2); };
  // voss: signature first, then rotation through own playlist at loop boundaries with no immediate repeat
  const seq = []; fight('warden', () => { seq.push(mm.cur); for (let i = 0; i < 24 && seq.length < 6; i++) { const before = mm.cur; off(10); loop(); if (mm.cur !== before) seq.push(mm.cur); } });
  { const ts = mm.log.filter(x => x.state === 'bosscombat').slice(0, 7).map(x => x.t); o.gaps = ts.slice(1).map((x, i) => x - ts[i]); } o.seq = seq; o.pl = B.warden; o.dbg = mm.log.slice(-12).map(x => x.to + '@' + x.t.toFixed(0) + x.state);
  const seq2 = []; fight('warden', () => { seq2.push(mm.cur); }); o.sig2 = seq2[0]; // new fight resets: signature again
  // phase change -> more intense
  fight('lineman', () => { o.pStart = mm.cur; off(20); mm.onPhase(1); o.pEnd = mm.cur; o.pOk = B.lineman.includes(mm.cur); o.pHigher = (I[mm.cur] || 2) > (I[o.pStart] || 2); const n = mm.log.length; mm.onPhase(1); o.pRepeat = mm.log.length === n; off(1); mm.onPhase(2); o.pTooSoon = mm.log.length === n; });
  // elite rotation at loop boundary after min dwell
  mm.setState('traversal'); off(40); mm.setState('elite'); const e0 = mm.cur; off(5); o.eliteEarly = mm.cur !== e0; loop(); o.e0 = e0; o.e1 = mm.cur; o.eliteInPool = mod.POOLS.elite.includes(mm.cur);
  mm.setState('traversal'); off(30); o.after = mm.state; o.afterTrack = mm.cur; return o; });
ok(R.ids >= 24 && R.sizes.length === 1 && R.sizes[0] === 4, 'every boss has a 4-track playlist: ' + R.ids + ' bosses, sizes ' + R.sizes);
ok(R.sig && R.uniq && R.pool && R.notLower, 'playlists: signature first, unique, from boss pool, same-or-higher intensity preferred');
ok(R.seq[0] === R.pl[0], 'first track on engagement is the signature: ' + R.seq[0]);
ok(R.seq.length >= 5 && R.seq.every((x, i) => i === 0 || x !== R.seq[i - 1]) && R.seq.every(x => R.pl.includes(x)), 'rotates at loop boundaries within playlist, no immediate repeat: ' + R.seq.join('>') + ' ' + R.dbg.join(' '));
ok(R.gaps.length >= 4 && R.gaps.every(g => g >= 15), 'min dwell: successive boss tracks >= 15 s apart: ' + R.gaps.map(g => g.toFixed(0)));
ok(R.sig2 === R.pl[0], 'new fight resets to signature track');
ok(R.pOk && R.pHigher && R.pRepeat && R.pTooSoon, 'phase change switches to a more intense playlist track (' + R.pStart + ' -> ' + R.pEnd + '), not repeated/too soon');
ok(!R.eliteEarly && R.eliteInPool && R.e1 !== R.e0, 'elite pool rotates at loop boundary after dwell: ' + R.e0 + ' -> ' + R.e1);
ok(R.after === 'traversal' && !/^(elite_|boss_)/.test(R.afterTrack), 'disengage returns to calm: ' + R.afterTrack);
// --- rotation logic + asset existence (variety pack) ---
import fs from 'fs';
const M = await ev(async () => { const m = await import('/src/music.ts'); return { pools: m.POOLS, boss: m.BOSS_MAP, core: m.CORE_TRACKS }; });
const files = new Set(fs.readdirSync('public/audio/music').map(f => f.replace(/\.mp3$/, '')));
const used = [...new Set([...Object.values(M.pools).flat(), ...Object.values(M.boss), ...M.core])];
ok(used.every(n => files.has(n)), 'every pooled track has an mp3: missing ' + used.filter(n => !files.has(n)).join());
ok([...files].every(n => used.includes(n)), 'no orphan mp3s: ' + [...files].filter(n => !used.includes(n)).join());
ok(fs.readdirSync('public/audio/music').every(f => fs.statSync('public/audio/music/' + f).size < 1.3e6), 'each track < 1.3 MB');
ok(M.pools.town.length >= 3 && M.pools.traversal.length >= 5 && M.pools.elite.length >= 4 && !M.pools.elite.some(n => /^(combat_|traversal_|calm_)/.test(n)) && M.pools.bosscombat.length >= 4, 'pool sizes');
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
  mm.state = null; mm.want = 'town'; mm.setState('town'); r.town0 = mm.cur; const live = mm.live.find(l => !l.ending); const d = mm.buffers[live.name].duration; mm.ROTATE_LOOPS = 1; mm.enteredAt -= 30; live.startedAt = mm.now() - (d - 1); mm.tick(); r.rot = mm.cur; r.rotLog = mm.log[mm.log.length - 1];
  return r; });
ok(['elite_siege', 'elite_hunt', 'boss_overclock', 'boss_meltdown'].includes(mgr.elite), 'elite state picks elite/boss pool: ' + mgr.elite);
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
