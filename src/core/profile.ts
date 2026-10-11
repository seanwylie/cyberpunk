// Build profile: the part of a player's save that a party server needs to run their real combat build.
// The client sends it (small JSON); the server NEVER trusts it: sanitizeProfile clamps everything to the item/chip catalog.
import { ITEM_BY_ID, CHIPS, SLOTS, SLOT_SOCKETS, chipFits, PROGRESSION, REP_RANKS, STARTING, ABILITIES } from '../config';
import type { Slot, ChipId } from '../config';
import { newSave, mkInst } from '../state';
import type { Save } from '../state';

export interface Profile {
  level: number; rep: { HI: number; PS: number; MM: number };
  /** installed hardware, one entry per body part: item def id + socketed chips */
  items: { def: string; chips: string[] }[];
  abPick?: (string | null)[];
  /** this player's own pity state so their rolls stay individual across runs (server returns the updated values) */
  abAcq?: { total: number; dry: number };
  cos?: any;
}
const MAX_CHIPS_TOTAL = 40;

/** Make a profile from a real save (client side). */
export function profileOf(s: Save): Profile {
  const items: Profile['items'] = [];
  for (const sl of SLOTS) { const u = s.installed[sl]; const it = u && s.items.find(i => i.uid === u); if (it) items.push({ def: it.def, chips: [...it.chips] }); }
  return { level: s.level, rep: { ...s.rep }, items, abPick: s.abPick ? [...s.abPick] : undefined, abAcq: s.abAcq ? { ...s.abAcq } : undefined, cos: s.cosmetics };
}

/** Clamp an untrusted profile to what the catalog allows. Returns a fresh Save with a stock kit for anything invalid. */
export function sanitizeProfile(p: any, maxLevel = PROGRESSION.maxLevel): { save: Save; rejected: string[] } {
  const rejected: string[] = []; const s = newSave(); const raw = p && typeof p === 'object' ? p : {};
  s.level = Math.max(1, Math.min(maxLevel, Math.floor(+raw.level) || PROGRESSION.startLevel));
  const top = REP_RANKS[REP_RANKS.length - 1] + 40;
  for (const m of ['HI', 'PS', 'MM'] as const) s.rep[m] = Math.max(0, Math.min(top, Math.floor(+raw.rep?.[m]) || 0));
  const seen = new Set<Slot>(); let chipsTotal = 0;
  for (const e of (Array.isArray(raw.items) ? raw.items : []).slice(0, SLOTS.length)) {
    const d = ITEM_BY_ID[String(e?.def)]; if (!d) { rejected.push('item:' + String(e?.def).slice(0, 24)); continue; }
    if (d.id.startsWith('stock_')) continue; if (seen.has(d.slot)) { rejected.push('dup-slot:' + d.slot); continue; }
    if (d.lvl > s.level) { rejected.push('level:' + d.id); continue; }
    seen.add(d.slot); const it = mkInst(s, d.id); const cap = SLOT_SOCKETS[d.slot];
    for (const c of (Array.isArray(e.chips) ? e.chips : []).slice(0, cap)) { const id = String(c) as ChipId; if (!CHIPS[id] || !chipFits(id, d.slot) || chipsTotal >= MAX_CHIPS_TOTAL) { rejected.push('chip:' + String(c).slice(0, 24)); continue; } it.chips.push(id); chipsTotal++; }
    s.items.push(it); s.installed[d.slot] = it.uid;
  }
  if (Array.isArray(raw.abPick)) s.abPick = raw.abPick.slice(0, 3).map((x: any) => (typeof x === 'string' && ABILITIES[x] ? x : null));
  if (raw.abAcq && typeof raw.abAcq === 'object') s.abAcq = { total: Math.max(0, Math.min(1e4, Math.floor(+raw.abAcq.total) || 0)), dry: Math.max(0, Math.min(1e3, Math.floor(+raw.abAcq.dry) || 0)) };
  if (raw.cos && typeof raw.cos === 'object') { try { const j = JSON.stringify(raw.cos); if (j.length < 6000) (s as any).cosmetics = JSON.parse(j); } catch { /* ignore */ } }
  s.stims = 0;
  return { save: s, rejected };
}
export { STARTING };
