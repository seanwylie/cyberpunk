// Analytics event layer (store funnel). Local ring buffer + pluggable sinks. No network by default.
// Wire a real backend by adding a sink: addSink(httpSink('https://example/ingest')). See docs/STORE_SIM.md.
export type AEventName = 'store_open' | 'sku_view' | 'purchase_start' | 'purchase_confirm' | 'purchase_success' | 'purchase_fail' | 'purchase_cancel'
  | 'entitlement_granted' | 'storage_full_prompt' | 'wardrobe_locked_item_click' | 'purchase_duplicate_receipt'
  | 'dr_preview' | 'dr_rotate' | 'dr_buy_intent' | 'dr_apply' | 'dr_revert' | 'dr_outfit_save' | 'dr_outfit_load';
export interface AEvent { n: number; t: number; name: AEventName; sku?: string; data?: Record<string, any>; }
export interface AnalyticsSink { name: string; write(e: AEvent): void; }
export const RING_MAX = 500;
const ring: AEvent[] = []; let seq = 0; const sinks: AnalyticsSink[] = [];

export const consoleSink: AnalyticsSink = { name: 'console', write: e => { try { console.debug('[analytics]', e.name, e.sku || '', e.data || ''); } catch { /* ignore */ } } };
/** Keeps the last `max` events in localStorage (survives reloads, shows up in the export). */
export function localStorageSink(key = 'wv_analytics', max = 200): AnalyticsSink {
  return { name: 'localStorage', write: e => { try { const a: AEvent[] = JSON.parse(localStorage.getItem(key) || '[]'); a.push(e); localStorage.setItem(key, JSON.stringify(a.slice(-max))); } catch { /* ignore */ } } };
}
/** Template for the later real endpoint: batches and POSTs JSON. Not installed by default. */
export function httpSink(url: string, flushEvery = 10, post: (u: string, body: string) => void = (u, b) => { try { if (navigator.sendBeacon) navigator.sendBeacon(u, b); else fetch(u, { method: 'POST', body: b, keepalive: true, headers: { 'content-type': 'application/json' } }); } catch { /* ignore */ } }): AnalyticsSink {
  const q: AEvent[] = [];
  return { name: 'http:' + url, write: e => { q.push(e); if (q.length >= flushEvery) post(url, JSON.stringify(q.splice(0))); } };
}
export function addSink(s: AnalyticsSink) { if (!sinks.some(x => x.name === s.name)) sinks.push(s); }
export function removeSink(name: string) { const i = sinks.findIndex(x => x.name === name); if (i >= 0) sinks.splice(i, 1); }
export const sinkNames = () => sinks.map(s => s.name);

export function track(name: AEventName, sku?: string, data?: Record<string, any>): AEvent {
  const e: AEvent = { n: ++seq, t: Date.now(), name, ...(sku ? { sku } : {}), ...(data ? { data } : {}) };
  ring.push(e); if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
  for (const s of sinks) { try { s.write(e); } catch { /* a bad sink never breaks gameplay */ } }
  return e;
}
export const events = (): AEvent[] => ring.slice();
export function resetAnalytics() { ring.length = 0; seq = 0; }

export interface Funnel {
  views: number; starts: number; confirms: number; successes: number; fails: number; cancels: number;
  viewToStart: number; startToSuccess: number; revenueCents: number;
  perSku: Record<string, { views: number; starts: number; successes: number; fails: number; cancels: number; revenueCents: number }>;
  prompts: { storageFull: number; lockedClicks: number }; opens: number;
}
export function funnel(list: AEvent[] = ring): Funnel {
  const f: Funnel = { views: 0, starts: 0, confirms: 0, successes: 0, fails: 0, cancels: 0, viewToStart: 0, startToSuccess: 0, revenueCents: 0, perSku: {}, prompts: { storageFull: 0, lockedClicks: 0 }, opens: 0 };
  const row = (k: string) => f.perSku[k] || (f.perSku[k] = { views: 0, starts: 0, successes: 0, fails: 0, cancels: 0, revenueCents: 0 });
  for (const e of list) {
    const r = e.sku ? row(e.sku) : null;
    switch (e.name) {
      case 'store_open': f.opens++; break;
      case 'sku_view': f.views++; if (r) r.views++; break;
      case 'purchase_start': f.starts++; if (r) r.starts++; break;
      case 'purchase_confirm': f.confirms++; break;
      case 'purchase_success': { f.successes++; const c = +(e.data?.cents || 0); f.revenueCents += c; if (r) { r.successes++; r.revenueCents += c; } break; }
      case 'purchase_fail': f.fails++; if (r) r.fails++; break;
      case 'purchase_cancel': f.cancels++; if (r) r.cancels++; break;
      case 'storage_full_prompt': f.prompts.storageFull++; break;
      case 'wardrobe_locked_item_click': f.prompts.lockedClicks++; break;
    }
  }
  f.viewToStart = f.views ? f.starts / f.views : 0; f.startToSuccess = f.starts ? f.successes / f.starts : 0; return f;
}
export const fmtUsd = (cents: number) => '$' + (cents / 100).toFixed(2);
export function exportJson(): string { return JSON.stringify({ exportedAt: new Date().toISOString(), funnel: funnel(), events: ring }, null, 1); }
export function funnelText(f: Funnel = funnel()): string {
  const pct = (x: number) => (x * 100).toFixed(0) + '%';
  const lines = [`views ${f.views} > starts ${f.starts} (${pct(f.viewToStart)}) > successes ${f.successes} (${pct(f.startToSuccess)}) | fails ${f.fails} cancels ${f.cancels} | SIMULATED revenue ${fmtUsd(f.revenueCents)}`];
  for (const [k, v] of Object.entries(f.perSku)) lines.push(`  ${k}: views ${v.views} starts ${v.starts} ok ${v.successes} fail ${v.fails} cancel ${v.cancels} ${fmtUsd(v.revenueCents)}`);
  lines.push(`  prompts: storage-full ${f.prompts.storageFull}, locked-item clicks ${f.prompts.lockedClicks}`); return lines.join('\n');
}
// default sinks: console (debug level) + localStorage ring
addSink(consoleSink); addSink(localStorageSink());
