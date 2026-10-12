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
export function bodyOf(type: string): Body { return BESTIARY_BODY[type] || (ORGANIC.has(type) ? 'organic' : HYBRID.has(type) ? 'hybrid' : SPECTRAL.has(type) ? 'spectral' : 'machine'); }
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
  if (b === 'organic') return [pri]; if (b === 'hybrid') return [pri, FLUIDS.coolant]; return [type.includes('doll') || type === 'fittingdoll' ? FLUIDS.oil : FLUIDS.coolant, FLUIDS.oil];
}
interface Decal { x: number; y: number; r: number; t0: number; life: number; a: number; fl: Fluid; sh: number; flip: number }
interface Chunk { x: number; y: number; vx: number; vy: number; z: number; vz: number; t0: number; life: number; kind: 'limb' | 'head' | 'lump' | 'plate' | 'shard'; fl: Fluid; metal: boolean; size: number; rot: number; spin: number; landed: boolean; big: boolean }
interface Drop { x: number; y: number; z: number; vx: number; vy: number; vz: number; t0: number; life: number; col: string; s: number; spark: boolean }
export const CAPS: Record<'high' | 'medium' | 'low', { decals: number; chunks: number; drops: number }> = { high: { decals: 160, chunks: 48, drops: 150 }, medium: { decals: 70, chunks: 22, drops: 60 }, low: { decals: 32, chunks: 10, drops: 24 } };
const G = 16, DECAL_LIFE = [34, 52];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const caps = () => CAPS[Q.tier] || CAPS.high;
interface Info { ang: number; heavy: boolean; dmg: number; bits: number }
const info = new WeakMap<object, Info>();

