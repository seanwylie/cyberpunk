// Travel (Reach Line) and Guild Counter modals. Hooked from ui.ts through `tv-*` / `gd-*` actions.
import { CHIPS, ChipId, RARITY_COLOR, STARTING } from './config';
import { TOWN_IDS, TOWN_INFO, currentTown, isUnlocked, travelCheck, unlockProgress, type TownId } from './towns';
import { bankOverflowChip, lockerFree } from './bank';
import { persist } from './state';
type UIx = any;
const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const TV = { msg: '' };
export function travelHtml(ui: UIx): string {
  const s = ui.g.save, here = currentTown(s);
  const cards = TOWN_IDS.map((id: TownId) => { const I = TOWN_INFO[id], un = isUnlocked(s, id), pr = unlockProgress(s, id), cur = here === id;
    return `<div class="tvcard ${cur ? 'here' : ''} ${un ? '' : 'locked'}" style="--tc:${I.color}" data-town="${id}"><div class="tvhead"><b>${esc(I.name)}</b>${cur ? '<span class="tag">You are here</span>' : un ? '<span class="tag ok">Open</span>' : '<span class="tag lock">Locked</span>'}</div>
      <p>${esc(I.blurb)}</p>${un ? '' : `<div class="tvprog"><b>To unlock</b>${pr.lines.map(l => `<div>${esc(l)}</div>`).join('')}</div>`}
      <button class="btn ${cur ? '' : 'primary'}" data-act="tv-go" data-id="${id}" ${cur || !un ? 'disabled' : ''}>${cur ? 'Current town' : un ? 'Ride the Reach Line' : 'Locked'}</button></div>`; }).join('');
  return `<div class="travelwrap"><div class="mut">The Reach Line runs freight and passengers between the towns. Travel is free and instant. Your instance and loot stay where they are; Tier III and IV dungeon gates are at Harrow Reach.</div>${TV.msg ? `<div class="bkmsg" role="status">${esc(TV.msg)}</div>` : ''}<div class="tvlist">${cards}</div></div>`;
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
  if (a === 'tv-go') { const id = el.dataset.id as TownId; const c = travelCheck(s, id); if (!c.ok) return done(c.why); TV.msg = ''; ui.close(); g.travel(id); return true; }
  if (a === 'gd-buy') { const c = el.dataset.chip as ChipId, d = CHIPS[c], p = GUILD_PRICE[d.rarity];
    if (d.rarity === 'purple' && s.level < GUILD_PURPLE_LEVEL) return done(`${d.name} needs level ${GUILD_PURPLE_LEVEL}.`); if (s.credits < p) return done(`Needs ${p}c.`);
    if ((s.lockerChips[c] || 0) > 0 || lockerFree(s) > 0) { s.lockerChips[c] = (s.lockerChips[c] || 0) + 1; } else if (!bankOverflowChip(s, c, 1)) return done('Locker and bank are full.');
    s.credits -= p; return done(`Bought ${d.name}.`); }
  return false;
}
void STARTING;
