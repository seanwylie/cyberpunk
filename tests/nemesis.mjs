// Nemesis bosses (docs/NEMESIS.md): creation, persistence (per character), adaptation, caps, hierarchy, permanent kill, trophy provenance,
// AI words validation, voice fallback, live sim hooks (death -> nemesis -> returns in a later run -> killed for good). Needs the dev server.
import { launch } from './lib.mjs'; import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// ---- server side (node): request sanitizer, output validator, limiter -> canned ----
{ const S = await import('../server/nemesis_words.mjs'); const sess = 'a'.repeat(24);
  ok(!S.sanitizeNemReq({ kind: 'nemesis_words', session: sess, enemy: 'Bad Id!', cat: 'melee', tier: 'stalker' }).ok && !S.sanitizeNemReq({ kind: 'nemesis_words', session: sess, enemy: 'foreman', cat: 'nuke', tier: 'stalker' }).ok, 'server rejects malformed nemesis requests');
  ok(S.validateWords('{"name":"Vesk the Tailor","taunt":"You folded like cheap cloth."}')?.name === 'Vesk the Tailor', 'server accepts a clean name + taunt');
  ok(S.validateWords('{"name":"X9000","taunt":"ok"}') === null && S.validateWords('{"name":"Vesk","taunt":"You lost 30% of your hp."}') === null && S.validateWords('not json') === null, 'server rejects digits / stats / garbage output');
  const h = S.createNemesisWords({ limiter: { check: async () => ({ ok: false, reason: 'budget' }) }, call: async () => { throw new Error('must not be called'); } });
  const r = await h({ kind: 'nemesis_words', session: sess, enemy: 'foreman', cat: 'melee', tier: 'stalker' }); ok(r.status === 200 && r.json.src === 'canned', 'story_limits deny -> canned words, no model call');
  const h2 = S.createNemesisWords({ limiter: { check: async () => ({ ok: true }) }, call: async () => ({ text: '{"name":"Rue Cold Hands","taunt":"Your arm still twitches on my belt."}' }) });
  const r2 = await h2({ kind: 'nemesis_words', session: sess, enemy: 'foreman', cat: 'melee', tier: 'stalker' }); ok(r2.json.src === 'ai' && r2.json.name === 'Rue Cold Hands', 'model words pass through the validator'); }

