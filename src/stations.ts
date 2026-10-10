// Town station registry: one source of truth for where each function lives, its colour, icon, label and interact prompt.
// Used by the level builder (layout), the town renderer (signs, decals, labels, offscreen arrows), the minimap and the tests.
export type StationId = 'jobs' | 'implants' | 'locker' | 'gate' | 'store' | 'repair';
export interface Station {
  key: StationId; id: string; /** interact id (what opens) */ opens: string; name: string; short: string; verb: string; color: string; rgb: string; icon: StationId;
  /** interact point (walkable, in front of the landmark) */ x: number; y: number; /** landmark anchor tile (top-left of the focal prop) */ lx: number; ly: number; /** sign tile */ sx: number; sy: number; kind: 'npc' | 'vendor' | 'locker' | 'gate' | 'terminal';
  ambient: 'screens' | 'sparks' | 'scan' | 'beacon' | 'neon' | 'weld';
}
export const TOWN_W = 60, TOWN_H = 44, TOWN_CX = 30, TOWN_CY = 22;
export const SPAWN = { x: 30.5, y: 22.5 }, RETURN_SPAWN = { x: 49.5, y: 22.5 };
export const STATIONS: Station[] = [
  { key: 'jobs', id: 'fixer', opens: 'fixer', name: 'Job Board', short: 'JOBS', verb: 'browse contracts', color: '#ffb02e', rgb: '255,176,46', icon: 'jobs', x: 15, y: 13.2, lx: 11, ly: 8, sx: 13, sy: 9, kind: 'npc', ambient: 'screens' },
  { key: 'implants', id: 'vendor', opens: 'vendor', name: 'Implant Parts', short: 'IMPLANTS', verb: 'buy augments', color: '#38d8ff', rgb: '56,216,255', icon: 'implants', x: 41.5, y: 12.2, lx: 38, ly: 7, sx: 41, sy: 9, kind: 'vendor', ambient: 'sparks' },
  { key: 'gate', id: 'annex', opens: 'annex', name: 'Dungeon Gate', short: 'GATE', verb: 'enter a dungeon', color: '#ff4455', rgb: '255,68,85', icon: 'gate', x: 52.5, y: 22.5, lx: 54, ly: 21, sx: 52, sy: 19, kind: 'gate', ambient: 'beacon' },
  { key: 'repair', id: 'repair', opens: 'vendor', name: 'Repair Bay', short: 'REPAIR', verb: 'fix damaged gear', color: '#a58bff', rgb: '165,139,255', icon: 'repair', x: 45, y: 32.6, lx: 44, ly: 34, sx: 42, sy: 33, kind: 'vendor', ambient: 'weld' },
  { key: 'locker', id: 'locker', opens: 'locker', name: 'Locker', short: 'LOCKER', verb: 'swap gear and chips', color: '#46e08a', rgb: '70,224,138', icon: 'locker', x: 30, y: 35.2, lx: 28, ly: 37, sx: 27, sy: 35, kind: 'locker', ambient: 'scan' },
  { key: 'store', id: 'store', opens: 'store', name: 'Outfitter', short: 'STORE', verb: 'shop (simulated)', color: '#ff5cc8', rgb: '255,92,200', icon: 'store', x: 12.5, y: 30.6, lx: 9, ly: 32, sx: 9, sy: 30, kind: 'terminal', ambient: 'neon' },
];
export const STATION_BY_ID: Record<string, Station> = Object.fromEntries(STATIONS.map(s => [s.id, s]));
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
    case 'repair': c.rotate(-Math.PI / 4); c.beginPath(); c.moveTo(0, -s * .1); c.lineTo(0, s * .95); c.stroke(); c.beginPath(); c.arc(0, -s * .45, s * .42, Math.PI * .8, Math.PI * .2, false); c.stroke(); c.beginPath(); c.moveTo(-s * .3, -s * .1); c.lineTo(s * .3, -s * .1); c.stroke(); break;
  }
  c.restore();
}
