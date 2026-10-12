// Rarity FX for cosmetics, painterly (Arcane / LoL skin-line direction, docs/RARITY_FX.md):
//  - less but better: no floor rings, light pillars, ember spam, scanlines or spark bursts.
//  - orange (legendary): a cohesive themed look INTEGRATED on the model: flat-shaded emissive inlays with ink outlines, crystalline
//    growths, brush-stroke energy wisps on hair/cloth, a painterly smear trail while moving. Idle motion is slow breathing; the
//    signature flourish plays on ability use / emote with anticipation -> snap -> soft settle (not a constant loop).
//  - purple (epic): polished material: one crisp rim highlight + an accent glow on a per-slot accessory with ink outline.
// One shared particle pool (fixed size), cached glow sprites, quality tiers scale it, Reduced FX freezes it (static inlays stay).
import type { CosDef } from './content/appearance';
import { Q } from './quality';
type C = CanvasRenderingContext2D;
export interface FxCtx { c: C; x: number; y: number; u: number; t: number; moving: boolean; face: number; id?: string }

export const ORANGE = '#ffb54a', PURPLE = '#b48cff';
/** Deliberate limited palettes: [ink, base, light, glow]. */
export const PALETTES: Record<string, [string, string, string, string]> = {
  hextech: ['#0d1420', '#2e7fd6', '#9fe6ff', '#ffd27a'],   // hextech blue / gold
  shimmer: ['#1a0d1e', '#c23fa0', '#ff9be0', '#b48cff'],   // shimmer pink / purple
  chem: ['#0c1a10', '#3fb04a', '#c8ff6a', '#e8ffb0'],      // chem-punk green
  forge: ['#1a0e08', '#d9631a', '#ffc070', '#fff0c8'],     // furnace gold-orange
  storm: ['#0c0a1e', '#6a5ad8', '#8fe0ff', '#e6d4ff'],     // season 1 signal storm: violet / static cyan
};
/** Per-orange-skin signature (theme + palette). Every orange cosmetic must have one (tests/rarity_fx.mjs). */
export const SIGNATURE: Record<string, { name: string; fx: string; pal: keyof typeof PALETTES; n?: number }> = {
  hair_flame: { name: 'Painted flame locks', fx: 'flame', pal: 'forge' },
  eyes_sun: { name: 'Furnace gaze streaks', fx: 'gaze', pal: 'forge' },
  torso_nova: { name: 'Heartstar inlay', fx: 'veins', pal: 'forge' },
  back_wings: { name: 'Cinder wing panels', fx: 'wings', pal: 'forge' },
  skin_holo: { name: 'Shimmer inlays', fx: 'holo', pal: 'shimmer' },
  aura_nova: { name: 'Hextech corona shards', fx: 'swarm', pal: 'hextech' },
  head_cowl: { name: 'Hextech seam', fx: 'chrome', pal: 'hextech' },
  pm_skin_plasma: { name: 'Chem-vein dermis', fx: 'veins', pal: 'chem' },
  pm_aura_swarm: { name: 'Hextech orbit shards', fx: 'swarm', pal: 'hextech' },
  pm_back_chrome: { name: 'Hextech wing panels', fx: 'wings', pal: 'hextech' },
  back_s1_halo: { name: 'Storm halo wings', fx: 'wings', pal: 'storm' },
  aura_s1_bloom: { name: 'Static bloom corona', fx: 'swarm', pal: 'storm', n: 4 }, // 4 shards: a sparser corona that reads as stilled static (and keeps the town draw-call budget)
};
/** Purple accessory silhouette per slot (one distinct shape per skin slot). */
export const ACCESSORY: Record<string, string> = { hair: 'crest', head: 'tickring', eyes: 'visor', torso: 'fins', arms: 'bracers', hands: 'orbs', legs: 'anklefins', back: 'shards', skin: 'outline', tattoo: 'glyph', aura: 'mote', trail: 'wake' };

// ------------------------------------------------------------------ settings / budget
let reducedOverride: boolean | null = null;
export const setReducedFx = (v: boolean | null) => { reducedOverride = v; };
export const reduced = () => reducedOverride ?? (typeof document !== 'undefined' && document.body?.classList.contains('reducefx'));
/** particle budget multiplier: high 1, medium .6, low .3; Reduced FX 0 */
export const budget = () => reduced() ? 0 : Q.p.fx === 2 ? .3 : Q.p.fx === 1 ? .6 : 1;
export const POOL_MAX = 240;

