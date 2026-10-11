// Dungeon VARIETY layer (docs/VARIETY.md). Pure canvas painters + per-theme "kits" so no two dungeon themes share the same floor wear, wall dressing, prop livery,
// decal set, ambient particle or colour grade. Everything is drawn into the SAME offscreen canvases the existing procedural textures use (no new texture sizes, no
// extra memory), once per (theme, zone, variant), cached by envtex.ts. Runtime cost: one multiply fill (grade) + <= 26 tiny particles per frame.
import type { Level } from './level';
type X = CanvasRenderingContext2D;
type RGB = [number, number, number];
export type FloorKind = 'drains' | 'chevrons' | 'cables' | 'rubble' | 'rustflake' | 'silt' | 'frost' | 'oil' | 'tilewear' | 'cinder' | 'moss' | 'glass' | 'paper' | 'bays' | 'wet';
export type WallKind = 'pipes' | 'vents' | 'stencil' | 'drips' | 'panels' | 'conduit' | 'posters' | 'shutters' | 'ribs';
export type PropKit = 'drums' | 'tape' | 'hazmat' | 'tarp' | 'plate' | 'lightbar' | 'rust';
export type DecalKind = 'tire' | 'chalk' | 'boots' | 'scorch' | 'frost' | 'puddle' | 'shards' | 'paper' | 'bloom' | 'scars' | 'arrow' | 'sludge' | 'tufts' | 'hand';
export type ParticleKind = 'embers' | 'steam' | 'paper' | 'drips' | 'frost' | 'sparks' | 'moths' | 'ash' | 'bubbles' | 'static';
export interface Grade { tint: RGB; boss: RGB; k: number; vig: number }
export interface Kit { floor: FloorKind; floor2: FloorKind; wall: WallKind; prop: PropKit; decals: DecalKind[]; particle: ParticleKind; grade: Grade }
const G = (tint: RGB, boss: RGB, k = .22, vig = .1): Grade => ({ tint, boss, k, vig });
/** one kit per dungeon theme (3 original + 20 content-batch-1). tests/variety.mjs checks they are pairwise distinct. */
export const KITS: Record<string, Kit> = {
  foundry:           { floor: 'cinder',    floor2: 'chevrons', wall: 'pipes',    prop: 'drums',    decals: ['scorch', 'tire', 'sludge'],  particle: 'embers',  grade: G([255, 226, 200], [255, 186, 150], .26, .14) },
  clinic:            { floor: 'tilewear',  floor2: 'drains',   wall: 'panels',   prop: 'hazmat',   decals: ['puddle', 'boots', 'hand'],   particle: 'drips',   grade: G([226, 244, 240], [240, 226, 208], .2, .08) },
  warehouse:         { floor: 'bays',      floor2: 'chevrons', wall: 'shutters', prop: 'tape',     decals: ['tire', 'arrow', 'paper'],    particle: 'paper',   grade: G([246, 240, 218], [236, 226, 196], .2, .1) },
  coke_ovens:        { floor: 'cinder',    floor2: 'rustflake', wall: 'ribs',    prop: 'rust',     decals: ['scorch', 'sludge', 'scars'], particle: 'ash',     grade: G([255, 214, 176], [255, 168, 120], .3, .16) },
  substation_12:     { floor: 'cables',    floor2: 'chevrons', wall: 'conduit',  prop: 'lightbar', decals: ['scars', 'puddle', 'arrow'],  particle: 'sparks',  grade: G([206, 226, 255], [186, 206, 255], .26, .12) },
  scrap_gantry:      { floor: 'rubble',    floor2: 'rustflake', wall: 'ribs',    prop: 'tarp',     decals: ['tire', 'bloom', 'boots'],    particle: 'paper',   grade: G([255, 238, 196], [240, 214, 170], .22, .1) },
  tailings_pit:      { floor: 'silt',      floor2: 'oil',      wall: 'drips',    prop: 'rust',     decals: ['sludge', 'tire', 'bloom'],   particle: 'ash',     grade: G([236, 224, 184], [224, 204, 160], .26, .12) },
  bell_foundry:      { floor: 'cinder',    floor2: 'drains',   wall: 'stencil',  prop: 'plate',    decals: ['scorch', 'chalk', 'tufts'],  particle: 'embers',  grade: G([255, 222, 178], [255, 190, 140], .24, .14) },
  cold_archive:      { floor: 'frost',     floor2: 'tilewear', wall: 'panels',   prop: 'plate',    decals: ['frost', 'paper', 'chalk'],   particle: 'frost',   grade: G([208, 230, 255], [190, 216, 250], .3, .14) },
  audit_tower:       { floor: 'bays',      floor2: 'glass',    wall: 'panels',   prop: 'lightbar', decals: ['paper', 'arrow', 'boots'],   particle: 'static',  grade: G([232, 240, 246], [214, 226, 238], .18, .08) },
  aesthetic_ward:    { floor: 'tilewear',  floor2: 'glass',    wall: 'posters',  prop: 'hazmat',   decals: ['shards', 'hand', 'puddle'],  particle: 'moths',   grade: G([255, 232, 236], [250, 210, 220], .22, .1) },
  pharmacy_vault:    { floor: 'drains',    floor2: 'tilewear', wall: 'vents',    prop: 'hazmat',   decals: ['puddle', 'chalk', 'hand'],   particle: 'bubbles', grade: G([214, 246, 226], [196, 236, 214], .24, .1) },
  anechoic_lab:      { floor: 'cables',    floor2: 'silt',     wall: 'ribs',     prop: 'lightbar', decals: ['scars', 'chalk', 'tufts'],   particle: 'static',  grade: G([214, 220, 232], [196, 204, 226], .26, .16) },
  outlet_mall:       { floor: 'paper',     floor2: 'tilewear', wall: 'posters',  prop: 'tarp',     decals: ['paper', 'shards', 'boots'],  particle: 'moths',   grade: G([255, 228, 238], [248, 206, 226], .22, .1) },
  liquidation_floor: { floor: 'bays',      floor2: 'paper',    wall: 'stencil',  prop: 'tape',     decals: ['arrow', 'paper', 'tire'],    particle: 'paper',   grade: G([255, 214, 208], [250, 188, 180], .24, .12) },
  parcel_tower:      { floor: 'chevrons',  floor2: 'paper',    wall: 'conduit',  prop: 'tape',     decals: ['arrow', 'tire', 'scars'],    particle: 'paper',   grade: G([255, 232, 190], [246, 210, 160], .2, .1) },
  freight_depot:     { floor: 'rubble',    floor2: 'chevrons', wall: 'stencil',  prop: 'drums',    decals: ['tire', 'arrow', 'bloom'],    particle: 'steam',   grade: G([210, 232, 220], [190, 216, 204], .24, .12) },
  warranty_vault:    { floor: 'glass',     floor2: 'bays',     wall: 'shutters', prop: 'plate',    decals: ['paper', 'scars', 'chalk'],   particle: 'static',  grade: G([246, 232, 196], [236, 214, 168], .22, .12) },
  drained_reservoir: { floor: 'wet',       floor2: 'moss',     wall: 'drips',    prop: 'rust',     decals: ['puddle', 'sludge', 'tufts'], particle: 'bubbles', grade: G([196, 226, 230], [176, 210, 220], .3, .16) },
  night_tunnels:     { floor: 'moss',      floor2: 'wet',      wall: 'pipes',    prop: 'lightbar', decals: ['puddle', 'hand', 'boots'],   particle: 'moths',   grade: G([170, 180, 228], [150, 160, 220], .34, .22) },
  breaker_yard:      { floor: 'rubble',    floor2: 'oil',      wall: 'vents',    prop: 'tarp',     decals: ['scars', 'scorch', 'tire'],   particle: 'sparks',  grade: G([255, 212, 190], [248, 180, 150], .26, .14) },
  radio_mast:        { floor: 'cables',    floor2: 'drains',   wall: 'conduit',  prop: 'plate',    decals: ['chalk', 'frost', 'scars'],   particle: 'static',  grade: G([200, 214, 238], [180, 198, 236], .26, .14) },
  recall_yard:       { floor: 'rustflake', floor2: 'chevrons', wall: 'stencil',  prop: 'drums',    decals: ['hand', 'scars', 'bloom'],    particle: 'ash',     grade: G([232, 214, 224], [226, 190, 206], .28, .16) },
};
export const kitOf = (th: string): Kit | undefined => KITS[th];
const kitSig = (k: Kit) => [k.floor, k.floor2, k.wall, k.prop, k.particle].join('|');
export const kitSignature = kitSig;

