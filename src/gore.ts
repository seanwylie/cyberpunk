// Blood & gore (Settings > Content > "Blood & gore": Off (default) / Mild / Bloody). docs/GORE.md
// Purely visual and per-client: every player in a party uses their own setting, nothing here touches the sim state, saves or the network.
//  * organic bodies bleed (blood / ichor / sap), robots spark and leak coolant or oil, hybrids do both, spectral/glitch entities show nothing.
//  * Mild: small droplets + one pool where a body falls. Bloody: wet hit bursts, floor splatter, gibs, dismemberment on heavy kills, boss limb severing, subtle screen-edge spray.
//  * floor decals fade over time and are capped per quality tier; everything is cleared when the level/instance changes (leave, re-enter, town). Never drawn in town. Never on players or NPCs.
//  * Reduced FX: no airborne particles, no screen spray; decals only (static). Flash guard: nothing here is a full-screen flash.
import { Q } from './quality';
import { flashAllowed } from './flashguard';
import { ENEMIES } from './config';
import { BODY as BESTIARY_BODY } from './content/bestiary_mobs';
export type GoreMode = 'off' | 'mild' | 'bloody';
export type Body = 'organic' | 'hybrid' | 'machine' | 'spectral';
export const goreMode = (g: any): GoreMode => { const v = g?.save?.settings?.gore; return v === 'mild' || v === 'bloody' ? v : 'off'; };
const ORGANIC = new Set(['cinderhound', 'cindermite', 'dustroach', 'staticpup', 'sedabloom', 'fusecrawler']);
const HYBRID = new Set(['recovered', 'leechorderly', 'apothecary', 'repocrawler', 'triagewarden']);
const SPECTRAL = new Set(['sootwisp', 'menderwisp']);
const MACHINE = new Set(['fittingdoll']);
export function bodyOf(type: string): Body { return BESTIARY_BODY[type] || (ORGANIC.has(type) ? 'organic' : SPECTRAL.has(type) ? 'spectral' : MACHINE.has(type) ? 'machine' : 'hybrid'); } // augmented humans by default (flesh + augments); pure machines are listed
export type FluidKind = 'blood' | 'ichor' | 'sap' | 'coolant' | 'oil';
export interface Fluid { kind: FluidKind; col: string; dk: string }
export const FLUIDS: Record<FluidKind, Fluid> = {
  blood: { kind: 'blood', col: '#8a1f1a', dk: '#4a0f0e' }, ichor: { kind: 'ichor', col: '#a4a82c', dk: '#565a16' }, sap: { kind: 'sap', col: '#4e8a3a', dk: '#25461c' },
  coolant: { kind: 'coolant', col: '#3aa6b4', dk: '#1c5e68' }, oil: { kind: 'oil', col: '#2c2318', dk: '#14100a' },
};
const ICHOR = new Set(['soothsac', 'drapejelly', 'squidwalker', 'stitchspider']), SAP = new Set(['rootcluster']);
/** fluids a body leaks (first = primary). Spectral = none. */
export function fluidsOf(type: string): Fluid[] {
  const b = bodyOf(type); if (b === 'spectral') return [];
  const pri = SAP.has(type) ? FLUIDS.sap : ICHOR.has(type) ? FLUIDS.ichor : FLUIDS.blood;
  if (b === 'organic') return [pri]; if (b === 'hybrid') return [pri, FLUIDS.oil]; return [type.includes('doll') || type === 'fittingdoll' ? FLUIDS.oil : FLUIDS.coolant, FLUIDS.oil];
}
interface Decal { x: number; y: number; r: number; t0: number; life: number; a: number; fl: Fluid; sh: number; flip: number }
export type GibKind = 'limb' | 'head' | 'lump' | 'rib' | 'plate' | 'servo' | 'cable' | 'shard';
/** augment hardware palettes per manufacturer: [body, dark edge, marking]. Heavy Industrial oxide red, Precision Surgical dirty ivory ceramic + slate, Mass-Market olive polymer. */
export const MFR_PAL: Record<string, [string, string, string]> = { HI: ['#7c3b24', '#3a1c12', '#a8a49a'], PS: ['#bdb39b', '#6a665c', '#4e5560'], MM: ['#5f6139', '#30321d', '#8a8468'] };
const PAL_IDX: Record<string, number> = { HI: 0, PS: 1, MM: 2 }; const PALS = [MFR_PAL.HI, MFR_PAL.PS, MFR_PAL.MM];
interface Chunk { x: number; y: number; vx: number; vy: number; z: number; vz: number; t0: number; life: number; kind: GibKind; fl: Fluid; metal: boolean; pal: number; pn: number; size: number; rot: number; spin: number; landed: boolean; big: boolean; path: Float32Array; dt: number; fx: number; fy: number }
interface Drop { x: number; y: number; z: number; vx: number; vy: number; vz: number; t0: number; life: number; col: string; s: number; spark: boolean }
export const CAPS: Record<'high' | 'medium' | 'low', { decals: number; chunks: number; drops: number }> = { high: { decals: 160, chunks: 72, drops: 170 }, medium: { decals: 70, chunks: 28, drops: 60 }, low: { decals: 32, chunks: 12, drops: 24 } };
/** gib count multiplier per tier (the lite path on phones spawns fewer pieces; caps still bound the total) */
export const GIB_MUL: Record<'high' | 'medium' | 'low', number> = { high: 1, medium: .55, low: .3 };
const PATH_CAP = 92 * 3;
const G = 16, DECAL_LIFE = [34, 52];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const caps = () => CAPS[Q.tier] || CAPS.high;
interface Info { ang: number; heavy: boolean; dmg: number; bits: number }
const info = new WeakMap<object, Info>();

