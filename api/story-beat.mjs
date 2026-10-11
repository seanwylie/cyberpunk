// Deployable serverless function (Vercel/Netlify-style Node handler). Set OPENAI_API_KEY in the host's env, never in the repo.
import { createStoryService, LIMITS } from '../server/story_beat.mjs';
const service = createStoryService();
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, reason: 'method' })); }
  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || JSON.stringify(body).length > LIMITS.maxBody) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, reason: 'bad_request' })); }
  const r = await service.handle(body); res.statusCode = r.status; res.end(JSON.stringify(r.json));
}
