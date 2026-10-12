// PartyWorld: the authoritative multiplayer instance, built on the REAL single-player combat code (src/sim.ts Game, abilities engine,
// heat model, boss/mob mechanics, loot tables). No second combat model exists any more:
//   * every party member is a headless Game instance (their own validated build/save, heat, cooldowns, stims, dodge, abilities, loot RNG)
//   * the enemy world (enemies, enemy projectiles/zones, boss state, doors, puzzle flags) is shared and ticked once per step by an "AI" Game
//     whose target is re-aimed per enemy at the nearest player (hooks Game.bindTarget / Game.flowHook)
//   * rewards are INDIVIDUAL: each participant runs Game.grantKill / grantClear on their own host with their own RNG stream, save, pity timers.
// Runs in Node (server) and tests; no DOM. Deterministic for a given seed + input script (Math.random is swapped for seeded streams while a host runs).
import { Game, ISO } from '../sim';
import type { En } from '../sim';
import { dungeonOf } from '../content/dungeons';
import { ENEMIES, COMBAT, ITEM_BY_ID, STARTER_ABILITIES } from '../config';
import { LAYOUT_V, mkInst } from '../state';
import type { InstanceState } from '../state';
import { abxTick, abxPlayerSpeed } from '../abilities/engine';
import { clearBossAdds } from '../content/mechanics';
import { tickZone, endZones } from '../content/zoneshape';
import { sanitizeProfile } from './profile';
import type { Profile } from './profile';
import { TICK_DT, partyHpMul, partyDmgMul, rng32, hash32, r2, clamp } from '../net/shared';
import type { InputMsg, PlayerView, EnemyView, DropView, SnapMsg, Look } from '../net/shared';

// Game persists to localStorage; a server has none and must never write anywhere
if (typeof (globalThis as any).localStorage === 'undefined') (globalThis as any).localStorage = { getItem: () => null, setItem: () => { }, removeItem: () => { }, clear: () => { }, key: () => null, length: 0 };
const REVIVE_TIME = 2.5, REVIVE_RANGE = 2.0, WIPE_DELAY = 3.0, MAX_QUEUE = 4, MAX_ACTS = 8, PARTICIPATE_R = 20;
const SHARED_FLAGS = ['gate1', 'lock2', 'passageSeen', 'controller', 'armory', 'cond', 'bossKey', 'bossRevealed', 'bossSpawned', 'bossDead', 'alarm', 'salvageForeman'] as const;
const SFX_OUT = /^(ab_|dodge|hurt|cooled|overheat|combo|windup|heal|coin|pickup|deny|down)/;

export type Act = { k: 'cast'; i: number; wx: number; wy: number } | { k: 'dodge' } | { k: 'vent' } | { k: 'stim' } | { k: 'use' } | { k: 'dlg'; i: number };
export interface PartyMember { id: string; name: string; lvl: number; look?: Look; profile?: Profile }
export interface PartyOpts { grace?: boolean | number; dmgMul?: number; seed?: number; dev?: boolean }
export interface GotEntry { kind: string; item?: string; chip?: string; amount: number; mfr?: string; k?: string; key?: string; id?: string; abAcq?: { total: number; dry: number } }

/** one party member: a real Game plus the network bookkeeping around it */
export class PHost {
  g!: Game; rng: () => number; q: InputMsg[] = []; acts: Act[] = []; held: InputMsg | null = null; heldTicks = 0; lastSeq = 0; applied = 0; rejected = 0;
  reviveT = 0; revivingBy = 0; priv: any[] = []; dlg: any[] | null = null; spd = COMBAT.playerSpeed; rejectedItems: string[] = []; spawnIdx = 0;
  sent = { credits: 0, items: new Set<string>(), chips: {} as Record<string, number>, stims: 0, xp: 0, rep: { HI: 0, PS: 0, MM: 0 } as Record<string, number>, cos: new Set<string>(), abTotal: 0 };
  got: GotEntry[] = []; lootRolls = 0;
  constructor(public id: string, public name: string, public lvl: number, public look: Look | undefined, seed: number) { this.rng = rng32(hash32(seed + ':host:' + id)); }
  get x() { return this.g.px; } get y() { return this.g.py; } get hp() { return this.g.hp; } get maxHp() { return this.g.maxHp; } get down() { return this.g.downed; }
  get drops() { return this.g.inst!.drops; } get face() { return this.g.face; }
}

