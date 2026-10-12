// Travel (Reach Line) and Guild Counter modals. Hooked from ui.ts through `tv-*` / `gd-*` actions.
import { CHIPS, ChipId, RARITY_COLOR, STARTING } from './config';
import { TOWN_INFO, currentTown, travelCheck, isUnlocked, unlockHint, unlockProgress, type TownId } from './towns';
import { bankOverflowChip, lockerFree } from './bank';
import { persist } from './state';
import { WORLD, WORLD_BY_ID, FIRST_VISIT_XP } from './world';
import { stationsOf } from './worldtowns';
import { worldOf, dungeonsAt, discoveredCount } from './discovery';
type UIx = any;
const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const TV: { msg: string; sel: string } = { msg: '', sel: '' };
/** Reach Line transit screen: a world map of every district (short labels, full details on hover/tap) plus a detail card for the selected town. */
export function travelHtml(ui: UIx): string {
  const s = ui.g.save, here = currentTown(s); const dc = discoveredCount(s); const sel = TV.sel && WORLD_BY_ID[TV.sel] ? TV.sel : here; const lv = s.level; const W = worldOf(s);
  const links = WORLD.flatMap((a, i) => WORLD.slice(i + 1).filter(b => Math.hypot(a.map[0] - b.map[0], a.map[1] - b.map[1]) < 32).map(b => `<line x1="${a.map[0]}" y1="${a.map[1]}" x2="${b.map[0]}" y2="${b.map[1]}"/>`)).join('');
  const nodes = WORLD.map(t => { const cur = t.id === here, seen = !!W.visited[t.id], above = lv < t.band[0], lock = !isUnlocked(s, t.id);
    const tip = `<b style="color:${t.color}">${esc(t.name)}</b><br>Lv ${t.band[0]}–${t.band[1]} · ${esc(t.faction)}<br>${esc(t.theme)}${above ? '<br><i>Above your level: safe to visit</i>' : ''}${lock ? '<br><b>Locked.</b> ' + esc(unlockHint(t.id)) : seen ? '' : '<br>Not visited yet'}`;
    return `<button class="wmnode ${lock ? 'locked' : ''} ${cur ? 'here' : ''} ${t.id === sel ? 'sel' : ''} ${seen ? 'seen' : 'new'} ${above ? 'above' : ''}" style="left:${t.map[0]}%;top:${t.map[1]}%;--tc:${t.color}" data-act="tv-sel" data-id="${t.id}" data-tip="${esc(tip)}" aria-label="${esc(t.name)}"><i></i><span>${esc(t.short)}</span></button>`; }).join('');
  const t = WORLD_BY_ID[sel], cur = sel === here, above = lv < t.band[0], lockSel = !isUnlocked(s, sel);
  const st = stationsOf(sel).map(x => `<span class="wmst" style="--sc:${x.color}" data-tip="${esc(x.name)}" aria-label="${esc(x.name)}">${esc(x.short)}</span>`).join('');
  const dg = dungeonsAt(sel).map(d => `<span class="tag ${lv < d.minLevel ? 'lock' : ''}" data-tip="${esc(d.name + ' · Lv ' + d.minLevel + '–' + d.maxLevel)}">${esc(d.short || d.name)}</span>`).join('');
  const card = `<div class="tvcard ${cur ? 'here' : ''}" style="--tc:${t.color}" data-town="${t.id}"><div class="tvhead"><b>${esc(t.name)}</b>${cur ? '<span class="tag">You are here</span>' : lockSel ? '<span class="tag lock">Locked</span>' : above ? '<span class="tag lock" data-tip="Towns are safe at any level. The gear and gates here are for later.">Above your level</span>' : '<span class="tag ok">Open</span>'}</div>
    <div class="wmmeta"><span class="tag">Lv ${t.band[0]}–${t.band[1]}</span><span class="tag" data-tip="Faction">${esc(t.faction)}</span><span class="tag">${esc(t.theme)}</span>${W.visited[t.id] || t.id === 'rustline' ? '' : `<span class="tag ok" data-tip="First visit bonus">+${FIRST_VISIT_XP(t)} XP</span>`}</div>
    <p>${esc(t.blurb)}</p>${t.gen ? `<div class="wmlm" data-tip="${esc(W.landmarks[t.id] ? t.gen.landmark.blurb : 'Find this landmark in town to log it.')}"><b>Landmark</b> ${W.landmarks[t.id] ? esc(t.gen.landmark.name) : '???'}</div>` : ''}<div class="wmrow">${st}</div>${dg ? `<div class="wmrow">${dg}</div>` : ''}
    ${lockSel ? `<div class="tvprog" data-unlock="${t.id}"><b>To unlock</b>${unlockProgress(s, sel).lines.map(l => `<div>${esc(l)}</div>`).join('')}</div>` : ''}<button class="btn ${cur || lockSel ? '' : 'primary'}" data-act="tv-go" data-id="${t.id}" ${cur || lockSel ? 'disabled' : ''}>${cur ? 'Current town' : lockSel ? 'Line closed' : 'Ride the Reach Line'}</button></div>`;
  return `<div class="travelwrap"><div class="mut">The Reach Line links every district. Travel is free and instant, towns are safe at any level, and new lines open as you make a name. <b data-atlas>Atlas ${dc.towns}/${dc.total} towns · ${dc.landmarks}/${dc.totalLm} landmarks</b></div>${TV.msg ? `<div class="bkmsg" role="status">${esc(TV.msg)}</div>` : ''}
    <div class="wmgrid"><div class="wmap" role="list"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${links}</svg>${nodes}</div>${card}</div></div>`;
}
/** Guild Counter: the Line 7 Retirees' Guild reclaims chips from shift lockers. Blue and purple chips for credits; purple needs level 18. */
export const GUILD_PRICE: Record<string, number> = { blue: 240, purple: 950 };
export const GUILD_PURPLE_LEVEL = 18;
export const guildStock = (): ChipId[] => (Object.keys(CHIPS) as ChipId[]).filter(c => GUILD_PRICE[CHIPS[c].rarity] !== undefined).sort((a, b) => GUILD_PRICE[CHIPS[a].rarity] - GUILD_PRICE[CHIPS[b].rarity] || CHIPS[a].name.localeCompare(CHIPS[b].name));
export function guildHtml(ui: UIx): string {
  const s = ui.g.save; const rc = (r: string) => (RARITY_COLOR as any)[r];
  const tiles = guildStock().map(c => { const d = CHIPS[c], p = GUILD_PRICE[d.rarity], lock = d.rarity === 'purple' && s.level < GUILD_PURPLE_LEVEL, poor = s.credits < p;
    return `<button class="slot tile st bk gd ${lock || poor ? 'off' : ''}" data-act="gd-buy" data-chip="${c}" data-tip="${esc(`<b style="color:${rc(d.rarity)}">${d.name}</b><br>${d.desc}<br>${p}c${lock ? ' · needs level ' + GUILD_PURPLE_LEVEL : ''}`)}" aria-label="${esc(d.name + ' ' + p + ' credits')}" style="border-color:${rc(d.rarity)}"><span class="ticon"></span><span class="cnt">${p}c</span></button>`; }).join('');
  return `<div class="bankwrap"><div class="mut">Guild Counter · Line 7 Retirees' Guild. Reclaimed chips, no questions. Bought chips go to the locker (or the bank when the locker is full).</div><div class="bkhead"><span class="bkcred"><b>Wallet</b> ${s.credits}c</span><span class="mut">Locker free slots: ${lockerFree(s)}</span></div>${TV.msg ? `<div class="bkmsg" role="status">${esc(TV.msg)}</div>` : ''}<div class="bkgrid" role="list">${tiles}</div></div>`;
}
export function townClick(ui: UIx, el: HTMLElement, a: string): boolean {
  const g = ui.g, s = g.save; const done = (m: string) => { TV.msg = m; persist(s); ui.render(); return true; };
  if (a === 'tv-sel') { TV.sel = el.dataset.id || ''; TV.msg = ''; ui.render(); return true; }
  if (a === 'tv-go') { const id = el.dataset.id as TownId; const c = travelCheck(s, id); if (!c.ok) return done(c.why); TV.msg = ''; rideTram(ui, id); return true; }
  if (a === 'gd-buy') { const c = el.dataset.chip as ChipId, d = CHIPS[c], p = GUILD_PRICE[d.rarity];
    if (d.rarity === 'purple' && s.level < GUILD_PURPLE_LEVEL) return done(`${d.name} needs level ${GUILD_PURPLE_LEVEL}.`); if (s.credits < p) return done(`Needs ${p}c.`);
    if ((s.lockerChips[c] || 0) > 0 || lockerFree(s) > 0) { s.lockerChips[c] = (s.lockerChips[c] || 0) + 1; } else if (!bankOverflowChip(s, c, 1)) return done('Locker and bank are full.');
    s.credits -= p; return done(`Bought ${d.name}.`); }
  return false;
}
void STARTING;

