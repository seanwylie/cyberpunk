// Harrow Reach (town 2): foundry-district hub unlocked through progression (see src/towns.ts, docs/BANK_AND_TOWN2.md).
// Level builder + art configuration. All content lives here and in public/town2 so the Rustline code paths stay untouched.
import type { Level, Decor, NpcDef, LightDef, Overhead, Interact, Prop } from './level';
import { ZONES } from './level';
import { HARROW_STATIONS, HARROW_W, HARROW_H, HARROW_CX, HARROW_CY, HARROW_SPAWN, HARROW_RETURN_SPAWN, stationPrompt } from './stations';
import type { TownCfg } from './town';

export const HARROW_PROPS = ['h_bld1','h_bld2','h_bld3','h_container','h_slab','h_barrier','h_barrier_corner','h_gantry','h_crates','h_barrels','h_lamp','h_cables','h_steam_drums','h_workbench','h_lockers','h_board_jobs','h_fixer_booth','h_noticeboard','h_stall_weapons','h_stall_goods','h_stall_vendor','h_gate_arch','h_junk','h_bench','h_banner_pole','h_scaffold',
  'furnace_tower','forge_hall','guild_counter','tram_platform','ladle_crane','smokestack','slag_cart',
  // shared with Rustline (loaded from ./town/props via fallbackBase): NPC silhouettes + overhead dressing
  'npc1','npc2','npc3','npc4','np_kneel_l','np_kneel_r','np_pair_talk','np_guard_l','np_guard_r','np_porter','np_hooded_wall','np_lantern_l','np_lantern_r','np_kid_l','np_kid_r','awn_red','awn_grey','awn_blue','awn_green','swag1','swag2','swag3','bulbs','rags1','rags2'];
export const HARROW_GROUND = ['slag', 'deck', 'grate', 'plaza'];

/** art config for the Harrow TownArt: slag base, deck plates for lanes, grating glow patches, foundry plaza medallion, no wet puddles */
export const harrowCfg = (): TownCfg => ({
  stations: HARROW_STATIONS, hub: [HARROW_CX + .5, HARROW_CY + .5], props: HARROW_PROPS, ground: HARROW_GROUND, fallbackBase: './town/', puddles: false, plazaSize: 24,
  g: { base: 'slag', debris: 'none', planks: 'deck', plaza: 'plaza' },
  // glowing grating pads under the forge and the parts hall (heat from below), feathered into the slag
  extra: (x, W, H, art) => { const gr = art.gimg.grate; if (!gr) return; const GPX = 40;
    for (const k of ['h_repair', 'h_parts', 'h_gate']) { const st = HARROW_STATIONS.find(s => s.key === k)!; const pw = 11 * GPX, ph = 8 * GPX, cx = st.x * GPX, cy = (st.y - 1.5) * GPX; const t = document.createElement('canvas'); t.width = pw; t.height = ph; const tx = t.getContext('2d')!;
      tx.fillStyle = tx.createPattern(gr, 'repeat')!; tx.fillRect(0, 0, pw, ph); tx.globalCompositeOperation = 'destination-in'; const g = tx.createRadialGradient(pw / 2, ph / 2, ph * .15, pw / 2, ph / 2, ph * .5); g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(.6, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); tx.fillStyle = g; tx.fillRect(0, 0, pw, ph); x.drawImage(t, cx - pw / 2, cy - ph / 2); } },
});

