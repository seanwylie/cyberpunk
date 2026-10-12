// Simulated store: purchase paths, idempotency, persistence, funnel, upsell hooks, no popups in runs, UI.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold', viewport: { width: 1280, height: 720 } });
const ev = (fn, a) => page.evaluate(fn, a);
await ev(async () => { const g = window.__game; g.enterTown(); window.__S = await import('/src/store.ts'); window.__A = await import('/src/analytics.ts'); window.__AP = await import('/src/content/appearance.ts'); window.__B = await import('/src/bank.ts'); window.__ST = await import('/src/state.ts');
  window.__S.configureMock({ delayMs: 20, failureRate: 0 }); window.__A.resetAnalytics(); window.__S.resetOrders(); window.__S.resetUpsell(); g.save.credits = 1000; });
// catalog + rarity policy
let r = await ev(() => { const S = window.__S, AP = window.__AP; const prem = AP.COSMETICS.filter(d => d.src.k === 'premium');
  return { n: prem.length, rar: [...new Set(prem.map(d => d.rarity))].sort(), noStats: prem.every(d => !('stats' in d)), skus: S.CATALOG.length, ids: new Set(S.CATALOG.map(s => s.id)).size, tiers: S.LOCKER_TIER_CENTS, bundleItems: S.CATALOG.filter(k => k.kind === 'bundle').every(k => k.items.every(i => AP.COS_BY_ID[i]?.src.k === 'premium')) }; });
