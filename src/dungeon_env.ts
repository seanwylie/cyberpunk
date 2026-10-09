// Dungeon-pack visual identity (purely visual; collisions/sim untouched):
//  - themed floor/wall/prop textures: the procedural Annex textures (envtex.ts) are re-graded per dungeon (Foundry / Clinic / Warehouse) with colour-blend + detail layers,
//    plus grit swatches cut from the concept sheets (tools/dungeons/make_tex.py -> public/dungeons/tex). Built once, cached, warmed in the background.
//  - per-hazard rendering: slag troughs (muted animated molten surface), furnace heat grate, press plates / stamping press (cycle), spilled fluid sheen, spinning saw rigs,
//    pallet-jack lanes, collapsed shelving, crane drop zones with swinging hook. Red windup warning of boss/elite zones is NOT touched (render.ts keeps it).
//  - lighting pools (additive), dust / steam / embers, boss-arena floor identity (furnace ring, operating amphitheatre tiers, retrieval-hall ring platform).
//  - themeScatter(): per-dungeon floor litter used by the organic floor overlay (less square, less repetitive).
import type { Renderer } from './render';
import type { Level } from './level';
import type { Zone } from './sim';
const S = 192;
const rng = (seed: number) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
export const themeOf = (L: Level | null | undefined): string => (L as any)?.theme || (L?.kind === 'annex' ? 'annex' : '');
export const isDungeonTheme = (t: string) => t === 'foundry' || t === 'clinic' || t === 'warehouse';
const loadImg = (src: string) => new Promise<HTMLImageElement | null>(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
const line = (x: CanvasRenderingContext2D, a: number, b: number, c: number, d: number, col: string, w = 1) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); };
function stripes(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, a: string, b: string, step = 14) { x.save(); x.beginPath(); x.rect(X, Y, W, H); x.clip(); x.fillStyle = b; x.fillRect(X, Y, W, H); x.fillStyle = a; for (let i = -H; i < W + H; i += step * 2) { x.beginPath(); x.moveTo(X + i, Y + H); x.lineTo(X + i + step, Y + H); x.lineTo(X + i + step + H, Y); x.lineTo(X + i + H, Y); x.fill(); } x.restore(); }
function stain(x: CanvasRenderingContext2D, r: () => number, W: number, H: number, col: string, n = 1, size = 1) { for (let i = 0; i < n; i++) { const px = r() * W, py = r() * H, rr = (14 + r() * 34) * size; const g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.save(); x.translate(px, py); x.scale(1 + r() * .8, 1); x.translate(-px, -py); x.beginPath(); x.arc(px, py, rr, 0, 7); x.fill(); x.restore(); } }
function crackp(x: CanvasRenderingContext2D, r: () => number, W: number, H: number, col: string, glow?: string) { let px = r() * W, py = r() * H; const pts: [number, number][] = [[px, py]]; const n = 5 + r() * 5 | 0; for (let i = 0; i < n; i++) { px += (r() - .45) * 34; py += (r() - .3) * 28; pts.push([px, py]); }
  for (const [col2, lw] of [[col, 2.4], [glow, 1]] as [string | undefined, number][]) { if (!col2) continue; x.strokeStyle = col2; x.lineWidth = lw; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); } }
