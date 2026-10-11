// Snapshot interpolation: remote entities are drawn INTERP_DELAY seconds behind the newest server state, lerped between the two bracketing snapshots.
import { INTERP_DELAY } from './shared';
export interface Ent { id: string | number; x: number; y: number; face?: number; [k: string]: any }
const lerpAng = (a: number, b: number, t: number) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
export class Interp<T extends Ent> {
  private buf: { st: number; recv: number; m: Map<string | number, T> }[] = [];
  constructor(public delay = INTERP_DELAY, public maxExtrap = 0.25) {}
  push(serverT: number, recvMs: number, list: T[]) { if (this.buf.length && serverT <= this.buf[this.buf.length - 1].st) return; this.buf.push({ st: serverT, recv: recvMs, m: new Map(list.map(e => [e.id, e])) }); if (this.buf.length > 40) this.buf.shift(); }
  clear() { this.buf = []; }
  /** entities as they should look at local time `nowMs` */
  sample(nowMs: number): T[] {
    const n = this.buf.length; if (!n) return []; const last = this.buf[n - 1];
    const rt = Math.min(last.st + this.maxExtrap, last.st - this.delay + (nowMs - last.recv) / 1000); // render time on the server clock, extrapolation bounded
    let i = n - 1; while (i > 0 && this.buf[i - 1].st > rt) i--; const b = this.buf[i], a = i > 0 ? this.buf[i - 1] : null; const out: T[] = [];
    for (const [id, eb] of b.m) { const ea = a?.m.get(id); if (!a || !ea || rt >= b.st) { out.push(eb); continue; } const k = Math.max(0, Math.min(1, (rt - a.st) / Math.max(1e-6, b.st - a.st))); out.push({ ...eb, x: ea.x + (eb.x - ea.x) * k, y: ea.y + (eb.y - ea.y) * k, face: ea.face != null && eb.face != null ? lerpAng(ea.face, eb.face, k) : eb.face }); }
    return out;
  }
}
