#!/usr/bin/env python3
"""Generate the signature ability sfx layers with the ElevenLabs sound-generation API.
Usage: ELEVENLABS_API_KEY=... python3 tools/gen_sfx.py [family_layer ...] [--force]   (needs ffmpeg)
Raw downloads are cached in tools/.sfx_raw/ (gitignored); outputs are trimmed, peak-normalised, lightly compressed, mono 32 kHz mp3 in public/audio/sfx/.
Layers: windup (charge-up before the cast), cast (the release), impact (hit), travel (short loopable projectile/beam whoosh, only for families that fire things).
The game maps all 78 abilities onto these families (src/abilities/sfxprofile.ts) and varies pitch/filter/gain per ability, so no more than ~56 files are needed."""
import os, sys, json, subprocess, urllib.request, urllib.error, pathlib
KEY = os.environ.get('ELEVENLABS_API_KEY')
if not KEY: sys.exit('ELEVENLABS_API_KEY not set')
RAW = pathlib.Path(__file__).parent / '.sfx_raw'; OUT = pathlib.Path(__file__).parent.parent / 'public' / 'audio' / 'sfx'; RAW.mkdir(exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
S = 'game sound effect, cyberpunk industrial, dry, no music, no voice, '
F = {
 'servo':   {'windup': ('hydraulic servo motor spinning up with a metallic whine and pressure hiss', .6), 'cast': ('heavy hydraulic piston thump with a metal clank and servo whir', .8), 'impact': ('heavy metal clank and dull thud of a hydraulic arm hitting armour', .6)},
 'blade':   {'windup': ('metal blade unsheathing scrape with a rising ring', .5), 'cast': ('fast blade whoosh slash with a bright metallic ring', .6), 'impact': ('sharp metal blade strike on armour, ring and scrape', .5)},
 'optic':   {'windup': ('laser optics charging, rising electronic whine', .6), 'cast': ('precise sci-fi laser zap, short and sharp', .5), 'impact': ('laser beam hitting metal, sizzling pop', .5), 'travel': ('laser beam hum, steady electronic sizzle, loopable', .7)},
 'arc':     {'windup': ('electric capacitor charging crackle building up', .6), 'cast': ('electric arc discharge crackle zap', .7), 'impact': ('electric shock crackle and sharp zap on impact', .5), 'travel': ('buzzing electrical current crackle loop', .7)},
 'fire':    {'windup': ('gas igniting, thermal fuel whoosh building', .6), 'cast': ('flamethrower burst whoomp with crackling fire', .8), 'impact': ('fiery explosion pop with embers crackling', .7), 'travel': ('burning projectile fire whoosh, loopable', .7)},
 'vent':    {'windup': ('pressure building in a steam pipe, hissing rise', .5), 'cast': ('steam vent release hiss, coolant spray', .8), 'impact': ('short steam burst hiss and frost crackle', .5)},
 'drone':   {'windup': ('small electronic drone booting up, servo chirps', .5), 'cast': ('robot deploy chirp, electronic beeps and servo whirr', .7), 'impact': ('small electronic blip and mechanical click', .4), 'travel': ('small drone propeller buzz hover loop with soft beeps', .7)},
 'shield':  {'windup': ('energy shield charging, rising electrical hum', .5), 'cast': ('force field activating, resonant energy hum swell with a pulse', .9), 'impact': ('energy shield absorbing a hit, glassy pulse thud', .5)},
 'kinetic': {'windup': ('heavy machine winding up for a stomp, low rumble', .5), 'cast': ('massive ground slam with rubble and deep boom', .9), 'impact': ('heavy punch impact, crunch and dull boom', .5), 'travel': ('fast heavy projectile whoosh with a low thrum', .6)},
 'gravity': {'windup': ('gravity field warping, low descending drone', .6), 'cast': ('sci-fi gravity well implosion, sucking low whomp', .9), 'impact': ('deep distorted pull thump, reversed whoosh', .6)},
 'heal':    {'windup': ('nanite swarm humming, soft rising shimmer', .5), 'cast': ('healing repair pulse, warm electronic chime with sparkle', .8), 'impact': ('soft repair blip, tiny electronic sparkle', .4)},
 'blink':   {'windup': ('quick rising whoosh, teleport charge', .4), 'cast': ('teleport phase shift zip, airy whoosh and pop', .6), 'impact': ('short airy pop and whisper whoosh', .4)},
 'stealth': {'windup': ('soft electronic fade, muffled low hum', .5), 'cast': ('cloaking device engaging, descending whisper and soft hum', .8), 'impact': ('muffled dull stab, quiet knife thud', .4)},
 'sonic':   {'windup': ('air horn inhale, rising pressure', .5), 'cast': ('concussive shockwave blast, flashbang crack with ringing', .8), 'impact': ('percussive shock wave thud with ringing tail', .5)},
 'hack':    {'windup': ('data uplink, rising digital glitch chirps', .5), 'cast': ('hacking intrusion, digital glitch burst and data modem sweep', .7), 'impact': ('digital glitch zap, short corrupted bitcrush blip', .4)},
 'blast':   {'windup': ('explosive charge arming, rapid escalating beeps', .6), 'cast': ('orbital strike impact, huge explosion boom with debris', 1.3), 'impact': ('grenade explosion, crack and low boom', .8)},
 'summon':  {'windup': ('machinery assembling, clanks and ratchets', .6), 'cast': ('heavy robot drop-in landing, metal slam and servo boot-up', .9), 'impact': ('turret firing a burst of small energy shots', .5), 'travel': ('automated turret ticking and swivelling, loopable', .7)},
}
want = [a for a in sys.argv[1:] if not a.startswith('--')]; force = '--force' in sys.argv; jobs = [(f, l, p, d) for f, ls in F.items() for l, (p, d) in ls.items() if not want or f'{f}_{l}' in want or f in want]
for f, l, p, d in jobs:
    name = f'{f}_{l}'; raw = RAW / (name + '.mp3'); out = OUT / (name + '.mp3')
    if out.exists() and not force: print('skip', name); continue
    if not raw.exists() or force:
        body = json.dumps({'text': S + p, 'duration_seconds': max(.5, d), 'prompt_influence': .55}).encode()
        req = urllib.request.Request('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', body, {'xi-api-key': KEY, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=120) as r: raw.write_bytes(r.read())
        except urllib.error.HTTPError as e: print('FAIL', name, e.code, e.read()[:200]); continue
    # trim silence both ends, compress, peak-normalise to -3 dB, short fade-out; mono 32 kHz 56 kbps
    flt = 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,acompressor=threshold=-18dB:ratio=3:attack=3:release=60,alimiter=limit=0.7,afade=t=out:st=%.2f:d=0.12' % max(0.1, d - .2)
    tmp = OUT / ('_tmp_' + name + '.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(raw), '-af', flt, '-ac', '1', '-ar', '32000', str(tmp)], check=True)
    # two-pass peak normalisation to -3 dB so every layer sits at the same level (the game scales per ability afterwards)
    vd = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(tmp), '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    peak = float([l for l in vd.splitlines() if 'max_volume' in l][0].split()[-2]); gain = -3.0 - peak
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(tmp), '-af', 'volume=%.2fdB,alimiter=limit=0.7' % gain, '-b:a', '56k', str(out)], check=True); tmp.unlink()
    print('ok', name, out.stat().st_size)
