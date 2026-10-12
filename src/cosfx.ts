// Rarity FX for cosmetics: orange (legendary) = epic animated layers + per-skin signature + flourishes + moving trail;
// purple (epic) = subtle sheen/glow + light particle accent + a per-skin accessory silhouette. Clearly below orange.
// Drawn from drawCosmetics() so the local player, other players (net/remote_render) and the dressing room all get it.
// Budget: ONE shared particle pool (fixed size), cached glow sprites (shared "shaders"), quality tiers scale it, Reduced FX freezes it.
// See docs/RARITY_FX.md.
import type { CosDef } from './content/appearance';
import { Q } from './quality';
type C = CanvasRenderingContext2D;
export interface FxCtx { c: C; x: number; y: number; u: number; t: number; moving: boolean; face: number; id?: string }

export const ORANGE = '#ff9a1f', PURPLE = '#b46bff';
/** Per-orange-skin signature effect. Every orange cosmetic must have one (tests/rarity_fx.mjs). */
export const SIGNATURE: Record<string, { name: string; fx: string }> = {
  hair_flame: { name: 'Plasma flame crown', fx: 'flame' },
  eyes_sun: { name: 'Furnace gaze beams', fx: 'gaze' },
  torso_nova: { name: 'Plasma veins', fx: 'veins' },
  back_wings: { name: 'Cinder wingbeat', fx: 'wings' },
  skin_holo: { name: 'Holographic glitch', fx: 'holo' },
  aura_nova: { name: 'Nanoswarm corona', fx: 'swarm' },
  head_cowl: { name: 'Liquid chrome seam', fx: 'chrome' },
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

// ------------------------------------------------------------------ shared glow sprites (cached per colour+size bucket)
const sprites = new Map<string, HTMLCanvasElement>();
export function glowSprite(col: string): HTMLCanvasElement {
  let s = sprites.get(col); if (s) return s; s = document.createElement('canvas'); s.width = s.height = 64; const x = s.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, col); g.addColorStop(.25, col + 'aa'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); sprites.set(col, s); return s; }
const blob = (c: C, x: number, y: number, r: number, col: string, a: number) => { if (a <= 0 || r <= 0) return; c.globalAlpha = Math.min(1, a); c.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); };

// ------------------------------------------------------------------ particle pool (shared by every character)
interface P { on: boolean; o: string; x: number; y: number; vx: number; vy: number; life: number; age: number; r: number; col: string; kind: 0 | 1 | 2 }
const pool: P[] = Array.from({ length: POOL_MAX }, () => ({ on: false, o: '', x: 0, y: 0, vx: 0, vy: 0, life: 1, age: 0, r: 1, col: ORANGE, kind: 0 }));
let cursor = 0;
export const stats = { live: 0, spawned: 0, dropped: 0, frames: 0 };
function spawn(o: string, x: number, y: number, vx: number, vy: number, life: number, r: number, col: string, kind: 0 | 1 | 2 = 0) {
  for (let n = 0; n < POOL_MAX; n++) { const p = pool[cursor]; cursor = (cursor + 1) % POOL_MAX; if (!p.on) { p.on = true; p.o = o; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.age = 0; p.r = r; p.col = col; p.kind = kind; stats.spawned++; return; } }
  stats.dropped++; }
export const liveParticles = (o?: string) => pool.reduce((n, p) => n + (p.on && (!o || p.o === o) ? 1 : 0), 0);
export const resetFx = () => { for (const p of pool) p.on = false; owners.clear(); stats.live = stats.spawned = stats.dropped = stats.frames = 0; };

/** per-owner state: last time, emit accumulators, flourish clock, last anchor (for the moving trail) */
interface Own { t: number; acc: number; tacc: number; flo: number; ax: number; ay: number; tier: 'orange' | 'purple' | null }
const owners = new Map<string, Own>();
let onSound: ((name: string, owner: string) => void) | null = null;
export const setFxSound = (f: typeof onSound) => { onSound = f; };
export const FLOURISH_EVERY = 7;

const hasRar = (list: CosDef[], r: string) => list.some(d => d.rarity === r);
export const topTier = (list: CosDef[]): 'orange' | 'purple' | null => hasRar(list, 'orange') ? 'orange' : hasRar(list, 'purple') ? 'purple' : null;

