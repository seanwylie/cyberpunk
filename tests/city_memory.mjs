// "The city remembers you" (docs/CITY_MEMORY.md): nemesis scars + build/limb taunts, first-session guarantee, deeds log ->
// "Your file" in city news, street barks, NPC lines, town "Hunted" banner, server-wide 'nem' claim -> weekly news. Needs the dev server.
import { launch } from './lib.mjs'; import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
{ const C = await import('../server/city_news.mjs');
  const st = { dist: {}, week: { wk: 'w', dist: {}, flips: [], players: {} }, prev: { wk: 'w0', dist: {}, flips: [], players: { a: { name: 'Vex', clears: 2, gateways: 0, nems: 1 } } } };
  const F = C.buildFacts(st, { towns: {} }); const n = C.cannedNews(F); const it = n.items.find(i => /settles a score/.test(i.h));
  ok(!!it && /Vex put down a nemesis/.test(it.b) && C.validateItem(it.b, F, { towns: {} }, ['Vex']), 'weekly news reports a player\'s nemesis kill (canned, passes the fact validator): ' + it?.b); }
fs.mkdirSync('shots/memory', { recursive: true });
const { browser, page, errors } = await launch({ init: () => { window.__WV_FEATURES = { nemesis: true, nemesisVoice: false, moments: false, momentClip: false }; } }); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove());
const u = await ev(async () => { const N = await import('/src/nemesis.ts'); const D = await import('/src/deeds.ts'); const M = await import('/src/npcmem.ts'); const Cy = await import('/src/city.ts'); const o = {};
  const prof = (p) => ({ hack: 0, burst: .2, kite: 0, main: 'kinetic', ...p });
  o.keys = [N.readKey(prof({ hack: .5 })), N.readKey(prof({ burst: .7 })), N.readKey(prof({ kite: .6 })), N.readKey(prof({ main: 'blade' })), N.readKey(prof({ hack: .9 }), ['armL']), N.readKey(prof(), ['legR'])];
  o.limbRec = N.lostLimbs({ limbs: { lost: { handR: { by: 'x' } }, scars: 1, tears: 1 } }); o.keys.push(N.readKey(prof(), o.limbRec));
  o.allVoiced = o.keys.every(k => typeof N.TAUNTS[k] === 'string');
  // first elite kill always makes a nemesis (any seed); later elites still roll
  let firsts = 0; for (let sd = 0; sd < 40; sd++) { const s = {}; if (N.onPlayerKilled(s, { type: 'foreman', attack: 'cleave', boss: false, elite: true, mfr: 'HI', dungeon: 'annex', name: 'F' }, { seed: sd, profile: prof(), trophy: null, owner: 'Vex', body: 'foreman', hurt: .5 }).kind === 'created') firsts++; } o.firsts = firsts;
  const s = {}; const c = N.onPlayerKilled(s, { type: 'foreman', attack: 'cleave', boss: false, elite: true, mfr: 'HI', dungeon: 'annex', name: 'F' }, { seed: 3, profile: prof({ main: 'blade' }), trophy: null, owner: 'Vex', body: 'foreman', hurt: .6 });
  o.scar0 = [...c.rec.scars]; o.fresh = [0, 1, 2, 3, 4].every(sd => N.pickForRun(s, sd)?.id === c.rec.id);
  N.onPlayerKilled(s, { type: 'foreman', attack: 'cleave', boss: false, elite: true, mfr: 'HI', dungeon: 'annex', name: 'F', nemId: c.rec.id }, { seed: 4, profile: prof({ main: 'arc', hack: .4 }), trophy: null, owner: 'Vex', body: 'foreman', lost: ['armL'], hurt: .1 });
  o.scar1 = [...c.rec.scars]; o.read = c.rec.read; c.rec.encounters = 1; o.ret = N.returnLine(c.rec);
  for (const t of ['kinetic', 'blade', 'arc', 'tech', 'kinetic']) N.addScar(c.rec, t); o.scarCap = c.rec.scars.length;
  // deeds -> wire + NPC + bark
  const p = { level: 3 }; const t0 = Date.now(); D.addDeed(p, 'nem_new', 'Vesk the Tailor', 'Shard Arm', 'annex', t0); D.addDeed(p, 'nem_new', 'Vesk the Tailor', 'Shard Arm', 'annex', t0 + 10); // dedupe
  for (let i = 0; i < 50; i++) D.addDeed(p, 'clear', 'annex', undefined, undefined, t0 + 1e4 * (i + 1)); o.cap = p.deeds.length; D.addDeed(p, 'nem_kill', 'Vesk the Tailor', undefined, 'annex', t0 + 1e6);
  const w = D.wireItems(p, 'Vex'); o.wire = w.map(x => x.h); o.bark = D.deedBark(p, 'Vex');
  o.npc = M.memLine(p, 'odalys_vane', k => k, t0 + 2e6); o.npcOld = M.memLine(p, 'odalys_vane', k => k, t0 + 5 * 864e5).kind;
  const q = { level: 3 }; o.npcNone = M.memLine(q, 'odalys_vane').kind;
  // city: nem event counts for the named player only
  const cs = Cy.newCity(); Cy.notePlayer(cs, 'g1', 'Vex'); const d = Object.keys(cs.dist)[0]; Cy.applyEvents(cs, [{ k: 'nem', d, f: Cy.FACTIONS[0], who: 'g1', w: .35 }]); o.cityNem = cs.week.players.g1.nems;
  const bad = /\b(drug|drugs|dope|meth|cocaine|heroin|pill|pills|stim|stims|junkie|dealer|dose|overdose|weed)\b/i; o.clean = Object.values(N.TAUNTS).every(t => !bad.test(t)) && w.every(x => !bad.test(x.h + x.b));
  return o; });
