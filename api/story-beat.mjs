// Deployable serverless function (Vercel/Netlify-style Node handler). Set OPENAI_API_KEY in the host's env, never in the repo.
// Also set STORY_TRUST_PROXY=1 when behind the host's proxy so per-IP limits use X-Forwarded-For, and optionally STORY_DAILY_CAP.
// Note: limits/cache are per warm instance; for a strict global cap on serverless, front this with the host's rate limiting.
import { createStoryService, LIMITS, clientIp } from '../server/story_beat.mjs';
const service = createStoryService();
const fail = (res, st, reason) => { res.statusCode = st; res.end(JSON.stringify({ ok: false, reason })); };
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return fail(res, 405, 'method');
  if (!/^application\/json/i.test(req.headers?.['content-type'] || '')) return fail(res, 415, 'content_type');
  if (parseInt(req.headers?.['content-length'] || '0', 10) > LIMITS.maxBody) return fail(res, 413, 'too_large');
  let body = req.body; if (typeof body === 'string') { if (body.length > LIMITS.maxBody) return fail(res, 413, 'too_large'); try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return fail(res, 400, 'bad_json');
  if (JSON.stringify(body).length > LIMITS.maxBody) return fail(res, 413, 'too_large');
  const r = await service.handle(body, { ip: clientIp(req) }); res.statusCode = r.status; res.end(JSON.stringify(r.json));
}
