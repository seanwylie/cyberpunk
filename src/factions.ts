// Manufacturer factions (docs/FACTIONS.md). Standing with Heavy Industrial / Precision Surgical / Mass Market comes from
// two things the player already controls: earned reputation rank and the hardware currently installed in their body.
// Each house resents its rival's hardware (HI resents PS, PS resents MM, MM resents HI). Pure functions, no allocation per frame.
// Effects: vendor price + top-shelf access, contract weighting + a Patron tag, and hunter squads in runs.
// Never blocks the main path: stock and green/blue stock stay purchasable, story contracts are untouched, hunters are optional fights.
import { ENEMIES, ITEM_BY_ID, MFR, SLOTS, type Mfr, type Rarity } from './config';
import { repRank } from './build';

export const MFRS: Mfr[] = ['HI', 'PS', 'MM'];
/** whose hardware each house resents */
export const RIVAL: Record<Mfr, Mfr> = { HI: 'PS', PS: 'MM', MM: 'HI' };
export type Tier = 'hostile' | 'wary' | 'neutral' | 'trusted' | 'loyal';
export const TIERS: Tier[] = ['hostile', 'wary', 'neutral', 'trusted', 'loyal'];
export const FAC_CFG = {
  perPart: .5, partCap: 3,
  price: { hostile: 1.2, wary: 1.1, neutral: 1, trusted: .93, loyal: .87 } as Record<Tier, number>,
  /** rarities a house refuses to sell you when hostile (grey/green always remain; purple/orange are loot-only anyway) */
  shutRarity: ['blue'] as Rarity[],
  hunterChance: { hostile: .45, wary: .15 } as Partial<Record<Tier, number>>,
  minHunterLevel: 6,
};
export const TIER_LABEL: Record<Tier, string> = { hostile: 'Hostile', wary: 'Wary', neutral: 'Neutral', trusted: 'Trusted', loyal: 'Loyal' };
export const TIER_ICON: Record<Tier, string> = { hostile: '✕', wary: '!', neutral: '·', trusted: '+', loyal: '★' };
const SHORT: Record<Mfr, string> = { HI: 'Heavy', PS: 'Surgical', MM: 'Mass' };

/** non-stock installed parts per manufacturer */
export function installedBy(s: any): Record<Mfr, number> { const o: Record<Mfr, number> = { HI: 0, PS: 0, MM: 0 };
  for (const sl of SLOTS) { const u = s?.installed?.[sl]; if (!u) continue; const it = s.items?.find((i: any) => i.uid === u); const d = it ? ITEM_BY_ID[it.def as string] : undefined;
    if (d && !d.id.startsWith('stock_') && o[d.mfr as Mfr] !== undefined) o[d.mfr as Mfr]++; } return o; }
const part = (n: number) => Math.min(FAC_CFG.partCap, n * FAC_CFG.perPart);
export function standingScore(s: any, m: Mfr, inst = installedBy(s)): number { return repRank(Math.max(0, +s?.rep?.[m] || 0)) + part(inst[m]) - part(inst[RIVAL[m]]); }
export function tierOf(score: number): Tier { return score <= -2 ? 'hostile' : score < 0 ? 'wary' : score < 1.5 ? 'neutral' : score < 3 ? 'trusted' : 'loyal'; }
export interface Standing { m: Mfr; score: number; tier: Tier; parts: number; rivalParts: number; rank: number }
export function standings(s: any): Record<Mfr, Standing> { const inst = installedBy(s); const o = {} as Record<Mfr, Standing>;
  for (const m of MFRS) { const score = standingScore(s, m, inst); o[m] = { m, score, tier: tierOf(score), parts: inst[m], rivalParts: inst[RIVAL[m]], rank: repRank(Math.max(0, +s?.rep?.[m] || 0)) }; } return o; }
export const tier = (s: any, m: Mfr) => tierOf(standingScore(s, m));
export const priceMulFor = (s: any, m: Mfr) => FAC_CFG.price[tier(s, m)];
/** null = for sale; otherwise the short reason shown on the disabled row */
export function shelfClosed(s: any, d: { mfr: Mfr; rarity: Rarity; id: string }): string | null {
  if (d.id.startsWith('stock_') || !FAC_CFG.shutRarity.includes(d.rarity)) return null; return tier(s, d.mfr) === 'hostile' ? SHORT[d.mfr] + ' won\u2019t sell to you' : null; }
export function tipFor(st: Standing): string { const M = MFR[st.m]; const p = Math.round((FAC_CFG.price[st.tier] - 1) * 100);
  return `<b>${M.short}</b> · ${TIER_LABEL[st.tier]}<br>Rep rank ${st.rank} · ${st.parts} of their parts installed${st.rivalParts ? ` · ${st.rivalParts} ${MFR[RIVAL[st.m]].short} part${st.rivalParts > 1 ? 's' : ''} they resent` : ''}`
    + `<br>Prices ${p > 0 ? '+' : ''}${p}%${st.tier === 'hostile' ? ' · top shelf closed · hunters likely' : st.tier === 'wary' ? ' · hunters possible' : st.tier === 'trusted' || st.tier === 'loyal' ? ' · Patron jobs (+15%)' : ''}`; }
/** compact strip: three chips with icon + short label + tooltip */
export function standingStrip(s: any, esc: (x: string) => string): string { const S = standings(s);
  return `<div class="facbar">${MFRS.map(m => { const st = S[m]; return `<span class="repb facb fac-${st.tier}" data-tip="${esc(tipFor(st))}" style="--ac:${MFR[m].accent}"><i>${TIER_ICON[st.tier]}</i>${SHORT[m]} <b>${TIER_LABEL[st.tier]}</b></span>`; }).join('')}</div>`; }

/** Hunter squad for a run: the most hostile house sends one elite and two crew. Deterministic per seed. */
const rnd = (seed: number) => { let a = (seed * 2654435761 + 0x6d2b79f5) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export function hunterPlan(s: any, seed: number, avoid: string[] = []): { mfr: Mfr; elite: string; crew: string[] } | null {
  if ((s?.level || 1) < FAC_CFG.minHunterLevel) return null; const S = standings(s); const worst = MFRS.map(m => S[m]).sort((a, b) => a.score - b.score)[0];
  const ch = FAC_CFG.hunterChance[worst.tier]; if (!ch) return null; const r = rnd(seed); if (r() >= ch) return null;
  const pool = Object.values(ENEMIES).filter(e => e.mfr === worst.m && !e.boss && !e.static && !avoid.includes(e.id));
  const elites = pool.filter(e => e.elite).sort((a, b) => a.hp - b.hp), crew = pool.filter(e => !e.elite && !e.summon).sort((a, b) => a.hp - b.hp);
  if (!elites.length || !crew.length) return null; const lvF = Math.min(.99, (s.level || 1) / 50);
  const elite = elites[Math.floor(lvF * elites.length)].id, c = crew[Math.floor(r() * Math.min(crew.length, 6))].id; return { mfr: worst.m, elite, crew: [c, c] }; }
