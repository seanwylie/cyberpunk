// Simulated storefront (NO real money, NO payment provider). Behaves like a real IAP flow so a real provider can be swapped in:
//   startPurchase (SKU view -> Buy) -> confirmPurchase (user confirm -> provider.purchase -> receipt) -> fulfil (idempotent entitlement grant).
// Everything the player can buy is cosmetic or storage. Nothing here touches stats, drop rates or the rarity policy (premium skins are grey/green/blue only).
// See docs/STORE_SIM.md.
import { persist, Save } from './state';
import { COS_BY_ID, COSMETICS, cosOf, grantCos, ownsCos } from './content/appearance';
import { BANK_TABS_MAX, bankCapacity, bankOf, bankUsed, lockerFree } from './bank';
import { STARTING } from './config';
import { funnel, funnelText, events, exportJson, track, resetAnalytics, addSink, httpSink, fmtUsd } from './analytics';

export type SkuKind = 'skin' | 'bundle' | 'storage_locker' | 'storage_bank';
export interface Sku { id: string; kind: SkuKind; name: string; desc: string; cents: number; items?: string[]; tier?: number; }
export interface Receipt { id: string; sku: string; cents: number; ts: number; orderId: string; granted: string[]; }
export interface StoreState { v: 1; receipts: Record<string, Receipt>; counters: { locker: number; bank: number }; spentCents: number; orderN: number; }

/** Escalating tiers, capped. Locker: +lockerPerPurchase slots each (feeds Save.purchases.lockerBlocks, which every locker-capacity calc already reads). Bank: +1 tab (60 slots) each. */
export const LOCKER_TIER_CENTS = [99, 199, 299, 499, 799];
export const BANK_TIER_CENTS = [149, 299, 449, 699];
export const LOCKER_SLOTS_PER_TIER = STARTING.lockerPerPurchase;
export const CURRENCY = 'USD';

const SKINS: Sku[] = COSMETICS.filter(d => d.src.k === 'premium').map(d => ({ id: 'skin_' + d.id, kind: 'skin' as const, name: d.name, desc: d.desc, cents: (d.src as any).cents, items: [d.id] }));
const BUNDLES: Sku[] = [
  { id: 'bundle_hazard', kind: 'bundle', name: 'Hazard Crew Bundle', desc: 'Jade skin, hazard cape and lime lenses.', cents: 399, items: ['pm_skin_jade', 'pm_back_hazard', 'pm_eyes_lime'] },
  { id: 'bundle_nightshift', kind: 'bundle', name: 'Night Shift Bundle', desc: 'Violet visor, brine mist aura and sodium trail.', cents: 599, items: ['pm_head_nightvisor', 'pm_aura_brine', 'pm_trail_sodium'] },
  { id: 'bundle_signal', kind: 'bundle', name: 'Signal Bundle', desc: 'Cobalt anodize skin and flare crest.', cents: 449, items: ['pm_skin_cobalt', 'pm_hair_signal'] } ];
const LOCKER: Sku[] = LOCKER_TIER_CENTS.map((c, i) => ({ id: 'locker_slots_' + (i + 1), kind: 'storage_locker' as const, name: `Locker +${LOCKER_SLOTS_PER_TIER} slots`, desc: `Permanent extra locker space (tier ${i + 1} of ${LOCKER_TIER_CENTS.length}).`, cents: c, tier: i + 1 }));
const BANK: Sku[] = BANK_TIER_CENTS.map((c, i) => ({ id: 'bank_tab_' + (i + 1), kind: 'storage_bank' as const, name: 'Bank +1 tab (60 slots)', desc: `Opens one more bank tab (tier ${i + 1} of ${BANK_TIER_CENTS.length}).`, cents: c, tier: i + 1 }));
export const CATALOG: Sku[] = [...SKINS, ...BUNDLES, ...LOCKER, ...BANK];
export const SKU_BY_ID: Record<string, Sku> = Object.fromEntries(CATALOG.map(s => [s.id, s]));

