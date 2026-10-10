// Mob EnemyDefs generated from batch-2 data (src/content/batch2_mobs.ts). Toolkit moves are "<mob>.<n>"; mob-only attacks (snipe, mend, ward, hex, detonate, summonlite) are in mobs.ts.
import type { EnemyDef } from '../config';
import { MOBS, MOB_META } from './batch2_mobs';
import { moveIdsOf } from './boss_moves';
export const BATCH2_ENEMIES:Record<string,EnemyDef>=Object.fromEntries(MOBS.map(m=>[m.id,{ id:m.id, name:m.name, hp:m.hp, speed:m.speed, radius:m.radius, mfr:m.mfr, ranged:m.ranged||undefined, aggro:m.aggro, xp:m.xp, rep:1+m.tier,
  attacks:[...m.melee,...moveIdsOf(m.id),...(m.custom||[])], summon:m.summon, dmgMul:m.dmg, keep:m.keep, mob:MOB_META(m) } as EnemyDef]));
