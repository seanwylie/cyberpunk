// Persistent, server-side abuse limits for the AI story endpoint (Regenerate spam, credit burn).
// Counters live in DynamoDB (Lambda) or memory (dev / tests) with a TTL so the table cleans itself.
// Every cap is configurable through env (STORY_*); see docs/STORY_LIMITS.md. Defaults below.
export const STORY_LIMIT_DEFAULTS = {
  regenCooldownSec: 60,      // STORY_REGEN_COOLDOWN_SEC: min gap between Regenerates per player
  regenPerDay: 5,            // STORY_REGEN_PER_DAY: Regenerates per player per UTC day
  genPerDay: 20,             // STORY_GEN_PER_DAY: total generations (beats + regenerates) per player per UTC day
  ipPerDay: 60,              // STORY_IP_PER_DAY: total generations per source IP per UTC day (fallback when ids are spoofed)
  globalPerDay: 2000,        // STORY_GLOBAL_PER_DAY: global circuit breaker; above it everyone gets canned lines
};
const ENV_KEYS = { regenCooldownSec: 'STORY_REGEN_COOLDOWN_SEC', regenPerDay: 'STORY_REGEN_PER_DAY', genPerDay: 'STORY_GEN_PER_DAY', ipPerDay: 'STORY_IP_PER_DAY', globalPerDay: 'STORY_GLOBAL_PER_DAY' };
export function limitConfig(env = process.env) {
  const out = { ...STORY_LIMIT_DEFAULTS };
  for (const [k, e] of Object.entries(ENV_KEYS)) { const n = parseInt(env[e] ?? '', 10); if (Number.isFinite(n) && n >= 0) out[k] = n; }
  // legacy name kept working
  if (env.STORY_GLOBAL_PER_DAY == null && env.STORY_DAILY_CAP != null) { const n = parseInt(env.STORY_DAILY_CAP, 10); if (Number.isFinite(n) && n >= 0) out.globalPerDay = n; }
  return out;
}
const dayOf = (now) => new Date(now).toISOString().slice(0, 10);
const secsToMidnight = (now) => { const d = new Date(now); const m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); return Math.max(1, Math.ceil((m - now) / 1000)); };

/** Memory store (dev server, tests). Same contract as the DynamoDB store. */
export function memoryStore() {
  const m = new Map();
  const live = (k, now) => { const v = m.get(k); if (v && v.exp * 1000 <= now) { m.delete(k); return null; } return v; };
  return {
    async take(key, limit, expSec, now) { const v = live(key, now); const n = v ? v.n : 0; if (n >= limit) return { ok: false, n }; m.set(key, { n: n + 1, exp: expSec }); return { ok: true, n: n + 1 }; },
    async cooldown(key, untilSec, now) { const v = live(key, now); if (v && v.until * 1000 > now) return { ok: false, until: v.until }; m.set(key, { until: untilSec, exp: untilSec }); return { ok: true }; },
    _m: m,
  };
}

/** DynamoDB store: one table, pk (S), ttl attribute "exp". Atomic conditional updates, so concurrent Lambdas can't overshoot a cap. */
export function dynamoStore(table, client, commands) {
  let ddb = client, cmds = commands || null;
  const init = async () => { if (!cmds) { const m = await import('@aws-sdk/client-dynamodb'); cmds = m; if (!ddb) ddb = new m.DynamoDBClient({}); } return cmds; };
  const failed = (e) => e?.name === 'ConditionalCheckFailedException';
  return {
    async take(key, limit, expSec) {
      const { UpdateItemCommand } = await init();
      try {
        const r = await ddb.send(new UpdateItemCommand({ TableName: table, Key: { pk: { S: key } }, UpdateExpression: 'ADD n :one SET exp = if_not_exists(exp, :exp)', ConditionExpression: 'attribute_not_exists(n) OR n < :lim', ExpressionAttributeValues: { ':one': { N: '1' }, ':lim': { N: String(limit) }, ':exp': { N: String(expSec) } }, ReturnValues: 'UPDATED_NEW' }));
        return { ok: true, n: Number(r.Attributes?.n?.N || 1) };
      } catch (e) { if (failed(e)) return { ok: false, n: limit }; throw e; }
    },
    async cooldown(key, untilSec, now) {
      const { PutItemCommand, GetItemCommand } = await init();
      try { await ddb.send(new PutItemCommand({ TableName: table, Item: { pk: { S: key }, until: { N: String(untilSec) }, exp: { N: String(untilSec + 60) } }, ConditionExpression: 'attribute_not_exists(pk) OR #u <= :now', ExpressionAttributeNames: { '#u': 'until' }, ExpressionAttributeValues: { ':now': { N: String(Math.floor(now / 1000)) } } })); return { ok: true }; }
      catch (e) { if (!failed(e)) throw e; const g = await ddb.send(new GetItemCommand({ TableName: table, Key: { pk: { S: key } }, ConsistentRead: true })); return { ok: false, until: Number(g.Item?.until?.N || Math.ceil(now / 1000) + 1) }; }
    },
  };
}

/**
 * check({player, ip, regen}) consumes quota for ONE upstream generation, or says why not.
 * Returns {ok:true} | {ok:false, reason:'rate_limited'|'daily_cap'|'budget', retryAfter:seconds, scope}.
 * Order: cooldown (cheap, regen only) -> per-player regen cap -> per-player total -> per-IP -> global breaker.
 * Store errors fail CLOSED for the global breaker's sake (reason 'budget'), so an outage can't turn into unlimited spend.
 */
export function createLimiter({ store, cfg = STORY_LIMIT_DEFAULTS, now = Date.now } = {}) {
  return {
    cfg, store, // store is shared with the speech scorer's own counters (server/npc_speech.mjs)
    async check({ player, ip, regen }) {
      const t = now(), day = dayOf(t), mid = secsToMidnight(t), exp = Math.floor(t / 1000) + mid + 3600;
      const daily = (scope) => ({ ok: false, reason: 'daily_cap', retryAfter: mid, scope });
      try {
        if (regen) {
          if (cfg.regenPerDay <= 0) return daily('regen');
          const cd = await store.cooldown('cd#' + player, Math.floor(t / 1000) + cfg.regenCooldownSec, t);
          if (!cd.ok) return { ok: false, reason: 'rate_limited', retryAfter: Math.max(1, cd.until - Math.floor(t / 1000)), scope: 'cooldown' };
          if (!(await store.take('rg#' + day + '#' + player, cfg.regenPerDay, exp, t)).ok) return daily('regen');
        }
        if (!(await store.take('pl#' + day + '#' + player, cfg.genPerDay, exp, t)).ok) return daily('player');
        if (!(await store.take('ip#' + day + '#' + ip, cfg.ipPerDay, exp, t)).ok) return daily('ip');
        if (!(await store.take('gl#' + day, cfg.globalPerDay, exp, t)).ok) return { ok: false, reason: 'budget', retryAfter: mid, scope: 'global' };
        return { ok: true };
      } catch { return { ok: false, reason: 'budget', retryAfter: 60, scope: 'store_error' }; }
    },
  };
}
