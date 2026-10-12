#!/usr/bin/env node
// Generate + cache nemesis taunt voice lines with ElevenLabs TTS (docs/NEMESIS.md).
// Usage: ELEVENLABS_API_KEY=... node tools/gen_nemesis_voice.mjs [--force]
// Writes public/audio/nemesis/<key>.mp3 + manifest.json. Never prints the key. Checks that the key has the text_to_speech permission first.
import { build } from 'esbuild'; import fs from 'fs'; import os from 'os'; import path from 'path'; import crypto from 'crypto';
const KEY = process.env.ELEVENLABS_API_KEY; if (!KEY) { console.error('ELEVENLABS_API_KEY not set'); process.exit(1); }
const force = process.argv.includes('--force'); const OUT = 'public/audio/nemesis'; fs.mkdirSync(OUT, { recursive: true });
const tmp = path.join(os.tmpdir(), 'wv_nem_' + process.pid + '.mjs'); await build({ entryPoints: ['src/nemesis.ts'], bundle: true, platform: 'node', format: 'esm', outfile: tmp, logLevel: 'error' });
const { TAUNTS } = await import(tmp); fs.unlinkSync(tmp);
// two restrained, low voices (ElevenLabs premade library); alternate by line so recurring nemeses don't all sound identical
const VOICES = ['pNInz6obpgDQGcFmaJgB', 'VR6AewLTigWG4xSOukaG']; const MODEL = 'eleven_multilingual_v2';
const tts = (voice, text) => fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, { method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: .55, similarity_boost: .7, style: .35 } }) });
{ const r = await tts(VOICES[0], 'Again.'); if (r.status === 401 || r.status === 403) { const j = await r.json().catch(() => ({})); console.error('ElevenLabs key lacks TTS permission:', j?.detail?.status || r.status, '(use a key with text_to_speech)'); process.exit(2); } if (!r.ok) { console.error('TTS check failed: HTTP ' + r.status); process.exit(3); } }
const manPath = path.join(OUT, 'manifest.json'); const man = fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, 'utf8')) : { v: 1, clips: {}, text: {} };
let made = 0, kept = 0; const keys = Object.keys(TAUNTS);
for (const [i, k] of keys.entries()) { const text = TAUNTS[k]; const h = crypto.createHash('sha1').update(text).digest('hex').slice(0, 8); const file = `${k}.mp3`;
  if (!force && man.clips[k] === file && man.text[k] === h && fs.existsSync(path.join(OUT, file))) { kept++; continue; }
  const r = await tts(VOICES[i % VOICES.length], text); if (!r.ok) { console.error(k + ': HTTP ' + r.status); continue; }
  fs.writeFileSync(path.join(OUT, file), Buffer.from(await r.arrayBuffer())); man.clips[k] = file; man.text[k] = h; made++; console.log('voiced', k); }
for (const k of Object.keys(man.clips)) if (!TAUNTS[k]) { delete man.clips[k]; delete man.text[k]; }
fs.writeFileSync(manPath, JSON.stringify(man, null, 1)); console.log(`done: ${made} generated, ${kept} cached, ${keys.length} lines`);