// ------------------------------------------------------------------ shared glow sprites (cached per colour) - used sparingly, under the flat shapes
const sprites = new Map<string, HTMLCanvasElement>();
export function glowSprite(col: string): HTMLCanvasElement {
  let s = sprites.get(col); if (s) return s; s = document.createElement('canvas'); s.width = s.height = 64; const x = s.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, col + 'cc'); g.addColorStop(.4, col + '55'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); sprites.set(col, s); return s; }
const blob = (c: C, x: number, y: number, r: number, col: string, a: number) => { if (a <= 0 || r <= 0) return; c.globalAlpha = Math.min(1, a); c.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); };

// ------------------------------------------------------------------ painterly primitives
/** flat polygon with an ink outline */
function shape(c: C, pts: number[][], fill: string, ink: string, lw: number, a = 1) { c.globalAlpha = a; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fillStyle = fill; c.fill(); if (lw > 0) { c.lineJoin = 'round'; c.strokeStyle = ink; c.lineWidth = lw; c.stroke(); } }
/** tapered brush stroke along a quadratic curve: thick in the middle, pointed ends (hand-painted wisp / smear) */
function stroke(c: C, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number, col: string, a: number, n = 6) {
  if (a <= 0) return; const L: number[][] = [], R: number[][] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, mt = 1 - t; const px = mt * mt * x0 + 2 * mt * t * cx + t * t * x1, py = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
    const dx = 2 * mt * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * mt * (cy - y0) + 2 * t * (y1 - cy); const l = Math.hypot(dx, dy) || 1; const hw = w * Math.sin(Math.PI * Math.min(1, t * 1.15)) * .5; L.push([px - dy / l * hw, py + dx / l * hw]); R.push([px + dy / l * hw, py - dx / l * hw]); }
  c.globalAlpha = a; c.beginPath(); [...L, ...R.reverse()].forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fillStyle = col; c.fill(); }
/** 4-point crystal shard (flat 2-tone + ink) */
function shard(c: C, x: number, y: number, h: number, w: number, ang: number, pal: string[], a = 1) {
  const ca = Math.cos(ang), sa = Math.sin(ang); const P = (px: number, py: number) => [x + px * ca - py * sa, y + px * sa + py * ca];
  shape(c, [P(0, -h), P(w, 0), P(0, h * .35), P(-w, 0)], pal[1], pal[0], Math.max(1, w * .28), a); shape(c, [P(0, -h), P(w * .2, -h * .1), P(0, h * .2), P(-w * .55, 0)], pal[2], pal[0], 0, a * .9); }
/** motion timing: anticipation (pull back) -> snap -> soft settle. e = seconds since trigger. Returns {k: 0..1 envelope, s: signed squash} */
export function flourishCurve(e: number): { k: number; s: number } { if (e < 0) return { k: 0, s: 0 }; if (e < .12) { const p = e / .12; return { k: .25 * p, s: -.35 * p }; } if (e < .26) { const p = (e - .12) / .14; return { k: .25 + .75 * (1 - (1 - p) ** 3), s: -.35 + 1.45 * p }; } if (e < 1.1) { const p = (e - .26) / .84; return { k: 1 - p * p * (3 - 2 * p), s: 1.1 * Math.exp(-p * 5) * Math.cos(p * 9) }; } return { k: 0, s: 0 }; }

// ------------------------------------------------------------------ particle pool (shared by every character) - now only painterly smears / motes
interface P { on: boolean; o: string; x: number; y: number; vx: number; vy: number; life: number; age: number; r: number; col: string; kind: 0 | 1 | 2 }
const pool: P[] = Array.from({ length: POOL_MAX }, () => ({ on: false, o: '', x: 0, y: 0, vx: 0, vy: 0, life: 1, age: 0, r: 1, col: ORANGE, kind: 0 }));
let cursor = 0;
export const stats = { live: 0, spawned: 0, dropped: 0, frames: 0 };
function spawn(o: string, x: number, y: number, vx: number, vy: number, life: number, r: number, col: string, kind: 0 | 1 | 2 = 0) {
  for (let n = 0; n < POOL_MAX; n++) { const p = pool[cursor]; cursor = (cursor + 1) % POOL_MAX; if (!p.on) { p.on = true; p.o = o; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.age = 0; p.r = r; p.col = col; p.kind = kind; stats.spawned++; return; } }
  stats.dropped++; }
