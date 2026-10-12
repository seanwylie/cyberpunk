// Data-driven town generator (docs/WORLD.md). Builds a safe-hub Level for every WORLD district that has a `gen` template:
// walkable footprint by shape, stations on a ring around a central plaza (pad in front of the focal prop, so labels/rings align the same
// way as Rustline/Harrow), carved lanes from the plaza to every pad, perimeter buildings from the district's prop family, a landmark vista,
// neon signage, crowds, elite NPCs and slow-pulsing lights. Deterministic per town seed. Unreachable pockets are filled solid at the end.
import type { Level, Decor, NpcDef, LightDef, Interact, Overhead } from './level';
import { ZONES } from './level';
import { stationPrompt, type Station } from './stations';
import { WORLD_BY_ID, type WorldTown, type StationKind } from './world';
import type { TownCfg } from './town';

const rr = (s: number) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
/** focal prop per station kind: [sprite, fw, fd, sw] */
const FOCAL: Record<StationKind, [string, number, number, number]> = {
  transit: ['tram_platform', 5, 2, 5.6], jobs: ['board_jobs', 2, 2, 3.6], vendor: ['stall_implant', 3, 3, 4.4], repair: ['workbench', 2, 2, 3.4],
  bank: ['bank_vault', 4, 3, 5.4], locker: ['lockers', 1, 2, 1.8], store: ['stall_clothes', 3, 3, 3.5], gate: ['gate_arch', 3, 1, 4.6],
};
const META: Record<StationKind, { opens: string; name: string; short: string; verb: string; color: string; rgb: string; icon: string; kind: Station['kind']; ambient: Station['ambient'] }> = {
  transit: { opens: 'travel', name: 'Reach Line', short: 'TRANSIT', verb: 'travel to other towns', color: '#a0e632', rgb: '160,230,50', icon: 'transit', kind: 'terminal', ambient: 'beacon' },
  jobs: { opens: 'fixer', name: 'Job Board', short: 'JOBS', verb: 'browse contracts', color: '#ffb02e', rgb: '255,176,46', icon: 'jobs', kind: 'npc', ambient: 'screens' },
  vendor: { opens: 'vendor', name: 'Parts Vendor', short: 'PARTS', verb: 'buy augments', color: '#38d8ff', rgb: '56,216,255', icon: 'implants', kind: 'vendor', ambient: 'sparks' },
  repair: { opens: 'vendor', name: 'Repair Bay', short: 'REPAIR', verb: 'fix damaged gear', color: '#a58bff', rgb: '165,139,255', icon: 'repair', kind: 'vendor', ambient: 'weld' },
  bank: { opens: 'bank', name: 'Bank', short: 'BANK', verb: 'store gear and credits', color: '#f2ecc4', rgb: '242,236,196', icon: 'bank', kind: 'terminal', ambient: 'vault' },
  locker: { opens: 'locker', name: 'Locker', short: 'LOCKER', verb: 'swap gear and chips', color: '#46e08a', rgb: '70,224,138', icon: 'locker', kind: 'locker', ambient: 'scan' },
  store: { opens: 'store', name: 'Outfitter', short: 'STORE', verb: 'shop (simulated)', color: '#ff5cc8', rgb: '255,92,200', icon: 'store', kind: 'terminal', ambient: 'neon' },
  gate: { opens: 'annex', name: 'Dungeon Gate', short: 'GATE', verb: 'enter a dungeon', color: '#ff4455', rgb: '255,68,85', icon: 'gate', kind: 'gate', ambient: 'beacon' },
};
const hubOf = (t: WorldTown) => [Math.floor(t.gen!.w / 2), Math.floor(t.gen!.h / 2)] as const;
const radii = (t: WorldTown) => { const g = t.gen!; return { rx: g.w / 2 - 6, ry: g.h / 2 - 6 }; };
const stCache: Record<string, Station[]> = {};
/** deterministic station list for a generated town (also used by the stations registry before the level is built) */
import { cityDecor } from './cityclient';
/** controlling-faction signs (coloured in the faction colour) shown first when someone other than the home faction holds the district */
function cityNeon(id: string): [string, string][] { const d = cityDecor(id), t = WORLD_BY_ID[id]; if (!d || !t || d.color === undefined) return []; return d.signs[0] && !t.gen?.signage.includes(d.signs[0]) ? d.signs.map(x => [x, d.color] as [string, string]) : []; }
export function genStations(id: string): Station[] {
  if (stCache[id]) return stCache[id]; const t = WORLD_BY_ID[id], g = t.gen!; const [CX, CY] = hubOf(t); const { rx, ry } = radii(t); const R = rr(g.seed);
  const n = g.stations.length, off = R() * Math.PI * 2; const out: Station[] = [];
  g.stations.forEach((k, i) => { const a = off + i / n * Math.PI * 2; const [, fw, fd] = FOCAL[k]; const px = CX + Math.cos(a) * rx * .74, py = CY + Math.sin(a) * ry * .72;
    const lx = Math.round(px - fw / 2 - .9), ly = Math.round(py - fd - .9); const x = lx + fw / 2 + .9, y = ly + fd + .9; const m = META[k];
    const key = `${id}_${k}`; out.push({ key, id: k === 'gate' ? 'annex' : key, opens: m.opens, name: k === 'transit' ? 'Reach Line' : m.name, short: m.short, verb: m.verb, color: m.color, rgb: m.rgb, icon: m.icon, x, y, lx, ly, sx: lx - 2, sy: ly + fd - 1, kind: m.kind, ambient: m.ambient }); });
  return (stCache[id] = out);
}
export const kindOfStation = (s: Station): StationKind | null => { const k = s.key.split('_').pop() as StationKind; return k in FOCAL ? k : null; };

