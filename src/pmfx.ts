// Premium line skins: painterly, stylized accents drawn with the cosmetics (local player, remote players, dressing room).
// Restraint rules (docs/MONETIZATION.md art direction): no floor rings or particle spam. Glow lives ON the character (inlays,
// crystals, edges) and motion happens on moments: an occasional idle flourish, ability casts, recalls and emotes.
// Also: weapon skins, pet drones, recall + emote animations, the subtle exclusive signature and nameplate flair.
import type { CosDef } from './content/appearance';
import { LINE_BY_ID } from './content/skinlines';
import { isExclusive } from './retire';
import { glowSprite, reduced, playCosSfx } from './cosfx';
const aud = (o: string, sl: string, id: string, f: () => void) => { const A = (globalThis as any).__cosAudit; if (!A) { f(); return; } const n0 = (globalThis as any).__ops || 0; try { f(); } finally { const k = o + '|' + sl + '|' + id; A[k] = (A[k] || 0) + ((globalThis as any).__ops || 0) - n0; } };
type C = CanvasRenderingContext2D;
export interface PmCtx { c: C; x: number; y: number; u: number; t: number; moving: boolean; face: number; id?: string; cast?: boolean }
const rgba = (hex: string, a: number) => { const n = parseInt(hex.replace('#', ''), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const soft = (c: C, x: number, y: number, r: number, col: string, a: number) => { if (a <= 0) return; c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, a); c.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); c.restore(); };
const ease = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);

// ---------------------------------------------------------------- per-owner moments (recall, emote, cast flourish)
interface Own { recall?: { style: string; t0: number; c: string; c2: string }; emote?: { style: string; t0: number; c: string }; flo: number; lastCast: boolean; lastT: number }
const OWN: Map<string, Own> = ((globalThis as any).__wvPm ??= new Map());
const own = (id = 'me') => { let o = OWN.get(id); if (!o) { o = { flo: -99, lastCast: false, lastT: 0 }; OWN.set(id, o); } return o; };
/** clear every owner's recall/emote moment (used by tests/cosmetics_render.mjs between cosmetics) */
export const resetPm = () => OWN.clear();
export const RECALL_S = 1.6, EMOTE_S = 2.2, FLO_S = .7;
/** Start a recall animation for owner (town arrival / teleport). Uses the recall slot, else the Legendary skin's bundled recall. */
export function playRecall(list: CosDef[], id = 'me', sound = true): string | null {
  const r = list.find(d => d.slot === 'recall'); const sk = list.find(d => d.slot === 'skin' && d.line); const style = r?.style || (sk && (sk.tier === 'legendary' || sk.tier === 'ultimate') ? sk.line! : null); if (!style) return null;
  const L = LINE_BY_ID[style]; own(id).recall = { style, t0: NaN, c: r?.c || L?.pal[2] || '#9fd8ff', c2: r?.c2 || L?.pal[1] || '#fff' };
  if (sound && id === 'me') playCosSfx('pm_' + (['arcforge', 'bloom', 'ronin', 'founder'].includes(style) ? style : 'arcforge') + '_recall', .5); return style;
}
export function playEmote(list: CosDef[], id = 'me', sound = true): string | null {
  const e = list.find(d => d.slot === 'emote'); if (!e) return null; own(id).emote = { style: e.style, t0: NaN, c: e.c }; if (sound && id === 'me') playCosSfx('pm_emote', .45); return e.style;
}

