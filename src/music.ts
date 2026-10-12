// File-based adaptive music (ElevenLabs-generated tracks, see docs/AUDIO.md). State-driven with equal-power crossfades.
// Falls back to the procedural scheduler in audio.ts when files are missing (isReady() === false).
export type MState='town'|'traversal'|'combat'|'elite'|'bossreveal'|'bosscombat'|'resolution';
interface TrackDef { file:string; loop:boolean; keepPos:boolean }
const LOOPS=['harrow_forge','harrow_ember','harrow_steam','town','traversal_a','traversal_b','combat_a','combat_b','boss_fight','calm_drift','calm_rust','calm_neon','calm_vents','calm_static','elite_siege','elite_hunt','boss_overclock','boss_meltdown','boss_hydraulic','boss_lineman','boss_pitboss','boss_bellfounder','boss_cryo','boss_auditor','boss_apothecary','boss_clearance','boss_resonance','boss_liquidator','boss_courier','boss_dispatcher','boss_warrantor','boss_rattle','boss_widow','boss_recall'];
/** Ambient pack 2 + extra elite themes: lazy (never preloaded; fetched one-ahead right before use). */
export const CALM2=['town_dusk','town_market','town_neonrain','harrow_dawn','harrow_cinder','area_hi_slag','area_hi_press','area_ps_sterile','area_ps_ward','area_mm_muzak','area_mm_aisles','calm_tide','calm_ghost','calm_orbit'];
export const CALM3=['town_rooftop','town_jukebox','town_dockside','harrow_smelter','harrow_lamplight','harrow_ash','harrow_shift','calm_hollow','calm_relay','calm_alley','calm_conduit','calm_afterglow','calm_stasis','area_hi_ember','area_ps_hush','area_mm_closing'];
/** Mood families: adjacent calm tracks prefer a different family so the soundtrack keeps contrasting (drift = beatless/slow, pulse = soft rhythm, noir = smoky/jazzy, industrial = machine calm). */
export const FAMILY:Record<string,'drift'|'pulse'|'noir'|'industrial'>={ town:'pulse',calm_drift:'drift',calm_rust:'noir',calm_vents:'drift',town_dusk:'noir',town_market:'pulse',town_neonrain:'noir',traversal_a:'pulse',traversal_b:'industrial',calm_neon:'pulse',calm_static:'pulse',calm_tide:'drift',calm_ghost:'noir',calm_orbit:'drift',
  harrow_forge:'industrial',harrow_ember:'drift',harrow_steam:'industrial',harrow_dawn:'drift',harrow_cinder:'drift',area_hi_slag:'industrial',area_hi_press:'industrial',area_ps_sterile:'drift',area_ps_ward:'noir',area_mm_muzak:'noir',area_mm_aisles:'pulse',
  town_rooftop:'drift',town_jukebox:'noir',town_dockside:'pulse',harrow_smelter:'industrial',harrow_lamplight:'noir',harrow_ash:'drift',harrow_shift:'pulse',calm_hollow:'drift',calm_relay:'pulse',calm_alley:'noir',calm_conduit:'industrial',calm_afterglow:'drift',calm_stasis:'industrial',area_hi_ember:'pulse',area_ps_hush:'drift',area_mm_closing:'noir' };