/** Tram interlude: a short Reach Line screen that preloads the destination's art, then travels. Re-entrancy safe. */
let riding = false;
export async function rideTram(ui: UIx, id: TownId) {
  if (riding) return; riding = true; const g = ui.g;
  const ov = document.createElement('div'); ov.id = 'tramload'; ov.setAttribute('role', 'status'); ov.setAttribute('aria-live', 'polite');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#07090c;color:#e8d9c0;font:600 18px "Roboto Condensed",sans-serif;letter-spacing:.12em;text-transform:uppercase;opacity:0;transition:opacity .18s';
  ov.innerHTML = `<div style="color:${TOWN_INFO[id].color}">Reach Line</div><div style="font-size:13px;opacity:.75">Riding to ${esc(TOWN_INFO[id].name)}…</div><div style="width:240px;height:4px;background:#222;border-radius:2px;overflow:hidden"><i id="tramfill" style="display:block;height:100%;width:0;background:${TOWN_INFO[id].color};transition:width 1s linear"></i></div>`;
  document.body.appendChild(ov); requestAnimationFrame(() => { ov.style.opacity = '1'; const f = document.getElementById('tramfill'); if (f) f.style.width = '92%'; });
  try { await Promise.all([Promise.resolve(g.townPreload?.(id)).catch(() => {}), new Promise(r => setTimeout(r, 900))]); ui.close(); g.travel(id); }
  finally { ov.style.opacity = '0'; setTimeout(() => ov.remove(), 220); riding = false; }
}
