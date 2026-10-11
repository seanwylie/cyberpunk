// Town bank: long-term storage + credits vault. PURE logic (no DOM); UI in src/bankui.ts. Lives in Save.bank (account-shareable block, see docs/BANK_AND_TOWN2.md).
import { CHIPS, ChipId, ITEM_BY_ID, RARITY_RANK, STARTING, SLOTS, SLOT_LABEL } from './config';
import type { Inst, Save } from './state';

export const BANK_TABS_MAX = 6, BANK_TAB_SLOTS = 60, BANK_START_TABS = 2;
/** price to open tab index i (0-based); the first BANK_START_TABS are free */
export const BANK_TAB_PRICE = [0, 0, 400, 800, 1400, 2200];
export interface BankEntry { id: string; tab: number; item?: Inst; chip?: ChipId; n?: number; }
export interface Bank { v: 1; tabs: number; credits: number; entries: BankEntry[]; nextId: number; }
export type BankRes = { ok: true } | { ok: false; why: string };
const ok: BankRes = { ok: true }; const no = (why: string): BankRes => ({ ok: false, why });

export const newBank = (): Bank => ({ v: 1, tabs: BANK_START_TABS, credits: 0, entries: [], nextId: 1 });
export function bankOf(s: Save): Bank { let b = s.bank; if (!b || b.v !== 1) b = s.bank = newBank(); b.tabs = Math.max(BANK_START_TABS, Math.min(BANK_TABS_MAX, b.tabs | 0)); b.entries = b.entries || []; b.credits = Math.max(0, b.credits | 0); b.nextId = b.nextId || b.entries.length + 1; return b; }
export const lockerCapOf = (s: Save) => s.lockerCap + s.purchases.lockerBlocks * STARTING.lockerPerPurchase;
export const lockerUsed = (s: Save) => { const inst = new Set(Object.values(s.installed)); return s.items.filter(i => !inst.has(i.uid)).length + Object.values(s.lockerChips).filter(v => v && v > 0).length; };
export const lockerFree = (s: Save) => lockerCapOf(s) - lockerUsed(s);
export const tabUsed = (b: Bank, tab: number) => b.entries.filter(e => e.tab === tab).length;
export const bankUsed = (b: Bank) => b.entries.length;
export const bankCapacity = (b: Bank) => b.tabs * BANK_TAB_SLOTS;
export const nextTabPrice = (b: Bank) => b.tabs >= BANK_TABS_MAX ? null : BANK_TAB_PRICE[b.tabs];

/** first tab with room, preferring `pref` (chips prefer a tab that already stacks that chip) */
function pickTab(b: Bank, pref: number, chip?: ChipId): number {
  if (chip) { const st = b.entries.find(e => e.chip === chip); if (st) return st.tab; }
  const order = [pref, ...Array.from({ length: b.tabs }, (_, i) => i).filter(i => i !== pref)];
  for (const t of order) if (t >= 0 && t < b.tabs && tabUsed(b, t) < BANK_TAB_SLOTS) return t; return -1;
}
export function unlockTab(s: Save): BankRes { const b = bankOf(s); const p = nextTabPrice(b); if (p == null) return no('All tabs are open.'); if (s.credits < p) return no(`Needs ${p}c.`); s.credits -= p; b.tabs++; return ok; }

export function depositItem(s: Save, uid: string, pref = 0): BankRes {
  const b = bankOf(s); const idx = s.items.findIndex(i => i.uid === uid); if (idx < 0) return no('Item not in locker.');
  if (Object.values(s.installed).includes(uid)) return no('Equipped hardware cannot be banked.');
  const t = pickTab(b, pref); if (t < 0) return no('Bank is full. Open another tab.');
  const [it] = s.items.splice(idx, 1); b.entries.push({ id: 'b' + b.nextId++, tab: t, item: it }); return ok;
}
export function depositChip(s: Save, chip: ChipId, n = 1, pref = 0): BankRes {
  const b = bankOf(s); const have = s.lockerChips[chip] || 0; n = Math.min(n, have); if (n <= 0) return no('No spare chips.');
  const t = pickTab(b, pref, chip); if (t < 0) return no('Bank is full. Open another tab.');
  const e = b.entries.find(x => x.chip === chip && x.tab === t); if (e) e.n = (e.n || 0) + n; else b.entries.push({ id: 'b' + b.nextId++, tab: t, chip, n });
  s.lockerChips[chip] = have - n; if (s.lockerChips[chip]! <= 0) delete s.lockerChips[chip]; return ok;
}
export function withdraw(s: Save, entryId: string, n = 1e9): BankRes {
  const b = bankOf(s); const e = b.entries.find(x => x.id === entryId); if (!e) return no('Not found.');
  if (e.item) { if (lockerFree(s) <= 0) return no('Locker is full. Free a slot first.'); s.items.push(e.item); b.entries.splice(b.entries.indexOf(e), 1); return ok; }
  const c = e.chip!; if ((s.lockerChips[c] || 0) <= 0 && lockerFree(s) <= 0) return no('Locker is full. Free a slot first.');
  const take = Math.min(n, e.n || 0); s.lockerChips[c] = (s.lockerChips[c] || 0) + take; e.n = (e.n || 0) - take; if (e.n <= 0) b.entries.splice(b.entries.indexOf(e), 1); return ok;
}
export function depositCredits(s: Save, amt: number): BankRes { amt = Math.min(Math.floor(amt), s.credits); if (amt <= 0) return no('No credits to deposit.'); const b = bankOf(s); s.credits -= amt; b.credits += amt; return ok; }
export function withdrawCredits(s: Save, amt: number): BankRes { const b = bankOf(s); amt = Math.min(Math.floor(amt), b.credits); if (amt <= 0) return no('Vault is empty.'); b.credits -= amt; s.credits += amt; return ok; }

