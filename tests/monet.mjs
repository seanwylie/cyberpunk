// Monetization levers + exclusives (docs/MONETIZATION.md): line skins, tiers, featured/rotation determinism, starter pack once-only,
// line bundles + collection rewards, season pass (buy, XP from play, claim), retirement (countdown, retire transition, never re-listed,
// never granted again), badges + provenance (wardrobe, build export), no stat effects, store UI tabs. URL=http://localhost:5450/ node tests/monet.mjs
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold', viewport: { width: 1280, height: 720 } });
const ev = (fn, a) => page.evaluate(fn, a);
await ev(async () => { const g = window.__game; g.enterTown(); window.__S = await import('/src/store.ts'); window.__M = await import('/src/monet.ts'); window.__R = await import('/src/retire.ts'); window.__AP = await import('/src/content/appearance.ts'); window.__L = await import('/src/content/skinlines.ts'); window.__A = await import('/src/analytics.ts'); window.__BC = await import('/src/buildcode.ts');
  window.__S.configureMock({ delayMs: 10, failureRate: 0 }); window.__S.resetOrders(); window.__A.resetAnalytics(); window.__R.setClock('2026-10-12'); });
const buy = (id) => ev(async id => { const S = window.__S, s = window.__game.save; const st = S.startPurchase(s, id); if (!st.ok) return { ok: false, why: st.why }; const r = await S.confirmPurchase(s, st.order.orderId); return { ok: r.status === 'success', granted: r.granted, cents: st.order.cents }; }, id);

// ---- data: tiers, lines, ladder, every top skin has a Blender body, epics 2-3, chromas
let r = await ev(() => { const L = window.__L, AP = window.__AP; const lines = L.LINES.map(l => { const sk = AP.COSMETICS.filter(d => d.line === l.id && d.slot === 'skin' && d.src.k === 'shop'); return { id: l.id, top: sk.filter(d => d.tier === 'legendary' || d.tier === 'ultimate').map(d => d.body), epics: sk.filter(d => d.tier === 'epic').length, chromas: AP.COSMETICS.filter(d => d.src.k === 'chroma' && sk.some(s => s.id === d.src.of)).length }; });
  const ladder = ['standard', 'epic', 'legendary', 'ultimate'].map(t => L.TIER[t].cents); return { lines, ladder, noStats: AP.COSMETICS.every(d => !('stats' in d)) }; });
const full = r.lines.filter(l => l.top.length && l.top.every(b => ['hextech', 'bloom', 'ronin', 'founder'].includes(b)) && l.epics >= 1 && l.chromas >= 1);
ok(full.length >= 3, 'at least 3 full lines (Legendary/Ultimate Blender body + epics + chromas): ' + JSON.stringify(r.lines));
ok(r.lines.filter(l => l.top.length).every(l => l.epics >= 2 || l.id === 'founder'), 'each premium line ships 2-3 Epics');
ok(r.ladder.every((c, i) => i === 0 || c > r.ladder[i - 1]), 'tier price ladder escalates: ' + r.ladder);
ok(r.noStats, 'no cosmetic row has a stats field');

// ---- rotation determinism + featured
r = await ev(() => { const M = window.__M; const w = M.weekOf(); const a = M.rotation(w).map(d => d.id), b = M.rotation(w).map(d => d.id), n = M.rotation(w + 1).map(d => d.id); const f = M.featured(w)?.id, f2 = M.featured(w + 1)?.id;
  let allDistinct = true; for (let k = 0; k < 20; k++) { const ids = M.rotation(w + k).map(d => d.id); if (new Set(ids).size !== ids.length || ids.includes(M.featured(w + k)?.id)) allDistinct = false; } return { a, b, n, f, f2, allDistinct }; });
ok(JSON.stringify(r.a) === JSON.stringify(r.b) && r.a.length === 6, 'rotation is deterministic for a week (6 offers)');
ok(JSON.stringify(r.a) !== JSON.stringify(r.n), 'rotation changes next week');
ok(r.f && r.f !== r.f2, 'featured hero skin changes weekly: ' + r.f + ' -> ' + r.f2);
ok(r.allDistinct, '20 weeks: no duplicate offers, hero never repeated in rotation');