export const liveParticles = (o?: string) => pool.reduce((n, p) => n + (p.on && (!o || p.o === o) ? 1 : 0), 0);
export const resetFx = () => { for (const p of pool) p.on = false; owners.clear(); stats.live = stats.spawned = stats.dropped = stats.frames = 0; };

interface Own { t: number; acc: number; tacc: number; flo: number; ax: number; ay: number; tier: 'orange' | 'purple' | null }
const owners = new Map<string, Own>();
let onSound: ((name: string, owner: string) => void) | null = null;
export const setFxSound = (f: typeof onSound) => { onSound = f; };
/** Signature flourish plays on ability use / emote (render.ts triggers it), never on a timer. Sound at most once per FLOURISH_SOUND_GAP s. */
export const FLOURISH_SOUND_GAP = 25; let lastFloSound = -1e9;

const hasRar = (list: CosDef[], r: string) => list.some(d => d.rarity === r);
export const topTier = (list: CosDef[]): 'orange' | 'purple' | null => hasRar(list, 'orange') ? 'orange' : hasRar(list, 'purple') ? 'purple' : null;

/** Trigger the signature flourish (ability use, emote, dressing-room showcase). */
export function flourish(owner = 'me', at?: number) { const o = owners.get(owner); if (!o) { owners.set(owner, { t: 0, acc: 0, tacc: 0, flo: at ?? -1, ax: 0, ay: 0, tier: null }); return; } o.flo = at ?? -1; }
export const flourishAge = (owner = 'me') => { const o = owners.get(owner); return o ? o.t - o.flo : 1e9; };

// ------------------------------------------------------------------ main entry
/** Feature flag: ?skinfx=0 or localStorage 'flag.skinfx'='0' turns all skin/gear FX off (cosmetics still draw). */
export let SKIN_FX_ON = (() => { try { const q = new URLSearchParams(location.search).get('skinfx'); if (q != null) return q !== '0'; return localStorage.getItem('flag.skinfx') !== '0'; } catch { return true; } })();
export function setSkinFx(on: boolean) { SKIN_FX_ON = on; }
export function drawRarityFx(k: FxCtx, list: CosDef[], phase: 'back' | 'front') {
  if (!SKIN_FX_ON) return;
  const tier = topTier(list); if (!tier) return; const id = k.id || 'me'; const { c, x, y, u } = k; const red = reduced(), B = budget();
  const t = red ? 0 : k.t;
  let o = owners.get(id); if (!o) { o = { t: k.t, acc: 0, tacc: 0, flo: -1e9, ax: x, ay: y, tier }; owners.set(id, o); if (owners.size > 64) owners.delete(owners.keys().next().value as string); }
  if (o.flo === -1) { o.flo = k.t; if (tier === 'orange' && (id === 'me' || id === 'dr') && k.t - lastFloSound > FLOURISH_SOUND_GAP) { lastFloSound = k.t; onSound?.('cos_flourish_orange', id); } }
  const fc = red ? { k: 0, s: 0 } : flourishCurve(k.t - o.flo);
  c.save();
  readable(k, list, tier, phase, t);
  if (phase === 'back') {
    const dt = Math.max(0, Math.min(.1, k.t - o.t)); o.t = k.t; const dx = x - o.ax, dy = y - o.ay; o.ax = x; o.ay = y;
    if (tier === 'orange') {
      for (const d of list) if (d.rarity === 'orange') signature(k, d, 'back', t, fc);
      // painterly smear trail while moving: a few long tapered strokes in the skin palette (no confetti)
      const pal = PALETTES[SIGNATURE[list.find(d => d.rarity === 'orange')!.id]?.pal || 'forge'];
      if (k.moving && B > 0) { o.tacc += dt * 9 * B; while (o.tacc >= 1) { o.tacc--; spawn(id + ':trail', x + (Math.random() - .5) * 8 * u, y - (8 + Math.random() * 26) * u, 0, 0, .45, (5 + Math.random() * 4) * u, Math.random() < .6 ? pal[2] : pal[1], 2); } }
    } else for (const d of list) if (d.rarity === 'purple') accessory(k, d, 'back', t);
    let live = 0;
    for (const p of pool) { if (!p.on || (p.o !== id && p.o !== id + ':trail')) continue; p.age += dt; if (p.age >= p.life) { p.on = false; continue; } live++;
      const a = 1 - p.age / p.life; if (p.kind === 2) { const ang = Math.atan2(dy || .001, dx || .001); const L = p.r * (1 + (1 - a)); stroke(c, p.x - Math.cos(ang) * L, p.y - Math.sin(ang) * L * .5, p.x, p.y - 2 * u, p.x + Math.cos(ang) * L * .3, p.y + Math.sin(ang) * L * .15, 1.6 * u * a, p.col, .55 * a); }
      else { p.x += dx + p.vx * dt; p.y += dy + p.vy * dt; shape(c, [[p.x, p.y - p.r], [p.x + p.r * .5, p.y], [p.x, p.y + p.r], [p.x - p.r * .5, p.y]], p.col, '#000', 0, a * .8); } }
    stats.live = live; stats.frames++;
  } else {
    if (tier === 'orange') { for (const d of list) if (d.rarity === 'orange') signature(k, d, 'front', t, fc); }
    else { for (const d of list) if (d.rarity === 'purple') accessory(k, d, 'front', t); }
    if (tier === 'purple') { // polished material: one crisp rim highlight that slowly travels along the shoulder line
      const ph = red ? .5 : .5 + .5 * Math.sin(t * .6); c.globalAlpha = .55; c.strokeStyle = '#efe4ff'; c.lineWidth = Math.max(1, .55 * u); c.lineCap = 'round'; c.beginPath(); c.arc(x, y - 30 * u, 9.5 * u, -Math.PI * (.85 - ph * .3), -Math.PI * (.6 - ph * .3)); c.stroke(); }
  }
  c.restore();
}

