// Monetization levers on top of the simulated store (docs/MONETIZATION.md): tiered line skins, weekly rotation + featured hero skin,
// once-only starter pack, line collections with completion rewards, a season pass (free + premium tracks, XP from play),
// and exclusives (src/retire.ts). Everything granted here is cosmetic. Rotation is a pure function of the week number.
import type { Save } from './state';
import { COSMETICS, COS_BY_ID, CosDef, cosOf, grantCos, ownsCos } from './content/appearance';
import { LINES, SEASON, TIER, INCLUDES, type SkinTier } from './content/skinlines';
import { isRetired, now, RETIRED, statusOf } from './retire';
import { track } from './analytics';

// ---------------------------------------------------------------- catalogue helpers
export const lineSkins = (line: string): CosDef[] => COSMETICS.filter(d => d.line === line && d.slot === 'skin' && (d.src.k === 'shop'));
export const shopItems = (): CosDef[] => COSMETICS.filter(d => d.src.k === 'shop' || d.src.k === 'chroma');
export const priceOf = (d: CosDef): number => (d.src as any).cents | 0;
export const tierOf = (d: CosDef): SkinTier | null => (d.src.k === 'shop' ? (d.src as any).tier : null);
/** Can this cosmetic be sold right now? Retired = never. Dated = only inside its window. Chromas need the base skin. */
export function sellable(d: CosDef, s?: Save, t = now()): { ok: boolean; why: string } {
  if (d.src.k !== 'shop' && d.src.k !== 'chroma') return { ok: false, why: 'Not sold' };
  if (RETIRED[d.id] || isRetired(d.id, t)) return { ok: false, why: 'Retired' };
  const st = statusOf(d.id, t); if (st.s === 'upcoming') return { ok: false, why: 'Not yet available' };
  if (s && d.src.k === 'chroma' && !ownsCos(s, (d.src as any).of)) return { ok: false, why: 'Needs ' + (COS_BY_ID[(d.src as any).of]?.name || 'the base skin') };
  if (s && ownsCos(s, d.id)) return { ok: false, why: 'Owned' };
  return { ok: true, why: '' };
}

// ---------------------------------------------------------------- weekly rotation (deterministic)
export const WEEK_MS = 7 * 864e5; const EPOCH = Date.parse('2026-01-05T00:00:00Z'); // a Monday, 00:00 UTC
export const weekOf = (t = now()) => Math.floor((t - EPOCH) / WEEK_MS);
export const weekEnds = (w = weekOf()) => EPOCH + (w + 1) * WEEK_MS;
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
/** The hero skin of the week: cycles through Legendary/Ultimate skins that are sellable that week. */
export function featured(w = weekOf()): CosDef | null {
  const t = EPOCH + w * WEEK_MS + 3600e3; const L = COSMETICS.filter(d => d.slot === 'skin' && (tierOf(d) === 'legendary' || tierOf(d) === 'ultimate') && sellable(d, undefined, t).ok);
  return L.length ? L[((w % L.length) + L.length) % L.length] : null;
}
export const ROTATION_SIZE = 6;
/** 6 rotating offers: seeded by the week, never the featured skin, never retired, chromas excluded (sold from the skin page). */
export function rotation(w = weekOf()): CosDef[] {
  const t = EPOCH + w * WEEK_MS + 3600e3; const hero = featured(w)?.id; const r = rng(0x9e3779b1 ^ (w * 2654435761 >>> 0));
  const pool = COSMETICS.filter(d => d.src.k === 'shop' && d.id !== hero && sellable(d, undefined, t).ok).sort((a, b) => a.id < b.id ? -1 : 1);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, ROTATION_SIZE);
}
/** Featured weekly discount on the hero skin (20%), shown with the original price. Clear pricing, no fake "was" prices. */
export const FEATURED_DISCOUNT = 0.2;
export const featuredPrice = (d: CosDef) => Math.round(priceOf(d) * (1 - FEATURED_DISCOUNT) / 10) * 10 - 1;

// ---------------------------------------------------------------- starter pack (once per account, first-purchase offer)
export const STARTER = { id: 'starter_pack', cents: 499, items: ['pm_ronin_initiate', 'emote_wave', 'pet_drone_scout'], lockerTier: true,
  name: 'Runner Starter Pack', desc: 'Ronin Initiate (Epic skin), Shift Change Wave emote, Scout Drone pet and +20 locker slots. Once per account.' };
export const starterValueCents = () => TIER.epic.cents + 299 + 499 + 99;

