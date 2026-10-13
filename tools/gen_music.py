#!/usr/bin/env python3
"""Generate music via ElevenLabs /v1/music, post-process to loop-friendly mp3 in public/audio/music/.
Usage: ELEVENLABS_API_KEY=... python3 tools/gen_music.py [name ...] [--force] [--model=music_v2_5]
Needs ffmpeg. Raw downloads are cached in tools/.music_raw (gitignored). Existing outputs are skipped unless --force."""
import os, sys, json, subprocess, urllib.request, urllib.error, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT/'tools'/'.music_raw'; OUT = ROOT/'public'/'audio'/'music'
RAW.mkdir(exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
KEY = os.environ.get('ELEVENLABS_API_KEY')
# Model for NEW generations (--model music_v1|music_v2|music_v2_5 or MUSIC_MODEL). Default music_v2_5; tracks already shipped are only regenerated when named with --force.
MODEL = next((a.split('=',1)[1] for a in sys.argv if a.startswith('--model=')), os.environ.get('MUSIC_MODEL', 'music_v2_5'))
NEG = "vocals, singing, lyrics, speech, pop, cheerful, orchestral strings, rock guitar"
# name: (seconds, loop?, prompt)
TRACKS = {
 'town': (75, True, "Unobtrusive lo-fi trance and techno ambient loop, 108 bpm, instrumental. Softened analog synth pads, degraded tape texture, muted soft kick, sparse hypnotic motif, dusty industrial cyberpunk settlement, melancholic, steady, minimal, leaves space for environmental detail, no big drops, constant energy, seamless loop."),
 'traversal_a': (75, True, "Lo-fi trance techno exploration loop, 118 bpm, instrumental. Restrained repetitive arpeggio, muted percussion, filtered saw pads, degraded textures, subtle tension, bleak industrial cyberpunk, minor key, sparse motifs, no big drops, steady energy, seamless loop."),
 'traversal_b': (75, True, "Dark lo-fi techno stealth loop, 122 bpm, instrumental. Pulsing muted bassline, soft hi-hats, glassy detuned synth stabs, noisy tape hiss, quiet tension, bleak industrial cyberpunk, minimal, restrained, steady energy, seamless loop."),
 'combat_a': (75, True, "Aggressive drum and bass, 174 bpm, instrumental. Heavy forceful growling reese bassline, driving breakbeat percussion with hard snares, dark industrial cyberpunk, gritty distortion, relentless energy, steady intensity throughout, no breakdown, seamless loop."),
 'combat_b': (75, True, "Heavy neurofunk drum and bass, 174 bpm, instrumental. Punchy rolling sub bass with mechanical metallic bass hits, driving percussion, ghost-note snares, dark industrial, steady intensity throughout, no breakdown, seamless loop."),
 'boss_reveal': (28, False, "Cinematic dark industrial boss entrance, instrumental. Starts near silence with a low mechanical drone and distant machinery, slow ominous rising tension, then introduces a menacing bass motif, sub boom hits, ends on a huge impact. No drums groove, no melody lead, tension builds the whole time."),
 'boss_fight': (80, True, "Epic menacing boss battle drum and bass, 172 bpm, instrumental. Massive distorted bassline with a signature repeating bass motif, relentless driving percussion, dark industrial cyberpunk, heavy mechanical stabs, steady maximum intensity throughout, seamless loop."),
 'clear': (24, False, "Short subdued post-battle resolution, instrumental. Slow lo-fi ambient synth pads resolving from tension to calm, soft low pulse, quiet relief, degraded texture, gently fades to a near-silent end."),
 # --- variety pack (calm pool) ---
 'calm_drift': (75, True, "Slow ambient dub techno loop, 92 bpm, instrumental. Deep soft kick, washed-out chord stabs with long tape echo, warm sub pulse, drifting filtered pads, dusty industrial cyberpunk settlement at night, melancholic, spacious, minimal, no big drops, constant energy, seamless loop."),
 'calm_rust': (75, True, "Downtempo industrial trip-hop loop, 84 bpm, instrumental. Rusty metallic clanks as percussion, slow dragging beat, detuned music-box melody, low analog bass, vinyl crackle, bleak industrial cyberpunk, wistful, sparse, restrained, no big drops, steady energy, seamless loop."),
 'calm_neon': (75, True, "Dark retro synthwave ambient loop, 100 bpm, instrumental. Gentle repeating arpeggio, soft gated reverb snare, warm analog pads, distant neon-lit rain atmosphere, cyberpunk melancholy, minor key, soft and spacious, no big drops, steady energy, seamless loop."),
 'calm_vents': (75, True, "Beatless dark ambient loop, instrumental. Low ventilation hum, slow evolving drones, sparse glassy bell tones, distant machinery and dripping, faint sub swells, abandoned industrial facility, uneasy calm, very quiet dynamics, no percussion, no drops, seamless loop."),
 'calm_static': (75, True, "Minimal glitch IDM techno loop, 112 bpm, instrumental. Soft clicks and cuts, muted shuffling hi-hats, detuned FM bell motif, rubbery sub bass, tape hiss and static, cold industrial cyberpunk, introspective, restrained, no big drops, steady energy, seamless loop."),
 # --- variety pack (elite / boss pool) ---
 'elite_siege': (75, True, "Hard industrial techno elite fight loop, 150 bpm, instrumental. Pounding distorted kick, clanging metallic percussion, grinding acid bass, tense detuned stabs, dark industrial cyberpunk, menacing, steady high intensity throughout, no breakdown, seamless loop."),
 'elite_hunt': (75, True, "Dark breakbeat hardcore chase loop, 160 bpm, instrumental. Chopped aggressive breaks, snarling mid bass, ominous staccato synth riff, ticking hi-hats, dark industrial cyberpunk, predatory tension, steady high intensity throughout, no breakdown, seamless loop."),
 'boss_overclock': (80, True, "Relentless neurofunk boss battle, 174 bpm, instrumental. Twisting morphing bass, rapid-fire snares, alarm-like synth stabs, mechanical glitches, dark industrial cyberpunk, steady maximum intensity throughout, seamless loop."),
 'boss_meltdown': (80, True, "Heavy half-time industrial bass boss battle, 140 bpm, instrumental. Huge slow crushing distorted bass hits, massive drum impacts, metallic grinding, ominous low brass-like synth swells, dark cyberpunk, colossal and menacing, steady maximum intensity throughout, seamless loop."),
 'boss_hydraulic': (80, True, "Dark breakcore industrial boss battle, 180 bpm, instrumental. Frantic chopped breakbeats, hydraulic hissing and piston hits, screeching saw bass, pounding kick, dark cyberpunk, chaotic yet driving, steady maximum intensity throughout, seamless loop."),
 # --- batch-1 boss themes (15 new; tier = difficulty tier I-IV, faction flavour). See docs/AUDIO.md ---
 'boss_lineman': (75, True, "Electrical industrial techno boss battle, 138 bpm, instrumental. Humming 50 Hz mains drone, crackling arc zaps as percussion, pounding muted kick, buzzing saw bassline, tense two-note transformer motif, dark industrial cyberpunk, steady high intensity throughout, no breakdown, seamless loop."),
 'boss_pitboss': (75, True, "Heavy half-time mining industrial boss battle, 128 bpm, instrumental. Massive slow distorted kick and rock-crusher impacts, grinding gravel textures, deep rumbling sub bass, dusty low brass-like synth drone, dark cyberpunk, heavy and relentless, steady high intensity throughout, no breakdown, seamless loop."),
 'boss_bellfounder': (75, True, "Ominous foundry boss battle, 144 bpm, instrumental. Huge detuned tolling bell strikes as a repeating motif, hammered anvil percussion, roaring furnace noise swells, distorted industrial bass, dark cyberpunk, steady intense energy throughout, no breakdown, seamless loop."),
 'boss_cryo': (75, True, "Icy dark electro boss battle, 150 bpm, instrumental. Cold glassy crystalline arpeggio, cracking ice percussion, sharp clinical hi-hats, deep frozen sub bass, sterile eerie pads, dark cyberpunk, tense and precise, steady intense energy throughout, no breakdown, seamless loop."),
 'boss_auditor': (75, True, "Cold bureaucratic industrial boss battle, 156 bpm, instrumental. Rigid mechanical stamping and typewriter-like clicks as percussion, ticking clock motif, stern repeating minor-key synth riff, tight gated bass, dark cyberpunk, oppressive and exact, steady intense energy throughout, no breakdown, seamless loop."),
 'boss_apothecary': (75, True, "Toxic dark drum and bass boss battle, 170 bpm, instrumental. Warbling sickly detuned bass, bubbling and hissing gas textures, glass-tube stabs, rolling breakbeat, queasy minor-key pads, dark cyberpunk, steady intense energy throughout, no breakdown, seamless loop."),
 'boss_clearance': (75, True, "Corrupted retail muzak industrial boss battle, 160 bpm, instrumental. A warped distorted sales-floor jingle melody over pounding hard techno kick, siren-like sale-alarm synth, glitching cash-register percussion hits, dark cyberpunk, manic and menacing, steady intense energy throughout, no breakdown, seamless loop."),
 'boss_resonance': (75, True, "Experimental sound-design boss battle, 168 bpm, instrumental. Pulsing standing-wave sub bass, resonant filter sweeps, sudden dropouts into silence and back, sonar pings, sharp tuned metallic percussion, dark cyberpunk, unnerving and intense, steady high intensity throughout, seamless loop."),
 'boss_liquidator': (75, True, "Aggressive industrial hardstyle-leaning boss battle, 150 bpm, instrumental. Distorted reverse-bass kick, auction-gavel snare hits, ticking countdown synth, shouting-free menacing stabs, dark cyberpunk, ruthless, steady high intensity throughout, no breakdown, seamless loop."),
 'boss_courier': (75, True, "Fast chase boss battle, drum and bass, 176 bpm, instrumental. Rapid skittering breakbeats, swarming arpeggiated synth runs, whooshing doppler passes, growling mid bass, dark cyberpunk, frantic and relentless, steady high intensity throughout, no breakdown, seamless loop."),
 'boss_dispatcher': (75, True, "Cold machine-logic boss battle, 164 bpm, instrumental. Rigid sequenced 16th-note bass, data-bleep and modem-like percussion, automated klaxon stabs, mechanical conveyor rhythm, dark cyberpunk, relentless and robotic, steady high intensity throughout, no breakdown, seamless loop."),
 'boss_warrantor': (75, True, "Dark orchestral-industrial hybrid boss battle, 146 bpm, instrumental. Booming sealed-vault door impacts, slow menacing minor chord pulses on synth brass, heavy ledger-stamp percussion, crushing distorted bass, dark cyberpunk, grim and imposing, steady high intensity throughout, no breakdown, seamless loop."),
 'boss_rattle': (75, True, "Tense minimal dark techno boss battle, 142 bpm, instrumental. Rattling chain and shaker percussion, deep creeping sub bass, hushed breathy drones, sparse sudden stabs, claustrophobic tunnel reverb, dark cyberpunk, predatory, steady high intensity throughout, no breakdown, seamless loop."),
 'boss_widow': (75, True, "Eerie broadcast-static boss battle, 172 bpm, instrumental. Distorted radio carrier tones and shortwave static, morse-like glitchy rhythm, haunting detuned high lead, snapping snares, screeching saw bass, dark cyberpunk, unnerving and furious, steady high intensity throughout, no breakdown, seamless loop."),
 'boss_recall': (75, True, "Apocalyptic final boss battle, 176 bpm, instrumental. Colossal distorted bass with a menacing repeating signature motif, blaring recall-alarm sirens, blistering double-time breakbeats, massive impact hits, choir-free dark industrial cyberpunk, the most intense and epic track, maximum intensity throughout, no breakdown, seamless loop."),
}

# --- ambient pack 2 (calm pool, 150 s, lazy-loaded, 80 kbps). Area tags: town / harrow / HI (Harrow-Brandt industrial) / PS (Aldane surgical) / MM (Kestrel + Rustline retail/logistics) / explore ---
AMB = "instrumental, ambient, no vocals, no big drops, quiet dynamics, constant low energy, dark industrial cyberpunk, seamless loop."
CALM2 = {
 'town_dusk': "Warm slow dusk ambient for a dusty cyberpunk settlement, 70 bpm, E-flat major-ish hopeful but weary. Soft felt electric piano chords, slow breathing analog pad, distant market murmur textures, no drums, gentle sub. " + AMB,
 'town_market': "Downtempo bazaar groove for a salvage market, 96 bpm, D minor. Muted hand percussion and shaker, plucked kalimba-like synth melody, warm rounded bass, crackle, relaxed and curious. " + AMB,
 'town_neonrain': "Late-night rain on neon, 78 bpm, A minor. Soft Rhodes arpeggio, slow sidechained pad, brushed hi-hat, deep warm sub, reverb tail washes. " + AMB,
 'harrow_dawn': "Cold industrial dawn over a foundry district, 64 bpm, C major drifting to A minor. Long evolving string-like synth pad, low bell tones, distant steam hiss, slow heartbeat sub pulse, sparse. " + AMB,
 'harrow_cinder': "Smouldering embers ambient, 58 bpm, F minor. Granular crackle, warm tape-saturated drone, slow descending three-note motif on a muted vibraphone-like synth, no drums. " + AMB,
 'area_hi_slag': "Heavy-industry ambient dub, 84 bpm, G minor. Distant hammer strikes as slow percussion, resonant metal drones, deep dub bass, echoing chord stabs, hot and oppressive but calm. " + AMB,
 'area_hi_press': "Mechanical minimalism, 100 bpm, B minor. Rhythmic piston and press thuds, steady muted kick, glassy repeating two-note motif, humming transformer drone, sparse. " + AMB,
 'area_ps_sterile': "Sterile clinical ambient, 72 bpm, C# minor. Pure sine-like tones, soft glass harmonics, slow sparse piano notes, faint monitor beeps as rhythm, cold wide reverb. " + AMB,
 'area_ps_ward': "Uneasy hospital-corridor ambient, 90 bpm, E minor. Soft pulsing heartbeat-like bass, breathy filtered noise swells, detuned music-box fragments, subtle tension. " + AMB,
 'area_mm_muzak': "Hollow dead-mall muzak ambient, 88 bpm, F major but warped. Detuned elevator-music electric piano, slowed and wobbling tape, soft bossa-like brush groove, eerie and nostalgic. " + AMB,
 'area_mm_aisles': "Warehouse night-shift ambient, 110 bpm, A minor. Conveyor-like soft rhythm, forklift beeps as sparse melody, deep warm bass, sweeping fluorescent-hum pad, lonely. " + AMB,
 'calm_tide': "Slow flooded-tunnel ambient, 66 bpm, D minor. Dripping water, deep rolling sub swells, soft choral-free synth pad, occasional sonar-like ping, spacious. " + AMB,
 'calm_ghost': "Haunted signal ambient, 80 bpm, G# minor. Faded radio fragments, slow detuned pad movement, soft pulsing arpeggio buried in reverb, ghostly high harmonics. " + AMB,
 'calm_orbit': "Weightless drifting synth ambient, 74 bpm, A major-ish melancholic. Wide airy pads, slow bell arpeggio, gentle glide bass, faint satellite-like blips, no drums. " + AMB,
}
ELITE2 = {
 'elite_chrome': "Dark electro-industrial elite fight, 140 bpm, instrumental. Stomping kick, snarling distorted mid bass, metallic offbeat clangs, tense minor-key stab riff, menacing, steady high intensity throughout, no breakdown, seamless loop.",
 'elite_voltage': "Aggressive hard dubstep-leaning elite fight, 140 bpm half-time, instrumental. Electrical zap leads, wobbling distorted bass, heavy snare on 3, dark cyberpunk, steady high intensity throughout, no breakdown, seamless loop.",
 'elite_claw': "Fast dark jungle breakbeat elite fight, 168 bpm, instrumental. Chopped amen-style breaks, deep rolling sub, scratchy staccato synth stabs, predatory, steady high intensity throughout, no breakdown, seamless loop.",
 'elite_gridlock': "Rigid industrial EBM elite fight, 132 bpm, instrumental. Driving sequenced bass, pounding gated kick, clanking sheet-metal snares, cold detuned lead hook, steady high intensity throughout, no breakdown, seamless loop.",
 'elite_static': "Noisy glitch-hop industrial elite fight, 120 bpm, instrumental. Stuttering chopped vocal-free synth cuts, crunchy bit-crushed drums, growling bass, aggressive and chaotic, steady high intensity throughout, no breakdown, seamless loop.",
 'elite_ashfall': "Heavy slow doom-industrial elite fight, 100 bpm, instrumental. Enormous distorted guitar-like synth drone riff, crushing kick and snare, scorched noise, ominous, steady high intensity throughout, no breakdown, seamless loop.",
 'elite_razor': "Dark psytrance-leaning elite fight, 148 bpm, instrumental. Rolling galloping bassline, razor-sharp acid squelch, tight hats, hypnotic and relentless, steady high intensity throughout, no breakdown, seamless loop.",
 'elite_cull': "Militaristic industrial elite fight, 154 bpm, instrumental. Marching snare rolls, heavy kick, brassy synth fanfare stabs in minor, alarm tones, steady high intensity throughout, no breakdown, seamless loop.",
 'elite_sleet': "Icy dark drum and bass elite fight, 170 bpm, instrumental. Cold bright stabs, sharp rimshot snares, deep clean sub, rapid hi-hat patterns, steady high intensity throughout, no breakdown, seamless loop.",
 'elite_quota': "Relentless hard techno elite fight, 156 bpm, instrumental. Pounding rumble kick, ticking clock percussion, droning detuned saw, spoken-free stern two-chord riff, steady high intensity throughout, no breakdown, seamless loop.",
}
for _n, _p in CALM2.items(): TRACKS[_n] = (150, True, _p)
for _n, _p in ELITE2.items(): TRACKS[_n] = (75, True, _p)
LOWRATE = set(CALM2)  # long ambient tracks are encoded at 80 kbps to keep the lazy downloads small

# --- boss signature themes (one per top-tier boss, used ONLY by that boss; see docs/AUDIO.md). 150 s multi-section loops, 112 kbps ---
SIGN = "instrumental, cinematic dark industrial cyberpunk, epic and memorable, multi-section arrangement that builds from an ominous intro through a main theme to a climactic section then returns to the opening for a seamless loop, maximum intensity in the main sections."
SIG = {
 'boss_sig_recall': "Apocalyptic final boss theme, 176 bpm, D minor. Massive wordless choir chanting a repeating four-note motif over crushing distorted industrial bass, blaring recall-alarm sirens, blistering double-time breakbeats, huge brass-like synth hits, tolling bell. " + SIGN,
 'boss_sig_recall_p2': "Phase two of the apocalyptic final boss theme, 184 bpm, D minor, even heavier. Full wordless choir at fortissimo repeating the same four-note motif, relentless hardcore kicks, shrieking sirens, thundering taiko-like impacts, distorted bass drops, frantic climax. " + SIGN,
 'boss_sig_dispatcher': "Cold machine-intelligence boss theme, 164 bpm, F# minor. Rigid sequenced 16th-note bass ostinato, driving staccato string-like synth ostinato, data-bleep percussion, klaxon brass stabs, a haunting robotic melody in the middle section. " + SIGN,
 'boss_sig_dispatcher_p2': "Phase two of the machine-intelligence boss theme, 172 bpm, F# minor, overclocked. Same sequenced bass ostinato doubled in speed, glitching stuttering drums, layered siren brass, corrupted version of the robotic melody, relentless. " + SIGN,
 'boss_sig_widow': "Haunting grief-fuelled boss theme, 172 bpm, B minor. Mourning wordless female-style vocal pads and a keening detuned lead lament, shortwave radio static and morse rhythms, snapping snares, screeching saw bass, a tragic soaring melody in the climax. " + SIGN,
 'boss_sig_widow_p2': "Phase two of the grief-fuelled boss theme, 180 bpm, B minor, furious. The lament melody screaming over blown-out static, double-time breaks, distorted wailing vocal pads, huge bass, desperate climax. " + SIGN,
 'boss_sig_resonance': "Experimental sonic-weapon boss theme, 168 bpm, C minor. Giant standing-wave sub bass, glass harmonica and sonar ping melody, resonant sweeps and sudden silent dropouts, orchestral timpani hits, sharp tuned metallic percussion, shattering climax. " + SIGN,
 'boss_sig_courier': "High-speed chase boss theme, drum and bass, 176 bpm, G minor. Heroic-villain brass-like synth fanfare, thundering taiko drums, skittering breakbeats, swarming arpeggios, doppler whooshes, a triumphant yet menacing main melody. " + SIGN,
 'boss_sig_rattle': "Creeping horror industrial boss theme, 142 bpm, A minor. Rattling chains and bowed metal scrapes, deep claustrophobic sub, whispering choir-like breathy pads that swell, sudden heavy industrial stomps, building to a crushing relentless climax. " + SIGN,
 'boss_sig_breaker': "Colossal demolition boss theme, half-time heavy industrial, 140 bpm, E minor. Gigantic anvil and wrecking-ball percussion, distorted guitar-like power riffs, brass-like synth swells, crushing bass, a slow monumental main riff then a furious double-time section. " + SIGN,
 'boss_sig_liquidator': "Ruthless auction-house boss theme, 150 bpm, G# minor. Chanting low male-style choir pads counting down, hardstyle reverse bass kicks, gavel snare hits, ticking countdown, orchestral stabs, menacing main melody and a ruthless climax. " + SIGN,
}
for _n, _p in SIG.items(): TRACKS[_n] = (150 if not _n.endswith('_p2') else 120, True, _p)

# --- ambient pack 3 (calm pool, 120 s, lazy, 80 kbps): faster calm cadence needs 40+ distinct calm tracks. Family tags drift/pulse/noir/industrial are in src/music.ts ---
CALM3 = {
 'town_rooftop': "Open-air rooftop drift above a neon settlement at night, 68 bpm, B-flat major hopeful. Slow shimmering synth pad, soft glass bell notes, distant traffic hush, no drums, gentle sub. " + AMB,
 'town_jukebox': "Noir backroom jazz-tinged ambient, 82 bpm, C minor. Muted brushed drums, upright-bass-like warm sub, smoky electric piano chords, faint vinyl hiss, late-night bar mood. " + AMB,
 'town_dockside': "Dockside night groove, 104 bpm, G minor. Soft four-on-floor kick, rubbery bass, tape-delayed dub chords, metallic clinks, creaking cranes in the distance, calm forward motion. " + AMB,
 'harrow_smelter': "Calm industrial drone of a distant smelter, 76 bpm, D minor. Slow low machine pulse, warm furnace rumble, resonant metal tones, sparse bell, hot haze. " + AMB,
 'harrow_lamplight': "Noir lamplight ambient for a company town street, 72 bpm, A minor. Slow tremolo guitar-like synth, soft upright bass, brushed hats, rainy window mood. " + AMB,
 'harrow_ash': "Drifting ash-fall ambient, 60 bpm, E major to C# minor. Wide airy pads, slow glassy piano notes, gentle noise swells, no drums, melancholic. " + AMB,
 'harrow_shift': "Shift-change pulse, 98 bpm, F# minor. Gentle muted kick and shaker, warm arpeggio, whistle-like lead sparse, industrial town waking up, steady and calm. " + AMB,
 'calm_hollow': "Hollow abandoned-corridor drift, 62 bpm, F minor. Long reverberant drones, faint metallic knocks far away, slow sub swells, hushed breathy texture. " + AMB,
 'calm_relay': "Relay-station pulse, 108 bpm, E minor. Soft clicking sequence, filtered bass pulse, muted hats, glassy arpeggio that slowly evolves, cool and focused. " + AMB,
 'calm_alley': "Back-alley noir, 86 bpm, D minor. Dusty broken-beat drums, plucked bass, lonely muted trumpet-like synth line, steam and drip textures. " + AMB,
 'calm_conduit': "Industrial calm: humming conduits, 90 bpm, A minor. Slow mechanical rhythm of valves and pistons at low volume, deep warm drone, sparse glass tones. " + AMB,
 'calm_afterglow': "Afterglow ambient, 70 bpm, G major drifting minor. Soft detuned pads, slow harp-like pluck pattern, gentle shimmer, relief after danger. " + AMB,
 'calm_stasis': "Cold stasis chamber industrial ambient, 84 bpm, C# minor. Pulsing low coolant hum, ticking relays, long metallic swells, faint ice-like harmonics. " + AMB,
 'area_hi_ember': "Heavy-industry glow pulse, 92 bpm, G minor. Slow anvil-like soft hits, warm bass pulse, drifting furnace pads, sparse bell motif. " + AMB,
 'area_ps_hush': "Hush of a sealed surgical wing, 66 bpm, F# minor. Pure tones, slow sine pulses, glass harmonics, faint ventilation, sterile and uneasy. " + AMB,
 'area_mm_closing': "Closing-time retail noir, 80 bpm, A-flat major warped. Slow detuned lounge keys, brushed snare, tape wobble, empty-store atmosphere, lonely announcement-free. " + AMB,
}
for _n, _p in CALM3.items(): TRACKS[_n] = (120, True, _p)
LOWRATE |= set(CALM3)

# --- pack 4: bigger variety (target ~60 calm, ~40 boss, ~25 elite, 4 stingers). See docs/AUDIO.md ---
CALM4 = {
 'town_dawnmarket': "Sleepy dawn market opening in a salvage town, 74 bpm, A major hopeful. Soft marimba-like pluck pattern, warm pad, birds replaced by distant drones, barely-there kick. " + AMB,
 'town_lastcall': "Last-call noir in a smoky back bar, 78 bpm, E minor. Brushed drums, warm upright-bass-like sub, slow smoky saxophone-like synth lines, vinyl crackle. " + AMB,
 'town_scrapyard': "Scrapyard lullaby, 88 bpm, C minor. Soft clanking metal percussion like wind chimes, deep calm drone, slow bass pulse, rusty textures. " + AMB,
 'harrow_whistle': "Factory whistle at shift change in a company town, 96 bpm, G major turning minor. Gentle muted beat, steam-whistle-like synth swells, warm arpeggio, steady and calm. " + AMB,
 'harrow_chapel': "Old industrial chapel ambient, 56 bpm, D major. Slow organ-like pads, distant bell, deep reverb, wordless soft choir texture, reverent. " + AMB,
 'harrow_mill': "Idle rolling mill, 82 bpm, F minor. Slow grinding rhythm at low volume, hot air drone, sparse metallic ping, hypnotic. " + AMB,
 'calm_coldopen': "Cold open of a dungeon run, 64 bpm, B minor. Sparse sub heartbeat, thin glassy pad, faint distant machinery, anticipation. " + AMB,
 'calm_midshift': "Mid-shift steady exploration, 100 bpm, A minor. Soft rolling hats, muted bass pulse, evolving pad, small repeating bell motif. " + AMB,
 'calm_deepcut': "Deep-cut industrial corridors, 78 bpm, C# minor. Slow piston rhythm, low metallic drone, sparse reversed tones, claustrophobic but calm. " + AMB,
 'calm_exitroute': "Quiet noir exit route after danger, 84 bpm, G minor. Soft brushed beat, lonely electric piano, slow walking bass, relief tinged with unease. " + AMB,
 'calm_breathing': "Breathing room drift, 58 bpm, E-flat major. Slow breathing pad swells, tiny bell pings, no rhythm, soft sub. " + AMB,
 'calm_wires': "Humming power wires pulse, 112 bpm, D minor. Electric hum bed, soft sequenced pulse, gentle filtered arpeggio, cool and steady. " + AMB,
 'calm_sodium': "Sodium streetlight noir, 70 bpm, F# minor. Slow tremolo electric guitar-like synth, sparse upright-bass notes, rain-on-metal texture. " + AMB,
 'area_hi_coke': "Slag ovens glow, 86 bpm, D minor. Slow heavy soft-hit pulse, ember crackle, warm low drone, sparse bell. " + AMB,
 'area_hi_bellring': "Distant bell foundry ambience, 62 bpm, A-flat major. Deep tolling bells softened with reverb, warm pad, slow shimmer, no drums. " + AMB,
 'area_ps_archive': "Cold archive drift, 60 bpm, B minor. Paper-and-glass textures, slow pure-tone pad, tiny clicks, frozen air. " + AMB,
 'area_ps_ledger': "Audit-floor noir, 92 bpm, E-flat minor. Typewriter-like soft clicks as rhythm, dry upright bass, muted keys, bureaucratic loneliness. " + AMB,
 'area_mm_clearance': "Clearance-sale ghost mall pulse, 102 bpm, C major warped. Gentle four-on-floor, detuned jingle-like pluck motif, tape wobble, hollow echo. " + AMB,
 'area_mm_freight': "Freight depot night, 96 bpm, B minor. Distant train-like soft rhythm, deep warm drone, sparse horn-like synth calls, steady. " + AMB,
}
_H = "instrumental, cinematic dark industrial cyberpunk, steady high intensity throughout, no breakdown, seamless loop."
BOSS4 = {
 'boss_tarpit': "Tar-thick sludge metal boss battle, 118 bpm, instrumental. Heavy slow distorted riffs, thick sub, crawling drums, dread, " + _H,
 'boss_rivet': "Riveting-gun industrial boss battle, 132 bpm, instrumental. Rapid machine-gun rivet percussion, pounding kick, grinding bass, " + _H,
 'boss_ledgerman': "Orchestral-industrial boss battle, 126 bpm, instrumental. Tense low strings ostinato, heavy anvil hits, brass-like swells, ticking, " + _H,
 'boss_cinder': "Smouldering furnace boss battle, 136 bpm, instrumental. Roaring distorted bass, crackling embers, driving tom-heavy drums, " + _H,
 'boss_vigil': "Choir-and-machine boss battle, 140 bpm, instrumental. Wordless dark choir pads chanting, mechanical pulse, big kick, bell hits, " + _H,
 'boss_static_choir': "Glitch choir boss battle, 148 bpm, instrumental. Chopped stuttering choir fragments, bit-crushed drums, broken-radio static, wobbling bass, " + _H,
 'boss_gearwork': "Clockwork gear boss battle, 152 bpm, instrumental. Interlocking gear-like percussion, ticking arpeggio, deep chugging bass, " + _H,
 'boss_tollroad': "Highway chase boss battle, 158 bpm, instrumental. Pounding four-on-floor, siren-like leads, doppler sweeps, aggressive acid bass, " + _H,
 'boss_marrow': "Bone-deep sub bass boss battle, 144 bpm, instrumental. Huge sub drops, bone-crunch percussion, minimal menacing lead, " + _H,
 'boss_hammerfall': "Drum-heavy tribal-industrial boss battle, 150 bpm, instrumental. Massive layered taiko and tom drums, metallic hits, distorted bass, " + _H,
 'boss_siren': "Air-raid siren boss battle, 164 bpm, instrumental. Rising wailing sirens, blistering breakbeats, heavy reese bass, " + _H,
 'boss_glitchking': "Hyper-glitch boss battle, 170 bpm, instrumental. Extreme stutter edits, digital screeches, fast double-time drums, mangled bass, " + _H,
 'boss_dirge': "Doom-orchestral boss battle, 138 bpm, instrumental. Slow crushing brass-like dirge theme, huge impacts, tolling bells, double-kick, " + _H,
 'boss_overload': "Overloaded power-grid boss battle, 160 bpm, instrumental. Arcing electric zaps, distorted square-wave leads, relentless kick, transformer hum, " + _H,
 'boss_ironchoir': "Iron-choir boss battle, 156 bpm, instrumental. Massive wordless choir with metal percussion, heavy stabs, pounding bass, epic, " + _H,
 'boss_apex': "Apex predator boss battle, 172 bpm, instrumental. Aggressive neurofunk, vicious growling bass, rapid snares, tense stabs, very intense, " + _H,
 'boss_cataclysm': "Cataclysm boss battle, 174 bpm, instrumental. Collapsing-building impacts, distorted hardcore kicks, apocalyptic synth hits, maximum intensity, " + _H,
 'boss_endshift': "Final shift boss battle, 168 bpm, instrumental. Frantic breakcore drums, alarm klaxons, screaming saw lead, relentless, maximum intensity, " + _H,
 'boss_zero': "Zero-hour boss battle, 176 bpm, instrumental. Terrifying distorted choir over blistering drum and bass, colossal bass drops, maximum intensity, " + _H,
}
ELITE4 = {
 'elite_pistons': "Piston-driven elite fight, 134 bpm, instrumental. Hissing pistons as hats, stomping kick, gritty bass riff, ",
 'elite_flare': "Flare-gun elite fight, 146 bpm, instrumental. Bright searing synth stabs, heavy kick, sizzling noise, rolling bass, ",
 'elite_knell': "Death-knell elite fight, 122 bpm, instrumental. Tolling bells over a grinding half-time groove, dark brass-like pads, ",
 'elite_hexa': "Glitch-hop elite fight, 110 bpm, instrumental. Hexagonal stuttering drums, wobbling bass, broken synth hook, ",
 'elite_scour': "Scouring noise-techno elite fight, 152 bpm, instrumental. Harsh noisy hats, punishing kick, distorted rumble bass, ",
 'elite_lockdown': "Lockdown elite fight, 142 bpm, instrumental. Alarm tones, rigid sequenced bass, heavy snare, tense minor stabs, ",
 'elite_vandal': "Punk-industrial elite fight, 160 bpm, instrumental. Fast distorted drums, shouting-free aggressive riffs from noisy synth guitars, ",
 'elite_cascade': "Cascading arpeggio trance-industrial elite fight, 138 bpm, instrumental. Rapid falling arpeggios, pounding kick, dark pads, ",
 'elite_thorn': "Thorny acid-electro elite fight, 128 bpm, instrumental. Spiky 303-style acid line, snappy claps, heavy bass, ",
 'elite_ironhide': "Armoured elite fight, 118 bpm, instrumental. Heavy stomping industrial groove, clanging metal, slow menacing brass-like lead, ",
 'elite_surge': "Surging drum-and-bass elite fight, 172 bpm, instrumental. Rolling sub, fast breaks, rising synth swells, ",
}
STING = {
 'stinger_levelup': (10, 4.0, "Short uplifting synth level-up sting, instrumental. Bright rising arpeggio and a warm shimmering chord, industrial cyberpunk flavour, ends cleanly."),
 'stinger_rare': (10, 4.0, "Short rare-loot discovery sting, instrumental. Glittering metallic chime cascade and a deep shimmering pad swell, mysterious and rewarding, ends cleanly."),
 'stinger_complete': (10, 8.0, "Run-complete victory sting, instrumental. Triumphant but weary industrial brass-like synth chord progression resolving to a warm final chord with a deep sub boom, ends cleanly."),
 'stinger_death': (10, 5.0, "Short defeat sting, instrumental. Descending detuned tones, power-down sweep and a low sub thud, bleak industrial, ends cleanly."),
}
for _n, _p in CALM4.items(): TRACKS[_n] = (120, True, _p)
for _n, _p in BOSS4.items(): TRACKS[_n] = (75, True, _p)
for _n, _p in ELITE4.items(): TRACKS[_n] = (75, True, _p + "dark industrial cyberpunk, steady high intensity throughout, no breakdown, seamless loop.")
for _n, (_g, _k, _p) in STING.items(): TRACKS[_n] = (_g, False, _p)
LOWRATE |= set(CALM4)
# --- pack 5: town / hub moods (more town variety so the first track and rotation feel fresh). Rustline = town_*, Harrow Reach = harrow_* ---
CALM5 = {
 'town_neonbazaar': "Neon night market groove, 98 bpm, F-sharp minor. Soft swung hand percussion, bubbling analog arpeggio, warm round bass, distant hawker-stall chatter textures (no words), glowing signs hum. " + AMB,
 'town_raingutter': "Rain on tin roofs and gutters, 72 bpm, D minor. Soft rain texture, slow warm Rhodes chords, gentle sidechained pad, faint rim clicks, cosy and melancholic. " + AMB,
 'town_lounge': "Late-night synth lounge, 86 bpm, A-flat major seventh chords. Smooth electric piano, brushed drums, warm fretless-like synth bass, soft muted trumpet-like synth lead, intimate and relaxed. " + AMB,
 'town_synthhaze': "Beatless synth ambient haze over a settlement, 60 bpm, E major. Slowly evolving warm analog pads, shimmering high arpeggio far in the background, tape warble, peaceful. " + AMB,
 'town_nightbus': "Night shuttle ride through the hub, 92 bpm, B minor. Soft steady kick, rolling bassline, passing light swooshes, gentle repeating synth motif, reflective. " + AMB,
 'harrow_rainworks': "Rain over a foundry yard, 70 bpm, G minor. Heavy rain texture, distant muffled hammer strikes, warm low drone, slow detuned piano-like synth chords. " + AMB,
 'harrow_lounge': "Foundry workers' lounge after shift, 80 bpm, C minor. Brushed drums, warm bass, smoky electric piano, faint clinking glasses and machinery hum, tired but warm. " + AMB,
 'harrow_glowpipes': "Synth ambient among glowing heat pipes, 64 bpm, D major. Warm evolving pads, slow sine bell motif, soft steam breaths, gentle sub pulse, no drums. " + AMB,
 'harrow_nightshift': "Night shift groove, 102 bpm, A minor. Muted four-on-floor kick, metallic shaker, rubbery bass, dubby chord stabs, conveyor rhythm in the distance, steady and calm. " + AMB,
 'harrow_neonforge': "Neon-lit forge district market, 94 bpm, E minor. Plucked synth melody, hand percussion, warm glowing pad, distant anvil ticks as rhythm, curious and lively but calm. " + AMB,
}
for _n, _p in CALM5.items(): TRACKS[_n] = (120, True, _p)
LOWRATE |= set(CALM5)
# --- pack 6: world districts (docs/WORLD.md). Six town-hub moods per generated district, named <town>_<mood>; pools in src/music.ts WORLD_POOLS ---
WORLD6_TOWNS = {
 'neon_mile': "neon entertainment strip, arcade bleeps and karaoke-bar glow in the distance",
 'the_stacks': "container slum stacks, distant generators, laundry flapping, tin and rope textures",
 'salt_harbor': "flooded harbor boardwalks, lapping water, distant foghorn, creaking moorings",
 'dust_yard': "desert salvage yard under a white sun, dry wind, distant hauler wrecks clanking",
 'under_bazaar': "underground metro night market, lantern hum, echoing concourse, cable hum",
 'aldane_spire': "clean white corporate arcology lobby, filtered air, glass and chrome, polished calm",
 'signal_heights': "rooftop antenna shanties, radio static and distant pirate broadcasts, wind on masts",
 'kestrel_plaza': "corporate HQ fountain plaza, polite chimes, fountain water, sponsored calm",
 'tether_base': "orbital elevator customs base, vast low hum of the tether, slow climber cars, cold air",
}
WORLD6_MOODS = {
 'a': "Slow ambient groove, 84 bpm, minor key. Soft kick, warm analog pads, gentle repeating synth motif, ",
 'b': "Beatless evolving ambient, 60 bpm. Long drones, distant bell tones, slow filter sweeps, ",
 'c': "Mellow downtempo trip-hop, 88 bpm. Dusty swung beat, deep round bass, muted chord stabs, ",
 'd': "Calm minimal techno, 104 bpm. Muted four-on-floor kick, soft shaker, dubby chord echoes, ",
 'e': "Night lounge, 78 bpm. Electric piano chords, brushed drums, warm synth bass, smoky lead, ",
 'f': "Dreamy retro synthwave haze, 96 bpm. Gated soft snare, warm arpeggio, wide pads, ",
}
WORLD6 = {f'{t}_{m}': mp + d + ". " + AMB for t, d in WORLD6_TOWNS.items() for m, mp in WORLD6_MOODS.items()}
for _n, _p in WORLD6.items(): TRACKS[_n] = (90, True, _p)
LOWRATE |= set(WORLD6)
# --- pack 7: MUSIC_DIRECTION (docs/MUSIC_DIRECTION.md). Loneliness turning into rage, unease turning into emergency.
# Prompts describe instruments, tempo, structure and mood only; never name or imitate existing works or artists.
D7 = "instrumental, no vocals, no lyrics, raw and cinematic, dark near-future city, seamless loop."
CORE7 = {
 'town': (90, True, "Lonely repeating felt piano figure, 76 bpm, D minor. A simple four-note motif repeats with tiny variations, soft electronic pulse underneath like a slow heartbeat, faint distant wordless choir pad far away in reverb, empty streets, mournful and hypnotic, never resolves, quiet dynamics. " + D7),
 'traversal_a': (75, True, "Insistent clean electric guitar ostinato, 96 bpm, E minor. One short repeated figure with long delay, sparse low tom pulse, slowly thickening tremolo drone, uneasy and watchful, steady tension that never releases. " + D7),
 'traversal_b': (75, True, "Cold hypnotic minimalism, 100 bpm, B minor. Repeating muted piano eighth notes, ticking electronic pulse, low bowed cello drone, distant metallic textures, rising unease held at a simmer. " + D7),
 'combat_a': (75, True, "Escalating post-rock assault, 132 bpm, E minor. The same insistent repeated guitar figure now distorted, driving floor-tom and snare pattern, layered tremolo guitars, abrasive noise swells, frightening and relentless, high intensity throughout. " + D7),
 'combat_b': (75, True, "Urgent orchestral-electronic chase, 140 bpm, C minor. Driving taiko-like percussion, staccato low strings ostinato, pulsing synth bass, abrasive brass-like stabs, panic and momentum, high intensity throughout. " + D7),
 'boss_fight': (80, True, "Overwhelming wall of noise boss battle, 138 bpm, D minor. A simple repeating guitar motif buried under layers of distorted tremolo guitars and feedback, massive pounding war drums, low brass-like swells, relentless and inevitable, maximum intensity throughout. " + D7),
 'boss_reveal': (28, False, "Cinematic boss entrance, instrumental. Starts with a lone repeating piano note and a faint electronic pulse, a tremolo guitar swell rises underneath, distant percussion builds, ends in a sudden roaring wall of sound."),
 'clear': (24, False, "Short aftermath resolution, instrumental. Slow warm ambient synth swell rising gently like light through haze, soft sustained chord, calm and almost spiritual relief, quiet ending."),
}
TRACKS.update(CORE7)
TOWN7 = {
 'town_dir_vigil': "Solitary piano in an empty hall, 66 bpm, A minor. Slow repeating three-note figure, long sustain, faint tape hiss, distant wind, lonely and mournful.",
 'town_dir_pulse': "Hypnotic piano and electronic pulse, 104 bpm, F# minor. Repeating eighth-note piano pattern, soft analog pulse bass, ticking hi-hat, faraway wordless voices in reverb, cool and detached unease.",
 'town_dir_embers': "Quiet post-rock ambience, 70 bpm, D major-ish melancholic. Clean guitar harmonics with long delay, warm drone, soft brushed cymbal swells, hopeful but weary.",
 'town_dir_static': "Lonely radio night, 80 bpm, E minor. Sparse piano notes over a low electronic pulse, gentle shortwave static texture, slow pad, isolated and watchful.",
 'town_dir_lantern': "Gentle ambient piano loop, 72 bpm, C minor. Soft repeating motif, subtle cello drone, distant city hum, intimate and mournful.",
 'town_dir_glass': "Cold minimalist piano and synth, 96 bpm, B minor. Interlocking repeating piano lines, glassy bell tones, quiet sequenced pulse, clinical and hypnotic.",
 'town_dir_dust': "Desolate guitar ambience, 62 bpm, G minor. Slow reverbed electric guitar figure repeating, low bowed bass drone, dry wind texture, vast empty spaces.",
 'town_dir_choir': "Distant voices ambient, 68 bpm, D minor. Wordless far-off choir pad, slow piano chords, soft sub pulse, spiritual calm with a thread of unease.",
 'town_dir_rain': "Rain on concrete, 84 bpm, A minor. Repeating muted piano figure, soft electronic pulse, gentle rain texture, slow swelling strings pad, reflective and lonely.",
 'town_dir_tick': "Clockwork unease, 108 bpm, C# minor. Ticking electronic pulse, repeating two-note piano ostinato, low synth drone slowly opening its filter, controlled tension.",
 'town_dir_hollow': "Hollow shelter ambience, 60 bpm, F minor. Beatless warm drone, sparse distant piano notes, faint metallic resonance, safe but haunted.",
 'town_dir_signal': "Pulsing signal ambient, 100 bpm, E minor. Soft repeating synth pulse, slow descending piano line, distant processed voices without words, cool and hypnotic.",
 'town_dir_ash': "Mournful strings and piano, 64 bpm, B-flat minor. Slow repeating cello phrase, quiet piano answers, soft room tone, grief held quietly.",
 'town_dir_neon': "Late-night hypnotic groove, 92 bpm, G minor. Muted soft kick, repeating electric piano figure, pulsing synth bass, sparse delayed guitar notes, cool and lonely.",
 'town_dir_ascend': "Slow rising ambient, 58 bpm, D major. Long swelling synth chords that climb gently, soft high harmonics, no drums, serene and almost spiritual.",
 'town_dir_watch': "Watchful minimal post-rock, 88 bpm, A minor. Single clean guitar ostinato, soft mallet toms, slow tremolo swell that recedes before it peaks, uneasy calm.",
}
for _n, _p in TOWN7.items(): TRACKS[_n] = (120, True, _p + " quiet dynamics, no big drops. " + D7)
LOWRATE |= set(TOWN7)
DUNGEON7 = {
 'calm_dir_motif': "Insistent dungeon ambience, 92 bpm, E minor. A simple repeated guitar figure with delay, slow low drone, distant percussion hits, tension held, never resolves.",
 'calm_dir_corridor': "Uneasy corridor minimalism, 100 bpm, C minor. Repeating muted piano eighths, ticking pulse, abrasive metallic textures far away, low cello drone.",
 'calm_dir_vast': "Vast empty underground, 64 bpm, D minor. Wide reverbed guitar drones, sparse low piano notes, distant rumble, deeply unsettling emptiness.",
 'calm_dir_creep': "Creeping escalation, 108 bpm, F minor. Soft repeating synth pulse, low tom pattern, tremolo guitar slowly rising in volume, unease growing.",
}
for _n, _p in DUNGEON7.items(): TRACKS[_n] = (120, True, _p + " quiet to moderate dynamics. " + D7)
LOWRATE |= set(DUNGEON7)
HI7 = {  # escalation stems: crossfaded in when combat stays intense (src/music.ts ESCALATE)
 'elite_escalate_a': "Maximum escalation post-rock assault, 132 bpm, E minor. Repeated distorted guitar figure swallowed by walls of tremolo guitars and feedback, pounding drums, crashing cymbals, overwhelming noise, relentless.",
 'elite_escalate_b': "Maximum escalation orchestral-electronic emergency, 140 bpm, C minor. Thunderous percussion ensemble, frantic low strings ostinato, blaring brass-like alarms, distorted synth pulses, mass panic.",
}
for _n, _p in HI7.items(): TRACKS[_n] = (75, True, _p + " " + D7)
BOSS7 = {
 'boss_wall_dread': "Slow-building boss battle, 120 bpm, A minor. Repeating guitar motif grows from clean to distorted, heavy half-time drums, low brass-like swells, dread becoming fury.",
 'boss_wall_siege': "Siege boss battle, 140 bpm, D minor. Driving war-drum percussion ensemble, staccato strings, abrasive synth textures, distorted guitar wall, urgent and relentless.",
 'boss_wall_storm': "Storm of noise boss battle, 150 bpm, E minor. Layered tremolo guitars and feedback, blast-like drums, pulsing electronic bass, frightening and overwhelming.",
 'boss_wall_end': "Final apocalyptic boss battle, 160 bpm, C minor. Massive orchestral-electronic hybrid, pounding percussion, repeating piano motif turned brutal, wall of distorted guitars, siren-like synths, inevitable doom.",
}
for _n, _p in BOSS7.items(): TRACKS[_n] = (75, True, _p + " maximum intensity, no breakdown. " + D7)
TRACKS['theme_main'] = (120, False, "Main theme, 84 bpm, D minor. Opens with a lonely repeating piano motif and soft electronic pulse, a clean guitar joins with the same figure, percussion slowly enters, layers of tremolo guitars and low strings build gradually into a vast roaring crescendo, then fall back to the lone piano. Loneliness turning into rage. " + D7)
LOWRATE.add('theme_main')
STING['stinger_ascent'] = (14, 10.0, "Ascent arrival sting, instrumental. Slow luminous synth swell rising from silence, warm sustained major chord, soft high shimmer, spiritual calm and wonder, ends cleanly.")
TRACKS['stinger_ascent'] = (14, False, STING['stinger_ascent'][2])
NEW7 = list(CORE7) + list(TOWN7) + list(DUNGEON7) + list(HI7) + list(BOSS7) + ['theme_main', 'stinger_ascent']
FADE_END = {'theme_main'}  # full pieces with a composed ending: 5.5 s musical fade-out instead of a loop seam
XF = 3.0
# --- pack 8: theme_main variations (docs/MUSIC_DIRECTION.md "Theme variations"). Measured theme_main: D minor, ~84 bpm (tools/motif_analyze.py).
MOTIF = ("Built on one recognisable melody in D minor: a slow four-note piano motif F, E, D, then a low A (scale degrees 3, 2, 1, low 5), "
         "each note held about one beat, repeated twice, then answered by a slow chromatic descent A, G sharp, G, F sharp resolving to D, over a sustained low D pedal. "
         "Strictly D minor, never major. Keep this exact melody, key and contour clearly audible throughout; the motif must come back every few bars.")
THEME8_LOFI = {
 'theme_lofi_dust': "Lo-fi hip-hop arrangement, 84 bpm, D minor. Dusty felt piano plays the melody, warm tape saturation and gentle wow and flutter, vinyl crackle, mellow swung boom-bap beat with soft kick and brushed snare, round upright-style bass, cozy and melancholic.",
 'theme_lofi_rain': "Lo-fi chillhop arrangement, 84 bpm, D minor. Soft electric piano carries the melody, tape hiss, quiet rain texture, lazy laid-back drums with rimshot, warm sub bass, gentle filtered pad, reflective and calm.",
 'theme_lofi_tape': "Mellow lo-fi jazz-hop arrangement, 84 bpm, D minor. Detuned upright piano plays the melody, worn cassette warmth, muted kick and shaker groove, soft muted guitar chords, sleepy and nostalgic.",
}
THEME8_BOSS = {
 'boss_theme_wall': "Boss battle arrangement, 168 bpm double-time over the 84 bpm pulse, D minor. The melody is hammered out by distorted tremolo guitars and low brass-like swells, massive war drums and taiko-like percussion, walls of feedback and noise, orchestral string ostinato, relentless and overwhelming, maximum intensity, no breakdown.",
 'boss_theme_siege': "Boss battle arrangement, 84 bpm half-time feel, D minor. Colossal orchestral-industrial hybrid: the melody on blaring low brass and choir-like synth pads without words, pounding war drums on every beat, abrasive distorted bass, staccato strings, urgent and inevitable, maximum intensity, no breakdown.",
 'boss_theme_storm': "Boss battle arrangement, 168 bpm, D minor. Driving percussion ensemble and pulsing electronic bass, the melody played by a piano doubled with distorted guitars, rising alarm-like synth layers, crashing cymbals, mass panic and fury, maximum intensity, no breakdown.",
}
for _n, _p in THEME8_LOFI.items(): TRACKS[_n] = (120, False, _p + " " + MOTIF + " quiet to moderate dynamics. " + D7); FADE_END.add(_n)
LOWRATE |= set(THEME8_LOFI)
for _n, _p in THEME8_BOSS.items(): TRACKS[_n] = (80, True, _p + " " + MOTIF + " " + D7)
NEW8 = list(THEME8_LOFI) + list(THEME8_BOSS)

# --- pack 9: snare-forward boss pool (docs/MUSIC_DIRECTION.md "Snare-forward bosses"). Drum style only, no artist references.
SNARE = ("Snare-forward drum production: a prominent crisp, bright snare high in the mix; rolling snare fills building into every new section; "
         "rapid 16th-note then 32nd-note snare rushes accelerating into each drop; busy ghost-note snare grooves between the backbeats; "
         "the driving rolling snare gives constant forward momentum. ")
SNARE9 = ['boss_theme_wall','boss_theme_siege','boss_theme_storm','boss_wall_dread','boss_wall_siege','boss_wall_storm','boss_wall_end','boss_fight','elite_escalate_a','elite_escalate_b']
for _n in SNARE9: TRACKS[_n] = (TRACKS[_n][0], TRACKS[_n][1], SNARE + TRACKS[_n][2] + (' The snare drum leads the arrangement: loud cracking snare on every backbeat with constant rolling snare fills.' if _n in ('boss_theme_storm','elite_escalate_b') else ''))
def gen(name, secs, prompt):
    raw = RAW/f'{name}.mp3'
    if raw.exists(): return raw
    body = json.dumps({"prompt": prompt, "music_length_ms": secs*1000, "force_instrumental": True, "model_id": MODEL}).encode()
    req = urllib.request.Request("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", body, {"xi-api-key": KEY, "Content-Type": "application/json"})
    import time
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=300) as r: raw.write_bytes(r.read())
            break
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 7: raise
            time.sleep(20)
    return raw