export function storeOf(s: Save): StoreState {
  let st = s.store; if (!st || st.v !== 1) st = s.store = { v: 1, receipts: {}, counters: { locker: 0, bank: 0 }, spentCents: 0, orderN: 0 };
  st.receipts = st.receipts || {}; st.counters = st.counters || { locker: 0, bank: 0 }; st.counters.locker |= 0; st.counters.bank |= 0; st.spentCents |= 0; st.orderN |= 0; return st;
}

export type Avail = { ok: true } | { ok: false; why: string; owned?: boolean; later?: boolean };
export function skuAvail(s: Save, id: string): Avail {
  const k = SKU_BY_ID[id]; if (!k) return { ok: false, why: 'Unknown item' }; const st = storeOf(s);
  if (k.kind === 'skin' || k.kind === 'bundle') { const left = k.items!.filter(i => !ownsCos(s, i)); return left.length ? { ok: true } : { ok: false, why: 'Owned', owned: true }; }
  if (k.kind === 'storage_locker') { const n = st.counters.locker; if (n >= LOCKER_TIER_CENTS.length) return { ok: false, why: 'Maxed out', owned: true }; if (k.tier! <= n) return { ok: false, why: 'Owned', owned: true }; if (k.tier! > n + 1) return { ok: false, why: 'Buy the earlier tier first', later: true }; return { ok: true }; }
  const n = st.counters.bank, b = bankOf(s); if (n >= BANK_TIER_CENTS.length || b.tabs >= BANK_TABS_MAX) return { ok: false, why: 'Maxed out', owned: true }; if (k.tier! <= n) return { ok: false, why: 'Owned', owned: true }; if (k.tier! > n + 1) return { ok: false, why: 'Buy the earlier tier first', later: true }; return { ok: true };
}
/** Next purchasable SKU of a storage line, or null when capped. */
export const nextStorageSku = (s: Save, line: 'locker' | 'bank'): Sku | null => { const n = storeOf(s).counters[line]; const id = (line === 'locker' ? 'locker_slots_' : 'bank_tab_') + (n + 1); return SKU_BY_ID[id] && skuAvail(s, id).ok ? SKU_BY_ID[id] : null; };

// ---------------------------------------------------------------- payment provider seam
export interface Order { orderId: string; sku: string; cents: number; currency: string; }
export interface ProviderResult { status: 'success' | 'failed' | 'cancelled'; receiptId?: string; reason?: string; }
/** Swap this for a real provider (App Store / Play / Stripe checkout). It only ever returns a receipt id; the grant happens in fulfil(). */
export interface PaymentProvider { name: string; purchase(o: Order): Promise<ProviderResult>; cancel?(orderId: string): void; }
export interface MockCfg { delayMs: number; failureRate: number; rng: () => number; }
export const MOCK_CFG: MockCfg = { delayMs: 1200, failureRate: 0, rng: Math.random };
try { const raw = typeof localStorage !== 'undefined' && localStorage.getItem('wv_store_cfg'); if (raw) { const j = JSON.parse(raw); if (typeof j.delayMs === 'number') MOCK_CFG.delayMs = j.delayMs; if (typeof j.failureRate === 'number') MOCK_CFG.failureRate = j.failureRate; } } catch { /* ignore */ }
let rcN = 0;
export class MockProvider implements PaymentProvider {
  name = 'mock'; private pend = new Map<string, (r: ProviderResult) => void>();
  constructor(private cfg: MockCfg = MOCK_CFG) {}
  purchase(o: Order): Promise<ProviderResult> {
    return new Promise(res => {
      let done = false; const fin = (r: ProviderResult) => { if (done) return; done = true; clearTimeout(t); this.pend.delete(o.orderId); res(r); };
      this.pend.set(o.orderId, fin);
      const t = setTimeout(() => { if (this.cfg.rng() < this.cfg.failureRate) fin({ status: 'failed', reason: 'Simulated payment declined' }); else fin({ status: 'success', receiptId: 'SIM-' + Date.now().toString(36).toUpperCase() + '-' + (++rcN).toString(36).toUpperCase() + '-' + Math.floor(this.cfg.rng() * 46656).toString(36).toUpperCase() }); }, Math.max(0, this.cfg.delayMs));
    });
  }
  cancel(orderId: string) { this.pend.get(orderId)?.({ status: 'cancelled', reason: 'Cancelled' }); }
}
let provider: PaymentProvider = new MockProvider();
export const setProvider = (p: PaymentProvider) => { provider = p; };
export const getProvider = () => provider;
export function configureMock(c: Partial<Pick<MockCfg, 'delayMs' | 'failureRate'>>) { if (c.delayMs !== undefined) MOCK_CFG.delayMs = c.delayMs; if (c.failureRate !== undefined) MOCK_CFG.failureRate = Math.max(0, Math.min(1, c.failureRate)); try { localStorage.setItem('wv_store_cfg', JSON.stringify({ delayMs: MOCK_CFG.delayMs, failureRate: MOCK_CFG.failureRate })); } catch { /* ignore */ } return { ...MOCK_CFG, rng: undefined }; }

