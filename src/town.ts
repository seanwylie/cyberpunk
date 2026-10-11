// Illustrated town hub: AI-generated, keyed-out prop sprites (public/town/props, cut by tools/town/cut.py), seamless ground textures
// (public/town/ground), a prebaked world-space ground canvas, idle-animated NPC silhouettes, steam/embers/dust and additive light pools.
// Everything heavy is baked once to offscreen canvases; per-frame work is drawImage of cached, pre-scaled sprites.
// Drop-in: replace any PNG in public/town/props with another of the same name (see public/town/manifest.json); missing files are skipped.
import { Townfolk } from './townfolk';
import type { Level, Decor } from './level';
import { makeVault } from './town_vault';
import { RUSTLINE_STATIONS, drawIcon, type Station } from './stations';

export const TOWN_PROPS = ['stall_a','stall_clothes','stall_goods','stall_vendor_sign','fixer_booth','gate_arch','scaffold','steam_drums','npc1','npc2','npc3','npc4','lockers','fence','poster_wall','sign_fixer','stall_vendor','workbench','stall_awning','crates','barrels','lamp','cables','bench','junk','grate','vending','noticeboard','barrel_fire','awn_red','awn_blue','awn_green','awn_grey','swag1','swag2','swag3','bulbs','rags1','rags2','leanto','stall_noodle','stall_implant','stall_clinic','stall_weapons','stall_junk','board_jobs','banner_pole','np_kneel_l','np_kneel_r','np_woman_table','np_pair_talk','np_kid_l','np_kid_r','np_guard_l','np_guard_r','np_porter','np_hooded_wall','np_lantern_l','np_lantern_r','bld1','bld2','bld3','container','slab','gantry','barrier','barrier_corner','tram_platform'];
const GROUND = ['cobble','planks','debris','plaza'];
const rng = (seed: number) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const loadImg = (src: string) => new Promise<HTMLImageElement | null>(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

const FONTS = '"Roboto Condensed","Bahnschrift","Arial Narrow",Impact,sans-serif';
/** world-space station sign (pole + neon panel with the shared icon + big label), baked once to a canvas; 100px per tile */
export function makeSign(st: Station): HTMLCanvasElement {
  const W = 480, H = 560, cv = mk(W, H), c = cv.getContext('2d')!; const col = st.color;
  // pole + base
  c.fillStyle = '#17191c'; c.fillRect(W / 2 - 9, 138, 18, 392); c.fillStyle = col; c.globalAlpha = .75; c.fillRect(W / 2 - 2, 138, 4, 392); c.globalAlpha = 1; c.fillStyle = '#26292d'; c.fillRect(W / 2 - 34, 520, 68, 18);
  // panel with glow
  c.save(); c.shadowColor = col; c.shadowBlur = 26; c.fillStyle = '#0a0c0f'; c.strokeStyle = col; c.lineWidth = 7; const r = 16, x0 = 12, y0 = 18, pw = W - 24, ph = 120; c.beginPath(); c.moveTo(x0 + r, y0); c.arcTo(x0 + pw, y0, x0 + pw, y0 + ph, r); c.arcTo(x0 + pw, y0 + ph, x0, y0 + ph, r); c.arcTo(x0, y0 + ph, x0, y0, r); c.arcTo(x0, y0, x0 + pw, y0, r); c.closePath(); c.fill(); c.stroke(); c.restore();
  // colour band + icon medallion
  c.fillStyle = `rgba(${st.rgb},.18)`; c.fillRect(x0 + 6, y0 + 6, 150, ph - 12); c.save(); c.shadowColor = col; c.shadowBlur = 14; drawIcon(c, st.icon, x0 + 81, y0 + ph / 2, 52, col, 8); c.restore();
  // text
  c.textAlign = 'left'; c.textBaseline = 'middle'; let fs = 70; c.font = `800 ${fs}px ${FONTS}`; const label = st.name.toUpperCase(); while (c.measureText(label).width > 290 && fs > 36) { fs -= 4; c.font = `800 ${fs}px ${FONTS}`; }
  c.save(); c.shadowColor = col; c.shadowBlur = 12; c.fillStyle = '#fff'; c.fillText(label, x0 + 170, y0 + ph / 2 + 2); c.restore();
  if (false) { let vs = 34; c.font = `600 ${vs}px ${FONTS}`; while (c.measureText(st.verb.toUpperCase()).width > 285 && vs > 20) { vs -= 2; c.font = `600 ${vs}px ${FONTS}`; } c.fillStyle = col; c.fillText(st.verb.toUpperCase(), x0 + 170, y0 + 126); }
  // rivets
  c.fillStyle = '#2c3035'; for (const [rx, ry] of [[24, 30], [W - 24, 30], [24, y0 + ph - 12], [W - 24, y0 + ph - 12]]) { c.beginPath(); c.arc(rx, ry, 5, 0, 7); c.fill(); }
  return cv;
}
export const GP = 40; // ground canvas pixels per world tile
export interface Part { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; life: number; k: 'steam' | 'ember' | 'dust'; s: number; col?: string; }

/** Per-town art configuration. Defaults reproduce Rustline Market exactly. */
export interface TownCfg { stations?: Station[]; hub?: [number, number]; props?: string[]; ground?: string[]; /** logical ground slots -> file names */ g?: Partial<Record<'base' | 'debris' | 'planks' | 'plaza', string>>; /** secondary prop dir used for files missing in `base` */ fallbackBase?: string; puddles?: boolean; plazaSize?: number; /** extra ground passes drawn after the plaza (ember cracks etc.) */ extra?: (x: CanvasRenderingContext2D, W: number, H: number, art: TownArt) => void; }
export class TownArt {
  img: Record<string, HTMLImageElement> = {}; gimg: Record<string, HTMLImageElement> = {}; ready = false; ground: HTMLCanvasElement | null = null;
  glows: Record<string, HTMLCanvasElement> = {}; parts: Part[] = []; private sc = new Map<string, HTMLCanvasElement>(); private scKey = ''; private em = 0; private R = rng(7);
  /** continuous walkers (src/townfolk.ts); `folkActive` is set by the renderer when the walk atlas is loaded - then wandering NPC silhouettes are replaced by walkers */
  folk: Townfolk | null = null; folkLevel: Level | null = null; folkActive = false;
  npcPos: { x: number; y: number; flip: boolean; moving: boolean }[] = [];
  stations: Station[]; hub: [number, number];
  constructor(private base = './town/', public cfg: TownCfg = {}) { this.stations = cfg.stations || RUSTLINE_STATIONS; this.hub = cfg.hub || [30.5, 22.5]; this.load(); for (const [k, c] of [['warm', '255,176,96'], ['fire', '255,128,52'], ['cool', '120,150,160'], ['puff', '190,194,192'], ...this.stations.map(st => [st.key, st.rgb] as const)] as const) { const cv = mk(128, 128), x = cv.getContext('2d')!; const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${c},1)`); g.addColorStop(.35, `rgba(${c},.38)`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); this.glows[k] = cv; } }
  loaded = 0; total = 1;
  async load() { const PL = this.cfg.props || TOWN_PROPS, GL = this.cfg.ground || GROUND; this.total = PL.length + GL.length; const tick = () => { this.loaded++; (window as any).__loadPct = this.loaded / this.total; };
    await Promise.all([...PL.map(async n => { let i = await loadImg(`${this.base}props/${n}.png`); if (!i && this.cfg.fallbackBase) i = await loadImg(`${this.cfg.fallbackBase}props/${n}.png`); if (i) this.img[n] = i; tick(); }), ...GL.map(async n => { const i = await loadImg(`${this.base}ground/${n}.jpg`); if (i) this.gimg[n] = i; tick(); })]);
    for (const st of this.stations) this.img['sign_' + st.key] = makeSign(st) as any;
    this.img['bank_vault'] = makeVault() as any;
    this.ready = !!this.gimg[this.cfg.g?.base || 'cobble'] && Object.keys(this.img).length > 8;
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
    const W = L.w * GP, H = L.h * GP; const cv = mk(W, H), x = cv.getContext('2d')!; const R = rng(11); const gi = this.gimg; const G = { base: 'cobble', debris: 'debris', planks: 'planks', plaza: 'plaza', ...this.cfg.g }; const [HX, HY] = this.hub;
    const pat = (n: string, sc: number, rot = 0) => { const p = x.createPattern(gi[n], 'repeat')!; (p as any).setTransform?.(new DOMMatrix().rotate(rot).scale(sc)); return p; };
    x.fillStyle = '#1a1816'; x.fillRect(0, 0, W, H);
    // value noise mask helper: blobs of soft alpha, thresholded for organic edges
    const noiseMask = (seed: number, cell: number, thr: number, soft: number) => { const m = mk(W / 4, H / 4), mx = m.getContext('2d')!; const r = rng(seed); const gw = Math.ceil(m.width / cell) + 2, gh = Math.ceil(m.height / cell) + 2; const lat = Array.from({ length: gw * gh }, () => r()); const id = mx.createImageData(m.width, m.height);
      for (let yy = 0; yy < m.height; yy++) for (let xx = 0; xx < m.width; xx++) { const fx = xx / cell, fy = yy / cell, x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); const a = lat[y0 * gw + x0], b = lat[y0 * gw + x0 + 1], c = lat[(y0 + 1) * gw + x0], d = lat[(y0 + 1) * gw + x0 + 1]; let v = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy; v += (r() - .5) * .06; const al = Math.max(0, Math.min(1, (v - thr) / soft)); const i = (yy * m.width + xx) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = al * 255; }
      mx.putImageData(id, 0, 0); return m; };
    const layer = (fill: (c: CanvasRenderingContext2D) => void, mask: HTMLCanvasElement | ((c: CanvasRenderingContext2D) => void), alpha = 1) => { const t = mk(W, H), tx = t.getContext('2d')!; fill(tx); tx.globalCompositeOperation = 'destination-in'; if (typeof mask === 'function') mask(tx); else { tx.imageSmoothingEnabled = true; tx.drawImage(mask, 0, 0, W, H); } x.globalAlpha = alpha; x.drawImage(t, 0, 0); x.globalAlpha = 1; };
    // 1. wet cobble everywhere (two rotated passes break up tiling)
    x.fillStyle = pat(G.base, .95); x.fillRect(0, 0, W, H);
    layer(c => { c.fillStyle = pat(G.base, 1.15, 90); c.fillRect(0, 0, W, H); }, noiseMask(3, 14, .42, .25), .85);
    // 2. debris / dirt patches
    if (gi[G.debris]) layer(c => { c.fillStyle = pat(G.debris, .9, 17); c.fillRect(0, 0, W, H); }, noiseMask(5, 10, .52, .18), .95);
    // 3. plank + plate walkways: lanes from plaza to each district
    const lanes: [number, number][][] = this.stations.map(st => [[HX, HY], [(HX + st.x) / 2 + Math.sin(st.x) * 1.2, (HY + st.y) / 2 + Math.cos(st.y) * 1.2], [st.x, st.y]]);
    if (gi[G.planks]) { const lm = mk(W, H), lx = lm.getContext('2d')!; lx.lineCap = 'round'; lx.lineJoin = 'round'; for (let pass = 0; pass < 5; pass++) { lx.strokeStyle = `rgba(255,255,255,${pass === 4 ? .9 : .22})`; lx.lineWidth = (2.3 - pass * .28) * GP; for (const ln of lanes) { lx.beginPath(); ln.forEach(([px, py], i) => { const jx = Math.sin(px * 3.1 + py) * .35, jy = Math.cos(px + py * 2.7) * .35; i ? lx.lineTo((px + jx) * GP, (py + jy) * GP) : lx.moveTo((px + jx) * GP, (py + jy) * GP); }); lx.stroke(); } }
      const edge = noiseMask(8, 5, .3, .35); lx.globalCompositeOperation = 'destination-in'; lx.drawImage(edge, 0, 0, W, H); layer(c => { c.fillStyle = pat(G.planks, .8, 27); c.fillRect(0, 0, W, H); }, c => c.drawImage(lm, 0, 0), .9); }
    // 4. central plaza with drain grate (non-tiling image, feathered into the surroundings)
    if (gi[G.plaza]) { const ps = this.cfg.plazaSize || 20; const pw = ps * GP, ph = ps * GP, cx = Math.floor(HX) * GP, cy = Math.floor(HY) * GP; const t = mk(pw, ph), tx = t.getContext('2d')!; tx.drawImage(gi[G.plaza], 0, 0, pw, ph); tx.globalCompositeOperation = 'destination-in'; const g = tx.createRadialGradient(pw / 2, ph / 2, pw * .22, pw / 2, ph / 2, pw * .5); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.7, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); tx.fillStyle = g; tx.fillRect(0, 0, pw, ph); x.drawImage(t, cx - pw / 2, cy - ph / 2); }
    this.cfg.extra?.(x, W, H, this);
    // 5. painted markings and wear
    this.paintStationDecals(x);
    // 6. puddles with cool sheen
    for (let i = 0; this.cfg.puddles !== false && i < 14; i++) { const px = (10 + R() * 40) * GP, py = (8 + R() * 28) * GP, rx = (.5 + R() * 1.4) * GP, ry = rx * (.45 + R() * .3); const g = x.createRadialGradient(px, py, 0, px, py, rx); g.addColorStop(0, 'rgba(40,52,60,.55)'); g.addColorStop(.7, 'rgba(30,38,44,.35)'); g.addColorStop(1, 'rgba(30,38,44,0)'); x.save(); x.translate(px, py); x.rotate(R() * 3); x.scale(1, ry / rx); x.translate(-px, -py); x.fillStyle = g; x.beginPath(); x.arc(px, py, rx, 0, 7); x.fill(); x.fillStyle = 'rgba(170,185,195,.1)'; x.beginPath(); x.arc(px - rx * .2, py - rx * .15, rx * .45, 0, 7); x.fill(); x.restore(); }
    // 7. soft contact shadows under every decor footprint, and rim darkening toward solid tiles
    for (const d of L.decor || []) { const cx = (d.x + d.fw / 2) * GP, cy = (d.y + d.fd / 2) * GP, rx = (d.fw + .6) * GP * .65, ry = (d.fd + .6) * GP * .65; const g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry)); g.addColorStop(0, 'rgba(4,4,5,.55)'); g.addColorStop(1, 'rgba(4,4,5,0)'); x.fillStyle = g; x.save(); x.translate(cx + GP * .25, cy + GP * .3); x.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); x.translate(-cx, -cy); x.beginPath(); x.arc(cx, cy, Math.max(rx, ry), 0, 7); x.fill(); x.restore(); }
    for (let ty = 0; ty < L.h; ty++) for (let tx = 0; tx < L.w; tx++) { if (!L.solid[ty * L.w + tx]) continue; const px = (tx + .5) * GP, py = (ty + .5) * GP; const g = x.createRadialGradient(px, py, GP * .3, px, py, GP * 1.9); g.addColorStop(0, 'rgba(6,6,8,.8)'); g.addColorStop(1, 'rgba(6,6,8,0)'); x.fillStyle = g; x.fillRect(px - GP * 2, py - GP * 2, GP * 4, GP * 4); }
    // 8. baked warm/cool light pools
    x.globalCompositeOperation = 'screen'; for (const l of L.lights || []) { const gl = this.glows[l.c]; const r = l.r * GP * .7; x.globalAlpha = Math.min(.55, l.a * 1.1); x.drawImage(gl, l.x * GP - r, l.y * GP - r, r * 2, r * 2); } x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    this.ground = cv;
  }

  /** ground decals: coloured pad ring + flat icon + name at each station, dashed colour-coded lane from the plaza hub, hazard stripes at the gate */
  paintStationDecals(x: CanvasRenderingContext2D) {
    x.save(); x.lineCap = 'round';
    for (const st of this.stations) { const px = st.x * GP, py = st.y * GP; const [HX, HY] = this.hub;
      x.strokeStyle = `rgba(${st.rgb},.2)`; x.lineWidth = GP * .09; x.setLineDash([GP * .45, GP * .6]); x.beginPath(); x.moveTo(HX * GP, HY * GP); x.quadraticCurveTo((HX + st.x) / 2 * GP + Math.sin(st.x) * 1.2 * GP, (HY + st.y) / 2 * GP + Math.cos(st.y) * 1.2 * GP, px, py); x.stroke(); x.setLineDash([]);
      const g = x.createRadialGradient(px, py, 0, px, py, GP * 1.9); g.addColorStop(0, `rgba(${st.rgb},.10)`); g.addColorStop(.7, `rgba(${st.rgb},.04)`); g.addColorStop(1, `rgba(${st.rgb},0)`); x.fillStyle = g; x.beginPath(); x.arc(px, py, GP * 1.9, 0, 7); x.fill();
      x.strokeStyle = `rgba(${st.rgb},.4)`; x.lineWidth = GP * .06; x.beginPath(); x.arc(px, py, GP * 1.3, 0, 7); x.stroke();
      drawIcon(x, st.icon, px, py, GP * .5, `rgba(${st.rgb},.5)`, GP * .07);
    }
    // hazard stripes across the gate approach
    const gs = this.stations.find(s => s.icon === 'gate')!; x.save(); x.beginPath(); x.rect((gs.x - 3.6) * GP, (gs.y + 2) * GP, 7.2 * GP, GP * .7); x.clip(); x.fillStyle = 'rgba(255,68,85,.45)'; for (let i = -10; i < 24; i++) { x.beginPath(); x.moveTo((gs.x - 3.6 + i * .7) * GP, (gs.y + 2.7) * GP); x.lineTo((gs.x - 3.6 + i * .7 + .35) * GP, (gs.y + 2.7) * GP); x.lineTo((gs.x - 3.6 + i * .7 + 1.05) * GP, (gs.y + 2) * GP); x.lineTo((gs.x - 3.6 + i * .7 + .7) * GP, (gs.y + 2) * GP); x.fill(); } x.restore();
    x.restore();
  }
  // ---------------- ambient ----------------
  update(dt: number, L: Level, t: number, px: number, py: number) {
    const R = this.R; this.em -= dt;
    if (this.em <= 0) { this.em = .12; for (const d of L.decor || []) { if (d.steam && R() < .8) this.parts.push({ x: d.x + d.fw * .4 + R() * .3, y: d.y + d.fd * .4 + R() * .3, z: 1.4, vx: (R() - .3) * .1, vy: (R() - .3) * .1, vz: .5 + R() * .3, t: 0, life: 2.6 + R(), k: 'steam', s: .25 + R() * .2 }); if (d.glow === 'fire' && R() < .5) this.parts.push({ x: d.x + .5 + (R() - .5) * .3, y: d.y + .5 + (R() - .5) * .3, z: .9, vx: (R() - .5) * .3, vy: (R() - .5) * .3, vz: .8 + R(), t: 0, life: 1.2 + R(), k: 'ember', s: .05 }); }
      if (this.parts.length < 90 && R() < .6) this.parts.push({ x: px + (R() - .5) * 18, y: py + (R() - .5) * 18, z: .3 + R() * 1.6, vx: (R() - .5) * .25, vy: (R() - .5) * .25, vz: (R() - .5) * .05, t: 0, life: 5 + R() * 3, k: 'dust', s: .03 }); }
    if (this.em > .08 && this.em <= .12) for (const st of this.stations) { if (Math.hypot(px - st.x, py - st.y) > 20 || this.parts.length > 160) continue; const a = st.ambient;
      if (a === 'sparks' && R() < .5) this.parts.push({ x: st.lx + 1 + R() * 2, y: st.ly + 1 + R() * 2, z: 1 + R(), vx: (R() - .5) * .8, vy: (R() - .5) * .8, vz: .4 + R() * .6, t: 0, life: .7 + R() * .6, k: 'ember', s: .03, col: st.rgb });
      else if (a === 'weld' && R() < .4) this.parts.push({ x: st.lx + .8 + R() * .6, y: st.ly + .8 + R() * .6, z: .9, vx: (R() - .5) * 1.6, vy: (R() - .5) * 1.6, vz: .5 + R() * .9, t: 0, life: .5 + R() * .4, k: 'ember', s: .03, col: '210,190,255' });
      else if (a === 'beacon' && R() < .35) this.parts.push({ x: st.lx + 1.5, y: st.ly - .5, z: 2.4, vx: (R() - .5) * .3, vy: (R() - .5) * .3, vz: .5, t: 0, life: 1.2, k: 'ember', s: .03, col: st.rgb });
      else if (a === 'screens' && R() < .15) this.parts.push({ x: st.lx + .5 + R() * 1.5, y: st.ly + 1.5, z: 1.4, vx: .1 + R() * .3, vy: .1 + R() * .3, vz: .1, t: 0, life: 2.2, k: 'ember', s: .03, col: st.rgb }); }
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.k === 'steam') p.s += dt * .22; }
    this.parts = this.parts.filter(p => p.t < p.life);
    // town folk (replace the wander lerp)
    if (this.folkActive) { if (this.folkLevel !== L) { this.folkLevel = L; const wn = (L.npcs || []).filter(n => n.wander); this.folk = new Townfolk(L, this.hub, [...(L.interacts || []), ...this.stations], L.w > 70 ? 11 : 8, wn, L.w > 70 ? 22 : 17); } this.folk!.update(Math.min(dt, .1), px, py); }
    // npc wander
    for (let i = 0; i < (L.npcs || []).length; i++) { const n = L.npcs![i]; let s = this.npcPos[i]; if (!s) s = this.npcPos[i] = { x: n.x, y: n.y, flip: false, moving: false };
      if (n.wander && !this.folkActive) { const cyc = ((t * (n.speed || .3) * .05 + n.ph) % 2); const u = cyc < 1 ? cyc : 2 - cyc; const e = u < .12 ? 0 : u > .88 ? 1 : (u - .12) / .76; const nx = n.x + (n.wander[0] - n.x) * e, ny = n.y + (n.wander[1] - n.y) * e; s.moving = Math.hypot(nx - s.x, ny - s.y) > .0004; if (s.moving) s.flip = (nx - s.x) - (ny - s.y) < 0; s.x = nx; s.y = ny; } }
  }
}
export function decorDepth(d: Decor) { return d.x + d.fw / 2 + d.y + d.fd / 2 + .6; }
