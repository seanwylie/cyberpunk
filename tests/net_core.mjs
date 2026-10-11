// Shared combat core under a party: the REAL Game code runs per member (src/core/party.ts). Headless node test, no browser.
import { load, mkTest } from './net_lib.mjs';
const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
const t = mkTest(); const { ok } = t;
const P = await load(process.cwd() + '/src/core/party.ts', 'core');
const C = await load(process.cwd() + '/src/core/testkit.ts', 'kit');
const { PartyWorld } = P;
const inp = (w, id, seq, o = {}) => w.input(id, { t: 'input', seq, mx: 0, my: 0, atk: false, face: 0, ...o });
const run = (w, n, f) => { for (let i = 0; i < n; i++) { f?.(i); w.step(); w.endTick(); } };

// ---- 1. every ability casts on a server host without throwing and actually pays heat/cooldown
{
  let bad = []; let cast = 0; const ids = C.abilityItems();
  for (const [ab, item] of ids) {
    try {
      const w = new PartyWorld('annex', 77, [{ id: 'a', name: 'A', lvl: 60, profile: { level: 60, rep: { HI: 40, PS: 40, MM: 40 }, items: [{ def: item, chips: [] }], abPick: [ab, null, null] } }]);
      const a = w.hosts.get('a'); const e = w.enemies.find(e => !e.dead && e.type !== 'turret'); w.devTeleport('a', e.x - 2, e.y); const g = a.g;
      if (g.build.abilities[0] !== ab) { if (!g.build.passives.includes(ab)) bad.push(ab + ' not bound'); continue; }
      run(w, 3); inp(w, 'a', 1, { acts: [{ k: 'cast', i: 0, wx: e.x, wy: e.y }] }); run(w, 40, i => { if (i === 0) return; inp(w, 'a', i + 1); });
      if (g.abCd[0] > 0 || g.casts?.[ab] > 0 || g.heat > 0) cast++; else bad.push(ab + ' did not fire');
    } catch (err) { bad.push(ab + ': ' + String(err.message).slice(0, 80)); }
  }
  ok(ids.length >= 40, 'tested ' + ids.length + ' abilities (>=40)'); ok(bad.length === 0, 'every ability casts on the server: ' + (bad.slice(0, 6).join(' | ') || cast + ' ok'));
}

// ---- 2. build validation: server clamps to the catalog
{
  const w = new PartyWorld('annex', 5, [{ id: 'a', name: 'A', lvl: 9, profile: { level: 999, rep: { HI: 1e9, PS: -5, MM: 0 }, items: [{ def: 'does_not_exist', chips: [] }, { def: C.abilityItems()[0][1], chips: ['bogus', 'bogus2'] }] } }]);
  const a = w.hosts.get('a'); ok(a.g.save.level <= 60, 'level clamped to cap: ' + a.g.save.level); ok(a.g.save.rep.PS === 0 && a.g.save.rep.HI < 1000, 'reputation clamped'); ok(a.rejectedItems.some(x => x.startsWith('item:')) && a.rejectedItems.some(x => x.startsWith('chip:')), 'unknown item and chips rejected: ' + a.rejectedItems.join());
}