// ---- purchase: featured price, gating of legendaries outside rotation, includes, line skin
r = await ev(() => { const M = window.__M, S = window.__S; const hero = M.featured(); const off = window.__AP.COSMETICS.filter(d => d.src.k === 'shop' && (d.tier === 'legendary' || d.tier === 'ultimate') && d.slot === 'skin' && !d.src.window && d.id !== hero.id && !M.rotation().some(x => x.id === d.id)); return { hero: hero.id, p: S.priceFor('line_' + hero.id), list: S.SKU_BY_ID['line_' + hero.id].cents, gated: off.map(d => S.skuAvail(window.__game.save, 'line_' + d.id)) }; });
ok(r.p < r.list, 'featured hero carries the weekly discount: ' + r.p + ' < ' + r.list);
ok(r.gated.every(a => !a.ok && /rotation/.test(a.why)), 'Legendary skins outside featured/rotation say they return in a future rotation: ' + JSON.stringify(r.gated));
const heroId = r.hero; let b = await buy('line_' + heroId);
r = await ev(id => ({ own: window.__AP.ownsCos(window.__game.save, id), inc: window.__M.includesOf(id).every(i => window.__AP.ownsCos(window.__game.save, i)), rc: Object.values(window.__S.storeOf(window.__game.save).receipts).at(-1) }), heroId);
ok(b.ok && r.own && r.inc && r.rc.cents === b.cents, 'buying the hero grants the skin + its bundled recall/pet at the featured price');
ok(!(await buy('line_' + heroId)).ok, 'owned skin cannot be bought twice');
r = await ev(id => { const ch = window.__AP.COSMETICS.find(d => d.src.k === 'chroma' && d.src.of !== id && !window.__AP.ownsCos(window.__game.save, d.src.of)); return window.__S.skuAvail(window.__game.save, 'line_' + ch.id); }, heroId);
ok(!r.ok && /Needs/.test(r.why), 'chroma needs its base skin: ' + r.why);

// ---- starter pack once-only
const lk0 = await ev(() => window.__game.save.purchases.lockerBlocks);
b = await buy('starter_pack'); r = await ev(() => ({ lk: window.__game.save.purchases.lockerBlocks, own: ['pm_ronin_initiate', 'emote_wave', 'pet_drone_scout'].every(i => window.__AP.ownsCos(window.__game.save, i)), again: window.__S.startPurchase(window.__game.save, 'starter_pack') }));
ok(b.ok && r.own && r.lk === lk0 + 1, 'starter pack grants epic skin, emote, pet drone and a locker tier');
ok(!r.again.ok && /Already/.test(r.again.why), 'starter pack is once only: ' + r.again.why);
r = await ev(() => { const S = window.__S, s = window.__game.save; const rid = Object.values(S.storeOf(s).receipts).find(x => x.sku === 'starter_pack').id; const lk = s.purchases.lockerBlocks; const d = S.fulfil(s, 'starter_pack', 'SIM-REPLAY-X', 499); return { lk: s.purchases.lockerBlocks === lk, granted: d.granted.length }; });
ok(r.lk && r.granted === 0, 'starter pack replay with a new receipt still grants nothing (counter guard)');

// ---- collection reward via line bundle
r = await ev(() => window.__M.collections(window.__game.save).find(c => c.line === 'undercity'));
ok(!r.done && !r.claimed, 'undercity collection not complete yet');
b = await buy('linebundle_undercity'); r = await ev(() => ({ c: window.__M.collections(window.__game.save).find(c => c.line === 'undercity'), ev: window.__A.events().filter(e => e.name === 'collection_complete').map(e => e.sku) }));
ok(b.ok && r.c.done && r.c.claimed && b.granted.includes('col_undercity_lantern'), 'line bundle completes the line and grants the collection reward once');
ok(r.ev.length === 1 && r.ev[0] === 'undercity', 'collection_complete tracked once');

// ---- season pass: XP from play (real kills), buy premium, claim both tracks
r = await ev(() => { const M = window.__M, s = window.__game.save; const p = M.passOf(s); p.xp = 0; const g = window.__game; g.startRun('annex'); let k = 0; for (const e of g.enemies.slice(0, 5)) { g.grantKill(e); k++; } g.enterTown(); return { xp: M.passOf(s).xp, k }; });
ok(r.xp >= r.k * 4 && r.xp > 0, 'pass XP comes from play (kills): ' + r.xp);
r = await ev(() => { const M = window.__M, s = window.__game.save; M.passOf(s).xp = 26000; return { lv: M.passLevel(M.passOf(s)), cl: M.claimable(s).map(d => d.src.track) }; });
ok(r.lv === 26 && r.cl.every(t => t === 'free') && r.cl.length >= 2, 'free track claimable without premium: ' + r.cl);
b = await buy('pass_s1'); r = await ev(() => { const M = window.__M, s = window.__game.save; const got = M.claimPass(s); return { prem: M.passOf(s).premium, got, again: M.claimPass(s).length, owned: got.every(i => window.__AP.ownsCos(s, i)) }; });
ok(b.ok && r.prem && r.got.length >= 5 && r.owned && r.again === 0, 'premium pass unlocks the premium track; claims are idempotent: ' + r.got.length);
ok(!(await buy('pass_s1')).ok, 'premium pass cannot be bought twice');

