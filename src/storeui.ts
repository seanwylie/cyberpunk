// Outfitter modal (simulated store UI): tabs + icon grid + one detail pane, confirm step, fake processing. Compact; reuses wardrobe/bank classes.
// All logic lives in src/store.ts; events in src/analytics.ts. Only reachable in town (UI.open refuses it in a run).
import { RARITY_COLOR } from './config';
import { COS_BY_ID, COS_SLOT_ICON, COS_SLOT_LABEL, ownsCos } from './content/appearance';
import { CATALOG, LOCKER_SLOTS_PER_TIER, LOCKER_TIER_CENTS, BANK_TIER_CENTS, Sku, SKU_BY_ID, activeOrder, cancelOrder, confirmPurchase, dismissUpsell, nextStorageSku, skuAvail, startPurchase, storeOf, MOCK_CFG } from './store';
import { exportJson, fmtUsd, funnel, track } from './analytics';
import { lockerCapOf } from './bank';
import { bankOf, bankCapacity } from './bank';
import { WD } from './wardrobeui';
type UIx = any;
const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export type StTab = 'skins' | 'bundles' | 'storage';
export const ST = { tab: 'skins' as StTab, sel: '', phase: 'idle' as 'idle' | 'confirm' | 'processing' | 'done', orderId: '', msg: '', funnel: false, from: 'town' as 'town' | 'wardrobe' | 'locker' | 'bank' };
const tabOf = (k: Sku): StTab => k.kind === 'skin' ? 'skins' : k.kind === 'bundle' ? 'bundles' : 'storage';
const usd = (c: number) => fmtUsd(c);
function view(id: string) { if (ST.sel === id) return; ST.sel = id; track('sku_view', id, { tab: ST.tab }); }

export function openStore(ui: UIx, from: typeof ST.from, sku?: string) {
  const a = activeOrder(); if (a && ST.phase !== 'idle') { /* keep an in-flight purchase visible */ } else { ST.phase = 'idle'; ST.msg = ''; ST.orderId = ''; }
  ST.from = from; const k = sku ? SKU_BY_ID[sku] : undefined; if (k) ST.tab = tabOf(k);
  if (k) ST.sel = ''; ui.open('store'); if (ui.modal !== 'store') { return; } track('store_open', undefined, { from }); if (k) { view(k.id); ui.render(); }
}

const swatch = (k: Sku) => { if (k.kind === 'skin') { const d = COS_BY_ID[k.items![0]]; return `<span class="cosw" style="--c:${d.c};--c2:${d.c2 || d.c}">${COS_SLOT_ICON[d.slot]}</span>`; } return `<span class="cosw" style="--c:#c9a24a;--c2:#fff0b0">${k.kind === 'bundle' ? '★' : k.kind === 'storage_bank' ? 'BK' : 'LK'}</span>`; };
const rar = (k: Sku) => k.kind === 'skin' ? COS_BY_ID[k.items![0]].rarity : 'green';

