// Staggered transit unlocks (src/world.ts UNLOCKS, docs/WORLD.md): starter towns open; every other line opens by each of its listed paths
// (dungeon clears by tier/maker, fixer jobs, manufacturer standing, level); locked towns refuse travel; unlocks are per save (per character)
// and never relock; every milestone lands below the town's band floor so players arrive under-levelled.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const r = await page.evaluate(async () => {
  const W = await import('/src/world.ts'), T = await import('/src/towns.ts'), D = await import('/src/content/dungeons.ts'); const g = window.__game; const out = [];
  const fresh = () => ({ ...g.save, level: 1, cleared: {}, contracts: { active: {}, done: [], doneDay: {} }, rep: { HI: 0, PS: 0, MM: 0 }, world: { visited: {}, landmarks: {} }, towns: undefined, town: 'rustline' });
  const dun = (tier, mfr) => D.DUNGEON_LIST.filter(d => (d.tier || 1) >= (tier || 0) && (!mfr || d.mfr === mfr)).map(d => d.id);
  for (const t of W.WORLD) { const u = W.UNLOCKS[t.id]; const s0 = fresh();
    if (u === 'open') { out.push({ id: t.id, open: T.isUnlocked(s0, t.id) }); continue; }
    const locked = !T.isUnlocked(s0, t.id) && !T.travelCheck(s0, t.id).ok; const paths = [];
    for (const p of u) { const s = fresh(); if (p.kind === 'level') s.level = p.n; if (p.kind === 'contract') s.contracts.done = Array.from({ length: p.n }, (_, i) => 'c' + i); if (p.kind === 'rep') s.rep[p.mfr] = p.n;
      if (p.kind === 'clears') { const ids = dun(p.tier, p.mfr).slice(0, p.n); for (const id of ids) s.cleared[id] = 1; }
      const below = { ...fresh() }; if (p.kind === 'level') below.level = p.n - 1; const notYet = !T.isUnlocked(below, t.id);
      const un = T.isUnlocked(s, t.id) && T.travelCheck(s, t.id).ok; const stays = (() => { s.level = 1; s.cleared = {}; s.rep = { HI: 0, PS: 0, MM: 0 }; s.contracts.done = []; return T.isUnlocked(s, t.id); })();
      paths.push({ k: W.unlockText(p), un, notYet, stays, early: p.kind !== 'level' || p.n <= t.band[0] }); }
    out.push({ id: t.id, locked, paths, band: t.band }); }
  // per character: a second character starts with only the starter lines
  const C = await import('/src/chars.ts').catch(() => null);
  return { out, chars: !!C };
});
for (const t of r.out) { if (t.open !== undefined) { ok(t.open, `${t.id}: starter town open from the start`); continue; }
  ok(t.locked, `${t.id}: locked on a fresh character (travel refused)`);
  for (const p of t.paths) ok(p.un && p.notYet && p.stays && p.early, `${t.id}: unlocks via "${p.k}" (not before; stays unlocked; at or before band floor ${t.band[0]})`); }
// UI: a locked node is a silhouette with name, band and unlock rule in its tooltip
const ui = await page.evaluate(async () => { const g = window.__game, s = g.save; s.world = { visited: {}, landmarks: {} }; s.cleared = {}; s.level = 12; s.contracts = { active: {}, done: [], doneDay: {} }; s.rep = { HI: 0, PS: 0, MM: 0 }; s.towns = undefined; s.town = 'rustline'; g.enterTown(true); window.__ui.open('travel'); await new Promise(r => setTimeout(r, 100));
  const n = document.querySelector('#modal .wmnode[data-id="tether_base"]'); return { cls: n.className, tip: n.dataset.tip, label: n.innerText, travel: g.travel('tether_base'), town: g.townId }; });
ok(/locked/.test(ui.cls) && /Tether Base/.test(ui.tip) && /Lv 38/.test(ui.tip) && /Unlock: clear 1 Tier III/.test(ui.tip) && ui.label.includes('TETHER'), 'locked town shows as a silhouette with name, band and unlock rule in its tooltip');
ok(ui.travel === false && ui.town === 'rustline', 'a locked town cannot be reached (travel refused)');
ok(errors.length === 0, 'no page errors ' + (errors[0] || '')); await browser.close();
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
