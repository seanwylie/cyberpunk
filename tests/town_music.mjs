// Regression: town soundtrack must rotate (never loop a single track). 30 simulated minutes in town per theme.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ init: () => { window.__WV_MUSIC_ALL = 1; } });
const ev = (f, a) => page.evaluate(f, a);
await ev(() => window.__audio.resume());
await page.waitForFunction(() => window.__audio.useFiles, null, { timeout: 20000 }).catch(() => {});
ok(await ev(() => window.__audio.useFiles), 'music files loaded');
for (const theme of ['rustline', 'harrow']) {
  const R = await ev(async (theme) => {
    const mm = window.__audio.music; clearInterval(mm.timer); localStorage.clear(); mm.bags = {}; mm.nextUp = {}; mm.hist = null;
    const loops = []; const S = AudioBufferSourceNode.prototype; if (!S.__w) { S.__w = true; const o = S.start; S.start = function () { window.__loops ??= []; window.__loops.push(this.loop); return o.apply(this, arguments); }; } window.__loops = [];
    const base = mm.ctx.currentTime + 5; mm.__off = 0; mm.now = () => base + mm.__off;
    const off = s => { mm.__off += s; mm.tick(); };
    const wait = async (c, ms = 20000) => { const t0 = performance.now(); while (!c() && performance.now() - t0 < ms) { await new Promise(r => setTimeout(r, 100)); mm.tick(); } return c(); };
    mm.setTownTheme(theme); mm.state = null; mm.want = 'town'; mm.setState('town'); await wait(() => !mm.pend && mm.cur);
    const n0 = mm.log.length; const seq = [mm.cur]; const times = [mm.now()];
    for (let t = 0; t < 30 * 60; t += 2) { off(2); const k = mm.bagKey(mm.state); if (mm.nextUp[k] && !mm.buffers[mm.nextUp[k]]) await wait(() => mm.buffers[mm.nextUp[k]], 20000); }
    const L = mm.log.slice(n0).filter(x => x.state === 'town'); for (const x of L) { seq.push(x.to); times.push(x.t); }
    return { seq, gaps: times.slice(1).map((t, i) => t - times[i]), loops: window.__loops, pend: !!mm.pend, live: mm.live.filter(l => !l.ending).length };
  }, theme);
  const q = R.seq; let imm = 0, win = 0; for (let i = 1; i < q.length; i++) if (q[i] === q[i - 1]) imm++; for (let i = 0; i < q.length; i++) for (let j = Math.max(0, i - 5); j < i; j++) if (q[i] === q[j]) win++;
  ok(new Set(q).size >= 10, theme + ': >= 10 distinct town tracks in 30 min: ' + new Set(q).size + ' of ' + q.length);
  ok(imm === 0 && win === 0, theme + ': no immediate repeats / none within previous 5');
  { const cnt = {}; for (const x of q) cnt[x] = (cnt[x] || 0) + 1; ok(Math.max(...Object.values(cnt)) <= 2, theme + ': no track (incl. the old intro) plays more than twice in 30 min'); }
  ok(R.gaps.length >= 11 && Math.max(...R.gaps) <= 165 && Math.min(...R.gaps) >= 55, theme + ': rotation cadence ' + Math.min(...R.gaps).toFixed(0) + '-' + Math.max(...R.gaps).toFixed(0) + ' s');
  ok(R.loops.length > 0 && R.loops.every(l => l === false), theme + ': no loop flag on any town music source (' + R.loops.length + ' sources)');
  ok(R.live === 1, theme + ': exactly one active track at the end');
}

// First track must vary (no fixed intro, no boot-order lock) and the persisted bag + history must not repeat across sessions/visits.
for (const theme of ['rustline', 'harrow']) {
  const R2 = await ev(async (theme) => {
    const M = await import('/src/music.ts'); const A = window.__audio; localStorage.clear();
    const seeded = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; /* mulberry32 */
    const orig = Math.random; const firsts = [], plays = [];
    for (let sess = 0; sess < 12; sess++) {          // 12 sessions, each with its own seed; localStorage (bag + history) persists between them
      Math.random = seeded(1000 + sess * 7919);
      const mm = new M.MusicManager(A.ctx || window.__audio.music.ctx, (A.ctx || window.__audio.music.ctx).createGain()); mm.setTownTheme(theme);
      const f = mm.planFirst(); firsts.push(f); delete mm.nextUp[mm.bagKey('town')]; mm.cur = f; mm.noteCalm(f); plays.push(f);
      for (let k = 0; k < 3; k++) { const n = mm.chooseCalm(mm.bagFor('town'), x => x !== mm.cur); /* the rotation draw (prefetch -> nextUp) */ mm.cur = n; mm.noteCalm(n); plays.push(n); }
    }
    // fresh installs: cleared storage, different seeds -> first track differs
    const fresh = []; for (let i = 0; i < 8; i++) { localStorage.clear(); Math.random = seeded(42 + i * 104729); const mm = new M.MusicManager(window.__audio.music.ctx, window.__audio.music.ctx.createGain()); mm.setTownTheme(theme); fresh.push(mm.planFirst()); }
    Math.random = orig; return { firsts, plays, fresh, pool: M.TOWN_POOLS[theme].length, histN: new M.MusicManager(window.__audio.music.ctx, window.__audio.music.ctx.createGain()).HIST_N };
  }, theme);
  ok(R2.pool >= 15, `${theme}: town pool has ${R2.pool} tracks (>= 15)`);
  ok(new Set(R2.firsts).size >= 8, `${theme}: first track varies across 12 seeded sessions (${new Set(R2.firsts).size} distinct)`);
  ok(new Set(R2.fresh).size >= 4 && !R2.fresh.every(x => x === 'town'), `${theme}: fresh installs start on different tracks (${R2.fresh.join(',')})`);
  let rep = 0; for (let i = 0; i < R2.plays.length; i++) for (let j = Math.max(0, i - R2.histN); j < i; j++) if (R2.plays[i] === R2.plays[j]) rep++;
  ok(rep === 0, `${theme}: persisted bag/history: no track repeats within the last ${R2.histN} plays across sessions (${R2.plays.length} plays)`);
}
// No intro lock: a real boot (lazy loading, not the preload-everything test mode) decodes and plays a random first track, not always 'town'.
const boots = [];
for (let i = 0; i < 6; i++) {
  const b = await launch({ init: new Function(`localStorage.clear(); let a=${7 + i * 9973}; Math.random=()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };`) });
  await b.page.evaluate(() => window.__audio.resume()); await b.page.waitForFunction(() => window.__audio.music?.cur, null, { timeout: 20000 }).catch(() => {});
  boots.push(await b.page.evaluate(() => window.__audio.music?.cur)); errors.push(...b.errors); await b.browser.close(); }
ok(boots.every(Boolean) && new Set(boots).size >= 3, 'boot: first town track differs across seeded sessions (' + boots.join(',') + ')');
ok(!/introDone/.test((await import('fs')).readFileSync('src/music.ts', 'utf8')), 'no intro lock in src/music.ts');
ok(!errors.length, 'no page errors ' + errors.join('|'));
await browser.close(); process.exit(fails ? 1 : 0);
