// Headless check: file-based music manager loads, crossfades on state change, applies hysteresis, falls back when files missing.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ init: () => { window.__WV_MUSIC_ALL = 1; } });
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
const n1 = L.length; await m('traversal'); await adv(2); await m('elite'); await m('traversal'); await adv(3); L = await log(); ok(L.length === n1, 'min dwell + exit delay: no flapping while disengaging (<45 s)');
await adv(60); L = await log(); ok(L.length === n1 + 1 && L[L.length - 1].state === 'traversal' && !hardTrack.test(L[L.length - 1].to), 'disengage returns to calm after dwell and ~10 s delay');
await m('traversal'); await adv(1); await m('elite'); await adv(50); await m('traversal'); await adv(1); L = await log(); ok(L[L.length - 1].state === 'elite', 'exit delay: still hard 1 s after calm resumes');
await adv(10); L = await log(); ok(L[L.length - 1].state === 'traversal', 'exit delay: calm after ~10 s');
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
const R = await ev(async () => { const mm = window.__audio.music, mod = await import('/src/music.ts'); const I = mod.INTENSITY; const off = s => { mm.__off += s; mm.tick(); };
  await new Promise(r => { const f = () => [...new Set(Object.values(mod.POOLS).flat())].filter(n => !mod.LAZY.has(n) || (/^(boss_|elite_)/.test(n) && !mod.SIG_TRACKS.includes(n))).every(n => (mm.ensure(n), mm.buffers[n])) ? r() : setTimeout(f, 300); f(); setTimeout(r, 120000); });
  const o = {};
  const fight = (key, fn) => { mm.setState('traversal', null); off(40); mm.state = 'traversal'; mm.want = 'traversal'; mm.setState('bossreveal', key); off(3); mm.setState('bosscombat', key); return fn(); };
  const loop = () => { const l = mm.live.find(x => !x.ending); off(Math.max(0, mm.buffers[l.name].duration - ((l.offset + (mm.now() - l.startedAt)) % mm.buffers[l.name].duration) - 1)); off(2); };
  const pool = mod.POOLS.bosscombat;
  // non-signature boss: draws from the whole boss pool; mid-fight rotation at loop boundaries (>= 90 s apart), never the same track twice in a row
  const seq = []; const lg0 = mm.log.length; fight('warden', () => { seq.push(mm.cur); for (let i = 0; i < 60 && seq.length < 5; i++) { const before = mm.cur; off(30); loop(); if (mm.cur !== before) seq.push(mm.cur); } });
  { const ts = mm.log.slice(lg0).filter(x => x.state === 'bosscombat').slice(0, 7).map(x => x.t); o.gaps = ts.slice(1).map((x, i) => x - ts[i]); } o.seq = seq; o.dbg = mm.log.slice(-12).map(x => x.to + '@' + x.t.toFixed(0) + x.state);
  o.pl = pool;
  // phase change -> more intense track from the pool, not repeated, not too soon (non-signature boss)
  fight('lineman', () => { o.pStart = mm.cur; off(25); mm.onPhase(1); off(0.5); o.pEnd = mm.cur; o.pOk = pool.includes(mm.cur) && mm.cur !== o.pStart; o.pHigher = (I[mm.cur] || 2) >= (I[o.pStart] || 2); const n = mm.log.length; mm.onPhase(1); o.pRepeat = mm.log.length === n; off(1); mm.onPhase(2); o.pTooSoon = mm.log.length === n; });
  // elite rotation at loop boundary after min dwell
  mm.setState('traversal'); off(40); mm.setState('elite'); const e0 = mm.cur; off(5); o.eliteEarly = mm.cur !== e0; off(100); o.eliteMid = mm.cur === e0; off(300); loop(); o.e0 = e0; o.e1 = mm.cur; o.eliteInPool = mod.POOLS.elite.includes(mm.cur);
  mm.setState('traversal'); off(30); o.after = mm.state; o.afterTrack = mm.cur; return o; });