export const CALM4=['town_dawnmarket','town_lastcall','town_scrapyard','harrow_whistle','harrow_chapel','harrow_mill','calm_coldopen','calm_midshift','calm_deepcut','calm_exitroute','calm_breathing','calm_wires','calm_sodium','area_hi_coke','area_hi_bellring','area_ps_archive','area_ps_ledger','area_mm_clearance','area_mm_freight'];
export const BOSS4=['boss_tarpit','boss_rivet','boss_ledgerman','boss_cinder','boss_vigil','boss_static_choir','boss_gearwork','boss_tollroad','boss_marrow','boss_hammerfall','boss_siren','boss_glitchking','boss_dirge','boss_overload','boss_ironchoir','boss_apex','boss_cataclysm','boss_endshift','boss_zero'];
export const ELITE4=['elite_pistons','elite_flare','elite_knell','elite_hexa','elite_scour','elite_lockdown','elite_vandal','elite_cascade','elite_thorn','elite_ironhide','elite_surge'];
export const STINGERS=['stinger_levelup','stinger_rare','stinger_complete','stinger_death','stinger_ascent'];
Object.assign(FAMILY,{ town_dawnmarket:'drift',town_lastcall:'noir',town_scrapyard:'industrial',harrow_whistle:'pulse',harrow_chapel:'drift',harrow_mill:'industrial',calm_coldopen:'drift',calm_midshift:'pulse',calm_deepcut:'industrial',calm_exitroute:'noir',calm_breathing:'drift',calm_wires:'pulse',calm_sodium:'noir',area_hi_coke:'industrial',area_hi_bellring:'drift',area_ps_archive:'drift',area_ps_ledger:'noir',area_mm_clearance:'pulse',area_mm_freight:'industrial' });
export const ELITE2=['elite_chrome','elite_voltage','elite_claw','elite_gridlock','elite_static','elite_ashfall','elite_razor','elite_cull','elite_sleet','elite_quota'];
/** Boss signature themes: one per top-tier boss, ONLY ever played in that boss's fight (not in any pool). `p2` plays from the first phase change. */
export const SIGNATURE:Record<string,{main:string;p2?:string}>={ recall:{main:'boss_sig_recall',p2:'boss_sig_recall_p2'}, dispatcher:{main:'boss_sig_dispatcher',p2:'boss_sig_dispatcher_p2'}, widow:{main:'boss_sig_widow',p2:'boss_sig_widow_p2'}, resonance:{main:'boss_sig_resonance'}, courier:{main:'boss_sig_courier'}, rattle:{main:'boss_sig_rattle'}, breaker:{main:'boss_sig_breaker'}, liquidator:{main:'boss_sig_liquidator'} };
export const SIG_TRACKS=Object.values(SIGNATURE).flatMap(x=>[x.main,...(x.p2?[x.p2]:[])]);
/** Pack 5: town / hub moods (neon market, rain, lounge, synth haze, night shuttle). */
export const CALM5_TOWN=['town_neonbazaar','town_raingutter','town_lounge','town_synthhaze','town_nightbus'], CALM5_HARROW=['harrow_rainworks','harrow_lounge','harrow_glowpipes','harrow_nightshift','harrow_neonforge'];
export const CALM5=[...CALM5_TOWN,...CALM5_HARROW];
Object.assign(FAMILY,{ town_neonbazaar:'pulse',town_raingutter:'noir',town_lounge:'noir',town_synthhaze:'drift',town_nightbus:'pulse',harrow_rainworks:'noir',harrow_lounge:'noir',harrow_glowpipes:'drift',harrow_nightshift:'industrial',harrow_neonforge:'pulse' });
/** pack 6: six generated tracks per world district (tools/gen_music.py WORLD6, docs/WORLD.md), lazy-loaded on first visit */
export const WORLD6_TOWNS=['neon_mile','the_stacks','salt_harbor','dust_yard','under_bazaar','aldane_spire','signal_heights','kestrel_plaza','tether_base'];
const W6M:Record<string,string>={ a:'drift',b:'drift',c:'noir',d:'pulse',e:'noir',f:'pulse' };
export const WORLD6=WORLD6_TOWNS.flatMap(t=>Object.keys(W6M).map(m=>t+'_'+m));
/** pack 7 (docs/MUSIC_DIRECTION.md): lonely/hypnotic town pieces, insistent dungeon motifs, wall-of-noise bosses, escalation stems, main theme. All lazy. */
export const TOWN7=['town_dir_vigil','town_dir_pulse','town_dir_embers','town_dir_static','town_dir_lantern','town_dir_glass','town_dir_dust','town_dir_choir','town_dir_rain','town_dir_tick','town_dir_hollow','town_dir_signal','town_dir_ash','town_dir_neon','town_dir_ascend','town_dir_watch'];
export const DUNGEON7=['calm_dir_motif','calm_dir_corridor','calm_dir_vast','calm_dir_creep'];
export const BOSS7=['boss_wall_dread','boss_wall_siege','boss_wall_storm','boss_wall_end'];
/** Escalation stems: when elite combat intensity (engaged elites near the player) stays >= ESC_LEVEL the elite track crossfades to one of these; it never plays otherwise. */
export const ESCALATE=['elite_escalate_a','elite_escalate_b']; export const ESC_LEVEL=3;
export const PACK7=[...TOWN7,...DUNGEON7,...BOSS7,...ESCALATE,'theme_main'];
Object.assign(FAMILY,{ town_dir_vigil:'noir',town_dir_pulse:'pulse',town_dir_embers:'drift',town_dir_static:'noir',town_dir_lantern:'noir',town_dir_glass:'pulse',town_dir_dust:'drift',town_dir_choir:'drift',town_dir_rain:'noir',town_dir_tick:'pulse',town_dir_hollow:'drift',town_dir_signal:'pulse',town_dir_ash:'noir',town_dir_neon:'pulse',town_dir_ascend:'drift',town_dir_watch:'industrial',theme_main:'noir',calm_dir_motif:'industrial',calm_dir_corridor:'pulse',calm_dir_vast:'drift',calm_dir_creep:'industrial' });
export const CALM_LAZY=new Set([...TOWN7,...DUNGEON7,'theme_main',...CALM2,...CALM3,...CALM4,...CALM5,...WORLD6]);
export const LAZY=new Set([...PACK7,...WORLD6,...CALM2,...CALM3,...CALM4,...CALM5,...BOSS4,...ELITE4,...ELITE2,...SIG_TRACKS]);
const T:Record<string,TrackDef>={ boss_reveal:{file:'boss_reveal',loop:false,keepPos:false}, clear:{file:'clear',loop:false,keepPos:false} };
for(const n of STINGERS) T[n]={file:n,loop:false,keepPos:false};
for(const n of [...PACK7,...LOOPS,...WORLD6,...CALM2,...CALM3,...CALM4,...CALM5,...BOSS4,...ELITE4,...ELITE2,...SIG_TRACKS]) T[n]={file:n,loop:/^(combat_|boss_|elite_)/.test(n),keepPos:/^(combat_|boss_|elite_)/.test(n)}; // calm tracks never loop: rotation crossfades out before the end (a lone track is never repeated)
/** Tracks that must load for file music to activate; the rest load best-effort and are dropped from pools when missing. */
export const CORE_TRACKS=['town','traversal_a','traversal_b','combat_a','combat_b','boss_reveal','boss_fight','clear'];
/** Per-state track pools (rotation draws from these via a shuffle bag). */
export const POOLS:Record<MState,string[]>={
  town:['town','theme_main',...TOWN7.slice(0,8),'calm_drift','calm_rust','calm_vents','town_dusk','town_market','town_neonrain','town_rooftop','town_jukebox','town_dockside','town_dawnmarket','town_lastcall','town_scrapyard',...CALM5_TOWN],
  traversal:['traversal_a','traversal_b',...DUNGEON7,'calm_neon','calm_static','calm_drift','calm_rust','calm_vents','calm_tide','calm_ghost','calm_orbit','calm_hollow','calm_relay','calm_alley','calm_conduit','calm_afterglow','calm_stasis','calm_coldopen','calm_midshift','calm_deepcut','calm_exitroute','calm_breathing','calm_wires','calm_sodium'],
  combat:['combat_a','combat_b'],
  elite:['elite_siege','elite_hunt','boss_overclock','boss_meltdown',...ELITE2,...ELITE4],
  bossreveal:['boss_reveal'],
  bosscombat:['boss_fight','boss_overclock','boss_meltdown','boss_hydraulic','elite_siege','elite_hunt','boss_lineman','boss_pitboss','boss_bellfounder','boss_cryo','boss_auditor','boss_apothecary','boss_clearance','boss_resonance','boss_liquidator','boss_courier','boss_dispatcher','boss_warrantor','boss_rattle','boss_widow','boss_recall',...BOSS4,...BOSS7],
  resolution:['clear'] };
