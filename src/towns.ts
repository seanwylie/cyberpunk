// Town registry: which towns exist, how they unlock, and which content each hosts. Pure logic (no DOM).
import { DUNGEONS } from './content/dungeons';
import type { Save } from './state';
export type TownId = 'rustline' | 'harrow';
export const TOWN_IDS: TownId[] = ['rustline', 'harrow'];
export const HARROW_UNLOCK_LEVEL = 20;
/** dungeons of this tier or higher can only be entered from Harrow Reach */
export const GATED_TIER = 3;
export const TOWN_INFO: Record<TownId, { name: string; blurb: string; unlock: string; color: string }> = {
  rustline: { name: 'Rustline Market', blurb: 'Tarp stalls and a cramped plaza. Neutral ground where all three manufacturers sell through independents. Tier I and II dungeons.', unlock: 'Always open.', color: '#ffb02e' },
  harrow: { name: 'Harrow Reach', blurb: 'The Cinderworks: a terraced foundry town built into cooled slag banks under a dead stack. Heavy Works hardware, the Line 7 Retirees\' Guild and the gates to Tier III and IV.', unlock: `Clear any Tier II dungeon or reach level ${HARROW_UNLOCK_LEVEL}.`, color: '#ff6a3a' },
};
export type Res = { ok: true } | { ok: false; why: string };
export const townsOf = (s: Save) => (s.towns = s.towns || {});
export const isUnlocked = (s: Save, id: TownId) => id === 'rustline' || !!townsOf(s).harrow?.unlocked;
export const currentTown = (s: Save): TownId => (s.town === 'harrow' && isUnlocked(s, 'harrow') ? 'harrow' : 'rustline');
export const clearedTier2 = (s: Save) => Object.keys(s.cleared || {}).some(id => ((DUNGEONS as any)[id]?.tier || 0) >= 2);
export const harrowConditionMet = (s: Save) => s.level >= HARROW_UNLOCK_LEVEL || clearedTier2(s);
/** Unlock any town whose condition is now met. Returns the towns unlocked by this call. Idempotent; also backfills old saves. */
export function refreshUnlocks(s: Save): TownId[] { const n: TownId[] = []; if (!isUnlocked(s, 'harrow') && harrowConditionMet(s)) { townsOf(s).harrow = { unlocked: true }; n.push('harrow'); } return n; }
export function unlockProgress(s: Save, id: TownId): { met: boolean; lines: string[] } {
  if (id === 'rustline') return { met: true, lines: [] };
  const lv = s.level >= HARROW_UNLOCK_LEVEL, t2 = clearedTier2(s);
  return { met: lv || t2, lines: [`${t2 ? '✓' : '○'} Clear any Tier II dungeon`, `${lv ? '✓' : '○'} or reach level ${HARROW_UNLOCK_LEVEL} (you are level ${s.level})`] };
}
export function travelCheck(s: Save, id: TownId): Res { if (!TOWN_IDS.includes(id)) return { ok: false, why: 'Unknown destination.' }; if (!isUnlocked(s, id)) return { ok: false, why: 'Locked: ' + TOWN_INFO[id].unlock }; if (currentTown(s) === id) return { ok: false, why: 'You are already here.' }; return { ok: true }; }
/** Tier III and IV dungeons are only reachable from Harrow Reach's gate. */
export function dungeonAccess(dungeonId: string, town: TownId): Res { const t = (DUNGEONS as any)[dungeonId]?.tier || 0; if (t >= GATED_TIER && town !== 'harrow') return { ok: false, why: 'Tier III and IV gates open only at Harrow Reach. Take the Reach Line from the Rustline plaza.' }; return { ok: true }; }