export function buildHarrow(): Level {
  const w = HARROW_W, h = HARROW_H, CX = HARROW_CX, CY = HARROW_CY; const solid = new Uint8Array(w * h).fill(1); const zone = new Uint8Array(w * h).fill(ZONES.indexOf('town')); const hide = new Uint8Array(w * h);
  const RX = 33, RY = 23; const edge = (a: number) => 1 + .07 * Math.sin(a * 3 + .9) + .05 * Math.sin(a * 5 + 1.4) + .035 * Math.sin(a * 8 + .2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (x + .5 - CX) / RX, dy = (y + .5 - CY) / RY; const n = edge(Math.atan2(dy, dx)); if (dx * dx + dy * dy < n * n) solid[y * w + x] = 0; }
  const carve = (x0: number, y0: number, x1: number, y1: number) => { for (let y = Math.max(1, y0); y <= Math.min(h - 2, y1); y++) for (let x = Math.max(1, x0); x <= Math.min(w - 2, x1); x++) solid[y * w + x] = 0; };
  for (const s of HARROW_STATIONS) carve(Math.floor(s.x) - 5, Math.floor(s.y) - 3, Math.floor(s.x) + 5, Math.floor(s.y) + 3);
  carve(60, 25, 70, 30); // gate road
  const decor: Decor[] = []; const props: Prop[] = [];
  const D = (spr: string, x: number, y: number, fw: number, fd: number, sw: number, o: Partial<Decor> = {}) => { decor.push({ spr, x, y, fw, fd, sw, solid: true, ...o }); if (o.solid !== false) for (let j = 0; j < fd; j++) for (let i = 0; i < fw; i++) { if (y + j < h && x + i < w) { solid[(y + j) * w + x + i] = 1; hide[(y + j) * w + x + i] = 1; } } };
  const S = (k: string) => HARROW_STATIONS.find(s => s.key === k)!;
  // ---- stations: one landmark each, then supporting props ----
  { const s = S('h_transit'); D('tram_platform', s.lx, s.ly, 5, 2, 5.8, { station: s.key, glow: 'warm' }); D('h_lamp', s.lx - 1, s.ly + 5, 1, 1, 1.0, { glow: 'warm' }); D('h_lamp', s.lx + 5, s.ly + 5, 1, 1, 1.0, { glow: 'warm' }); D('h_crates', s.lx + 6, s.ly + 1, 2, 2, 2.6); }
  { const s = S('h_jobs'); D('h_board_jobs', s.lx, s.ly, 2, 2, 3.8, { station: s.key, glow: 'warm' }); D('h_fixer_booth', s.lx + 4, s.ly - 1, 3, 3, 3.6, { station: s.key, glow: 'warm' }); D('h_noticeboard', s.lx - 2, s.ly + 3, 1, 1, 1.5, { station: s.key }); D('h_banner_pole', s.lx + 8, s.ly + 3, 1, 1, 2.6); D('h_barrels', s.lx + 7, s.ly - 1, 2, 2, 2.4); }
  { const s = S('h_bank'); D('bank_vault', s.lx, s.ly, 4, 3, 5.4, { station: s.key, glow: 'warm' }); D('h_crates', s.lx - 3, s.ly + 1, 2, 2, 2.4); D('h_barrier', s.lx + 5, s.ly + 1, 3, 1, 3.0); D('h_lamp', s.lx - 1, s.ly + 4, 1, 1, 1.0, { glow: 'warm' }); D('h_lamp', s.lx + 4, s.ly + 4, 1, 1, 1.0, { glow: 'warm' }); }
  { const s = S('h_parts'); D('forge_hall', s.lx, s.ly, 5, 3, 5.0, { station: s.key, glow: 'fire' }); D('h_stall_weapons', s.lx + 6, s.ly + 2, 3, 3, 4.0, { station: s.key, glow: 'warm' }); D('h_crates', s.lx - 2, s.ly + 3, 2, 2, 2.6); D('h_lamp', s.lx + 1, s.ly + 5, 1, 1, 1.0, { glow: 'warm' }); D('slag_cart', s.lx - 4, s.ly + 5, 2, 1, 1.9, { solid: false }); }
  { const s = S('h_gate'); D('h_gate_arch', s.lx, s.ly - 1, 3, 1, 5.0, { station: s.key, glow: 'warm' }); D('h_barrier', s.lx - 5, s.ly - 3, 3, 1, 3.0); D('h_barrier', s.lx - 5, s.ly + 4, 3, 1, 3.0); D('h_barrels', s.lx + 1, s.ly + 3, 2, 2, 2.4); D('h_barrier_corner', s.lx + 1, s.ly - 4, 2, 2, 3.2); D('ladle_crane', s.lx - 8, s.ly - 8, 2, 2, 3.0, { glow: 'fire' }); }
  { const s = S('h_repair'); D('furnace_tower', s.lx, s.ly, 3, 3, 3.9, { station: s.key, glow: 'fire' }); D('h_workbench', s.lx - 4, s.ly + 1, 2, 2, 3.4, { station: s.key, glow: 'warm' }); D('h_steam_drums', s.lx + 4, s.ly + 1, 2, 2, 2.5, { steam: true }); D('slag_cart', s.lx - 7, s.ly - 1, 2, 1, 1.9, { solid: false }); }
  { const s = S('h_locker'); D('h_lockers', s.lx, s.ly, 1, 2, 1.8, { station: s.key, glow: 'cool' }); D('h_lockers', s.lx + 1, s.ly, 1, 2, 1.8, { station: s.key }); D('h_lockers', s.lx + 2, s.ly, 1, 2, 1.8, { station: s.key }); D('h_container', s.lx + 4, s.ly + 1, 4, 2, 3.7); D('h_lamp', s.lx - 2, s.ly - 1, 1, 1, 1.0, { glow: 'warm' }); }
  { const s = S('h_guild'); D('guild_counter', s.lx, s.ly, 4, 2, 3.8, { station: s.key, glow: 'warm' }); D('h_stall_goods', s.lx + 5, s.ly + 1, 3, 3, 4.1, { station: s.key, glow: 'warm' }); D('h_banner_pole', s.lx - 2, s.ly, 1, 1, 2.6); D('h_barrels', s.lx - 3, s.ly + 3, 2, 2, 2.4); }
  for (const s of HARROW_STATIONS) D('sign_' + s.key, s.sx, s.sy, 1, 1, 3.9, { station: s.key, ay: .93, glow: undefined });
  // ---- hub: foundry plaza, ladle crane, benches, lamps (kept low so the spawn reads) ----
  D('ladle_crane', CX - 2, CY - 5, 2, 2, 3.4, { glow: 'fire' }); D('h_bench', CX + 4, CY - 1, 2, 1, 2.0); D('h_bench', CX - 6, CY + 2, 2, 1, 2.0); D('h_barrels', CX + 6, CY - 5, 2, 2, 2.4); D('h_steam_drums', CX - 8, CY - 4, 2, 2, 2.5, { steam: true }); D('h_cables', CX + 2, CY + 5, 1, 1, 1.5);
  for (const [lx, ly] of [[CX - 8, CY - 8], [CX + 8, CY - 8], [CX - 8, CY + 9], [CX + 8, CY + 9], [CX - 15, CY], [CX + 15, CY - 1], [CX, CY - 14], [CX, CY + 15]]) D('h_lamp', lx, ly, 1, 1, 1.0, { glow: 'warm' });
  D('slag_cart', CX + 10, CY + 3, 2, 1, 1.9, { solid: false }); D('h_junk', 10, 14, 2, 1, 2.8, { solid: false }); D('h_junk', 66, 38, 2, 1, 2.8, { solid: false });
  // ---- perimeter: heavy blocks, stacks, barriers (back = bld/stacks, front = containers/slabs) ----
  { let seed = 17; const R = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const free = (x: number, y: number, fw: number, fd: number) => { if (x < 0 || y < 0 || x + fw > w || y + fd > h) return false; for (let j = 0; j < fd; j++) for (let i = 0; i < fw; i++) { const k = (y + j) * w + x + i; if (!solid[k] || hide[k]) return false; } return true; };
    for (let a = -Math.PI; a < Math.PI; a += .05) { const r = 1.5 + R() * 1.4; const cx = CX + (RX * edge(a) + r) * Math.cos(a), cy = CY + (RY * edge(a) + r) * Math.sin(a); const depth = cx + cy - (CX + CY) + 45;
      const pool: [string, number, number, number][] = depth < 40 ? [['h_bld1', 3, 3, 3.0], ['h_bld2', 3, 3, 3.0], ['h_bld3', 3, 3, 3.0], ['smokestack', 2, 2, 1.7], ['h_gantry', 2, 2, 2.3], ['forge_hall', 5, 3, 4.6]] : depth < 56 ? [['h_container', 4, 2, 3.7], ['h_slab', 2, 2, 2.6], ['h_barrier', 3, 1, 3.0], ['h_bld1', 3, 3, 2.7], ['h_gantry', 2, 2, 2.2], ['smokestack', 2, 2, 1.7]] : [['h_container', 4, 2, 3.7], ['h_slab', 2, 2, 2.6], ['h_barrier', 3, 1, 3.0], ['h_barrier_corner', 2, 2, 3.2], ['h_container', 2, 4, 3.7]];
      const [spr, fw, fd, sw] = pool[(R() * pool.length) | 0]; const x = Math.round(cx - fw / 2), y = Math.round(cy - fd / 2);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (free(x + dx, y + dy, fw, fd)) { D(spr, x + dx, y + dy, fw, fd, sw); break; } }
  }
  // ---- lights: forge glow pools ----
  const lights: LightDef[] = [];
  for (const d of decor) { if (!d.glow) continue; const cx = d.x + d.fw / 2, cy = d.y + d.fd / 2; if (d.glow === 'warm') lights.push({ x: cx, y: cy, z: d.spr === 'h_lamp' ? 1.5 : 1.1, r: d.spr === 'h_lamp' ? 5.4 : 4.2, c: 'warm', a: d.spr === 'h_lamp' ? .42 : .3, flick: d.spr === 'h_lamp' ? .04 : .12 }); else if (d.glow === 'fire') lights.push({ x: cx, y: cy, z: 1.2, r: 7.5, c: 'fire', a: .55, flick: .3 }); else lights.push({ x: cx, y: cy, z: 1, r: 3.4, c: 'cool', a: .2, flick: .03 }); }
  lights.push({ x: CX + .5, y: CY + .5, z: 0, r: 14, c: 'fire', a: .12 });
  for (const s of HARROW_STATIONS) { lights.push({ x: s.x, y: s.y, z: .2, r: 7.5, c: s.key, a: .5, flick: s.ambient === 'screens' || s.ambient === 'neon' ? .25 : s.ambient === 'beacon' ? .35 : .08 }); lights.push({ x: s.lx + 1, y: s.ly + 1, z: 2.2, r: 5, c: s.key, a: .22, flick: .06 }); }
  const AW = ['awn_red', 'awn_grey', 'awn_blue', 'awn_green'] as const; const overhead: Overhead[] = [];
  HARROW_STATIONS.filter(s => ['h_jobs', 'h_locker', 'h_guild'].includes(s.key)).forEach((s, i) => overhead.push({ spr: AW[i % 4], x: s.lx + 2, y: s.ly + 3.3, z: 2.2, sw: 3.3 }));
  overhead.push({ spr: 'swag1', x: S('h_jobs').lx + 4, y: S('h_jobs').ly + 4, z: 2.3, sw: 3.0, glow: 'lanterns' }, { spr: 'swag2', x: S('h_guild').lx + 4, y: S('h_guild').ly + 4, z: 2.3, sw: 3.0, glow: 'lanterns' }, { spr: 'bulbs', x: CX, y: CY - 12, z: 3.0, sw: 7.5, glow: 'bulbs' }, { spr: 'bulbs', x: CX, y: CY + 13, z: 2.9, sw: 7, glow: 'bulbs' }, { spr: 'rags1', x: S('h_guild').lx - 2, y: S('h_guild').ly - 1, z: 2.7, sw: 3.4 });
  const N = (spr: string, x: number, y: number, ph: number, o: Partial<NpcDef> = {}): NpcDef => ({ spr, x, y, ph, h: 1.3, ...o });
  const npcs: NpcDef[] = [
    N('np_pair_talk', CX - 3, CY + 1, 0, { h: 1.45 }), N('np_kid_l', CX + 4, CY + 2, 2.1, { h: 1, wander: [CX - 4, CY + 4], speed: .5 }), N('np_lantern_l', CX + 9, CY - 6, 5.2, { h: 1.35, wander: [CX + 2, CY - 10], speed: .28 }), N('npc1', CX - 1, CY - 2, 0, { h: 1.25 }),
    N('np_porter', CX - 9, CY + 5, .7, { wander: [CX - 9, CY + 11], speed: .3 }),
    // transit
    N('np_guard_l', S('h_transit').x + 2, S('h_transit').y - 3, 1.3, { h: 1.35 }), N('npc3', S('h_transit').x + 3, S('h_transit').y + 1, 1.3, { h: 1.25 }),
    // jobs: Ten Hallowell (npc2) + clients
    N('npc2', S('h_jobs').x - .8, S('h_jobs').y - 1.4, .2), N('np_kneel_l', S('h_jobs').x - 3.5, S('h_jobs').y + .5, .6, { h: .95 }), N('npc4', S('h_jobs').x + 2.5, S('h_jobs').y + .5, 2.7, { h: 1.25 }),
    // bank guards
    N('np_guard_l', S('h_bank').x - 3.2, S('h_bank').y - 1.6, .9, { h: 1.35 }), N('np_guard_r', S('h_bank').x + 3.2, S('h_bank').y - 1.6, 1.6, { h: 1.35 }),
    // parts: hooded fitter
    N('np_hooded_wall', S('h_parts').x + 3, S('h_parts').y - .5, 1.8, { h: 1.55 }), N('npc3', S('h_parts').x - 2.5, S('h_parts').y + .6, 3.3, { h: 1.25 }),
    // gate guards
    N('np_guard_l', S('h_gate').x - 2.5, S('h_gate').y - 2, 1.3, { h: 1.35 }), N('np_guard_r', S('h_gate').x - 2.5, S('h_gate').y + 2.2, .4, { h: 1.35 }),
    // forge, locker, guild (retiree veterans)
    N('np_porter', S('h_repair').x - 3, S('h_repair').y - 1, .7, { wander: [S('h_repair').x - 3, S('h_repair').y - 5], speed: .3 }), N('np_kneel_r', S('h_repair').x + 2.5, S('h_repair').y - .5, 4.1, { h: .95 }),
    N('npc1', S('h_locker').x + 3.5, S('h_locker').y - .5, 4.4, { h: 1.25 }),
    N('npc2', S('h_guild').x + 2.5, S('h_guild').y - 1, 4.9, { h: 1.25, wander: [S('h_guild').x + 2.5, S('h_guild').y - 4], speed: .25 }), N('np_hooded_wall', S('h_guild').x - 2, S('h_guild').y - .5, 3.9, { h: 1.55 }),
  ];
  const interacts: Interact[] = HARROW_STATIONS.map(s => ({ id: s.id, x: s.x, y: s.y, r: 2.4, label: stationPrompt(s), kind: s.kind, opens: s.opens, station: s.key }));
  return { w, h, solid, zone, doors: [], props, interacts, spawns: [], checkpoints: [], sensors: { x0: 0, y0: 0, x1: 0, y1: 0 }, spawn: { ...HARROW_SPAWN }, returnSpawn: { ...HARROW_RETURN_SPAWN }, zoneNames: ZONES, bossSpawn: { x: 0, y: 0 }, revealX: 0, salvage: { x: 0, y: 0 }, kind: 'town', theme: 'harrow', decor, npcs, lights, hide, overhead } as Level;
}