// ---------------------------------------------------------------- collections
export interface Collection { line: string; name: string; have: number; total: number; reward: string; done: boolean; claimed: boolean; }
export function collections(s: Save): Collection[] {
  return LINES.map(L => { const sk = lineSkins(L.id); const have = sk.filter(d => ownsCos(s, d.id)).length; return { line: L.id, name: L.name, have, total: sk.length, reward: L.reward, done: sk.length > 0 && have === sk.length, claimed: ownsCos(s, L.reward) }; });
}
/** Grant completion rewards (idempotent). Called after every grant. */
export function checkCollections(s: Save): string[] {
  const got: string[] = []; for (const c of collections(s)) if (c.done && !c.claimed && grantCos(s, c.reward)) { got.push(c.reward); track('collection_complete', c.line, { reward: c.reward }); }
  return got;
}
/** Legendary/Ultimate purchases include their recall / pet. */
export const includesOf = (id: string) => INCLUDES[id] || [];

// ---------------------------------------------------------------- season pass
export interface PassState { season: string; xp: number; premium: boolean; claimed: Record<string, number>; }
export function passOf(s: Save): PassState { const a = s as any; if (!a.pass || a.pass.season !== SEASON.id) a.pass = { season: SEASON.id, xp: 0, premium: false, claimed: {} }; return a.pass; }
export const passLevel = (p: PassState) => Math.min(SEASON.levels, Math.floor(p.xp / SEASON.xpPerLevel));
export const passRewards = () => COSMETICS.filter(d => d.src.k === 'pass' && (d.src as any).season === SEASON.id).sort((a, b) => (a.src as any).level - (b.src as any).level);
export const passOpen = (t = now()) => statusOf(passRewards()[0]?.id || '', t).s === 'open';
/** XP from play. Sources: kill 4, elite 20, boss 120, dungeon clear 300, first town visit 150. Capped per call. */
export const PASS_XP: Record<string, number> = { kill: 4, elite: 20, boss: 120, clear: 300, visit: 150 };
export function passXp(s: Save, src: keyof typeof PASS_XP | string, n = 1): number {
  if (!passOpen()) return 0; const p = passOf(s); const before = passLevel(p); const add = Math.min(2000, (PASS_XP[src] || 0) * Math.max(0, n)); p.xp += add;
  const after = passLevel(p); if (after > before) track('pass_level', SEASON.id, { level: after, src });
  return add;
}
export function claimable(s: Save): CosDef[] { const p = passOf(s), L = passLevel(p); return passRewards().filter(d => { const r = d.src as any; return r.level <= L && !p.claimed[d.id] && (r.track === 'free' || p.premium); }); }
export function claimPass(s: Save): string[] {
  const p = passOf(s); const got: string[] = []; for (const d of claimable(s)) { p.claimed[d.id] = now(); if (grantCos(s, d.id)) { got.push(d.id); track('pass_claim', d.id, { track: (d.src as any).track, level: (d.src as any).level }); } }
  return got;
}
export const PASS_SKU = 'pass_' + SEASON.id;

// ---------------------------------------------------------------- exclusives earned in play
/** One-time earn-only exclusives. Granted only while their window is open (grantCos refuses retired ids). */
export function earnExclusive(s: Save, key: string): string | null {
  const d = COSMETICS.find(x => x.src.k === 'exclusive' && (x.src as any).key === key); if (!d || ownsCos(s, d.id)) return null;
  if (statusOf(d.id).s !== 'open') return null; if (!grantCos(s, d.id)) return null; track('exclusive_earned', d.id, { key }); return d.id;
}
/** Hook: a dungeon clear. Launch-week clears and gateway clears inside the founder window earn their exclusives; also pass XP. */
export function onClear(s: Save, dungeon: string, gateway: boolean): string[] {
  passXp(s, 'clear'); const got = [earnExclusive(s, 'launch_week_clear'), gateway ? earnExclusive(s, 'world_first_gateway') : null].filter(Boolean) as string[]; return got;
}
/** Showcase: the one exclusive a player pins to their nameplate and inspect card. */
export function showcaseOf(s: Save): string | null { const c = cosOf(s) as any; const id = c.showcase; return id && ownsCos(s, id) ? id : null; }
export function setShowcase(s: Save, id: string | null) { const c = cosOf(s) as any; if (id === null || ownsCos(s, id)) { c.showcase = id; track('showcase_set', id || ''); return true; } return false; }
