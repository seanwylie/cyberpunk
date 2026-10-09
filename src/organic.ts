// "Less square" environments: everything here is purely visual (the sim grid and collisions are untouched).
//  - wallShape/drawRubble/drawBreak: wall height variation, chamfered/caved-in corner tiles, cracked wall tops
//  - build/drawFloorOverlay: one prebaked world-space overlay per level (24px/tile) with zone-seam blending, grime/rubble bleeding off the walls onto
//    the floor, scatter details, diagonal pipes/cables crossing the floor, cave-in debris piles, dark corners and light pools; blitted in chunks
//  - drawFogAndVignette: slow parallax fog banks + extra edge darkening
import type { Level } from './level';
import type { Renderer } from './render';
import { themeScatter, themeOf } from './dungeon_env';
const OP = 24, CH = 6;
const rng = (seed: number) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const vnoise = (x: number, y: number) => { const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1); return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy; };
const ZT: Record<string, string> = { yard: '122,120,112', proc: '98,92,88', junction: '96,104,112', boss: '58,56,58', salvage: '112,102,86', corridor: '90,92,92', passage: '70,74,76', town: '110,100,86' };
interface Shape { h: number; rubble?: number; broken?: boolean }

export class Organic {
  private shapes = new WeakMap<Level, Map<number, Shape>>(); private ov = new WeakMap<Level, HTMLCanvasElement>(); private fog: HTMLCanvasElement[] = [];
  // ---------- walls ----------
  wallShape(L: Level, x: number, y: number): Shape {
    let m = this.shapes.get(L); if (!m) { m = new Map(); this.shapes.set(L, m); } const k = y * L.w + x; let s = m.get(k); if (s) return s;
    const fl = (a: number, b: number) => a >= 0 && b >= 0 && a < L.w && b < L.h && !L.solid[b * L.w + a];
    const town = L.kind === 'town'; const n = vnoise(x * .35 + 3, y * .35 + 7) * .65 + vnoise(x * 1.3, y * 1.3) * .35; const n2 = vnoise(x * .8 + 11, y * .8 + 5); let h = town ? 2.4 + n * 1.5 : .8 + n * 1.0 + n2 * .75;
    const nearDoor = L.doors.some(d => d.tiles.some(t => Math.abs(t[0] - x) <= 2 && Math.abs(t[1] - y) <= 2));
    const e = fl(x + 1, y), w = fl(x - 1, y), sN = fl(x, y + 1), nN = fl(x, y - 1); const corner = (e || w) && (sN || nN) && ((e ? 1 : 0) + (w ? 1 : 0) + (sN ? 1 : 0) + (nN ? 1 : 0)) === 2;
    const hv = hash(x * 3 + 1, y * 5 + 2); s = { h };
    const touches = e || w || sN || nN; if (town && touches && !(L.hide && L.hide[k])) { s.rubble = 1 + ((hv * 10) | 0) % 3; m.set(k, s); return s; } const cave = vnoise(x * .45 + 91, y * .45 + 17) > .74 && hv < .8; // clustered cave-in stretches
    if (corner && !nearDoor && hv < .85 && !(L.hide && L.hide[k])) s.rubble = 1 + ((hv * 10) | 0) % 3; else if (touches && cave && !nearDoor) s.rubble = 1 + ((hv * 10) | 0) % 3; else if (hv > .8 && !nearDoor) s.broken = true;
    if (nearDoor) s.h = Math.max(1.5, Math.min(1.65, h)); m.set(k, s); return s;
  }
  /** chamfered / caved-in corner: a low wall stub with a heap of angular rubble leaning over it, so the corner reads rounded */
  drawRubble(r: Renderer, x: number, y: number, kind: number) {
    const c = r.ctx, T = r.TW, e = r.env!, wi = (r as any).wallInfo(x, y); const img = e.wall(wi.style, wi.v, wi.zone);
    (r as any).faceStretch(img, x, y + 1, 0, .5, .12, false); (r as any).faceStretch(img, x, y, 1, .5, .34, true); (r as any).isoTex(e.cap(0), x, y, .5, 1, 1);
    const R = rng(x * 977 + y * 131 + kind), cx = r.sx(x + .5, y + .5), cy = r.sy(x + .5, y + .5, .45); const n = 9 + kind * 2;
    for (let i = 0; i < n; i++) { const a = R() * 6.283, d = R() * T * .34, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * .5 - R() * T * .26 * (1 - d / (T * .34)); const s = T * (.07 + R() * .1); const v = 78 + R() * 60 | 0;
      c.fillStyle = `rgb(${v},${v - 2},${v - 6})`; c.beginPath(); const k = 5 + (R() * 3 | 0); for (let j = 0; j < k; j++) { const aa = j / k * 6.283 + R() * .6, rr = s * (.6 + R() * .5); const X = px + Math.cos(aa) * rr, Y = py + Math.sin(aa) * rr * .7; j ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.closePath(); c.fill();
      c.fillStyle = 'rgba(215,205,185,.18)'; c.beginPath(); c.arc(px - s * .2, py - s * .25, s * .35, 0, 7); c.fill(); }
    // a bent rebar / pipe poking out
    c.strokeStyle = '#2b2a28'; c.lineWidth = Math.max(1.5, T * .035); c.beginPath(); const rb = R(); c.moveTo(cx + (rb - .5) * T * .2, cy - T * .05); c.lineTo(cx + (rb - .5) * T * .5, cy - T * (.38 + R() * .2)); c.stroke();
  }
  /** cracked/ripped wall top: dark gouge on the cap and a diagonal cable draped over the face */
  drawBreak(r: Renderer, x: number, y: number, H: number) {
    const c = r.ctx, T = r.TW; const R = rng(x * 53 + y * 91), a = r.sx(x + .5, y + .5), b = r.sy(x + .5, y + .5, H);
    c.strokeStyle = 'rgba(20,20,20,.8)'; c.lineWidth = Math.max(1, T * .03); c.beginPath(); c.moveTo(a - T * .25, b + T * .04); c.quadraticCurveTo(a - T * .05, b + T * (.35 + R() * .2), a + T * .22, b + T * .18); c.stroke();
  }
  // ---------- floor overlay ----------
  drawFloorOverlay(r: Renderer, L: Level) {
    let cv = this.ov.get(L); if (!cv) { cv = this.build(L); this.ov.set(L, cv); }
    const g = r.g, kk = r.TW / OP, Rr = Math.ceil(Math.max(r.w, r.h) / r.TW * 1.1) + 4;
    const cx0 = Math.max(0, Math.floor((g.px - Rr) / CH)), cx1 = Math.min(Math.ceil(L.w / CH) - 1, Math.floor((g.px + Rr) / CH)), cy0 = Math.max(0, Math.floor((g.py - Rr) / CH)), cy1 = Math.min(Math.ceil(L.h / CH) - 1, Math.floor((g.py + Rr) / CH));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) { const sw = Math.min(CH * OP, cv.width - cx * CH * OP), sh = Math.min(CH * OP, cv.height - cy * CH * OP); if (sw <= 0 || sh <= 0) continue; r.bakeBlit(cv, cx * CH * OP, cy * CH * OP, sw, sh, kk / 2, kk / 4, -kk / 2, kk / 4, r.sx(cx * CH, cy * CH), r.sy(cx * CH, cy * CH), 0, 1); }
  }
  build(L: Level): HTMLCanvasElement {
    const W = L.w * OP, H = L.h * OP, cv = mk(W, H), x = cv.getContext('2d')!; const R = rng(L.w * 31 + L.h * 7 + 5);
    const fl = (a: number, b: number) => a >= 0 && b >= 0 && a < L.w && b < L.h && !L.solid[b * L.w + a];
    const zn = (a: number, b: number) => L.zoneNames[L.zone[b * L.w + a]];
    const blob = (px: number, py: number, rad: number, col: string, a: number, sq = 1, rot = 0) => { const g = x.createRadialGradient(0, 0, 0, 0, 0, rad); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(.6, `rgba(${col},${a * .5})`); g.addColorStop(1, `rgba(${col},0)`); x.save(); x.translate(px, py); x.rotate(rot); x.scale(1, sq); x.fillStyle = g; x.beginPath(); x.arc(0, 0, rad, 0, 7); x.fill(); x.restore(); };
    const rock = (px: number, py: number, s: number, v: number) => { x.fillStyle = `rgb(${v},${v - 3},${v - 8})`; x.beginPath(); const k = 5 + (R() * 3 | 0); for (let j = 0; j < k; j++) { const aa = j / k * 6.283 + R() * .7, rr = s * (.55 + R() * .6); const X = px + Math.cos(aa) * rr, Y = py + Math.sin(aa) * rr * .8; j ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.closePath(); x.fill(); x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(px + s * .5, py + s * .5, s * .8, s * .35, 0, 0, 7); x.fill(); x.fillStyle = `rgb(${v},${v - 3},${v - 8})`; x.beginPath(); for (let j = 0; j < 5; j++) { const aa = j / 5 * 6.283; const X = px + Math.cos(aa) * s * .6, Y = py + Math.sin(aa) * s * .5; j ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.fill(); };
    const floors: [number, number][] = []; for (let ty = 0; ty < L.h; ty++) for (let tx = 0; tx < L.w; tx++) if (fl(tx, ty)) floors.push([tx, ty]);
    // 1. blend material seams between zones (splat-like soft dirt both sides of the boundary, noisy)
    for (const [tx, ty] of floors) for (const [dx, dy] of [[1, 0], [0, 1]]) { const nx = tx + dx, ny = ty + dy; if (!fl(nx, ny)) continue; const za = zn(tx, ty), zb = zn(nx, ny); if (za === zb) continue; const mx = (tx + (dx ? 1 : .5)) * OP, my = (ty + (dy ? 1 : .5)) * OP;
      for (let i = 0; i < 7; i++) { const off = (R() - .5) * OP * 1.1; const px = mx + (dx ? (R() - .5) * OP * 1.4 : off), py = my + (dy ? (R() - .5) * OP * 1.4 : off); blob(px, py, OP * (.4 + R() * .6), ZT[R() < .5 ? za : zb] || '100,98,92', .3, .5 + R() * .5, R() * 3); blob(px, py, OP * (.3 + R() * .4), '24,22,20', .14, .6, R() * 3); } }
    // 2. organic floor edges: grime and rubble creeping off the walls (breaks the straight tile border)
    for (const [tx, ty] of floors) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (fl(tx + dx, ty + dy)) continue; const hv = hash(tx * 7 + dx, ty * 11 + dy); if (hv < .12) continue;
      const nb = 3 + (R() * 3 | 0); for (let i = 0; i < nb; i++) { const along = R(), dep = R() * R() * .85; const ex = dx ? (dx > 0 ? 1 - dep : dep) : along, ey = dy ? (dy > 0 ? 1 - dep : dep) : along; const px = (tx + ex) * OP, py = (ty + ey) * OP;
        blob(px, py, OP * (.18 + R() * .42), '12,11,10', .34 + R() * .2, .7 + R() * .5, R() * 3);
        if (R() < .45) rock(px + (R() - .5) * 4, py + (R() - .5) * 4, OP * (.05 + R() * .1), 70 + R() * 70 | 0);
        if (R() < .12) blob(px, py, OP * .5, '150,140,120', .12, .6, R() * 3); } }
    // 3. scatter: stones, cracks, oil/scorch, puddles
    for (const [tx, ty] of floors) { const hv = hash(tx * 13 + 5, ty * 17 + 3); const px = (tx + R()) * OP, py = (ty + R()) * OP;
      if (hv < .14) { const k = 3 + (R() * 4 | 0); for (let i = 0; i < k; i++) rock(px + (R() - .5) * OP * .5, py + (R() - .5) * OP * .5, OP * (.03 + R() * .06), 80 + R() * 60 | 0); }
      else if (hv < .2) blob(px, py, OP * (.4 + R() * .5), '10,10,10', .3, .55, R() * 3);
      else if (hv < .25) { x.strokeStyle = 'rgba(8,8,9,.55)'; x.lineWidth = 1.1; x.beginPath(); let cx = px, cy = py, a = R() * 6.28; x.moveTo(cx, cy); for (let i = 0; i < 6; i++) { a += (R() - .5) * 1.1; cx += Math.cos(a) * OP * .35; cy += Math.sin(a) * OP * .35; x.lineTo(cx, cy); } x.stroke(); }
      else if (hv < .28) blob(px, py, OP * (.6 + R() * .6), '70,48,34', .18, .7, R() * 3);
      else if (hv < .31) { blob(px, py, OP * (.35 + R() * .45), '40,50,58', .38, .45 + R() * .3, R() * 3); blob(px - 2, py - 2, OP * .22, '170,185,195', .1, .5, 0); } }
    themeScatter(x, L, OP, floors, R, themeOf(L));
    // 4. diagonal pipes / cables lying across the floor at arbitrary angles
    const nPipes = Math.max(4, Math.floor(floors.length / 90));
    for (let n = 0; n < nPipes; n++) { const [tx, ty] = floors[(R() * floors.length) | 0]; let a = R() * Math.PI; if (Math.abs((a % (Math.PI / 2)) - 0) < .25 || Math.abs((a % (Math.PI / 2)) - Math.PI / 2) < .25) a += .5; const pts: [number, number][] = []; let px = tx + .5, py = ty + .5; const len = 4 + R() * 6; const curve = (R() - .5) * .35;
      for (let s = 0; s < len; s += .5) { if (!fl(Math.floor(px), Math.floor(py))) break; pts.push([px * OP, py * OP]); a += curve * .12; px += Math.cos(a) * .5; py += Math.sin(a) * .5; }
      if (pts.length < 6) continue; const cable = R() < .5; const wd = cable ? 2.2 : 3.6;
      for (const [off, col, lw] of [[2.5, 'rgba(0,0,0,.35)', wd + 1.5], [0, cable ? '#252423' : '#4a4640', wd], [-.9, cable ? 'rgba(120,115,100,.18)' : 'rgba(205,195,170,.28)', wd * .35]] as [number, string, number][]) { x.strokeStyle = col; x.lineWidth = lw; x.lineCap = 'round'; x.beginPath(); pts.forEach(([X, Y], i) => i ? x.lineTo(X + off, Y + off) : x.moveTo(X + off, Y + off)); x.stroke(); }
      if (!cable) for (let i = 2; i < pts.length - 1; i += 4) { x.fillStyle = '#2c2a27'; x.beginPath(); x.arc(pts[i][0], pts[i][1], 3.2, 0, 7); x.fill(); } }
    // 5. cave-in / damage piles near walls
    const edgeFloors = floors.filter(([tx, ty]) => !fl(tx + 1, ty) || !fl(tx - 1, ty) || !fl(tx, ty + 1) || !fl(tx, ty - 1)); const nPiles = Math.max(3, Math.floor(floors.length / 140));
    for (let n = 0; n < nPiles && edgeFloors.length; n++) { const [tx, ty] = edgeFloors[(R() * edgeFloors.length) | 0]; const px = (tx + .5) * OP, py = (ty + .5) * OP; blob(px, py, OP * 1.3, '8,8,8', .4, .7, R() * 3); const k = 10 + (R() * 8 | 0); for (let i = 0; i < k; i++) { const aa = R() * 6.28, d = R() * OP * .75; rock(px + Math.cos(aa) * d, py + Math.sin(aa) * d * .8, OP * (.08 + R() * .16), 60 + R() * 70 | 0); } blob(px, py, OP * 1.1, '150,140,120', .1, .6, 0); }
    // 6. dark corners + zone light pools (baked)
    for (const [tx, ty] of floors) { const sc = (fl(tx + 1, ty) ? 0 : 1) + (fl(tx - 1, ty) ? 0 : 1) + (fl(tx, ty + 1) ? 0 : 1) + (fl(tx, ty - 1) ? 0 : 1); if (sc >= 2) blob((tx + .5) * OP, (ty + .5) * OP, OP * 1.7, '4,4,6', .42, 1, 0); }
    const zc = new Map<string, [number, number, number]>(); for (const [tx, ty] of floors) { const z = zn(tx, ty); const v = zc.get(z) || [0, 0, 0]; v[0] += tx; v[1] += ty; v[2]++; zc.set(z, v); }
    x.globalCompositeOperation = 'screen'; for (const [z, v] of zc) { if (v[2] < 30) continue; const cx = v[0] / v[2], cy = v[1] / v[2]; const warm = z === 'yard' || z === 'salvage'; blob(cx * OP, cy * OP, Math.min(10, Math.sqrt(v[2]) * .7) * OP, warm ? '255,190,120' : z === 'boss' ? '170,70,52' : '120,150,170', warm ? .1 : z === 'boss' ? .1 : .07, .7, 0); } x.globalCompositeOperation = 'source-over';
    // keep it on floors (a 1-tile dilation: walls cover the rest)
    const mask = mk(W, H), mx = mask.getContext('2d')!; mx.fillStyle = '#fff'; for (const [tx, ty] of floors) mx.fillRect((tx - .5) * OP, (ty - .5) * OP, OP * 2, OP * 2); x.globalCompositeOperation = 'destination-in'; x.drawImage(mask, 0, 0); x.globalCompositeOperation = 'source-over';
    return cv;
  }
  // ---------- fog + vignette ----------
  drawFogAndVignette(r: Renderer) {
    if (!this.fog.length) for (let i = 0; i < 3; i++) { const c = mk(512, 256), x = c.getContext('2d')!; const R = rng(40 + i); for (let k = 0; k < 14; k++) { const px = R() * 512, py = 60 + R() * 140, rad = 50 + R() * 90; const g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, 'rgba(150,155,158,.22)'); g.addColorStop(1, 'rgba(150,155,158,0)'); x.fillStyle = g; x.save(); x.translate(px, py); x.scale(1.8, .55); x.translate(-px, -py); x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill(); x.restore(); } this.fog.push(c); }
    if (r.g.save.settings.reducedFx) return; const c = r.ctx, t = r.g.time; c.save(); const sc = Math.max(1, r.w / 700);
    this.fog.forEach((f, i) => { const w = 512 * sc * (1 + i * .3), h = 256 * sc * (1 + i * .3); const ox = ((t * (6 + i * 4) - r.camx * (.15 + i * .07)) % w + w) % w; c.globalAlpha = .16 - i * .03; for (let X = -ox; X < r.w; X += w) c.drawImage(f, X, r.h * (.18 + i * .27) - h / 2 + Math.sin(t * .1 + i) * 12, w, h); });
    c.restore();
  }
}
