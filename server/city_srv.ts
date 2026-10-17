// Living city, server side (docs/LIVING_CITY.md). Owns the authoritative CityState, ingests ONLY validated events, persists to DynamoDB
// (or a local file / memory in dev), and syncs a tiny wire snapshot to town shards. Never blocks gameplay: all I/O is async + best effort.
import { applyEvents, decay, newCity, notePlayer, toWire, factionOfDungeon, districtOfDungeon, FACTIONS, DISTRICTS, CityState, CityEv, Faction } from '../src/city';
import { DUNGEONS } from '../src/content/dungeons';
import { GATEWAY_BY_DUNGEON } from '../src/world';
import { ddb } from './ddb_lite';
// @ts-ignore plain ESM shared with the news Lambda
import { generateNews } from './city_news.mjs';
import fs from 'node:fs';
import { WORLD } from '../src/world';
/** town names stored next to the state so the news Lambda (plain JS) can name places without bundling the game */
export const CITY_NAMES = { towns: Object.fromEntries(WORLD.map(t => [t.id, t.name])) };

export interface CityStore { load(): Promise<{ state?: CityState; news?: any } | null>; save(s: CityState): Promise<void>; news(): Promise<any | null> }
export const memStore = (): CityStore & { saved: number; data: any } => { const o: any = { saved: 0, data: null, load: async () => o.data, save: async (s: CityState) => { o.saved++; o.data = { ...(o.data || {}), state: JSON.parse(JSON.stringify(s)) }; }, news: async () => o.data?.news ?? null }; return o; };
export const fileStore = (path: string): CityStore => ({ load: async () => { try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return null; } }, save: async s => { let o: any = {}; try { o = JSON.parse(fs.readFileSync(path, 'utf8')); } catch {} o.state = s; fs.writeFileSync(path, JSON.stringify(o)); }, news: async () => { try { return JSON.parse(fs.readFileSync(path, 'utf8')).news ?? null; } catch { return null; } } });
/** DynamoDB table (pk string): item pk='state' {json}, pk='news#latest' {json} written by the news Lambda */
export const ddbStore = (table: string): CityStore => ({
  load: async () => { const r = await ddb('GetItem', { TableName: table, Key: { pk: { S: 'state' } }, ConsistentRead: true }); return r.Item?.json?.S ? { state: JSON.parse(r.Item.json.S) } : null; },
  save: async s => { await ddb('PutItem', { TableName: table, Item: { pk: { S: 'state' }, json: { S: JSON.stringify(s) }, v: { N: String(s.v) }, at: { N: String(s.at) } } }); },
  news: async () => { const r = await ddb('GetItem', { TableName: table, Key: { pk: { S: 'news#latest' } } }); return r.Item?.json?.S ? JSON.parse(r.Item.json.S) : null; },
});

/** anti-spoof limits for client-claimed events (party clears/kills are arbitrated by the hub and never claimed) */
export const CLAIM = { perMin: 4, perDay: 80, hackPerRun: 12, speechPerRun: 8, soloClearGapMs: 150e3, soloMinRunMs: 90e3, soloW: .3, claimW: .5 };
interface Claimer { tokens: number; last: number; day: string; n: number; run: { id: string; at: number; hack: number; speech: number; cleared: boolean; nem?: boolean } | null; lastClear: number }
const today = () => new Date().toISOString().slice(0, 10);

