import { DungeonArt, isDungeonTheme } from './dungeon_env';
// Procedural environment textures (runtime-generated, cached, lazily built). Style: concrete grey, soot black, dirty bone,
// oxidized metal, faded textile; restrained oxide red / slate blue / olive; no neon. Everything is drawn once into offscreen
// canvases (1 texture px = 1/S world unit) and blitted with an isometric affine, so per-frame cost is one drawImage per face.
// Any failure (no canvas, etc.) leaves `Env` unusable and render.ts falls back to flat procedural fills.
export const S = 192;
type RGB = [number, number, number];
const rng = (seed: number) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const rgb = (c: RGB, k = 1, a = 1) => `rgba(${Math.max(0, Math.min(255, c[0] * k)) | 0},${Math.max(0, Math.min(255, c[1] * k)) | 0},${Math.max(0, Math.min(255, c[2] * k)) | 0},${a})`;
/** tileable value-noise fbm in [0,1] */
function fbm(w: number, h: number, seed: number, oct: number[]): Float32Array {
  const out = new Float32Array(w * h); const r = rng(seed); let tot = 0;
  oct.forEach((g, o) => { const lat = new Float32Array(g * g); for (let i = 0; i < lat.length; i++) lat[i] = r(); const amp = 1 / (1 + o * .9); tot += amp;
    for (let y = 0; y < h; y++) { const fy = y / h * g, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty); const ya = (y0 % g) * g, yb = ((y0 + 1) % g) * g;
      for (let x = 0; x < w; x++) { const fx = x / w * g, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx); const xa = x0 % g, xb = (x0 + 1) % g;
        const v = (lat[ya + xa] * (1 - sx) + lat[ya + xb] * sx) * (1 - sy) + (lat[yb + xa] * (1 - sx) + lat[yb + xb] * sx) * sy; out[y * w + x] += v * amp; } } });
  for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
}
/** fill a canvas with noisy base material */
function material(w: number, h: number, base: RGB, seed: number, o: { low?: number; fine?: number; oct?: number[]; tint?: RGB; tintAmt?: number } = {}) {
  const c = mk(w, h), x = c.getContext('2d')!; const id = x.createImageData(c.width, c.height); const lo = fbm(c.width, c.height, seed, o.oct || [3, 7, 15]); const tn = o.tint ? fbm(c.width, c.height, seed + 99, [2, 5]) : null; const r = rng(seed * 7 + 1);
  const L = o.low ?? .35, F = o.fine ?? .12, T = o.tintAmt ?? .5;
  for (let i = 0; i < lo.length; i++) { let k = 1 + (lo[i] - .5) * L + (r() - .5) * F; let R = base[0] * k, G = base[1] * k, B = base[2] * k;
    if (tn && o.tint) { const t = Math.max(0, tn[i] - .55) * 2.2 * T; R += (o.tint[0] - R) * t; G += (o.tint[1] - G) * t; B += (o.tint[2] - B) * t; }
    id.data[i * 4] = R; id.data[i * 4 + 1] = G; id.data[i * 4 + 2] = B; id.data[i * 4 + 3] = 255; }
  x.putImageData(id, 0, 0); return c;
}
const line = (x: CanvasRenderingContext2D, a: number, b: number, c: number, d: number, col: string, w = 1) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); };
const rivet = (x: CanvasRenderingContext2D, px: number, py: number, rr = 2.4) => { x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.arc(px + .8, py + 1, rr, 0, 7); x.fill(); x.fillStyle = 'rgba(190,185,168,.35)'; x.beginPath(); x.arc(px, py, rr, 0, 7); x.fill(); x.fillStyle = 'rgba(30,30,30,.5)'; x.beginPath(); x.arc(px + .6, py + .7, rr * .55, 0, 7); x.fill(); };
function crack(x: CanvasRenderingContext2D, r: () => number, W: number, H: number, col = 'rgba(15,15,16,.55)') { let px = r() * W, py = r() * H; x.strokeStyle = col; x.lineWidth = 1.3; x.beginPath(); x.moveTo(px, py); const n = 5 + r() * 6 | 0; for (let i = 0; i < n; i++) { px += (r() - .45) * 34; py += (r() - .3) * 28; x.lineTo(px, py); if (r() < .3) { x.moveTo(px, py); x.lineTo(px + (r() - .5) * 30, py + (r() - .5) * 30); x.moveTo(px, py); } } x.stroke(); }
function stain(x: CanvasRenderingContext2D, r: () => number, W: number, H: number, col: string, n = 1, size = 1) { for (let i = 0; i < n; i++) { const px = r() * W, py = r() * H, rr = (14 + r() * 34) * size; const g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.save(); x.translate(px, py); x.scale(1 + r() * .8, 1); x.translate(-px, -py); x.beginPath(); x.arc(px, py, rr, 0, 7); x.fill(); x.restore(); } }
function hazardStripes(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, a: string, b: string, step = 18) { x.save(); x.beginPath(); x.rect(X, Y, W, H); x.clip(); x.fillStyle = b; x.fillRect(X, Y, W, H); x.fillStyle = a; for (let i = -H; i < W + H; i += step * 2) { x.beginPath(); x.moveTo(X + i, Y + H); x.lineTo(X + i + step, Y + H); x.lineTo(X + i + step + H, Y); x.lineTo(X + i + H, Y); x.fill(); } x.restore(); }
const OX: RGB = [143, 59, 46], SL: RGB = [79, 101, 120], OL: RGB = [107, 112, 53], BONE: RGB = [207, 198, 176];
function stencil(x: CanvasRenderingContext2D, t: string, px: number, py: number, size: number, col = 'rgba(207,198,176,.55)') { x.save(); x.font = `bold ${size}px "Arial Narrow",Impact,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(t, px, py); x.restore(); }
function wear(x: CanvasRenderingContext2D, r: () => number, W: number, H: number, n = 400, a = .1) { for (let i = 0; i < n; i++) { x.fillStyle = r() < .5 ? `rgba(0,0,0,${a * r()})` : `rgba(210,205,190,${a * .5 * r()})`; const s = 1 + r() * 2.5; x.fillRect(r() * W, r() * H, s, s * (r() < .3 ? 3 : 1)); } }

// ---------------- floors (square, 1x1 world unit) ----------------
interface FloorStyle { base: RGB; alt: RGB; tint?: RGB; kind: 'slab' | 'plate' | 'tile' | 'dark' | 'bone' | 'packed' | 'checker' }
const FLOOR: Record<string, FloorStyle> = {
  yard: { base: [123, 125, 121], alt: [115, 117, 113], tint: [96, 86, 70], kind: 'slab' },
  proc: { base: [104, 106, 104], alt: [98, 100, 99], tint: [120, 84, 60], kind: 'plate' },
  junction: { base: [112, 116, 121], alt: [106, 110, 115], tint: [70, 84, 98], kind: 'tile' },
  boss: { base: [90, 92, 94], alt: [88, 90, 92], tint: [70, 60, 54], kind: 'dark' },
  salvage: { base: [110, 107, 96], alt: [103, 100, 90], tint: [120, 84, 58], kind: 'bone' },
  corridor: { base: [105, 107, 106], alt: [98, 100, 100], tint: [90, 84, 76], kind: 'checker' },
  passage: { base: [86, 90, 93], alt: [80, 84, 87], tint: [70, 76, 70], kind: 'checker' },
  town: { base: [124, 120, 110], alt: [116, 112, 102], tint: [110, 96, 70], kind: 'packed' },
};
export const FLOOR_VARIANTS = 6;
function makeFloor(zone: string, v: number): HTMLCanvasElement {
  const st = FLOOR[zone] || FLOOR.yard; const seed = zone.length * 977 + v * 131 + zone.charCodeAt(0) * 17; const r = rng(seed);
  const c = material(S, S, v % 2 ? st.alt : st.base, seed, { low: .3, fine: .10, tint: st.tint, tintAmt: .6 }); const x = c.getContext('2d')!;
  if (st.kind === 'slab') { if (v === 1 || v === 4) crack(x, r, S, S); if (v === 2) stain(x, r, S, S, 'rgba(18,18,18,.35)', 2); if (v === 3) { stain(x, r, S, S, 'rgba(70,50,36,.3)', 2); wear(x, r, S, S, 300, .2); } if (v === 5) { hazardStripes(x, 0, S - 22, S, 12, 'rgba(176,150,70,.42)', 'rgba(20,20,20,.0)', 12); } wear(x, r, S, S, 200, .12); }
  if (st.kind === 'plate') { // diamond tread plate + rivets
    x.save(); x.globalAlpha = .5; for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) { const px = i * 16 + (j % 2) * 8 + 4, py = j * 16 + 4; x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(px, py + 1, 5, 2, (i + j) % 2 ? .6 : -.6, 0, 7); x.fill(); x.fillStyle = 'rgba(205,200,185,.16)'; x.beginPath(); x.ellipse(px, py, 5, 2, (i + j) % 2 ? .6 : -.6, 0, 7); x.fill(); } x.restore();
    if (v === 2) { x.fillStyle = 'rgba(12,12,13,.85)'; x.fillRect(22, 22, S - 44, S - 44); x.strokeStyle = 'rgba(160,160,150,.5)'; x.lineWidth = 3; for (let i = 0; i < 9; i++) { line(x, 22 + i * 18, 22, 22 + i * 18, S - 22, 'rgba(120,118,110,.8)', 4); } line(x, 22, S / 2, S - 22, S / 2, 'rgba(90,88,84,.8)', 3); }
    if (v === 4) { stain(x, r, S, S, 'rgba(120,60,36,.4)', 3); } if (v === 5) { hazardStripes(x, 0, 0, S, 14, 'rgba(176,150,70,.5)', 'rgba(20,20,20,.6)', 12); } if (v === 1) { stain(x, r, S, S, 'rgba(15,15,15,.5)', 2); }
    for (const [px, py] of [[10, 10], [S - 10, 10], [10, S - 10], [S - 10, S - 10]]) rivet(x, px, py); }
  if (st.kind === 'tile') { x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 2; x.strokeRect(14, 14, S - 28, S - 28); x.strokeStyle = 'rgba(200,205,210,.12)'; x.strokeRect(16, 16, S - 32, S - 32); if (v % 3 === 0) { for (let i = 0; i < 3; i++) line(x, 0, 60 + i * 28, S, 60 + i * 28, 'rgba(10,10,12,.6)', 6); line(x, 0, 58, S, 58, 'rgba(120,130,140,.18)', 1.2); } if (v === 2) { x.fillStyle = rgb(SL, 1, .25); x.fillRect(40, 40, 60, 40); } if (v === 4) { x.fillStyle = rgb(OX, 1, .5); x.beginPath(); x.arc(S - 30, 30, 3.5, 0, 7); x.fill(); } wear(x, r, S, S, 250, .14); rivet(x, 24, 24, 2); rivet(x, S - 24, S - 24, 2); }
  if (st.kind === 'dark') { stain(x, r, S, S, 'rgba(0,0,0,.2)', 2); if (v % 2) { for (let i = 0; i < 6; i++) { const a = r() * 6.28, rr = 20 + r() * 70; line(x, S / 2 + Math.cos(a) * rr, S / 2 + Math.sin(a) * rr, S / 2 + Math.cos(a + .2) * (rr + 30), S / 2 + Math.sin(a + .2) * (rr + 30), 'rgba(0,0,0,.45)', 2); } } if (v === 3) crack(x, r, S, S, 'rgba(0,0,0,.6)'); wear(x, r, S, S, 220, .15); for (const [px, py] of [[12, 12], [S - 12, S - 12]]) rivet(x, px, py, 3); }
  if (st.kind === 'bone') { stain(x, r, S, S, 'rgba(110,70,40,.35)', 3); stain(x, r, S, S, 'rgba(20,20,20,.28)', 2); if (v === 1 || v === 4) crack(x, r, S, S); wear(x, r, S, S, 350, .18); if (v === 5) { x.fillStyle = rgb(OL, 1, .25); x.fillRect(30, 50, 110, 70); line(x, 30, 80, 140, 80, 'rgba(0,0,0,.25)', 2); } }
  if (st.kind === 'checker') { x.fillStyle = 'rgba(0,0,0,.14)'; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if ((i + j) % 2) x.fillRect(i * S / 4, j * S / 4, S / 4, S / 4); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.strokeRect(1, 1, S - 2, S - 2); if (v === 2) hazardStripes(x, 0, S - 16, S, 16, 'rgba(176,150,70,.38)', 'rgba(0,0,0,.35)', 11); wear(x, r, S, S, 200, .15); stain(x, r, S, S, 'rgba(10,10,10,.3)', 1); }
  if (st.kind === 'packed') { stain(x, r, S, S, 'rgba(70,56,40,.32)', 3); stain(x, r, S, S, 'rgba(210,200,170,.12)', 2); if (v === 2) { const col = OX; x.fillStyle = rgb(col, 1, .14); x.fillRect(20, 20, S - 40, S - 40); for (let i = 0; i < 12; i++) line(x, 20, 20 + i * 12, S - 20, 20 + i * 12, 'rgba(0,0,0,.15)', 1); x.strokeStyle = 'rgba(0,0,0,.3)'; x.strokeRect(20, 20, S - 40, S - 40); } wear(x, r, S, S, 300, .15); if (v === 1) crack(x, r, S, S); }
  // slab/tile seams (shared): dark joint on far edges, faint highlight on near edges so neighbouring tiles read as separate plates
  x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(S - 2, 0, 2, S); x.fillRect(0, S - 2, S, 2); x.fillStyle = 'rgba(255,255,240,.07)'; x.fillRect(0, 0, 2, S); x.fillRect(0, 0, S, 2);
  return c;
}
// ambient-occlusion edge overlays: [-x, +x, -y, +y] side of the floor tile touched by a wall
function makeAO(side: number): HTMLCanvasElement { const c = mk(S, S), x = c.getContext('2d')!; const v = side < 2 ? [side === 0 ? 0 : S, 0, side === 0 ? S * .45 : S * .55, 0] : [0, side === 2 ? 0 : S, 0, side === 2 ? S * .45 : S * .55]; const g = x.createLinearGradient(v[0], v[1], side < 2 ? (side === 0 ? S * .45 : S * .55) : v[0], side < 2 ? v[1] : (side === 2 ? S * .45 : S * .55)); g.addColorStop(0, 'rgba(6,6,8,.62)'); g.addColorStop(.5, 'rgba(6,6,8,.22)'); g.addColorStop(1, 'rgba(6,6,8,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); return c; }

// ---------------- wall faces (S wide, 1.6 tall) ----------------
const WALLH = 1.65;
type WStyle = 'concrete' | 'steel' | 'door';
function makeWall(style: WStyle, v: number, zone: string): HTMLCanvasElement {
  const W = S, H = Math.round(S * WALLH); const seed = (style === 'concrete' ? 5 : style === 'steel' ? 11 : 17) * 313 + v * 59 + zone.length; const r = rng(seed);
  const base: RGB = style === 'concrete' ? [86, 88, 87] : style === 'steel' ? [76, 80, 83] : [70, 72, 74];
  const c = material(W, H, base, seed, { low: .28, fine: .1, oct: [2, 5, 11], tint: style === 'concrete' ? [70, 62, 52] : [96, 66, 48], tintAmt: .7 }); const x = c.getContext('2d')!;
  // vertical weathering streaks from the top
  for (let i = 0; i < 7; i++) { const px = r() * W, wd = 4 + r() * 14, len = H * (.2 + r() * .6); const g = x.createLinearGradient(0, 0, 0, len); g.addColorStop(0, `rgba(10,10,10,${.22 + r() * .18})`); g.addColorStop(1, 'rgba(10,10,10,0)'); x.fillStyle = g; x.fillRect(px, 0, wd, len); }
  if (style === 'concrete') {
    for (const yy of [H * .34, H * .68]) { line(x, 0, yy, W, yy, 'rgba(0,0,0,.45)', 2); line(x, 0, yy + 2, W, yy + 2, 'rgba(210,205,190,.10)', 1); }
    line(x, W - 1, 0, W - 1, H, 'rgba(0,0,0,.35)', 2); for (const yy of [H * .17, H * .51, H * .85]) { rivet(x, 14, yy, 2); rivet(x, W - 14, yy, 2); }
    if (v === 1) crack(x, r, W, H); if (v === 2) { // pipe run
      const py = H * .22; x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, py + 6, W, 14); const g = x.createLinearGradient(0, py, 0, py + 18); g.addColorStop(0, 'rgb(98,92,84)'); g.addColorStop(.35, 'rgb(150,140,124)'); g.addColorStop(1, 'rgb(48,44,40)'); x.fillStyle = g; x.fillRect(0, py, W, 18); for (const bx of [30, 130]) { x.fillStyle = 'rgba(30,28,26,.9)'; x.fillRect(bx, py - 3, 8, 24); } x.fillStyle = rgb(OX, 1, .7); x.fillRect(80, py, 6, 18); }
    if (v === 3) { hazardStripes(x, 0, H * .78, W, 16, 'rgba(176,150,70,.55)', 'rgba(20,20,20,.75)', 14); stencil(x, 'ANNEX-7', W / 2, H * .52, 28); }
    if (v === 4) { x.fillStyle = 'rgba(14,14,15,.8)'; x.fillRect(46, H * .45, 100, 60); for (let i = 0; i < 6; i++) line(x, 50, H * .45 + 8 + i * 9, 142, H * .45 + 8 + i * 9, 'rgba(120,118,110,.55)', 3); x.strokeStyle = 'rgba(160,155,140,.4)'; x.strokeRect(46, H * .45, 100, 60); }
    if (v === 5) { stencil(x, 'STAND CLEAR', W / 2, H * .45, 22, 'rgba(143,59,46,.7)'); }
  } else if (style === 'steel') {
    for (let i = 0; i < 4; i++) { const px = i * W / 4; line(x, px, 0, px, H, 'rgba(0,0,0,.4)', 2); line(x, px + 2, 0, px + 2, H, 'rgba(200,205,210,.1)', 1); }
    for (const yy of [H * .3, H * .66]) line(x, 0, yy, W, yy, 'rgba(0,0,0,.4)', 2);
    for (let i = 0; i < 4; i++) for (const yy of [H * .08, H * .3 - 8, H * .66 - 8, H * .95]) { rivet(x, i * W / 4 + 8, yy, 2); }
    if (v % 3 === 0) { for (let k = 0; k < 2; k++) { const py = H * .12 + k * 26; x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, py + 5, W, 13); const g = x.createLinearGradient(0, py, 0, py + 14); g.addColorStop(0, 'rgb(60,66,72)'); g.addColorStop(.4, 'rgb(130,138,146)'); g.addColorStop(1, 'rgb(32,36,40)'); x.fillStyle = g; x.fillRect(0, py, W, 14); } }
    if (v === 1) { x.fillStyle = 'rgba(12,13,14,.85)'; x.fillRect(40, H * .38, 112, 70); x.fillStyle = rgb(SL, 1, .5); x.fillRect(48, H * .38 + 8, 40, 22); stencil(x, '07', 120, H * .38 + 20, 20); x.fillStyle = rgb(OX, 1, .8); x.beginPath(); x.arc(134, H * .38 + 54, 3.5, 0, 7); x.fill(); x.fillStyle = rgb(OL, 1, .7); x.beginPath(); x.arc(118, H * .38 + 54, 3.5, 0, 7); x.fill(); }
    if (v === 2) { x.fillStyle = 'rgba(0,0,0,.4)'; for (let i = 0; i < 5; i++) x.fillRect(30 + i * 28, H * .4, 14, 80); x.strokeStyle = 'rgba(150,150,140,.35)'; x.strokeRect(24, H * .4 - 6, 148, 92); }
    if (v === 4) { hazardStripes(x, 0, H * .85, W, 14, 'rgba(176,150,70,.5)', 'rgba(20,20,20,.75)', 13); stain(x, r, W, H, 'rgba(130,70,40,.35)', 3, .8); }
    if (v === 5) { x.fillStyle = rgb(OX, 1, .35); x.fillRect(0, H * .72, W, 10); stencil(x, 'RECLAIM', W / 2, H * .5, 24); }
  } else { // door / shutter
    hazardStripes(x, 0, 0, W, H, 'rgba(120,100,50,.6)', 'rgba(26,26,28,.9)', 22); x.fillStyle = 'rgba(36,38,40,.8)'; x.fillRect(14, 20, W - 28, H - 40); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 3; x.strokeRect(14, 20, W - 28, H - 40); for (let i = 1; i < 7; i++) line(x, 14, 20 + i * (H - 40) / 7, W - 14, 20 + i * (H - 40) / 7, 'rgba(0,0,0,.5)', 3); stencil(x, 'SECURE', W / 2, H / 2, 24, 'rgba(143,59,46,.85)'); for (const yy of [30, H - 30]) { rivet(x, 24, yy); rivet(x, W - 24, yy); }
  }
  // base grime + top lip (so adjacent wall tops separate from the cap)
  let g = x.createLinearGradient(0, H * .72, 0, H); g.addColorStop(0, 'rgba(8,8,8,0)'); g.addColorStop(1, 'rgba(8,8,8,.5)'); x.fillStyle = g; x.fillRect(0, H * .72, W, H * .28);
  g = x.createLinearGradient(0, 0, 0, 14); g.addColorStop(0, 'rgba(215,210,195,.16)'); g.addColorStop(1, 'rgba(215,210,195,0)'); x.fillStyle = g; x.fillRect(0, 0, W, 14);
  wear(x, r, W, H, 500, .12); return c;
}
function makeCap(seed: number, base: RGB = [66, 68, 70]): HTMLCanvasElement { const c = material(S, S, base, seed, { low: .2, fine: .12 }); const x = c.getContext('2d')!; x.strokeStyle = 'rgba(210,205,190,.12)'; x.lineWidth = 3; x.strokeRect(2, 2, S - 4, S - 4); x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 2; x.strokeRect(8, 8, S - 16, S - 16); wear(x, rng(seed), S, S, 200, .15); return c; }

// ---------------- props ----------------
function makeCrateFace(kind: string, v: number, h: number): HTMLCanvasElement {
  const W = S, H = Math.round(S * h); const r = rng(v * 71 + Math.round(h * 10) + kind.length); let c: HTMLCanvasElement; let x: CanvasRenderingContext2D;
  if (kind === 'crate') {
    const pal: RGB[] = [[132, 104, 74], [74, 92, 112], [136, 62, 50], [92, 98, 58], [150, 140, 118]]; const col = pal[v % pal.length]; const cont = v % 5 !== 0;
    c = material(W, H, cont ? col : col, 40 + v, { low: .25, fine: .12, oct: [2, 6, 13], tint: [70, 48, 30], tintAmt: .8 }); x = c.getContext('2d')!;
    if (cont) { // corrugated shipping container
      for (let i = 0; i < 20; i++) { const px = 10 + i * 8.6; x.fillStyle = 'rgba(0,0,0,.26)'; x.fillRect(px + 3, 8, 3, H - 16); x.fillStyle = 'rgba(255,250,235,.10)'; x.fillRect(px, 8, 2, H - 16); }
      x.fillStyle = rgb(col, .55); x.fillRect(0, 0, W, 10); x.fillRect(0, H - 12, W, 12); x.fillRect(0, 0, 9, H); x.fillRect(W - 9, 0, 9, H); x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 2; x.strokeRect(1, 1, W - 2, H - 2);
      if (v % 5 === 2) { stencil(x, '♻', W / 2, H * .5, 40, 'rgba(225,215,195,.45)'); } else stencil(x, ['ANNEX-7', 'RCL-0' + (v % 9), 'SALV 44', 'LOT ' + (v * 7 % 90)][v % 4], W / 2, H * .38, 20, 'rgba(225,218,195,.55)');
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(W - 40, 20, 3, H - 40); x.fillRect(W - 52, 20, 3, H - 40); stain(x, r, W, H, 'rgba(140,70,36,.35)', 3, .5);
    } else { // wood/steel supply crate
      for (let i = 1; i < 4; i++) line(x, 0, i * H / 4, W, i * H / 4, 'rgba(0,0,0,.35)', 2); x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 8; x.strokeRect(8, 8, W - 16, H - 16); x.strokeStyle = 'rgba(210,190,150,.18)'; x.lineWidth = 2; x.strokeRect(5, 5, W - 10, H - 10); line(x, 10, 10, W - 10, H - 10, 'rgba(0,0,0,.4)', 7); line(x, W - 10, 10, 10, H - 10, 'rgba(0,0,0,.4)', 7);
      for (const [px, py] of [[16, 16], [W - 16, 16], [16, H - 16], [W - 16, H - 16]]) rivet(x, px, py, 3); stencil(x, 'FRAGILE', W / 2, H * .5, 16, 'rgba(225,218,195,.5)'); }
  } else if (kind === 'machine') {
    c = material(W, H, [92, 100, 106], 80 + v, { low: .25, fine: .1, tint: [100, 72, 52], tintAmt: .6 }); x = c.getContext('2d')!;
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, W, 16); x.fillRect(0, H - 22, W, 22); for (let i = 0; i < 3; i++) line(x, 0, 20 + i * (H - 50) / 3, W, 20 + i * (H - 50) / 3, 'rgba(0,0,0,.4)', 2);
    x.fillStyle = 'rgba(10,10,12,.85)'; x.fillRect(22, H * .2, 70, H * .22); for (let i = 0; i < 6; i++) line(x, 26, H * .2 + 8 + i * 10, 88, H * .2 + 8 + i * 10, 'rgba(120,125,125,.5)', 3); x.fillStyle = rgb(SL, 1, .75); x.fillRect(110, H * .2, 60, 34); x.fillStyle = 'rgba(207,198,176,.55)'; x.fillRect(114, H * .2 + 6, 28, 3); x.fillRect(114, H * .2 + 14, 40, 3); x.fillStyle = rgb(OX, 1, .9); x.beginPath(); x.arc(122, H * .2 + 56, 4, 0, 7); x.fill(); x.fillStyle = rgb(OL, 1, .9); x.beginPath(); x.arc(138, H * .2 + 56, 4, 0, 7); x.fill();
    hazardStripes(x, 0, H - 22, W, 12, 'rgba(176,150,70,.5)', 'rgba(20,20,20,.7)', 12); const gp = x.createLinearGradient(0, H * .56, 0, H * .56 + 14); gp.addColorStop(0, 'rgb(60,56,52)'); gp.addColorStop(.4, 'rgb(150,138,120)'); gp.addColorStop(1, 'rgb(40,36,32)'); x.fillStyle = gp; x.fillRect(0, H * .56, W, 14); for (const [px, py] of [[10, 24], [W - 10, 24], [10, H - 34], [W - 10, H - 34]]) rivet(x, px, py); stain(x, r, W, H, 'rgba(10,10,10,.35)', 2, .8);
  } else if (kind === 'rack') {
    c = material(W, H, [58, 54, 50], 120 + v, { low: .3, fine: .12 }); x = c.getContext('2d')!; const shelves = 3; x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(0, 0, W, H);
    for (let s = 0; s < shelves; s++) { const sy = H * (s + 1) / shelves - 10; x.fillStyle = 'rgb(86,78,68)'; x.fillRect(0, sy, W, 8); x.fillStyle = 'rgba(210,200,180,.2)'; x.fillRect(0, sy, W, 2);
      let px = 8; while (px < W - 24) { const bw = 20 + r() * 34, bh = 18 + r() * (H / shelves - 40); const pal: RGB[] = [[96, 78, 60], [70, 82, 96], [104, 56, 46], [86, 90, 58], [118, 110, 92]]; const col = pal[r() * pal.length | 0]; x.fillStyle = rgb(col, .8); x.fillRect(px, sy - bh, bw, bh); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(px + bw - 4, sy - bh, 4, bh); x.fillStyle = 'rgba(230,220,200,.12)'; x.fillRect(px, sy - bh, bw, 2); if (r() < .35) line(x, px, sy - bh / 2, px + bw, sy - bh / 2, 'rgba(0,0,0,.4)', 2); px += bw + 3 + r() * 8; } }
    for (const px of [4, W - 8]) { x.fillStyle = 'rgb(54,50,46)'; x.fillRect(px, 0, 5, H); }
  } else if (kind === 'conveyor') {
    c = material(W, H, [64, 67, 71], 160 + v, { low: .25, fine: .1, tint: [110, 78, 54], tintAmt: .5 }); x = c.getContext('2d')!; x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(0, H - 14, W, 14);
    for (let i = 0; i < 6; i++) { const px = 12 + i * 30; x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(px - 2, 6, 18, H - 10); const g = x.createLinearGradient(px, 0, px + 14, 0); g.addColorStop(0, 'rgb(46,48,52)'); g.addColorStop(.4, 'rgb(130,134,138)'); g.addColorStop(1, 'rgb(34,36,40)'); x.fillStyle = g; x.fillRect(px, 8, 14, H - 18); }
    hazardStripes(x, 0, 0, W, 7, 'rgba(176,150,70,.5)', 'rgba(20,20,20,.7)', 8); wear(x, r, W, H, 150, .15);
  } else { // pillar / default
    c = material(W, H, [96, 98, 96], 200 + v, { low: .3, fine: .12, tint: [70, 62, 52], tintAmt: .7 }); x = c.getContext('2d')!;
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(.3, 'rgba(255,255,240,.10)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    hazardStripes(x, 0, H - 44, W, 22, 'rgba(176,150,70,.5)', 'rgba(20,20,20,.7)', 14); hazardStripes(x, 0, 12, W, 12, 'rgba(176,150,70,.35)', 'rgba(20,20,20,.5)', 12); for (let i = 0; i < 4; i++) rivet(x, 14 + i * 54, H * .5, 3); stain(x, r, W, H, 'rgba(10,10,10,.4)', 2, .8); crack(x, r, W, H);
  }
  const x2 = c.getContext('2d')!; let g = x2.createLinearGradient(0, H * .75, 0, H); g.addColorStop(0, 'rgba(8,8,8,0)'); g.addColorStop(1, 'rgba(8,8,8,.38)'); x2.fillStyle = g; x2.fillRect(0, H * .75, W, H * .25); g = x2.createLinearGradient(0, 0, 0, 10); g.addColorStop(0, 'rgba(225,220,200,.16)'); g.addColorStop(1, 'rgba(225,220,200,0)'); x2.fillStyle = g; x2.fillRect(0, 0, W, 10); return c;
}
function makeTop(kind: string, v: number): HTMLCanvasElement {
  const r = rng(v * 13 + kind.length * 3);
  if (kind === 'crate') { const pal: RGB[] = [[140, 110, 78], [80, 98, 120], [146, 68, 54], [98, 104, 62], [156, 146, 124]]; const col = pal[v % 5]; const c = material(S, S, col, 300 + v, { low: .25, fine: .12 }); const x = c.getContext('2d')!; if (v % 5 !== 0) { for (let i = 0; i < 12; i++) { x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(i * 16 + 10, 0, 4, S); x.fillStyle = 'rgba(255,250,235,.1)'; x.fillRect(i * 16 + 8, 0, 2, S); } } else { for (let i = 1; i < 5; i++) line(x, 0, i * S / 5, S, i * S / 5, 'rgba(0,0,0,.35)', 2); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 7; x.strokeRect(6, 6, S - 12, S - 12); } x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 2; x.strokeRect(1, 1, S - 2, S - 2); wear(x, r, S, S, 200, .2); stain(x, r, S, S, 'rgba(110,60,30,.35)', 2, .6); return c; }
  if (kind === 'machine') { const c = material(S, S, [74, 80, 84], 320 + v, { low: .25 }); const x = c.getContext('2d')!; x.fillStyle = 'rgba(8,8,10,.85)'; x.fillRect(24, 24, S - 48, S - 48); for (let i = 0; i < 9; i++) line(x, 28, 30 + i * 16, S - 28, 30 + i * 16, 'rgba(110,112,108,.6)', 4); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 3; x.strokeRect(2, 2, S - 4, S - 4); for (const [px, py] of [[10, 10], [S - 10, 10], [10, S - 10], [S - 10, S - 10]]) rivet(x, px, py, 3); return c; }
  if (kind === 'rack') { const c = material(S, S, [64, 58, 52], 340, { low: .3 }); const x = c.getContext('2d')!; for (let i = 0; i < 5; i++) { x.fillStyle = `rgba(${90 + r() * 50 | 0},${80 + r() * 30 | 0},${60 + r() * 30 | 0},.8)`; x.fillRect(8 + r() * 100, 12 + i * 34, 40 + r() * 70, 24); } x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 4; x.strokeRect(2, 2, S - 4, S - 4); return c; }
  if (kind === 'conveyor') { const c = material(S, S, [40, 42, 45], 360, { low: .2 }); return c; }
  const c = makeCap(380 + v, [88, 90, 88]); const x = c.getContext('2d')!; hazardStripes(x, 0, 0, S, 12, 'rgba(176,150,70,.4)', 'rgba(20,20,20,.5)', 10); return c;
}
function makeBelt(ph: number): HTMLCanvasElement { const base = makeBeltBase(), c = mk(S, S), x = c.getContext('2d')!; const off = Math.round(ph / 6 * (S / 3)); x.drawImage(base, -off, 0); x.drawImage(base, S - off, 0); return c; }
let _bb: HTMLCanvasElement | null = null; function makeBeltBase(): HTMLCanvasElement { if (_bb) return _bb; const c = mk(S, S), x = c.getContext('2d')!; x.fillStyle = '#2b2c2e'; x.fillRect(0, 0, S, S); // belt flowing along +U; tileable in U with period S/3
  for (let i = 0; i < 3; i++) { const px = i * S / 3; x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(px + S / 3 - 5, 0, 5, S); x.fillStyle = 'rgba(215,205,170,.14)'; x.fillRect(px, 0, 3, S); x.strokeStyle = 'rgba(176,150,70,.42)'; x.lineWidth = 5; x.beginPath(); x.moveTo(px + 20, S * .22); x.lineTo(px + 44, S * .5); x.lineTo(px + 20, S * .78); x.stroke(); }
  const r = rng(5); wear(x, r, S, S, 260, .22); x.fillStyle = 'rgba(176,150,70,.5)'; x.fillRect(0, 0, S, 10); x.fillRect(0, S - 10, S, 10); hazardStripes(x, 0, 0, S, 10, 'rgba(176,150,70,.5)', 'rgba(20,20,20,.7)', 10); hazardStripes(x, 0, S - 10, S, 10, 'rgba(176,150,70,.5)', 'rgba(20,20,20,.7)', 10); _bb = c; return c; }

// ---------------- public renderer-facing API ----------------
export class Env {
  ok = true; private cache = new Map<string, HTMLCanvasElement>(); private bytes = 0;
  /** dungeon visual theme: themed floor/wall/prop variants are re-graded from the base procedural textures (see dungeon_env.ts) */
  theme = ''; da: DungeonArt | null = null; private th() { return this.da && isDungeonTheme(this.theme) ? this.theme : ''; }
  setTheme(t: string) { if (t === this.theme) return; this.theme = t; for (const k of [...this.cache.keys()]) { const i = k.indexOf('|'); if (i > 0 && k.slice(0, i) !== t) { const c = this.cache.get(k)!; this.bytes -= c.width * c.height * 4; this.cache.delete(k); } } if (this.th()) this.warmTheme(); }
  private warmTheme() { const t = this.theme; const q: (() => void)[] = []; for (const z of ['yard', 'proc', 'junction', 'boss', 'salvage', 'corridor', 'passage']) for (let v = 0; v < FLOOR_VARIANTS; v++) q.push(() => this.floor(z, v)); for (let v = 0; v < 6; v++) { q.push(() => this.wall('concrete', v, 'yard')); q.push(() => this.wall('steel', v, 'proc')); }
    for (let v = 0; v < 5; v++) { q.push(() => this.crateFace('crate', v, .9)); q.push(() => this.top('crate', v)); } for (const h of [1.8, 1.5, 1.6, 2, 1.4, 1.1, 1.7, 2.4]) q.push(() => this.crateFace('machine', 0, h)); for (const h of [1.6, 1.4, 1.8, 1.1, 2.2, 1.7]) q.push(() => this.crateFace('rack', 0, h)); q.push(() => this.top('machine', 0)); q.push(() => this.top('rack', 0)); for (const h of [2.2, 2.0, 2.4]) q.push(() => this.crateFace('pillar', 0, h)); q.push(() => this.top('pillar', 0));
    const tick = () => { if (this.theme !== t) return; const f = q.shift(); if (!f) return; try { f(); } catch { /* lazy path will retry */ } setTimeout(tick, 0); }; setTimeout(tick, 30); }
  private get<T extends HTMLCanvasElement>(k: string, f: () => T): T { let c = this.cache.get(k) as T; if (!c) { c = f(); this.cache.set(k, c); this.bytes += c.width * c.height * 4; } return c; }
  floor(zone: string, v: number) { const t = this.th(); return t ? this.get(`${t}|f:${zone}:${v}`, () => this.da!.floor(makeFloor(zone, v), t, zone, v)) : this.get(`f:${zone}:${v}`, () => makeFloor(zone, v)); }
  ao(side: number) { return this.get(`ao:${side}`, () => makeAO(side)); }
  wall(style: WStyle, v: number, zone: string) { const t = this.th(); if (t && style !== 'door') return this.get(`${t}|w:${style}:${v}`, () => this.da!.wall(makeWall(style, v, zone), t, style, v, zone)); return this.get(`w:${style}:${v}:${style === 'concrete' ? 'c' : 's'}`, () => makeWall(style, v, zone)); }
  cap(v: number) { return this.get(`cap:${v}`, () => makeCap(400 + v)); }
  crateFace(kind: string, v: number, h: number) { const t = this.th(); if (t) return this.get(`${t}|pf:${kind}:${v}:${h}`, () => this.da!.prop(makeCrateFace(kind, v, h), t, kind, v, false)); return this.get(`pf:${kind}:${v}:${h}`, () => makeCrateFace(kind, v, h)); }
  top(kind: string, v: number) { const t = this.th(); if (t) return this.get(`${t}|pt:${kind}:${v}`, () => this.da!.prop(makeTop(kind, v), t, kind, v, true)); return this.get(`pt:${kind}:${v}`, () => makeTop(kind, v)); }
  belt(ph = 0) { return this.get('belt' + ph, () => makeBelt(ph)); }
  get memoryMB() { return this.bytes / 1048576; }
  /** Build every texture one-per-tick in the background (first level/zone first) so no frame pays for generation in bulk. */
  warmAsync(firstZones: string[] = []) {
    const q: (() => void)[] = []; const zones = [...new Set([...firstZones, ...Object.keys(FLOOR)])];
    for (let i = 0; i < 4; i++) q.push(() => this.ao(i));
    for (const z of zones) for (let v = 0; v < FLOOR_VARIANTS; v++) q.push(() => this.floor(z, v));
    for (let v = 0; v < 6; v++) { q.push(() => this.wall('concrete', v, 'yard')); q.push(() => this.wall('steel', v, 'proc')); } q.push(() => this.wall('door', 0, 'x')); for (let i = 0; i < 3; i++) q.push(() => this.cap(i));
    for (let v = 0; v < 5; v++) { q.push(() => this.crateFace('crate', v, .9)); q.push(() => this.top('crate', v)); }
    for (const h of [1.8, 1.5, 1.6]) for (let v = 0; v < 3; v++) q.push(() => this.crateFace('machine', v, h)); q.push(() => this.top('machine', 0)); q.push(() => this.top('machine', 1)); q.push(() => this.top('machine', 2));
    for (const h of [1.6, 1.4]) q.push(() => this.crateFace('rack', 0, h)); q.push(() => this.top('rack', 0)); q.push(() => this.crateFace('conveyor', 0, .7)); q.push(() => this.crateFace('pillar', 0, 2.2)); q.push(() => this.top('pillar', 0)); for (let i = 0; i < 6; i++) q.push(() => this.belt(i));
    const tick = () => { const f = q.shift(); if (!f) return; try { f(); } catch { /* lazy path will retry */ } setTimeout(tick, 0); }; setTimeout(tick, 50);
  }
}
export function makeEnv(): Env | null { try { if (typeof document === 'undefined') return null; const e = new Env(); e.ao(0); return e; } catch { return null; } }
export const WALL_H = WALLH;