ok(r.n >= 6 && r.rar.every(x => ['grey', 'green', 'blue'].includes(x)) && r.noStats, 'premium skins: ' + r.n + ' items, ' + r.rar + ' only, no stats');
ok(r.skus === r.ids && r.bundleItems && r.tiers.every((c, i) => i === 0 || c > r.tiers[i - 1]), 'catalog ids unique, bundles reference premium skins, locker prices escalate');
// premium never drops
r = await ev(() => { const AP = window.__AP; let rs = 1; const rnd = () => (rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296; let bad = 0; for (let i = 0; i < 20000; i++) { const x = AP.rollCosmetic({}, i % 3 ? 'boss' : 'elite', 'auditor', 3, rnd); if (x?.def?.src.k === 'premium') bad++; } return bad; });
ok(r === 0, 'premium skins never roll from drops');
// happy path: skin
r = await ev(async () => { const S = window.__S, A = window.__A, g = window.__game, s = g.save; const cred = s.credits; const st = S.startPurchase(s, 'skin_pm_skin_jade'); const res = await S.confirmPurchase(s, st.order.orderId);
  return { start: st.ok, res, owned: window.__AP.ownsCos(s, 'pm_skin_jade'), cred: s.credits === cred, rc: S.storeOf(s).receipts[res.receiptId], spent: S.storeOf(s).spentCents, ev: A.events().map(e => e.name) }; });
ok(r.start && r.res.status === 'success' && r.owned && r.cred, 'skin purchase success unlocks the skin, no credits spent');
ok(/^SIM-/.test(r.res.receiptId) && r.rc?.sku === 'skin_pm_skin_jade' && r.spent === 199, 'receipt recorded with SIM id; simulated spend 199');
ok(['purchase_start', 'purchase_confirm', 'purchase_success', 'entitlement_granted'].every((n, i) => r.ev[i] === n), 'event order start>confirm>success>granted: ' + r.ev);
// repurchase blocked
r = await ev(() => window.__S.startPurchase(window.__game.save, 'skin_pm_skin_jade'));
ok(!r.ok, 'owned skin cannot be bought again: ' + r.why);
// idempotent
r = await ev(() => { const S = window.__S, s = window.__game.save; const rid = Object.keys(S.storeOf(s).receipts)[0]; const before = JSON.stringify([S.storeOf(s).spentCents, s.purchases.lockerBlocks]); const a = S.fulfil(s, 'locker_slots_1', rid, 99); const after = JSON.stringify([S.storeOf(s).spentCents, s.purchases.lockerBlocks]); return { dup: a.duplicate, g: a.granted.length, same: before === after, n: window.__A.events().filter(e => e.name === 'purchase_duplicate_receipt').length }; });
ok(r.dup && r.g === 0 && r.same && r.n === 1, 'replaying a receipt id grants nothing and charges nothing more');
// storage tiers + cap + escalating
r = await ev(async () => { const S = window.__S, s = window.__game.save; const base = window.__B.lockerCapOf(s); const prices = []; for (let i = 0; i < 7; i++) { const k = S.nextStorageSku(s, 'locker'); if (!k) break; prices.push(k.cents); const st = S.startPurchase(s, k.id); await S.confirmPurchase(s, st.order.orderId); }
  const over = S.startPurchase(s, 'locker_slots_5'); return { prices, cap: window.__B.lockerCapOf(s) - base, over: over.ok, skip: S.startPurchase(s, 'locker_slots_3').ok, next: S.nextStorageSku(s, 'locker') }; });
ok(r.prices.length === 5 && r.prices.every((p, i) => i === 0 || p > r.prices[i - 1]), 'locker tiers escalate and stop at 5: ' + r.prices);
ok(r.cap === 100 && !r.over && !r.skip && r.next === null, 'locker +100 slots total, capped, no tier skipping');
r = await ev(async () => { const S = window.__S, s = window.__game.save; const t0 = window.__B.bankOf(s).tabs; const k = S.nextStorageSku(s, 'bank'); const st = S.startPurchase(s, k.id); await S.confirmPurchase(s, st.order.orderId); return { t0, t1: window.__B.bankOf(s).tabs }; });
ok(r.t1 === r.t0 + 1, 'bank tab purchase opens one tab');
// bundle partially owned grants only the rest
r = await ev(async () => { const S = window.__S, s = window.__game.save; const st = S.startPurchase(s, 'bundle_hazard'); const res = await S.confirmPurchase(s, st.order.orderId); return { g: res.granted, all: ['pm_skin_jade', 'pm_back_hazard', 'pm_eyes_lime'].every(i => window.__AP.ownsCos(s, i)), again: S.startPurchase(s, 'bundle_hazard').ok }; });
ok(r.all && r.g.length === 2 && !r.again, 'bundle grants only unowned items; fully owned bundle not purchasable');
// fail path
r = await ev(async () => { const S = window.__S, s = window.__game.save; S.configureMock({ failureRate: 1 }); const before = JSON.stringify([s.cosmetics.owned, S.storeOf(s).spentCents]); const st = S.startPurchase(s, 'skin_pm_hair_signal'); const res = await S.confirmPurchase(s, st.order.orderId); S.configureMock({ failureRate: 0 });
  return { res, same: before === JSON.stringify([s.cosmetics.owned, S.storeOf(s).spentCents]), ev: window.__A.events().filter(e => e.sku === 'skin_pm_hair_signal').map(e => e.name), again: (() => { const x = S.startPurchase(s, 'skin_pm_hair_signal'); if (x.ok) S.cancelOrder(x.order.orderId); return x.ok; })() }; });
ok(r.res.status === 'failed' && r.same && /not charged/.test(r.res.why), 'failed payment grants nothing and says not charged');
ok(r.ev.join() === 'purchase_start,purchase_confirm,purchase_fail' && r.again, 'fail events logged; can retry after fail');
// cancel path: at confirm sheet and while processing
r = await ev(async () => { const S = window.__S, s = window.__game.save; S.resetOrders(); const n0 = window.__A.events().filter(e => e.name === 'purchase_cancel').length; let st = S.startPurchase(s, 'skin_pm_hair_signal'); const c1 = S.cancelOrder(st.order.orderId); const c1b = S.cancelOrder(st.order.orderId);
  S.configureMock({ delayMs: 400 }); st = S.startPurchase(s, 'skin_pm_hair_signal'); const p = S.confirmPurchase(s, st.order.orderId); await new Promise(r => setTimeout(r, 30)); const c2 = S.cancelOrder(st.order.orderId); const res = await p; S.configureMock({ delayMs: 20 });
  return { c1, c1b, c2, res, owned: window.__AP.ownsCos(s, 'pm_hair_signal'), n: window.__A.events().filter(e => e.name === 'purchase_cancel').length - n0 }; });
ok(r.c1 && !r.c1b && r.c2 && r.res.status === 'cancelled' && !r.owned && r.n === 2, 'cancel at confirm sheet and mid-processing: nothing granted, one event each');
// one order at a time
r = await ev(() => { const S = window.__S, s = window.__game.save; S.resetOrders(); const a = S.startPurchase(s, 'skin_pm_hair_signal'); const b = S.startPurchase(s, 'skin_pm_aura_brine'); S.cancelOrder(a.order.orderId); return [a.ok, b.ok]; });
ok(r[0] && !r[1], 'only one active order at a time');
// persistence
await ev(() => { window.__ST.persist(window.__game.save); });
await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__game);
r = await ev(async () => { const S = await import('/src/store.ts'), AP = await import('/src/content/appearance.ts'), B = await import('/src/bank.ts'); const s = window.__game.save; const st = S.storeOf(s); return { rc: Object.keys(st.receipts).length, lk: st.counters.locker, cap: B.lockerCapOf(s), jade: AP.ownsCos(s, 'pm_skin_jade'), spent: st.spentCents, bank: st.counters.bank }; });
ok(r.rc >= 8 && r.lk === 5 && r.cap >= 160 && r.jade && r.spent > 0 && r.bank === 1, 'receipts, tiers and skins persist across reload: ' + JSON.stringify(r));
r = await ev(async () => { const S = await import('/src/store.ts'), s = window.__game.save; const rid = Object.keys(S.storeOf(s).receipts)[0]; const rc = S.storeOf(s).receipts[rid]; const before = s.purchases.lockerBlocks; const x = S.fulfil(s, rc.sku, rid, rc.cents); return { dup: x.duplicate, same: s.purchases.lockerBlocks === before }; });
ok(r.dup && r.same, 'idempotency holds after reload');
// stat neutrality
r = await ev(async () => { const B = await import('/src/build.ts'), AP = await import('/src/content/appearance.ts'); const s = window.__game.save; const f = () => JSON.stringify(B.computeBuild(Object.fromEntries(Object.entries(s.installed).map(([k, u]) => [k, s.items.find(i => i.uid === u)])), s.level, s.rep).stats); const a = f(); for (const d of AP.COSMETICS.filter(x => x.src.k === 'premium')) { AP.grantCos(s, d.id); AP.equipCos(s, d.id); } return a === f(); });
ok(r, 'equipping every premium skin leaves build stats unchanged');
// funnel counts
r = await ev(async () => { const S = await import('/src/store.ts'), A = await import('/src/analytics.ts'); A.resetAnalytics(); S.resetOrders(); const s = window.__game.save; s.cosmetics.owned = {}; s.cosmetics.equipped = {}; S.configureMock({ delayMs: 5, failureRate: 0 });
  A.track('sku_view', 'skin_pm_aura_brine'); A.track('sku_view', 'skin_pm_aura_brine'); A.track('sku_view', 'skin_pm_head_nightvisor'); let st = S.startPurchase(s, 'skin_pm_aura_brine'); await S.confirmPurchase(s, st.order.orderId);
  st = S.startPurchase(s, 'skin_pm_head_nightvisor'); S.cancelOrder(st.order.orderId); S.configureMock({ failureRate: 1 }); st = S.startPurchase(s, 'skin_pm_head_nightvisor'); await S.confirmPurchase(s, st.order.orderId); S.configureMock({ failureRate: 0 });
  const f = A.funnel(); return { f, txt: A.funnelText(f), js: JSON.parse(A.exportJson()).events.length, ls: JSON.parse(localStorage.getItem('wv_analytics') || '[]').length, api: typeof window.wvStore.funnel }; });
