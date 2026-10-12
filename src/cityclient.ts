// Living city, client side (docs/LIVING_CITY.md). Small and eager: holds the city state (server mirror when online, local sim offline),
// turns game events into city events, applies rule effects (prices, guards, signage, bounties). The news panel and street chatter live in
// src/cityui.ts and are lazy-imported behind the `city_news` flag. Nothing here runs per frame; sync is event-driven and tiny.
import { newCity, applyEvents, decay, effectsFor, fromWire, factionOfDungeon, districtOfDungeon, DISTRICTS, FACTIONS, CityState, CityEv, Effects, Wire } from './city';
import { DUNGEONS } from './content/dungeons';

const LS = 'wv_city';
const env = (() => { try { return (import.meta as any).env || {}; } catch { return {}; } })();
/** feature flags: VITE_WV_CITY_NEWS=0 at build time, or localStorage wv_ff_city_news=0/1 per browser. Rules/effects are always on. */
export function cityFlag(name: 'news' | 'chatter'): boolean { try { const o = localStorage.getItem('wv_ff_city_' + name); if (o === '0' || o === '1') return o === '1'; } catch {} return env['VITE_WV_CITY_' + name.toUpperCase()] !== '0'; }
export const CITY_C = { src: 'local' as 'local' | 'server', s: null as unknown as CityState, listeners: new Set<() => void>(), saveT: 0 as any, run: null as null | { dungeon: string; at: number } };
function loadLocal(now = Date.now()): CityState { try { const j = JSON.parse(localStorage.getItem(LS) || 'null'); if (j?.dist && j.week) { for (const id of DISTRICTS) if (!j.dist[id]) j.dist[id] = newCity(now).dist[id]; return j; } } catch {} return newCity(now); }
const saveLocal = () => { if (CITY_C.src !== 'local') return; clearTimeout(CITY_C.saveT); CITY_C.saveT = setTimeout(() => { try { localStorage.setItem(LS, JSON.stringify(CITY_C.s)); } catch {} }, 1500); };
const changed = () => { for (const f of CITY_C.listeners) try { f(); } catch {} };
export const onCity = (f: () => void) => { CITY_C.listeners.add(f); return () => CITY_C.listeners.delete(f); };
const hash = (n: number) => { let a = n >>> 0; a = Math.imul(a ^ (a >>> 15), a | 1); a ^= a + Math.imul(a ^ (a >>> 7), a | 61); return ((a ^ (a >>> 14)) >>> 0) / 4294967296; };
/** offline: the rest of the city keeps living. Deterministic ambient events per elapsed hour (max 72 h), same rules + caps as the server. */
export function ambient(s: CityState, now = Date.now()) {
  const h0 = Math.floor((s.at || now) / 36e5), h1 = Math.floor(now / 36e5); const evs: CityEv[] = []; const ks: CityEv['k'][] = ['clear', 'hack', 'kill', 'speech'];
  for (let h = Math.max(h0 + 1, h1 - 72); h <= h1; h++) for (let j = 0; j < 2; j++) { const r = (k: number) => hash(h * 7919 + j * 104729 + k); const d = DISTRICTS[(r(1) * DISTRICTS.length) | 0]; const f = FACTIONS[(r(2) * FACTIONS.length) | 0]; const k = ks[(r(3) * ks.length) | 0];
    evs.push({ k, d, f, n: k === 'kill' ? 10 : 1, ok: r(4) < .6, w: .6 }); applyEvents(s, evs.splice(0), h * 36e5); }
  decay(s, now);
}
export function cityInit(now = Date.now()) { if (CITY_C.s) return CITY_C.s; CITY_C.s = loadLocal(now); ambient(CITY_C.s, now); saveLocal(); return CITY_C.s; }
/** server snapshot / diff (msg t:'city'). The server is the truth while online. */
export function cityFromServer(m: Wire & { p?: number }) { const base = CITY_C.src === 'server' ? CITY_C.s : newCity(); CITY_C.s = fromWire(m, m.p ? base : newCity()); if (!m.p) { CITY_C.s.v = m.v; } CITY_C.src = 'server'; changed(); }
export function cityGoOffline() { if (CITY_C.src === 'local') return; CITY_C.src = 'local'; CITY_C.s = loadLocal(); ambient(CITY_C.s); changed(); }
export const cityVersion = () => CITY_C.src === 'server' ? CITY_C.s?.v ?? -1 : -1;
export function cityEffects(town: string, now = Date.now()): Effects { cityInit(now); return effectsFor(CITY_C.s, town, now, DUNGEONS as any); }
/** decoration hook for town generation: controlling-faction signage + colour (null = the district's own faction holds it) */
export function cityDecor(town: string): { signs: string[]; color: string; guards: number } | null { const e = cityEffects(town); return { signs: e.signs, color: e.color, guards: e.guards }; }

type Net = { state: string; send: (m: any) => void } | null;
const netOf = (): Net => { const n = (globalThis as any).__net?.client; return n && n.state === 'online' ? n : null; };
const inParty = () => !!(globalThis as any).__net?.session?.active;
/** local apply (offline) or claim (online; the server validates, rate-limits and weights it) */
function record(ev: CityEv, claim: any) { const n = netOf(); if (n && CITY_C.src === 'server') { n.send({ t: 'cev', ...claim }); return; } applyEvents(CITY_C.s, [ev]); saveLocal(); changed(); }
/** game event tap (main.ts emit). Cheap: only reacts to a handful of event types. */
export function cityEvent(g: any, t: string, p: any) {
  if (t !== 'mode' && t !== 'traitcheck' && t !== 'althack' && t !== 'altspeech_res') return; cityInit();
  const dId = g.inst?.dungeon || g.save?.instance?.dungeon; const dd: any = dId ? (DUNGEONS as any)[dId] : null; const f = factionOfDungeon(dd); const d = dId ? districtOfDungeon(dId) : '';
  if (t === 'mode' && p === 'run' && dd) { CITY_C.run = { dungeon: dId, at: Date.now() }; netOf()?.send({ t: 'cev', k: 'run', dungeon: dId, run: String(g.save?.instance?.id || '').slice(0, 32) }); return; }
  if (!dd || !f) return;
  if (t === 'traitcheck' && p === 'clear') { const kills = Object.values(g.inst?.kills || {}).reduce((a: number, b: any) => a + (+b || 0), 0) as number;
    payBounty(g, dId, d); if (inParty()) return; /* party clears are arbitrated by the hub */ record({ k: 'clear', d, f, w: 1 }, { k: 'clear', dungeon: dId, kills }); if (kills) { const n = netOf(); if (!n) { applyEvents(CITY_C.s, [{ k: 'kill', d, f, n: kills }]); saveLocal(); changed(); } } return; }
  if (t === 'althack') return record({ k: 'hack', d, f }, { k: 'hack', dungeon: dId });
  if (t === 'altspeech_res') return record({ k: 'speech', d, f, ok: !!p?.ok }, { k: 'speech', dungeon: dId, ok: p?.ok ? 1 : 0 });
}
/** bounty payout on a clear of a bountied dungeon (rule-based reward; once per dungeon per day) */
export function payBounty(g: any, dungeon: string, d: string): number {
  const e = cityEffects(d); const b = e.bounties.find(x => x.dungeon === dungeon); if (!b) return 0; const s = g.save; const day = new Date().toISOString().slice(0, 10); s.cityBounty = s.cityBounty || {};
  if (s.cityBounty[dungeon] === day) return 0; s.cityBounty[dungeon] = day; s.credits += b.reward; g.toast?.(`Bounty paid: +${b.reward}c`); return b.reward;
}