// ---------------------------------------------------------------- purchase flow
export type OrderStatus = 'started' | 'processing' | 'success' | 'failed' | 'cancelled';
interface LiveOrder extends Order { status: OrderStatus; }
const orders = new Map<string, LiveOrder>();
export const activeOrder = (): LiveOrder | null => { for (const o of orders.values()) if (o.status === 'started' || o.status === 'processing') return o; return null; };
export const resetOrders = () => orders.clear();

export type Start = { ok: true; order: Order } | { ok: false; why: string };
/** User pressed Buy on a SKU (confirm sheet opens). */
export function startPurchase(s: Save, skuId: string): Start {
  const k = SKU_BY_ID[skuId]; if (!k) return { ok: false, why: 'Unknown item' };
  const a = skuAvail(s, skuId); if (!a.ok) return { ok: false, why: a.why };
  const live = activeOrder(); if (live) return { ok: false, why: 'Finish or cancel the current purchase first.' };
  const st = storeOf(s); const orderId = 'ord_' + (++st.orderN) + '_' + Date.now().toString(36);
  const o: LiveOrder = { orderId, sku: skuId, cents: k.cents, currency: CURRENCY, status: 'started' }; orders.set(orderId, o);
  track('purchase_start', skuId, { cents: k.cents, orderId, simulated: true }); return { ok: true, order: { orderId, sku: skuId, cents: k.cents, currency: CURRENCY } };
}
export interface PurchaseResult { status: 'success' | 'failed' | 'cancelled'; why: string; receiptId?: string; granted?: string[]; duplicate?: boolean; }
/** User pressed Confirm: run the provider, then fulfil on success. */
export async function confirmPurchase(s: Save, orderId: string, p: PaymentProvider = provider): Promise<PurchaseResult> {
  const o = orders.get(orderId); if (!o || o.status !== 'started') return { status: 'failed', why: 'No pending purchase.' };
  o.status = 'processing'; track('purchase_confirm', o.sku, { orderId }); let r: ProviderResult;
  try { r = await p.purchase({ orderId, sku: o.sku, cents: o.cents, currency: o.currency }); } catch (e: any) { r = { status: 'failed', reason: String(e?.message || e) }; }
  if ((o.status as OrderStatus) === 'cancelled') return { status: 'cancelled', why: 'Purchase cancelled. You were not charged.' }; // cancelled while the provider was still working
  if (r.status === 'cancelled') { o.status = 'cancelled'; track('purchase_cancel', o.sku, { orderId, stage: 'provider' }); return { status: 'cancelled', why: 'Purchase cancelled. You were not charged.' }; }
  if (r.status !== 'success' || !r.receiptId) { o.status = 'failed'; track('purchase_fail', o.sku, { orderId, reason: r.reason || 'failed' }); return { status: 'failed', why: (r.reason || 'Payment failed') + '. You were not charged.' }; }
  const f = fulfil(s, o.sku, r.receiptId, o.cents, orderId); o.status = 'success'; persist(s);
  return { status: 'success', why: f.duplicate ? 'Already applied.' : 'Purchase complete (simulated).', receiptId: r.receiptId, granted: f.granted, duplicate: f.duplicate };
}
/** User pressed Cancel (confirm sheet or while processing). */
export function cancelOrder(orderId: string, p: PaymentProvider = provider): boolean {
  const o = orders.get(orderId); if (!o || (o.status !== 'started' && o.status !== 'processing')) return false;
  const was = o.status; o.status = 'cancelled'; if (was === 'processing') p.cancel?.(orderId); track('purchase_cancel', o.sku, { orderId, stage: was }); return true;
}

