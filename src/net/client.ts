// Multiplayer client core (no DOM): connection, guest identity, party actions, instance prediction/reconciliation, remote interpolation.
// Offline by default: nothing here runs unless a server URL is configured and the player opens the Party panel.
import { dungeonOf } from '../content/dungeons';
import type { Level } from '../level';
import { PROTO, STATE_HZ, DMG_FLUSH_MS, INTERP_DELAY, PartyState, PlayerView, Look, stepPlayer, rng32 } from './shared';
import { COMBAT } from '../config';
import { Interp } from './interp';

export interface LinkSim { delayMs: number; jitterMs?: number; loss: number; lossTypes?: string[]; seed?: number } // test-only latency / packet-loss shim
type Fn = (...a: any[]) => void;
export interface NetOpts { url: string; name?: string; lvl?: number; look?: Look; WS?: any; store?: { get(k: string): string | null; set(k: string, v: string): void }; link?: LinkSim }

/** where the server URL comes from: ?server=, localStorage wv_server, build-time VITE_WV_SERVER; empty = single-player only */
export function configuredServer(): string {
  try { const q = new URLSearchParams(location.search).get('server'); if (q) { try { localStorage.setItem('wv_server', q); } catch {} return q; } } catch {}
  try { const s = localStorage.getItem('wv_server'); if (s) return s; } catch {}
  try { return String((import.meta as any).env?.VITE_WV_SERVER || ''); } catch { return ''; }
}

/** Client side of a party dungeon (protocol v2). Gameplay is LOCAL and never waits on the server: `move`/`setState` change position immediately;
 *  this class only (a) reports display state at STATE_HZ, (b) batches damage dealt, (c) sends pivotal claims (kill, flag, revive) and (d) interpolates teammates. */
export interface RosterEntry { id: string; name: string; lvl: number; look?: Look }
export class InstanceClient {
  level: Level; px: number; py: number; face = 0; hp = 100; maxHp = 100; down = false; moving = false; atk = false;
  players = new Interp<PlayerView & { id: string }>(INTERP_DELAY + .05); roster = new Map<string, RosterEntry>();
  flags: Record<string, any> = {}; killed = new Set<number>(); nSpawns = 0; you: { down: boolean; hp: number; maxHp: number } | null = null; snaps = 0; lastN = 0;
  stats = { stateSent: 0, dmgSent: 0, claims: 0, flagsSent: 0 }; private known = new Map<string, any>(); private lastX = 0; private lastY = 0; private lastSent = 0; private lastKey = ''; private dmgAcc = new Map<number, number>(); private dmgAt = 0;
  constructor(public net: NetClient, public dungeon: string, public seed: number, public myId: string, public hpMul: number, public dmgMul: number, init?: any) {
    this.level = dungeonOf(dungeon).build(seed); this.px = this.lastX = this.level.spawn.x; this.py = this.lastY = this.level.spawn.y;
    if (init) { for (const r of init.roster || []) this.roster.set(r.id, r); this.flags = { ...(init.flags || {}) }; for (const k of init.killed || []) this.killed.add(k); this.nSpawns = init.nSpawns || 0; }
  }
  /** instant local movement with the shared movement function (headless bots/tests; the real game moves itself and calls setState) */
  move(mx: number, my: number, dt: number, spd = COMBAT.playerSpeed) { if (this.down) { mx = 0; my = 0; } const p = { x: this.px, y: this.py }; stepPlayer(this.level, p, mx, my, dt, spd); this.px = p.x; this.py = p.y; this.moving = Math.hypot(mx, my) > .05; if (this.moving) this.face = Math.atan2(my, mx); this.report(); }
  setState(x: number, y: number, face: number, hp: number, maxHp: number, down: boolean, moving: boolean, atk: boolean) { this.px = x; this.py = y; this.face = face; this.hp = hp; this.maxHp = maxHp; this.down = down; this.moving = moving; this.atk = atk; this.you = { down, hp, maxHp }; this.report(); }
  /** throttled to STATE_HZ; sends only when something changed (plus a 1 s heartbeat). Returns true if a message was sent. */
  report(nowMs = Date.now()): boolean {
    this.flushDmg(nowMs); if (nowMs - this.lastSent < 1000 / STATE_HZ - 2) return false;
    const jump = Math.hypot(this.px - this.lastX, this.py - this.lastY) > 12; this.lastX = this.px; this.lastY = this.py; const m: any = { t: 'st', ...(jump ? { tp: 1 } : {}), x: +this.px.toFixed(2), y: +this.py.toFixed(2), f: +this.face.toFixed(2), hp: Math.round(this.hp), mh: Math.round(this.maxHp), dn: this.down ? 1 : 0, mv: this.moving ? 1 : 0, at: this.atk ? 1 : 0 }; const key = m.x + ',' + m.y + ',' + m.f + ',' + m.hp + ',' + m.mh + m.dn + m.mv + m.at;
    if (key === this.lastKey && nowMs - this.lastSent < 1000) return false; this.lastKey = key; this.lastSent = nowMs; this.stats.stateSent++; this.net.send(m); return true;
  }
  /** damage this player dealt to an enemy (id 0 = boss); batched and relayed so teammates' copies of that enemy lose the same HP */
  addDamage(id: number, amount: number) { if (amount > 0 && Number.isFinite(amount)) this.dmgAcc.set(id, (this.dmgAcc.get(id) || 0) + amount); }
  flushDmg(nowMs = Date.now(), force = false) { if (!this.dmgAcc.size || (!force && nowMs - this.dmgAt < DMG_FLUSH_MS)) return; this.dmgAt = nowMs; const d = [...this.dmgAcc].map(([id, a]) => [id, Math.round(a * 10) / 10]); this.dmgAcc.clear(); this.stats.dmgSent++; this.net.send({ t: 'dmg', d }); }
  /** pivotal: claim an enemy kill (0 = boss). The server dedupes; every client then receives `ekill` and rolls its own rewards. */
  claimKill(id: number) { this.flushDmg(Date.now(), true); this.stats.claims++; this.net.send({ t: 'kill', id }); }
  setFlag(k: string, v: any) { if (this.flags[k] === v) return; this.flags[k] = v; this.stats.flagsSent++; this.net.send({ t: 'flag', k, v }); }
  revive(id: string) { this.net.send({ t: 'revive', id }); }
  onPs(m: any, nowMs: number) { this.snaps++; this.lastN = m.n; const list = (m.p as any[]).filter(p => p.id !== this.myId).map(p => { const r = this.roster.get(p.id); return { id: p.id, name: r?.name || 'Guest', lvl: r?.lvl || 1, look: r?.look, x: p.x, y: p.y, face: p.f, hp: p.hp, maxHp: p.mh, down: !!p.dn, moving: !!p.mv, atk: !!p.at } as any; });
    // merge with the previous known set so players that did not change this tick stay visible (server sends deltas)
    for (const l of list) this.known.set(l.id, l); this.players.push(m.n / STATE_HZ, nowMs, [...this.known.values()]); }
  onEvent(m: any) { if (m.t === 'ekill') { if (m.id) this.killed.add(m.id); else this.flags.bossDead = true; } else if (m.t === 'flag') this.flags[m.k] = m.v; }
}

