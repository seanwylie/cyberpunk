// Epic gateway dungeons (docs/WORLD.md "Town graph"). Each town link's gateway is a longer variant of an existing batch-1 dungeon:
//  - bigger rooms (+35% each side) and +50% packs (+25% in tier III-IV): the extra area / longer run
//  - a set-piece ambush: a second elite pair waits with the junction controller (group 77)
//  - the boss gains an extra final phase (enrage + adds + its arena gimmick doubled) and +30% HP, via the dungeon's `gateway` flag (mechanics.ts)
//  - level band re-anchored on the destination town's entry level; clear XP and credits scaled up; one-shot unlock (no unlock chain)
// Variants register as their own dungeon ids (gw_<base>), so daily locks, instances, catalog and sweeps treat them like any other dungeon.
import type { LevelSpec } from './batch1_levels';
import type { Phase } from './batch1_bosses';
import { WORLD_BY_ID, GATEWAYS } from '../world';
export const GW_PREFIX = 'gw_';
export const gwBase = (id: string) => id.startsWith(GW_PREFIX) ? id.slice(GW_PREFIX.length) : id;
export const GW_BOSS_HP = 1.3;
/** the extra phase every gateway boss gets below 22% HP */
export const gwPhase = (summon: string | undefined, gim: any): Phase => ({ at: .22, say: 'You will not pass this gate.', acts: [{ k: 'enrage', spd: 1.18, cd: .8 }, { k: 'adds', type: summon || 'shooter', n: 3 }, ...(gim ? [{ k: 'gimmick', g: { ...gim, every: Math.max(3, gim.every * .6), n: Math.ceil((gim.n || 3) * 1.4) } } as any] : [])] });
export function gatewaySpec(base: LevelSpec, to: string, title: string): LevelSpec {
  const t = WORLD_BY_ID[to]; const floor = t.band[0]; const grow = ([w, h]: [number, number]) => [Math.round(w * 1.35), Math.round(h * 1.35)] as [number, number];
  /* pack growth eases off in tier III-IV, where packs already hit hard: +50% / +25% */ const extra = base.tier >= 3 ? .25 : .5;
  const sq: any = {}; if (base.squads) for (const z of Object.keys(base.squads)) { const a = (base.squads as any)[z]; sq[z] = [...a, ...a.slice(0, Math.max(1, Math.round(a.length * extra)))]; }
  const ro: any = {}; for (const z of Object.keys(base.roster)) ro[z] = (base.roster as any)[z].map(([k, n]: [string, number]) => [k, Math.ceil(n * (1 + extra))]);
  return { ...base, id: GW_PREFIX + base.id, name: title, short: title.replace(/^(Through|Down|Climb) (the )?/, '').slice(0, 18), minLevel: floor, maxLevel: floor + 12,
    est: [Math.round(base.est[0] * 1.6), Math.round(base.est[1] * 1.6)], dims: base.dims.map(grow) as any, squads: base.squads ? sq : undefined, roster: ro,
    blurb: `Epic gateway to ${t.name}. ${base.blurb}`, intro: `${title}: the long way through to ${t.name}. ${base.intro}`, unlock: { after: [] }, xp: Math.round(base.xp * 2.2), creditMul: base.creditMul * 1.6,
    district: t.name, theme: base.theme };
}
export const GATEWAY_BASES = GATEWAYS.map(g => ({ ...g, base: gwBase(g.dungeon) }));