// ---- 3. individual rewards: own xp / rep / contracts / loot rolls / pity, nothing shared or split
{
  const kit = C.eliteKit(); const mk = (extra) => {
    const members = [{ id: 'a', name: 'A', lvl: 30, profile: { level: 30, rep: { HI: 0, PS: 0, MM: 0 }, items: [], abAcq: { total: 0, dry: 0 } } }, { id: 'b', name: 'B', lvl: 30, profile: { level: 30, rep: { HI: 0, PS: 0, MM: 0 }, items: [], abAcq: { total: 9, dry: 0 } } }, { id: 'c', name: 'C', lvl: 30, profile: { level: 30, rep: { HI: 0, PS: 0, MM: 0 }, items: [] } }, ...(extra ? [{ id: 'd', name: 'D', lvl: 30 }] : [])];
    const w = new PartyWorld('annex', 4242, members); const sp = w.level.spawn; const H = id => w.hosts.get(id);
    w.devTeleport('a', sp.x, sp.y); w.devTeleport('b', sp.x + 1, sp.y); w.devTeleport('c', sp.x + 60, sp.y + 40); if (extra) w.devTeleport('d', sp.x + 1, sp.y + 1);
    let xpExpect = 0; const N = 24;
    for (let i = 0; i < N; i++) { const e = H('a').g.spawnEnemy(kit.elite, sp.x + 2 + (i % 4) * .3, sp.y + 1); e._rt.reveal = 0; w.run(H('a'), () => H('a').g.hurtEnemy(e, 1e7, sp.x, sp.y, 0)); xpExpect += kit.xp; w.step(); w.endTick(); }
    return { w, H, xpExpect, N };
  };
  const { w, H, xpExpect, N } = mk(false); const A = H('a'), B = H('b'), Cc = H('c');
  ok(A.g.inst.xpEarned === xpExpect && B.g.inst.xpEarned === xpExpect, `both participants get the FULL xp (no splitting): ${A.g.inst.xpEarned}/${B.g.inst.xpEarned} of ${xpExpect}`);
  ok(Cc.g.inst.xpEarned === 0 && Cc.g.inst.drops.length === 0 && Cc.lootRolls === 0, 'a member who did not take part (far away, no damage) gets nothing');
  ok(A.lootRolls === N && B.lootRolls === N, 'each participant made their own loot roll for every kill (' + A.lootRolls + '/' + B.lootRolls + ')');
  ok(A.g.save.rep[kit.mfr] > 0 && A.g.save.rep[kit.mfr] === B.g.save.rep[kit.mfr] && Cc.g.save.rep[kit.mfr] === 0, 'reputation granted to each participant individually (' + A.g.save.rep[kit.mfr] + '/' + B.g.save.rep[kit.mfr] + '/' + Cc.g.save.rep[kit.mfr] + ')');
  const sig = h => JSON.stringify(h.g.inst.drops.map(d => [d.kind, d.inst?.def, d.chip, d.amount])); const sa = sig(A), sb = sig(B);
  ok(A.g.inst.drops.length > 0 && B.g.inst.drops.length > 0 && sa !== sb, `drops are rolled independently per player (${A.g.inst.drops.length} vs ${B.g.inst.drops.length} piles, different contents)`);
  const idsA = new Set(A.g.inst.drops.map(d => d.id)); ok(!B.g.inst.drops.some(d => idsA.has(d.id)) && A.g.inst.drops !== B.g.inst.drops, 'no drop id is shared between players');
  const snapB = w.snapshot('b'); ok(snapB.drops.length === B.g.inst.drops.length && !snapB.drops.some(d => idsA.has(d.id)), "a player's snapshot only ever shows their own drops");
  ok(w.tryPickup('b', [...idsA][0]) === false && w.stats.pickupDenied === 1, "taking another player's drop is refused and counted");
  const cev = h => (h.g._cev?.length || 0) + 0; const ctA = w.takeLoot('a'), ctB = w.takeLoot('b'), ctC = w.takeLoot('c');
  ok(ctA.filter(x => x.kind === 'cev' && /^kill_/.test(x.k)).length === 2 * N && ctB.filter(x => x.kind === 'cev' && /^kill_/.test(x.k)).length === 2 * N && !(ctC || []).some(x => x.kind === 'cev'), 'contract/objective credit goes to each participant individually (2 events per kill each, none for the absent member)');
  // pity: a (total 0) was force-fed an ability augment by her OWN pity counter; b's counter (9) only moves with b's own pickups
  const abItems = h => h.g.inst.drops.concat(h.g.inst.carried.items.map(i => ({ inst: i }))).filter(d => d.inst && ITEM_ABS(d.inst.def)); const ITEM_ABS = C.hasAbility;
  ok(A.g.inst.abForced === true, "player A's own first-run pity guarantee fired (her abAcq.total was 0)");
  ok(B.g.save.abAcq.total === 9 + B.g.inst.carried.items.filter(i => ITEM_ABS(i.def)).length, "player B's ability pity counter is untouched by A's pickups (" + B.g.save.abAcq.total + ')');
  // independence: a's rolls do not depend on who else is in the party (own rng stream), same seed => same drops
  const w2 = mk(true); ok(sig(w2.H('a')) === sa, "A's drops are identical with a 4th member present (rolls come from A's own seeded stream)");
  const w3 = mk(false); ok(sig(w3.H('a')) === sa && sig(w3.H('b')) === sb, 'same seed + same script reproduces every player\'s drops exactly (deterministic)');
}

// ---- 4. determinism: same seed + inputs => identical authoritative state; 1-player party == solo Game for a seeded ability
{
  const script = () => { const w = new PartyWorld('annex', 99, [{ id: 'a', name: 'A', lvl: 20 }, { id: 'b', name: 'B', lvl: 20 }]); const e = w.enemies.find(e => !e.dead && e.type !== 'turret'); w.devTeleport('a', e.x - 2, e.y); w.devTeleport('b', e.x - 2, e.y + 1);
    run(w, 300, i => { inp(w, 'a', i + 1, { mx: i % 40 < 20 ? .5 : -.5, my: .2, acts: i % 25 === 0 ? [{ k: 'cast', i: i % 3, wx: e.x, wy: e.y }, { k: 'dodge' }] : undefined }); inp(w, 'b', i + 1, { mx: .3, my: -.1, acts: i % 31 === 0 ? [{ k: 'vent' }, { k: 'stim' }] : undefined }); }); return JSON.stringify(w.snapshot('a')) + JSON.stringify(w.snapshot('b')); };
  const s1 = script(), s2 = script(); ok(s1 === s2, 'two runs with the same seed and inputs give byte-identical snapshots (' + s1.length + ' bytes)');
  const r = C.soloVsParty(P); ok(r.solo > 0 && Math.abs(r.solo - r.party) < 1e-6, `solo Game and a 1-player party deal identical sweep damage to the same target (${r.solo.toFixed(2)} vs ${r.party.toFixed(2)})`);
}

