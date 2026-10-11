import { startHub } from './hub';
// Environment: PORT (8787), WV_HOST, WV_DEV=1 (test-only teleports; never in production), WV_ORIGINS (comma list of allowed Origins, e.g.
// https://play.example.com,*.example.com; empty = allow all), WV_ALLOW_NO_ORIGIN=1, WV_MAX_CONNS (500), WV_MAX_ROOMS (100), WV_MAX_PARTIES (500), WV_GRACE_MS (8000)
const list = (v?: string) => (v || '').split(',').map(x => x.trim()).filter(Boolean);
const num = (v: string | undefined, d: number) => (v && Number.isFinite(+v) ? +v : d);
// WV_STORY=1 serves POST /api/story-beat from this process (needs OPENAI_API_KEY in the task secrets); otherwise use the story Lambda.
let extra: any; if (process.env.WV_STORY === '1') { const { createStoryService, storyMiddleware } = await import('./story_beat.mjs' as any); const mw = storyMiddleware(createStoryService(), process.env); extra = (req: any, res: any) => { if (!String(req.url || '').split('?')[0].endsWith('/api/story-beat')) return false; mw(req, res, () => { res.writeHead(404); res.end(); }); return true; }; }
const hub = startHub({ extra, port: num(process.env.PORT || process.env.WV_PORT, 8787), dev: process.env.WV_DEV === '1', log: true, host: process.env.WV_HOST, origins: list(process.env.WV_ORIGINS), allowNoOrigin: process.env.WV_ALLOW_NO_ORIGIN === '1', maxConns: num(process.env.WV_MAX_CONNS, 500), maxRooms: num(process.env.WV_MAX_ROOMS, 100), maxParties: num(process.env.WV_MAX_PARTIES, 500) });
await hub.ready;
console.log(`[wv-hub] listening on :${hub.port()} (dev=${process.env.WV_DEV === '1'}, origins=${list(process.env.WV_ORIGINS).join('|') || 'ANY'})`);
let stopping = false; const stop = async (sig: string) => { if (stopping) return; stopping = true; console.log(`[wv-hub] ${sig}: draining`); await hub.shutdown(num(process.env.WV_GRACE_MS, 8000)); process.exit(0); };
process.on('SIGTERM', () => stop('SIGTERM')); process.on('SIGINT', () => stop('SIGINT'));