export class PartyWorld {
  level; tick = 0; time = 0; hosts = new Map<string, PHost>(); enemies: En[] = []; kills = 0; total = 0; wipeT = 0; hpMul = 1; dmgMul = 1; nextId = 1;
  flags: any; ai: Game; rand: () => number; evq: any[] = []; stats = { pickupDenied: 0, inputsDropped: 0, lootRolls: 0 }; completed = false; private ann = new Set<number>(); private flowStore = new Map<string, (Int16Array | null)[]>();
  private tgt: PHost | null = null; private aiBase = { px: 0, py: 0 };
  constructor(public dungeon: string, public seed: number, members: PartyMember[], public opts: PartyOpts = {}) {
    const dd = dungeonOf(dungeon); this.level = dd.build(seed); this.rand = rng32(seed ^ 0x9e3779b9);
    this.hpMul = partyHpMul(members.length); this.dmgMul = partyDmgMul(members.length);
    this.flags = { gate1: false, lock2: false, passageSeen: false, controller: false, armory: false, cond: null, bossKey: null, bossRevealed: false, bossSpawned: false, bossDead: false, completed: false, rewardsGranted: false, alarm: false, salvageForeman: false };
    this.ai = this.makeAi();
    this.withRand(this.rand, () => {
      for (const sp of this.level.spawns) { const d = ENEMIES[sp.type]; if (!d || d.boss) continue; const e = this.ai.wrap({ id: this.nextId++, type: sp.type, x: sp.x + .5, y: sp.y + .5, hp: d.hp * this.ai.hpMul(), maxHp: d.hp * this.ai.hpMul(), alert: false, dead: false, home: { x: sp.x + .5, y: sp.y + .5 }, group: sp.group, faction: 'enemy', ctrlT: 0, stunT: 0, ...((sp as any).affix ? { affix: (sp as any).affix } : {}) } as any); this.enemies.push(e); }
    });
    this.ai.enemies = this.enemies; this.total = this.enemies.length + 1;
    members.forEach((m, i) => this.addPlayer(m, i));
    if (opts.grace) this.startGrace(typeof opts.grace === 'number' ? opts.grace : 5);
  }
  /** calm start for the whole party: one shared timer started with the world (seed/start event); any member's first action or moving away ends it for everyone */
  graceT = 0; private graceAt = { x: 0, y: 0 };
  startGrace(dur = 5) { this.graceT = dur; this.graceAt = { x: this.level.spawn.x, y: this.level.spawn.y }; for (const g of [this.ai, ...[...this.hosts.values()].map(h => h.g)]) { g.grace = { t: dur, x: this.graceAt.x, y: this.graceAt.y, acted: false, ext: true }; } for (const e of this.enemies) { e.alert = false; } this.evq.push({ e: 'grace', t: dur }); }
  endGrace(why: string) { if (!this.ai.grace) return; this.graceT = 0; this.ai.grace = null; for (const h of this.hosts.values()) h.g.grace = null; this.evq.push({ e: 'grace_end', why }); }
  get players() { return this.hosts; } get bossSpawned() { return !!this.flags.bossSpawned; } get bossDead() { return !!this.flags.bossDead; }
  private withRand<T>(r: () => number, fn: () => T): T { const o = Math.random; Math.random = r; try { return fn(); } finally { Math.random = o; } }

