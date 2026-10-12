// Shareable moments (docs/MOMENTS.md). PURE selection logic: one moment per session, the best one wins.
export const MOMENT_SCORE: Record<string, number> = { nemesis_kill: 100, exclusive_drop: 90, orange_drop: 80, gateway_clear: 70, flawless_boss: 60 };
export const MOMENT_LABEL: Record<string, string> = { nemesis_kill: 'Nemesis slain', exclusive_drop: 'Exclusive drop', orange_drop: 'Orange drop', gateway_clear: 'Gateway cleared', flawless_boss: 'Flawless boss' };
export interface Moment { kind: string; title: string; sub: string; at: number; score: number; stats: Record<string, string | number>; code: string }
export interface MomentSession { best: Moment | null; captures: number }
export const MAX_CAPTURES_PER_SESSION = 1;
/** Offer an event. Returns the moment when it becomes this session's capture (first qualifying event, or a strictly better one before the card was shared). */
export function offer(ses: MomentSession, ev: { kind: string; title?: string; sub?: string }, ctx: { stats: Record<string, string | number>; code: string; now?: number }, locked = false): Moment | null {
  const sc = MOMENT_SCORE[ev.kind]; if (!sc) return null; if (ses.best && (locked || sc <= ses.best.score)) return null;
  if (!ses.best && ses.captures >= MAX_CAPTURES_PER_SESSION) return null;
  const m: Moment = { kind: ev.kind, title: String(ev.title || MOMENT_LABEL[ev.kind]).slice(0, 80), sub: String(ev.sub || '').slice(0, 80), at: ctx.now ?? Date.now(), score: sc, stats: ctx.stats, code: ctx.code };
  if (!ses.best) ses.captures++; ses.best = m; return m; }
