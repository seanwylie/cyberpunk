// AWS Lambda (Function URL, payload v2) wrapper around the shared story-beat service. The OpenAI key is read ONCE per cold start from
// Secrets Manager (OPENAI_SECRET_ID) and never returned to clients. Staged next to server/story_beat.mjs + story_catalog.json by the CDK app.
import { createStoryService, LIMITS } from './story_beat.mjs';
let service = null;
async function init() {
  if (service) return service;
  if (!process.env.OPENAI_API_KEY && process.env.OPENAI_SECRET_ID) {
    const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager'); // bundled in the nodejs20.x runtime
    const r = await new SecretsManagerClient({}).send(new GetSecretValueCommand({ SecretId: process.env.OPENAI_SECRET_ID }));
    if (r.SecretString && !/^PLACEHOLDER/.test(r.SecretString)) process.env.OPENAI_API_KEY = r.SecretString.trim();
  }
  service = createStoryService(); return service;
}
const json = (status, body) => ({ statusCode: status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
export async function handler(event) {
  const method = event.requestContext?.http?.method; if (method !== 'POST') return json(405, { ok: false, reason: 'method' });
  const ct = event.headers?.['content-type'] || ''; if (!/^application\/json/i.test(ct)) return json(415, { ok: false, reason: 'content_type' });
  let raw = event.body || ''; if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8'); if (raw.length > LIMITS.maxBody) return json(413, { ok: false, reason: 'too_large' });
  let body; try { body = JSON.parse(raw); } catch { return json(400, { ok: false, reason: 'bad_json' }); }
  const svc = await init(); const r = await svc.handle(body, { ip: event.requestContext?.http?.sourceIp || 'unknown' }); return json(r.status, r.json);
}