  // ---------------- construction ----------------
  private mkInstance(): InstanceState {
    const sp = this.level.spawn; const w = this;
    const inst: any = { id: 'inst-' + this.seed, dungeon: this.dungeon, layoutV: LAYOUT_V, createdAt: Date.now(), expiresAt: Date.now() + 864e5, seed: this.seed, enemies: [], drops: [], carried: { items: [], chips: {}, stims: 0, credits: 0 }, flags: { ...this.flags },
      checkpoint: { id: 1, x: sp.x, y: sp.y }, px: sp.x, py: sp.y, hp: 0, broken: [], protectedSlots: [], repairAdded: 0, xpEarned: 0, warned: true, kills: {}, claimed: [], elapsed: 0 };
    Object.defineProperty(inst, 'nextId', { get: () => w.nextId, set: (v: number) => { w.nextId = v; }, enumerable: true, configurable: true });
    return inst;
  }
  private bootGame(save: any, emit: (t: string, p?: any) => void): Game {
    const g = new Game(save, emit as any); const inst = this.mkInstance(); g.save.instance = inst; g.inst = inst; g.mode = 'run'; g.level = this.level; g.enemies = this.enemies; g.projs = []; g.zones = []; g.fx = []; g.target = null; g.cast = null; g.aim = null; g.channel = null; g.downed = false; g.revealing = false;
    (g as any).saveNow = () => { }; (g as any).hpMul = () => Game.prototype.hpMul.call(g) * this.hpMul; g.checkTownUnlocks = (() => []) as any;
    return g;
  }
  private makeAi(): Game {
    const ai = this.bootGame(sanitizeProfile({ level: 40 }).save, () => { }); ai.inst!.flags = this.flags; ai.zones = ai.envZones(); ai.downed = true;
    const w = this; const origOpp = Game.prototype.opponents;
    ai.opponents = function (f: 'enemy' | 'ally') { const base = origOpp.call(ai, f); if (f !== 'enemy') return base; const out: any[] = []; for (const h of w.hosts.values()) if (!h.g.downed) out.push({ x: h.g.px, y: h.g.py, r: COMBAT.playerRadius, hurt: (d: number, sx: number, sy: number) => w.hurtPlayer(h, d, sx, sy) }); return out.concat(base); };
    ai.hurtPlayer = (d: number, sx: number, sy: number) => { if (w.tgt) w.hurtPlayer(w.tgt, d, sx, sy); };
    ai.bindTarget = (e: En) => w.bind(e);
    ai.flowHook = () => w.flows();
    ai.updateZones = (dt: number) => w.updateZones(dt);
    return ai;
  }
  addPlayer(m: PartyMember, i = this.hosts.size) {
    const { save, rejected } = sanitizeProfile(m.profile ?? { level: m.lvl }, 60); const h = new PHost(m.id, m.name, clamp(Math.floor(save.level), 1, 60), m.look, this.seed); h.spawnIdx = i; h.rejectedItems = rejected;
    h.g = this.bootGame(save, (t, p) => this.onEmit(h, t, p)); const g = h.g; const sp = this.level.spawn, a = i * 1.7; g.px = sp.x + Math.cos(a) * .9; g.py = sp.y + Math.sin(a) * .9; if (g.circleHits(g.px, g.py, COMBAT.playerRadius)) { g.px = sp.x; g.py = sp.y; }
    g.recompute(); g.hp = g.maxHp; g.heat = 0; g.overheated = false; g.abCd = [0, 0, 0]; g.dodgeCd = 0; g.inst!.carried.stims = 2; g.inst!.checkpoint = { id: 1, x: sp.x, y: sp.y };
    g.updateWorldRun = () => { }; (g as any).grantKill = () => { };
    g.killEnemy = (e: En) => this.killEnemy(h, e); const hurt = Game.prototype.hurtEnemy; const pm = this.opts.dmgMul ?? 1; /* test/dev knob: multiplies PLAYER damage */ g.hurtEnemy = (e: En, d: number, sx: number, sy: number, k = 0) => { ((e as any)._by ||= new Set<string>()).add(h.id); hurt.call(g, e, d * pm, sx, sy, k); };
    g.onTeamRevive = () => this.teamRevive(h); (g as any)._cev = []; g.contractEvent = (k: string, key: string) => { (g as any)._cev.push([k, key]); };
    h.sent.stims = g.inst!.carried.stims; h.sent.rep = { ...g.save.rep }; h.sent.abTotal = g.save.abAcq?.total ?? 0; h.sent.cos = new Set(Object.keys(((g.save as any).cosmetics?.owned) || {}));
    this.hosts.set(m.id, h); this.syncIn(h); return h;
  }
  removePlayer(id: string) { this.hosts.delete(id); }

  // ---------------- shared state plumbing ----------------
  private syncIn(h: PHost) { h.g.enemies = this.enemies; const f = h.g.inst!.flags as any; for (const k of SHARED_FLAGS) f[k] = this.flags[k]; h.g.revealing = this.ai.revealing; }
  private syncOut(h: PHost) { this.enemies = h.g.enemies; const f = h.g.inst!.flags as any; for (const k of SHARED_FLAGS) if (f[k] !== this.flags[k]) this.flags[k] = f[k]; if (this.flags.bossDead && !this.bossWorldDone) this.onBossWorldDead(); }
  private bossWorldDone = false;
  private onBossWorldDead() { this.bossWorldDone = true; this.ai.projs = []; this.ai.zones = this.ai.envZones(); clearBossAdds(this.ai); this.completed = true; this.evq.push({ e: 'complete' }); }
  /** run fn as host h: shared enemy array/flags in, host's own seeded RNG stream, shared state out */
  run<T>(h: PHost, fn: () => T): T { this.syncIn(h); try { return this.withRand(h.rng, fn); } finally { this.syncOut(h); } }

