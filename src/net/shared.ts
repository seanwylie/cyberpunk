// Shared (client + server) multiplayer protocol, constants and pure movement/rng helpers. No DOM, no Game import.
import type { Level } from '../level';
import { COMBAT } from '../config';

/** Wire protocol version. v2 = client-authoritative gameplay (v1 was the per-tick authoritative server sim). The server refuses any other value with err code 'version'. */
export const PROTO = 2;
export const STATE_HZ = 8;             // display-state relay rate (position/facing/hp/anim), client -> server -> party
export const DMG_FLUSH_MS = 125;       // damage-dealt batches
export const MAX_MOVE_SPEED = COMBAT.playerSpeed * 3;  // tiles/s: generous (speed buffs, lunges); anything above is a teleport
export const MOVE_BUDGET = 16;          // tiles of burst allowance (blinks, dodges, lag catch-up)
export const SHARED_FLAGS = ['gate1', 'lock2', 'controller', 'armory', 'passageSeen', 'cond', 'bossKey', 'bossSpawned', 'alarm', 'salvageForeman'] as const;
export const TICK_HZ = 20;                // legacy v1 authoritative tick (only the legacy PartyWorld test core uses it)
export const TICK_DT = 1 / TICK_HZ;
export const MAX_PARTY = 4;
export const TOWN_SHARD_CAP = 30;
export const TOWN_HZ = 10;
export const INTERP_DELAY = 0.12;         // seconds remote entities are rendered behind the newest snapshot
export const CHAT_MAX = 140;
export const NAME_MAX = 16;

export interface Look { body?: Record<string, string>; cos?: string[]; tint?: string; /** purple/orange hardware for the scaled-down gear FX: 'slot:o' | 'slot:p' */ gear?: string[]; /** exclusives owned: [cosmetic id, acquired ms] */ ex?: [string, number][]; /** pinned showcase exclusive */ sc?: string }
export type Dungeon = string;

/** client -> server, once per client tick (20 Hz) while in an instance */
export interface InputMsg { t: 'input'; seq: number; mx: number; my: number; atk: boolean; face: number; revive?: boolean; /** discrete actions (cast/dodge/vent/stim/use/dlg) validated + rate limited by the server */ acts?: any[] }

export interface PlayerView { id: string; name: string; x: number; y: number; face: number; hp: number; maxHp: number; down: boolean; moving: boolean; atk: boolean; look?: Look; lvl: number }
export interface EnemyView { id: number; type: string; x: number; y: number; hp: number; maxHp: number; face: number; boss?: boolean; atk?: boolean; ally?: boolean; sh?: number; rv?: boolean; aff?: string[] }
/** the receiving player's own combat state (real Game values from the server) */
export interface YouView extends PlayerView { heat: number; oh: boolean; cd: number[]; dcd: number; vcd: number; stims: number; spd: number; ab: (string | null)[]; cast: { i: number; t: number; w: number } | null; rv: number; prompt: string | null; ch: number | null; bro: number }
export interface DropView { id: number; x: number; y: number; kind: 'item' | 'chip' | 'stim' | 'credits'; item?: string; chip?: string; amount: number }
export interface SnapMsg {
  t: 'snap'; tick: number; ack: number; you: YouView; players: PlayerView[]; enemies: EnemyView[]; drops: DropView[];
  flags: { bossSpawned: boolean; bossDead: boolean; completed: boolean; kills: number; total: number; wipeT: number; gate1?: boolean; lock2?: boolean; controller?: boolean; bossKey?: string | null; cond?: string | null };
  ev?: any[];
}
export interface PartyMember { id: string; name: string; ready: boolean; leader: boolean; lvl: number; look?: Look }
export interface PartyState { t: 'party'; code: string; members: PartyMember[]; dungeon: string | null; inInstance: boolean }

/** Deterministic mulberry32 */
export function rng32(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hash32(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Party scaling (server authoritative, shown to players in the party panel). */
export const partyHpMul = (n: number) => 1 + 0.65 * (Math.max(1, n) - 1);
export const partyDmgMul = (n: number) => 1 + 0.2 * (Math.max(1, n) - 1);

/** Open every door so a party can reach the boss (phase 1 simplification: gate/lock puzzles are not networked yet). */

const solidAt = (lv: Level, ix: number, iy: number) => ix < 0 || iy < 0 || ix >= lv.w || iy >= lv.h || lv.solid[iy * lv.w + ix] === 1;
export function circleHits(lv: Level, x: number, y: number, r: number): boolean {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
  for (let iy = y0; iy <= y1; iy++) for (let ix = x0; ix <= x1; ix++) { if (!solidAt(lv, ix, iy)) continue; const cx = Math.max(ix, Math.min(x, ix + 1)), cy = Math.max(iy, Math.min(y, iy + 1)); if ((x - cx) ** 2 + (y - cy) ** 2 < r * r - 1e-6) return true; }
  return false;
}
/** axis-separated circle move with sub-stepping; identical on client (prediction) and server (authority) */
export function moveCircle(lv: Level, x: number, y: number, dx: number, dy: number, r: number) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / .3)); let cx = x, cy = y;
  for (let i = 0; i < n; i++) { let nx = cx + dx / n; if (circleHits(lv, nx, cy, r)) nx = cx; let ny = cy + dy / n; if (circleHits(lv, nx, ny, r)) ny = cy; cx = nx; cy = ny; }
  return { x: cx, y: cy };
}
/** One fixed-step player move. Input direction is clamped to unit length; speed is the fixed base speed (never client supplied). */
export function stepPlayer(lv: Level, p: { x: number; y: number }, mx: number, my: number, dt = TICK_DT, spd = COMBAT.playerSpeed) {
  if (!Number.isFinite(mx) || !Number.isFinite(my)) { mx = 0; my = 0; }
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  const q = moveCircle(lv, p.x, p.y, mx * spd * dt, my * spd * dt, COMBAT.playerRadius); p.x = q.x; p.y = q.y;
}
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const r2 = (v: number) => Math.round(v * 100) / 100;
/** names: printable, trimmed, bounded */
export function cleanName(s: any, fallback = 'Guest'): string { const t = String(s ?? '').replace(/[^\p{L}\p{N} _\-.']/gu, '').trim().slice(0, NAME_MAX); return t || fallback; }
export function cleanChat(s: any): string { return String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, CHAT_MAX); }
export function cleanLook(l: any): Look | undefined {
  if (!l || typeof l !== 'object') return undefined; const o: Look = {};
  if (l.body && typeof l.body === 'object') { o.body = {}; for (const k of Object.keys(l.body).slice(0, 12)) { const v = String(l.body[k]).slice(0, 24); o.body[String(k).slice(0, 16)] = v; } }
  if (Array.isArray(l.cos)) o.cos = l.cos.slice(0, 16).map((c: any) => String(c).slice(0, 32));
  if (Array.isArray(l.ex)) o.ex = l.ex.slice(0, 8).filter((e: any) => Array.isArray(e)).map((e: any) => [String(e[0]).slice(0, 40), Math.max(0, Math.floor(+e[1]) || 0)] as [string, number]);
  if (typeof l.sc === 'string') o.sc = l.sc.slice(0, 40);
  if (Array.isArray(l.gear)) o.gear = l.gear.slice(0, 11).map((g: any) => String(g).slice(0, 8)).filter((g: string) => /^[a-zA-Z]{4,6}:[op]$/.test(g));
  if (typeof l.tint === 'string' && /^#[0-9a-f]{6}$/i.test(l.tint)) o.tint = l.tint;
  return o;
}
