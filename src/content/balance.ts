// Balance tuning table (docs/BALANCE.md). Everything the balance pass changes lives here so before/after is auditable:
// per-boss and per-mob HP/damage multipliers on top of the authored data, plus a few global parameters.
// Measured by tools/balance (headless bot harness); guarded by tests/balance.mjs.
export interface Mul { hp?:number; dmg?:number }
export const BAL:{ boss:Record<string,Mul>; mob:Record<string,Mul>; elite:Record<number,number>; p:{ snipe:number; hexSlow:number; hexSlowMul:number; hexHeat:number; ward:number; shieldMul:number; summonCap:number; summonCd:number; detonate:number; detonateBig:number; mend:number } } = {
  boss:{
    // base dungeons (original bosses; onboarding tier, par kit mid/blue/purple)
    overseer:{ hp:1.35, dmg:1.3 }, teague:{ hp:1.05, dmg:1.05 }, surgeon:{ hp:1.25 }, stockmgr:{ hp:1.1 },
    // tier I (par kit: green/blue 'mid')
    pitboss:{ hp:.85, dmg:.65 }, gantrymother:{ dmg:.85 },
    // tier II (par kit: blue)
    apothecary:{ dmg:.8 }, cryo:{ hp:1.5, dmg:1.3 }, bellfounder:{ hp:1.2 }, auditor:{ hp:1.25, dmg:1.15 }, mirrorpt:{ hp:1.1, dmg:1.05 }, clearance:{ hp:1.25, dmg:1.25 }, tidewarden:{ hp:1.05, dmg:1 },
    // tier III (par kit: purple): boss HP up (longer exposure) rather than only flat damage, since armour subtracts a flat amount per hit
    resonance:{ hp:2.2, dmg:2 }, liquidator:{ hp:1.7, dmg:1.6 }, courier:{ hp:2.2, dmg:2 }, dispatcher:{ hp:2.2, dmg:2.2 }, warrantor:{ hp:1, dmg:1.25 }, rattle:{ hp:2.2, dmg:2 }, breaker:{ hp:2.2, dmg:2 }, widow:{ hp:1.8, dmg:2.2 },
    // tier IV
    recall:{ hp:1.1, dmg:1.1 },
  },
  mob:{
    bulwarktread:{ dmg:.75 }, tagcarrier:{ dmg:.7 }, rebarcrusher:{ dmg:.85 }, shiftstalker:{ dmg:.85 }, sweepertread:{ hp:.8, dmg:.8 }, reclaimwalker:{ hp:.85 },
  },
  elite:{},
  p:{ snipe:22, hexSlow:2.5, hexSlowMul:.8, hexHeat:16, ward:.22, shieldMul:.85, summonCap:3, summonCd:13, detonate:26, detonateBig:34, mend:.22 },
};
export const bossMul=(id:string):Required<Mul>=>({ hp:BAL.boss[id]?.hp??1, dmg:BAL.boss[id]?.dmg??1 });
export const mobMul=(id:string):Required<Mul>=>({ hp:BAL.mob[id]?.hp??1, dmg:BAL.mob[id]?.dmg??1 });
