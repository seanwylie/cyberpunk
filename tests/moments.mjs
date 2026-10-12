// Shareable moments (docs/MOMENTS.md): once-per-session selection, PNG card capture, WebM clip from the rolling buffer (flagged),
// buffer memory cap, frame-time budget with the buffer on, flag off = nothing allocated, Share/Copy/Download panel fits (ui_overflow style). Needs the dev server.
import { launch, sleep } from './lib.mjs'; import fs from 'fs'; import { PNG } from 'pngjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync('shots', { recursive: true });
// ---- pure selection ----
{ const { build } = await import('esbuild'); const out = '/tmp/wv_mom_' + process.pid + '.mjs'; await build({ entryPoints: ['src/moments.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' }); const M = await import(out); fs.unlinkSync(out);
  const s = { best: null, captures: 0 }; const c = { stats: {}, code: 'WVB1.x' };
  const a = M.offer(s, { kind: 'gateway_clear' }, c); const b = M.offer(s, { kind: 'flawless_boss' }, c); const d = M.offer(s, { kind: 'nemesis_kill' }, c); const e = M.offer(s, { kind: 'orange_drop' }, c); const z = M.offer(s, { kind: 'bogus' }, c);
  ok(a && !b && d && !e && !z && s.best.kind === 'nemesis_kill' && s.captures === 1, 'one moment per session; a strictly better moment replaces it, lesser / unknown ones are ignored');
  const s2 = { best: null, captures: 0 }; M.offer(s2, { kind: 'flawless_boss' }, c); ok(M.offer(s2, { kind: 'nemesis_kill' }, c, true) === null, 'after sharing, the captured moment is locked'); }
// ---- flag off: nothing allocated ----
{ const { browser, page, errors } = await launch({ init: () => { window.__WV_FEATURES = { moments: true, momentClip: false }; } });
  const r = await page.evaluate(() => ({ buf: !!window.__moments?.clipBuf, rec: typeof MediaRecorder })); ok(!r.buf, 'clip buffer flag off (default): no MediaRecorder / buffer allocated');
  await browser.close(); }
// ---- flag on: card + clip, perf + memory ----
const { browser, page, errors } = await launch({ init: () => { window.__WV_FEATURES = { moments: true, momentClip: false, nemesis: false }; } }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove());
await ev(() => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.level = 30; g.save.settings.devFreeReset = true; g.recompute(); g.startRun('annex', 3); });
const frameStats = (ms) => ev(ms => new Promise(res => { const d = []; let last = performance.now(); const t0 = last; const f = (n) => { d.push(n - last); last = n; if (n - t0 < ms) requestAnimationFrame(f); else { d.sort((a, b) => a - b); res({ p50: d[Math.floor(d.length * .5)], p95: d[Math.floor(d.length * .95)], n: d.length }); } }; requestAnimationFrame(f); }), ms);
const off = await frameStats(3000);
await ev(() => { window.__WV_FEATURES.momentClip = true; window.__moments.syncClip(); });
await sleep(1500); const on = await frameStats(3000);
const mem = await ev(() => { const b = window.__moments.clipBuf; return { running: b.running, bytes: b.bytes(), cap: b.budget?.maxBytes ?? 3145728, peak: b.stats.peakBytes, segs: b.stats.segments, js: b.stats.jsMaxMs }; });
ok(mem.running && mem.peak <= mem.cap && mem.bytes <= mem.cap, `clip buffer stays under its memory cap (${(mem.peak / 1048576).toFixed(2)} MB peak, cap ${(mem.cap / 1048576).toFixed(1)} MB, ${mem.segs} segments)`);
const load = (await import('os')).loadavg()[0] / (await import('os')).cpus().length; // a saturated shared box makes timing meaningless: report, don't gate
if (load > 1.5) console.log(`INFO recorder callbacks worst main-thread slice ${mem.js.toFixed(2)} ms (box load ${load.toFixed(1)}x cores, not gated)`); else ok(mem.js < 4, `recorder callbacks stay off the frame path: worst main-thread slice ${mem.js.toFixed(2)} ms (< 4 ms)`);
if (load > 1.5) console.log(`INFO frame time (box load ${load.toFixed(1)}x cores, not gated): p95 ${off.p95.toFixed(1)} -> ${on.p95.toFixed(1)} ms, p50 ${off.p50.toFixed(1)} -> ${on.p50.toFixed(1)} ms`);
else ok(on.p50 <= Math.max(off.p50 * 1.15, off.p50 + 2) && on.p95 <= Math.max(off.p95 * 1.25, off.p95 + 4), `frame time with clip buffer on stays in budget (p95 ${off.p95.toFixed(1)} -> ${on.p95.toFixed(1)} ms, p50 ${off.p50.toFixed(1)} -> ${on.p50.toFixed(1)})`);
// hard cap enforcement: tiny cap forces drops and self-shutdown, never growth
const cap = await ev(async () => { const C = await import('/src/clipbuf.ts'); const b = new C.ClipBuffer(document.getElementById('game'), { ...C.CLIP_BUDGET, maxBytes: 20000 }); b.start(); const blob = n => new Blob([new Uint8Array(n)], { type: 'video/webm' });
  b.done.push(blob(12000)); b.done.push(blob(12000)); b.enforce(); const afterDone = b.bytes(); b.chunks.push(blob(30000)); b.enforce(); const o = { bytes: b.bytes(), afterDone, running: b.running, why: b.disabledWhy, dropped: b.stats.dropped, peak: b.stats.peakBytes }; b.stop(); b.clear(); return o; });
