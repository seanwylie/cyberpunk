// Outfitter modal (simulated store UI): tabs + icon grid + one detail pane, confirm step, fake processing. Compact; reuses wardrobe/bank classes.
// All logic lives in src/store.ts; events in src/analytics.ts. Only reachable in town (UI.open refuses it in a run).
import { RARITY_COLOR } from './config';
import { COS_BY_ID, COS_SLOT_ICON, COS_SLOT_LABEL, ownsCos } from './content/appearance';
import { featuredSkus, limitedSku } from './store';
import { CATALOG, LOCKER_SLOTS_PER_TIER, LOCKER_TIER_CENTS, BANK_TIER_CENTS, Sku, SKU_BY_ID, activeOrder, cancelOrder, confirmPurchase, dismissUpsell, nextStorageSku, skuAvail, startPurchase, storeOf, MOCK_CFG } from './store';
import { exportJson, fmtUsd, funnel, track } from './analytics';
import { lockerCapOf } from './bank';
import { bankOf, bankCapacity } from './bank';
import { previewFromStore, WD, stageSet } from './wardrobeui';
import { priceFor, lineSku } from './store';
import { featured, rotation, weekEnds, collections, lineSkins, passOf, passLevel, passRewards, claimable, claimPass, STARTER, starterValueCents, tierOf, FEATURED_DISCOUNT } from './monet';
import { LINES, LINE_BY_ID, TIER, SEASON } from './content/skinlines';
import { statusOf, countdown, fmtDate, badgeOf, now as rnow } from './retire';
import { persist } from './state';
import { esc } from './esc';
type UIx = any;
export type StTab = 'featured' | 'lines' | 'pass' | 'skins' | 'bundles' | 'storage';
export const ST = ((globalThis as any).__wvStoreUi ??= { tab: 'featured' as StTab, line: 'hextech', sel: '', phase: 'idle' as 'idle' | 'confirm' | 'processing' | 'done', orderId: '', msg: '', funnel: false, from: 'town' as 'town' | 'wardrobe' | 'locker' | 'bank' });
const tabOf = (k: Sku): StTab => k.kind === 'skin' ? 'skins' : k.kind === 'bundle' ? 'bundles' : k.kind === 'line' || k.kind === 'line_bundle' ? (ST.tab === 'featured' ? 'featured' : 'lines') : k.kind === 'starter' ? 'featured' : k.kind === 'pass' ? 'pass' : 'storage';
const usd = (c: number) => fmtUsd(c);
function view(id: string) { if (ST.sel === id) return; ST.sel = id; track('sku_view', id, { tab: ST.tab }); }

export function openStore(ui: UIx, from: typeof ST.from, sku?: string) {
  const a = activeOrder(); if (a && ST.phase !== 'idle') { /* keep an in-flight purchase visible */ } else { ST.phase = 'idle'; ST.msg = ''; ST.orderId = ''; }
  ST.from = from; const k = sku ? SKU_BY_ID[sku] : undefined; if (k) ST.tab = tabOf(k);
  if (k) ST.sel = ''; ui.open('store'); if (ui.modal !== 'store') { return; } track('store_open', undefined, { from }); if (k) { view(k.id); ui.render(); }
}

const swatch = (k: Sku) => { if (k.kind === 'line') { const d = COS_BY_ID[k.items![0]]; return `<span class="cosw" style="--c:${d.c};--c2:${d.c2 || d.c}">${d.slot === 'skin' ? (tierOf(d) || 'ch').slice(0, 2).toUpperCase() : COS_SLOT_ICON[d.slot]}</span>`; } if (k.kind === 'skin') { const d = COS_BY_ID[k.items![0]]; return `<span class="cosw" style="--c:${d.c};--c2:${d.c2 || d.c}">${COS_SLOT_ICON[d.slot]}</span>`; } return `<span class="cosw" style="--c:#c9a24a;--c2:#fff0b0">${k.kind === 'bundle' ? '★' : k.kind === 'storage_bank' ? 'BK' : 'LK'}</span>`; };
const RS = ['grey', 'green', 'blue', 'purple', 'orange'];
const rar = (k: Sku) => k.kind === 'skin' || k.kind === 'line' ? COS_BY_ID[k.items![0]].rarity : (k.kind === 'bundle' || k.kind === 'line_bundle') && k.items ? k.items.map(i => COS_BY_ID[i].rarity).reduce((m, r) => RS.indexOf(r) > RS.indexOf(m) ? r : m, 'green') : 'green';
const RANK = (k: Sku) => RS.indexOf(rar(k));

