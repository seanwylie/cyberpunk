// Glue between the single-player Game and the multiplayer client. Active ONLY while a party instance runs (Game.netHook returns true)
// or while the player is in a town shard. Single-player behaviour is untouched when no server is configured/connected.
import type { Game, En } from '../sim';
import type { Renderer } from '../render';
import { ISO } from '../sim';
import { LAYOUT_V, InstanceState, mkInst, persist } from '../state';
import { dungeonOf } from '../content/dungeons';
import { ITEM_BY_ID, ABILITIES } from '../config';
import { profileOf } from '../core/profile';
import { cosOf } from '../content/appearance';
import { NetClient, InstanceClient } from './client';
import { RemoteDrawer, RemoteP } from './remote_render';
import { TICK_DT } from './shared';
import { bodyOf } from '../bodyvariants';
import { equippedCos } from '../content/appearance';

export class NetSession {
  active = false; ic: InstanceClient | null = null; draw: RemoteDrawer; private acc = 0; private enemyMap = new Map<number, En>(); private prevInst: InstanceState | null = null; private saved: Record<string, any> = {}; private reviveHeld = false; private townT = 0; private lastTownKey = ''; private doneToast = false; private seenT = 0; private lastAtk = false; mouse = { x: 0, y: 0 }; onExit?: (reason: string) => void; onEnter?: () => void;
  constructor(public g: Game, public rend: Renderer, public net: NetClient) {
    this.draw = new RemoteDrawer(rend);
    (g as any).netHook = (dt: number) => this.hook(dt); (rend as any).netItems = (items: any[]) => this.items(items);
    net.on('instance_start', (ic: InstanceClient) => this.enter(ic));
    net.on('instance_end', (why: string) => { if (this.active) this.exit(why, false); });
    net.on('loot', (m: any) => this.grant(m.items));
    net.on('town_leave', (id: string) => this.draw.forget(id));
    net.on('lost', () => { if (this.active) this.exit('connection lost', false); });
    net.on('snap', (s: any) => this.events(s));
    window.addEventListener('keydown', e => { if (e.code === 'KeyF') this.reviveHeld = true; if (e.code === 'KeyG' && this.net.state === 'online' && (this.active || this.net.party) && !(e.target as HTMLElement)?.matches?.('input,textarea')) { const w = this.rend.screenToWorld(this.mouse.x, this.mouse.y); this.net.mark(w.x, w.y); } });
    window.addEventListener('keyup', e => { if (e.code === 'KeyF') this.reviveHeld = false; });
    rend.canvas.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    setInterval(() => this.townTick(), 100);
  }
  // ---------- entering / leaving a networked instance
  enter(ic: InstanceClient) {
    const g = this.g; if (this.active) this.exit('restart', false);
    this.ic = ic; this.active = true; this.doneToast = false; this.prevInst = g.inst; this.acc = 0; this.enemyMap.clear();
    const lv = ic.level; const f = { gate1: false, lock2: false, passageSeen: false, controller: false, armory: false, cond: null as any, bossKey: null, bossRevealed: false, bossSpawned: false, bossDead: false, completed: false, rewardsGranted: true, alarm: false, salvageForeman: false };
    const inst: InstanceState = { id: 'net-' + ic.seed, dungeon: ic.dungeon, layoutV: LAYOUT_V, createdAt: Date.now(), expiresAt: Date.now() + 36e5, seed: ic.seed, enemies: [], drops: [], carried: { items: [], chips: {}, stims: 0, credits: 0 }, flags: f, checkpoint: { id: 1, x: lv.spawn.x, y: lv.spawn.y }, px: lv.spawn.x, py: lv.spawn.y, hp: 0, broken: [], protectedSlots: [], repairAdded: 0, nextId: 1, xpEarned: 0, warned: true, kills: {}, claimed: [], elapsed: 0 };
    g.inst = inst; g.mode = 'run'; g.level = lv; g.enemies = []; g.projs = []; g.zones = []; g.fx = []; g.target = null; g.cast = null; g.aim = null; g.channel = null; g.downed = false; g.px = ic.px; g.py = ic.py; g.seen = null as any;
    g.recompute(); g.hp = g.maxHp; g.heat = 0; g.overheated = false; g.musicSet('traversal'); g.emit('mode', 'run');
    // while networked, every "leave" path is the soft, penalty-free party exit (never touches the solo save's instance/repair bill)
    const leave = () => { this.net.send({ t: 'leave_instance' }); this.exit('left', true); return true; };
    for (const k of ['leaveInstance', 'townReturn', 'abandonInstance']) { this.saved[k] = (g as any)[k]; (g as any)[k] = leave; }
    // every combat action is a request to the server, which runs the real Game code for this player (cast aim is resolved locally exactly like solo)
    const A = (k: string, fn: any) => { this.saved[k] = (g as any)[k]; (g as any)[k] = fn; };
    A('releaseAim', () => { const a = g.aim; g.aim = null; if (!a || g.downed) return; const id = g.build.abilities[a.idx]; if (!id) return; const def = ABILITIES[id]; if (def.aim !== 'self') g.quickAim(a); this.ic?.act({ k: 'cast', i: a.idx, wx: +a.wx.toFixed(2), wy: +a.wy.toFixed(2) }); });
    A('dodge', () => { g.aim = null; this.ic?.act({ k: 'dodge' }); }); A('ventNow', () => { this.ic?.act({ k: 'vent' }); return true; }); A('useStim', () => { this.ic?.act({ k: 'stim' }); }); A('interact', () => { this.ic?.act({ k: 'use' }); });
    g.toast(`Party dungeon: ${dungeonOf(ic.dungeon).name}. Enemy HP x${ic.hpMul.toFixed(2)}. Hold F near a downed teammate to revive. G pings.`);
    this.sendProfile(); (g.inst as any).carried.stims = 2; this.onEnter?.();
  }
  exit(reason: string, local: boolean) {
    const g = this.g; if (!this.active) return; this.active = false; for (const k of Object.keys(this.saved)) delete (g as any)[k]; this.saved = {};
    this.ic = null; this.enemyMap.clear(); g.inst = this.prevInst; this.prevInst = null; g.downed = false; g.enemies = []; g.channel = null;
    if (g.mode === 'run') g.enterTown(); g.recompute(); g.hp = g.maxHp; if (!local) g.toast('Left the party dungeon (' + reason + ').'); this.onExit?.(reason);
  }
  /** the player's look for others to render: body variants + equipped cosmetics ids */
  look() { try { return { body: bodyOf(this.g.save) as any, cos: equippedCos(this.g.save).map(c => c.id) }; } catch { return undefined; } }
  sendProfile() { const s = this.g.save as any; this.net.profile(this.net.o.name || 'Guest', Math.max(1, Math.min(60, s.level || 1)), this.look()); this.net.build(profileOf(this.g.save)); }
  // ---------- per-frame hook (replaces Game.update while in a party instance)
  private hook(dtRaw: number): boolean {
    if (!this.active || !this.ic) return false; const g = this.g, ic = this.ic;
    if (g.mode !== 'run') { this.exit('returned', true); return false; } // Game moved us (e.g. cheat/menu): treat as leaving
    const dt = Math.min(dtRaw, .05); g.time += dt; this.acc += dt; let n = 0;
    const m = Math.min(1, Math.hypot(g.inputMove.x, g.inputMove.y)); let wx = 0, wy = 0; if (m > .12) { const v = ISO.vec(g.inputMove.x, g.inputMove.y); wx = v.x * m; wy = v.y * m; }
    const revive = this.reviveHeld && [...ic.players.sample(performance.now())].some(p => p.down && Math.hypot(p.x - ic.px, p.y - ic.py) < 2.4);
    while (this.acc >= TICK_DT && n++ < 3) { this.acc -= TICK_DT; ic.tickInput(wx, wy, true, g.face, revive); }
    g.px = ic.px; g.py = ic.py; g.moving = m > .12 && !ic.you?.down; if (g.moving) g.face = Math.atan2(wy, wx);
    const you = ic.you; if (you) { g.downed = you.down; g.hp = you.hp; if (you.atk && !this.lastAtk) g.atkCd = .45; this.lastAtk = you.atk; if (g.atkCd > 0) g.atkCd = Math.max(0, g.atkCd - dt);
      // authoritative combat state from the server's real Game for this player
      g.heat = you.heat; g.overheated = you.oh; for (let i = 0; i < 3; i++) g.abCd[i] = Math.max(0, (you.cd[i] || 0) - (performance.now() - this.snapAt) / 1000); g.dodgeCd = you.dcd; g.ventCd = you.vcd; (g.inst as any).carried.stims = you.stims; g.cast = you.cast ? { idx: you.cast.i, t: you.cast.t, aim: g.aim || ({ idx: you.cast.i, wx: g.px, wy: g.py, hasDir: true } as any), ab: ABILITIES[g.build.abilities[you.cast.i] as string] } as any : null;
      g.prompt = you.prompt ? (ic.level.interacts.find(i => i.id === you.prompt) || null) : null; }
    this.syncWorld(); this.seenT -= dt; if (this.seenT <= 0) { this.seenT = .25; try { (g as any).markSeen(); } catch {} } try { (g as any).updateMusic(dt); } catch {} g.updateFx(dt); return true;
  }
  private syncWorld() {
    const g = this.g, ic = this.ic!, inst = g.inst!; const f = ic.flags as any; const was = inst.flags.gate1 + '' + inst.flags.lock2 + inst.flags.controller; Object.assign(inst.flags, { bossSpawned: f.bossSpawned, bossDead: f.bossDead, completed: f.completed, bossRevealed: f.bossSpawned, gate1: !!f.gate1, lock2: !!f.lock2, controller: !!f.controller, bossKey: f.bossKey ?? null, cond: f.cond ?? null }); if (was !== inst.flags.gate1 + '' + inst.flags.lock2 + inst.flags.controller) { try { (g as any).applyDoors(); } catch { } } inst.elapsed += TICK_DT / 3;
    const list = ic.enemies.sample(performance.now()); const seen = new Set<number>();
    for (const v of list) { seen.add(v.id); let e = this.enemyMap.get(v.id); if (!e) { e = (g as any).wrap({ id: v.id, type: v.type, x: v.x, y: v.y, hp: v.hp, maxHp: v.maxHp, alert: true, dead: false, home: { x: v.x, y: v.y }, group: 0, faction: 'enemy', ctrlT: 0, stunT: 0 }); this.enemyMap.set(v.id, e!); }
      const en = e!; const mv = Math.hypot(v.x - en.x, v.y - en.y) > .005; en.x = v.x; en.y = v.y; en.hp = v.hp; en.maxHp = v.maxHp; en.dead = false; en.alert = true; en._rt.ang = v.face ?? 0; en._rt.st = v.atk ? 'tele' : mv ? 'chase' : 'idle'; en.faction = v.ally ? 'ally' : 'enemy'; en._rt.reveal = v.rv ? 1 : 0; en._rt.shield = v.sh ? { hp: v.sh, max: v.sh } : undefined; if (v.aff) (en as any).affix = v.aff; }
    for (const [id, e] of this.enemyMap) if (!seen.has(id) && !e.dead) { this.enemyMap.delete(id); }
    g.enemies = [...this.enemyMap.values()].concat(this.corpses.filter(c => g.time - c.at < 1.4).map(c => c.e)); this.corpses = this.corpses.filter(c => g.time - c.at < 1.4);
    // instanced drops: only mine are in the snapshot
    inst.drops = ic.drops.map(d => ({ id: d.id, x: d.x, y: d.y, kind: d.kind, amount: d.amount, chip: d.chip as any, inst: d.item ? { uid: 'n' + d.id, def: d.item, chips: [] } : undefined, born: 0 }) as any);
    if (f.completed && !this.doneToast) { this.doneToast = true; g.toast('PARTY CLEAR! Loot rolls were personal. Open the menu > Leave when ready.'); }
  }
  private corpses: { e: En; at: number }[] = [];
  private snapAt = 0;
  private events(s: any) {
    this.snapAt = performance.now(); if (!this.active || !s.ev) return; const g = this.g;
    for (const ev of s.ev) { if (ev.e === 'ehit') { const en = this.enemyMap.get(ev.id); if (en) g.popup(en.x, en.y - .3, String(ev.d), ev.by === this.net.id ? '#f1eadb' : '#9a9a9a'); }
      else if (ev.e === 'edead') { const en = this.enemyMap.get(ev.id); if (en) { en.dead = true; en.hp = 0; this.enemyMap.delete(ev.id); this.corpses.push({ e: en, at: g.time }); g.fx.push({ kind: 'burst', x: en.x, y: en.y, t: 0, life: .5 }); } }
      else if (ev.e === 'phit' && ev.id === this.net.id) { g.fx.push({ kind: 'text', x: g.px, y: g.py - .5, t: 0, life: .8, text: '-' + ev.d, c: '#e5604a' }); }
      else if (ev.e === 'fx') { for (const f of ev.fx || []) g.fx.push({ kind: f[0], x: f[1], y: f[2], t: 0, life: f[3], text: f[4], c: f[5], r: f[6] } as any); for (const v of ev.vev || []) { const { k, x, y, ...o } = v; try { g.vfx(k, x, y, o); } catch { } } }
      else if (ev.e === 'toast' && ev.to === this.net.id) g.toast(ev.s); else if (ev.e === 'sfx' && ev.to === this.net.id) g.emit('sfx', ev.n);
      else if (ev.e === 'dialog' && ev.to === this.net.id) g.emit('dialog', { title: ev.title, body: ev.body, options: (ev.opts as string[]).map((label, i) => ({ label, cb: () => this.ic?.act({ k: 'dlg', i }) })) });
      else if (ev.e === 'revive') g.toast((ev.id === this.net.id ? 'You were' : 'Teammate') + ' revived.'); else if (ev.e === 'wipe') g.toast('Party wiped: back to the entrance, boss reset.'); else if (ev.e === 'boss') g.toast('The boss awakens.'); else if (ev.e === 'down' && ev.id === this.net.id) g.toast('You are down. A teammate can revive you (hold F).'); }
  }
  /** apply server-granted personal loot to the LOCAL save (saves stay local) */
  grant(items: { kind: string; item?: string; chip?: string; amount: number; mfr?: string; k?: string; key?: string; id?: string; abAcq?: { total: number; dry: number } }[]) {
    const g = this.g, s = g.save as any; const names: string[] = [];
    for (const it of items) {
      if (it.kind === 'credits') { if (it.amount > 0) { s.credits += it.amount; names.push(it.amount + 'c'); } else s.credits = Math.max(0, s.credits + it.amount); }
      else if (it.kind === 'item' && it.item && ITEM_BY_ID[it.item]) { s.items.push(mkInst(s, it.item)); names.push(ITEM_BY_ID[it.item].name); }
      else if (it.kind === 'chip' && it.chip) { s.lockerChips[it.chip] = (s.lockerChips[it.chip] || 0) + (it.amount || 1); names.push('chip'); }
      else if (it.kind === 'stim') { s.stims += it.amount || 1; names.push('stim'); }
      // individual progression: this player's own xp / reputation / contract credit / pity / cosmetic rolls, computed server-side from their own participation
      else if (it.kind === 'xp') g.addXp(it.amount);
      else if (it.kind === 'rep' && it.mfr && s.rep[it.mfr] !== undefined) s.rep[it.mfr] += it.amount;
      else if (it.kind === 'cev' && it.k) g.contractEvent(it.k, it.key || '');
      else if (it.kind === 'pity' && it.abAcq) s.abAcq = { ...it.abAcq };
      else if (it.kind === 'cos' && it.id) { const c = cosOf(s); if (!c.owned[it.id]) { c.owned[it.id] = Date.now(); names.push('cosmetic'); } }
    }
    if (names.length) g.toast('Loot: ' + names.slice(0, 3).join(', ') + (names.length > 3 ? ' +' + (names.length - 3) : ''));
    persist(g.save);
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
