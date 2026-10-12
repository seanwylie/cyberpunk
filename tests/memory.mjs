// Memory budgets + growth checks (docs/PERF.md). Scenario per tier: boot -> town -> [dungeon run -> town] x ROUNDS, sampling after a forced GC each stage.
// Env: MEM_TIERS=high,medium,low  MEM_ROUNDS=5  MEM_TOWN_S=20  MEM_RUN_S=40  MEM_RUNS=3 (median of runs)  MEM_REPORT=1 (print table only, never fail)  URL=...
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const TIERS = (process.env.MEM_TIERS || 'high,medium,low').split(','), ROUNDS = +(process.env.MEM_ROUNDS || 5), TOWN_S = +(process.env.MEM_TOWN_S || 20), RUN_S = +(process.env.MEM_RUN_S || 40), REPORT = !!process.env.MEM_REPORT;
// Budgets (MB). rss = whole Chrome process tree (renderer+gpu+browser) measured on a headless software-GL box, so it is a loose ceiling; decoded = images+canvases+audio tracked by src/memtrack.ts.
// Re-baselined after the music variety/audio growth (quiet-box measurements, 5 rounds: high peak rss 1360 / decoded ~740, low peak rss 1117 / decoded 500.1); ~12% headroom so box load cannot flip them.
// The load-independent leak gates are heap, decoded (app-tracked), canvas/listener counts and the rss PLATEAU check below; raw rss is only a loose ceiling.
const BUDGET = { high: { rss: 1520, decoded: 850, audio: 250 }, medium: { rss: 1260, decoded: 600, audio: 250 }, low: { rss: 1260, decoded: 600, audio: 250 } };
const GROWTH_MB = { rss: 380, heap: 25, decoded: 90 }; const RSS_PLATEAU_MB = 90; // rss climbs for ~4 rounds (allocator/GL warm-up) then must flatten: last two town samples within 90 MB // allowed drift between round 2 and the last round
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : (REPORT ? 'INFO ' : 'FAIL ')) + m); if (!c && !REPORT) fails++; };
const kids = (root) => { const par = {}; for (const d of fs.readdirSync('/proc')) if (/^\d+$/.test(d)) { try { const st = fs.readFileSync(`/proc/${d}/stat`, 'utf8'); par[d] = st.slice(st.lastIndexOf(')') + 2).split(' ')[1]; } catch {} } const out = [String(root)]; for (let i = 0; i < out.length; i++) for (const [p, pp] of Object.entries(par)) if (pp === out[i]) out.push(p); return out; };
const rssMB = (root) => { let t = 0, ren = 0; for (const p of kids(root)) { try { const s = fs.readFileSync(`/proc/${p}/smaps_rollup`, 'utf8'); const m = +/Pss:\s+(\d+)/.exec(s)[1] / 1024; t += m; if (/--type=renderer/.test(fs.readFileSync(`/proc/${p}/cmdline`, 'utf8'))) ren += m; } catch {} } return { total: Math.round(t), renderer: Math.round(ren) }; };
const mains = () => fs.readdirSync('/proc').filter(d => /^\d+$/.test(d)).filter(d => { try { const c = fs.readFileSync(`/proc/${d}/cmdline`, 'utf8'); return /chrom/i.test(c.split('\0')[0]) && !/--type=/.test(c); } catch { return false; } });
export async function runTier(tier) {
  const before = new Set(mains());
  const { browser, page, errors } = await launch({ viewport: { width: 1920, height: 1080 }, query: '?q=' + tier, init: () => { window.__WV_MEM = 1; } });
  const cdp = await page.context().newCDPSession(page); const pid = mains().find(p => !before.has(p)); const ev = (f, a) => page.evaluate(f, a);
  const sample = async (label) => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); await sleep(300); const s = await ev(() => window.__memSnap()); const c = await cdp.send('Memory.getDOMCounters'); const r = rssMB(pid); const row = { label, rss: r.total, ren: r.renderer, heap: s.jsHeapMB, img: s.imgMB, imgN: s.imgN, cv: s.cvMB, cvN: s.cvN, audio: s.audioMB, audioN: s.audioN, nodes: c.nodes, listeners: c.jsEventListeners, decoded: +(s.imgMB + s.cvMB + s.audioMB).toFixed(1), dirs: s.byDir, big: s.bigImgs.slice(0, 3).map(b => b.mb + 'MB ' + b.src.split('/').slice(-2).join('/')), bigCv: s.bigCvs.slice(0, 3).map(b => b.mb + 'MB ' + b.wh) }; rows.push(row); return row; };
  const rows = []; await sleep(2500);
  await ev(() => { const g = window.__game; g.save.level = 20; g.dbg ??= {}; g.dbg.god = true;  document.getElementById('game').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  await page.mouse.click(900, 500); await sleep(3000); await sample('boot');
  const wander = (secs) => ev(async s => { const g = window.__game; const t0 = performance.now(); let a = 0; while (performance.now() - t0 < s * 1000) { a += 1.3; g.setMove?.(Math.cos(a), Math.sin(a) / 2); g.hp = g.maxHp; await new Promise(r => setTimeout(r, 400)); } g.setMove?.(0, 0); }, secs);
  await ev(() => { const g = window.__game; g.enterTown(true); }); await wander(TOWN_S); await sample('town');
  const dungeons = ['annex', 'foundry', 'annex', 'foundry', 'annex', 'foundry', 'annex'];
  for (let i = 0; i < ROUNDS; i++) {
    await ev(async id => { const g = window.__game; g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.dbg.god = true; g.startRun(id); }, dungeons[i % dungeons.length]);
    await wander(RUN_S); await sample('run' + (i + 1));
    await ev(() => { const g = window.__game; g.enterTown(true); }); await wander(Math.min(TOWN_S, 8)); await sample('town' + (i + 1));
  }
  await browser.close(); return { rows, errors };
}
const fmt = (r) => `${r.label.padEnd(7)} rss ${String(r.rss).padStart(5)} (rend ${String(r.ren).padStart(4)})  heap ${String(r.heap).padStart(6)}  img ${String(r.img).padStart(6)}/${String(r.imgN).padStart(3)}  cv ${String(r.cv).padStart(6)}/${String(r.cvN).padStart(3)}  audio ${String(r.audio).padStart(6)}/${String(r.audioN).padStart(2)}  nodes ${r.nodes} lst ${r.listeners}`;
const all = {};
// Flakiness guard: one run on a loaded shared box can read high (e.g. decoded 863 MB vs the 850 MB budget, Oct 2026): the scenario is wall-clock based, so
// under load music fades/queued decodes overlap and different atlases are resident at the sample point. Each tier runs MEM_RUNS times (default 3) and every
// check uses the MEDIAN across runs. Budgets are NOT raised for this (Sean's rule: never trade performance for features or for test convenience).
const RUNS = Math.max(1, +(process.env.MEM_RUNS || 3)); const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
for (const t of TIERS) {
  const runs = []; const errs = [];
  for (let n = 0; n < RUNS; n++) { const { rows, errors } = await runTier(t); runs.push(rows); errs.push(...errors); console.log(`\n== ${t} run ${n + 1}/${RUNS} ==`); for (const r of rows) console.log(fmt(r)); }
  const rows = runs[runs.length - 1]; all[t] = runs;
  console.log('image MB by dir at end:', JSON.stringify(Object.fromEntries(Object.entries(rows.at(-1).dirs).sort((a, b) => b[1] - a[1]).slice(0, 12)))); console.log('biggest images at end:', rows.at(-1).big.join(' | ')); console.log('biggest canvases at end:', rows.at(-1).bigCv.join(' | '));
  const M = f => { const v = runs.map(f); return { m: med(v), all: v.join('/') }; }; const peak = k => M(rows => Math.max(...rows.map(r => r[k]))); const B = BUDGET[t];
  for (const [k, lim, lbl] of [['rss', B.rss, 'peak process memory'], ['decoded', B.decoded, 'peak decoded images+canvases+audio'], ['audio', B.audio, 'peak decoded music']]) { const p = peak(k); ok(p.m <= lim, `${t}: ${lbl} median ${p.m}MB <= ${lim}MB (runs ${p.all})`); }
  const towns = rs => rs.filter(r => /^town\d/.test(r.label));
  if (towns(rows).length >= 3) { const d = (k) => M(rs => { const tw = towns(rs); return tw.at(-1)[k] - tw[1][k]; });
    for (const [k, lim] of [['rss', GROWTH_MB.rss], ['heap', GROWTH_MB.heap], ['decoded', GROWTH_MB.decoded]]) { const g = d(k); ok(g.m <= lim, `${t}: no growth over repeated runs: ${k} median +${+g.m.toFixed(1)} (runs ${g.all}; limit +${lim})`); }
    if (towns(rows).length >= 4) { const pl = M(rs => { const tw = towns(rs); return tw.at(-1).rss - tw.at(-2).rss; }); ok(pl.m <= RSS_PLATEAU_MB, `${t}: rss plateaus, last two towns median +${pl.m} (runs ${pl.all}, limit +${RSS_PLATEAU_MB}); steady growth would be a leak`); }
    const cv = d('cvN'), ls = d('listeners'); ok(cv.m <= 40, `${t}: canvas count stable, median +${cv.m} (runs ${cv.all})`); ok(ls.m <= 200, `${t}: listeners stable, median +${ls.m} (runs ${ls.all})`); }
  const real = errs.filter(e => !/setPointerCapture/.test(e)); ok(real.length === 0, `${t}: no page errors ${real[0] || ''}`); // setPointerCapture: synthetic mouse click on a touch button, harmless
}
fs.writeFileSync(process.env.MEM_OUT || '/tmp/memory_results.json', JSON.stringify(all, null, 1));
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
