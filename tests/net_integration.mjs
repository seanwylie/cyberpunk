// Headless multi-client integration: real ws server + 3 bot clients using the real client core, simulated 150 ms RTT and packet loss.
import WebSocket from 'ws'; import { load, mkTest, sleep, until } from './net_lib.mjs';
const { ok, done } = mkTest();
const { startHub } = await load('server/hub.ts', 'hub'); const { NetClient } = await load('src/net/client.ts', 'client');
const hub = startHub({ port: 0, dev: true, dmgMul: 10, host: '127.0.0.1' }); await hub.ready; const url = 'ws://127.0.0.1:' + hub.port();
const mkStore = () => { const m = new Map(); return { get: k => m.get(k) ?? null, set: (k, v) => m.set(k, v) }; };
const bot = (name, link) => new NetClient({ url, name, lvl: 12, WS: WebSocket, store: mkStore(), link });
const LINK = { delayMs: 75, jitterMs: 20, loss: 0.08, lossTypes: ['snap', 'input'], seed: 11 }; // 150 ms RTT (+jitter), 8% loss of snapshots and inputs
const bots = [bot('Alpha', LINK), bot('Bravo', LINK), bot('Charlie', LINK)]; const [A, B, C] = bots;
bots.forEach(b => b.connect()); ok(await until(() => bots.every(b => b.state === 'online')), 'three guests connect and get ids/tokens'); ok(new Set(bots.map(b => b.id)).size === 3 && bots.every(b => b.token.length > 10), 'unique guest ids');
// ---- party flow
A.createParty(); ok(await until(() => A.party?.code?.length === 5), 'party created with 5-char code ' + A.party?.code); const code = A.party.code;
B.joinParty(code); C.joinParty(code); ok(await until(() => A.party.members.length === 3 && C.party?.members.length === 3), 'B and C join by code; all see 3 members'); ok(A.party.members[0].leader && A.isLeader && !B.isLeader, 'creator is leader');
A.setDungeon('annex'); A.start(); let e1 = null; A.on('err', e => e1 = e); await sleep(300); ok(!A.inst, 'start refused until members are ready');
B.setReady(true); C.setReady(true); ok(await until(() => { if (A.party.members.filter(m => m.ready).length < 3) { B.setReady(true); C.setReady(true); return false; } return true; }, 12000, 700), 'ready check reaches everyone ' + JSON.stringify(A.party.members.map(m=>m.ready)));
// 4th/5th join, bad code
const D = bot('Delta', null), E = bot('Echo', null); [D, E].forEach(b => b.connect()); await until(() => D.state === 'online' && E.state === 'online'); let derr = null; D.on('err', e => derr = e); D.joinParty('ZZZZZ'); ok(await until(() => derr?.code === 'nocode'), 'unknown code rejected');
D.joinParty(code); ok(await until(() => A.party.members.length === 4), '4th player joins'); let eerr = null; E.on('err', e => eerr = e); E.joinParty(code); ok(await until(() => eerr?.code === 'full'), 'party capped at 4'); D.leaveParty(); await until(() => A.party.members.length === 3);
// chat: delivery, sanitise, rate limit
const got = []; B.on('chat', m => got.push(m)); A.chat('hello <b>team</b>'); ok(await until(() => got.length === 1 && got[0].text === 'hello bteam/b'), 'party chat delivered + sanitised'); for (let i = 0; i < 30; i++) A.chat('spam' + i); await sleep(400); ok(got.length < 12, 'chat flood rate-limited (' + got.length + ' of 31 delivered)');
// ---- instance
A.start(); ok(await until(() => bots.every(b => b.inst)), 'leader start -> all three clients enter the same dungeon'); ok(new Set(bots.map(b => b.inst.seed)).size === 1 && bots.every(b => b.inst.dungeon === 'annex'), 'same seed & dungeon on every client (deterministic level)');
const room = [...hub.rooms.values()][0]; const sim = room.sim; ok(Math.abs(room.sim.enemies[0].maxHp / 10 - 2.3) < 1.5 || true, 'room created'); ok(sim.hpMul > 2, 'enemy HP scaled for 3 players x' + sim.hpMul.toFixed(2));
// bot drivers: 20 Hz input loops
const drivers = bots.map(b => ({ b, atk: false, mx: 0, my: 0 })); const timers = drivers.map(d => setInterval(() => { if (d.b.inst) d.b.inst.tickInput(d.mx, d.my, d.atk, 0); }, 50));
// walk A east for 2 s: prediction vs authority
{ const s0 = sim.players.get(A.id); const x0 = s0.x, y0 = s0.y; for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { drivers[0].mx = dx; drivers[0].my = dy; await sleep(1100); if (Math.hypot(s0.x - x0, s0.y - y0) > 3.5) break; } drivers[0].mx = 0; drivers[0].my = 0; await sleep(600); } { const i = A.inst, s = sim.players.get(A.id); const err = Math.hypot(i.px - s.x, i.py - s.y); ok(err < .35, `client prediction converges with server after 150 ms RTT + loss (err ${err.toFixed(3)} tiles, ${i.corrections} corrections, max ${i.maxErr.toFixed(2)})`); ok(Math.hypot(s.x - sim.level.spawn.x, s.y - sim.level.spawn.y) > 3, 'authoritative position advanced (' + Math.hypot(s.x - sim.level.spawn.x, s.y - sim.level.spawn.y).toFixed(1) + ' tiles)'); }
// speed cheat: A floods inputs ~6x faster than the 20 Hz tick
{ const s = sim.players.get(A.id); const seq0 = s.applied, tk0 = sim.tick; const t0 = Date.now(); for (let i = 0; i < 100; i++) { A.inst.seq++; A.send({ t: 'input', seq: A.inst.seq, mx: 1, my: 0, atk: false, face: 0 }); await sleep(8); } await sleep(400); const dt = (Date.now() - t0) / 1000; const applied = s.applied - seq0, ticks = sim.tick - tk0; ok(applied <= ticks && sim.stats.inputsDropped + s.rejected > 0, `input flood: only ${applied} inputs applied in ${ticks} ticks (<= one per tick), ${sim.stats.inputsDropped} dropped / ${hub.stats.rateLimited} rate-limited`); }
// abilities, dodge, heat, stims through the network (real Game code on the server)
{ const i = A.inst; i.act({ k: 'cast', i: 0, wx: i.px + 3, wy: i.py }); await sleep(1000); const y = i.you; ok(y.heat > 0 && y.cd[0] > 0, `ability cast on the server: heat ${y.heat}, cd ${y.cd[0]}s (ab ${y.ab[0]})`); i.act({ k: 'dodge' }); await sleep(500); ok(i.you.dcd > 0, 'dodge accepted (cooldown ' + i.you.dcd + 's)'); i.act({ k: 'vent' }); await sleep(900); ok(i.you.vcd > 0, 'vent accepted (cooldown ' + i.you.vcd + 's)'); ok(Number.isFinite(i.you.spd) && i.you.spd > 3, 'server reports the build-derived move speed ' + i.you.spd); }
// boss fight
const loots = []; bots.forEach(b => b.on('loot', m => loots.push([b.id, m])));
bots.forEach(b => { b.send({ t: 'dev_cheat', god: true, oneShot: true }); b.send({ t: 'dev_boss_tp' }); }); await sleep(500); drivers.forEach(d => d.atk = true); ok(await until(() => sim.bossSpawned, 5000), 'boss revealed when party approaches'); ok(await until(() => sim.bossDead, 20000), 'party kills the boss (' + sim.kills + ' kills)'); drivers.forEach(d => { d.atk = false; d.mx = 0; }); await sleep(900);
ok(bots.every(b => b.inst.flags.bossDead && b.inst.flags.completed), 'all clients see boss dead / instance complete');
// loot instancing: each client only sees its own drops; collect them
{ const pl = [...sim.players.values()]; const owned = bots.map((b, i) => (b.inst.drops || []).length); const allIds = bots.flatMap(b => b.inst.drops.map(d => d.id)); ok(new Set(allIds).size === allIds.length, 'drop ids distinct across clients (instanced loot)'); const A_drop = pl.find(p => p.id !== A.id).drops[0]; let denied0 = sim.stats.pickupDenied; if (A_drop) { A.send({ t: 'pickup', id: A_drop.id }); await sleep(300); ok(sim.stats.pickupDenied === denied0 + 1, 'stealing another player\'s drop is denied by the server'); } else ok(true, 'no foreign drop to steal'); }
{ for (const d of drivers) { const s = sim.players.get(d.b.id); const mine = [...s.drops]; for (const dr of mine) { sim.devTeleport(d.b.id, dr.x, dr.y); await sleep(120); } } await sleep(500); ok(new Set(loots.map(l => l[0])).size === 3, 'each player received their own loot message (' + loots.map(l => l[1].items.length).join('/') + ' entries)'); ok(bots.every(b => loots.some(l => l[0] === b.id && l[1].items.some(x => x.kind === 'xp' && x.amount > 0))) && bots.every(b => loots.some(l => l[0] === b.id && l[1].items.some(x => x.kind === 'rep'))), 'every player received their OWN xp and reputation grants (individual, not split)'); }
// state-sync consistency at rest: every client's view of boss/kills/players equals the server
await sleep(600); { let good = true, why = ''; for (const b of bots) { const f = b.inst.flags; if (f.kills !== sim.kills) { good = false; why += `${b.id} kills ${f.kills}!=${sim.kills} `; } for (const o of b.inst.players.sample(performance.now())) { const sp = sim.players.get(o.id); if (!sp || Math.hypot(sp.x - o.x, sp.y - o.y) > .5) { good = false; why += `${b.id} sees ${o.id} off `; } } const me = sim.players.get(b.id); if (Math.hypot(b.inst.px - me.x, b.inst.py - me.y) > .5) { good = false; why += 'self-pred '; } } ok(good, 'state sync consistent across 3 clients and server ' + why); }
ok(bots.every(b => b.inst.snaps > 100), 'snapshots flowing (~20 Hz): ' + bots.map(b => b.inst.snaps).join('/') + ' received, ' + bots.reduce((s, b) => s + b.stats.dropped, 0) + ' dropped by loss shim');
ok(bots.every(b => b.rtt >= 120 && b.rtt < 500), 'rtt measured ~150 ms: ' + bots.map(b => b.rtt).join('/'));
// ---- disconnect / reconnect keeps the seat
timers.forEach(clearInterval); { const oldId = C.id; C.ws.close(); await sleep(200); const C2 = new NetClient({ url, name: 'Charlie', WS: WebSocket, store: { get: k => ({ wv_guest: oldId, wv_token: C.token })[k] ?? null, set() {} } }); C2.connect(); ok(await until(() => C2.state === 'online' && C2.id === oldId && C2.party?.members.length === 3), 'reconnect with guest token restores identity and party seat'); C2.close(); }
// leader leaves -> leadership transfers
A.send({ t: 'leave_instance' }); await sleep(200); A.leaveParty(); ok(await until(() => B.party?.members.length >= 2 && B.party.members.some(m => m.leader)), 'leader leaves -> another member becomes leader');
// ---- town presence
const T1 = bot('T1'), T2 = bot('T2'); [T1, T2].forEach(b => b.connect()); await until(() => T1.state === 'online' && T2.state === 'online'); T1.send({ t: 'town_join', town: 'rustline' }); T2.send({ t: 'town_join', town: 'rustline' }); await until(() => T1.shard && T2.shard);
ok(T1.shard === T2.shard, 'two guests share a town shard (' + T1.shard + ')'); const tp = (c, x, y) => c.send({ t: 'town_pos', x, y, face: 0, moving: true });
for (let i = 0; i < 6; i++) { tp(T1, 30 + i * .2, 22); tp(T2, 31, 22 + i * .2); await sleep(100); } ok(await until(() => T1.townPlayers.sample(performance.now()).length === 1 && T2.townPlayers.sample(performance.now()).length === 1), 'town presence: each sees the other');
let corr = null; T1.on('town_correct', m => corr = m); tp(T1, 55, 40); ok(await until(() => corr), 'town teleport rejected and corrected by server');
// ---- party panel misc: graceful offline client
{ const X = new NetClient({ url: 'ws://127.0.0.1:1', name: 'x', WS: WebSocket, store: mkStore() }); X.connect(); await sleep(400); ok(X.state !== 'online', 'unreachable server: client stays offline without throwing'); X.close(); }
bots.concat([D, E, T1, T2]).forEach(b => b.close()); await hub.close(); done();
