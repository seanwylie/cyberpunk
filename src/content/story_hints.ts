// Useful story lines: every Fixer line carries ONE actionable hint grounded in real game data (docs/BOSSES.md kits):
// the recommended next job's boss, one of its signature mechanics + the counter, the player's gear gap against it, and a reward lead.
// The client computes the hint from the save (ids/enums only) and sends it; the story proxy resolves names/counters from server/story_catalog.json
// (generated from THIS file by tools/gen_story_ids.mjs), so the model can only talk about real mechanics. Canned lines use the same facts.
import { ENEMIES, ITEM_BY_ID, type Stats } from '../config';
import { KITS, MECH_INFO, type MechId } from './boss_kits';
import { DUNGEONS, DUNGEON_LIST, inBand, unlockReason } from './dungeons';
import type { Save } from '../state';

export type Need = 'move' | 'hp' | 'dmg';
export type Gap = Need | 'none';
export type Fail = 'cleared' | 'left' | 'none';
/** keyword: the word the line must contain (highlighted + tooltip in the story panel). counter: what to do. need: the stat that helps. */
export const MECH_HINT: Record<MechId, { keyword: string; counter: string; need: Need }> = {
  beam: { keyword: 'beam', counter: 'circle with the beam and stay ahead of its turn', need: 'move' },
  grid: { keyword: 'laser grid', counter: 'step into a dark cell before the lines flash', need: 'move' },
  scythe: { keyword: 'scythe', counter: 'get behind the sweep, not away from it', need: 'move' },
  vortex: { keyword: 'vortex', counter: 'walk against the pull and keep off the core', need: 'move' },
  conveyor: { keyword: 'conveyor', counter: 'walk against the belt and never stand at the shredder end', need: 'move' },
  ricochet: { keyword: 'roller', counter: 'read the dotted bounce path and step off it', need: 'move' },
  pylons: { keyword: 'pylons', counter: 'kill the pylons first, the snipes stop with them', need: 'dmg' },
  safe: { keyword: 'safe zones', counter: 'run to a green beacon before the countdown ends', need: 'move' },
  gaze: { keyword: 'gaze', counter: 'break line of sight behind a pillar', need: 'hp' },
  tiles: { keyword: 'tiles', counter: 'stand on the tiles that already went off', need: 'move' },
  bombs: { keyword: 'bombs', counter: 'spread the fuses out so the chain breaks', need: 'hp' },
  strike: { keyword: 'afterimage', counter: 'side-step the lunge lane, then hit it while it recovers', need: 'move' },
  overload: { keyword: 'heat', counter: 'stand in the cyan coolant rings', need: 'hp' },
  buffers: { keyword: 'nodes', counter: 'cut the violet nodes before you hit the boss', need: 'dmg' },
  shockring: { keyword: 'shockwave', counter: 'run for the green gap in the ring', need: 'move' },
  shield: { keyword: 'shield', counter: 'break the hex shield to open a stagger window', need: 'dmg' },
};
export const GAP_TEXT: Record<Need, { stat: keyof Stats; parts: string; text: string }> = {
  move: { stat: 'move', parts: 'legs and feet', text: 'your legs are too slow for it' },
  hp: { stat: 'maxHp', parts: 'torso', text: 'your torso will not soak many hits' },
  dmg: { stat: 'dmg', parts: 'arms and hands', text: 'your arms hit too soft to break it fast' },
};
export const bossName = (id: string) => ENEMIES[id]?.name || id;
export const bossOf = (dungeon: string) => { const d = DUNGEONS[dungeon]; return d ? (d.boss || d.defaultBoss) : ''; };

/** The job the player should do next: first unlocked, uncleared dungeon in their level band (falls back to any unlocked one in band, then the last one played). */
export function nextJob(s: Save, last?: string): string {
  const ok = (d: any) => !unlockReason(s as any, d.id) && KITS[bossOf(d.id)];
  const band = DUNGEON_LIST.filter(d => ok(d) && inBand(d, s.level));
  const fresh = band.find(d => !(s as any).cleared?.[d.id]);
  return (fresh || band[0] || (last && DUNGEONS[last] && KITS[bossOf(last)] ? DUNGEONS[last] : null) || DUNGEON_LIST.find(ok) || DUNGEONS.annex).id;
}
/** Best reward lead: the heaviest-weighted item in the job's boss loot pool (prefers one the player does not own). */
export function rewardOf(dungeon: string, s?: Save): string | undefined {
  const pool = (DUNGEONS[dungeon]?.loot?.boss || []).filter(e => e.item && ITEM_BY_ID[e.item]).sort((a, b) => b.w - a.w);
  const own = new Set((s?.items || []).map(i => i.def)); return (pool.find(e => !own.has(e.item!)) || pool[0])?.item;
}
export interface Hint { dungeon: string; boss: string; mech: MechId; gap: Gap; fail: Fail; reward?: string }
/** stats: current build stats; base: stock build stats at the same level (a stat no better than ~stock counts as a gap). */
export function buildHint(s: Save, stats: Stats | null, base: Stats | null, o: { last?: string; result?: string; variant?: number } = {}): Hint {
  const dungeon = nextJob(s, o.last), boss = bossOf(dungeon), kit = KITS[boss]; const mechs = kit.mechs.map(m => m.m);
  const mech = mechs[((o.variant || 0) + (s as any).beatMeta?.count | 0) % mechs.length];
  const need = MECH_HINT[mech].need; let gap: Gap = 'none';
  if (stats && base) { const k = GAP_TEXT[need].stat; if ((stats[k] as number) < (base[k] as number) * 1.1) gap = need; }
  const fail: Fail = !o.result ? 'none' : /defeat/i.test(o.result) ? 'cleared' : 'left';
  return { dungeon, boss, mech, gap, fail, reward: rewardOf(dungeon, s) };
}
const plain = (n: string) => n.replace(/^[A-Z]{2,3}(?:-\d+)?\s+/, '').replace(/\s*\((?:L|R)\)$/, '').trim();
/** Canned (no-AI) line from the same facts: still in the Fixer's voice, still one actionable hint. Always contains MECH_HINT[mech].keyword. */
export function cannedHint(h: Hint, idx = 0): string {
  const M = MECH_HINT[h.mech], d = DUNGEONS[h.dungeon], who = bossName(h.boss).split(' ').slice(-1)[0];
  const rw = h.reward && ITEM_BY_ID[h.reward] ? plain(ITEM_BY_ID[h.reward].name) : '';
  const gap = h.gap !== 'none' ? ` Upgrade your ${GAP_TEXT[h.gap].parts} first.` : rw ? ` ${who} guards a ${rw}.` : '';
  const T = [
    `${d?.name || 'Next job'}: when ${who} brings out the ${M.keyword}, ${M.counter}.${gap}`,
    `Heard ${who} uses a ${M.keyword} now. ${M.counter[0].toUpperCase() + M.counter.slice(1)}.${gap}`,
    `${h.fail === 'left' ? 'Walking out is fine. ' : ''}For ${who}, watch the ${M.keyword}: ${M.counter}.${gap}`,
  ];
  let t = T[idx % T.length]; if (t.length > 220) t = t.replace(gap, ''); return t;
}
export const mechTip = (m: MechId) => `<b>${MECH_INFO[m].name}</b><br>${MECH_INFO[m].tell}.<br><i>Counter:</i> ${MECH_HINT[m].counter}.`;