export const TOWN_POOLS:Record<string,string[]>={ rustline:['town','theme_main',...TOWN7.slice(0,8),'calm_drift','calm_rust','calm_vents','town_dusk','town_market','town_neonrain','town_rooftop','town_jukebox','town_dockside','town_dawnmarket','town_lastcall','town_scrapyard',...CALM5_TOWN], harrow:[...TOWN7.slice(8),'harrow_forge','harrow_ember','harrow_steam','harrow_dawn','harrow_cinder','harrow_smelter','harrow_lamplight','harrow_ash','harrow_shift','harrow_whistle','harrow_chapel','harrow_mill',...CALM5_HARROW] };
for(const t of WORLD6_TOWNS) TOWN_POOLS[t]=Object.keys(W6M).map(m=>t+'_'+m);
Object.assign(FAMILY,Object.fromEntries(WORLD6.map(n=>[n,W6M[n.slice(-1)]])));
/** Run areas (manufacturer of the dungeon): tracks written for an area get double weight there and are excluded elsewhere; everything else in the traversal pool is shared. */
export const AREA_TRACKS:Record<string,string[]>={ HI:['area_hi_slag','area_hi_press','area_hi_ember','area_hi_coke','area_hi_bellring'], PS:['area_ps_sterile','area_ps_ward','area_ps_hush','area_ps_archive','area_ps_ledger'], MM:['area_mm_muzak','area_mm_aisles','area_mm_closing','area_mm_clearance','area_mm_freight'] };
/** Traversal pool for an area with weights: [track, weight]. Unknown/empty area = shared pool only. */
export function areaPool(area:string|null):[string,number][]{ const mine=(area&&AREA_TRACKS[area])||[]; const other=new Set(Object.entries(AREA_TRACKS).filter(([k])=>k!==area).flatMap(([,v])=>v)); return [...POOLS.traversal.filter(t=>!other.has(t)&&!mine.includes(t)).map(t=>[t,1] as [string,number]),...mine.map(t=>[t,2] as [string,number])]; }
/** Boss id -> fixed fight track, so each boss has its own identity (unmapped bosses draw from the pool). */
import { BOSSES } from './content/batch1_bosses';
import { Q } from './quality';
export const BOSS_MAP:Record<string,string>={ ...Object.fromEntries(BOSSES.map(b=>[b.id,b.track])), overseer:'boss_fight', warden:'boss_overclock', enforcer:'boss_meltdown', teague:'boss_hydraulic', brannoch:'boss_meltdown', ore9:'boss_fight', surgeon:'boss_overclock', autosurgeon:'boss_hydraulic', recovered:'boss_fight', stockmgr:'boss_meltdown', retrieval:'boss_overclock', reclaimer:'boss_hydraulic' };
/** Relative intensity of each hard track (1 lightest .. 4 maximum); drives playlist building and phase escalation. */
export const INTENSITY:Record<string,number>={ elite_siege:1,elite_hunt:1,boss_lineman:1,boss_pitboss:1, boss_fight:2,boss_hydraulic:2,boss_bellfounder:2,boss_cryo:2,boss_auditor:2,boss_apothecary:2,boss_clearance:2, boss_overclock:3,boss_meltdown:3,boss_resonance:3,boss_liquidator:3,boss_courier:3,boss_dispatcher:3,boss_warrantor:3,boss_rattle:3,boss_widow:3, boss_recall:4, boss_tarpit:1,boss_rivet:1,boss_ledgerman:1, boss_cinder:2,boss_vigil:2,boss_static_choir:2,boss_gearwork:2,boss_tollroad:2,boss_marrow:2, boss_hammerfall:3,boss_siren:3,boss_glitchking:3,boss_dirge:3,boss_overload:3,boss_ironchoir:3, boss_apex:4,boss_cataclysm:4,boss_endshift:4,boss_zero:4, boss_wall_dread:2,boss_wall_siege:3,boss_wall_storm:3,boss_wall_end:4 };
/** Boss tier (1 easiest .. 4 hardest): batch-1 bosses carry it in their data; the original dungeon bosses are all starter-tier (1). */
export const bossTier=(id:string|null):number=>{ const b=id?BOSSES.find(x=>x.id===id):null; return b?b.tier:1; };
/** Weighted boss pool for a tier: every boss-pool track is in, tracks whose intensity is near the tier's get more slots (distance 0: 3, 1: 2, 2+: 1). */
export function bossPool(tier:number):[string,number][]{ const tg=Math.min(4,Math.max(1,tier)); return POOLS.bosscombat.map(t=>[t,Math.abs((INTENSITY[t]||2)-tg)===0?3:Math.abs((INTENSITY[t]||2)-tg)===1?2:1] as [string,number]); }
/** Shuffle bag: every item once per cycle (weight n = n slots per cycle), never the same item twice in a row (also across cycle refills and, with a storage key, across sessions: bag contents + last track persist in localStorage). */
export class ShuffleBag{ private bag:string[]=[]; last:string|null=null; items:string[]; private w:Record<string,number>={};
  constructor(items:string[]|[string,number][], private rnd:()=>number=Math.random, private storeKey:string|null=null){ this.items=[]; for(const it of items){ const [n,w]=Array.isArray(it)?it:[it,1]; this.items.push(n); this.w[n]=w; } this.restore(); }
  private store(){ const ls:any=(globalThis as any).localStorage; return ls||null; }
  private restore(){ if(!this.storeKey) return; try{ const raw=this.store()?.getItem(this.storeKey); if(!raw) return; const d=JSON.parse(raw); if(Array.isArray(d.bag)) this.bag=d.bag.filter((x:any)=>this.items.includes(x)); if(typeof d.last==='string') this.last=d.last; }catch{} }
  private save(){ if(!this.storeKey) return; try{ this.store()?.setItem(this.storeKey,JSON.stringify({bag:this.bag,last:this.last})); }catch{} }
  private fill(items:string[]){ const slots:string[]=[]; for(const n of items) for(let k=0;k<(this.w[n]||1);k++) slots.push(n);
    for(let tries=0;tries<40;tries++){ for(let i=slots.length-1;i>0;i--){ const j=Math.floor(this.rnd()*(i+1)); [slots[i],slots[j]]=[slots[j],slots[i]]; } let bad=false; if(slots[slots.length-1]===this.last) bad=true; for(let i=1;i<slots.length&&!bad;i++) if(slots[i]===slots[i-1]) bad=true; if(!bad) break; } // pop() takes from the end, so the end must not equal last
    this.bag=slots; }
  next(avail?:(n:string)=>boolean):string{ const items=avail?this.items.filter(avail):this.items; if(!items.length) return this.items[0]; if(items.length===1){ this.last=items[0]; return items[0]; }
    this.bag=this.bag.filter(x=>items.includes(x));
    if(!this.bag.length) this.fill(items);
    let n=this.bag.pop()!; if(n===this.last){ const k=this.bag.findIndex(x=>x!==this.last); if(k>=0){ const o=this.bag.splice(k,1)[0]; this.bag.push(n); n=o; } else { const o=items.find(x=>x!==this.last)!; this.bag.push(n); n=o; } }
    this.last=n; this.save(); return n; } }
