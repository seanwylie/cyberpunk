// Nemesis taunt voice (docs/NEMESIS.md). Pre-generated ElevenLabs clips (tools/gen_nemesis_voice.mjs) cached under public/audio/nemesis/.
// Never on the frame path: playback is an event-driven, lazily created single <audio> element (streamed by the browser's media pipeline,
// not decoded into WebAudio), started from a macrotask. Feature flag `nemesisVoice`; any miss (flag off, no clip, muted, load/play error,
// custom AI text with no clip) returns 'text' and the caller shows the subtitle only.
import { feature } from './features';
const BASE = 'audio/nemesis/';
let manifest: Promise<Record<string, string>> | null = null; let el: HTMLAudioElement | null = null;
export function loadManifest(fetcher: (u: string) => Promise<any> = u => fetch(u)): Promise<Record<string, string>> {
  if (!manifest) manifest = fetcher(BASE + 'manifest.json').then(r => r.ok ? r.json() : {}).then(j => (j && typeof j.clips === 'object' ? j.clips : {})).catch(() => ({})); return manifest; }
export const _resetVoice = () => { manifest = null; if (el) { el.pause(); el.removeAttribute('src'); } el = null; };
export type VoiceResult = 'voice' | 'text';
export async function playTaunt(key: string, settings: any, opts: { fetcher?: (u: string) => Promise<any>; timeoutMs?: number } = {}): Promise<VoiceResult> {
  if (!key || !feature('nemesisVoice', settings)) return 'text'; const vol = (settings?.volume ?? .6) * (settings?.sfxVol ?? 1); if (vol <= 0) return 'text';
  const m = await loadManifest(opts.fetcher); const file = m[key]; if (!file || typeof file !== 'string' || !/^[a-z0-9_]+\.mp3$/.test(file)) return 'text';
  return new Promise<VoiceResult>(res => { setTimeout(() => { try { el ??= new Audio(); el.preload = 'none'; el.volume = Math.min(1, vol); el.src = BASE + file;
    const to = setTimeout(() => res('text'), opts.timeoutMs ?? 2500); el.play().then(() => { clearTimeout(to); res('voice'); }, () => { clearTimeout(to); res('text'); }); } catch { res('text'); } }, 0); }); }
