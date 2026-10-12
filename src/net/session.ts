// Glue between the single-player Game and the multiplayer client. Active ONLY while a party instance runs (Game.netHook returns true)
// or while the player is in a town shard. Single-player behaviour is untouched when no server is configured/connected.
import { Game } from '../sim';
import type { En } from '../sim';
import type { Renderer } from '../render';
import { ISO } from '../sim';
import { LAYOUT_V, InstanceState, persist } from '../state';
import { dungeonOf } from '../content/dungeons';
import { ENEMIES } from '../config';
import { NetClient, InstanceClient } from './client';
import { RemoteDrawer, RemoteP } from './remote_render';
import { SHARED_FLAGS } from './shared';
import { bodyOf } from '../bodyvariants';
import { equippedCos } from '../content/appearance';
import { encodeGear } from '../cosfx';
import { gearFxOf } from '../gearfx';

const PARTICIPATE_R = 20, REVIVE_HOLD = 2.5, REVIVE_REACH = 2.4;
const DOOR_FLAGS = new Set(['gate1', 'lock2', 'controller', 'armory']);
/** Client-authoritative party play (protocol v2). The local Game runs the dungeon completely by itself (movement, combat, enemy AI): nothing here ever waits on the
 *  server. This glue (a) reports display state, (b) relays damage and kill claims, (c) applies teammates' damage / kills / flags / revives, (d) defers kill rewards until the
 *  server confirms the claim (every participant then rolls their OWN rewards locally, from their own save and pity timers). */
