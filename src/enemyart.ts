// Illustrated enemies/bosses for the dungeon pack: alpha PNG cut-outs from the concept sheets (tools/dungeons/cut_enemies.py -> public/dungeons/enemies),
// drawn as shaded, ground-shadowed, pre-scaled sprites with a PROCEDURAL animation layer (walk bob/squash synced to travel speed, windup crouch + tremble,
// attack lunge / ranged recoil, dash stretch + afterimages, hit flash + squash, stun wobble, death collapse + fade, boss entrance scale-pop + shake).
// Facing is approximated: the single concept view is flipped to the screen side of the movement/aim direction (with an animated squash through the turn) and leaned
// into travel. True 8-direction animated sprites are future hand-made art. Any enemy id without an entry (or if loading fails) keeps the procedural primitive.
import type { En } from './sim';
import { ATK } from './sim';
import { COMBAT } from './config';
import type { EnemyDef } from './config';
import type { Renderer } from './render';
import { toScreen, stepDir, variantFor, dirIndex, S, type Variant } from './facing';

/** sprite file, height in tiles (x TW), optional hover height (tiles), tint multiply for variants */
interface Art { spr: string; h: number; hover?: number; tint?: string; ground?: boolean; flip0?: boolean; dark?: boolean; }
const A = (spr: string, h: number, o: Partial<Art> = {}): Art => ({ spr, h, ...o });
export const ART: Record<string, Art> = {
  // Reclamation Annex (original dungeon); drone = spare hover minion art
  worker: A('worker', 1.05), shooter: A('shooter', 1.1), turret: A('turret', .85, { ground: true }), sawhand: A('sawhand', 1.5), foreman: A('foreman', 1.5),
  overseer: A('overseer', 2.4), warden: A('warden', 2.3, { hover: .8 }), enforcer: A('enforcer', 2.4), drone: A('drone', .8, { hover: .5 }),
  // Harrow-Brandt Foundry
  slaghauler: A('slaghauler', 1.15), ladlecrew: A('ladlecrew', 1.1), cinderhound: A('cinderhound', .62), slagcannon: A('slagcannon', .85, { ground: true }),
  brakeman: A('teague', 1.45, { tint: 'rgba(60,40,50,.28)' }), quenchpriest: A('quenchpriest', 1.55),
  teague: A('teague', 2.35), brannoch: A('brannoch', 2.35), ore9: A('ore9', 2.1, { hover: .55 }),
  // Aldane clinic
  orderly: A('orderly', 1.1), nursebot: A('nursebot', 1.05), gurneyrunner: A('gurneyrunner', .8), sentry: A('sentry', 1.05, { ground: true }),
  matron: A('matron', 1.5), anesthetist: A('nursebot', 1.4, { tint: 'rgba(40,70,80,.3)' }),
  surgeon: A('surgeon', 2.3), autosurgeon: A('autosurgeon', 2.3, { hover: 1.1 }), recovered: A('recovered', 2.4),
  // Kestrel warehouse
  picker: A('picker', 1.0), loader: A('loader', 1.15), forkbot: A('forkbot', 1.15), scanner: A('scanner', 1.0), camgun: A('camgun', .7, { ground: true }),
  shiftlead: A('shiftlead', 1.45), hobbs: A('loader', 1.5, { tint: 'rgba(120,90,30,.22)' }),
  stockmgr: A('stockmgr', 2.2), retrieval: A('retrieval', 2.9), reclaimer: A('reclaimer', 2.5),
};
/** 3D-rendered 8-direction animated atlas (tools/enemies3d: Blender archetype rigs -> public/dungeons/enemies3d/<id>.json + <id>_<anim>.webp). Rows S,SW,W,NW,N,NE,E,SE; cols = frames. */
interface AAnim { image: string; frames: number; fps: number; loop: boolean; hit: number | null; }
interface Atl { meta: { frame: number; anchor: [number, number]; hpx: number; anims: Record<string, AAnim> } | null; ims: Record<string, HTMLImageElement>; state: 'loading' | 'ready' | 'fail'; used: number; }
const ROW = [6, 7, 0, 1, 2, 3, 4, 5]; // facing.ts notch (E,SE,S,SW,W,NW,N,NE) -> atlas row
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const ease = (t: number) => 1 - (1 - t) * (1 - t);
interface St { f: number; lx: number; ly: number; lt: number; wp: number; spd: number; alive: boolean; deadAt: number; dur: number; lastHp: number; hitAt: number; prevReveal: boolean; popAt: number; phase: number; phaseAt: number; away: boolean; lastSt: string; sx: number; dir: number; pdir: number; blend: number; held: number; lock: [number, number] | null; }

