import { ABILITY_DATA } from './data';
import type { AbilityData } from './types';
export const ABILITY_BY_ID:Record<string,AbilityData>=Object.fromEntries(ABILITY_DATA.map(a=>[a.id,a]));
export { ABILITY_DATA };
/** Auto-generated one-line description from the primitives (used by the tooltip and the codex). */
export function describe(a:AbilityData):string{
  const out:string[]=[]; const walk=(ps:AbilityData['steps'],pre='')=>{ for(const p of ps as any[]){ switch(p.p){
    case 'damage': out.push(`${pre}hits for ${Math.round(p.k*30)}`); break; case 'cone': out.push(`${pre}${Math.round(p.k*30)} dmg in a ${p.arc}° cone`); break; case 'line': out.push(`${pre}${Math.round(p.k*30)} dmg along a ${p.len}-tile line`); break;
    case 'circle': if(p.k>0) out.push(`${pre}${Math.round(p.k*30)} dmg in ${p.r} tiles`); else out.push(`${pre}everything within ${p.r} tiles`); break; case 'chain': out.push(`${pre}chains to ${p.n} enemies`); break;
    case 'projectile': out.push(`${pre}fires a bolt${p.pierce?` (pierces ${p.pierce})`:''}`); walk(p.then,'→ '); break; case 'dash': out.push(`${pre}dashes ${p.len} tiles${p.inv?' (brief invulnerability)':''}${p.k?` for ${Math.round(p.k*30)} dmg`:''}`); break; case 'teleport': out.push(`${pre}teleports to the aimed point (up to ${a.range} tiles)`); break;
    case 'pull': out.push('pulls in'); break; case 'push': out.push('knocks back'); break; case 'stun': out.push(`stuns ${p.t}s`); break; case 'slow': out.push(`slows ${Math.round((1-p.m)*100)}% for ${p.t}s`); break; case 'root': out.push(`roots ${p.t}s`); break;
    case 'mark': out.push(`Marks ${p.t}s (+15% damage taken)`); break; case 'expose': out.push(`Exposes ${p.t}s (+20% damage taken)`); break; case 'burn': out.push(`burns ${p.t}s`); break; case 'tether': out.push('Tethers (damage echoes)'); break;
    case 'control': out.push(`turns an enemy ${p.t}s`); break; case 'strip': out.push('strips shields'); break; case 'lose': out.push('enemies lose track of you'); break;
    case 'shield': out.push(`${Math.round(p.f*100)}% max HP shield ${p.t}s`); break; case 'mitigate': out.push(`${Math.round((1-p.m)*100)}% less damage ${p.t}s`); break; case 'reflect': out.push(`reflects ${Math.round(p.f*100)}% of damage`); break;
    case 'heal': out.push(`heals ${Math.round(p.f*100)}% HP${p.over?` over ${p.over}s`:''}`); break; case 'cloak': out.push(`cloaks you for ${p.t}s (enemies lose track)`); break; case 'cdr': out.push(p.all&&p.t>=30?'resets other cooldowns':`other cooldowns -${p.t}s`); break;
    case 'vent': out.push(`vents ${p.n} heat`); break; case 'ventHit': out.push(`vents ${p.n} heat per enemy hit (max ${p.cap})`); break; case 'buff': out.push(p.s==='dmg'?`+${Math.round((p.m-1)*100)}% damage ${p.t}s`:p.s==='move'?`+${Math.round((p.m-1)*100)}% speed ${p.t}s`:p.s==='lifesteal'?`${Math.round(p.m*100)}% lifesteal ${p.t}s`:`next hit x${p.m} (ambush)`); break;
    case 'invuln': out.push(`${p.t}s invulnerable`); break; case 'shoot': out.push(`shoots for ${Math.round(p.k*30)}`); break;
    case 'summon': out.push(`deploys a ${p.kind} (${p.life}s)`); break; case 'aura': out.push(`${p.r}-tile field for ${p.life}s`); break; case 'trap': out.push('lays a trap'); break; case 'delayed': out.push(`after ${p.t}s:`); walk(p.then,''); break; } } };
  walk(a.steps); if(a.toggle) out.push(`toggle: ${a.toggle.heat?`+${a.toggle.heat} heat/s`:''}${a.toggle.vent?` vents ${a.toggle.vent}/s`:''}${a.toggle.mitigate?`, ${Math.round((1-a.toggle.mitigate)*100)}% less damage`:''}${a.toggle.dmg?`, +${Math.round((a.toggle.dmg-1)*100)}% damage`:''}${a.toggle.move?`, ${Math.round((a.toggle.move-1)*100)}% speed`:''}`);
  for(const b of a.bonus||[]) out.push(`x${b.m} vs ${b.w}${b.eat?' (consumes)':''}`); if(a.exec) out.push(`x${a.exec.m} below ${Math.round(a.exec.hp*100)}% HP`); if(a.refundOnKill) out.push(`kill refunds ${a.refundOnKill}s cooldown`);
  const s=out.join(', '); return s.charAt(0).toUpperCase()+s.slice(1)+'.'; }
export const ROLE_LABEL:Record<string,string>={ burst:'Damage burst', aoe:'Area damage', execute:'Execute', cc:'Crowd control', mobility:'Mobility', defence:'Defence', support:'Support', stealth:'Stealth', tech:'Hacking / tech', heat:'Heat control', sustain:'Sustain', summon:'Summons', ultimate:'Ultimate' };