ok(cap.afterDone <= 20000 && cap.bytes <= 20000 && cap.dropped >= 2 && !cap.running && cap.peak <= 20000, `hard byte cap enforced (tiny 20 KB cap: ${cap.bytes} B kept, ${cap.dropped} dropped, ${cap.running ? 'running' : 'stopped: ' + cap.why})`);
await sleep(4000);
const cap1 = await ev(async () => { const m = window.__moments; m.event({ kind: 'gateway_clear', title: 'Gateway cleared', sub: 'Saltwater Harbor' }); await m.busy; return { kind: m.ses.best?.kind, card: m.card?.size, clip: m.clip?.size, clipType: m.clip?.type, btn: !!document.getElementById('momentBtn') }; });
const cap2 = await ev(async () => { const m = window.__moments; m.event({ kind: 'flawless_boss', title: 'Flawless', sub: 'Annex Overseer' }); const after = m.ses.best.kind; m.event({ kind: 'nemesis_kill', title: 'Killed Vesk the Tailor, who killed you 3 times', sub: "Vesk the Tailor's Mark" }); await m.busy;
  const u8 = new Uint8Array(await m.card.arrayBuffer()); let s = ''; for (const b of u8) s += String.fromCharCode(b); return { after, kind: m.ses.best.kind, captures: m.ses.captures, b64: btoa(s), clip: m.clip?.size }; });
ok(cap1.kind === 'gateway_clear' && cap1.card > 10000 && cap1.btn, `card captured (${(cap1.card / 1024).toFixed(0)} KB PNG) and the Moment button appears`);
ok(cap1.clip > 1000 && /webm/.test(cap1.clipType), `short WebM clip captured from the rolling buffer (${(cap1.clip / 1024).toFixed(0)} KB)`);
ok(cap2.after === 'gateway_clear' && cap2.kind === 'nemesis_kill' && cap2.captures === 1, 'session keeps one capture; nemesis kill outranks the gateway clear');
const png = PNG.sync.read(Buffer.from(cap2.b64, 'base64')); fs.writeFileSync('shots/moment_card.png', Buffer.from(cap2.b64, 'base64'));
ok(png.width === 1200 && png.height === 630, `card is a 1200x630 PNG (${png.width}x${png.height}) -> shots/moment_card.png`);
const clipB64 = await ev(async () => { const b = window.__moments.clip; if (!b) return ''; const u8 = new Uint8Array(await b.arrayBuffer()); let s = ''; for (const x of u8) s += String.fromCharCode(x); return btoa(s); }); if (clipB64) fs.writeFileSync('shots/moment_clip.webm', Buffer.from(clipB64, 'base64'));
ok(clipB64 && Buffer.from(clipB64, 'base64').subarray(0, 4).toString('hex') === '1a45dfa3', 'clip is a standalone WebM (EBML header) -> shots/moment_clip.webm');
// panel UI + actions + overflow at desktop and phone widths
for (const vp of [{ width: 1280, height: 720 }, { width: 390, height: 740 }]) { await page.setViewportSize(vp); await ev(() => window.__moments.open()); await sleep(300);
  const u = await ev(() => { const p = document.getElementById('momentPanel'); const bs = [...p.querySelectorAll('.mp-row button')]; const bad = [...p.querySelectorAll('button,span,.mp-head,.mp-msg')].filter(x => x.scrollWidth > x.clientWidth + 1); const box = p.querySelector('.mp-box').getBoundingClientRect();
    return { labels: bs.map(b => b.textContent), tips: bs.every(b => b.title.length > 10), bad: bad.map(b => b.textContent), inView: box.left >= 0 && box.right <= innerWidth }; });
  ok(u.labels.join(',') === 'Share,Copy,Download,Clip' && u.tips && !u.bad.length && u.inView, `${vp.width}px: Share/Copy/Download/Clip with tooltips, nothing clipped (${u.bad.join('|') || 'ok'})`);
  await page.screenshot({ path: `shots/moment_panel_${vp.width}.png` }); }
const acts = await ev(async () => { const m = window.__moments; const dl = await m.act('png'); const cp = await m.act('copy'); return { dl, cp, shared: m.shared }; });
ok(acts.dl === 'Downloaded.' && /copied|blocked/.test(acts.cp) && acts.shared, `actions work: download "${acts.dl}", copy "${acts.cp}"; sharing locks the moment`);
await ev(() => { window.__WV_FEATURES.momentClip = false; window.__moments.syncClip(); }); ok(await ev(() => !window.__moments.clipBuf), 'turning the setting off stops and frees the buffer');
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 3).join(' | '));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