/** walkable = not solid (walls, wall tops, props, void). Gore only ever rests on these cells. */
const floorAt = (g: any, x: number, y: number) => !(g.solidAt ? g.solidAt(x, y) : false);
const M = .2; // keep a gib's footprint this far from any wall face so its sprite never overlaps a wall
const clearAt = (g: any, x: number, y: number) => floorAt(g, x, y) && floorAt(g, x - M, y) && floorAt(g, x + M, y) && floorAt(g, x, y - M) && floorAt(g, x, y + M);
/** nearest floor cell centre (spiral search, radius 6); falls back to the given point */
export function nearestFloor(g: any, x: number, y: number): [number, number] {
  if (clearAt(g, x, y)) return [x, y]; const ix = Math.floor(x), iy = Math.floor(y); let best: [number, number] | null = null, bd = 1e9;
  for (let r = 0; r <= 6 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const cx = ix + dx + .5, cy = iy + dy + .5; if (!clearAt(g, cx, cy) && !floorAt(g, cx, cy)) continue; const d = (cx - x) ** 2 + (cy - y) ** 2; if (d < bd) { bd = d; best = [cx, cy]; } }
  return best || [x, y];
}
/** Step-simulate a gib (30 Hz): ballistic arc, bounces off wall faces (per-axis reflect), bounces/slides on the floor, then settles on a walkable cell.
 *  Stores samples [x,y,z]* in ch.path and the resting spot in ch.fx/fy. Deterministic given the initial velocity. */
