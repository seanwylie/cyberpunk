// Living city (docs/LIVING_CITY.md): server-wide world state as pure data + rules. Shared by the client (offline sim + effects), the game
// server (authoritative aggregation) and tests. No DOM, no Game import. Every gameplay effect comes from these bounded rules; AI only writes words.
import { WORLD, WORLD_BY_ID } from './world';

export const FACTIONS = ['Rustline Compact', 'Kestrel Value', 'Harrow-Brandt', 'Aldane Surgical', 'Quiet Shift', 'Recall Authority'] as const;
export type Faction = typeof FACTIONS[number];
export const CORPS: readonly string[] = ['Kestrel Value', 'Harrow-Brandt', 'Aldane Surgical', 'Recall Authority'];
export const FACTION_SHORT: Record<string, string> = { 'Rustline Compact': 'Compact', 'Kestrel Value': 'Kestrel', 'Harrow-Brandt': 'Harrow-Brandt', 'Aldane Surgical': 'Aldane', 'Quiet Shift': 'Quiet Shift', 'Recall Authority': 'Recall' };
export const FACTION_COLOR: Record<string, string> = { 'Rustline Compact': '#ffb02e', 'Kestrel Value': '#ffd84a', 'Harrow-Brandt': '#ff6a3a', 'Aldane Surgical': '#f2ecc4', 'Quiet Shift': '#46e08a', 'Recall Authority': '#7af0ff' };
export const FACTION_SIGNS: Record<string, string[]> = { 'Rustline Compact': ['COMPACT', 'OPEN MARKET'], 'Kestrel Value': ['KESTREL', 'SALE'], 'Harrow-Brandt': ['HARROW-BRANDT', 'SHIFT 7'], 'Aldane Surgical': ['ALDANE', 'QUIET ZONE'], 'Quiet Shift': ['QUIET SHIFT', 'CASH ONLY'], 'Recall Authority': ['RECALL AUTH', 'CUSTOMS'] };
export const DISTRICTS: string[] = WORLD.map(t => t.id);
const MFR_FACTION: Record<string, Faction> = { HI: 'Harrow-Brandt', PS: 'Aldane Surgical', MM: 'Kestrel Value' };
/** faction id of whatever owns a dungeon's mobs (dungeon `faction`, else its manufacturer) */
export function factionOfDungeon(d: { faction?: string; mfr?: string } | undefined): Faction | null {
  if (!d) return null; const f = d.faction && (FACTIONS as readonly string[]).includes(d.faction) ? d.faction as Faction : (d.faction && MFR_FACTION[d.faction]) || (d.mfr ? MFR_FACTION[d.mfr] : undefined); return f || null;
}
/** host district of a dungeon (first town whose gate lists it) */
export const districtOfDungeon = (id: string) => WORLD.find(t => t.dungeons.includes(id))?.id || (id === 'annex' || id === 'warehouse' ? 'neon_mile' : 'rustline');

// ---------- tunables (all bounded; see docs/LIVING_CITY.md)
export const CITY = {
  floor: 2,               // min influence any faction keeps in a district
  flipMargin: 8,          // challenger must lead the controller by this much
  minHoldH: 6,            // controller holds at least this long after a flip
  hourCap: 12,            // max influence moved per district per hour (server + local)
  tensionBase: 20, tensionDecayH: 4, flipTension: 70,
  bountyTension: 55, lockdownTension: 80,
  w: { kill: .02, clear: 1, gateway: 2, hack: .6, speech: .5 } as Record<string, number>,
  tw: { kill: .01, clear: 1, gateway: 2, hack: .6, speech: .3 } as Record<string, number>,
};
export type CityEvKind = 'kill' | 'clear' | 'gateway' | 'hack' | 'speech';
/** one aggregated event: `n` occurrences of `k` against (or, for successful speech, with) faction `f` in district `d`; `w` = source weight (arbitrated 1, unverified solo claims < 1) */
export interface CityEv { k: CityEvKind; d: string; f: Faction; n?: number; ok?: boolean; w?: number; who?: string }
export interface District { inf: number[]; ctrl: number; since: number; tension: number; moved: number; movedHour: number }
export interface WeekAgg { wk: string; dist: Record<string, Record<string, number>>; flips: { d: string; from: string; to: string; at: number }[]; players: Record<string, { name: string; clears: number; gateways: number }> }
export interface CityState { v: number; at: number; dist: Record<string, District>; week: WeekAgg; prev?: WeekAgg }

