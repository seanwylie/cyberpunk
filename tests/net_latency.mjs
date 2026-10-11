// Latency test: with 200 ms simulated RTT (100 ms each way, jitter, 8% loss) the local player's input is NEVER delayed:
// gameplay is client-authoritative, so movement is applied in the same call as the input and the network only carries display state for teammates.
import WebSocket from 'ws'; import { load, mkTest, sleep, until } from './net_lib.mjs';
const { ok, done } = mkTest();
const { startHub } = await load('server/hub.ts', 'hub'); const { NetClient } = await load('src/net/client.ts', 'client');
const hub = startHub({ port: 0, host: '127.0.0.1' }); await hub.ready; const url = 'ws://127.0.0.1:' + hub.port();
const mkStore = () => { const m = new Map(); return { get: k => m.get(k) ?? null, set: (k, v) => m.set(k, v) }; };
const LINK = { delayMs: 100, jitterMs: 25, loss: 0.08, lossTypes: ['ps', 'st'], seed: 5 }; // 200 ms RTT
const A = new NetClient({ url, name: 'A', lvl: 10, WS: WebSocket, store: mkStore(), link: LINK }), B = new NetClient({ url, name: 'B', lvl: 10, WS: WebSocket, store: mkStore(), link: LINK });
A.connect(); B.connect(); await until(() => A.state === 'online' && B.state === 'online'); A.createParty(); await until(() => A.party?.code); B.joinParty(A.party.code); await until(() => B.party?.members.length === 2);
A.setDungeon('annex'); A.start(); B.setReady(true); await sleep(1500); if (!A.inst) { B.setReady(true); await sleep(1500); A.start(); }
ok(await until(() => A.inst && B.inst, 12000), 'both clients in the dungeon over a 200 ms RTT link'); await until(() => A.rtt > 0 && B.rtt > 0, 5000);
ok(A.rtt >= 190 && A.rtt < 400, 'measured RTT is ~200 ms (' + A.rtt + ' ms)');
// 1) input -> local position: zero network wait, measured per input
const ic = A.inst; const lat = []; const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; let dir = DIRS[0], firstMoved = false, walked = 0;
for (const d of DIRS) { const x0 = ic.px, y0 = ic.py; for (let i = 0; i < 30; i++) { const px = ic.px, py = ic.py, a = performance.now(); ic.move(d[0], d[1], .05); lat.push(performance.now() - a); if (i === 0 && Math.hypot(ic.px - px, ic.py - py) > 1e-3) firstMoved = true; await sleep(50); } walked = Math.hypot(ic.px - x0, ic.py - y0); if (walked > 3) { dir = d; break; } } // (a seed may start facing a wall: try the next direction)
const xs = ic.px - 0, ys = ic.py - 0;
const worst = Math.max(...lat), avg = lat.reduce((s, v) => s + v, 0) / lat.length;
ok(firstMoved && walked > 3, 'inputs moved the player in the same call, and 30 steps walked ' + walked.toFixed(1) + ' tiles'); ok(worst < 5, 'input -> position applied synchronously: worst ' + worst.toFixed(2) + ' ms, avg ' + avg.toFixed(3) + ' ms (limit 200 ms at 200 ms RTT)');
// 2) teammates see it after the link delay (display only)
const seenAfter = []; { await sleep(400); for (let i = 0; i < 15; i++) ic.move(-dir[0], -dir[1], .05); const target = { x: ic.px, y: ic.py }; const t = performance.now();
  ok(await until(() => { ic.report(); const p = B.inst.players.sample(performance.now()).find(q => q.id === A.id); return p && Math.hypot(p.x - target.x, p.y - target.y) < .6; }, 6000), 'B eventually sees A at the new position'); seenAfter.push(performance.now() - t); }
ok(seenAfter[0] > 90 && seenAfter[0] < 1500, "teammate view arrives after the link delay (" + Math.round(seenAfter[0]) + " ms) while A's own view was instant");
// 3) the server can be unreachable and local input still never waits
{ A.ws.close(); const x0 = ic.px, y0 = ic.py; let worst2 = 0; const back = [-dir[0], -dir[1]]; for (let i = 0; i < 40; i++) { const a = performance.now(); ic.move(back[0], back[1], .05); worst2 = Math.max(worst2, performance.now() - a); await sleep(25); }
  ok(worst2 < 5 && Math.hypot(ic.px - x0, ic.py - y0) > 1, 'with the connection dropped, local movement continues unaffected (worst ' + worst2.toFixed(2) + ' ms)'); }
// 4) bandwidth is tiny
ok(A.inst.stats.stateSent < 400 && hub.stats.snaps < 400, 'server load stays light: ' + hub.stats.snaps + ' state relays, A sent ' + A.inst.stats.stateSent + ' state msgs'); 
B.close(); await hub.close(); done();