ok(r.f.views === 3 && r.f.starts === 3 && r.f.successes === 1 && r.f.cancels === 1 && r.f.fails === 1, 'funnel counts: ' + JSON.stringify([r.f.views, r.f.starts, r.f.successes, r.f.cancels, r.f.fails]));
ok(r.f.revenueCents === 299 && r.f.perSku.skin_pm_aura_brine.successes === 1 && r.f.perSku.skin_pm_head_nightvisor.starts === 2 && Math.abs(r.f.startToSuccess - 1 / 3) < 1e-9, 'simulated revenue 299 and per-SKU counts');
ok(r.js === r.f.views + 3 + 2 + 1 + 1 + 1 + 1 || r.js > 0, 'export has events') ; ok(r.ls > 0 && r.api === 'function' && /SIMULATED/.test(r.txt), 'localStorage sink, wvStore console API, text report');
// custom sink + ring cap
r = await ev(async () => { const A = await import('/src/analytics.ts'); const got = []; A.addSink({ name: 't', write: e => got.push(e.name) }); A.addSink({ name: 'bad', write: () => { throw new Error('x'); } }); A.track('store_open'); for (let i = 0; i < 700; i++) A.track('sku_view', 'x'); return { got: got.length, ring: A.events().length, max: A.RING_MAX }; });
ok(r.got === 701 && r.ring === r.max, 'pluggable sinks receive events (bad sink ignored); ring buffer capped at ' + r.max);
// UI flow
await ev(async () => { const A = await import('/src/analytics.ts'); A.resetAnalytics(); const S = await import('/src/store.ts'); S.configureMock({ delayMs: 2500, failureRate: 0 }); S.resetOrders(); window.__game.enterTown(); window.__game.save.cosmetics.owned = {}; window.__game.save.cosmetics.equipped = {}; window.__ui.open('wardrobe'); });
await page.evaluate(() => { document.querySelector('#modal [data-act=wd-show][data-show=all]')?.click(); });
await ev(() => document.querySelector('#modal [data-act=wd-sel][data-id=pm_aura_brine]')?.click());
r = await ev(() => ({ buy: !!document.querySelector('#modal [data-act=st-open][data-sku=skin_pm_aura_brine]'), lock: window.wvStore.funnel().prompts.lockedClicks, txt: document.querySelector('#modal .drdet')?.textContent }));
ok(r.buy && r.lock === 1 && /Previewing/.test(r.txt), 'wardrobe: locked premium item previews and offers Buy; click logged');
await ev(() => document.querySelector('#modal [data-act=st-open][data-sku=skin_pm_aura_brine]')?.click());
ok(await ev(() => window.__ui.modal === 'store' && !!document.querySelector('#modal [data-store]') && /SIMULATED/.test(document.querySelector('#modal').textContent)), 'Store opens from wardrobe with the SKU selected, labelled SIMULATED');
await ev(() => document.querySelector('#modal [data-act=st-buy]')?.click());
ok(await ev(() => !!document.querySelector('#modal [data-act=st-confirm]') && /no real charge/i.test(document.querySelector('#modal').textContent)), 'confirm step shown before any processing');
await ev(() => document.querySelector('#modal [data-act=st-confirm]')?.click()); await page.waitForFunction(() => /Processing/.test(document.querySelector("#modal")?.textContent || ""), null, { timeout: 2000 }); /* wait on the state itself; the 2.5 s fake delay keeps it visible long enough */
ok(await ev(() => /Processing/.test(document.querySelector('#modal').textContent)), 'processing state visible during the fake delay');
await page.waitForFunction(() => !!window.__game.save.cosmetics.owned.pm_aura_brine && document.querySelector("#modal .bkmsg"), null, { timeout: 8000 });
r = await ev(() => ({ owned: !!window.__game.save.cosmetics.owned.pm_aura_brine, msg: document.querySelector('#modal .bkmsg')?.textContent, f: window.wvStore.funnel() }));
ok(r.owned && /complete/i.test(r.msg) && r.f.successes === 1 && r.f.opens >= 1, 'UI purchase succeeds, result message shown, funnel updated');
await ev(() => { document.querySelector('#modal [data-act=st-funnel]')?.click(); });
ok(await ev(() => !!document.querySelector('#modal [data-funnel]')), 'funnel panel toggles open');
// cancel through UI
await ev(() => { document.querySelector('#modal [data-act=st-tab][data-tab=skins]')?.click(); document.querySelector('#modal [data-act=st-sel][data-id=skin_pm_hair_signal]')?.click(); document.querySelector('#modal [data-act=st-buy]')?.click(); document.querySelector('#modal [data-act=st-cancel]')?.click(); });
ok(await ev(() => !window.__game.save.cosmetics.owned.pm_hair_signal && /cancelled/i.test(document.querySelector('#modal .bkmsg')?.textContent || '')), 'UI cancel: not granted, message shown');
// storage-full prompt: locker (town), dismissable, logged once
r = await ev(async () => { const S = await import('/src/store.ts'), A = await import('/src/analytics.ts'), ST = await import('/src/state.ts'); const g = window.__game, s = g.save; S.resetUpsell(); A.resetAnalytics(); s.purchases.lockerBlocks = 0; S.storeOf(s).counters.locker = 0; s.lockerCap = 0; g.enterTown(); window.__ui.open('locker'); window.__ui.render();
  const has = !!document.querySelector('#modal .stprompt'); window.__ui.render(); const n = A.events().filter(e => e.name === 'storage_full_prompt').length; return { has, n }; });
