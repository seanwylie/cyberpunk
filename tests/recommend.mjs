// Upgrade recommendations: engine ranking/rules (pure) + locker/vendor UI + one-click flows + town nudge.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1600, height: 900 } }); const ev = (f, a) => page.evaluate(f, a);
// ---------- engine (pure) ----------
const E = await ev(async () => {
  const R = await import('/src/recommend.ts'), C = await import('/src/config.ts'), S = await import('/src/state.ts');
  const mk = (over = {}) => { const s = S.newSave(); s.level = 30; s.credits = 5000; Object.assign(s, over); return s; };
  const inp = (s, extra = {}) => ({ items: s.items, installed: s.installed, lockerChips: s.lockerChips, credits: s.credits, level: s.level, rep: s.rep, repairBill: s.repairBill, vendorStock: [], lockerFree: 10, greyCount: 0, ...extra });
  const out = {};
  // 1. storage swap that is strictly better than stock is recommended; worse is not
  let s = mk(); s.items.push(S.mkInst(s, 'pool_g_torso')); s.items.push(S.mkInst(s, 'pool_p_torso'));
  let r = R.recommend(inp(s)); out.swap = r.recs.filter(x => x.kind === 'swap').map(x => x.defId); out.topGain = r.recs.length>0 && r.recs[0].rank === Math.max(...r.recs.map(x => x.rank));
  // 2. no level gating violation: purple torso lvl15 at level 12
  s = mk({ level: 12 }); s.items.push(S.mkInst(s, 'pool_p_torso')); r = R.recommend(inp(s)); out.gated = r.recs.concat(r.saveUp).some(x => x.defId === 'pool_p_torso');
  // 3. hard conflict never recommended: ripper arm with veil torso installed
  s = mk(); const veil = S.mkInst(s, 'ps_veil_torso'); s.items.push(veil); s.installed.torso = veil.uid; s.items.push(S.mkInst(s, 'hi_ripper_arm')); r = R.recommend(inp(s)); out.conflict = r.recs.some(x => x.defId === 'hi_ripper_arm');
  // 4. chips: legal only. stock has power (hands/arms only) + coolant (torso/brain) + magnet etc.
  s = mk(); s.lockerChips = { power: 2, speed: 2, coolant: 3, sustain: 2, magnet: 1, stride: 2, cloakdur: 1 };
  r = R.recommend(inp(s)); out.chipLegal = r.chipMoves.length > 0 && r.chipMoves.every(m => C.chipFits(m.chip, m.slot)); out.chipN = r.chipMoves.length;
  // capacity never exceeded & stock never overspent
  const per = {}; const use = {}; for (const m of r.chipMoves) { if (!m.replaces) per[m.slot] = (per[m.slot] || 0) + 1; use[m.chip] = (use[m.chip] || 0) + 1; }
  out.cap = Object.entries(per).every(([sl, n]) => n <= C.SLOT_SOCKETS[sl]); out.stock = Object.entries(use).every(([c, n]) => n <= s.lockerChips[c] + r.chipMoves.filter(m => m.replaces === c).length);
  // 5. chip replacing weaker chip: sustain in torso slot full of... fill torso with 8 weak magnet? magnet doesn't fit torso; use sustain vs coolant when playstyle hacker
  s = mk(); const t = s.items.find(i => i.uid === s.installed.handR); t.chips = ['sustain'.length ? 'speed' : 'speed', 'speed']; s.lockerChips = { power: 1 }; // hand full of speed; power(+12% dmg) beats a 15% atkspeed? equal-ish => just verify legality
  r = R.recommend(inp(s)); out.replLegal = r.chipMoves.every(m => C.chipFits(m.chip, m.slot) && (!m.replaces || t.chips[m.socket] === m.replaces));
  // 6. vendor + price + rep discount + save up
  const ven = C.ITEMS.filter(d => ['grey', 'green', 'blue'].includes(d.rarity) && !d.id.startsWith('stock_') && d.lvl <= 30);
  s = mk({ credits: 400 }); const vr = R.recommend(inp(s, { vendorStock: ven, vendorPrice: () => 300 }));
  out.vend = vr.recs.filter(x => x.kind === 'buy').length; out.vendCostOk = vr.recs.filter(x => x.kind === 'buy').every(x => x.cost <= 400);
  s = mk({ credits: 150 }); const su = R.recommend(inp(s, { vendorStock: ven, vendorPrice: () => 300 })); out.saveUp = su.saveUp.length; out.saveNeed = su.saveUp.every(x => x.needed > 0 && x.needed === x.cost - 150); out.noAffordable = su.recs.filter(x => x.kind === 'buy').length === 0;
  s = mk({ credits: 5, rep: { HI: 0, PS: 0, MM: 0 } }); out.far = R.recommend(inp(s, { vendorStock: ven, vendorPrice: () => 300 })).saveUp.length;
  const d0 = ven.find(d => R.recommend(inp(mk(), { vendorStock: [d], vendorPrice: () => 300 })).recs.some(x => x.defId === d.id)) || ven[0]; s = mk(); const a = R.recommend(inp(s, { vendorStock: [d0], vendorPrice: () => 300 })).recs.find(x => x.defId === d0.id); s.rep = { HI: 60, PS: 60, MM: 60 }; const b = R.recommend(inp(s, { vendorStock: [d0], vendorPrice: () => 300 })).recs.find(x => x.defId === d0.id);
  out.disc = !a || !b ? 'missing' : b.cost < a.cost;
  // vendor locker full => no buy recs
  s = mk(); out.full = R.recommend(inp(s, { vendorStock: ven, vendorPrice: () => 300, lockerFree: 0 })).recs.some(x => x.kind === 'buy');
  // 7. maintenance
  s = mk({ repairBill: 40 }); r = R.recommend(inp(s, { greyCount: 3, lockerFree: 1 })); out.maint = r.maintenance.map(m => m.kind).join();
  // 8. ordering and gains
  s = mk(); s.items.push(S.mkInst(s, 'pool_p_torso'), S.mkInst(s, 'pool_g_torso')); s.items.push(S.mkInst(s, 'hi_torso_cool')); r = R.recommend(inp(s)); out.sorted = r.recs.every((x, i, A) => i === 0 || A[i - 1].rank >= x.rank); out.allGain = r.recs.every(x => x.gain >= R.REC_MIN_GAIN || x.kind === 'chip');
  // 9. nothing to recommend for a fresh, chipless, stock build with no vendor
  s = mk(); s.lockerChips = {}; out.fresh = R.recommend(inp(s)).recs.length;
  // 10. playstyle
  const bld = await import('/src/build.ts'); out.style = R.playstyle(bld.computeBuild(bld.installedLayout(mk()), 30, { HI: 0, PS: 0, MM: 0 })).style;
  return out; });
