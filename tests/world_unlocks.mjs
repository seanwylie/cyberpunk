// Epic gateway unlocks (src/world.ts GATEWAYS, docs/WORLD.md): starter towns open; every other town is locked (map silhouette with name, band and
// "Clear <Gateway> to unlock"; travel refused) until this character clears its gateway dungeon, which is enterable from the source town and tuned
// to the destination's entry level. A real grantClear opens the line, the unlock persists across reload and is per character.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove());
const fresh = () => { const g = window.__game, s = g.save; s.level = 12; s.cleared = {}; s.world = { visited: {}, landmarks: {} }; s.towns = undefined; s.town = 'rustline'; s.instance = null; g.inst = null; s.lockouts = {}; s.lastClearDay = null; s.settings.devFreeReset = true; g.enterTown(true); };
await ev(fresh);
const r = await ev(async () => { const W = await import('/src/world.ts'), T = await import('/src/towns.ts'), D = await import('/src/content/dungeons.ts'); const s = window.__game.save; const out = [];
  for (const t of W.WORLD) { const gw = W.GATEWAY_TO[t.id]; if (!gw) { out.push({ id: t.id, starter: W.STARTER_TOWNS.includes(t.id), open: T.isUnlocked(s, t.id) }); continue; } const d = D.DUNGEONS[gw.dungeon];
    out.push({ id: t.id, gw: gw.dungeon, locked: !T.isUnlocked(s, t.id) && !T.travelCheck(s, t.id).ok, host: T.dungeonAccess(gw.dungeon, gw.from).ok, srcReach: W.STARTER_TOWNS.includes(gw.from) || !!W.GATEWAY_TO[gw.from], tuned: Math.abs(d.minLevel - t.band[0]) <= 6, dmin: d.minLevel, band: t.band }); }
  return out; });
for (const t of r) { if (t.gw === undefined) { ok(t.starter && t.open, `${t.id}: starter town open from the start`); continue; }
  ok(t.locked, `${t.id}: locked on a fresh character, transit refused`); ok(t.host && t.srcReach, `${t.id}: gateway ${t.gw} enterable from its source town`); ok(t.tuned, `${t.id}: gateway Lv ${t.dmin} tuned to the town's entry level ${t.band[0]} (±6)`); }
// UI silhouette
let u = await ev(async () => { window.__ui.open('travel'); await new Promise(r => setTimeout(r, 100)); const n = document.querySelector('#modal .wmnode[data-id="tether_base"]'); n.click(); const b = document.querySelector('#modal [data-act="tv-go"]'); const res = { cls: n.className, tip: n.dataset.tip, dis: b.disabled, travel: window.__game.travel('tether_base'), town: window.__game.townId }; window.__ui.close(); return res; });
ok(/locked/.test(u.cls) && /Tether Base/.test(u.tip) && /Lv 38/.test(u.tip) && /Clear Recall Authority Yard to unlock/.test(u.tip), 'locked town is a silhouette with name, band and "Clear <Gateway> to unlock"');
ok(u.dis && u.travel === false && u.town === 'rustline', 'locked town cannot be reached by transit');
// real clear of every gateway through the run path
for (const t of r.filter(x => x.gw)) {
  const c = await ev(async ({ id, gw }) => { const W = await import('/src/world.ts'); const g = window.__game, s = g.save; const G = W.GATEWAY_TO[id]; s.level = 50; (s.world.unlocked ??= {})[G.from] = s.world.unlocked[G.from] || 1; s.instance = null; g.inst = null; s.lockouts = {}; if (g.mode !== 'town') g.enterTown(true); if (g.townId !== G.from) g.travel(G.from);
    const before = window.__T ? null : null; const lockedBefore = g.travel(id) === false; const started = g.startRun(gw); if (!started) return { err: 'startRun failed in ' + g.townId };
    window.__t = []; const o = g.toast.bind(g); g.toast = m => { window.__t.push(m); o(m); }; g.inst.flags.bossDead = true; g.grantClear({ type: 'x', x: g.px, y: g.py }); g.toast = o; g.enterTown(true); const ok2 = g.travel(id);
    return { lockedBefore, ok2, toast: window.__t.find(m => /GATEWAY CLEARED/.test(m)) || '' }; }, t);
  if (c.err) { ok(false, t.id + ': ' + c.err); continue; }
  ok(c.lockedBefore && c.ok2 && /Reach Line to/.test(c.toast), `${t.id}: clearing ${t.gw} unlocks it (set-piece toast) and transit works`); }
// persistence + per character
const p = await ev(async () => { const S = await import('/src/state.ts'); S.persist(window.__game.save); const C = await import('/src/chars.ts'); const a = C.activeCharId(); const nc = C.createChar('Alt', S.newSave); return { a, b: nc.ok ? nc.id : null }; });
await page.reload(); await page.waitForFunction(() => window.__game);
let q = await ev(async () => { const T = await import('/src/towns.ts'); return T.isUnlocked(window.__game.save, 'tether_base'); });
ok(q, 'unlock persists across reload');
if (p.b) { await ev(async id => { const C = await import('/src/chars.ts'); C.selectChar(id); window.__wvNoPersist = true; }, p.b); await page.reload(); await page.waitForFunction(() => window.__game);
  q = await ev(async () => { const T = await import('/src/towns.ts'); const s = window.__game.save; return { u: T.isUnlocked(s, 'tether_base'), h: T.isUnlocked(s, 'salt_harbor') }; }); ok(!q.u && !q.h, 'a second character starts with only the starter lines (unlocks are per character)');
  await ev(async id => { const C = await import('/src/chars.ts'); const S = await import("/src/state.ts"); S.persist(window.__game.save); C.selectChar(id); window.__wvNoPersist = true; }, p.a); await page.reload(); await page.waitForFunction(() => window.__game);
  q = await ev(async () => { const T = await import('/src/towns.ts'); return T.isUnlocked(window.__game.save, 'tether_base'); }); ok(q, 'switching back: the first character still has its unlocks'); }
else ok(false, 'could not create a second character');
ok(errors.length === 0, 'no page errors ' + (errors[0] || '')); await browser.close();
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
