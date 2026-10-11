// Ability counters: which ability answers which enemy mechanic. Used for the enemy counter icon, first-time hints and the low-ability-use nudge.
import { ABILITIES, AbilityId, ENEMIES } from '../config';
export interface Counter { id:AbilityId; why:string; kind:string }
/** The ability that best counters this enemy right now, or null when plain damage is fine. */
export function counterFor(e:any):Counter|null{
  const def=ENEMIES[e.type]; if(!def||e.dead||e.faction!=='enemy') return null; const rt=e._rt||{}; const aff:string[]=e.affix||[]; const role=def.mob?.role;
  if(rt.shield&&rt.shield.hp>0) return { id:'pulse', kind:'shield', why:'Shield: use Pulse' };
  if(def.boss){ return def.summon?{ id:'sweep', kind:'adds', why:'Adds: use Sweep' }:null; }
  if(role==='healer'||role==='support') return { id:'control', kind:'healer', why:'Healer: use Control' };
  if(aff.includes('vampiric')) return { id:'control', kind:'vampiric', why:'Vampiric: stun it with Control' };
  if(aff.includes('warded')) return { id:'control', kind:'warded', why:'Warded: stun it to cancel the ward' };
  if(aff.includes('frenzied')) return { id:'control', kind:'frenzied', why:'Frenzied: stun it to reset the rage' };
  if(aff.includes('stormcalled')) return { id:'reposition', kind:'stormcalled', why:'Lightning: Reposition through the strike' };
  if(aff.includes('molten')) return { id:'control', kind:'molten', why:'Molten: stun it, keep off the pools' };
  if(aff.includes('brooding')) return { id:'sweep', kind:'brooding', why:'Brood: Sweep clears the cindermites' };
  if(aff.includes('regenerating')) return { id:'bladeburst', kind:'regen', why:'Regenerating: burst it with abilities' };
  if(aff.includes('hasted')) return { id:'control', kind:'hasted', why:'Hasted: stun it with Control' };
  if(aff.includes('volatile')) return { id:'pulse', kind:'volatile', why:'Volatile: stun it, kill it at range' };
  if(role==='charger') return { id:'brace', kind:'charger', why:'Charger: Brace to counter-stun it' };
  if(role==='summoner'||def.summon) return { id:'sweep', kind:'summoner', why:'Summoner: Sweep clears its adds' };
  if(role==='swarmer') return { id:'sweep', kind:'swarm', why:'Swarm: use Sweep' };
  if(role==='exploder') return { id:'reposition', kind:'exploder', why:'Exploder: Reposition away' };
  if(role==='sniper') return { id:'bladeburst', kind:'sniper', why:'Sniper: Blade Burst to close in' };
  if(role==='caster') return { id:'reposition', kind:'caster', why:'Telegraphed AoE: Reposition through it' };
  if(role==='debuffer') return { id:'pulse', kind:'debuffer', why:'Debuffer: stun it with Pulse' };
  if(role==='bruiser') return { id:'brace', kind:'bruiser', why:'Heavy hitter: Brace and reflect' };
  return null;
}
export const KEYS=['Q','E','R'];
/** Hint line with the hotkey when the ability is equipped, otherwise a pointer to hardware. */
export function hintText(c:Counter,equipped:AbilityId[]):string{ const i=equipped.indexOf(c.id); return i>=0?`${c.why} [${KEYS[i]}]`:`${c.why} (${ABILITIES[c.id].name}: equip hardware that grants it)`; }
