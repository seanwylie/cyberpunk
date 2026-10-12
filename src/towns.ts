// Town registry: which towns exist, how they unlock, and which content each hosts. Pure logic (no DOM).
import { DUNGEONS } from './content/dungeons';
import type { Save } from './state';
import { WORLD, WORLD_BY_ID, UNLOCKS, unlockText, type UnlockPath } from './world';
/** any WORLD district id (src/world.ts) */
export type TownId = string;
export const TOWN_IDS: TownId[] = WORLD.map(t => t.id);
export const HARROW_UNLOCK_LEVEL = 20;
/** dungeons of this tier or higher can only be entered from Harrow Reach */
export const GATED_TIER = 3;
export const TOWN_INFO: Record<TownId, { name: string; blurb: string; unlock: string; color: string }> = {
  ...Object.fromEntries(WORLD.map(t => [t.id, { name: t.name, blurb: t.blurb, unlock: 'Always open.', color: t.color }])),
  rustline: { name: 'Rustline Market', blurb: 'Tarp stalls and a cramped plaza. Neutral ground where all three manufacturers sell through independents. Tier I and II dungeons.', unlock: 'Always open.', color: '#ffb02e' },
  harrow: { name: 'Harrow Reach', blurb: 'The Cinderworks: a terraced foundry town built into cooled slag banks under a dead stack. Heavy Works hardware, the Line 7 Retirees\' Guild and the gates to Tier III and IV.', unlock: `Clear any Tier II dungeon or reach level ${HARROW_UNLOCK_LEVEL}.`, color: '#ff6a3a' },
};
export type Res = { ok: true } | { ok: false; why: string };
export const townsOf = (s: Save) => (s.towns = s.towns || {});
/** every town is a safe hub: any level can ride there (aspirational, see docs/WORLD.md). Harrow's old unlock flag is still tracked for story/toasts. */
export function pathMet(s: Save, p: UnlockPath): boolean { if (p.kind === 'level') return s.level >= p.n; if (p.kind === 'contract') return (s.contracts?.done?.length || 0) >= p.n; if (p.kind === 'rep') return (s.rep?.[p.mfr] || 0) >= p.n;
  return Object.keys(s.cleared || {}).filter(id => { const d = (DUNGEONS as any)[id]; return d && (d.tier || 1) >= (p.tier || 0) && (!p.mfr || d.mfr === p.mfr); }).length >= p.n; }
/** per-character transit unlocks: once met they stay unlocked (stored on the save's world state) */
export const isUnlocked = (s: Save, id: TownId) => { const u = UNLOCKS[id]; if (!WORLD_BY_ID[id]) return false; if (!u || u === 'open') return true; const w: any = ((s as any).world ??= { visited: {}, landmarks: {} }); if (w.unlocked?.[id] || w.visited?.[id]) return true; if (id === 'harrow' && townsOf(s).harrow?.unlocked) return true; if (u.some(p => pathMet(s, p))) { (w.unlocked ??= {})[id] = Date.now(); return true; } return false; };
export const unlockHint = (id: TownId) => { const u = UNLOCKS[id]; return !u || u === 'open' ? 'Open' : 'Unlock: ' + u.map(unlockText).join(' or '); };
export const currentTown = (s: Save): TownId => (s.town && WORLD_BY_ID[s.town] ? s.town : 'rustline');
export const clearedTier2 = (s: Save) => Object.keys(s.cleared || {}).some(id => ((DUNGEONS as any)[id]?.tier || 0) >= 2);
export const harrowConditionMet = (s: Save) => s.level >= HARROW_UNLOCK_LEVEL || clearedTier2(s);
/** Unlock any town whose condition is now met. Returns the towns unlocked by this call. Idempotent; also backfills old saves. */
export function refreshUnlocks(s: Save): TownId[] { const n: TownId[] = []; if (!townsOf(s).harrow?.unlocked && harrowConditionMet(s)) { townsOf(s).harrow = { unlocked: true }; } const w: any = ((s as any).world ??= { visited: {}, landmarks: {} }); for (const t of WORLD) { const had = !!w.unlocked?.[t.id] || UNLOCKS[t.id] === 'open' || !!w.visited?.[t.id]; if (!had && isUnlocked(s, t.id)) { n.push(t.id); (w.unlocked ??= {})[t.id] = Date.now(); } } return n; }
export function unlockProgress(s: Save, id: TownId): { met: boolean; lines: string[] } {
  if (id !== 'harrow') { const u = UNLOCKS[id]; if (!u || u === 'open') return { met: true, lines: [] }; return { met: isUnlocked(s, id), lines: u.map(p => `${pathMet(s, p) ? '✓' : '○'} ${unlockText(p)}`) }; }
  const lv = s.level >= HARROW_UNLOCK_LEVEL, t2 = clearedTier2(s);
  return { met: lv || t2, lines: [`${t2 ? '✓' : '○'} Clear any Tier II dungeon`, `${lv ? '✓' : '○'} or reach level ${HARROW_UNLOCK_LEVEL} (you are level ${s.level})`] };
}
export function travelCheck(s: Save, id: TownId): Res { if (!TOWN_IDS.includes(id)) return { ok: false, why: 'Unknown destination.' }; if (!isUnlocked(s, id)) return { ok: false, why: 'Locked. ' + unlockHint(id) + '.' }; if (currentTown(s) === id) return { ok: false, why: 'You are already here.' }; return { ok: true }; }
/** Tier III and IV dungeons are only reachable from Harrow Reach's gate. */
export function dungeonAccess(dungeonId: string, town: TownId): Res { const wt = WORLD_BY_ID[town]; if (wt?.gen) { if (wt.dungeons.includes(dungeonId)) return { ok: true }; const at = hostsOf(dungeonId).map(h => WORLD_BY_ID[h].name); return { ok: false, why: `That gate is not in ${wt.name}. Try ${at.join(' or ') || 'Harrow Reach'}.` }; } const t = (DUNGEONS as any)[dungeonId]?.tier || 0; if (t >= GATED_TIER && town !== 'harrow') return { ok: false, why: 'Tier III and IV gates open only at Harrow Reach. Take the Reach Line from the Rustline plaza.' }; return { ok: true }; }
/** towns whose gate hosts a dungeon (Rustline: tier I-II, Harrow: all, generated districts: their list) */
export function hostsOf(dungeonId: string): TownId[] { const t = (DUNGEONS as any)[dungeonId]?.tier || 0; return WORLD.filter(w => w.gen ? w.dungeons.includes(dungeonId) : w.id === 'harrow' || t < GATED_TIER).map(w => w.id); }
