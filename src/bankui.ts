import { inbox } from './mail';
// Bank modal (town station). All state lives in Save.bank via src/bank.ts; this file only renders and handles `bk-*` actions.
import { CHIPS, ChipId, ITEM_BY_ID, MFR, RARITY_COLOR, SLOT_LABEL } from './config';
import { BANK_TABS_MAX, BANK_TAB_SLOTS, bankCapacity, bankOf, bankUsed, depositChip, depositCredits, depositItem, depositMany, entryName, entryRarity, filterEntries, lockerCapOf, lockerFree, lockerUsed, nextTabPrice, sortTab, storedItems, tabUsed, unlockTab, withdraw, withdrawCredits, withdrawMany, BankFilter } from './bank';
import { persist } from './state';
import { storagePromptHtml } from './store';
import { esc } from './esc';
type UIx = any;
export const BK = { tab: 0 as number, q: '', type: 'all' as 'all' | 'item' | 'chip', rarity: 'all', sort: 'slot' as 'slot' | 'rarity' | 'name' | 'new', msg: '' };
const rc = (r: string) => (RARITY_COLOR as any)[r] || '#b4b6b2';
const itemTip = (id: string) => { const d = ITEM_BY_ID[id]; if (!d) return ''; return `<b style="color:${rc(d.rarity)}">${esc(d.name)}</b><br>${esc(SLOT_LABEL[d.slot])} · ${esc(MFR[d.mfr].short)} · Lv ${d.lvl}<br>${Object.entries(d.stats).map(([k, v]) => `${k} ${v}`).join(', ')}${d.abilities?.length ? '<br>Abilities: ' + d.abilities.join(', ') : ''}`; };
const chipTip = (c: ChipId) => `<b style="color:${rc(CHIPS[c].rarity)}">${esc(CHIPS[c].name)}</b><br>${esc(CHIPS[c].desc)}`;

