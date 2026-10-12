// Dressing room (the Wardrobe modal, opened from the locker / Store). Selecting an item only PREVIEWS it on a large rotatable model;
// nothing changes on your character until Apply. Store skins can be tried on and bought in place through the simulated store
// (src/store.ts startPurchase -> confirmPurchase). Saved outfits, sets with a combined price, analytics hooks. See docs/DRESSING_ROOM.md.
import { RARITIES, RARITY_COLOR, Rarity } from './config';
import { COSMETICS, COS_BY_ID, COS_SLOTS, COS_SLOT_ICON, COS_SLOT_LABEL, COS_THEME_LABEL, CosDef, CosSlot, buyCos, checkAchievements, cosOf, equipCos, ownsCos, ACHIEVEMENTS } from './content/appearance';
import { applyCosmeticVariants, bodyOf } from './bodyvariants';
import { drawCosmetics, drawTrail } from './cosmetics';
import { PlayerAnimator, Dir8, DIR_ORDER, dirFromWorld } from './sprites';
import { persist } from './state';
import { track, fmtUsd } from './analytics';
import { CATALOG, SKU_BY_ID, Sku, activeOrder, cancelOrder, confirmPurchase, skuAvail, startPurchase } from './store';
type UIx = any;
type Look = Partial<Record<CosSlot, string>>;
const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const rc = (r: Rarity) => RARITY_COLOR[r];

/** Dressing-room state. `staged` holds preview overrides per slot (id = try on, null = take off); empty = preview equals what you wear. */
export const WD = {
  tab: 'all' as 'all' | 'sets' | CosSlot, show: 'all' as 'owned' | 'all' | 'store', sel: '', msg: '',
  staged: {} as Partial<Record<CosSlot, string | null>>, set: '' as string,
  dir: 0 as Dir8, dirF: 0, phase: 'idle' as 'idle' | 'confirm' | 'processing', orderId: '', buySku: '',
};
export const OUTFIT_SLOTS = 3;
export const NEW_DAYS = 7;
/** Store spotlight: featured premium pieces (bundle contents) get a star badge. */
const FEATURED = new Set(CATALOG.filter(k => k.kind === 'bundle').flatMap(k => k.items || []));

const SRC_HINT = (d: CosDef): string => { const s = d.src; switch (s.k) {
  case 'vendor': return 'Sold here for ' + s.price + 'c';
  case 'drop': return 'Drops from kills (rare from mobs, better from elites and bosses)';
  case 'elite': return 'Drops from elites and bosses';
  case 'boss': return 'Drops from any boss';
  case 'bossId': return 'Drops from one specific boss';
  case 'ach': return 'Achievement: ' + (ACHIEVEMENTS.find(a => a.key === s.key)?.label || s.key);
  case 'premium': return 'Store skin: try it on, then Buy ' + fmtUsd(s.cents) + ' (SIMULATED)';
  case 'event': return 'Limited: a tiny chance on any boss kill'; } };
