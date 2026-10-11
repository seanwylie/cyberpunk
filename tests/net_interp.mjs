// Protocol-level checks: input sanitising / speed-hack resistance on the real-core world, interpolation, string sanitising. No sockets.
import { load, mkTest } from './net_lib.mjs';
const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
const { ok, done } = mkTest();
const P = await load('src/core/party.ts', 'core'); const sh = await load('src/net/shared.ts', 'shared'); const ip = await load('src/net/interp.ts', 'interp');
const mk = n => new P.PartyWorld('annex', 4242, Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, lvl: 10 })));
{ const a = mk(2), b = mk(2); ok(a.enemies.length === b.enemies.length && a.enemies.length > 10 && a.level.spawn.x === b.level.spawn.x, `deterministic seed: ${a.enemies.length} enemies`); }
{ const s1 = mk(1), s4 = mk(4); ok(Math.abs(s4.enemies[0].maxHp / s1.enemies[0].maxHp - sh.partyHpMul(4)) < 1e-6 && sh.partyDmgMul(4) > 1, `enemy HP x${sh.partyHpMul(4).toFixed(2)} for 4 players`); }
{ const s = mk(1); const p = s.hosts.get('p0'); const x0 = p.x, y0 = p.y; for (let i = 1; i <= 20; i++) { s.input('p0', { t: 'input', seq: i, mx: 1e9, my: NaN, atk: false, face: 0 }); s.step(); }
  const d = Math.hypot(p.x - x0, p.y - y0); ok(d <= p.spd * 1.05 + .3, `speed hack clamped: moved ${d.toFixed(2)} tiles in 1 s (max ${p.spd.toFixed(1)}/s)`);
  const last = p.lastSeq; s.input('p0', { t: 'input', seq: 3, mx: 1, my: 0, atk: false, face: 0 }); s.step(); ok(p.lastSeq === last, 'replayed/stale input seq ignored'); }
{ const s = mk(1); for (let i = 1; i <= 500; i++) s.input('p0', { t: 'input', seq: i, mx: 1, my: 0, atk: false, face: 0, acts: [{ k: 'dodge' }, { k: 'cast', i: 99, wx: 1, wy: 1 }, { k: 'bogus' }] }); const p = s.hosts.get('p0'); ok(p.q.length <= 4 && p.acts.length <= 8, `input queue and action queue bounded (${p.q.length}/${p.acts.length}); invalid actions dropped`); }
{ const I = new ip.Interp(.1); I.push(1.0, 1000, [{ id: 'a', x: 0, y: 0, face: 0 }]); I.push(1.05, 1050, [{ id: 'a', x: 1, y: 0, face: 0 }]); I.push(1.10, 1100, [{ id: 'a', x: 2, y: 0, face: 0 }]); const v = I.sample(1175)[0]; ok(v && v.x > 0.3 && v.x < 1.9, 'interpolation renders between snapshots: x=' + v?.x.toFixed(2)); }
ok(sh.cleanName('<b>Bob</b>  the Great Destroyer of Worlds').length <= 16 && !sh.cleanName('<script>').includes('<'), 'names sanitised'); ok(sh.cleanChat('hi\u0000<x>') === 'hix', 'chat sanitised');
done();