const { browser, page, errors } = await launch({ init: () => { window.__WV_FEATURES = { nemesis: true, nemesisVoice: true, moments: false, momentClip: false }; } }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove());
const r = await ev(async () => { const N = await import('/src/nemesis.ts'); const o = {};
  const prof = (p) => ({ hack: 0, burst: .2, kite: 0, main: 'kinetic', ...p }); const K = (p = {}) => ({ type: 'overseer', attack: 'slam', boss: true, elite: true, mfr: 'MM', dungeon: 'annex', name: 'Annex Overseer', ...p });
  const C = (p = {}) => ({ seed: 1234, profile: prof(), trophy: { def: 'x', name: 'Shard Arm', rarity: 'purple', slot: 'armL' }, owner: 'Vex', body: 'foreman', now: 1000, ...p });
  const s = { level: 12 }; const c1 = N.onPlayerKilled(s, K(), C()); o.created = c1.kind; o.rec = c1.rec;
  o.trash = N.onPlayerKilled({ level: 5 }, K({ type: 'worker', boss: false, elite: false }), C()).kind;
  // persistence: JSON round trip keeps the record; another character's save is untouched
  const s2 = JSON.parse(JSON.stringify(s)); o.persist = N.nemOf(s2).list[0]?.name === c1.rec.name && N.nemOf(s2).list[0].trophy.name === 'Shard Arm'; const other = { level: 12 }; o.otherEmpty = N.nemOf(other).list.length === 0;
  // adaptation
  o.hack = N.adapt(prof({ hack: .6 }), 1).modules[0]; o.burst = N.adapt(prof({ burst: .8 }), 1).modules[0]; o.kite = N.adapt(prof({ kite: .7 }), 1).modules[0]; o.res = N.adapt(prof({ main: 'blade' }), 1);
  o.r5 = N.adapt(prof({ hack: .6, burst: .8, kite: .7 }), 5).modules.length; o.r1 = N.adapt(prof({ hack: .6, burst: .8, kite: .7 }), 1).modules.length;
  // promotion + caps: keep dying to it
  const id = c1.rec.id; const kinds = []; for (let i = 0; i < 12; i++) kinds.push(N.onPlayerKilled(s, K({ nemId: id }), C({ profile: prof({ hack: .5, burst: .7 }) })).kind);
  const n = N.nemOf(s).list[0]; o.kinds = kinds; o.rank = n.rank; o.tier = n.tier; o.kills = n.kills;
  const st = N.nemStats(n, 300, 2000); o.st = st; const big = N.nemStats({ ...n, rank: 99, modules: ['shield', 'resist', 'counter_intrusion', 'gap_closer', 'godmode'], recruits: 50 }, 300, 2000); o.big = big;
  const tiny = N.nemStats({ ...n, rank: 5 }, 300, 350); o.bossCap = tiny.hp <= 300 * N.NEM_CFG.hpCap && tiny.hp >= 300;
  // hierarchy full -> recruit
  const h = { level: 20 }; for (let i = 0; i < 3; i++) N.onPlayerKilled(h, K({ type: 'b' + i }), C({ seed: 77 + i })); const rc = N.onPlayerKilled(h, K({ type: 'b9' }), C({ seed: 99 })); o.recruit = rc.kind; o.activeH = N.activeNems(h).length;
  // permanent kill + provenance
  const t = N.onNemesisKilled(s, id, 5000); o.line = t.line; o.again = N.onNemesisKilled(s, id); o.status = N.nemOf(s).list[0].status;
  let picked = 0; for (let sd = 0; sd < 300; sd++) if (N.pickForRun(s, sd)) picked++; o.pickedDead = picked; o.revive = N.onPlayerKilled(s, K({ nemId: id }), C()).kind;
  o.pub = N.publicTrophies(s);
  // AI words validation
  const w = { ...c1.rec }; o.wBad = N.applyWords(w, { name: 'X 9', taunt: 'x' }); o.wDrug = N.applyWords(w, { name: 'Pill Dealer', taunt: 'Hello there runner.' }); o.wOk = N.applyWords(w, { name: 'Rue Cold Hands', taunt: 'Your arm still twitches on my belt.' }); o.wName = w.name; o.wKey = w.tauntKey;
  // build export carries the public trophy, decode validates it
  const B = await import('/src/buildcode.ts'); const g = window.__game; const sv = g.save; sv.nemesis = s.nemesis; const code = B.encodeBuild(B.exportBuild(sv)); const d = B.decodeBuild(code); o.exportTrophy = d.ok && d.build.trophies?.[0]?.l; o.text = d.ok && B.buildText(d.build).includes('Trophies:'); delete sv.nemesis;
  return o; });
ok(r.created === 'created' && r.rec.name.split(' ').length >= 2 && r.rec.trophy.name === 'Shard Arm' && r.rec.taunt.length > 10 && r.rec.tauntKey.startsWith('slam_'), `boss kill creates a nemesis with name, trophy and a taunt about how it killed you: ${r.rec.name} — "${r.rec.taunt}"`);
ok(r.trash === 'none', 'a plain mob kill never makes a nemesis');
ok(r.persist && r.otherEmpty, 'nemesis state persists through a save round trip and is per character');
ok(r.hack === 'counter_intrusion' && r.burst === 'shield' && r.kite === 'gap_closer' && r.res.resist === 'blade' && r.res.modules.includes('resist'), `adaptation picks tested counter-modules: hack->${r.hack}, burst->${r.burst}, kite->${r.kite}, main blade->resist ${r.res.resist}`);
ok(r.r1 === 1 && r.r5 === 3, `module count bounded by rank (rank1 ${r.r1}, rank5 ${r.r5})`);
ok(r.rank === 5 && r.tier === 'warlord' && r.kinds.includes('promoted') && r.kills === 13, `repeat kills climb in bounded steps: rank ${r.rank}/5, tier ${r.tier}, promotions seen`);
ok(r.big.hp <= 300 * 1.5 + 1e-6 && r.big.dmgMul <= 1.25 && r.big.resist <= .3 && r.big.shield <= .3 && r.big.escorts <= 2 && r.bossCap, `tampered rank 99 / unknown modules still clamp: ${JSON.stringify(r.big)}`);
ok(r.recruit === 'recruited' && r.activeH === 3, 'hierarchy full (3) -> the strongest nemesis recruits instead of a 4th');
ok(r.line === 'Killed ' + r.rec.name + ', who killed you 13 times' && r.again === null && r.status === 'dead', 'permanent kill gives a provenance trophy line once: ' + r.line);
ok(r.pickedDead === 0 && r.revive === 'none', 'a dead nemesis never returns (300 seeds) and cannot be re-ranked');
ok(r.pub.length === 1 && r.exportTrophy === r.line && r.text, 'trophy is public: build export + text summary carry the provenance line');
ok(r.wBad === false && r.wDrug === false && r.wOk === true && r.wName === 'Rue Cold Hands' && r.wKey === '', 'AI words validated (digits / banned words rejected); custom taunt drops the cached voice key');
// ---- voice fallback ----
// flee: fleeing an engaged boss can mark a new nemesis (same caps), but never ranks up an existing one; deaths counter untouched
{ const f = await ev(async () => { const N = await import('/src/nemesis.ts'); const K = { type: 'overseer', attack: 'swing', boss: true, elite: true, mfr: 'MM', dungeon: 'annex', name: 'Annex Overseer' };
  const C = { seed: 77, profile: { hack: 0, burst: .2, kite: 0, main: 'kinetic' }, trophy: null, owner: 'Vex', body: 'foreman', now: 1 }; const s = {};
  const a = N.onPlayerKilled(s, K, C, true); const rank0 = a.rec?.rank; const b = N.onPlayerKilled(s, { ...K, nemId: a.rec?.id }, C, true);
  for (let i = 0; i < 20; i++) N.onPlayerKilled(s, { ...K, type: 'foreman' + i }, { ...C, seed: i }, true);
  return { a: a.kind, fled: a.rec?.fled, b: b.kind, rank: N.nemOf(s).list[0].rank, rank0, deaths: N.nemOf(s).deaths, active: N.activeNems(s).length, cap: N.NEM_CFG.maxActive }; });
  ok(f.a === 'created' && f.fled === true && f.deaths === 0, `fleeing an engaged boss marks a nemesis without counting a death (${f.a})`);
  ok(f.b === 'none' && f.rank === f.rank0, 'fleeing an existing nemesis never ranks it up (avoiding is always safe)');
  ok(f.active <= f.cap, `flee-made nemeses respect the per-character cap (${f.active}/${f.cap})`); }