export function storeHtml(ui: UIx): string {
  const s = ui.g.save; const tabBtn = (id: StTab, label: string) => `<button class="btn tabb ${ST.tab === id ? 'primary' : ''}" data-act="st-tab" data-tab="${id}">${label}</button>`;
  let list = ''; 
  if (ST.tab === 'storage') {
    const lk = nextStorageSku(s, 'locker'), bk = nextStorageSku(s, 'bank'), st = storeOf(s), b = bankOf(s);
    const row = (k: Sku | null, title: string, now: string, n: number, max: number) => `<div class="row"><span><b>${title}</b> <span class="mut">${now}</span><br><span class="mut">${n}/${max} bought</span></span>${k ? `<button class="btn ${ST.sel === k.id ? 'primary' : ''}" data-act="st-sel" data-id="${k.id}">${esc(k.name)} · ${usd(k.cents)}</button>` : '<span class="tag good">Maxed</span>'}</div>`;
    list = row(lk, 'Locker', `${lockerCapOf(s)} slots now`, st.counters.locker, LOCKER_TIER_CENTS.length) + row(bk, 'Bank', `${b.tabs} tabs, ${bankCapacity(b)} slots now`, st.counters.bank, BANK_TIER_CENTS.length);
  } else {
    const items = CATALOG.filter(k => tabOf(k) === ST.tab);
    list = `<div class="stgrid wdgrid">${items.map(k => { const a = skuAvail(s, k.id); return `<button class="slot tile st cos ${ST.sel === k.id ? 'sel' : ''} ${a.ok ? '' : 'off'}" data-act="st-sel" data-id="${k.id}" data-tip="${esc('<b>' + esc(k.name) + '</b><br>' + esc(k.desc) + '<br><span class="mut">' + (a.ok ? usd(k.cents) + ' SIMULATED' : a.why) + '</span>')}" aria-label="${esc(k.name + ', ' + (a.ok ? usd(k.cents) + ' simulated price' : a.why))}" style="border-color:${RARITY_COLOR[rar(k) as keyof typeof RARITY_COLOR]}"><span class="ticon">${swatch(k)}</span><span class="tn"><small>${a.ok ? usd(k.cents) : esc(a.why)}</small></span></button>`; }).join('')}</div>`;
  }
  const k = ST.sel ? SKU_BY_ID[ST.sel] : null; let detail = '<div class="mut wdsel">Select an item for details. Prices are SIMULATED: nothing is charged.</div>';
  if (k && tabOf(k) === ST.tab) {
    const a = skuAvail(s, k.id); const parts = k.kind === 'bundle' && k.items ? k.items.map(i => `${esc(COS_BY_ID[i].name)}${ownsCos(s, i) ? ' (owned)' : ''}`).join(', ') : '';
    let act = '';
    if (ST.phase === 'confirm') act = `<span>Buy <b>${esc(k.name)}</b> for <b>${usd(k.cents)}</b>? <span class="tag">SIMULATED, no real charge</span></span><button class="btn primary" data-act="st-confirm">Confirm</button><button class="btn" data-act="st-cancel">Cancel</button>`;
    else if (ST.phase === 'processing') act = `<span class="mut" role="status">Processing payment (simulated)…</span><button class="btn" data-act="st-cancel">Cancel</button>`;
    else act = a.ok ? `<button class="btn primary" data-act="st-buy" data-id="${k.id}">Buy ${usd(k.cents)} <small>SIMULATED</small></button>` : `<span class="tag good">${esc(a.why)}</span>`;
    const prev = k.kind === 'skin' && a.ok ? `<button class="btn" data-act="st-preview" data-id="${k.id}" data-tip="${esc('Try it on your character in the Wardrobe preview')}">Preview</button>` : '';
    detail = `<div class="wdsel"><b>${esc(k.name)}</b> <span class="tag">${usd(k.cents)} SIMULATED</span><div>${esc(k.desc)}</div>${parts ? `<div class="mut">Includes: ${parts}</div>` : ''}${k.kind === 'skin' ? `<div class="mut">${esc(COS_SLOT_LABEL[COS_BY_ID[k.items![0]].slot])} · cosmetic only, no stat change</div>` : k.kind === 'storage_locker' ? `<div class="mut">+${LOCKER_SLOTS_PER_TIER} permanent locker slots. Price rises each tier.</div>` : k.kind === 'storage_bank' ? '<div class="mut">One more bank tab. Price rises each tier.</div>' : '<div class="mut">Cosmetic only, no stat change</div>'}<div class="wdact">${act}${ST.phase === 'idle' ? prev : ''}</div></div>`;
  }
  let fun = '';
  if (ST.funnel) { const f = funnel(); fun = `<div class="wdsel" data-funnel><b>Funnel (local, simulated)</b><div class="mut">views ${f.views} → starts ${f.starts} (${(f.viewToStart * 100).toFixed(0)}%) → successes ${f.successes} (${(f.startToSuccess * 100).toFixed(0)}%) · fails ${f.fails} · cancels ${f.cancels} · revenue ${usd(f.revenueCents)} SIMULATED</div>${Object.entries(f.perSku).map(([id, v]) => `<div class="mut">${esc(id)}: ${v.views}v ${v.starts}s ${v.successes}ok ${v.fails}f ${v.cancels}c</div>`).join('')}<div class="wdact"><button class="btn" data-act="st-export">Export JSON to console</button><span class="mut">Fail rate ${(MOCK_CFG.failureRate * 100).toFixed(0)}% · set with wvStore.config({failureRate:.3})</span></div></div>`; }
  const back = ST.from !== 'town' ? `<button class="btn" data-act="st-back">Back to ${ST.from}</button>` : '';
  return `<div class="col" data-store><div class="trayhead"><span class="wdtabs">${tabBtn('skins', 'Skins')}${tabBtn('bundles', 'Bundles')}${tabBtn('storage', 'Storage')}</span><span class="trayctl"><span class="tag">SIMULATED · no real money</span><button class="btn ${ST.funnel ? 'primary' : ''}" data-act="st-funnel" aria-pressed="${ST.funnel}">Funnel</button>${back}</span></div>
    ${list}${detail}${ST.msg ? `<div class="bkmsg" role="status">${esc(ST.msg)}</div>` : ''}${fun}<div class="mut">Skins are appearance only. Storage is permanent. This prototype has no real checkout.</div></div>`;
}

