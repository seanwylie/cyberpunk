// Prestige-drop economy (docs/LOOT_ECONOMY.md). Oranges and season exclusives come ONLY from this roll, never from the regular loot tables:
// one hidden roll per boss (elites at a small fraction) on top of the normal drops. Pure: no DOM, injected rng/time, so tests and the
// balance sim drive exactly the code the game runs.
import { ITEMS, ITEM_BY_ID } from './config';
import { SEASONS, SEASON_OF, activeSeason, canGrant } from './seasons';
import { COS_BY_ID } from './content/appearance';

/** Every tunable lives here (see docs/LOOT_ECONOMY.md for the targets these produce). */
export const LOOT_ECO={
  /** base chance per eligible kill */
  orange:{ boss:.0042, elite:.0002 },
  seasonal:{ boss:.005, elite:.00022 },
  /** while a season is live its exclusives compete for the same kills; this keeps first-orange time at or under 25 h in season */
  seasonOrangeMul:1.25,
  /** low band: at or under maxLevel only a few bosses can roll an orange at all (most oranges are higher level), so the orange chance is x3.5 there (replacing the in-season x1.25) */
  lowBand:{ maxLevel:22, mul:3.5, pityMul:.3, pityOrange:.62 }, // short hard pity only on kills where an orange can land; forced pity picks orange 62% (55% otherwise),
  /** dungeon tier 0..4 (base dungeons are tier 0), epic gateway and hard mode multipliers: harder content is the better farm */
  tierMul:[.85,.95,1,1.2,1.5], gatewayMul:1.5, hardMul:1.35,
  /** hidden soft pity, counted in boss-kill equivalents (an elite counts eliteWeight): after softStart dry kills each further kill adds softStep; at hard the next eligible kill is guaranteed */
  eliteWeight:.06, pity:{ softStart:130, softStep:.0007, hard:320 },
  /** target farming: share of a signature boss's orange roll that lands on its own signature items */
  sigShare:.75,
  /** per-member chance by party size (index = size). Each member already rolls on their own save, so this offsets faster group clears */
  party:[1,1,.9,.8,.72,.65],
  /** duplicates: one reroll into an orange you do not own yet; a repeat after that becomes Prism Shards, and shardCost shards buy any orange you have seen */
  dupeRerolls:1, shardsPerDupe:1, shardCost:6,
  logMax:60,
};
export type PTier='ordinary'|'elite'|'boss';
export interface LogEntry { t:number; kind:'orange'|'seasonal'|'shard'|'purple'; id:string; name:string; where?:string; boss?:string; season?:string; }
export interface EcoState { dry:number; seen:Record<string,number>; shards:number; log:LogEntry[]; firstOrange?:number; kills:number; awards:number; }
export const ecoOf=(s:any):EcoState=>{ const e=(s.lootEco=s.lootEco||{}); e.dry=e.dry||0; e.seen=e.seen||{}; e.shards=e.shards||0; e.log=e.log||[]; e.kills=e.kills||0; e.awards=e.awards||0; return e; };
export interface PrestigeCtx { tier:PTier; dungeonTier:number; gateway?:boolean; hard?:boolean; party?:number; contributed?:boolean; level:number; tierCap:number;
  /** signature orange ids of the boss that died (target farming, from the dungeon/LOOT signature table the catalog also reads) */ bossSig?:string[];
  where?:string; boss?:string; now?:number; rnd?:()=>number; }
export interface PrestigeAward { kind:'orange'|'seasonal'|'shard'; item?:string; cos?:string; season?:string; dupeOf?:string; pity?:boolean; }

const SEASON_IDS=new Set(SEASONS.flatMap(s=>s.gear)); const isIdkfa=(id:string)=>id.startsWith('idkfa_');
/** Every orange that can come out of the general (non-signature) prestige pool. Signature items only ever drop from their own boss. */
export function generalOranges(sigIds:Set<string>):string[]{ return ITEMS.filter(d=>d.rarity==='orange'&&!isIdkfa(d.id)&&!SEASON_IDS.has(d.id)&&!sigIds.has(d.id)).map(d=>d.id); }
let SIG_ALL:Set<string>|null=null; export function setSignatureIds(ids:string[]){ SIG_ALL=new Set(ids); }
const sigAll=()=>SIG_ALL||new Set(ITEMS.filter(d=>d.id.startsWith('sig_')).map(d=>d.id));
export const partyMul=(n:number)=>LOOT_ECO.party[Math.max(1,Math.min(LOOT_ECO.party.length-1,Math.floor(n||1)))];
/** chance multiplier for this context (no pity) */
export function ctxMul(c:PrestigeCtx):number{ return (LOOT_ECO.tierMul[c.dungeonTier]??1)*(c.gateway?LOOT_ECO.gatewayMul:1)*(c.hard?LOOT_ECO.hardMul:1)*partyMul(c.party||1); }
export function pityBonus(dry:number):number{ const P=LOOT_ECO.pity; return dry<=P.softStart?0:(dry-P.softStart)*P.softStep; }
const lvlOk=(id:string,c:PrestigeCtx)=>{ const d=ITEM_BY_ID[id]; return !!d&&d.lvl<=c.level&&d.lvl<=c.tierCap; };
const owned=(e:EcoState,id:string)=>!!e.seen[id];
const pick=<T>(a:T[],r:()=>number)=>a[Math.floor(r()*a.length)%a.length];