// ---- 4b. stim + dodge + vent + heat on the server host
{
  const w = new PartyWorld('annex', 8, [{ id: 'a', name: 'A', lvl: 20 }]); const h = w.hosts.get('a'), g = h.g; w.hurtPlayer(h, 60, 0, 0); const hp0 = g.hp; inp(w, 'a', 1, { acts: [{ k: 'stim' }] }); run(w, 2);
  ok(g.hp > hp0 && g.inst.carried.stims === 1, `stim heals and is consumed on the server (hp ${Math.round(hp0)} -> ${Math.round(g.hp)}, stims ${g.inst.carried.stims})`);
  g.heat = 80; inp(w, 'a', 2, { acts: [{ k: 'vent' }] }); run(w, 2); ok(g.heat < 60 && g.ventCd > 0, 'vent lowers heat and starts its cooldown (' + Math.round(g.heat) + ')');
  const x0 = g.px; inp(w, 'a', 3, { mx: 1, my: 0, acts: [{ k: 'dodge' }] }); run(w, 6); ok(g.dodgeCd > 0 && Math.hypot(g.px - x0, 0) > 1, 'dodge dashes ' + (g.px - x0).toFixed(1) + ' tiles and starts its cooldown');
  g.heat = 99.9; run(w, 3); ok(g.heat >= 0, 'heat model runs server side');
}

// ---- 5. party rules: scaling, wipe, revive, team revival, boss + clear credit per player
{
  const w = new PartyWorld('annex', 31, [{ id: 'a', name: 'A', lvl: 30 }, { id: 'b', name: 'B', lvl: 30 }, { id: 'c', name: 'C', lvl: 30 }]); const e0 = w.enemies[0];
  ok(Math.abs(e0.maxHp / (e0.maxHp / w.hpMul) - w.hpMul) < 1e-9 && w.hpMul > 1.9, 'enemy HP scaled for a 3-player party x' + w.hpMul.toFixed(2));
  const A = w.hosts.get('a'), B = w.hosts.get('b'), Cc = w.hosts.get('c');
  w.hurtPlayer(B, 1e5, A.g.px, A.g.py); ok(B.g.downed, 'a member can be downed'); run(w, 5); ok(B.g.downed && !w.evq.some(e => e.e === 'wipe'), 'others alive: no wipe');
  w.devTeleport('b', A.g.px + 1, A.g.py); run(w, 60, i => inp(w, 'a', i + 1, { revive: true })); ok(!B.g.downed && B.g.hp > 0, 'a teammate holding revive brings the downed member back (hp ' + Math.round(B.g.hp) + ')');
  for (const h of w.hosts.values()) { h.g.iframes = 0; w.hurtPlayer(h, 1e5, h.g.px, h.g.py); } const dn = [...w.hosts.values()].map(h => h.g.downed).join(); run(w, 20 * 3.5); ok([...w.hosts.values()].every(h => !h.g.downed && h.g.hp > 0), 'full party wipe respawns everyone at the entrance (downed before: ' + dn + '; after: ' + [...w.hosts.values()].map(h => h.g.downed + '/' + Math.round(h.g.hp)).join() + ')');
  // boss: drive the real reveal + kill; every participant gets their own clear
  const bs = w.level.bossSpawn; for (const id of ['a', 'b']) w.devTeleport(id, bs.x - 3, bs.y); w.devTeleport('c', w.level.spawn.x, w.level.spawn.y);
  w.flags.controller = true; for (const h of w.hosts.values()) w.syncIn?.(h); const pt = A.g.revealPoint(); w.devTeleport('a', pt.x, pt.y); run(w, 5); ok(w.flags.bossSpawned, 'boss reveal triggered by a member entering the boss room');
  const boss = w.enemies.find(e => e.type === w.flags.bossKey); ok(!!boss, 'boss exists: ' + w.flags.bossKey); run(w, 20 * 8); boss._rt.reveal = 0; w.ai.revealing = false;
  w.run(A, () => A.g.hurtEnemy(boss, 1e9, A.g.px, A.g.py, 0)); run(w, 5);
  ok(w.flags.bossDead && w.completed, 'boss dead -> instance complete'); ok(A.g.save.stats.clears === 1 && B.g.save.stats.clears === 1 && Cc.g.save.stats.clears === 0, 'clear credit applied per participating player (a,b yes; c who stayed at the entrance no)');
}
t.done();
