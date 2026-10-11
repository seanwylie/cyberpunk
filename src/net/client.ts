// Multiplayer client core (no DOM): connection, guest identity, party actions, instance prediction/reconciliation, remote interpolation.
// Offline by default: nothing here runs unless a server URL is configured and the player opens the Party panel.
import { dungeonOf } from '../content/dungeons';
import type { Level } from '../level';
import { PROTO, TICK_HZ, TICK_DT, InputMsg, SnapMsg, PartyState, PlayerView, YouView, EnemyView, DropView, Look, stepPlayer, rng32 } from './shared';
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

export class InstanceClient {
  level: Level; seq = 0; px: number; py: number; pending: InputMsg[] = []; players = new Interp<PlayerView & { id: string }>(); enemies = new Interp<EnemyView & { id: number }>();
  last: SnapMsg | null = null; you: YouView | null = null; spd = 5.6; private outActs: any[] = []; drops: DropView[] = []; flags = { bossSpawned: false, bossDead: false, completed: false, kills: 0, total: 0, wipeT: 0 }; corrections = 0; maxErr = 0; snaps = 0; lastTick = 0;
  constructor(public net: NetClient, public dungeon: string, public seed: number, public myId: string, public hpMul: number, public dmgMul: number) {
    this.level = dungeonOf(dungeon).build(seed); this.px = this.level.spawn.x; this.py = this.level.spawn.y;
  }
  /** call at TICK_HZ: predict locally with the exact server step, then send. mx,my are WORLD-space direction. */
  /** queue a discrete action (cast/dodge/vent/stim/use/dlg); it rides on the next input message */
  act(a: any) { if (this.outActs.length < 6) this.outActs.push(a); return true; }
  tickInput(mx: number, my: number, atk: boolean, face: number, revive = false) {
    if (this.you?.down) { mx = 0; my = 0; }
    const m: InputMsg = { t: 'input', seq: ++this.seq, mx, my, atk, face, revive }; if (this.outActs.length) { m.acts = this.outActs.splice(0, 4); } const p = { x: this.px, y: this.py }; stepPlayer(this.level, p, mx, my, TICK_DT, this.spd); this.px = p.x; this.py = p.y; this.pending.push(m); if (this.pending.length > 120) this.pending.shift(); this.net.send(m); return m;
  }
  onSnap(s: SnapMsg, nowMs: number) {
    this.snaps++; this.last = s; this.you = s.you; if (s.you.spd > 0) this.spd = s.you.spd; this.drops = s.drops; this.flags = s.flags; this.lastTick = s.tick; const st = s.tick * TICK_DT;
    this.players.push(st, nowMs, s.players as any); this.enemies.push(st, nowMs, s.enemies as any);
    // reconcile: start from the authoritative state, replay inputs the server has not processed yet
    while (this.pending.length && this.pending[0].seq <= s.ack) this.pending.shift();
    const p = { x: s.you.x, y: s.you.y }; for (const m of this.pending) stepPlayer(this.level, p, m.mx, m.my, TICK_DT, this.spd);
    const err = Math.hypot(p.x - this.px, p.y - this.py); this.maxErr = Math.max(this.maxErr, err);
    if (err > 0.02) { this.corrections++; if (err > 1.5) { this.px = p.x; this.py = p.y; } else { this.px += (p.x - this.px) * .5; this.py += (p.y - this.py) * .5; } }
  }
}

export class NetClient {
  state: 'off' | 'connecting' | 'online' = 'off'; id = ''; token = ''; party: PartyState | null = null; inst: InstanceClient | null = null; rtt = 0; devServer = false; lastErr = ''; shard = ''; townPlayers = new Interp<any>(.2); townPop = 0; marks: { x: number; y: number; name: string; t: number }[] = [];
  private ws: any = null; private h: Record<string, Fn[]> = {}; private pingT: any = null; private cn = 0; private rnd: () => number; private closedByUser = false; private retry = 0; private retryT: any = null; stats = { sent: 0, recv: 0, dropped: 0 };
  constructor(public o: NetOpts) { this.rnd = rng32(o.link?.seed ?? 7); }
  on(t: string, f: Fn) { (this.h[t] ||= []).push(f); return this; }
  private emit(t: string, ...a: any[]) { for (const f of this.h[t] || []) { try { f(...a); } catch (e) { console.warn('net handler', t, e); } } }
  private store() { return this.o.store ?? { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} } }; }
  connect() {
    if (this.state !== 'off') return; this.closedByUser = false; this.state = 'connecting'; this.emit('state', this.state); const WS = this.o.WS || (globalThis as any).WebSocket;
    let ws: any; try { ws = new WS(this.o.url); } catch (e) { this.state = 'off'; this.lastErr = 'bad server URL'; this.emit('state', this.state); return; } this.ws = ws;
    ws.onopen = () => { this.rawSend({ t: 'hello', guest: this.store().get('wv_guest') || undefined, token: this.store().get('wv_token') || undefined, name: this.o.name, lvl: this.o.lvl, look: this.o.look }); };
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
      case 'welcome': if (m.proto !== PROTO) { this.lastErr = 'server protocol mismatch'; this.close(); return; } this.id = m.id; this.token = m.token; this.devServer = !!m.dev; this.store().set('wv_guest', m.id); this.store().set('wv_token', m.token); this.state = 'online'; this.retry = 0; this.emit('state', this.state); this.emit('welcome', m);
        this.pingT = setInterval(() => this.send({ t: 'ping', c: (globalThis as any).performance?.now?.() ?? Date.now() }), 2000); this.send({ t: 'ping', c: (globalThis as any).performance?.now?.() ?? Date.now() }); break;
      case 'pong': { const n = (globalThis as any).performance?.now?.() ?? Date.now(); this.rtt = Math.round(this.rtt ? this.rtt * .7 + (n - m.c) * .3 : n - m.c); this.emit('rtt', this.rtt); break; }
      case 'party': this.party = m.code ? m : null; this.emit('party', this.party); break;
      case 'instance_start': this.inst = new InstanceClient(this, m.dungeon, m.seed, m.you, m.hpMul, m.dmgMul); this.emit('instance_start', this.inst, m); break;
      case 'instance_end': { const i = this.inst; this.inst = null; this.emit('instance_end', m.reason, i); break; }
      case 'snap': if (this.inst) { this.inst.onSnap(m, now); this.emit('snap', m); } break;
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