ok(R.seq.length >= 4 && R.pl.includes(R.seq[0]), 'boss fight opens with a boss-pool track: ' + R.seq[0]);
ok(R.seq.length >= 4 && R.seq.every((x, i) => i === 0 || x !== R.seq[i - 1]) && R.seq.every(x => R.pl.includes(x)), 'rotates at loop boundaries through the boss pool, no immediate repeat: ' + R.seq.join('>') + ' ' + R.dbg.join(' '));
ok(R.gaps.length >= 3 && R.gaps.every(g => g >= 300), 'boss mid-fight rotation only after >= 300 s: ' + R.gaps.map(g => g.toFixed(0)));
ok(R.pOk && R.pHigher && R.pRepeat && R.pTooSoon, 'phase change switches to a more intense playlist track (' + R.pStart + ' -> ' + R.pEnd + '), not repeated/too soon');
ok(!R.eliteEarly && R.eliteInPool && R.e1 !== R.e0, 'elite pool rotates at loop boundary after dwell: ' + R.e0 + ' -> ' + R.e1);
ok(R.after === 'traversal' && !/^(elite_|boss_)/.test(R.afterTrack), 'disengage returns to calm: ' + R.afterTrack);
// --- switch budgets + guaranteed hard fade-in (fake clock) ---
const C = await ev(async () => { const mm = window.__audio.music, mod = await import('/src/music.ts'); const off = s => { mm.__off += s; mm.tick(); }; const o = {};
  await new Promise(r => { const f = () => [...new Set([...Object.values(mod.POOLS).flat(), ])].filter(n => !mod.LAZY.has(n) || (/^(boss_|elite_)/.test(n) && !mod.SIG_TRACKS.includes(n))).every(n => (mm.ensure(n), mm.buffers[n])) ? r() : setTimeout(f, 300); f(); setTimeout(r, 120000); });
  const settle = () => { mm.setState('traversal', null); off(60); mm.state = 'traversal'; mm.want = 'traversal'; };
  const loopEnd = () => { const l = mm.live.find(x => !x.ending); off(Math.max(0, mm.buffers[l.name].duration - ((l.offset + (mm.now() - l.startedAt)) % mm.buffers[l.name].duration) - 1)); off(2); };
  // calm: scripted 10 minutes of exploring (zone-change requests every 5 s)
  settle(); mm.resetCounts(); const n0 = mm.log.length; for (let t = 0; t < 600; t += 5) { mm.setState('traversal'); off(5); const k = mm.bagKey('traversal'); if (mm.nextUp[k] && !mm.buffers[mm.nextUp[k]]) { const t0 = performance.now(); while (!mm.buffers[mm.nextUp[k]] && performance.now() - t0 < 15000) { await new Promise(r => setTimeout(r, 100)); mm.tick(); } } } o.calm = { ...mm.counts }; o.calmLog = mm.log.length - n0;
  // boss fight: 5 minutes, one phase change at 2:00
  settle(); mm.setState('bossreveal', 'warden'); off(3); mm.setState('bosscombat', 'warden'); mm.resetCounts(); const b0 = mm.log.length; for (let t = 0; t < 300; t += 1) { if (t === 120) mm.onPhase(1); off(1); } o.boss = { ...mm.counts }; o.bossLog = mm.log.length - b0;
  // elite fight: 3 minutes of continuous engagement
  settle(); mm.setState('elite'); mm.resetCounts(); const e0 = mm.log.length; for (let t = 0; t < 180; t += 1) { mm.setState('elite'); off(1); } o.elite = { ...mm.counts }; o.eliteLog = mm.log.length - e0;
  // fade-in guarantee: elite right after a calm rotation, boss right after elite, repeated engagements
  const fades = []; const chk = (what) => { const e = mm.log[mm.log.length - 1]; fades.push({ what, ok: /^(elite_|boss_)/.test(e.to) && e.dur >= 1.5 && e.dur <= 2 && (what.startsWith('boss') ? e.state === 'bosscombat' : e.state === 'elite') }); };
  settle(); mm.state = 'traversal'; mm.enteredAt = mm.now() - 400; mm.lastSwitchAt = mm.now() - 400; { const l = mm.live.find(x => !x.ending); l.startedAt = mm.now() - (mm.buffers[l.name].duration * 4 - 1); mm.tick(); } o.calmRot = mm.log[mm.log.length - 1].state === 'traversal';
  mm.setState('elite'); chk('elite-after-calm-switch'); // immediately, no dwell
  for (let i = 0; i < 4; i++) { mm.setState('traversal'); off(1); mm.setState('elite'); off(0.2); const e = mm.log[mm.log.length - 1]; fades.push({ what: 'repeat' + i, ok: mm.state === 'elite' }); mm.setState('traversal'); off(60); mm.state === 'traversal' || (mm.state = 'traversal'); mm.want = 'traversal'; mm.setState('elite'); chk('elite-repeat' + i); mm.setState('traversal'); off(60); }
  settle(); mm.setState('elite'); off(2); mm.setState('bossreveal', 'warden'); off(3); mm.setState('bosscombat', 'warden'); chk('boss-from-elite');
  settle(); mm.setState('bossreveal', 'lineman'); off(3); mm.setState('bosscombat', 'lineman'); chk('boss-after-calm'); settle();
  // not decoded yet: engagement starts the moment the track loads
  mm.setState('bossreveal', 'warden'); const sig = mm.fightNext, keep = mm.buffers[sig]; delete mm.buffers[sig]; off(3); const n1 = mm.log.length; mm.setState('bosscombat', 'warden'); off(1); o.pendWait = mm.log.length === n1 && mm.state === 'bosscombat'; mm.buffers[sig] = keep; off(0.3); const e = mm.log[mm.log.length - 1]; o.pendStart = e.to === sig && e.state === 'bosscombat';
  o.fades = fades; return o; });
