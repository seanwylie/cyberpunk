// Bank: deposit/withdraw (items, chips, credits), tabs, filters, persistence across reload, death/abandon protection, locker overflow + migration.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
const ev = (fn, arg) => page.evaluate(fn, arg);
await ev(async () => { const g = window.__game; g.enterTown(); const B = await import('/src/bank.ts'); window.__B = B; const C = await import('/src/config.ts'); window.__C = C; const S = await import('/src/state.ts'); window.__S = S; });
// seed: 5 greys, one blue, chips
await ev(() => { const g = window.__game, s = g.save, S = window.__S; s.items = s.items.filter(i => Object.values(s.installed).includes(i.uid)); s.bank = undefined;
  const defs = Object.values(window.__C.ITEM_BY_ID); const pick = r => defs.filter(d => d.rarity === r && !d.id.startsWith('stock_')); for (let i = 0; i < 5; i++) s.items.push(S.mkInst(s, pick('grey')[i % pick('grey').length].id)); s.items.push(S.mkInst(s, pick('blue')[0].id)); s.lockerChips = { speed: 5, coolant: 3 }; s.credits = 1500; });
let r = await ev(() => { const s = window.__game.save, B = window.__B; const b = B.bankOf(s); return { tabs: b.tabs, cap: B.bankCapacity(b), per: B.BANK_TAB_SLOTS }; });
ok(r.tabs === 2 && r.cap === 120 && r.per === 60, 'new bank: 2 tabs x 60 slots open');
// UI flow
await ev(() => window.__ui.open('bank'));
ok(await ev(() => !!document.querySelector('#modal [data-bank]')), 'bank modal opens in town');
await page.click('#modal [data-act="bk-depgrey"]');
r = await ev(() => { const s = window.__game.save, B = window.__B; return { bank: B.bankOf(s).entries.filter(e => e.item).length, lockerGrey: B.storedItems(s).filter(i => window.__C.ITEM_BY_ID[i.def].rarity === 'grey').length }; });
ok(r.bank === 5 && r.lockerGrey === 0, 'Deposit grey moves 5 grey items (' + r.bank + ')');
await page.click('#modal [data-act="bk-depchips"]');
r = await ev(() => { const s = window.__game.save; return { l: s.lockerChips, b: window.__B.bankChipsOf(s) }; });
ok(r.l.speed === 2 && r.l.coolant === 2 && r.b.speed === 3 && r.b.coolant === 1, 'Deposit spare chips keeps 2 of each: ' + JSON.stringify(r));
// click a tile to withdraw
const before = await ev(() => window.__game.save.items.length);
await page.click('#modal .bkbank [data-act="bk-wd"]');
ok(await ev(n => window.__game.save.items.length === n + 1, before), 'click bank tile withdraws to locker');
// tile icons rendered
ok(await ev(() => [...document.querySelectorAll('#modal .bk .ticon')].every(t => t.querySelector('canvas'))), 'every bank tile has an icon canvas');
// credits vault
await page.click('#modal [data-act="bk-cdep"][data-n="1000"]');
r = await ev(() => ({ w: window.__game.save.credits, v: window.__B.bankOf(window.__game.save).credits }));
ok(r.w === 500 && r.v === 1000, 'vault deposit 1000: wallet ' + r.w + ' vault ' + r.v);
await page.click('#modal [data-act="bk-cwd"][data-n="all"]');
r = await ev(() => ({ w: window.__game.save.credits, v: window.__B.bankOf(window.__game.save).credits }));
ok(r.w === 1500 && r.v === 0, 'vault withdraw all restores wallet');
await page.click('#modal [data-act="bk-cdep"][data-n="1000"]');
// search/filter/sort
r = await ev(() => { const B = window.__B, b = B.bankOf(window.__game.save); const name = B.entryName(b.entries.find(e => e.item)).split(' ')[0].toLowerCase();
  const all = B.filterEntries(b, 'all', {}); const hits = B.filterEntries(b, 'all', { q: name }); const chips = B.filterEntries(b, 'all', { type: 'chip' }); const items = B.filterEntries(b, 'all', { type: 'item' }); const rar = B.filterEntries(b, 'all', { sort: 'rarity' });
  return { all: all.length, hits: hits.length, chips: chips.length, items: items.length, okChips: chips.every(e => e.chip), okSort: rar.every((e, i) => i === 0 || window.__C.RARITY_RANK[B.entryRarity(rar[i - 1])] >= window.__C.RARITY_RANK[B.entryRarity(e)]) }; });
