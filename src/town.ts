// Illustrated town hub: AI-generated, keyed-out prop sprites (public/town/props, cut by tools/town/cut.py), seamless ground textures
// (public/town/ground), a prebaked world-space ground canvas, idle-animated NPC silhouettes, steam/embers/dust and additive light pools.
// Everything heavy is baked once to offscreen canvases; per-frame work is drawImage of cached, pre-scaled sprites.
// Drop-in: replace any PNG in public/town/props with another of the same name (see public/town/manifest.json); missing files are skipped.
import type { Level, Decor } from './level';

export const TOWN_PROPS = ['stall_a','stall_clothes','stall_goods','stall_vendor_sign','fixer_booth','gate_arch','scaffold','steam_drums','npc1','npc2','npc3','npc4','lockers','fence','poster_wall','sign_fixer','stall_vendor','workbench','stall_awning','crates','barrels','lamp','cables','bench','junk','grate','vending','noticeboard','barrel_fire','awn_red','awn_blue','awn_green','awn_grey','swag1','swag2','swag3','bulbs','rags1','rags2','leanto','stall_noodle','stall_implant','stall_clinic','stall_weapons','stall_junk','board_jobs','banner_pole','np_kneel_l','np_kneel_r','np_woman_table','np_pair_talk','np_kid_l','np_kid_r','np_guard_l','np_guard_r','np_porter','np_hooded_wall','np_lantern_l','np_lantern_r','bld1','bld2','bld3','container','slab','gantry','barrier','barrier_corner'];
const GROUND = ['cobble','planks','debris','plaza'];
const rng = (seed: number) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const loadImg = (src: string) => new Promise<HTMLImageElement | null>(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
export const GP = 40; // ground canvas pixels per world tile
export interface Part { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; life: number; k: 'steam' | 'ember' | 'dust'; s: number; }

export class TownArt {
  img: Record<string, HTMLImageElement> = {}; gimg: Record<string, HTMLImageElement> = {}; ready = false; ground: HTMLCanvasElement | null = null;
  glows: Record<string, HTMLCanvasElement> = {}; parts: Part[] = []; private sc = new Map<string, HTMLCanvasElement>(); private scKey = ''; private em = 0; private R = rng(7);
  npcPos: { x: number; y: number; flip: boolean; moving: boolean }[] = [];
  constructor(private base = './town/') { this.load(); for (const [k, c] of [['warm', '255,176,96'], ['fire', '255,128,52'], ['cool', '120,150,160'], ['puff', '190,194,192']] as const) { const cv = mk(128, 128), x = cv.getContext('2d')!; const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${c},1)`); g.addColorStop(.35, `rgba(${c},.38)`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); this.glows[k] = cv; } }
  async load() {
    await Promise.all([...TOWN_PROPS.map(async n => { const i = await loadImg(`${this.base}props/${n}.png`); if (i) this.img[n] = i; }), ...GROUND.map(async n => { const i = await loadImg(`${this.base}ground/${n}.jpg`); if (i) this.gimg[n] = i; })]);
    this.ready = !!this.gimg.cobble && Object.keys(this.img).length > 8;
  }
  /** pre-scaled sprite (one cached canvas per sprite per zoom) so per-frame drawing is a 1:1 blit */
  scaled(name: string, wpx: number, dpr: number): { cv: HTMLCanvasElement; w: number; h: number } | null {
    const im = this.img[name]; if (!im) return null; const key = String(dpr); if (key !== this.scKey || this.sc.size > 600) { this.scKey = key; this.sc.clear(); }
    const k = name + '|' + Math.round(wpx * 4); let cv = this.sc.get(k); const w = wpx, h = wpx * im.height / im.width;
    if (!cv) { cv = mk(Math.ceil(w * dpr), Math.ceil(h * dpr)); const x = cv.getContext('2d')!; x.imageSmoothingQuality = 'high'; // two-step downscale keeps detail
      let src: CanvasImageSource = im, sw = im.width; while (sw > cv.width * 2) { const t = mk(sw / 2, (sw / 2) * im.height / im.width); const tx = t.getContext('2d')!; tx.imageSmoothingQuality = 'high'; tx.drawImage(src, 0, 0, t.width, t.height); src = t; sw = t.width; }
      x.drawImage(src, 0, 0, cv.width, cv.height); this.sc.set(k, cv); }
    return { cv, w: cv.width / dpr, h: cv.height / dpr }; // exact device-pixel size => 1:1 blit, no per-frame resampling
  }
  // ---------------- ground ----------------
  buildGround(L: Level) {
    const W = L.w * GP, H = L.h * GP; const cv = mk(W, H), x = cv.getContext('2d')!; const R = rng(11); const gi = this.gimg;
    const pat = (n: string, sc: number, rot = 0) => { const p = x.createPattern(gi[n], 'repeat')!; (p as any).setTransform?.(new DOMMatrix().rotate(rot).scale(sc)); return p; };
    x.fillStyle = '#1a1816'; x.fillRect(0, 0, W, H);
    // value noise mask helper: blobs of soft alpha, thresholded for organic edges
    const noiseMask = (seed: number, cell: number, thr: number, soft: number) => { const m = mk(W / 4, H / 4), mx = m.getContext('2d')!; const r = rng(seed); const gw = Math.ceil(m.width / cell) + 2, gh = Math.ceil(m.height / cell) + 2; const lat = Array.from({ length: gw * gh }, () => r()); const id = mx.createImageData(m.width, m.height);
      for (let yy = 0; yy < m.height; yy++) for (let xx = 0; xx < m.width; xx++) { const fx = xx / cell, fy = yy / cell, x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); const a = lat[y0 * gw + x0], b = lat[y0 * gw + x0 + 1], c = lat[(y0 + 1) * gw + x0], d = lat[(y0 + 1) * gw + x0 + 1]; let v = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy; v += (r() - .5) * .06; const al = Math.max(0, Math.min(1, (v - thr) / soft)); const i = (yy * m.width + xx) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = al * 255; }
      mx.putImageData(id, 0, 0); return m; };
    const layer = (fill: (c: CanvasRenderingContext2D) => void, mask: HTMLCanvasElement | ((c: CanvasRenderingContext2D) => void), alpha = 1) => { const t = mk(W, H), tx = t.getContext('2d')!; fill(tx); tx.globalCompositeOperation = 'destination-in'; if (typeof mask === 'function') mask(tx); else { tx.imageSmoothingEnabled = true; tx.drawImage(mask, 0, 0, W, H); } x.globalAlpha = alpha; x.drawImage(t, 0, 0); x.globalAlpha = 1; };
    // 1. wet cobble everywhere (two rotated passes break up tiling)
    x.fillStyle = pat('cobble', .95); x.fillRect(0, 0, W, H);
    layer(c => { c.fillStyle = pat('cobble', 1.15, 90); c.fillRect(0, 0, W, H); }, noiseMask(3, 14, .42, .25), .85);
    // 2. debris / dirt patches
    if (gi.debris) layer(c => { c.fillStyle = pat('debris', .9, 17); c.fillRect(0, 0, W, H); }, noiseMask(5, 10, .52, .18), .95);
    // 3. plank + plate walkways: lanes from plaza to each district
    const lanes: [number, number][][] = [[[20, 15], [12, 12], [8, 11]], [[20, 15], [11, 16], [6, 17]], [[20, 15], [25, 12], [31, 12]], [[20, 15], [22, 20], [18, 24]], [[20, 15], [27, 19], [34, 21]], [[20, 15], [19, 9], [18, 7]], [[20, 15], [13, 20], [9, 22]]];
    if (gi.planks) { const lm = mk(W, H), lx = lm.getContext('2d')!; lx.lineCap = 'round'; lx.lineJoin = 'round'; for (let pass = 0; pass < 5; pass++) { lx.strokeStyle = `rgba(255,255,255,${pass === 4 ? .9 : .22})`; lx.lineWidth = (2.3 - pass * .28) * GP; for (const ln of lanes) { lx.beginPath(); ln.forEach(([px, py], i) => { const jx = Math.sin(px * 3.1 + py) * .35, jy = Math.cos(px + py * 2.7) * .35; i ? lx.lineTo((px + jx) * GP, (py + jy) * GP) : lx.moveTo((px + jx) * GP, (py + jy) * GP); }); lx.stroke(); } }
      const edge = noiseMask(8, 5, .3, .35); lx.globalCompositeOperation = 'destination-in'; lx.drawImage(edge, 0, 0, W, H); layer(c => { c.fillStyle = pat('planks', .8, 27); c.fillRect(0, 0, W, H); }, c => c.drawImage(lm, 0, 0), .9); }
    // 4. central plaza with drain grate (non-tiling image, feathered into the surroundings)
    if (gi.plaza) { const pw = 17 * GP, ph = 17 * GP, cx = 20 * GP, cy = 15 * GP; const t = mk(pw, ph), tx = t.getContext('2d')!; tx.drawImage(gi.plaza, 0, 0, pw, ph); tx.globalCompositeOperation = 'destination-in'; const g = tx.createRadialGradient(pw / 2, ph / 2, pw * .22, pw / 2, ph / 2, pw * .5); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.7, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); tx.fillStyle = g; tx.fillRect(0, 0, pw, ph); x.drawImage(t, cx - pw / 2, cy - ph / 2); }
    // 5. painted markings and wear
    x.save(); x.font = `bold ${GP * .8}px "Arial Narrow",Impact,sans-serif`; x.textAlign = 'center'; x.fillStyle = 'rgba(207,198,176,.16)'; x.save(); x.translate(20 * GP, 23 * GP); x.fillText('REPAIR MARKET', 0, 0); x.restore();
    x.strokeStyle = 'rgba(176,150,70,.22)'; x.lineWidth = GP * .14; x.setLineDash([GP * .5, GP * .4]); x.strokeRect(32.2 * GP, 20.2 * GP, 4.6 * GP, 3.6 * GP); x.setLineDash([]); x.restore();
    // 6. puddles with cool sheen
    for (let i = 0; i < 14; i++) { const px = (8 + R() * 24) * GP, py = (7 + R() * 17) * GP, rx = (.5 + R() * 1.4) * GP, ry = rx * (.45 + R() * .3); const g = x.createRadialGradient(px, py, 0, px, py, rx); g.addColorStop(0, 'rgba(40,52,60,.55)'); g.addColorStop(.7, 'rgba(30,38,44,.35)'); g.addColorStop(1, 'rgba(30,38,44,0)'); x.save(); x.translate(px, py); x.rotate(R() * 3); x.scale(1, ry / rx); x.translate(-px, -py); x.fillStyle = g; x.beginPath(); x.arc(px, py, rx, 0, 7); x.fill(); x.fillStyle = 'rgba(170,185,195,.1)'; x.beginPath(); x.arc(px - rx * .2, py - rx * .15, rx * .45, 0, 7); x.fill(); x.restore(); }
    // 7. soft contact shadows under every decor footprint, and rim darkening toward solid tiles
    for (const d of L.decor || []) { const cx = (d.x + d.fw / 2) * GP, cy = (d.y + d.fd / 2) * GP, rx = (d.fw + .6) * GP * .65, ry = (d.fd + .6) * GP * .65; const g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry)); g.addColorStop(0, 'rgba(4,4,5,.55)'); g.addColorStop(1, 'rgba(4,4,5,0)'); x.fillStyle = g; x.save(); x.translate(cx + GP * .25, cy + GP * .3); x.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); x.translate(-cx, -cy); x.beginPath(); x.arc(cx, cy, Math.max(rx, ry), 0, 7); x.fill(); x.restore(); }
    for (let ty = 0; ty < L.h; ty++) for (let tx = 0; tx < L.w; tx++) { if (!L.solid[ty * L.w + tx]) continue; const px = (tx + .5) * GP, py = (ty + .5) * GP; const g = x.createRadialGradient(px, py, GP * .3, px, py, GP * 1.9); g.addColorStop(0, 'rgba(6,6,8,.8)'); g.addColorStop(1, 'rgba(6,6,8,0)'); x.fillStyle = g; x.fillRect(px - GP * 2, py - GP * 2, GP * 4, GP * 4); }
    // 8. baked warm/cool light pools
    x.globalCompositeOperation = 'screen'; for (const l of L.lights || []) { const gl = this.glows[l.c]; const r = l.r * GP * .7; x.globalAlpha = Math.min(.55, l.a * 1.1); x.drawImage(gl, l.x * GP - r, l.y * GP - r, r * 2, r * 2); } x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    this.ground = cv;
  }
  // ---------------- ambient ----------------
  update(dt: number, L: Level, t: number, px: number, py: number) {
    const R = this.R; this.em -= dt;
    if (this.em <= 0) { this.em = .12; for (const d of L.decor || []) { if (d.steam && R() < .8) this.parts.push({ x: d.x + d.fw * .4 + R() * .3, y: d.y + d.fd * .4 + R() * .3, z: 1.4, vx: (R() - .3) * .1, vy: (R() - .3) * .1, vz: .5 + R() * .3, t: 0, life: 2.6 + R(), k: 'steam', s: .25 + R() * .2 }); if (d.glow === 'fire' && R() < .5) this.parts.push({ x: d.x + .5 + (R() - .5) * .3, y: d.y + .5 + (R() - .5) * .3, z: .9, vx: (R() - .5) * .3, vy: (R() - .5) * .3, vz: .8 + R(), t: 0, life: 1.2 + R(), k: 'ember', s: .05 }); }
      if (this.parts.length < 90 && R() < .6) this.parts.push({ x: px + (R() - .5) * 18, y: py + (R() - .5) * 18, z: .3 + R() * 1.6, vx: (R() - .5) * .25, vy: (R() - .5) * .25, vz: (R() - .5) * .05, t: 0, life: 5 + R() * 3, k: 'dust', s: .03 }); }
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.k === 'steam') p.s += dt * .22; }
    this.parts = this.parts.filter(p => p.t < p.life);
    // npc wander
    for (let i = 0; i < (L.npcs || []).length; i++) { const n = L.npcs![i]; let s = this.npcPos[i]; if (!s) s = this.npcPos[i] = { x: n.x, y: n.y, flip: false, moving: false };
      if (n.wander) { const cyc = ((t * (n.speed || .3) * .05 + n.ph) % 2); const u = cyc < 1 ? cyc : 2 - cyc; const e = u < .12 ? 0 : u > .88 ? 1 : (u - .12) / .76; const nx = n.x + (n.wander[0] - n.x) * e, ny = n.y + (n.wander[1] - n.y) * e; s.moving = Math.hypot(nx - s.x, ny - s.y) > .0004; if (s.moving) s.flip = (nx - s.x) - (ny - s.y) < 0; s.x = nx; s.y = ny; } }
  }
}
export function decorDepth(d: Decor) { return d.x + d.fw / 2 + d.y + d.fd / 2 + .6; }