export class NetSession {
  active = false; ic: InstanceClient | null = null; draw: RemoteDrawer; private prevInst: InstanceState | null = null; private saved: Record<string, any> = {}; private reviveHeld = false; private lastTownKey = ''; mouse = { x: 0, y: 0 }; onExit?: (reason: string) => void; onEnter?: () => void;
  private applying = false; private claimed = new Map<number, En>(); private hurtBy = new Set<number>(); private flagSeen: Record<string, any> = {}; private flagT = 0; private holdT = 0; private holdId = ''; private origKill: ((e: En) => void) | null = null; private pendingClear: En | null = null;
  constructor(public g: Game, public rend: Renderer, public net: NetClient) {
    this.draw = new RemoteDrawer(rend);
    (g as any).netHook = (dt: number) => this.hook(dt); (rend as any).netItems = (items: any[]) => this.items(items);
    net.on('instance_start', (ic: InstanceClient) => this.enter(ic));
    net.on('instance_end', (why: string) => { if (this.active) this.exit(why, false); });
    net.on('town_leave', (id: string) => this.draw.forget(id));
    net.on('lost', () => { if (this.active) this.exit('connection lost', false); });
    net.on('ekill', (m: any) => this.onEkill(m)); net.on('edmg', (m: any) => this.onEdmg(m)); net.on('flag', (m: any) => this.onFlag(m)); net.on('revived', (m: any) => this.onRevived(m)); net.on('wipe', () => this.onWipe());
    window.addEventListener('keydown', e => { if (e.code === 'KeyF') this.reviveHeld = true; if (e.code === 'KeyG' && this.net.state === 'online' && (this.active || this.net.party) && !(e.target as HTMLElement)?.matches?.('input,textarea')) { const w = this.rend.screenToWorld(this.mouse.x, this.mouse.y); this.net.mark(w.x, w.y); } });
    window.addEventListener('keyup', e => { if (e.code === 'KeyF') this.reviveHeld = false; });
    rend.canvas.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    setInterval(() => this.townTick(), 100);
  }
  /** id the network knows this enemy by: spawn index (deterministic from the shared seed), 0 = boss, -1 = local-only (summons/adds) */
  private netId(e: En): number { if (ENEMIES[e.type]?.boss) return 0; return e.id >= 1 && this.ic && e.id <= this.ic.nSpawns ? e.id : -1; }
  private findEnemy(id: number): En | undefined { return this.g.enemies.find(e => !e.dead && (id === 0 ? !!ENEMIES[e.type]?.boss : e.id === id)); }
  // ---------- entering / leaving a networked instance
  enter(ic: InstanceClient) {
    const g = this.g; if (this.active) this.exit('restart', false);
    this.ic = ic; this.active = true; this.claimed.clear(); this.hurtBy.clear(); this.flagSeen = {}; this.pendingClear = null; this.holdT = 0;
    const lv = ic.level; const f: any = { gate1: false, lock2: false, passageSeen: false, controller: false, armory: false, cond: null, bossKey: null, bossRevealed: false, bossSpawned: false, bossDead: false, completed: false, rewardsGranted: false, alarm: false, salvageForeman: false };
    for (const k of SHARED_FLAGS) if (k !== 'bossSpawned' && ic.flags[k]) f[k] = ic.flags[k]; if (ic.flags.bossDead) { f.bossDead = true; f.completed = true; f.rewardsGranted = true; }
    this.prevInst = g.inst;
    // party scaling of enemy HP applies to this game's own enemies (teammates' damage is relayed onto each copy, so the HP pool is effectively shared)
    this.saved.hpMul = (g as any).hpMul; (g as any).hpMul = () => Game.prototype.hpMul.call(g) * ic.hpMul;
    const inst: InstanceState = { id: 'net-' + ic.seed, dungeon: ic.dungeon, layoutV: LAYOUT_V, createdAt: Date.now(), expiresAt: Date.now() + 36e5, seed: ic.seed, enemies: [], drops: [], carried: { items: [], chips: {}, stims: 0, credits: 0 }, flags: f, checkpoint: { id: 1, x: lv.spawn.x, y: lv.spawn.y }, px: lv.spawn.x, py: lv.spawn.y, hp: 0, broken: [], protectedSlots: [], repairAdded: 0, nextId: 1, xpEarned: 0, warned: true, kills: {}, claimed: [], elapsed: 0 };
    for (const sp of lv.spawns) { const id = inst.nextId++; if (ic.killed.has(id)) continue; const hp = ENEMIES[sp.type].hp * (g as any).hpMul(); inst.enemies.push({ id, type: sp.type, x: sp.x + .5, y: sp.y + .5, hp, maxHp: hp, alert: false, dead: false, home: { x: sp.x + .5, y: sp.y + .5 }, group: sp.group, faction: 'enemy', ctrlT: 0, stunT: 0, ...((sp as any).affix ? { affix: (sp as any).affix } : {}) } as any); }
    g.inst = inst; g.mode = 'run'; g.level = lv; g.enemies = inst.enemies.map(e => g.wrap(e)); g.projs = []; g.zones = g.envZones(); g.fx = []; g.target = null; g.cast = null; g.aim = null; g.channel = null; g.downed = false; g.revealing = false; g.px = lv.spawn.x; g.py = lv.spawn.y; g.seen = null as any;
    try { g.applyDoors(); } catch { } g.recompute(); g.hp = g.maxHp; g.heat = 0; g.overheated = false; g.abCd = [0, 0, 0]; g.dodgeCd = 0; g.musicSet('traversal'); g.emit('mode', 'run'); g.autoGrace(ic.graceMs / 1000); g.introBeat(true);
    { const n = Math.min(2, g.save.stims); inst.carried.stims = n; g.save.stims -= n; } // same as a solo run: stims come out of your own stock (and go back on exit)
    // every "leave" path is the soft, penalty-free party exit; loot you carry is banked to YOUR save on the way out
    const leave = () => { this.net.send({ t: 'leave_instance' }); this.exit('left', true); return true; };
    const A = (k: string, fn: any) => { this.saved[k] = (g as any)[k]; (g as any)[k] = fn; };
    for (const k of ['leaveInstance', 'townReturn', 'abandonInstance']) A(k, leave);
    A('returnToCheckpoint', () => { g.toast('Downed: a teammate can revive you (hold F), or the party wipes and restarts at the entrance.'); });
    // downing carries no solo penalties in a party dungeon (no broken gear, no repair bill, no credit loss)
    const origDown = Game.prototype.playerDown; A('playerDown', () => { const rb = g.save.repairBill, cr = g.inst!.carried.credits; origDown.call(g); g.save.repairBill = rb; g.inst!.broken = []; g.inst!.repairAdded = 0; g.inst!.carried.credits = cr; g.recompute(); g.hp = 0; });
    // damage dealt is relayed (batched); enemies we kill are CLAIMED; rewards wait for the server's `ekill` so each claim pays out once per player
    const origHurt = Game.prototype.hurtEnemy; A('hurtEnemy', (e: En, d: number, sx: number, sy: number, kn = 0) => { const before = e.hp; origHurt.call(g, e, d, sx, sy, kn); const id = this.netId(e); if (id >= 0 && !this.applying && e.faction === 'enemy') { const dealt = Math.max(0, before - Math.max(0, e.hp)); if (dealt > 0) { this.ic?.addDamage(id, dealt); this.hurtBy.add(id); } } });
    this.origKill = Game.prototype.grantKill.bind(g); A('grantKill', (e: En) => { const id = this.netId(e); if (id < 0) { this.origKill!(e); return; } if (!this.applying) { this.claimed.set(id, e); this.ic?.claimKill(id); } });
    A('grantClear', (e: En) => { this.pendingClear = e; });
    g.toast(`Party dungeon: ${dungeonOf(ic.dungeon).name}. Enemy HP x${ic.hpMul.toFixed(2)}. Hold F near a downed teammate to revive. G pings.`);
    this.sendProfile(); this.onEnter?.();
  }
  exit(reason: string, local: boolean) {
    const g = this.g; if (!this.active) return; this.active = false; const inst = g.inst;
    for (const k of Object.keys(this.saved)) { if (this.saved[k] === undefined) delete (g as any)[k]; else (g as any)[k] = this.saved[k]; } this.saved = {}; for (const k of ['leaveInstance', 'townReturn', 'abandonInstance', 'returnToCheckpoint', 'playerDown', 'hurtEnemy', 'grantKill', 'grantClear', 'hpMul']) if (Object.prototype.hasOwnProperty.call(g, k)) delete (g as any)[k];
    // bank what you carry (items, chips, credits, stims) into YOUR save; this is the same bookkeeping as a solo run, never touching a solo instance
    if (inst && inst.id.startsWith('net-')) { const keep = g.save.instance; (g.save as any).instance = inst; try { g.bankCarried(); } catch { } (g.save as any).instance = keep; }
    this.ic = null; this.origKill = null; g.inst = this.prevInst; this.prevInst = null; g.downed = false; g.enemies = []; g.channel = null;
    if (g.mode === 'run') g.enterTown(); g.recompute(); g.hp = g.maxHp; persist(g.save); if (!local) g.toast('Left the party dungeon (' + reason + ').'); this.onExit?.(reason);
  }
  /** the player's look for others to render: body variants + equipped cosmetics ids */
  look() { try { return { body: bodyOf(this.g.save) as any, cos: equippedCos(this.g.save).map(c => c.id), gear: encodeGear(gearFxOf(this.g.save)) }; } catch { return undefined; } }
  sendProfile() { const s = this.g.save as any; this.net.profile(this.net.o.name || 'Guest', Math.max(1, Math.min(60, s.level || 1)), this.look());  }
  // ---------- per-frame hook: the game's own update always runs (return false); this only does the network side, all non-blocking
  private hook(dtRaw: number): boolean {
    if (!this.active || !this.ic) return false; const g = this.g, ic = this.ic;
    if (g.mode !== 'run') { this.exit('returned', true); return false; } // Game moved us (cheat/menu): treat as leaving
    const dt = Math.min(dtRaw, .05); ic.setState(g.px, g.py, g.face, g.hp, g.maxHp, g.downed, !!g.moving, g.mode === 'run' && g.atkCd > .3);
    this.flagT -= dt; if (this.flagT <= 0) { this.flagT = .25; this.pollFlags(); }
    this.reviveLogic(dt); this.finishClear(); return false;
  }
  private pollFlags() { const f = this.g.inst!.flags as any; for (const k of SHARED_FLAGS) { const v = f[k]; if (v && this.flagSeen[k] !== v) { this.flagSeen[k] = v; this.ic!.setFlag(k, v); } } }
  /** hold F next to a downed teammate for 2.5 s: pivotal event, the server validates range and state */
  private reviveLogic(dt: number) {
    const g = this.g, ic = this.ic!; if (!this.reviveHeld || g.downed) { this.holdT = 0; this.holdId = ''; return; }
    const t = (ic.players.sample(performance.now()) as any[]).find(p => p.down && Math.hypot(p.x - g.px, p.y - g.py) < REVIVE_REACH); if (!t) { this.holdT = 0; this.holdId = ''; return; }
    if (t.id !== this.holdId) { this.holdId = t.id; this.holdT = 0; } this.holdT += dt; if (this.holdT >= REVIVE_HOLD) { this.holdT = 0; ic.revive(t.id); }
  }
  // ---------- teammates' pivotal events
  private onEdmg(m: any) { if (!this.active) return; for (const [id, a] of m.d as [number, number][]) { const e = this.findEnemy(id); if (!e || e.faction !== 'enemy') continue; e.hp = Math.max(1, e.hp - a); this.g.popup(e.x, e.y - .3, String(Math.round(a)), '#9a9a9a'); } }
  private onFlag(m: any) { if (!this.active) return; const f = this.g.inst!.flags as any; if (m.k === 'bossSpawned') return; f[m.k] = m.v; this.flagSeen[m.k] = m.v; if (DOOR_FLAGS.has(m.k)) { try { this.g.applyDoors(); } catch { } this.g.toast('A teammate opened the way.'); } }
  /** server-confirmed kill (first claim won): the enemy dies on every client, and each participant rolls their own rewards */
  private onEkill(m: any) {
    if (!this.active || !this.origKill) return; const g = this.g, id = m.id as number; let e = this.claimed.get(id), part = !!e; this.claimed.delete(id);
    if (!e) { e = this.findEnemy(id); if (!e) { if (id === 0) { const f = g.inst!.flags as any; f.bossDead = true; f.completed = true; g.toast('Your party defeated the boss.'); } return; } part = this.hurtBy.has(id) || Math.hypot(e.x - g.px, e.y - g.py) <= PARTICIPATE_R || (id === 0 && g.zoneAt(g.px, g.py) === 'boss'); this.applying = true; try { g.killEnemy(e); } finally { this.applying = false; } }
    if (part) { this.origKill(e); if (id === 0) this.pendingClear = e; } else if (id === 0) this.pendingClear = null;
    this.hurtBy.delete(id);
  }
  /** per-player clear rewards (XP + contract events), granted once, only to participants; no daily lockout is consumed by party runs */
  private finishClear() { const e = this.pendingClear, g = this.g, inst = g.inst; if (!e || !inst || !this.ic?.flags.bossDead) return; this.pendingClear = null; if ((inst as any)._cg) return; (inst as any)._cg = true; inst.flags.completed = true; inst.flags.rewardsGranted = true; g.addXp(g.dd.clearXp); g.note('boss_defeated', e.type); g.note('run_cleared', inst.flags.cond || 'none'); g.toast('PARTY CLEAR! Rewards are personal. Open the menu > Leave when ready.'); g.emit('boss-dead'); }
  private onRevived(m: any) { if (!this.active) return; const g = this.g; if (m.id === this.net.id && g.downed) { g.downed = false; g.hp = g.maxHp * .4; g.iframes = 1.5; g.clearTransients(); g.emit('revived', 'team'); g.toast('A teammate revived you.'); } else if (m.id !== this.net.id) g.toast('Teammate revived.'); }
  private onWipe() {
    if (!this.active || !this.ic) return; const g = this.g, sp = this.ic.level.spawn; g.downed = false; g.px = sp.x; g.py = sp.y; g.recompute(); g.hp = g.maxHp; g.heat = 0; g.overheated = false; g.iframes = 1.5; g.clearTransients(); g.resetBossIfAlive();
    for (const e of g.enemies) if (!e.dead && e.faction === 'enemy' && !ENEMIES[e.type].boss) { e.alert = false; e.hp = e.maxHp; e.x = e.home.x; e.y = e.home.y; e._rt.st = 'idle'; } g.zones = g.envZones(); g.toast('Party wiped: back at the entrance, enemies reset.');
  }
  // ---------- town presence
  private townTick() {
    const g = this.g, n = this.net; if (n.state !== 'online' || this.active) return;
    if (g.mode === 'town') { const key = g.townId; if (key !== this.lastTownKey) { this.lastTownKey = key; n.send({ t: 'town_join', town: key }); n.townPlayers.clear(); } n.send({ t: 'town_pos', x: +g.px.toFixed(2), y: +g.py.toFixed(2), face: +g.face.toFixed(2), moving: !!g.moving }); }
    else if (this.lastTownKey) { this.lastTownKey = ''; n.send({ t: 'town_leave' }); }
  }
  // ---------- rendering
  private items(items: { d: number; f: () => void }[]) {
    const g = this.g, n = this.net; if (n.state !== 'online') return; this.draw.beginFrame(); const me = { x: g.px, y: g.py }; const now = performance.now();
    if (this.active && this.ic) { for (const p of this.ic.players.sample(now) as any[]) items.push({ d: p.x + p.y, f: () => this.draw.draw(p as RemoteP, me, true) }); for (const m of n.marks) items.push({ d: 1e4, f: () => this.draw.mark(m) }); }
    else if (g.mode === 'town') for (const p of n.townPlayers.sample(now) as any[]) items.push({ d: p.x + p.y, f: () => this.draw.draw(p as RemoteP, me, false) });
  }
}