/** Discovery: owned, sold by the vendor, or a store skin is "known"; everything else shows only slot/rarity/source until found. */
export const isKnown = (s: any, d: CosDef) => ownsCos(s, d.id) || d.src.k === 'vendor' || d.src.k === 'premium';
const isStore = (d: CosDef) => d.src.k === 'premium' || d.src.k === 'vendor';
const isNew = (s: any, d: CosDef) => { const c = cosOf(s), t = c.owned[d.id]; return !!t && t > 1 && Date.now() - t < NEW_DAYS * 864e5 && !(c.seen![d.id] >= t); };
const badgeOf = (s: any, d: CosDef): [string, string, string] | null => !ownsCos(s, d.id) && d.src.k === 'event' ? ['ltd', 'LTD', 'Limited'] : isNew(s, d) ? ['new', 'NEW', 'New: not previewed yet'] : !ownsCos(s, d.id) && FEATURED.has(d.id) ? ['feat', '★', 'Featured in a set'] : null;
const priceOf = (d: CosDef) => d.src.k === 'premium' ? fmtUsd(d.src.cents) : d.src.k === 'vendor' ? d.src.price + 'c' : '';
const tipOf = (s: any, d: CosDef) => { const known = isKnown(s, d), own = ownsCos(s, d.id); return `<b style="color:${rc(d.rarity)}">${known ? esc(d.name) : '???'}</b><br>${esc(COS_SLOT_LABEL[d.slot])} · ${d.rarity}${known ? ' · ' + esc(COS_THEME_LABEL[d.theme]) : ''}<br>` + (known ? `${esc(d.desc)}<br><span class="mut">${esc(d.lore)}</span><br>` : '') + `<span class="mut">${own ? 'Owned' : esc(SRC_HINT(d))}</span><br><i>Click: try on (preview only)</i>`; };
const swatch = (d: CosDef, known: boolean) => known ? `<span class="cosw" style="--c:${d.c};--c2:${d.c2 || d.c}">${COS_SLOT_ICON[d.slot]}</span>` : `<span class="cosw unk">?</span>`;

/** What you currently wear (owned + equipped only). */
export function wornLook(s: any): Look { const c = cosOf(s), o: Look = {}; for (const sl of COS_SLOTS) { const id = c.equipped[sl]; if (id && c.owned[id] && COS_BY_ID[id]?.slot === sl) o[sl] = id; } return o; }
/** The previewed look: worn + staged overrides. */
export function previewLook(s: any): Look { const o = wornLook(s); for (const [sl, id] of Object.entries(WD.staged) as [CosSlot, string | null][]) { if (id) o[sl] = id; else delete o[sl]; } return o; }
/** Slots where the preview differs from what you wear. */
export function lookDiff(s: any): { slot: CosSlot; from?: string; to?: string }[] { const a = wornLook(s), b = previewLook(s); return COS_SLOTS.filter(sl => a[sl] !== b[sl]).map(sl => ({ slot: sl, from: a[sl], to: b[sl] })); }
const unownedInPreview = (s: any) => Object.values(previewLook(s)).filter(id => id && !ownsCos(s, id)) as string[];

/** Stage one item (try on). Re-staging what you already wear clears the override. */
export function stageItem(s: any, id: string) { const d = COS_BY_ID[id]; if (!d) return; WD.sel = id; WD.set = ''; if (wornLook(s)[d.slot] === id) delete WD.staged[d.slot]; else WD.staged[d.slot] = id;
  const c = cosOf(s); if (c.owned[id]) c.seen![id] = Date.now(); track('dr_preview', isStore(d) && !ownsCos(s, id) ? (d.src.k === 'premium' ? 'skin_' + id : undefined) : undefined, { id, slot: d.slot, owned: ownsCos(s, id), rarity: d.rarity, src: d.src.k });
  if (!ownsCos(s, id)) track('wardrobe_locked_item_click', id, { src: d.src.k, rarity: d.rarity }); }
/** Stage a store set (bundle) for preview. */
export function stageSet(s: any, skuId: string) { const k = SKU_BY_ID[skuId]; if (!k?.items) return; for (const id of k.items) { const d = COS_BY_ID[id]; WD.staged[d.slot] = id; } WD.set = skuId; WD.sel = k.items[0]; track('dr_preview', skuId, { set: true, n: k.items.length }); }
/** Revert: drop every preview override. Nothing on the character changed, so nothing else to undo. */
export function revert(s: any) { const n = lookDiff(s).length; WD.staged = {}; WD.set = ''; WD.msg = n ? 'Reverted to your current look.' : ''; if (n) track('dr_revert', undefined, { n }); }
/** Apply: commit owned staged pieces to the character. Unowned pieces stay staged as previews. */
export function applyLook(s: any): { applied: number; needBuy: number } { let applied = 0, needBuy = 0;
  for (const [sl, id] of Object.entries(WD.staged) as [CosSlot, string | null][]) { if (id === null) { equipCos(s, null, sl); delete WD.staged[sl]; applied++; } else if (ownsCos(s, id)) { equipCos(s, id); delete WD.staged[sl]; applied++; } else needBuy++; }
  if (applied) { persist(s); track('dr_apply', undefined, { applied, needBuy }); } if (!needBuy) WD.set = ''; return { applied, needBuy }; }
