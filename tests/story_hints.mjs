// Useful story lines: every generated or canned line references a REAL mechanic of the recommended next job's boss (docs/BOSSES.md kits),
// with its counter; the proxy only accepts validated hint ids and rejects AI lines that skip the mechanic. Catalog stays in sync with game data.
import { createServer } from 'vite';
import { createStoryService, sanitizeSummary, promptFacts, CATALOG, SYSTEM_PROMPT } from '../server/story_beat.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const vs = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const H = await vs.ssrLoadModule('/src/content/story_hints.ts'), K = await vs.ssrLoadModule('/src/content/boss_kits.ts'), St = await vs.ssrLoadModule('/src/state.ts'), D = await vs.ssrLoadModule('/src/content/dungeons.ts');
const kws = Object.values(H.MECH_HINT).map(m => m.keyword); ok(new Set(kws).size === kws.length && Object.keys(H.MECH_HINT).length === Object.keys(K.MECH_INFO).length, 'every mechanic has a unique hint keyword and a counter');
ok(Object.entries(K.KITS).every(([id, k]) => JSON.stringify(CATALOG.bosses[id]?.mechs) === JSON.stringify(k.mechs.map(m => m.m))), 'catalog boss kits match src/content/boss_kits.ts (else: node tools/gen_story_ids.mjs)');
const stats = { maxHp: 100, dmg: 1, atkSpeed: 1, cooling: 1, move: 1, pickup: 1, regen: 0, armor: 0 };
let n = 0, good = 0;
for (const lvl of [1, 10, 15, 20, 25, 30, 40, 55]) for (let v = 0; v < 3; v++) {
  const s = St.newSave ? St.newSave() : St.defaultSave?.(); if (!s) break; s.level = lvl; s.cleared = Object.fromEntries(D.DUNGEON_IDS.filter((_, i) => i < lvl / 6).map(id => [id, 1]));
  const h = H.buildHint(s, stats, { ...stats, move: 1.3 }, { variant: v, result: v ? 'Left the run early' : 'Boss defeated' });
  const kit = K.KITS[h.boss]; const line = H.cannedHint(h, v); n++;
  const real = kit && kit.mechs.some(m => m.m === h.mech) && H.bossOf(h.dungeon) === h.boss;
  const M = H.MECH_HINT[h.mech]; const low = line.toLowerCase(); const mentions = low.includes(M.keyword) && low.includes(M.counter.slice(0, 18).toLowerCase()); if (v === 0 && lvl % 20 === 0) console.log('  e.g. L' + lvl + ': ' + line);
  if (real && mentions && line.length <= 220 && sanitizeSummary({ trigger: 'return_town', town: 'rustline', level: lvl, session: 'a1b2c3d4e5f60718', installed: [], rep: { HI: 0, PS: 0, MM: 0 }, hint: h }).ok) good++; else console.log('  bad', lvl, v, h, line);
}
ok(n > 0 && good === n, `canned lines (${good}/${n} saves x variants) name a real next-boss mechanic + its counter, fit 220 chars, and the hint passes server validation`);
{ const s = St.newSave ? St.newSave() : St.defaultSave(); s.level = 12; const h = H.buildHint(s, stats, { ...stats, move: 1.3 }); ok(h.gap === H.MECH_HINT[h.mech].need, 'gear gap: a stat no better than stock against the mechanic need is flagged'); const h2 = H.buildHint(s, { ...stats, move: 2, maxHp: 400, dmg: 3 }, stats); ok(h2.gap === 'none', 'no gap when gear beats stock'); }
// server: facts + output must reference the mechanic
const job = Object.entries(CATALOG.jobs).find(([, j]) => j.rewards.length); const [jid, J] = job; const mech = CATALOG.bosses[J.boss].mechs[0]; const kw = CATALOG.mechs[mech].keyword;
const body = { trigger: 'return_town', town: 'rustline', level: 12, session: 'a1b2c3d4e5f60718', installed: [], rep: { HI: 0, PS: 0, MM: 0 }, hint: { dungeon: jid, mech, gap: 'none', fail: 'left', reward: J.rewards[0] } };
const f = promptFacts(sanitizeSummary(body).summary); ok(f.hint && f.hint.boss === CATALOG.bosses[J.boss].name && f.hint.keyword === kw && f.hint.counter === CATALOG.mechs[mech].counter && f.hint.reward_lead && f.hint.last_run === 'left before the boss', 'prompt facts: next job boss, mechanic keyword, real counter, reward lead, last run result');
ok(/hint\.keyword/.test(SYSTEM_PROMPT) && /never invent mechanics/.test(SYSTEM_PROMPT), 'system prompt demands one actionable tip from the facts only');
const bad = (h, m) => ok(!sanitizeSummary({ ...body, hint: { ...body.hint, ...h } }).ok, 'rejects hint with ' + m);
const other = Object.keys(CATALOG.mechs).find(m => !CATALOG.bosses[J.boss].mechs.includes(m));
bad({ mech: other }, 'a mechanic that boss does not have'); bad({ dungeon: 'nowhere' }, 'unknown job'); bad({ gap: 'luck' }, 'unknown gap'); bad({ reward: 'stock_torso' }, 'reward not in that boss pool'); bad({ fail: 'free text' }, 'free-text fail reason');
const mkS = (txt) => createStoryService({ env: { OPENAI_API_KEY: 'k' }, limiter: null, fetch: async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: txt } }] }) }) });
let r = await mkS('You did fine out there. Get some rest before the next one.').handle(body, { ip: '1.1.1.1' }); ok(!r.json.ok && r.json.reason === 'rejected_output', 'AI line that skips the mechanic is rejected (client uses the canned hint line)');
r = await mkS(`Next job, watch the ${kw}. ${CATALOG.mechs[mech].counter[0].toUpperCase() + CATALOG.mechs[mech].counter.slice(1)}.`.slice(0, 200)).handle(body, { ip: '1.1.1.2' });
ok(r.json.ok && r.json.text.toLowerCase().includes(kw) && r.json.hint?.keyword === kw && r.json.hint.mech === mech, 'AI line naming the real mechanic is accepted and tagged with the hint keyword');
await vs.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
