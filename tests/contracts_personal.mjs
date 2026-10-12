// Personal contracts (docs/CONTRACTS.md): generation from tested pieces for varied characters, validation (and tamper rejection),
// server request/output checks (AI may only pick valid ids and write words), progression sweep on every used template,
// and completability: the balance bot plays real contracts to completion in the browser. Needs the dev server for the browser part.
import { createServer } from 'vite'; import { build } from 'esbuild'; import fs from 'fs'; import path from 'path'; import os from 'os';
import { sanitizeContractReq, validatePicks, CAT } from '../server/contract_pick.mjs';
import { createStoryService } from '../server/story_beat.mjs';
import { createLimiter, memoryStore, STORY_LIMIT_DEFAULTS as D } from '../server/story_limits.mjs';
const full = process.argv.includes('--full');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const vs = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' }); const L = (m) => vs.ssrLoadModule(m);
const PC = await L('/src/pcontracts.ts'), M = await L('/src/npcmem.ts'), DG = await L('/src/content/dungeons.ts');
const NOW = Date.UTC(2026, 9, 12, 15);
const base = (o = {}) => ({ level: 15, credits: 500, items: [], installed: {}, rep: { HI: 0, PS: 0, MM: 0 }, humanity: 75, cleared: {}, lockouts: {}, lastClearDay: null, world: { visited: {}, landmarks: {} }, ...o });
const tr = (id) => ({ v: 1, runs: [], cur: null, l10: { id, at: 1, level: 10 }, l20: null, offer: null, hinted: {} });
const ALL = () => Object.fromEntries(DG.DUNGEON_IDS.map(i => [i, 1]));
const chars = {
  fresh: base({ level: 3 }), mid: base({ level: 15, cleared: { annex: 1 } }), hacker: base({ level: 22, cleared: { annex: 1, warehouse: 1 }, traits: tr('netrunner') }),
  brute: base({ level: 30, humanity: 20, rep: { HI: 40, PS: 0, MM: -10 }, cleared: ALL(), traits: tr('bruiser') }),
  rival: base({ level: 14, cleared: { annex: 1, warehouse: 1, foundry: 1 }, nemesis: { list: [{ boss: 'overseer', dungeon: 'annex', name: 'Overseer Prime' }] } }),
  endgame: base({ level: 48, humanity: 95, cleared: ALL() }) };