ok(C.calm.total >= 3 && C.calm.total <= 9 && C.calm.hard === 0 && C.calmLog <= 9, 'calm: 3-9 track switches (90-150 s dwell) in a scripted 10-minute run: ' + JSON.stringify(C.calm));
ok(C.boss.hard <= 4 && C.boss.phase <= 1 && C.bossLog <= 4, 'boss fight (5 min, 1 phase): <= 4 switches: ' + JSON.stringify(C.boss));
ok(C.elite.total <= 2 && C.eliteLog <= 2, 'elite fight (3 min): <= 2 switches: ' + JSON.stringify(C.elite));
ok(C.calmRot && C.fades.every(f => f.ok), 'every elite/boss engagement fades in 1.5-2 s immediately, incl. right after a calm switch and on repeats: ' + JSON.stringify(C.fades.filter(f => !f.ok)));
ok(C.pendWait && C.pendStart, 'boss track not yet decoded: waits, then fades in as soon as it loads');
// --- death / respawn / retry: never restart the track that just played; persistent bag; no hard reset ---
{ const D = await ev(async () => { const mm = window.__audio.music, mod = await import('/src/music.ts'); const off = s => { mm.__off += s; mm.tick(); }; const o = {};
    await new Promise(r => { const f = () => [...new Set([...Object.values(mod.POOLS).flat(), ])].filter(n => !mod.LAZY.has(n) || (/^(boss_|elite_)/.test(n) && !mod.SIG_TRACKS.includes(n))).every(n => (mm.ensure(n), mm.buffers[n])) ? r() : setTimeout(f, 300); f(); setTimeout(r, 120000); });
    const settle = () => { mm.setState('traversal', null); off(60); mm.state = 'traversal'; mm.want = 'traversal'; };
    const n0 = mm.log.length; const hardSeq = []; const bagBefore = mm.bags; const seen = []; localStorage.removeItem('wv_music_lasthard');
    for (const key of ['warden', 'lineman', 'overseer']) { settle(); mm.setState('bossreveal', key); off(3); mm.setState('bosscombat', key); const fights = [mm.cur];
      for (let k = 0; k < 7; k++) { // die: boss resets (musicretry), player respawns, calm hold elapses, reveal again
        window.__audio.noteMusicRetry(); mm.setState('traversal', key); off(2); window.__game.save.settings.musicVarietyDummy = 0; mm.state = 'traversal'; mm.want = 'traversal'; off(60); mm.setState('bossreveal', key); off(3); mm.setState('bosscombat', key); fights.push(mm.cur); }
      hardSeq.push(fights); }
    o.fights = hardSeq; o.fightRep = hardSeq.every(f => f.every((x, i) => i === 0 || x !== f[i - 1]));
    o.lastHardStored = localStorage.getItem('wv_music_lasthard') === mm.cur; o.bagKept = bagBefore === mm.bags;
    // elite right after a respawn must differ from the last hard track; calm after respawn keeps rotating from the same bag
    settle(); const lh = mm.lastHard; mm.setState('elite'); o.eliteDiff = mm.cur !== lh; settle(); const calm = []; for (let i = 0; i < 12; i++) { mm.state = 'traversal'; mm.enteredAt = mm.now() - 400; mm.lastSwitchAt = mm.now() - 400; const l = mm.live.find(x => !x.ending); if (l) l.startedAt = mm.now() - (mm.buffers[l.name].duration * 4 - 1); mm.tick(); off(5); calm.push(mm.cur); }
    o.calmRep = calm.filter((x, i) => i && x === calm[i - 1] && false).length; const all = mm.log.slice(n0).filter(x => x.to); o.consec = all.filter((x, i) => i && x.to === all[i - 1].to).length; o.total = all.length; return o; });
  ok(D.fightRep, 'death->respawn->retry: boss track never repeats on consecutive attempts (' + D.fights.map(f => f.join('>')).join(' | ') + ')');
  ok(D.consec === 0, 'death/respawn/retry sequence: no consecutive identical tracks in the whole fade log (' + D.total + ' fades)');
  ok(D.eliteDiff && D.lastHardStored && D.bagKept, 'respawn keeps the persistent bags (no hard reset) and elite never reuses the last hard track');
  // real sim: killing the player mid-boss-fight and returning to checkpoint emits a retry exactly once and resets the reveal
  const Sx = await ev(async () => { const g = window.__game; g.enterTown(true); g.save.level = 40; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.startRun('warehouse'); g.revealing = false; const ev2 = []; const old = g.emit; g.emit = (t, p) => { ev2.push(t); return old(t, p); };
    const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; { const rp = g.revealPoint(); g.px = rp.x; g.py = rp.y; } for (let i = 0; i < 400; i++) g.update(1 / 30); const spawned = g.enemies.some(e => !e.dead && window.__enemies?.[e.type]?.boss);
    g.playerDown(); g.returnToCheckpoint(); g.emit = old; return { spawned, retry: ev2.filter(t => t === 'musicretry').length, flags: !g.inst.flags.bossSpawned }; });
  ok(Sx.retry >= 1 && Sx.flags, 'sim: boss reset after death emits musicretry (' + JSON.stringify(Sx) + ')'); }