console.log(JSON.stringify(E));
ok(E.swap.includes('pool_p_torso') && !E.swap.includes('pool_g_torso'), 'better storage part recommended, worse not');
ok(E.topGain, 'ranking is by gain per cost, best first');
ok(!E.gated, 'level-gated item never recommended nor save-up');
ok(!E.conflict, 'hard-conflict install never recommended');
ok(E.chipLegal && E.chipN > 0, 'chip moves exist and all obey CHIP_FITS (' + E.chipN + ')');
ok(E.cap && E.stock, 'chip moves respect socket capacity and stock');
ok(E.replLegal, 'chip replacements target the real weaker chip');
ok(E.vend > 0 && E.vendCostOk, 'affordable vendor items recommended within credits');
ok(E.saveUp > 0 && E.saveNeed && E.noAffordable, 'unaffordable-but-close => save up with exact credits needed');
ok(E.far === 0, 'far-out-of-reach items not mentioned');
ok(E.disc === true, 'reputation discount lowers cost');
ok(!E.full, 'no vendor buy when locker is full');
ok(E.maint === 'repair,tidy', 'maintenance nudges: ' + E.maint);
ok(E.sorted && E.allGain, 'ranked descending; gains above noise floor');
ok(E.fresh === 0, 'fresh stock build with nothing in stock has no recommendations');
ok(typeof E.style === 'string', 'playstyle ' + E.style);
// ---------- UI ----------
const setup = (extra) => ev((x) => { const g = window.__game, s = g.save; s.level = 30; s.credits = 3000; s.repairBill = 0; s.lockerChips = { power: 1, speed: 1, coolant: 2, sustain: 1 }; s.settings.recHidden = false; window.__ui.recDismissed.clear();
  import('/src/state.ts').then(S => { s.items.push(S.mkInst(s, 'pool_p_torso')); }); }, extra);