export interface FadeEvent { t:number; from:string|null; to:string|null; dur:number; state:MState }
interface Live { name:string; src:AudioBufferSourceNode; gain:GainNode; startedAt:number; offset:number; ending:boolean }

/** Decoded PCM is ~50 MB per 146 s stereo track, so by default only a handful are ever decoded at once (current + fading-out + next + a few hot ones); everything else is re-fetched from the HTTP/SW cache on demand.
 *  Tests that need every track resident set window.__WV_MUSIC_ALL = 1 before load (restores the old preload-everything behaviour). */
const ALL=()=>!!(globalThis as any).__WV_MUSIC_ALL;
export class MusicManager {
  buffers:Record<string,AudioBuffer>={}; ready=false; loading=false; live:Live[]=[]; pos:Record<string,number>={};
  state:MState|null=null; want:MState='town'; cur:string|null=null; bags:Partial<Record<MState,ShuffleBag>>={}; key:string|null=null; fromTown=true; ROTATE_LOOPS=1; ROTATE_FADE=3; CALM_FADE=7; calmDwell=120; NUDGE_MIN=45; rnd:()=>number=Math.random; hist:string[]|null=null; area:string|null=null; nextUp:Record<string,string>={};
  enteredAt=0; lastSwitchAt=0; phase=0; PHASE_MIN=20; leaveSince=-1; log:FadeEvent[]=[]; timer:any=null; onReady:(()=>void)|null=null;
  HARD_MIN=45; HARD_EXIT_HOLD=10; CALM_MIN=90; CALM_MAX=150; /* calm dwell is jittered in [CALM_MIN, CALM_MAX] per track */ HARD_ROTATE=300; counts={calm:0,hard:0,phase:0,total:0,entries:0}; resetCounts(){ this.counts={calm:0,hard:0,phase:0,total:0,entries:0}; } // hysteresis (seconds): min time on a hard track; calm required before leaving it; min time on a calm track before it rotates
  constructor(private ctx:AudioContext, private out:AudioNode, private base='audio/music/'){ if(typeof document!=='undefined') document.addEventListener('visibilitychange',()=>{ if(document.hidden){ this.hideT=setTimeout(()=>{ if(document.hidden) this.dropIdle(); },20000); } else { clearTimeout(this.hideT); } }); }
  private hideT:any=0;
  isReady(){ return this.ready; }
  private getTrack:((d:TrackDef)=>Promise<void>)|null=null; private asked=new Set<string>();
  /** constrained devices skip the preload of variety tracks (decoded PCM is ~10x the mp3); fetch just the track that is about to be needed */
  askedAt:Record<string,number>={};
  ensure(file:string){ const d=Object.values(T).find(x=>x.file===file); if(!d||this.buffers[file]||!this.getTrack) return; if(this.asked.has(file)){ if(performance.now()-(this.askedAt[file]||0)<8000) return; } /* a request that has not landed after 8 s is retried (stalled fetch) */ this.askedAt[file]=performance.now(); if(typeof document!=='undefined'&&document.hidden&&!this.pend) return; /* no background decoding while the tab is hidden */ this.asked.add(file); this.getTrack(d).then(()=>this.trim()).catch(()=>{ this.asked.delete(file); this.failed.add(file); if(this.pend?.name===file){ this.pend=null; this.lastSwitchAt=-1e9; } /* missing file: drop it from calm picks and rotate on to another track */ }); }
  async load(){ if(this.loading||this.ready) return; this.loading=true;
    try{ const get=async(d:TrackDef)=>{ const r=await fetch(this.base+d.file+'.mp3'); if(!r.ok) throw new Error(d.file+' '+r.status); const ab=await r.arrayBuffer(); this.buffers[d.file]=await this.ctx.decodeAudioData(ab); };
      this.getTrack=get;
      if(ALL()){ await Promise.all(Object.values(T).filter(d=>CORE_TRACKS.includes(d.file)).map(get)); if(this.want!=='traversal'){ const f=this.planFirst(); await get(T[f]).catch(()=>{ delete this.nextUp[this.bagKey('town')]; }); } }
      else { const first=this.want==='traversal'?'traversal_a':this.planFirst(); try{ await get(T[first]); }catch{ delete this.nextUp[this.bagKey('town')]; await get(T.town); } } // boot decodes ONE track: a random first town track drawn from the persisted bag (never a fixed intro); everything else is lazy
      this.ready=true; this.timer=setInterval(()=>this.tick(),250); this.onReady?.(); if(ALL()&&Q.p.musicVariety) Promise.all(Object.values(T).filter(d=>!CORE_TRACKS.includes(d.file)&&!LAZY.has(d.file)).map(d=>get(d).catch(()=>{}))); } // variety tracks stream in after start
    catch(e){ console.warn('music files unavailable, using procedural fallback',e); this.loading=false; } }
  now(){ return this.ctx.currentTime; }
  // Game-facing: request a state. Hysteresis is applied in tick().
  setState(s:MState,key?:string|null){ this.want=s; if(key!==undefined){ if(key!==this.key) this.fightNext=null; this.key=key; }
    if((s==='bossreveal'||s==='bosscombat')&&!this.fightNext&&this.state!=='bosscombat') this.planFight(); // choose (and start fetching) the fight track during the reveal, so the fight fades in on time
    if((!Q.p.musicVariety||!ALL())&&(s==='combat'||s==='elite'||s==='traversal')){ for(const f of POOLS[s].slice(0,2)) this.ensure(f); } this.tick(); }
  /** Boss fight track: a signature boss always gets its own theme; everyone else draws from the whole boss pool through a persistent, tier-weighted shuffle bag (never the last hard track played). */
  fightNext:string|null=null; sig:{main:string;p2?:string}|null=null; p2done=false; phasePend:{name:string}|null=null; bossBags:Record<number,ShuffleBag>={};
  bossBag(tier:number){ return this.bossBags[tier]??=new ShuffleBag(bossPool(tier),Math.random,'wv_music_boss:t'+tier); }
  planFight(){ const sg=this.key?SIGNATURE[this.key]:undefined; let n:string; if(sg) n=sg.main; else { const b=this.bossBag(bossTier(this.key)); n=b.next(this.fresh(b.items,x=>x!==this.lastHard)); this.fightBag=b; } this.fightNext=n; this.ensure(n); if(sg?.p2) this.hold.add(sg.p2); }
  hold=new Set<string>();
  /** Pick the next track for a state: boss key mapping if known, else the state's shuffle bag (no immediate repeat). */
  /** Shuffle-bag key per state (persisted in localStorage, so rotation order survives reloads/sessions). */
  bagKey(s:MState){ return s==='town'?'town:'+this.townId:s==='traversal'?'trav:'+(this.area||'-'):s; }
  bagFor(s:MState):ShuffleBag{ const k=this.bagKey(s); let b=this.bags[k as MState]; if(!b){ const items=s==='traversal'?areaPool(this.area):POOLS[s]; b=this.bags[k as MState]=new ShuffleBag(items,Math.random,'wv_music_bag:'+k); } return b; }
  /** No intro lock: the first town track of every session / town entry is a random draw from the persisted shuffle bag + recent history. Queued as nextUp so boot decodes exactly it. */
  planFirst():string{ const k=this.bagKey('town'); const nu=this.nextUp[k]; if(nu&&T[nu]&&!this.failed.has(nu)) return nu; const n=this.chooseCalm(this.bagFor('town'),x=>!!T[x]&&!this.failed.has(x)&&x!==this.cur); this.nextUp[k]=n; return n; }
  failed=new Set<string>(); /** set by enter() for a real town entry (boot / back from a run), not for rotation or the ended-track safety re-entry */ townEntry=false; wasTown=false;
  pick(s:MState):string{ const have=(n:string)=>!!this.buffers[n];
    if(s==='bosscombat'){ if(!this.fightNext) this.planFight(); const r=this.fightNext!; this.fightNext=null; delete this.nextUp.boss; this.sig=this.key?SIGNATURE[this.key]||null:null; this.p2done=false; this.setHard(r); return r; }
    const pool=POOLS[s]; if(pool.length===1) return pool[0];
    if(s==='elite'){ const nu=this.nextUp.elite; if(nu&&have(nu)&&nu!==this.lastHard){ delete this.nextUp.elite; this.setHard(nu); return nu; } const bg=this.bagFor(s); const r=bg.next(this.fresh(bg.items,x=>have(x)&&x!==this.lastHard)); this.setHard(r); return r; } // hard entry is never gated: only decoded tracks are picked (lazy ones are prefetched in the background during runs)
    if(s==='town'&&this.townEntry){ this.townEntry=false; const n=this.planFirst(); delete this.nextUp[this.bagKey('town')]; return n; } // every town ENTRY draws a random track from the persisted bag (may still be decoding: crossfade() keeps the old track until it is ready)
    const calm=s==='town'||s==='traversal'; if(calm){ const k=this.bagKey(s), nu=this.nextUp[k]; if(nu&&have(nu)){ delete this.nextUp[k]; return nu; } }
    return this.chooseCalm(this.bagFor(s),have); }
  /** Last N calm tracks played (persisted, so a new session does not repeat what just played). */
  HIST_N=8;
  history():string[]{ if(!this.hist){ try{ this.hist=JSON.parse((globalThis as any).localStorage?.getItem('wv_music_calm_hist')||'[]'); }catch{ this.hist=[]; } if(!Array.isArray(this.hist)) this.hist=[]; } return this.hist!; }
  private noteCalm(n:string){ const h=this.history(); const i=h.indexOf(n); if(i>=0) h.splice(i,1); h.push(n); while(h.length>this.HIST_N) h.shift(); try{ (globalThis as any).localStorage?.setItem('wv_music_calm_hist',JSON.stringify(h)); }catch{} }
  /** Draw from a calm bag preferring (1) a different mood family than what is playing and (2) not in the recent history; relaxes both when the pool is too small. */
  private chooseCalm(bag:ShuffleBag,base:(x:string)=>boolean):string{ const cf=this.cur?FAMILY[this.cur]:undefined, h=this.history(); const levels:((x:string)=>boolean)[]=[x=>(!cf||FAMILY[x]!==cf)&&!h.includes(x),x=>!h.includes(x),x=>!cf||FAMILY[x]!==cf,()=>true];
    for(const lv of levels){ if(bag.items.some(x=>base(x)&&lv(x))) return bag.next(x=>base(x)&&lv(x)); } return bag.next(base); }
  /** Natural trigger (new zone, level-up, ...): a calm track that has played >= NUDGE_MIN s is due to change soon. */
  sbuf:Record<string,AudioBuffer>={}; lastSting=-1e9;
  /** One-shot stinger (level-up, rare loot, run complete, death) layered over the current music; rate-limited, lazy fetched, ~1 MB decoded. */
  async stinger(name:string){ if(!this.ready||!STINGERS.includes(name)) return; const n=performance.now(); if(n-this.lastSting<4000) return; this.lastSting=n;
    try{ let b=this.sbuf[name]; if(!b){ const r=await fetch(this.base+name+'.mp3'); if(!r.ok) return; b=this.sbuf[name]=await this.ctx.decodeAudioData(await r.arrayBuffer()); } const src=this.ctx.createBufferSource(); src.buffer=b; const g=this.ctx.createGain(), ct=this.ctx.currentTime; g.gain.setValueAtTime(0,ct); g.gain.linearRampToValueAtTime(.8,ct+.05); src.connect(g); g.connect(this.out); src.start(ct); }catch{} }
  nudge(){ if(this.state!=='town'&&this.state!=='traversal') return; const t=this.now(); this.calmDwell=Math.min(this.calmDwell,Math.max(this.NUDGE_MIN,t-this.lastSwitchAt)); }
  /** Pick (and start fetching) the track that follows the current calm one so a rotation never waits on the network. */
  private prefetch(s:MState){ if(s!=='town'&&s!=='traversal'&&s!=='elite') return; const k=this.bagKey(s); if(this.nextUp[k]&&this.nextUp[k]!==this.cur) { this.ensure(this.nextUp[k]); return; } const bag=this.bagFor(s); const n=s==='elite'?bag.next(x=>x!==this.cur):this.chooseCalm(bag,x=>x!==this.cur); this.nextUp[k]=n; this.ensure(n); }
  /** Set the run area (dungeon manufacturer HI/PS/MM) for per-area weighting of the exploration pool; applies to the next pick. */
  setArea(a:string|null){ if(a===this.area) return; this.area=a; }
  fightBag:ShuffleBag|null=null; retry=false;
  /** Called when the player dies / resets a boss fight: the next boss engagement is a retry and must not restart the track that just played. */
  noteRetry(){ this.retry=true; }
  /** last hard (elite/boss) track played, persisted: a death/retry/new session never restarts the same one. */
  get lastHard():string|null{ if(this._lh===undefined){ try{ this._lh=((globalThis as any).localStorage?.getItem("wv_music_lasthard")||null) as string|null; }catch{ this._lh=null; } } return this._lh as string|null; } private _lh:string|null|undefined=undefined;
  /** Recent hard (boss/elite) tracks, persisted: new fights/phases prefer tracks outside the last HARD_HIST so a track is not replayed until most others have played. */
  HARD_HIST=14; hh:string[]|null=null;
  hardHist():string[]{ if(!this.hh){ try{ this.hh=JSON.parse((globalThis as any).localStorage?.getItem('wv_music_hardhist')||'[]'); }catch{ this.hh=[]; } if(!Array.isArray(this.hh)) this.hh=[]; } return this.hh!; }
  setHard(n:string){ this._lh=n; try{ (globalThis as any).localStorage?.setItem('wv_music_lasthard',n); }catch{} const h=this.hardHist(); const i=h.indexOf(n); if(i>=0) h.splice(i,1); h.push(n); while(h.length>this.HARD_HIST) h.shift(); try{ (globalThis as any).localStorage?.setItem('wv_music_hardhist',JSON.stringify(h)); }catch{} }
  /** Prefer tracks outside the recent hard history (relaxes when too few remain). */
  fresh(items:string[],ok:(x:string)=>boolean):((x:string)=>boolean){ const h=this.hardHist(); const f=(x:string)=>ok(x)&&!h.includes(x); return items.some(f)?f:ok; }
  townId='rustline';
  /** Switch the calm town pool (Rustline vs Harrow Reach). Crossfades immediately when currently in town. */
  setTownTheme(id:string){ const pool=TOWN_POOLS[id]||TOWN_POOLS.rustline; POOLS.town.splice(0,POOLS.town.length,...pool); /* always sync the shared pool (another manager may have switched it) */ if(id===this.townId) return; this.townId=id; delete this.bags['town:'+id as MState]; delete this.nextUp['town:'+id]; if(!this.ready) return;
    if(this.state==='town'||this.want==='town'){ const t=this.now(); const nx=this.planFirst(); delete this.nextUp[this.bagKey('town')]; this.lastSwitchAt=t; this.enteredAt=t; if(this.buffers[nx]) this.crossfade(nx,3,'town'); else if(this.state==='town') this.pend={name:nx,dur:3,s:'town',at:t}; } }
  /** Boss phase change / enrage: switch to a more intense track from the boss playlist (after PHASE_MIN s on the current one). */
  onPhase(n:number){ if(n<=this.phase){ this.phase=n; return; } this.phase=n; this.phaseDue=true; this.applyPhase(); }
  phaseDue=false;
  /** A phase change is never dropped: if it lands within PHASE_MIN of the last switch it fires as soon as that has elapsed. */
  private applyPhase(){ if(!this.phaseDue||this.state!=='bosscombat'||!this.ready) return; const t=this.now(); if(t-this.lastSwitchAt<this.PHASE_MIN) return; this.phaseDue=false;
    let nx:string|null=null; const sg=this.sig;
    if(sg){ if(sg.p2&&!this.p2done&&this.cur!==sg.p2) nx=sg.p2; else return; } // signature bosses keep their own theme; the phase-two variant (if any) takes over once
    else { const ci=INTENSITY[this.cur||'']||2; const hh=this.hardHist(); let c=POOLS.bosscombat.filter(x=>x!==this.cur&&x!==this.lastHard); { const c2=c.filter(x=>!hh.includes(x)); if(c2.length>=2) c=c2; } const higher=c.filter(x=>(INTENSITY[x]||2)>ci), pool=higher.length?higher:c.filter(x=>(INTENSITY[x]||2)>=ci); if(!pool.length) return;
      const lo=Math.min(...pool.map(x=>INTENSITY[x]||2)); const g=pool.filter(x=>(INTENSITY[x]||2)===lo); nx=g[Math.floor(Math.random()*g.length)]; }
    if(!this.buffers[nx]){ this.ensure(nx); this.phasePend={name:nx}; return; } this.doPhase(nx); }
  private doPhase(nx:string){ const t=this.now(); this.phasePend=null; this.lastSwitchAt=t; this.counts.phase++; this.counts.hard++; this.counts.total++; this.crossfade(nx,2,'bosscombat'); if(this.sig&&nx===this.sig.p2) this.p2done=true; if(this.fightBag) this.fightBag.last=nx; this.setHard(nx); }
  tick(){ if(!this.ready) return; const t=this.now(); this.flushPending(t); this.tailGuard(t); if((this.state==='town'||this.state==='traversal')&&this.want===this.state&&!this.pend&&this.leaveSince<0&&!this.live.some(l=>!l.ending)){ const st=this.state; this.state=null; this.enter(st); return; } // safety: a calm track ended with nothing queued -> start the next one
    this.applyPhase(); if(this.phasePend){ if(this.state!=='bosscombat') this.phasePend=null; else if(this.buffers[this.phasePend.name]&&this.phasePend.name!==this.cur) this.doPhase(this.phasePend.name); else this.ensure(this.phasePend.name); }
    if(this.state==='bosscombat'&&this.sig?.p2&&!this.p2done) this.ensure(this.sig.p2); let tgt=this.want;
    const hard=(s:MState|null)=>s==='elite'||s==='bosscombat'||s==='combat';
    if(hard(this.state)&&tgt==='traversal'){ // (town return is explicit and not held) hold hard music: min dwell + sustained calm (exit delay) before fading back to calm
      if(this.leaveSince<0) this.leaveSince=t; if(t-this.enteredAt<this.HARD_MIN||t-this.leaveSince<this.HARD_EXIT_HOLD) tgt=this.state!; }
    else this.leaveSince=-1;
    this.escalate(t);
    if(tgt===this.state){ const k=this.state==='town'||this.state==='traversal'?this.bagKey(this.state):null; if(k&&this.nextUp[k]) this.ensure(this.nextUp[k]); this.maybeRotate(t); return; }
    if(tgt==='bosscombat'&&this.state!=='bossreveal'){ this.phase=0; this.phaseDue=false; } if(tgt==='bosscombat'&&this.state!=='bossreveal'&&!this.fightNext) this.planFight(); // new fight (a reveal->fight handoff keeps the phase)
    this.enter(tgt); }
  /** Calm states rotate to the next pool track after ROTATE_LOOPS full loops; the fade starts so it lands on the loop boundary. */
  private maybeRotate(t:number){ const hard=this.state==='elite'||this.state==='bosscombat'; if(!hard&&this.state!=='town'&&this.state!=='traversal') return; if(this.state==='bosscombat'&&this.sig) return; // signature fights never rotate
    const l=this.live.find(x=>!x.ending); if(!l) return; const b=this.buffers[l.name]; if(!b) return; const tail=!hard&&(l.offset+(t-l.startedAt))>b.duration-(this.CALM_FADE+2); // calm track nearly over: rotate now so it never ends or loops
    if(hard? t-this.lastSwitchAt<this.HARD_ROTATE : (!tail&&t-this.lastSwitchAt<this.calmDwell)) return; if(!hard&&(this.want!==this.state||this.leaveSince>=0)) return;
    if(hard){ const played=l.offset+(t-l.startedAt); if(played<b.duration-this.ROTATE_FADE) return; } // hard fights rotate (rarely) at a loop boundary; calm tracks crossfade mid-track after their jittered dwell
    if(!hard){ const k=this.bagKey(this.state!); if(!this.nextUp[k]) this.prefetch(this.state!); if(!this.buffers[this.nextUp[k]]&&!tail&&t-this.lastSwitchAt<this.calmDwell+15) return; }
    let n:string; if(this.state==='bosscombat'){ const bag=this.fightBag??=this.bossBag(bossTier(this.key)); let nu=this.nextUp.boss; if(!nu||nu===l.name) nu=this.nextUp.boss=bag.next(x=>x!==l.name); this.ensure(nu); if(!this.buffers[nu]) return; delete this.nextUp.boss; n=nu; this.setHard(n); } else n=this.pick(this.state!);
    if(n===l.name) return; this.lastSwitchAt=t; this.counts.total++; if(hard) this.counts.hard++; else this.counts.calm++; this.crossfade(n,hard?this.ROTATE_FADE:this.CALM_FADE,this.state!); }
  pend:{name:string;dur:number;s:MState;at:number}|null=null;
  /** Entering hard music is never gated by dwell/cooldowns. If the wanted track isn't decoded yet it is fetched and started the moment it loads (any decoded hard track after 4 s). */
  private flushPending(t:number){ const p=this.pend; if(!p) return; if(this.state!==p.s){ this.pend=null; return; } let n=p.name; if(!this.buffers[n]){ this.ensure(n); if(t-p.at<4) return; const alt=POOLS[p.s].find(x=>this.buffers[x])||(p.s==='bosscombat'&&this.buffers.boss_fight?'boss_fight':''); if(!alt) return; n=alt; } this.pend=null; this.counts.entries++; this.crossfade(n,p.dur,p.s); }
  private enter(s:MState){ const prev=this.state; if(s==='resolution'||s==='town') this.retry=false; if(s!=='bossreveal'&&s!=='bosscombat'){ this.phaseDue=false; this.fightNext=null; this.sig=null; this.phasePend=null; delete this.nextUp.boss; this.hold.clear(); } const t=this.now(); this.townEntry=s==='town'&&prev!=='town'&&!(prev===null&&this.wasTown); this.wasTown=s==='town'; this.state=s; this.enteredAt=t; this.lastSwitchAt=t; this.leaveSince=-1; this.pend=null; const name=this.pick(s);
    let dur=2; if(s==='traversal'&&(prev===null||prev==='town')) dur=3; else if(s==='town') dur=3; else if(s==='bossreveal') dur=2.5; else if(s==='bosscombat') dur=1.5; else if(s==='resolution') dur=4; else if(s==='combat'||s==='elite') dur=1.5; else if(prev==='resolution') dur=2.5; else if(s==='traversal'&&(prev==='elite'||prev==='bosscombat'||prev==='combat'||prev==='bossreveal')) dur=4;
    if(!this.buffers[name]&&(s==='elite'||s==='bosscombat')){ this.ensure(name); this.pend={name,dur,s,at:t}; return; }
    if(s==='elite'||s==='bosscombat') this.counts.entries++; this.crossfade(name,dur,s,s==='resolution'?1.5:dur); }
  /** Equal-power crossfade: the old track(s) fade out over `dur`, the new one fades in over `inDur` (default `dur`). If the new track is not decoded yet the old one keeps playing untouched and the whole crossfade starts the moment the new one is ready (no silence gap, no abrupt start). */
  crossfade(name:string|null,dur:number,s:MState,inDur:number=dur){ const t=this.now();
    if(name&&!this.buffers[name]){ this.pend={name,dur,s,at:t}; this.ensure(name); return; } // track not decoded yet: fade in once ready
    const out=this.live.filter(l=>!l.ending);
    for(const l of out){ l.ending=true; this.savePos(l,t); const g=l.gain.gain; g.cancelScheduledValues(t); const v=g.value; try{ g.setValueAtTime(v,t); }catch{} this.curve(g,v,0,t,dur); l.src.stop(t+dur+.05); setTimeout(()=>{ this.live=this.live.filter(x=>x!==l); this.evict(l.name); },(dur+.2)*1000); }
    this.log.push({t,from:this.cur,to:name,dur,state:s}); this.cur=name; if(!name) return; this.usedAt[name]=performance.now();
    const d=T[name], buf=this.buffers[name]; const src=this.ctx.createBufferSource(); src.buffer=buf; src.loop=d.loop; const gain=this.ctx.createGain(); gain.gain.value=0; src.connect(gain); gain.connect(this.out);
    let off=d.keepPos?(this.pos[name]||0):0; if(off>=buf.duration-1) off=0; src.start(t,off); this.curve(gain.gain,0,1,t,inDur);
    if(!d.loop){ const rem=buf.duration-off, fd=Math.min(1.5,Math.max(.2,(rem-inDur)/2)); if(rem-fd>inDur) this.curve(gain.gain,1,0,t+rem-fd,fd); } // one-shots (reveal, clear) fade out before their natural end: never a hard cut
    const l:Live={name,src,gain,startedAt:t,offset:off,ending:false}; this.live.push(l); if(s==='town'||s==='traversal'){ this.noteCalm(name); this.calmDwell=this.CALM_MIN+this.rnd()*(this.CALM_MAX-this.CALM_MIN); } if(s==='bosscombat'&&!this.sig&&this.fightBag&&!this.nextUp.boss){ this.nextUp.boss=this.fightBag.next(x=>x!==name); this.ensure(this.nextUp.boss); } if(s==='town'||s==='traversal'||s==='elite'){ this.prefetch(s); if(s==='traversal') this.prefetch('elite'); } }
  /** Lazy tracks are decoded PCM (~50 MB each): drop them once faded out unless they are current or queued next (re-fetched from the HTTP cache when needed). */
  private evict(n:string){ if(!this.evictable(n)) return; delete this.buffers[n]; this.asked.delete(n); this.trim(); }
  private evictable(n:string){ if(ALL()&&!CALM_LAZY.has(n)) return false; return n!==this.cur&&!this.live.some(x=>x.name===n)&&!Object.values(this.nextUp).includes(n)&&this.pend?.name!==n&&this.fightNext!==n&&this.phasePend?.name!==n&&!(this.sig&&this.state==='bosscombat'&&this.hold.has(n)); }
  /** max decoded tracks kept (each ~50 MB PCM): High 5, Medium/Low 3 */
  get maxDecoded(){ return ALL()?1e9:Q.tier==='high'?5:3; }
  /** drop the least-recently-used decoded tracks beyond the cap (never current / fading / queued / pending) */
  trim(){ const ks=Object.keys(this.buffers); if(ks.length<=this.maxDecoded) return; const cand=ks.filter(k=>this.evictable(k)).sort((a,b)=>(this.usedAt[a]||0)-(this.usedAt[b]||0)); for(const k of cand){ if(Object.keys(this.buffers).length<=this.maxDecoded) break; delete this.buffers[k]; this.asked.delete(k); } }
  usedAt:Record<string,number>={};
  /** free every decoded track that is not playing (memory pressure / tab hidden) */
  dropIdle(){ for(const k of Object.keys(this.buffers)) if(this.evictable(k)){ delete this.buffers[k]; this.asked.delete(k); } }
  private savePos(l:Live,t:number){ const d=T[l.name]; if(!d.keepPos) return; const b=this.buffers[l.name]; this.pos[l.name]=(l.offset+(t-l.startedAt))%b.duration; }
  // equal-power (cos/sin) fade curve
  private curve(p:AudioParam,a:number,b:number,t:number,dur:number){ const n=32, c=new Float32Array(n); for(let i=0;i<n;i++){ const x=i/(n-1); c[i]=a<b?Math.sin(x*Math.PI/2)*(b-a)+a:Math.cos(x*Math.PI/2)*(a-b)+b; } try{ p.setValueCurveAtTime(c,t,dur); }catch{ p.linearRampToValueAtTime(b,t+dur); } }
  /** Combat intensity 0..n (engaged elites near the player). Sustained >= ESC_LEVEL in elite combat crossfades to an escalation stem (prefetched at level ESC_LEVEL-1); dropping back to <= 1 for 6 s returns to the pool. */
  intensity=0; escAt=-1; calmAt=-1; escFrom:string|null=null;
  setIntensity(n:number){ this.intensity=n; if(this.state==='elite'&&n>=ESC_LEVEL-1) this.ensure(ESCALATE[0]); }
  private escalate(t:number){ if(this.state!=='elite'){ this.escAt=-1; this.escFrom=null; return; } const on=ESCALATE.includes(this.cur||'');
    if(!on){ if(this.intensity>=ESC_LEVEL){ if(this.escAt<0) this.escAt=t; if(t-this.escAt>=3){ const n=ESCALATE.find(x=>this.buffers[x]&&x!==this.lastEsc); if(n){ this.escFrom=this.cur; this.lastEsc=n; this.escAt=-1; this.lastSwitchAt=t; this.crossfade(n,2,'elite'); } else this.ensure(ESCALATE[1]); } } else this.escAt=-1; return; }
    if(this.intensity<=1){ if(this.calmAt<0) this.calmAt=t; if(t-this.calmAt>=6&&this.escFrom&&this.buffers[this.escFrom]){ this.calmAt=-1; this.lastSwitchAt=t; this.crossfade(this.escFrom,3,'elite'); this.escFrom=null; } } else this.calmAt=-1; }
  lastEsc:string|null=null;
  /** Never hard-stop: a non-looping track within 3.5 s of its end that nothing has faded out yet is ramped to silence by its last sample (the safety re-entry in tick() then starts the next calm track). */
  tailGuard(t:number){ for(const l of this.live){ if(l.ending||T[l.name]?.loop) continue; const b=this.buffers[l.name]; if(!b) continue; const left=b.duration-(l.offset+(t-l.startedAt)); if(left>3.5) continue; l.ending=true; const g=l.gain.gain, ct=this.ctx.currentTime; try{ g.cancelScheduledValues(ct); g.setValueAtTime(g.value,ct); g.linearRampToValueAtTime(0,ct+Math.max(.05,left-.05)); }catch{} } }
  stopAll(dur=2){ this.state=null; this.crossfade(null,dur,'town'); }
}
