// Aspirational hooks + discovery (docs/WORLD.md): first-visit XP once, faction nod, fixer out-of-depth line, landmark log, sealed high-level gates
// with level + boss teaser (entry refused), elite vendor stock with level locks, discovery state persisted on the (per-character) save.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 }, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
let r = await ev(() => { const g = window.__game, s = g.save; s.level = 12; s.xp = 0; s.world = { visited: {}, landmarks: {}, unlocked: { kestrel_plaza: 1 } }; s.town = 'rustline'; s.instance = null; g.inst = null; g.enterTown(true); window.__t = []; const o = g.toast.bind(g); g.toast = m => { window.__t.push(m); o(m); }; const oe = g.emit.bind(g); g.emit = (t, p) => { if (t === 'toast') window.__t.push(p); return oe(t, p); };
  const xp0 = s.xp, lv0 = s.level, rep0 = s.rep.MM; g.travel('kestrel_plaza'); const a = { xp: s.xp, lv: s.level, rep: s.rep.MM, toasts: window.__t.slice() }; window.__t.length = 0; g.travel('rustline'); g.travel('kestrel_plaza'); return { xp0, lv0, rep0, a, again: window.__t.slice(), xp2: s.xp, lv2: s.level, visited: Object.keys(s.world.visited) }; });
ok((r.a.xp > r.xp0 || r.a.lv > r.lv0) && r.a.rep === r.rep0 + 5 && r.a.toasts.some(t => /Discovered Kestrel Plaza/.test(t)), 'first visit grants bonus XP + Kestrel Value standing: ' + r.a.toasts[0]);
ok(r.a.toasts.some(t => /^Odalys:/.test(t)) && r.again.some(t => /^Odalys:/.test(t)), 'fixer acknowledges the player is out of their depth (level 12 in a Lv 30+ town)');
ok(!r.again.some(t => /Discovered/.test(t)) && r.xp2 === r.a.xp && r.lv2 === r.a.lv, 'second visit: no XP again');
r = await ev(() => { const g = window.__game, s = g.save, L = g.level; const lm = L.landmark; window.__t.length = 0; const xp = s.xp; g.px = lm.x + 1; g.py = lm.y + 3; if (g.solidAt(g.px, g.py)) { g.px = lm.x - 2; g.py = lm.y + 2; } for (let i = 0; i < 70; i++) g.update(.016); g.worldScan(); return { lm: lm.name, logged: !!s.world.landmarks.kestrel_plaza, toast: window.__t.join('|'), d: Math.hypot(g.px - lm.x, g.py - lm.y) }; });
ok(r.logged && /Landmark logged/.test(r.toast), `landmark ${r.lm} logged when the player walks up to it (${r.d.toFixed(1)} tiles)`);
r = await ev(async () => { const g = window.__game, ui = window.__ui; ui.showAll = false; ui.open('gate'); await new Promise(r => setTimeout(r, 100)); const sealed = [...document.querySelectorAll('#modal [data-sealed]')].map(e => ({ id: e.dataset.sealed, txt: e.innerText }));
  const startOk = g.startRun ? null : null; const btn = document.createElement('button'); btn.dataset.act = 'enter'; btn.dataset.id = sealed[0]?.id; document.getElementById('modal').appendChild(btn); btn.click(); await new Promise(r => setTimeout(r, 50)); return { sealed, mode: g.mode, toast: window.__t.slice(-1)[0] }; });
ok(r.sealed.length >= 3 && r.sealed.every(x => /Lv \d+/.test(x.txt) && /Boss: /.test(x.txt) && /Sealed until level/.test(x.txt)), `sealed gates show level, boss and a teaser (${r.sealed.map(x => x.id).join(', ')})`);
ok(r.mode === 'town' && /Sealed until level/.test(r.toast || ''), 'entering a sealed gate is refused: ' + r.toast);
r = await ev(async () => { const ui = window.__ui; ui.close(); ui.open('vendor'); await new Promise(r => setTimeout(r, 100)); const rows = [...document.querySelectorAll('#modal .shoprow')]; const locked = rows.filter(x => /🔒/.test(x.innerText)); return { n: rows.length, locked: locked.length, tip: locked[0]?.querySelector('[data-tip*="Elite"]')?.dataset.tip || '', btn: locked[0]?.querySelector('button')?.disabled }; });
ok(r.n > 0 && r.locked > 0 && /needs level/.test(r.tip) && r.btn, `vendor shows elite stock (${r.locked}/${r.n} rows level-locked with a tooltip, buy disabled)`);
r = await ev(async () => { const ui = window.__ui; ui.close(); ui.open('travel'); await new Promise(r => setTimeout(r, 100)); return document.querySelector('#modal [data-atlas]')?.textContent || ''; });
ok(/Atlas \d+\/\d+ towns · 1\/\d+ landmarks/.test(r), 'transit screen shows the atlas: ' + r);
await ev(() => { window.__ui.close(); window.__game.save.settings && 0; }); await ev(async () => { const S = await import('/src/state.ts'); S.persist(window.__game.save); });
await page.reload(); await page.waitForFunction(() => window.__game); r = await ev(() => ({ v: Object.keys(window.__game.save.world?.visited || {}), l: Object.keys(window.__game.save.world?.landmarks || {}) }));
ok(r.v.includes('kestrel_plaza') && r.l.includes('kestrel_plaza'), 'discovery persists on the save across reload');
ok(errors.length === 0, 'no page errors ' + (errors[0] || '')); await browser.close();
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
