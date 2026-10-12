// Traits (docs/TRAITS.md): bounded data, signal scoring -> hacker / brute / hybrid / sparse option sets, delay + checkpoint refresh,
// permanence (no respec path), L20 requires L10, AI ranking outside the candidate set rejected, effects clamped, live recording + effects in the sim.
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({}); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove());
const r = await ev(async () => { const T = await import('/src/traits.ts'), S = await import('/src/traitstate.ts'), C = await import('/src/config.ts');
  const out = {}; const fresh = (lvl = 12) => ({ level: lvl });
  out.errors = T.TRAIT_ERRORS; out.bounds = T.TRAITS.every(t => t.effects.every(e => { const b = T.EFFECT_BOUNDS[e.t]; return b && e.v >= b.min && e.v <= b.max; }));
  out.noAugment = T.TRAITS.every(t => t.effects.every(e => !C.ITEM_BY_ID[e.t] && Object.keys(e).every(k => ['t', 'v', 'f'].includes(k))));
  out.l20parents = T.TRAITS.filter(t => t.tier === 1).every(p => T.TRAITS.filter(t => t.tier === 2 && t.parent.includes(p.id)).length >= 2);
  // tampered effect is rejected by the validator
  out.validatorCatches = T.validateTrait({ id: 'x', tier: 1, name: 'x', short: 'x', fams: ['hack'], blurb: '', effects: [{ t: 'famDmg', f: 'hack', v: 5 }, { t: 'godmode', v: 1 }] }).length === 2;
  const play = (s, sig, n) => { for (let i = 0; i < n; i++) { S.addSig(s, sig, 3); if (i % 5 === 4) S.closeRun(s); } S.closeRun(s); };
  const hacker = fresh(); play(hacker, { hack: 1 }, 30); out.hacker = S.refreshOffer(hacker).ids; out.hackerLean = S.lean(hacker).kind;
  const brute = fresh(); play(brute, { brute: 1 }, 30); out.brute = S.refreshOffer(brute).ids;
  const mixed = fresh(); play(mixed, { hack: 1, brute: .9 }, 30); out.mixed = S.refreshOffer(mixed).ids; out.mixedLean = S.lean(mixed).kind;
  const sparse = fresh(); S.addSig(sparse, { gun: 1 }, 1); out.sparse = S.refreshOffer(sparse, { tech: 2 }); out.sparseLean = S.lean(sparse, { tech: 2 });
  // equipment alone does not decide: a heavy brute history with a hack-only loadout prior still gets brute options
  out.priorIgnored = S.refreshOffer(brute, { hack: 10 }).ids[0];
  // not unlocked below 10
  out.low = S.refreshOffer(fresh(8)); out.lowChoose = S.chooseTrait(fresh(8), 'netrunner');
  // delay: no pick, play changes, checkpoint refresh changes the offer; the offer is provisional (no pick recorded)
  const d = fresh(); play(d, { hack: 1 }, 20); const o1 = S.refreshOffer(d).ids.slice(); play(d, { gun: 1 }, 80); const o2 = S.refreshOffer(d).ids.slice(); out.delay = { o1, o2, l10: S.traitsOf(d).l10 };
  // ranking: permutation accepted, outsiders rejected, lines kept only for valid ids
  const k = fresh(); play(k, { hack: 1 }, 30); S.refreshOffer(k); const ids = S.traitsOf(k).offer.ids.slice();
  out.rankBad = S.applyRanking(k, ['bruiser', ids[0]]); out.rankDup = S.applyRanking(k, [ids[0], ids[0]]); out.rankNonArr = S.applyRanking(k, 'netrunner');
  out.rankOk = S.applyRanking(k, [ids[1], ids[0]], { [ids[1]]: 'line', bruiser: 'smuggled' }); out.ranked = S.traitsOf(k).offer;
  // permanence
  const pick = S.chooseTrait(k, 'bruiser'); out.pickOutside = pick.ok; const p1 = S.chooseTrait(k, ids[0]); const p2 = S.chooseTrait(k, ids[1]);
  out.perm = { p1: p1.ok, p2: p2.ok, why: p2.why, l10: S.traitsOf(k).l10?.id };
  out.noRespec = Object.keys(S).filter(n => /respec|unpick|reset|clear|remove|undo/i.test(n));
  // L20
  const z = fresh(25); out.l20NoL10 = S.chooseTrait(z, 'rootkit'); S.refreshOffer(z); out.z1 = S.traitsOf(z).offer.tier;
  play(z, { hack: 1 }, 20); S.refreshOffer(z); S.chooseTrait(z, S.traitsOf(z).offer.ids.find(x => x === 'netrunner') || S.traitsOf(z).offer.ids[0]); S.refreshOffer(z); out.z2 = { tier: S.traitsOf(z).offer.tier, ids: S.traitsOf(z).offer.ids, l10: S.traitsOf(z).l10.id };
  out.z2parents = out.z2.ids.every(id => T.TRAIT_BY_ID[id].parent.includes(out.z2.l10));
  const zz = fresh(15); play(zz, { hack: 1 }, 20); S.refreshOffer(zz); S.chooseTrait(zz, S.traitsOf(zz).offer.ids[0]); out.l20Low = S.refreshOffer(zz);
  // effects: clamp + stack cap + tampered save
  const e = fresh(25); S.traitsOf(e).l10 = { id: 'netrunner', at: 0, level: 10 }; S.traitsOf(e).l20 = { id: 'icebreaker', at: 0, level: 20 };
  const fx = S.traitEffects(e); out.fxHackDmg = S.famBonus(fx, 'famDmg', 'cascade_arc'); out.fxBruteDmg = S.famBonus(fx, 'famDmg', 'piston_jab');
  out.capOk = Object.entries(fx.reduce((a, x) => { const k = x.t + (x.f || ''); a[k] = (a[k] || 0) + x.v; return a; }, {})).every(([k, v]) => v <= (T.STACK_CAP[k.replace(/(hack|brute|gun|ghost|tech)$/, '')] ?? 1) + 1e-9);
  const t2 = fresh(25); S.traitsOf(t2).l20 = { id: 'juggernaut', at: 0, level: 20 }; S.traitsOf(t2).l10 = { id: 'netrunner', at: 0, level: 10 }; out.tamperedL20 = S.traitEffects(t2).filter(x => x.t === 'maxHp').length; // juggernaut is not on the netrunner path -> ignored
  const t3 = fresh(25); S.traitsOf(t3).l10 = { id: 'made_up', at: 0, level: 10 }; out.unknown = S.traitEffects(t3).length;
  // rolling window: only the last 15 runs count, and runs older than 3 h drop
  const w = fresh(); for (let i = 0; i < 30; i++) { S.addSig(w, { brute: 1 }, 1); S.closeRun(w); } out.window = S.traitsOf(w).runs.length; const old = fresh(); S.addSig(old, { hack: 1 }, 5, Date.now() - 4 * 3600e3); S.closeRun(old, Date.now() - 4 * 3600e3); S.trimWindow(S.traitsOf(old)); out.oldDropped = S.traitsOf(old).runs.length;
  // family tagging from catalog data
  out.tags = { cascade: T.abilityFamilies('cascade_arc'), jab: T.abilityFamilies('piston_jab'), turret: T.abilityFamilies('auto_turret'), decoy: T.abilityFamilies('decoy_projector'), headshot: T.abilityFamilies('headshot_protocol'), control: T.abilityFamilies('control') };
  return out; });
