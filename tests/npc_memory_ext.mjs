// NPC memory extensions (docs/NPC_MEMORY.md): per-character isolation through the roster, gifts/deaths/dropped jobs,
// the "Second shot" contract modifier, deterministic generation, and AI-off fallback. Node only, no network.
import { createServer } from 'vite';
import { createStoryService } from '../server/story_beat.mjs';
import { createLimiter, memoryStore, STORY_LIMIT_DEFAULTS as D } from '../server/story_limits.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const vs = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' }); const L = (m) => vs.ssrLoadModule(m);
const M = await L('/src/npcmem.ts'), PC = await L('/src/pcontracts.ts'), CH = await L('/src/chars.ts'), ST = await L('/src/state.ts');
const NOW = Date.UTC(2026, 9, 12, 15);
const mk = (o = {}) => ({ level: 15, credits: 1000, items: [], installed: {}, rep: { HI: 0, PS: 0, MM: 0 }, humanity: 80, ...o });
// per-character persistence via the real roster
{ const store = new Map(); const kv = { get: k => store.get(k) ?? null, set: (k, v) => store.set(k, v), del: k => store.delete(k) };
  const fresh = () => ({ ...ST.newSave() });
  CH.ensureRoster(kv); const a = CH.createChar('Ann', fresh, kv), b = CH.createChar('Bo', fresh, kv); ok(a.ok && b.ok, 'two characters created');
  CH.selectChar(a.id, kv); const sa = JSON.parse(CH.activeRaw(kv)); M.remember(sa, 'odalys_vane', 'betrayed', 'annex', NOW); CH.saveActive(JSON.stringify(sa), sa, kv);
  CH.selectChar(b.id, kv); const sb = JSON.parse(CH.activeRaw(kv)); ok(M.memFor(sb, 'odalys_vane').length === 0, 'character B does not inherit A\'s memories');
  CH.selectChar(a.id, kv); const sa2 = JSON.parse(CH.activeRaw(kv)); ok(M.memFor(sa2, 'odalys_vane').some(e => e.k === 'betrayed'), 'character A memory survives save/load round trip'); }
// gifts
{ const s = mk({ level: 10 }); const c = M.giftCost(s); ok(c === 40 + 8 * 10, 'gift cost by formula (' + c + ')');
  ok(M.giveGift(s, 'vendor_rustline', NOW) === null && s.credits === 1000 - c, 'gift spends credits and is remembered');
  ok(M.memFor(s, 'vendor_rustline').some(e => e.k === 'gift'), 'gift memory recorded'); ok(M.giveGift(s, 'vendor_rustline', NOW + 1000) !== null, 'one gift per NPC per day');
  ok(M.giveGift(mk({ credits: 5 }), 'vendor_rustline', NOW) !== null, 'no gift without credits'); ok(M.giveGift(s, 'not_an_npc', NOW) === 'unknown', 'unknown NPC rejected');
  ok(M.priceMul(s, 'vendor_rustline', NOW) < 1, 'gift goodwill lowers prices (bounded)'); }
// deaths witnessed: once per run, line references place
{ const s = mk(); M.memOnDown(s, { id: 'annex', fixer: 'odalys_vane' }, 'run1', NOW); M.memOnDown(s, { id: 'annex', fixer: 'odalys_vane' }, 'run1', NOW + 1);
  ok(M.memFor(s, 'odalys_vane').filter(e => e.k === 'witnessed_death').length === 1, 'death witnessed once per run');
  const ln = M.memLine(s, 'odalys_vane', k => k === 'annex' ? 'the Annex' : k, NOW); ok(ln.kind === 'witnessed_death' && /the Annex/.test(ln.text), 'line references the death: ' + ln.text);
  const ln2 = M.memLine(s, 'odalys_vane', k => k === 'annex' ? 'the Annex' : k, NOW); ok(ln.text === ln2.text, 'reference lines are deterministic'); }
// dungeon speech nodes feed the faction crew
{ const s = mk(); M.memOnSpeech(s, 'HI', 'bribe', true, NOW); M.memOnSpeech(s, 'HI', 'standdown', false, NOW); M.memOnSpeech(s, 'XX', 'bribe', true, NOW);
  const k = M.memFor(s, 'guard_HI').map(e => e.k); ok(k.includes('bribed') && k.includes('speech_failed') && M.memOf(s).log.length === 2, 'speech node outcomes remembered by faction crew only'); }
// contracts: deterministic + Second shot from history, never restrictive
{ const caps = new Set(); const s = mk({ level: 6, cleared: {} }); const a = JSON.stringify(PC.candidates(s, { caps, now: NOW, salt: 1 })), b = JSON.stringify(PC.candidates(s, { caps, now: NOW, salt: 1 }));
  ok(a === b && a.length > 2, 'contract candidates deterministic for (save, day, salt)');
  const c0 = PC.candidates(s, { caps, now: NOW, salt: 1 }); const tpl = c0[0]?.tpl; const giver = c0[0]?.giver;
  M.remember(s, giver, 'failed_job', tpl, NOW); const c1 = PC.candidates(s, { caps, now: NOW, salt: 1 }).filter(c => c.tpl === tpl);
  ok(c1.length && c1.every(c => c.mods.includes('redeem')), 'dropped job -> "Second shot" modifier on that place (' + tpl + ')');
  ok(c1.every(c => PC.validateContract(s, c, caps, NOW).length === 0), 'Second shot contracts validate');
  ok(c1.every(c => c.reward.credits <= PC.PC_CFG.creditCap), 'reward stays rules-computed and capped'); }
// real nemesis records (src/nemesis.ts shape: src/body, status, dungeon) feed Rival jobs; dead ones don't
{ const caps = new Set(); const s = mk({ level: 8, cleared: { annex: 1 }, nemesis: { v: 1, list: [{ id: 'n1', src: 'overseer', body: 'x', name: 'Overseer Prime', status: 'active', dungeon: 'annex' }] } });
  const c = PC.candidates(s, { caps, now: NOW, salt: 1 }); ok(c.some(x => x.tpl === 'annex' && x.mods.includes('nemesis')) && c.filter(x => x.mods.includes('nemesis')).every(x => PC.validateContract(s, x, caps, NOW).length === 0), 'active nemesis -> valid Rival jobs where it lives');
  s.nemesis.list[0].status = 'dead'; ok(!PC.candidates(s, { caps, now: NOW, salt: 1 }).some(x => x.mods.includes('nemesis')), 'dead nemesis -> no Rival tag'); }
// AI off: no key and global cap -> canned, never an outcome
{ const svc = createStoryService({ env: { OPENAI_API_KEY: '' }, limiter: createLimiter({ store: memoryStore(), cfg: D }), now: () => NOW });
  const r = await svc.handle({ kind: 'npc_intent', session: 'a'.repeat(24), player: 'b'.repeat(24), npc: 'guard_MM', role: 'guard', situation: 'standdown', trust: 'neutral', band: 'human', mem: ['gift', 'witnessed_death'], text: 'Please, I just want to go home' }, { ip: '1' });
  ok(r.json.src === 'canned' && !('ok_roll' in r.json) && !('outcome' in r.json), JSON.stringify(r.json).slice(0,0)+'AI off -> canned intent, new memory kinds accepted, no outcome in reply (' + r.json.intent + ')'); }
await vs.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