  private onEmit(h: PHost, t: string, p: any) {
    if (t === 'toast') { if (h.priv.length < 12) h.priv.push({ e: 'toast', s: String(p).slice(0, 140) }); }
    else if (t === 'dialog') { h.dlg = p.options || []; h.priv.push({ e: 'dialog', title: String(p.title || '').slice(0, 60), body: String(p.body || '').slice(0, 600), opts: (p.options || []).map((o: any) => String(o.label).slice(0, 40)) }); }
    else if (t === 'sfx' && SFX_OUT.test(String(p)) && h.priv.length < 12) h.priv.push({ e: 'sfx', n: String(p) });
    else if (t === 'down') { this.evq.push({ e: 'down', id: h.id }); }
    else if (t === 'revived') { this.evq.push({ e: 'revive', id: h.id }); }
    else if (t === 'prestigeDrop') { this.evq.push({ e: 'prestige', id: h.id, name: h.name, item: String(p?.name || '').slice(0, 60), kind: p?.kind }); }
    else if (t === 'cosmeticFound') h.got.push({ kind: 'cos', id: String(p), amount: 1 });
    else if (t === 'filtered' && h.priv.length < 12) h.priv.push({ e: 'toast', s: 'Loot filtered: ' + String(p) });
  }

  // ---------------- input ----------------
  input(id: string, m: InputMsg & { acts?: any[] }) {
    const h = this.hosts.get(id); if (!h || !m || typeof m.seq !== 'number') return;
    if (m.seq <= (h.q.length ? h.q[h.q.length - 1].seq : h.lastSeq)) { h.rejected++; return; }
    if (Array.isArray(m.acts)) for (const a of m.acts.slice(0, 4)) { const c = cleanAct(a); if (c && h.acts.length < MAX_ACTS) h.acts.push(c); }
    if (h.q.length >= MAX_QUEUE) { h.q.shift(); this.stats.inputsDropped++; }
    h.q.push({ t: 'input', seq: m.seq | 0, mx: clamp(+m.mx || 0, -2, 2), my: clamp(+m.my || 0, -2, 2), atk: !!m.atk, face: clamp(+m.face || 0, -7, 7), revive: !!m.revive });
  }
  private applyActs(h: PHost) {
    const g = h.g; const acts = h.acts; h.acts = [];
    for (const a of acts) this.run(h, () => {
      if (a.k === 'dlg') { const o = h.dlg?.[a.i]; h.dlg = null; if (o?.cb) o.cb(); return; }
      if (g.downed || this.ai.revealing && a.k !== 'use') return;
      if (a.k === 'cast') { if (g.cast) return; g.beginAim(a.i); if (g.aim) { g.updateAim(a.wx, a.wy, true); g.releaseAim(); } }
      else if (a.k === 'dodge') g.dodge(); else if (a.k === 'vent') g.ventNow(); else if (a.k === 'stim') g.useStim(); else if (a.k === 'use') { g.updatePrompt(); g.interact(); }
    });
  }