/** Force a flourish / reveal now (dressing room showcase, equip). */
export function flourish(owner = 'me', at?: number) { const o = owners.get(owner); if (o) o.flo = at ?? -1e9; }

// ------------------------------------------------------------------ main entry
export function drawRarityFx(k: FxCtx, list: CosDef[], phase: 'back' | 'front') {
  const tier = topTier(list); if (!tier) return; const id = k.id || 'me'; const { c, x, y, u } = k; const red = reduced(), B = budget();
  const t = red ? 0 : k.t; // Reduced FX: frozen look, no motion
  let o = owners.get(id); if (!o) { o = { t: k.t, acc: 0, tacc: 0, flo: k.t, ax: x, ay: y, tier }; owners.set(id, o); if (owners.size > 64) owners.delete(owners.keys().next().value as string); }
  const col = tier === 'orange' ? ORANGE : PURPLE;
  c.save();
  if (phase === 'back') {
    const dt = Math.max(0, Math.min(.1, k.t - o.t)); o.t = k.t;
    // move existing particles of this owner along with the anchor so they stay with the character (trail ones keep their screen position)
    const dx = x - o.ax, dy = y - o.ay; o.ax = x; o.ay = y;
    c.globalCompositeOperation = 'lighter';
    if (tier === 'orange') {
      // floor crown: bright ring + rotating ticks + light pillar (reads as top tier at a glance)
      const pu = .75 + .25 * Math.sin(t * 3);
      blob(c, x, y, 26 * u, ORANGE, .55 * pu);
      c.globalAlpha = .85; c.strokeStyle = ORANGE; c.lineWidth = Math.max(1.5, 1.1 * u); c.beginPath(); c.ellipse(x, y, 15 * u, 5.4 * u, 0, 0, 7); c.stroke();
      c.strokeStyle = '#ffe2a8'; c.lineWidth = Math.max(1, .7 * u); for (let i = 0; i < 6; i++) { const a = t * 1.6 + i * Math.PI / 3; c.beginPath(); c.ellipse(x, y, 15 * u, 5.4 * u, 0, a, a + .35); c.stroke(); }
      if (!red) { const g = c.createLinearGradient(x, y - 60 * u, x, y); g.addColorStop(0, 'rgba(255,154,31,0)'); g.addColorStop(1, `rgba(255,154,31,${.22 * pu})`); c.globalAlpha = 1; c.fillStyle = g; c.fillRect(x - 9 * u, y - 60 * u, 18 * u, 60 * u); }
      for (const d of list) if (d.rarity === 'orange') signature(k, d, 'back', t, id, B);
      // idle flourish: spiral burst + sound
      if (!red && k.t - o.flo > FLOURISH_EVERY) { o.flo = k.t; const n = Math.round(28 * B); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; spawn(id, x + Math.cos(a) * 6 * u, y - 4 * u, Math.cos(a) * 26 * u, -18 * u - Math.random() * 20 * u, .9 + Math.random() * .5, 1.4 * u, i % 3 ? ORANGE : '#fff1c4', 1); } onSound?.('cos_flourish_orange', id); }
      // ambient embers + moving trail
      o.acc += dt * 14 * B; while (o.acc >= 1) { o.acc--; spawn(id, x + (Math.random() - .5) * 18 * u, y - Math.random() * 40 * u, (Math.random() - .5) * 6 * u, -10 * u - Math.random() * 14 * u, .8 + Math.random() * .6, (.8 + Math.random() * .8) * u, Math.random() < .7 ? ORANGE : '#ffd27a'); }
      if (k.moving) { o.tacc += dt * 40 * B; while (o.tacc >= 1) { o.tacc--; spawn(id + ':trail', x + (Math.random() - .5) * 10 * u, y - Math.random() * 30 * u, (Math.random() - .5) * 4 * u, -4 * u, .6 + Math.random() * .3, 1.5 * u, Math.random() < .5 ? ORANGE : '#fff1c4', 2); } }
    } else {
      // purple: soft floor glow + slow ring, light sparkle accent
      blob(c, x, y, 18 * u, PURPLE, .32 * (.85 + .15 * Math.sin(t * 2)));
      c.globalAlpha = .5; c.strokeStyle = PURPLE; c.lineWidth = Math.max(1, .8 * u); c.beginPath(); c.ellipse(x, y, 12 * u, 4.3 * u, 0, 0, 7); c.stroke();
      o.acc += dt * 2.5 * B; while (o.acc >= 1) { o.acc--; spawn(id, x + (Math.random() - .5) * 16 * u, y - (10 + Math.random() * 32) * u, 0, -5 * u, 1.1, .9 * u, '#e2c8ff', 0); }
      for (const d of list) if (d.rarity === 'purple') accessory(k, d, 'back', t);
    }
    // update + draw this owner's particles
    let live = 0;
    for (const p of pool) { if (!p.on || (p.o !== id && p.o !== id + ':trail')) continue; p.age += dt; if (p.age >= p.life) { p.on = false; continue; } live++;
      if (p.kind !== 2) { p.x += dx; p.y += dy; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 1 ? 30 : -4) * u * dt;
      const a = 1 - p.age / p.life; blob(c, p.x, p.y, p.r * (p.kind === 2 ? 2.2 : 1.8) * (.6 + .4 * a), p.col, a * (p.kind === 1 ? 1 : .8)); }
    stats.live = live; stats.frames++;
  } else {
    c.globalCompositeOperation = 'lighter';
    if (tier === 'orange') { for (const d of list) if (d.rarity === 'orange') signature(k, d, 'front', t, id, B);
      // scanline / pulse sweep over the body (shared)
      if (!red && Q.p.fx < 2) { const ph = (t * .7) % 1.6; if (ph < 1) { const sy = y - (4 + ph * 44) * u; const g = c.createLinearGradient(0, sy - 3 * u, 0, sy + 3 * u); g.addColorStop(0, 'rgba(255,200,120,0)'); g.addColorStop(.5, 'rgba(255,214,150,.55)'); g.addColorStop(1, 'rgba(255,200,120,0)'); c.globalAlpha = 1; c.fillStyle = g; c.fillRect(x - 11 * u, sy - 3 * u, 22 * u, 6 * u); } }
      blob(c, x, y - 41 * u, 9 * u, ORANGE, .25 + .15 * Math.sin(t * 4)); // head halo glint
    } else { for (const d of list) if (d.rarity === 'purple') accessory(k, d, 'front', t);
      // sheen: a slow soft diagonal band
      if (!red) { const ph = (t * .35) % 2; if (ph < 1) { const sx = x + (ph * 24 - 12) * u; c.globalAlpha = .28; const g = c.createLinearGradient(sx - 4 * u, 0, sx + 4 * u, 0); g.addColorStop(0, 'rgba(220,190,255,0)'); g.addColorStop(.5, 'rgba(230,205,255,.8)'); g.addColorStop(1, 'rgba(220,190,255,0)'); c.fillStyle = g; c.fillRect(sx - 4 * u, y - 46 * u, 8 * u, 46 * u); } }
    }
  }
  c.restore();
}

