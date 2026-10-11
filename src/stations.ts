// Town station registry: one source of truth for where each function lives, its colour, icon, label and interact prompt.
// Used by the level builder (layout), the town renderer (signs, decals, labels, offscreen arrows), the minimap and the tests.
export type StationId = 'jobs' | 'implants' | 'locker' | 'gate' | 'store' | 'repair' | 'bank' | (string & {});
export interface Station {
  key: StationId; id: string; /** interact id (what opens) */ opens: string; name: string; short: string; verb: string; color: string; rgb: string; icon: StationId;
  /** interact point (walkable, in front of the landmark) */ x: number; y: number; /** landmark anchor tile (top-left of the focal prop) */ lx: number; ly: number; /** sign tile */ sx: number; sy: number; kind: 'npc' | 'vendor' | 'locker' | 'gate' | 'terminal';
  ambient: 'screens' | 'sparks' | 'scan' | 'beacon' | 'neon' | 'weld' | 'vault';
}
export const TOWN_W = 60, TOWN_H = 44, TOWN_CX = 30, TOWN_CY = 22;
export const SPAWN = { x: 30.5, y: 22.5 }, RETURN_SPAWN = { x: 49.5, y: 22.5 };
export const RUSTLINE_STATIONS: Station[] = [
  { key: 'jobs', id: 'fixer', opens: 'fixer', name: 'Job Board', short: 'JOBS', verb: 'browse contracts', color: '#ffb02e', rgb: '255,176,46', icon: 'jobs', x: 15, y: 13.2, lx: 11, ly: 8, sx: 13, sy: 9, kind: 'npc', ambient: 'screens' },
  { key: 'implants', id: 'vendor', opens: 'vendor', name: 'Implant Parts', short: 'IMPLANTS', verb: 'buy augments', color: '#38d8ff', rgb: '56,216,255', icon: 'implants', x: 41.5, y: 12.2, lx: 38, ly: 7, sx: 41, sy: 9, kind: 'vendor', ambient: 'sparks' },
  { key: 'gate', id: 'annex', opens: 'annex', name: 'Dungeon Gate', short: 'GATE', verb: 'enter a dungeon', color: '#ff4455', rgb: '255,68,85', icon: 'gate', x: 52.5, y: 22.5, lx: 54, ly: 21, sx: 52, sy: 19, kind: 'gate', ambient: 'beacon' },
  { key: 'repair', id: 'repair', opens: 'vendor', name: 'Repair Bay', short: 'REPAIR', verb: 'fix damaged gear', color: '#a58bff', rgb: '165,139,255', icon: 'repair', x: 45, y: 32.6, lx: 44, ly: 34, sx: 42, sy: 33, kind: 'vendor', ambient: 'weld' },
  { key: 'locker', id: 'locker', opens: 'locker', name: 'Locker', short: 'LOCKER', verb: 'swap gear and chips', color: '#46e08a', rgb: '70,224,138', icon: 'locker', x: 30, y: 35.2, lx: 28, ly: 37, sx: 27, sy: 35, kind: 'locker', ambient: 'scan' },
  { key: 'store', id: 'store', opens: 'store', name: 'Outfitter', short: 'STORE', verb: 'shop (simulated)', color: '#ff5cc8', rgb: '255,92,200', icon: 'store', x: 12.5, y: 30.6, lx: 9, ly: 32, sx: 9, sy: 30, kind: 'terminal', ambient: 'neon' },
  { key: 'bank', id: 'bank', opens: 'bank', name: 'Bank', short: 'BANK', verb: 'store gear and credits', color: '#e8c45a', rgb: '232,196,90', icon: 'bank', x: 30, y: 8.6, lx: 28, ly: 4, sx: 25, sy: 7, kind: 'terminal', ambient: 'vault' },
  { key: 'transit', id: 'transit', opens: 'travel', name: 'Reach Line', short: 'TRANSIT', verb: 'travel to other towns', color: '#ff8f3a', rgb: '255,143,58', icon: 'transit', x: 32.5, y: 20.2, lx: 32, ly: 16, sx: 35, sy: 19, kind: 'terminal', ambient: 'beacon' },
];
/** Active town's stations. Mutated IN PLACE by setTownStations() so every consumer (minimap, markers, prompts) follows the current town. */
export const STATIONS: Station[] = [...RUSTLINE_STATIONS];
export const STATION_BY_ID: Record<string, Station> = Object.fromEntries(STATIONS.map(s => [s.id, s]));
export function setTownStations(list: Station[]) { if (STATIONS.length === list.length && STATIONS.every((s, i) => s === list[i])) return; STATIONS.splice(0, STATIONS.length, ...list); for (const k of Object.keys(STATION_BY_ID)) delete STATION_BY_ID[k]; for (const s of STATIONS) STATION_BY_ID[s.id] = s; }
/** Harrow Reach (town 2): 76x54, eight stations on a ring, all 11+ tiles apart. Keys/ids are prefixed h_ so both towns can coexist in the registry types. */
export const HARROW_W = 76, HARROW_H = 54, HARROW_CX = 38, HARROW_CY = 27;
export const HARROW_SPAWN = { x: 18.5, y: 27.5 }, HARROW_RETURN_SPAWN = { x: 59.5, y: 27.5 };
export const HARROW_STATIONS: Station[] = [
  { key: 'h_transit', id: 'h_transit', opens: 'travel', name: 'Reach Line', short: 'TRANSIT', verb: 'ride back to Rustline', color: '#ff8f3a', rgb: '255,143,58', icon: 'transit', x: 13.5, y: 27.5, lx: 8, ly: 21, sx: 6, sy: 25, kind: 'terminal', ambient: 'beacon' },
  { key: 'h_jobs', id: 'h_jobs', opens: 'fixer', name: 'Job Board', short: 'JOBS', verb: 'foundry contracts', color: '#ffb02e', rgb: '255,176,46', icon: 'jobs', x: 22, y: 12, lx: 18, ly: 6.5, sx: 20, sy: 9, kind: 'npc', ambient: 'screens' },
  { key: 'h_bank', id: 'h_bank', opens: 'bank', name: 'Bank', short: 'BANK', verb: 'Reach branch', color: '#e8c45a', rgb: '232,196,90', icon: 'bank', x: 38, y: 9, lx: 36, ly: 4.5, sx: 33, sy: 7.5, kind: 'terminal', ambient: 'vault' },
  { key: 'h_parts', id: 'h_parts', opens: 'vendor', name: 'Heavy Works Parts', short: 'PARTS', verb: 'tier hardware', color: '#38d8ff', rgb: '56,216,255', icon: 'implants', x: 54.5, y: 12, lx: 50, ly: 6, sx: 53, sy: 9.5, kind: 'vendor', ambient: 'sparks' },
  { key: 'h_gate', id: 'annex', opens: 'annex', name: 'Dungeon Gate', short: 'GATE', verb: 'tier I to IV dungeons', color: '#ff4455', rgb: '255,68,85', icon: 'gate', x: 64, y: 27.5, lx: 66, ly: 26, sx: 64, sy: 23.5, kind: 'gate', ambient: 'beacon' },
  { key: 'h_repair', id: 'h_repair', opens: 'vendor', name: 'Forge Repair', short: 'FORGE', verb: 'repair and reforge', color: '#a58bff', rgb: '165,139,255', icon: 'repair', x: 55, y: 42, lx: 54, ly: 44, sx: 51, sy: 41, kind: 'vendor', ambient: 'weld' },
  { key: 'h_locker', id: 'h_locker', opens: 'locker', name: 'Locker', short: 'LOCKER', verb: 'swap gear and chips', color: '#46e08a', rgb: '70,224,138', icon: 'locker', x: 38, y: 46, lx: 36, ly: 48, sx: 33, sy: 45, kind: 'locker', ambient: 'scan' },
  { key: 'h_guild', id: 'h_guild', opens: 'guild', name: 'Guild Counter', short: 'GUILD', verb: 'reclaimed chips', color: '#ff5cc8', rgb: '255,92,200', icon: 'guild', x: 21.5, y: 42, lx: 17, ly: 43.5, sx: 20, sy: 40, kind: 'vendor', ambient: 'neon' },
];
export const TOWN_STATIONS: Record<string, Station[]> = { rustline: RUSTLINE_STATIONS, harrow: HARROW_STATIONS };
export const stationPrompt = (s: Station) => `${s.name}: ${s.verb}`;
/** minimum allowed distance between any two station interact points */
export const MIN_STATION_DIST = 11;

