// Performance gate (docs/PERF_BUDGETS.md). Deterministic, seeded scenarios measured in headless Chrome, compared against hard budgets AND the committed
// baseline (perf/baseline.json): any budget breach, or a >10% regression of a gated metric beyond its noise tolerance, fails.
//   node tests/perf_gate.mjs            fast subset (npm test): desktop town crowd + dungeon combat + world map, static sizes, multiplayer bytes/sec
//   node tests/perf_gate.mjs --full     + throttled mobile profile (CPU 4x, 844x390), production bundle (vite build), load time, GC pauses
//   --record   write the measured numbers as the new perf/baseline.json (only after an intentional, reviewed change)   --json FILE   dump results
//   --report   print only, never fail.   Env: URL=http://host:port/ (else a private vite dev server is started on PERF_PORT, default 5199)
// Determinism: Math.random is seeded (mulberry32), every dungeon uses a fixed layout seed, the sim advances with a fixed dt, and the remote-player crowd is scripted.
// Wall-clock noise: timing metrics are normalised by an in-page CPU calibration loop (so a loaded box does not fail the gate), each scenario is sampled up to
// 3 times and the best sample counts (load only ever adds time), and timing metrics get a wider noise tolerance than the op/byte counters (exactly reproducible).
import { chromium } from 'playwright-core'; import fs from 'fs'; import path from 'path'; import { spawn, execSync } from 'child_process'; import os from 'os';
const A = process.argv.slice(2), FULL = A.includes('--full') || !!process.env.PERF_FULL, RECORD = A.includes('--record'), REPORT = A.includes('--report') || !!process.env.PERF_REPORT;
const JSON_OUT = A.includes('--json') ? A[A.indexOf('--json') + 1] : null; const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASE_F = path.join(ROOT, 'perf/baseline.json'), BUD = JSON.parse(fs.readFileSync(path.join(ROOT, 'perf/budgets.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms)); let fails = 0; const lines = [];
// Box-load guard: absolute wall-clock budgets (frame p95, GC pause, load time) and timing regressions are only ENFORCED on a quiet box
// (1-min loadavg per core <= PERF_QUIET, default 1.25) or with PERF_STRICT=1. On a loaded shared box they are printed as INFO; the deterministic
// counters (draw calls, DOM mutations, heap, decoded textures, particles, bundle, network bytes) are always enforced.
const LOADPC = os.loadavg()[0] / os.cpus().length, QUIET = !!process.env.PERF_STRICT || LOADPC <= +(process.env.PERF_QUIET || 1.25);
const okT = (c, m) => { if (QUIET) return ok(c, m); const s = (c ? 'PASS ' : 'INFO ') + m + ` [timing not enforced: load ${LOADPC.toFixed(1)}/core]`; console.log(s); lines.push(s); };
const ok = (c, m) => { const s = (c ? 'PASS ' : (REPORT ? 'INFO ' : 'FAIL ')) + m; console.log(s); lines.push(s); if (!c && !REPORT) fails++; };
// ---------- dev server
let BASE_URL = process.env.URL, dev = null;
if (!BASE_URL) { const port = +(process.env.PERF_PORT || 5199); BASE_URL = `http://127.0.0.1:${port}/`; let up = false; try { up = (await fetch(BASE_URL)).ok; } catch { }
  if (!up) { dev = spawn(path.join(ROOT, 'node_modules/.bin/vite'), ['--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore', detached: true });
    for (let i = 0; i < 120 && !up; i++) { await sleep(500); try { up = (await fetch(BASE_URL)).ok; } catch { } } if (!up) { console.log('FAIL perf_gate: dev server did not start on ' + port); process.exit(1); } } }
const stopDev = () => { if (dev) try { process.kill(-dev.pid); } catch { } }; process.on('exit', stopDev);
// ---------- in-page helpers (seed + instrumentation)
const INIT = () => { let s = 0x9e3779b9 ^ 1337; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { localStorage.setItem('wv_nograce', '1'); localStorage.setItem('wv_notut', '1'); } catch { } window.__WV_MEM = 1; window.__WV_PERF_TEST = 1; };
async function open(prof) {
  const exe = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const ctx = await browser.newContext({ viewport: prof.vp, deviceScaleFactor: 1, hasTouch: !!prof.touch, isMobile: !!prof.touch }); const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); await page.route('**/api/story-beat', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
  await page.addInitScript(INIT); const cdp = await ctx.newCDPSession(page); const t0 = Date.now();
  await page.goto(BASE_URL + '?seed=1337', { waitUntil: 'load' }); await page.waitForFunction(() => window.__game && window.__rend?.town?.ready, null, { timeout: 120000 }); const loadMs = Date.now() - t0;
  await page.evaluate(() => { document.getElementById('splash')?.remove(); window.__ui?.close?.(); }); await sleep(800);
  if (prof.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: prof.cpu });
  return { browser, page, cdp, errors, loadMs };
}
// calibration: fixed JS workload (ms). Timing metrics are reported raw and as "cal units" = ms / calibration, so box load cancels out.
// the measured frame: the same work as main.ts frame() (sim update, render, HUD), fixed dt; then a 1px readback forces the (software) raster so it is counted
const SCEN = async ({ name, frames, warm }) => { var tour = null, hop = null;
  const CAL = () => { const t = performance.now(); let x = 0; const a = new Float64Array(4096); for (let k = 0; k < 1200; k++) for (let i = 0; i < 4096; i++) { a[i] = Math.sqrt(i * k + x); x += a[(i * 7) & 4095] * 1e-9; } return performance.now() - t + (x > 1e99 ? 1 : 0); };
  const g = window.__game, R = window.__rend, ui = window.__ui; const imp = async m => { try { return await import(m); } catch { return {}; } }; const FX = await imp('/src/cosfx.ts'), GO = await imp('/src/gore.ts');
  const P = { countOps(c) { const M = ['drawImage', 'fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'putImageData', 'clearRect']; const n = { total: 0, drawImage: 0 }; for (const m of M) { const o = c[m]; c[m] = function (...a) { n.total++; if (m === 'drawImage') n.drawImage++; return o.apply(this, a); }; } return { stop() { for (const m of M) delete c[m]; return n; } }; },
    snapshot() { const gc = GO.GORE?.counts?.() || {}; return { particles: FX.liveParticles ? FX.liveParticles() : 0, gore: (gc.decals || 0) + (gc.chunks || 0) + (gc.drops || 0) }; } };
  const dt = 1 / 60; const step = () => { g.update(dt); R.draw(dt); ui.hud(); };
  if (name === 'town') {
    const A = await import('/src/content/appearance.ts'), RR = await import('/src/net/remote_render.ts'); const slots = {}; for (const d of A.COSMETICS) if (d.rarity === 'orange' && !slots[d.slot]) slots[d.slot] = d.id; const cos = Object.values(slots);
    for (const id of cos) { A.grantCos(g.save, id); A.equipCos(g.save, id); }
    const dr = new RR.RemoteDrawer(R); const L = g.level; const cx = L.spawn.x, cy = L.spawn.y; let t = 0; const crowd = Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, name: 'Runner ' + i, x: cx, y: cy, face: 0, moving: true, look: { cos, body: undefined }, lvl: 30 }));
    const prev = R.netItems; R.netItems = items => { prev?.(items); t += dt; const me = { x: g.px, y: g.py }; for (let i = 0; i < crowd.length; i++) { const p = crowd[i], a = t * .6 + i * .52, rr = 2 + (i % 4) * 1.1; const nx = cx + Math.cos(a) * rr, ny = cy + Math.sin(a) * rr * .8; p.face = Math.atan2(ny - p.y, nx - p.x); p.x = nx; p.y = ny; items.push({ d: p.x + p.y, f: () => dr.draw(p, me, false) }); } };
    const path = [[cx, cy], ...L.interacts.slice(0, 6).map(i => [i.x, i.y]), [cx, cy]]; let pi = 0; g.px = cx; g.py = cy;
    var move = () => { const tg = path[pi]; const dx = tg[0] - g.px, dy = tg[1] - g.py, d = Math.hypot(dx, dy); if (d < .3) pi = (pi + 1) % path.length; else { g.px += dx / d * .08; g.py += dy / d * .08; } };
  } else if (name === 'dungeon') {
    g.save.settings.gore = 'bloody'; g.dbg.god = true; g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.settings.devFreeReset = true; g.startRun('foundry', 4242);
    for (let i = 0; i < 400 && !(g.mode === 'dungeon' && g.level && R.ready !== false); i++) await new Promise(r => setTimeout(r, 50)); await new Promise(r => setTimeout(r, 1500));
    const E = window.__enemies; const types = Object.keys(E).filter(k => !E[k].boss && !E[k].summon && E[k].hp > 0).slice(0, 6); let k = 0;
    const pack = () => { for (let i = 0; i < 28; i++) { const a = i * 0.7, r = 2.5 + (i % 5) * .7; const e = g.spawnEnemy(types[k++ % types.length], g.px + Math.cos(a) * r, g.py + Math.sin(a) * r); e.alert = true; } };
    pack(); try { const b = g.spawnEnemy(g.dd.defaultBoss, g.px + 4, g.py + 1); b.alert = true; b._rt.reveal = 0; } catch { } g.revealing = false;
    let f = 0; var move = () => { f++; g.hp = g.maxHp; if (f % 6 === 0) { const e = g.enemies.find(e => !e.dead && !E[e.type].boss); if (e) g.hurtEnemy(e, 1e6, g.px, g.py, 2); else pack(); } if (f % 3 === 0) { const b = g.enemies.find(e => !e.dead && E[e.type].boss); if (b) g.hurtEnemy(b, b.maxHp * .002, g.px, g.py, 0); } };
  } else if (name === 'worldtour') { // travel town to town (lazy town art + music swaps); timing frames are split across the towns
    var tour = ['neon_mile', 'the_stacks', 'salt_harbor', 'harrow', 'rustline']; const w = (g.save.world ??= { visited: {}, landmarks: {} }); for (const t of tour) (w.unlocked ??= {})[t] = 1;
    var hop = async t => { g.travel(t); for (let i = 0; i < 600 && !(g.townId === t && R.town?.ready); i++) await new Promise(r => setTimeout(r, 50)); for (let i = 0; i < 10; i++) step(); };
    let a = 0; var move = () => { a += .05; g.px += Math.cos(a) * .03; g.py += Math.sin(a) * .03; };
  } else if (name === 'worldmap') {
    const it = g.level.interacts.find(i => i.opens === 'travel'); g.px = it.x; g.py = it.y; g.update(.05); g.interact(); var move = () => { if (ui.modal !== 'travel') { g.interact(); } };
  }
  for (let i = 0; i < warm; i++) { move(); step(); }
  // pass 1: draw-call / DOM counters (exactly reproducible)
  const ops = P.countOps(R.ctx); let mut = 0; const mo = new MutationObserver(l => { mut += l.length; }); mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  const N1 = 40; for (let i = 0; i < N1; i++) { move(); step(); await Promise.resolve(); } await new Promise(r => setTimeout(r, 0)); mo.disconnect(); const counts = ops.stop(); const sn = P.snapshot();
  // pass 2: timing
  const S = [], T = []; const cal0 = (() => { const c = []; for (let i = 0; i < 5; i++) c.push(CAL()); return c.sort((a, b) => a - b)[2]; })();
  for (let i = 0; i < frames; i++) { if (tour && i % Math.ceil(frames / tour.length) === 0) await hop(tour[Math.floor(i / Math.ceil(frames / tour.length))]); move(); const a = performance.now(); step(); const b = performance.now(); R.ctx.getImageData(0, 0, 1, 1); S.push(b - a); T.push(performance.now() - a); }
  const cal1 = (() => { const c = []; for (let i = 0; i < 5; i++) c.push(CAL()); return c.sort((a, b) => a - b)[2]; })(); const cal = Math.min(cal0, cal1);
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2); };
  const mem = window.__memSnap ? window.__memSnap() : {};
  return { cal: +cal.toFixed(2), submit: { p50: q(S, .5), p95: q(S, .95), p99: q(S, .99) }, frame: { p50: q(T, .5), p95: q(T, .95), p99: q(T, .99) },
    drawCalls: Math.round(counts.total / N1), drawImage: Math.round(counts.drawImage / N1), domMut: +(mut / N1).toFixed(2), particles: sn.particles, gore: sn.gore, enemies: g.enemies.filter(e => !e.dead).length,
    heapMB: +((performance.memory?.usedJSHeapSize || 0) / 1048576).toFixed(1), texMB: +((mem.imgMB || 0) + (mem.cvMB || 0)).toFixed(1), audioMB: mem.audioMB || 0, canvas: R.canvas.width + 'x' + R.canvas.height };
};
// GC pauses during the timing pass: devtools trace, V8 GC events
async function traced(cdp, fn) {
  const ev = []; const h = e => { for (const x of e.value) if (/^(MajorGC|MinorGC|V8\.GC_SCAVENGER|V8\.GC_MARK_COMPACTOR|V8\.GCScavenger|V8\.GCFinalizeMC)$/.test(x.name) && x.dur) ev.push(x); }; cdp.on('Tracing.dataCollected', h);
  await cdp.send('Tracing.start', { categories: 'v8,devtools.timeline,disabled-by-default-v8.gc', transferMode: 'ReportEvents' }); const r = await fn(); const done = new Promise(res => cdp.once('Tracing.tracingComplete', res)); await cdp.send('Tracing.end'); await done; cdp.off('Tracing.dataCollected', h);
  const top = ev.filter(e => /^(MajorGC|MinorGC)$/.test(e.name)); const use = top.length ? top : ev; const d = use.map(e => e.dur / 1000); r.gc = { n: d.length, maxMs: +(Math.max(0, ...d)).toFixed(2), totalMs: +d.reduce((s, v) => s + v, 0).toFixed(1) }; return r;
}
const PROFILES = { desktop: { vp: { width: 1280, height: 720 }, cpu: 1 }, mobile: { vp: { width: 844, height: 390 }, cpu: 4, touch: true } };
const SCENES = ['town', 'dungeon', 'worldtour', 'worldmap'];
const results = { quiet: QUIET, loadPerCore: +LOADPC.toFixed(2), when: new Date().toISOString(), git: (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return '?'; } })(), load: +os.loadavg()[0].toFixed(1), profiles: {} };
const ONLY_P = process.env.PERF_PROFILES?.split(','), ONLY_S = process.env.PERF_SCENES?.split(',');
for (const pn of ONLY_P || (FULL ? ['desktop', 'mobile'] : ['desktop'])) {
  const prof = PROFILES[pn]; const out = results.profiles[pn] = {};
  for (const sc of ONLY_S || SCENES) {
    let best = null; for (let att = 1; att <= +(process.env.PERF_TRIES || 3); att++) {
      const { browser, page, cdp, errors, loadMs } = await open(prof);
      try { const frames = pn === 'mobile' ? 60 : 120; const r = await traced(cdp, () => page.evaluate(SCEN, { name: sc, frames, warm: 30 })); r.loadMs = loadMs; r.errors = errors.slice(0, 3);
        await cdp.send('HeapProfiler.collectGarbage'); r.heapAfterGcMB = +((await page.evaluate(() => performance.memory?.usedJSHeapSize || 0)) / 1048576).toFixed(1);
        if (!best || r.submit.p95 / r.cal < best.submit.p95 / best.cal) best = r; }
      catch (e) { best = best || { error: String(e).slice(0, 300) }; } finally { await browser.close(); }
      const B = BUD.profiles[pn]; if (best && !best.error && best.submit.p95 <= B.submitP95 && best.gc.maxMs <= B.gcMaxMs) break; // retry only a miss
    }
    out[sc] = best; const r = best;
    if (r.error) { ok(false, `${pn}/${sc}: scenario error ${r.error}`); continue; }
    console.log(`  ${pn}/${sc} [${r.canvas}]: submit p50/p95/p99 ${r.submit.p50}/${r.submit.p95}/${r.submit.p99} ms | frame+raster ${r.frame.p50}/${r.frame.p95}/${r.frame.p99} ms | cal ${r.cal} ms | draw calls ${r.drawCalls} (${r.drawImage} drawImage) | DOM mutations/frame ${r.domMut} | particles ${r.particles} gore ${r.gore} | heap ${r.heapAfterGcMB} MB tex ${r.texMB} MB | GC n${r.gc.n} max ${r.gc.maxMs} ms | load ${r.loadMs} ms`);
  }
}
// ---------- static sizes: per-town lazy assets (public/), initial bundle (vite build, --full)
const du = d => { let t = 0; if (!fs.existsSync(d)) return 0; for (const f of fs.readdirSync(d, { withFileTypes: true })) t += f.isDirectory() ? du(path.join(d, f.name)) : fs.statSync(path.join(d, f.name)).size; return t; };
const MB = b => +(b / 1048576).toFixed(2); const st = results.static = { townMB: {} };
for (const base of ['public/town', 'public/town2']) if (fs.existsSync(path.join(ROOT, base))) for (const f of fs.readdirSync(path.join(ROOT, base), { withFileTypes: true })) if (f.isDirectory()) st.townMB[base.slice(7) + '/' + f.name] = MB(du(path.join(ROOT, base, f.name)));
st.musicMB = MB(du(path.join(ROOT, 'public/audio/music'))); st.srcKB = +(du(path.join(ROOT, 'src')) / 1024).toFixed(0);
if (FULL && !process.env.PERF_NO_BUILD) { try { const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wvperf-')); process.env.BUILD_SHA ||= 'perf'; const cwd0 = process.cwd(); process.chdir(ROOT); try { const { build } = await import('vite'); await build({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'), publicDir: false, logLevel: 'warn', build: { outDir: tmp, emptyOutDir: true } }); } finally { process.chdir(cwd0); } // publicDir off: art/audio are measured per town below, not copied
  const html = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8'); const ent = [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+\.(?:js|css))"/g)].map(m => m[1]); let js = 0, css = 0, all = 0; const zlib = await import('zlib'); let gz = 0;
  for (const e of ent) { const b = fs.readFileSync(path.join(tmp, e)); if (e.endsWith('.js')) js += b.length; else css += b.length; gz += zlib.gzipSync(b).length; } for (const f of fs.readdirSync(path.join(tmp, 'assets'))) if (f.endsWith('.js')) all += fs.statSync(path.join(tmp, 'assets', f)).size;
  st.bundle = { initialJsKB: +(js / 1024).toFixed(1), initialCssKB: +(css / 1024).toFixed(1), initialGzKB: +(gz / 1024).toFixed(1), allJsKB: +(all / 1024).toFixed(1) }; fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { st.bundle = { error: String(e).slice(0, 200) }; } }