export class NetClient {
  state: 'off' | 'connecting' | 'online' = 'off'; id = ''; token = ''; party: PartyState | null = null; inst: InstanceClient | null = null; rtt = 0; devServer = false; versionError = ''; lastErr = ''; shard = ''; townPlayers = new Interp<any>(.2); townPop = 0; marks: { x: number; y: number; name: string; t: number }[] = [];
  private ws: any = null; private h: Record<string, Fn[]> = {}; private pingT: any = null; private cn = 0; private rnd: () => number; private closedByUser = false; private retry = 0; private retryT: any = null; stats = { sent: 0, recv: 0, dropped: 0 };
  constructor(public o: NetOpts) { this.rnd = rng32(o.link?.seed ?? 7); }
  on(t: string, f: Fn) { (this.h[t] ||= []).push(f); return this; }
  emit(t: string, ...a: any[]) { for (const f of this.h[t] || []) { try { f(...a); } catch (e) { console.warn('net handler', t, e); } } }
  private store() { return this.o.store ?? { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} } }; }
  connect() {
    if (this.state !== 'off') return; this.closedByUser = false; this.state = 'connecting'; this.emit('state', this.state); const WS = this.o.WS || (globalThis as any).WebSocket;
    let ws: any; try { ws = new WS(this.o.url); } catch (e) { this.state = 'off'; this.lastErr = 'bad server URL'; this.emit('state', this.state); return; } this.ws = ws;
    ws.onopen = () => { this.rawSend({ t: 'hello', proto: PROTO, guest: this.store().get('wv_guest') || undefined, token: this.store().get('wv_token') || undefined, name: this.o.name, lvl: this.o.lvl, look: this.o.look }); };
    ws.onmessage = (ev: any) => { const data = typeof ev.data === 'string' ? ev.data : String(ev.data); const l = this.o.link; if (l && l.lossTypes?.some(t => data.startsWith('{"t":"' + t + '"')) && this.rnd() < l.loss) { this.stats.dropped++; return; } const d = l ? this.linkDelay('in') : 0; if (d > 0) setTimeout(() => this.onRaw(data), d); else this.onRaw(data); };
    ws.onclose = () => { const was = this.state; this.state = 'off'; this.ws = null; clearInterval(this.pingT); this.emit('state', this.state); if (was === 'online') this.emit('lost'); if (!this.closedByUser) { this.retry = Math.min(this.retry + 1, 6); this.retryT = setTimeout(() => this.connect(), 500 * 2 ** this.retry); } };
    ws.onerror = () => { this.lastErr = 'could not reach server'; };
  }
  close() { this.closedByUser = true; clearTimeout(this.retryT); clearInterval(this.pingT); try { this.ws?.close(); } catch {} this.state = 'off'; this.inst = null; this.party = null; }
  private rawSend(m: any) { const s = JSON.stringify(m); this.stats.sent++; const l = this.o.link; if (l) { if (l.lossTypes?.includes(m.t) && this.rnd() < l.loss) { this.stats.dropped++; return; } const d = this.linkDelay('out'); setTimeout(() => { try { if (this.ws?.readyState === 1) this.ws.send(s); } catch {} }, d); return; } try { if (this.ws?.readyState === 1) this.ws.send(s); } catch {} }
  /** test shim: jittered delay that never reorders messages (a WebSocket is an ordered stream) */
  private due = { in: 0, out: 0 };
  private linkDelay(dir: 'in' | 'out') { const l = this.o.link!; const now = Date.now(); const t = Math.max(this.due[dir], now + l.delayMs + (l.jitterMs ? this.rnd() * l.jitterMs : 0)); this.due[dir] = t; return t - now; }
  send(m: any) { if (this.state === 'online') this.rawSend(m); }
  private onRaw(data: string) {
    let m: any; try { m = JSON.parse(data); } catch { return; } this.stats.recv++; const now = (globalThis as any).performance?.now?.() ?? Date.now();
    switch (m.t) {
      case 'welcome': if (m.proto !== PROTO) { this.versionError = 'This game version and the server speak different protocols. Refresh the page (Ctrl+F5) to update.'; this.lastErr = this.versionError; this.emit('err', { code: 'version', msg: this.versionError }); this.close(); return; } this.id = m.id; this.token = m.token; this.devServer = !!m.dev; this.store().set('wv_guest', m.id); this.store().set('wv_token', m.token); this.state = 'online'; this.retry = 0; this.emit('state', this.state); this.emit('welcome', m);
        this.pingT = setInterval(() => this.send({ t: 'ping', c: (globalThis as any).performance?.now?.() ?? Date.now() }), 2000); this.send({ t: 'ping', c: (globalThis as any).performance?.now?.() ?? Date.now() }); break;
      case 'pong': { const n = (globalThis as any).performance?.now?.() ?? Date.now(); this.rtt = Math.round(this.rtt ? this.rtt * .7 + (n - m.c) * .3 : n - m.c); this.emit('rtt', this.rtt); break; }
      case 'party': this.party = m.code ? m : null; this.emit('party', this.party); break;
      case 'instance_start': this.inst = new InstanceClient(this, m.dungeon, m.seed, m.you, m.hpMul, m.dmgMul, m); this.emit('instance_start', this.inst, m); break;
      case 'instance_end': { const i = this.inst; this.inst = null; this.emit('instance_end', m.reason, i); break; }
      case 'ps': if (this.inst) { this.inst.onPs(m, now); this.emit('ps', m); } break;
      case 'ekill': case 'flag': case 'edmg': case 'revived': case 'wipe': this.inst?.onEvent(m); this.emit(m.t, m); break;
      case 'err': if (m.code === 'version') { this.versionError = m.msg; this.lastErr = m.msg; this.closedByUser = true; clearTimeout(this.retryT); } this.emit('err', m); break;
      case 'town': this.shard = m.shard; this.townPop = m.pop; this.emit('town', m); break;
      case 'town_snap': this.townPop = m.pop; this.townPlayers.push((Date.now()) / 1000, now, m.players); this.emit('town_snap', m); break;
      case 'town_leave': this.emit('town_leave', m.id); break;
      case 'mark': this.marks.push({ x: m.x, y: m.y, name: m.name, t: Date.now() }); if (this.marks.length > 6) this.marks.shift(); this.emit('mark', m); break;
      default: this.emit(m.t, m);
    }
  }
  // ---- party API
  createParty() { this.send({ t: 'party_create' }); } joinParty(code: string) { this.send({ t: 'party_join', code }); } leaveParty() { this.send({ t: 'party_leave' }); this.party = null; }
  setReady(r: boolean) { this.onBuild?.(); this.send({ t: 'party_ready', ready: r }); } onBuild?: () => void; setDungeon(d: string) { this.send({ t: 'party_dungeon', dungeon: d }); } start() { this.send({ t: 'party_start' }); }
  kick(id: string) { this.send({ t: 'party_kick', id }); } chat(text: string, scope: 'party' | 'town' = 'party') { this.send({ t: 'chat', text, scope }); } mark(x: number, y: number) { this.send({ t: 'mark', x, y }); }
  profile(name: string, lvl: number, look?: Look) { this.o.name = name; this.o.lvl = lvl; this.o.look = look; this.send({ t: 'profile', name, lvl, look }); }
  /** the validated-on-server combat build (installed hardware, chips, rep, pity) */
  build(profile: any) { this.send({ t: 'build', profile }); }
  get isLeader() { return !!this.party && this.party.members.some(m => m.id === this.id && m.leader); }
}