export function storeHtml(ui: UIx): string {
  const s = ui.g.save; const tabBtn = (id: StTab, label: string) => `<button class="btn tabb ${ST.tab === id ? 'primary' : ''}" data-act="st-tab" data-tab="${id}">${label}</button>`;
  const tile = (k: Sku, extra = '') => { const a = skuAvail(s, k.id); const c = priceFor(k.id); const d = k.items?.[0] ? COS_BY_ID[k.items[0]] : null; const b = d ? badgeOf(d.id) : ''; const st = d ? statusOf(d.id) : null;
    const when = st?.s === 'open' ? 'Available until ' + fmtDate(st.until) + ' (' + countdown(st.msLeft) + ' left)' : st?.s === 'retired' ? 'Retired · ' + fmtDate(st.from) + ' – ' + fmtDate(st.until) : '';
    return `<button class="slot tile st cos ${ST.sel === k.id ? 'sel' : ''} ${a.ok ? '' : 'off'}" data-act="st-sel" data-id="${k.id}" data-tip="${esc('<b>' + esc(k.name) + '</b>' + (d?.tier ? ' · ' + TIER[d.tier].label : '') + '<br>' + esc(k.desc) + (when ? '<br>' + esc(when) : '') + '<br><span class="mut">' + (a.ok ? usd(c) + ' SIMULATED' : a.why) + '</span>')}" aria-label="${esc(k.name + ', ' + (a.ok ? usd(c) + ' simulated price' : a.why))}" style="border-color:${RARITY_COLOR[rar(k) as keyof typeof RARITY_COLOR]}">${b ? `<span class="wdb xb-${b.toLowerCase()}">${b[0]}</span>` : ''}${extra}<span class="ticon">${swatch(k)}</span><span class="tn"><small>${a.ok ? usd(c) : esc(a.why)}</small></span></button>`; };
  let list = ''; 
  if (ST.tab === 'featured') {
    const hero = featured(), rot = rotation(), left = countdown(weekEnds() - rnow()); const hk = hero ? lineSku(hero.id) : null; const sp = SKU_BY_ID[STARTER.id], spa = skuAvail(s, sp.id);
    if (hero) track('featured_view', hk!.id, { week: Math.floor(weekEnds() / 6048e5) }); track('rotation_view', undefined, { ids: rot.map(r => r.id).join(',') });
    list = `<div class="sthero row" data-hero="${hero?.id || ''}">${hero ? `<img class="splash" alt="" src="store/splash/${hero.id}.webp" onerror="this.style.visibility='hidden'"><span><b class="cap">${esc(hero.name)}</b> <span class="tag" data-tip="${esc(TIER[hero.tier!].tip)}">${TIER[hero.tier!].label}</span><br><span class="mut">Hero of the week · ${Math.round(FEATURED_DISCOUNT * 100)}% off · ${usd(priceFor(hk!.id))} <s>${usd(hk!.cents)}</s></span></span><button class="btn ${ST.sel === hk!.id ? 'primary' : ''}" data-act="st-sel" data-id="${hk!.id}">View</button>` : ''}</div>`
      + `<div class="mut" data-rot data-tip="${esc('The rotation changes every Monday 00:00 UTC. Legendary skins are sold only while featured or in rotation; they come back in later weeks. Dated items (Founder, events) never return once retired.')}">Rotation · resets in ${left}</div><div class="stgrid wdgrid" data-rotation>${rot.map(d => tile(lineSku(d.id))).join('')}</div>`
      + (spa.ok ? `<div class="row ststarter" data-starter><span><b>${esc(STARTER.name)}</b> <span class="tag" data-tip="${esc('Separate value ' + usd(starterValueCents()) + '. One per account.')}">Once only</span><br><span class="mut">${esc(STARTER.desc)}</span></span><button class="btn ${ST.sel === sp.id ? 'primary' : ''}" data-act="st-sel" data-id="${sp.id}">${usd(sp.cents)}</button></div>` : '');
  } else if (ST.tab === 'lines') {
    const cols = collections(s); const L = LINE_BY_ID[ST.line] || LINES[0]; track('line_view', L.id);
    const sub = LINES.map(l => { const c = cols.find(x => x.line === l.id)!; return `<button class="btn tabb ${l.id === L.id ? 'primary' : ''}" data-act="st-line" data-line="${l.id}" data-tip="${esc(l.name + ': ' + l.theme + '. ' + c.have + '/' + c.total + ' owned' + (c.claimed ? ', reward claimed' : ''))}">${esc(l.name.split(' ')[0])} <small>${c.have}/${c.total}</small></button>`; }).join('');
    const items = CATALOG.filter(k => k.kind === 'line' && COS_BY_ID[k.items![0]].line === L.id);
    const lb = SKU_BY_ID['linebundle_' + L.id]; const c = cols.find(x => x.line === L.id)!;
    list = `<div class="wdtabs stlines">${sub}</div><div class="mut" data-col="${L.id}" data-tip="${esc('Own every ' + L.name + ' skin to unlock ' + (COS_BY_ID[L.reward]?.name || 'the reward') + '. ' + L.blurb)}">${esc(L.theme)} · ${c.have}/${c.total} · reward: ${esc(COS_BY_ID[L.reward]?.name || '')}${c.claimed ? ' ✓' : ''}</div><div class="stgrid wdgrid">${items.map(k => tile(k)).join('')}${lb ? tile(lb) : ''}</div>`;
  } else if (ST.tab === 'pass') {
    const p = passOf(s), lv = passLevel(p), cl = claimable(s); track('pass_view', SEASON.id, { level: lv, premium: p.premium }); const ps = SKU_BY_ID['pass_' + SEASON.id]; const st = statusOf(passRewards()[0].id);
    const rw = passRewards().map(d => { const r = d.src as any; const got = !!p.claimed[d.id]; return `<span class="slot tile st cos ${got ? '' : r.level > lv ? 'off' : ''}" data-tip="${esc('<b>' + esc(d.name) + '</b><br>Level ' + r.level + ' · ' + r.track + ' track<br>' + esc(d.desc))}" style="border-color:${RARITY_COLOR[d.rarity]}"><span class="ticon"><span class="cosw" style="--c:${d.c};--c2:${d.c2 || d.c}">${COS_SLOT_ICON[d.slot]}</span></span><span class="tn"><small>L${r.level}${r.track === 'premium' ? ' ★' : ''}${got ? ' ✓' : ''}</small></span></span>`; }).join('');
    list = `<div class="row" data-pass><span><b>${esc(SEASON.name)}</b> <span class="mut">Level ${lv}/${SEASON.levels} · ${p.xp % SEASON.xpPerLevel}/${SEASON.xpPerLevel} XP</span><br><span class="mut" data-tip="${esc('Pass XP comes from play: kills, elites, bosses, clears and first town visits. Rewards are cosmetic and retire when the season ends.')}">${st.s === 'open' ? 'Ends ' + fmtDate(st.until) + ' (' + countdown(st.msLeft) + ')' : 'Season closed'}</span></span>${cl.length ? `<button class="btn primary" data-act="st-claim">Claim ${cl.length}</button>` : ''}${p.premium ? '<span class="tag good">Premium</span>' : `<button class="btn ${ST.sel === ps.id ? 'primary' : ''}" data-act="st-sel" data-id="${ps.id}">Premium ${usd(ps.cents)}</button>`}</div><div class="stgrid wdgrid">${rw}</div>`;
  } else if (ST.tab === 'storage') {
    const lk = nextStorageSku(s, 'locker'), bk = nextStorageSku(s, 'bank'), st = storeOf(s), b = bankOf(s);
    const row = (k: Sku | null, title: string, now: string, n: number, max: number) => `<div class="row"><span><b>${title}</b> <span class="mut">${now}</span><br><span class="mut">${n}/${max} bought</span></span>${k ? `<button class="btn ${ST.sel === k.id ? 'primary' : ''}" data-act="st-sel" data-id="${k.id}">${esc(k.name)} · ${usd(k.cents)}</button>` : '<span class="tag good">Maxed</span>'}</div>`;
    list = row(lk, 'Locker', `${lockerCapOf(s)} slots now`, st.counters.locker, LOCKER_TIER_CENTS.length) + row(bk, 'Bank', `${b.tabs} tabs, ${bankCapacity(b)} slots now`, st.counters.bank, BANK_TIER_CENTS.length);
  } else {
    const items = CATALOG.filter(k => tabOf(k) === ST.tab).sort((p, q) => RANK(q) - RANK(p)); const lim = limitedSku();
    const tile = (k: Sku, spot = false) => { const a = skuAvail(s, k.id); const isLim = lim.sku.id === k.id; const badge = isLim ? `<i class="drb ltd" title="Limited: this week only">LTD</i>` : k.featured || rar(k) === 'orange' ? '<i class="drb feat" title="Featured">★</i>' : ''; return `<button class="slot tile st cos r-${rar(k)} ${spot ? 'spot' : ''} ${ST.sel === k.id ? 'sel' : ''} ${a.ok ? '' : 'off'}" data-act="st-sel" data-id="${k.id}" data-tip="${esc('<b>' + esc(k.name) + '</b><br>' + esc(k.desc) + '<br><span class="mut">' + (a.ok ? usd(k.cents) + ' SIMULATED' : a.why) + '</span>')}" aria-label="${esc(k.name + ', ' + (a.ok ? usd(k.cents) + ' simulated price' : a.why))}" style="border-color:${RARITY_COLOR[rar(k) as keyof typeof RARITY_COLOR]}"><span class="ticon">${swatch(k)}</span><span class="tn"><small>${a.ok ? usd(k.cents) : esc(a.why)}</small></span>${badge}</button>`; };
    const spot = ST.tab !== 'storage' ? [...new Map([lim.sku, ...featuredSkus()].filter(k => tabOf(k) === ST.tab).map(k => [k.id, k])).values()] : [];
    list = (spot.length ? `<div class="stspot"><span class="mut" data-tip="${esc('Featured legendary and epic skins. LTD rotates weekly (ends ' + new Date(lim.endsAt).toLocaleDateString() + ').')}">Featured</span><div class="stgrid wdgrid spotgrid">${spot.map(k => tile(k, true)).join('')}</div></div>` : '') + `<div class="stgrid wdgrid">${items.map(k => tile(k)).join('')}</div>`;
  }
  const k = ST.sel ? SKU_BY_ID[ST.sel] : null; let detail = '<div class="mut wdsel">Select an item for details. Prices are SIMULATED: nothing is charged.</div>';
  if (k && (tabOf(k) === ST.tab || (ST.tab === 'featured' && (k.kind === 'line' || k.kind === 'starter')) || (ST.tab === 'pass' && k.kind === 'pass'))) {
    const kc = priceFor(k.id); const d0 = k.kind === 'line' ? COS_BY_ID[k.items![0]] : null; const st0 = d0 ? statusOf(d0.id) : null;
    const a = skuAvail(s, k.id); const parts = (k.kind === 'bundle' || k.kind === 'line_bundle' || k.kind === 'starter' || (k.kind === 'line' && k.items!.length > 1)) && k.items ? k.items.map(i => `${esc(COS_BY_ID[i].name)}${ownsCos(s, i) ? ' (owned)' : ''}`).join(', ') : '';
    let act = '';
    if (ST.phase === 'confirm') act = `<span>Buy <b>${esc(k.name)}</b> for <b>${usd(kc)}</b>? <span class="tag">SIMULATED, no real charge</span></span><button class="btn primary" data-act="st-confirm">Confirm</button><button class="btn" data-act="st-cancel">Cancel</button>`;
    else if (ST.phase === 'processing') act = `<span class="mut" role="status">Processing payment (simulated)…</span><button class="btn" data-act="st-cancel">Cancel</button>`;
    else act = a.ok ? `<button class="btn primary" data-act="st-buy" data-id="${k.id}">Buy ${usd(kc)} <small>SIMULATED</small></button>` : `<span class="tag good">${esc(a.why)}</span>`;
    const show = (k.kind === 'skin' || k.kind === 'bundle') ? `<button class="btn" data-act="st-showcase" data-id="${k.id}" data-tip="${esc('Showcase: see it animate on your character in the dressing room')}">▶ Showcase</button>` : '';
    const prev = (k.kind === 'skin' || k.kind === 'line') && a.ok ? `<button class="btn" data-act="st-preview" data-id="${k.id}" data-tip="${esc('Try it on your character in the Wardrobe preview')}">Preview</button>` : '';
    const splash = d0 && d0.slot === 'skin' ? `<img class="splash" alt="" src="store/splash/${d0.id.split('__')[0]}.webp" onerror="this.style.visibility='hidden'">` : '';
    const when = st0?.s === 'open' ? `<div class="stwhen" data-countdown data-tip="${esc('Dated release. When this window closes it is retired for good and never sold again.')}">Available until ${fmtDate(st0.until)} · ${countdown(st0.msLeft)} left</div>` : st0?.s === 'retired' ? `<div class="stwhen" data-retired>Retired · ${fmtDate(st0.from)} – ${fmtDate(st0.until)}</div>` : '';
    detail = `<div class="wdsel">${splash}<b>${esc(k.name)}</b>${d0?.tier ? ` <span class="tag" data-tip="${esc(TIER[d0.tier].tip)}">${TIER[d0.tier].label}</span>` : ''} <span class="tag">${usd(kc)} SIMULATED</span>${when}<div>${esc(k.desc)}</div>${parts ? `<div class="mut">Includes: ${parts}</div>` : ''}${k.kind === 'skin' || k.kind === 'line' ? `<div class="mut">${esc(COS_SLOT_LABEL[COS_BY_ID[k.items![0]].slot])} · cosmetic only, no stat change</div>` : k.kind === 'storage_locker' ? `<div class="mut">+${LOCKER_SLOTS_PER_TIER} permanent locker slots. Price rises each tier.</div>` : k.kind === 'storage_bank' ? '<div class="mut">One more bank tab. Price rises each tier.</div>' : '<div class="mut">Cosmetic only, no stat change</div>'}<div class="wdact">${act}${ST.phase === 'idle' ? show + prev : ''}</div></div>`;
  }
  let fun = '';
  if (ST.funnel) { const f = funnel(); fun = `<div class="wdsel" data-funnel><b>Funnel (local, simulated)</b><div class="mut">views ${f.views} → starts ${f.starts} (${(f.viewToStart * 100).toFixed(0)}%) → successes ${f.successes} (${(f.startToSuccess * 100).toFixed(0)}%) · fails ${f.fails} · cancels ${f.cancels} · revenue ${usd(f.revenueCents)} SIMULATED</div>${Object.entries(f.perSku).map(([id, v]) => `<div class="mut">${esc(id)}: ${v.views}v ${v.starts}s ${v.successes}ok ${v.fails}f ${v.cancels}c</div>`).join('')}<div class="wdact"><button class="btn" data-act="st-export">Export JSON to console</button><span class="mut">Fail rate ${(MOCK_CFG.failureRate * 100).toFixed(0)}% · set with wvStore.config({failureRate:.3})</span></div></div>`; }
  const back = ST.from !== 'town' ? `<button class="btn" data-act="st-back">Back to ${ST.from}</button>` : '';
  return `<div class="col" data-store><div class="trayhead"><span class="wdtabs">${tabBtn('featured', 'Featured')}${tabBtn('lines', 'Lines')}${tabBtn('pass', 'Pass')}${tabBtn('skins', 'Skins')}${tabBtn('bundles', 'Bundles')}${tabBtn('storage', 'Storage')}</span><span class="trayctl"><span class="mut">SIMULATED · no real money</span><button class="btn ${ST.funnel ? 'primary' : ''}" data-act="st-funnel" aria-pressed="${ST.funnel}">Funnel</button>${back}</span></div>
    ${list}${detail}${ST.msg ? `<div class="bkmsg" role="status">${esc(ST.msg)}</div>` : ''}${fun}<div class="mut">Skins are appearance only. Storage is permanent. This prototype has no real checkout.</div></div>`;
}