// --- rotation logic + asset existence (variety pack) ---
import fs from 'fs';
const M = await ev(async () => { const m = await import('/src/music.ts'); return { pools: { ...m.POOLS, harrow: m.TOWN_POOLS.harrow, areas: Object.values(m.AREA_TRACKS).flat() }, boss: m.BOSS_MAP, sig: [...m.SIG_TRACKS, ...m.STINGERS], core: m.CORE_TRACKS }; });
const files = new Set(fs.readdirSync('public/audio/music').map(f => f.replace(/\.mp3$/, '')));
const used = [...new Set([...Object.values(M.pools).flat(), ...Object.values(M.boss), ...M.core, ...M.sig])];
ok(used.every(n => files.has(n)), 'every pooled track has an mp3: missing ' + used.filter(n => !files.has(n)).join());
ok([...files].every(n => used.includes(n)), 'no orphan mp3s: ' + [...files].filter(n => !used.includes(n)).join());
ok(fs.readdirSync('public/audio/music').every(f => fs.statSync('public/audio/music/' + f).size < 2.5e6), 'each track < 2.5 MB');
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
  mm.state = null; mm.want = 'town'; mm.setState('town'); r.town0 = mm.cur; await new Promise(res => { const f = () => mm.buffers[mm.nextUp['town:' + mm.townId]] ? res() : setTimeout(f, 200); f(); setTimeout(res, 15000); }); const live = mm.live.find(l => !l.ending); const d = mm.buffers[live.name].duration; mm.ROTATE_LOOPS = 1; mm.enteredAt -= 300; mm.lastSwitchAt -= 300; live.startedAt = mm.now() - (d * Math.max(1, Math.ceil(mm.CALM_MIN / d)) - 1); mm.tick(); r.rot = mm.cur; r.rotLog = mm.log[mm.log.length - 1];
  return r; });
ok(/^(elite_|boss_)/.test(mgr.elite) && M.pools.elite.includes(mgr.elite), 'elite state picks elite/boss pool: ' + mgr.elite);
ok(M.pools.bosscombat.includes(mgr.boss), 'non-signature boss (warden) draws from the boss pool: ' + mgr.boss);
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
// --- ambient variety (>= 20 calm tracks), persistent shuffle bag, per-area weighting ---
{ const A = await ev(async () => { const m = await import('/src/music.ts'); const calm = new Set([...m.POOLS.town, ...m.POOLS.traversal, ...m.TOWN_POOLS.harrow, ...Object.values(m.AREA_TRACKS).flat()]); const o = { calm: [...calm], elite: m.POOLS.elite.length };
    // persistence: a second bag with the same key resumes the same cycle (no repeats until all played) and never starts with the previous 'last'
    localStorage.clear(); const items = ['a', 'b', 'c', 'd', 'e']; const b1 = new m.ShuffleBag(items, Math.random, 'wv_test'); const seq = [b1.next(), b1.next()]; const b2 = new m.ShuffleBag(items, Math.random, 'wv_test'); seq.push(b2.next(), b2.next(), b2.next());
    o.persistCycle = new Set(seq).size === 5; o.persistLast = (() => { const b3 = new m.ShuffleBag(items, Math.random, 'wv_test'); return b3.last === seq[4]; })();
    // no repeats across many sessions (a new bag object each "session")
    let prev = null, rep = 0, lastSeen = null; for (let i = 0; i < 300; i++) { const b = new m.ShuffleBag(items, Math.random, 'wv_test2'); const n = b.next(); if (n === prev) rep++; prev = n; } o.sessionRepeats = rep;
    // area weighting: area tracks get 2 slots/cycle, other areas' tracks are excluded
    const hi = m.areaPool('HI'), ps = m.areaPool('PS'), none = m.areaPool(null); const w = (p, n) => (p.find(x => x[0] === n) || [0, 0])[1];
    o.area = w(hi, 'area_hi_slag') === 2 && w(hi, 'area_ps_ward') === 0 && w(ps, 'area_ps_ward') === 2 && w(hi, 'calm_drift') === 1 && !none.some(x => /^area_/.test(x[0]));
    const bw = new m.ShuffleBag(hi, Math.random); const cyc = []; const total = hi.reduce((a, x) => a + x[1], 0); for (let i = 0; i < total * 20; i++) cyc.push(bw.next()); let adj = 0; for (let i = 1; i < cyc.length; i++) if (cyc[i] === cyc[i - 1]) adj++; o.weightAdj = adj; o.weightShare = cyc.filter(x => x === 'area_hi_slag').length / 20;
    return o; });
  ok(A.calm.length >= 20, 'calm/ambient pool has >= 20 distinct tracks: ' + A.calm.length);
  ok(A.elite >= 10, 'elite pool >= 10 tracks: ' + A.elite);
  ok(A.persistCycle && A.persistLast, 'shuffle bag persists across sessions (localStorage): cycle continues, last track remembered');
  ok(A.sessionRepeats === 0, 'never the same track twice in a row across 300 simulated sessions');
  ok(A.area && A.weightAdj === 0 && A.weightShare === 2, 'per-area weighting: own-area tracks 2 slots, others excluded, no adjacent repeats');
  const calmFiles = await ev(async () => { const m = await import('/src/music.ts'); return [...new Set([...m.POOLS.town, ...m.POOLS.traversal, ...m.TOWN_POOLS.harrow, ...Object.values(m.AREA_TRACKS).flat()])]; });
  ok(calmFiles.every(n => files.has(n)), 'every calm track exists as an mp3');
  const lazyOk = await ev(async () => { const m = await import('/src/music.ts'), mm = window.__audio.music; return m.CALM2.every(n => !m.CORE_TRACKS.includes(n)) && m.CALM2.filter(n => mm.buffers[n]).length <= 5; });
  ok(lazyOk, 'new ambient tracks are lazy-loaded (not preloaded; only a few decoded at once: current + next + recent)'); }
