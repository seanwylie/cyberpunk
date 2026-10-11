// Balance-harness coverage for abilities: the augment-ability kits (abmid / abpurple) must clear dungeons in a similar band to the legacy kits (abilities should help, not break or trivialise the game).
import { launch } from './lib.mjs'; import { runJob } from '../tools/balance/harness.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const job = (kit, level, id, seed) => ({ mode: 'level', id, kit, level, seed, maxT: 900, maxDeaths: 4 });
const R = {}; for (const [kit, lvl, id] of [['mid', 16, 'annex'], ['abmid', 16, 'annex'], ['purple', 32, 'foundry'], ['abpurple', 32, 'foundry']]) { R[kit] = []; for (const seed of [1001, 1078]) R[kit].push(await page.evaluate(runJob, job(kit, lvl, id, seed))); }
const sum = a => ({ cleared: a.filter(r => r.cleared || r.completed || r.result === 'clear').length, t: a.reduce((s, r) => s + (r.t || 0), 0) / a.length, deaths: a.reduce((s, r) => s + (r.deaths || 0), 0) / a.length, abil: a[0]?.kitInfo?.abilities });
const S = Object.fromEntries(Object.entries(R).map(([k, v]) => [k, sum(v)])); console.log(JSON.stringify(S)); console.log(JSON.stringify(R.abmid[0]).slice(0, 600));
for (const [legacy, ab] of [['mid', 'abmid'], ['purple', 'abpurple']]) {
  ok(S[ab].abil.some(a => !['sweep', 'brace', 'forcedcool', 'cloak', 'bladeburst', 'reposition', 'control', 'pulse', 'revive', 'defib'].includes(a)), `${ab} kit binds augment abilities: ${S[ab].abil}`);
  ok(R[ab].every(r => !r.err), `${ab}: harness runs complete without errors`);
  ok(S[ab].t > S[legacy].t * .25 && S[ab].t < S[legacy].t * 1.8 + 60 && S[ab].cleared >= S[legacy].cleared, `${ab} clears at least as often as ${legacy} and is not trivial: ${S[ab].t.toFixed(0)}s vs ${S[legacy].t.toFixed(0)}s (>= 0.25x)`);
  ok(S[ab].deaths <= S[legacy].deaths + 2, `${ab} deaths ${S[ab].deaths.toFixed(1)} vs ${legacy} ${S[legacy].deaths.toFixed(1)}`);
}
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 3).join('|'));
await browser.close(); process.exit(fails ? 1 : 0);
