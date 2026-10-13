// Town copies ("Rustline 1"): cap, overflow into a new copy, party members routed to the leader's copy (reserved seats), empty copies close, towns numbered separately.
import { load, sleep, until, mkTest } from './net_lib.mjs'; import WebSocket from 'ws';
const { ok, done } = mkTest(); const { startHub } = await load('server/hub.ts', 'hub'); const { PROTO, TOWN_SHARD_CAP } = await load('src/net/shared.ts', 'shared');
const hub = startHub({ port: 0, host: '127.0.0.1', townCap: 3, shardIdleMs: 400 }); await hub.ready; const URL = 'ws://127.0.0.1:' + hub.port();
const guest = name => new Promise(res => { const ws = new WebSocket(URL); const c = { ws, name, msgs: [], id: '', town: null, send: m => ws.send(JSON.stringify(m)) }; ws.on('message', d => { const m = JSON.parse(String(d)); c.msgs.push(m); if (m.t === 'welcome') { c.id = m.id; res(c); } if (m.t === 'town') c.town = m; }); ws.on('open', () => c.send({ t: 'hello', proto: PROTO, name })); });
const enter = async (c, town = 'rustline') => { c.town = null; c.send({ t: 'town_join', town }); await until(() => c.town); return c.town; };
const last = (c, t) => [...c.msgs].reverse().find(m => m.t === t);
ok(TOWN_SHARD_CAP === 12, 'default cap is 12 (perf-gate load)');
const G = []; for (const n of ['a', 'b', 'c', 'd']) G.push(await guest(n));
for (const c of G.slice(0, 3)) await enter(c); ok(G.slice(0, 3).every(c => c.town.n === 1 && c.town.shard === 'rustline-1' && c.town.cap === 3), 'first 3 players share Rustline 1');
await enter(G[3]); ok(G[3].town.n === 2, 'when copy 1 is full, Rustline 2 opens');
const h = await guest('h'); ok((await enter(h, 'harrow')).n === 1, 'each town numbers its own copies');
// party: a (copy 1) invites d (copy 2) -> d moves to the leader's copy even above the cap
G[0].send({ t: 'invite', to: G[3].id }); await until(() => last(G[3], 'invite')); G[3].town = null; G[3].send({ t: 'invite_reply', from: G[0].id, ok: true });
ok(await until(() => G[3].town?.shard === 'rustline-1'), 'party member is moved to the leader\'s copy (reserved seat, 4/3)'); ok(hub.shards.get('rustline-1').members.size === 4, 'copy 1 holds the party over the cap');
// a new arrival does not take a party seat; a member returning from a dungeon still lands with the leader
const e = await guest('e'); ok((await enter(e)).shard === 'rustline-2', 'newcomer goes to the copy with room');
G[3].send({ t: 'town_leave' }); G[1].send({ t: 'town_leave' }); await sleep(100); ok(hub.shards.get('rustline-1').members.size === 2, 'party mate (and one stranger) left town: 2 present + 1 reserved = full');
const f = await guest('f'); ok((await enter(f)).shard !== 'rustline-1', 'away party mate keeps a reserved seat (newcomer not put into copy 1)');
ok((await enter(G[3])).shard === 'rustline-1', 'returning party member goes back to the leader\'s copy');
// empty copies close after the idle time; numbers are reused
for (const c of [e, f]) c.send({ t: 'town_leave' }); await sleep(100); ok(hub.shards.has('rustline-2'), 'empty copy stays open briefly (people coming back)');
ok(await until(() => !hub.shards.has('rustline-2'), 3000), 'empty copy closes after the idle time');
const g2 = await guest('g'); ok((await enter(g2)).n === 2, 'lowest free number is reused');
ok(/^\w+ \d$/.test('Rustline ' + g2.town.n) && g2.town.pop >= 1, 'town message carries the copy number, cap and population');
for (const c of [...G, h, e, f, g2]) c.ws.close(); await hub.close(); done();
