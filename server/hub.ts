// Warranty Void multiplayer hub (phase 1): guests, parties, town presence shards, authoritative instances, chat, pings, rate limits.
// Transport: plain WebSocket (ws), JSON messages. Single process, in-memory state (see docs/MULTIPLAYER.md).
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
// Protocol v2: client-authoritative gameplay. The hub runs NO per-tick combat sim; it relays low-rate display state and arbitrates pivotal events (see docs/MULTIPLAYER.md).
import { dungeonOf } from '../src/content/dungeons';
import { PROTO, STATE_HZ, SHARED_FLAGS, MAX_MOVE_SPEED, MOVE_BUDGET, partyHpMul, partyDmgMul, TOWN_HZ, MAX_PARTY, TOWN_SHARD_CAP, TOWN_SHARD_IDLE_MS, cleanName, cleanChat, cleanLook, clamp, r2, Look, PartyState } from '../src/net/shared';
import { DUNGEONS } from '../src/content/dungeons';
import { COMBAT } from '../src/config';
import { CityHub, CITY_SYNC_MS, CITY_SAVE_MS, CITY_NEWS_MS } from './city_srv';

export interface HubOpts { /** allowed browser Origins (exact match, or '*.example.com'); empty/undefined = allow all (dev). Requests with no Origin header (bots/CLI) are allowed only when `allowNoOrigin` */ /** optional extra HTTP route handler (e.g. story proxy); return true when handled */ extra?: (req: any, res: any) => boolean; origins?: string[]; allowNoOrigin?: boolean; /** max concurrent instance rooms / parties (server refuses new ones when full) */ maxRooms?: number; maxParties?: number; port?: number; dev?: boolean; dmgMul?: number; host?: string; maxConns?: number; log?: boolean; /** living city (docs/LIVING_CITY.md); omitted = off */ city?: CityHub | null; citySyncMs?: number; /** players per town copy (default TOWN_SHARD_CAP) */ townCap?: number; /** empty town copy lifetime (default 60 s) */ shardIdleMs?: number }
class Bucket { tokens: number; last = Date.now(); constructor(public rate: number, public burst: number) { this.tokens = burst; } take() { const n = Date.now(); this.tokens = Math.min(this.burst, this.tokens + (n - this.last) / 1000 * this.rate); this.last = n; if (this.tokens < 1) return false; this.tokens--; return true; } }
interface Guest { id: string; token: string; name: string; lvl: number; look?: Look; build?: any; ws: WebSocket | null; party: Party | null; shard: Shard | null; pos: { x: number; y: number; face: number; moving: boolean; em?: number; t: number; town: string }; ready: boolean; b: { all: Bucket; input: Bucket; chat: Bucket; ping: Bucket; pos: Bucket }; viol: number }
interface Party { code: string; leader: string; members: Guest[]; dungeon: string | null; room: Room | null; ready: Set<string>; check: { dungeon: string; until: number; yes: Set<string>; no: Set<string> } | null }
interface Invite { from: string; kind: 'invite' | 'join'; at: number }
interface RPlayer { id: string; name: string; lvl: number; look?: Look; x: number; y: number; f: number; hp: number; mh: number; dn: boolean; mv: boolean; at: boolean; em?: number; dirty: boolean; t: number; budget: number; viol: number; dmgB: Bucket; killB: Bucket; reviveAt: number; freeUntil: number; kills: number; dmgTotal: number }
interface Room { id: string; party: Party; dungeon: string; seed: number; hpMul: number; dmgMul: number; w: number; h: number; spawn: { x: number; y: number }; cps: { x: number; y: number }[]; homes: { x: number; y: number }[]; players: Map<string, RPlayer>; killed: Set<number>; flags: Record<string, any>; bossDead: boolean; completed: boolean; allDownT: number; tick: number; stats: { stateRejected: number; kills: number; killsRejected: number; dmgClipped: number; revives: number; revivesRejected: number; flagsRejected: number } }
interface Shard { id: string; town: string; n: number; members: Set<Guest>; emptyAt: number }
const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function startHub(o: HubOpts = {}) {
  const guests = new Map<string, Guest>(); const parties = new Map<string, Party>(); const shards = new Map<string, Shard>(); const rooms = new Map<string, Room>(); const invites = new Map<string, Map<string, Invite>>(); // target guest id -> pending invites/join requests by sender id
  const stats = { badOrigin: 0, roomCapHits: 0, conns: 0, msgs: 0, rateLimited: 0, rejected: 0, snaps: 0, versionRefused: 0, kicked: 0 };
  const originOk = (origin: string | undefined) => { const list = o.origins; if (!list || !list.length) return true; if (!origin) return !!o.allowNoOrigin; return list.some(p => p === origin || (p.startsWith('*.') && (() => { try { return new URL(origin).hostname.endsWith(p.slice(1)); } catch { return false; } })())); };
  let draining = false;
  const http = createServer((req, res) => { if (o.extra?.(req, res)) return; // health + metrics on the same port as the ALB target (no auth, no secrets)
    if (req.url === '/healthz') { res.writeHead(draining ? 503 : 200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: !draining, conns: wss.clients.size, rooms: rooms.size, parties: parties.size })); return; }
    const city = o.city; if (city && req.method === 'GET' && (req.url === '/city/news' || req.url === '/city/state')) { const body = req.url === '/city/news' ? (city.news || { ok: false }) : city.full(); res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=300', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(body)); return; }
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
  const partyState = (p: Party): PartyState => ({ t: 'party', code: p.code, dungeon: p.dungeon, inInstance: !!p.room, ...(p.check ? { check: { dungeon: p.check.dungeon, ms: Math.max(0, p.check.until - Date.now()), yes: [...p.check.yes], no: [...p.check.no] } } : {}), members: p.members.map(m => ({ inRun: !!p.room?.players.has(m.id), id: m.id, name: m.name, ready: p.ready.has(m.id) || m.id === p.leader, leader: m.id === p.leader, lvl: m.lvl, look: m.look })) });
  const bcastParty = (p: Party) => { const s = partyState(p); for (const m of p.members) send(m, s); gatherParty(p); };
  const partyOf = (g: Guest) => g.party;
  function newCode() { for (;;) { let c = ''; const b = randomBytes(5); for (let i = 0; i < 5; i++) c += CODE_ALPHA[b[i] % CODE_ALPHA.length]; if (!parties.has(c)) return c; } }
  function leaveParty(g: Guest, why = 'left') {
    const p = g.party; if (!p) return; g.party = null; p.members = p.members.filter(m => m !== g); p.ready.delete(g.id); if (p.check) { p.check.yes.delete(g.id); p.check.no.delete(g.id); }
    if (p.room) { p.room.players.delete(g.id); send(g, { t: 'instance_end', reason: why }); if (!p.room.players.size) { rooms.delete(p.room.id); p.room = null; } }
    if (!p.members.length) { if (p.room) rooms.delete(p.room.id); parties.delete(p.code); } else { if (p.leader === g.id) p.leader = p.members[0].id; bcastParty(p); }
    send(g, { t: 'party', code: '', members: [], dungeon: null, inInstance: false });
  }
  // ---------- town shards (shared presence)
  // numbered town copies ("Rustline 1"): fill the fullest copy below the cap, open the lowest free number when all are full.
  // Party members always go to a party mate's copy (leader first) even above the cap: reserved seats, so a party is never split.
  // Seats of party mates who are away (in a dungeon) count against the cap so they can come back. Empty copies close after shardIdleMs.
  const townCap = Math.max(1, o.townCap ?? TOWN_SHARD_CAP);
  const seats = (sh: Shard) => { const away = new Set<string>(); for (const m of sh.members) for (const q of m.party?.members || []) if (!q.shard) away.add(q.id); return sh.members.size + away.size; };
  function pickShard(g: Guest, town: string): Shard {
    const p = g.party; if (p) { const mates = [p.members.find(x => x.id === p.leader), ...p.members].filter(x => x && x !== g && x.shard?.town === town); if (mates[0]) return mates[0]!.shard!; }
    const open = [...shards.values()].filter(s => s.town === town && seats(s) < townCap).sort((a, b) => b.members.size - a.members.size || a.n - b.n); if (open[0]) return open[0];
    const used = new Set([...shards.values()].filter(s => s.town === town).map(s => s.n)); let n = 1; while (used.has(n)) n++;
    const sh: Shard = { id: town + '-' + n, town, n, members: new Set(), emptyAt: 0 }; shards.set(sh.id, sh); return sh;
  }
  function joinShard(g: Guest, town: string, force?: Shard) {
    const sh = force ?? pickShard(g, town); if (g.shard === sh) return; leaveShard(g);
    sh.members.add(g); sh.emptyAt = 0; g.shard = sh; g.pos.town = town; send(g, { t: 'town', shard: sh.id, town, n: sh.n, cap: townCap, pop: sh.members.size });
  }
  function leaveShard(g: Guest) { const sh = g.shard; if (!sh) return; sh.members.delete(g); g.shard = null; for (const m of sh.members) send(m, { t: 'town_leave', id: g.id }); if (!sh.members.size) sh.emptyAt = Date.now(); }
  /** after a party forms/changes: pull members in the same town into the leader's copy */
  function gatherParty(p: Party) { const lead = p.members.find(x => x.id === p.leader); const sh = lead?.shard; if (!sh) return; for (const m of p.members) if (m.shard && m.shard !== sh && m.shard.town === sh.town) joinShard(m, sh.town, sh); }

  // ---------- instances
  const rosterOf = (r: Room) => [...r.players.values()].map(x => ({ id: x.id, name: x.name, lvl: x.lvl, look: x.look }));
  const startMsg = (r: Room, id: string, resume = false) => ({ t: 'instance_start', proto: PROTO, dungeon: r.dungeon, seed: r.seed, you: id, hpMul: r.hpMul, dmgMul: r.dmgMul, stateHz: STATE_HZ, players: [...r.players.keys()], roster: rosterOf(r), nSpawns: r.homes.length, flags: r.flags, killed: [...r.killed], resume, graceMs: 5000 });
  const toRoom = (r: Room, m: any, except?: string) => { const s = JSON.stringify(m); for (const x of r.party.members) if (x.id !== except && r.players.has(x.id) && x.ws && x.ws.readyState === WebSocket.OPEN) x.ws.send(s); };
  function startInstance(p: Party, dungeon: string, who: Guest[] = p.members) {
    const seed = (Math.random() * 1e9) | 0; const lv = dungeonOf(dungeon).build(seed); // layout is only used for bounds + enemy home points (claim sanity); no enemies are simulated here
    const players = new Map<string, RPlayer>(); for (const m of who) players.set(m.id, mkRP(m, lv.spawn));
    const room: Room = { id: 'r-' + p.code + '-' + seed, party: p, dungeon, seed, hpMul: partyHpMul(who.length), dmgMul: (o.dmgMul ?? 1) * partyDmgMul(who.length), w: lv.w, h: lv.h, spawn: { x: lv.spawn.x, y: lv.spawn.y }, cps: [lv.spawn, ...((lv as any).checkpoints || [])].map((c: any) => ({ x: c.x, y: c.y })), homes: lv.spawns.map((q: any) => ({ x: q.x + .5, y: q.y + .5 })), players, killed: new Set(), flags: {}, bossDead: false, completed: false, allDownT: 0, tick: 0,
      stats: { stateRejected: 0, kills: 0, killsRejected: 0, dmgClipped: 0, revives: 0, revivesRejected: 0, flagsRejected: 0 } };
    p.room = room; rooms.set(room.id, room);
    for (const m of who) { leaveShard(m); send(m, startMsg(room, m.id)); }
    p.dungeon = dungeon; bcastParty(p); log('instance', dungeon, p.code, who.length);
  }
  const mkRP = (m: Guest, sp: { x: number; y: number }): RPlayer => ({ id: m.id, name: m.name, lvl: m.lvl, look: m.look, x: sp.x, y: sp.y, f: 0, hp: 100, mh: 100, dn: false, mv: false, at: false, dirty: true, t: Date.now(), budget: MOVE_BUDGET, viol: 0, dmgB: new Bucket(400 + 60 * m.lvl, 1200 + 180 * m.lvl), killB: new Bucket(8, 30), reviveAt: 0, freeUntil: 0, kills: 0, dmgTotal: 0 });
  function endInstance(p: Party, reason: string) { const r = p.room; if (!r) return; for (const m of p.members) if (r.players.has(m.id)) send(m, { t: 'instance_end', reason }); rooms.delete(r.id); p.room = null; p.ready.clear(); bcastParty(p); }

  // ---------- instance event handlers (client-authoritative gameplay; the hub only sanity-checks and relays)
  const kickCheater = (r: Room, g: Guest, why: string) => { stats.kicked++; r.players.delete(g.id); send(g, { t: 'instance_end', reason: why }); toRoom(r, { t: 'sys', msg: (g.name || 'A player') + ' was removed from the dungeon (' + why + ').' }); if (!r.players.size) endInstance(r.party, 'empty'); };
  const num = (v: any, lo: number, hi: number, d = 0) => { v = +v; return Number.isFinite(v) ? clamp(v, lo, hi) : d; };
  /** 8 Hz display state: position/facing/hp/anim. Speed-gated with a distance budget so teleports are rejected; never blocks the sender. */
  function onState(r: Room, g: Guest, m: any) {
    const q = r.players.get(g.id); if (!q) return; const x = +m.x, y = +m.y; if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > r.w || y > r.h) { r.stats.stateRejected++; return; }
    const now = Date.now(); const dt = Math.min(5, Math.max(0, (now - q.t) / 1000)); q.t = now; q.budget = Math.min(MOVE_BUDGET, q.budget + MAX_MOVE_SPEED * dt);
    const d = Math.hypot(x - q.x, y - q.y);
    const warp = d > q.budget && (r.cps.some(c => Math.hypot(x - c.x, y - c.y) < 3) /* checkpoint / entrance respawns */ || (o.dev && m.tp === 1) /* test-only teleport */); if (warp) q.budget = MOVE_BUDGET + d;
    if (d > q.budget && now > q.freeUntil) { r.stats.stateRejected++; stats.rejected++; if (++q.viol > 25) kickCheater(r, g, 'impossible movement'); return; } // keep the last good position; the sender's own game is unaffected
    q.budget -= d; q.x = x; q.y = y; q.f = num(m.f, -7, 7); q.mh = num(m.mh, 1, 20000, 100); q.hp = num(m.hp, 0, q.mh, q.mh); q.dn = !!m.dn; q.mv = !!m.mv; q.at = !!m.at; q.em = (+m.em | 0) & 255; q.dirty = true; if (q.viol > 0 && d < 1) q.viol = Math.max(0, q.viol - .1);
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
    if (id === 0) { r.bossDead = true; r.completed = true; r.flags.bossDead = true; r.flags.completed = true; try { o.city?.roomCompleted(r.dungeon, [...r.players.values()], r.killed.size); } catch {} } else r.killed.add(id);
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
    r.tick++; const list: any[] = []; for (const q of r.players.values()) { if (!q.dirty) continue; q.dirty = false; list.push({ id: q.id, x: r2(q.x), y: r2(q.y), f: r2(q.f), hp: Math.round(q.hp), mh: Math.round(q.mh), dn: q.dn ? 1 : 0, mv: q.mv ? 1 : 0, at: q.at ? 1 : 0, ...(q.em ? { em: q.em } : {}) }); }
    if (list.length) { toRoom(r, { t: 'ps', n: r.tick, p: list }); stats.snaps++; }
    // party wipe: everyone down for 3 s -> everyone back at the entrance (clients reset their own boss/enemy aggro)
    if (r.players.size && [...r.players.values()].every(q => q.dn)) { r.allDownT += dt; if (r.allDownT >= 3) { r.allDownT = 0; for (const q of r.players.values()) { q.dn = false; q.x = r.spawn.x; q.y = r.spawn.y; q.dirty = true; q.budget = MOVE_BUDGET; q.freeUntil = Date.now() + 3000; } toRoom(r, { t: 'wipe' }); } } else r.allDownT = 0;
  }

  // ---------- zero-config grouping: invite / join request from town, ready check on the world entrance, drop-in (docs/MULTIPLAYER.md section 2b)
  const INVITE_MS = 60000, CHECK_MS = 15000;
  function mkParty(g: Guest): Party { if (g.party) return g.party; const p: Party = { code: newCode(), leader: g.id, members: [g], dungeon: null, room: null, ready: new Set(), check: null }; parties.set(p.code, p); g.party = p; return p; }
  function addMember(p: Party, g: Guest) { if (g.party === p) return true; if (p.members.length >= MAX_PARTY) { err(g, 'full', 'Party is full (4 max).'); return false; } if (g.party) leaveParty(g); p.members.push(g); g.party = p; bcastParty(p); for (const x of p.members) if (x !== g) send(x, { t: 'sys', msg: (g.name || 'A player') + ' joined the party.' }); return true; }
  function onInvite(g: Guest, m: any) {
    if (!g.b.chat.take()) return err(g, 'slow', 'Slow down.'); const to = guests.get(String(m.to || '')); if (!to || !to.ws || to === g) return err(g, 'gone', 'That player is not online.');
    const kind: 'invite' | 'join' = m.kind === 'join' ? 'join' : 'invite'; if (kind === 'invite' && g.party && g.party === to.party) return;
    if (kind === 'invite' && parties.size >= (o.maxParties ?? 500) && !g.party) { stats.roomCapHits++; return err(g, 'busy', 'Server is full, try again later.'); }
    let box = invites.get(to.id); if (!box) { box = new Map(); invites.set(to.id, box); } box.set(g.id, { from: g.id, kind, at: Date.now() }); if (box.size > 8) box.delete(box.keys().next().value!);
    send(to, { t: 'invite', from: g.id, name: g.name, lvl: g.lvl, kind }); send(g, { t: 'sys', msg: (kind === 'join' ? 'Asked to join ' : 'Invited ') + (to.name || 'A player') + '.' });
  }
  function onInviteReply(g: Guest, m: any) {
    const box = invites.get(g.id); const inv = box?.get(String(m.from || '')); if (!inv) return; box!.delete(inv.from); const from = guests.get(inv.from); if (!from || Date.now() - inv.at > INVITE_MS) return err(g, 'expired', 'That invite expired.');
    if (!m.ok) { send(from, { t: 'sys', msg: g.name + (inv.kind === 'join' ? ' declined your request.' : ' declined.') }); return; }
    if (inv.kind === 'invite') addMember(mkParty(from), g); else addMember(mkParty(g), from); // join request: the asker joins the accepter's party
  }
  function onGo(g: Guest, m: any) {
    const p = g.party; if (!p || p.leader !== g.id || p.room || p.check) return; const d = String(m.dungeon || ''); if (!DUNGEONS[d]) return err(g, 'baddungeon', 'Unknown dungeon.');
    if (rooms.size >= (o.maxRooms ?? 100)) { stats.roomCapHits++; return err(g, 'busy', 'All dungeon rooms are busy, try again in a minute.'); }
    p.dungeon = d; p.check = { dungeon: d, until: Date.now() + CHECK_MS, yes: new Set([g.id]), no: new Set() }; bcastParty(p); checkDone(p);
  }
  function onCheckReply(g: Guest, m: any) { const c = g.party?.check; if (!c) return; c.yes.delete(g.id); c.no.delete(g.id); (m.ok ? c.yes : c.no).add(g.id); bcastParty(g.party!); checkDone(g.party!); }
  /** start with whoever said yes once everyone answered or the countdown ran out; declined / timed-out members stay in town, still in the party */
  function checkDone(p: Party, force = false) {
    const c = p.check; if (!c) return; const all = p.members.every(x => c.yes.has(x.id) || c.no.has(x.id)); if (!all && !force && Date.now() < c.until) return; p.check = null;
    if (!p.members.some(x => x.id === p.leader) || !c.yes.has(p.leader)) { bcastParty(p); return; }
    const who = p.members.filter(x => c.yes.has(x.id)); startInstance(p, c.dungeon, who);
    for (const x of p.members) if (!c.yes.has(x.id)) send(x, { t: 'sys', msg: 'Your party went in. Press Join in the Party panel to drop in.' });
  }
  /** drop-in: a party member in town joins the running instance (gets seed, killed set and flags; spawns at the entrance). Party scaling stays as it was at the start. */
  function onDropIn(g: Guest) { const p = g.party, r = p?.room; if (!p || !r || r.players.has(g.id) || r.completed) return; if (r.players.size >= MAX_PARTY) return err(g, 'full', 'That run is full.'); leaveShard(g); r.players.set(g.id, mkRP(g, r.spawn)); send(g, startMsg(r, g.id)); toRoom(r, { t: 'sys', msg: (g.name || 'A player') + ' dropped in.' }, g.id); bcastParty(p); }

  function onMsg(g: Guest, m: any) {
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    if (m.t === 'st') { if (!g.b.input.take()) { stats.rateLimited++; return; } const r = g.party?.room; if (r) onState(r, g, m); return; }
    if (!g.b.all.take()) { stats.rateLimited++; if (++g.viol > 400) g.ws?.close(1008, 'rate limit'); return; }
    switch (m.t) {
      case 'ping': send(g, { t: 'pong', c: m.c, s: Date.now() }); break;
      case 'build': break; // protocol v1 leftover: gameplay is client-side now, the server keeps no build
      case 'profile': g.name = cleanName(m.name, g.name); if (m.pub !== undefined) o.city?.setPublic(g.id, cleanName(m.name, g.name), m.pub === 1); g.lvl = clamp(Math.floor(+m.lvl) || 1, 1, 50); g.look = cleanLook(m.look) ?? g.look; if (g.party) bcastParty(g.party); break;
      case 'party_create': { if (parties.size >= (o.maxParties ?? 500) && !g.party) { stats.roomCapHits++; return err(g, 'busy', 'Server is full, try again later.'); } if (g.party) leaveParty(g); const p: Party = { code: newCode(), leader: g.id, members: [g], dungeon: null, room: null, ready: new Set(), check: null }; parties.set(p.code, p); g.party = p; bcastParty(p); break; }
      case 'party_join': { const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); const p = parties.get(code); if (!p) return err(g, 'nocode', 'No party with that code.'); if (g.party === p) return; if (p.members.length >= MAX_PARTY) return err(g, 'full', 'Party is full (4 max).'); if (g.party) leaveParty(g); p.members.push(g); g.party = p; bcastParty(p); for (const x of p.members) if (x !== g) send(x, { t: 'sys', msg: (g.name || 'A player') + ' joined the party.' }); break; }
      case 'party_leave': leaveParty(g); break;
      case 'invite': onInvite(g, m); break;
      case 'invite_reply': onInviteReply(g, m); break;
      case 'party_go': onGo(g, m); break;
      case 'rcheck': onCheckReply(g, m); break;
      case 'drop_in': onDropIn(g); break;
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
      case 'town_join': joinShard(g, typeof m.town === 'string' && /^[a-z0-9_]{1,24}$/.test(m.town) ? m.town : 'rustline'); if (o.city && m.cv !== o.city.s.v) send(g, o.city.full()); break;
      case 'cev': { if (!o.city) return; const r = o.city.claim(g.id, m, { inRoom: g.party?.room?.id ?? null }); if (!r.ok) stats.rejected++; break; }
      case 'town_leave': leaveShard(g); break;
      case 'town_pos': { if (!g.shard || !g.b.pos.take()) return; const x = +m.x, y = +m.y; if (!Number.isFinite(x) || !Number.isFinite(y)) return; const now = Date.now(), dt = Math.min(1, (now - g.pos.t) / 1000); const max = COMBAT.playerSpeed * 1.6 * Math.max(dt, .05) + 1.2; // speed gate: no teleporting
        if (g.pos.t && Math.hypot(x - g.pos.x, y - g.pos.y) > max) { stats.rejected++; send(g, { t: 'town_correct', x: g.pos.x, y: g.pos.y }); return; } if (x < 0 || y < 0 || x > 200 || y > 200) return; g.pos = { x, y, face: clamp(+m.face || 0, -7, 7), moving: !!m.moving, em: (+m.em | 0) & 255, t: now, town: g.pos.town }; break; }
    }
  }

  wss.on('connection', ws => {
    if (wss.clients.size > (o.maxConns ?? 500)) { ws.close(1013, 'full'); return; } stats.conns++; let g: Guest | null = null; const tmp = { all: new Bucket(20, 30) };
    ws.on('message', raw => {
      stats.msgs++; let m: any; try { m = JSON.parse(String(raw)); } catch { return; }
      if (!g) { // handshake: anonymous guest id + secret token (server issues both on first contact)
        if (!tmp.all.take() || m?.t !== 'hello') return;
        if (m.proto !== PROTO) { stats.versionRefused++; try { ws.send(JSON.stringify({ t: 'err', code: 'version', server: PROTO, client: m.proto ?? 0, msg: 'Your game version is out of date for this server (protocol ' + (m.proto ?? 1) + ', server ' + PROTO + '). Refresh the page (Ctrl+F5) to update, then reconnect.' })); } catch {} setTimeout(() => { try { ws.close(4001, 'version mismatch'); } catch {} }, 50); return; } let gg = typeof m.guest === 'string' ? guests.get(m.guest) : undefined; if (gg && gg.token !== m.token) gg = undefined;
        if (!gg) { gg = { id: 'g' + randomBytes(5).toString('hex'), token: randomBytes(12).toString('hex'), name: '', lvl: 1, ws: null, party: null, shard: null, pos: { x: 0, y: 0, face: 0, moving: false, t: 0, town: 'rustline' }, ready: false, b: mkBuckets(), viol: 0 }; guests.set(gg.id, gg); }
        if (gg.ws && gg.ws !== ws) { try { gg.ws.close(4000, 'replaced'); } catch {} } gg.ws = ws; g = gg; g.name = cleanName(m.name, g.name); g.lvl = clamp(Math.floor(+m.lvl) || 1, 1, 50); g.look = cleanLook(m.look) ?? g.look;
        send(g, { t: 'welcome', proto: PROTO, id: g.id, token: g.token, stateHz: STATE_HZ, name: g.name, dev: !!o.dev });
        if (g.party) { bcastParty(g.party); const r = g.party.room; if (r && r.players.has(g.id)) send(g, startMsg(r, g.id, true)); } return; }
      onMsg(g, m);
    });
    ws.on('close', () => { if (!g || g.ws !== ws) return; g.ws = null; leaveShard(g); const gg = g; // grace period: keep party seat 60 s for reconnects
      setTimeout(() => { if (!gg.ws) { leaveParty(gg, 'disconnected'); guests.delete(gg.id); invites.delete(gg.id); } }, 60000).unref?.(); });
    ws.on('error', () => {});
  });

  // ---------- main loops
  // one light 8 Hz loop for all rooms: relay changed player state + wipe check. No combat simulation runs here.
  let lastRoomT = Date.now();
  const simTimer = setInterval(() => { const now = Date.now(), dt = (now - lastRoomT) / 1000; lastRoomT = now; for (const p of parties.values()) if (p.check && now >= p.check.until) checkDone(p, true); for (const r of rooms.values()) { roomTick(r, dt); if (r.players.size === 0) endInstance(r.party, 'empty'); } }, 1000 / STATE_HZ);
  const townTimer = setInterval(() => {
    { const now = Date.now(); for (const sh of [...shards.values()]) if (!sh.members.size && sh.emptyAt && now - sh.emptyAt >= (o.shardIdleMs ?? TOWN_SHARD_IDLE_MS)) shards.delete(sh.id); }
    for (const sh of shards.values()) { const list = [...sh.members].filter(m => m.pos.t).map(m => ({ id: m.id, name: m.name, x: r2(m.pos.x), y: r2(m.pos.y), face: r2(m.pos.face), moving: m.pos.moving, em: m.pos.em || 0, look: m.look, lvl: m.lvl })); for (const m of sh.members) send(m, { t: 'town_snap', players: list.filter(p => p.id !== m.id), pop: sh.members.size }); }
  }, 1000 / TOWN_HZ);
  // living city: one slow timer. Diffs only (changed districts), every citySyncMs, to town shard members; persistence + news refresh are async best effort.
  let lastSave = Date.now(), lastNews = 0;
  const cityTimer = o.city ? setInterval(() => { const c = o.city!; c.tick(); const d = c.takeDiff(); if (d) { const sj = JSON.stringify(d); for (const sh of shards.values()) for (const m of sh.members) if (m.ws && m.ws.readyState === WebSocket.OPEN) { m.ws.send(sj); c.stats.bytes += sj.length; } }
    const now = Date.now(); if (now - lastSave >= CITY_SAVE_MS) { lastSave = now; void c.persist(); } if (now - lastNews >= CITY_NEWS_MS) { lastNews = now; void c.refreshNews(); } }, o.citySyncMs ?? CITY_SYNC_MS) : null; (cityTimer as any)?.unref?.();
  wss.on('close', () => { clearInterval(simTimer); clearInterval(townTimer); if (cityTimer) clearInterval(cityTimer); });
  const ready = new Promise<void>(res => http.on('listening', () => res()));
  const api: any = {
    ready, city: o.city,    port: () => (http.address() as any).port as number, drain: () => { draining = true; }, stats, guests, parties, rooms, shards,
    /** graceful shutdown: stop accepting, tell clients, give them a moment, then close */
    shutdown: async (graceMs = 5000) => { draining = true; for (const g of guests.values()) send(g, { t: 'sys', msg: 'Server restarting, you will be returned to town.' }); for (const r of [...rooms.values()]) endInstance(r.party, 'server restart'); await new Promise(r => setTimeout(r, graceMs)); await o.city?.persist(); await api.close(); },
    close: () => new Promise<void>(res => { clearInterval(simTimer); clearInterval(townTimer); if (cityTimer) clearInterval(cityTimer); for (const c of wss.clients) c.terminate(); wss.close(() => http.close(() => res())); }),
  };
  return api;
}