def dur(p): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(p)]).strip())
def static_gain(raw, L, S=0.0):
    """Static gain to -16 LUFS. Dynamic loudnorm on a loop drifts its gain between the end and the start, which clicks at the seam."""
    import re
    e = subprocess.run(['ffmpeg','-v','info','-ss',str(S),'-t',str(L-S),'-i',str(raw),'-af','loudnorm=I=-16:TP=-1.5:print_format=json','-f','null','-'], capture_output=True, text=True).stderr
    i = float(re.findall(r'"input_i" : "(-?[0-9.]+)"', e)[-1]); tp = float(re.findall(r'"input_tp" : "(-?[0-9.]+)"', e)[-1])
    return min(-16 - i, -1.5 - tp)  # no limiter: its look-ahead delay shifts the signal and breaks the seam
import re as _re
HARD_LOOP = lambda n: bool(_re.match(r'^(combat_|boss_|elite_)', n))
def _env(raw):
    import array, math
    b = subprocess.run(['ffmpeg','-v','error','-i',str(raw),'-ac','1','-ar','22050','-f','s16le','-'], capture_output=True).stdout
    x = array.array('h'); x.frombytes(b); w = 2205
    return [10*math.log10(sum(v*v for v in x[i*w:(i+1)*w])/w/1073741824+1e-12) for i in range(len(x)//w)]
def body_start(raw):
    """First point (s) where the 100 ms RMS reaches within 4 dB of the body level (median of loud windows)."""
    env = _env(raw); loud = sorted(e for e in env if e > -60); body = loud[len(loud)//2] if loud else -30
    first = next((i for i, e in enumerate(env) if e >= body-4), 0)
    return min(first*0.1, len(env)*0.1*0.25)
def body_end(raw, L):
    """Last point (s) before the generated ending fade: 100 ms RMS stays within 6 dB of the body level (median of the final 30 s, ignoring silence)."""
    import array, math
    b = subprocess.run(['ffmpeg','-v','error','-i',str(raw),'-ac','1','-ar','22050','-f','s16le','-'], capture_output=True).stdout
    x = array.array('h'); x.frombytes(b); w = 2205; n = len(x)//w
    env = [10*math.log10(sum(v*v for v in x[i*w:(i+1)*w])/w/1073741824+1e-12) for i in range(max(0,n-300), n)]
    loud = sorted(e for e in env if e > -60); body = loud[len(loud)//2] if loud else -30
    last = max((i for i, e in enumerate(env) if e >= body-6), default=len(env)-1)
    cut = (max(0,n-300)+last+1)*w/22050 - 0.3
    return min(L, max(L*0.7, cut))
def process(name, loop):
    raw = RAW/f'{name}.mp3'; out = OUT/f'{name}.mp3'; L = dur(raw); BR = '80k' if name in LOWRATE else '112k'
    if loop and not HARD_LOOP(name): loop = False; FADE_END.add(name)  # calm tracks never loop in game (rotation crossfades): keep the generated ending + a musical fade
    S = 0.0
    if loop: S, L = body_start(raw), body_end(raw, L)  # hard loops: cut the generated intro swell and ending fade so the seam never dips, then blend tail into head
    if loop:  # equal-power blend of tail into head so the file loops seamlessly
        fc = (f"[0:a]atrim={S}:{L},asetpts=PTS-STARTPTS,asplit=3[a][b][c];[a]atrim={XF}:{L-S-XF},asetpts=PTS-STARTPTS[mid];"
              f"[b]atrim={L-S-XF}:{L-S},asetpts=PTS-STARTPTS[tail];[c]atrim=0:{XF},asetpts=PTS-STARTPTS[head];"
              f"[tail][head]acrossfade=d={XF-0.01}:c1=qsin:c2=qsin[x];[mid][x]concat=n=2:v=0:a=1,volume={static_gain(raw, L, S):.2f}dB[o]")
        subprocess.check_call(['ffmpeg','-y','-v','error','-i',str(raw),'-filter_complex',fc,'-map','[o]','-ac','2','-ar','44100','-b:a',BR,str(out)])
    elif name in STING:
        k = STING[name][1]
        subprocess.check_call(['ffmpeg','-y','-v','error','-i',str(raw),'-af',f'atrim=0:{k},afade=t=out:st={k-1.2}:d=1.2,loudnorm=I=-16:TP=-1.5','-ac','2','-ar','44100','-b:a','112k',str(out)])
    else:
        subprocess.check_call(['ffmpeg','-y','-v','error','-i',str(raw),'-af',f'loudnorm=I=-16:TP=-1.5,afade=t=out:st={L-1.5}:d=1.5' if name=='clear' else f'loudnorm=I=-16:TP=-1.5,afade=t=out:st={L-5.5}:d=5.5' if name in FADE_END else 'loudnorm=I=-16:TP=-1.5','-ac','2','-ar','44100','-b:a',BR,str(out)])
    print(name, f'{dur(out):.1f}s', out.stat().st_size//1024, 'KB')
if __name__ == '__main__':
    force = '--force' in sys.argv; names = [a for a in sys.argv[1:] if not a.startswith('--')] or list(TRACKS)
    if '--pack7' in sys.argv: names = NEW7
    if '--pack8' in sys.argv: names = NEW8
    if '--pack9' in sys.argv: names = SNARE9
    for n in names:
        s, loop, p = TRACKS[n]
        if (OUT/f'{n}.mp3').exists() and not force: print('skip', n); continue
        if not KEY and not (RAW/f'{n}.mp3').exists(): sys.exit('ELEVENLABS_API_KEY not set')
        gen(n, s, p); process(n, loop)
