// Minimal DynamoDB JSON-API client (GetItem/PutItem) with SigV4, no SDK dependency (keeps the hub image tiny).
// Credentials: env (AWS_ACCESS_KEY_ID/...) or the ECS task-role endpoint (AWS_CONTAINER_CREDENTIALS_RELATIVE_URI). Never logged.
import { createHash, createHmac } from 'node:crypto';
type Creds = { k: string; s: string; t?: string; exp: number };
let cached: Creds | null = null;
async function creds(): Promise<Creds> {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) return { k: process.env.AWS_ACCESS_KEY_ID, s: process.env.AWS_SECRET_ACCESS_KEY, t: process.env.AWS_SESSION_TOKEN, exp: Infinity };
  if (cached && cached.exp - Date.now() > 5 * 60e3) return cached;
  const rel = process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI; if (!rel) throw new Error('no AWS credentials');
  const r = await fetch('http://169.254.170.2' + rel); const j: any = await r.json(); cached = { k: j.AccessKeyId, s: j.SecretAccessKey, t: j.Token, exp: Date.parse(j.Expiration) || Date.now() + 30 * 60e3 }; return cached;
}
const h = (s: string) => createHash('sha256').update(s).digest('hex'); const mac = (k: any, s: string) => createHmac('sha256', k).update(s).digest();
export async function ddb(op: 'GetItem' | 'PutItem', body: any, region = process.env.AWS_REGION || 'us-east-1'): Promise<any> {
  const c = await creds(); const host = `dynamodb.${region}.amazonaws.com`; const payload = JSON.stringify(body);
  const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''); const day = amz.slice(0, 8);
  const hdr: Record<string, string> = { 'content-type': 'application/x-amz-json-1.0', host, 'x-amz-date': amz, 'x-amz-target': 'DynamoDB_20120810.' + op }; if (c.t) hdr['x-amz-security-token'] = c.t;
  const names = Object.keys(hdr).sort(); const canon = ['POST', '/', '', names.map(n => n + ':' + hdr[n]).join('\n') + '\n', names.join(';'), h(payload)].join('\n');
  const scope = `${day}/${region}/dynamodb/aws4_request`; const sts = ['AWS4-HMAC-SHA256', amz, scope, h(canon)].join('\n');
  const key = mac(mac(mac(mac('AWS4' + c.s, day), region), 'dynamodb'), 'aws4_request'); const sig = createHmac('sha256', key).update(sts).digest('hex');
  const r = await fetch('https://' + host + '/', { method: 'POST', headers: { ...hdr, authorization: `AWS4-HMAC-SHA256 Credential=${c.k}/${scope}, SignedHeaders=${names.join(';')}, Signature=${sig}` }, body: payload });
  const j: any = await r.json().catch(() => ({})); if (!r.ok) throw new Error('ddb ' + op + ' ' + r.status + ' ' + (j.__type || '')); return j;
}