export const storedItems = (s: Save) => { const inst = new Set(Object.values(s.installed)); return s.items.filter(i => !inst.has(i.uid)); };
/** bulk helpers: return how many entries moved */
export function depositMany(s: Save, pick: 'grey' | 'all' | 'chips', pref = 0): number {
  let n = 0;
  if (pick === 'chips') { for (const c of Object.keys(s.lockerChips) as ChipId[]) { const spare = (s.lockerChips[c] || 0) - 2; if (spare > 0 && depositChip(s, c, spare, pref).ok) n += spare; } return n; }
  for (const it of storedItems(s)) { const d = ITEM_BY_ID[it.def]; if (!d) continue; if (pick === 'grey' && d.rarity !== 'grey') continue; if (it.def.startsWith('stock_') && pick === 'all' && false) continue; if (depositItem(s, it.uid, pref).ok) n++; else break; }
  return n;
}
export function withdrawMany(s: Save, ids: string[]): number { let n = 0; for (const id of ids) { if (withdraw(s, id).ok) n++; else break; } return n; }

export interface BankFilter { q?: string; type?: 'all' | 'item' | 'chip'; rarity?: string; sort?: 'slot' | 'rarity' | 'name' | 'new'; }
export const entryName = (e: BankEntry) => e.item ? (ITEM_BY_ID[e.item.def]?.name || e.item.def) : CHIPS[e.chip!].name;
export const entryRarity = (e: BankEntry) => e.item ? ITEM_BY_ID[e.item.def]?.rarity || 'grey' : CHIPS[e.chip!].rarity;
export function filterEntries(b: Bank, tab: number | 'all', f: BankFilter = {}): BankEntry[] {
  const q = (f.q || '').toLowerCase().trim();
  let l = b.entries.filter(e => (tab === 'all' || e.tab === tab) && (!f.type || f.type === 'all' || (f.type === 'item') === !!e.item) && (!f.rarity || f.rarity === 'all' || entryRarity(e) === f.rarity));
  if (q) l = l.filter(e => { const d = e.item ? ITEM_BY_ID[e.item.def] : null; return entryName(e).toLowerCase().includes(q) || (d && (SLOT_LABEL[d.slot].toLowerCase().includes(q) || d.mfr.toLowerCase().includes(q))); });
  const so = f.sort || 'slot'; const slotIx = (e: BankEntry) => e.item ? SLOTS.indexOf(ITEM_BY_ID[e.item.def]?.slot) : 99;
  l = [...l].sort((a, c) => so === 'name' ? entryName(a).localeCompare(entryName(c)) : so === 'rarity' ? RARITY_RANK[entryRarity(c)] - RARITY_RANK[entryRarity(a)] || entryName(a).localeCompare(entryName(c)) : so === 'new' ? parseInt(c.id.slice(1)) - parseInt(a.id.slice(1)) : slotIx(a) - slotIx(c) || RARITY_RANK[entryRarity(c)] - RARITY_RANK[entryRarity(a)] || entryName(a).localeCompare(entryName(c)));
  return l;
}
/** keep a tab in a stable useful order (re-seat entries by slot, rarity, name; tab membership unchanged) */
export function sortTab(b: Bank, tab: number) { const mine = filterEntries(b, tab, { sort: 'slot' }); const rest = b.entries.filter(e => e.tab !== tab); b.entries = [...rest, ...mine]; }

/** Overflow into the bank: used by return-to-town and by migration. Moves the entry out of `from` (items or chips) when the bank has room. */
export function bankOverflowItem(s: Save, it: Inst): boolean { const b = bankOf(s); const t = pickTab(b, 0); if (t < 0) return false; b.entries.push({ id: 'b' + b.nextId++, tab: t, item: it }); return true; }
export function bankOverflowChip(s: Save, chip: ChipId, n: number): boolean { const b = bankOf(s); const t = pickTab(b, 0, chip); if (t < 0 || n <= 0) return false; const e = b.entries.find(x => x.chip === chip && x.tab === t); if (e) e.n = (e.n || 0) + n; else b.entries.push({ id: 'b' + b.nextId++, tab: t, chip, n }); return true; }

/** Save migration (idempotent): create the bank; if the locker is over capacity move the lowest-value surplus (grey, then green...) to the bank. Returns entries moved. */
export function migrateBank(s: Save): number {
  const b = bankOf(s); let moved = 0; let over = lockerUsed(s) - lockerCapOf(s); if (over <= 0) return 0;
  const cand = storedItems(s).map(i => ({ i, r: RARITY_RANK[ITEM_BY_ID[i.def]?.rarity || 'grey'] })).sort((a, c) => a.r - c.r);
  for (const { i } of cand) { if (over <= 0) break; if (depositItem(s, i.uid).ok) { moved++; over--; } else break; }
  void b; return moved;
}
/** bank-only items/chips for the recommendation hints */
export const bankItemsOf = (s: Save): Inst[] => bankOf(s).entries.filter(e => e.item).map(e => e.item!);
export const bankChipsOf = (s: Save): Partial<Record<ChipId, number>> => { const o: Partial<Record<ChipId, number>> = {}; for (const e of bankOf(s).entries) if (e.chip) o[e.chip] = (o[e.chip] || 0) + (e.n || 0); return o; };