// ------------------------------------------------------------------ in-world readability (docs/RARITY_FX.md "Readability")
// At town zoom a character is ~40 px tall, so inlays alone vanish. Three restrained, static-shaped layers make the tier read at a glance:
//  1. ground mark: a painted brush crescent under the feet (two tapered strokes), tier palette; orange also a faint warm pool.
//  2. silhouette: orange = flat mantle plates on both shoulders + a 3-shard crest; purple = one angled pauldron plate + a thin halo tick.
//  3. palette rim: an ink-backed rim line down the lit side (orange both sides) so the outline separates from the ground.
// Sizes have a pixel floor (never thinner than ~1.5 px) so they survive the small in-world scale; all batched paths, no particles.
function readable(k: FxCtx, list: CosDef[], tier: 'orange' | 'purple', phase: 'back' | 'front', t: number) {
  const { c, x, y, u } = k; const O = tier === 'orange';
  const P: string[] = O ? PALETTES[SIGNATURE[list.find(d => d.rarity === 'orange')!.id]?.pal || 'forge'] : ['#140a20', '#7a4ad0', '#efe4ff', PURPLE];
  const px = (v: number) => Math.max(v * u, 1.5); c.lineCap = 'round';
  // batched paths: every layer below is ONE path, so a character adds ~25 canvas ops (perf_gate draw-call budget)
  const poly = (pts: number[][]) => { c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
  if (phase === 'back') {
    // 1. ground mark: two open brush arcs on the iso floor (front + back halves, gaps at the sides), palette light
    c.beginPath(); c.ellipse(x, y + .6 * u, 9 * u, 3.2 * u, 0, .35, Math.PI - .35); c.moveTo(x - 9 * u * Math.cos(.5), y + .6 * u - 3.2 * u * Math.sin(.5)); c.ellipse(x, y + .6 * u, 9 * u, 3.2 * u, 0, Math.PI + .5, -.5);
    c.globalAlpha = O ? .75 : .6; c.strokeStyle = O ? P[2] : P[3]; c.lineWidth = px(O ? 1.1 : .8); c.stroke();
    if (!O) { c.beginPath(); c.ellipse(x, y - 49 * u, 5.5 * u, 1.7 * u, 0, Math.PI * 1.05, Math.PI * 1.95); c.globalAlpha = .8; c.strokeStyle = P[0]; c.lineWidth = px(1.4); c.stroke(); c.strokeStyle = P[3]; c.lineWidth = px(.8); c.stroke(); }
    c.globalAlpha = 1; return;
  }
  // 2. silhouette pieces: shoulder mantle plate(s) (+ orange crest of 3 shards), one fill + one ink stroke
  c.beginPath(); for (const s of O ? [-1, 1] : [-1]) poly([[x + s * 4 * u, y - 37.5 * u], [x + s * 11.5 * u, y - 38.5 * u], [x + s * 12.5 * u, y - 33.5 * u], [x + s * 8 * u, y - 31.5 * u]]);
  if (O && !list.some(d => d.rarity === 'orange' && (d.slot === 'head' || d.slot === 'hair'))) for (const [ox, h, w] of [[0, 5.5, 1.4], [-2.6, 3.8, 1.1], [2.6, 3.8, 1.1]]) poly([[x + ox * u, y - (47 + h * (1 + .12 * Math.sin(t * 1.4))) * u], [x + (ox + w) * u, y - 47 * u], [x + ox * u, y - 45.5 * u], [x + (ox - w) * u, y - 47 * u]]);
  c.globalAlpha = .95; c.fillStyle = P[1]; c.fill(); c.strokeStyle = P[0]; c.lineWidth = px(.5); c.stroke();
  // 3. palette rim down the lit side(s) + the plate's top edge highlight, one light stroke (the plate already carries the ink outline)
  c.beginPath(); for (const s of O ? [-1, 1] : [-1]) { c.moveTo(x + s * 4.5 * u, y - 37.4 * u); c.lineTo(x + s * 11.3 * u, y - 38.3 * u); c.moveTo(x + s * 9 * u, y - 31 * u); c.quadraticCurveTo(x + s * 10.5 * u, y - 20 * u, x + s * 7 * u, y - 9 * u); }
  c.globalAlpha = O ? .9 : .8; c.strokeStyle = O ? P[2] : P[3]; c.lineWidth = px(.7); c.stroke();
  c.globalAlpha = 1;
}
// ------------------------------------------------------------------ orange signatures (integrated on the model, themed palettes)
function signature(k: FxCtx, d: CosDef, phase: 'back' | 'front', t: number, fc: { k: number; s: number }) {
  const { c, x, y, u } = k; const sg = SIGNATURE[d.id]; if (!sg) return; const P = PALETTES[sg.pal]; const ink = P[0], lw = Math.max(1, .55 * u);
  const br = .5 + .5 * Math.sin(t * 1.4);              // slow breathing, not noise
  const amp = 1 + fc.k * .6 + fc.s * .25;              // flourish: anticipation pull-in, snap, settle
  switch (sg.fx) {
    case 'flame': if (phase === 'front') { // painted flame locks: 5 tapered strokes rising from the crown, swaying with follow-through
      for (let i = 0; i < 5; i++) { const sx = x + (i - 2) * 2.2 * u, sway = Math.sin(t * 1.6 + i * .9) * 1.6 * u + fc.s * 2 * u, h = (7 + (i % 2) * 3 + br * 1.5) * u * amp;
        stroke(c, sx, y - 44 * u, sx + sway, y - 44 * u - h * .6, sx + sway * 1.6, y - 44 * u - h, 3.4 * u, ink, .9); stroke(c, sx, y - 44.5 * u, sx + sway, y - 44 * u - h * .55, sx + sway * 1.5, y - 44 * u - h * .9, 2.4 * u, i % 2 ? P[1] : P[2], .95); }
      blob(c, x, y - 49 * u, 7 * u, P[1], .25 + .15 * br); } break;
    case 'gaze': if (phase === 'front') { for (const ex of [-2, 2]) { const ox = x + ex * u, oy = y - 41.5 * u; shape(c, [[ox - 1.6 * u, oy], [ox, oy - .9 * u], [ox + 1.6 * u, oy], [ox, oy + .9 * u]], P[3], ink, lw * .7); // almond eye inlay
        const L = (4 + br * 2 + fc.k * 10) * u; stroke(c, ox, oy, ox + Math.cos(k.face) * L * .5 + ex * .5 * u, oy - 1 * u, ox + Math.cos(k.face) * L + ex * u, oy + Math.sin(k.face) * L * .3 - 1.5 * u, 1.6 * u, P[2], .75); } } break;
    case 'veins': if (phase === 'front') { // inlaid core + branching painted channels with an ink outline (Heartstar / chem-veins)
      const cy = y - 29 * u; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .7; const L = (6 + (i % 2) * 2) * u * amp; stroke(c, x, cy, x + Math.cos(a + .3) * L * .5, cy + Math.sin(a + .3) * L * .5, x + Math.cos(a) * L, cy + Math.sin(a) * L + 4 * u, 1.9 * u, ink, .85); stroke(c, x, cy, x + Math.cos(a + .3) * L * .5, cy + Math.sin(a + .3) * L * .5, x + Math.cos(a) * L, cy + Math.sin(a) * L + 4 * u, 1.1 * u, P[2], .55 + .35 * br); }
      blob(c, x, cy, 6 * u, P[1], .3 + .2 * br); shard(c, x, cy, 3.4 * u * amp, 2.2 * u, 0, P, 1); } break;
    case 'wings': if (phase === 'back') { // flat panelled wings (2 feathers each side), slow beat, snap open on flourish
      const open = .25 + .08 * br + fc.k * .45 + fc.s * .1; for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + sd * (open + i * .32), L = (14 - i * 2.5) * u, bx = x + sd * 2 * u, by = y - 33 * u;
        const tx = bx + Math.cos(a) * L * sd * sd, ty = by + Math.sin(a) * L * .85; shape(c, [[bx, by], [bx + (tx - bx) * .55 + sd * 2 * u, by + (ty - by) * .55 - 2 * u], [tx, ty], [bx + (tx - bx) * .5, by + (ty - by) * .5 + 2.5 * u]], i ? P[1] : P[2], ink, lw); } } break;
    case 'holo': if (phase === 'front') { // shimmer inlays: 3 crisp diamond inlays on chest/shoulders + one slow iridescent brush streak across the body
      for (const [ix, iy, s] of [[0, -31, 1.3], [-7, -34, .9], [7, -34, .9]]) shard(c, x + ix * u, y + iy * u, 2.2 * u * s * amp, 1.4 * u * s, 0, P, .95);
      const ph = (t * .25) % 1.6; if (ph < 1) { const sy = y - (8 + ph * 36) * u; stroke(c, x - 10 * u, sy + 3 * u, x, sy - 1 * u, x + 10 * u, sy + 2 * u, 2.2 * u, P[2], .35 * Math.sin(ph * Math.PI)); } } break;
    case 'swarm': { // hextech corona: 6 crystal shards on a slow ellipse, depth sorted, gold rim on the near ones
      const n = sg.n || 6; for (let i = 0; i < n; i++) { const a = t * .45 + i / n * Math.PI * 2; const z = Math.sin(a); if ((z > 0) !== (phase === 'front')) continue; const r = (13 + fc.k * 5) * u;
        shard(c, x + Math.cos(a) * r, y - 24 * u + z * 3.5 * u + Math.sin(t + i) * 1.2 * u, (3 + z) * u, 1.6 * u, Math.cos(a) * .4, z > 0 ? [P[0], P[1], P[3], P[3]] : P, .95); } } break;
    case 'chrome': if (phase === 'front') { // hextech seam: gold seam inlay down the cowl + two small crystal studs
      const cy = y - 46 * u; shape(c, [[x - .8 * u, cy - 4 * u], [x + .8 * u, cy - 4 * u], [x + .5 * u, cy + 5 * u], [x - .5 * u, cy + 5 * u]], P[3], ink, lw * .8, .9);
      shard(c, x - 3.4 * u, cy + 1 * u, 1.8 * u * amp, 1.1 * u, -.3, P, 1); shard(c, x + 3.4 * u, cy + 1 * u, 1.8 * u * amp, 1.1 * u, .3, P, 1); blob(c, x, cy, 4 * u, P[1], .2 + .2 * br); } break;
  }
}
// ------------------------------------------------------------------ purple accessories (one silhouette per slot): polished flat shapes + ink + accent glow
function accessory(k: FxCtx, d: CosDef, phase: 'back' | 'front', t: number) {
  const { c, x, y, u } = k; const a = ACCESSORY[d.slot]; const col = d.c || PURPLE, ink = '#140a20', lw = Math.max(1, .5 * u); const P = [ink, col, '#efe4ff', PURPLE];
  const tri = (pts: number[][]) => shape(c, pts, col, ink, lw, .95);
  if (phase === 'back') { if (a === 'shards') for (const s of [-1, 1]) shard(c, x + s * 10 * u, y - (34 + Math.sin(t * 1.2 + s) * .8) * u, 4 * u, 1.6 * u, s * .25, P, .95);
    else if (a === 'mote') { const an = t * .7; shard(c, x + Math.cos(an) * 13 * u, y - 22 * u + Math.sin(an) * 3 * u, 2 * u, 1.2 * u, 0, P, .9); } return; }
  switch (a) {
    case 'crest': for (const s of [-1, 1]) tri([[x + s * 2 * u, y - 46 * u], [x + s * 5 * u, y - 52 * u], [x + s * 4.2 * u, y - 45 * u]]); break;
    case 'tickring': c.globalAlpha = .9; c.strokeStyle = ink; c.lineWidth = 2.2 * lw; c.beginPath(); c.ellipse(x, y - 52 * u, 6 * u, 1.8 * u, 0, 0, 7); c.stroke(); c.strokeStyle = col; c.lineWidth = lw * 1.2; c.stroke(); break;
    case 'visor': shape(c, [[x - 5 * u, y - 42.6 * u], [x + 5 * u, y - 42.6 * u], [x + 4 * u, y - 41.2 * u], [x - 4 * u, y - 41.2 * u]], col, ink, lw, .9); break;
    case 'fins': for (const s of [-1, 1]) tri([[x + s * 7 * u, y - 35 * u], [x + s * 12 * u, y - 38 * u], [x + s * 10 * u, y - 32.5 * u]]); break;
    case 'bracers': for (const s of [-1, 1]) shape(c, [[x + s * 8 * u, y - 23 * u], [x + s * 11 * u, y - 23 * u], [x + s * 11 * u, y - 21 * u], [x + s * 8 * u, y - 21 * u]], col, ink, lw); break;
    case 'orbs': for (const s of [-1, 1]) { shard(c, x + s * 10 * u, y - 16 * u, 1.8 * u, 1.2 * u, 0, P, .95); } break;
    case 'anklefins': for (const s of [-1, 1]) tri([[x + s * 4 * u, y - 4 * u], [x + s * 7.5 * u, y - 6.5 * u], [x + s * 6 * u, y - 2.5 * u]]); break;
    case 'outline': c.globalAlpha = .4; c.strokeStyle = '#efe4ff'; c.lineWidth = lw; c.beginPath(); c.arc(x, y - 30 * u, 10 * u, -2.6, -1.9); c.stroke(); c.beginPath(); c.arc(x, y - 30 * u, 10 * u, -1.25, -.55); c.stroke(); break;
    case 'glyph': shard(c, x + 11 * u, y - 40 * u, 2 * u, 1.2 * u, 0, P, .9); break;
  }
  blob(c, x, y - 30 * u, 8 * u, PURPLE, .08); // faint accent glow
}