// ---------- multiplayer bytes/sec: 4 clients in one party instance + 12 in a town shard, 6 s, real hub over loopback
try { const { load } = await import('./net_lib.mjs'); const WebSocket = (await import('ws')).default; const { startHub } = await load('server/hub.ts', 'hub'); const { NetClient } = await load('src/net/client.ts', 'client');
  const hub = startHub({ port: 0, host: '127.0.0.1' }); await hub.ready; const url = 'ws://127.0.0.1:' + hub.port(); let up = 0, down = 0; let counting = false;
  class CW extends WebSocket { constructor(...a) { super(...a); this.on('message', d => { if (counting) down += d.length ?? d.byteLength ?? 0; }); } send(d, ...r) { if (counting) up += Buffer.byteLength(d); return super.send(d, ...r); } }
  const mk = () => { const m = new Map(); return { get: k => m.get(k) ?? null, set: (k, v) => m.set(k, v) }; };
  const until = async (f, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return true; await sleep(50); } return false; };
  const cs = Array.from({ length: 12 }, (_, i) => new NetClient({ url, name: 'P' + i, lvl: 20, WS: CW, store: mk() })); cs.forEach(c => c.connect()); await until(() => cs.every(c => c.state === 'online'));
  for (const c of cs) c.send({ t: 'town_join', town: 'rustline' }); await sleep(300);
  const P = cs.slice(0, 4); P[0].createParty(); await until(() => P[0].party?.code); for (const c of P.slice(1)) c.joinParty(P[0].party.code); await until(() => P[0].party?.members.length === 4); P[0].setDungeon('annex'); for (const c of P.slice(1)) c.setReady(true); await sleep(800); P[0].start();
  await until(() => P.every(c => c.inst), 12000); counting = true; const t0 = Date.now(); let k = 0;
  while (Date.now() - t0 < 6000) { k++; cs.slice(4).forEach((c, i) => c.send({ t: 'town_pos', x: 30 + Math.cos(k * .1 + i) * 3, y: 22 + Math.sin(k * .1 + i) * 3, face: k * .1, moving: true })); P.forEach((c, i) => { c.inst?.move?.(Math.cos(k * .2 + i), Math.sin(k * .2 + i), .1); c.inst?.report?.(); }); await sleep(100); }
  const secs = (Date.now() - t0) / 1000; results.net = { clients: 12, partyClients: 4, upBps: Math.round(up / secs / 12), downBps: Math.round(down / secs / 12), totalBps: Math.round((up + down) / secs) };
  cs.forEach(c => { try { c.ws?.close(); } catch { } }); hub.close?.(); console.log(`  network: per client up ${results.net.upBps} B/s, down ${results.net.downBps} B/s (12 clients: 8 town shard + 4-player party)`);
} catch (e) { results.net = { error: String(e).slice(0, 200) }; console.log('  network: ' + results.net.error); }
// ---------- budgets
for (const [pn, sc] of Object.entries(results.profiles)) { const B = BUD.profiles[pn]; for (const [name, r] of Object.entries(sc)) { if (!r || r.error) continue; const SB = { ...B, ...(BUD.scenes?.[name] || {}) };
  okT(r.submit.p95 <= SB.submitP95, `${pn}/${name}: main-thread frame p95 ${r.submit.p95} ms <= ${SB.submitP95} ms`);
  ok(r.drawCalls <= SB.drawCalls, `${pn}/${name}: ${r.drawCalls} canvas draw calls/frame <= ${SB.drawCalls}`);
  ok(r.domMut <= SB.domMutPerFrame, `${pn}/${name}: ${r.domMut} HUD DOM mutations/frame <= ${SB.domMutPerFrame}`);
  ok(r.heapAfterGcMB <= SB.heapMB, `${pn}/${name}: JS heap after GC ${r.heapAfterGcMB} MB <= ${SB.heapMB} MB`);
  ok(r.texMB <= SB.textureMB, `${pn}/${name}: decoded images + canvases ${r.texMB} MB <= ${SB.textureMB} MB`);
  ok(r.particles <= BUD.features.fxParticlePool, `${pn}/${name}: live FX particles ${r.particles} <= pool ${BUD.features.fxParticlePool}`);
  okT(r.gc.maxMs <= SB.gcMaxMs, `${pn}/${name}: longest GC pause ${r.gc.maxMs} ms <= ${SB.gcMaxMs} ms`);
  if (FULL) okT(r.loadMs <= SB.loadMs, `${pn}/${name}: load to first town frame ${r.loadMs} ms <= ${SB.loadMs} ms (dev server)`);
  ok(!r.errors?.length, `${pn}/${name}: no page errors ${r.errors?.[0] || ''}`); } }
