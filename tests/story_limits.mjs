// Story endpoint abuse limits: limiter logic (memory store + mocked DynamoDB client) and service wiring. No network, no AWS.
import { createLimiter, memoryStore, dynamoStore, limitConfig, STORY_LIMIT_DEFAULTS as D } from '../server/story_limits.mjs';
import { createStoryService, CATALOG } from '../server/story_beat.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
let t = Date.UTC(2026, 9, 12, 12, 0, 0); const now = () => t;
const mk = (cfg = D, store = memoryStore()) => createLimiter({ store, cfg, now });

ok(D.regenCooldownSec === 60 && D.regenPerDay === 5 && D.genPerDay === 20, 'defaults: 60 s cooldown, 5 regens/day, 20 generations/day');
{ const c = limitConfig({ STORY_REGEN_COOLDOWN_SEC: '30', STORY_GEN_PER_DAY: '7', STORY_GLOBAL_PER_DAY: 'x' }); ok(c.regenCooldownSec === 30 && c.genPerDay === 7 && c.globalPerDay === D.globalPerDay, 'env overrides; junk ignored'); ok(limitConfig({ STORY_DAILY_CAP: '9' }).globalPerDay === 9, 'legacy STORY_DAILY_CAP feeds the global breaker'); }
{ const L = mk(); let r = await L.check({ player: 'p1', ip: 'i', regen: true }); ok(r.ok, 'first regen allowed');
  t += 10_000; r = await L.check({ player: 'p1', ip: 'i', regen: true }); ok(!r.ok && r.reason === 'rate_limited' && r.retryAfter === 50, 'second regen 10 s later: rate_limited, retryAfter 50');
  r = await L.check({ player: 'p2', ip: 'i', regen: true }); ok(r.ok, 'cooldown is per player');
  r = await L.check({ player: 'p1', ip: 'i', regen: false }); ok(r.ok, 'normal beats are not blocked by the regen cooldown');
  let last; for (let i = 0; i < 6; i++) { t += 61_000; last = await L.check({ player: 'p1', ip: 'i', regen: true }); }
  ok(!last.ok && last.reason === 'daily_cap' && last.scope === 'regen' && last.retryAfter > 0 && last.retryAfter <= 86400, '6th regen of the day: daily_cap with retryAfter until UTC midnight'); }
{ const L = mk(); let r; for (let i = 0; i < 21; i++) r = await L.check({ player: 'p9', ip: 'ip' + i, regen: false }); ok(!r.ok && r.reason === 'daily_cap' && r.scope === 'player', '21st generation for a player: daily_cap (across IPs)');
  t += 86_400_000; r = await L.check({ player: 'p9', ip: 'z', regen: false }); ok(r.ok, 'resets next UTC day'); }
{ const L = mk({ ...D, ipPerDay: 3 }); let r; for (let i = 0; i < 4; i++) r = await L.check({ player: 'spoof' + i, ip: '9.9.9.9', regen: false }); ok(!r.ok && r.scope === 'ip', 'per-IP fallback stops rotating fake player ids'); }
{ const L = mk({ ...D, globalPerDay: 2 }); let r; for (let i = 0; i < 3; i++) r = await L.check({ player: 'g' + i, ip: 'g' + i, regen: false }); ok(!r.ok && r.reason === 'budget', 'global circuit breaker trips -> budget'); }
{ const L = createLimiter({ store: { take: async () => { throw new Error('ddb down'); }, cooldown: async () => { throw new Error('x'); } }, now }); const r = await L.check({ player: 'a', ip: 'b' }); ok(!r.ok && r.reason === 'budget', 'store error fails closed'); }
// mocked DynamoDB client: emulate conditional writes
{ const items = new Map(); const sent = [];
  const client = { send: async (c) => { const i = c.input; sent.push(c.constructor.name); const k = i.Key?.pk?.S || i.Item?.pk?.S; const cur = items.get(k);
    const cfe = () => { const e = new Error('cond'); e.name = 'ConditionalCheckFailedException'; throw e; };
    if (c.constructor.name === 'UpdateItemCommand') { const lim = Number(i.ExpressionAttributeValues[':lim'].N); if (cur && cur.n >= lim) cfe(); const n = (cur?.n || 0) + 1; items.set(k, { n }); return { Attributes: { n: { N: String(n) } } }; }
    if (c.constructor.name === 'PutItemCommand') { const nw = Number(i.ExpressionAttributeValues[':now'].N); if (cur && cur.until > nw) cfe(); items.set(k, { until: Number(i.Item.until.N) }); return {}; }
    if (c.constructor.name === 'GetItemCommand') return { Item: cur ? { until: { N: String(cur.until) } } : undefined }; } };
  class UpdateItemCommand { constructor(i) { this.input = i; } } class PutItemCommand { constructor(i) { this.input = i; } } class GetItemCommand { constructor(i) { this.input = i; } }
  { const L = mk({ ...D, genPerDay: 2 }, dynamoStore('T', client, { UpdateItemCommand, PutItemCommand, GetItemCommand })); let r = await L.check({ player: 'd', ip: 'x', regen: true }); ok(r.ok, 'dynamo: first regen ok');
    r = await L.check({ player: 'd', ip: 'x', regen: true }); ok(!r.ok && r.reason === 'rate_limited' && r.retryAfter > 0 && r.retryAfter <= 60, 'dynamo: conditional put enforces cooldown with retryAfter');
    t += 61_000; await L.check({ player: 'd', ip: 'x' }); r = await L.check({ player: 'd', ip: 'x' }); ok(!r.ok && r.reason === 'daily_cap', 'dynamo: conditional ADD enforces the daily cap'); ok(sent.includes('UpdateItemCommand') && sent.includes('PutItemCommand'), 'dynamo: uses UpdateItem/PutItem'); } }
// service wiring
{ const items = Object.keys(CATALOG.items); const body = (v, x = {}) => ({ trigger: 'return_town', town: 'rustline', level: 5, session: 'a1b2c3d4e5f60718', player: 'ffffeeee00001111', installed: [items[v % items.length]], rep: { HI: 0, PS: 0, MM: 0 }, variant: 1, ...x });
  let calls = 0; const sv = createStoryService({ env: { OPENAI_API_KEY: 'k' }, now, fetch: async () => { calls++; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'That arm looks heavy and ready for work. Bring it back in one piece.' } }] }) }; } });
  t += 86_400_000; let r = await sv.handle(body(1), { ip: '5.5.5.5' }); ok(r.json.ok, 'service: regen allowed');
  r = await sv.handle(body(2), { ip: '5.5.5.5' }); ok(r.status === 429 && r.json.reason === 'rate_limited' && r.json.retryAfter > 0 && calls === 1, 'service: immediate regen -> 429 rate_limited + retryAfter, no upstream call');
  ok(!(await sv.handle(body(3, { player: 'NOT-HEX' }))).json.ok, 'service: malformed player id rejected');
  const sb = createStoryService({ env: { OPENAI_API_KEY: 'k', STORY_GLOBAL_PER_DAY: '0' }, now, fetch: async () => { throw new Error('should not call'); } });
  r = await sb.handle(body(4, { variant: 0 }), { ip: '1.2.3.4' }); ok(r.status === 200 && r.json.reason === 'budget' && r.json.canned, 'service: breaker -> canned (200, reason budget)'); }
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