// ------------------------------------------------------------------ sounds (ElevenLabs, public/audio/sfx/cos_*.mp3), lazy + cached, rate-limited
const sbuf = new Map<string, AudioBuffer | 'loading' | null>(); const lastPlay: Record<string, number> = {};
export function playCosSfx(name: string, gain = .55) {
  const A = (globalThis as any).__audio; const ctx: AudioContext | undefined = A?.ctx; if (!ctx || ctx.state !== 'running' || !A.sfxBus) return false;
  const now = performance.now(); if (now - (lastPlay[name] || 0) < 1500) return false; lastPlay[name] = now;
  const b = sbuf.get(name); if (b === 'loading' || b === null) return false;
  if (!b) { sbuf.set(name, 'loading'); fetch('audio/sfx/' + name + '.mp3').then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(x => ctx.decodeAudioData(x)).then(d => { sbuf.set(name, d); playCosSfx(name, gain); lastPlay[name] = 0; }).catch(() => sbuf.set(name, null)); lastPlay[name] = 0; return false; }
  const src = ctx.createBufferSource(); src.buffer = b; const g = ctx.createGain(); g.gain.value = gain; src.connect(g); g.connect(A.sfxBus); src.start(); return true; }
export const fxSoundLog: string[] = [];
setFxSound((n, owner) => { if (owner !== 'me' && owner !== 'dr') return; fxSoundLog.push(n); if (fxSoundLog.length > 50) fxSoundLog.shift(); playCosSfx(n, n.includes('flourish') ? .22 : .35); });
/** equip sound for the top tier of a set of applied pieces */
export function equipSound(list: CosDef[]) { const tr = topTier(list); if (!tr) return; const n = 'cos_equip_' + tr; fxSoundLog.push(n); playCosSfx(n); }
if (typeof window !== 'undefined') (window as any).__cosfx = { stats, liveParticles, resetFx, setReducedFx, budget, SIGNATURE, ACCESSORY, fxSoundLog, flourish, POOL_MAX };