ok(r.errors.length === 0 && r.bounds && r.noAugment, 'trait data: every effect whitelisted and within bounds, no augment-specific effects ' + r.errors.join('|'));
ok(r.validatorCatches, 'validator rejects out-of-bounds values and unknown effect types');
ok(r.l20parents, 'every level 10 trait has at least two level 20 follow-ups');
ok(r.tags.cascade.hack && r.tags.jab.brute && r.tags.turret.tech && r.tags.decoy.ghost && r.tags.headshot.gun && r.tags.control.hack, 'ability families come from catalog role/type/shape: ' + JSON.stringify(r.tags));
ok(r.hacker[0] === 'netrunner' && r.hackerLean === 'lean' && r.hacker.every(id => ['netrunner', 'breacher', 'glitch', 'conartist', 'jackofall'].includes(id)), 'hacker history -> hacking choices: ' + r.hacker);
ok(r.brute[0] === 'bruiser' && r.brute.every(id => ['bruiser', 'breacher', 'phantom', 'jackofall'].includes(id)), 'brute-force history -> direct-combat choices: ' + r.brute);
ok(r.mixedLean === 'hybrid' && r.mixed[0] === 'breacher' && r.mixed.includes('netrunner') && r.mixed.includes('bruiser'), 'mixed hack+brute -> hybrid first: ' + r.mixed);
ok(r.sparse.sparse && r.sparse.ids[0] === 'jackofall' && r.sparse.ids.includes('tinker'), 'sparse history -> balanced set + equipped abilities as a weak prior: ' + r.sparse.ids);
ok(r.priorIgnored === 'bruiser', 'installed equipment alone does not decide (rich brute history beats a hack loadout prior)');
ok(r.low === null && !r.lowChoose.ok, 'below level 10: no offer, cannot choose');
ok(r.delay.o1[0] === 'netrunner' && r.delay.o2[0] === 'gunslinger' && r.delay.l10 === null, `delay: unpicked offer keeps shifting with play (${r.delay.o1} -> ${r.delay.o2})`);
ok(r.rankBad === false && r.rankDup === false && r.rankNonArr === false, 'AI ranking outside the candidate set / duplicates / garbage rejected');
ok(r.rankOk && r.ranked.src === 'ai' && r.ranked.lines && !('bruiser' in r.ranked.lines), 'valid AI permutation accepted, smuggled line for a non-candidate dropped');
ok(!r.pickOutside && r.perm.p1 && !r.perm.p2 && /permanent/.test(r.perm.why), 'permanence: pick commits, second pick refused: ' + r.perm.why);
ok(r.noRespec.length === 0, 'no respec / unpick / reset export exists in trait state ' + r.noRespec);
ok(!r.l20NoL10.ok && /level 10/.test(r.l20NoL10.why) && r.z1 === 1, 'L20 requires a confirmed L10 trait (level 25 without L10 is offered tier 1)');
ok(r.z2.tier === 2 && r.z2parents && r.z2.ids.length >= 2, 'L20 options complement the chosen L10 trait: ' + r.z2.ids);
ok(r.l20Low === null, 'L20 not offered below level 20');
ok(r.fxHackDmg > 0 && r.fxHackDmg <= .25 && r.fxBruteDmg === 0 && r.capOk, 'effects: family-level, stack-capped (hack dmg ' + r.fxHackDmg + ')');
ok(r.tamperedL20 === 0 && r.unknown === 0, 'tampered saves: off-path L20 and unknown ids grant nothing');
ok(r.window === 15 && r.oldDropped === 0, 'rolling window: last 15 runs, older than 3 h dropped');
// live: casting records signals, town return closes the run and refreshes the offer; a trait's maxHp applies to the build
const live = await ev(async () => { const S = await import('/src/traitstate.ts'); const g = window.__game, s = g.save; s.level = 12; g.startRun(); g.revealing = false; const T = S.traitsOf(s);
  const before = JSON.stringify(T.cur?.sig || {}); const id = g.build.abilities[0]; g.executeAbility({ idx: 0, aim: { idx: 0, wx: g.px + 2, wy: g.py, ok: true }, ab: (await import('/src/config.ts')).ABILITIES[id] || { id, heat: 1, cd: 1, aim: 'self' } }); g.dodge();
  const mid = JSON.stringify(T.cur?.sig || {}); g.enterTown(); return { before, mid, runs: T.runs.length, offer: !!T.offer, cur: T.cur }; });
ok(live.mid !== live.before && live.runs >= 1 && live.offer && !live.cur, 'live: ability/dodge recorded, town return closes the run and refreshes the offer ' + live.mid);
const hp = await ev(async () => { const S = await import('/src/traitstate.ts'); const g = window.__game, s = g.save; g.recompute(); const h0 = g.build.stats.maxHp; const T = S.traitsOf(s); T.l10 = { id: 'bruiser', at: 0, level: 12 }; g.recompute(); const h1 = g.build.stats.maxHp; T.l10 = null; g.recompute(); return { h0, h1 }; });
ok(Math.abs(hp.h1 / hp.h0 - 1.06) < 1e-6, `live: Bruiser +6% max HP applied in the build (${hp.h0.toFixed(1)} -> ${hp.h1.toFixed(1)})`);
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|')); await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