export class EnemyArt {
  img: Record<string, HTMLImageElement> = {}; ready = false; private sc = new Map<string, HTMLCanvasElement>(); private fl = new Map<string, HTMLCanvasElement>(); private key = ''; private st = new Map<number, St>(); private shadow: HTMLCanvasElement;
  constructor(private base = './dungeons/enemies/') {
    const s = mk(128, 64), x = s.getContext('2d')!; const g = x.createRadialGradient(64, 32, 2, 64, 32, 62); g.addColorStop(0, 'rgba(0,0,0,.62)'); g.addColorStop(.55, 'rgba(0,0,0,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.save(); x.scale(1, .5); x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill(); x.restore(); this.shadow = s; this.load(); this.load3();
  }
  private async load() {
    const names = [...new Set(Object.values(ART).map(a => a.spr))]; for (const n of names) for (const sfx of ['back', 'side', 'tfront']) new Promise<void>(res => { const i = new Image(); i.onload = () => { this.img[n + '_' + sfx] = i; res(); }; i.onerror = () => res(); i.src = `${this.base}${n}_${sfx}.png`; });
    await Promise.all(names.map(n => new Promise<void>(res => { const i = new Image(); i.onload = () => { this.img[n] = i; res(); }; i.onerror = () => res(); i.src = `${this.base}${n}.png`; })));
    this.ready = Object.keys(this.img).length > 0;
  }
  private atl = new Map<string, Atl>(); private a3 = new Set<string>(); private tmp: HTMLCanvasElement | null = null; atlasMax = 8;
  private async load3() { try { const r = await fetch(`${this.base}../enemies3d/index.json`); if (r.ok) for (const id of await r.json()) this.a3.add(id); } catch { /* no 3D art: flat sprites only */ } }
  /** lazily loads (and LRU-evicts) the 3D atlas for an enemy type; returns it only once every animation sheet has decoded */
  atlasFor(type: string, now: number): Atl | null {
    if (!this.a3.has(type)) return null; let a = this.atl.get(type);
    if (!a) { a = { meta: null, ims: {}, state: 'loading', used: now }; this.atl.set(type, a); const A = a; const dir = `${this.base}../enemies3d/`;
      fetch(`${dir}${type}.json`).then(r => r.json()).then(m => { A.meta = m; return Promise.all(Object.entries(m.anims as Record<string, AAnim>).map(([k, v]) => new Promise<void>(res => { const i = new Image(); i.onload = () => { A.ims[k] = i; res(); }; i.onerror = () => res(); i.src = dir + v.image; }))); }).then(() => { A.state = Object.keys(A.ims).length ? 'ready' : 'fail'; }).catch(() => { A.state = 'fail'; });
      while (this.atl.size > this.atlasMax) { let ok = '', ou = 1e18; for (const [k, v] of this.atl) if (k !== type && v.used < ou && v.used < now - 4) { ok = k; ou = v.used; } /* never evict an atlas drawn in the last 4 s (no load/evict thrash when many types are on screen) */ if (!ok) break; const ev = this.atl.get(ok)!; for (const i of Object.values(ev.ims)) i.src = ''; this.atl.delete(ok); } }
    a.used = now; return a.state === 'ready' && a.meta ? a : null;
  }
  has(type: string) { return this.ready && !!ART[type] && !!this.img[ART[type].spr]; }
  /** pre-scaled, pre-shaded sprite (cached per size): foot occlusion gradient, soft top rim, optional variant tint */
  private scaled(a: Art, hpx: number, dpr: number, flash: boolean) {
    const k0 = String(dpr); if (k0 !== this.key) { this.key = k0; this.sc.clear(); this.fl.clear(); }
    const im = this.img[a.spr]; const hh = Math.max(8, Math.round(hpx / 4) * 4); const k = a.spr + '|' + (a.tint || '') + (a.dark ? '|D' : '') + '|' + hh; let cv = this.sc.get(k);
    if (!cv) { const w = Math.round(hh * im.width / im.height); cv = mk(w * dpr, hh * dpr); const x = cv.getContext('2d')!; x.imageSmoothingQuality = 'high';
      let src: CanvasImageSource = im, sw = im.width, sh = im.height; while (sh > cv.height * 2) { const t = mk(sw / 2, sh / 2); const tx = t.getContext('2d')!; tx.imageSmoothingQuality = 'high'; tx.drawImage(src, 0, 0, t.width, t.height); src = t; sw = t.width; sh = t.height; }
      x.drawImage(src, 0, 0, cv.width, cv.height);
      x.globalCompositeOperation = 'source-atop';
      if (a.dark) { x.fillStyle = 'rgba(10,10,16,.5)'; x.fillRect(0, 0, cv.width, cv.height); } // no back art: occluded/darkened front silhouette
      if (a.tint) { x.fillStyle = a.tint; x.fillRect(0, 0, cv.width, cv.height); }
      let g = x.createLinearGradient(0, cv.height * .62, 0, cv.height); g.addColorStop(0, 'rgba(6,6,9,0)'); g.addColorStop(1, 'rgba(6,6,9,.42)'); x.fillStyle = g; x.fillRect(0, 0, cv.width, cv.height); // ground occlusion at the feet
      g = x.createLinearGradient(0, 0, 0, cv.height * .25); g.addColorStop(0, 'rgba(215,205,185,.13)'); g.addColorStop(1, 'rgba(215,205,185,0)'); x.fillStyle = g; x.fillRect(0, 0, cv.width, cv.height); // top light
      this.sc.set(k, cv); }
    if (!flash) return cv; let f = this.fl.get(k); if (!f) { f = mk(cv.width, cv.height); const x = f.getContext('2d')!; x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(238,230,210,.5)'; x.fillRect(0, 0, f.width, f.height); this.fl.set(k, f); } return f;
  }
  private state(e: En, now: number): St { let s = this.st.get(e.id); if (!s) { s = { f: 1, lx: e.x, ly: e.y, lt: now, wp: Math.random() * 6, spd: 0, alive: !e.dead, deadAt: 0, dur: 1.8, lastHp: e.hp, hitAt: -9, prevReveal: false, popAt: -9, phase: 0, phaseAt: -9, away: false, dir: S, pdir: S, blend: 1, held: 9, lock: null, lastSt: '', sx: 0 }; this.st.set(e.id, s); } return s; }
  /** true while a freshly killed enemy is still playing its collapse (render keeps drawing it) */
  dying(e: En, now: number) { const s = this.st.get(e.id); return !!s && ((s.alive && e.dead) || (s.deadAt > 0 && now - s.deadAt < s.dur)); }
  /** Draws the enemy; returns the top-of-sprite pixel height for UI anchors, or null to fall back to the procedural primitive. */
  draw(r: Renderer, e: En, def: EnemyDef, rt: any, a: number, b: number): { top: number } | null {
    const art = ART[e.type]; if (!art || !this.has(e.type)) return null; const g = r.g, c = r.ctx, TW = r.TW, dpr = r.dpr, now = g.time; const s = this.state(e, now);
    const dt = Math.min(.1, Math.max(.001, now - s.lt)); s.lt = now; const T = now + e.id * 1.7; const boss = !!def.boss, stat = !!def.static;
    // --- death bookkeeping ---
    if (e.dead && s.alive) { s.alive = false; s.deadAt = now; s.dur = (boss ? 1.5 : def.elite ? 1.0 : .8) + .1; for (let i = 0; i < (boss ? 9 : 4); i++) g.fx.push({ kind: 'dust', x: e.x + (Math.random() - .5) * (boss ? 2.4 : 1), y: e.y + (Math.random() - .5) * (boss ? 2.4 : 1), t: 0, life: .7 + Math.random() * .5 } as any); if (boss) r.shake = Math.max(r.shake, .8); }
    const age = s.deadAt > 0 ? now - s.deadAt : 0; const dur = boss ? 1.5 : def.elite ? 1.0 : .8; if (e.dead && (s.deadAt <= 0 || age > dur + .1)) return null;
    // --- velocity from world motion (synchronises walk bob to ground speed) ---
    const vx = (e.x - s.lx) / dt, vy = (e.y - s.ly) / dt; s.lx = e.x; s.ly = e.y; const sp = Math.hypot(vx, vy); s.spd += (Math.min(sp, 8) - s.spd) * Math.min(1, dt * 10); s.wp += sp * dt * 1.55;
    // --- facing: 8 screen-aligned notches. Aim is LOCKED through windup/recovery; otherwise travel direction, else toward the player while alert ---
    if (rt.st === 'tele' && s.lastSt !== 'tele') s.lock = [Math.cos(rt.ang), Math.sin(rt.ang)]; else if (rt.st !== 'tele' && rt.st !== 'rec') s.lock = null;
    let wx = 0, wy = 0, have = true; if (s.lock) { wx = s.lock[0]; wy = s.lock[1]; } else if (s.spd > .35 || rt.st === 'dash') { wx = vx; wy = vy; } else if (e.alert) { wx = g.px - e.x; wy = g.py - e.y; } else have = false;
    const sv = toScreen(wx, wy); const fx = have ? sv.sx : 0; s.held += dt;
    if (have) { const nd = stepDir(s.dir, sv.sx, sv.sy, s.held, boss ? .14 : .1); if (nd !== s.dir) { s.pdir = s.dir; s.dir = nd; s.blend = 0; s.held = 0; } }
    s.blend = Math.min(1, s.blend + dt / (boss ? .2 : .13)); s.away = s.dir >= 5 && s.dir <= 7;
    const tgt = Math.abs(fx) < .02 ? Math.sign(s.f) || 1 : Math.sign(fx) * (art.flip0 ? -1 : 1); s.f += (tgt - s.f) * Math.min(1, dt * (boss ? 7 : 13));
    // --- procedural pose ---
    const H = art.h * TW * (stat ? 1 : 1); let sxs = 1, sys = 1, lean = 0, ox = 0, oy = 0, alpha = 1; const ang = rt.ang; const dirx = (Math.cos(ang) - Math.sin(ang)) * .5, diry = (Math.cos(ang) + Math.sin(ang)) * .25; const dl = Math.hypot(dirx, diry) || 1;
    const breathe = Math.sin(T * 1.9) * (boss ? .008 : .014); sys += breathe; sxs -= breathe * .5;
    if (!stat && s.spd > .25) { const k = Math.min(1, s.spd / 3.2); const ph = s.wp * Math.PI; const bob = Math.abs(Math.sin(ph)); oy -= bob * H * (boss ? .018 : .045) * k; sys += (bob - .5) * .045 * k; sxs -= (bob - .5) * .035 * k; lean += Math.sin(ph) * .035 * k * (boss ? .5 : 1) + Math.sign(vx - vy) * .05 * k; }
    if (stat) { lean += Math.sin(T * .9) * .012; }
    const A0 = ATK[rt.atk];
    if (rt.st === 'tele' && A0) { const p = Math.min(1, rt.t / (A0.w || 1)); const q = ease(p); sys -= .09 * q; sxs += .06 * q; lean -= .13 * q * Math.sign(s.f || 1); ox -= dirx / dl * TW * .1 * q; oy -= diry / dl * TW * .1 * q; if (p > .6) { const sh = (p - .6) * .02 * TW; ox += Math.sin(now * 70) * sh; } }
    else if (rt.st === 'rec' && A0) { const ranged = !!A0.ranged; const q = Math.max(0, 1 - rt.t / (ranged ? .22 : .28)); const sgn = ranged ? -1 : 1; const m = q * q * TW * (ranged ? .14 : (boss ? .42 : .3)); ox += dirx / dl * m * sgn; oy += diry / dl * m * sgn; sys += .08 * q * (ranged ? -.5 : 1); sxs -= .06 * q; lean += (ranged ? -.08 : .14) * q * Math.sign(s.f || 1); }
    else if (rt.st === 'dash') { const k = 1; sxs += .1 * k; sys -= .06 * k; lean += .2 * Math.sign(s.f || 1); }
    if (rt.vuln > 0 && rt.st !== 'tele') { sys -= .04; lean += .05 * Math.sign(s.f || 1); }
    if (e.stunT > 0) { lean += Math.sin(now * 26) * .06; ox += Math.sin(now * 31) * TW * .015; }
    if (e.hp < s.lastHp - 1e-6 && !e.dead) s.hitAt = now; s.lastHp = e.hp; const hitAge = now - s.hitAt; const hitK = hitAge >= 0 && hitAge < .12 ? 1 - hitAge / .12 : 0; // own timer: rt.hit can stay latched while stunned, which left a permanent pale flash if (hitK > 0) { sxs += .07 * hitK; sys -= .07 * hitK; ox += -dirx / dl * TW * .04 * hitK; }
    if (s.lastSt !== rt.st) s.lastSt = rt.st;
    // --- phase changes (boss 66% / 33%, elites 50%): rear-up, shockwave, shake, enraged rim glow afterwards ---
    const fr = e.hp / e.maxHp; const ph = e.dead ? s.phase : (boss ? (fr < .33 ? 2 : fr < .66 ? 1 : 0) : def.elite ? (fr < .5 ? 1 : 0) : 0);
    if (ph > s.phase && rt.reveal <= 0) { s.phase = ph; s.phaseAt = now; r.shake = Math.max(r.shake, boss ? .9 : .4); for (let i = 0; i < 6; i++) g.fx.push({ kind: 'ring', x: e.x, y: e.y, r: 1.2 + i * .5, t: 0, life: .3 + i * .1, c: '#b5483a' } as any); }
    let phF = 0; const pq = now - s.phaseAt; if (pq >= 0 && pq < 1.0 && !e.dead) { const q = pq < .45 ? ease(pq / .45) : Math.max(0, 1 - (pq - .45) / .55) * (pq < .6 ? 1 : .6); sys += .1 * q; sxs -= .05 * q; lean -= .1 * q * Math.sign(s.f || 1); oy -= H * .03 * q; if (pq > .4 && pq < .55) sys -= .14; phF = q * .45; }
    // --- boss entrance (emerge from the floor, then a scale pop + shake) ---
    let clipTop = false, revOy = 0; if (rt.reveal > 0) { const rev = Math.max(0, 1 - rt.reveal / COMBAT.bossRevealSeconds); const q = ease(Math.min(1, rev)); oy += (1 - q) * H * .85; revOy = (1 - q) * H * .85; sxs *= .86 + .14 * q; sys *= .86 + .14 * q; alpha = Math.min(1, .2 + q * 1.1); clipTop = true; s.prevReveal = true; }
    else if (s.prevReveal) { s.prevReveal = false; s.popAt = now; r.shake = Math.max(r.shake, .9); }
    const pa = now - s.popAt; if (pa >= 0 && pa < .55) { const q = Math.sin(pa / .55 * Math.PI); sxs *= 1 + .1 * q; sys *= 1 + .06 * q; }
    // --- death collapse ---
    let flashD = 0; if (e.dead) { const p = Math.min(1, age / dur); const q = ease(p); sys *= 1 - .6 * q; sxs *= 1 + (stat ? -.1 : .22) * q; lean += (s.f >= 0 ? 1 : -1) * (stat ? 0 : .42) * q; oy += H * .06 * q; alpha = 1 - Math.max(0, (p - .5) / .5); flashD = Math.max(0, 1 - age / .12); if (boss && p < .8) ox += Math.sin(now * 55) * TW * .02 * (1 - p); }
    // --- 3D atlas mode: the rendered frames carry all body motion (walk, lunge, recoil, collapse), so NO procedural squash / lean / skew is applied ---
    const at = this.atlasFor(e.type, now); if (at) { sxs = 1; sys = 1; lean = 0; ox = 0; oy = revOy; }
    // --- hover bob ---
    const hov = (art.hover || 0) * TW + (art.hover ? Math.sin(T * 1.5) * TW * .06 : 0); oy -= hov * (e.dead ? 1 - Math.min(1, age / dur) : 1);
    // --- ground shadow (shrinks and fades when hovering/dying) ---
    const sprW = H * this.img[art.spr].width / this.img[art.spr].height; const shK = 1 / (1 + hov / (TW * 2)); const sw = Math.min(sprW * .62, TW * (boss ? 2.4 : 1.5)) * shK * (e.dead ? 1 - .3 * Math.min(1, age / dur) : 1);
    c.save(); c.globalAlpha = (art.hover ? .55 : .9) * (e.dead ? alpha : 1); c.drawImage(this.shadow, a - sw, b - sw * .26, sw * 2, sw * .52); c.restore();
    // --- sprite ---
    if (at && at.meta) { const m = at.meta; const hitT = (an: string) => { const d = m.anims[an]; return d && d.hit != null ? d.hit / d.fps : 0; };
      let an = 'idle', tt = T * (m.anims.idle?.fps || 6); const A1 = ATK[rt.atk];
      if (e.dead) { an = 'death'; tt = Math.min(1, age / dur) * ((m.anims.death?.frames || 2) - 1); }
      else if (rt.st === 'tele' && A1 && m.anims.attack) { an = 'attack'; tt = Math.min(1, rt.t / (A1.w || 1)) * hitT('attack') * m.anims.attack.fps; }
      else if (rt.st === 'rec' && m.anims.attack) { an = 'attack'; tt = (hitT('attack') + rt.t) * m.anims.attack.fps; }
      else if (hitAge < .26 && m.anims.hit) { an = 'hit'; tt = (hitAge / .26) * (m.anims.hit.frames - 1); }
      else if (s.spd > .25 && m.anims.walk) { an = 'walk'; tt = (s.wp / 2) * m.anims.walk.frames; }
      const d = m.anims[an] || m.anims.idle, im = at.ims[an] || at.ims.idle; if (d && im) { const n = d.frames; let f: number, nf: number, fr: number;
        if (d.loop) { const x = ((tt % n) + n) % n; f = Math.floor(x); fr = x - f; nf = (f + 1) % n; } else { const x = Math.min(Math.max(tt, 0), n - 1); f = Math.floor(x); fr = x - f; nf = Math.min(f + 1, n - 1); }
        if (an === 'attack' && f === d.hit) fr = 0; // exact impact frame: no ghosting
        const k = H / m.hpx, W = m.frame, row = ROW[s.dir], ax = m.anchor[0], ay = m.anchor[1], dw = W * k, bx = -ax * k, by = -ay * k;
        const ds = Math.max(1, Math.round(dw * dpr)); const tc = this.tmp || (this.tmp = mk(ds, ds)); if (tc.width !== ds) { tc.width = ds; tc.height = ds; }
        c.save(); if (clipTop) { c.beginPath(); c.rect(a - dw, b - dw * 2 - hov, dw * 2, dw * 2 + hov + 2); c.clip(); } c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.translate(a + ox, b + oy);
        const draw = (ff: number, al: number) => { c.globalAlpha = (e.faction === 'ally' ? .88 : 1) * alpha * al; c.drawImage(im, ff * W, row * W, W, W, bx, by, dw, dw); };
        draw(f, 1); if (fr > .02 && nf !== f) draw(nf, fr);
        const fl = Math.max(hitK, flashD, phF); if (fl > .01) { const x = tc.getContext('2d')!; x.clearRect(0, 0, tc.width, tc.height); x.globalCompositeOperation = 'source-over'; x.drawImage(im, f * W, row * W, W, W, 0, 0, tc.width, tc.height); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(238,230,210,.5)'; x.fillRect(0, 0, tc.width, tc.height); c.globalAlpha = fl * alpha; c.drawImage(tc, bx, by, dw, dw); }
        c.restore(); if (e.faction === 'ally') { c.save(); c.globalAlpha = .18; c.globalCompositeOperation = 'lighter'; c.fillStyle = '#6f93a8'; c.fillRect(a - dw * .25, b - ay * k, dw * .5, ay * k); c.restore(); }
        return { top: H + hov + 6 }; } }
    const hasA = { back: !!this.img[art.spr + '_back'], side: !!this.img[art.spr + '_side'], tfront: !!this.img[art.spr + '_tfront'] };
    const lay = (d: number) => { const v = variantFor(d, hasA); const a2: Art = { ...art, spr: v.kind === 'front' ? art.spr : art.spr + '_' + v.kind, dark: v.dark }; const cv = this.scaled(a2, H, dpr, false); return { v, cv, fl: (hitK > .01 || flashD > 0) ? this.scaled(a2, H, dpr, true) : null }; };
    const L0 = lay(s.dir), L1 = s.blend < 1 ? lay(s.pdir) : null; const w = L0.cv.width / dpr, h = L0.cv.height / dpr;
    c.save(); if (clipTop) { c.beginPath(); c.rect(a - w, b - h * 2 - hov, w * 2, h * 2 + hov + 2); c.clip(); }
    if (e.faction === 'ally') c.globalAlpha = .88; else c.globalAlpha = 1;
    const drawL = (L: { v: Variant; cv: HTMLCanvasElement; fl: HTMLCanvasElement | null }, gx: number, ga: number, extra = 1) => { const cw = L.cv.width / dpr, ch = L.cv.height / dpr; c.save(); c.globalAlpha *= alpha * ga; c.translate(a + ox + gx, b + oy); c.rotate(lean); c.transform(1, 0, L.v.skew * L.v.flip, 1, 0, 0); c.scale(L.v.flip * L.v.xs * sxs, sys); c.drawImage(L.cv, -cw / 2, -ch * .97, cw, ch);
      if (L.fl) { c.globalAlpha = Math.max(hitK, flashD) * alpha * ga; c.drawImage(L.fl, -cw / 2, -ch * .97, cw, ch); } c.restore(); };
    const turnDip = L1 ? Math.sin(s.blend * Math.PI) : 0; // squash-turn: narrows slightly mid cross-fade
    const drawOne = (gx: number, ga: number) => { if (L1) { drawL(L1, gx, ga * (1 - s.blend)); drawL(L0, gx, ga * s.blend); } else drawL(L0, gx, ga); };
    if (rt.st === 'dash' && !e.dead) { const bx = -dirx / dl * TW * .5, by = -diry / dl * TW * .5; for (const [k, al] of [[2, .12], [1, .24]] as const) { c.save(); c.translate(bx * k, by * k); drawOne(0, al); c.restore(); } }
    drawOne(0, 1);
    if (s.phase > 0 && !e.dead) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = (.05 + .04 * Math.sin(now * 5)) * s.phase; c.translate(a + ox, b + oy); c.rotate(lean); c.scale(L0.v.flip * L0.v.xs * sxs, sys); c.drawImage(L0.cv, -w / 2, -h * .97, w, h); c.restore(); }
    c.restore();
    if (e.faction === 'ally') { c.save(); c.globalAlpha = .18; c.globalCompositeOperation = 'lighter'; c.fillStyle = '#6f93a8'; c.fillRect(a - w / 2, b - h, w, h); c.restore(); }
    return { top: h + hov + 6 };
  }
  forget(id: number) { this.st.delete(id); }
}