/** Rotate the model by `step` notches (45 degrees each). */
export function rotate(step: number, via = 'button') { WD.dir = (((WD.dir + step) % 8) + 8) % 8 as Dir8; track('dr_rotate', undefined, { dir: DIR_ORDER[WD.dir], via }); }
/** What the Buy button buys: the staged set if one is staged, else the selected unowned store piece. */
export function buyTarget(s: any): { kind: 'sku'; sku: Sku } | { kind: 'credits'; d: CosDef } | null {
  if (WD.set && skuAvail(s, WD.set).ok) return { kind: 'sku', sku: SKU_BY_ID[WD.set] };
  const d = WD.sel ? COS_BY_ID[WD.sel] : null; if (!d || ownsCos(s, d.id)) return null;
  if (d.src.k === 'premium') { const k = SKU_BY_ID['skin_' + d.id]; return k && skuAvail(s, k.id).ok ? { kind: 'sku', sku: k } : null; }
  if (d.src.k === 'vendor') return { kind: 'credits', d }; return null; }
export function saveOutfit(s: any, i: number): boolean { const c = cosOf(s); const look = previewLook(s); if (Object.values(look).some(id => id && !ownsCos(s, id))) return false; c.outfits = c.outfits || []; while (c.outfits.length < OUTFIT_SLOTS) c.outfits.push(null); c.outfits[i] = { n: 'Look ' + (i + 1), eq: look }; persist(s); track('dr_outfit_save', undefined, { slot: i, n: Object.keys(look).length }); return true; }
export function loadOutfit(s: any, i: number): boolean { const o = cosOf(s).outfits?.[i]; if (!o) return false; const worn = wornLook(s); WD.staged = {}; WD.set = ''; for (const sl of COS_SLOTS) { const want = o.eq[sl] && ownsCos(s, o.eq[sl]!) ? o.eq[sl]! : undefined; if (want !== worn[sl]) WD.staged[sl] = want ?? null; } track('dr_outfit_load', undefined, { slot: i }); return true; }