const ZONE_SHIFT: Record<string, RGB> = { yard: [1.04, 1.02, .98], proc: [1, 1, 1], junction: [.95, .98, 1.05], salvage: [1.05, .98, .9], passage: [.9, .92, .96], corridor: [.9, .92, .96], boss: [1, 1, 1] };
/** target multiply colour for a zone: theme tint x zone shift (boss uses the theme's boss tint), pulled toward white by k so it stays a grade, never a filter */
export function gradeTarget(th: string, zone: string): { rgb: RGB; vig: number } | null {
  const k = KITS[th]; if (!k) return null; const g = k.grade, sh = ZONE_SHIFT[zone] || ZONE_SHIFT.proc, base = zone === 'boss' ? g.boss : g.tint;
  const rgb = base.map((c, i) => Math.round(255 - (255 - Math.max(0, Math.min(255, c * sh[i]))) * g.k * (zone === 'boss' ? 1.25 : 1) * 255 / 255)) as RGB;
  return { rgb: rgb.map(c => Math.max(190, Math.min(255, c))) as RGB, vig: g.vig * (zone === 'boss' ? 1.4 : zone === 'passage' || zone === 'corridor' ? 1.2 : 1) };
}
let cur: RGB = [255, 255, 255], curVig = 0, lastT = -1, lastTh = '';
/** screen-space colour grade, smoothly cross-faded when the player walks between zones. Returns the colour used (tests). */
export function applyGrade(c: X, w: number, h: number, th: string, zone: string, time: number): RGB | null {
  const tg = gradeTarget(th, zone); if (!tg) return null; const dt = lastT < 0 || time < lastT || th !== lastTh ? 9 : Math.min(.25, time - lastT); lastT = time; lastTh = th; const a = 1 - Math.exp(-dt * 1.6);
  cur = cur.map((v, i) => v + (tg.rgb[i] - v) * a) as RGB; curVig += (tg.vig - curVig) * a;
  c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = `rgb(${cur[0] | 0},${cur[1] | 0},${cur[2] | 0})`; c.fillRect(0, 0, w, h);
  if (curVig > .01) { c.globalCompositeOperation = 'source-over'; const gr = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .38, w / 2, h / 2, Math.max(w, h) * .78); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(4,4,8,${curVig.toFixed(3)})`); c.fillStyle = gr; c.fillRect(0, 0, w, h); }
  c.restore(); return cur;
}

// ---------------------------------------------------------------- floor / wall / prop painters
const line = (x: X, a: number, b: number, c: number, d: number, col: string, w = 1) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); };
const blob = (x: X, px: number, py: number, rr: number, col: string, sq = 1, rot = 0) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(1, sq); const g = x.createRadialGradient(0, 0, 0, 0, 0, rr); g.addColorStop(0, col); g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); x.fillStyle = g; x.beginPath(); x.arc(0, 0, rr, 0, 7); x.fill(); x.restore(); };
const chip = (x: X, r: () => number, px: number, py: number, s: number, col: string) => { x.fillStyle = col; x.beginPath(); const n = 4 + (r() * 2 | 0); for (let i = 0; i < n; i++) { const a = i / n * 6.283 + r(), rr = s * (.6 + r() * .5); i ? x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr) : x.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } x.closePath(); x.fill(); };

export function floorLayer(x: X, kind: FloorKind, S: number, r: () => number, v: number, zone: string) {
  const m = 26; const P = () => [m + r() * (S - 2 * m), m + r() * (S - 2 * m)] as const; x.save();
  switch (kind) {
    case 'drains': if (v % 3 === 0 || zone === 'proc') { const [px, py] = P(); blob(x, px, py, 40, 'rgba(10,12,14,.3)', .8); x.fillStyle = 'rgba(8,8,10,.8)'; x.beginPath(); x.arc(px, py, 15, 0, 7); x.fill(); x.strokeStyle = 'rgba(170,170,160,.35)'; x.lineWidth = 2.5; x.stroke(); for (let i = -2; i <= 2; i++) line(x, px + i * 5, py - 12, px + i * 5, py + 12, 'rgba(120,120,112,.5)', 1.6); } break;
    case 'chevrons': { const y0 = 40 + (v % 3) * 38; x.fillStyle = 'rgba(196,170,80,.4)'; for (let i = 0; i < 3; i++) { const px = 22 + i * 56; x.beginPath(); x.moveTo(px, y0); x.lineTo(px + 26, y0 + 22); x.lineTo(px, y0 + 44); x.lineTo(px + 12, y0 + 44); x.lineTo(px + 38, y0 + 22); x.lineTo(px + 12, y0); x.closePath(); x.fill(); } x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(0,0,0,${.2 + r() * .3})`; x.fillRect(r() * S, y0 + r() * 44, 1 + r() * 4, 1 + r() * 3); } break; }
    case 'cables': { const y0 = 30 + r() * (S - 60), amp = 6 + r() * 10; for (const [w, col] of [[9, 'rgba(6,6,8,.75)'], [3, 'rgba(90,96,104,.45)']] as const) { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); for (let k = 0; k <= S; k += 8) x.lineTo(k, y0 + Math.sin(k / S * 6.283) * amp - (w === 3 ? 2 : 0)); x.stroke(); } for (let k = 40; k < S; k += 70) { x.fillStyle = 'rgba(70,74,80,.85)'; x.fillRect(k - 5, y0 + Math.sin(k / S * 6.283) * amp - 8, 10, 16); } break; }
    case 'rubble': for (let i = 0; i < 16; i++) { const [px, py] = P(); chip(x, r, px + 1.5, py + 2, 4 + r() * 5, 'rgba(0,0,0,.35)'); chip(x, r, px, py, 3 + r() * 5, `rgba(${120 + r() * 50 | 0},${116 + r() * 40 | 0},${106 + r() * 36 | 0},.7)`); } break;
    case 'rustflake': for (let i = 0; i < 4; i++) { const [px, py] = P(); blob(x, px, py, 22 + r() * 20, 'rgba(140,70,34,.38)', .7, r() * 3); for (let j = 0; j < 7; j++) chip(x, r, px + (r() - .5) * 34, py + (r() - .5) * 20, 1.5 + r() * 2, 'rgba(176,96,48,.65)'); } break;
    case 'silt': for (let i = 0; i < 6; i++) { const [px, py] = P(); x.strokeStyle = `rgba(220,206,170,${.12 + r() * .1})`; x.lineWidth = 3 + r() * 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(px - 30, py); x.quadraticCurveTo(px, py - 8 - r() * 8, px + 34, py + 4); x.stroke(); } blob(x, S * .3, S * .7, 50, 'rgba(60,44,28,.22)', .6); break;
    case 'frost': for (let i = 0; i < 4; i++) { const [px, py] = P(); blob(x, px, py, 26 + r() * 22, 'rgba(220,238,255,.34)', .7, r() * 3); for (let j = 0; j < 5; j++) { const a = r() * 6.283, l = 10 + r() * 18; line(x, px, py, px + Math.cos(a) * l, py + Math.sin(a) * l, 'rgba(240,250,255,.5)', 1); } } break;
    case 'oil': { const [px, py] = P(); blob(x, px, py, 44, 'rgba(4,4,6,.55)', .55, r() * 3); x.strokeStyle = 'rgba(130,150,160,.25)'; x.lineWidth = 2; x.beginPath(); x.ellipse(px - 6, py - 3, 20, 9, .3, 3.5, 5.2); x.stroke(); break; }
    case 'tilewear': for (let i = 0; i < 3; i++) { const tx = Math.floor(r() * 4) * 48, ty = Math.floor(r() * 4) * 48; x.fillStyle = 'rgba(20,20,22,.22)'; x.fillRect(tx + 2, ty + 2, 44, 44); line(x, tx + 4, ty + 8, tx + 40, ty + 34, 'rgba(10,10,10,.55)', 1.6); line(x, tx + 22, ty + 20, tx + 14, ty + 42, 'rgba(10,10,10,.45)', 1.2); } break;
    case 'cinder': for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${40 + r() * 30 | 0},${34 + r() * 20 | 0},${30 + r() * 20 | 0},${.4 + r() * .3})`; x.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 2); } for (let i = 0; i < 4; i++) { const [px, py] = P(); blob(x, px, py, 5, 'rgba(255,120,40,.5)'); } break;
    case 'moss': for (let i = 0; i < 4; i++) { const [px, py] = P(); blob(x, px, py, 24 + r() * 24, 'rgba(70,88,44,.4)', .65, r() * 3); blob(x, px + 6, py, 12, 'rgba(110,130,70,.28)'); } break;
    case 'glass': for (let i = 0; i < 12; i++) { const [px, py] = P(); chip(x, r, px, py, 3 + r() * 5, 'rgba(190,220,230,.3)'); x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(px - 1, py - 1, 2, 2); } break;
    case 'paper': for (let i = 0; i < 9; i++) { const [px, py] = P(); x.save(); x.translate(px, py); x.rotate(r() * 6); x.fillStyle = r() < .2 ? 'rgba(168,60,52,.7)' : 'rgba(224,218,200,.65)'; x.fillRect(-7, -5, 14, 10); x.fillStyle = 'rgba(40,40,40,.35)'; x.fillRect(-5, -2, 9, 1.2); x.fillRect(-5, 1, 6, 1.2); x.restore(); } break;
    case 'bays': { x.strokeStyle = 'rgba(214,206,160,.4)'; x.lineWidth = 4; x.strokeRect(24, 24, S - 48, S - 56); x.fillStyle = 'rgba(214,206,160,.34)'; x.font = 'bold 40px "Arial Narrow",Impact,sans-serif'; x.textAlign = 'center'; x.fillText(String.fromCharCode(65 + (v * 3 + zone.length) % 22) + (1 + (v * 5) % 9), S / 2, S / 2 + 14); x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(r() * S, r() * S, 2 + r() * 5, 1 + r() * 2); } break; }
    case 'wet': for (let i = 0; i < 3; i++) { const [px, py] = P(); blob(x, px, py, 30 + r() * 26, 'rgba(60,92,104,.42)', .55, r() * 3); x.strokeStyle = 'rgba(190,220,230,.22)'; x.lineWidth = 1.2; x.beginPath(); x.ellipse(px, py, 14 + r() * 8, 6, 0, 0, 7); x.stroke(); } break;
  }
  x.restore();
}
export function wallLayer(x: X, kind: WallKind, W: number, H: number, r: () => number, v: number) {
  x.save();
  switch (kind) {
    case 'pipes': for (let i = 0; i < 2 + (v % 2); i++) { const y = H * (.22 + i * .2 + r() * .06), t = 7 + r() * 5; x.fillStyle = 'rgba(8,8,10,.5)'; x.fillRect(0, y + 3, W, t); const g = x.createLinearGradient(0, y, 0, y + t); g.addColorStop(0, 'rgba(150,146,134,.7)'); g.addColorStop(.5, 'rgba(84,82,76,.8)'); g.addColorStop(1, 'rgba(30,30,30,.8)'); x.fillStyle = g; x.fillRect(0, y, W, t); for (let k = 30 + r() * 20; k < W; k += 60 + r() * 30) { x.fillStyle = 'rgba(40,40,42,.9)'; x.fillRect(k, y - 3, 7, t + 6); } } break;
    case 'vents': { const px = W * (.18 + r() * .5), py = H * .22, w = 54, h = 34; x.fillStyle = 'rgba(10,10,12,.85)'; x.fillRect(px, py, w, h); for (let i = 1; i < 6; i++) line(x, px + 3, py + i * h / 6, px + w - 3, py + i * h / 6, 'rgba(120,118,110,.6)', 2); x.strokeStyle = 'rgba(140,138,130,.5)'; x.lineWidth = 2; x.strokeRect(px, py, w, h); const g = x.createLinearGradient(0, py + h, 0, py + h + 70); g.addColorStop(0, 'rgba(10,10,10,.4)'); g.addColorStop(1, 'rgba(10,10,10,0)'); x.fillStyle = g; x.fillRect(px + 6, py + h, w - 12, 70); break; }
    case 'stencil': { const t = ['SECTOR ' + (1 + v * 3 % 9), 'LINE ' + (2 + v), 'NO ENTRY', 'BAY ' + (4 + v * 2), 'LOT ' + String.fromCharCode(65 + v)][v % 5]; x.fillStyle = 'rgba(214,206,176,.42)'; x.font = 'bold 24px "Arial Narrow",Impact,sans-serif'; x.textAlign = 'center'; x.fillText(t, W * .5, H * .36); x.fillRect(W * .5 - 44, H * .36 + 8, 88, 3); break; }
    case 'drips': for (let i = 0; i < 6; i++) { const px = r() * W, l = H * (.3 + r() * .5); const g = x.createLinearGradient(0, 0, 0, l); g.addColorStop(0, 'rgba(8,10,12,.5)'); g.addColorStop(1, 'rgba(8,10,12,0)'); x.fillStyle = g; x.fillRect(px, 0, 2 + r() * 4, l); } break;
    case 'panels': for (let i = 1; i < 4; i++) line(x, i * W / 4, 0, i * W / 4, H, 'rgba(0,0,0,.28)', 2); for (let i = 0; i < 2; i++) { const px = W * (.1 + r() * .6), py = H * (.15 + r() * .3); x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(px, py, 38, 26); x.strokeStyle = 'rgba(200,200,190,.28)'; x.strokeRect(px, py, 38, 26); for (const [a, b] of [[3, 3], [35, 3], [3, 23], [35, 23]]) { x.fillStyle = 'rgba(190,186,170,.5)'; x.fillRect(px + a - 1, py + b - 1, 2, 2); } } break;
    case 'conduit': for (let i = 0; i < 3; i++) { const px = W * (.12 + i * .3 + r() * .05); x.fillStyle = 'rgba(6,6,8,.6)'; x.fillRect(px + 2, 0, 7, H); x.fillStyle = 'rgba(110,112,116,.55)'; x.fillRect(px, 0, 5, H); if (i === 1) { x.fillStyle = 'rgba(44,46,50,.9)'; x.fillRect(px - 8, H * .4, 22, 24); x.fillStyle = 'rgba(210,150,50,.6)'; x.fillRect(px - 3, H * .4 + 8, 4, 4); } } break;
    case 'posters': for (let i = 0; i < 3; i++) { const px = W * (.08 + i * .3 + r() * .08), py = H * (.14 + r() * .25), w = 34 + r() * 10, h = 44; x.fillStyle = `rgba(${200 + r() * 30 | 0},${190 + r() * 30 | 0},${170 + r() * 30 | 0},.55)`; x.beginPath(); x.moveTo(px, py); x.lineTo(px + w, py + r() * 4); x.lineTo(px + w - r() * 6, py + h); x.lineTo(px + r() * 5, py + h - 3); x.fill(); x.fillStyle = 'rgba(160,60,50,.55)'; x.fillRect(px + 4, py + 5, w - 8, 9); for (let j = 0; j < 3; j++) { x.fillStyle = 'rgba(30,30,30,.4)'; x.fillRect(px + 4, py + 20 + j * 7, w - 8 - j * 5, 2); } } break;
    case 'shutters': { const y0 = H * .18, y1 = H * .78; x.fillStyle = 'rgba(70,72,66,.55)'; x.fillRect(W * .12, y0, W * .76, y1 - y0); for (let y = y0; y < y1; y += 7) line(x, W * .12, y, W * .88, y, 'rgba(0,0,0,.32)', 2); x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(W * .12, y0 - 5, W * .76, 6); break; }
    case 'ribs': for (let i = 0; i < 4; i++) { const px = W * (i + .5) / 4 - 7; x.fillStyle = 'rgba(0,0,0,.42)'; x.fillRect(px, 0, 14, H); x.fillStyle = 'rgba(210,206,190,.12)'; x.fillRect(px, 0, 3, H); } break;
  }
  x.restore();
}
export function propLayer(x: X, kind: PropKit, W: number, H: number, r: () => number, v: number, top: boolean) {
  x.save();
  if (top) { if (kind === 'rust' || kind === 'tarp') { blob(x, W * (.3 + r() * .4), H * (.3 + r() * .4), W * .3, kind === 'rust' ? 'rgba(130,64,30,.32)' : 'rgba(170,176,160,.3)', .8, r() * 3); } x.restore(); return; }
  switch (kind) {
    case 'drums': x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, H * .3, W, 4); x.fillRect(0, H * .66, W, 4); x.fillStyle = 'rgba(210,200,170,.22)'; x.fillRect(0, H * .3 + 4, W, 2); x.fillRect(0, H * .66 + 4, W, 2); break;
    case 'tape': x.save(); x.beginPath(); x.rect(0, H * .3, W, H * .2); x.clip(); for (let i = -4; i < 12; i++) { x.fillStyle = i % 2 ? 'rgba(20,20,20,.7)' : 'rgba(200,170,60,.7)'; x.beginPath(); x.moveTo(i * 16, H * .5); x.lineTo(i * 16 + 8, H * .5); x.lineTo(i * 16 + 24, H * .3); x.lineTo(i * 16 + 16, H * .3); x.fill(); } x.restore(); break;
    case 'hazmat': x.fillStyle = 'rgba(210,180,50,.7)'; x.beginPath(); x.moveTo(W * .5, H * .18); x.lineTo(W * .5 + 16, H * .18 + 28); x.lineTo(W * .5 - 16, H * .18 + 28); x.closePath(); x.fill(); x.fillStyle = 'rgba(20,20,20,.8)'; x.fillRect(W * .5 - 1.5, H * .18 + 9, 3, 11); x.fillRect(W * .5 - 1.5, H * .18 + 22, 3, 3); break;
    case 'tarp': { const g = x.createLinearGradient(0, H * .1, W, H * .5); g.addColorStop(0, 'rgba(120,128,112,.62)'); g.addColorStop(1, 'rgba(70,76,66,.62)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, H * .1); x.lineTo(W, H * .1); x.lineTo(W, H * .52); x.lineTo(W * .7, H * .44); x.lineTo(W * .4, H * .56); x.lineTo(0, H * .46); x.closePath(); x.fill(); for (let i = 1; i < 5; i++) line(x, i * W / 5, H * .1, i * W / 5 + (r() - .5) * 12, H * .5, 'rgba(0,0,0,.25)', 2); break; }
    case 'plate': x.fillStyle = 'rgba(30,32,34,.8)'; x.fillRect(W * .12, H * .12, 48, 22); x.fillStyle = 'rgba(206,200,176,.7)'; x.font = 'bold 11px "Arial Narrow",sans-serif'; x.fillText('SN ' + (1000 + v * 137 + (r() * 90 | 0)), W * .12 + 4, H * .12 + 15); for (const [a, b] of [[2, 2], [44, 2], [2, 18], [44, 18]]) { x.fillStyle = 'rgba(200,196,180,.5)'; x.fillRect(W * .12 + a, H * .12 + b, 2, 2); } break;
    case 'lightbar': { x.fillStyle = 'rgba(10,10,12,.85)'; x.fillRect(W * .15, H * .12, W * .7, 9); const c = v % 2 ? '255,176,70' : '150,210,230'; const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, `rgba(${c},.2)`); g.addColorStop(.5, `rgba(${c},.85)`); g.addColorStop(1, `rgba(${c},.2)`); x.fillStyle = g; x.fillRect(W * .17, H * .12 + 2, W * .66, 5); break; }
    case 'rust': for (let i = 0; i < 3; i++) { const px = r() * W; const g = x.createLinearGradient(0, H * .2, 0, H); g.addColorStop(0, 'rgba(130,64,30,.5)'); g.addColorStop(1, 'rgba(130,64,30,0)'); x.fillStyle = g; x.fillRect(px, H * .2, 4 + r() * 8, H * (.3 + r() * .5)); } break;
  }
  x.restore();
}
/** floor-scatter decals baked into the organic overlay (OP px per tile) */
export function decal(x: X, kind: DecalKind, px: number, py: number, OP: number, R: () => number) {
  x.save(); x.translate(px, py); x.rotate(R() * 6.283);
  switch (kind) {
    case 'tire': x.strokeStyle = 'rgba(8,8,8,.3)'; x.lineWidth = OP * .22; for (const o of [-.28, .28]) { x.beginPath(); x.moveTo(-OP * 1.4, o * OP); x.quadraticCurveTo(0, o * OP + OP * .2, OP * 1.4, o * OP); x.stroke(); } break;
    case 'chalk': x.strokeStyle = 'rgba(230,226,210,.32)'; x.lineWidth = 1.4; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * 4 - 6, -6); x.lineTo(i * 4 - 6, 6); x.stroke(); } x.beginPath(); x.moveTo(-8, 4); x.lineTo(10, -4); x.stroke(); break;
    case 'boots': x.fillStyle = 'rgba(10,10,10,.26)'; for (let i = 0; i < 5; i++) { x.beginPath(); x.ellipse(i * OP * .5 - OP, (i % 2 ? 1 : -1) * OP * .16, OP * .15, OP * .09, 0, 0, 7); x.fill(); } break;
    case 'scorch': blob(x, 0, 0, OP * 1.1, 'rgba(6,5,4,.5)', .7); blob(x, 0, 0, OP * .45, 'rgba(120,52,24,.18)', .7); break;
    case 'frost': blob(x, 0, 0, OP * .9, 'rgba(226,240,255,.22)', .6); x.strokeStyle = 'rgba(240,250,255,.32)'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, l = OP * (.4 + R() * .5); line(x, 0, 0, Math.cos(a) * l, Math.sin(a) * l, 'rgba(240,250,255,.32)', 1); } break;
    case 'puddle': blob(x, 0, 0, OP * .9, 'rgba(40,62,74,.42)', .55); x.strokeStyle = 'rgba(190,220,232,.2)'; x.lineWidth = 1; x.beginPath(); x.ellipse(0, 0, OP * .45, OP * .2, 0, 0, 7); x.stroke(); break;
    case 'shards': for (let i = 0; i < 7; i++) { chip(x, R, (R() - .5) * OP * 1.2, (R() - .5) * OP * .9, 2 + R() * 3, 'rgba(200,226,236,.34)'); } break;
    case 'paper': for (let i = 0; i < 3; i++) { x.save(); x.translate((R() - .5) * OP, (R() - .5) * OP * .7); x.rotate(R() * 6); x.fillStyle = 'rgba(222,216,198,.5)'; x.fillRect(-4, -3, 8, 6); x.restore(); } break;
    case 'bloom': blob(x, 0, 0, OP * .8, 'rgba(126,64,30,.3)', .6); break;
    case 'scars': x.strokeStyle = 'rgba(8,8,8,.42)'; x.lineWidth = 1.6; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(i * 4 - 4, -OP * .4); x.lineTo(i * 4 - 2 + R() * 3, OP * .4); x.stroke(); } blob(x, 0, 0, OP * .35, 'rgba(210,190,120,.12)'); break;
    case 'arrow': x.fillStyle = 'rgba(196,170,80,.26)'; x.beginPath(); x.moveTo(-OP * .6, -OP * .12); x.lineTo(OP * .1, -OP * .12); x.lineTo(OP * .1, -OP * .3); x.lineTo(OP * .65, 0); x.lineTo(OP * .1, OP * .3); x.lineTo(OP * .1, OP * .12); x.lineTo(-OP * .6, OP * .12); x.closePath(); x.fill(); break;
    case 'sludge': blob(x, 0, 0, OP * 1.2, 'rgba(34,28,18,.5)', .5); blob(x, OP * .3, 0, OP * .5, 'rgba(70,60,36,.3)', .6); break;
    case 'tufts': x.strokeStyle = 'rgba(90,104,60,.5)'; x.lineWidth = 1.2; for (let i = 0; i < 7; i++) { const bx = (R() - .5) * OP * .8; line(x, bx, 0, bx + (R() - .5) * 5, -4 - R() * 6, 'rgba(90,104,60,.5)', 1.2); } break;
    case 'hand': x.fillStyle = 'rgba(110,30,26,.3)'; x.beginPath(); x.ellipse(0, 0, 5, 6.5, 0, 0, 7); x.fill(); for (let i = -2; i <= 2; i++) { x.beginPath(); x.ellipse(i * 2.6, -8 - (2 - Math.abs(i)) * 1.1, 1.2, 3.2, i * .12, 0, 7); x.fill(); } break;
  }
  x.restore();
}
// ---------------------------------------------------------------- ambient particles (screen space)
export function particles(c: X, kind: ParticleKind, w: number, h: number, t: number, n = 22) {
  c.save();
  for (let i = 0; i < n; i++) {
    const s1 = (Math.sin(i * 12.9898) * 43758.5453) % 1, s2 = (Math.sin(i * 78.233) * 12345.678) % 1, a1 = Math.abs(s1), a2 = Math.abs(s2); const ph = (t * (.05 + a2 * .08) + a1) % 1;
    let x = a1 * w, y = a2 * h, al = 0, sz = 1.4;
    switch (kind) {
      case 'embers': y = h * (1 - ph); x = (a1 * w + Math.sin(t * .8 + i) * 18) % w; al = Math.sin(ph * 3.14) * .55; c.fillStyle = `rgba(255,${110 + a2 * 80 | 0},40,${al})`; sz = 1.2 + a2 * 1.4; break;
      case 'ash': x = (a1 * w + ph * w * .3) % w; y = h * ph; al = Math.sin(ph * 3.14) * .3; c.fillStyle = `rgba(190,186,180,${al})`; sz = 1.3 + a1; break;
      case 'steam': y = h * (1 - ph); x = a1 * w + Math.sin(t * .4 + i) * 24; al = Math.sin(ph * 3.14) * .1; c.fillStyle = `rgba(220,226,226,${al})`; sz = 10 + ph * 22; break;
      case 'paper': x = (a1 * w + ph * w * .5) % w; y = h * ph * .9 + Math.sin(t + i) * 8; al = Math.sin(ph * 3.14) * .34; c.fillStyle = `rgba(226,220,202,${al})`; sz = 2.4; break;
      case 'drips': y = h * ((ph * 2.4) % 1); x = a1 * w; al = .26; c.fillStyle = `rgba(160,190,206,${al})`; c.fillRect(x, y, 1, 7); continue;
      case 'frost': y = h * ph; x = (a1 * w + Math.sin(t * .5 + i) * 20) % w; al = Math.sin(ph * 3.14) * .5; c.fillStyle = `rgba(235,246,255,${al})`; sz = 1.1 + a2; break;
      case 'sparks': { const k = (t * .9 + a1 * 7) % 4; if (k > .16) continue; al = .85 * (1 - k / .16); c.fillStyle = `rgba(255,${200 + a2 * 40 | 0},120,${al})`; x = a1 * w; y = a2 * h; sz = 2.1; break; }
      case 'moths': { const R = 14 + a2 * 22; x = a1 * w + Math.cos(t * (.6 + a2) + i) * R; y = a2 * h * .9 + Math.sin(t * (.9 + a1) + i) * R * .6; al = .4; c.fillStyle = `rgba(226,214,190,${al})`; sz = 1.6; break; }
      case 'bubbles': y = h * (1 - ph); x = a1 * w + Math.sin(t + i) * 6; al = Math.sin(ph * 3.14) * .36; c.strokeStyle = `rgba(200,236,226,${al})`; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 2 + a2 * 3, 0, 7); c.stroke(); continue;
      case 'static': { const k = (t * 1.3 + a1 * 5) % 3; if (k > .12) continue; al = .5; c.fillStyle = `rgba(190,210,255,${al})`; x = a1 * w; y = a2 * h; c.fillRect(x, y, 14 + a2 * 22, 1); continue; }
    }
    if (al <= .01) continue; if (kind === 'steam') { c.beginPath(); c.arc(x, y, sz, 0, 7); c.fill(); } else c.fillRect(x, y, sz, sz);
  }
  c.restore();
}
export const zoneNameAt = (L: Level, px: number, py: number): string => { const ix = Math.floor(px), iy = Math.floor(py); if (ix < 0 || iy < 0 || ix >= L.w || iy >= L.h) return 'proc'; return L.zoneNames?.[L.zone[iy * L.w + ix]] || 'proc'; };