// ------------------------------------------------------------------ orange signatures
function signature(k: FxCtx, d: CosDef, phase: 'back' | 'front', t: number, id: string, B: number) {
  const { c, x, y, u } = k; const s = SIGNATURE[d.id]?.fx; const cc = d.c || ORANGE, c2 = d.c2 || '#fff1c4';
  switch (s) {
    case 'flame': if (phase === 'front') { for (let i = 0; i < 7; i++) { const fx = x + (i - 3) * 1.6 * u, h = (6 + 4 * Math.sin(t * 9 + i * 1.7)) * u; blob(c, fx, y - 46 * u - h * .5, 3.6 * u, i % 2 ? cc : c2, .85); blob(c, fx, y - 46 * u - h, 2.2 * u, '#fff1c4', .75); } } else if (Math.random() < .25 * B) spawn(id, x + (Math.random() - .5) * 8 * u, y - 48 * u, 0, -22 * u, .5, 1.2 * u, cc); break;
    case 'gaze': if (phase === 'front') { const sw = Math.sin(t * 1.3) * .5; for (const ex of [-2, 2]) { const ox = x + ex * u, oy = y - 41.5 * u; blob(c, ox, oy, 3.4 * u, c2, .9); c.globalAlpha = .35 + .2 * Math.sin(t * 5); c.strokeStyle = cc; c.lineWidth = Math.max(1, .9 * u); c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(k.face + sw) * 26 * u, oy + Math.sin(k.face + sw) * 10 * u); c.stroke(); } } break;
    case 'veins': if (phase === 'front') { c.globalAlpha = .55 + .35 * Math.sin(t * 4); c.strokeStyle = cc; c.lineWidth = Math.max(1, .8 * u); c.lineCap = 'round'; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.sin(t * .7) * .3; let px = x, py = y - 29 * u; c.beginPath(); c.moveTo(px, py); for (let j = 1; j <= 4; j++) { px += Math.cos(a + Math.sin(t * 2 + i + j) * .6) * 2.2 * u; py += Math.sin(a + Math.sin(t * 2 + i + j) * .6) * 2.6 * u; c.lineTo(px, py); } c.stroke(); } blob(c, x, y - 29 * u, 6 * u, c2, .8 + .2 * Math.sin(t * 6)); } break;
    case 'wings': if (phase === 'back') { const fl = Math.sin(t * 3) * .25; for (const sd of [-1, 1]) { for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + sd * (0.5 + i * .22 + fl); const r = (10 + i * 2.6) * u; blob(c, x + sd * 3 * u + Math.cos(a) * r * sd * sd, y - 32 * u + Math.sin(a) * r * .6 - i * .5 * u, (2.8 - i * .25) * u, i % 2 ? cc : c2, .55); } } if (Math.random() < .3 * B) spawn(id, x + (Math.random() - .5) * 30 * u, y - 34 * u, 0, 12 * u, .9, 1 * u, cc, 1); } break;
    case 'holo': if (phase === 'front') { const n = Q.p.fx === 2 ? 3 : 6; for (let i = 0; i < n; i++) { const sy = y - ((t * 30 + i * 8.3) % 46) * u; const off = !reduced() && Math.sin(t * 23 + i * 5) > .6 ? Math.sin(t * 97 + i * 13) * 3 * u : 0; c.globalAlpha = .4; c.fillStyle = `hsl(${(t * 120 + i * 50) % 360},95%,65%)`; c.fillRect(x - 9 * u + off, sy, 18 * u, Math.max(1, .6 * u)); } c.globalAlpha = .25; c.fillStyle = '#00e5ff'; c.fillRect(x - 10 * u - 1.2 * u, y - 46 * u, 1 * u, 46 * u); c.fillStyle = '#ff2bd6'; c.fillRect(x + 10 * u + .2 * u, y - 46 * u, 1 * u, 46 * u); } break;
    case 'chrome': if (phase === 'front') { for (let i = 0; i < 5; i++) { const ph = (t * .8 + i / 5) % 1; const dx = (i - 2) * 2.4 * u; blob(c, x + dx, y - (50 - ph * 10) * u, (1.6 - ph) * 1.4 * u, '#e8f4ff', .8 * (1 - ph)); } c.globalAlpha = .7 + .3 * Math.sin(t * 5); c.strokeStyle = c2; c.lineWidth = Math.max(1.2, 1 * u); c.beginPath(); c.moveTo(x, y - 49 * u); for (let j = 1; j <= 6; j++) c.lineTo(x + Math.sin(t * 3 + j) * .9 * u, y - (49 - j * 1.6) * u); c.stroke(); blob(c, x, y - 44 * u, 5 * u, c2, .5 + .2 * Math.sin(t * 5)); } break;
    case 'swarm': if (phase === 'back' || phase === 'front') { const n = Math.round((phase === 'front' ? 14 : 10) * (B || .5)); for (let i = 0; i < n; i++) { const a = t * (1.4 + (i % 3) * .3) + i * 2.399; const r = (12 + (i % 4) * 2) * u; const yy = y - (14 + 10 * Math.sin(a * .7 + i)) * u; const z = Math.sin(a); if ((z > 0) !== (phase === 'front')) continue; blob(c, x + Math.cos(a) * r, yy + z * 3 * u, 1.3 * u, i % 3 ? cc : '#e8f4ff', .9); } } break;
  }
}
// ------------------------------------------------------------------ purple accessories (one silhouette per slot)
function accessory(k: FxCtx, d: CosDef, phase: 'back' | 'front', t: number) {
  const { c, x, y, u } = k; const a = ACCESSORY[d.slot]; const col = d.c || PURPLE; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(1, .8 * u); c.globalAlpha = .75;
  const tri = (pts: number[][]) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); };
  if (phase === 'back') { if (a === 'shards') for (const s of [-1, 1]) { const by = y - (34 + Math.sin(t * 2 + s) * 1.5) * u; tri([[x + s * 9 * u, by - 7 * u], [x + s * 12 * u, by], [x + s * 9 * u, by + 5 * u], [x + s * 7 * u, by]]); }
    else if (a === 'mote') { const an = t * 1.2; blob(c, x + Math.cos(an) * 14 * u, y - 20 * u + Math.sin(an) * 4 * u, 2.4 * u, col, .9); } return; }
  switch (a) {
    case 'crest': for (const s of [-1, 1]) tri([[x + s * 2 * u, y - 46 * u], [x + s * 5 * u, y - 53 * u], [x + s * 4.5 * u, y - 45 * u]]); break;
    case 'tickring': c.beginPath(); c.ellipse(x, y - 52 * u, 6 * u, 1.8 * u, 0, 0, 7); c.stroke(); for (let i = 0; i < 4; i++) { const an = t + i * Math.PI / 2; blob(c, x + Math.cos(an) * 6 * u, y - 52 * u + Math.sin(an) * 1.8 * u, 1 * u, '#ffffff', .8); } break;
    case 'visor': c.globalAlpha = .55 + .3 * Math.sin(t * 2); c.fillRect(x - 5 * u, y - 42.4 * u, 10 * u, 1.3 * u); break;
    case 'fins': for (const s of [-1, 1]) tri([[x + s * 7 * u, y - 35 * u], [x + s * 12.5 * u, y - 38.5 * u], [x + s * 10 * u, y - 32 * u]]); break;
    case 'bracers': for (const s of [-1, 1]) { c.beginPath(); c.ellipse(x + s * 9.5 * u, y - 22 * u, 2.6 * u, 1 * u, 0, 0, 7); c.stroke(); } break;
    case 'orbs': for (const s of [-1, 1]) blob(c, x + s * 10 * u, y - 16 * u, 2.2 * u, col, .8 + .2 * Math.sin(t * 3 + s)); break;
    case 'anklefins': for (const s of [-1, 1]) tri([[x + s * 4 * u, y - 4 * u], [x + s * 8 * u, y - 7 * u], [x + s * 6 * u, y - 2 * u]]); break;
    case 'outline': c.globalAlpha = .35 + .15 * Math.sin(t * 2); c.beginPath(); c.ellipse(x, y - 24 * u, 11 * u, 24 * u, 0, 0, 7); c.stroke(); break;
    case 'glyph': c.globalAlpha = .6 + .3 * Math.sin(t * 2.4); c.beginPath(); c.arc(x + 12 * u, y - 40 * u, 2 * u, 0, 7); c.moveTo(x + 10 * u, y - 40 * u); c.lineTo(x + 14 * u, y - 40 * u); c.stroke(); break;
  }
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
setFxSound((n, owner) => { if (owner !== 'me' && owner !== 'dr') return; fxSoundLog.push(n); if (fxSoundLog.length > 50) fxSoundLog.shift(); playCosSfx(n, n.includes('flourish') ? .3 : .55); });
/** equip sound for the top tier of a set of applied pieces */
export function equipSound(list: CosDef[]) { const tr = topTier(list); if (!tr) return; const n = 'cos_equip_' + tr; fxSoundLog.push(n); playCosSfx(n); }
if (typeof window !== 'undefined') (window as any).__cosfx = { stats, liveParticles, resetFx, setReducedFx, budget, SIGNATURE, ACCESSORY, fxSoundLog, flourish, POOL_MAX };
