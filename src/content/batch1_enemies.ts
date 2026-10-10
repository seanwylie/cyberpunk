// Boss EnemyDefs generated from the batch-1 boss data (src/content/batch1_bosses.ts). Melee attacks are the existing ones; toolkit moves are "<boss>.<n>".
import type { EnemyDef } from '../config';
import { BOSSES } from './batch1_bosses';
import { moveIdsOf } from './boss_moves';
export const TIER_DMG:Record<number,number>={1:1.4,2:1.55,3:1.7,4:1.9};
export const BATCH1_ENEMIES:Record<string,EnemyDef>=Object.fromEntries(BOSSES.map(b=>[b.id,{ id:b.id, name:b.name, hp:b.hp, speed:b.speed, radius:b.radius, mfr:b.mfr, boss:true, elite:true, ranged:b.melee.length===0, aggro:30, xp:b.xp, rep:30+b.tier*2,
  attacks:[...b.melee,...moveIdsOf(b.id)], summon:b.summon, dmgMul:TIER_DMG[b.tier] } as EnemyDef]));