const v = await ev(async () => { const V = await import('/src/nemesis_voice.ts'); const o = {}; const st = { volume: .5, sfxVol: 1 };
  window.__WV_FEATURES.nemesisVoice = false; o.off = await V.playTaunt('melee_1', st); window.__WV_FEATURES.nemesisVoice = true;
  V._resetVoice(); o.miss = await V.playTaunt('melee_1', st, { fetcher: async () => ({ ok: false }) });
  V._resetVoice(); o.throw = await V.playTaunt('melee_1', st, { fetcher: async () => { throw new Error('net'); } });
  V._resetVoice(); o.unknown = await V.playTaunt('nope_1', st); o.muted = await V.playTaunt('melee_1', { volume: 0 }); o.custom = await V.playTaunt('', st);
  V._resetVoice(); o.real = await V.playTaunt('melee_1', st); const m = await V.loadManifest(); o.n = Object.keys(m).length; return o; });
ok(v.off === 'text' && v.miss === 'text' && v.throw === 'text' && v.unknown === 'text' && v.muted === 'text' && v.custom === 'text', 'voice falls back to text: flag off, no manifest, network error, unknown line, muted, custom AI text');
ok(v.real === 'voice' && v.n >= 20, `cached ElevenLabs taunt plays (${v.n} clips in manifest)`);
// ---- live sim: death -> nemesis -> returns -> adapts -> killed for good -> trophy + moment event ----
const e2e = await ev(async () => { const g = window.__game; const N = await import('/src/nemesis.ts'); const evs = []; const oe = g.emit; g.emit = (t, p) => { if (t === 'nemesis' || t === 'moment') evs.push([t, p]); return oe.call(g, t, p); };
  const go = (seed) => { g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.level = 30; g.save.settings.devFreeReset = true; g.recompute(); return g.startRun('annex', seed); };
  delete g.save.nemesis; go(11); const elite = g.enemies.find(e => !e.dead && e.type === 'foreman') || g.enemies.find(e => !e.dead && window.__enemies[e.type].elite && !window.__enemies[e.type].boss);
  g.dmgSrc = elite.type + ':cleave'; g.px = elite.x + 1; g.py = elite.y; g.dealt = { auto: 50, cascade_arc: 400 }; let tries = 0; while (!N.activeNems(g.save).length && tries++ < 8) { g.downed = false; g.hp = 1; g.playerDown(); g.returnToCheckpoint(); g.save.stats.runs++; }
  const n = N.activeNems(g.save)[0]; if (n) { n.rank = 3; n.modules = ['resist', 'shield']; n.resist = 'tech'; } const out = { made: !!n, name: n?.name, ev: evs.find(e => e[0] === 'nemesis')?.[1]?.kind };
  // persisted to localStorage via the normal save path
  g.saveNow?.(); (await import('/src/state.ts')).persist(g.save); out.ls = JSON.stringify(JSON.parse(localStorage.getItem('arpg-proto-save-v1')).nemesis?.list?.[0]?.name) === JSON.stringify(n.name);
  let seed = 1, spawned = null; for (; seed < 200; seed++) { if (N.pickForRun(g.save, seed)) { go(seed); spawned = g.enemies.find(e => e.nem); if (spawned) break; } }
  out.spawned = !!spawned; out.label = spawned?.name; out.inCache = g._nems?.length >= 1; out.hpOk = spawned && spawned.maxHp <= window.__enemies[spawned.type].hp * g.hpMul() * 1.5 + 1e-6;
  g.update(0.05); out.init = !!spawned._rt.nemSt; out.mods = spawned._rt.nemSt;
  // resist: main type was tech (ability-heavy); compare a tech hit vs kinetic auto
  const hp0 = spawned.hp; g.curTag = 'cascade_arc'; spawned._rt.shield = null; g.hurtEnemy(spawned, 100, g.px, g.py); const dTech = hp0 - spawned.hp; const hp1 = spawned.hp; g.curTag = 'auto'; g.hurtEnemy(spawned, 100, g.px, g.py); const dAuto = hp1 - spawned.hp; out.dTech = dTech; out.dAuto = dAuto;
  g.killEnemy(spawned); out.status = N.nemOf(g.save).list.find(x => x.id === spawned.nem).status; out.trophy = N.nemOf(g.save).trophies[0]?.line; out.killEv = evs.some(e => e[0] === 'nemesis' && e[1].kind === 'killed'); out.moment = evs.find(e => e[0] === 'moment')?.[1]?.kind;
  let back = 0; for (let sd = 1; sd < 120; sd++) { go(sd); if (g.enemies.some(e => e.nem === spawned.nem)) back++; } out.back = back;
  g.emit = oe; g.enterTown(); g.save.instance = null; g.inst = null; return out; });