function wear(x: CanvasRenderingContext2D, r: () => number, W: number, H: number, n = 400, a = .1) { for (let i = 0; i < n; i++) { x.fillStyle = r() < .5 ? `rgba(0,0,0,${a * r()})` : `rgba(210,205,190,${a * .5 * r()})`; const s = 1 + r() * 2.5; x.fillRect(r() * W, r() * H, s, s * (r() < .3 ? 3 : 1)); } }
function stencil(x: CanvasRenderingContext2D, t: string, px: number, py: number, size: number, col: string) { x.save(); x.font = `bold ${size}px "Arial Narrow",Impact,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(t, px, py); x.restore(); }
function rivet(x: CanvasRenderingContext2D, px: number, py: number, rr = 2.4) { x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.arc(px + .8, py + 1, rr, 0, 7); x.fill(); x.fillStyle = 'rgba(190,185,168,.3)'; x.beginPath(); x.arc(px, py, rr, 0, 7); x.fill(); }

interface Light { x: number; y: number; r: number; c: 'warm' | 'cool' | 'red' | 'pale'; a: number; fl?: number; }
const LABEL_KIND = (l: string) => /slag/i.test(l) ? 'slag' : /furnace/i.test(l) ? 'furnace' : /press plate/i.test(l) ? 'plate' : /fluid|coolant/i.test(l) ? 'fluid' : /saw/i.test(l) ? 'saw' : /pallet/i.test(l) ? 'lane' : /shelving/i.test(l) ? 'shelf' : /stamping/i.test(l) ? 'press' : /crane/i.test(l) ? 'crane' : '';

export class DungeonArt {
  tex: Record<string, HTMLImageElement> = {}; private pats = new Map<string, CanvasPattern>(); private glows: Record<string, HTMLCanvasElement> = {}; private lights: Light[] = []; private cache = new Map<string, HTMLCanvasElement>();
  private zl = new WeakMap<Level, Light[]>(); private labels = new WeakMap<object, Map<string, string>>(); private dust: { x: number; y: number; z: number; v: number; ph: number }[] = [];
  constructor(base = './dungeons/tex/') {
    for (const n of ['slag', 'tile', 'conc']) loadImg(`${base}${n}.png`).then(i => { if (i) this.tex[n] = i; });
    for (const [k, c] of [['warm', '255,170,92'], ['red', '190,64,36'], ['cool', '130,160,180'], ['pale', '215,222,214']] as const) { const cv = mk(128, 128), x = cv.getContext('2d')!; const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${c},1)`); g.addColorStop(.35, `rgba(${c},.45)`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); this.glows[k] = cv; }
    const R = rng(3); for (let i = 0; i < 46; i++) this.dust.push({ x: R(), y: R(), z: .3 + R() * .7, v: .3 + R(), ph: R() * 6.28 });
  }
  private memo(k: string, f: () => HTMLCanvasElement) { let c = this.cache.get(k); if (!c) { c = f(); this.cache.set(k, c); } return c; }
  private pat(c: CanvasRenderingContext2D, n: string, scale: number): CanvasPattern | null { const im = this.tex[n]; if (!im) return null; const k = n + scale; let p = this.pats.get(k); if (!p) { p = c.createPattern(im, 'repeat')!; this.pats.set(k, p); } (p as any).setTransform?.(new DOMMatrix().scale(scale)); return p; }

  // ============================ textures ============================
  floor(base: HTMLCanvasElement, theme: string, zone: string, v: number): HTMLCanvasElement {
    const cv = mk(S, S), x = cv.getContext('2d')!, r = rng(zone.length * 91 + v * 17 + theme.length * 7); x.drawImage(base, 0, 0);
    const blend = (op: GlobalCompositeOperation, col: string) => { x.globalCompositeOperation = op; x.fillStyle = col; x.fillRect(0, 0, S, S); x.globalCompositeOperation = 'source-over'; };
    const grit = (a: number, name = 'conc', sc = 1.5) => { const p = this.pat(x, name, sc); if (!p) return; x.save(); x.globalAlpha = a; x.globalCompositeOperation = 'overlay'; x.fillStyle = p; x.fillRect(0, 0, S, S); x.restore(); };
    if (theme === 'foundry') {
      blend('color', zone === 'boss' ? 'rgba(104,64,50,.62)' : 'rgba(112,78,64,.5)'); blend('multiply', zone === 'yard' ? 'rgb(176,160,152)' : 'rgb(150,136,130)'); grit(.5);
      if (zone === 'yard' || zone === 'salvage') { if (v === 1 || v === 4 || v === 3) crackp(x, r, S, S, 'rgba(8,6,5,.75)', 'rgba(150,62,30,.38)'); stain(x, r, S, S, 'rgba(60,40,30,.42)', 2); stain(x, r, S, S, 'rgba(10,8,8,.45)', 2, 1.2); }
      if (zone === 'proc') { stain(x, r, S, S, 'rgba(120,70,36,.3)', 2); stain(x, r, S, S, 'rgba(10,8,8,.4)', 2); if (v === 0 || v === 3) { x.fillStyle = 'rgba(150,64,30,.07)'; x.fillRect(0, 0, S, S); } }
      if (zone === 'junction') { x.fillStyle = 'rgba(8,8,9,.55)'; x.fillRect(0, 0, S, S); for (let i = 0; i <= 12; i++) { line(x, i * 16 + 1, 0, i * 16 + 1, S, 'rgba(120,112,104,.55)', 2); line(x, 0, i * 16 + 1, S, i * 16 + 1, 'rgba(120,112,104,.55)', 2); line(x, i * 16 + 3, 0, i * 16 + 3, S, 'rgba(0,0,0,.4)', 1); } stripes(x, 0, 0, S, 8, 'rgba(176,150,70,.35)', 'rgba(20,20,20,.5)', 10); for (const [px, py] of [[10, 10], [S - 10, S - 10]]) rivet(x, px, py, 3); }
      if (zone === 'boss') { const g = x.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S * .8); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(6,4,4,.5)'); x.fillStyle = g; x.fillRect(0, 0, S, S); for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(170,70,36,${.15 + r() * .3})`; x.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); } if (v % 2) crackp(x, r, S, S, 'rgba(6,4,4,.8)', 'rgba(140,56,28,.32)'); }
      if (zone === 'corridor' || zone === 'passage') { stain(x, r, S, S, 'rgba(8,8,8,.45)', 2); }
    } else if (theme === 'clinic') {
      if (zone === 'yard' || zone === 'corridor' || zone === 'passage' || zone === 'salvage' || zone === 'junction') {
        blend('color', 'rgba(196,192,182,.85)'); x.fillStyle = zone === 'junction' ? 'rgba(210,214,216,.1)' : 'rgba(228,224,212,.26)'; x.fillRect(0, 0, S, S); blend('multiply', zone === 'passage' ? 'rgb(190,192,194)' : 'rgb(222,216,204)'); grit(.2, 'tile', 1.2);
        x.strokeStyle = 'rgba(52,50,44,.45)'; x.lineWidth = 2.2; for (const o of [0, S / 2]) { line(x, o, 0, o, S, 'rgba(52,50,44,.45)', 2.2); line(x, 0, o, S, o, 'rgba(52,50,44,.45)', 2.2); } x.fillStyle = 'rgba(255,252,240,.07)'; for (const o of [2, S / 2 + 2]) { x.fillRect(o, 0, 1.5, S); x.fillRect(0, o, S, 1.5); }
        if (v === 3 || v === 1) { const px = 30 + r() * 100, py = 30 + r() * 100; stain(x, r, S, S, 'rgba(40,52,64,.38)', 1, 1.1); x.fillStyle = 'rgba(70,96,120,.22)'; x.beginPath(); x.ellipse(px, py, 32, 18, r() * 3, 0, 7); x.fill(); x.fillStyle = 'rgba(210,225,235,.14)'; x.beginPath(); x.ellipse(px - 6, py - 5, 14, 6, r() * 3, 0, 7); x.fill(); }
        if (v === 2) { stain(x, r, S, S, 'rgba(26,26,26,.35)', 2); crackp(x, r, S, S, 'rgba(25,22,18,.5)'); }
        if (zone === 'junction') { for (let i = 0; i < 3; i++) line(x, 0, 40 + i * 52, S, 40 + i * 52, 'rgba(36,50,64,.55)', 6); line(x, 0, 38, S, 38, 'rgba(120,150,175,.2)', 1.2); }
        if (zone === 'passage' || zone === 'corridor') { line(x, 0, 14, S, 14, 'rgba(96,140,170,.55)', 3); line(x, 0, S - 14, S, S - 14, 'rgba(96,140,170,.55)', 3); for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(140,185,210,.4)'; x.fillRect(10 + i * 24, 11, 4, 6); } }
      } else if (zone === 'proc') { blend('color', 'rgba(124,138,150,.8)'); blend('multiply', 'rgb(192,198,204)'); grit(.35); for (let i = 0; i <= 6; i++) { line(x, i * 32 + 1, 0, i * 32 + 1, S, 'rgba(0,0,0,.35)', 2); line(x, 0, i * 32 + 1, S, i * 32 + 1, 'rgba(0,0,0,.35)', 2); } x.fillStyle = 'rgba(190,205,215,.06)'; x.fillRect(0, 0, S, S); if (v % 3 === 0) stripes(x, 0, S - 16, S, 10, 'rgba(96,130,160,.55)', 'rgba(14,16,20,.55)', 10); if (v === 2) stain(x, r, S, S, 'rgba(50,70,88,.4)', 2); for (const [px, py] of [[12, 12], [S - 12, S - 12]]) rivet(x, px, py, 3); }
      else { // boss: warm polished bronze-brown ceramic
        blend('color', 'rgba(150,112,76,.6)'); blend('multiply', 'rgb(150,136,124)'); grit(.35); for (let i = 0; i <= 4; i++) { line(x, i * 48 + 1, 0, i * 48 + 1, S, 'rgba(0,0,0,.4)', 2); line(x, 0, i * 48 + 1, S, i * 48 + 1, 'rgba(0,0,0,.4)', 2); } const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, 'rgba(255,230,190,.1)'); g.addColorStop(.5, 'rgba(255,230,190,0)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); x.fillStyle = g; x.fillRect(0, 0, S, S); if (v % 2) crackp(x, r, S, S, 'rgba(10,8,6,.55)'); }
    } else if (theme === 'warehouse') {
      blend('color', zone === 'boss' ? 'rgba(96,98,90,.7)' : 'rgba(128,124,108,.6)'); blend('multiply', zone === 'boss' ? 'rgb(150,148,142)' : 'rgb(176,172,160)'); grit(.45);
      line(x, S - 1, 0, S - 1, S, 'rgba(0,0,0,.3)', 2); line(x, 0, S - 1, S, S - 1, 'rgba(0,0,0,.3)', 2);
      if (zone === 'yard' || zone === 'salvage') { if (v === 5) { stripes(x, 0, 0, S, 16, 'rgba(176,150,70,.55)', 'rgba(20,20,20,.6)', 12); } if (v === 4) { x.strokeStyle = 'rgba(176,150,70,.5)'; x.lineWidth = 4; x.strokeRect(24, 24, S - 48, S - 48); } if (v === 3) { x.strokeStyle = 'rgba(10,10,10,.4)'; x.lineWidth = 9; x.beginPath(); x.arc(40, 150, 90, -1.2, -.2); x.stroke(); } if (v === 1) crackp(x, r, S, S, 'rgba(10,10,10,.5)'); stain(x, r, S, S, 'rgba(14,14,12,.38)', 2); }
      if (zone === 'proc') { line(x, 0, 6, S, 6, 'rgba(176,150,70,.45)', 4); if (v % 2) line(x, 0, S - 6, S, S - 6, 'rgba(176,150,70,.45)', 4); if (v === 2) { x.fillStyle = 'rgba(14,14,12,.28)'; x.fillRect(30, 40, 130, 100); } stain(x, r, S, S, 'rgba(16,14,10,.38)', 2); }
      if (zone === 'junction') { blend('multiply', 'rgb(160,164,150)'); for (let i = 0; i <= 6; i++) line(x, i * 32 + 1, 0, i * 32 + 1, S, 'rgba(0,0,0,.28)', 2); stripes(x, 0, 0, S, 8, 'rgba(176,150,70,.4)', 'rgba(20,20,20,.55)', 10); x.fillStyle = 'rgba(107,112,53,.18)'; x.fillRect(0, S * .45, S, 28); for (const [px, py] of [[10, 10], [S - 10, S - 10]]) rivet(x, px, py, 3); }
      if (zone === 'boss') { stain(x, r, S, S, 'rgba(0,0,0,.28)', 2); if (v === 5) stripes(x, 0, S - 14, S, 10, 'rgba(176,150,70,.45)', 'rgba(20,20,20,.6)', 11); if (v % 2) crackp(x, r, S, S, 'rgba(8,8,8,.6)'); for (const [px, py] of [[12, 12], [S - 12, S - 12]]) rivet(x, px, py, 3); }
      if (zone === 'passage' || zone === 'corridor') { x.fillStyle = 'rgba(107,112,53,.14)'; x.fillRect(0, 0, S, S); stain(x, r, S, S, 'rgba(10,10,10,.3)', 1); }
    }
    wear(x, r, S, S, 140, .1); return cv;
  }
  wall(base: HTMLCanvasElement, theme: string, style: string, v: number, zone: string): HTMLCanvasElement {
    const W = base.width, H = base.height, cv = mk(W, H), x = cv.getContext('2d')!, r = rng(v * 59 + theme.length * 31 + style.length); x.drawImage(base, 0, 0);
    const blend = (op: GlobalCompositeOperation, col: string) => { x.globalCompositeOperation = op; x.fillStyle = col; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; };
    if (theme === 'foundry') {
      blend('color', 'rgba(118,72,56,.55)'); blend('multiply', 'rgb(158,142,136)'); for (let i = 1; i < 4; i++) { line(x, i * W / 4, 0, i * W / 4, H, 'rgba(0,0,0,.45)', 3); line(x, i * W / 4 + 3, 0, i * W / 4 + 3, H, 'rgba(210,150,120,.08)', 1); for (const yy of [H * .1, H * .5, H * .9]) rivet(x, i * W / 4 - 9, yy, 2.4); }
      for (let i = 0; i < 6; i++) { const px = r() * W, wd = 5 + r() * 12, len = H * (.3 + r() * .6); const g = x.createLinearGradient(0, H * .15, 0, H * .15 + len); g.addColorStop(0, 'rgba(110,50,26,.35)'); g.addColorStop(1, 'rgba(110,50,26,0)'); x.fillStyle = g; x.fillRect(px, H * .15, wd, len); }
      if (v % 3 === 1) { const vy = H * .42; x.fillStyle = 'rgba(8,6,6,.85)'; x.fillRect(48, vy, 96, 54); for (let i = 0; i < 5; i++) line(x, 52, vy + 6 + i * 9, 140, vy + 6 + i * 9, 'rgba(120,70,48,.6)', 3); const g = x.createLinearGradient(0, vy + 54, 0, vy + 84); g.addColorStop(0, 'rgba(160,64,30,.28)'); g.addColorStop(1, 'rgba(160,64,30,0)'); x.fillStyle = g; x.fillRect(40, vy + 54, 112, 30); }
      if (v % 3 === 2) { stripes(x, 0, H * .8, W, 14, 'rgba(176,150,70,.55)', 'rgba(20,20,20,.7)', 13); stencil(x, 'HB-7', W / 2, H * .5, 30, 'rgba(190,160,140,.4)'); }
      if (v === 0) { for (let k = 0; k < 2; k++) { const py = H * .16 + k * 24; x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, py + 5, W, 12); const g = x.createLinearGradient(0, py, 0, py + 14); g.addColorStop(0, 'rgb(70,44,36)'); g.addColorStop(.4, 'rgb(150,100,80)'); g.addColorStop(1, 'rgb(40,26,22)'); x.fillStyle = g; x.fillRect(0, py, W, 13); } }
    } else if (theme === 'clinic') {
      const split = H * .6; const g0 = x.createLinearGradient(0, 0, 0, H); // upper dark steel / glass, lower ivory ceramic tile
      blend('color', 'rgba(100,112,124,.6)'); blend('multiply', 'rgb(170,178,186)');
      x.fillStyle = 'rgba(206,198,176,.92)'; x.fillRect(0, split, W, H - split); x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgb(210,204,190)'; x.fillRect(0, split, W, H - split); x.globalCompositeOperation = 'source-over'; void g0;
      for (let i = 0; i <= W; i += 24) line(x, i, split, i, H, 'rgba(60,56,48,.4)', 1.6); for (let j = split; j <= H; j += 24) line(x, 0, j, W, j, 'rgba(60,56,48,.4)', 1.6);
      for (let i = 0; i < 10; i++) { x.fillStyle = `rgba(40,36,30,${.05 + r() * .12})`; x.fillRect(Math.floor(r() * 8) * 24, split + Math.floor(r() * 5) * 24, 24, 24); }
      x.fillStyle = 'rgba(70,98,124,.85)'; x.fillRect(0, split - 5, W, 9); x.fillStyle = 'rgba(210,225,235,.18)'; x.fillRect(0, split - 5, W, 2);
      for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(14,16,20,.8)'; x.fillRect(12 + i * 46, H * .08, 38, split - H * .2); x.fillStyle = 'rgba(110,140,160,.16)'; x.fillRect(14 + i * 46, H * .08 + 2, 34, (split - H * .2) * .45); line(x, 12 + i * 46, H * .08, 12 + i * 46, split - H * .12, 'rgba(120,125,130,.7)', 2); }
      if (v % 3 === 0) { x.fillStyle = 'rgba(40,52,66,.95)'; x.fillRect(W / 2 - 40, H * .12, 80, 46); stencil(x, 'WARD 9', W / 2, H * .12 + 16, 18, 'rgba(210,225,235,.8)'); x.fillStyle = 'rgba(100,150,180,.7)'; x.fillRect(W / 2 - 6, H * .12 + 28, 12, 3); x.fillRect(W / 2 - 1.5, H * .12 + 24, 3, 12); }
      if (v === 1) { x.fillStyle = 'rgba(80,110,134,.7)'; x.beginPath(); x.arc(W - 30, H * .2, 4, 0, 7); x.fill(); }
      const g = x.createLinearGradient(0, 0, 0, 26); g.addColorStop(0, 'rgba(210,225,235,.12)'); g.addColorStop(1, 'rgba(210,225,235,0)'); x.fillStyle = g; x.fillRect(0, 0, W, 26);
    } else if (theme === 'warehouse') {
      blend('color', 'rgba(104,108,86,.55)'); blend('multiply', 'rgb(170,170,160)'); for (let i = 0; i < 24; i++) { const px = i * (W / 24); x.fillStyle = 'rgba(0,0,0,.26)'; x.fillRect(px + W / 48, 0, 3, H); x.fillStyle = 'rgba(235,232,210,.08)'; x.fillRect(px, 0, 2, H); }
      x.fillStyle = 'rgba(56,58,46,.55)'; x.fillRect(0, H * .86, W, H * .14); stripes(x, 0, H * .78, W, 10, 'rgba(176,150,70,.5)', 'rgba(20,20,20,.65)', 12);
      if (v % 3 === 0) { stencil(x, 'BAY ' + (1 + v * 2), W / 2, H * .3, 28, 'rgba(214,206,170,.6)'); x.strokeStyle = 'rgba(214,206,170,.35)'; x.lineWidth = 3; x.strokeRect(W / 2 - 52, H * .3 - 24, 104, 48); }
      if (v === 2) { x.fillStyle = 'rgba(8,8,8,.7)'; x.fillRect(14, H * .12, W - 28, 7); x.fillStyle = 'rgba(205,212,200,.5)'; x.fillRect(18, H * .12 + 1, W - 36, 3); }
      if (v === 4) { x.fillStyle = 'rgba(14,14,12,.7)'; x.fillRect(40, H * .36, 110, 70); for (let i = 1; i < 6; i++) line(x, 40, H * .36 + i * 11.6, 150, H * .36 + i * 11.6, 'rgba(0,0,0,.5)', 2); x.strokeStyle = 'rgba(180,170,140,.35)'; x.strokeRect(40, H * .36, 110, 70); }
      if (v === 5) { stencil(x, 'K', W / 2, H * .45, 60, 'rgba(176,168,130,.4)'); }
      for (const [px, py] of [[10, 12], [W - 10, 12], [10, H - 12], [W - 10, H - 12]]) rivet(x, px, py, 2.4);
    }
    const g2 = x.createLinearGradient(0, H * .75, 0, H); g2.addColorStop(0, 'rgba(8,8,8,0)'); g2.addColorStop(1, 'rgba(8,8,8,.4)'); x.fillStyle = g2; x.fillRect(0, H * .75, W, H * .25); wear(x, r, W, H, 260, .1); return cv;
  }
  prop(base: HTMLCanvasElement, theme: string, kind: string, v: number, top: boolean): HTMLCanvasElement {
    const W = base.width, H = base.height, cv = mk(W, H), x = cv.getContext('2d')!, r = rng(v * 11 + kind.length + theme.length); x.drawImage(base, 0, 0);
    const blend = (op: GlobalCompositeOperation, col: string) => { x.globalCompositeOperation = op; x.fillStyle = col; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; };
    if (theme === 'foundry') {
      blend('color', kind === 'crate' ? (v % 2 ? 'rgba(118,60,44,.65)' : 'rgba(70,64,62,.7)') : 'rgba(108,66,52,.5)'); blend('multiply', 'rgb(168,150,144)');
      if (!top && (kind === 'machine' || kind === 'pillar')) { for (let i = 0; i < 3; i++) { const px = 24 + i * 52, py = H * .55; x.fillStyle = 'rgba(8,6,6,.8)'; x.fillRect(px, py, 36, 10); const g = x.createLinearGradient(px, 0, px + 36, 0); g.addColorStop(0, 'rgba(150,60,28,0)'); g.addColorStop(.5, 'rgba(160,66,30,.5)'); g.addColorStop(1, 'rgba(150,60,28,0)'); x.fillStyle = g; x.fillRect(px, py + 1, 36, 8); } }
      if (!top && kind === 'crate') stencil(x, 'HB', W / 2, H * .68, 20, 'rgba(210,190,170,.35)');
    } else if (theme === 'clinic') {
      if (kind === 'crate') { blend('color', 'rgba(204,196,174,.9)'); blend('multiply', 'rgb(224,218,204)'); x.fillStyle = 'rgba(70,98,124,.8)'; if (!top) { x.fillRect(0, H * .45, W, 12); x.fillStyle = 'rgba(30,40,50,.9)'; x.fillRect(W / 2 - 3, H * .2, 6, 28); x.fillRect(W / 2 - 14, H * .2 + 11, 28, 6); x.fillStyle = 'rgba(205,220,230,.55)'; x.fillRect(W / 2 - 2, H * .2 + 1, 4, 26); } else { x.fillRect(0, 0, W, 14); x.fillRect(0, S - 14, W, 14); } }
      else { blend('color', 'rgba(150,164,176,.65)'); blend('multiply', 'rgb(196,204,210)'); if (!top && kind === 'machine') { x.fillStyle = 'rgba(12,16,22,.85)'; x.fillRect(W * .12, H * .22, W * .5, H * .26); x.fillStyle = 'rgba(100,140,166,.45)'; x.fillRect(W * .14, H * .24, W * .46, H * .1); x.fillStyle = 'rgba(70,98,124,.9)'; x.fillRect(0, H * .75, W, 10); } if (!top && kind === 'rack') { x.fillStyle = 'rgba(200,210,214,.18)'; x.fillRect(0, 0, W, H); } }
    } else if (theme === 'warehouse') {
      blend('color', kind === 'crate' ? 'rgba(140,114,76,.5)' : 'rgba(104,110,84,.55)'); blend('multiply', 'rgb(176,170,156)');
      if (!top) { x.fillStyle = 'rgba(107,112,53,.5)'; x.fillRect(0, H * (kind === 'crate' ? .5 : .12), W, 9); if (kind === 'crate') { x.fillStyle = 'rgba(214,206,170,.5)'; x.fillRect(W * .18, H * .15, W * .26, H * .22); x.fillStyle = 'rgba(20,20,18,.7)'; for (let i = 0; i < 9; i++) x.fillRect(W * .2 + i * 4.6, H * .18, 2 + (i % 3), H * .16); } }
    }
    wear(x, r, W, H, 100, .1); return cv;
  }

  // ============================ hazards / zones ============================
  private labelOf(r: Renderer, z: Zone): string { const dd = r.g.dd; let m = this.labels.get(dd); if (!m) { m = new Map(); for (const h of dd.hazards) m.set(h.x.toFixed(2) + ',' + h.y.toFixed(2), h.label); this.labels.set(dd, m); } return m.get(z.x.toFixed(2) + ',' + z.y.toFixed(2)) || ''; }
  private iso(r: Renderer, f: (c: CanvasRenderingContext2D) => void) { const c = r.ctx, k = r.TW / 2; c.save(); c.transform(k, k / 2, -k, k / 2, r.sx(0, 0), r.sy(0, 0)); f(c); c.restore(); }
  /** Draws a non-warning zone with its themed art. Returns false to fall back to the generic zone drawing. */
  zone(r: Renderer, z: Zone): boolean {
    const L = r.g.level, th = themeOf(L); if (!isDungeonTheme(th)) return false;
    const px = r.sx(z.x, z.y); if (px < -r.TW * 4 || px > r.w + r.TW * 4) return false; const py = r.sy(z.x, z.y); if (py < -r.TW * 6 || py > r.h + r.TW * 4) return false;
    let kind = z.env ? LABEL_KIND(this.labelOf(r, z)) : (th === 'foundry' ? 'slagpool' : th === 'clinic' ? 'fluid' : 'shelf'); if (!kind) return false;
    const t = r.g.time, red = r.g.save.settings.reducedFx; const fade = z.env ? 1 : Math.min(1, Math.max(0, (z.life - z.t) / .7)) * Math.min(1, (z.t - z.windup) / .25 + .2);
    this.iso(r, c => { c.globalAlpha = fade;
      switch (kind) {
        case 'slag': case 'slagpool': if (z.env && this.rimT !== t) { this.rimT = t; c.fillStyle = 'rgba(10,8,7,.92)'; c.strokeStyle = 'rgba(104,94,84,.7)'; c.lineWidth = .07; for (const o of r.g.zones) if (o.env && LABEL_KIND(this.labelOf(r, o)) === 'slag') { this.circ(c, o.x, o.y, o.r * 1.18); c.fill(); } }
          this.slag(c, z, t, !z.env); this.lights.push({ x: z.x, y: z.y, r: z.r * 2.4, c: 'red', a: .26 * fade, fl: 1 }); break;
        case 'furnace': this.furnace(c, z, t); this.lights.push({ x: z.x, y: z.y, r: z.r * 2.8, c: 'red', a: .22, fl: 1 }); break;
        case 'plate': case 'press': this.press(c, z, t, kind === 'press'); break;
        case 'fluid': this.fluid(c, z, t, !z.env); break;
        case 'saw': this.saw(c, z, t); break;
        case 'lane': this.lane(c, z, t); break;
        case 'shelf': this.shelf(c, z, t); break;
        case 'crane': this.crane(c, z, t); break;
      }
      if (z.env || true) { c.globalAlpha = .28 * fade; c.strokeStyle = 'rgba(176,150,70,1)'; c.lineWidth = .05; c.setLineDash([.28, .22]); c.lineDashOffset = -t * .25; c.beginPath(); c.arc(z.x, z.y, z.r + .03, 0, 7); c.stroke(); c.setLineDash([]); }
    });
    if (kind === 'crane') { const c = r.ctx, a = r.sx(z.x, z.y), b = r.sy(z.x, z.y), TW = r.TW; const sw = Math.sin(t * .9 + z.x) * TW * .1; const hy = b - TW * (1.7 + Math.sin(t * 1.3 + z.y) * .08); c.save(); c.strokeStyle = 'rgba(20,20,20,.85)'; c.lineWidth = Math.max(2, TW * .04); c.beginPath(); c.moveTo(a + sw * .3, b - TW * 5); c.lineTo(a + sw, hy); c.stroke(); c.fillStyle = '#3a3532'; c.fillRect(a + sw - TW * .09, hy, TW * .18, TW * .14); c.strokeStyle = '#8a8070'; c.lineWidth = Math.max(2, TW * .045); c.beginPath(); c.arc(a + sw, hy + TW * .26, TW * .12, -.4, Math.PI * 1.1); c.stroke(); c.restore(); }
    void red; return true;
  }
  private rimT = -1;
  private circ(c: CanvasRenderingContext2D, x: number, y: number, r: number) { c.beginPath(); c.arc(x, y, r, 0, 7); }
  private slag(c: CanvasRenderingContext2D, z: Zone, t: number, loose: boolean) {
    const R = rng((z.x * 131 + z.y * 71) | 0); const rad = z.r; if (loose) { c.fillStyle = 'rgba(10,8,7,.88)'; this.circ(c, z.x, z.y, rad * 1.14); c.fill(); c.strokeStyle = 'rgba(96,88,80,.6)'; c.lineWidth = .06; this.circ(c, z.x, z.y, rad * 1.14); c.stroke(); }
    c.save(); this.circ(c, z.x, z.y, loose ? rad : rad * 1.1); c.clip(); c.fillStyle = '#34150d'; c.fillRect(z.x - rad, z.y - rad, rad * 2, rad * 2);
    const p = this.pat(c, 'slag', 1 / 90); if (p) { for (const [dx, dy, a] of [[t * .06, t * .03, .62], [-t * .045, t * .05 + .4, .36]] as const) { c.save(); c.globalAlpha *= a; c.translate(dx, dy); c.fillStyle = p; c.fillRect(z.x - rad - 1, z.y - rad - 1, rad * 2 + 2, rad * 2 + 2); c.restore(); } }
    c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgb(150,112,100)'; c.fillRect(z.x - rad, z.y - rad, rad * 2, rad * 2); c.globalCompositeOperation = 'source-over';
    const pulse = .55 + .45 * Math.sin(t * 1.3 + z.x * 2.1 + z.y); const g = c.createRadialGradient(z.x, z.y, rad * .1, z.x, z.y, rad); g.addColorStop(0, `rgba(176,70,30,${.14 * pulse})`); g.addColorStop(.7, 'rgba(110,34,16,.0)'); g.addColorStop(1, 'rgba(8,4,3,.7)'); c.fillStyle = g; c.fillRect(z.x - rad, z.y - rad, rad * 2, rad * 2);
    for (let i = 0; i < 5; i++) { const a = R() * 6.28 + t * .05 * (i % 2 ? 1 : -1), d = R() * rad * .8; c.fillStyle = 'rgba(20,10,8,.6)'; c.beginPath(); const cx = z.x + Math.cos(a) * d + Math.sin(t * .3 + i) * .05, cy = z.y + Math.sin(a) * d; for (let k = 0; k < 6; k++) { const aa = k / 6 * 6.28 + R(), rr = .16 + R() * .22; k ? c.lineTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr) : c.moveTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr); } c.closePath(); c.fill(); }
    c.restore();
  }
  private furnace(c: CanvasRenderingContext2D, z: Zone, t: number) {
    const rad = z.r; c.fillStyle = 'rgba(8,7,7,.85)'; this.circ(c, z.x, z.y, rad * 1.05); c.fill(); c.strokeStyle = 'rgba(110,100,92,.55)'; c.lineWidth = .07; this.circ(c, z.x, z.y, rad * 1.05); c.stroke();
    const pulse = .5 + .5 * Math.sin(t * 1.6 + z.x); const g = c.createRadialGradient(z.x, z.y, 0, z.x, z.y, rad); g.addColorStop(0, `rgba(170,66,28,${.34 + .12 * pulse})`); g.addColorStop(1, 'rgba(40,14,8,.15)'); c.fillStyle = g; this.circ(c, z.x, z.y, rad); c.fill();
    c.strokeStyle = 'rgba(10,8,8,.8)'; c.lineWidth = .07; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + t * .08; c.beginPath(); c.moveTo(z.x + Math.cos(a) * rad * .15, z.y + Math.sin(a) * rad * .15); c.lineTo(z.x + Math.cos(a) * rad * .98, z.y + Math.sin(a) * rad * .98); c.stroke(); }
    c.strokeStyle = `rgba(190,90,40,${.12 + .1 * pulse})`; c.lineWidth = .05; this.circ(c, z.x, z.y, rad * (.5 + .12 * pulse)); c.stroke();
  }
  private press(c: CanvasRenderingContext2D, z: Zone, t: number, big: boolean) {
    const s = z.r * .92; const ph = ((t + z.x * .7) % 3.2) / 3.2; const down = ph > .82 ? Math.min(1, (ph - .82) / .06) * (1 - Math.max(0, (ph - .94) / .06)) : 0; c.save(); c.translate(z.x, z.y); c.rotate(.0);
    c.fillStyle = 'rgba(8,8,9,.85)'; c.fillRect(-s * 1.08, -s * 1.08, s * 2.16, s * 2.16); stripeRect(c, -s * 1.08, -s * 1.08, s * 2.16, s * 2.16, s * .16); c.fillStyle = `rgb(${72 - down * 22},${70 - down * 22},${70 - down * 22})`; c.fillRect(-s * .86, -s * .86, s * 1.72, s * 1.72);
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = .05; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-s * .86, i * s * .34); c.lineTo(s * .86, i * s * .34); c.stroke(); } c.fillStyle = `rgba(255,250,235,${.12 - down * .1})`; c.fillRect(-s * .86, -s * .86, s * 1.72, s * .1);
    if (down > 0) { c.fillStyle = `rgba(0,0,0,${.35 * down})`; c.fillRect(-s * 1.2, -s * 1.2, s * 2.4, s * 2.4); } const warnLight = ph > .6 && ph < .84 && Math.sin(t * 18) > 0; c.fillStyle = warnLight ? 'rgba(190,70,50,.9)' : 'rgba(80,40,36,.8)'; this.circ(c, s * .95, -s * .95, s * .09); c.fill(); if (big) { c.fillStyle = 'rgba(20,20,20,.5)'; c.fillRect(-s * .3, -s * .3, s * .6, s * .6); } c.restore();
  }
  private fluid(c: CanvasRenderingContext2D, z: Zone, t: number, loose: boolean) {
    const R = rng((z.x * 17 + z.y * 31) | 0); c.save(); const tone = loose ? 'rgba(96,120,140,.34)' : 'rgba(86,112,130,.5)';
    for (let i = 0; i < 6; i++) { const a = R() * 6.28, d = R() * z.r * .55, rx = z.r * (.45 + R() * .45), ry = z.r * (.35 + R() * .4); c.fillStyle = tone; c.beginPath(); c.ellipse(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, rx, ry, R() * 3, 0, 7); c.fill(); }
    c.strokeStyle = 'rgba(190,210,222,.22)'; c.lineWidth = .045; c.beginPath(); c.ellipse(z.x, z.y, z.r * .9, z.r * .72, .5, 0, 7); c.stroke();
    const sh = (t * .35 + z.x) % 1; c.fillStyle = `rgba(225,236,242,${.22 * Math.sin(sh * Math.PI)})`; c.beginPath(); c.ellipse(z.x - z.r * .5 + sh * z.r, z.y - z.r * .2, z.r * .3, z.r * .1, .5, 0, 7); c.fill();
    const rp = (t * .4) % 1; c.strokeStyle = `rgba(200,220,232,${.3 * (1 - rp)})`; c.lineWidth = .03; c.beginPath(); c.ellipse(z.x, z.y, z.r * (.2 + rp * .75), z.r * (.15 + rp * .6), .5, 0, 7); c.stroke(); c.restore();
  }
  private saw(c: CanvasRenderingContext2D, z: Zone, t: number) {
    const rad = z.r; c.fillStyle = 'rgba(10,10,12,.82)'; this.circ(c, z.x, z.y, rad * 1.1); c.fill(); c.strokeStyle = 'rgba(176,150,70,.5)'; c.lineWidth = .06; c.setLineDash([.18, .14]); this.circ(c, z.x, z.y, rad * 1.1); c.stroke(); c.setLineDash([]);
    const a0 = t * 11 + z.x; const teeth = 14; c.fillStyle = 'rgb(150,156,160)'; c.strokeStyle = 'rgba(20,20,22,.9)'; c.lineWidth = .03; c.beginPath(); for (let i = 0; i < teeth * 2; i++) { const a = a0 + i / (teeth * 2) * 6.283, rr = (i % 2 ? .78 : 1) * rad * .95; i ? c.lineTo(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr) : c.moveTo(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr); } c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(30,32,36,.9)'; this.circ(c, z.x, z.y, rad * .55); c.fill(); c.strokeStyle = 'rgba(215,220,225,.35)'; c.lineWidth = .04; for (let i = 0; i < 3; i++) { const a = a0 * 1.3 + i * 2.094; c.beginPath(); c.arc(z.x, z.y, rad * .75, a, a + .7); c.stroke(); }
    c.fillStyle = 'rgb(86,92,98)'; this.circ(c, z.x, z.y, rad * .18); c.fill();
  }
  private lane(c: CanvasRenderingContext2D, z: Zone, t: number) {
    const L = z.r * 1.45, Wd = z.r * .95; c.save(); c.translate(z.x, z.y); c.fillStyle = 'rgba(14,14,12,.55)'; c.fillRect(-L, -Wd, L * 2, Wd * 2); c.save(); c.beginPath(); c.rect(-L, -Wd, L * 2, Wd * 2); c.clip(); c.fillStyle = 'rgba(176,150,70,.5)'; const off = (t * .8) % .6; for (let x = -L - .6; x < L + .6; x += .6) { c.beginPath(); c.moveTo(x + off, -Wd * .55); c.lineTo(x + off + .25, 0); c.lineTo(x + off, Wd * .55); c.lineTo(x + off + .12, Wd * .55); c.lineTo(x + off + .37, 0); c.lineTo(x + off + .12, -Wd * .55); c.closePath(); c.fill(); } c.restore();
    stripeRect(c, -L, -Wd, L * 2, .14, .12); stripeRect(c, -L, Wd - .14, L * 2, .14, .12); const jx = Math.sin(t * .7 + z.y) * L * .7; c.fillStyle = 'rgba(60,66,52,.95)'; c.fillRect(jx - .32, -.22, .64, .44); c.fillStyle = 'rgba(30,30,28,.95)'; c.fillRect(jx + .3, -.2, .5, .08); c.fillRect(jx + .3, .12, .5, .08); c.restore();
  }
  private shelf(c: CanvasRenderingContext2D, z: Zone, t: number) {
    const R = rng((z.x * 13 + z.y * 7) | 0); c.save(); c.fillStyle = 'rgba(10,9,8,.5)'; this.circ(c, z.x, z.y, z.r * 1.05); c.fill();
    for (let i = 0; i < 4; i++) { const a = R() * 3.14, d = z.r * (.3 + R() * .6), cx = z.x + Math.cos(R() * 6.28) * d * .5, cy = z.y + Math.sin(R() * 6.28) * d * .5; c.strokeStyle = 'rgba(8,8,8,.7)'; c.lineWidth = .16; c.beginPath(); c.moveTo(cx - Math.cos(a) * z.r * .8, cy - Math.sin(a) * z.r * .8); c.lineTo(cx + Math.cos(a) * z.r * .8, cy + Math.sin(a) * z.r * .8); c.stroke(); c.strokeStyle = 'rgb(112,116,118)'; c.lineWidth = .1; c.beginPath(); c.moveTo(cx - Math.cos(a) * z.r * .8, cy - Math.sin(a) * z.r * .8 - .03); c.lineTo(cx + Math.cos(a) * z.r * .8, cy + Math.sin(a) * z.r * .8 - .03); c.stroke(); }
    for (let i = 0; i < 6; i++) { const bx = z.x + (R() - .5) * z.r * 1.5, by = z.y + (R() - .5) * z.r * 1.3; c.save(); c.translate(bx, by); c.rotate(R() * 3); c.fillStyle = ['rgb(124,96,64)', 'rgb(96,104,78)', 'rgb(146,126,92)'][i % 3]; c.fillRect(-.2, -.15, .4, .3); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-.2, .05, .4, .1); c.restore(); }
    const dp = Math.sin(t * .8 + z.x) * .5 + .5; c.fillStyle = `rgba(190,185,165,${.08 + dp * .06})`; this.circ(c, z.x + Math.sin(t * .3) * .2, z.y, z.r * .8); c.fill(); c.restore();
  }
  private crane(c: CanvasRenderingContext2D, z: Zone, t: number) {
    c.fillStyle = 'rgba(8,8,9,.38)'; this.circ(c, z.x, z.y, z.r); c.fill(); c.strokeStyle = 'rgba(176,150,70,.55)'; c.lineWidth = .1; c.setLineDash([.4, .3]); c.lineDashOffset = -t * .3; this.circ(c, z.x, z.y, z.r * .94); c.stroke(); c.setLineDash([]); c.strokeStyle = 'rgba(176,150,70,.35)'; c.lineWidth = .06; c.beginPath(); c.moveTo(z.x - z.r * .7, z.y); c.lineTo(z.x + z.r * .7, z.y); c.moveTo(z.x, z.y - z.r * .7); c.lineTo(z.x, z.y + z.r * .7); c.stroke(); this.circ(c, z.x, z.y, z.r * .45); c.stroke();
  }

  // ============================ arena decals ============================
  arena(r: Renderer) {
    const g = r.g, L = g.level, th = themeOf(L); if (!isDungeonTheme(th)) return; const dd = g.dd; const key = th === 'foundry' ? 'Furnace heat' : th === 'clinic' ? 'Saw rig' : 'Gantry crane'; const hz = dd.hazards.filter(h => h.label === key); if (!hz.length) return;
    const cx = hz.reduce((a, h) => a + h.x, 0) / hz.length, cy = hz.reduce((a, h) => a + h.y, 0) / hz.length; if (Math.hypot(g.px - cx, g.py - cy) > 24) return; const t = g.time;
    this.iso(r, c => {
      c.lineCap = 'butt'; const ring = (rad: number, col: string, w: number, dash?: number[]) => { c.strokeStyle = col; c.lineWidth = w; if (dash) c.setLineDash(dash); c.beginPath(); c.arc(cx, cy, rad, 0, 7); c.stroke(); c.setLineDash([]); };
      if (th === 'foundry') { const pulse = .5 + .5 * Math.sin(t * 1.2);
        for (const [a, b, col] of [[3.7, 6.2, 'rgba(6,5,5,.35)']] as const) { c.fillStyle = col; c.beginPath(); c.arc(cx, cy, b, 0, 7); c.arc(cx, cy, a, 0, 7, true); c.fill(); }
        const gr = c.createRadialGradient(cx, cy, 2.6, cx, cy, 8); gr.addColorStop(0, `rgba(150,56,26,${.2 + .06 * pulse})`); gr.addColorStop(1, 'rgba(150,56,26,0)'); c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, 8, 0, 7); c.fill();
        ring(3.5, 'rgba(120,108,96,.5)', .14); ring(6.2, 'rgba(120,108,96,.35)', .09); ring(9.3, 'rgba(176,150,70,.28)', .2, [.5, .5]); c.strokeStyle = 'rgba(8,6,6,.45)'; c.lineWidth = .16; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 + Math.PI / 16; c.beginPath(); c.moveTo(cx + Math.cos(a) * 3.8, cy + Math.sin(a) * 3.8); c.lineTo(cx + Math.cos(a) * 8.6, cy + Math.sin(a) * 8.6); c.stroke(); }
        c.save(); c.translate(cx, cy - 10.4); c.font = 'bold .62px "Arial Narrow",Impact,sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(190,160,140,.24)'; c.fillText('FURNACE RING // LINE 7', 0, 0); c.restore(); }
      else if (th === 'clinic') { const radii = [3.7, 5.0, 6.2, 7.4, 8.6]; radii.forEach((rad, i) => { c.fillStyle = i % 2 ? 'rgba(120,92,62,.14)' : 'rgba(210,196,170,.1)'; c.beginPath(); c.arc(cx, cy, rad + .6, 0, 7); c.arc(cx, cy, rad - .6, 0, 7, true); c.fill(); ring(rad, 'rgba(18,16,14,.5)', .07); ring(rad + .6, 'rgba(190,175,150,.2)', .035); });
        c.strokeStyle = 'rgba(18,16,14,.4)'; c.lineWidth = .05; for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; c.beginPath(); c.moveTo(cx + Math.cos(a) * 4.3, cy + Math.sin(a) * 4.3); c.lineTo(cx + Math.cos(a) * 9.2, cy + Math.sin(a) * 9.2); c.stroke(); }
        const gl = c.createRadialGradient(cx, cy, 0, cx, cy, 4); gl.addColorStop(0, 'rgba(235,225,200,.2)'); gl.addColorStop(1, 'rgba(235,225,200,0)'); c.fillStyle = gl; c.beginPath(); c.arc(cx, cy, 4, 0, 7); c.fill(); ring(2.5, 'rgba(70,98,124,.5)', .12); ring(1.6, 'rgba(210,225,235,.25)', .05, [.2, .2]);
        c.save(); c.translate(cx, cy - 10.4); c.font = 'bold .62px "Arial Narrow",Impact,sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(205,215,222,.26)'; c.fillText('OPERATING AMPHITHEATRE', 0, 0); c.restore(); }
      else { ring(6.6, 'rgba(176,150,70,.5)', .3, [.8, .8]); ring(6.6, 'rgba(14,14,12,.55)', .3, [.8, .8]); c.lineDashOffset = .8; ring(6.6, 'rgba(14,14,12,.55)', .3, [.8, .8]); ring(2.6, 'rgba(214,206,170,.22)', .08); ring(4.4, 'rgba(214,206,170,.14)', .05);
        c.strokeStyle = 'rgba(176,150,70,.3)'; c.lineWidth = .1; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; c.beginPath(); c.moveTo(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3); c.lineTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6); c.stroke(); } c.fillStyle = 'rgba(8,8,8,.16)'; c.beginPath(); c.arc(cx, cy, 6, 0, 7); c.fill();
        c.save(); c.translate(cx, cy - 8.4); c.font = 'bold .62px "Arial Narrow",Impact,sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(214,206,170,.26)'; c.fillText('RETRIEVAL HALL // 0%', 0, 0); c.restore(); }
    });
  }

  // ============================ lighting + atmosphere ============================
  private zoneLights(L: Level, th: string): Light[] {
    let v = this.zl.get(L); if (v) return v; v = []; const warm = th === 'foundry' || th === 'annex';
    for (let y = 4; y < L.h; y += 8) for (let x = 4; x < L.w; x += 8) { let fx = -1, fy = -1; for (let dy = -2; dy <= 2 && fx < 0; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < L.w && Y < L.h && !L.solid[Y * L.w + X]) { fx = X; fy = Y; break; } } if (fx < 0) continue; const z = L.zoneNames[L.zone[fy * L.w + fx]];
      const c: Light['c'] = th === 'foundry' ? (z === 'boss' ? 'red' : (z === 'yard' ? 'warm' : 'cool')) : th === 'clinic' ? (z === 'boss' ? 'warm' : 'pale') : th === 'warehouse' ? (z === 'boss' ? 'cool' : (z === 'yard' ? 'pale' : 'warm')) : (z === 'yard' || z === 'salvage' ? 'warm' : z === 'boss' ? 'red' : 'cool');
      v.push({ x: fx + .5, y: fy + .5, r: 5.2, c, a: th === 'foundry' ? (c === 'cool' ? .08 : .13) : th === 'clinic' ? .1 : .11, fl: th === 'warehouse' && (x + y) % 3 === 0 ? 1 : 0 }); }
    for (const cp of L.checkpoints) v.push({ x: cp.x, y: cp.y, r: 4, c: 'warm', a: .16 }); void warm; this.zl.set(L, v); return v;
  }
  ambient(r: Renderer) {
    const g = r.g, L = g.level, th = themeOf(L); const c = r.ctx, TW = r.TW, t = g.time, red = g.save.settings.reducedFx; if (!th || th === 'town') { this.lights.length = 0; return; }
    const pa = (x: number, y: number) => [r.sx(x, y), r.sy(x, y)] as const; c.save(); c.globalCompositeOperation = 'lighter';
    const draw = (l: Light) => { const [a, b] = pa(l.x, l.y); const rr = l.r * TW * .5; if (a < -rr || a > r.w + rr || b < -rr || b > r.h + rr) return; const fl = l.fl ? 1 + Math.sin(t * 13 + l.x * 3) * .05 + (Math.sin(t * 2.3 + l.y) > .96 ? -.5 : 0) : 1; c.globalAlpha = Math.max(0, l.a * fl); c.drawImage(this.glows[l.c], a - rr, b - rr * .62, rr * 2, rr * 1.24); };
    for (const l of this.zoneLights(L, th)) draw(l); for (const l of this.lights) draw(l); this.lights.length = 0; c.restore();
    if (red) return;
    // dust motes / ash (screen space, parallax with camera)
    c.save(); const col = th === 'foundry' ? '200,150,110' : th === 'clinic' ? '215,225,230' : th === 'annex' ? '200,190,170' : '214,200,160'; const n = th === 'foundry' ? 46 : 30; for (let i = 0; i < n && i < this.dust.length; i++) { const d = this.dust[i]; const x = ((d.x * r.w * 1.3 + t * 7 * d.v * (th === 'foundry' ? 1.6 : 1) - r.camx * .12 * d.z) % (r.w * 1.3) + r.w * 1.3) % (r.w * 1.3) - r.w * .15; const y = ((d.y * r.h * 1.2 - t * (th === 'foundry' ? 14 : 3) * d.v * d.z + Math.sin(t * .6 + d.ph) * 6) % (r.h * 1.2) + r.h * 1.2) % (r.h * 1.2) - r.h * .1; c.fillStyle = `rgba(${col},${.16 + .12 * Math.sin(t + d.ph)})`; const s = 1 + d.z * 1.3; c.fillRect(x, y, s, s); } c.restore();
    // steam off slag / vents, stateless puffs
    if (th === 'foundry' || th === 'clinic') { const dd = g.dd; const key = th === 'foundry' ? 'Slag trough' : 'Spilled fluids'; let cnt = 0; c.save(); for (let i = 0; i < dd.hazards.length && cnt < 14; i++) { const h = dd.hazards[i]; if (h.label !== key || Math.hypot(h.x - g.px, h.y - g.py) > 14) continue; cnt++; for (let k = 0; k < 2; k++) { const ph = (t * (.22 + .06 * k) + i * .37 + k * .5) % 1; const [a, b] = pa(h.x + Math.sin(i + k) * .5, h.y + Math.cos(i * 2 + k) * .5); const rad = TW * (.28 + ph * .5); c.globalAlpha = Math.sin(ph * Math.PI) * (th === 'foundry' ? .2 : .08); c.fillStyle = th === 'foundry' ? 'rgb(150,140,132)' : 'rgb(210,222,230)'; c.beginPath(); c.arc(a + Math.sin(ph * 5 + i) * TW * .1, b - ph * TW * 1.4 - TW * .1, rad, 0, 7); c.fill(); } if (th === 'foundry') { const e = (t * .7 + i * .31) % 1; const [a, b] = pa(h.x, h.y); c.globalAlpha = (1 - e); c.fillStyle = 'rgb(220,110,50)'; c.fillRect(a + Math.sin(e * 9 + i) * TW * .3, b - e * TW * 1.2, 2, 2); } } c.restore(); }
    if (th === 'warehouse' && L.zoneNames[L.zone[Math.floor(g.py) * L.w + Math.floor(g.px)]] === 'boss') { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { const a = r.w * (.25 + i * .28) + Math.sin(t * .1 + i) * 14; c.globalAlpha = .045; c.fillStyle = 'rgb(190,200,215)'; c.beginPath(); c.moveTo(a, -10); c.lineTo(a + 70, -10); c.lineTo(a + 190, r.h * .75); c.lineTo(a + 70, r.h * .75); c.fill(); } c.restore(); }
  }
}
function stripeRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step: number) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = 'rgba(20,20,20,.75)'; c.fillRect(x, y, w, h); c.fillStyle = 'rgba(176,150,70,.6)'; for (let i = -h; i < w + h; i += step * 2) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + step, y + h); c.lineTo(x + i + step + h, y); c.lineTo(x + i + h, y); c.fill(); } c.restore(); }

