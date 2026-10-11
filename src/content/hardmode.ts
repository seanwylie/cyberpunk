// Hard-mode tuning (docs/BALANCE.md "Hard mode"). Data-only: everything the difficulty/drop/sustain pass tunes lives here.
// Bosses punish melee camping and passive play (pressureTick in mechanics.ts reads HARD.press), damage/HP scale by class and dungeon tier,
// sustain is rationed, deaths cost credits, packs aggro together. applyHard() multiplies the enemy defs once at load.
export const HARD = {
  /** class multipliers on top of the authored + BAL values */
  boss:{ hp:1.05, dmg:1.05 }, elite:{ hp:1.25, dmg:1.3 }, mob:{ hp:1.05, dmg:1.15 },
  /** dungeon tier (0 = base dungeons, 1-4 = batch-1 tiers) multipliers, applied to bosses, elites and mobs native to that tier */
  tierDmg:[1.12,1.15,.92,.97,.8], tierHp:[1.12,1.15,.95,.97,.8],
  press:{
    campR:3.2,      // player within boss radius + campR counts as camping
    campT:2.0,      // seconds of camping before the boss answers with a quake
    quakeCd:3.6,    // minimum seconds between quakes
    quakeR:3.9,     // quake ring radius beyond the boss body
    quakeWind:1.1, quakeDmg:.18, quakePush:3.4 /* quakeDmg/underDmg are fractions of the player's max HP per hit, so pressure scales with the kit, not with boss dmgMul */,
    underEvery:6.5, // a ground hazard is placed under the player (stationary or not) this often; faster below half HP
    underWind:1.25, underR:2.1, underDmg:.09,
    addsEvery:26, addsN:2, addsCap:6, addsType:'shooter',
    enrageAt:140,   // seconds in the fight before it enrages (damage and tempo ramp)
    enrageRamp:.012, enrageMax:2.0,
  },
  stimHeal:32, stimCd:9, runRegen:.5,
  packAggroR:10,
  /** pack flanking: melee pack members arc in by up to maxAng radians (gain per tile beyond closeIn), only in packs of minPack+ */
  flank:{ minPack:3, maxAng:.95, gain:.13, closeIn:2.6, maxD:13 },
  death:{ creditLoss:.35, repairMul:1.5 },
  /** ground-drop volume (tools/balance/drops.mjs) */
  autoSellGrey:true,
  /** keep-probability per rarity when a loot roll picks it (re-rolled otherwise); orange never rolls from pools (signature drops only) */
  rarityKeep:{ grey:1, green:1, blue:.35, purple:.06, orange:0 } as Record<string,number>,
  /** per dungeon tier multiplier on DROP.scale (tier IV drops more, but slowly) */
  dropTier:[1,1,1.1,1.3,1.8],
  /** chance that an affixed (non-boss, non-true-elite) pack leader drops its first roll; true elites and bosses keep their guaranteed rolls */
  affixChance:.25,
  bossSecondNonItem:.75,
};
/** once: scale defs. tierOf maps enemy id -> dungeon tier (bosses via dungeon default boss, mobs via their own tier). */
let applied=false;
export function applyHard(ENEMIES:Record<string,any>, DUNGEONS:Record<string,any>){
  if(applied) return; applied=true;
  const tier:Record<string,number>={};
  for(const d of Object.values(DUNGEONS)){ const t=d.tier||0; for(const k of [d.defaultBoss,d.lockElite,d.gateGuard,d.alarmType]) if(k&&tier[k]===undefined) tier[k]=t; }
  for(const [id,def] of Object.entries(ENEMIES)){
    const cls=def.boss?HARD.boss:def.elite?HARD.elite:HARD.mob; const t=Math.max(0,Math.min(4,def.mob?.tier??tier[id]??0));
    def.hp=Math.round(def.hp*cls.hp*HARD.tierHp[t]); def.dmgMul=(def.dmgMul??1)*cls.dmg*HARD.tierDmg[t]; }
}
