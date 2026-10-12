// Inspect card for another player (click/tap them in town or a party): their exclusives with Founder/Retired badges,
// "Acquired <date> · Retired" provenance and a SIMULATED owner count. Short labels, details in data-tip tooltips (UI rule).
import { COS_BY_ID } from './content/appearance';
import { badgeOf, provenance, ownersOf, isExclusive } from './retire';
import { RARITY_COLOR } from './config';
import { track } from './analytics';
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
export interface InspectTarget { id: string; name: string; lvl?: number; look?: { cos?: string[]; ex?: [string, number][]; sc?: string } }
/** Exclusives a look advertises (owned list with acquisition time, falling back to equipped exclusive ids). */
export function exclusivesOf(p: InspectTarget): { id: string; at: number }[] {
  const ex = (p.look?.ex || []).filter(([id]) => COS_BY_ID[id] && isExclusive(id)).map(([id, at]) => ({ id, at: +at || 0 }));
  for (const id of p.look?.cos || []) if (isExclusive(id) && !ex.some(e => e.id === id)) ex.push({ id, at: 0 });
  return ex;
}
export function inspectHtml(p: InspectTarget): string {
  const ex = exclusivesOf(p); const sc = p.look?.sc && COS_BY_ID[p.look.sc] ? p.look.sc : ex[0]?.id;
  const row = (e: { id: string; at: number }) => { const d = COS_BY_ID[e.id]; const b = badgeOf(e.id); const prov = e.at ? provenance(e.id, e.at) : 'Equipped'; const n = ownersOf(e.id);
    return `<li class="xi-row" data-id="${e.id}"><span class="xi-name cap" style="color:${(RARITY_COLOR as any)[d.rarity] || '#ddd'}" data-tip="${esc(d.name + ': ' + d.desc)}">${esc(d.name)}</span>`
      + (b ? ` <span class="xbadge xb-${b.toLowerCase()}" data-tip="${esc(b === 'Founder' ? 'Launch-window item. Retired for good after its window.' : b === 'Retired' ? 'No longer obtainable. It will never return.' : b === 'Limited' ? 'Dated release: retired when its window closes.' : 'Earn-only exclusive')}">${b}</span>` : '')
      + `<div class="xi-prov mut" data-tip="${esc(prov + ' · 1 of ' + n + ' owners (SIMULATED count)')}">${esc(prov)}</div></li>`; };
  return `<div class="xi-head"><b class="cap">${esc(p.name)}</b>${p.lvl ? ` <span class="mut">Lv ${p.lvl}</span>` : ''}<button class="btn xi-x" data-act="xi-close" aria-label="Close" data-tip="Close">✕</button></div>`
    + (sc ? `<div class="xi-show" data-tip="Showcase: the exclusive this player pinned">◆ <span class="cap">${esc(COS_BY_ID[sc].name)}</span></div>` : '')
    + (ex.length ? `<ul class="xi-list">${ex.slice(0, 8).map(row).join('')}</ul>` : '<div class="mut">No exclusives yet.</div>');
}
export function openInspect(p: InspectTarget) {
  let el = document.getElementById('xinspect'); if (!el) { el = document.createElement('div'); el.id = 'xinspect'; el.className = 'panel xinspect'; el.setAttribute('role', 'dialog'); document.body.appendChild(el);
    el.addEventListener('click', e => { if ((e.target as HTMLElement).closest('[data-act="xi-close"]')) closeInspect(); }); }
  el.innerHTML = inspectHtml(p); el.dataset.pid = p.id; el.style.display = 'block'; track('inspect_open', p.id, { exclusives: exclusivesOf(p).length });
}
export function closeInspect() { const el = document.getElementById('xinspect'); if (el) el.style.display = 'none'; }
if (typeof window !== 'undefined') (window as any).__inspect = { openInspect, closeInspect, inspectHtml, exclusivesOf };
