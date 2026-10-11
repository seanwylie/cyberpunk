// Town pedestrians ("townfolk"): continuous, velocity-based walkers that reuse the player's Blender rig (8-direction `walk` + `idle` sheets,
// tinted per outfit). Replaces the old ping-pong lerp + sine "step bob" on static silhouettes.
//  * movement: A* over the town's solid grid (with clearance) + string-pulled waypoints; speed ramps (accel/decel), heading turns at a bounded
//    rate, speed drops in sharp turns and when arriving, pauses + idle look-arounds at waypoints, separation from each other and the player.
//  * animation: walk-cycle phase advances by DISTANCE travelled (STRIDE_TILES per cycle, matched to the baked foot travel) => no foot sliding;
//    idle plays on time; walk<->idle cross-fades; the displayed facing steps one 45deg notch at a time.
import type { Level } from './level';
import { dirFromWorld, type Dir8, type LoadedAtlas } from './sprites';

/** World tiles covered per walk cycle. Derived from the baked rig: body travel per cycle = 2*A/D = 0.667 model units (tools/sprites/poses.py WALK_A/WALK_D);
 *  the run cycle covers 1.636 units in COMBAT.playerSpeed * 16/34 tiles => 1.611 tiles per model unit => 1.074 tiles/cycle. */
export const STRIDE_TILES = 1.074;
export const WALK_FRAMES = 16, IDLE_FRAMES = 12, IDLE_FPS = 7;
export const CRUISE = 1.25, ACCEL = 2.4, DECEL = 3.6, TURN_MOVING = 3.2, TURN_STILL = 6, WALK_ON = .14, WALK_OFF = .06;
const TINTS = ['#a6adb2', '#b4a692', '#93a595', '#a995b0', '#b89a96', '#93a6b8', '#bdb48e', '#9c9c9c', '#b9a0b0', '#8fb0ab']; // muted outfit tints (multiply) so walkers sit in the town's dim lighting