// ------------------------------------------------------------------ gear / augment rarity FX (scaled DOWN: always below the cosmetic tier)
/** body-part anchor (units) per hardware slot */
const PART: Record<string, [number, number]> = { face: [0, -41], brain: [0, -45], torso: [0, -28], armL: [-9.5, -27], armR: [9.5, -27], handL: [-10, -17], handR: [10, -17], legL: [-4, -10], legR: [4, -10], footL: [-4, -1], footR: [4, -1] };
export type GearFx = { slot: string; r: 'purple' | 'orange' };
/** Caps: at most GEAR_GLINTS glints (orange first), particle rate capped at GEAR_RATE/s total; none when the character already wears an orange cosmetic tier. */
export const GEAR_GLINTS = 4, GEAR_RATE = 1;
export function encodeGear(g: GearFx[]): string[] { return g.map(x => x.slot + ':' + (x.r === 'orange' ? 'o' : 'p')); }
export function decodeGear(a?: string[]): GearFx[] { return (a || []).map(s => { const [slot, r] = String(s).split(':'); return PART[slot] && (r === 'o' || r === 'p') ? { slot, r: r === 'o' ? 'orange' : 'purple' } as GearFx : null; }).filter(Boolean) as GearFx[]; }
export function drawGearFx(k: FxCtx, gear: GearFx[], cosTier: 'orange' | 'purple' | null) {
  if (!SKIN_FX_ON) return;
  if (!gear.length) return; const { c, x, y, u } = k; const red = reduced(), t = red ? 0 : k.t, B = budget(); const id = (k.id || 'me') + ':gear';
  const list = [...gear].sort((a, b) => (b.r === 'orange' ? 1 : 0) - (a.r === 'orange' ? 1 : 0)).slice(0, GEAR_GLINTS);
  let o = owners.get(id); if (!o) { o = { t: k.t, acc: 0, tacc: 0, flo: 0, ax: x, ay: y, tier: null }; owners.set(id, o); } const dt = Math.max(0, Math.min(.1, k.t - o.t)); o.t = k.t; const dx = x - o.ax, dy = y - o.ay; o.ax = x; o.ay = y;
  c.save(); c.globalCompositeOperation = 'lighter';
  list.forEach((g, i) => { const p = PART[g.slot]; const O = g.r === 'orange'; const ph = .5 + .5 * Math.sin(t * 1.2 + i * 1.3); const px = x + p[0] * u, py = y + p[1] * u, r = (O ? 1.5 : 1.1) * u;
    // small flat inlay with ink outline (smaller and dimmer than any cosmetic layer)
    shape(c, [[px, py - r * 1.4], [px + r, py], [px, py + r * .6], [px - r, py]], O ? '#ffc070' : '#c9a8ff', '#120c10', Math.max(.8, .35 * u), .55 + .25 * ph); });
  // particles: tiny rate, off under an orange cosmetic tier so skins stay the premium layer
  const rate = cosTier === 'orange' ? 0 : Math.min(GEAR_RATE, list.reduce((n, g) => n + (g.r === 'orange' ? .4 : .15), 0)) * B;
  o.acc += dt * rate; while (o.acc >= 1) { o.acc--; const g = list[Math.floor(Math.random() * list.length)], p = PART[g.slot]; spawn(id, x + p[0] * u, y + p[1] * u, (Math.random() - .5) * 4 * u, -7 * u, .7, .7 * u, g.r === 'orange' ? '#ffcf8a' : '#e2c8ff'); }
  for (const p of pool) { if (!p.on || p.o !== id) continue; p.age += dt; if (p.age >= p.life) { p.on = false; continue; } p.x += dx + p.vx * dt; p.y += dy + p.vy * dt; const a = 1 - p.age / p.life; shape(c, [[p.x, p.y - p.r], [p.x + p.r * .5, p.y], [p.x, p.y + p.r], [p.x - p.r * .5, p.y]], p.col, '#000', 0, a * .6); }
  c.restore(); }
