// Headless authoritative party-instance simulation (phase 1). Runs on the server (Node) and in tests; no DOM.
// It reuses the real, seeded dungeon generators (dungeonOf(id).build(seed)) and the real enemy/loot data tables, but is a
// deliberately small combat model (see docs/MULTIPLAYER.md "what is stubbed"): the single-player Game stays the source of
// truth for solo play and is NOT modified to run on the server in this phase.
import { dungeonOf } from '../content/dungeons';
import { ENEMIES, ENEMY_DMG, LOOT, COMBAT, ITEM_BY_ID } from '../config';
import type { Level } from '../level';
import { TICK_DT, InputMsg, PlayerView, EnemyView, DropView, SnapMsg, Look, partyHpMul, partyDmgMul, openAllDoors, stepPlayer, moveCircle, rng32, hash32, r2, clamp } from './shared';

export interface SimDrop extends DropView { owner: string }
interface SPlayer { id: string; name: string; lvl: number; look?: Look; x: number; y: number; face: number; hp: number; maxHp: number; down: boolean; moving: boolean; atkFx: number; atkCd: number; reviveT: number; lastSeq: number; q: InputMsg[]; held: InputMsg | null; heldTicks: number; kills: number; drops: SimDrop[]; got: { kind: string; item?: string; chip?: string; amount: number }[]; rejected: number; revivingBy: number; applied: number }
interface SEnemy { id: number; type: string; x: number; y: number; hx: number; hy: number; hp: number; maxHp: number; face: number; alert: boolean; atkCd: number; wind: number; windKind: string; dead: boolean; boss: boolean; elite: boolean; spawnT: number }
export interface SimOpts { dmgMul?: number; seed?: number; dev?: boolean }

const PLAYER_ATK_RANGE = 3.2, PLAYER_ATK_CD = .5, REVIVE_TIME = 2.5, REVIVE_RANGE = 2.0, WIPE_DELAY = 3.0, MAX_QUEUE = 4;
export const playerMaxHp = (lvl: number) => 100 + 8 * clamp(Math.floor(lvl) || 1, 1, 50);
export const playerDmg = (lvl: number) => 14 + 1.4 * clamp(Math.floor(lvl) || 1, 1, 50);