ok(e2e.made && e2e.ev === 'created' && e2e.ls, `live: dying to an elite creates a nemesis (${e2e.name}), emits the event and persists in the save`);
ok(e2e.spawned && e2e.inCache && e2e.hpOk && e2e.label === e2e.name, 'live: the nemesis returns by name in a later run, stronger within the hp cap');
ok(e2e.init && e2e.mods.resistType === 'tech' && e2e.dTech < e2e.dAuto, `live: adapts to your main damage type (tech hit ${e2e.dTech.toFixed(1)} < auto ${e2e.dAuto.toFixed(1)})`);
ok(e2e.status === 'dead' && /^Killed .+, who killed you \d+ times?$/.test(e2e.trophy) && e2e.killEv && e2e.moment === 'nemesis_kill', 'live: killing it is permanent, grants the provenance trophy and offers a nemesis_kill moment: ' + e2e.trophy);
ok(e2e.back === 0, 'live: a killed nemesis never spawns again (119 runs)');
// screenshot: nemesis card + nameplate
await ev(async () => { const g = window.__game; const N = await import('/src/nemesis.ts'); delete g.save.nemesis; const s = g.save; N.onPlayerKilled(s, { type: 'overseer', attack: 'slam', boss: true, elite: true, mfr: 'MM', dungeon: 'annex', name: 'Annex Overseer' }, { seed: 5, profile: { hack: .5, burst: .6, kite: 0, main: 'tech' }, trophy: { def: 'x', name: 'Shard Arm', rarity: 'purple', slot: 'armL' }, owner: 'Vex', body: 'foreman' });
  const n = N.activeNems(s)[0]; const M = await import('/src/nemesis_ui.ts'); window.__WV_FEATURES.nemesisVoice = false; M.showNemesis(g, { kind: 'created', id: n.id, taunt: n.taunt, tauntKey: n.tauntKey }); });
await new Promise(r => setTimeout(r, 600)); fs.mkdirSync('shots', { recursive: true }); await page.screenshot({ path: 'shots/nemesis_card.png' });
const ov = await ev(() => { const el = document.getElementById('nemCard'); const bad = [...el.querySelectorAll('*')].filter(x => x.scrollWidth > x.clientWidth + 1 && getComputedStyle(x).overflow !== 'visible'); return { bad: bad.length, fits: el.getBoundingClientRect().right <= innerWidth }; });
ok(ov.bad === 0 && ov.fits, 'nemesis card fits (no clipped text)');
await ev(() => { delete window.__game.save.nemesis; });
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 3).join(' | '));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
