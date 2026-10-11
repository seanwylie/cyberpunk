// Heat as a real constraint (docs/BALANCE.md "Heat"): caps and diminishing returns, overheat consequences, vent, HUD bands, and bench limits on cast rate.
import { launch, sleep } from './lib.mjs'; import { runJob } from '../tools/balance/harness.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const ev = (f, a) => page.evaluate(f, a);

// ---- pure model: diminishing returns and hard caps ----
const M = await ev(async () => { const H = await import('/src/heat.ts'); const r = {};
  r.cool = [1, 1.5, 2, 3, 10, 100].map(c => H.effCooling(c)); r.red = [0, .1, .3, .6, 2, 50].map(x => H.effReduce(x)); r.cdr = [.1, .5, 5].map(x => H.cdAfter(10, x));
  r.thr0 = H.throttle(0, 1); r.thrMax = H.throttle(50, 100); r.dissBase = H.dissipation(1, false, 0), r.dissMax = H.dissipation(100, false, 0), r.dissOver = H.dissipation(1, true, 0), r.dissSoak = H.dissipation(1, false, .3);
  r.cap = H.HEAT.coolCap; r.rcap = H.HEAT.reduceCap; r.band = [H.heatBand(10, false), H.heatBand(65, false), H.heatBand(85, false), H.heatBand(100, true)];
  // sustainable casts/min of a 28-heat ability with autos eating 3/s: unspecced vs hard-capped max spec
  const sus = (cool, red) => (H.dissipation(cool, false, 0) - 3) * 60 / H.heatCost(28, red); r.susBase = sus(1, 0); r.susMax = sus(100, 100); return r; });
ok(M.cool[0] === 1 && M.cool.every((v, i) => i === 0 || v >= M.cool[i - 1]) && M.cool[5] <= M.cap + 1e-9 && M.cool[4] <= M.cap, `effective cooling is monotone and hard-capped at x${M.cap}: ${M.cool.map(v => v.toFixed(2))}`);
ok(M.cool[2] - 1 < (2 - 1) * .8, `diminishing returns: COOL stat 2.0 gives x${M.cool[2].toFixed(2)}, not x2`);
ok(M.red[0] === 0 && M.red[5] <= M.rcap + 1e-9 && M.red[3] < M.red[5] + 1e-9 && M.red[2] < .3 * 1.0, `heat-cost reduction capped at ${Math.round(M.rcap * 100)}%: ${M.red.map(v => v.toFixed(3))}`);
ok(M.cdr[2] >= 6.9 && M.cdr[0] === 9, `cooldown reduction hard-capped at 30%: ${M.cdr.map(v => v.toFixed(2))}`);
ok(M.thr0 === 1 && M.thrMax < .85 && M.thrMax > .6, `heat-efficiency spec pays damage: unspecced x${M.thr0}, maxed x${M.thrMax.toFixed(2)}`);
ok(M.dissMax <= M.dissBase * M.cap + 1e-9 && M.dissOver < M.dissBase && M.dissSoak === 0, `dissipation: base ${M.dissBase}/s, capped max ${M.dissMax.toFixed(1)}/s, overheated ${M.dissOver.toFixed(1)}/s (reduced), paused during cast soak`);
ok(M.band.join() === 'ok,warm,hot,over', `HUD bands ${M.band}`);
ok(M.susMax < M.susBase * 2.6 && M.susMax < 30, `max spec sustains ${M.susMax.toFixed(1)} casts/min vs ${M.susBase.toFixed(1)} unspecced (ratio ${(M.susMax / M.susBase).toFixed(2)})`);

// ---- sim: overheat consequences and vent ----
await ev(() => { const g = window.__game; g.enterTown(true); g.startRun('annex'); g.revealing = false; g.dbg.god = false; g.dbg.oneShot = false; });
const S = await ev(async () => { const g = window.__game, H = await import('/src/heat.ts'); const r = {}; const step = n => { for (let i = 0; i < n; i++) g.update(1 / 30); };
  g.enemies.forEach(e => e.dead = true); g.hp = g.maxHp; g.heat = 0; g.overheated = false; g.ventCd = 0; g.ventLock = 0; g.iframes = 0;
  // take a hit normally, then overheated
  g.hurtPlayer(20, g.px + 1, g.py); r.normalHit = g.maxHp - g.hp; g.hp = g.maxHp; g.iframes = 0;
  g.heat = 99.9; g.heat += 5; step(1); r.over = g.overheated; r.ohT = g.ohT; g.hp = g.maxHp; g.iframes = 0; g.hurtPlayer(20, g.px + 1, g.py); r.overHit = g.maxHp - g.hp;
  // abilities are offline, can't cast
  const id = g.build.abilities.find(a => a && a !== 'defib'); r.ab = id; g.abCd = [0, 0, 0]; const c0 = g.casts[id] || 0; g.beginAim(g.build.abilities.indexOf(id)); if (g.aim) { g.updateAim(g.px + 2, g.py, true); g.releaseAim(); } step(15); r.castWhileOver = (g.casts[id] || 0) - c0;
  // lockout: heat low but still locked until ohT elapses
  g.heat = 10; g.ohT = 1; step(10); r.stillLocked = g.overheated; step(30); r.unlocked = !g.overheated;
  // recovery rate while overheated is slower than normal
  r.dissBase = H.dissipation(g.build.stats.cooling, false, 0); r.dissOver = H.dissipation(g.build.stats.cooling, true, 0);
  // vent
  g.overheated = false; g.heat = 80; g.ventCd = 0; r.vented = g.ventNow(); r.afterVent = g.heat; r.lock = g.ventLock; r.cd = g.ventCd; r.again = g.ventNow(); r.weaponOff = g.weaponOff;
  const id2 = g.build.abilities.find(a => a && a !== 'defib'); g.abCd = [0, 0, 0]; const c1 = g.casts[id2] || 0; g.beginAim(g.build.abilities.indexOf(id2)); if (g.aim) { g.updateAim(g.px + 2, g.py, true); g.releaseAim(); } step(10); r.castWhileVent = (g.casts[id2] || 0) - c1;
  // vent ends overheat when it drops under the recover line
  step(60); g.heat = 94; g.overheated = true; g.ohT = 0; g.ventCd = 0; g.ventLock = 0; g.ventNow(); r.ventRecovers = !g.overheated; r.afterOverVent = g.heat;
  // stim vents some heat
  g.heat = 70; g.hp = 10; g.inst.carried.stims = 2; g.stimCd = 0; g.useStim(); r.stimHeat = g.heat;
  return r; });
