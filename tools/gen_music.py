#!/usr/bin/env python3
"""Generate music via ElevenLabs /v1/music, post-process to loop-friendly mp3 in public/audio/music/.
Usage: ELEVENLABS_API_KEY=... python3 tools/gen_music.py [name ...] [--force]
Needs ffmpeg. Raw downloads are cached in tools/.music_raw (gitignored). Existing outputs are skipped unless --force."""
import os, sys, json, subprocess, urllib.request, urllib.error, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT/'tools'/'.music_raw'; OUT = ROOT/'public'/'audio'/'music'
RAW.mkdir(exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
KEY = os.environ.get('ELEVENLABS_API_KEY')
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
 'boss_apothecary': (75, True, "Toxic dark drum and bass boss battle, 170 bpm, instrumental. Warbling sickly detuned bass, bubbling and hissing gas textures, syringe-like glass stabs, rolling breakbeat, queasy minor-key pads, dark cyberpunk, steady intense energy throughout, no breakdown, seamless loop."),
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
 'area_hi_coke': "Coke ovens glow, 86 bpm, D minor. Slow heavy soft-hit pulse, ember crackle, warm low drone, sparse bell. " + AMB,
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
XF = 2.0
def gen(name, secs, prompt):
    raw = RAW/f'{name}.mp3'
    if raw.exists(): return raw
    body = json.dumps({"prompt": prompt, "music_length_ms": secs*1000, "force_instrumental": True, "model_id": "music_v1"}).encode()
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
def process(name, loop):
    raw = RAW/f'{name}.mp3'; out = OUT/f'{name}.mp3'; L = dur(raw); BR = '80k' if name in LOWRATE else '112k'
    if loop:  # equal-power blend of tail into head so the file loops seamlessly
        fc = (f"[0:a]asplit=3[a][b][c];[a]atrim={XF}:{L-XF},asetpts=PTS-STARTPTS[mid];"
              f"[b]atrim={L-XF}:{L},asetpts=PTS-STARTPTS[tail];[c]atrim=0:{XF},asetpts=PTS-STARTPTS[head];"
              f"[tail][head]acrossfade=d={XF-0.01}:c1=qsin:c2=qsin[x];[mid][x]concat=n=2:v=0:a=1,loudnorm=I=-16:TP=-1.5[o]")
        subprocess.check_call(['ffmpeg','-y','-v','error','-i',str(raw),'-filter_complex',fc,'-map','[o]','-ac','2','-ar','44100','-b:a',BR,str(out)])
    elif name in STING:
        k = STING[name][1]
        subprocess.check_call(['ffmpeg','-y','-v','error','-i',str(raw),'-af',f'atrim=0:{k},afade=t=out:st={k-1.2}:d=1.2,loudnorm=I=-16:TP=-1.5','-ac','2','-ar','44100','-b:a','112k',str(out)])
    else:
        subprocess.check_call(['ffmpeg','-y','-v','error','-i',str(raw),'-af',f'loudnorm=I=-16:TP=-1.5,afade=t=out:st={L-1.5}:d=1.5' if name=='clear' else 'loudnorm=I=-16:TP=-1.5','-ac','2','-ar','44100','-b:a','112k',str(out)])
    print(name, f'{dur(out):.1f}s', out.stat().st_size//1024, 'KB')
if __name__ == '__main__':
    force = '--force' in sys.argv; names = [a for a in sys.argv[1:] if not a.startswith('--')] or list(TRACKS)
    for n in names:
        s, loop, p = TRACKS[n]
        if (OUT/f'{n}.mp3').exists() and not force: print('skip', n); continue
        if not KEY and not (RAW/f'{n}.mp3').exists(): sys.exit('ELEVENLABS_API_KEY not set')
        gen(n, s, p); process(n, loop)