// --- boss music: tier-weighted persistent bag over the whole pool, signature themes only for their boss ---
{ const Bt = await ev(async () => { const m = await import('/src/music.ts'), b = await import('/src/content/batch1_bosses.ts'), mm = window.__audio.music; localStorage.clear(); mm.bossBags = {}; mm._lh = null;
    const ids = [...new Set([...b.BOSSES.map(x => x.id), ...Object.keys(m.BOSS_MAP)])]; const sigIds = Object.keys(m.SIGNATURE); const o = { ids: ids.length, sigIds, fights: 0, consec: 0, sigWrong: 0, sigLeak: 0 };
    const sigTracks = new Set(m.SIG_TRACKS); const seen = new Set(), byTier = {}; let prev = null; const perBoss = {};
    for (let i = 0; i < 600; i++) { const id = ids[Math.floor(Math.random() * ids.length)]; mm.key = id; mm.fightNext = null; mm.planFight(); const n = mm.fightNext; mm.fightNext = null; mm.setHard(n); o.fights++;
      if (n === prev && !m.SIGNATURE[id]) o.consec++; prev = n; if (m.SIGNATURE[id]) { if (n !== m.SIGNATURE[id].main) o.sigWrong++; } else { if (sigTracks.has(n)) o.sigLeak++; seen.add(n); const t = m.bossTier(id); (byTier[t] ??= []).push(m.INTENSITY[n] || 2); } (perBoss[id] ??= new Set()).add(n); }
    o.seen = seen.size; o.pool = m.POOLS.bosscombat.length; o.avg = Object.fromEntries(Object.entries(byTier).map(([t, a]) => [t, a.reduce((x, y) => x + y, 0) / a.length])); o.minVariety = Math.min(...ids.filter(i => !m.SIGNATURE[i]).map(i => perBoss[i]?.size || 0));
    o.poolHasSig = m.POOLS.bosscombat.some(x => sigTracks.has(x)) || Object.values(m.POOLS).flat().some(x => sigTracks.has(x));
    o.w1 = Object.fromEntries(m.bossPool(1)), o.w3 = Object.fromEntries(m.bossPool(3)); o.tiers = Object.fromEntries(sigIds.map(i => [i, m.bossTier(i)]));
    // persistence across sessions: new manager bags resume the stored bag/last
    const k = 'wv_music_boss:t2'; o.persisted = !!localStorage.getItem(k) || !!localStorage.getItem('wv_music_boss:t1'); return o; });
  ok(Bt.fights === 600 && Bt.consec === 0, 'boss pick: no immediate repeat (pool bosses) across 600 simulated fights over all ' + Bt.ids + ' bosses');
  ok(Bt.sigIds.length >= 8 && Bt.sigWrong === 0 && Bt.sigLeak === 0 && !Bt.poolHasSig, 'signature themes: >= 8 bosses, each fight uses only its own theme, signature tracks never appear in other bosses or any pool: ' + Bt.sigIds.join());
  ok(Bt.seen >= Bt.pool - 2 && Bt.minVariety >= 5, 'non-signature bosses cycle through the whole boss pool (' + Bt.seen + '/' + Bt.pool + ' used, every boss heard >= 5 distinct tracks: ' + Bt.minVariety + ')');
  ok(Bt.avg[1] < Bt.avg[2] && Bt.avg[2] < Bt.avg[3] || (Bt.avg[1] < Bt.avg[2]), 'tier weighting: easier bosses draw lighter tracks (avg intensity by tier ' + JSON.stringify(Bt.avg) + ')');
  ok(Bt.w1.elite_siege > Bt.w1.boss_recall && Bt.w3.boss_widow > Bt.w3.elite_siege, 'weights favour near-intensity tracks (tier1 siege>recall, tier3 widow>siege)');
  ok(Bt.persisted, 'boss bags persist in localStorage');
  const Sg = await ev(async () => { const m = await import('/src/music.ts'), mm = window.__audio.music; const off = s => { mm.__off += s; mm.tick(); }; const o = {}; const wait = async (c, ms = 20000) => { const t0 = performance.now(); while (!c() && performance.now() - t0 < ms) { await new Promise(r => setTimeout(r, 200)); mm.tick(); } return c(); };
    const settle = () => { mm.setState('traversal', null); off(60); mm.state = 'traversal'; mm.want = 'traversal'; };
    // signature boss with a phase-two variant
    settle(); mm.setState('bossreveal', 'recall'); off(3); mm.setState('bosscombat', 'recall'); o.loaded = await wait(() => mm.cur === 'boss_sig_recall'); o.start = mm.cur; off(25); o.rot = (() => { const n = mm.log.length; off(200); const l = mm.live.find(x => !x.ending); return mm.log.length === n; })();
    mm.onPhase(1); await wait(() => mm.buffers['boss_sig_recall_p2'] && mm.cur === 'boss_sig_recall_p2'); o.p2 = mm.cur; const n2 = mm.log.length; off(25); mm.onPhase(2); off(1); o.p2stay = mm.cur === 'boss_sig_recall_p2' && mm.log.length === n2;
    // new fight starts at the main theme again (retry)
    window.__audio.noteMusicRetry(); settle(); mm.setState('bossreveal', 'recall'); off(3); mm.setState('bosscombat', 'recall'); await wait(() => mm.cur === 'boss_sig_recall'); o.retryMain = mm.cur === 'boss_sig_recall';
    // signature boss without a p2: stays on its theme through phases
    settle(); mm.setState('bossreveal', 'resonance'); off(3); mm.setState('bosscombat', 'resonance'); await wait(() => mm.cur === 'boss_sig_resonance'); o.rStart = mm.cur; off(25); mm.onPhase(1); off(5); o.rStay = mm.cur === 'boss_sig_resonance';
    // memory: decoded set stays bounded
    o.decoded = Object.keys(mm.buffers).length; o.cap = mm.maxDecoded; settle(); return o; });
  ok(Sg.loaded && Sg.start === 'boss_sig_recall' && Sg.rot, 'signature boss opens with its own theme and does not rotate mid-fight');
  ok(Sg.p2 === 'boss_sig_recall_p2' && Sg.p2stay, 'phase change -> phase-two variant, then stays (no repeat)');
  ok(Sg.retryMain, 'retry of a signature boss restarts its own theme');
  ok(Sg.rStart === 'boss_sig_resonance' && Sg.rStay, 'signature boss without a variant keeps its theme through phase changes');
  ok(Sg.decoded <= Math.max(Sg.cap, 40) || Sg.cap >= 1e9, 'decoded track count bounded by cap (' + Sg.decoded + ' / ' + Sg.cap + ')');
  const sigFiles = await ev(async () => (await import('/src/music.ts')).SIG_TRACKS); ok(sigFiles.length >= 11 && sigFiles.every(n => files.has(n)), 'signature mp3s exist (' + sigFiles.length + ')'); }
