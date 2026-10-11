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
