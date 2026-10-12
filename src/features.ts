// Feature flags (docs/NEMESIS.md, docs/MOMENTS.md, docs/PERF_BUDGETS.md). A flag is the ONLY switch that lets a heavy system run at all.
// Off-by-default systems allocate nothing until enabled. Settings may turn a flag OFF; they can turn on only flags marked userToggle.
// Tests / dev may override through window.__WV_FEATURES = { key: bool } or localStorage wv_feat_<key> = '1' | '0'.
export const FEATURE_DEFAULTS = {
  /** nemesis bosses (pure save logic + one extra elite per run at most) */ nemesis: true,
  /** cached ElevenLabs taunt playback (lazy <audio>, never decoded into the WebAudio graph, never on the frame path) */ nemesisVoice: true,
  /** once-per-session moment card (PNG rendered only at capture time, on idle) */ moments: true,
  /** rolling WebM clip buffer (MediaRecorder, segmented, hard byte cap). OFF by default: opt in from Settings > Moments */ momentClip: false,
} as const;
export type FeatureKey = keyof typeof FEATURE_DEFAULTS;
export function feature(k: FeatureKey, settings?: any): boolean {
  const g: any = globalThis as any; const o = g.__WV_FEATURES; if (o && typeof o[k] === 'boolean') return o[k];
  try { const v = g.localStorage?.getItem('wv_feat_' + k); if (v === '1') return true; if (v === '0') return false; } catch {}
  const sv = settings?.features?.[k]; if (typeof sv === 'boolean') return sv;
  return FEATURE_DEFAULTS[k];
}