export function bankHtml(ui: UIx): string {
  const s = ui.g.save, b = bankOf(s); if (BK.tab >= b.tabs && BK.tab !== -1) BK.tab = 0;
  const f: BankFilter = { q: BK.q, type: BK.type, rarity: BK.rarity, sort: BK.sort }; const all = BK.tab === -1;
  const list = filterEntries(b, all ? 'all' : BK.tab, f);
  const tabs = Array.from({ length: BANK_TABS_MAX }, (_, i) => i < b.tabs
    ? `<button class="btn tabb ${BK.tab === i ? 'primary' : ''}" data-act="bk-tab" data-tab="${i}" aria-label="Bank tab ${i + 1}, ${tabUsed(b, i)} of ${BANK_TAB_SLOTS} used">${i + 1}<small> ${tabUsed(b, i)}/${BANK_TAB_SLOTS}</small></button>`
    : `<button class="btn tabb locked" data-act="bk-buytab" ${i === b.tabs ? '' : 'disabled'} data-tip="${esc(i === b.tabs ? 'Open tab ' + (i + 1) + ' for ' + nextTabPrice(b) + 'c' : 'Open the previous tab first')}" aria-label="Locked tab ${i + 1}">🔒${i === b.tabs ? '<small> ' + nextTabPrice(b) + 'c</small>' : ''}</button>`).join('');
  const tile = (e: typeof list[0]) => e.item
    ? `<button class="slot tile st bk" data-act="bk-wd" data-id="${e.id}" data-def="${e.item.def}" data-tip="${esc(itemTip(e.item.def) + '<br><i>Click: withdraw to locker</i>')}" aria-label="${esc(entryName(e) + ' (withdraw)')}" style="border-color:${rc(entryRarity(e))}"><span class="ticon"></span></button>`
    : `<button class="slot tile st bk" data-act="bk-wd" data-id="${e.id}" data-chip="${e.chip}" data-tip="${esc(chipTip(e.chip!) + '<br><i>Click: withdraw 1 · Shift: all</i>')}" aria-label="${esc(entryName(e) + ' x' + e.n + ' (withdraw)')}" style="border-color:${rc(entryRarity(e))}"><span class="ticon"></span><span class="cnt">${e.n}</span></button>`;
  const grid = list.length ? list.map(tile).join('') : `<div class="mut bkempty">${bankUsed(b) ? 'Nothing matches this filter.' : 'The bank is empty. Deposit hardware and chips from your locker on the right.'}</div>`;
  const stored = storedItems(s); const q = BK.q.toLowerCase();
  const lockItems = stored.filter(i => !q || (ITEM_BY_ID[i.def]?.name || '').toLowerCase().includes(q)).map(i => { const d = ITEM_BY_ID[i.def]; return `<button class="slot tile st bk" data-act="bk-dep" data-uid="${i.uid}" data-def="${d.id}" data-tip="${esc(itemTip(d.id) + '<br><i>Click: deposit</i>')}" aria-label="${esc(d.name + ' (deposit)')}" style="border-color:${rc(d.rarity)}"><span class="ticon"></span></button>`; }).join('');
  const lockChips = (Object.keys(s.lockerChips) as ChipId[]).filter(c => (s.lockerChips[c] || 0) > 0 && CHIPS[c] && (!q || CHIPS[c].name.toLowerCase().includes(q))).map(c => `<button class="slot tile st bk" data-act="bk-depchip" data-chip="${c}" data-tip="${esc(chipTip(c) + '<br><i>Click: deposit 1 · Shift: all</i>')}" aria-label="${esc(CHIPS[c].name + ' (deposit)')}" style="border-color:${rc(CHIPS[c].rarity)}"><span class="ticon"></span><span class="cnt">${s.lockerChips[c]}</span></button>`).join('');
  const opt = (v: string, cur: string, n: string) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${n}</option>`;
  const free = lockerFree(s);
  return `<div class="bankwrap" data-bank>
    <div class="bkhead"><span class="bkcred"><b>Wallet</b> ${s.credits}c</span><span class="bkcred vault"><b>Vault</b> ${b.credits}c <small>(safe from loss)</small></span><span class="mut">Bank ${bankUsed(b)}/${bankCapacity(b)} slots · Locker ${lockerUsed(s)}/${lockerCapOf(s)}</span><button class="btn" data-act="ml-open" data-tip="Send items to your other characters, claim items sent here">Mail${inbox().length?' ('+inbox().length+')':''}</button></div>
    ${storagePromptHtml(ui.g, 'bank')}
    ${BK.msg ? `<div class="bkmsg" role="status">${esc(BK.msg)}</div>` : ''}
    <div class="bkcols">
      <section class="col bkbank"><div class="sttabs bktabs">${tabs}<button class="btn tabb ${all ? 'primary' : ''}" data-act="bk-tab" data-tab="-1">All</button></div>
        <div class="bkfilters"><input class="bksearch" type="search" data-bk-in="q" value="${esc(BK.q)}" placeholder="Search name, slot, maker" aria-label="Search bank">
          <select data-bk-in="type" aria-label="Type">${opt('all', BK.type, 'All')}${opt('item', BK.type, 'Hardware')}${opt('chip', BK.type, 'Chips')}</select>
          <select data-bk-in="rarity" aria-label="Rarity">${opt('all', BK.rarity, 'Any rarity')}${['grey', 'green', 'blue', 'purple', 'orange'].map(r => opt(r, BK.rarity, r)).join('')}</select>
          <select data-bk-in="sort" aria-label="Sort">${opt('slot', BK.sort, 'By slot')}${opt('rarity', BK.sort, 'By rarity')}${opt('name', BK.sort, 'By name')}${opt('new', BK.sort, 'Newest')}</select></div>
        <div class="bkgrid" role="list">${grid}</div>
        <div class="actrow"><button class="btn" data-act="bk-wdmatch" ${list.length && free > 0 ? '' : 'disabled'}>Withdraw matches (${Math.min(list.length, Math.max(0, free))})</button>${all ? '' : `<button class="btn" data-act="bk-sorttab">Auto-sort tab</button>`}</div></section>
      <section class="col bklock"><h3>Locker <span class="mut">${free} free</span></h3>
        <div class="bkgrid small" role="list">${lockItems}${lockChips}${!lockItems && !lockChips ? '<div class="mut bkempty">Nothing spare in the locker.</div>' : ''}</div>
        <div class="actrow"><button class="btn" data-act="bk-depgrey">Deposit grey</button><button class="btn" data-act="bk-depchips" data-tip="Keeps 2 of each chip in the locker">Deposit spare chips</button><button class="btn" data-act="bk-depall">Deposit all stored</button></div>
        <h3>Credits vault</h3><div class="actrow">${[100, 1000].map(n => `<button class="btn" data-act="bk-cdep" data-n="${n}" ${s.credits >= 1 ? '' : 'disabled'}>Deposit ${n}</button>`).join('')}<button class="btn" data-act="bk-cdep" data-n="all" ${s.credits > 0 ? '' : 'disabled'}>Deposit all</button></div>
        <div class="actrow">${[100, 1000].map(n => `<button class="btn" data-act="bk-cwd" data-n="${n}" ${b.credits > 0 ? '' : 'disabled'}>Withdraw ${n}</button>`).join('')}<button class="btn" data-act="bk-cwd" data-n="all" ${b.credits > 0 ? '' : 'disabled'}>Withdraw all</button></div>
        <div class="mut">Safekeeping only, no interest. Bank contents survive death, abandoning and expiry.</div></section>
    </div></div>`;
}
export function bankInput(ui: UIx, el: HTMLInputElement | HTMLSelectElement) { const k = el.getAttribute('data-bk-in'); if (!k) return false; (BK as any)[k] = el.value; ui.render(); const n = document.querySelector<HTMLInputElement>('#modal .bksearch'); if (k === 'q' && n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } return true; }
export function bankClick(ui: UIx, el: HTMLElement, a: string, shift = false): boolean {
  const g = ui.g, s = g.save; const d = el.dataset; const note = (m: string) => { BK.msg = m; }; const done = (m = '') => { note(m); persist(s); ui.render(); return true; };
  const r = (x: { ok: boolean; why?: string }, okMsg: string) => done(x.ok ? okMsg : (x as any).why);
  const pref = BK.tab >= 0 ? BK.tab : 0;
  switch (a) {
    case 'bk-tab': BK.tab = +d.tab!; BK.msg = ''; ui.render(); return true;
    case 'bk-buytab': return r(unlockTab(s), 'New bank tab opened.');
    case 'bk-dep': return r(depositItem(s, d.uid!, pref), 'Deposited.');
    case 'bk-depchip': return r(depositChip(s, d.chip as ChipId, shift ? 99 : 1, pref), 'Deposited.');
    case 'bk-wd': { const e = bankOf(s).entries.find(x => x.id === d.id); if (!e) return done(); return r(withdraw(s, d.id!, shift ? 1e9 : 1), 'Withdrawn to locker.'); }
    case 'bk-depgrey': { const n = depositMany(s, 'grey', pref); return done(n ? `Deposited ${n} grey item(s).` : 'No spare grey hardware.'); }
    case 'bk-depall': { const n = depositMany(s, 'all', pref); return done(n ? `Deposited ${n} item(s).` : 'No stored hardware to deposit.'); }
    case 'bk-depchips': { const n = depositMany(s, 'chips', pref); return done(n ? `Deposited ${n} spare chip(s).` : 'No spare chips beyond 2 of each.'); }
    case 'bk-wdmatch': { const b = bankOf(s); const ids = filterEntries(b, BK.tab === -1 ? 'all' : BK.tab, { q: BK.q, type: BK.type, rarity: BK.rarity, sort: BK.sort }).map(e => e.id); const n = withdrawMany(s, ids); return done(n ? `Withdrew ${n} entr${n > 1 ? 'ies' : 'y'}.` : 'Locker is full.'); }
    case 'bk-sorttab': if (BK.tab >= 0) sortTab(bankOf(s), BK.tab); return done('Tab sorted.');
    case 'bk-cdep': return r(depositCredits(s, d.n === 'all' ? s.credits : +d.n!), 'Credits deposited.');
    case 'bk-cwd': return r(withdrawCredits(s, d.n === 'all' ? bankOf(s).credits : +d.n!), 'Credits withdrawn.');
  }
  return false;
}