// ---------------------------------------------------------------- epic accents: one unique silhouette piece per skin
type Fn = (k: PmCtx, d: CosDef, pal: string[]) => void;
const ACC: Record<string, Fn> = {
  pm_arcforge_warden: ({ c, x, y, u }, d, p) => { for (const s of [-1, 1]) { c.fillStyle = p[1]; c.beginPath(); c.moveTo(x + s * 7 * u, y - 37 * u); c.lineTo(x + s * 14 * u, y - 39 * u); c.lineTo(x + s * 12 * u, y - 32 * u); c.closePath(); c.fill(); } soft(c, x, y - 30 * u, 5 * u, p[2], .55); },
  pm_arcforge_lancer: ({ c, x, y, u }, d, p) => { c.strokeStyle = p[1]; c.lineWidth = Math.max(1, 1.1 * u); c.beginPath(); c.moveTo(x + 9 * u, y - 4 * u); c.lineTo(x + 13 * u, y - 60 * u); c.stroke(); c.fillStyle = p[2]; c.beginPath(); c.moveTo(x + 13 * u, y - 66 * u); c.lineTo(x + 15 * u, y - 59 * u); c.lineTo(x + 11.2 * u, y - 59 * u); c.closePath(); c.fill(); soft(c, x + 13 * u, y - 61 * u, 5 * u, p[2], .5); },
  pm_arcforge_standard: ({ c, x, y, u }, d, p) => { c.strokeStyle = rgba(p[1], .9); c.lineWidth = Math.max(1, 1.6 * u); c.beginPath(); c.moveTo(x - 7 * u, y - 36 * u); c.lineTo(x + 7 * u, y - 22 * u); c.stroke(); },
  pm_bloom_courier: ({ c, x, y, u }, d, p) => { for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { c.fillStyle = rgba(i % 2 ? p[1] : p[0], .9); c.beginPath(); c.ellipse(x + s * (9 + i * 2) * u, y - (20 + i * 2) * u, 1.6 * u, 4.6 * u, s * (.5 + i * .3), 0, 7); c.fill(); } soft(c, x, y - 22 * u, 6 * u, p[2], .35); },
  pm_bloom_medic: ({ c, x, y, u }, d, p) => { c.fillStyle = rgba(p[1], .92); c.beginPath(); c.ellipse(x, y - 44 * u, 7.2 * u, 6.4 * u, 0, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(x + 6 * u, y - 36 * u); c.lineTo(x - 6 * u, y - 36 * u); c.closePath(); c.fill(); soft(c, x, y - 47 * u, 4 * u, p[2], .5); },
  pm_ronin_initiate: ({ c, x, y, u, t }, d, p) => { c.strokeStyle = p[1]; c.lineWidth = Math.max(1, 1.2 * u); c.beginPath(); c.moveTo(x - 7 * u, y - 20 * u); c.quadraticCurveTo(x - 10 * u, y - 12 * u + Math.sin(t * 2) * u, x - 9 * u, y - 6 * u); c.stroke(); c.fillStyle = p[1]; c.fillRect(x - 10 * u, y - 7 * u, 2 * u, 3 * u); },
  pm_street_ronin: ({ c, x, y, u, t, moving }, d, p) => { const sw = Math.sin(t * 3) * (moving ? 3 : 1) * u; c.fillStyle = rgba('#2fb7b0', .95); c.beginPath(); c.moveTo(x - 4 * u, y - 37 * u); c.lineTo(x + 4 * u, y - 37 * u); c.lineTo(x + 13 * u + sw, y - 31 * u); c.lineTo(x + 11 * u + sw, y - 28 * u); c.closePath(); c.fill(); },
  pm_undercity_pipefitter: ({ c, x, y, u, t }, d, p) => { c.fillStyle = '#5a4a2a'; c.fillRect(x + 6 * u, y - 44 * u, 3 * u, 8 * u); soft(c, x + 7.5 * u, y - 46 * u, 7 * u, p[2], .45 + .1 * Math.sin(t * 1.4)); c.fillStyle = rgba(p[2], .9); c.beginPath(); c.arc(x + 7.5 * u, y - 46 * u, 1.6 * u, 0, 7); c.fill(); },
  pm_undercity_alchemist: ({ c, x, y, u, t }, d, p) => { c.fillStyle = rgba(p[2], .55); c.beginPath(); c.arc(x - 8 * u, y - 16 * u, 2.4 * u, 0, 7); c.fill(); c.fillStyle = p[1]; c.fillRect(x - 8.6 * u, y - 20.5 * u, 1.2 * u, 2.4 * u); soft(c, x - 8 * u, y - 16 * u, 5 * u, p[2], .4); c.fillStyle = rgba(p[1], .95); for (const s of [-2, 2]) { c.beginPath(); c.arc(x + s * u, y - 42 * u, 1.5 * u, 0, 7); c.fill(); } void t; },
  pm_void_auditor: ({ c, x, y, u, t }, d, p) => { const g = Math.floor(t * 6) % 7 === 0 ? 2 * u : 0; c.strokeStyle = rgba(p[2], .85); c.lineWidth = Math.max(1, .9 * u); c.beginPath(); c.moveTo(x + g, y - 40 * u); c.lineTo(x - 1 * u + g, y - 30 * u); c.lineTo(x + 1.5 * u - g, y - 24 * u); c.lineTo(x - g, y - 16 * u); c.stroke(); },
  pm_void_breach: ({ c, x, y, u, t }, d, p) => { for (let i = 0; i < 4; i++) { const a = i * 1.7 + t * .3; c.fillStyle = rgba(i % 2 ? p[2] : p[1], .85); c.beginPath(); const cx = x + Math.cos(a) * 11 * u, cy = y - 30 * u + Math.sin(a * 1.3) * 6 * u; c.moveTo(cx, cy - 2.4 * u); c.lineTo(cx + 1.4 * u, cy); c.lineTo(cx, cy + 2.4 * u); c.lineTo(cx - 1.4 * u, cy); c.closePath(); c.fill(); } },
};
/** Legendary/Ultimate: integrated emissive points (the body frames already carry the glow; this adds a soft bloom only) */
const EMIT: Record<string, number[][]> = { arcforge: [[0, -30], [-9, -37], [9, -37], [0, -56]], bloom: [[0, -28], [-6, -34], [6, -34]], ronin: [[0, -50], [-8, -24]], founder: [[0, -31]] };
const lineOf = (list: CosDef[]) => list.find(d => d.slot === 'skin' && d.line);

// ---------------------------------------------------------------- weapon skins + pets
const WEAPON: Record<string, Fn> = {
  hexblade: ({ c, x, y, u, face }, d) => { const s = Math.cos(face) >= 0 ? 1 : -1; c.strokeStyle = d.c2 || '#d7a63e'; c.lineWidth = Math.max(1.4, 1.6 * u); c.beginPath(); c.moveTo(x + s * 11 * u, y - 20 * u); c.lineTo(x + s * 19 * u, y - 36 * u); c.stroke(); c.strokeStyle = d.c; c.lineWidth = Math.max(1, .8 * u); c.beginPath(); c.moveTo(x + s * 12 * u, y - 23 * u); c.lineTo(x + s * 18.4 * u, y - 35 * u); c.stroke(); soft(c, x + s * 15 * u, y - 28 * u, 4 * u, d.c, .4); },
  katana: ({ c, x, y, u, face }, d) => { const s = Math.cos(face) >= 0 ? 1 : -1; c.strokeStyle = '#141418'; c.lineWidth = Math.max(1.4, 1.5 * u); c.beginPath(); c.moveTo(x + s * 10 * u, y - 18 * u); c.quadraticCurveTo(x + s * 18 * u, y - 28 * u, x + s * 21 * u, y - 40 * u); c.stroke(); c.strokeStyle = rgba(d.c, .95); c.lineWidth = Math.max(1, .6 * u); c.stroke(); c.fillStyle = d.c2 || '#a5302c'; c.fillRect(x + s * 9.4 * u, y - 19 * u, 2.4 * u, 2 * u); },
  thorn: ({ c, x, y, u, face }, d) => { const s = Math.cos(face) >= 0 ? 1 : -1; c.fillStyle = rgba(d.c2 || '#fff', .95); c.beginPath(); c.moveTo(x + s * 10 * u, y - 19 * u); c.lineTo(x + s * 20 * u, y - 38 * u); c.lineTo(x + s * 13 * u, y - 21 * u); c.closePath(); c.fill(); soft(c, x + s * 16 * u, y - 30 * u, 4 * u, d.c, .45); },
};
const PET: Record<string, Fn> = {
  scout: ({ c, x, y, u }, d) => { c.fillStyle = '#3a3f46'; c.beginPath(); c.ellipse(x, y, 3 * u, 1.8 * u, 0, 0, 7); c.fill(); c.fillStyle = rgba(d.c, .95); c.beginPath(); c.arc(x + 1.2 * u, y - .2 * u, .8 * u, 0, 7); c.fill(); c.strokeStyle = 'rgba(200,210,220,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 4 * u, y - 2 * u); c.lineTo(x + 4 * u, y - 2 * u); c.stroke(); },
  hex: ({ c, x, y, u, t }, d) => { c.fillStyle = d.c2 || '#d7a63e'; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + t * .4; c.lineTo(x + Math.cos(a) * 3.2 * u, y + Math.sin(a) * 3.2 * u); } c.closePath(); c.fill(); c.fillStyle = rgba(d.c, .95); c.beginPath(); c.arc(x, y, 1.3 * u, 0, 7); c.fill(); soft(c, x, y, 5 * u, d.c, .45); },
  moth: ({ c, x, y, u, t, moving }, d) => { const f = Math.sin(t * 9) * .6 + .9; c.fillStyle = rgba(d.c2 || '#fff', .9); for (const s of [-1, 1]) { c.beginPath(); c.ellipse(x + s * 2.2 * u * f, y, 2.4 * u * f, 1.6 * u, s * .4, 0, 7); c.fill(); } if (!moving) soft(c, x, y, 5 * u, d.c, .5); },
};

// ---------------------------------------------------------------- main entry (called from drawCosmetics)
export function drawPm(k: PmCtx, list: CosDef[], phase: 'back' | 'front') {
  const { c, x, y, u, t } = k; const id = k.id || 'me'; const o = own(id); const red = reduced();
  const sk = lineOf(list);
  if (k.cast && !o.lastCast) { o.flo = t; if (id === 'me' && sk?.body && (sk.tier === 'legendary' || sk.tier === 'ultimate')) playCosSfx('pm_' + sk.body.split('@')[0] + '_flourish', .4); } o.lastCast = !!k.cast; o.lastT = t; const pal = sk ? LINE_BY_ID[sk.line!].pal : null;
  const pet = list.find(d => d.slot === 'pet');
  if (pet && PET[pet.style]) { const a = t * .9; const px = x + Math.cos(a) * 15 * u, py = y - (34 + Math.sin(t * 2.1) * 2) * u + Math.sin(a) * 5 * u; const behind = Math.sin(a) < 0; if ((phase === 'back') === behind) { c.save(); c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(px, y + Math.sin(a) * 5 * u, 3 * u, 1.2 * u, 0, 0, 7); c.fill(); aud(id, 'pet', pet.id, () => PET[pet.style]({ ...k, x: px, y: py }, pet, [])); c.restore(); } }
  if (phase === 'back') {
    // exclusive signature: a thin brass filigree arc behind the feet + one slow glint. Subtle on purpose.
    if (list.some(d => isExclusive(d.id))) { c.save(); c.strokeStyle = 'rgba(232,196,106,.55)'; c.lineWidth = Math.max(1, .7 * u); c.beginPath(); c.ellipse(x, y, 11 * u, 4 * u, 0, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); if (!red) { const g = (t * .25) % 1; soft(c, x + Math.cos(Math.PI * (1.08 + .84 * g)) * 11 * u, y + Math.sin(Math.PI * (1.08 + .84 * g)) * 4 * u, 3 * u, '#ffe6a6', .5 * Math.sin(g * Math.PI)); } c.restore(); }
    return;
  }
  if (sk && pal) {
    const acc = ACC[sk.id.split('__')[0]]; if (acc) { c.save(); aud(id, 'line', sk.id, () => acc(k, sk, pal)); c.restore(); }
    const pts = EMIT[(sk.body || '').split('@')[0]]; if (pts) for (const [px, py] of pts) soft(c, x + px * u, y + py * u, 4.5 * u, pal[2], red ? .35 : .3 + .12 * Math.sin(t * 1.6 + px));
    // ability flourish: one painted arc (Legendary/Ultimate) when an ability fires
    const fa = (t - o.flo) / FLO_S; if (!red && fa >= 0 && fa < 1 && (sk.tier === 'legendary' || sk.tier === 'ultimate')) { c.save(); c.globalCompositeOperation = 'lighter'; const r = (10 + 10 * ease(fa)) * u; const g = c.createLinearGradient(x - r, y - 30 * u, x + r, y - 30 * u); g.addColorStop(0, rgba(pal[2], 0)); g.addColorStop(.5, rgba(pal[2], .55 * (1 - fa))); g.addColorStop(1, rgba(pal[1], 0)); c.strokeStyle = g; c.lineWidth = (3 - 2 * fa) * u; c.beginPath(); c.ellipse(x, y - 26 * u, r, r * .45, -.2, Math.PI * .9, Math.PI * 2.2); c.stroke(); c.restore(); }
  }
  const w = list.find(d => d.slot === 'weapon'); if (w && WEAPON[w.style]) { c.save(); aud(id, 'weapon', w.id, () => WEAPON[w.style](k, w, [])); c.restore(); }
  const em = o.emote ? list.find(d => d.slot === 'emote') : undefined, rc = o.recall ? list.find(d => d.slot === 'recall') : undefined;
  aud(id, 'moment', (em?.id || '') + (rc ? '+' + rc.id : ''), () => drawMoments(k, o));
}
function drawMoments(k: PmCtx, o: Own) {
  const { c, x, y, u, t } = k;
  if (o.recall && isNaN(o.recall.t0)) o.recall.t0 = t; if (o.emote && isNaN(o.emote.t0)) o.emote.t0 = t;
  if (o.recall) { const f = (t - o.recall.t0) / RECALL_S; if (f >= 1 || f < 0) o.recall = undefined; else { const { style, c: c1, c2 } = o.recall; c.save(); c.globalCompositeOperation = 'lighter';
    if (style === 'arcforge') { for (let i = 0; i < 6; i++) { const yy = y - (6 + i * 9) * u - ease(f) * 8 * u, a = (1 - f) * (1 - i / 7); c.strokeStyle = rgba(i % 2 ? c2 : c1, .7 * a); c.lineWidth = Math.max(1, u); c.beginPath(); for (let j = 0; j < 7; j++) { const ang = j * Math.PI / 3 + i * .3; c.lineTo(x + Math.cos(ang) * (9 - i) * u, yy + Math.sin(ang) * (3.4 - i * .3) * u); } c.stroke(); } }
    else if (style === 'bloom') { for (let i = 0; i < 6; i++) { const ang = i * Math.PI / 3, r = (16 - 12 * ease(f)) * u; c.fillStyle = rgba(i % 2 ? c1 : c2, .55 * (1 - f * .6)); c.beginPath(); c.ellipse(x + Math.cos(ang) * r, y - 24 * u + Math.sin(ang) * r * .6, 2.4 * u, 7 * u, ang, 0, 7); c.fill(); } }
    else if (style === 'ronin') { const s = ease(f * 1.6); c.strokeStyle = rgba(c1, .9 * (1 - f)); c.lineWidth = Math.max(1, 1.6 * u * (1 - f)); c.beginPath(); c.moveTo(x - 22 * u * s, y - 28 * u); c.lineTo(x + 22 * u * s, y - 30 * u); c.stroke(); }
    else if (style === 'founder') { const g = c.createRadialGradient(x, y, 0, x, y, 18 * u); g.addColorStop(0, rgba(c1, .5 * (1 - f))); g.addColorStop(1, rgba(c1, 0)); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 18 * u, 7 * u, 0, 0, 7); c.fill(); c.strokeStyle = rgba(c2, .7 * (1 - f)); c.lineWidth = Math.max(1, u); c.beginPath(); c.ellipse(x, y - 50 * u, 4 * u + f * 8 * u, 2 * u + f * 3 * u, 0, 0, 7); c.stroke(); }
    else { for (let i = 0; i < 5; i++) { c.fillStyle = rgba(c1, .5 * (1 - f)); c.fillRect(x - 10 * u + ((i * 37 + Math.floor(t * 20)) % 20) * u, y - (8 + i * 9) * u, (4 + i % 3 * 3) * u, 1.2 * u); } }
    soft(c, x, y - 26 * u, 18 * u * (1 - f * .5), c1, .25 * Math.sin(f * Math.PI)); c.restore(); } }
  if (o.emote) { const f = (t - o.emote.t0) / EMOTE_S; if (f >= 1 || f < 0) o.emote = undefined; else { const col = o.emote.c, a = Math.sin(f * Math.PI); c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(col, .8 * a); c.lineWidth = Math.max(1, u);
    if (o.emote.style === 'hexsign') { const n = Math.floor(ease(f * 1.4) * 7); c.beginPath(); for (let j = 0; j < n; j++) { const ang = j * Math.PI / 3; c.lineTo(x + 14 * u + Math.cos(ang) * 5 * u, y - 40 * u + Math.sin(ang) * 5 * u); } c.stroke(); }
    else if (o.emote.style === 'bow') { c.beginPath(); c.moveTo(x - 10 * u, y - 46 * u + f * 4 * u); c.lineTo(x + 10 * u, y - 46 * u + f * 4 * u); c.stroke(); }
    else { const sw = Math.sin(t * 10) * 3 * u; c.beginPath(); c.arc(x + 12 * u + sw, y - 44 * u, 2.4 * u, 0, 7); c.stroke(); c.beginPath(); c.moveTo(x + 8 * u, y - 36 * u); c.lineTo(x + 12 * u + sw, y - 42 * u); c.stroke(); }
    c.restore(); } }
}
/** Brief nameplate flair when an exclusive owner arrives in a hub (3 s ease-out). Returns 0..1. */
export const FLAIR_S = 3;
export const flairAlpha = (since: number, nowS: number) => { const f = (nowS - since) / FLAIR_S; return f < 0 || f > 1 ? 0 : 1 - f; };