ok(JSON.stringify(u.keys) === JSON.stringify(['build_hack', 'build_burst', 'build_kite', 'build_blade', 'limb_arm', 'limb_leg', 'limb_arm']) && u.allVoiced, 'taunt read: hacks / burst / kiting / damage type, limb losses win: ' + u.keys.join(','));
ok(u.firsts === 40, `first elite that kills you always becomes a nemesis (${u.firsts}/40 seeds)`);
ok(u.fresh, 'a fresh nemesis is guaranteed in your next run (seen in the first 30 minutes)');
ok(JSON.stringify(u.scar0) === '["blade"]' && JSON.stringify(u.scar1) === '["blade"]' && u.scarCap === 3, 'scars: hurting it leaves your damage type as a scar; a scratch does not; capped at 3');
ok(u.read === 'limb_arm' && u.ret.key === 'limb_arm' && /arm/.test(u.ret.text), 'return line references your limb loss: ' + u.ret.text);
ok(u.cap === 30 && u.wire[0] === 'Vex ends Vesk the Tailor' && u.wire.length === 4, 'deeds log is capped and feeds "Your file": ' + u.wire[0]);
ok(/Vesk the Tailor/.test(u.bark || ''), 'street bark about your deed: ' + u.bark);
ok(u.npc.kind === 'deed' && /Vesk the Tailor/.test(u.npc.text) && u.npcOld !== 'deed' && u.npcNone === 'first', 'NPCs open with your fresh deed, forget it after 3 days: ' + u.npc.text);
ok(u.cityNem === 1, 'server-wide city: a nemesis kill is credited to the named player for the weekly news');
ok(u.clean, 'no drug references in new words');
// ---- live: first run death -> nemesis + deed -> town banner + news file -> next run it returns with a taunt about you ----
const L = await ev(async () => { const g = window.__game; const N = await import('/src/nemesis.ts'); const evs = []; const oe = g.emit; g.emit = (t, p) => { if (t === 'nemesis') evs.push(p); return oe.call(g, t, p); };
  const go = (seed) => { g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.level = 30; g.save.settings.devFreeReset = true; g.recompute(); return g.startRun('annex', seed); };
  delete g.save.nemesis; g.save.deeds = []; go(11); const elite = g.enemies.find(e => !e.dead && e.type === 'foreman') || g.enemies.find(e => !e.dead && window.__enemies[e.type].elite && !window.__enemies[e.type].boss);
  elite.hp = elite.maxHp * .4; g.dmgSrc = elite.type + ':cleave'; g.px = elite.x + 1; g.py = elite.y; g.dealt = { auto: 400 }; g.downed = false; g.hp = 1; g.playerDown(); g.returnToCheckpoint();
  const n = N.activeNems(g.save)[0]; const o = { made: !!n && evs[0]?.kind === 'created', scars: n?.scars, deed: g.save.deeds.slice(-1)[0]?.k, name: n?.name };
  g.emit = oe; g.enterTown(); g.save.instance = null; g.inst = null; return o; });
ok(L.made && L.deed === 'nem_new' && L.scars?.length === 1, `live: first death to an elite marks a nemesis (${L.name}), scarred, logged as a deed`);
await page.waitForFunction(() => document.getElementById('citybanner')?.textContent.includes('Hunted'), null, { timeout: 8000 }).catch(() => {});
const bn = await ev(() => { const b = document.getElementById('citybanner'); return { t: b?.textContent, tip: b?.dataset.tip }; });
ok(/Hunted/.test(bn.t || '') && bn.tip.includes(L.name), 'town banner: short "Hunted" label, tooltip names the nemesis');
await ev(() => window.__ui.open('news')); await page.waitForSelector('.cnfile', { timeout: 8000 }).catch(() => {}); await new Promise(r => setTimeout(r, 400));
const nf = await ev(() => { const f = document.querySelector('.cnfile'); const bad = f ? [...f.querySelectorAll('*')].filter(x => x.scrollWidth > x.clientWidth + 1 && getComputedStyle(x).overflow !== 'visible').length : -1; return { txt: f?.textContent || '', bad }; });
await page.screenshot({ path: 'shots/memory/news_your_file.png' });
ok(nf.txt.includes('Hunted by ' + L.name) && nf.txt.includes('marks') && nf.bad === 0, 'city news opens with "Your file": hunted-by + your deeds, no clipped text');
await ev(() => window.__ui.close?.() ?? (window.__ui.modal = null, window.__ui.render?.()));
const R = await ev(async () => { const g = window.__game; const evs = []; const oe = g.emit; g.emit = (t, p) => { if (t === 'nemesis') evs.push(p); return oe.call(g, t, p); };
  g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.recompute(); g.startRun('annex', 4242); const e = g.enemies.find(x => x.nem);
  if (e) { g.px = e.x + 2; g.py = e.y; e.alert = true; for (let i = 0; i < 4; i++) g.update(0.05); } g.emit = oe; return { spawned: !!e, plate: e?.nemScar, ret: evs.find(x => x.kind === 'return') }; });
await new Promise(r => setTimeout(r, 700)); await page.screenshot({ path: 'shots/memory/nemesis_returns.png' });
ok(R.spawned && !!R.plate && !!R.ret?.taunt, `live: next run it returns (guaranteed), scar on its nameplate (${R.plate}), says: "${R.ret?.taunt}"`);
ok(!errors.filter(e => !/favicon|404|ERR_CONNECTION/.test(e)).length, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''));
await browser.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