/** Idempotent entitlement grant. A receipt id can only ever grant once (replays, double-clicks, restore flows return duplicate:true and change nothing). */
export function fulfil(s: Save, skuId: string, receiptId: string, cents: number, orderId = ''): { duplicate: boolean; granted: string[] } {
  const st = storeOf(s), k = SKU_BY_ID[skuId];
  if (st.receipts[receiptId]) { track('purchase_duplicate_receipt', skuId, { receiptId }); return { duplicate: true, granted: [] }; }
  if (!k) return { duplicate: false, granted: [] };
  const granted: string[] = [];
  if (k.kind === 'skin' || k.kind === 'bundle') { for (const id of k.items!) if (grantCos(s, id)) granted.push(id); }
  else if (k.kind === 'storage_locker') { if (st.counters.locker < LOCKER_TIER_CENTS.length && k.tier === st.counters.locker + 1) { st.counters.locker++; s.purchases.lockerBlocks++; granted.push('locker+' + LOCKER_SLOTS_PER_TIER); } }
  else { const b = bankOf(s); if (st.counters.bank < BANK_TIER_CENTS.length && k.tier === st.counters.bank + 1 && b.tabs < BANK_TABS_MAX) { st.counters.bank++; b.tabs++; granted.push('bank_tab'); } }
  st.receipts[receiptId] = { id: receiptId, sku: skuId, cents, ts: Date.now(), orderId, granted }; st.spentCents += cents;
  track('purchase_success', skuId, { cents, receiptId, orderId, simulated: true });
  for (const g of granted) track('entitlement_granted', skuId, { grant: g, receiptId });
  return { duplicate: false, granted };
}

// ---------------------------------------------------------------- contextual upsell (gentle, inline, town only)
let dismissedUntil = 0; let lastPromptKey = '';
export const resetUpsell = () => { dismissedUntil = 0; lastPromptKey = ''; };
export const dismissUpsell = (mins = 15) => { dismissedUntil = Date.now() + mins * 60000; };
/** Which storage is full right now (null = none, or not in town). Never answers in a run, so nothing can pop up mid-combat. */
export function storageFullKind(g: any): 'locker' | 'bank' | null {
  if (!g || g.mode !== 'town') return null; const s: Save = g.save;
  if (lockerFree(s) <= 0 && nextStorageSku(s, 'locker')) return 'locker';
  const b = bankOf(s); if (bankUsed(b) >= bankCapacity(b) && nextStorageSku(s, 'bank')) return 'bank'; return null;
}
/** Small inline row for the locker/bank header. Empty string when not applicable. Logs storage_full_prompt once per appearance. */
export function storagePromptHtml(g: any, where: 'locker' | 'bank'): string {
  if (Date.now() < dismissedUntil) return ''; const kind = storageFullKind(g); if (!kind || (where === 'locker' && kind !== 'locker')) return '';
  const k = nextStorageSku(g.save, kind)!; const key = where + ':' + k.id; if (key !== lastPromptKey) { lastPromptKey = key; track('storage_full_prompt', k.id, { where, cents: k.cents }); }
  return `<div class="bkmsg stprompt" role="status">${kind === 'locker' ? 'Locker is full.' : 'Bank is full.'} <span class="mut">Optional:</span> <button class="btn" data-act="st-open" data-sku="${k.id}">${k.name} · ${fmtUsd(k.cents)} SIMULATED</button> <button class="btn" data-act="st-dismiss">Not now</button></div>`;
}

// ---------------------------------------------------------------- dev console (window.wvStore)
export const devApi = { funnel, funnelText: () => funnelText(), events, export: exportJson, config: configureMock, catalog: () => CATALOG, reset: () => { resetAnalytics(); try { localStorage.removeItem('wv_analytics'); } catch { /* ignore */ } }, addHttpSink: (url: string) => addSink(httpSink(url)) };
if (typeof window !== 'undefined') (window as any).wvStore = devApi;