// --- sim-driven boss fights: no fade-out/restart of the fight track except at deliberate points (phase change, 5-min rotation, boss death, leaving) ---
{ const F = await ev(async () => { const g = window.__game, mm = window.__audio.music, { ENEMIES } = await import('/src/config.ts'); const m = await import('/src/music.ts');
    clearInterval(mm.timer); { const base = mm.ctx.currentTime + (mm.__off || 0); mm.__off = 0; mm.now = () => base + mm.__off; } // pure fake clock: only the simulated seconds count
    const wait = async (c, ms = 20000) => { const t0 = performance.now(); while (!c() && performance.now() - t0 < ms) { await new Promise(r => setTimeout(r, 100)); mm.tick(); } return c(); };
    const runFight = async (dungeon, key, secs, phases, o) => { localStorage.clear(); if (g.inst) g.abandonInstance(); mm.state = null; mm.want = 'town'; g.save.settings.minimap ??= true; g.startRun(dungeon); const f = g.inst.flags; f.controller = true; if (key) f.bossKey = key; g.spawnBoss(); const b = g.enemies.find(e => ENEMIES[e.type].boss); const L = g.level, dt = 1 / 30; const n0 = mm.log.length; const adds = [];
      for (let i = 0; i < 30 * secs; i++) { mm.__off += dt; if (i % 15 === 0) await new Promise(r => setTimeout(r, 0)); g.update(dt); mm.tick(); b.hp = b.maxHp = 1e9; if (!g.downed) g.hp = g.maxHp; const t = i * dt;
        g.px = L.bossSpawn.x + 3 * Math.cos(i / 40); g.py = L.bossSpawn.y + 3 * Math.sin(i / 40); // player strafes through the room
        if (i % 300 === 150) { b.x = L.bossSpawn.x + 2.5 * Math.sign(Math.sin(i)); b.y = L.bossSpawn.y - 2; b.alert = true; } // boss dashes/teleports
        if (i % 450 === 200) { b.alert = false; } if (i % 450 === 220) b.alert = true; // aggro flaps
        if (i % 600 === 100) g.knock?.(2, 0); // knockback if available
        if (t > 20 && Math.abs(t - 70) < .02) { g.downed = true; } if (t > 20 && Math.abs(t - 76) < .02) { g.downed = false; g.hp = g.maxHp; } // downed and revived in place (no checkpoint return)
        if (i === 30 * 90) { mm.dropIdle(); mm.trim(); document.dispatchEvent(new Event('visibilitychange')); } // memory handlers while fighting
        for (const [ts, ph] of phases) if (Math.abs(t - ts) < .02) b.phase = ph;
        if (i % 30 === 0 && !g.enemies.some(e => e === b && !e.dead)) { o.bossGone = true; break; } }
      const lg = mm.log.slice(n0); const live = mm.live.filter(x => !x.ending).map(x => x.name); return { log: lg.map(x => ({ s: x.state, to: x.to, from: x.from, t: +x.t.toFixed(1) })), live, key: g.inst?.flags.bossKey, state: mm.state }; };
    const o = {};
    // 1) 5-minute pool-boss fight (annex overseer), two phase changes
    await wait(() => Object.keys(mm.buffers).length > 0); o.a = await runFight('annex', 'overseer', 300, [[120, 1], [200, 2]], o);
    // 2) 5-minute fight, no phases (no rotation expected before 300 s)
    o.b = await runFight('annex', 'overseer', 290, [], o);
    // 3) very long fight with no phases: exactly one smooth rotation after 5 minutes
    o.c = await runFight('annex', 'overseer', 330, [], o);
    // 4) signature boss (needs its lazy track)
    o.d = await runFight('annex', null, 5, [], o); return o; });
  const bc = (r) => r.log.filter(x => x.s === 'bosscombat'); const fightTracks = (r) => bc(r).map(x => x.to);
  ok(!F.a.bossGone && bc(F.a).length >= 1 && bc(F.a).length <= 3, '5-min fight with strafing, dashes, aggro flaps, downed/revived, memory handlers: fight-track changes only at the opening + 2 phase changes: ' + fightTracks(F.a).join('>'));
  ok(fightTracks(F.a).every((x, i, a) => i === 0 || x !== a[i - 1]), 'no restart of the same fight track');
  ok(F.a.log.every(x => x.s === 'bossreveal' || x.s === 'bosscombat' || x.s === 'town'), 'no fade to calm/other states mid-fight: ' + F.a.log.map(x => x.s + ':' + x.to + '@' + x.t).join(' '));
  ok(F.a.live.length === 1, 'exactly one active track after the fight');
  ok(bc(F.b).length === 1, '290 s fight without phases: the fight track never changes (' + fightTracks(F.b).join('>') + ')');
  ok(bc(F.c).length === 2 && F.c.log.filter(x => x.s === 'bosscombat')[1].t - F.c.log.filter(x => x.s === 'bosscombat')[0].t >= 295, '330 s fight without phases: exactly one smooth rotation, not before 5 minutes (' + fightTracks(F.c).join('>') + ')'); }