ok(S.over === true && S.ohT > 2, `overheat triggers at max heat with a lockout window (${S.ohT?.toFixed(1)}s)`);
ok(S.overHit > S.normalHit * 1.2, `overheated: +damage taken (${S.normalHit.toFixed(1)} -> ${S.overHit.toFixed(1)})`);
ok(S.castWhileOver === 0, 'abilities cannot be cast while overheated');
ok(S.stillLocked === true && S.unlocked === true, 'lockout holds even when heat is already low, then ends');
ok(S.dissOver < S.dissBase, `dissipation reduced while overheated (${S.dissBase} -> ${S.dissOver.toFixed(1)}/s)`);
ok(S.vented === true && S.afterVent <= 80 - 44 && S.afterVent >= 80 - 46 && S.again === false && S.cd >= 10 && S.lock > 0, `hot vent dumps 45 (80 -> ${S.afterVent.toFixed(0)}), has a ${S.cd}s cooldown, cannot be chained`);
ok(S.castWhileVent === 0 && S.weaponOff > 0, 'venting locks abilities and autos for its channel');
ok(S.ventRecovers === true, `vent from 94 while overheated ends the lockout (${S.afterOverVent})`);
ok(S.stimHeat <= 70 - 24, `stim vents heat (70 -> ${S.stimHeat.toFixed(0)})`);

// ---- keyboard / HUD ----
await ev(() => { const g = window.__game; g.heat = 70; g.ventCd = 0; g.ventLock = 0; g.overheated = false; g.hp = g.maxHp; });
await page.keyboard.press('v'); await sleep(100);
ok(await ev(() => window.__game.ventCd > 10), 'V key vents');
const hud = async (heat, over) => { await ev(([h, o]) => { const g = window.__game; g.heat = h; g.overheated = o; g.ventCd = 0; g.ventLock = 0; g.ohT = 5; }, [heat, over]); await sleep(250); return ev(() => { const b = document.querySelector('.bar.heat'); return { band: b.dataset.band, cls: b.className, txt: document.getElementById('heattxt').textContent, w: document.getElementById('heatfill').style.width, anim: getComputedStyle(document.getElementById('heatfill')).animationDuration }; }); };
const h1 = await hud(20, false), h2 = await hud(65, false), h3 = await hud(88, false), h4 = await hud(100, true);
ok(h1.band === 'ok' && h2.band === 'warm' && h3.band === 'hot' && h4.band === 'over', `HUD bands ok/warm/hot/over: ${[h1, h2, h3, h4].map(h => h.band)}`);
ok(/HEAT (19|20)/.test(h1.txt) && /HOT 8\d/.test(h3.txt) && /OVERHEATED/.test(h4.txt) && /V/.test(h4.txt), `HUD text: "${h1.txt}" "${h3.txt}" "${h4.txt}"`);
const dur = s => { const v = parseFloat(s); return /ms/.test(s) ? v / 1000 : v; };
ok([h1, h2, h3].every(h => dur(h.anim) === 0) && dur(h4.anim) >= .5, `no flashing: warm/hot are steady, overheat pulse period ${h4.anim} (<= 2 Hz)`);
await ev(() => { const g = window.__game; g.overheated = false; g.heat = 0; });

// ---- bench: heat limits cast rate for every spec ----
const bench = (kit, profile, level) => ev(runJob, { mode: 'heat', id: 'annex', kit, profile, level, seed: 7, secs: 60 });
const sl = await bench('starter', 'sloppy', 20), hm = await bench('heatmax', 'skilled', 34), sk = await bench('starter', 'skilled', 20), sp = await bench('abpurple', 'spam', 34);
console.log(' bench', JSON.stringify([sl, hm, sk, sp].map(r => ({ kit: r.kit, p: r.profile, ...r.heat }))));
ok(sl.heat.overheats >= 2, `unspecced bot that ignores heat overheats regularly (${sl.heat.overheats} in 60 s, ${(sl.heat.overheatShare * 100).toFixed(0)}% locked out)`);
ok(sp.heat.overheats >= 2, `purple spam bot overheats too (${sp.heat.overheats} in 60 s)`);
ok(hm.heat.castsPerMin <= 30, `max heat-reduction spec (cooling x${hm.heat.cooling}) casts ${hm.heat.castsPerMin}/min, cannot spam (cap 30; cooldown ceiling is ~60)`);
ok(hm.heat.avgHeat > 55, `max spec is still heat-bound (avg heat ${hm.heat.avgHeat})`);
ok(sk.heat.castsPerMin >= 8 && sk.heat.castsPerMin <= hm.heat.castsPerMin + 10, `unspecced skilled bot still casts ${sk.heat.castsPerMin}/min within its budget`);
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 3).join('|'));
await browser.close(); console.log(fails ? `${fails} FAILED` : 'heat OK'); process.exit(fails ? 1 : 0);