export class CityHub {
  s: CityState; dirty = false; pending = new Set<string>(); news: any = null; stats = { accepted: 0, rejected: 0, flips: 0, saves: 0, saveErr: 0, bytes: 0 };
  private cl = new Map<string, Claimer>();
  constructor(public store: CityStore | null, now = Date.now()) { this.s = newCity(now); }
  async init() { try { const d = await this.store?.load(); if (d?.state?.dist) { this.s = d.state; delete (this.s as any).names; for (const id of DISTRICTS) if (!this.s.dist[id]) this.s.dist[id] = newCity().dist[id]; } if (d?.news) this.news = d.news; } catch (e) { console.warn('[city] load failed, starting fresh', String(e)); } }
  private apply(evs: CityEv[], now = Date.now()) { const f0 = this.s.week.flips.length; const ch = applyEvents(this.s, evs, now); for (const d of ch) this.pending.add(d); if (ch.length) this.dirty = true; this.stats.flips += Math.max(0, this.s.week.flips.length - f0); return ch; }
  /** arbitrated pivotal event from the hub: a party room completed (boss kill claim accepted). One clear per member, kills credited once per room. */
  roomCompleted(dungeon: string, members: { id: string }[], kills: number, now = Date.now()) {
    const dd: any = (DUNGEONS as any)[dungeon]; const f = factionOfDungeon(dd); if (!f) return []; const d = districtOfDungeon(dungeon); const evs: CityEv[] = [];
    for (const m of members) evs.push({ k: GATEWAY_BY_DUNGEON[dungeon] ? 'gateway' : 'clear', d, f, w: 1, who: m.id });
    if (kills > 0) evs.push({ k: 'kill', d, f, n: Math.min(kills, 300), w: 1 }); return this.apply(evs, now);
  }
  private claimer(id: string, now: number) { let c = this.cl.get(id); if (!c) { c = { tokens: CLAIM.perMin, last: now, day: today(), n: 0, run: null, lastClear: 0 }; this.cl.set(id, c); } c.tokens = Math.min(CLAIM.perMin, c.tokens + (now - c.last) / 60e3 * CLAIM.perMin); c.last = now; if (c.day !== today()) { c.day = today(); c.n = 0; } return c; }
  /** client-claimed event (solo runs, hacks, speech). Rate-limited, sanity-checked, low weight. Returns ok/why (never thrown, never blocks). */
  claim(guest: string, m: any, ctx: { inRoom?: string | null } = {}, now = Date.now()): { ok: boolean; why?: string } {
    const no = (why: string) => { this.stats.rejected++; return { ok: false, why }; }; if (!m || typeof m !== 'object') return no('bad');
    const c = this.claimer(guest, now); const k = String(m.k || ''); const dungeon = String(m.dungeon || ''); const dd: any = (DUNGEONS as any)[dungeon];
    if (k === 'run') { if (!dd) return no('dungeon'); c.run = { id: String(m.run || '').slice(0, 32), at: now, hack: 0, speech: 0, cleared: false }; return { ok: true }; }
    if (!dd || !c.run) return no('norun'); if (c.tokens < 1) return no('rate'); if (c.n >= CLAIM.perDay) return no('daily');
    const f0 = factionOfDungeon(dd); const fArg = (FACTIONS as readonly string[]).includes(m.f) ? m.f as Faction : f0; if (!fArg) return no('faction'); const d = districtOfDungeon(dungeon);
    let ev: CityEv | null = null;
    if (k === 'hack') { if (++c.run.hack > CLAIM.hackPerRun) return no('cap'); ev = { k: 'hack', d, f: fArg, w: CLAIM.claimW }; }
    else if (k === 'speech') { if (++c.run.speech > CLAIM.speechPerRun) return no('cap'); ev = { k: 'speech', d, f: fArg, ok: !!m.ok, w: CLAIM.claimW }; }
    else if (k === 'clear') { if (ctx.inRoom) return no('arbitrated'); /* party clears come from the hub, never from claims */ if (c.run.cleared || now - c.run.at < CLAIM.soloMinRunMs || now - c.lastClear < CLAIM.soloClearGapMs) return no('timing'); c.run.cleared = true; c.lastClear = now;
      const kills = Math.max(0, Math.min(+m.kills || 0, 80)); this.apply([{ k: GATEWAY_BY_DUNGEON[dungeon] ? 'gateway' : 'clear', d, f: f0 || fArg, w: CLAIM.soloW, who: guest }, ...(kills ? [{ k: 'kill' as const, d, f: f0 || fArg, n: kills, w: CLAIM.soloW }] : [])], now); }
    else if (k === 'nem') { if (c.run.nem) return no('cap'); c.run.nem = true; ev = { k: 'nem', d, f: f0 || fArg, w: CLAIM.claimW, who: guest }; } // one nemesis kill per run counts (docs/CITY_MEMORY.md)
    else return no('kind');
    if (ev) this.apply([ev], now); c.tokens--; c.n++; this.stats.accepted++; return { ok: true };
  }
  /** privacy: names appear in the news only for players who opted in (Settings > Privacy). Opting out removes the name from this and last week. */
  setPublic(guest: string, name: string, pub: boolean) { notePlayer(this.s, guest, pub ? name : null); }
  tick(now = Date.now()) { decay(this.s, now); }
  /** diff for shard broadcast: only changed districts, or null. Caller throttles (CITY_SYNC_MS). */
  takeDiff(): any | null { if (!this.pending.size) return null; const w = toWire(this.s, [...this.pending]); this.pending.clear(); return { t: 'city', ...w, p: 1 }; }
  full() { return { t: 'city', ...toWire(this.s) }; }
  async persist() { if (!this.dirty || !this.store) return; this.dirty = false; try { await this.store.save({ ...this.s, names: CITY_NAMES } as any); this.stats.saves++; } catch (e) { this.dirty = true; this.stats.saveErr++; } }
  /** latest Lambda-written feed; until one exists (dev, first week) a canned feed from this week's real data so the panel is never empty */
  async refreshNews() { try { const n = await this.store?.news(); if (n) { this.news = n; return; } } catch {} if (!this.news || this.news.local) { const s: any = { ...this.s, prev: this.s.prev || this.s.week }; this.news = { ...(await generateNews(s, CITY_NAMES, null)), local: true }; } }
}
export const CITY_SYNC_MS = 30e3, CITY_SAVE_MS = 60e3, CITY_NEWS_MS = 10 * 60e3;