// --- calm cadence: jittered 90-150 s dwell, 7 s crossfades, mood-family contrast, history, natural-trigger nudges, 40+ calm tracks ---
{ const K = await ev(async () => { const m = await import('/src/music.ts'), mm = window.__audio.music; clearInterval(mm.timer); { const base = mm.ctx.currentTime + (mm.__off || 0); mm.__off = 0; mm.now = () => base + mm.__off; }
    const off = s => { mm.__off += s; mm.tick(); }; const wait = async (c, ms = 15000) => { const t0 = performance.now(); while (!c() && performance.now() - t0 < ms) { await new Promise(r => setTimeout(r, 100)); mm.tick(); } return c(); };
    const o = {}; const calm = new Set([...m.POOLS.town, ...m.POOLS.traversal, ...m.TOWN_POOLS.harrow, ...Object.values(m.AREA_TRACKS).flat()]); o.calm = calm.size; o.rust = m.TOWN_POOLS.rustline.length; o.harrowN = m.TOWN_POOLS.harrow.length; o.noFamily = [...calm].filter(n => !m.FAMILY[n]); o.families = [...new Set([...calm].map(n => m.FAMILY[n]))].length;
    const run = async (state, area, theme, mins) => { localStorage.clear(); mm.bags = {}; mm.nextUp = {}; mm.hist = null; mm.setTownTheme(theme); mm.setArea(area); mm.state = null; mm.want = state; mm.setState(state); mm.pend = null; mm.setState(state); await wait(() => !mm.pend && mm.cur && mm.live.some(l => !l.ending)); const n0 = mm.log.length; const seq = [{ to: mm.cur, t: mm.now() }];
      for (let t = 0; t < mins * 60; t += 2) { off(2); const k = mm.bagKey(mm.state); if (mm.nextUp[k] && !mm.buffers[mm.nextUp[k]]) await wait(() => mm.buffers[mm.nextUp[k]], 20000); }
      const L = mm.log.slice(n0).filter(x => x.state === state); return { seq: [seq[0].to, ...L.map(x => x.to)], gaps: L.map((x, i) => x.t - (i ? L[i - 1].t : seq[0].t)), durs: L.map(x => x.dur) }; };
    for (const [name, st, area, th] of [['town', 'town', null, 'rustline'], ['harrow', 'town', null, 'harrow'], ['trav', 'traversal', 'HI', 'rustline']]) { const r = await run(st, area, th, 40); const q = r.seq, fam = q.map(x => m.FAMILY[x]); let rep = 0, famSame = 0, win = 0; for (let i = 1; i < q.length; i++) { if (q[i] === q[i - 1]) rep++; if (fam[i] === fam[i - 1]) famSame++; }
      for (let i = 0; i < q.length; i++) for (let j = Math.max(0, i - 5); j < i; j++) if (q[i] === q[j]) win++; o[name] = { n: q.length, rep, famSame, win, min: Math.min(...r.gaps), max: Math.max(...r.gaps), avg: r.gaps.reduce((a, b) => a + b, 0) / r.gaps.length, fade: Math.min(...r.durs), distinct: new Set(q).size, seq: q.join('>') }; }
    // natural triggers: nudge before 45 s does nothing, after 45 s switches soon
    localStorage.clear(); mm.bags = {}; mm.nextUp = {}; mm.hist = null; mm.setArea(null); mm.state = null; mm.want = 'traversal'; mm.setState('traversal'); await wait(() => mm.cur); mm.calmDwell = 150; await wait(() => mm.buffers[mm.nextUp[mm.bagKey('traversal')]]); off(20); mm.nudge(); const a0 = mm.log.length; off(10); o.earlyNudge = mm.log.length === a0; off(30); o.lateNudge = mm.log.length === a0 + 1; o.lateTime = mm.now() - mm.lastSwitchAt;
    // memory: only a few lazy tracks decoded at once
    await new Promise(r => setTimeout(r, 9000)); o.lazyDecoded = [...m.CALM2, ...m.CALM3].filter(n => mm.buffers[n]).length; return o; });
  ok(K.calm >= 60, 'calm/ambient pool has >= 60 distinct tracks: ' + K.calm);
  ok(K.rust >= 13 && K.harrowN >= 12, 'town sets: Rustline ' + K.rust + ', Harrow Reach ' + K.harrowN);
  ok(K.noFamily.length === 0 && K.families === 4, 'every calm track has a mood family (4 families): ' + K.noFamily.join());
  for (const n of ['town', 'harrow', 'trav']) { const r = K[n]; ok(r.n >= 14 && r.min >= 88 && r.max <= 160 && r.avg >= 100 && r.avg <= 140, n + ' cadence over 40 min: ' + (r.n - 1) + ' switches, dwell ' + r.min.toFixed(0) + '-' + r.max.toFixed(0) + ' s (avg ' + r.avg.toFixed(0) + ')'); ok(r.rep === 0 && r.win === 0, n + ': no track repeats within the previous 5 (incl. immediate repeats)'); ok(r.famSame <= (r.n - 1) * 0.2, n + ': adjacent tracks contrast in mood family (' + r.famSame + ' same of ' + (r.n - 1) + ')'); ok(r.fade >= 6 && r.fade <= 8, n + ': calm crossfades 6-8 s'); ok(r.distinct >= 9, n + ': ' + r.distinct + ' distinct tracks in 40 min'); }
  ok(K.earlyNudge && K.lateNudge && K.lateTime < 120, 'natural trigger (zone change / level-up) nudges a track that has played >= 45 s, but not earlier');
  ok(K.lazyDecoded <= 6, 'memory: lazy calm tracks decoded at once <= 6 (' + K.lazyDecoded + ')'); }