/** shared icon language (HUD labels, minimap, world signs, offscreen arrows). Draws into a box centred at (x,y) with half-size r. */
export function drawIcon(c: CanvasRenderingContext2D, icon: StationId, x: number, y: number, r: number, col: string, lw = Math.max(1.4, r * .16)) {
  c.save(); c.translate(x, y); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; const s = r;
  switch (icon) {
    case 'jobs': c.strokeRect(-s * .62, -s * .8, s * 1.24, s * 1.6); c.beginPath(); c.moveTo(-s * .3, -s * .35); c.lineTo(s * .3, -s * .35); c.moveTo(-s * .3, 0); c.lineTo(s * .3, 0); c.moveTo(-s * .3, s * .35); c.lineTo(s * .1, s * .35); c.stroke(); c.fillRect(-s * .22, -s * .95, s * .44, s * .3); break;
    case 'implants': c.strokeRect(-s * .5, -s * .5, s, s); for (const u of [-.3, 0, .3]) { c.beginPath(); c.moveTo(u * s, -s * .5); c.lineTo(u * s, -s * .9); c.moveTo(u * s, s * .5); c.lineTo(u * s, s * .9); c.moveTo(-s * .5, u * s); c.lineTo(-s * .9, u * s); c.moveTo(s * .5, u * s); c.lineTo(s * .9, u * s); c.stroke(); } c.fillRect(-s * .2, -s * .2, s * .4, s * .4); break;
    case 'locker': c.strokeRect(-s * .7, -s * .85, s * 1.4, s * 1.7); c.beginPath(); c.moveTo(0, -s * .85); c.lineTo(0, s * .85); c.stroke(); c.fillRect(-s * .3, -s * .1, s * .14, s * .3); c.fillRect(s * .16, -s * .1, s * .14, s * .3); break;
    case 'gate': c.beginPath(); c.moveTo(-s * .8, s * .85); c.lineTo(-s * .8, -s * .1); c.arc(0, -s * .1, s * .8, Math.PI, 0); c.lineTo(s * .8, s * .85); c.stroke(); c.beginPath(); c.moveTo(-s * .3, s * .2); c.lineTo(0, -s * .15); c.lineTo(s * .3, s * .2); c.moveTo(-s * .3, s * .65); c.lineTo(0, s * .3); c.lineTo(s * .3, s * .65); c.stroke(); break;
    case 'store': c.beginPath(); c.moveTo(-s * .7, -s * .35); c.lineTo(s * .7, -s * .35); c.lineTo(s * .55, s * .85); c.lineTo(-s * .55, s * .85); c.closePath(); c.stroke(); c.beginPath(); c.arc(0, -s * .35, s * .38, Math.PI, 0); c.stroke(); break;
    case 'bank': c.beginPath(); c.arc(0, 0, s * .82, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, s * .42, 0, 7); c.stroke(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.beginPath(); c.moveTo(Math.cos(a) * s * .42, Math.sin(a) * s * .42); c.lineTo(Math.cos(a) * s * .82, Math.sin(a) * s * .82); c.stroke(); } c.beginPath(); c.arc(0, 0, s * .12, 0, 7); c.fill(); break;
    case 'transit': c.strokeRect(-s * .8, -s * .55, s * 1.6, s * 1.0); c.beginPath(); c.moveTo(-s * .8, -s * .1); c.lineTo(s * .8, -s * .1); c.moveTo(-s * .45, s * .45); c.lineTo(-s * .45, s * .8); c.moveTo(s * .45, s * .45); c.lineTo(s * .45, s * .8); c.moveTo(-s * .9, s * .85); c.lineTo(s * .9, s * .85); c.stroke(); c.fillRect(-s * .6, -s * .4, s * .4, s * .22); c.fillRect(s * .2, -s * .4, s * .4, s * .22); break;
    case 'guild': c.beginPath(); c.moveTo(0, -s * .9); c.lineTo(s * .75, -s * .45); c.lineTo(s * .75, s * .25); c.lineTo(0, s * .9); c.lineTo(-s * .75, s * .25); c.lineTo(-s * .75, -s * .45); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(-s * .35, s * .25); c.lineTo(0, -s * .35); c.lineTo(s * .35, s * .25); c.stroke(); break;
    case 'repair': c.rotate(-Math.PI / 4); c.beginPath(); c.moveTo(0, -s * .1); c.lineTo(0, s * .95); c.stroke(); c.beginPath(); c.arc(0, -s * .45, s * .42, Math.PI * .8, Math.PI * .2, false); c.stroke(); c.beginPath(); c.moveTo(-s * .3, -s * .1); c.lineTo(s * .3, -s * .1); c.stroke(); break;
  }
  c.restore();
}
