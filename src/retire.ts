// Retirement registry + exclusivity (Webkinz-style). See docs/MONETIZATION.md "Exclusives and retirement".
// A dated item (launch / event / season / founder window) is sold or earnable ONLY inside its window. When the window closes it is
// RETIRED FOREVER: never sold, never re-listed in any rotation, featured slot, bundle or pass, and never granted again (grantCos refuses).
// Owners keep it, with a provenance line ("Acquired <date> · Retired"). Retired items are ACCOUNT-BOUND (no trade, no gift, no mail).
// Nothing retired carries gameplay power: every row is a cosmetic (enforced by tests/exclusives.mjs).
import { PM_ROWS, type Window } from './content/skinlines';

/** Permanent registry. Append-only: an id here can never leave it, and tests fail if it shows up in any shop surface.
 *  Every item whose window has ended MUST be listed (tests/exclusives.mjs checks this against the data). */
export const RETIRED: Record<string, { retiredOn: string; reason: string }> = {
  ex_alpha_visor: { retiredOn: '2026-09-30', reason: 'Closed alpha ended' },
};
const __G = ((globalThis as any).__wvRetire ??= { now: null as number | null });
/** Clock (ms). Tests and the dev console can pin it: wvStore.clock('2026-11-02'). */
export const now = (): number => (__G.now ?? Date.now());
export const setClock = (t: number | string | null) => { __G.now = t == null ? null : typeof t === 'number' ? t : Date.parse(t.length <= 10 ? t + 'T12:00:00Z' : t); };
const end = (w: Window) => Date.parse(w.until + 'T23:59:59Z');
const start = (w: Window) => Date.parse(w.from + 'T00:00:00Z');
export const windowOf = (id: string): Window | null => { const r = PM_ROWS.find(x => x.id === id); return r && (r.src as any).window ? (r.src as any).window : null; };
export type Status = { s: 'always' } | { s: 'upcoming'; from: number } | { s: 'open'; until: number; msLeft: number } | { s: 'retired'; from: string; until: string };
export function statusOf(id: string, t = now()): Status {
  if (RETIRED[id]) { const w = windowOf(id); return { s: 'retired', from: w?.from || '', until: w?.until || RETIRED[id].retiredOn }; }
  const w = windowOf(id); if (!w) return { s: 'always' };
  if (t < start(w)) return { s: 'upcoming', from: start(w) };
  if (t > end(w)) return { s: 'retired', from: w.from, until: w.until };
  return { s: 'open', until: end(w), msLeft: end(w) - t };
}
export const isRetired = (id: string, t = now()) => statusOf(id, t).s === 'retired';
/** Exclusive = anything dated (founder, launch, event, season pass) or earn-only. These get badges + provenance. */
export const isExclusive = (id: string) => !!windowOf(id) || !!RETIRED[id];
export function badgeOf(id: string, t = now()): '' | 'Founder' | 'Retired' | 'Limited' | 'Exclusive' {
  const w = windowOf(id); if (!isExclusive(id)) return ''; if (w?.kind === 'founder') return 'Founder'; const s = statusOf(id, t).s;
  return s === 'retired' ? 'Retired' : s === 'open' && PM_ROWS.find(r => r.id === id)?.src.k !== 'exclusive' ? 'Limited' : 'Exclusive';
}
const fmtD = (iso: string | number) => { const d = new Date(typeof iso === 'number' ? iso : iso + 'T12:00:00Z'); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }); };
export const fmtDate = fmtD;
/** "Acquired Oct 12, 2026 · Retired (Oct 1 – Nov 1, 2026)" */
export function provenance(id: string, acquiredAt: number, t = now()): string {
  const st = statusOf(id, t); const a = 'Acquired ' + fmtD(acquiredAt);
  if (st.s === 'retired') return `${a} · Retired (${fmtD(st.from)} – ${fmtD(st.until)})`;
  if (st.s === 'open') return `${a} · Available until ${fmtD(st.until)}`;
  return a;
}
export function countdown(ms: number): string { const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4); return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${Math.max(0, m)}m`; }
/** Simulated owner counts ("1 of N owners"). The live game would read this from the account service; here it is a stable placeholder labelled SIMULATED. */
export function ownersOf(id: string): number { let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 120 + h % 2400; }
export const canTrade = (id: string) => !isExclusive(id); // account-bound: exclusives never move between accounts