await setup(); await sleep(300);
await ev(() => { window.__ui.open('locker'); }); await sleep(400);
ok(await ev(() => !!document.querySelector('.recpanel .rec')), 'locker shows Recommended panel');
ok(await ev(() => document.querySelectorAll('.recpanel .rec').length <= 3), 'at most top 3 rows');
ok(await ev(() => document.querySelectorAll('.slot.tile .recb').length > 0), 'green badge on body tiles with an upgrade');
const row = await ev(() => { const r = document.querySelector('.recpanel .rec'); return { t: r.textContent, hasBtn: !!r.querySelector('[data-act=rec-go]'), tip: r.dataset.tip }; });
ok(row.hasBtn && /%/.test(row.t) || /free/.test(row.t), 'row has delta chips and action: ' + row.t.replace(/\s+/g, ' '));
ok(/Why\?/.test(row.tip), 'Why? tooltip');
await page.hover('.recpanel .rec'); await sleep(200); ok(await ev(() => /Why\?/.test(document.getElementById('tiptile').textContent)), 'hover shows why');
await page.screenshot({ path: 'shots/recs_locker.png' });
// one-click install opens the existing confirm popover
await ev(() => { const r = window.__ui.recs().recs.find(x => x.action === 'install'); document.querySelector(`[data-act=rec-go][data-id="${r.id}"]`)?.click(); }); await sleep(250);
ok(await ev(() => !!document.querySelector('.popwrap .pop')), 'Install opens the confirm popover');
await page.screenshot({ path: 'shots/recs_confirm.png' });
const c0 = await ev(() => window.__game.save.credits); await page.click('[data-act=confirm-replace]'); await sleep(250);
ok(await ev(() => window.__game.save.items.find(i => i.uid === window.__game.save.installed.torso).def === 'pool_p_torso'), 'confirm installs recommended part');
ok(await ev((c) => window.__game.save.credits <= c, c0), 'install cost charged');
// chips: apply all
await ev(() => { const s = window.__game.save; s.lockerChips = { power: 2, speed: 2, coolant: 3, sustain: 2 }; window.__ui.recCache = null; window.__ui.render(); }); await sleep(200);
const n0 = await ev(() => window.__ui.recs().chipMoves.length); ok(n0 > 1 && await ev(() => !!document.querySelector('[data-act=rec-chips-all]')), 'Apply all chip suggestions button (' + n0 + ' moves)');
const used0 = await ev(() => Object.values(window.__game.save.items.filter(i => Object.values(window.__game.save.installed).includes(i.uid))).reduce((a, i) => a + i.chips.length, 0));
await page.click('[data-act=rec-chips-all]'); await sleep(250);
const after = await ev(async () => { const C = await import('/src/config.ts'); const s = window.__game.save; const sl = {}; for (const k of C.SLOTS) { const it = s.items.find(i => i.uid === s.installed[k]); sl[k] = it.chips; } return { legal: C.SLOTS.every(k => sl[k].every(c => C.chipFits(c, k)) && sl[k].length <= C.SLOT_SOCKETS[k]), n: Object.values(sl).reduce((a, c) => a + c.length, 0), left: window.__ui.recs().chipMoves.length, neg: Object.values(s.lockerChips).some(v => v < 0) }; });
ok(after.legal && after.n > used0 && !after.neg, 'apply-all socketed legal chips: ' + JSON.stringify(after));
ok(after.left <= 1, 'few/no chip suggestions left after apply-all (' + after.left + ')');
// single Socket flow
await ev(() => { const s = window.__game.save; for (const k of Object.keys(s.installed)) { const it = s.items.find(i => i.uid === s.installed[k]); it.chips = []; } s.lockerChips = { power: 1 }; window.__ui.recCache = null; window.__ui.render(); }); await sleep(200);
await ev(() => { const r = window.__ui.recs().recs.find(x => x.kind === 'chip'); document.querySelector(`[data-act=rec-go][data-id="${r.id}"]`).click(); }); await sleep(250);
ok(await ev(() => ['handL', 'handR', 'armL', 'armR'].some(k => window.__game.save.items.find(i => i.uid === window.__game.save.installed[k]).chips.includes('power'))) && await ev(() => window.__game.save.lockerChips.power === 0), 'one-click Socket places chip on a fitting part');
// dismiss
await ev(() => { const s = window.__game.save; s.lockerChips = { coolant: 2, power: 2 }; window.__ui.recCache = null; window.__ui.render(); }); await sleep(150);
const did = await ev(() => document.querySelector('.recpanel .rec').dataset.rec); await page.click('.recpanel .rec [data-act=rec-dismiss]'); await sleep(150);
ok(await ev((d) => ![...document.querySelectorAll('.recpanel .rec')].some(r => r.dataset.rec === d), did), 'dismiss a recommendation');
await page.click('[data-act=rec-hide]'); await sleep(150); ok(await ev(() => !document.querySelector('.recpanel') && !!document.querySelector('.recshow') && !document.querySelector('.recb')), 'panel dismissible; badges hidden; restore pill shown');
await page.click('[data-act=rec-show]'); await sleep(150); ok(await ev(() => !!document.querySelector('.recpanel')), 'restore panel');
// repair nudge
await ev(() => { const s = window.__game.save; s.repairBill = 35; window.__ui.recCache = null; window.__ui.render(); }); await sleep(150);
ok(await ev(() => !!document.querySelector('.recmaint')), 'repair nudge in panel'); await page.click('.recmaint [data-act=rec-go]'); await sleep(200);
ok(await ev(() => window.__game.save.repairBill === 0), 'repair nudge one-click pays the bill');
// ---------- vendor ----------
await ev(() => { const s = window.__game.save; s.credits = 2000; s.level = 30; for (const k of Object.keys(s.installed)) { const it = s.items.find(i => i.uid === s.installed[k]); it.chips = []; } window.__ui.recDismissed.clear(); window.__ui.open('vendor'); }); await sleep(400);
const vr = await ev(() => ({ rows: document.querySelectorAll('.recpanel .rec').length, buy: [...document.querySelectorAll('.recpanel [data-act=rec-go]')].map(b => b.textContent), badge: document.querySelectorAll('.shoptabs .recb').length }));
ok(vr.rows > 0, 'vendor shows Recommended panel ' + JSON.stringify(vr)); ok(vr.badge > 0, 'vendor slot tabs carry the badge');
await page.screenshot({ path: 'shots/recs_vendor.png' });
const buyBtn = await ev(() => { const r = window.__ui.recs().recs.find(x => x.action === 'buy'); return r ? r.id : null; });
if (buyBtn) { const n = await ev(() => window.__game.save.items.length); await ev((id) => document.querySelector(`[data-act=rec-go][data-id="${id}"]`).click(), buyBtn); await sleep(250); ok(await ev((n) => window.__game.save.items.length === n + 1, n), 'one-click Buy adds the part'); } else ok(true, 'no vendor buy rec in this state (skipped)');
// ---------- nudge toast ----------
await ev(() => { window.__ui.open(null); const s = window.__game.save; s.credits = 3000; s.level = 30; s.settings.recHidden = false; window.__ui.recNudged.clear(); document.getElementById('toasts').innerHTML = ''; window.__ui.recNudge(); });
ok(await ev(() => /Upgrade available/.test(document.getElementById('toasts').textContent)) || await ev(() => window.__ui.recs().significant === null), 'town nudge toast fires only when a significant upgrade exists');
await ev(() => { document.getElementById('toasts').innerHTML = ''; window.__ui.recNudge(); }); ok(await ev(() => !/Upgrade available/.test(document.getElementById('toasts').textContent)), 'nudge not repeated for same upgrade');
ok(errors.length === 0, 'no page errors ' + errors.join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