/** The hidden prestige roll. Mutates the save's eco state (pity, seen, shards, log); the caller turns item awards into ground drops. */
export function rollPrestige(save:any,c:PrestigeCtx):PrestigeAward|null{
  if(c.tier==='ordinary') return null; if(c.contributed===false) return null; // no credit for standing near a fight you did not join
  const e=ecoOf(save); const r=c.rnd||Math.random; const now=c.now??Date.now(); const w=c.tier==='boss'?1:LOOT_ECO.eliteWeight;
  const sig=(c.bossSig||[]).filter(id=>lvlOk(id,c)); const gen=generalOranges(sigAll()).filter(id=>lvlOk(id,c));
  const se=activeSeason(now); const sGear=se?se.gear.filter(id=>canGrant(id,now)&&lvlOk(id,c)):[]; const sCos=se?se.cosmetics.filter(id=>canGrant(id,now)&&COS_BY_ID[id]&&!save.cosmetics?.owned?.[id]):[];
  const canO=sig.length+gen.length>0, canS=sGear.length+sCos.length>0; if(!canO&&!canS) return null; // nothing reachable here yet: pity does not advance
  e.kills++; const m=ctxMul(c); const pb=pityBonus(e.dry)*w; const low=c.level<=LOOT_ECO.lowBand.maxLevel; const forced=e.dry+w>=LOOT_ECO.pity.hard*(low&&canO?LOOT_ECO.lowBand.pityMul:1); // the short net only where an orange can land
  const pO=canO?LOOT_ECO.orange[c.tier]*m*(low?LOOT_ECO.lowBand.mul:canS?LOOT_ECO.seasonOrangeMul:1)+pb*(canS?.55:1):0, pS=canS?LOOT_ECO.seasonal[c.tier]*m+pb*(canO?.45:1):0;
  const x=r(); let kind:'orange'|'seasonal'|null=null;
  if(forced) kind=canO&&canS?(r()<(low?LOOT_ECO.lowBand.pityOrange:.55)?'orange':'seasonal'):canO?'orange':'seasonal'; else if(x<pO) kind='orange'; else if(x<pO+pS) kind='seasonal';
  if(!kind){ e.dry+=w; return null; }
  e.dry=0; e.awards++; const base={ t:now, where:c.where, boss:c.boss };
  if(kind==='orange'){
    let id=sig.length&&(r()<LOOT_ECO.sigShare||!gen.length)?pick(sig,r):pick(gen,r); const all=[...sig,...gen];
    for(let k=0;k<LOOT_ECO.dupeRerolls&&owned(e,id);k++){ const un=all.filter(i=>!owned(e,i)); if(!un.length) break; id=pick(un,r); }
    if(owned(e,id)){ e.shards+=LOOT_ECO.shardsPerDupe; log(e,{...base,kind:'shard',id,name:'Prism Shard (duplicate '+ITEM_BY_ID[id].name+')'}); return { kind:'shard', dupeOf:id, pity:forced }; }
    e.seen[id]=now; if(!e.firstOrange) e.firstOrange=now; log(e,{...base,kind:'orange',id,name:ITEM_BY_ID[id].name}); return { kind:'orange', item:id, pity:forced };
  }
  const pool=[...sGear.filter(i=>!owned(e,i)).map(i=>({i,g:true})),...sCos.map(i=>({i,g:false}))];
  if(!pool.length){ const id=pick(sGear,r); e.shards+=LOOT_ECO.shardsPerDupe; log(e,{...base,kind:'shard',id,name:'Prism Shard (duplicate '+ITEM_BY_ID[id].name+')'}); return { kind:'shard', dupeOf:id, season:se!.id, pity:forced }; }
  const p=pick(pool,r); const nm=p.g?ITEM_BY_ID[p.i].name:COS_BY_ID[p.i].name; if(p.g) e.seen[p.i]=now;
  log(e,{...base,kind:'seasonal',id:p.i,name:nm,season:se!.id}); return p.g?{ kind:'seasonal', item:p.i, season:se!.id, pity:forced }:{ kind:'seasonal', cos:p.i, season:se!.id, pity:forced };
}
export function log(e:EcoState,l:LogEntry){ e.log.unshift(l); if(e.log.length>LOOT_ECO.logMax) e.log.length=LOOT_ECO.logMax; }
/** Shards -> an orange you have already seen drop (never a seasonal: those retire). */
export function redeemable(save:any):string[]{ const e=ecoOf(save); return Object.keys(e.seen).filter(id=>ITEM_BY_ID[id]?.rarity==='orange'&&!SEASON_OF[id]); }
export function redeemShards(save:any,id:string):{ok:boolean;why?:string}{ const e=ecoOf(save); if(!redeemable(save).includes(id)) return {ok:false,why:'Only oranges you have found can be rebuilt'}; if(e.shards<LOOT_ECO.shardCost) return {ok:false,why:'Needs '+LOOT_ECO.shardCost+' Prism Shards'};
  e.shards-=LOOT_ECO.shardCost; log(e,{t:Date.now(),kind:'orange',id,name:ITEM_BY_ID[id].name+' (rebuilt from shards)'}); return {ok:true}; }