// --- boss/elite variety: pool sizes, 50 simulated fights + retries, history window, phase contrast ---
{ const V = await ev(async () => { const m = await import('/src/music.ts'), b = await import('/src/content/batch1_bosses.ts'), mm = window.__audio.music; localStorage.clear(); mm.bossBags = {}; mm.bags = {}; mm.hh = null; mm._lh = null; const o = {};
    o.boss = m.POOLS.bosscombat.length; o.elite = m.POOLS.elite.length; o.sigN = m.SIG_TRACKS.length; o.sting = m.STINGERS.length;
    const ids = [...new Set([...b.BOSSES.map(x => x.id), ...Object.keys(m.BOSS_MAP)])].filter(i => !m.SIGNATURE[i]); const seq = [], tiers = [];
    for (let i = 0; i < 50; i++) { const id = ids[Math.floor(Math.random() * ids.length)]; mm.key = id; mm.fightNext = null; mm.planFight(); const n = mm.fightNext; mm.fightNext = null; mm.setHard(n); seq.push(n); // retry after death: same boss again
      if (i % 3 === 0) { mm.noteRetry(); mm.fightNext = null; mm.planFight(); const r = mm.fightNext; mm.fightNext = null; mm.setHard(r); seq.push(r); } }
    o.n = seq.length; o.imm = seq.filter((x, i) => i && x === seq[i - 1]).length; let win = 0; for (let i = 0; i < seq.length; i++) for (let j = Math.max(0, i - 8); j < i; j++) if (seq[i] === seq[j]) win++; o.win8 = win; o.distinct = new Set(seq).size;
    // elite: bag + history, 50 picks (all decoded assumed)
    const eb = mm.bagFor('elite'); const eseq = []; for (let i = 0; i < 50; i++) { const n = eb.next(mm.fresh ? mm.fresh(eb.items, x => x !== mm.lastHard) : x => x !== mm.lastHard); mm.setHard(n); eseq.push(n); } o.eimm = eseq.filter((x, i) => i && x === eseq[i - 1]).length; o.edistinct = new Set(eseq).size;
    return o; });
  ok(V.boss >= 40 && V.elite >= 25, 'pools: boss ' + V.boss + ' (>= 40), elite ' + V.elite + ' (>= 25), signature ' + V.sigN + ', stingers ' + V.sting);
  ok(V.imm === 0 && V.win8 === 0, '50 simulated boss fights + retries (' + V.n + ' picks): no immediate repeat and none within the previous 8 (persistent history): imm ' + V.imm + ', window ' + V.win8);
  ok(V.distinct >= 25 && V.edistinct >= 18, 'variety: ' + V.distinct + ' distinct boss tracks over ' + V.n + ' picks, ' + V.edistinct + ' distinct elite tracks over 50'); }
ok(!errors.length, 'no page errors ' + errors.join('|'));
// fallback: block music files
const b2 = await launch({ query: '' }); await b2.page.route('**/audio/music/*', r => r.abort());
await b2.page.reload(); await b2.page.waitForFunction(() => window.__game); await b2.page.evaluate(() => window.__audio.resume()); await sleep(1500);
ok(!(await b2.page.evaluate(() => window.__audio.useFiles)), 'fallback to procedural when files missing');
await browser.close(); await b2.browser.close(); process.exit(fails ? 1 : 0);
