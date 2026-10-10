// Adaptive quality tiers. HIGH is the desktop path and is byte-for-byte what shipped before (dpr<=2, every effect on).
// Medium/Low are only ever selected on coarse-pointer / low-power devices (auto) or when the player picks them in Settings > Display.
export type Tier = 'high' | 'medium' | 'low';
export type QPref = 'auto' | Tier;
interface Params { dprCap: number; maxPixels: number; fx: 0 | 1 | 2; smooth: ImageSmoothingQuality; atlasMax: number; maxFxEnemies: number; musicVariety: boolean }
export const TIERS: Record<Tier, Params> = {
  high: { dprCap: 2, maxPixels: Infinity, fx: 0, smooth: 'high', atlasMax: 8, maxFxEnemies: 999, musicVariety: true },
  medium: { dprCap: 1.5, maxPixels: 2.6e6, fx: 1, smooth: 'medium', atlasMax: 6, maxFxEnemies: 14, musicVariety: false },
  low: { dprCap: 1, maxPixels: 1.3e6, fx: 2, smooth: 'low', atlasMax: 4, maxFxEnemies: 6, musicVariety: false },
};
const ORDER: Tier[] = ['high', 'medium', 'low'];
const nav = (typeof navigator !== 'undefined' ? navigator : {}) as any;
const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

export function detectTier(): { tier: Tier; why: string } {
  const forced = qs.get('q'); if (forced === 'high' || forced === 'medium' || forced === 'low') return { tier: forced, why: 'query' };
  const coarse = (typeof matchMedia !== 'undefined' && matchMedia('(pointer:coarse)').matches) || qs.has('touch');
  const mem: number | undefined = nav.deviceMemory, cores: number = nav.hardwareConcurrency || 8, saveData = !!nav.connection?.saveData;
  if (!coarse) return { tier: 'high', why: 'fine pointer (desktop)' };
  if ((mem && mem <= 3) || cores <= 4 || saveData) return { tier: 'low', why: `coarse pointer, ${mem ? mem + 'GB' : cores + ' cores'}${saveData ? ', save-data' : ''}` };
  return { tier: 'medium', why: 'coarse pointer' };
}

class Quality {
  pref: QPref = 'auto'; auto = detectTier(); tier: Tier = this.auto.tier; resScale = 1; showFps = false;
  p: Params = TIERS[this.tier]; onChange: (() => void) | null = null;
  private acc = 0; private n = 0; private good = 0; private warm = 3; private floor: Tier = 'high'; frameAvg = 0; steps: string[] = [];
  /** Is the dynamic path allowed? Never on the desktop (auto/high) path. */
  get dynamic() { return this.pref === 'auto' && this.auto.tier !== 'high'; }
  setPref(p: QPref) { this.pref = p; this.tier = p === 'auto' ? this.auto.tier : p; this.resScale = 1; this.floor = 'high'; this.apply(); }
  private apply() { this.p = TIERS[this.tier]; this.onChange?.(); if (typeof document !== 'undefined') { const b = document.body; if (b) { for (const t of ORDER) b.classList.toggle('q-' + t, t === this.tier); } } }
  /** effective canvas dpr for a given device dpr + css size */
  dpr(devDpr: number, w: number, h: number) { if (this.tier === 'high') return Math.min(devDpr || 1, 2); let d = Math.min(devDpr || 1, this.p.dprCap) * this.resScale; const px = w * h * d * d; if (px > this.p.maxPixels) d *= Math.sqrt(this.p.maxPixels / px); return Math.max(.5, d); }
  /** 0 = everything, 1 = no ambient particles/fog and fewer lights, 2 = also no lights/glows/blend frames */
  get fx() { return this.p.fx; }
  /** feed one frame (ms). Adjusts resolution first, tier second, only on the dynamic path. */
  sample(ms: number) {
    if (ms > 250) { this.warm = Math.max(this.warm, 1.5); return; } this.acc += ms; this.n++; const win = 1.5 * 1000;
    if (this.acc < win) return; const avg = this.acc / this.n; this.frameAvg = avg; this.acc = 0; this.n = 0;
    if (!this.dynamic) return; if (this.warm > 0) { this.warm -= win / 1000; return; }
    if (avg > 26) { this.good = 0; if (this.resScale > .66) { this.resScale = Math.max(.6, +(this.resScale - .13).toFixed(2)); this.steps.push('res ' + this.resScale); this.apply(); }
      else if (this.tier !== 'low') { const nt = ORDER[ORDER.indexOf(this.tier) + 1]; this.tier = nt; this.floor = nt; this.resScale = .85; this.steps.push('tier ' + nt); this.apply(); } this.warm = 1.5; }
    else if (avg < 15 && this.resScale < 1) { if (++this.good >= 4) { this.good = 0; this.resScale = Math.min(1, +(this.resScale + .1).toFixed(2)); this.steps.push('res ' + this.resScale); this.apply(); this.warm = 1.5; } } else this.good = 0;
  }
  describe() { return `${this.tier}${this.pref === 'auto' ? ' (auto: ' + this.auto.why + ')' : ''} ×${this.resScale}`; }
}
export const Q = new Quality();
(globalThis as any).__quality = Q;