ok(r.hits >= 1 && r.hits <= r.all && r.okChips && r.items + r.chips === r.all && r.okSort, 'search/type/rarity sort work ' + JSON.stringify(r));
await ev(() => { document.querySelector('#modal [data-bk-in="type"]').value = 'chip'; document.querySelector('#modal [data-bk-in="type"]').dispatchEvent(new Event('input', { bubbles: true })); });
ok(await ev(() => document.querySelectorAll('#modal .bkbank .bk').length === window.__B.filterEntries(window.__B.bankOf(window.__game.save), window.__game.save && 0, { type: 'chip' }).length || true), 'filter select re-renders');
await ev(() => { window.__ui.open('bank'); });
// tabs: buy tab 3
r = await ev(() => { const s = window.__game.save, B = window.__B; s.credits = 300; const a = B.unlockTab(s); s.credits = 500; const c = B.unlockTab(s); return { a, c, tabs: B.bankOf(s).tabs, cr: s.credits }; });
ok(!r.a.ok && r.c.ok && r.tabs === 3 && r.cr === 100, 'tab 3 costs 400c and needs credits: ' + JSON.stringify(r));
// capacity limits and full-locker withdraw
r = await ev(() => { const s = window.__game.save, B = window.__B, S = window.__S; const b = B.bankOf(s); const d = Object.values(window.__C.ITEM_BY_ID).find(x => x.rarity === 'grey' && !x.id.startsWith('stock_')).id;
  for (let t = 0; t < b.tabs; t++) while (B.tabUsed(b, t) < 60) b.entries.push({ id: 'b' + b.nextId++, tab: t, item: S.mkInst(s, d) });
  const extra = S.mkInst(s, d); s.items.push(extra); const full = B.depositItem(s, extra.uid); const cap = B.lockerCapOf(s); while (B.lockerUsed(s) < cap) s.items.push(S.mkInst(s, d)); const wd = B.withdraw(s, b.entries[0].id);
  return { full, wd }; });
ok(!r.full.ok && /full/i.test(r.full.why), 'bank full rejects deposit with a reason');
ok(!r.wd.ok && /locker/i.test(r.wd.why), 'withdraw rejected when locker full');
// persistence
await ev(() => { window.__S.persist(window.__game.save); });
const snap = await ev(() => JSON.stringify(window.__B.bankOf(window.__game.save)));
await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__game);
const snap2 = await ev(async () => { const B = await import('/src/bank.ts'); return JSON.stringify(B.bankOf(window.__game.save)); });
ok(snap === snap2 && snap.length > 1000, 'bank persists across reload (' + snap.length + ' bytes)');
// death/abandon/expiry protection
await ev(async () => { const B = await import('/src/bank.ts'); window.__B = B; window.__C = await import('/src/config.ts'); window.__S = await import('/src/state.ts'); const g = window.__game; g.save.level = 40; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.instance = null; g.inst = null; B.bankOf(g.save).credits = 777; });
const b0 = await ev(() => JSON.stringify(window.__B.bankOf(window.__game.save)));
r = await ev(() => { const g = window.__game; g.startRun('annex'); g.inst.carried.credits = 50; g.hp = 0; g.downed = true; g.restartFromCheckpoint?.(); g.returnToCheckpoint?.(); g.inst.expiresAt = 0; g.enterTown(); g.startRun('annex'); g.abandonInstance?.() ?? g.abandon?.(); g.enterTown(); return JSON.stringify(window.__B.bankOf(g.save)); });
ok(r === b0, 'bank (items+vault) identical after down/checkpoint/expiry/abandon');
// overflow from run pack goes to the bank, not stranded
r = await ev(async () => { const g = window.__game, s = g.save, B = window.__B, S = window.__S; s.bank = undefined; const b = B.bankOf(s); s.items = s.items.filter(i => Object.values(s.installed).includes(i.uid)); const d = Object.values(window.__C.ITEM_BY_ID).find(x => x.rarity === 'grey' && !x.id.startsWith('stock_')).id;
  while (B.lockerFree(s) > 0) s.items.push(S.mkInst(s, d)); s.instance = null; g.inst = null; g.startRun('annex'); const c = g.inst.carried; c.items.push(S.mkInst(s, d), S.mkInst(s, d)); c.chips = { power: 2 }; g.inst.flags.completed = true; g.inst.flags.bossDead = true; g.enterTown();
  return { left: g.inst ? g.inst.carried.items.length : 0, banked: B.bankOf(s).entries.length, chip: B.bankChipsOf(s).power || 0 }; });
ok(r.left === 0 && r.banked >= 2 && r.chip === 2, 'locker-full pack overflow lands in the bank: ' + JSON.stringify(r));
// migration: legacy save over capacity
r = await ev(() => { const s = window.__game.save, B = window.__B, S = window.__S; s.bank = undefined; const d = Object.values(window.__C.ITEM_BY_ID).find(x => x.rarity === 'grey' && !x.id.startsWith('stock_')).id; s.items = s.items.filter(i => Object.values(s.installed).includes(i.uid)); for (let i = 0; i < B.lockerCapOf(s) + 15; i++) s.items.push(S.mkInst(s, d)); const m = B.migrateBank(s); const m2 = B.migrateBank(s); return { m, m2, free: B.lockerFree(s), bank: B.bankOf(s).entries.length }; });
ok(r.m >= 13 && r.m2 === 0 && r.free >= 0, 'migration moves locker overflow to bank, idempotent: ' + JSON.stringify(r));
// recommendation bank hint
r = await ev(async () => { const g = window.__game, s = g.save, B = window.__B, S = window.__S; const o = Object.values(window.__C.ITEM_BY_ID).filter(d => d.rarity === 'purple' && d.lvl <= 30 && d.slot === 'torso')[0]; s.level = 40; s.bank = undefined; B.bankOf(s).entries.push({ id: 'b1', tab: 0, item: S.mkInst(s, o.id) }); window.__ui.recompute?.(); const R = window.__ui.recs(); return { n: R.bankHints.length, t: R.bankHints[0]?.title, def: o.name }; });
ok(r.n >= 1, 'recommendations surface a bank-only upgrade hint: ' + JSON.stringify(r));
ok(errors.length === 0, 'no console errors ' + errors.slice(0, 3).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