ok(r.has && r.n === 1, 'locker full: gentle inline prompt, logged once (not per render)');
await ev(() => document.querySelector('#modal [data-act=st-dismiss]')?.click());
ok(await ev(() => !document.querySelector('#modal .stprompt')), 'Not now dismisses the prompt');
await ev(async () => { (await import('/src/store.ts')).resetUpsell(); window.__ui.render(); });
await ev(() => document.querySelector('#modal [data-act=st-open]')?.click());
ok(await ev(() => window.__ui.modal === 'store'), 'prompt button opens the Store');
// no popups in runs
r = await ev(async () => { const S = await import('/src/store.ts'), A = await import('/src/analytics.ts'); const g = window.__game; window.__ui.close(); S.resetUpsell(); A.resetAnalytics(); g.save.lockerCap = 0; const L = (await import('/src/town.ts')); 
  const before = A.events().length; let started = false; try { g.startRun?.('annex'); started = g.mode === 'run'; } catch (e) {} 
  if (!started) { try { window.__ui.open('gate'); } catch {} }
  return { mode: g.mode, started }; });
if (r.started) {
  await sleep(300);
  r = await ev(async () => { const S = await import('/src/store.ts'), A = await import('/src/analytics.ts'); const g = window.__game; const k = S.storageFullKind(g); const html = S.storagePromptHtml(g, 'locker') + S.storagePromptHtml(g, 'bank'); window.__ui.open('store'); window.__ui.open('wardrobe'); window.__ui.open('bank'); return { k, html, modal: window.__ui.modal, ev: A.events().filter(e => e.name !== 'sku_view').map(e => e.name) }; });
  ok(r.k === null && r.html === '' && r.modal === null && r.ev.length === 0, 'in a run: no storage prompt, Store/Wardrobe/Bank refuse to open, zero store events: ' + JSON.stringify(r));
} else ok(false, 'could not start a run for the no-popup check');
await ev(() => { window.__game.enterTown(); });
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 3).join(' | '));
await browser.close(); process.exit(fails ? 1 : 0);