export function storeClick(ui: UIx, el: HTMLElement, a: string): boolean {
  const g = ui.g, s = g.save;
  switch (a) {
    case 'st-open': { const from = ui.modal === 'wardrobe' ? 'wardrobe' : ui.modal === 'locker' ? 'locker' : ui.modal === 'bank' ? 'bank' : 'town'; openStore(ui, from, el.dataset.sku); return true; }
    case 'st-dismiss': dismissUpsell(); ui.render(); return true;
    case 'st-tab': if (ST.phase === 'processing') return true; ST.tab = (el.dataset.tab as StTab) || 'skins'; ST.sel = ''; ST.phase = 'idle'; ST.msg = ''; break;
    case 'st-sel': if (ST.phase === 'processing') return true; if (ST.phase === 'confirm' && ST.orderId) cancelOrder(ST.orderId); ST.phase = 'idle'; ST.msg = ''; view(el.dataset.id!); break;
    case 'st-preview': { const k = SKU_BY_ID[el.dataset.id!]; if (!k?.items) return true; WD.sel = k.items[0]; WD.msg = ''; ui.open('wardrobe'); return true; }
    case 'st-buy': { const r = startPurchase(s, el.dataset.id!); if (r.ok) { ST.orderId = r.order.orderId; ST.phase = 'confirm'; ST.msg = ''; } else ST.msg = r.why; break; }
    case 'st-confirm': {
      if (ST.phase !== 'confirm' || !ST.orderId) return true; const oid = ST.orderId; ST.phase = 'processing'; ST.msg = '';
      confirmPurchase(s, oid).then(r => { if (ST.orderId !== oid) return; ST.phase = 'done'; ST.msg = r.status === 'success' ? (r.duplicate ? r.why : 'Purchase complete (simulated). ' + (r.granted?.length ? 'Added to your account.' : '')) : r.why; if (r.status === 'success') g.toast?.('Outfitter: purchase complete (simulated)'); if (ui.modal === 'store') ui.render(); });
      break; }
    case 'st-cancel': { if (ST.orderId) cancelOrder(ST.orderId); ST.phase = 'idle'; ST.msg = 'Purchase cancelled. You were not charged.'; break; }
    case 'st-funnel': ST.funnel = !ST.funnel; break;
    case 'st-export': { const j = exportJson(); try { console.log(j); (navigator as any).clipboard?.writeText(j); } catch { /* ignore */ } ST.msg = 'Funnel exported to the browser console (and clipboard if allowed).'; break; }
    case 'st-back': ui.open(ST.from); return true;
    default: return false;
  }
  ui.render(); return true;
}