export class InstanceSim {
  level: Level; tick = 0; time = 0; players = new Map<string, SPlayer>(); enemies: SEnemy[] = []; nextId = 1; nextDrop = 1; kills = 0; total = 0;
  bossSpawned = false; bossDead = false; completed = false; wipeT = 0; hpMul = 1; dmgMul = 1; rand: () => number; evq: any[] = []; stats = { pickupDenied: 0, inputsDropped: 0, lootRolls: 0 };
  constructor(public dungeon: string, public seed: number, members: { id: string; name: string; lvl: number; look?: Look }[], public opts: SimOpts = {}) {
    const dd = dungeonOf(dungeon); this.level = dd.build(seed); openAllDoors(this.level); this.rand = rng32(seed ^ 0x9e3779b9);
    this.hpMul = partyHpMul(members.length); this.dmgMul = partyDmgMul(members.length);
    for (const sp of this.level.spawns) { const d = ENEMIES[sp.type]; if (!d || d.boss) continue; const hp = d.hp * this.hpMul; this.enemies.push({ id: this.nextId++, type: sp.type, x: sp.x + .5, y: sp.y + .5, hx: sp.x + .5, hy: sp.y + .5, hp, maxHp: hp, face: 0, alert: false, atkCd: 1, wind: 0, windKind: '', dead: false, boss: false, elite: !!d.elite, spawnT: 0 }); }
    this.total = this.enemies.length + 1;
    members.forEach((m, i) => this.addPlayer(m, i));
  }
  addPlayer(m: { id: string; name: string; lvl: number; look?: Look }, i = this.players.size) {
    const sp = this.level.spawn; const a = i * 1.7; const lvl = clamp(Math.floor(m.lvl) || 1, 1, 50); const maxHp = playerMaxHp(lvl);
    const p: SPlayer = { id: m.id, name: m.name, lvl, look: m.look, x: sp.x + Math.cos(a) * .9, y: sp.y + Math.sin(a) * .9, face: 0, hp: maxHp, maxHp, down: false, moving: false, atkFx: 0, atkCd: 0, reviveT: 0, lastSeq: 0, q: [], held: null, heldTicks: 0, kills: 0, drops: [], got: [], rejected: 0, revivingBy: 0, applied: 0 };
    if (circleBad(this.level, p.x, p.y)) { p.x = sp.x; p.y = sp.y; } this.players.set(m.id, p); return p;
  }
  removePlayer(id: string) { this.players.delete(id); }
  /** queue a client input (server never trusts values: clamped, rate limited by queue length) */
  input(id: string, m: InputMsg) {
    const p = this.players.get(id); if (!p || !m || typeof m.seq !== 'number') return;
    if (m.seq <= (p.q.length ? p.q[p.q.length - 1].seq : p.lastSeq)) { p.rejected++; return; } // stale / replayed seq
    if (p.q.length >= MAX_QUEUE) { p.q.shift(); this.stats.inputsDropped++; }
    p.q.push({ t: 'input', seq: m.seq | 0, mx: clamp(+m.mx || 0, -2, 2), my: clamp(+m.my || 0, -2, 2), atk: !!m.atk, face: clamp(+m.face || 0, -7, 7), revive: !!m.revive });
  }
  private alivePlayers() { return [...this.players.values()].filter(p => !p.down); }
  private nearest(x: number, y: number, list: SPlayer[]) { let b: SPlayer | null = null, bd = 1e9; for (const p of list) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; b = p; } } return { p: b, d: Math.sqrt(bd) }; }
  private spawnBoss() { const dd = dungeonOf(this.dungeon); const key = dd.defaultBoss; const d = ENEMIES[key]; if (!d) return; this.bossSpawned = true; const bs = this.level.bossSpawn; const hp = d.hp * this.hpMul;
    this.enemies.push({ id: this.nextId++, type: key, x: bs.x, y: bs.y, hx: bs.x, hy: bs.y, hp, maxHp: hp, face: Math.PI, alert: true, atkCd: 2, wind: 0, windKind: '', dead: false, boss: true, elite: true, spawnT: this.time }); this.evq.push({ e: 'boss', type: key }); }
  step() {
    const dt = TICK_DT; this.tick++; this.time += dt; const lv = this.level; const dmgMul = this.opts.dmgMul ?? 1;
    // ---- players
    for (const p of this.players.values()) {
      p.atkFx = Math.max(0, p.atkFx - dt); if (p.atkCd > 0) p.atkCd -= dt;
      let inp = p.q.shift() || null; if (inp) { p.lastSeq = inp.seq; p.applied++; p.held = inp; p.heldTicks = 0; } else if (p.held && p.heldTicks < 3) { inp = p.held; p.heldTicks++; } else inp = null; // tolerate up to 150 ms of lost/late input by holding the last one
      if (p.down) { p.moving = false; continue; }
      if (inp) { const px = p.x, py = p.y; stepPlayer(lv, p, inp.mx, inp.my, dt); p.moving = Math.hypot(p.x - px, p.y - py) > .01; if (p.moving) p.face = Math.atan2(inp.my, inp.mx); }
      else p.moving = false;
      p.revivingBy = 0;
      if (inp?.atk && p.atkCd <= 0) { let t: SEnemy | null = null, bd = PLAYER_ATK_RANGE; for (const e of this.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - p.y) - ENEMIES[e.type].radius; if (d < bd) { bd = d; t = e; } }
        if (t) { p.atkCd = PLAYER_ATK_CD; p.atkFx = .25; p.face = Math.atan2(t.y - p.y, t.x - p.x); this.hurtEnemy(t, playerDmg(p.lvl) * dmgMul, p); } }
    }
    // revive: a living teammate holding revive near a downed player
    for (const d of this.players.values()) { if (!d.down) continue; let who: SPlayer | null = null; for (const o of this.players.values()) { if (o.down || o === d) continue; const inp = o.held; if (inp?.revive && Math.hypot(o.x - d.x, o.y - d.y) <= REVIVE_RANGE) { who = o; break; } }
      if (who) { d.reviveT += dt; if (d.reviveT >= REVIVE_TIME) { d.down = false; d.hp = Math.ceil(d.maxHp * .4); d.reviveT = 0; this.evq.push({ e: 'revive', id: d.id, by: who.id }); } } else d.reviveT = Math.max(0, d.reviveT - dt * 2); }
    // boss reveal
    if (!this.bossSpawned && !this.bossDead) { const bs = this.level.bossSpawn; for (const p of this.players.values()) if (!p.down && Math.hypot(p.x - bs.x, p.y - bs.y) < 15) { this.spawnBoss(); break; } }
    // ---- enemies
    const alive = this.alivePlayers();
    for (const e of this.enemies) {
      if (e.dead) continue; const def = ENEMIES[e.type]; const { p: tgt, d } = this.nearest(e.x, e.y, alive);
      if (e.atkCd > 0) e.atkCd -= dt;
      if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0) this.enemyStrike(e, def, alive); continue; }
      if (!e.alert && tgt && d < def.aggro) e.alert = true; if (e.alert && !tgt && !e.boss) { e.alert = false; }
      if (!e.alert || !tgt) { if (!e.boss && Math.hypot(e.hx - e.x, e.hy - e.y) > .5) this.chase(e, e.hx, e.hy, def.speed * .6, dt); continue; }
      const reach = def.radius + COMBAT.playerRadius + (def.ranged ? 6 : .9);
      if (d > reach && !def.static) this.chase(e, tgt.x, tgt.y, def.speed, dt); else if (!def.static && def.ranged && d < 3.5) this.chase(e, e.x * 2 - tgt.x, e.y * 2 - tgt.y, def.speed * .7, dt);
      e.face = Math.atan2(tgt.y - e.y, tgt.x - e.x);
      if (d <= reach && e.atkCd <= 0) { e.wind = e.boss ? .8 : .35; e.windKind = e.boss && this.rand() < .5 ? 'slam' : 'hit'; e.atkCd = e.boss ? 3 : def.ranged ? 1.8 : 1.2; this.evq.push({ e: 'wind', id: e.id, k: e.windKind }); }
    }
    // ---- wipe / respawn
    if (this.players.size && ![...this.players.values()].some(p => !p.down)) { this.wipeT += dt; if (this.wipeT >= WIPE_DELAY) this.wipe(); } else this.wipeT = 0;
    // ---- loot pickup (instanced: only the owner can collect, server decides)
    for (const p of this.players.values()) { if (p.down) continue; for (let i = p.drops.length - 1; i >= 0; i--) { const dr = p.drops[i]; if (Math.hypot(dr.x - p.x, dr.y - p.y) <= COMBAT.pickupRadius) { p.drops.splice(i, 1); p.got.push({ kind: dr.kind, item: dr.item, chip: dr.chip, amount: dr.amount }); } } }
    if (this.bossDead && !this.completed) { this.completed = true; this.evq.push({ e: 'complete' }); }
  }
  /** a client asked to pick up an id it may not own */
  tryPickup(pid: string, dropId: number): boolean { for (const o of this.players.values()) { const i = o.drops.findIndex(d => d.id === dropId); if (i >= 0) { if (o.id !== pid) { this.stats.pickupDenied++; return false; } const p = o, dr = o.drops[i]; if (!p.down && Math.hypot(dr.x - p.x, dr.y - p.y) <= COMBAT.pickupRadius + 1) { p.drops.splice(i, 1); p.got.push({ kind: dr.kind, item: dr.item, chip: dr.chip, amount: dr.amount }); return true; } } } return false; }
  private chase(e: SEnemy, tx: number, ty: number, speed: number, dt: number) { const dx = tx - e.x, dy = ty - e.y; const l = Math.hypot(dx, dy) || 1; const r = ENEMIES[e.type].radius * .85; let q = moveCircle(this.level, e.x, e.y, dx / l * speed * dt, dy / l * speed * dt, r);
    if (q.x === e.x && q.y === e.y) { const s = (e.id & 1) ? 1 : -1; q = moveCircle(this.level, e.x, e.y, -dy / l * speed * dt * s, dx / l * speed * dt * s, r); } e.x = q.x; e.y = q.y; }
  private enemyStrike(e: SEnemy, def: any, alive: SPlayer[]) {
    const base = (ENEMY_DMG[def.attacks?.[0]] ?? 10) * (def.dmgMul ?? 1) * this.dmgMul * .6;
    if (e.windKind === 'slam') { for (const p of alive) if (Math.hypot(p.x - e.x, p.y - e.y) <= 3.4) this.hurtPlayer(p, base * 1.3); this.evq.push({ e: 'slam', id: e.id }); return; }
    const reach = def.radius + COMBAT.playerRadius + (def.ranged ? 7 : 1.2); const { p, d } = this.nearest(e.x, e.y, alive); if (p && d <= reach) { this.hurtPlayer(p, base); if (def.ranged) this.evq.push({ e: 'shot', id: e.id, to: p.id }); }
  }
  hurtPlayer(p: SPlayer, dmg: number) { if (p.down) return; p.hp -= dmg; this.evq.push({ e: 'phit', id: p.id, d: Math.round(dmg) }); if (p.hp <= 0) { p.hp = 0; p.down = true; p.reviveT = 0; this.evq.push({ e: 'down', id: p.id }); } }
  hurtEnemy(e: SEnemy, dmg: number, by: SPlayer) { if (e.dead) return; e.hp -= dmg; e.alert = true; this.evq.push({ e: 'ehit', id: e.id, d: Math.round(dmg), by: by.id }); if (e.hp <= 0) this.killEnemy(e, by); }
  private killEnemy(e: SEnemy, by: SPlayer) {
    e.dead = true; e.hp = 0; this.kills++; by.kills++; this.evq.push({ e: 'edead', id: e.id }); if (e.boss) { this.bossDead = true; }
    const def = ENEMIES[e.type]; const tbl = (e.boss ? LOOT.boss : def.elite ? LOOT.elite : LOOT.ordinary) as any;
    // per-player loot roll: every party member rolls their own drops from a seeded stream (instanced: nobody can see or steal another's)
    for (const p of this.players.values()) {
      const r = rng32(hash32(this.seed + ':' + e.id + ':' + p.id)); this.stats.lootRolls++;
      const cr = tbl.credits as [number, number]; if (r() < (tbl.chance ?? 1)) p.drops.push({ id: this.nextDrop++, owner: p.id, x: e.x + (r() - .5), y: e.y + (r() - .5), kind: 'credits', amount: Math.round(cr[0] + r() * (cr[1] - cr[0])) });
      const rolls = e.boss ? (tbl.rolls ?? 1) : 1; for (let k = 0; k < rolls; k++) { if (r() > (e.boss || def.elite ? 1 : tbl.chance ?? .16)) continue; const pool = tbl.pool as any[]; const tot = pool.reduce((s, x) => s + x.w, 0); let t = r() * tot; let pick = pool[0]; for (const x of pool) { t -= x.w; if (t <= 0) { pick = x; break; } }
        const dr: SimDrop = { id: this.nextDrop++, owner: p.id, x: e.x + (r() - .5) * 1.4, y: e.y + (r() - .5) * 1.4, kind: pick.item ? 'item' : pick.chip ? 'chip' : 'stim', item: pick.item && ITEM_BY_ID[pick.item] ? pick.item : undefined, chip: pick.chip, amount: 1 }; if (dr.kind === 'item' && !dr.item) continue; p.drops.push(dr); }
    }
  }
  private wipe() { const sp = this.level.spawn; let i = 0; for (const p of this.players.values()) { p.down = false; p.hp = p.maxHp; p.x = sp.x + Math.cos(i * 1.7) * .9; p.y = sp.y + Math.sin(i * 1.7) * .9; i++; if (circleBad(this.level, p.x, p.y)) { p.x = sp.x; p.y = sp.y; } p.q = []; p.held = null; }
    const b = this.enemies.find(e => e.boss && !e.dead); if (b) { b.hp = b.maxHp; b.x = b.hx; b.y = b.hy; b.wind = 0; } for (const e of this.enemies) if (!e.dead && !e.boss) { e.alert = false; e.hp = e.maxHp; e.x = e.hx; e.y = e.hy; e.wind = 0; } this.wipeT = 0; this.evq.push({ e: 'wipe' }); }
  /** dev only (tests): move a player */
  devTeleport(id: string, x: number, y: number) { const p = this.players.get(id); if (p) { p.x = x; p.y = y; } }
  view(p: SPlayer): PlayerView { return { id: p.id, name: p.name, x: r2(p.x), y: r2(p.y), face: r2(p.face), hp: Math.round(p.hp), maxHp: p.maxHp, down: p.down, moving: p.moving, atk: p.atkFx > 0, look: p.look, lvl: p.lvl }; }
  /** per-recipient snapshot (own drops only; enemies culled by distance) */
  snapshot(id: string, ev?: any[]): SnapMsg | null {
    const me = this.players.get(id); if (!me) return null; const R2 = 30 * 30;
    const enemies: EnemyView[] = []; for (const e of this.enemies) { if (e.dead && this.time - 0 < 0) continue; if (e.dead) continue; if ((e.x - me.x) ** 2 + (e.y - me.y) ** 2 > R2 && !e.boss) continue; enemies.push({ id: e.id, type: e.type, x: r2(e.x), y: r2(e.y), hp: Math.round(e.hp), maxHp: Math.round(e.maxHp), face: r2(e.face), boss: e.boss || undefined, atk: e.wind > 0 || undefined }); }
    const players: PlayerView[] = []; for (const p of this.players.values()) if (p !== me) players.push(this.view(p));
    return { t: 'snap', tick: this.tick, ack: me.lastSeq, you: this.view(me), players, enemies, drops: me.drops.map(({ owner, ...d }) => d), flags: { bossSpawned: this.bossSpawned, bossDead: this.bossDead, completed: this.completed, kills: this.kills, total: this.total, wipeT: r2(this.wipeT) }, ev };
  }
  drainEvents() { const e = this.evq; this.evq = []; return e; }
  takeLoot(id: string) { const p = this.players.get(id); if (!p || !p.got.length) return null; const g = p.got; p.got = []; return g; }
}
function circleBad(lv: Level, x: number, y: number) { return moveCircle(lv, x, y, 0, 0, COMBAT.playerRadius) && (lv.solid[Math.floor(y) * lv.w + Math.floor(x)] === 1); }