export function storeClick(ui: UIx, el: HTMLElement, a: string): boolean {
  const g = ui.g, s = g.save;
  switch (a) {
    case 'st-open': { const from = ui.modal === 'wardrobe' ? 'wardrobe' : ui.modal === 'locker' ? 'locker' : ui.modal === 'bank' ? 'bank' : 'town'; openStore(ui, from, el.dataset.sku); return true; }
    case 'st-dismiss': dismissUpsell(); ui.render(); return true;
    case 'st-tab': if (ST.phase === 'processing') return true; ST.tab = (el.dataset.tab as StTab) || 'featured'; track('shop_tab', ST.tab); ST.sel = ''; ST.phase = 'idle'; ST.msg = ''; break;
    case 'st-sel': if (ST.phase === 'processing') return true; if (ST.phase === 'confirm' && ST.orderId) cancelOrder(ST.orderId); ST.phase = 'idle'; ST.msg = ''; view(el.dataset.id!); break;
    case 'st-showcase': { const k = SKU_BY_ID[el.dataset.id!]; if (!k?.items) return true; WD.showcase = true; if (k.kind === 'bundle') { WD.tab = 'all'; WD.show = 'all'; stageSet(s, k.id); ui.open('wardrobe'); } else previewFromStore(ui, k.items[0]); track('sku_view', k.id, { showcase: true }); return true; }
    case 'st-preview': { const k = SKU_BY_ID[el.dataset.id!]; if (!k?.items) return true; previewFromStore(ui, k.items[0]); return true; }
    case 'st-buy': { const r = startPurchase(s, el.dataset.id!); if (r.ok) { ST.orderId = r.order.orderId; ST.phase = 'confirm'; ST.msg = ''; } else ST.msg = r.why; break; }
    case 'st-confirm': {
      if (ST.phase !== 'confirm' || !ST.orderId) return true; const oid = ST.orderId; ST.phase = 'processing'; ST.msg = '';
      confirmPurchase(s, oid).then(r => { if (ST.orderId !== oid) return; ST.phase = 'done'; ST.msg = r.status === 'success' ? (r.duplicate ? r.why : 'Purchase complete (simulated). ' + (r.granted?.length ? 'Added to your account.' : '')) : r.why; if (r.status === 'success') g.toast?.('Outfitter: purchase complete (simulated)'); if (ui.modal === 'store') ui.render(); });
      break; }
    case 'st-cancel': { if (ST.orderId) cancelOrder(ST.orderId); ST.phase = 'idle'; ST.msg = 'Purchase cancelled. You were not charged.'; break; }
    case 'st-funnel': ST.funnel = !ST.funnel; break;
    case 'st-line': ST.line = el.dataset.line || 'hextech'; ST.sel = ''; ST.phase = 'idle'; ST.msg = ''; break;
    case 'st-claim': { const got = claimPass(s); persist(s); ST.msg = got.length ? 'Claimed: ' + got.map(i => COS_BY_ID[i].name).join(', ') : 'Nothing to claim yet.'; break; }
    case 'st-export': { const j = exportJson(); try { console.log(j); (navigator as any).clipboard?.writeText(j); } catch { /* ignore */ } ST.msg = 'Funnel exported to the browser console (and clipboard if allowed).'; break; }
    case 'st-back': ui.open(ST.from); return true;
    default: return false;
  }
  ui.render(); return true;
}