// ------------------------------------------------------------------------------------------------ render
export function wardrobeHtml(ui: UIx): string {
  const s = ui.g.save, c = cosOf(s); const look = previewLook(s), worn = wornLook(s), diff = lookDiff(s);
  const tabBtn = (id: string, label: string, title: string) => `<button class="btn tabb ${WD.tab === id ? 'primary' : ''}" data-act="wd-tab" data-tab="${id}" data-tip="${esc(title)}" aria-label="${esc(title)}">${label}</button>`;
  const tabs = tabBtn('all', 'All', 'All slots') + tabBtn('sets', 'Sets', 'Outfit sets: several store skins at one combined price') + COS_SLOTS.map(sl => tabBtn(sl, COS_SLOT_ICON[sl], COS_SLOT_LABEL[sl])).join('');
  const showBtn = (id: string, label: string, tip: string) => `<button class="btn ${WD.show === id ? 'primary' : ''}" data-act="wd-show" data-show="${id}" aria-pressed="${WD.show === id}" data-tip="${esc(tip)}">${label}</button>`;
  let grid: string;
  if (WD.tab === 'sets') {
    grid = CATALOG.filter(k => k.kind === 'bundle').map(k => { const parts = k.items!.map(i => COS_BY_ID[i]); const sum = parts.reduce((a, d) => a + ((d.src as any).cents || 0), 0); const a = skuAvail(s, k.id); const top = parts.reduce((m, d) => RARITIES.indexOf(d.rarity) > RARITIES.indexOf(m) ? d.rarity : m, 'grey' as Rarity);
      const tip = `<b>${esc(k.name)}</b><br>${parts.map(d => esc(d.name) + (ownsCos(s, d.id) ? ' (owned)' : '')).join('<br>')}<br>${fmtUsd(k.cents)} <s>${fmtUsd(sum)}</s> SIMULATED<br><i>Click: try the whole set on</i>`;
      return `<button class="slot tile st cos set ${WD.set === k.id ? 'sel' : ''}" data-act="wd-set" data-id="${k.id}" data-tip="${esc(tip)}" aria-label="${esc(k.name + ', set, ' + fmtUsd(k.cents) + (a.ok ? '' : ', owned'))}" style="border-color:${rc(top)}"><span class="ticon setic">${parts.map(d => `<span class="cosw" style="--c:${d.c};--c2:${d.c2 || d.c}"></span>`).join('')}</span>${a.ok ? `<i class="pricb">${fmtUsd(k.cents)}</i><i class="drb feat">SET</i>` : '<i class="drb own">✓</i>'}</button>`; }).join('');
  } else {
    const inTab = (d: CosDef) => WD.tab === 'all' || d.slot === WD.tab;
    const vis = (d: CosDef) => WD.show === 'owned' ? ownsCos(s, d.id) : WD.show === 'store' ? isStore(d) && !ownsCos(s, d.id) : true;
    const list = COSMETICS.filter(d => inTab(d) && vis(d)).sort((a, b) => +ownsCos(s, b.id) - +ownsCos(s, a.id) || RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || a.name.localeCompare(b.name));
    grid = list.map(d => { const own = ownsCos(s, d.id), on = worn[d.slot] === d.id, tried = look[d.slot] === d.id && !on, known = isKnown(s, d), b = badgeOf(s, d);
      return `<button class="slot tile st cos r-${d.rarity} ${WD.sel === d.id ? 'sel' : ''} ${own ? 'own' : 'off'} ${on ? 'worn' : ''} ${tried ? 'tried' : ''}" data-act="wd-sel" data-id="${d.id}" data-tip="${esc(tipOf(s, d))}" aria-label="${esc((known ? d.name : 'Undiscovered ' + COS_SLOT_LABEL[d.slot]) + ', ' + d.rarity + (own ? (on ? ', equipped' : ', owned') : ', not owned') + (tried ? ', previewing' : ''))}" style="border-color:${rc(d.rarity)};--rc:${rc(d.rarity)}"><span class="ticon">${swatch(d, known)}</span>${on ? '<i class="wornb" title="Wearing">●</i>' : ''}${own ? '<i class="drb own" title="Owned">✓</i>' : b ? `<i class="drb ${b[0]}" title="${b[2]}">${b[1]}</i>` : ''}${!own && priceOf(d) ? `<i class="pricb">${priceOf(d)}</i>` : ''}</button>`; }).join('') || '<div class="mut">Nothing here. Try "All".</div>';
  }
  // detail of the selected piece (short; the rest is in tooltips)
  const d = WD.sel ? COS_BY_ID[WD.sel] : null;
  const det = d ? `<div class="drdet"><b style="color:${rc(d.rarity)}" class="cap" data-tip="${esc(tipOf(s, d))}">${isKnown(s, d) ? esc(d.name) : '???'}</b> <span class="tag" style="border-color:${rc(d.rarity)}">${d.rarity}</span> <span class="mut">${ownsCos(s, d.id) ? 'Owned' : d.src.k === 'premium' ? 'Previewing · store skin' : d.src.k === 'vendor' ? 'Previewing · sold here' : esc(SRC_HINT(d))}</span>${look[d.slot] === d.id ? ` <button class="btn" data-act="wd-off" data-slot="${d.slot}" data-tip="Preview without this slot">Take off</button>` : ''}${d.src.k === 'premium' && !ownsCos(s, d.id) ? ` <button class="btn" data-act="st-open" data-sku="skin_${d.id}" data-tip="Open this skin in the Outfitter">Store</button>` : ''}</div>` : '<div class="drdet mut">Pick an item to try it on. Nothing changes until Apply.</div>';
  // diff vs current look
  const nm = (id?: string) => id ? esc(COS_BY_ID[id].name) : 'none';
  const diffHtml = diff.length ? diff.map(x => `<span class="drdiff ${x.to && !ownsCos(s, x.to) ? 'buy' : ''}" data-tip="${esc('<b>' + COS_SLOT_LABEL[x.slot] + '</b><br>' + nm(x.from) + ' → ' + nm(x.to))}">${COS_SLOT_ICON[x.slot]} ${x.to ? (ownsCos(s, x.to) ? '+' : '$') : '−'}</span>`).join('') : '<span class="mut">Matches your current look</span>';
  // action bar
  const need = unownedInPreview(s), applyN = diff.filter(x => !x.to || ownsCos(s, x.to)).length, bt = buyTarget(s);
  let buy = '';
  if (WD.phase === 'confirm') buy = `<span class="drconf">Buy <b>${esc(SKU_BY_ID[WD.buySku]?.name || '')}</b> ${fmtUsd(SKU_BY_ID[WD.buySku]?.cents || 0)}? <span class="tag">SIMULATED</span></span><button class="btn primary" data-act="wd-confirm">Confirm</button><button class="btn" data-act="wd-cancel">Cancel</button>`;
  else if (WD.phase === 'processing') buy = `<span class="mut" role="status">Processing (simulated)…</span><button class="btn" data-act="wd-cancel">Cancel</button>`;
  else if (bt) buy = bt.kind === 'sku' ? `<button class="btn buy" data-act="wd-buy" data-sku="${bt.sku.id}" data-tip="${esc(bt.sku.name + ': ' + fmtUsd(bt.sku.cents) + ' SIMULATED, no real charge. Stays a preview until you Apply.')}">Buy ${fmtUsd(bt.sku.cents)}</button>` : `<button class="btn buy" data-act="wd-buy" data-id="${bt.d.id}" ${s.credits >= (bt.d.src as any).price ? '' : 'disabled'} data-tip="${esc(bt.d.name + ' for ' + (bt.d.src as any).price + 'c (you have ' + s.credits + 'c)')}">Buy ${(bt.d.src as any).price}c</button>`;
  const outfits = Array.from({ length: OUTFIT_SLOTS }, (_, i) => { const o = c.outfits?.[i]; return `<button class="btn mini ${o ? '' : 'empty'}" data-act="wd-load" data-i="${i}" ${o ? '' : 'disabled'} data-tip="${esc(o ? '<b>' + o.n + '</b><br>' + (Object.values(o.eq).map(id => esc(COS_BY_ID[id!]?.name || '')).join('<br>') || 'Bare') + '<br><i>Click: preview it</i>' : 'Empty outfit slot')}">L${i + 1}</button>`; }).join('') + `<button class="btn mini" data-act="wd-save" ${need.length ? 'disabled' : ''} data-tip="${esc(need.length ? 'Buy the previewed store pieces first' : 'Save this preview as an outfit (fills the first empty slot, else L1)')}">Save</button>`;
  return `<div class="drwrap" data-dressing><div class="drstage">
      <canvas id="wdprev" width="300" height="360" aria-label="Character preview, facing ${DIR_ORDER[WD.dir]}. Drag to rotate." tabindex="0"></canvas>
      <div class="drrot"><button class="btn" data-act="wd-rot" data-d="-1" aria-label="Rotate left" data-tip="Rotate left (or drag the model)">⟲</button><span class="mut drdir">${DIR_ORDER[WD.dir]}</span><button class="btn" data-act="wd-rot" data-d="1" aria-label="Rotate right" data-tip="Rotate right (or drag the model)">⟳</button></div>
      <div class="drdiffs" aria-label="Changes vs your current look">${diffHtml}</div>
      <div class="drbar"><button class="btn primary" data-act="wd-apply" ${applyN ? '' : 'disabled'} data-tip="${esc(applyN ? 'Wear the previewed owned pieces' + (need.length ? ' (store pieces stay previews until bought)' : '') : 'Nothing owned to apply')}">Apply${applyN ? ' ' + applyN : ''}</button><button class="btn" data-act="wd-revert" ${diff.length ? '' : 'disabled'} data-tip="Back to your current look">Revert</button>${buy}</div></div>
    <div class="drright"><div class="wdtabs">${tabs}</div>
      <div class="trayhead"><span class="trayctl">${showBtn('all', 'All', 'Everything, including undiscovered drops')}${showBtn('owned', 'Owned', 'Only what you own')}${showBtn('store', 'Store', 'Only what you can buy')}</span><span class="trayctl"><span class="mut" data-tip="Credits">${s.credits}c</span><button class="btn" data-act="wd-back" data-tip="Back to the locker">Locker</button></span></div>
      <div class="stgrid wdgrid">${grid}</div>${det}
      <div class="drout"><span class="mut">Outfits</span>${outfits}<span class="mut drnote" data-tip="Cosmetics never change stats. Store prices are SIMULATED.">ⓘ</span></div>${WD.msg ? `<div class="bkmsg" role="status">${esc(WD.msg)}</div>` : ''}</div></div>`;
}

