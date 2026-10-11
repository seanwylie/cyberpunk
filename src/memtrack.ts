// Dev memory tracker + overlay (docs/PERF.md). Off by default: enable with ?mem, localStorage wv_mem=1 or window.__WV_MEM=1 (tests).
// Tracks every Image / canvas / OffscreenCanvas with WeakRefs so live decoded-pixel memory (w*h*4) can be summed after a GC.
// Also reads decoded music AudioBuffers from the music manager. Nothing here runs when disabled.
const on = (() => { try { return !!(globalThis as any).__WV_MEM || new URLSearchParams(location.search).has('mem') || localStorage.getItem('wv_mem') === '1'; } catch { return false; } })();
type Ref = { r: WeakRef<any>; s: string };
const imgs: Ref[] = [], cvs: Ref[] = [];
function prune(a: Ref[]) { let j = 0; for (const x of a) if (x.r.deref()) a[j++] = x; a.length = j; }
export interface MemSnap { jsHeapMB: number; imgMB: number; imgN: number; cvMB: number; cvN: number; audioMB: number; audioN: number; byDir: Record<string, number>; bigImgs: { src: string; mb: number }[]; bigCvs: { mb: number; wh: string }[] }
const mb = (b: number) => +(b / 1048576).toFixed(1);
export function memSnap(): MemSnap {
  prune(imgs); prune(cvs); let im = 0, ci = 0, cc = 0; const bd: Record<string, number> = {}, bi: { src: string; mb: number }[] = [], bc: { mb: number; wh: string }[] = [];
  for (const x of imgs) { const i = x.r.deref() as HTMLImageElement; if (!i || !i.complete || !i.naturalWidth) continue; const b = i.naturalWidth * i.naturalHeight * 4; im += b; ci++; bi.push({ src: x.s, mb: mb(b) }); const d = x.s.replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*/, '').split('/').slice(0, -1).join('/') || 'data/blob'; bd[d] = +((bd[d] || 0) + b / 1048576).toFixed(1); }
  for (const x of cvs) { const c = x.r.deref(); if (!c) continue; const b = c.width * c.height * 4; cc += b; bc.push({ mb: mb(b), wh: c.width + 'x' + c.height }); }
  const m = (globalThis as any).__audio?.music, bufs: AudioBuffer[] = m ? Object.values(m.buffers || {}) : []; let ab = 0; for (const b of bufs) ab += b.length * b.numberOfChannels * 4;
  const pm = (performance as any).memory;
  return { jsHeapMB: pm ? mb(pm.usedJSHeapSize) : 0, imgMB: mb(im), imgN: ci, cvMB: mb(cc), cvN: cvs.length, audioMB: mb(ab), audioN: bufs.length, byDir: bd, bigImgs: bi.sort((a, b) => b.mb - a.mb).slice(0, 12), bigCvs: bc.sort((a, b) => b.mb - a.mb).slice(0, 8) };
}
if (on) {
  const W = window as any; W.__memSnap = memSnap;
  const OI = W.Image; W.Image = function (this: any, w?: number, h?: number) { const i = new OI(...(w === undefined ? [] : [w, h])); imgs.push({ r: new WeakRef(i), s: '' }); const e = imgs[imgs.length - 1]; i.addEventListener('load', () => { e.s = i.currentSrc || i.src; }); return i; } as any; W.Image.prototype = OI.prototype;
  const ce = Document.prototype.createElement; (Document.prototype as any).createElement = function (this: Document, t: string, o?: any) { const el = ce.call(this, t, o); const tl = String(t).toLowerCase(); if (tl === 'canvas') cvs.push({ r: new WeakRef(el), s: '' }); else if (tl === 'img') { const e: Ref = { r: new WeakRef(el), s: '' }; imgs.push(e); el.addEventListener('load', () => { e.s = (el as HTMLImageElement).currentSrc; }); } return el; };
  const OC = W.OffscreenCanvas; if (OC) { W.OffscreenCanvas = class extends OC { constructor(w: number, h: number) { super(w, h); cvs.push({ r: new WeakRef(this), s: '' }); } }; }
  window.addEventListener('DOMContentLoaded', () => {
    const el = document.createElement('div'); el.id = 'memOverlay'; el.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:9999;font:11px monospace;color:#ff9;background:rgba(0,0,0,.7);padding:3px 6px;pointer-events:none;white-space:pre'; document.body.appendChild(el);
    setInterval(() => { const s = memSnap(), d = (navigator as any).deviceMemory; el.textContent = `heap ${s.jsHeapMB}MB  img ${s.imgMB}MB/${s.imgN}  canvas ${s.cvMB}MB/${s.cvN}  audio ${s.audioMB}MB/${s.audioN}${d ? '  dev ' + d + 'GB' : ''}`; }, 1000);
  });
}
