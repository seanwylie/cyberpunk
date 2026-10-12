// Living city on the hub: arbitrated pivotal events (party boss kill -> clears), anti-spoof for client claims (rate, caps, timing, no party
// clear claims), privacy opt-in for names, persistence, low-bandwidth diffs to town shards, /city endpoints.
import WebSocket from 'ws'; import http from 'node:http'; import { load, mkTest, sleep, until } from './net_lib.mjs';
const { ok, done } = mkTest(); const { startHub } = await load('server/hub.ts', 'hubc'); const S = await load('server/city_srv.ts', 'citysrv'); const { NetClient } = await load('src/net/client.ts', 'clientc');
const store = () => { const m = new Map(); return { get: k => m.get(k) ?? null, set: (k, v) => m.set(k, v) }; };
const get = (port, path) => new Promise(r => http.get({ port, host: '127.0.0.1', path }, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => r({ status: res.statusCode, body: b })); }).on('error', () => r({ status: 0, body: '' })));
const st = S.memStore(); const city = new S.CityHub(st); await city.init(); await city.refreshNews();
const hub = startHub({ port: 0, host: '127.0.0.1', dev: true, city, citySyncMs: 200 }); await hub.ready; const url = 'ws://127.0.0.1:' + hub.port();
const bot = n => new NetClient({ url, name: n, lvl: 20, WS: WebSocket, store: store() }); const A = bot('Vexa'), B = bot('Moth'); A.connect(); B.connect(); await until(() => A.state === 'online' && B.state === 'online');
const got = { A: [], B: [] }; A.on('city', m => got.A.push(m)); B.on('city', m => got.B.push(m));
A.profile('Vexa', 20, undefined, 1); B.profile('Moth', 20, undefined, 0); await sleep(100);
ok(city.s.week.players[A.id]?.name === 'Vexa' && !city.s.week.players[B.id], 'privacy: only the opted-in player is recorded by name');
A.send({ t: 'town_join', town: 'rustline', cv: -1 }); await until(() => got.A.length > 0); ok(got.A[0] && got.A[0].d.length === 11 && JSON.stringify(got.A[0]).length < 700, `town join gets one full snapshot (${JSON.stringify(got.A[0] || {}).length} bytes)`);
const nA = got.A.length; A.send({ t: 'town_leave' }); await sleep(50); A.send({ t: 'town_join', town: 'rustline', cv: city.s.v }); await sleep(150); ok(got.A.length === nA, 'rejoin with the current version: no resend');
// arbitrated clear: party room, boss kill accepted by the hub
const nm0 = city.s.week.dist.neon_mile?.clear || 0; A.createParty(); await until(() => A.party?.code); B.joinParty(A.party.code); await until(() => B.party?.members?.length === 2); A.setDungeon('warehouse'); await sleep(50); B.setReady(true); await sleep(50); A.start(); await until(() => A.inst && B.inst);
A.send({ t: 'kill', id: 1 }); A.send({ t: 'kill', id: 2 }); A.send({ t: 'flag', k: 'bossSpawned', v: true }); await sleep(60); A.send({ t: 'kill', id: 0 }); await sleep(100);
ok((city.s.week.dist.neon_mile?.clear || 0) === nm0 + 2, 'party boss kill (hub-arbitrated) credits one clear per member to Neon Mile');
ok(city.s.week.players[A.id]?.clears === 1, 'opted-in player tally counts the arbitrated clear');
A.send({ t: 'kill', id: 0 }); await sleep(80); ok((city.s.week.dist.neon_mile?.clear || 0) === nm0 + 2, 'a second boss claim credits nothing');
const c0 = city.s.week.dist.neon_mile.clear; A.send({ t: 'cev', k: 'run', dungeon: 'warehouse' }); A.send({ t: 'cev', k: 'clear', dungeon: 'warehouse', kills: 999 }); await sleep(80); ok(city.s.week.dist.neon_mile.clear === c0, 'clear claims from inside a party room are refused (arbitrated only)');
// claim validation (unit, deterministic clock)
const C2 = new S.CityHub(null, 0); const T = Date.UTC(2026, 9, 6, 12);
ok(!C2.claim('x', { k: 'hack', dungeon: 'warehouse' }, {}, T).ok, 'claims without a run start are refused');
ok(!C2.claim('x', { k: 'run', dungeon: 'not_a_dungeon' }, {}, T).ok && !C2.claim('x', { k: 'hack', dungeon: 'not_a_dungeon' }, {}, T).ok, 'unknown dungeon refused');
C2.claim('x', { k: 'run', dungeon: 'warehouse' }, {}, T); let acc = 0; for (let i = 0; i < 30; i++) if (C2.claim('x', { k: 'hack', dungeon: 'warehouse' }, {}, T).ok) acc++; ok(acc === S.CLAIM.perMin, `burst of 30 hacks: only ${acc} accepted (rate limit ${S.CLAIM.perMin}/min)`);
acc = 0; for (let i = 1; i <= 40; i++) if (C2.claim('x', { k: 'hack', dungeon: 'warehouse' }, {}, T + i * 20e3).ok) acc++; ok(acc + S.CLAIM.perMin === S.CLAIM.hackPerRun, `per-run hack cap ${S.CLAIM.hackPerRun}`);
ok(!C2.claim('y', { k: 'run', dungeon: 'warehouse' }, {}, T).ok === false && !C2.claim('y', { k: 'clear', dungeon: 'warehouse' }, {}, T + 10e3).ok, 'solo clear 10 s after run start is refused (min run time)');
const w0 = C2.s.week.dist.neon_mile?.clear || 0; ok(C2.claim('y', { k: 'clear', dungeon: 'warehouse', kills: 5000 }, {}, T + 120e3).ok && C2.s.week.dist.neon_mile.clear === w0 + 1 && (C2.s.week.dist.neon_mile.kill || 0) <= 80, 'valid solo clear accepted once, claimed kills clamped to 80');
ok(!C2.claim('y', { k: 'clear', dungeon: 'warehouse' }, {}, T + 130e3).ok, 'a second clear of the same run is refused');
{ const C3 = new S.CityHub(null, 0); let n = 0; for (let r = 0; r < 200; r++) { C3.claim('z', { k: 'run', dungeon: 'warehouse' }, {}, T + r * 60e3); for (let i = 0; i < 4; i++) if (C3.claim('z', { k: 'speech', dungeon: 'warehouse', ok: 1 }, {}, T + r * 60e3 + i * 15e3).ok) n++; } ok(n === S.CLAIM.perDay, `daily claim cap ${S.CLAIM.perDay} per player (${n} accepted)`); }
{ const C4 = new S.CityHub(null, 0); const before = C4.s.dist.neon_mile.inf[1]; for (let p = 0; p < 300; p++) { const id = 'bot' + p; C4.claim(id, { k: 'run', dungeon: 'warehouse' }, {}, T); for (let i = 0; i < 4; i++) C4.claim(id, { k: 'hack', dungeon: 'warehouse' }, {}, T + i); }
  const moved = before - C4.s.dist.neon_mile.inf[1]; ok(moved <= 12.01 && C4.s.dist.neon_mile.ctrl === 1, `300 spoofing clients in one hour move at most the hourly cap (${moved.toFixed(1)}) and cannot flip Neon Mile`); }