export function wardrobeClick(ui: UIx, el: HTMLElement, a: string): boolean {
  const g = ui.g, s = g.save;
  switch (a) {
    case 'wd-open': for (const d of checkAchievements(s)) g.toast('Wardrobe unlocked: ' + d.name); ui.open('wardrobe'); return true;
    case 'wd-tab': WD.tab = (el.dataset.tab as any) || 'all'; break;
    case 'wd-show': WD.show = (el.dataset.show as any) || (WD.show === 'all' ? 'owned' : 'all'); break;
    case 'wd-sel': if (WD.phase !== 'idle') return true; stageItem(s, el.dataset.id!); WD.msg = ''; break;
    case 'wd-set': if (WD.phase !== 'idle') return true; stageSet(s, el.dataset.id!); WD.msg = ''; break;
    case 'wd-off': WD.staged[el.dataset.slot as CosSlot] = wornLook(s)[el.dataset.slot as CosSlot] ? null : undefined as any; if (WD.staged[el.dataset.slot as CosSlot] === undefined) delete WD.staged[el.dataset.slot as CosSlot]; break;
    case 'wd-unslot': WD.staged[el.dataset.slot as CosSlot] = null; break;
    case 'wd-apply': case 'wd-equip': { const r = applyLook(s); WD.msg = r.applied ? 'Applied.' + (r.needBuy ? ' ' + r.needBuy + ' store piece(s) still preview only.' : '') : r.needBuy ? 'Buy the previewed store pieces first.' : ''; if (r.applied) g.toast?.('Look applied'); break; }
    case 'wd-revert': revert(s); break;
    case 'wd-rot': rotate(+el.dataset.d! || 1); break;
    case 'wd-save': { const c = cosOf(s); let i = (c.outfits || []).findIndex(o => !o); if (i < 0) i = (c.outfits || []).length < OUTFIT_SLOTS ? (c.outfits || []).length : 0; WD.msg = saveOutfit(s, i) ? 'Saved as L' + (i + 1) + '.' : 'Buy the previewed store pieces first.'; break; }
    case 'wd-load': loadOutfit(s, +el.dataset.i!); WD.msg = 'Previewing L' + (+el.dataset.i! + 1) + '. Apply to wear it.'; break;
    case 'wd-buy': {
      if (el.dataset.id) { const r = buyCos(s, el.dataset.id); WD.msg = r.why; track('dr_buy_intent', undefined, { id: el.dataset.id, credits: true }); if (r.ok) { persist(s); g.toast?.(r.why); } break; }
      const sku = el.dataset.sku!; track('dr_buy_intent', sku, { set: !!WD.set }); const r = startPurchase(s, sku); if (r.ok) { WD.phase = 'confirm'; WD.orderId = r.order.orderId; WD.buySku = sku; WD.msg = ''; } else WD.msg = r.why; break; }
    case 'wd-confirm': {
      if (WD.phase !== 'confirm') return true; const oid = WD.orderId; WD.phase = 'processing';
      confirmPurchase(s, oid).then(r => { if (WD.orderId !== oid) return; WD.phase = 'idle'; WD.orderId = ''; WD.msg = r.status === 'success' ? 'Bought (simulated). Press Apply to wear it.' : r.why; if (r.status === 'success') g.toast?.('Purchase complete (simulated)'); if (ui.modal === 'wardrobe') ui.render(); });
      break; }
    case 'wd-cancel': if (WD.orderId) cancelOrder(WD.orderId); WD.phase = 'idle'; WD.orderId = ''; WD.msg = 'Purchase cancelled. You were not charged.'; break;
    case 'wd-clear': for (const sl of COS_SLOTS) WD.staged[sl] = null; break;
    case 'wd-back': ui.open('locker'); return true;
    default: return false;
  }
  ui.render(); return true;
}
/** Store "Preview" entry point: try one piece on in the dressing room. */
export function previewFromStore(ui: UIx, id: string) { WD.tab = 'all'; WD.show = 'all'; stageItem(ui.g.save, id); WD.msg = ''; ui.open('wardrobe'); }