// ---- retirement: countdown, transition, never re-listed, never granted
r = await ev(() => { const R = window.__R, S = window.__S; R.setClock('2026-10-30T12:00:00Z'); const st = R.statusOf('pm_founder_mark'); const a = S.skuAvail(window.__game.save, 'line_pm_founder_mark'); return { st, cd: R.countdown(st.msLeft), a, badge: R.badgeOf('pm_founder_mark') }; });
ok(r.st.s === 'open' && /^2d \d+h$/.test(r.cd) && r.a.ok && r.badge === 'Founder', 'founder skin open with countdown before its window closes: ' + r.cd);
b = await buy('line_pm_founder_mark'); ok(b.ok && b.granted.includes('recall_founder'), 'founder skin can be bought inside its window (with its recall)');
await ev(() => { window.__S.SKU_BY_ID; window.__ui.render(); });
r = await ev(async () => { const g = window.__game; const ST = (await import('/src/storeui.ts')).ST; ST.tab = 'lines'; ST.line = 'founder'; ST.sel = 'line_pm_founder_mark'; window.__ui.open('store'); window.__ui.render(); const t = document.querySelector('[data-countdown]')?.textContent || ''; window.__ui.open(null); return t; });
ok(/Available until Nov 1, 2026 · 2d \d+h left/.test(r), 'store detail shows "Available until <date>" + countdown: ' + r);
r = await ev(async () => { const R = window.__R, S = window.__S, M = window.__M, AP = window.__AP; R.setClock('2026-11-02T00:00:01Z'); const s = window.__game.save;
  const st = R.statusOf('pm_founder_mark'); const a = S.skuAvail(s, 'line_pm_founder_mark'); const start = S.startPurchase(s, 'line_pm_founder_mark'); const g0 = AP.grantCos({}, 'pm_founder_mark');
  const g = window.__game; const ST = (await import('/src/storeui.ts')).ST; ST.tab = 'lines'; ST.line = 'founder'; ST.sel = 'line_pm_founder_mark'; window.__ui.open('store'); window.__ui.render(); const txt = document.querySelector('[data-retired]')?.textContent || ''; window.__ui.open(null);
  return { st, a, start: start.ok, g0, txt, badge: R.badgeOf('pm_founder_mark'), bundle: S.skuAvail(s, 'linebundle_founder') }; });
ok(r.st.s === 'retired' && !r.a.ok && r.a.why === 'Retired' && !r.start, 'after the window closes the founder skin is Retired and cannot be bought');
ok(/Retired · Oct 1, 2026 – Nov 1, 2026/.test(r.txt), 'store shows "Retired" with its original dates: ' + r.txt);
ok(r.g0 === false && !r.bundle.ok, 'a retired id is never granted again (grantCos refuses) and its line bundle is closed');
r = await ev(() => { const M = window.__M, R = window.__R, AP = window.__AP, S = window.__S; const bad = []; const w0 = M.weekOf(R.now());
  const retired = AP.COSMETICS.filter(d => R.isRetired(d.id)).map(d => d.id); for (let w = w0 - 60; w < w0 + 200; w++) { const rot = M.rotation(w).map(d => d.id); const f = M.featured(w)?.id; for (const id of retired) { const T = Date.parse('2026-01-05T00:00:00Z') + w * 6048e5; if (T > Date.parse('2026-11-02') && (rot.includes(id) || f === id)) bad.push(w + ':' + id); } }
  const reg = Object.keys(R.RETIRED); const endedNotListed = AP.COSMETICS.filter(d => d.src.window && Date.parse(d.src.window.until + 'T23:59:59Z') < Date.parse('2026-10-12') && !R.RETIRED[d.id]).map(d => d.id);
  const regInShop = reg.filter(id => S.CATALOG.some(k => ['line', 'skin', 'bundle', 'line_bundle', 'starter'].includes(k.kind) && k.items?.includes(id) && S.skuAvail({ ...window.__game.save }, k.id).ok));
  return { bad, retired, endedNotListed, regInShop, alpha: R.statusOf('ex_alpha_visor').s }; });
