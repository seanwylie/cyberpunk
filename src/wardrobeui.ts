// Wardrobe modal (opened from the locker): icon grid, slot tabs, hover details, live preview on the character. Cosmetic only; no stats.
import { RARITIES, RARITY_COLOR, Rarity } from './config';
import { COSMETICS, COS_BY_ID, COS_SLOTS, COS_SLOT_ICON, COS_SLOT_LABEL, COS_THEME_LABEL, CosDef, CosSlot, buyCos, checkAchievements, cosOf, equipCos, equippedCos, ownsCos, ACHIEVEMENTS } from './content/appearance';
import { applyCosmeticVariants, bodyOf } from './bodyvariants';
import { drawCosmetics, drawTrail } from './cosmetics';
import { persist } from './state';
type UIx = any;
const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const WD = { tab: 'all' as 'all' | CosSlot, sel: '', show: 'owned' as 'owned' | 'all', msg: '' };
const rc = (r: Rarity) => RARITY_COLOR[r];
const SRC_HINT = (d: CosDef): string => { const s = d.src; switch (s.k) {
  case 'vendor': return 'Sold at the wardrobe counter for ' + s.price + 'c';
  case 'drop': return 'Drops from kills (rare from mobs, better from elites and bosses)';
  case 'elite': return 'Drops from elites and bosses';
  case 'boss': return 'Drops from any boss';
  case 'bossId': return 'Drops from one specific boss';
  case 'ach': return 'Achievement: ' + (ACHIEVEMENTS.find(a => a.key === s.key)?.label || s.key);
  case 'event': return 'Extremely rare: a tiny chance on any boss kill'; } };
/** Discovery: owned, sold by the vendor, or equipped is "known"; everything else shows only slot/rarity/source until found. */
export const isKnown = (s: any, d: CosDef) => ownsCos(s, d.id) || d.src.k === 'vendor';
const tipOf = (s: any, d: CosDef) => { const known = isKnown(s, d); return `<b style="color:${rc(d.rarity)}">${known ? esc(d.name) : '???'}</b><br>${esc(COS_SLOT_LABEL[d.slot])} · ${d.rarity}${known ? ' · ' + esc(COS_THEME_LABEL[d.theme]) : ''}<br>` + (known ? `${esc(d.desc)}<br><span class="mut">${esc(d.lore)}</span><br>` : '') + `<span class="mut">${ownsCos(s, d.id) ? 'Owned' : esc(SRC_HINT(d))}</span>`; };
const swatch = (d: CosDef, known: boolean) => known ? `<span class="cosw" style="--c:${d.c};--c2:${d.c2 || d.c}">${COS_SLOT_ICON[d.slot]}</span>` : `<span class="cosw unk">?</span>`;