export interface Walker {
  x: number; y: number; vx: number; vy: number; speed: number; heading: number; aim: number;
  state: 'idle' | 'walk'; pause: number; path: [number, number][]; pi: number; goal: [number, number] | null;
  cyc: number; idleT: number; mode: 'walk' | 'idle'; dir: Dir8; dk: number; dkT: number; fade: number; prev: { mode: 'walk' | 'idle'; cyc: number; idleT: number; dir: Dir8 } | null;
  tint: string; scale: number; cruise: number; stride: number; ph: number; blockT: number; lookT: number; lastX: number; lastY: number; stuckT: number; id: number; src: number;
}
const mulberry = (a: number) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const angDiff = (a: number, b: number) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export class Townfolk {
  walkers: Walker[] = []; wp: [number, number][] = []; private clear: Uint8Array; private R = mulberry(1);
  constructor(public L: Level, hub: [number, number], avoid: { x: number; y: number }[], count: number, wanderNpcs: { x: number; y: number }[], radius = 17) {
    const { w, h, solid } = L; this.clear = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { let ok = 1; for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (solid[(y + dy) * w + x + dx]) { ok = 0; break; } this.clear[y * w + x] = ok; }
    // flood fill from the clear tile nearest the hub; waypoints = lattice of reachable clear tiles near the hub, away from station pads
    const near = this.nearestClear(hub[0], hub[1]); const reach = new Uint8Array(w * h); const q = [near]; reach[near] = 1;
    for (let i = 0; i < q.length; i++) { const c = q[i], cx = c % w, cy = (c / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (cy + dy) * w + cx + dx; if (cx + dx < 0 || cy + dy < 0 || cx + dx >= w || cy + dy >= h || reach[n] || !this.clear[n]) continue; reach[n] = 1; q.push(n); } }
    this.reach = reach;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { if (!reach[y * w + x]) continue; if (Math.hypot(x + .5 - hub[0], y + .5 - hub[1]) > radius) continue; if (avoid.some(a => Math.hypot(a.x - x - .5, a.y - y - .5) < 3.2)) continue; this.wp.push([x + .5, y + .5]); }
    const R = mulberry(L.seed || (w * 131 + h)); this.R = R;
    const starts: [number, number][] = wanderNpcs.map(n => this.nearestWp(n.x, n.y)); while (starts.length < count && this.wp.length) starts.push(this.wp[(R() * this.wp.length) | 0]);
    starts.slice(0, count).forEach((s, i) => this.walkers.push(this.mk(i, s, i < wanderNpcs.length ? i : -1)));
  }
  reach: Uint8Array;
  private nearestClear(x: number, y: number) { const { w, h } = this.L; let best = 0, bd = 1e9; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.clear[j * w + i]) { const d = Math.hypot(i + .5 - x, j + .5 - y); if (d < bd) { bd = d; best = j * w + i; } } return best; }
  private nearestWp(x: number, y: number): [number, number] { let b = this.wp[0], bd = 1e9; for (const p of this.wp) { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; b = p; } } return b; }
  private mk(i: number, s: [number, number], src: number): Walker { const R = this.R; const hd = R() * Math.PI * 2; const sc = .94 + R() * .12;
    const wk: Walker = { x: s[0], y: s[1], vx: 0, vy: 0, speed: 0, heading: hd, aim: hd, state: 'idle', pause: .3 + R() * 3, path: [], pi: 0, goal: null, cyc: R(), idleT: R() * 5, mode: 'idle', dir: dirFromWorld(Math.cos(hd), Math.sin(hd)), dk: 0, dkT: 0, fade: 1, prev: null,
      tint: TINTS[i % TINTS.length], scale: sc, cruise: CRUISE * (.8 + R() * .35), stride: STRIDE_TILES * sc, ph: R() * 6, blockT: 0, lookT: 1 + R() * 3, lastX: s[0], lastY: s[1], stuckT: 0, id: i, src };
    wk.dk = ringIndex(hd); return wk; }

  // ---------- geometry ----------
  private blocked(x: number, y: number, r = .27) { const { w, h, solid } = this.L; for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) { const ix = Math.floor(x + dx), iy = Math.floor(y + dy); if (ix < 0 || iy < 0 || ix >= w || iy >= h || solid[iy * w + ix]) return true; } return false; }
  private los(ax: number, ay: number, bx: number, by: number) { const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / .2)); for (let i = 1; i <= n; i++) { const t = i / n; if (this.blocked(ax + (bx - ax) * t, ay + (by - ay) * t, .42)) return false; } return true; }
  /** A* over clear tiles (8-neighbour, no corner cutting), then string-pulled. */
  path(ax: number, ay: number, bx: number, by: number): [number, number][] {
    const { w, h } = this.L; const sx = Math.floor(ax), sy = Math.floor(ay), gx = Math.floor(bx), gy = Math.floor(by); let s = sy * w + sx; if (!this.clear[s]) s = this.nearestClear(ax, ay); const g = gy * w + gx; if (!this.clear[g]) return [];
    if (this.los(ax, ay, bx, by)) return [[bx, by]];
    const gs = new Float32Array(w * h).fill(1e9), from = new Int32Array(w * h).fill(-1), closed = new Uint8Array(w * h); const open: number[] = [s]; gs[s] = 0; const f = new Map<number, number>(); const hh = (c: number) => Math.hypot((c % w) - gx, ((c / w) | 0) - gy); f.set(s, hh(s));
    while (open.length) { let bi = 0; for (let i = 1; i < open.length; i++) if (f.get(open[i])! < f.get(open[bi])!) bi = i; const c = open.splice(bi, 1)[0]; if (c === g) break; closed[c] = 1; const cx = c % w, cy = (c / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const n = ny * w + nx; if (closed[n] || !this.clear[n]) continue; if (dx && dy && (!this.clear[cy * w + nx] || !this.clear[ny * w + cx])) continue; const ng = gs[c] + Math.hypot(dx, dy); if (ng < gs[n]) { gs[n] = ng; from[n] = c; f.set(n, ng + hh(n)); if (!open.includes(n)) open.push(n); } } }
    if (from[g] < 0 && s !== g) return []; const pts: [number, number][] = []; for (let c = g; c >= 0 && c !== s; c = from[c]) pts.push([(c % w) + .5, ((c / w) | 0) + .5]); pts.reverse(); pts[pts.length - 1] = [bx, by];
    const out: [number, number][] = []; let cx = ax, cy = ay, i = 0; while (i < pts.length) { let j = pts.length - 1; while (j > i && !this.los(cx, cy, pts[j][0], pts[j][1])) j--; out.push(pts[j]); cx = pts[j][0]; cy = pts[j][1]; i = j + 1; } return out;
  }
  private plan(wk: Walker) { for (let k = 0; k < 6; k++) { const t = this.wp[(this.R() * this.wp.length) | 0]; if (!t || Math.hypot(t[0] - wk.x, t[1] - wk.y) < 5) continue; const p = this.path(wk.x, wk.y, t[0], t[1]); if (p.length) { wk.path = p; wk.pi = 0; wk.goal = t; wk.state = 'walk'; wk.stuckT = 0; wk.lastX = wk.x; wk.lastY = wk.y; return; } } wk.pause = 1 + this.R() * 2; }

  // ---------- simulation ----------
  update(dt: number, px: number, py: number) { let r = dt; while (r > 1e-6) { const s = Math.min(r, 1 / 30); for (const w of this.walkers) this.step(w, s, px, py); r -= s; } }
  private step(w: Walker, dt: number, px: number, py: number) {
    w.idleT += dt; w.ph += dt;
    let ds = 0; let aim = w.aim;
    if (w.state === 'idle') { w.pause -= dt; w.lookT -= dt; if (w.lookT <= 0 && w.speed < .05) { w.aim = w.heading + (this.R() < .5 ? -1 : 1) * (Math.PI / 4 + this.R() * Math.PI / 2); w.lookT = 1.2 + this.R() * 3; } aim = w.aim; if (w.pause <= 0 && w.speed < .05) this.plan(w); }
    else {
      let tx = w.path[w.pi]?.[0], ty = w.path[w.pi]?.[1]; if (tx === undefined) { w.state = 'idle'; w.pause = 1.5 + this.R() * 4.5; w.lookT = .8; }
      else {
        let d = Math.hypot(tx - w.x, ty - w.y); const last = w.pi === w.path.length - 1;
        if (d < (last ? .12 : .45)) { w.pi++; if (last) { w.state = 'idle'; w.pause = 1.5 + this.R() * 5; w.lookT = .6 + this.R(); w.aim = w.heading; } }
        else {
          let ax = (tx - w.x) / d, ay = (ty - w.y) / d;
          // separation from other walkers + the player
          let rx = 0, ry = 0, slow = 1; const rep = (ox: number, oy: number, rad: number) => { const dx = w.x - ox, dy = w.y - oy, dd = Math.hypot(dx, dy); if (dd > rad || dd < 1e-4) return; const k = (rad - dd) / rad; rx += dx / dd * k * 1.6 + (-dy / dd) * k * .7; ry += dy / dd * k * 1.6 + (dx / dd) * k * .7; const ahead = (-dx * ax - dy * ay) / dd; if (ahead > .35 && dd < rad * .8) slow = Math.min(slow, .35 + dd / rad * .4); };
          for (const o of this.walkers) if (o !== w) rep(o.x, o.y, 1.15); rep(px, py, 1.5);
          let bx = ax + rx, by = ay + ry; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
          // never steer into a wall: if the avoidance heading would clip geometry within ~0.5 tile, follow the path instead (and ease off if even that is tight)
          if (this.blocked(w.x + bx * .5, w.y + by * .5, .36)) { bx = ax; by = ay; if (this.blocked(w.x + bx * .5, w.y + by * .5, .36)) slow = Math.min(slow, .4); }
          aim = Math.atan2(by, bx);
          let sp = w.cruise * slow; if (last) sp = Math.min(sp, .3 + d * 1.5);
          const err = Math.abs(angDiff(w.heading, aim)); sp *= err > 1.3 ? .12 : 1 - .6 * Math.min(1, err / 1.3); ds = sp;
        }
      }
    }
    // heading: bounded turn rate (faster when nearly stationary)
    const tr = (w.speed < .35 ? TURN_STILL : TURN_MOVING) * dt; const e = angDiff(w.heading, aim); if (w.state === 'walk' || w.speed > .05 || Math.abs(e) > .02) w.heading += Math.abs(e) < tr ? e : Math.sign(e) * tr;
    // speed: accel / decel
    w.speed += Math.max(-DECEL * dt, Math.min(ACCEL * dt, ds - w.speed)); if (w.speed < .002) w.speed = 0;
    w.vx = Math.cos(w.heading) * w.speed; w.vy = Math.sin(w.heading) * w.speed;
    const nx = w.x + w.vx * dt, ny = w.y + w.vy * dt; let mx = w.x, my = w.y;
    if (!this.blocked(nx, ny)) { mx = nx; my = ny; } else if (!this.blocked(nx, w.y)) mx = nx; else if (!this.blocked(w.x, ny)) my = ny; else { w.blockT += dt; w.speed *= .85; }
    const moved = Math.hypot(mx - w.x, my - w.y); w.x = mx; w.y = my; if (moved > 1e-6) w.blockT = 0;
    if (w.state === 'walk') { w.stuckT += dt; if (w.stuckT > 1.5) { if (Math.hypot(w.x - w.lastX, w.y - w.lastY) < .25) { w.state = 'idle'; w.pause = .2; } w.stuckT = 0; w.lastX = w.x; w.lastY = w.y; } }
    // animation state
    w.cyc += moved / w.stride;
    const nm: 'walk' | 'idle' = w.mode === 'walk' ? (w.speed > WALK_OFF ? 'walk' : 'idle') : (w.speed > WALK_ON ? 'walk' : 'idle');
    // displayed facing: continuous heading -> 8 notches with hysteresis, stepped (min dwell) so turns are visible but never flicker
    const kf = ringIndexF(w.state === 'walk' || w.speed > .1 ? w.heading : w.aim); const kd = ((w.dk % 8) + 8) % 8; if (Math.abs(ringDiff(kf, kd)) > .5 + .18) w.dk = ((Math.round(kf) % 8) + 8) % 8;
    const nd = ringToDir(w.dk); w.dkT -= dt;
    if (nd !== w.dir && w.dkT <= 0) { w.dir = nd; w.dkT = .06; }
    if (nm !== w.mode) { w.prev = { mode: w.mode, cyc: w.cyc, idleT: w.idleT, dir: w.dir }; w.fade = 0; w.mode = nm; }
    if (w.fade < 1) { w.fade = Math.min(1, w.fade + dt / .14); if (w.prev && w.prev.mode === 'walk') w.prev.cyc += moved / w.stride; if (w.prev) w.prev.idleT += dt; if (w.fade >= 1) w.prev = null; }
  }
}
// ring helpers (E=0,SE=1,S=2,SW=3,W=4,NW=5,N=6,NE=7 on the iso-projected plane) -- same maths as PlayerAnimator
const ringIndexF = (a: number) => { const dx = Math.cos(a), dy = Math.sin(a); return Math.atan2((dx + dy) / 2, dx - dy) / (Math.PI / 4); };
const ringIndex = (a: number) => ((Math.round(ringIndexF(a)) % 8) + 8) % 8;
const ringDiff = (a: number, b: number) => { const d = (((a - b) % 8) + 8) % 8; return d > 4 ? d - 8 : d; };
const ringToDir = (k: number): Dir8 => ((((k - 2) % 8) + 8) % 8) as Dir8;