  // ---------------- enemy AI targeting ----------------
  private alive() { return [...this.hosts.values()].filter(h => !h.g.downed); }
  private flush() { const t = this.tgt; if (!t) return; const ai = this.ai, g = t.g;
    if (ai.px !== this.aiBase.px || ai.py !== this.aiBase.py) { const p = g.moveCircle(g.px, g.py, ai.px - this.aiBase.px, ai.py - this.aiBase.py, COMBAT.playerRadius); g.px = p.x; g.py = p.y; }
    if (ai.heat > 0) { g.heat = Math.min(COMBAT.heat.max, g.heat + ai.heat); ai.heat = 0; } if (ai.slowT > 0) { g.slowT = Math.max(g.slowT, ai.slowT); ai.slowT = 0; } if (ai.weaponOff > 0) { g.weaponOff = Math.max(g.weaponOff, ai.weaponOff); ai.weaponOff = 0; } this.tgt = null; }
  bind(e: En) {
    this.flush(); const ai = this.ai; let best: PHost | null = null, bd = 1e9;
    for (const h of this.alive()) { const d = Math.hypot(h.g.px - e.x, h.g.py - e.y) * (h.g.cloakT > 0 ? 3 : 1); if (d < bd) { bd = d; best = h; } }
    if (!best) { ai.downed = true; return; } this.tgt = best; ai.downed = false; ai.px = this.aiBase.px = best.g.px; ai.py = this.aiBase.py = best.g.py; ai.cloakT = best.g.cloakT; ai.iframes = best.g.iframes; ai.overheated = false;
    ai.flows = this.flowsOf(best.id); ai.flow = ai.flows[0] ?? null;
  }
  private flowsOf(id: string) { let f = this.flowStore.get(id); if (!f) { f = [null, null, null]; this.flowStore.set(id, f); } return f; }
  /** one flow field per player per class, refreshed on the same cadence as solo */
  flows() { const ai = this.ai; if (ai.flowT > 0) return; ai.flowT = .35; const need = [false, false, false]; for (const e of this.enemies) if (!e.dead && e.faction === 'enemy' && e.alert && !ENEMIES[e.type].static) need[ai.flowCls(ENEMIES[e.type].radius)] = true; need[0] = true;
    for (const h of this.alive()) { ai.px = h.g.px; ai.py = h.g.py; ai.flows = this.flowsOf(h.id); for (let c = 0; c < 3; c++) if (need[c]) ai.flowField(c); } }
  hurtPlayer(h: PHost, dmg: number, sx: number, sy: number) { const g = h.g; const hp0 = g.hp; this.run(h, () => { g.dmgSrc = this.ai.dmgSrc; g.hurtPlayer(dmg * this.dmgMul, sx, sy); }); if (g.hp < hp0) this.evq.push({ e: 'phit', id: h.id, d: Math.round(hp0 - g.hp) }); }
  private updateZones(dt: number) { const ai = this.ai; const hs = ai.revealing ? [] : this.alive(); const tg = hs.map(h => ({ px: h.g.px, py: h.g.py, g: h.g as any, hurt: (d: number, sx: number, sy: number) => this.hurtPlayer(h, d, sx, sy) })); for (const z of ai.zones) { ai.dmgSrc = (z as any).src || (z.env ? 'env' : 'zone'); tickZone(ai, z, dt, tg, COMBAT.heat.max, COMBAT.playerRadius); }
    const old = ai.zones; ai.zones = ai.zones.filter(z => z.t < z.life); if (old.length !== ai.zones.length) endZones(ai, old); const MAXZ = 40; let drop = ai.zones.filter(z => !z.env && !(z as any).kit).length - MAXZ; if (drop > 0) ai.zones = ai.zones.filter(z => z.env || (z as any).kit || drop-- <= 0); }

  // ---------------- rewards: individual by construction ----------------
  killEnemy(killer: PHost, e: En) {
    if (e.dead) return; const def = ENEMIES[e.type]; const by: Set<string> = (e as any)._by || new Set(); by.add(killer.id);
    // 1. world part once (death, fx, door unlock, boss flags) via the killer's real Game.killEnemy, rewards suppressed (grantKill is a no-op on hosts)
    this.run(killer, () => Game.prototype.killEnemy.call(killer.g, e));
    this.kills++; if (e.faction === 'ally') return;
    // 2. participation: dealt damage to it, or was alive within PARTICIPATE_R tiles (boss: or inside the boss zone)
    const part: PHost[] = []; for (const h of this.hosts.values()) { const g = h.g; const near = !g.downed && (Math.hypot(g.px - e.x, g.py - e.y) <= PARTICIPATE_R || (!!def.boss && g.zoneAt(g.px, g.py) === 'boss')); if (by.has(h.id) || near) part.push(h); }
    // 3. each participant gets THEIR OWN xp / rep / contracts / loot / cosmetic / ability rolls on their own save + rng stream
    for (const h of part) { this.stats.lootRolls++; h.lootRolls++; h.g.partyN = this.hosts.size; h.g.contributed = by.has(h.id) || (!!def.boss && h.g.zoneAt(h.g.px, h.g.py) === 'boss'); /* prestige roll: scaled by party size, no credit for proximity alone (docs/LOOT_ECONOMY.md) */ this.run(h, () => { Game.prototype.grantKill.call(h.g, e); if (def.boss && h !== killer) h.g.onBossDead(e); }); }
    // contract credit rides on contractEvent: forwarded to each client (its own save advances) by collect()
  }
  private teamRevive(by: PHost) { for (const h of this.hosts.values()) if (h !== by && h.g.downed && Math.hypot(h.g.px - by.g.px, h.g.py - by.g.py) <= 4.5) this.revive(h, by, .3); }
  private revive(d: PHost, by: PHost | null, frac: number) { const g = d.g; g.downed = false; g.hp = Math.ceil(g.maxHp * frac); g.iframes = 1.5; g.clearTransients(); d.reviveT = 0; this.evq.push({ e: 'revive', id: d.id, by: by?.id }); }

