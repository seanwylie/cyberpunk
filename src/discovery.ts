// World discovery (docs/WORLD.md): first-visit bonus XP, landmark log, faction standing hooks. State lives on the save (per character,
// so it follows whatever character the multi-character save API has loaded). Pure logic; Sim calls visitTown()/landmarkNear().
import type { Save } from './state';
import { WORLD, WORLD_BY_ID, FIRST_VISIT_XP, LANDMARK_XP } from './world';
import { DUNGEON_LIST } from './content/dungeons';
import { dungeonAccess } from './towns';
export interface WorldState { visited: Record<string, number>; landmarks: Record<string, number>; }
export const worldOf = (s: Save): WorldState => { const w = ((s as any).world ??= { visited: {}, landmarks: {} }); w.visited ??= {}; w.landmarks ??= {}; return w; };
export const dungeonsAt = (id: string) => DUNGEON_LIST.filter(d => dungeonAccess(d.id, id).ok);
/** marks the town visited; returns bonus XP for a first visit (0 otherwise). Rustline (start town) and towns visited before this feature are free. */
export function visitTown(s: Save, id: string, now = Date.now()): number { const w = worldOf(s); if (w.visited[id] || !WORLD_BY_ID[id]) return 0; w.visited[id] = now; return id === 'rustline' ? 0 : FIRST_VISIT_XP(WORLD_BY_ID[id]); }
/** landmark discovery: returns bonus XP the first time the player stands within `r` tiles of the town landmark */
export function landmarkNear(s: Save, id: string, px: number, py: number, lm: { x: number; y: number } | undefined, r = 5): number { if (!lm) return 0; const w = worldOf(s); if (w.landmarks[id] || Math.hypot(px - lm.x, py - lm.y) > r) return 0; w.landmarks[id] = Date.now(); return LANDMARK_XP(WORLD_BY_ID[id]); }
export const discoveredCount = (s: Save) => { const w = worldOf(s); return { towns: WORLD.filter(t => w.visited[t.id]).length, landmarks: Object.keys(w.landmarks).length, total: WORLD.length, totalLm: WORLD.filter(t => t.gen).length }; };