// ---------- drawing ----------
let tmp: HTMLCanvasElement | null = null;
/** Draw one walker with feet at (x,y) screen px. unit = TW/64 (same scale basis as the player). Returns false if the atlas has no walk/idle sheets. */
export function drawWalker(c: CanvasRenderingContext2D, A: LoadedAtlas, w: Walker, x: number, y: number, unit: number): boolean {
  const walk = A.images.walk, idle = A.images.idle, wd = A.atlas.anims.walk, id = A.atlas.anims.idle; if (!walk || !idle || !wd || !id) return false;
  const W = A.atlas.frame.w, H = A.atlas.frame.h; const s = unit * w.scale * A.atlas.scale * (48 / (H * .6));
  c.save(); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y, 13 * s / w.scale * .95, 6 * s / w.scale * .95, 0, 0, 7); c.fill();
  if (!tmp) { tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; } const t = tmp.getContext('2d')!; t.clearRect(0, 0, W, H);
  const one = (mode: 'walk' | 'idle', cyc: number, it: number, dir: Dir8, al: number) => { const im = mode === 'walk' ? walk : idle, n = mode === 'walk' ? WALK_FRAMES : IDLE_FRAMES; const p = mode === 'walk' ? ((cyc % 1) + 1) % 1 * n : (it * IDLE_FPS) % n; const f = Math.floor(p) % n, fr = p - Math.floor(p), nf = (f + 1) % n; t.globalAlpha = al; t.drawImage(im, f * W, dir * H, W, H, 0, 0, W, H); if (fr > .004) { t.globalAlpha = al * fr; t.drawImage(im, nf * W, dir * H, W, H, 0, 0, W, H); } };
  if (w.prev && w.fade < 1) { one(w.prev.mode, w.prev.cyc, w.prev.idleT, w.prev.dir, 1); const f = w.fade * w.fade * (3 - 2 * w.fade); one(w.mode, w.cyc, w.idleT, w.dir, f); } else one(w.mode, w.cyc, w.idleT, w.dir, 1);
  { t.globalAlpha = 1; t.globalCompositeOperation = 'multiply'; t.fillStyle = w.tint; t.fillRect(0, 0, W, H); t.globalCompositeOperation = 'destination-in'; one(w.mode, w.cyc, w.idleT, w.dir, 1); t.globalCompositeOperation = 'source-over'; }
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(tmp, 0, 0, W, H, x - A.atlas.anchor.x * s, y - A.atlas.anchor.y * s, W * s, H * s);
  c.restore(); return true;
}