  // ---------------- step ----------------
  step() {
    const dt = TICK_DT; this.tick++; this.time += dt; const ai = this.ai;
    if (this.graceT > 0) { this.graceT -= dt; let why = ''; for (const h of this.hosts.values()) { if (h.g.grace?.acted) why = 'action'; else if (Math.hypot(h.g.px - this.graceAt.x, h.g.py - this.graceAt.y) > 8) why = why || 'moved'; } if (!why && this.graceT <= 0) why = 'time'; if (why) this.endGrace(why); }
    for (const h of this.hosts.values()) {
      const g = h.g; let inp = h.q.shift() || null; if (inp) { h.lastSeq = inp.seq; h.applied++; h.held = inp; h.heldTicks = 0; } else if (h.held && h.heldTicks < 3) { inp = h.held; h.heldTicks++; } else inp = null;
      // screen-space input for the real movement code: invert ISO.vec so world direction (mx,my) comes out unchanged
      const m = inp ? Math.min(1, Math.hypot(inp.mx, inp.my)) : 0; if (m > .01 && inp) { const vx = inp.mx - inp.my, vy = (inp.mx + inp.my) / 2; const l = Math.hypot(vx, vy) || 1; g.setMove(vx / l * m, vy / l * m); } else g.setMove(0, 0);
      this.applyActs(h);
      this.run(h, () => {
        g.time += dt; g.inst!.elapsed += dt; g.updatePlayer(dt); abxTick(g, dt); g.updateProjs(dt); g.autoPickup(); g.updateRun(dt); g.updateFx(dt);
        if (g.downed && g.build.passives.includes('defib') && g.defibCd <= 0 && g.downT > .6) g.defibInPlace();
      });
      const st = g.stat(); h.spd = COMBAT.playerSpeed * st.move * (g.overheated ? COMBAT.heat.overheatSpeedMult : 1) * abxPlayerSpeed(g);
      h.revivingBy = 0;
    }
    // revive: a living teammate holding revive near a downed player
    for (const d of this.hosts.values()) { if (!d.g.downed) continue; let who: PHost | null = null; for (const o of this.hosts.values()) { if (o.g.downed || o === d) continue; if (o.held?.revive && Math.hypot(o.g.px - d.g.px, o.g.py - d.g.py) <= REVIVE_RANGE) { who = o; break; } }
      if (who) { d.reviveT += dt; if (d.reviveT >= REVIVE_TIME) this.revive(d, who, .4); } else d.reviveT = Math.max(0, d.reviveT - dt * 2); }
    // ---- shared enemy world, once
    this.withRand(this.rand, () => {
      ai.enemies = this.enemies; ai.time += dt; ai.inst!.elapsed += dt; ai.downed = true; ai.revealing = ai.revealing; this.tgt = null;
      ai.updateEnemies(dt); this.flush(); ai.downed = true; ai.updateProjs(dt); ai.updateZones(dt);
      let inBoss = false; for (const h of this.alive()) if (h.g.zoneAt(h.g.px, h.g.py) === 'boss') inBoss = true;
      ai.updateWorldRun(dt, inBoss); this.enemies = ai.enemies;
    });
    for (const h of this.hosts.values()) { h.g.revealing = ai.revealing; if (this.flags.bossDead !== h.g.inst!.flags.bossDead) this.syncIn(h); }
    for (const e of this.enemies) if (e.dead && !this.ann.has(e.id)) { this.ann.add(e.id); this.evq.push({ e: 'edead', id: e.id }); }
    if (this.flags.bossSpawned && !(this as any)._bossAnn) { (this as any)._bossAnn = 1; this.evq.push({ e: 'boss', type: this.flags.bossKey }); }
    if (this.flags.bossDead && !this.bossWorldDone) this.onBossWorldDead();
    // ---- wipe / respawn
    if (this.hosts.size && [...this.hosts.values()].every(h => h.g.downed)) { this.wipeT += dt; if (this.wipeT >= WIPE_DELAY) this.wipe(); } else this.wipeT = 0;
    // fx / ability vfx emitted this tick
    for (const h of this.hosts.values()) this.harvestFx(h);
  }
  private fxOut: { x: number; y: number; id: string; fx: any[]; vev: any[] }[] = [];
  private harvestFx(h: PHost) { const g = h.g; const fx: any[] = []; for (const f of g.fx as any[]) { if (f._s) continue; f._s = 1; if (fx.length < 16 && f.t < .05) fx.push([f.kind, r2(f.x), r2(f.y), r2(f.life), f.text, f.c, f.r]); } const vev = g.vev.splice(0, g.vev.length).slice(-16).map((v: any) => ({ ...v })); if (fx.length || vev.length) this.fxOut.push({ x: g.px, y: g.py, id: h.id, fx, vev }); }
  private wipe() { const sp = this.level.spawn; let i = 0; for (const h of this.hosts.values()) { const g = h.g; g.inst!.checkpoint = { id: 1, x: sp.x, y: sp.y }; this.run(h, () => g.returnToCheckpoint()); g.px = sp.x + Math.cos(i * 1.7) * .9; g.py = sp.y + Math.sin(i * 1.7) * .9; if (g.circleHits(g.px, g.py, COMBAT.playerRadius)) { g.px = sp.x; g.py = sp.y; } i++; h.q = []; h.held = null; }
    for (const e of this.enemies) if (!e.dead && e.faction === 'enemy' && !ENEMIES[e.type].boss) { e.alert = false; e.hp = e.maxHp; e.x = e.home.x; e.y = e.home.y; e._rt.st = 'idle'; } this.ai.projs = []; this.ai.zones = this.ai.envZones(); this.wipeT = 0; this.evq.push({ e: 'wipe' }); }
  /** dev/test only: solve the dungeon puzzles (all gates open, controller secured) and put a member at the boss reveal point */
  devBoss(id: string, jitter = 0) { for (const k of ['gate1', 'lock2', 'controller']) this.flags[k] = true; for (const d of this.level.doors) this.ai.openDoor(d.id); for (const h of this.hosts.values()) this.syncIn(h); const p = this.ai.revealPoint(); this.devTeleport(id, p.x + jitter, p.y); }
  /** dev/test only: Game's own debug switches (god, oneShot) for one member */
  devCheat(id: string, c: { god?: boolean; oneShot?: boolean }) { const h = this.hosts.get(id); if (h) Object.assign(h.g.dbg, { god: !!c.god, oneShot: !!c.oneShot }); }
  devTeleport(id: string, x: number, y: number) { const h = this.hosts.get(id); if (h) { h.g.px = x; h.g.py = y; } }

