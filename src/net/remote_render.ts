// Draws other players (town presence + party instances) with the real animated sprite/cosmetics and ONE name plate each.
// Plate rules (no clutter): shown only within PLATE_RANGE tiles of the local player (fading out), never two plates overlapping, party members always in instances.
import type { Renderer } from '../render';
import { PlayerAnimator } from '../sprites';
import { COS_BY_ID, CosDef } from '../content/appearance';
import { drawCosmetics, CosCtx } from '../cosmetics';
import { cpx } from '../config';

export interface RemoteP { id: string; name: string; x: number; y: number; face: number; moving?: boolean; down?: boolean; atk?: boolean; hp?: number; maxHp?: number; look?: any; lvl?: number }
const PLATE_RANGE = 7.5;
const TINTS = ['#e8c46a', '#7fd6c2', '#e58f7b', '#9fb8ff', '#c9a3ff'];
export class RemoteDrawer {
  private an = new Map<string, { a: PlayerAnimator; t: number; hp: number; atk: number }>(); private plates: { x0: number; y0: number; x1: number; y1: number }[] = []; private frameT = -1;
  constructor(private r: Renderer) {}
  private animFor(p: RemoteP) { let o = this.an.get(p.id); const base = this.r.anim; if (!o && base) { o = { a: new PlayerAnimator(base.loaded), t: performance.now(), hp: p.hp ?? 100, atk: 0 }; this.an.set(p.id, o); } return o; }
  forget(id: string) { this.an.delete(id); }
  /** the animator wants a Game-like state; synthesise it from the networked view */
  private fake(p: RemoteP, o: { atk: number }) { const m = !!p.moving; const wx = Math.cos(p.face), wy = Math.sin(p.face); return { hp: p.hp ?? 100, downed: !!p.down, moving: m, dodgeT: 0, cast: null, atkCd: o.atk, face: p.face, inputMove: { x: wx - wy, y: (wx + wy) / 2 }, dodgeDx: 0, dodgeDy: 0, abCd: [0, 0, 0] }; }
  draw(p: RemoteP, me: { x: number; y: number }, alwaysPlate: boolean) {
    const r = this.r, c = r.ctx; const s = r.TW / 64; const a = r.sx(p.x, p.y), b = r.sy(p.x, p.y); const now = performance.now();
    if (now !== this.frameT) { this.frameT = now; }
    c.save(); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(a, b, 13 * s, 6 * s, 0, 0, 7); c.fill();
    const o = this.animFor(p); let drew = false;
    if (o) { const dt = Math.min(.1, (now - o.t) / 1000); o.t = now; if (p.atk) o.atk = .5; else o.atk = Math.max(0, o.atk - dt); try { if (p.look?.body) o.a.setBody(p.look.body); } catch {} o.a.update(this.fake(p, o) as any, dt);
      const cos = ((p.look?.cos || []) as string[]).map(id => COS_BY_ID[id]).filter(Boolean) as CosDef[]; const ck: CosCtx = { c, x: a, y: b, u: s, t: now / 1000, moving: !!p.moving, face: p.face, id: 'net:' + p.id };
      try { if (cos.length) drawCosmetics(ck, cos, 'back'); } catch {} drew = o.a.draw(c, a, b, s); try { if (drew && cos.length) drawCosmetics(ck, cos, 'front'); } catch {} }
    if (!drew) { c.translate(a, b); c.fillStyle = TINTS[(p.id.charCodeAt(1) || 0) % TINTS.length]; c.beginPath(); c.arc(0, -22 * s, 9 * s, 0, 7); c.fill(); c.fillRect(-6 * s, -14 * s, 12 * s, 14 * s); }
    c.restore();
    this.plate(p, a, b, s, Math.hypot(p.x - me.x, p.y - me.y), alwaysPlate);
  }
  private plate(p: RemoteP, a: number, b: number, s: number, dist: number, always: boolean) {
    if (!always && dist > PLATE_RANGE) return; const c = this.r.ctx; const alpha = always ? 1 : Math.max(0, Math.min(1, (PLATE_RANGE - dist) / 2.5)); if (alpha <= .02) return;
    const txt = p.name + (p.down ? '  (downed)' : ''); c.save(); c.globalAlpha = alpha; c.font = `600 ${cpx(12)}px "Roboto Condensed", sans-serif`; const w = c.measureText(txt).width + 12, h = cpx(12) + 6; const x0 = a - w / 2, y0 = b - 74 * s - h;
    const box = { x0, y0, x1: x0 + w, y1: y0 + h + (p.maxHp ? 5 : 0) }; if (this.plates.some(q => box.x0 < q.x1 && box.x1 > q.x0 && box.y0 < q.y1 && box.y1 > q.y0)) { c.restore(); return; } // one label rules: skip overlapping plates
    this.plates.push(box); c.fillStyle = 'rgba(14,15,17,.78)'; c.strokeStyle = p.down ? '#e5604a' : 'rgba(232,196,106,.55)'; c.lineWidth = 1; c.beginPath(); c.roundRect(x0, y0, w, h, 4); c.fill(); c.stroke();
    c.fillStyle = p.down ? '#ffb4a6' : '#f1eadb'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, a, y0 + h / 2 + .5);
    if (p.maxHp && p.hp != null) { const f = Math.max(0, Math.min(1, p.hp / p.maxHp)); c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(x0 + 2, y0 + h + 1, w - 4, 3); c.fillStyle = f > .5 ? '#6fcf7a' : f > .25 ? '#e8c46a' : '#e5604a'; c.fillRect(x0 + 2, y0 + h + 1, (w - 4) * f, 3); }
    c.restore();
  }
  beginFrame() { this.plates.length = 0; }
  /** ping marker: pulsing ring + sender name (4 s) */
  mark(m: { x: number; y: number; name: string; t: number }) { const r = this.r, c = r.ctx; const age = (Date.now() - m.t) / 1000; if (age > 4) return; const a = r.sx(m.x, m.y), b = r.sy(m.x, m.y), s = r.TW / 64; c.save(); c.globalAlpha = Math.max(0, 1 - age / 4); c.strokeStyle = '#e8c46a'; c.lineWidth = 2.5; const k = (age * 1.6) % 1; c.beginPath(); c.ellipse(a, b, (10 + k * 22) * s, (5 + k * 11) * s, 0, 0, 7); c.stroke(); c.fillStyle = '#e8c46a'; c.beginPath(); c.moveTo(a, b - 4 * s); c.lineTo(a - 6 * s, b - 20 * s); c.lineTo(a + 6 * s, b - 20 * s); c.fill(); c.font = `600 ${cpx(12)}px "Roboto Condensed", sans-serif`; c.textAlign = 'center'; c.fillText(m.name, a, b - 26 * s); c.restore(); }
}