export function wardrobeHtml(ui: UIx): string {
  const s = ui.g.save, c = cosOf(s); const eq = c.equipped;
  const tabBtn = (id: string, label: string, title: string) => `<button class="btn tabb ${WD.tab === id ? 'primary' : ''}" data-act="wd-tab" data-tab="${id}" data-tip="${esc(title)}" aria-label="${esc(title)}">${label}</button>`;
  const tabs = tabBtn('all', 'All', 'All slots') + COS_SLOTS.map(sl => tabBtn(sl, COS_SLOT_ICON[sl], COS_SLOT_LABEL[sl])).join('');
  const inTab = (d: CosDef) => WD.tab === 'all' || d.slot === WD.tab;
  const list = COSMETICS.filter(d => inTab(d) && (WD.show === 'all' || ownsCos(s, d.id) || d.src.k === 'vendor')).sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || a.name.localeCompare(b.name));
  const tiles = list.map(d => { const own = ownsCos(s, d.id), on = eq[d.slot] === d.id, known = isKnown(s, d);
    return `<button class="slot tile st cos ${WD.sel === d.id ? 'sel' : ''} ${own ? '' : 'off'} ${on ? 'worn' : ''}" data-act="wd-sel" data-id="${d.id}" data-tip="${esc(tipOf(s, d))}" aria-label="${esc((known ? d.name : 'Undiscovered ' + COS_SLOT_LABEL[d.slot]) + ', ' + d.rarity + (own ? (on ? ', equipped' : ', owned') : ', not owned'))}" style="border-color:${rc(d.rarity)}"><span class="ticon">${swatch(d, known)}</span>${on ? '<i class="wornb" title="Equipped">●</i>' : ''}${own ? '' : d.src.k === 'vendor' ? `<i class="pricb">${d.src.price}c</i>` : ''}</button>`; }).join('') || '<div class="mut">Nothing here yet. Cosmetics drop from elites and bosses, or can be bought at the counter. Use "Show all" to see what is out there.</div>';
  const d = WD.sel ? COS_BY_ID[WD.sel] : null;
  const detail = d ? (() => { const own = ownsCos(s, d.id), on = eq[d.slot] === d.id, known = isKnown(s, d);
    const act = own ? `<button class="btn primary" data-act="wd-equip" data-id="${d.id}">${on ? 'Unequip' : 'Equip'}</button>` : d.src.k === 'vendor' ? `<button class="btn primary" data-act="wd-buy" data-id="${d.id}" ${s.credits >= d.src.price ? '' : 'disabled'}>Buy ${d.src.price}c</button>` : `<span class="mut">${esc(SRC_HINT(d))}</span>`;
    return `<div class="wdsel"><b style="color:${rc(d.rarity)}">${known ? esc(d.name) : '???'}</b> <span class="tag" style="border-color:${rc(d.rarity)}">${d.rarity}</span> <span class="mut">${esc(COS_SLOT_LABEL[d.slot])}${known ? ' · ' + esc(COS_THEME_LABEL[d.theme]) : ''}</span><div>${known ? esc(d.desc) : 'Not discovered yet.'}</div>${known ? `<div class="mut">${esc(d.lore)}</div>` : ''}<div class="wdact">${act}${d.variant ? '<span class="mut"> uses real body-part art</span>' : known ? '<span class="mut"> procedural look</span>' : ''}</div></div>`; })()
    : '<div class="mut wdsel">Select an item to preview it on your character. Hover tiles for details.</div>';
  const have = COSMETICS.filter(x => c.owned[x.id]).length;
  const per = RARITIES.map(r => { const t = COSMETICS.filter(x => x.rarity === r), h = t.filter(x => c.owned[x.id]).length; return `<span class="repb" style="--ac:${rc(r)}" data-tip="${esc(r + ': ' + h + ' of ' + t.length + ' collected')}">${h}/${t.length}</span>`; }).join('');
  return `<div class="wdwrap"><div class="wdleft"><canvas id="wdprev" width="220" height="260" aria-label="Character preview"></canvas>
      <div class="wdworn">${COS_SLOTS.map(sl => { const id = eq[sl], w = id && c.owned[id] ? COS_BY_ID[id] : null; return `<button class="slot tile mini wslot ${WD.tab === sl ? 'sel' : ''}" data-act="${w ? 'wd-unslot' : 'wd-tab'}" data-tab="${sl}" data-slot="${sl}" data-tip="${esc(w ? '<b style="color:' + rc(w.rarity) + '">' + esc(w.name) + '</b><br>' + COS_SLOT_LABEL[sl] + '<br><i>Click: unequip</i>' : '<b>' + COS_SLOT_LABEL[sl] + '</b><br>Nothing equipped. Click to browse.')}" style="border-color:${w ? rc(w.rarity) : '#555'}" aria-label="${esc(COS_SLOT_LABEL[sl] + ': ' + (w ? w.name : 'empty'))}"><span class="ticon">${w ? swatch(w, true) : '<span class="tempty">·</span>'}</span></button>`; }).join('')}</div>
      <div class="wdcount mut">Collected ${have}/${COSMETICS.length}</div><div class="repbar">${per}</div></div>
    <div class="wdright"><div class="wdtabs">${tabs}</div>
      <div class="trayhead"><span class="mut">Cosmetics never change stats. ${ui.g.save.credits}c</span><span class="trayctl"><button class="btn ${WD.show === 'all' ? 'primary' : ''}" data-act="wd-show" aria-pressed="${WD.show === 'all'}">Show all</button><button class="btn" data-act="wd-clear">Clear all</button><button class="btn" data-act="wd-back">Back to locker</button></span></div>
      <div class="stgrid wdgrid">${tiles}</div>${detail}${WD.msg ? `<div class="bkmsg" role="status">${esc(WD.msg)}</div>` : ''}</div></div>`;
}