// ------------------------------------------------------------------------------------------------ stage (canvas)
let raf = 0, anim: PlayerAnimator | null = null, animSrc: any = null;
/** world facing angle whose screen direction is `d` (for the procedural cosmetics) */
const FACE: number[] = (() => { const o: number[] = []; for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2, dd = dirFromWorld(Math.cos(a), Math.sin(a)); if (o[dd] === undefined) o[dd] = a; } return o; })();
export function wardrobeAfter(ui: UIx) {
  const cv = document.getElementById('wdprev') as HTMLCanvasElement | null; cancelAnimationFrame(raf); if (!cv) return;
  const g = ui.g, s = g.save, ctx = cv.getContext('2d')!; const rend = (window as any).__rend; let last = performance.now(), t = 0;
  if (rend?.anim && animSrc !== rend.anim.loaded) { anim = new PlayerAnimator(rend.anim.loaded); animSrc = rend.anim.loaded; }
  // drag / swipe to rotate (one 45 degree notch per 40px), arrow keys too
  let dragX: number | null = null, acc = 0, turned = false;
  cv.style.touchAction = 'none';
  cv.onpointerdown = e => { dragX = e.clientX; acc = 0; turned = false; cv.setPointerCapture?.(e.pointerId); };
  cv.onpointermove = e => { if (dragX === null) return; acc += e.clientX - dragX; dragX = e.clientX; while (Math.abs(acc) >= 40) { const st = acc > 0 ? 1 : -1; WD.dir = (((WD.dir + st) % 8) + 8) % 8 as Dir8; acc -= st * 40; turned = true; } };
  cv.onpointerup = cv.onpointercancel = () => { if (turned) { track('dr_rotate', undefined, { dir: DIR_ORDER[WD.dir], via: 'drag' }); const l = document.querySelector('.drdir'); if (l) l.textContent = DIR_ORDER[WD.dir]; cv.setAttribute('aria-label', 'Character preview, facing ' + DIR_ORDER[WD.dir] + '. Drag to rotate.'); } dragX = null; };
  cv.onkeydown = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); rotate(e.key === 'ArrowLeft' ? -1 : 1, 'key'); ui.render(); document.getElementById('wdprev')?.focus(); } };
  const W = cv.width, H = cv.height, fx = W / 2, fy = H - 46;
  const frame = () => { if (!document.getElementById('wdprev')) return; const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now; t += dt;
    // smooth snap: dirF eases toward the target notch along the short way round
    let dd = WD.dir - WD.dirF; dd = ((dd % 8) + 12) % 8 - 4; WD.dirF = Math.abs(dd) < .02 ? WD.dir : WD.dirF + dd * Math.min(1, dt * 14); WD.dirF = ((WD.dirF % 8) + 8) % 8;
    const look = previewLook(s), list = COS_SLOTS.map(sl => look[sl] ? COS_BY_ID[look[sl]!] : null).filter(Boolean) as CosDef[];
    const sel = WD.sel ? COS_BY_ID[WD.sel] : null, glow = sel && look[sel.slot] === sel.id ? rc(sel.rarity) : '#6b7a86';
    // backdrop: dark gradient, spotlight cone, floor disc with rarity rim light
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#101418'); bg.addColorStop(1, '#1d2023'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const sp = ctx.createRadialGradient(fx, fy - 150, 10, fx, fy - 120, 190); sp.addColorStop(0, 'rgba(255,240,215,.16)'); sp.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sp; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = .5 + .1 * Math.sin(t * 2); const rim = ctx.createRadialGradient(fx, fy, 20, fx, fy, 95); rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(.8, glow + '55'); rim.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rim; ctx.beginPath(); ctx.ellipse(fx, fy, 95, 26, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(fx, fy, 52, 13, 0, 0, 7); ctx.fill();
    const u = 4.6, dA = Math.floor(WD.dirF) % 8 as Dir8, frac = WD.dirF - Math.floor(WD.dirF), dB = (dA + 1) % 8 as Dir8; const dShow = (frac < .5 ? dA : dB) as Dir8;
    const k = { c: ctx, x: fx, y: fy, u, t, moving: false, face: FACE[dShow] };
    const tr = list.find(x => x.slot === 'trail'); if (tr) drawTrail(ctx, Array.from({ length: 14 }, (_, i) => ({ x: fx - 8 - i * 7, y: fy + (i % 2) * 2, t: t - i * .06 })), t, u, tr);
    drawCosmetics(k, list, 'back'); let drew = false;
    if (anim) { try { const body = applyCosmeticVariants(bodyOf({ ...s, cosmetics: { owned: {}, equipped: {} } } as any, null), { cosmetics: { owned: Object.fromEntries(list.map(x => [x.id, 1])), equipped: look } } as any); anim.setBody(body); anim.anim = 'idle'; anim.t = t;
      // cross-fade the two nearest baked directions while snapping (no ghost at rest)
      if (frac > .01 && frac < .99) { anim.dir = dA; drew = anim.draw(ctx, fx, fy, u); ctx.save(); ctx.globalAlpha = frac; anim.dir = dB; anim.draw(ctx, fx, fy, u); ctx.restore(); } else { anim.dir = dShow; drew = anim.draw(ctx, fx, fy, u); } } catch { drew = false; } }
    if (!drew) { const sx = Math.cos(WD.dirF / 8 * Math.PI * 2); ctx.fillStyle = '#5c5f5a'; ctx.beginPath(); ctx.ellipse(fx, fy - 28 * u, 8.5 * u * (.75 + .25 * Math.abs(sx)), 10 * u, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#b8a48c'; ctx.beginPath(); ctx.ellipse(fx, fy - 41 * u, 5.2 * u, 5.8 * u, 0, 0, 7); ctx.fill(); ctx.fillRect(fx - 8 * u, fy - 20 * u, 6.5 * u, 20 * u); ctx.fillRect(fx + 1.5 * u, fy - 20 * u, 6.5 * u, 20 * u); }
    drawCosmetics(k, list, 'front');
    // key light from the upper left
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; const kl = ctx.createLinearGradient(0, 0, W, H); kl.addColorStop(0, 'rgba(255,230,200,.35)'); kl.addColorStop(1, 'rgba(0,10,30,.35)'); ctx.fillStyle = kl; ctx.fillRect(0, 0, W, H); ctx.restore();
    raf = requestAnimationFrame(frame); };
  frame();
}
/** test / console hook */
if (typeof window !== 'undefined') (window as any).__dr = { WD, previewLook: () => previewLook((window as any).__game.save), wornLook: () => wornLook((window as any).__game.save), diff: () => lookDiff((window as any).__game.save), activeOrder };
export { checkAchievements };