export const weekKey = (t: number) => { const d = new Date(t); const day = (d.getUTCDay() + 6) % 7; const m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day); return new Date(m).toISOString().slice(0, 10); };
const emptyWeek = (t: number): WeekAgg => ({ wk: weekKey(t), dist: {}, flips: [], players: {} });
export function newCity(now = Date.now()): CityState {
  const dist: Record<string, District> = {};
  for (const t of WORLD) { const home = FACTIONS.indexOf(t.faction as Faction); const inf: number[] = FACTIONS.map((_, i) => i === home ? 55 : 0); const rest = FACTIONS.length - 1; for (let i = 0; i < inf.length; i++) if (i !== home) inf[i] = 45 / rest; dist[t.id] = { inf, ctrl: Math.max(0, home), since: now - CITY.minHoldH * 36e5, tension: CITY.tensionBase, moved: 0, movedHour: Math.floor(now / 36e5) }; }
  return { v: 1, at: now, dist, week: emptyWeek(now) };
}
const norm = (inf: number[]) => { for (let i = 0; i < inf.length; i++) inf[i] = Math.max(CITY.floor, inf[i]); const s = inf.reduce((a, b) => a + b, 0); for (let i = 0; i < inf.length; i++) inf[i] = inf[i] * 100 / s; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Apply events. Returns the districts that changed. Bounded: per-district hourly influence cap, influence floor, tension 0..100. */
export function applyEvents(s: CityState, evs: CityEv[], now = Date.now()): string[] {
  rollWeek(s, now); const touched = new Set<string>();
  for (const e of evs) {
    const D = s.dist[e.d], fi = FACTIONS.indexOf(e.f); if (!D || fi < 0 || !CITY.w[e.k]) continue;
    const n = clamp(Math.floor(e.n ?? 1), 1, 500), w = clamp(e.w ?? 1, 0, 1); const hr = Math.floor(now / 36e5); if (D.movedHour !== hr) { D.movedHour = hr; D.moved = 0; }
    let amt = CITY.w[e.k] * n * w; amt = Math.min(amt, Math.max(0, CITY.hourCap - D.moved)); D.moved += amt;
    if (e.k === 'speech' && e.ok) { const take = amt; for (let i = 0; i < D.inf.length; i++) if (i !== fi) D.inf[i] -= take * (D.inf[i] / (100 - D.inf[fi] || 1)); D.inf[fi] += take; }
    else if (!(e.k === 'speech' && !e.ok)) { const lose = Math.min(amt, Math.max(0, D.inf[fi] - CITY.floor)); let ch = -1; for (let i = 0; i < D.inf.length; i++) if (i !== fi && (ch < 0 || D.inf[i] > D.inf[ch])) ch = i; D.inf[fi] -= lose; D.inf[ch] += lose; }
    norm(D.inf); D.tension = clamp(D.tension + CITY.tw[e.k] * n * w * (e.k === 'speech' && e.ok ? -1 : 1), 0, 100);
    const a = (s.week.dist[e.d] ||= {}); a[e.k + (e.k === 'speech' ? (e.ok ? '_ok' : '_fail') : '')] = (a[e.k + (e.k === 'speech' ? (e.ok ? '_ok' : '_fail') : '')] || 0) + n;
    if (e.who && (e.k === 'clear' || e.k === 'gateway')) { const p = s.week.players[e.who]; if (p) { if (e.k === 'clear') p.clears += n; else p.gateways += n; } }
    touched.add(e.d);
  }
  for (const d of touched) if (flipCheck(s, d, now)) touched.add(d);
  if (touched.size) { s.v++; s.at = now; } return [...touched];
}
/** Flip rule: the strongest challenger takes the district when it leads the controller by flipMargin and the controller has held for minHoldH. */
export function flipCheck(s: CityState, d: string, now = Date.now()): boolean {
  const D = s.dist[d]; let c = -1; for (let i = 0; i < D.inf.length; i++) if (i !== D.ctrl && (c < 0 || D.inf[i] > D.inf[c])) c = i;
  if (D.inf[c] < D.inf[D.ctrl] + CITY.flipMargin || now - D.since < CITY.minHoldH * 36e5) return false;
  s.week.flips.push({ d, from: FACTIONS[D.ctrl], to: FACTIONS[c], at: now }); if (s.week.flips.length > 40) s.week.flips.shift(); D.ctrl = c; D.since = now; D.tension = Math.max(D.tension, CITY.flipTension); return true;
}
/** time passes: tension relaxes toward base; the week aggregate rolls over on Monday (UTC) */
export function decay(s: CityState, now = Date.now()) { const h = clamp((now - s.at) / 36e5, 0, 24 * 14); if (h <= 0) return; for (const D of Object.values(s.dist)) { const dv = D.tension - CITY.tensionBase; D.tension = CITY.tensionBase + Math.sign(dv) * Math.max(0, Math.abs(dv) - CITY.tensionDecayH * h); } s.at = now; rollWeek(s, now); }
export function rollWeek(s: CityState, now: number) { const wk = weekKey(now); if (s.week.wk !== wk) { s.prev = s.week; s.week = emptyWeek(now); } }
export function notePlayer(s: CityState, id: string, name: string | null) { if (!name) { delete s.week.players[id]; if (s.prev) delete s.prev.players[id]; return; } const p = s.week.players[id]; if (p) p.name = name; else s.week.players[id] = { name, clears: 0, gateways: 0 }; }

// ---------- compact wire format (low bandwidth): [ctrl, tension, ...inf] per district in WORLD order, ints
export type Wire = { v: number; d: number[][] };
export const toWire = (s: CityState, only?: string[]): Wire => ({ v: s.v, d: DISTRICTS.map(id => { if (only && !only.includes(id)) return []; const D = s.dist[id]; return [D.ctrl, Math.round(D.tension), ...D.inf.map(x => Math.round(x))]; }) });
export function fromWire(w: Wire, base?: CityState): CityState { const s = base ? base : newCity(); w.d.forEach((r, i) => { if (!r || r.length < 2 + FACTIONS.length) return; const D = s.dist[DISTRICTS[i]]; if (!D) return; D.ctrl = clamp(r[0] | 0, 0, FACTIONS.length - 1); D.tension = clamp(+r[1] || 0, 0, 100); D.inf = r.slice(2, 2 + FACTIONS.length).map(x => clamp(+x || 0, 0, 100)); }); s.v = w.v | 0; return s; }

// ---------- effects (rules only). Everything the game changes based on the city goes through here.
export interface WorldEvent { id: string; kind: 'lockdown' | 'night_market' | 'turf_war'; d: string; f: string; label: string; tip: string; until: number }
export interface Bounty { d: string; f: string; dungeon: string; reward: number; label: string }
export interface Effects { d: string; ctrl: string; color: string; signs: string[]; tension: number; priceMul: number; guards: number; events: WorldEvent[]; bounties: Bounty[]; mood: 'calm' | 'tense' | 'hot' }
const weekendEnd = (now: number) => { const d = new Date(now); const day = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 7); };
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export function worldEvents(s: CityState, now = Date.now()): WorldEvent[] {
  const out: WorldEvent[] = []; const end = weekendEnd(now); const town = (d: string) => WORLD_BY_ID[d]?.name || d;
  for (const d of DISTRICTS) { const D = s.dist[d], f = FACTIONS[D.ctrl], sh = FACTION_SHORT[f];
    if (D.tension >= CITY.lockdownTension && CORPS.includes(f)) out.push({ id: 'lock_' + d, kind: 'lockdown', d, f, label: `${sh} lockdown in ${town(d)}`, tip: 'Extra guards, prices up. Ends when tension drops.', until: end });
    else if (D.tension >= CITY.lockdownTension) out.push({ id: 'war_' + d, kind: 'turf_war', d, f, label: `Turf war in ${town(d)}`, tip: 'Bounties pay more until it cools off.', until: end }); }
  const wd = (new Date(now).getUTCDay() + 6) % 7; if (wd >= 4) { const d = DISTRICTS[hash(weekKey(now)) % DISTRICTS.length], D = s.dist[d], f = FACTIONS[D.ctrl];
    if (!out.some(e => e.d === d)) out.push(CORPS.includes(f) ? { id: 'wk_' + d, kind: 'lockdown', d, f, label: `${FACTION_SHORT[f]} lockdown in ${town(d)} this weekend`, tip: 'Extra guards, prices up until Monday.', until: end } : { id: 'wk_' + d, kind: 'night_market', d, f, label: `Night market in ${town(d)} this weekend`, tip: 'Vendor prices down until Monday.', until: end }); }
  return out;
}
export function effectsFor(s: CityState, d: string, now = Date.now(), dungeons?: Record<string, { faction?: string; mfr?: string; minLevel?: number }>): Effects {
  const D = s.dist[d] || newCity(now).dist[d] || { ctrl: 0, tension: CITY.tensionBase, inf: [] } as any; const f = FACTIONS[D.ctrl]; const ev = worldEvents(s, now).filter(e => e.d === d); const t = WORLD_BY_ID[d];
  let priceMul = clamp(1 + .25 * (D.tension - 30) / 70, .9, 1.25); if (t && t.faction === f && CORPS.includes(f)) priceMul -= .05;
  if (ev.some(e => e.kind === 'lockdown')) priceMul += .1; if (ev.some(e => e.kind === 'night_market')) priceMul -= .1; priceMul = Math.round(clamp(priceMul, .8, 1.35) * 100) / 100;
  const guards = clamp((CORPS.includes(f) ? 2 : 1) + Math.round(D.tension / 25) + (ev.some(e => e.kind === 'lockdown') ? 2 : 0), 0, 8);
  const bounties: Bounty[] = []; if (D.tension >= CITY.bountyTension && t) { const war = ev.some(e => e.kind === 'turf_war') ? 1.5 : 1;
    const pool = t.dungeons.filter(id => !dungeons || factionOfDungeon(dungeons[id]) === f); const list = pool.length ? pool : t.dungeons;
    for (const dn of list.slice(0, 2)) bounties.push({ d, f, dungeon: dn, reward: Math.round((60 + t.band[0] * 12 + D.tension * 2) * war), label: `Bounty: ${FACTION_SHORT[f]}` }); }
  return { d, ctrl: f, color: FACTION_COLOR[f], signs: FACTION_SIGNS[f], tension: Math.round(D.tension), priceMul, guards, events: ev, bounties, mood: D.tension >= 75 ? 'hot' : D.tension >= 45 ? 'tense' : 'calm' };
}