ok(r.bad.length === 0, 'no retired id appears in any rotation or featured slot over 260 weeks: ' + r.bad.slice(0, 5));
ok(r.endedNotListed.length === 0, 'every window that has ended is in the permanent RETIRED registry: ' + r.endedNotListed);
ok(r.regInShop.length === 0 && r.alpha === 'retired', 'registry ids are never sellable');
r = await ev(() => { const M = window.__M, R = window.__R; R.setClock('2026-11-02T00:00:01Z'); return M.earnExclusive(window.__game.save, 'world_first_gateway'); });
ok(r === null, 'earn-only exclusive cannot be earned after its window');
r = await ev(() => { const M = window.__M, R = window.__R, s = window.__game.save; R.setClock('2026-10-12'); return [M.earnExclusive(s, 'world_first_gateway'), M.earnExclusive(s, 'world_first_gateway')]; });
ok(r[0] === 'ex_world_first_gateway' && r[1] === null, 'earn-only exclusive granted once inside its window');
r = await ev(() => { const R = window.__R; return { t: R.canTrade('pm_founder_mark'), x: R.canTrade('pm_bloom_courier'), p: R.badgeOf('pass_s1_aura') }; });
ok(!r.t && r.x, 'exclusives are account-bound (no trade); regular skins are not exclusives');

// ---- badges + provenance: wardrobe, build export, nothing has stats
r = await ev(() => { const R = window.__R, s = window.__game.save; R.setClock('2026-11-05'); const ex = window.__BC.exportBuild(s); const code = window.__BC.encodeBuild(ex); const dec = window.__BC.decodeBuild(code); const txt = window.__BC.buildText(dec.build); return { ex: ex.ex, dec: dec.ok && dec.build.ex, txt }; });
const fm = r.ex?.find(e => e.id === 'pm_founder_mark');
ok(fm && fm.badge === 'Founder' && fm.at > 0, 'build export carries exclusives with badge and acquired time');
ok(r.dec && r.dec.length === r.ex.length && /Founder's Mark \[Founder\] Acquired .* · Retired \(Oct 1, 2026 – Nov 1, 2026\)/.test(r.txt), 'build code round-trips exclusives; text shows provenance: ' + (r.txt.split('\n').find(l => l.startsWith('Exclusives')) || '').slice(0, 140));
r = await ev(async () => { const g = window.__game, s = g.save; const W = await import('/src/wardrobeui.ts'); window.__ui.open('wardrobe'); W.WD.tab = 'all'; W.WD.show = 'all'; window.__ui.render(); document.querySelector('[data-act="wd-sel"][data-id="pm_founder_mark"]').click(); const prov = document.querySelector('[data-prov]')?.textContent || ''; const pin = !!document.querySelector('[data-act="wd-pin"]'); const tile = document.querySelector('[data-act="wd-sel"][data-id="pm_founder_mark"] .wdb')?.textContent || ''; window.__ui.open(null); return { prov, pin, tile }; });
ok(/Acquired .* · Retired/.test(r.prov) && r.pin && r.tile === 'F', 'wardrobe shows Founder badge, provenance line and a Showcase pin: ' + r.prov);
r = await ev(async () => { const B = await import('/src/build.ts'), AP = window.__AP, s = window.__game.save; const f = () => JSON.stringify(B.computeBuild(B.installedLayout(s), s.level, s.rep).stats); const a = f(); const c = AP.cosOf(s); const keep = { ...c.equipped }; for (const d of AP.COSMETICS) if (c.owned[d.id]) c.equipped[d.slot] = d.id; window.__game.recompute(); const b2 = f(); c.equipped = keep; return a === b2; });
ok(r, 'wearing every owned premium/exclusive cosmetic leaves build stats unchanged');

// ---- UI: tabs render, analytics funnel events
r = await ev(async () => { const g = window.__game; const ST = (await import('/src/storeui.ts')).ST; window.__R.setClock('2026-10-12'); const out = {}; for (const t of ['featured', 'lines', 'pass']) { ST.tab = t; ST.sel = ''; window.__ui.open('store'); window.__ui.render(); out[t] = { hero: !!document.querySelector('[data-hero]'), rot: document.querySelectorAll('[data-rotation] .tile').length, pass: !!document.querySelector('[data-pass]'), col: !!document.querySelector('[data-col]') }; } window.__ui.open(null); const names = new Set(window.__A.events().map(e => e.name)); return { out, names: ['featured_view', 'rotation_view', 'line_view', 'pass_view', 'pass_claim', 'collection_complete', 'exclusive_earned', 'purchase_success'].filter(n => !names.has(n)) }; });
ok(r.out.featured.hero && r.out.featured.rot === 6 && r.out.lines.col && r.out.pass.pass, 'Featured / Lines / Pass tabs render: ' + JSON.stringify(r.out));
ok(r.names.length === 0, 'funnel analytics instrumented for every lever (missing: ' + r.names + ')');
await ev(() => window.__R.setClock(null));
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 3).join(' | '));
await browser.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
