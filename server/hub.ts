// Warranty Void multiplayer hub (phase 1): guests, parties, town presence shards, authoritative instances, chat, pings, rate limits.
// Transport: plain WebSocket (ws), JSON messages. Single process, in-memory state (see docs/MULTIPLAYER.md).
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
// Protocol v2: client-authoritative gameplay. The hub runs NO per-tick combat sim; it relays low-rate display state and arbitrates pivotal events (see docs/MULTIPLAYER.md).
import { dungeonOf } from '../src/content/dungeons';
import { PROTO, STATE_HZ, SHARED_FLAGS, MAX_MOVE_SPEED, MOVE_BUDGET, partyHpMul, partyDmgMul, TOWN_HZ, MAX_PARTY, TOWN_SHARD_CAP, cleanName, cleanChat, cleanLook, clamp, r2, Look, PartyState } from '../src/net/shared';
import { DUNGEONS } from '../src/content/dungeons';
import { COMBAT } from '../src/config';

export interface HubOpts { /** allowed browser Origins (exact match, or '*.example.com'); empty/undefined = allow all (dev). Requests with no Origin header (bots/CLI) are allowed only when `allowNoOrigin` */ /** optional extra HTTP route handler (e.g. story proxy); return true when handled */ extra?: (req: any, res: any) => boolean; origins?: string[]; allowNoOrigin?: boolean; /** max concurrent instance rooms / parties (server refuses new ones when full) */ maxRooms?: number; maxParties?: number; port?: number; dev?: boolean; dmgMul?: number; host?: string; maxConns?: number; log?: boolean }
class Bucket { tokens: number; last = Date.now(); constructor(public rate: number, public burst: number) { this.tokens = burst; } take() { const n = Date.now(); this.tokens = Math.min(this.burst, this.tokens + (n - this.last) / 1000 * this.rate); this.last = n; if (this.tokens < 1) return false; this.tokens--; return true; } }
interface Guest { id: string; token: string; name: string; lvl: number; look?: Look; build?: any; ws: WebSocket | null; party: Party | null; shard: Shard | null; pos: { x: number; y: number; face: number; moving: boolean; t: number; town: string }; ready: boolean; b: { all: Bucket; input: Bucket; chat: Bucket; ping: Bucket; pos: Bucket }; viol: number }
interface Party { code: string; leader: string; members: Guest[]; dungeon: string | null; room: Room | null; ready: Set<string> }
interface RPlayer { id: string; name: string; lvl: number; look?: Look; x: number; y: number; f: number; hp: number; mh: number; dn: boolean; mv: boolean; at: boolean; dirty: boolean; t: number; budget: number; viol: number; dmgB: Bucket; killB: Bucket; reviveAt: number; freeUntil: number; kills: number; dmgTotal: number }
interface Room { id: string; party: Party; dungeon: string; seed: number; hpMul: number; dmgMul: number; w: number; h: number; spawn: { x: number; y: number }; cps: { x: number; y: number }[]; homes: { x: number; y: number }[]; players: Map<string, RPlayer>; killed: Set<number>; flags: Record<string, any>; bossDead: boolean; completed: boolean; allDownT: number; tick: number; stats: { stateRejected: number; kills: number; killsRejected: number; dmgClipped: number; revives: number; revivesRejected: number; flagsRejected: number } }
interface Shard { id: string; town: string; members: Set<Guest> }
const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function startHub(o: HubOpts = {}) {
  const guests = new Map<string, Guest>(); const parties = new Map<string, Party>(); const shards = new Map<string, Shard>(); const rooms = new Map<string, Room>();
  const stats = { badOrigin: 0, roomCapHits: 0, conns: 0, msgs: 0, rateLimited: 0, rejected: 0, snaps: 0, versionRefused: 0, kicked: 0 };
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
  const mkBuckets = () => ({ all: new Bucket(120, 160), input: new Bucket(14, 24), kill: new Bucket(8, 30), chat: new Bucket(1.5, 4), ping: new Bucket(1, 3), pos: new Bucket(14, 20) });

  // ---------- parties
  const partyState = (p: Party): PartyState => ({ t: 'party', code: p.code, dungeon: p.dungeon, inInstance: !!p.room, members: p.members.map(m => ({ id: m.id, name: m.name, ready: p.ready.has(m.id) || m.id === p.leader, leader: m.id === p.leader, lvl: m.lvl, look: m.look })) });
  const bcastParty = (p: Party) => { const s = partyState(p); for (const m of p.members) send(m, s); };
  const partyOf = (g: Guest) => g.party;
  function newCode() { for (;;) { let c = ''; const b = randomBytes(5); for (let i = 0; i < 5; i++) c += CODE_ALPHA[b[i] % CODE_ALPHA.length]; if (!parties.has(c)) return c; } }
  function leaveParty(g: Guest, why = 'left') {
    const p = g.party; if (!p) return; g.party = null; p.members = p.members.filter(m => m !== g); p.ready.delete(g.id);
    if (p.room) { p.room.players.delete(g.id); send(g, { t: 'instance_end', reason: why }); if (!p.room.players.size) { rooms.delete(p.room.id); p.room = null; } }
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
  const rosterOf = (r: Room) => [...r.players.values()].map(x => ({ id: x.id, name: x.name, lvl: x.lvl, look: x.look }));
  const startMsg = (r: Room, id: string, resume = false) => ({ t: 'instance_start', proto: PROTO, dungeon: r.dungeon, seed: r.seed, you: id, hpMul: r.hpMul, dmgMul: r.dmgMul, stateHz: STATE_HZ, players: [...r.players.keys()], roster: rosterOf(r), nSpawns: r.homes.length, flags: r.flags, killed: [...r.killed], resume });
  const toRoom = (r: Room, m: any, except?: string) => { const s = JSON.stringify(m); for (const x of r.party.members) if (x.id !== except && r.players.has(x.id) && x.ws && x.ws.readyState === WebSocket.OPEN) x.ws.send(s); };
  function startInstance(p: Party, dungeon: string) {
    const seed = (Math.random() * 1e9) | 0; const lv = dungeonOf(dungeon).build(seed); // layout is only used for bounds + enemy home points (claim sanity); no enemies are simulated here
    const players = new Map<string, RPlayer>(); for (const m of p.members) players.set(m.id, mkRP(m, lv.spawn));
    const room: Room = { id: 'r-' + p.code + '-' + seed, party: p, dungeon, seed, hpMul: partyHpMul(p.members.length), dmgMul: (o.dmgMul ?? 1) * partyDmgMul(p.members.length), w: lv.w, h: lv.h, spawn: { x: lv.spawn.x, y: lv.spawn.y }, cps: [lv.spawn, ...((lv as any).checkpoints || [])].map((c: any) => ({ x: c.x, y: c.y })), homes: lv.spawns.map((q: any) => ({ x: q.x + .5, y: q.y + .5 })), players, killed: new Set(), flags: {}, bossDead: false, completed: false, allDownT: 0, tick: 0,
      stats: { stateRejected: 0, kills: 0, killsRejected: 0, dmgClipped: 0, revives: 0, revivesRejected: 0, flagsRejected: 0 } };
    p.room = room; rooms.set(room.id, room);
    for (const m of p.members) { leaveShard(m); send(m, startMsg(room, m.id)); }
    bcastParty(p); log('instance', dungeon, p.code, p.members.length);
  }
  const mkRP = (m: Guest, sp: { x: number; y: number }): RPlayer => ({ id: m.id, name: m.name, lvl: m.lvl, look: m.look, x: sp.x, y: sp.y, f: 0, hp: 100, mh: 100, dn: false, mv: false, at: false, dirty: true, t: Date.now(), budget: MOVE_BUDGET, viol: 0, dmgB: new Bucket(400 + 60 * m.lvl, 1200 + 180 * m.lvl), killB: new Bucket(8, 30), reviveAt: 0, freeUntil: 0, kills: 0, dmgTotal: 0 });
  function endInstance(p: Party, reason: string) { const r = p.room; if (!r) return; for (const m of p.members) if (r.players.has(m.id)) send(m, { t: 'instance_end', reason }); rooms.delete(r.id); p.room = null; p.ready.clear(); bcastParty(p); }

  // ---------- instance event handlers (client-authoritative gameplay; the hub only sanity-checks and relays)
  const kickCheater = (r: Room, g: Guest, why: string) => { stats.kicked++; r.players.delete(g.id); send(g, { t: 'instance_end', reason: why }); toRoom(r, { t: 'sys', msg: g.name + ' was removed from the dungeon (' + why + ').' }); if (!r.players.size) endInstance(r.party, 'empty'); };
  const num = (v: any, lo: number, hi: number, d = 0) => { v = +v; return Number.isFinite(v) ? clamp(v, lo, hi) : d; };
  /** 8 Hz display state: position/facing/hp/anim. Speed-gated with a distance budget so teleports are rejected; never blocks the sender. */
  function onState(r: Room, g: Guest, m: any) {
    const q = r.players.get(g.id); if (!q) return; const x = +m.x, y = +m.y; if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > r.w || y > r.h) { r.stats.stateRejected++; return; }
    const now = Date.now(); const dt = Math.min(5, Math.max(0, (now - q.t) / 1000)); q.t = now; q.budget = Math.min(MOVE_BUDGET, q.budget + MAX_MOVE_SPEED * dt);
    const d = Math.hypot(x - q.x, y - q.y);
    const warp = d > q.budget && (r.cps.some(c => Math.hypot(x - c.x, y - c.y) < 3) /* checkpoint / entrance respawns */ || (o.dev && m.tp === 1) /* test-only teleport */); if (warp) q.budget = MOVE_BUDGET + d;
    if (d > q.budget && now > q.freeUntil) { r.stats.stateRejected++; stats.rejected++; if (++q.viol > 25) kickCheater(r, g, 'impossible movement'); return; } // keep the last good position; the sender's own game is unaffected
    q.budget -= d; q.x = x; q.y = y; q.f = num(m.f, -7, 7); q.mh = num(m.mh, 1, 20000, 100); q.hp = num(m.hp, 0, q.mh, q.mh); q.dn = !!m.dn; q.mv = !!m.mv; q.at = !!m.at; q.dirty = true; if (q.viol > 0 && d < 1) q.viol = Math.max(0, q.viol - .1);
  }
  /** batched damage a client dealt to enemies, relayed so teammates' copies of the same enemy lose the same HP. Clipped by a per-player damage-rate budget. */
  function onDmg(r: Room, g: Guest, m: any) {
    const q = r.players.get(g.id); if (!q || !Array.isArray(m.d)) return; const out: [number, number][] = [];
    for (const e of m.d.slice(0, 24)) { if (!Array.isArray(e)) continue; const id = e[0] | 0, a = +e[1]; if (!Number.isFinite(a) || a <= 0 || id < 0 || id > r.homes.length || r.killed.has(id) || (id === 0 && (!r.flags.bossSpawned || r.bossDead))) continue;
      const ok = q.dmgB.tokens >= a ? a : Math.max(0, q.dmgB.tokens); if (ok < a) r.stats.dmgClipped++; if (ok <= 0) continue; q.dmgB.tokens -= ok; q.dmgTotal += ok; out.push([id, Math.round(ok * 10) / 10]); }
    if (out.length) toRoom(r, { t: 'edmg', from: g.id, d: out }, g.id);
  }
  /** kill claim: first valid claim per enemy wins; everyone (claimant included) then gets `ekill` and rolls their OWN rewards. id 0 = the boss. */
  function onKill(r: Room, g: Guest, m: any) {
    const q = r.players.get(g.id); if (!q) return; const id = m.id | 0; if (!g.b.kill.take()) { r.stats.killsRejected++; return; }
    const bad = () => { r.stats.killsRejected++; stats.rejected++; };
    if (id === 0) { if (r.bossDead || !r.flags.bossSpawned) return bad(); }
    else { if (id < 1 || id > r.homes.length) return bad(); if (r.killed.has(id)) return; /* duplicate: someone else already won the claim */ const h = r.homes[id - 1]; if (Math.hypot(q.x - h.x, q.y - h.y) > 70) return bad(); }
    if (id === 0) { r.bossDead = true; r.completed = true; r.flags.bossDead = true; r.flags.completed = true; } else r.killed.add(id);
    r.stats.kills++; q.kills++; toRoom(r, { t: 'ekill', id, by: g.id, k: r.killed.size });
  }
  /** shared objective flags (doors/locks/condition/boss spawned): whitelist, monotonic (set once), relayed to the others */
  function onFlag(r: Room, g: Guest, m: any) {
    const k = String(m.k || ''); if (!(SHARED_FLAGS as readonly string[]).includes(k) || !r.players.has(g.id)) { r.stats.flagsRejected++; return; }
    const v = (k === 'cond' || k === 'bossKey') ? (typeof m.v === 'string' && /^[A-Za-z0-9_]{1,24}$/.test(m.v) ? m.v : null) : (m.v === true ? true : null); if (v === null) { r.stats.flagsRejected++; return; }
    if (r.flags[k] !== undefined && r.flags[k] !== false && r.flags[k] !== null) return; r.flags[k] = v; toRoom(r, { t: 'flag', k, v, by: g.id }, g.id);
  }
  /** revive: reviver alive and near a downed teammate (positions are the relayed ones, with latency slack) */
  function onRevive(r: Room, g: Guest, m: any) {
    const a = r.players.get(g.id), b = r.players.get(String(m.id)); const now = Date.now(); if (!a || !b || a === b || a.dn || !b.dn || now - a.reviveAt < 1000 || Math.hypot(a.x - b.x, a.y - b.y) > 6) { r.stats.revivesRejected++; return; }
    a.reviveAt = now; b.dn = false; b.dirty = true; r.stats.revives++; toRoom(r, { t: 'revived', id: b.id, by: a.id });
  }
  function roomTick(r: Room, dt: number) {
    r.tick++; const list: any[] = []; for (const q of r.players.values()) { if (!q.dirty) continue; q.dirty = false; list.push({ id: q.id, x: r2(q.x), y: r2(q.y), f: r2(q.f), hp: Math.round(q.hp), mh: Math.round(q.mh), dn: q.dn ? 1 : 0, mv: q.mv ? 1 : 0, at: q.at ? 1 : 0 }); }
    if (list.length) { toRoom(r, { t: 'ps', n: r.tick, p: list }); stats.snaps++; }
    // party wipe: everyone down for 3 s -> everyone back at the entrance (clients reset their own boss/enemy aggro)
    if (r.players.size && [...r.players.values()].every(q => q.dn)) { r.allDownT += dt; if (r.allDownT >= 3) { r.allDownT = 0; for (const q of r.players.values()) { q.dn = false; q.x = r.spawn.x; q.y = r.spawn.y; q.dirty = true; q.budget = MOVE_BUDGET; q.freeUntil = Date.now() + 3000; } toRoom(r, { t: 'wipe' }); } } else r.allDownT = 0;
  }

  function onMsg(g: Guest, m: any) {
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    if (m.t === 'st') { if (!g.b.input.take()) { stats.rateLimited++; return; } const r = g.party?.room; if (r) onState(r, g, m); return; }
    if (!g.b.all.take()) { stats.rateLimited++; if (++g.viol > 400) g.ws?.close(1008, 'rate limit'); return; }
    switch (m.t) {
      case 'ping': send(g, { t: 'pong', c: m.c, s: Date.now() }); break;
      case 'build': break; // protocol v1 leftover: gameplay is client-side now, the server keeps no build
      case 'profile': g.name = cleanName(m.name, g.name); g.lvl = clamp(Math.floor(+m.lvl) || 1, 1, 50); g.look = cleanLook(m.look) ?? g.look; if (g.party) bcastParty(g.party); break;
      case 'party_create': { if (parties.size >= (o.maxParties ?? 500) && !g.party) { stats.roomCapHits++; return err(g, 'busy', 'Server is full, try again later.'); } if (g.party) leaveParty(g); const p: Party = { code: newCode(), leader: g.id, members: [g], dungeon: null, room: null, ready: new Set() }; parties.set(p.code, p); g.party = p; bcastParty(p); break; }
      case 'party_join': { const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); const p = parties.get(code); if (!p) return err(g, 'nocode', 'No party with that code.'); if (g.party === p) return; if (p.members.length >= MAX_PARTY) return err(g, 'full', 'Party is full (4 max).'); if (p.room) return err(g, 'started', 'That party is already in a dungeon.'); if (g.party) leaveParty(g); p.members.push(g); g.party = p; bcastParty(p); for (const x of p.members) if (x !== g) send(x, { t: 'sys', msg: g.name + ' joined the party.' }); break; }
      case 'party_leave': leaveParty(g); break;
      case 'party_kick': { const p = g.party; if (!p || p.leader !== g.id || p.room) return; const v = p.members.find(x => x.id === m.id); if (v && v !== g) { send(v, { t: 'sys', msg: 'You were removed from the party.' }); leaveParty(v, 'kicked'); } break; }
      case 'party_ready': { const p = g.party; if (!p) return; if (m.ready) p.ready.add(g.id); else p.ready.delete(g.id); bcastParty(p); break; }
      case 'party_dungeon': { const p = g.party; if (!p || p.leader !== g.id || p.room) return; const d = String(m.dungeon || ''); if (!DUNGEONS[d]) return err(g, 'baddungeon', 'Unknown dungeon.'); p.dungeon = d; p.ready.clear(); bcastParty(p); break; }
      case 'party_start': { const p = g.party; if (!p || p.leader !== g.id || p.room) return; if (!p.dungeon) return err(g, 'nodungeon', 'Pick a dungeon first.'); const wait = p.members.filter(x => x.id !== p.leader && !p.ready.has(x.id)); if (wait.length) return err(g, 'notready', 'Waiting for: ' + wait.map(x => x.name).join(', ')); if (rooms.size >= (o.maxRooms ?? 100)) { stats.roomCapHits++; return err(g, 'busy', 'All dungeon rooms are busy, try again in a minute.'); } startInstance(p, p.dungeon); break; }
      case 'leave_instance': { const p = g.party; if (!p?.room) return; p.room.players.delete(g.id); send(g, { t: 'instance_end', reason: 'left' }); if (!p.room.players.size) endInstance(p, 'empty'); break; }
      case 'dmg': { const r = g.party?.room; if (r) onDmg(r, g, m); break; }
      case 'kill': { const r = g.party?.room; if (r) onKill(r, g, m); break; }
      case 'flag': { const r = g.party?.room; if (r) onFlag(r, g, m); break; }
      case 'revive': { const r = g.party?.room; if (r) onRevive(r, g, m); break; }
      case 'chat': { if (!g.b.chat.take()) { stats.rateLimited++; return err(g, 'slow', 'Slow down.'); } const text = cleanChat(m.text); if (!text) return; const scope = m.scope === 'town' ? 'town' : 'party'; const msg = { t: 'chat', scope, from: g.id, name: g.name, text, at: Date.now() };
        if (scope === 'party' && g.party) for (const x of g.party.members) send(x, msg); else if (scope === 'town' && g.shard) for (const x of g.shard.members) send(x, msg); break; }
      case 'mark': { if (!g.b.ping.take()) return; const r = g.party?.room; if (!r) return; const x = +m.x, y = +m.y; if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > r.w || y > r.h) return; for (const q of g.party!.members) send(q, { t: 'mark', from: g.id, name: g.name, x: r2(x), y: r2(y) }); break; }
      case 'town_join': joinShard(g, ['rustline', 'harrow'].includes(m.town) ? m.town : 'rustline'); break;
      case 'town_leave': leaveShard(g); break;
      case 'town_pos': { if (!g.shard || !g.b.pos.take()) return; const x = +m.x, y = +m.y; if (!Number.isFinite(x) || !Number.isFinite(y)) return; const now = Date.now(), dt = Math.min(1, (now - g.pos.t) / 1000); const max = COMBAT.playerSpeed * 1.6 * Math.max(dt, .05) + 1.2; // speed gate: no teleporting
        if (g.pos.t && Math.hypot(x - g.pos.x, y - g.pos.y) > max) { stats.rejected++; send(g, { t: 'town_correct', x: g.pos.x, y: g.pos.y }); return; } if (x < 0 || y < 0 || x > 200 || y > 200) return; g.pos = { x, y, face: clamp(+m.face || 0, -7, 7), moving: !!m.moving, t: now, town: g.pos.town }; break; }
    }
  }

  wss.on('connection', ws => {
    if (wss.clients.size > (o.maxConns ?? 500)) { ws.close(1013, 'full'); return; } stats.conns++; let g: Guest | null = null; const tmp = { all: new Bucket(20, 30) };
    ws.on('message', raw => {
      stats.msgs++; let m: any; try { m = JSON.parse(String(raw)); } catch { return; }
      if (!g) { // handshake: anonymous guest id + secret token (server issues both on first contact)
        if (!tmp.all.take() || m?.t !== 'hello') return;
        if (m.proto !== PROTO) { stats.versionRefused++; try { ws.send(JSON.stringify({ t: 'err', code: 'version', server: PROTO, client: m.proto ?? 0, msg: 'Your game version is out of date for this server (protocol ' + (m.proto ?? 1) + ', server ' + PROTO + '). Refresh the page (Ctrl+F5) to update, then reconnect.' })); } catch {} setTimeout(() => { try { ws.close(4001, 'version mismatch'); } catch {} }, 50); return; } let gg = typeof m.guest === 'string' ? guests.get(m.guest) : undefined; if (gg && gg.token !== m.token) gg = undefined;
        if (!gg) { gg = { id: 'g' + randomBytes(5).toString('hex'), token: randomBytes(12).toString('hex'), name: 'Guest', lvl: 1, ws: null, party: null, shard: null, pos: { x: 0, y: 0, face: 0, moving: false, t: 0, town: 'rustline' }, ready: false, b: mkBuckets(), viol: 0 }; guests.set(gg.id, gg); }
        if (gg.ws && gg.ws !== ws) { try { gg.ws.close(4000, 'replaced'); } catch {} } gg.ws = ws; g = gg; g.name = cleanName(m.name, g.name); g.lvl = clamp(Math.floor(+m.lvl) || 1, 1, 50); g.look = cleanLook(m.look) ?? g.look;
        send(g, { t: 'welcome', proto: PROTO, id: g.id, token: g.token, stateHz: STATE_HZ, name: g.name, dev: !!o.dev });
        if (g.party) { bcastParty(g.party); const r = g.party.room; if (r && r.players.has(g.id)) send(g, startMsg(r, g.id, true)); } return; }
      onMsg(g, m);
    });
    ws.on('close', () => { if (!g || g.ws !== ws) return; g.ws = null; leaveShard(g); const gg = g; // grace period: keep party seat 60 s for reconnects
      setTimeout(() => { if (!gg.ws) { leaveParty(gg, 'disconnected'); guests.delete(gg.id); } }, 60000).unref?.(); });
    ws.on('error', () => {});
  });

  // ---------- main loops
  // one light 8 Hz loop for all rooms: relay changed player state + wipe check. No combat simulation runs here.
  let lastRoomT = Date.now();
  const simTimer = setInterval(() => { const now = Date.now(), dt = (now - lastRoomT) / 1000; lastRoomT = now; for (const r of rooms.values()) { roomTick(r, dt); if (r.players.size === 0) endInstance(r.party, 'empty'); } }, 1000 / STATE_HZ);
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
