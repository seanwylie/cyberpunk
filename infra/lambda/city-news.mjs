// Weekly city news Lambda (EventBridge schedule). Reads the hub's persisted city state from DynamoDB, writes the feed to pk='news#latest'.
// AI writes words only, from buildFacts(); every line is validated against the facts, canned fallback otherwise. Key from Secrets Manager.
import { generateNews, NEWS } from './city_news.mjs';
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
const db = new DynamoDBClient({});
async function key() { if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY; if (!process.env.OPENAI_SECRET_ID) return null; try { const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager'); const r = await new SecretsManagerClient({}).send(new GetSecretValueCommand({ SecretId: process.env.OPENAI_SECRET_ID })); return r.SecretString && !/^PLACEHOLDER/.test(r.SecretString) ? r.SecretString.trim() : null; } catch { return null; } }
export async function handler() {
  const T = process.env.CITY_TABLE; const r = await db.send(new GetItemCommand({ TableName: T, Key: { pk: { S: 'state' } } })); if (!r.Item?.json?.S) return { ok: false, reason: 'no_state' };
  const state = JSON.parse(r.Item.json.S); const names = state.names || {}; const k = process.env.CITY_AI === '0' ? null : await key();
  const callAI = k ? async (system, user) => { const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), NEWS.timeoutMs); try {
      const res = await fetch((process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1') + '/chat/completions', { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + k }, body: JSON.stringify({ model: process.env.OPENAI_NEWS_MODEL || 'gpt-5.4-nano', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_completion_tokens: NEWS.maxTokens, response_format: { type: 'json_object' } }) });
      if (!res.ok) throw new Error('http ' + res.status); const j = await res.json(); return j?.choices?.[0]?.message?.content; } finally { clearTimeout(to); } } : null;
  const news = await generateNews(state, names, callAI);
  await db.send(new PutItemCommand({ TableName: T, Item: { pk: { S: 'news#latest' }, json: { S: JSON.stringify(news) }, at: { N: String(news.at) } } }));
  console.log(JSON.stringify({ wk: news.wk, src: news.src, why: news.why, items: news.items.length })); return { ok: true, src: news.src };
}
