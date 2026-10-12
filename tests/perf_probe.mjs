// Dev probe (not part of npm test): where do canvas ops, ms and HUD DOM mutations go? node tests/perf_probe.mjs [town|dungeon]
import { launch, sleep } from './lib.mjs';
const sc = process.argv[2] || 'town';
const { browser, page } = await launch({ init: () => { window.__WV_PERF_TEST = 1; } }); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 120000 }); await sleep(1000);
const r = await page.evaluate(async sc => {
  const g = window.__game, R = window.__rend, ui = window.__ui; const dt = 1 / 60;
  if (sc === 'dungeon') { g.save.settings.gore = 'bloody'; g.dbg.god = true; g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.settings.devFreeReset = true; g.startRun('foundry', 4242); await new Promise(r => setTimeout(r, 4000));
    const E = window.__enemies; const types = Object.keys(E).filter(k => !E[k].boss && !E[k].summon && E[k].hp > 0).slice(0, 6); for (let i = 0; i < 28; i++) { const e = g.spawnEnemy(types[i % 6], g.px + Math.cos(i * .7) * (2.5 + i % 5 * .7), g.py + Math.sin(i * .7) * (2.5 + i % 5 * .7)); e.alert = true; } }
  if (sc === 'town') { const A = await import('/src/content/appearance.ts'), RR = await import('/src/net/remote_render.ts'); const slots = {}; for (const d of A.COSMETICS) if (d.rarity === 'orange' && !slots[d.slot]) slots[d.slot] = d.id; const cos = Object.values(slots); for (const id of cos) { A.grantCos(g.save, id); A.equipCos(g.save, id); }
    const dr = new RR.RemoteDrawer(R); const L = g.level; const cx = L.spawn.x, cy = L.spawn.y; let t = 0; const crowd = Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, name: 'Runner ' + i, x: cx, y: cy, face: 0, moving: true, look: { cos }, lvl: 30 }));
    const prev = R.netItems; R.netItems = items => { prev?.(items); t += dt; for (let i = 0; i < 12; i++) { const p = crowd[i], a = t * .6 + i * .52, rr = 2 + (i % 4) * 1.1; p.x = cx + Math.cos(a) * rr; p.y = cy + Math.sin(a) * rr * .8; items.push({ d: p.x + p.y, f: () => window.__probeSec('remote', () => dr.draw(p, { x: g.px, y: g.py }, false)) }); } }; }
  const ops = {}, ms = {}; let cur = ['root']; const c = R.ctx; for (const m of ['drawImage', 'fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'putImageData', 'clearRect']) { const o = c[m]; c[m] = function (...a) { const k = cur[cur.length - 1] + '.' + m; ops[k] = (ops[k] || 0) + 1; return o.apply(this, a); }; }
  window.__probeSec = (n, f) => { cur.push(n); const a = performance.now(); try { return f(); } finally { ms[n] = (ms[n] || 0) + performance.now() - a; cur.pop(); } };
  const proto = Object.getPrototypeOf(R); for (const m of Object.getOwnPropertyNames(proto)) { if (m === 'constructor' || m === 'draw' || typeof R[m] !== 'function' || /^s[xy]$|^screenToWorld$/.test(m)) continue; const o = R[m]; R[m] = function (...a) { return window.__probeSec(m, () => o.apply(this, a)); }; }
  const muts = {}; const mo = new MutationObserver(l => { for (const x of l) { const el = x.target.nodeType === 3 ? x.target.parentElement : x.target; const k = (el?.id || el?.className || el?.tagName) + ':' + x.type + (x.attributeName ? '.' + x.attributeName : ''); muts[k] = (muts[k] || 0) + 1; } }); mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  const N = 60; const hudMs = []; for (let i = 0; i < N; i++) { g.update(dt); R.draw(dt); const a = performance.now(); ui.hud(); hudMs.push(performance.now() - a); if (sc === 'dungeon' && i % 6 === 0) { const e = g.enemies.find(e => !e.dead); if (e) g.hurtEnemy(e, 1e6, g.px, g.py, 2); } }
  await new Promise(r => setTimeout(r, 0)); mo.disconnect();
  const top = (o, n = 25) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => k + ' ' + (+(v / N).toFixed(2)));
  return { ops: top(ops), ms: top(ms, 30), muts: top(muts, 30), hud: (hudMs.reduce((a, b) => a + b, 0) / N).toFixed(2) };
}, sc);
console.log(JSON.stringify(r, null, 1)); await browser.close();
