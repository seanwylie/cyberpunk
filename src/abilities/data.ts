// 66 augment-granted abilities (docs/ABILITIES.md). Data only: behaviour comes from composing effect primitives (engine.ts).
import type { AbilityData as D, Prim } from './types';
type X=Partial<D>;
const A=(id:string,name:string,role:D['role'],type:D['type'],mfr:D['mfr'],rarity:D['rarity'],slots:D['slots'],shape:D['shape'],heat:number,cd:number,range:number,scale:D['scale'],steps:Prim[],flavor:string,x:X={}):D=>({
  id,name,flavor,role,type,mfr,rarity,slots,shape,heat,cd,range,windup:x.windup??(shape==='self'||shape==='toggle'?.1:.2),scale,steps,gives:x.gives||[],uses:x.uses||[],...x });
const HI='HI' as const, PS='PS' as const, MM='MM' as const;
export const ABILITY_DATA:D[]=[
// ---------------- damage burst (arms/hands) ----------------
A('piston_jab','Piston Jab','burst','attack',HI,'grey',['arm','hand'],'cone',9,3.5,2.6,'dmg',[{p:'cone',k:1.5,r:2.6,arc:50,kb:1.2},{p:'stun',t:.4}],'One honest shove of a hydraulic ram.',{gives:['Staggered']}),
A('rivet_burst','Rivet Burst','burst','attack',MM,'green',['arm','hand'],'cone',10,4,4.2,'dmg',[{p:'cone',k:1.6,r:4.2,arc:44},{p:'slow',m:.75,t:1.5}],'Kestrel sells rivets by the pallet. This is what they do to a person.',{gives:['Slowed']}),
A('hammer_slam','Hammer Slam','burst','attack',HI,'green',['arm','hand'],'self',14,5,2.4,'dmg',[{p:'circle',k:1.7,r:2.4,kb:1.5},{p:'stun',t:.6}],'Both fists, one floor.',{gives:['Staggered']}),
A('scalpel_flurry','Scalpel Flurry','burst','attack',PS,'blue',['hand','arm'],'cone',10,5,2.6,'dmg',[{p:'cone',k:.7,r:2.6,arc:70},{p:'cone',k:.7,r:2.6,arc:70},{p:'cone',k:.7,r:2.6,arc:70},{p:'mark',t:6}],'Three cuts before the first one registers. Leaves a surgical mark.',{gives:['Marked']}),
A('overcharge_shot','Overcharge Shot','burst','attack',PS,'blue',['hand','arm'],'line',12,5,9,'dmg',[{p:'projectile',speed:22,r:.5,pierce:3,life:.6,then:[{p:'damage',k:2}]}],'A capacitor bank emptied through one needle.'),
A('slag_cannon','Slag Cannon','burst','attack',HI,'blue',['arm'],'line',20,6,8,'dmg',[{p:'projectile',speed:15,r:.6,pierce:0,life:.7,then:[{p:'damage',k:1.5},{p:'burn',k:.35,t:4}]}],'Foundry waste, aimed.',{gives:['Burning']}),
// ---------------- AoE ----------------
A('frag_grenade','Frag Grenade','aoe','attack',MM,'grey',['arm','hand','torso'],'ground',9,5,7,'dmg',[{p:'delayed',t:.5,at:'aim',then:[{p:'circle',k:1.1,r:2.5,kb:.8}]}],'Pin out, count to one.'),
A('shock_ring','Shock Ring','aoe','attack',MM,'green',['arm','torso','brain'],'self',11,5,3.5,'dmg',[{p:'circle',k:.9,r:3.5},{p:'slow',m:.6,t:2.5}],'A coil on the chest dumps its charge outward.',{gives:['Slowed']}),
A('thermite_lob','Thermite Lob','aoe','attack',HI,'blue',['arm','hand'],'ground',22,6,7.5,'dmg',[{p:'delayed',t:.6,at:'aim',then:[{p:'circle',k:1.3,r:2.8},{p:'burn',k:.4,t:4}]}],'It does not need a target. It needs a floor.',{gives:['Burning']}),
A('cascade_arc','Cascade Arc','aoe','hacking',MM,'blue',['arm','brain','hand'],'lockon',14,5,8,'dmg',[{p:'chain',k:1,n:4,r:3.2,fall:.85}],'Lightning is cheap when you reuse it.'),
A('seismic_stomp','Seismic Stomp','aoe','attack',HI,'purple',['leg','torso'],'self',34,8,4.6,'dmg',[{p:'circle',k:2.1,r:4.6,kb:2},{p:'stun',t:1.1},{p:'expose',t:5}],'Gantry legs were built to stand on things. Stand on them harder.',{gives:['Staggered','Exposed']}),
A('firestorm_pillar','Firestorm Pillar','aoe','attack',HI,'purple',['arm','torso','brain'],'ground',32,10,8,'dmg',[{p:'aura',r:3,life:4.5,every:.5,at:'aim',tick:[{p:'circle',k:.38,r:3,at:'aim'},{p:'burn',k:.3,t:2}]}],'The Crucible Exchange vents the way it was designed: upward, and on someone.',{gives:['Burning']}),
// ---------------- single-target execute ----------------
A('surgical_cut','Surgical Cut','execute','attack',PS,'green',['hand','arm'],'lockon',8,4,2.4,'dmg',[{p:'damage',k:1.7}],'One incision, in the right place. Doubly so on marked flesh.',{uses:['Marked'],bonus:[{w:'Marked',m:1.5,eat:true}]}),
A('needle_pin','Needle Pin','execute','attack',PS,'green',['hand','arm','face'],'lockon',7,5,8,'dmg',[{p:'projectile',speed:30,r:.35,pierce:0,life:.4,then:[{p:'damage',k:1.2},{p:'mark',t:8}]}],'Aldane calls it a tagging dart.',{gives:['Marked']}),
A('coup_de_grace','Coup de Grace','execute','attack',PS,'blue',['hand','arm','face'],'lockon',12,8,6,'dmg',[{p:'damage',k:1.6}],'A formality, on anything already losing.',{exec:{hp:.3,m:2.6},refundOnKill:3}),
A('reaper_lunge','Reaper Lunge','execute','attack',PS,'blue',['leg','arm'],'lockon',14,7,7,'dmg',[{p:'dash',len:7,inv:.25,toTarget:true},{p:'damage',k:1.7}],'Closes the gap and the account.',{exec:{hp:.25,m:2},uses:['Marked'],bonus:[{w:'Marked',m:1.3}]}),
A('headshot_protocol','Headshot Protocol','execute','attack',PS,'purple',['face','hand','arm'],'lockon',18,10,10,'dmg',[{p:'damage',k:3.4}],'Face-mounted ranging fused to a single, unhurried shot.',{exec:{hp:.35,m:2},bonus:[{w:'Marked',m:2,eat:true}],uses:['Marked'],refundOnKill:5}),
// ---------------- crowd control ----------------
A('static_snare','Static Snare','cc','hacking',MM,'grey',['arm','hand','brain'],'ground',8,6,7,'dmg',[{p:'circle',k:.3,r:2.5,at:'aim'},{p:'slow',m:.45,t:3.5}],'Wire and a lot of volts.',{gives:['Slowed']}),
A('flashbang','Flashbang','cc','hacking',MM,'green',['face','torso'],'self',11,8,4,'cooling',[{p:'circle',k:.3,r:4},{p:'stun',t:.9},{p:'lose',r:4}],'A faceplate that is, briefly, the sun.',{gives:['Staggered']}),
A('root_spikes','Root Spikes','cc','attack',HI,'green',['arm','leg'],'line',12,7,6,'dmg',[{p:'line',k:.6,len:6,w:1.2},{p:'root',t:2.2}],'Rebar rises through the floor plates.',{gives:['Rooted']}),
A('magnet_pull','Magnet Pull','cc','hacking',MM,'blue',['arm','brain','hand'],'ground',16,8,7,'dmg',[{p:'circle',k:.4,r:4,at:'aim'},{p:'pull',s:3.2},{p:'slow',m:.6,t:2}],'Every pack, in one place, for a moment.',{gives:['Slowed']}),
A('concussion_wave','Concussion Wave','cc','attack',HI,'blue',['arm','torso'],'cone',18,7,5,'dmg',[{p:'cone',k:.9,r:5,arc:100,kb:0},{p:'push',s:3.4},{p:'stun',t:1}],'Hits like a door closing.',{gives:['Staggered']}),
A('gravity_well','Gravity Well','cc','hacking',PS,'purple',['brain','face'],'ground',26,12,8,'cooling',[{p:'aura',r:4,life:4,every:.4,at:'aim',tick:[{p:'circle',k:.25,r:4,at:'aim'},{p:'pull',s:1.2},{p:'slow',m:.5,t:.8}]}],'A tidy little singularity with a three-second warranty.',{gives:['Slowed']}),
// ---------------- mobility (legs/feet) ----------------
A('sprint_burst','Sprint Burst','mobility','mobility',MM,'grey',['leg','foot'],'self',6,8,0,'move',[{p:'buff',s:'move',m:1.4,t:3}],'The cheapest speed money buys.',{gives:['Hasted']}),
A('slipstream','Slipstream','mobility','mobility',MM,'green',['foot','leg'],'line',8,6,4.2,'move',[{p:'dash',len:4.2,inv:.15},{p:'buff',s:'move',m:1.25,t:3}],'Go forward, and keep going.',{gives:['Hasted']}),
A('blink_step','Blink Step','mobility','mobility',PS,'green',['foot','leg'],'ground',12,7,5.5,'move',[{p:'teleport'}],'Damped feet, zero friction, one stride.'),
A('shoulder_charge','Shoulder Charge','mobility','attack',HI,'green',['leg','arm'],'line',13,7,4.5,'dmg',[{p:'dash',len:4.5,inv:.2,k:1},{p:'stun',t:.6}],'Brannoch-built legs do not detour.',{gives:['Staggered']}),
A('grapple_hook','Grapple Hook','mobility','mobility',MM,'blue',['arm','leg','hand'],'lockon',12,8,9,'move',[{p:'dash',len:9,inv:.2,toTarget:true},{p:'damage',k:.8},{p:'stun',t:.5}],'Winch, hook and an apology.',{gives:['Staggered']}),
A('phase_slip','Phase Slip','mobility','mobility',PS,'blue',['leg','foot'],'line',16,9,4.6,'move',[{p:'dash',len:4.6,inv:.35},{p:'cloak',t:1.8}],'Slip between frames; arrive unobserved.',{gives:['Cloaked']}),
// ---------------- defence / mitigation (torso/legs) ----------------
A('bulwark_plates','Bulwark Plates','defence','defense',HI,'grey',['torso','leg'],'self',7,9,0,'armor',[{p:'mitigate',m:.55,t:3}],'Slag Apron shutters, closed.'),
A('ablative_shell','Ablative Shell','defence','defense',HI,'green',['torso'],'self',10,10,0,'maxHp',[{p:'shield',f:.3,t:6}],'Sacrificial plating, cooked to order.',{gives:['Shielded']}),
A('reactive_armour','Reactive Armour','defence','defense',HI,'blue',['torso'],'self',18,11,0,'armor',[{p:'mitigate',m:.7,t:4},{p:'reflect',f:1,t:4}],'Explosive tiles. Not for the attacker.'),
A('phase_barrier','Phase Barrier','defence','defense',PS,'blue',['torso','brain'],'self',14,12,0,'maxHp',[{p:'shield',f:.25,t:5},{p:'invuln',t:.8}],'A membrane that is not quite here.',{gives:['Shielded']}),
A('stoneskin','Stoneskin','defence','defense',HI,'purple',['torso'],'toggle',6,2,0,'armor',[],'Ram the frame solid. It drinks power.',{toggle:{heat:5.5,mitigate:.7,move:.85},chipNote:'Plating and Ablative chips add to the mitigation.'}),
A('kinetic_dampers','Kinetic Dampers','defence','defense',PS,'green',['leg','torso'],'self',9,9,0,'armor',[{p:'mitigate',m:.65,t:2.5},{p:'buff',s:'move',m:1.15,t:2.5}],'Fall softly, move quickly.',{gives:['Hasted']}),
// ---------------- support / team ----------------
A('rally_beacon','Rally Beacon','support','defense',MM,'blue',['torso','brain'],'self',14,14,0,'regen',[{p:'aura',r:4.5,life:7,every:1,follow:false,at:'self',tick:[{p:'heal',f:.03},{p:'buff',s:'dmg',m:1.15,t:1.5}]}],'A Kestrel safety light that happens to embolden.',{gives:['Charged']}),
A('shared_aegis','Shared Aegis','support','defense',MM,'green',['torso','brain'],'self',12,12,0,'maxHp',[{p:'shield',f:.2,t:6}],'Shield your squad. Solo: your own.',{gives:['Shielded']}),
A('warcry_horn','Warcry Horn','support','attack',HI,'blue',['torso','face'],'self',16,13,4,'dmg',[{p:'buff',s:'dmg',m:1.3,t:6},{p:'circle',k:.2,r:4},{p:'slow',m:.7,t:2}],'Subtle as a foundry whistle.',{gives:['Charged']}),
// ---------------- stealth / deception ----------------
A('shadow_veil','Shadow Veil','stealth','mobility',PS,'green',['face','torso'],'self',11,10,0,'cooling',[{p:'cloak',t:4}],'Optics dim, signature drops.',{gives:['Cloaked']}),
A('decoy_projector','Decoy Projector','stealth','mobility',MM,'green',['face','brain'],'ground',10,11,6,'cooling',[{p:'summon',kind:'decoy',life:5,every:.5,r:6,tick:[{p:'lose',r:6}],end:[{p:'circle',k:.8,r:2.2,at:'aim'}]}],'It looks like you, but cheaper.'),
A('ambush_mark','Ambush Mark','stealth','attack',PS,'blue',['face','torso'],'self',13,11,0,'dmg',[{p:'cloak',t:2.5},{p:'buff',s:'ambush',m:2,t:4}],'Disappear, then arrive.',{gives:['Cloaked']}),
A('smoke_bomb','Smoke Bomb','stealth','mobility',MM,'grey',['torso','arm','face'],'ground',8,10,6,'cooling',[{p:'aura',r:3,life:5,every:.5,at:'aim',tick:[{p:'lose',r:3},{p:'slow',m:.8,t:.8}]}],'Gray, cheap, effective.'),
A('mirage_step','Mirage Step','stealth','mobility',PS,'purple',['face','leg','brain'],'ground',20,12,6.5,'move',[{p:'teleport'},{p:'cloak',t:3},{p:'summon',kind:'decoy',life:4,every:.5,r:6,tick:[{p:'lose',r:6}]}],'You were never where they were looking.',{gives:['Cloaked']}),
// ---------------- hacking / tech ----------------
A('auto_turret','Auto Turret','tech','hacking',MM,'green',['arm','brain','torso'],'ground',14,12,6,'dmg',[{p:'summon',kind:'turret',life:12,every:.8,r:9,tick:[{p:'shoot',k:.45}]}],'A gate turret with its allegiance reflashed.'),
A('sentry_drone','Sentry Drone','tech','hacking',MM,'blue',['brain','torso','arm'],'self',16,14,0,'cooling',[{p:'summon',kind:'drone',life:11,every:.6,r:8,tick:[{p:'shoot',k:.38}]}],'Trails you like a loyal, armed pigeon.'),
A('shock_mine','Shock Mine','tech','hacking',MM,'grey',['arm','hand','leg'],'ground',8,6,6,'dmg',[{p:'trap',r:1.5,life:30,then:[{p:'circle',k:1.2,r:2.2},{p:'stun',t:.9}]}],'Step here. Please.',{gives:['Staggered']}),
A('overwatch_array','Overwatch Array','tech','hacking',PS,'purple',['brain','arm'],'ground',26,14,6,'dmg',[{p:'summon',kind:'turret',life:14,every:.45,r:11,tick:[{p:'shoot',k:.6}]}],'Precision, on a schedule.',{uses:['Marked']}),
A('virus_upload','Virus Upload','tech','hacking',PS,'blue',['brain','face'],'lockon',15,9,9,'cooling',[{p:'burn',k:.25,t:5},{p:'expose',t:6},{p:'mark',t:6}],'A worm that makes everything else hit harder.',{gives:['Exposed','Marked','Burning']}),
A('emp_burst','EMP Burst','tech','hacking',MM,'green',['brain','face','torso'],'self',13,8,4,'cooling',[{p:'circle',k:.6,r:4},{p:'strip'},{p:'stun',t:1.1}],'Pulls the plug on shields and little else.',{gives:['Staggered']}),
A('repulsor_drone','Repulsor Drone','tech','hacking',HI,'blue',['brain','arm','torso'],'self',18,13,0,'cooling',[{p:'summon',kind:'drone',life:9,every:.7,r:3,tick:[{p:'circle',k:.3,r:3,at:'aim'},{p:'push',s:1.3}]}],'Hovering bumper bar.'),
A('neural_hijack','Neural Hijack','tech','hacking',PS,'purple',['brain','face'],'lockon',28,16,9,'cooling',[{p:'control',t:7},{p:'tether',t:7}],'Gets you a very confused soldier.',{gives:['Tethered']}),
// ---------------- heat management ----------------
A('heat_sink','Heat Sink','heat','defense',MM,'grey',['brain','torso'],'self',0,8,0,'cooling',[{p:'vent',n:35}],'A bag of cold water and a fan.'),
A('coolant_flush','Coolant Flush','heat','defense',PS,'green',['brain','torso'],'self',0,10,0,'cooling',[{p:'vent',n:50},{p:'cdr',t:1.2,all:true}],'Dump, reload, go.'),
A('thermal_siphon','Thermal Siphon','heat','attack',HI,'blue',['torso','arm','brain'],'self',10,7,3,'dmg',[{p:'circle',k:.8,r:3},{p:'ventHit',n:7,cap:35}],'Takes heat out of the room and puts it into the weather.'),
A('overclock_core','Overclock Core','heat','attack',HI,'purple',['brain','torso'],'toggle',4,3,0,'dmg',[],'Heat is a currency. Spend it.',{toggle:{heat:6,dmg:1.3,cool:.7},uses:['Overheated']}),
A('cold_loop','Cold Loop','heat','defense',PS,'blue',['brain','torso'],'toggle',3,3,0,'cooling',[],'The brain runs cold; the legs pay.',{toggle:{heat:0,vent:6,move:.85}}),
// ---------------- sustain / healing ----------------
A('field_stitch','Field Stitch','sustain','defense',MM,'grey',['torso','arm'],'self',6,12,0,'regen',[{p:'heal',f:.22,over:4}],'Staples and wishes.'),
A('triage_cycle','Triage Cycle','sustain','defense',PS,'green',['torso','brain'],'self',10,16,0,'regen',[{p:'heal',f:.28}],'Aldane advertises it as a lifestyle.'),
A('leech_blades','Leech Blades','sustain','attack',HI,'blue',['arm','hand','torso'],'self',14,12,0,'dmg',[{p:'buff',s:'lifesteal',m:.18,t:7}],'The ripper remembers where it has been.'),
A('adrenal_surge','Adrenal Surge','sustain','defense',MM,'blue',['torso','leg'],'self',12,14,0,'regen',[{p:'heal',f:.25,over:5},{p:'buff',s:'dmg',m:1.2,t:5}],'Kestrel has not done a study.',{gives:['Charged']}),
// ---------------- summons / deployables ----------------
A('siege_bot','Siege Bot','summon','hacking',HI,'purple',['arm','torso','brain'],'ground',30,16,6,'dmg',[{p:'summon',kind:'bot',life:14,every:.6,r:2.6,tick:[{p:'circle',k:.55,r:2.6,at:'aim'},{p:'slow',m:.7,t:1}]}],'A walking Press-Ram. Bring a leash.',{gives:['Slowed']}),
A('scrap_swarm','Scrap Swarm','summon','hacking',MM,'blue',['arm','torso','brain'],'self',18,13,0,'dmg',[{p:'summon',kind:'drone',life:9,every:.3,r:6,tick:[{p:'shoot',k:.2}]}],'Whatever was on the floor, now angry.'),
// ---------------- ultimates ----------------
A('orbital_strike','Orbital Strike','ultimate','attack',PS,'orange',['face','brain'],'ground',45,40,12,'dmg',[{p:'delayed',t:1.3,at:'aim',then:[{p:'circle',k:6.5,r:3.6,kb:1},{p:'stun',t:2},{p:'mark',t:8}]}],'The Warden never gave back the satellite.',{gives:['Staggered','Marked'],windup:.35}),
A('blackout_protocol','Blackout Protocol','ultimate','mobility',PS,'orange',['face','brain','torso'],'self',35,45,8,'cooling',[{p:'lose',r:9},{p:'cloak',t:6},{p:'buff',s:'ambush',m:2.4,t:7}],'Every light in the district, off.',{gives:['Cloaked']}),
A('foundry_meltdown','Foundry Meltdown','ultimate','attack',HI,'orange',['torso','arm'],'self',45,45,4.4,'dmg',[{p:'circle',k:2.6,r:4.4,kb:2},{p:'burn',k:.5,t:5},{p:'shield',f:.4,t:8},{p:'buff',s:'dmg',m:1.5,t:8}],'It is not an explosion. It is a shift change.',{gives:['Burning','Shielded','Charged'],windup:.3}),
A('legion_protocol','Legion Protocol','ultimate','hacking',MM,'orange',['brain','torso'],'ground',40,40,6,'cooling',[{p:'summon',kind:'turret',life:14,every:.6,r:9,tick:[{p:'shoot',k:.5}]},{p:'summon',kind:'turret',life:14,every:.6,r:9,tick:[{p:'shoot',k:.5}]},{p:'summon',kind:'drone',life:14,every:.5,r:9,tick:[{p:'shoot',k:.35}]},{p:'summon',kind:'drone',life:14,every:.5,r:9,tick:[{p:'shoot',k:.35}]}],'The whole catalogue, deployed.'),
A('chain_reaction','Chain Reaction','ultimate','attack',HI,'orange',['arm','brain'],'self',40,35,9,'dmg',[{p:'circle',k:0,r:9},{p:'mark',t:4},{p:'tether',t:4},{p:'delayed',t:1.6,at:'self',then:[{p:'circle',k:2.4,r:9},{p:'burn',k:.3,t:3}]}],'Everything nearby is a fuse.',{gives:['Marked','Tethered','Burning']}),
A('second_wind','Second Wind','ultimate','defense',MM,'orange',['torso','brain'],'self',0,60,0,'maxHp',[{p:'heal',f:.6},{p:'shield',f:.3,t:8},{p:'cdr',t:60,all:true},{p:'vent',n:100}],'Kestrel\'s one-time-use clause, used.',{gives:['Shielded']}),
];
