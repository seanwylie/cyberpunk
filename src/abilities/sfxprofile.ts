// Ability SFX profiles: every ability maps to a sound FAMILY (what the augment physically is: hydraulic servo, optics, vent, arc, blade, drone...), and the
// body slot, manufacturer and rarity vary it (pitch, filter, weight, extra layers). Layers: windup (charge), cast (release), travel (projectile/beam loop tick),
// impact (hit). Pure data + pure functions: src/audio.ts plays it (ElevenLabs sample per family+layer when present, otherwise the synth fallback), tests read it.
import { ABILITY_DATA } from './data';
import { PROFILES } from './vfxprofile';
export type Family='servo'|'blade'|'optic'|'arc'|'fire'|'vent'|'drone'|'shield'|'kinetic'|'gravity'|'heal'|'blink'|'stealth'|'sonic'|'hack'|'blast'|'summon';
export type Layer='windup'|'cast'|'travel'|'impact';
export const FAMILIES:Family[]=['servo','blade','optic','arc','fire','vent','drone','shield','kinetic','gravity','heal','blink','stealth','sonic','hack','blast','summon'];
/** layers that exist as generated samples per family (tools/gen_sfx.py); every family synthesises all four as a fallback */
export const SAMPLE_LAYERS:Record<Family,Layer[]>={ servo:['windup','cast','impact'], blade:['windup','cast','impact'], optic:['windup','cast','impact','travel'], arc:['windup','cast','impact','travel'], fire:['windup','cast','impact','travel'], vent:['windup','cast','impact'], drone:['windup','cast','impact','travel'], shield:['windup','cast','impact'], kinetic:['windup','cast','impact','travel'], gravity:['windup','cast','impact'], heal:['windup','cast','impact'], blink:['windup','cast','impact'], stealth:['windup','cast','impact'], sonic:['windup','cast','impact'], hack:['windup','cast','impact'], blast:['windup','cast','impact'], summon:['windup','cast','impact','travel'] };
const F:Record<string,Family>={
  sweep:'blade', bladeburst:'blade', pulse:'hack', control:'hack', brace:'shield', reposition:'blink', cloak:'stealth', forcedcool:'vent', revive:'heal', defib:'arc',
  piston_jab:'servo', rivet_burst:'servo', hammer_slam:'kinetic', scalpel_flurry:'blade',
  overcharge_shot:'optic', slag_cannon:'fire', frag_grenade:'blast', shock_ring:'arc', thermite_lob:'fire', cascade_arc:'arc', seismic_stomp:'kinetic', firestorm_pillar:'fire',
  surgical_cut:'blade', needle_pin:'optic', coup_de_grace:'blade', reaper_lunge:'blade', headshot_protocol:'optic',
  static_snare:'arc', flashbang:'sonic', root_spikes:'kinetic', magnet_pull:'gravity', concussion_wave:'sonic', gravity_well:'gravity',
  sprint_burst:'blink', slipstream:'blink', blink_step:'blink', shoulder_charge:'servo', grapple_hook:'servo', phase_slip:'blink',
  bulwark_plates:'servo', ablative_shell:'shield', reactive_armour:'shield', phase_barrier:'shield', stoneskin:'kinetic', kinetic_dampers:'servo',
  rally_beacon:'heal', shared_aegis:'shield', warcry_horn:'sonic',
  shadow_veil:'stealth', decoy_projector:'hack', ambush_mark:'stealth', smoke_bomb:'vent', mirage_step:'stealth',
  auto_turret:'summon', sentry_drone:'drone', shock_mine:'arc', overwatch_array:'summon', virus_upload:'hack', emp_burst:'arc', repulsor_drone:'drone', neural_hijack:'hack',
  heat_sink:'vent', coolant_flush:'vent', thermal_siphon:'fire', overclock_core:'fire', cold_loop:'vent',
  field_stitch:'heal', triage_cycle:'heal', leech_blades:'blade', adrenal_surge:'heal',
  siege_bot:'summon', scrap_swarm:'drone',
  orbital_strike:'blast', blackout_protocol:'stealth', foundry_meltdown:'blast', legion_protocol:'summon', chain_reaction:'blast', second_wind:'heal',
};
/** which abilities launch something that travels (get a travel layer) */
const TRAVEL=new Set(['overcharge_shot','slag_cannon','needle_pin','thermite_lob','frag_grenade','cascade_arc','rivet_burst','grapple_hook','auto_turret','sentry_drone','overwatch_array','scrap_swarm','repulsor_drone','siege_bot','legion_protocol','orbital_strike']);
const MFR_RATE:Record<string,number>={ HI:.9, MM:1, PS:1.12 };    // Harrow-Brandt heavy / Mid-market / Precision
const MFR_LP:Record<string,number>={ HI:5200, MM:8000, PS:11500 };
const SLOT_RATE:Record<string,number>={ arm:.96, hand:1.02, leg:.92, foot:.97, torso:.86, face:1.08, brain:1.12 };
const RAR_W:Record<string,number>={ grey:.2, green:.4, blue:.6, purple:.8, orange:1 };
const hash=(s:string,m=1000)=>{ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0)%m; };
export interface SfxProfile { id:string; family:Family; mfr:string; slot:string; power:number; /** base playback rate (pitch) for this ability */ rate:number; /** per-cast random pitch spread (+-) */ vary:number; /** lowpass Hz */ lp:number; gain:number; layers:Layer[]; /** adds a low sub boom to the cast of rare+ abilities */ sub:boolean; /** synth detune seed 0..99 */ seed:number; /** loudness of the windup layer (0 = none) */ windup:number }
export const SFX:Record<string,SfxProfile>={};
const mk=(id:string,mfr:string,slot:string,power:number)=>{ const family=F[id]||'kinetic'; const seed=hash(id,100); const rate=+((MFR_RATE[mfr]??1)*(SLOT_RATE[slot]??1)*(.92+seed/100*.18)).toFixed(3);
  const layers:Layer[]=['cast','impact']; if(power>=.4||['servo','shield','blast','gravity'].includes(family)) layers.unshift('windup'); if(TRAVEL.has(id)||family==='drone') layers.splice(layers.length-1,0,'travel');
  SFX[id]={ id, family, mfr, slot, power, rate, vary:.04+.03*(1-power), lp:MFR_LP[mfr]??8000, gain:+(.5+.5*power).toFixed(2), layers, sub:power>=.8, seed, windup:power>=.4?+(.5+.4*power).toFixed(2):0 }; };
const CORE:Record<string,[string,string,number]>={ sweep:['HI','arm',.55], bladeburst:['PS','arm',.6], pulse:['MM','brain',.6], control:['MM','brain',.5], brace:['HI','torso',.45], reposition:['MM','leg',.35], cloak:['PS','torso',.35], forcedcool:['MM','torso',.4], revive:['HI','torso',.9], defib:['HI','torso',.9] };
for(const [id,[m,s,p]] of Object.entries(CORE)) mk(id,m,s,p);
for(const a of ABILITY_DATA) mk(a.id,a.mfr,a.slots[0],Math.min(1,(RAR_W[a.rarity]??.4)+(a.role==='ultimate'?.15:0)));
void PROFILES;
export const sfxOf=(id:string):SfxProfile|undefined=>SFX[id];
/** stable fingerprint of what you hear (family + pitch + filter + layers): used by tests to prove abilities sound distinct */
export const fingerprint=(p:SfxProfile)=>[p.family,p.rate,p.lp,p.gain,p.layers.join('+'),p.sub?1:0].join('|');