/** per-dungeon floor litter, drawn into the baked organic overlay (24 px / tile) */
export function themeScatter(x: CanvasRenderingContext2D, L: Level, OP: number, floors: [number, number][], R: () => number, th: string) {
  if (!isDungeonTheme(th)) return; const n = Math.floor(floors.length / 26);
  const blob = (px: number, py: number, rad: number, col: string, a: number, sq = 1, rot = 0) => { const g = x.createRadialGradient(0, 0, 0, 0, 0, rad); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(.6, `rgba(${col},${a * .5})`); g.addColorStop(1, `rgba(${col},0)`); x.save(); x.translate(px, py); x.rotate(rot); x.scale(1, sq); x.fillStyle = g; x.beginPath(); x.arc(0, 0, rad, 0, 7); x.fill(); x.restore(); };
  for (let i = 0; i < n; i++) { const [tx, ty] = floors[(R() * floors.length) | 0]; const px = (tx + R()) * OP, py = (ty + R()) * OP; const k = R();
    if (th === 'foundry') { if (k < .35) { blob(px, py, OP * (.5 + R() * .6), '60,26,16', .45, .6, R() * 3); blob(px, py, OP * .25, '150,60,30', .12, .6, R() * 3); } else if (k < .7) blob(px, py, OP * (.8 + R()), '8,6,6', .4, .55, R() * 3); else { for (let j = 0; j < 5; j++) { x.fillStyle = `rgba(${90 + R() * 40 | 0},${60 + R() * 20 | 0},${44},.7)`; x.beginPath(); x.ellipse(px + (R() - .5) * OP * .6, py + (R() - .5) * OP * .5, OP * (.05 + R() * .08), OP * (.03 + R() * .05), R() * 3, 0, 7); x.fill(); } } }
    else if (th === 'clinic') { if (k < .35) { blob(px, py, OP * (.4 + R() * .6), '60,84,104', .32, .5, R() * 3); blob(px - 2, py - 2, OP * .2, '200,220,232', .1, .5, 0); } else if (k < .6) { x.strokeStyle = 'rgba(50,70,90,.35)'; x.lineWidth = 1.4; x.beginPath(); let cx = px, cy = py, a = R() * 6.28; x.moveTo(cx, cy); for (let j = 0; j < 5; j++) { a += (R() - .5) * .8; cx += Math.cos(a) * OP * .3; cy += Math.sin(a) * OP * .3; x.lineTo(cx, cy); } x.stroke(); } else { for (let j = 0; j < 4; j++) { x.fillStyle = `rgba(${200 + R() * 30 | 0},${192 + R() * 24 | 0},${170 + R() * 20 | 0},.5)`; const s = OP * (.04 + R() * .07); x.beginPath(); const cx = px + (R() - .5) * OP * .6, cy = py + (R() - .5) * OP * .5; for (let q = 0; q < 4; q++) { const aa = q / 4 * 6.28 + R(), rr = s * (.7 + R() * .6); q ? x.lineTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr) : x.moveTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr); } x.closePath(); x.fill(); } } }
    else { if (k < .3) { x.strokeStyle = 'rgba(10,10,10,.38)'; x.lineWidth = 3; x.beginPath(); x.arc(px, py, OP * (.8 + R()), R() * 6, R() * 6 + 1.2); x.stroke(); } else if (k < .6) { for (let j = 0; j < 4; j++) { x.save(); x.translate(px + (R() - .5) * OP, py + (R() - .5) * OP * .8); x.rotate(R() * 3); x.fillStyle = `rgba(${120 + R() * 30 | 0},${96 + R() * 20 | 0},${64},.7)`; x.fillRect(-OP * .12, -OP * .07, OP * .24, OP * .14); x.restore(); } } else if (k < .8) blob(px, py, OP * (.4 + R() * .5), '12,12,10', .34, .55, R() * 3); else { x.fillStyle = 'rgba(220,225,215,.12)'; x.beginPath(); x.ellipse(px, py, OP * .5, OP * .25, R() * 3, 0, 7); x.fill(); } } }
}