  // ---------------- output ----------------
  view(h: PHost): PlayerView { const g = h.g; return { id: h.id, name: h.name, x: r2(g.px), y: r2(g.py), face: r2(g.face), hp: Math.round(g.hp), maxHp: Math.round(g.maxHp), down: g.downed, moving: g.moving, atk: g.atkCd > 0 && g.atkCd > .3, look: h.look, lvl: h.lvl }; }
  snapshot(id: string, ev?: any[]): SnapMsg | null {
    const me = this.hosts.get(id); if (!me) return null; const g = me.g; const R2 = 30 * 30;
    const enemies: EnemyView[] = []; for (const e of this.enemies) { if (e.dead) continue; if ((e.x - g.px) ** 2 + (e.y - g.py) ** 2 > R2 && !ENEMIES[e.type].boss) continue; const rt = e._rt; if (rt.reveal > 0 && (e.x - g.px) ** 2 + (e.y - g.py) ** 2 > R2) continue;
      enemies.push({ id: e.id, type: e.type, x: r2(e.x), y: r2(e.y), hp: Math.round(e.hp), maxHp: Math.round(e.maxHp), face: r2(rt.ang || 0), boss: ENEMIES[e.type].boss ? true : undefined, atk: rt.st === 'tele' || undefined, ally: e.faction === 'ally' || undefined, sh: rt.shield?.hp > 0 ? Math.round(rt.shield.hp) : undefined, rv: rt.reveal > 0 || undefined, aff: (e as any).affix } as any); }
    const players: PlayerView[] = []; for (const h of this.hosts.values()) if (h !== me) players.push(this.view(h));
    const drops: DropView[] = me.g.inst!.drops.map(d => ({ id: d.id, x: r2(d.x), y: r2(d.y), kind: d.kind, item: d.inst?.def, chip: d.chip, amount: d.amount }));
    const evs = [...(ev || [])]; for (const f of this.fxOut) if ((f.x - g.px) ** 2 + (f.y - g.py) ** 2 < R2 && f.id !== id) evs.push({ e: 'fx', id: f.id, fx: f.fx, vev: f.vev });
    const mine = this.fxOut.find(f => f.id === id); if (mine) evs.push({ e: 'fx', id, fx: mine.fx, vev: mine.vev, own: 1 }); if (me.priv.length) { evs.push(...me.priv.map(p => ({ ...p, to: id }))); me.priv = []; }
    const inst = g.inst!;
    const you = { ...this.view(me), heat: Math.round(g.heat * 10) / 10, oh: g.overheated, cd: g.abCd.map((c: number) => r2(Math.max(0, c))), dcd: r2(Math.max(0, g.dodgeCd)), vcd: r2(Math.max(0, g.ventCd)), stims: inst.carried.stims, spd: r2(me.spd), ab: g.build.abilities, cast: g.cast ? { i: g.cast.idx, t: r2(g.cast.t), w: g.cast.ab.windup } : null, rv: r2(me.reviveT), prompt: g.prompt?.id ?? null, ch: g.channel ? r2(g.channel.t / g.channel.dur) : null, bro: inst.broken.length };
    return { t: 'snap', tick: this.tick, ack: me.lastSeq, you, players, enemies, drops, flags: { bossSpawned: this.flags.bossSpawned, bossDead: this.flags.bossDead, completed: this.completed, kills: this.kills, total: this.total, wipeT: r2(this.wipeT), gate1: this.flags.gate1, lock2: this.flags.lock2, controller: this.flags.controller, bossKey: this.flags.bossKey, cond: this.flags.cond }, ev: evs.length ? evs : undefined } as any;
  }
  drainEvents() { const e = this.evq; this.evq = []; return e; }
  /** call after every snapshot broadcast */
  endTick() { this.fxOut = []; }
  tryPickup(pid: string, dropId: number): boolean { for (const o of this.hosts.values()) { if (o.g.inst!.drops.some(d => d.id === dropId) && o.id !== pid) { this.stats.pickupDenied++; return false; } } return false; /* pickup is automatic server-side (Game.autoPickup) */ }
  /** what this player gained since the last call: items/chips/credits/stims plus xp, rep, contract events, cosmetics, pity (all individual) */
  takeLoot(id: string): GotEntry[] | null {
    const h = this.hosts.get(id); if (!h) return null; const g = h.g, inst = g.inst!, c = inst.carried, s = h.sent; const out: GotEntry[] = h.got; h.got = [];
    if (c.credits !== s.credits) { out.push({ kind: 'credits', amount: c.credits - s.credits }); s.credits = c.credits; }
    for (const it of c.items) if (!s.items.has(it.uid)) { s.items.add(it.uid); out.push({ kind: 'item', item: it.def, amount: 1 }); }
    for (const [k, v] of Object.entries(c.chips)) { const d = (v || 0) - (s.chips[k] || 0); if (d > 0) out.push({ kind: 'chip', chip: k, amount: d }); s.chips[k] = v || 0; }
    if (c.stims > s.stims) out.push({ kind: 'stim', amount: c.stims - s.stims }); s.stims = c.stims;
    if (inst.xpEarned > s.xp) { out.push({ kind: 'xp', amount: Math.round((inst.xpEarned - s.xp) * 100) / 100 }); s.xp = inst.xpEarned; }
    for (const m of ['HI', 'PS', 'MM'] as const) { const d = g.save.rep[m] - s.rep[m]; if (d) { out.push({ kind: 'rep', mfr: m, amount: d }); s.rep[m] = g.save.rep[m]; } }
    const ct = (g as any)._cev as [string, string][] | undefined; if (ct) { for (const [k, key] of ct) out.push({ kind: 'cev', k, key, amount: 1 }); ct.length = 0; }
    const aq = g.save.abAcq; if (aq && aq.total !== s.abTotal) { s.abTotal = aq.total; out.push({ kind: 'pity', amount: 0, abAcq: { ...aq } }); }
    return out.length ? out : null;
  }
}
function cleanAct(a: any): Act | null {
  if (!a || typeof a !== 'object') return null;
  switch (a.k) {
    case 'cast': { const i = a.i | 0; const wx = +a.wx, wy = +a.wy; if (i < 0 || i > 2 || !Number.isFinite(wx) || !Number.isFinite(wy) || Math.abs(wx) > 1e4 || Math.abs(wy) > 1e4) return null; return { k: 'cast', i, wx, wy }; }
    case 'dodge': case 'vent': case 'stim': case 'use': return { k: a.k };
    case 'dlg': { const i = a.i | 0; return i >= 0 && i < 8 ? { k: 'dlg', i } : null; }
  }
  return null;
}
void STARTER_ABILITIES; void ITEM_BY_ID; void mkInst; void ISO;
