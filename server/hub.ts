// Warranty Void multiplayer hub (phase 1): guests, parties, town presence shards, authoritative instances, chat, pings, rate limits.
// Transport: plain WebSocket (ws), JSON messages. Single process, in-memory state (see docs/MULTIPLAYER.md).
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { InstanceSim } from '../src/net/netsim';
import { PROTO, TICK_HZ, TICK_DT, TOWN_HZ, MAX_PARTY, TOWN_SHARD_CAP, cleanName, cleanChat, cleanLook, clamp, r2, Look, PartyState } from '../src/net/shared';
import { DUNGEONS } from '../src/content/dungeons';
import { COMBAT } from '../src/config';

export interface HubOpts { /** allowed browser Origins (exact match, or '*.example.com'); empty/undefined = allow all (dev). Requests with no Origin header (bots/CLI) are allowed only when `allowNoOrigin` */ /** optional extra HTTP route handler (e.g. story proxy); return true when handled */ extra?: (req: any, res: any) => boolean; origins?: string[]; allowNoOrigin?: boolean; /** max concurrent instance rooms / parties (server refuses new ones when full) */ maxRooms?: number; maxParties?: number; port?: number; dev?: boolean; dmgMul?: number; host?: string; maxConns?: number; log?: boolean }
class Bucket { tokens: number; last = Date.now(); constructor(public rate: number, public burst: number) { this.tokens = burst; } take() { const n = Date.now(); this.tokens = Math.min(this.burst, this.tokens + (n - this.last) / 1000 * this.rate); this.last = n; if (this.tokens < 1) return false; this.tokens--; return true; } }
interface Guest { id: string; token: string; name: string; lvl: number; look?: Look; ws: WebSocket | null; party: Party | null; shard: Shard | null; pos: { x: number; y: number; face: number; moving: boolean; t: number; town: string }; ready: boolean; b: { all: Bucket; input: Bucket; chat: Bucket; ping: Bucket; pos: Bucket }; viol: number }
interface Party { code: string; leader: string; members: Guest[]; dungeon: string | null; room: Room | null; ready: Set<string> }
interface Room { id: string; party: Party; sim: InstanceSim; accTick: number; last: number; ended: boolean; emptyT: number }
interface Shard { id: string; town: string; members: Set<Guest> }
const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function startHub(o: HubOpts = {}) {
  const guests = new Map<string, Guest>(); const parties = new Map<string, Party>(); const shards = new Map<string, Shard>(); const rooms = new Map<string, Room>();
  const stats = { badOrigin: 0, roomCapHits: 0, conns: 0, msgs: 0, rateLimited: 0, rejected: 0, snaps: 0 };
  const originOk = (origin: string | undefined) => { const list = o.origins; if (!list || !list.length) return true; if (!origin) return !!o.allowNoOrigin; return list.some(p => p === origin || (p.startsWith('*.') && (() => { try { return new URL(origin).hostname.endsWith(p.slice(1)); } catch { return false; } })())); };
  let draining = false;
  const http = createServer((req, res) => { if (o.extra?.(req, res)) return; // health + metrics on the same port as the ALB target (no auth, no secrets)
    if (req.url === '/healthz') { res.writeHead(draining ? 503 : 200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: !draining, conns: wss.clients.size, rooms: rooms.size, parties: parties.size })); return; }
    if (req.url === '/metrics') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ conns: wss.clients.size, rooms: rooms.size, parties: parties.size, shards: shards.size, ...stats })); return; }
    res.writeHead(404); res.end();
  });
  const wss = new WebSocketServer({ server: http, maxPayload: 8192, verifyClient: (i: any, cb: any) => { if (draining) return cb(false, 503, 'draining'); if (!originOk(i.origin || i.req.headers.origin)) { stats.badOrigin++; return cb(false, 403, 'origin not allowed'); } cb(true); } });
  http.listen(o.port ?? 8787, o.host);
  const log = (...a: any[]) => { if (o.log) console.log('[wv-hub]', ...a); };
  const send = (g: Guest, m: any) => { if (g.ws && g.ws.readyState === WebSocket.OPEN) g.ws.send(JSON.stringify(m)); };
  const err = (g: Guest, code: string, msg: string) => send(g, { t: 'err', code, msg });
  const mkBuckets = () => ({ all: new Bucket(120, 160), input: new Bucket(30, 40), chat: new Bucket(1.5, 4), ping: new Bucket(1, 3), pos: new Bucket(14, 20) });

  // ---------- parties
  const partyState = (p: Party): PartyState => ({ t: 'party', code: p.code, dungeon: p.dungeon, inInstance: !!p.room, members: p.members.map(m => ({ id: m.id, name: m.name, ready: p.ready.has(m.id) || m.id === p.leader, leader: m.id === p.leader, lvl: m.lvl, look: m.look })) });
  const bcastParty = (p: Party) => { const s = partyState(p); for (const m of p.members) send(m, s); };
  const partyOf = (g: Guest) => g.party;
  function newCode() { for (;;) { let c = ''; const b = randomBytes(5); for (let i = 0; i < 5; i++) c += CODE_ALPHA[b[i] % CODE_ALPHA.length]; if (!parties.has(c)) return c; } }
  function leaveParty(g: Guest, why = 'left') {
    const p = g.party; if (!p) return; g.party = null; p.members = p.members.filter(m => m !== g); p.ready.delete(g.id);
    if (p.room) { p.room.sim.removePlayer(g.id); send(g, { t: 'instance_end', reason: why }); }
    if (!p.members.length) { if (p.room) rooms.delete(p.room.id); parties.delete(p.code); } else { if (p.leader === g.id) p.leader = p.members[0].id; bcastParty(p); }
    send(g, { t: 'party', code: '', members: [], dungeon: null, inInstance: false });
  }
  // ---------- town shards (shared presence)
  function joinShard(g: Guest, town: string) {
    if (g.shard && g.shard.town === town) return; leaveShard(g); let sh = [...shards.values()].find(s => s.town === town && s.members.size < TOWN_SHARD_CAP);
    if (!sh) { sh = { id: town + '-' + (1 + [...shards.values()].filter(s => s.town === town).length), town, members: new Set() }; shards.set(sh.id, sh); }
    sh.members.add(g); g.shard = sh; g.pos.town = town; send(g, { t: 'town', shard: sh.id, town, pop: sh.members.size });
  }
  function leaveShard(g: Guest) { const sh = g.shard; if (!sh) return; sh.members.delete(g); g.shard = null; for (const m of sh.members) send(m, { t: 'town_leave', id: g.id }); if (!sh.members.size) shards.delete(sh.id); }

  // ---------- instances
  function startInstance(p: Party, dungeon: string) {
    const seed = (Math.random() * 1e9) | 0; const sim = new InstanceSim(dungeon, seed, p.members.map(m => ({ id: m.id, name: m.name, lvl: m.lvl, look: m.look })), { dmgMul: o.dmgMul });
    const room: Room = { id: 'r-' + p.code + '-' + seed, party: p, sim, accTick: 0, last: Date.now(), ended: false, emptyT: 0 }; p.room = room; rooms.set(room.id, room);
    for (const m of p.members) { leaveShard(m); send(m, { t: 'instance_start', dungeon, seed, you: m.id, hpMul: sim.hpMul, dmgMul: sim.dmgMul, tickHz: TICK_HZ, players: p.members.map(x => x.id) }); }
    bcastParty(p); log('instance', dungeon, p.code, p.members.length);
  }
  function endInstance(p: Party, reason: string) { const r = p.room; if (!r) return; for (const m of p.members) send(m, { t: 'instance_end', reason }); rooms.delete(r.id); p.room = null; p.ready.clear(); bcastParty(p); }

  function onMsg(g: Guest, m: any) {
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    if (m.t === 'input') { if (!g.b.input.take()) { stats.rateLimited++; return; } const r = g.party?.room; if (r) r.sim.input(g.id, m); return; }
    if (!g.b.all.take()) { stats.rateLimited++; if (++g.viol > 400) g.ws?.close(1008, 'rate limit'); return; }
    switch (m.t) {
      case 'ping': send(g, { t: 'pong', c: m.c, s: Date.now() }); break;
      case 'profile': g.name = cleanName(m.name, g.name); g.lvl = clamp(Math.floor(+m.lvl) || 1, 1, 50); g.look = cleanLook(m.look) ?? g.look; if (g.party) bcastParty(g.party); break;
      case 'party_create': { if (parties.size >= (o.maxParties ?? 500) && !g.party) { stats.roomCapHits++; return err(g, 'busy', 'Server is full, try again later.'); } if (g.party) leaveParty(g); const p: Party = { code: newCode(), leader: g.id, members: [g], dungeon: null, room: null, ready: new Set() }; parties.set(p.code, p); g.party = p; bcastParty(p); break; }
      case 'party_join': { const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); const p = parties.get(code); if (!p) return err(g, 'nocode', 'No party with that code.'); if (g.party === p) return; if (p.members.length >= MAX_PARTY) return err(g, 'full', 'Party is full (4 max).'); if (p.room) return err(g, 'started', 'That party is already in a dungeon.'); if (g.party) leaveParty(g); p.members.push(g); g.party = p; bcastParty(p); for (const x of p.members) if (x !== g) send(x, { t: 'sys', msg: g.name + ' joined the party.' }); break; }
      case 'party_leave': leaveParty(g); break;
      case 'party_kick': { const p = g.party; if (!p || p.leader !== g.id || p.room) return; const v = p.members.find(x => x.id === m.id); if (v && v !== g) { send(v, { t: 'sys', msg: 'You were removed from the party.' }); leaveParty(v, 'kicked'); } break; }
      case 'party_ready': { const p = g.party; if (!p) return; if (m.ready) p.ready.add(g.id); else p.ready.delete(g.id); bcastParty(p); break; }
      case 'party_dungeon': { const p = g.party; if (!p || p.leader !== g.id || p.room) return; const d = String(m.dungeon || ''); if (!DUNGEONS[d]) return err(g, 'baddungeon', 'Unknown dungeon.'); p.dungeon = d; p.ready.clear(); bcastParty(p); break; }
      case 'party_start': { const p = g.party; if (!p || p.leader !== g.id || p.room) return; if (!p.dungeon) return err(g, 'nodungeon', 'Pick a dungeon first.'); const wait = p.members.filter(x => x.id !== p.leader && !p.ready.has(x.id)); if (wait.length) return err(g, 'notready', 'Waiting for: ' + wait.map(x => x.name).join(', ')); if (rooms.size >= (o.maxRooms ?? 100)) { stats.roomCapHits++; return err(g, 'busy', 'All dungeon rooms are busy, try again in a minute.'); } startInstance(p, p.dungeon); break; }
      case 'leave_instance': { const p = g.party; if (!p?.room) return; p.room.sim.removePlayer(g.id); send(g, { t: 'instance_end', reason: 'left' }); if (!p.room.sim.players.size) endInstance(p, 'empty'); break; }
      case 'chat': { if (!g.b.chat.take()) { stats.rateLimited++; return err(g, 'slow', 'Slow down.'); } const text = cleanChat(m.text); if (!text) return; const scope = m.scope === 'town' ? 'town' : 'party'; const msg = { t: 'chat', scope, from: g.id, name: g.name, text, at: Date.now() };
        if (scope === 'party' && g.party) for (const x of g.party.members) send(x, msg); else if (scope === 'town' && g.shard) for (const x of g.shard.members) send(x, msg); break; }
      case 'mark': { if (!g.b.ping.take()) return; const r = g.party?.room; if (!r) return; const x = +m.x, y = +m.y; if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > r.sim.level.w || y > r.sim.level.h) return; for (const q of g.party!.members) send(q, { t: 'mark', from: g.id, name: g.name, x: r2(x), y: r2(y) }); break; }
      case 'town_join': joinShard(g, ['rustline', 'harrow'].includes(m.town) ? m.town : 'rustline'); break;
      case 'town_leave': leaveShard(g); break;
      case 'town_pos': { if (!g.shard || !g.b.pos.take()) return; const x = +m.x, y = +m.y; if (!Number.isFinite(x) || !Number.isFinite(y)) return; const now = Date.now(), dt = Math.min(1, (now - g.pos.t) / 1000); const max = COMBAT.playerSpeed * 1.6 * Math.max(dt, .05) + 1.2; // speed gate: no teleporting
        if (g.pos.t && Math.hypot(x - g.pos.x, y - g.pos.y) > max) { stats.rejected++; send(g, { t: 'town_correct', x: g.pos.x, y: g.pos.y }); return; } if (x < 0 || y < 0 || x > 200 || y > 200) return; g.pos = { x, y, face: clamp(+m.face || 0, -7, 7), moving: !!m.moving, t: now, town: g.pos.town }; break; }
      case 'dev_tp': { if (!o.dev) return; const r = g.party?.room; if (r) r.sim.devTeleport(g.id, +m.x, +m.y); break; }
      case 'dev_boss_tp': { if (!o.dev) return; const r = g.party?.room; if (r) { const b = r.sim.level.bossSpawn; r.sim.devTeleport(g.id, b.x - 2 - Math.random(), b.y + (Math.random() - .5) * 2); } break; }
      case 'pickup': { const r = g.party?.room; if (r) { if (r.sim.tryPickup(g.id, +m.id)) flushLoot(r, g); } break; }
    }
  }
  function flushLoot(r: Room, g: Guest) { const got = r.sim.takeLoot(g.id); if (got) send(g, { t: 'loot', items: got }); }

  wss.on('connection', ws => {
    if (wss.clients.size > (o.maxConns ?? 500)) { ws.close(1013, 'full'); return; } stats.conns++; let g: Guest | null = null; const tmp = { all: new Bucket(20, 30) };
    ws.on('message', raw => {
      stats.msgs++; let m: any; try { m = JSON.parse(String(raw)); } catch { return; }
      if (!g) { // handshake: anonymous guest id + secret token (server issues both on first contact)
        if (!tmp.all.take() || m?.t !== 'hello') return; let gg = typeof m.guest === 'string' ? guests.get(m.guest) : undefined; if (gg && gg.token !== m.token) gg = undefined;
        if (!gg) { gg = { id: 'g' + randomBytes(5).toString('hex'), token: randomBytes(12).toString('hex'), name: 'Guest', lvl: 1, ws: null, party: null, shard: null, pos: { x: 0, y: 0, face: 0, moving: false, t: 0, town: 'rustline' }, ready: false, b: mkBuckets(), viol: 0 }; guests.set(gg.id, gg); }
        if (gg.ws && gg.ws !== ws) { try { gg.ws.close(4000, 'replaced'); } catch {} } gg.ws = ws; g = gg; g.name = cleanName(m.name, g.name); g.lvl = clamp(Math.floor(+m.lvl) || 1, 1, 50); g.look = cleanLook(m.look) ?? g.look;
        send(g, { t: 'welcome', proto: PROTO, id: g.id, token: g.token, tickHz: TICK_HZ, name: g.name, dev: !!o.dev });
        if (g.party) { bcastParty(g.party); const r = g.party.room; if (r && r.sim.players.has(g.id)) send(g, { t: 'instance_start', dungeon: r.sim.dungeon, seed: r.sim.seed, you: g.id, hpMul: r.sim.hpMul, dmgMul: r.sim.dmgMul, tickHz: TICK_HZ, players: [...r.sim.players.keys()], resume: true }); } return; }
      onMsg(g, m);
    });
    ws.on('close', () => { if (!g || g.ws !== ws) return; g.ws = null; leaveShard(g); const gg = g; // grace period: keep party seat 60 s for reconnects
      setTimeout(() => { if (!gg.ws) { leaveParty(gg, 'disconnected'); guests.delete(gg.id); } }, 60000).unref?.(); });
    ws.on('error', () => {});
  });

  // ---------- main loops
  const simTimer = setInterval(() => {
    const now = Date.now();
    for (const r of rooms.values()) {
      r.accTick += (now - r.last) / 1000; r.last = now; let n = 0; while (r.accTick >= TICK_DT && n++ < 4) { r.accTick -= TICK_DT; r.sim.step(); }
      if (n) { const ev = r.sim.drainEvents(); for (const m of r.party.members) { const s = r.sim.snapshot(m.id, ev.length ? ev : undefined); if (s) { send(m, s); stats.snaps++; } flushLoot(r, m); } }
      if (r.sim.players.size === 0) endInstance(r.party, 'empty');
    }
  }, 1000 / TICK_HZ / 2);
  const townTimer = setInterval(() => {
    for (const sh of shards.values()) { const list = [...sh.members].filter(m => m.pos.t).map(m => ({ id: m.id, name: m.name, x: r2(m.pos.x), y: r2(m.pos.y), face: r2(m.pos.face), moving: m.pos.moving, look: m.look, lvl: m.lvl })); for (const m of sh.members) send(m, { t: 'town_snap', players: list.filter(p => p.id !== m.id), pop: sh.members.size }); }
  }, 1000 / TOWN_HZ);
  wss.on('close', () => { clearInterval(simTimer); clearInterval(townTimer); });
  const ready = new Promise<void>(res => http.on('listening', () => res()));
  const api: any = {
    ready,    port: () => (http.address() as any).port as number, drain: () => { draining = true; }, stats, guests, parties, rooms, shards,
    /** graceful shutdown: stop accepting, tell clients, give them a moment, then close */
    shutdown: async (graceMs = 5000) => { draining = true; for (const g of guests.values()) send(g, { t: 'sys', msg: 'Server restarting, you will be returned to town.' }); for (const r of [...rooms.values()]) endInstance(r.party, 'server restart'); await new Promise(r => setTimeout(r, graceMs)); await api.close(); },
    close: () => new Promise<void>(res => { clearInterval(simTimer); clearInterval(townTimer); for (const c of wss.clients) c.terminate(); wss.close(() => http.close(() => res())); }),
  };
  return api;
}