export function wardrobeClick(ui: UIx, el: HTMLElement, a: string): boolean {
  const g = ui.g, s = g.save;
  switch (a) {
    case 'wd-open': for (const d of checkAchievements(s)) g.toast('Wardrobe unlocked: ' + d.name); ui.open('wardrobe'); return true;
    case 'wd-tab': WD.tab = (el.dataset.tab as any) || 'all'; break;
    case 'wd-show': WD.show = WD.show === 'all' ? 'owned' : 'all'; break;
    case 'wd-sel': WD.sel = el.dataset.id!; WD.msg = ''; break;
    case 'wd-equip': { const id = el.dataset.id!, d = COS_BY_ID[id]; if (d && cosOf(s).equipped[d.slot] === id) equipCos(s, null, d.slot); else equipCos(s, id); persist(s); WD.msg = ''; break; }
    case 'wd-unslot': equipCos(s, null, el.dataset.slot as CosSlot); persist(s); break;
    case 'wd-clear': cosOf(s).equipped = {}; persist(s); break;
    case 'wd-buy': { const r = buyCos(s, el.dataset.id!); WD.msg = r.why; if (r.ok) { persist(s); g.toast(r.why); } break; }
    case 'wd-back': ui.open('locker'); return true;
    default: return false;
  }
  ui.render(); return true;
}

/** Called after each render: start the live preview loop (re-uses the real animated sprite when available). */
let raf = 0;
export function wardrobeAfter(ui: UIx) {
  const cv = document.getElementById('wdprev') as HTMLCanvasElement | null; cancelAnimationFrame(raf); if (!cv) return;
  const g = ui.g, s = g.save, ctx = cv.getContext('2d')!; const rend = (window as any).__rend; const t0 = performance.now();
  const frame = () => { if (!document.getElementById('wdprev')) return; const t = (performance.now() - t0) / 1000;
    const eq = equippedCos(s).filter(x => !(WD.sel && COS_BY_ID[WD.sel] && COS_BY_ID[WD.sel].slot === x.slot)); const sel = WD.sel ? COS_BY_ID[WD.sel] : null; const list = sel ? [...eq, sel] : eq;
    ctx.clearRect(0, 0, cv.width, cv.height); const gr = ctx.createRadialGradient(110, 150, 10, 110, 150, 140); gr.addColorStop(0, '#2b2d2c'); gr.addColorStop(1, '#141516'); ctx.fillStyle = gr; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(110, 222, 50, 14, 0, 0, 7); ctx.fill();
    const u = 3.7, k = { c: ctx, x: 110, y: 222, u, t, moving: false, face: 0 };
    const tr = list.find(x => x.slot === 'trail'); if (tr) drawTrail(ctx, Array.from({ length: 14 }, (_, i) => ({ x: 110 - 8 - i * 7, y: 222 + (i % 2) * 2, t: t - i * .06 })), t, u, tr);
    drawCosmetics(k, list, 'back'); let drew = false;
    if (rend?.anim) { try { const body = applyCosmeticVariants(bodyOf({ ...s, cosmetics: { owned: {}, equipped: {} } } as any, null), { cosmetics: { owned: Object.fromEntries(list.map(x => [x.id, 1])), equipped: Object.fromEntries(list.map(x => [x.slot, x.id])) } } as any); rend.anim.setBody(body); drew = rend.anim.draw(ctx, 110, 222, u); } catch { drew = false; } }
    if (!drew) { ctx.fillStyle = '#5c5f5a'; ctx.beginPath(); ctx.ellipse(110, 222 - 28 * u, 8.5 * u, 10 * u, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#b8a48c'; ctx.beginPath(); ctx.ellipse(110, 222 - 41 * u, 5.2 * u, 5.8 * u, 0, 0, 7); ctx.fill(); ctx.fillRect(110 - 8 * u, 222 - 20 * u, 6.5 * u, 20 * u); ctx.fillRect(110 + 1.5 * u, 222 - 20 * u, 6.5 * u, 20 * u); }
    drawCosmetics(k, list, 'front'); raf = requestAnimationFrame(frame); };
  frame();
}
export { checkAchievements };
