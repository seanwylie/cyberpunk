// Heat model (docs/BALANCE.md "Heat", docs/ABILITIES.md "Heat and cooldowns"). Pure functions and tunables only: no sim imports.
// Design: HEAT is the primary limiter of sustained ability use, COOLDOWN the secondary one (bursts and ultimates).
// Every reduction source has diminishing returns and a hard cap, so no build can cast continuously.
export const HEAT = {
  max: 100,
  /** baseline dissipation per second (x effective cooling, which is capped) */
  passiveCool: 6,
  /** hard cap on the effective cooling multiplier from the COOL stat (items/chips): dissipation never exceeds passiveCool x coolCap */
  coolCap: 1.4,
  /** hard cap on the share of an ability's heat cost that gear/chips can remove, and the rate (raw sum / reduceK) at which it is approached */
  reduceCap: .3, reduceK: .35,
  /** every authored ability heat cost is multiplied by this (heat is the main limiter); cooldowns by cdMul (more modest); cdr from chips is capped */
  abilityMul: 1.8, powerMul: 1.4, cdMul: .6, cdrCap: .3,
  /** heat-efficiency specs trade damage: ability damage x (1 - throttleReduce*reduction - throttleCool*coolFraction) */
  throttleReduce: .3, throttleCool: .12,
  /** casting soaks heat: dissipation pauses briefly after a cast or an auto swing burst */
  soakT: .6,
  overheat: { lockT: 2.5, recover: 50, coolMul: .8, autoHeatMul: .25, takenMul: 1.25, speedMul: .8, dmgMul: .5, atkRateMul: .5 },
  /** warning bands for the HUD (fractions of max) */
  warnAt: .6, hotAt: .8,
  /** manual vent (V key / tap the heat bar): short channel that locks abilities and autos, big dump; 'hot' vents dump more */
  vent: { amount: 30, hotBonus: 15, hotAt: 75, cd: 12, lockT: 1.0, moveMul: .6 },
  stimVent: 25,
} as const;

/** Effective cooling multiplier: linear up to 1, then saturating toward coolCap. */
export function effCooling(c:number):number{ if(c<=1) return Math.max(.2,c); const room=HEAT.coolCap-1; return 1+room*(1-Math.exp(-(c-1)/room)); }
/** Effective share (0..reduceCap) of ability heat cost removed, from the raw sum of chip heat modifiers. */
export function effReduce(raw:number):number{ if(raw<=0) return 0; return HEAT.reduceCap*(1-Math.exp(-raw/HEAT.reduceK)); }
/** Heat paid for one cast. */
export function heatCost(base:number,rawReduce:number):number{ return base*(1-effReduce(rawReduce)); }
/** Cooldown after chips (cdr capped). */
export function cdAfter(base:number,cdr:number):number{ return base*(1-Math.min(HEAT.cdrCap,Math.max(0,cdr))); }
/** Damage multiplier for heat-efficiency builds (the cost of cheap heat). 1 = no penalty. */
export function throttle(rawReduce:number,cooling:number):number{ const coolFrac=Math.min(1,(effCooling(cooling)-1)/(HEAT.coolCap-1)); return 1-HEAT.throttleReduce*effReduce(rawReduce)-HEAT.throttleCool*Math.max(0,coolFrac); }
/** Dissipation per second at this moment. */
export function dissipation(cooling:number,overheated:boolean,soak:number):number{ if(soak>0) return 0; return HEAT.passiveCool*effCooling(cooling)*(overheated?HEAT.overheat.coolMul:1); }
/** HUD band: 'ok' | 'warm' | 'hot' | 'over'. */
export function heatBand(heat:number,overheated:boolean):'ok'|'warm'|'hot'|'over'{ if(overheated) return 'over'; const f=heat/HEAT.max; return f>=HEAT.hotAt?'hot':f>=HEAT.warnAt?'warm':'ok'; }
/** Steady-state ceiling on ability heat per minute for a spec (what dissipation alone can absorb), before autos. Used by tests and docs. */
export function sustainHeatPerMin(cooling:number):number{ return dissipation(cooling,false,0)*60; }