for (let i = 0; i < 4; i++) M.remember(chars.endgame, 'odalys_vane', 'helped', 'annex', NOW);
const capsSets = { none: new Set(), hack: new Set(['hack']), all: new Set(['hack', 'force', 'cloak', 'charm']) };
const used = new Set(); const all = [];
for (const [nm, s] of Object.entries(chars)) for (const [cn, caps] of Object.entries(capsSets)) {
  const c = PC.candidates(s, { caps, now: NOW }); const bad = c.map(x => [x.id, PC.validateContract(s, x, caps, NOW)]).filter(x => x[1].length);
  ok(c.length >= 1 && !bad.length, `${nm}/${cn}: ${c.length} candidates, all valid ${bad.length ? JSON.stringify(bad.slice(0, 2)) : ''} [${c.map(x => x.obj + ':' + x.tpl + (x.mods.length ? '+' + x.mods.join('+') : '')).join(', ')}]`);
  for (const x of c) { used.add(x.tpl); all.push({ nm, s, caps, c: x }); if (x.obj === 'condition' && !DG.DUNGEONS[x.tpl].conds.some(k => k.id === x.goal.key && caps.has(k.cap))) ok(false, `${nm}/${cn}: condition job without its cap`); }
}
ok(all.every(a => a.c.reward.credits <= PC.PC_CFG.creditCap && Object.values(a.c.reward.rep).every(v => v <= PC.PC_CFG.repMax)), 'rewards within caps (' + all.length + ' contracts)');
ok(PC.candidates(chars.rival, { caps: capsSets.none, now: NOW }).some(c => c.boss === 'overseer' && c.mods.includes('nemesis')), 'nemesis boss gets a personal job with the Rival tag');
ok(PC.candidates(chars.hacker, { caps: capsSets.hack, now: NOW }).some(c => c.obj === 'condition'), 'hacker trait + hack cap -> a wake-the-hidden-boss job');
ok(PC.candidates(chars.endgame, { caps: capsSets.none, now: NOW }).some(c => c.mods.includes('premium')) && PC.candidates(chars.brute, { caps: capsSets.none, now: NOW }).some(c => c.mods.includes('chrome')), 'trust -> Premium; low humanity -> Loud');
ok(PC.candidates(base({ level: 6 }), { caps: capsSets.none, now: NOW }).every(c => DG.DUNGEONS[c.tpl].minLevel - 4 <= 6) && PC.candidates(base({ level: 6 }), { caps: capsSets.none, now: NOW }).length > 0, 'level 6: only dungeons within the seal margin');
{ const s = base({ level: 20, cleared: { annex: 1, warehouse: 1 } }); M.remember(s, 'ten_hallowell', 'betrayed', 'x', NOW); M.remember(s, 'ten_hallowell', 'scammed', 'x', NOW); ok(!PC.candidates(s, { caps: capsSets.none, now: NOW }).some(c => c.giver === 'ten_hallowell'), 'a hostile contact offers nothing'); }
{ const s = base({ level: 15 }); const c = PC.candidates(s, { caps: capsSets.none, now: NOW })[0]; const v = (o) => PC.validateContract(s, { ...c, ...o }, capsSets.none, NOW);
  for (const [o, w] of [[{ reward: { ...c.reward, credits: c.reward.credits * 10 } }, 'inflated reward'], [{ mods: ['premium', 'nemesis'] }, 'unearned modifiers'], [{ boss: 'brannoch' }, 'boss from another dungeon'], [{ giver: 'noor_abiodun' }, 'wrong giver'], [{ tpl: 'nowhere' }, 'unknown template'], [{ goal: { ...c.goal, n: 999 } }, 'goal count'], [{ obj: 'assassinate' }, 'objective type'], [{ title: 'x'.repeat(60) }, 'title length'], [{ tpl: 'clinic', goal: { ...c.goal, dungeon: 'clinic' } }, 'locked template']])
    ok(v(o).length > 0, 'tampered contract rejected: ' + w + ' (' + v(o).join(',') + ')');
  const cond = DG.DUNGEONS.foundry.conds[0]; const s2 = base({ level: 22, cleared: { annex: 1 } }); const src = PC.candidates(s2, { caps: capsSets.all, now: NOW }).find(x => x.tpl === 'foundry');
  if (src) { const fake = { ...src, obj: 'condition', boss: cond.boss, kit: null, goal: { kind: 'condition', key: cond.id, dungeon: 'foundry', n: 1 }, mods: [] }; fake.reward = PC.rewardFor(s2, DG.DUNGEONS.foundry, 'condition', [], fake.giver); ok(PC.validateContract(s2, fake, capsSets.none, NOW).some(e => /condition|boss/.test(e)), 'condition job without the cap is invalid (never a hard block)'); } else ok(false, 'foundry candidate for cap test'); }
{ const s = base({ level: 15, cleared: { annex: 1 } }); const r = PC.refreshBoard(s, capsSets.none, NOW); ok(r.board.offers.length === 3 && r.board.offers.every(o => o.brief && o.src === 'rules'), 'board: 3 offers with canned briefs');
  const ids = r.cands.map(c => c.id);
  ok(!PC.applyPick(s, r.cands, [{ id: 'pc_fake', title: 'Fake job', brief: 'This is not one of the offered jobs at all.' }], capsSets.none, NOW) && PC.boardOf(s).offers[0].src === 'rules', 'AI pick outside the candidate set rejected');
  ok(!PC.applyPick(s, r.cands, [{ id: ids[0], title: 'x'.repeat(80), brief: 'ok ok ok ok ok ok ok ok' }], capsSets.none, NOW), 'AI pick with oversized title rejected');
  ok(PC.applyPick(s, r.cands, [{ id: ids[1], title: 'Quiet hands', brief: 'Clear the place and keep your head down. You are good at that.' }], capsSets.none, NOW) && PC.boardOf(s).offers[0].id === ids[1] && PC.boardOf(s).offers[0].src === 'ai' && PC.boardOf(s).offers[0].reward.credits === r.cands[1].reward.credits, 'valid AI pick applied; reward still the rules reward');
  const a = PC.acceptPersonal(s, ids[1], capsSets.none, 4, NOW); ok(a.ok && s.contracts.active[ids[1]] === 0 && PC.contractDefOf(s, ids[1]).goal.dungeon, 'accept stores the def; shared contract machinery resolves it'); }
{ const s = base({ level: 15, cleared: { annex: 1 } }); const cands = PC.candidates(s, { caps: capsSets.none, now: NOW }); const reqC = cands.map(c => ({ id: c.id, tpl: c.tpl, obj: c.obj, boss: c.boss, mods: c.mods, giver: c.giver, n: c.goal.n }));
  const S = 'a'.repeat(24); const req = (o = {}) => ({ kind: 'contract_pick', session: S, player: S, candidates: reqC, player_facts: { level: 15, band: 'human', fams: ['hack'], rivals: [] }, ...o });
  ok(sanitizeContractReq(req()).ok, 'server accepts rules-built candidates (' + reqC.length + ')');
  ok(!sanitizeContractReq(req({ candidates: [{ ...reqC[0], boss: 'brannoch' }] })).ok && !sanitizeContractReq(req({ candidates: [{ ...reqC[0], tpl: 'moon_base' }] })).ok && !sanitizeContractReq(req({ candidates: [{ ...reqC[0], mods: ['godmode'] }] })).ok && !sanitizeContractReq(req({ candidates: [{ ...reqC[0], giver: 'pell_okafor' }] })).ok, 'server rejects candidates whose pieces do not fit (catalog check)');
  ok(Object.keys(CAT.dungeons).length === DG.DUNGEON_IDS.length, 'server contract catalog generated from game data');
  ok(validatePicks(JSON.stringify({ picks: [{ id: 'pc_zzz', title: 'Nope', brief: 'Not offered to you at all, sorry.' }] }), reqC.map(c => c.id), x => x) === null, 'model pick outside the set -> null');
  let reply = ''; const sent = []; const fetch = async (u, i) => { sent.push(JSON.parse(i.body)); return { ok: true, json: async () => ({ choices: [{ message: { content: reply } }] }) }; };
  const mk = (cfg = D) => createStoryService({ env: { OPENAI_API_KEY: 'test' }, fetch, limiter: createLimiter({ store: memoryStore(), cfg }) });
  reply = JSON.stringify({ picks: [{ id: reqC[0].id, title: 'Old friends', brief: 'You know that place better than anyone I hire. Go and finish it.' }] });
  const r = await mk().handle(req(), { ip: '1' }); ok(r.json.src === 'ai' && r.json.picks[0].id === reqC[0].id && !/credit|reward/i.test(sent[0].messages[1].content), 'model sees pieces by name, never rewards; valid pick returned');
  ok(sent[0].response_format?.json_schema?.strict === true, 'strict JSON schema for contract picks');
  reply = JSON.stringify({ picks: [{ id: reqC[0].id, title: 'Deal', brief: 'Bring me a crate of pills and I double your pay.' }] }); const r2 = await mk().handle(req(), { ip: '2' });
  ok(r2.json.ok && r2.json.src === 'canned', 'briefing with banned content -> canned (client keeps rules offers)');
  const r3 = await mk({ ...D, genPerDay: 0 }).handle(req({ player_facts: { level: 16, band: 'human', fams: [], rivals: [] } }), { ip: '3' }); ok(r3.json.src === 'canned' && r3.json.reason === 'daily_cap', 'shares story_limits caps -> canned'); }
