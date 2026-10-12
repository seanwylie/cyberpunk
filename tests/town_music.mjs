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
  ok(q.filter(x => x === 'town').length <= 1, theme + ': intro/town track plays at most once in 30 min');
  ok(R.gaps.length >= 11 && Math.max(...R.gaps) <= 165 && Math.min(...R.gaps) >= 55, theme + ': rotation cadence ' + Math.min(...R.gaps).toFixed(0) + '-' + Math.max(...R.gaps).toFixed(0) + ' s');
  ok(R.loops.length > 0 && R.loops.every(l => l === false), theme + ': no loop flag on any town music source (' + R.loops.length + ' sources)');
  ok(R.live === 1, theme + ': exactly one active track at the end');
}
ok(!errors.length, 'no page errors ' + errors.join('|'));
await browser.close(); process.exit(fails ? 1 : 0);