class GoreSys {
  decals: Decal[] = []; chunks: Chunk[] = []; drops: Drop[] = []; edge: { t0: number; seed: number; fl: Fluid } | null = null;
  private lvl: any = null; private inst: any = null; private sweepAt = 0; private budgetT = 0; private budget = 0; stats = { spawned: 0, cleared: 0, dropsCapped: 0 };
  reset() { this.stats.cleared += this.decals.length + this.chunks.length + this.drops.length; this.decals.length = 0; this.chunks.length = 0; this.drops.length = 0; this.edge = null; }
  counts() { return { decals: this.decals.length, chunks: this.chunks.length, drops: this.drops.length }; }
  /** true while gore may exist/draw for this game state */
  private active(g: any) { return goreMode(g) !== 'off' && g.mode === 'run' && g.level?.kind !== 'town'; }
  sync(g: any) { if (g.level !== this.lvl || g.inst !== this.inst || !this.active(g)) { if (this.decals.length || this.chunks.length || this.drops.length || this.edge) this.reset(); this.lvl = g.level; this.inst = g.inst; } }
  private take(g: any, n: number) { if (g.time - this.budgetT > .12) { this.budgetT = g.time; this.budget = 0; } if (this.budget + n > 60) return false; this.budget += n; return true; }
  private decal(g: any, x: number, y: number, r: number, fl: Fluid, a = .85, delay = 0) {
    if (g.solidAt?.(x, y)) return; const c = caps(), red = !!g.save.settings.reducedFx; if (this.decals.length >= (red ? c.decals >> 1 : c.decals)) this.decals.shift();
    this.decals.push({ x, y, r, t0: g.time + delay, life: rnd(DECAL_LIFE[0], DECAL_LIFE[1]) * (fl.kind === 'oil' ? 1.15 : 1), a, fl, sh: (Math.random() * 6) | 0, flip: Math.random() < .5 ? -1 : 1 }); this.stats.spawned++;
  }
  private drop(g: any, x: number, y: number, ang: number, sp: number, fl: Fluid, spark = false) {
    if (g.save.settings.reducedFx) return; const c = caps(); if (this.drops.length >= c.drops) { this.stats.dropsCapped++; return; }
    const a = ang + rnd(-.9, .9), s = sp * rnd(.5, 1.1); this.drops.push({ x, y, z: rnd(.3, .9), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(2, 5.5), t0: g.time, life: spark ? rnd(.18, .34) : 1.1, col: spark ? '#f0c060' : Math.random() < .35 ? fl.dk : fl.col, s: spark ? 1.4 : rnd(1.2, 2.4), spark });
  }
  private chunk(g: any, e: any, kind: Chunk['kind'], fl: Fluid, metal: boolean, ang: number, power: number, size: number, big = false) {
    const c = caps(); if (this.chunks.length >= c.chunks) this.chunks.shift(); const a = ang + rnd(-.8, .8), s = power * rnd(.6, 1.1), red = !!g.save.settings.reducedFx;
    const ch: Chunk = { x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, z: rnd(.4, 1.0), vz: rnd(3, 6.5) * (big ? 1.2 : 1), t0: g.time, life: rnd(26, 42), kind, fl, metal, size, rot: Math.random() * 6.28, spin: rnd(-9, 9), landed: false, big };
    for (let i = 0; i < 6; i++) { const tl = (ch.vz + Math.sqrt(ch.vz * ch.vz + 2 * G * ch.z)) / G; if (!g.solidAt?.(ch.x + ch.vx * tl * 1.3, ch.y + ch.vy * tl * 1.3)) break; ch.vx *= .6; ch.vy *= .6; } // never land inside a wall / the void
    if (red) { ch.t0 = g.time - 3; ch.vx *= .2; ch.vy *= .2; ch.spin = 0; } this.chunks.push(ch);
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
    const inf = info.get(e) || { ang: Math.random() * 6.28, heavy: false, dmg: 0, bits: 0 }, bloody = mode === 'bloody'; const ang = inf.ang, big = !!def.boss; const heavy = inf.heavy || inf.dmg >= e.maxHp * .9 || big;
    fls.forEach((fl, i) => { const mech = fl.kind === 'coolant' || fl.kind === 'oil'; this.decal(g, e.x + (i ? rnd(-.3, .3) : 0), e.y + (i ? rnd(-.3, .3) : 0), (bloody ? rnd(.8, 1.2) : rnd(.5, .7)) * (big ? 2 : def.elite ? 1.3 : 1) * (i ? .7 : 1), fl, .9); if (bloody) { for (let k = 0; k < (big ? 3 : 2); k++) this.decal(g, e.x + rnd(-1.3, 1.3), e.y + rnd(-1.3, 1.3), rnd(.25, .6), fl, .8); }
      for (let k = 0; k < (bloody ? (big ? 36 : 18) : 6) / (i + 1); k++) this.drop(g, e.x, e.y, ang, bloody ? 6.5 : 3.2, fl, mech && bloody && k % 4 === 0); });
    if (bloody) {
      const fl = fls[0], mech = fl.kind === 'coolant' || fl.kind === 'oil'; const nG = big ? 6 : heavy ? 4 : 2;
      for (let k = 0; k < nG; k++) this.chunk(g, e, mech ? (k % 2 ? 'plate' : 'lump') : 'lump', fl, mech, ang, 4 + (heavy ? 3 : 0), big ? 1.8 : rnd(.5, .8));
      if (heavy) { // dismemberment: limbs and a head
        const kinds: Chunk['kind'][] = ['limb', 'limb', 'head']; for (const k of kinds.slice(0, big ? 3 : 2 + (Math.random() < .5 ? 1 : 0))) this.chunk(g, e, mech && k !== 'limb' ? 'plate' : k, fl, mech, ang, 6.5, big ? 2.2 : 1, big);
        if (!g.save.settings.reducedFx && Math.hypot(e.x - g.px, e.y - g.py) < 6 && flashAllowed(false)) this.edge = { t0: g.time, seed: Math.random() * 99, fl };
      }
      g.emit?.('sfx', big ? 'gore_pop' : heavy ? 'gore_gib' : 'gore_wet');
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
  drawGround(r: any) {
    const g = r.g; this.sync(g); if (!this.decals.length) return; const c = r.ctx, t = g.time, TW = r.TW; c.save();
    if (t - this.sweepAt > 1) { this.sweepAt = t; this.decals = this.decals.filter(d => t - d.t0 < d.life); }
    for (const d of this.decals) { const age = t - d.t0; if (age < 0) continue; const a = d.a * Math.min(1, age / .25) * (age > d.life * .6 ? 1 - (age - d.life * .6) / (d.life * .4) : 1); if (a <= .02) continue; const sx = r.sx(d.x, d.y), sy = r.sy(d.x, d.y), w = d.r * TW * 1.25; if (sx < -w || sx > r.w + w || sy < -w || sy > r.h + w) continue; const grow = Math.min(1, .55 + age * 2.2); c.globalAlpha = a; c.drawImage(this.splat(d.fl, d.sh), sx - w * grow * d.flip / 2 * (d.flip < 0 ? -1 : 1), sy - w * grow / 4, w * grow * d.flip, w * grow / 2); }
    c.restore();
  }
  drawAir(r: any) {
    const g = r.g; if (!this.active(g) || (!this.chunks.length && !this.drops.length)) return; const c = r.ctx, t = g.time, TW = r.TW; c.save();
    if (this.drops.length) { this.drops = this.drops.filter(d => t - d.t0 < d.life); }
    for (const d of this.drops) { const a = t - d.t0, z = d.z + d.vz * a - .5 * G * a * a; if (z < 0) { if (!d.spark && a < d.life - .3) d.life = a + .3; } const zz = Math.max(0, z), px = r.sx(d.x + d.vx * a, d.y + d.vy * a), py = r.sy(d.x + d.vx * a, d.y + d.vy * a) - zz * TW * .5; c.globalAlpha = Math.max(0, Math.min(1, (d.life - a) / .25)); c.fillStyle = d.col; if (d.spark) { c.fillRect(px - 1, py - 1, 2.2, 2.2); } else { c.beginPath(); c.ellipse(px, py, d.s, d.s * (z > 0 ? 1.35 : .6), 0, 0, 7); c.fill(); } }
    this.chunks = this.chunks.filter(k => t - k.t0 < k.life);
    for (const k of this.chunks) {
      const a = t - k.t0, tl = (k.vz + Math.sqrt(k.vz * k.vz + 2 * G * k.z)) / G; let wx: number, wy: number, z = 0, rot = k.rot;
      if (a < tl) { wx = k.x + k.vx * a; wy = k.y + k.vy * a; z = k.z + k.vz * a - .5 * G * a * a; rot += k.spin * a; }
      else { const lx = k.x + k.vx * tl, ly = k.y + k.vy * tl, b = a - tl, sl = 1 - Math.exp(-b * 4) * 1; wx = lx + k.vx * .22 * sl; wy = ly + k.vy * .22 * sl; const vb = (k.vz - G * tl) * -.28, tb = 2 * vb / G; z = b < tb ? Math.max(0, vb * b - .5 * G * b * b) : 0; rot += k.spin * tl + (b < .5 ? k.spin * b * .4 : k.spin * .2);
        if (!k.landed && b > .05) { k.landed = true; const mode = goreMode(g); if (mode === 'bloody') this.decal(g, wx, wy, k.big ? .9 : .4, k.fl, .85); } }
      const px = r.sx(wx, wy), py = r.sy(wx, wy) - z * TW * .5, s = TW * .13 * k.size; if (px < -40 || px > r.w + 40 || py < -40 || py > r.h + 40) continue; const fade = Math.min(1, (k.life - a) / 4);
      c.globalAlpha = fade; c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(px, py + z * TW * .5, s * .8, s * .35, 0, 0, 7); c.fill();
      c.save(); c.translate(px, py); c.rotate(rot); c.lineWidth = 1.2; c.strokeStyle = 'rgba(14,10,8,.85)';
      const body = k.metal ? '#6a6a68' : k.fl.col, edge = k.metal ? '#3a3a3a' : k.fl.dk; c.fillStyle = body;
      if (k.kind === 'limb') { c.beginPath(); c.moveTo(-s * 1.1, -s * .32); c.lineTo(s * 1.1, -s * .2); c.lineTo(s * 1.1, s * .2); c.lineTo(-s * 1.1, s * .34); c.closePath(); c.fill(); c.stroke(); c.fillStyle = k.metal ? '#aaa' : '#d8cfc0'; c.beginPath(); c.arc(-s * 1.1, 0, s * .26, 0, 7); c.fill(); c.fillStyle = edge; c.beginPath(); c.arc(s * 1.1, 0, s * .3, 0, 7); c.fill(); }
      else if (k.kind === 'head') { c.beginPath(); c.arc(0, 0, s * .8, 0, 7); c.fill(); c.stroke(); c.fillStyle = k.metal ? '#ffb040' : 'rgba(10,6,6,.8)'; c.beginPath(); c.arc(s * .25, -s * .1, s * .16, 0, 7); c.fill(); }
      else if (k.kind === 'plate') { c.fillStyle = '#5c5c5a'; c.beginPath(); c.moveTo(-s, -s * .5); c.lineTo(s * .9, -s * .7); c.lineTo(s, s * .6); c.lineTo(-s * .6, s * .8); c.closePath(); c.fill(); c.stroke(); c.fillStyle = k.fl.col; c.fillRect(-s * .3, -s * .1, s * .7, s * .2); }
      else if (k.kind === 'shard') { c.beginPath(); c.moveTo(0, -s); c.lineTo(s * .7, s * .6); c.lineTo(-s * .7, s * .6); c.closePath(); c.fill(); }
      else { c.beginPath(); c.moveTo(-s, 0); c.quadraticCurveTo(-s * .6, -s * .9, s * .3, -s * .7); c.quadraticCurveTo(s * 1.1, -s * .2, s * .6, s * .7); c.quadraticCurveTo(-s * .2, s * 1.0, -s, 0); c.fill(); c.stroke(); c.fillStyle = edge; c.beginPath(); c.arc(-s * .1, s * .1, s * .3, 0, 7); c.fill(); }
      if (!k.metal) { c.fillStyle = 'rgba(255,230,220,.22)'; c.beginPath(); c.ellipse(-s * .25, -s * .3, s * .22, s * .1, -.5, 0, 7); c.fill(); }
      c.restore();
    }
    c.restore();
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