for (const [t, mb] of Object.entries(st.townMB)) ok(mb <= BUD.static.perTownMB, `lazy assets ${t}: ${mb} MB <= ${BUD.static.perTownMB} MB`);
if (st.bundle && !st.bundle.error) { ok(st.bundle.initialJsKB <= BUD.static.initialJsKB, `initial JS bundle ${st.bundle.initialJsKB} KB <= ${BUD.static.initialJsKB} KB`); ok(st.bundle.initialGzKB <= BUD.static.initialGzKB, `initial JS+CSS gzip ${st.bundle.initialGzKB} KB <= ${BUD.static.initialGzKB} KB`); } else if (FULL) ok(false, 'bundle build: ' + st.bundle?.error);
if (results.net && !results.net.error) ok(results.net.downBps + results.net.upBps <= BUD.net.perClientBps, `multiplayer ${results.net.downBps + results.net.upBps} B/s per client <= ${BUD.net.perClientBps} B/s`); else ok(false, 'network measurement: ' + results.net?.error);
// ---------- regression vs committed baseline (>10% + per-metric noise floor)
const base = fs.existsSync(BASE_F) ? JSON.parse(fs.readFileSync(BASE_F, 'utf8')) : null; const REG = BUD.regression;
const reg = (label, now, was, tol, floor) => { if (was == null || now == null) return; const lim = was * (1 + tol) + floor; ok(now <= lim, `no regression ${label}: ${now} vs baseline ${was} (limit ${+lim.toFixed(2)})`); };
if (base && !RECORD) { for (const [pn, sc] of Object.entries(results.profiles)) for (const [name, r] of Object.entries(sc)) { const b = base.profiles?.[pn]?.[name]; if (!b || !r || r.error) continue;
    reg(`${pn}/${name} draw calls`, r.drawCalls, b.drawCalls, REG.counters, 2); reg(`${pn}/${name} drawImage`, r.drawImage, b.drawImage, REG.counters, 2); reg(`${pn}/${name} DOM mutations/frame`, r.domMut, b.domMut, REG.counters, 1);
    if (QUIET) reg(`${pn}/${name} frame p95 (cal units)`, +(r.submit.p95 / r.cal).toFixed(3), +(b.submit.p95 / b.cal).toFixed(3), REG.counters + REG.timingNoise, .05); reg(`${pn}/${name} heap MB`, r.heapAfterGcMB, b.heapAfterGcMB, REG.counters, 4); reg(`${pn}/${name} texture MB`, r.texMB, b.texMB, REG.counters, 2); }
  if (st.bundle?.initialJsKB && base.static?.bundle?.initialJsKB) reg('initial JS KB', st.bundle.initialJsKB, base.static.bundle.initialJsKB, REG.counters, 5);
  if (results.net?.downBps && base.net?.downBps) reg('net B/s per client', results.net.downBps + results.net.upBps, base.net.downBps + base.net.upBps, REG.counters + REG.netNoise, 100); }
else if (!base) console.log('  (no perf/baseline.json yet: run with --record --full)');
if (RECORD) { const prev = base || {}; const merged = { ...prev, ...results, profiles: { ...(prev.profiles || {}), ...results.profiles }, static: { ...(prev.static || {}), ...st } }; fs.mkdirSync(path.dirname(BASE_F), { recursive: true }); fs.writeFileSync(BASE_F, JSON.stringify(merged, null, 1) + '\n'); console.log('wrote ' + BASE_F); }
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 1));
stopDev(); console.log(fails ? `perf_gate FAIL (${fails})` : 'perf_gate OK'); process.exit(fails ? 1 : 0);
