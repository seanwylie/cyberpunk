// Moment card renderer (docs/MOMENTS.md): 1200x630 PNG, painterly splash-art frame (League / Arcane direction: warm painted wash,
// brushed vignette, thin gold frame, no particles). Runs only at capture time, on idle, on its own canvas: never on the frame path.
import type { Moment } from './moments';
export const CARD_W = 1200, CARD_H = 630;
const ACC: Record<string, [string, string]> = { nemesis_kill: ['#c9a46a', '#3a1d1a'], exclusive_drop: ['#d9b46a', '#2a2140'], orange_drop: ['#e09a4a', '#3a2214'], gateway_clear: ['#9cc0c8', '#14262c'], flawless_boss: ['#d8d2bf', '#22201c'] };
function rnd(seed: number) { let a = seed >>> 0 || 7; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return ((a >>> 0) % 10000) / 10000; }; }
export function drawCard(c: CanvasRenderingContext2D, m: Moment, shot: CanvasImageSource | null) { const W = CARD_W, H = CARD_H; const [acc, deep] = ACC[m.kind] || ACC.flawless_boss; const r = rnd(m.at | 0);
  const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, deep); bg.addColorStop(1, '#0d0b0a'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.save(); c.globalAlpha = .07; for (let i = 0; i < 70; i++) { c.strokeStyle = i % 3 ? acc : '#f2e6cc'; c.lineWidth = 18 + r() * 50; c.lineCap = 'round'; c.beginPath(); const x = r() * W, y = r() * H, a = -.5 + r() * .3; c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * 160, y + Math.sin(a) * 40 + 30 * (r() - .5), x + Math.cos(a) * 320, y + Math.sin(a) * 80); c.stroke(); } c.restore();
  const sx = 40, sy = 40, sw = 700, sh = H - 80; if (shot) { c.save(); c.beginPath(); c.rect(sx, sy, sw, sh); c.clip(); const iw = (shot as any).width || sw, ih = (shot as any).height || sh; const k = Math.max(sw / iw, sh / ih); c.drawImage(shot, sx + (sw - iw * k) / 2, sy + (sh - ih * k) / 2, iw * k, ih * k);
    const v = c.createLinearGradient(sx, 0, sx + sw, 0); v.addColorStop(0, 'rgba(10,8,8,0)'); v.addColorStop(.75, 'rgba(10,8,8,.15)'); v.addColorStop(1, 'rgba(10,8,8,.85)'); c.fillStyle = v; c.fillRect(sx, sy, sw, sh); c.restore(); }
  c.strokeStyle = acc; c.lineWidth = 2; c.strokeRect(sx - 6, sy - 6, sw + 12, sh + 12); c.globalAlpha = .45; c.strokeRect(sx - 12, sy - 12, sw + 24, sh + 24); c.globalAlpha = 1;
  const tx = 780; c.textAlign = 'left'; c.fillStyle = acc; c.font = '600 18px "Roboto Condensed", sans-serif'; c.fillText(labelOf(m).toUpperCase(), tx, 92);
  c.fillStyle = '#f2e6cc'; c.font = '700 40px "Roboto Condensed", sans-serif'; wrap(c, m.title, tx, 140, 380, 44, 3);
  c.fillStyle = '#d6c6a4'; c.font = 'italic 22px "Roboto Condensed", sans-serif'; wrap(c, m.sub, tx, 290, 380, 28, 2);
  c.font = '600 17px "Roboto Condensed", sans-serif'; let y = 380; for (const [k, v] of Object.entries(m.stats).slice(0, 5)) { c.fillStyle = '#9c8c70'; c.fillText(k, tx, y); c.fillStyle = '#efe4cc'; c.textAlign = 'right'; c.fillText(String(v).slice(0, 26), 1160, y); c.textAlign = 'left'; y += 28; }
  c.fillStyle = '#7d705a'; c.font = '13px monospace'; c.fillText('Build ' + (m.code.length > 44 ? m.code.slice(0, 44) + '…' : m.code), tx, H - 66);
  c.fillStyle = acc; c.font = '700 20px "Roboto Condensed", sans-serif'; c.fillText('WARRANTY VOID', tx, H - 40); }
const labelOf = (m: Moment) => ({ nemesis_kill: 'Nemesis slain', exclusive_drop: 'Exclusive drop', orange_drop: 'Orange drop', gateway_clear: 'Gateway cleared', flawless_boss: 'Flawless boss' } as any)[m.kind] || 'Moment';
function wrap(c: CanvasRenderingContext2D, t: string, x: number, y: number, w: number, lh: number, max: number) { const words = String(t).split(/\s+/); let line = '', n = 0; for (const wd of words) { const tt = line ? line + ' ' + wd : wd; if (c.measureText(tt).width > w && line) { c.fillText(line, x, y); y += lh; line = wd; if (++n >= max - 1) break; } else line = tt; } if (line) c.fillText(line, x, y); }
export function renderCard(m: Moment, shot: CanvasImageSource | null): Promise<Blob | null> { const cv = document.createElement('canvas'); cv.width = CARD_W; cv.height = CARD_H; const c = cv.getContext('2d')!; drawCard(c, m, shot);
  return new Promise(res => cv.toBlob(b => { cv.width = cv.height = 0; res(b); }, 'image/png')); }
