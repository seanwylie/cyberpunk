// Town variety layer (docs/VARIETY.md): everything here is baked once (ground canvas) or cached (walker frames); no per-frame cost is added.
//  - groundDetail(): painted signage, lane numbers, crosswalks, graffiti tags, litter, scorch + heat cracks, per town so Rustline (market, paper + bunting shadows)
//    and Harrow Reach (slag terraces, safety paint, ember cracks) stop sharing the same floor dressing.
//  - TOWN_GRADE: per-town colour grade (replaces the one shared dusk tint).
//  - outfitPaint(): NPC outfit variants (hi-vis vest, scarf, cap, work trousers, apron, two-tone) painted onto the tinted walker frame before it is alpha-masked.
import { GEN_TOWNS } from './world';
type X = CanvasRenderingContext2D;
export const TOWN_GRADE: Record<string, { tint: string; vig: string }> = {
  rustline: { tint: 'rgba(14,12,22,.2)', vig: 'rgba(6,7,10,.72)' },
  harrow: { tint: 'rgba(48,22,10,.15)', vig: 'rgba(14,6,3,.74)' },
};
for (const t of GEN_TOWNS) TOWN_GRADE[t.id] = t.gen!.grade;
export const gradeOf = (th: string) => TOWN_GRADE[th] || TOWN_GRADE.rustline;
export const OUTFITS = 8;
const ACC = ['#e0782a', '#c9a02a', '#4a8a9a', '#a04a4a', '#6a8a4a', '#8a5aa0'];
/** paints outfit `o` (0 = plain) over the walker frame in-place; the caller then clips to the sprite alpha. Frame is a 160-cell, figure ~ x 55..95, y 45..154. */
export function outfitPaint(x: X, W: number, H: number, o: number, id: number) {
  if (!o) return; const k = W / 160, acc = ACC[id % ACC.length]; x.save(); x.globalCompositeOperation = 'source-over';
  const band = (y0: number, y1: number, col: string, a: number) => { x.globalAlpha = a; x.fillStyle = col; x.fillRect(48 * k, y0 * H / 160, 56 * k, (y1 - y0) * H / 160); };
  switch (o) {
    case 1: band(74, 100, '#f0762a', .62); band(86, 89, '#e8e2c8', .7); break;              // hi-vis vest + reflective strip
    case 2: band(70, 76, acc, .75); break;                                                  // scarf
    case 3: band(46, 58, acc, .66); break;                                                  // cap / head wrap
    case 4: band(102, 152, '#2c2a2a', .5); break;                                           // dark work trousers
    case 5: band(80, 118, '#8a7a5a', .5); break;                                            // leather apron
    case 6: band(100, 152, acc, .38); band(72, 99, '#20262c', .3); break;                   // two-tone
    case 7: band(46, 72, '#1e2024', .42); band(72, 80, acc, .5); break;                     // hood + collar
  }
  x.restore();
}
const rr = (s: number) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
/** extra baked ground dressing. GP = px per tile. `solid(tx,ty)` marks blocked tiles; we only paint on walkable ones. */
export function groundDetail(x: X, th: string, W: number, H: number, GP: number, hub: [number, number], solid: (tx: number, ty: number) => boolean) {
  const R = rr(th === 'harrow' ? 77 : 41), tw = Math.floor(W / GP), th2 = Math.floor(H / GP); const pick = (): [number, number] | null => { for (let i = 0; i < 12; i++) { const tx = 2 + Math.floor(R() * (tw - 4)), ty = 2 + Math.floor(R() * (th2 - 4)); if (!solid(tx, ty) && !solid(tx + 1, ty) && !solid(tx, ty + 1)) return [(tx + R()) * GP, (ty + R()) * GP]; } return null; };
  x.save(); x.lineCap = 'round';
  const stencil = (t: string, px: number, py: number, size: number, col: string, rot = 0) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(1, .62); x.font = `bold ${size}px "Arial Narrow",Impact,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(t, 0, 0); x.restore(); };
  const arrow = (px: number, py: number, s: number, col: string, rot: number) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(1, .62); x.fillStyle = col; x.beginPath(); x.moveTo(-s, -s * .22); x.lineTo(s * .2, -s * .22); x.lineTo(s * .2, -s * .5); x.lineTo(s, 0); x.lineTo(s * .2, s * .5); x.lineTo(s * .2, s * .22); x.lineTo(-s, s * .22); x.closePath(); x.fill(); x.restore(); };
  const blob = (px: number, py: number, r: number, col: string, sq = .55, rot = 0) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(1, sq); const g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, col); g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill(); x.restore(); };
  if (th === 'harrow') {
    for (let i = 0; i < 16; i++) { const p = pick(); if (!p) continue; arrow(p[0], p[1], GP * .5, 'rgba(226,190,60,.3)', Math.floor(R() * 4) * Math.PI / 2 + .3); }       // safety arrows
    for (let i = 0; i < 9; i++) { const p = pick(); if (!p) continue; stencil('L7-' + (10 + Math.floor(R() * 80)), p[0], p[1], GP * .6, 'rgba(226,214,180,.26)', (R() - .5) * .2); }  // line-7 bay numbers
    for (let i = 0; i < 12; i++) { const p = pick(); if (!p) continue; x.strokeStyle = 'rgba(255,120,36,.4)'; x.lineWidth = 1.6; x.beginPath(); let cx = p[0], cy = p[1], a = R() * 6.28; x.moveTo(cx, cy); for (let j = 0; j < 7; j++) { a += (R() - .5) * 1.1; cx += Math.cos(a) * GP * .22; cy += Math.sin(a) * GP * .14; x.lineTo(cx, cy); } x.stroke(); blob(p[0], p[1], GP * .8, 'rgba(255,100,30,.1)'); } // ember cracks
    for (let i = 0; i < 12; i++) { const p = pick(); if (!p) continue; blob(p[0], p[1], GP * (.8 + R() * .9), 'rgba(6,5,4,.42)', .5, R() * 3); }                                // soot scorch
    for (let i = 0; i < 6; i++) { const p = pick(); if (!p) continue; x.strokeStyle = 'rgba(226,190,60,.32)'; x.lineWidth = GP * .1; x.setLineDash([GP * .5, GP * .35]); x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[0] + GP * (2 + R() * 3), p[1] + (R() - .5) * GP); x.stroke(); x.setLineDash([]); }
  } else {
    for (let i = 0; i < 12; i++) { const p = pick(); if (!p) continue; for (let j = 0; j < 4; j++) { x.fillStyle = 'rgba(214,206,176,.22)'; x.fillRect(p[0] + j * GP * .34, p[1], GP * .2, GP * .9); } }          // crosswalk stripes
    for (let i = 0; i < 10; i++) { const p = pick(); if (!p) continue; stencil(String.fromCharCode(65 + Math.floor(R() * 12)) + '-' + (1 + Math.floor(R() * 40)), p[0], p[1], GP * .55, 'rgba(214,180,120,.26)', (R() - .5) * .3); } // stall numbers
    for (let i = 0; i < 12; i++) { const p = pick(); if (!p) continue; arrow(p[0], p[1], GP * .42, 'rgba(120,170,200,.22)', Math.floor(R() * 4) * Math.PI / 2); }
    for (let i = 0; i < 26; i++) { const p = pick(); if (!p) continue; x.save(); x.translate(p[0], p[1]); x.rotate(R() * 6); x.fillStyle = R() < .25 ? 'rgba(168,60,52,.55)' : R() < .5 ? 'rgba(80,130,160,.4)' : 'rgba(220,214,196,.45)'; x.fillRect(-4, -3, 8, 6); x.restore(); }  // paper / flyers
    for (let i = 0; i < 14; i++) { const p = pick(); if (!p) continue; const col = ['rgba(255,60,120,.3)', 'rgba(60,220,255,.28)', 'rgba(255,200,60,.3)'][i % 3]; x.strokeStyle = col; x.lineWidth = GP * .07; x.beginPath(); x.moveTo(p[0] - GP * .5, p[1]); x.bezierCurveTo(p[0] - GP * .2, p[1] - GP * .35, p[0] + GP * .1, p[1] + GP * .3, p[0] + GP * .5, p[1] - GP * .05); x.stroke(); } // graffiti tags
    for (let i = 0; i < 10; i++) { const p = pick(); if (!p) continue; blob(p[0], p[1], GP * (.7 + R() * .8), 'rgba(70,52,34,.3)', .5, R() * 3); }
  }
  void hub; x.restore();
}