/** TownArt config for a generated district: shared prop families (Rustline + Harrow) recoloured per district, district ground set and lamp colour */
export function genCfg(id: string): TownCfg {
  const t = WORLD_BY_ID[id], g = t.gen!; const st = genStations(id); const [CX, CY] = hubOf(t);
  const props = new Set<string>(['npc1', 'npc2', 'npc3', 'npc4', 'np_kneel_l', 'np_kneel_r', 'np_pair_talk', 'np_guard_l', 'np_guard_r', 'np_porter', 'np_hooded_wall', 'np_lantern_l', 'np_lantern_r', 'np_kid_l', 'np_kid_r', 'lamp', 'awn_red', 'awn_blue', 'swag1', 'swag2', 'bulbs', 'fixer_booth', 'noticeboard', 'steam_drums', 'crates', 'barrels', 'barrier', 'vending']);
  for (const k of g.stations) props.add(FOCAL[k][0]); for (const p of g.perimeter) props.add(p[0]); for (const p of g.hub) props.add(p[0]); props.add(g.landmark.spr); props.delete('bank_vault');
  return { stations: st, hub: [CX + .5, CY + .5], props: [...props], ground: [...new Set([g.ground.base, g.ground.planks, g.ground.plaza, g.ground.debris || g.ground.base])], fallbackBase: './town2/', puddles: g.puddles, plazaSize: 18,
    g: { base: g.ground.base, planks: g.ground.planks, plaza: g.ground.plaza, debris: g.ground.debris || 'none' }, recolor: g.recolor, theme: id, lamp: g.lamp, neon: [...cityNeon(id), ...g.signage].map(s => (typeof s === 'string' ? [s, t.color] : s) as [string, string]) } as TownCfg;
}

