// Ability VFX profiles: one data row per ability (core + augment) that drives the particle recipes (src/vfx.ts), hit reactions (src/sim.ts hurtEnemy),
// screen accents, shake/hit-stop scaling and synth stingers (src/audio.ts). Pure data + pure functions (no sim/render imports) so config/sim/tests can all use it.
// Colour: the ability TYPE colour (same as the buttons) stays the primary ring/aura colour; the ELEMENT supplies the motif and highlight colours.
import { ABILITY_DATA } from './data';
export type Elem='kinetic'|'fire'|'arc'|'frost'|'void'|'barrier'|'verdant'|'blink'|'gear'|'steam'|'shadow'|'sonic'|'holo';
export type VType='attack'|'defense'|'hacking'|'mobility'|'heat';
export interface VfxProfile { id:string; elem:Elem; type:VType; /** short description of the signature look (docs) */ signature:string; /** 0..1 grandness: rarity + role */ power:number; /** screen shake 0..1 */ shake:number; /** hit-stop seconds on a hit */ stop:number; /** stinger name for audio.sfx */ cast:string; hit:string; /** per-ability variation seed 0..7 (spoke counts, rotation, ring layering) */ v:number; trail:boolean; accent:boolean }
export const TYPE_RGB:Record<VType,string>={ attack:'#c4543c', defense:'#d8d2bf', hacking:'#6d90b0', mobility:'#a8b87a', heat:'#d5e4e6' };
/** [highlight, core] per element (the type colour is the third, outer colour) */
export const ELEM_PAL:Record<Elem,readonly [string,string]>={ kinetic:['#ffe0b0','#d9a36a'], fire:['#ffd27a','#ff7a2a'], arc:['#f4ffff','#8fd4ff'], frost:['#ffffff','#a8e4f4'], void:['#e8d0ff','#8a5ad0'], barrier:['#ffffff','#9ec7e8'], verdant:['#e8ffd8','#7fd08a'], blink:['#f4ffe0','#b5e070'], gear:['#fff4c8','#d8b050'], steam:['#ffffff','#c8d8dc'], shadow:['#d8e0c0','#5a6a46'], sonic:['#fff8e0','#e8c46a'], holo:['#e8f6ff','#5fb4ea'] };
const EL:Record<string,[Elem,string]>={
  sweep:['kinetic','Rip arc: crescent slash trail, debris fan'], bladeburst:['kinetic','Afterimage lunge streaks'], pulse:['holo','Hex rune pulse + shield-shatter shards'], control:['holo','Pull rings and a tether bolt'], brace:['barrier','Hex plate shell that flares when struck'], reposition:['blink','Dash ghosts + dust'], cloak:['shadow','Rising motes and a fading ghost'], forcedcool:['steam','Vent jet and frost mist'], revive:['verdant','Defib arcs and a lifting bloom'], defib:['arc','Defib arcs and a lifting bloom'],
  piston_jab:['kinetic','Short piston thrust, dust ring'], rivet_burst:['gear','Rivet spray, ricochet sparks'], hammer_slam:['kinetic','Ground slam: cracks, debris and a dust shockwave'], scalpel_flurry:['kinetic','Rapid fine slashes'],
  overcharge_shot:['arc','Charged bolt with a crackling trail'], slag_cannon:['fire','Molten slug trailing embers, splash puddle'], frag_grenade:['fire','Lobbed frag, ring blast and shrapnel'], shock_ring:['arc','Expanding lightning ring'], thermite_lob:['fire','Thermite burn pool'], cascade_arc:['arc','Chain lightning forks'], seismic_stomp:['kinetic','Seismic ripple rings and falling rubble'], firestorm_pillar:['fire','Rising fire pillar, cinders'],
  surgical_cut:['kinetic','Single precise cut flash'], needle_pin:['gear','Needle bolt, pin mark'], coup_de_grace:['kinetic','Finishing strike, heavy flash'], reaper_lunge:['shadow','Dark lunge streak, scythe arc'], headshot_protocol:['holo','Target lock reticle, crack'],
  static_snare:['arc','Static web on the ground'], flashbang:['sonic','White-gold burst ring'], root_spikes:['kinetic','Spikes erupting along a line'], magnet_pull:['void','Inward pull rings'], concussion_wave:['sonic','Cone shock wave rings'], gravity_well:['void','Singularity: inward sparks, dark ring'],
  sprint_burst:['blink','Speed lines and foot dust'], slipstream:['blink','Wind streak lane'], blink_step:['blink','Entry and exit rings, motes'], shoulder_charge:['kinetic','Charge dust trail and impact'], grapple_hook:['gear','Hook cable and snap'], phase_slip:['shadow','Phase ghosts, blurred streak'],
  bulwark_plates:['barrier','Plates slam up around you'], ablative_shell:['barrier','Segmented shell shimmer'], reactive_armour:['barrier','Reactive tiles flaring'], phase_barrier:['holo','Phase dome flicker'], stoneskin:['kinetic','Stone grit aura'], kinetic_dampers:['kinetic','Damper rings'],
  rally_beacon:['verdant','Beacon pillar and healing motes'], shared_aegis:['barrier','Aegis dome'], warcry_horn:['sonic','Horn shock rings'],
  shadow_veil:['shadow','Veil fog and motes'], decoy_projector:['holo','Decoy projection flicker'], ambush_mark:['shadow','Mark brand and shadow'], smoke_bomb:['steam','Smoke billow'], mirage_step:['holo','Mirage afterimages'],
  auto_turret:['gear','Deploy sparks, muzzle flashes'], sentry_drone:['gear','Drone spin-up ring'], shock_mine:['arc','Armed mine ring, arc burst'], overwatch_array:['gear','Array deploy rings'], virus_upload:['holo','Glitching code motes'], emp_burst:['arc','EMP ring and arcs'], repulsor_drone:['sonic','Repulsor pulse'], neural_hijack:['holo','Neural tether and flicker'],
  heat_sink:['steam','Vent steam'], coolant_flush:['frost','Coolant frost burst'], thermal_siphon:['fire','Siphon inward embers'], overclock_core:['fire','Overclock ember aura'], cold_loop:['frost','Frost aura'],
  field_stitch:['verdant','Stitch glints and green motes'], triage_cycle:['verdant','Triage cross glints'], leech_blades:['void','Draining red motes'], adrenal_surge:['verdant','Adrenal surge burst'],
  siege_bot:['gear','Siege bot drop, dust'], scrap_swarm:['gear','Scrap swarm deploy'],
  orbital_strike:['arc','Targeting ring, orbital beam impact'], blackout_protocol:['shadow','Blackout dark wave'], foundry_meltdown:['fire','Meltdown core burst'], legion_protocol:['holo','Legion deploy rings'], chain_reaction:['fire','Chain reaction cascade'], second_wind:['verdant','Second wind bloom and ring'],
};
const RAR:Record<string,number>={ grey:.2, green:.4, blue:.6, purple:.8, orange:1 };
const CORE_POWER:Record<string,number>={ sweep:.55, bladeburst:.6, pulse:.6, control:.5, brace:.45, reposition:.35, cloak:.35, forcedcool:.4, revive:.9, defib:.9 };
const CORE_TYPE:Record<string,VType>={ sweep:'attack', bladeburst:'attack', pulse:'hacking', control:'hacking', brace:'defense', reposition:'mobility', cloak:'mobility', forcedcool:'heat', revive:'defense', defib:'defense' };
const ROLE_BONUS:Record<string,number>={ ultimate:.2, aoe:.1, burst:.08, execute:.08, summon:.06 };
const hash=(s:string)=>{ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0)%8; };
const CAST_SFX:Partial<Record<Elem,string>>={}; // names are 'abc_<elem>' / 'abh_<elem>' (src/audio.ts)
export const PROFILES:Record<string,VfxProfile>={};
const build=(id:string,type:VType,power:number,role='')=>{ const [elem,signature]=EL[id]||['kinetic','Generic type burst']; const p=Math.min(1,power+(ROLE_BONUS[role]||0));
  PROFILES[id]={ id, elem, type, signature, power:p, shake:+(.12+.5*p).toFixed(2), stop:+(.025+.045*p).toFixed(3), cast:'abc_'+elem, hit:'abh_'+elem, v:hash(id), trail:true, accent:p>=.6 }; };
for(const [id,p] of Object.entries(CORE_POWER)) build(id,CORE_TYPE[id],p);
for(const a of ABILITY_DATA) build(a.id,a.role==='heat'?'heat':a.type,RAR[a.rarity]??.4,a.role);
void CAST_SFX;
/** profile for any ability id (generic fallback so unknown ids still get a sane look) */
export const profileOf=(id:string):VfxProfile=>PROFILES[id]||(PROFILES[id]={ id, elem:'kinetic', type:'attack', signature:'Generic burst', power:.3, shake:.2, stop:.03, cast:'abc_kinetic', hit:'abh_kinetic', v:hash(id), trail:false, accent:false });
