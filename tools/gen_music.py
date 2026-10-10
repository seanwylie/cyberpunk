#!/usr/bin/env python3
"""Generate music via ElevenLabs /v1/music, post-process to loop-friendly mp3 in public/audio/music/.
Usage: ELEVENLABS_API_KEY=... python3 tools/gen_music.py [name ...] [--force]
Needs ffmpeg. Raw downloads are cached in tools/.music_raw (gitignored). Existing outputs are skipped unless --force."""
import os, sys, json, subprocess, urllib.request, pathlib
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
XF = 2.0
def gen(name, secs, prompt):
    raw = RAW/f'{name}.mp3'
    if raw.exists(): return raw
    body = json.dumps({"prompt": prompt, "music_length_ms": secs*1000, "force_instrumental": True, "model_id": "music_v1"}).encode()
    req = urllib.request.Request("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", body, {"xi-api-key": KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r: raw.write_bytes(r.read())
    return raw
def dur(p): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(p)]).strip())
def process(name, loop):
    raw = RAW/f'{name}.mp3'; out = OUT/f'{name}.mp3'; L = dur(raw)
    if loop:  # equal-power blend of tail into head so the file loops seamlessly
        fc = (f"[0:a]asplit=3[a][b][c];[a]atrim={XF}:{L-XF},asetpts=PTS-STARTPTS[mid];"
              f"[b]atrim={L-XF}:{L},asetpts=PTS-STARTPTS[tail];[c]atrim=0:{XF},asetpts=PTS-STARTPTS[head];"
              f"[tail][head]acrossfade=d={XF-0.01}:c1=qsin:c2=qsin[x];[mid][x]concat=n=2:v=0:a=1,loudnorm=I=-16:TP=-1.5[o]")
        subprocess.check_call(['ffmpeg','-y','-v','error','-i',str(raw),'-filter_complex',fc,'-map','[o]','-ac','2','-ar','44100','-b:a','112k',str(out)])
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