export function buildGenTown(id: string): Level {
  const t = WORLD_BY_ID[id], g = t.gen!; const w = g.w, h = g.h; const [CX, CY] = hubOf(t); const { rx, ry } = radii(t); const R = rr(g.seed * 7 + 3);
  const solid = new Uint8Array(w * h).fill(1), zone = new Uint8Array(w * h).fill(ZONES.indexOf('town')), hide = new Uint8Array(w * h), keep = new Uint8Array(w * h);
  const inside = (x: number, y: number) => x >= 2 && y >= 2 && x < w - 2 && y < h - 2;
  const edge = (a: number) => 1 + .06 * Math.sin(a * 3 + g.seed) + .04 * Math.sin(a * 5 + 1.3 * g.seed);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!inside(x, y)) continue; const dx = (x + .5 - CX) / (rx + 3), dy = (y + .5 - CY) / (ry + 3); const n = edge(Math.atan2(dy, dx)); let open = dx * dx + dy * dy < n * n;
    if (g.shape === 'long') open = Math.abs(dy) < .78 * n && Math.abs(dx) < .98;
    if (g.shape === 'cross') open = (Math.abs(dx) < .95 && Math.abs(dy) < .42) || (Math.abs(dx) < .42 && Math.abs(dy) < .95) || dx * dx + dy * dy < .55;
    if (g.shape === 'terrace' && open) { const band = Math.floor((y - 2) / 7); if ((y - 2) % 7 === 0 && band > 0 && Math.abs(x - CX) > 4 && ((x + band * 5) % 13) > 3) open = false; } // ledge walls with stair gaps
    if (open) solid[y * w + x] = 0; }
  const carve = (x0: number, y0: number, x1: number, y1: number, k = true) => { for (let y = Math.max(2, Math.floor(y0)); y <= Math.min(h - 3, Math.floor(y1)); y++) for (let x = Math.max(2, Math.floor(x0)); x <= Math.min(w - 3, Math.floor(x1)); x++) { solid[y * w + x] = 0; if (k) keep[y * w + x] = 1; } };
  const ST = genStations(id); carve(CX - 5, CY - 4, CX + 5, CY + 4);
  for (const s of ST) { const [, fw, fd] = FOCAL[kindOfStation(s)!]; carve(s.lx - 4, s.ly - 2, s.lx + fw + 4, s.ly + fd + 4);
    // lane: three tiles wide from the plaza to the pad
    const n = Math.ceil(Math.hypot(s.x - CX, s.y - CY) * 2); for (let i = 0; i <= n; i++) { const u = i / n, x = CX + (s.x - CX) * u, y = CY + (s.y - CY) * u; carve(x - 1.5, y - 1.5, x + 1.5, y + 1.5); } }
  const decor: Decor[] = [];
  const D = (spr: string, x: number, y: number, fw: number, fd: number, sw: number, o: Partial<Decor> = {}) => { decor.push({ spr, x, y, fw, fd, sw, solid: true, ...o }); if (o.solid !== false) for (let j = 0; j < fd; j++) for (let i = 0; i < fw; i++) { const xx = Math.floor(x) + i, yy = Math.floor(y) + j; if (yy < h && xx < w && yy >= 0 && xx >= 0) { solid[yy * w + xx] = 1; hide[yy * w + xx] = 1; } } };
  const freeWalk = (x: number, y: number, fw: number, fd: number, pad = 1) => { for (let j = -pad; j < fd + pad; j++) for (let i = -pad; i < fw + pad; i++) { const xx = x + i, yy = y + j; if (xx < 2 || yy < 2 || xx >= w - 2 || yy >= h - 2) return false; const k = yy * w + xx; if (solid[k] || keep[k] || hide[k]) return false; } return true; };
  // ---- stations ----
  for (const s of ST) { const k = kindOfStation(s)!; const [spr, fw, fd, sw] = FOCAL[k]; const glow = k === 'locker' || k === 'vendor' ? 'cool' : 'lamp';
    if (k === 'locker') { for (let i = 0; i < 3; i++) D('lockers', s.lx + i - 1, s.ly, 1, 2, 1.8, { station: s.key, glow: i === 1 ? 'cool' : undefined }); }
    else D(spr, s.lx, s.ly, fw, fd, sw, { station: s.key, glow });
    if (k === 'jobs' && freeWalk(s.lx + 3, s.ly - 1, 3, 3, 0)) D('fixer_booth', s.lx + 3, s.ly - 1, 3, 3, 3.4, { station: s.key, glow: 'lamp' });
    if (k === 'repair' && freeWalk(s.lx - 3, s.ly, 2, 2, 0)) D('steam_drums', s.lx - 3, s.ly, 2, 2, 2.5, { steam: true });
    if (k === 'gate') { D('barrier', s.lx - 4, s.ly - 2, 3, 1, 3.0, { solid: false }); }
    D('sign_' + s.key, s.sx, s.sy, 1, 1, 1.9, { station: s.key, ay: .93 });
    D('lamp', s.lx + fw + 2, s.ly + fd + 2, 1, 1, 1.0, { glow: 'lamp', solid: false }); }
  // ---- landmark vista: on the far side of the plaza from the transit pad, set back so it frames the hub ----
  const tr = ST.find(s => kindOfStation(s) === 'transit')!; const L0 = g.landmark;
  let lmx = Math.round(CX - (tr.x - CX) * .45 - L0.fw / 2), lmy = Math.round(CY - (tr.y - CY) * .45 - L0.fd / 2);
  for (let tries = 0; tries < 40 && !freeWalk(lmx, lmy, L0.fw, L0.fd, 0); tries++) { lmx += Math.round((R() - .5) * 6); lmy += Math.round((R() - .5) * 6); lmx = Math.max(3, Math.min(w - 3 - L0.fw, lmx)); lmy = Math.max(3, Math.min(h - 3 - L0.fd, lmy)); }
  D(L0.spr, lmx, lmy, L0.fw, L0.fd, L0.sw, { glow: 'lamp' }); const landmark = { x: lmx + L0.fw / 2, y: lmy + L0.fd / 2, name: L0.name };
  // ---- hub dressing ----
  for (let i = 0; i < 9; i++) { const [spr, fw, fd, sw] = g.hub[i % g.hub.length]; for (let k = 0; k < 14; k++) { const a = R() * 6.28, r = 6 + R() * 6; const x = Math.round(CX + Math.cos(a) * r), y = Math.round(CY + Math.sin(a) * r * .8); if (freeWalk(x, y, fw, fd)) { D(spr, x, y, fw, fd, sw, { glow: spr.includes('fire') ? 'fire' : undefined }); break; } } }
  for (const [lx, ly] of [[CX - 7, CY - 6], [CX + 7, CY - 6], [CX - 7, CY + 6], [CX + 7, CY + 6]]) D('lamp', lx, ly, 1, 1, 1.0, { glow: 'lamp', solid: false });
  // ---- perimeter: district buildings on solid tiles bordering the walkable area; never in front of a station landmark ----
  const occludes = (x: number, y: number, fw: number, fd: number) => ST.some(st => x < st.lx + 10 && x + fw > st.lx - 8 && y + fd > st.ly - 4 && y < st.ly + 10 && x + y + fw + fd > st.lx + st.ly + 2);
  const solidFree = (x: number, y: number, fw: number, fd: number) => { if (occludes(x, y, fw, fd) || x < 0 || y < 0 || x + fw > w || y + fd > h) return false; for (let j = 0; j < fd; j++) for (let i = 0; i < fw; i++) { const k = (y + j) * w + x + i; if (!solid[k] || hide[k]) return false; } return true; };
  const border: [number, number][] = []; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x; if (solid[k] && !hide[k] && (!solid[k - 1] || !solid[k + 1] || !solid[k - w] || !solid[k + w])) border.push([x, y]); }
  const neonIx = { i: 0 }; for (let i = border.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [border[i], border[j]] = [border[j], border[i]]; }
  for (const [bx, by] of border) { const [spr, fw, fd, sw] = g.perimeter[(R() * g.perimeter.length) | 0]; for (const [dx, dy] of [[0, 0], [-1, -1], [-fw + 1, 0], [0, -fd + 1]]) if (solidFree(bx + dx, by + dy, fw, fd)) { D(spr, bx + dx, by + dy, fw, fd, sw); break; } }
  // neon signage on the backs of the plaza (visual only)
  for (let i = 0; i < g.signage.length * 2; i++) { const [bx, by] = border[(R() * border.length) | 0] || [0, 0]; if (bx + by > CX + CY) continue; decor.push({ spr: 'neon_' + (neonIx.i++ % g.signage.length), x: bx, y: by, fw: 1, fd: 1, sw: 2.2, solid: false, ay: .9, glow: 'lamp' }); }
  // ---- flood fill from spawn: seal pockets the player could never reach (no-stuck rule) ----
  const spawn = { x: tr.x + Math.sign(CX - tr.x) * 2.5, y: tr.y + Math.sign(CY - tr.y) * 2.5 }; if (solid[Math.floor(spawn.y) * w + Math.floor(spawn.x)]) { spawn.x = CX + .5; spawn.y = CY + .5; }
  { const seen = new Uint8Array(w * h), q = [Math.floor(spawn.y) * w + Math.floor(spawn.x)]; seen[q[0]] = 1; while (q.length) { const k = q.pop()!; for (const d of [1, -1, w, -w]) { const n = k + d; if (n >= 0 && n < w * h && !seen[n] && !solid[n]) { seen[n] = 1; q.push(n); } } } for (let k = 0; k < w * h; k++) if (!solid[k] && !seen[k]) solid[k] = 1; }
  const gt = ST.find(s => kindOfStation(s) === 'gate'); const returnSpawn = gt ? { x: gt.x + Math.sign(CX - gt.x) * 2.5, y: gt.y + Math.sign(CY - gt.y) * 2.5 } : spawn; if (solid[Math.floor(returnSpawn.y) * w + Math.floor(returnSpawn.x)]) { returnSpawn.x = spawn.x; returnSpawn.y = spawn.y; }
  // ---- lights: slow pulses only (flick kept tiny so lightPulse stays a 3-5 s breathe, never a flicker) ----
  const lights: LightDef[] = [];
  for (const d of decor) { if (!d.glow) continue; const cx = d.x + d.fw / 2, cy = d.y + d.fd / 2; lights.push({ x: cx, y: cy, z: d.spr === 'lamp' ? 1.5 : 1.1, r: d.spr === 'lamp' ? 5.2 : 4.4, c: d.glow === 'fire' ? 'fire' : d.glow === 'cool' ? 'cool' : 'lamp' as any, a: d.spr === 'lamp' ? .4 : .3, flick: .02 }); }
  lights.push({ x: CX + .5, y: CY + .5, z: 0, r: 14, c: 'lamp' as any, a: .14 });
  for (const s of ST) { lights.push({ x: s.x, y: s.y, z: .2, r: 7.5, c: s.key, a: .5, flick: .04 }); lights.push({ x: s.lx + 1, y: s.ly + 1, z: 2.2, r: 5, c: s.key, a: .22, flick: .02 }); }
  const overhead: Overhead[] = [{ spr: 'bulbs', x: CX, y: CY - 6, z: 3.0, sw: 7.5, glow: 'bulbs' }, { spr: 'swag1', x: CX - 5, y: CY + 5, z: 2.4, sw: 3.0, glow: 'lanterns' }];
  // ---- crowds: ambient NPCs at the plaza and stations; elite NPCs (visibly better kit) near the gate ----
  const N = (spr: string, x: number, y: number, ph: number, o: Partial<NpcDef> = {}): NpcDef => ({ spr, x, y, ph, h: 1.3, ...o });
  const npcs: NpcDef[] = []; const walk = (x: number, y: number) => !solid[Math.floor(y) * w + Math.floor(x)];
  const pool = ['npc1', 'npc2', 'npc3', 'npc4', 'np_pair_talk', 'np_kid_l', 'np_lantern_l', 'np_porter', 'np_hooded_wall'];
  const crowd = Math.round(10 * g.crowd); for (let i = 0; i < crowd * 3 && npcs.length < crowd; i++) { const a = R() * 6.28, r = 2 + R() * 9; const x = CX + .5 + Math.cos(a) * r, y = CY + .5 + Math.sin(a) * r * .8; if (!walk(x, y) || Math.hypot(x - spawn.x, y - spawn.y) < 2) continue; const spr = pool[(R() * pool.length) | 0];
    npcs.push(N(spr, x, y, R() * 6, spr === 'np_porter' || spr === 'np_lantern_l' || spr === 'np_kid_l' ? { wander: [x + (R() - .5) * 8, y + (R() - .5) * 6], speed: .3 } : {})); }
  for (const s of ST) { const x = s.x + (R() < .5 ? -2.6 : 2.6), y = s.y - 1; if (walk(x, y)) npcs.push(N(pool[(R() * 4) | 0], x, y, R() * 6, { h: 1.25 })); }
  const elites: { x: number; y: number }[] = []; if (gt) for (const dx of [-2.6, 2.6]) { const x = gt.x + dx, y = gt.y - 1.6; if (walk(x, y)) { npcs.push(N(dx < 0 ? 'np_guard_l' : 'np_guard_r', x, y, 1, { h: 1.42 })); elites.push({ x, y }); } }
  // living city: the controlling faction posts extra guards on the plaza ring (docs/LIVING_CITY.md)
  { const xg = Math.max(0, (cityDecor(id)?.guards ?? 2) - 2); for (let i = 0, k = 0; i < 24 && k < xg; i++) { const a = i * 2.39, x = CX + .5 + Math.cos(a) * 6.5, y = CY + .5 + Math.sin(a) * 5; if (!walk(x, y)) continue; npcs.push(N(i % 2 ? 'np_guard_l' : 'np_guard_r', x, y, 1, { h: 1.42 })); elites.push({ x, y }); k++; } }
  for (const e of elites) lights.push({ x: e.x, y: e.y, z: 1, r: 3, c: 'cool', a: .35, flick: .02 });
  const interacts: Interact[] = ST.map(s => ({ id: s.id, x: s.x, y: s.y, r: 2.4, label: stationPrompt(s), kind: s.kind, opens: s.opens, station: s.key }));
  return { w, h, solid, zone, doors: [], props: [], interacts, spawns: [], checkpoints: [], sensors: { x0: 0, y0: 0, x1: 0, y1: 0 }, spawn, returnSpawn, zoneNames: ZONES, bossSpawn: { x: 0, y: 0 }, revealX: 0, salvage: { x: 0, y: 0 }, kind: 'town', theme: id, decor, npcs, lights, hide, overhead, landmark, elites } as unknown as Level;
}
