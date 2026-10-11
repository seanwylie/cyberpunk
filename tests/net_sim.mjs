// Unit-level checks of the authoritative sim + shared helpers (no sockets).
import { load, mkTest } from './net_lib.mjs';
const { ok, done } = mkTest();
const sim = await load('src/net/netsim.ts', 'sim'); const sh = await load('src/net/shared.ts', 'shared'); const ip = await load('src/net/interp.ts', 'interp');
const mk = (n, o) => new sim.InstanceSim('annex', 4242, Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, lvl: 10 })), o);
// determinism: same seed => same enemies and spawn
const a = mk(2), b = mk(2); ok(a.enemies.length === b.enemies.length && a.enemies.length > 10 && a.level.spawn.x === b.level.spawn.x, `deterministic seed: ${a.enemies.length} enemies`);
// scaling by party size
const s1 = mk(1), s4 = mk(4); ok(Math.abs(s4.enemies[0].maxHp / s1.enemies[0].maxHp - sh.partyHpMul(4)) < 1e-6 && sh.partyHpMul(4) > sh.partyHpMul(2) && sh.partyDmgMul(4) > 1, `enemy HP x${sh.partyHpMul(4).toFixed(2)} dmg x${sh.partyDmgMul(4).toFixed(2)} at 4 players`);
// speed hack: huge / NaN inputs are clamped
{ const s = mk(1); const p = s.players.get('p0'); const x0 = p.x; for (let i = 1; i <= 20; i++) { s.input('p0', { t: 'input', seq: i, mx: 1e9, my: NaN, atk: false, face: 0 }); s.step(); } const d = Math.hypot(p.x - x0, 0); ok(d <= 5.6 * 1.0 + .01, `speedhack clamped: moved ${d.toFixed(2)} tiles in 1 s (max 5.6)`);
  const lastSeq = p.lastSeq; s.input('p0', { t: 'input', seq: 3, mx: 1, my: 0, atk: false, face: 0 }); s.step(); ok(p.lastSeq === lastSeq, 'replayed/stale input seq ignored'); }
// input flood: queue bounded
{ const s = mk(1); for (let i = 1; i <= 500; i++) s.input('p0', { t: 'input', seq: i, mx: 1, my: 0, atk: false, face: 0 }); ok(s.players.get('p0').q.length <= 4, 'input queue bounded (flood cannot fast-forward the player)'); }
// loot instancing + boss kill
{ const s = mk(3, { dmgMul: 8 }); const bs = s.level.bossSpawn; ['p0', 'p1', 'p2'].forEach((id, i) => s.devTeleport(id, bs.x - 2 - i * .4, bs.y)); let q = 0; for (let i = 0; i < 3000 && !s.completed; i++) { for (const id of ['p0', 'p1', 'p2']) s.input(id, { t: 'input', seq: ++q, mx: 0, my: 0, atk: true, face: 0 }); s.step(); }
  ok(s.bossDead && s.completed, 'party kills boss -> instance completed');
  const ids = ['p0', 'p1', 'p2'].map(id => s.players.get(id)); const dropIds = ids.flatMap(p => p.drops.map(d => d.id)); ok(new Set(dropIds).size === dropIds.length, 'drop ids unique across players');
  ok(ids.every(p => p.drops.length + p.got.length >= 2), 'every player rolled their own loot (' + ids.map(p => p.drops.length + p.got.length).join('/') + ')');
  const snap = s.snapshot('p0'); ok(snap.drops.every(d => !('owner' in d)) && snap.drops.length === s.players.get('p0').drops.length, 'snapshot only carries recipient\'s own drops');
  const other = ids[1].drops[0]; ok(!other || s.tryPickup('p0', other.id) === false, 'cannot pick up another player\'s drop (denied: ' + s.stats.pickupDenied + ')'); }
// revive
{ const s = mk(2); const d = s.players.get('p1'), r = s.players.get('p0'); d.x = r.x + .5; d.y = r.y; s.hurtPlayer(d, 9999); ok(d.down, 'player downs at 0 hp'); let q = 0; for (let i = 0; i < 80; i++) { s.input('p0', { t: 'input', seq: ++q, mx: 0, my: 0, atk: false, face: 0, revive: true }); s.step(); } ok(!d.down && d.hp > 0, 'teammate holding revive for 2.5 s revives (hp ' + d.hp + ')'); }
// wipe resets
{ const s = mk(2); for (const p of s.players.values()) s.hurtPlayer(p, 9999); for (let i = 0; i < 80; i++) s.step(); ok([...s.players.values()].every(p => !p.down && p.hp === p.maxHp), 'full wipe respawns the party at the entrance'); }
// interpolation
{ const I = new ip.Interp(.1); I.push(1.0, 1000, [{ id: 'a', x: 0, y: 0, face: 0 }]); I.push(1.05, 1050, [{ id: 'a', x: 1, y: 0, face: 0 }]); I.push(1.10, 1100, [{ id: 'a', x: 2, y: 0, face: 0 }]); const x0 = I.sample(1100)[0].x, x1 = I.sample(1150)[0].x; ok(Math.abs(x0) < .05 && Math.abs(x1 - 1) < .05, `interp renders 100 ms behind newest (x=${x0.toFixed(2)} then ${x1.toFixed(2)})`); }
// sanitising
ok(sh.cleanName('<b>Bob</b>  the Great Destroyer of Worlds') .length <= 16 && !sh.cleanName('<script>').includes('<'), 'names sanitised'); ok(sh.cleanChat('hi\u0000<x>') === 'hix', 'chat sanitised');
done();