function simChunk(g: any, ch: any) {
  const dt = ch.dt, out = ch.path; let n = 0; let x = ch.x, y = ch.y, z = ch.z, vx = ch.vx, vy = ch.vy, vz = ch.vz, bounces = 0;
  if (!clearAt(g, x, y)) [x, y] = nearestFloor(g, x, y);
  for (let i = 0; i < 90; i++) {
    out[n++] = x; out[n++] = y; out[n++] = z;
    const nx = x + vx * dt; if (clearAt(g, nx, y)) x = nx; else vx = -vx * .35;
    const ny = y + vy * dt; if (clearAt(g, x, ny)) y = ny; else vy = -vy * .35;
    vz -= G * dt; z += vz * dt;
    if (z <= 0) { z = 0; if (bounces < (ch.metal ? 2 : 1) && vz < -2) { vz = -vz * (ch.metal ? .4 : .28); bounces++; } else vz = 0; vx *= z === 0 && vz === 0 ? .82 : .7; vy *= z === 0 && vz === 0 ? .82 : .7; }
    if (z === 0 && vz === 0 && vx * vx + vy * vy < .01) break;
  }
  [x, y] = nearestFloor(g, x, y); out[n++] = x; out[n++] = y; out[n++] = 0; ch.pn = n / 3; ch.fx = x; ch.fy = y;
}
class GoreSys {
  decals: Decal[] = []; chunks: Chunk[] = []; drops: Drop[] = []; edge: { t0: number; seed: number; fl: Fluid } | null = null;
  private lvl: any = null; private inst: any = null; private sweepAt = 0; private budgetT = 0; private budget = 0; stats = { spawned: 0, cleared: 0, dropsCapped: 0 };
  private cPool: Chunk[] = []; private dPool: Drop[] = [];
  poolSizes() { return { chunks: this.cPool.length, drops: this.dPool.length }; }
  reset() { this.stats.cleared += this.decals.length + this.chunks.length + this.drops.length; for (const k of this.chunks) this.cPool.push(k); for (const d of this.drops) this.dPool.push(d); this.decals.length = 0; this.chunks.length = 0; this.drops.length = 0; this.edge = null; }
  counts() { return { decals: this.decals.length, chunks: this.chunks.length, drops: this.drops.length }; }
  /** true while gore may exist/draw for this game state */
  private active(g: any) { return goreMode(g) !== 'off' && g.mode === 'run' && g.level?.kind !== 'town'; }
  sync(g: any) { if (g.level !== this.lvl || g.inst !== this.inst || !this.active(g)) { if (this.decals.length || this.chunks.length || this.drops.length || this.edge) this.reset(); this.lvl = g.level; this.inst = g.inst; } }
  private take(g: any, n: number) { if (g.time - this.budgetT > .12) { this.budgetT = g.time; this.budget = 0; } if (this.budget + n > 60) return false; this.budget += n; return true; }
  private decal(g: any, x: number, y: number, r: number, fl: Fluid, a = .85, delay = 0) {
    if (!floorAt(g, x, y)) return; const c = caps(), red = !!g.save.settings.reducedFx; if (this.decals.length >= (red ? c.decals >> 1 : c.decals)) this.decals.shift();
    this.decals.push({ x, y, r, t0: g.time + delay, life: rnd(DECAL_LIFE[0], DECAL_LIFE[1]) * (fl.kind === 'oil' ? 1.15 : 1), a, fl, sh: (Math.random() * 6) | 0, flip: Math.random() < .5 ? -1 : 1 }); this.stats.spawned++;
  }
  private drop(g: any, x: number, y: number, ang: number, sp: number, fl: Fluid, spark = false, delay = 0, vzMul = 1) {
    if (g.save.settings.reducedFx) return; const c = caps(); if (this.drops.length >= c.drops) { this.stats.dropsCapped++; return; }
    const a = ang + rnd(-.9, .9), s = sp * rnd(.5, 1.1), d = this.dPool.pop() || ({} as Drop); d.x = x; d.y = y; d.z = rnd(.3, .9); d.vx = Math.cos(a) * s; d.vy = Math.sin(a) * s; d.vz = rnd(2, 5.5) * vzMul; d.t0 = g.time + delay; d.life = spark ? rnd(.18, .34) : 1.1; d.col = spark ? '#c89a52' : Math.random() < .35 ? fl.dk : fl.col; d.s = spark ? 1.4 : rnd(1.2, 2.4); d.spark = spark; this.drops.push(d);
  }
  private chunk(g: any, e: any, kind: GibKind, fl: Fluid, metal: boolean, ang: number, power: number, size: number, big = false, delay = 0, spread = .8) {
    const c = caps(); if (this.chunks.length >= c.chunks) { const o = this.chunks.shift()!; this.cPool.push(o); } const a = ang + rnd(-spread, spread), s = power * rnd(.6, 1.1), red = !!g.save.settings.reducedFx;
    const ch = this.cPool.pop() || ({ path: new Float32Array(PATH_CAP) } as Chunk); const def = ENEMIES[e.type];
    ch.x = e.x; ch.y = e.y; ch.vx = Math.cos(a) * s; ch.vy = Math.sin(a) * s; ch.z = rnd(.4, 1.0) * (big ? 1.6 : 1); ch.vz = rnd(3, 6.5) * (big ? 1.25 : 1); ch.t0 = g.time + delay; ch.life = rnd(26, 42); ch.kind = kind; ch.fl = fl; ch.metal = metal;
    ch.pal = PAL_IDX[def?.mfr] ?? 2; ch.size = size; ch.rot = Math.random() * 6.28; ch.spin = rnd(-9, 9) * (metal ? 1.3 : 1); ch.landed = false; ch.big = big; ch.dt = 1 / 30; ch.fx = e.x; ch.fy = e.y; ch.pn = 0;
    if (red) { ch.vx *= .2; ch.vy *= .2; }
    simChunk(g, ch);
    if (red) { ch.t0 = g.time - 3; ch.spin = 0; } this.chunks.push(ch);
  }
  /** one Doom-style burst: flesh + manufacturer hardware flying out radially, a blood spray and splats. n scales with the quality tier. */
  private burst(g: any, e: any, fl: Fluid, ang: number, nFlesh: number, nHw: number, power: number, size: number, big: boolean, delay: number, radial: boolean) {
    const mul = GIB_MUL[Q.tier] || 1, nf = Math.max(1, Math.round(nFlesh * mul)), nh = Math.max(1, Math.round(nHw * mul)), sp = radial ? Math.PI : .9;
    const FL: GibKind[] = ['lump', 'rib', 'lump', 'limb'], HW: GibKind[] = ['plate', 'servo', 'cable', 'shard'];
    for (let k = 0; k < nf; k++) this.chunk(g, e, FL[k % 4], fl, false, ang + (radial ? k * 2.4 : 0), power, size * rnd(.7, 1.15), big, delay + k * .012, sp);
    for (let k = 0; k < nh; k++) this.chunk(g, e, HW[k % 4], fl, true, ang + (radial ? k * 2.4 + 1.2 : 0), power * 1.1, size * rnd(.6, 1), big, delay + k * .012, sp);
    if (!g.save.settings.reducedFx) for (let k = 0; k < Math.round((big ? 26 : 14) * mul); k++) this.drop(g, e.x, e.y, ang + (radial ? k * 2.4 : 0), power * 1.1, fl, false, delay, 1.25);
    // spray: a streak of splats thrown along the hit direction, plus a ring for radial bursts
    const R = big ? 1.8 : 1; for (let k = 0; k < (radial ? 5 : 3); k++) { const aa = ang + (radial ? k * 1.26 : rnd(-.35, .35)), d = rnd(.6, 2.2) * R; this.decal(g, e.x + Math.cos(aa) * d, e.y + Math.sin(aa) * d, rnd(.3, .65) * R, fl, .82, delay + .15 + d * .05); }
  }
  // ---------------------------------------------------------------- sim hooks
  hit(g: any, e: any, dmg: number, heavy: boolean, sx: number, sy: number) {
    const mode = goreMode(g); if (mode === 'off' || !this.active(g) || e.faction === 'ally' || dmg <= 0) return; const def = ENEMIES[e.type]; if (!def) return;
    const ang = Math.atan2(e.y - sy, e.x - sx); let inf = info.get(e); if (!inf) { inf = { ang, heavy, dmg, bits: 0 }; info.set(e, inf); } inf.ang = ang; inf.heavy = heavy; inf.dmg = dmg;
    const fls = fluidsOf(e.type); if (!fls.length || !this.take(g, 4)) return; const bloody = mode === 'bloody';
    for (const fl of fls) {
      const mech = fl.kind === 'coolant' || fl.kind === 'oil', n = bloody ? (heavy ? 9 : 5) : 2;
      if (mech) { if (bloody) for (let i = 0; i < (heavy ? 4 : 2); i++) this.drop(g, e.x, e.y, ang, 5, fl, true); for (let i = 0; i < Math.ceil(n / 2); i++) this.drop(g, e.x, e.y, ang, 3.5, fl); }
      else for (let i = 0; i < n; i++) this.drop(g, e.x, e.y, ang, bloody ? 5.5 : 3, fl);
      if (Math.random() < (bloody ? (heavy ? .9 : .5) : .15)) this.decal(g, e.x + Math.cos(ang) * rnd(.2, .9), e.y + Math.sin(ang) * rnd(.2, .9), (heavy ? .55 : .3) * (def.boss ? 1.6 : 1), fl, .8);
      break; // primary fluid only for the burst; second fluid pools on death
    }
    g.emit?.('sfx', bloody ? (fls[0].kind === 'coolant' || fls[0].kind === 'oil' ? 'gore_spark' : 'gore_wet') : 'gore_wet');
    // boss limb severing at 75 / 50 / 25 %
    if (bloody && def.boss) { const f = e.hp / Math.max(1, e.maxHp); [.75, .5, .25].forEach((th, i) => { if (f < th && !(inf!.bits & (1 << i))) { inf!.bits |= 1 << i; const fl = fls[0], mech = fl.kind === 'coolant' || fl.kind === 'oil'; this.chunk(g, e, mech ? 'plate' : 'limb', fl, mech, ang, 5, 2.4, true); this.chunk(g, e, mech ? 'plate' : 'lump', fl, mech, ang + 1, 3.5, 1.6, true); for (let k = 0; k < 14; k++) this.drop(g, e.x, e.y, ang, 6, fl, mech && k % 3 === 0); this.decal(g, e.x, e.y, 1.6, fl, .85); g.emit?.('sfx', 'gore_gib'); g.toast?.('Limb severed'); } }); }
  }
  kill(g: any, e: any) {
    const mode = goreMode(g); if (mode === 'off' || !this.active(g) || e.faction === 'ally') return; const def = ENEMIES[e.type]; if (!def) return; const fls = fluidsOf(e.type); if (!fls.length) return;
    const inf = info.get(e) || { ang: Math.random() * 6.28, heavy: false, dmg: 0, bits: 0 }, bloody = mode === 'bloody'; const ang = inf.ang, big = !!def.boss, elite = !big && !!def.elite;
    const over = inf.dmg >= e.maxHp * .9, heavy = inf.heavy || over || big;
    fls.forEach((fl, i) => { const mech = fl.kind === 'coolant' || fl.kind === 'oil'; this.decal(g, e.x + (i ? rnd(-.3, .3) : 0), e.y + (i ? rnd(-.3, .3) : 0), (bloody ? rnd(.9, 1.3) : rnd(.5, .7)) * (big ? 2.2 : elite ? 1.4 : 1) * (i ? .7 : 1), fl, .9, big && bloody ? 1.2 : 0); if (bloody) { for (let k = 0; k < (big ? 3 : 2); k++) this.decal(g, e.x + rnd(-1.3, 1.3), e.y + rnd(-1.3, 1.3), rnd(.25, .6), fl, .8); }
      for (let k = 0; k < (bloody ? (big ? 30 : 16) : 6) / (i + 1); k++) this.drop(g, e.x, e.y, ang, bloody ? 6.5 : 3.2, fl, mech && bloody && k % 5 === 0); });
    if (bloody) {
      const fl = fls[0], hw = bodyOf(e.type) !== 'organic'; // organic beasts: flesh only; augmented humans + machines: flesh AND hardware
      const nHw = (n: number) => hw ? n : 0;
      if (big) { // signature boss death: three escalating ruptures while it staggers, then it comes apart
        this.burst(g, e, fl, ang, 3, nHw(2), 4.5, 1.3, false, 0, false);
        this.burst(g, e, fl, ang + 2.1, 3, nHw(3), 5.5, 1.5, false, .38, false);
        this.burst(g, e, fl, ang - 2.1, 3, nHw(3), 6, 1.6, false, .72, false);
        this.burst(g, e, fl, ang, 6, nHw(6), 8.5, 1.9, true, 1.1, true);
        for (const [kd, d] of [['head', 1.12], ['limb', 1.1], ['limb', 1.14], ['limb', 1.16]] as [GibKind, number][]) this.chunk(g, e, kd, fl, false, ang + rnd(-3, 3), 7.5, 2.2, true, d, Math.PI);
        e._gibAt = g.time + 1.1; if (!g.save.settings.reducedFx && Math.hypot(e.x - g.px, e.y - g.py) < 8 && flashAllowed(false)) this.edge = { t0: g.time + 1.1, seed: Math.random() * 99, fl };
        g.emit?.('sfx', 'gore_pop'); g.kick = Math.max(g.kick || 0, 6);
      } else if (heavy) { // overkill / heavy hit: the body bursts apart, no corpse left (Doom gib)
        const xl = over || elite; this.burst(g, e, fl, ang, xl ? 6 : 4, nHw(xl ? 5 : 3), xl ? 7.5 : 6, elite ? 1.25 : 1, elite, 0, true);
        const kinds: GibKind[] = ['limb', 'limb', 'head', 'limb']; for (const kd of kinds.slice(0, elite ? 4 : 2 + (Math.random() < .5 ? 1 : 0))) this.chunk(g, e, kd, fl, false, ang, 6.5, elite ? 1.4 : 1, elite);
        e._gibAt = g.time; if (!g.save.settings.reducedFx && Math.hypot(e.x - g.px, e.y - g.py) < 6 && flashAllowed(false)) this.edge = { t0: g.time, seed: Math.random() * 99, fl };
        g.emit?.('sfx', 'gore_gib'); if (elite) g.kick = Math.max(g.kick || 0, 3);
      } else { // ordinary kill: a few chunks knocked off the corpse
        this.burst(g, e, fl, ang, elite ? 3 : 2, nHw(elite ? 2 : 1), 4.5, elite ? 1.1 : .75, false, 0, false); g.emit?.('sfx', 'gore_wet');
      }
    } else g.emit?.('sfx', 'gore_wet');
    info.delete(e);
  }
  // ---------------------------------------------------------------- drawing
  private tex = new Map<string, HTMLCanvasElement>();
  private splat(fl: Fluid, sh: number): HTMLCanvasElement {
    const k = fl.kind + sh; let cv = this.tex.get(k); if (cv) return cv; cv = document.createElement('canvas'); cv.width = 96; cv.height = 48; const x = cv.getContext('2d')!; let s = (sh + 1) * 7919 + fl.col.length * 31; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const gl = fl.kind === 'coolant' || fl.kind === 'oil';
    x.translate(48, 24); x.scale(1, .5); for (let i = 0; i < 6 + sh; i++) { const a = r() * 6.28, d = r() * 22, rr = 9 + r() * 14; const g2 = x.createRadialGradient(Math.cos(a) * d, Math.sin(a) * d, 0, Math.cos(a) * d, Math.sin(a) * d, rr); g2.addColorStop(0, fl.col); g2.addColorStop(.7, fl.dk); g2.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g2; x.beginPath(); x.arc(Math.cos(a) * d, Math.sin(a) * d, rr, 0, 7); x.fill(); }
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = fl.dk; for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(48 + (r() - .5) * 84, 24 + (r() - .5) * 38, 1 + r() * 2.5, .6 + r() * 1.2, 0, 0, 7); x.fill(); }
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = gl ? 'rgba(220,240,244,.16)' : 'rgba(255,200,190,.09)'; x.beginPath(); x.ellipse(40, 18, 14, 4, -.2, 0, 7); x.fill(); this.tex.set(k, cv); return cv;
  }
  /** clip a decal to the walkable floor cells it covers, so a splat next to a wall never paints onto the wall face or wall top */
  private clipFloor(r: any, d: Decal) {
    const g = r.g, c = r.ctx, R = Math.ceil(d.r * .7) + 1, ix = Math.floor(d.x), iy = Math.floor(d.y); let all = true; const cells: number[] = [];
    for (let y = iy - R; y <= iy + R; y++) for (let x = ix - R; x <= ix + R; x++) { if (floorAt(g, x + .5, y + .5)) cells.push(x, y); else all = false; }
    if (all) return; c.beginPath(); for (let i = 0; i < cells.length; i += 2) { const x = cells[i], y = cells[i + 1]; c.moveTo(r.sx(x, y), r.sy(x, y)); c.lineTo(r.sx(x + 1, y), r.sy(x + 1, y)); c.lineTo(r.sx(x + 1, y + 1), r.sy(x + 1, y + 1)); c.lineTo(r.sx(x, y + 1), r.sy(x, y + 1)); c.closePath(); } c.clip();
  }
  drawGround(r: any) {
    const g = r.g; this.sync(g); if (!this.decals.length) return; const c = r.ctx, t = g.time, TW = r.TW; c.save();
    if (t - this.sweepAt > 1) { this.sweepAt = t; this.decals = this.decals.filter(d => t - d.t0 < d.life); }
    for (const d of this.decals) { const age = t - d.t0; if (age < 0) continue; const a = d.a * Math.min(1, age / .25) * (age > d.life * .6 ? 1 - (age - d.life * .6) / (d.life * .4) : 1); if (a <= .02) continue; const sx = r.sx(d.x, d.y), sy = r.sy(d.x, d.y), w = d.r * TW * 1.25; if (sx < -w || sx > r.w + w || sy < -w || sy > r.h + w) continue; const grow = Math.min(1, .55 + age * 2.2); c.save(); this.clipFloor(r, d); c.globalAlpha = a; c.drawImage(this.splat(d.fl, d.sh), sx - w * grow * d.flip / 2 * (d.flip < 0 ? -1 : 1), sy - w * grow / 4, w * grow * d.flip, w * grow / 2); c.restore(); }
    c.restore();
  }
  drawAir(r: any) {
    const g = r.g; if (!this.active(g) || !this.drops.length) return; const c = r.ctx, t = g.time, TW = r.TW; c.save();
    { let j = 0; const D = this.drops; for (let i = 0; i < D.length; i++) { const d = D[i]; if (t - d.t0 < d.life) D[j++] = d; else this.dPool.push(d); } D.length = j; } // in place, recycled
    for (const d of this.drops) { const a = t - d.t0; if (a < 0) continue; const z = d.z + d.vz * a - .5 * G * a * a; if (z < 0) { if (!d.spark && a < d.life - .3) d.life = a + .3; } if (!floorAt(g, d.x + d.vx * a, d.y + d.vy * a)) { d.life = Math.min(d.life, a); continue; } const zz = Math.max(0, z), px = r.sx(d.x + d.vx * a, d.y + d.vy * a), py = r.sy(d.x + d.vx * a, d.y + d.vy * a) - zz * TW * .5; c.globalAlpha = Math.max(0, Math.min(1, (d.life - a) / .25)); c.fillStyle = d.col; if (d.spark) { c.fillRect(px - 1, py - 1, 2.2, 2.2); } else { c.beginPath(); c.ellipse(px, py, d.s, d.s * (z > 0 ? 1.35 : .6), 0, 0, 7); c.fill(); } }
    c.restore();
  }
  /** world position of a gib at time t: [x, y, z, landed] */
  pos(k: Chunk, t: number): [number, number, number, boolean] {
    const P = k.path, n = k.pn, f = Math.max(0, (t - k.t0) / k.dt); if (f >= n - 1) return [P[(n - 1) * 3], P[(n - 1) * 3 + 1], 0, true];
    const i = Math.floor(f), u = f - i, j = i * 3; return [P[j] + (P[j + 3] - P[j]) * u, P[j + 1] + (P[j + 4] - P[j + 1]) * u, P[j + 2] + (P[j + 5] - P[j + 2]) * u, false];
  }
  /** gibs go into the renderer's isometric depth sort (d = x + y of the ground point under them) so walls in front correctly cover them */
  items(r: any, items: { d: number; f: () => void }[]) {
    const g = r.g; if (!this.active(g) || !this.chunks.length) return; const t = g.time;
    { let j = 0; const C = this.chunks; for (let i = 0; i < C.length; i++) { const k = C[i]; if (t - k.t0 < k.life) C[j++] = k; else this.cPool.push(k); } C.length = j; }
    for (const k of this.chunks) { if (t < k.t0) continue; const [wx, wy] = this.pos(k, t); items.push({ d: wx + wy, f: () => this.drawChunk(r, k) }); }
  }
  /** gib sprites are painted once per (kind, fluid, manufacturer, pixel size) into a small canvas and then blitted rotated: one drawImage per gib per frame */
  private gtex = new Map<string, HTMLCanvasElement>();
  private gibSprite(k: Chunk, s: number): HTMLCanvasElement {
    const sb = Math.max(3, Math.round(s)), key = k.kind + (k.metal ? 'm' + k.pal : k.fl.kind) + sb; let cv = this.gtex.get(key); if (cv) return cv;
    if (this.gtex.size > 260) this.gtex.clear(); // bounded (zoom changes mint new sizes)
    cv = document.createElement('canvas'); const W = Math.ceil(sb * 2.8); cv.width = W; cv.height = W; const c = cv.getContext('2d')!; c.translate(W / 2, W / 2); const S = sb;
    const [hb, hd, hm] = PALS[k.pal] || PALS[2], flesh = '#5e2820', fleshDk = '#2a0f0b', bone = '#b8ad96', fl = k.fl;
    c.lineWidth = Math.max(1, S * .08); c.strokeStyle = 'rgba(20,12,10,.7)'; c.lineJoin = 'round';
    const blob = (col: string, rr: number) => { c.fillStyle = col; c.beginPath(); c.moveTo(-rr, 0); c.quadraticCurveTo(-rr * .6, -rr * .9, rr * .3, -rr * .7); c.quadraticCurveTo(rr * 1.1, -rr * .2, rr * .6, rr * .7); c.quadraticCurveTo(-rr * .2, rr, -rr, 0); c.fill(); c.stroke(); };
    const wet = () => { c.fillStyle = 'rgba(240,215,200,.13)'; c.beginPath(); c.ellipse(-S * .25, -S * .3, S * .24, S * .09, -.5, 0, 7); c.fill(); };
    switch (k.kind) {
      case 'lump': blob(flesh, S); c.fillStyle = fl.dk; c.beginPath(); c.ellipse(S * .1, S * .05, S * .5, S * .3, .3, 0, 7); c.fill(); c.fillStyle = '#8a5a48'; c.beginPath(); c.ellipse(-S * .45, -S * .3, S * .3, S * .14, -.4, 0, 7); c.fill(); /* torn skin */ c.fillStyle = fleshDk; c.beginPath(); c.arc(-S * .15, S * .2, S * .22, 0, 7); c.fill(); wet(); break;
      case 'rib': c.fillStyle = flesh; c.beginPath(); c.ellipse(0, 0, S * 1.05, S * .55, 0, 0, 7); c.fill(); c.stroke(); c.strokeStyle = bone; c.lineWidth = Math.max(1, S * .16); for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-S * .8, i * S * .28); c.quadraticCurveTo(0, i * S * .28 - S * .25, S * .8, i * S * .28); c.stroke(); } c.fillStyle = fl.col; c.globalAlpha = .7; c.beginPath(); c.ellipse(S * .3, S * .1, S * .35, S * .2, 0, 0, 7); c.fill(); c.globalAlpha = 1; break;
      case 'limb': { c.fillStyle = '#7e5644'; c.beginPath(); c.moveTo(-S * 1.15, -S * .3); c.lineTo(S * .5, -S * .26); c.lineTo(S * .5, S * .26); c.lineTo(-S * 1.15, S * .32); c.closePath(); c.fill(); c.stroke(); // skin forearm
        c.fillStyle = hb; c.beginPath(); c.moveTo(S * .2, -S * .32); c.lineTo(S * 1.15, -S * .26); c.lineTo(S * 1.15, S * .26); c.lineTo(S * .2, S * .32); c.closePath(); c.fill(); c.stroke(); c.fillStyle = hm; c.fillRect(S * .45, -S * .05, S * .5, S * .1); // augment sleeve
        c.fillStyle = bone; c.beginPath(); c.arc(-S * 1.15, 0, S * .22, 0, 7); c.fill(); c.fillStyle = fl.col; c.beginPath(); c.arc(-S * 1.1, 0, S * .32, 1.2, 5.1); c.fill(); wet(); break; }
      case 'head': c.fillStyle = '#76523f'; c.beginPath(); c.arc(0, 0, S * .78, 0, 7); c.fill(); c.stroke(); c.fillStyle = hb; c.beginPath(); c.arc(0, 0, S * .78, -1.9, .3); c.lineTo(0, 0); c.closePath(); c.fill(); c.stroke(); c.fillStyle = hd; c.beginPath(); c.arc(S * .3, -S * .25, S * .14, 0, 7); c.fill(); c.fillStyle = fl.col; c.beginPath(); c.ellipse(-S * .1, S * .55, S * .5, S * .22, 0, 0, 7); c.fill(); break;
      case 'plate': c.fillStyle = hb; c.beginPath(); c.moveTo(-S, -S * .5); c.lineTo(S * .9, -S * .72); c.lineTo(S, S * .6); c.lineTo(-S * .6, S * .82); c.closePath(); c.fill(); c.stroke(); c.fillStyle = hd; c.beginPath(); c.moveTo(-S * .6, S * .82); c.lineTo(S, S * .6); c.lineTo(S * .95, S * .35); c.lineTo(-S * .7, S * .55); c.closePath(); c.fill();
        c.fillStyle = hm; c.fillRect(-S * .55, -S * .3, S * .7, S * .12); c.fillStyle = hd; for (const [bx, by] of [[-S * .7, -S * .35], [S * .65, -S * .5], [S * .7, S * .35]]) { c.beginPath(); c.arc(bx, by, S * .1, 0, 7); c.fill(); } c.fillStyle = fl.col; c.globalAlpha = .6; c.beginPath(); c.ellipse(-S * .2, S * .45, S * .3, S * .14, 0, 0, 7); c.fill(); c.globalAlpha = 1; break;
      case 'servo': c.fillStyle = '#4a4744'; c.fillRect(-S * .15, -S * .2, S * 1.15, S * .4); c.strokeRect(-S * .15, -S * .2, S * 1.15, S * .4); c.fillStyle = '#8a857a'; c.fillRect(S * .2, -S * .08, S * .8, S * .16); // piston rod
        c.fillStyle = hb; c.beginPath(); c.arc(-S * .35, 0, S * .55, 0, 7); c.fill(); c.stroke(); c.fillStyle = hd; c.beginPath(); c.arc(-S * .35, 0, S * .22, 0, 7); c.fill(); c.strokeStyle = hm; c.lineWidth = Math.max(1, S * .08); c.beginPath(); c.arc(-S * .35, 0, S * .4, .4, 2.2); c.stroke(); break;
      case 'cable': c.lineCap = 'round'; c.strokeStyle = 'rgba(16,12,10,.9)'; c.lineWidth = Math.max(2, S * .34); const path = () => { c.beginPath(); c.moveTo(-S * 1.1, S * .2); c.bezierCurveTo(-S * .4, -S * .9, S * .3, S * .9, S * 1.1, -S * .3); }; path(); c.stroke(); c.strokeStyle = '#2a2826'; c.lineWidth = Math.max(1, S * .22); path(); c.stroke();
        c.strokeStyle = hb; c.lineWidth = Math.max(1, S * .1); path(); c.stroke(); c.fillStyle = '#9a8e76'; c.fillRect(S * .95, -S * .45, S * .3, S * .3); c.fillStyle = fl.col; c.beginPath(); c.arc(-S * 1.1, S * .2, S * .2, 0, 7); c.fill(); break;
      default: c.fillStyle = hb; c.beginPath(); c.moveTo(0, -S); c.lineTo(S * .7, S * .6); c.lineTo(-S * .7, S * .6); c.closePath(); c.fill(); c.stroke(); c.fillStyle = hd; c.beginPath(); c.moveTo(0, -S); c.lineTo(S * .7, S * .6); c.lineTo(0, S * .3); c.closePath(); c.fill();
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; const gr = c.createLinearGradient(0, 0, W, W); gr.addColorStop(0, 'rgba(230,210,190,.14)'); gr.addColorStop(.45, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(8,5,4,.5)'); c.fillStyle = gr; c.fillRect(0, 0, W, W);
    let q = W * 7 + k.kind.length; const rr = () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; c.fillStyle = k.metal ? 'rgba(30,24,18,.28)' : 'rgba(25,6,4,.35)'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(rr() * W, rr() * W, .6 + rr() * W * .06, 0, 7); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    this.gtex.set(key, cv); return cv;
  }
  private shadowTex: HTMLCanvasElement | null = null;
  drawChunk(r: any, k: Chunk) {
    const g = r.g, c = r.ctx, t = g.time, TW = r.TW, a = t - k.t0; if (a < 0) return; const [wx, wy, z, done] = this.pos(k, t); const tl = k.pn * k.dt; const rot = k.rot + k.spin * Math.min(a, tl);
    if (done && !k.landed) { k.landed = true; if (goreMode(g) === 'bloody') this.decal(g, wx, wy, (k.big ? .9 : .4) * (k.metal ? .6 : 1), k.fl, k.metal ? .55 : .85); }
    const px = r.sx(wx, wy), py = r.sy(wx, wy) - z * TW * .5, s = TW * .13 * k.size; if (px < -40 || px > r.w + 40 || py < -40 || py > r.h + 40) return; const fade = Math.max(0, Math.min(1, (k.life - a) / 4));
    if (!this.shadowTex) { const sc = document.createElement('canvas'); sc.width = 32; sc.height = 14; const x = sc.getContext('2d')!; x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(16, 7, 15, 6, 0, 0, 7); x.fill(); this.shadowTex = sc; }
    c.globalAlpha = fade; c.drawImage(this.shadowTex, px - s * .85, py + z * TW * .5 - s * .38, s * 1.7, s * .76);
    const q = r.dpr || 1, sp = this.gibSprite(k, s * q), W = sp.width / q;
    c.save(); c.translate(px, py); c.rotate(rot); c.drawImage(sp, -W / 2, -W / 2, W, W); c.restore(); c.globalAlpha = 1;
  }
  /** subtle screen-edge spray after a heavy kill close to the player (alpha <= .16, ~1.4 s, never with Reduced FX; the flash guard was consulted when it was queued) */
  drawScreen(r: any) {
    const g = r.g; const e = this.edge; if (!e || g.save.settings.reducedFx) { this.edge = null; return; } const age = g.time - e.t0; if (age > 1.4) { this.edge = null; return; } const a = .16 * (age < .12 ? age / .12 : 1 - (age - .12) / 1.28); if (a <= .01) return; const c = r.ctx; c.save(); c.globalAlpha = a; c.fillStyle = e.fl.col;
    let s = e.seed * 1000 + 3; const q = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 9; i++) { const side = (q() * 4) | 0, u = q(), rr = 10 + q() * 30; const px = side === 0 ? u * r.w : side === 1 ? u * r.w : side === 2 ? 0 : r.w, py = side === 0 ? 0 : side === 1 ? r.h : u * r.h; c.beginPath(); c.ellipse(px, py, rr * (side > 1 ? .6 : 1.3), rr * (side > 1 ? 1.3 : .6), 0, 0, 7); c.fill(); }
    c.restore();
  }
}
export const GORE = new GoreSys();
(globalThis as any).__gore = (globalThis as any).__gore || GORE; // test hook; first instance wins (a dev-server re-import must not shadow the live one)
