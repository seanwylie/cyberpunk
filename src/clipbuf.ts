// Rolling WebM clip buffer (docs/MOMENTS.md, docs/PERF_BUDGETS.md). Behind feature flag `momentClip` (default OFF).
// Off the frame path: canvas.captureStream + MediaRecorder encode in the browser's media pipeline; JS only receives a blob every segment.
// Segmented so every kept blob is a standalone, playable WebM: we keep the last complete segment + the one recording now.
// Strict memory cap: CLIP_BUDGET.maxBytes over all kept blobs; a segment that alone breaks the cap is dropped and the buffer shuts itself off.
export const CLIP_BUDGET = { fps: 15, bitsPerSecond: 900_000, segmentMs: 5000, keep: 2, maxBytes: 3 * 1024 * 1024, maxW: 960 } as const;
export class ClipBuffer {
  private rec: any = null; private chunks: Blob[] = []; private done: Blob[] = []; private stream: MediaStream | null = null; private timer: any = 0; private segStart = 0;
  running = false; disabledWhy = ''; stats = { segments: 0, dropped: 0, peakBytes: 0, /** worst main-thread time spent in our recorder callbacks (ms) */ jsMaxMs: 0 };
  private t<T>(f: () => T): T { const a = performance.now(); try { return f(); } finally { this.stats.jsMaxMs = Math.max(this.stats.jsMaxMs, performance.now() - a); } }
  constructor(private canvas: HTMLCanvasElement, private budget = CLIP_BUDGET) {}
  static supported() { return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype; }
  bytes() { return this.done.reduce((a, b) => a + b.size, 0) + this.chunks.reduce((a, b) => a + b.size, 0); }
  start() { if (this.running || !ClipBuffer.supported()) return false; try { this.stream = (this.canvas as any).captureStream(this.budget.fps); } catch { this.disabledWhy = 'capture unsupported'; return false; } this.running = true; this.seg(); return true; }
  private mime() { for (const m of ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm']) if ((MediaRecorder as any).isTypeSupported?.(m)) return m; return 'video/webm'; }
  private seg() { if (!this.running || !this.stream) return; const R: any = new MediaRecorder(this.stream, { mimeType: this.mime(), videoBitsPerSecond: this.budget.bitsPerSecond }); this.rec = R; this.chunks = []; this.segStart = performance.now();
    R.ondataavailable = (e: any) => this.t(() => { if (e.data && e.data.size) { this.chunks.push(e.data); this.enforce(); } });
    R.onstop = () => this.t(() => { const b = new Blob(this.chunks, { type: 'video/webm' }); this.chunks = []; if (b.size) { this.done.push(b); this.stats.segments++; while (this.done.length > this.budget.keep - 1) this.done.shift(); } this.enforce(); (R as any)._res?.(b); if (this.running && !(R as any)._final) setTimeout(() => this.t(() => this.seg()), 0); }); // restart in its own task: keeps each main-thread slice small
    R.start(1000); clearTimeout(this.timer); this.timer = setTimeout(() => { if (R.state === 'recording') R.stop(); }, this.budget.segmentMs); }
  private enforce() { let b = this.bytes(); while (b > this.budget.maxBytes && this.done.length) { this.done.shift(); this.stats.dropped++; b = this.bytes(); }
    if (b > this.budget.maxBytes) { this.chunks = []; this.stats.dropped++; this.stop('over memory cap'); } this.stats.peakBytes = Math.max(this.stats.peakBytes, Math.min(b, this.budget.maxBytes)); }
  /** Finish the current segment and return the best clip (current if it has >= 2 s, else the last complete one). Recording continues. */
  async grab(): Promise<Blob | null> { const R = this.rec; if (!this.running || !R || R.state !== 'recording') return this.done[this.done.length - 1] || null; const prev = this.done[this.done.length - 1] || null; const dur = performance.now() - this.segStart;
    const cur: Blob = await new Promise(res => { R._res = res; clearTimeout(this.timer); R.stop(); }); return dur >= 2000 || !prev ? (cur.size ? cur : prev) : prev; }
  stop(why = '') { this.running = false; if (why) this.disabledWhy = why; clearTimeout(this.timer); try { if (this.rec && this.rec.state === 'recording') { this.rec._final = true; this.rec.stop(); } } catch {} this.rec = null; this.stream?.getTracks().forEach(t => t.stop()); this.stream = null; }
  clear() { this.done = []; this.chunks = []; }
}