ok(!C2.claim('q', { k: 'run', dungeon: 'warehouse' }, {}, T).ok === false && C2.claim('q', { k: 'speech', dungeon: 'warehouse', f: 'Not A Faction', ok: 1 }, {}, T).ok && C2.s.dist.neon_mile.inf.length === 6 && !('Not A Faction' in C2.s.dist), 'bad faction name falls back to the dungeon faction (no new factions can be injected)');
// low-bandwidth diffs to the town shard
B.send({ t: 'leave_instance' }); await sleep(50); B.send({ t: 'town_join', town: 'rustline', cv: -1 }); await until(() => got.B.length > 0); const nb = got.B.length; city.claim('solo1', { k: 'run', dungeon: 'warehouse' }, {}, Date.now() - 200e3); city.claim('solo1', { k: 'clear', dungeon: 'warehouse' }, {}, Date.now());
await until(() => got.B.length > nb, 2000); const d = got.B[got.B.length - 1]; ok(d && d.p === 1 && d.d.filter(x => x.length).length === 1 && JSON.stringify(d).length < 140, `change -> one diff with only the changed district (${JSON.stringify(d || {}).length} bytes)`);
await sleep(700); ok(got.B.length === nb + 1, 'no change -> nothing sent');
// endpoints + persistence + opt-out
const ns = await get(hub.port(), '/city/news'); const nj = JSON.parse(ns.body || '{}'); ok(ns.status === 200 && Array.isArray(nj.items) && nj.items.length > 0, '/city/news serves a feed (canned until the Lambda writes one)');
const ss = await get(hub.port(), '/city/state'); ok(ss.status === 200 && JSON.parse(ss.body).d.length === 11, '/city/state serves the compact snapshot');
city.dirty = true; await city.persist(); ok(st.saved >= 1 && st.data.state.week && st.data.state.names.towns.neon_mile === 'Neon Mile', 'state persists (with town names for the news Lambda)');
const C5 = new S.CityHub(st); await C5.init(); ok(C5.s.v === city.s.v && C5.s.week.dist.neon_mile.clear === city.s.week.dist.neon_mile.clear, 'a restarted hub resumes the persisted city');
A.profile('Vexa', 20, undefined, 0); await sleep(80); ok(!city.s.week.players[A.id], 'opting out removes the name from the tallies');
const st2 = { load: async () => { throw new Error('ddb down'); }, save: async () => { throw new Error('ddb down'); }, news: async () => null }; const C6 = new S.CityHub(st2); await C6.init(); C6.dirty = true; await C6.persist(); ok(C6.stats.saveErr === 1 && C6.dirty, 'store outage: hub starts fresh, keeps playing, retries the save later');
A.close(); B.close(); await hub.close(); done();