await vs.close();
{ const out = path.join(os.tmpdir(), 'wv_pc_' + process.pid + '.mjs'); await build({ entryPoints: [new URL('./progression/structure.ts', import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', loader: { '.png': 'empty', '.jpg': 'empty', '.json': 'json' } });
  const { sweep } = await import(out); fs.unlinkSync(out); const rows = sweep([1, 4053]).filter(r => used.has(r.id)); const bad = rows.filter(r => r.issues.length);
  ok(rows.length >= used.size && !bad.length, `progression sweep clean on all ${used.size} contract templates ${bad.slice(0, 2).map(r => r.id + ':' + r.issues[0]).join(' | ')}`); }
const { launch, URL: TURL } = await import('./lib.mjs'); let up = false; try { up = (await fetch(TURL)).ok; } catch {}
if (!up) console.log('SKIP bot completability: dev server not running at ' + TURL);
else { const { runJob } = await import('../tools/balance/harness.mjs');
  const pickObj = (o, t) => all.find(a => a.c.obj === o && (!t || a.c.tpl === t) && a.caps.size === 0);
  const jobs = [pickObj('clear', 'annex'), pickObj('cull'), pickObj('boss'), pickObj('salvage')].filter(Boolean); if (full) for (const a of all.filter(a => a.caps.size === 0)) if (!jobs.some(j => j.c.tpl === a.c.tpl)) jobs.push(a);
  for (const j of jobs) { const f = await launch({ query: '?splash=hold' }); try {
    const c = j.c; const dd = DG.DUNGEONS[c.tpl]; const tier = dd.tier || 0; const lvl = Math.min(dd.maxLevel, Math.max(dd.minLevel + 8, [15, 18, 26, 35, 44][tier] || 18)); // in the dungeon's own band (the bot's kit loadout varies by level)
    await f.page.evaluate(async (c) => { const g = window.__game; const St = await import('/src/state.ts'); const cs = St.contractState(g.save); cs.active = {}; (g.save.pcon ??= { v: 1, day: '', offers: [], defs: {}, n: 0 }).defs[c.id] = c; cs.active[c.id] = 0; }, c);
    // same kits/levels the progression sweep's bot uses; a second seed only if the naive bot itself dies out (that is a bot-skill miss, not a blocked contract)
    let res; for (const seed of [4000, 4106]) { res = await f.page.evaluate(runJob, { mode: 'level', id: c.tpl, kit: ['mid', 'mid', 'blue', 'purple', 'purple'][tier] || 'mid', level: lvl, seed, maxT: 1100, maxDeaths: 4 }); if (res.cleared) break; }
    // the bot fights but never detours for loot: walk the player over every remaining drop (salvage jobs) the way a player would
    const after = await f.page.evaluate(id => { const g = window.__game; for (const d of [...(g.inst?.drops || [])]) { if (d.kind === 'credits') continue; g.px = d.x; g.py = d.y; g.update(0.05); } return g.save.contracts.active[id]; }, c.id);
    ok(after >= c.goal.n && (res.cleared || c.obj === 'cull' || c.obj === 'salvage'), /* cull/salvage don't need the boss: reaching the count is the job */ `bot completes ${c.obj} contract in ${c.tpl} (${after}/${c.goal.n}, cleared ${res.cleared}, ${res.t}s)`);
  } finally { await f.browser.close(); } }
  const { browser, page, errors } = await launch({ query: '?splash=hold' });
  const u = await page.evaluate(async () => { document.getElementById('splash')?.remove(); const g = window.__game; g.enterTown(true); g.save.level = 14; g.save.cleared = { annex: 1, warehouse: 1 }; g.save.nemesis = { list: [{ boss: 'overseer', name: 'Overseer Prime' }] }; g.save.pcon = null; window.__ui.open('fixer'); await new Promise(r => setTimeout(r, 300));
    const rows = [...document.querySelectorAll('.pcrow')]; const tags = [...document.querySelectorAll('.pcblock .tag')].map(t => t.textContent); const b = document.querySelector('[data-act=pc-accept]'); const id = b?.dataset.id; b?.click(); await new Promise(r => setTimeout(r, 200)); return { n: rows.length, id, active: !!id && id in (g.save.contracts?.active || {}), tags }; });
  ok(u.n === 3 && u.active, 'job board lists 3 personal jobs; Take accepts one (' + u.tags.join(',') + ')');
  await page.evaluate(() => document.querySelector('.pcblock')?.scrollIntoView()); await page.screenshot({ path: 'shots/contracts/job_board.png' });
  ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|')); await browser.close(); }
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
