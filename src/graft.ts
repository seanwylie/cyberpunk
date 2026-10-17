// Field grafts (docs/GRAFT.md): rip a part off a fresh kill and wire it in mid-fight.
// Elites always drop one, ordinary mobs rarely. A part lies on the floor briefly; Graft (F / tap the button / tap the part)
// installs it as a temporary power for this run that degrades to nothing. Costs a little humanity for the run.
// Perf: fixed-size pool, at most GRAFT.maxParts on the floor, no per-frame allocation.
import { ENEMIES, Mfr } from './config';

export const GRAFT = {
  life: 7,            // seconds a part lies on the floor
  mobChance: .06,     // ordinary mob drop chance (elites always)
  maxParts: 3,        // pool size / floor cap
  dur: 40,            // seconds an installed graft lasts (power decays linearly to floor)
  floor: .25,         // strength at the very end, then it falls off
  pickR: 1.5,
  hum: 2, humCap: 10, // run humanity cost per graft, capped
  bossMul: .5,        // offensive bonus vs bosses is halved: bosses stay deadly
};

export type GraftKind = 'HI' | 'PS' | 'MM';
export interface GraftDef { kind: GraftKind; name: string; tip: string; c: string; }
const NAMES: Record<Mfr, string[]> = {
  HI: ['Forklift Tine', 'Piston Fist', 'Rivet Drill', 'Ram Arm'],
  PS: ['Ceramic Blades', 'Scalpel Hand', 'Bone Saw', 'Suture Claws'],
  MM: ['Stamped Plating', 'Patch Servo', 'Scrap Ribcage', 'Bolt-on Shin'],
};
const TIPS: Record<GraftKind, string> = {
  HI: 'Heavy Industrial graft: hits +40% and every 4th hit slams nearby enemies. Fades over 40 s.',
  PS: 'Precision Surgical graft: hits +25% and mend 3% of damage dealt. Fades over 40 s.',
  MM: 'Mass-Market graft: take 25% less damage. Jams now and then. Fades over 40 s.',
};
export const GRAFT_COL: Record<GraftKind, string> = { HI: '#9a4a32', PS: '#d8cdb4', MM: '#6f7444' };

export function graftDefFor(type: string): GraftDef {
  const d = ENEMIES[type]; const mfr = (d?.mfr || 'MM') as Mfr; let h = 0; for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
  const list = NAMES[mfr]; const name = list[h % list.length];
  return { kind: mfr, name, tip: name + ' (from ' + (d?.name || type) + ') · ' + TIPS[mfr] + ' Costs ' + GRAFT.hum + ' humanity this run.', c: GRAFT_COL[mfr] };
}

export interface Part { on: boolean; x: number; y: number; t: number; type: string; id: number; }
export interface Active { def: GraftDef; t: number; hits: number; jam: number; src: string; }
export interface GraftState { parts: Part[]; active: Active | null; hum: number; n: number; seq: number; }

export function graftState(g: any): GraftState {
  return g._graft || (g._graft = { parts: Array.from({ length: GRAFT.maxParts }, () => ({ on: false, x: 0, y: 0, t: 0, type: '', id: 0 })), active: null, hum: 0, n: 0, seq: 0 });
}
export function graftReset(g: any) { const s = graftState(g); for (const p of s.parts) p.on = false; s.active = null; s.hum = 0; s.n = 0; }
/** strength 0..1 of the installed graft (0 = none) */
export function graftStr(g: any): number { const a = g._graft?.active; if (!a) return 0; const k = 1 - a.t / GRAFT.dur; return k <= 0 ? 0 : GRAFT.floor + (1 - GRAFT.floor) * k; }
export function graftHum(g: any): number { return g._graft?.hum || 0; }

export function graftOnKill(g: any, e: any, rnd = Math.random) {
  if (g.mode !== 'run' || e.faction === 'ally') return; const d = ENEMIES[e.type]; if (!d || d.static) return;
  const elite = !!(d.elite || e.affix?.length);
  if (!elite && rnd() >= GRAFT.mobChance) return;
  const s = graftState(g); let slot = s.parts.find(p => !p.on);
  if (!slot) { slot = s.parts.reduce((a, b) => (a.t > b.t ? a : b)); } // recycle the oldest
  slot.on = true; slot.x = e.x; slot.y = e.y; slot.t = 0; slot.type = e.type; slot.id = ++s.seq;
}

export function graftTick(g: any, dt: number) {
  const s = g._graft as GraftState | undefined; if (!s) return;
  for (const p of s.parts) if (p.on && (p.t += dt) > GRAFT.life) p.on = false;
  const a = s.active; if (a) { a.t += dt; if (a.jam > 0) a.jam -= dt; if (a.t >= GRAFT.dur) { s.active = null; g.popup?.(g.px, g.py - 1, 'GRAFT SPENT', '#a89f8c'); } }
}

export function graftNear(g: any): Part | null {
  const s = g._graft as GraftState | undefined; if (!s || g.downed) return null; let best: Part | null = null, bd = GRAFT.pickR;
  for (const p of s.parts) { if (!p.on) continue; const d = Math.hypot(p.x - g.px, p.y - g.py); if (d < bd) { bd = d; best = p; } } return best;
}
export function graftPrompt(g: any): any { const p = graftNear(g); if (!p) return null; const def = graftDefFor(p.type); return { id: 'graft', kind: 'crate', x: p.x, y: p.y, r: GRAFT.pickR, label: 'Graft', graftTip: def.tip }; }

export function graftTake(g: any, p?: Part | null): boolean {
  p = p || graftNear(g); if (!p || !p.on) return false; const s = graftState(g); const def = graftDefFor(p.type);
  p.on = false; s.active = { def, t: 0, hits: 0, jam: 0, src: p.type }; s.n++; s.hum = Math.min(GRAFT.humCap, s.hum + GRAFT.hum);
  g.popup?.(g.px, g.py - 1.2, 'GRAFT: ' + def.name.toUpperCase(), '#e8dcc0'); g.emit?.('sfx', 'pickup'); g.emit?.('graft', def);
  g.vfx?.('brace.cast', g.px, g.py); return true;
}
/** tap on the floor part (mobile): grafts if the part is under the tap and within reach */
export function graftTapAt(g: any, wx: number, wy: number): boolean { const p = graftNear(g); if (!p || Math.hypot(p.x - wx, p.y - wy) > 1.1) return false; return graftTake(g, p); }

/** outgoing damage multiplier; also handles HI slam and PS mend side effects */
export function graftOut(g: any, e: any, dmg: number, tag: string): number {
  const s = g._graft as GraftState | undefined; const a = s?.active; if (!a || e.faction !== 'enemy' || dmg <= 0) return dmg;
  const k = graftStr(g); const boss = !!ENEMIES[e.type]?.boss; const bm = boss ? GRAFT.bossMul : 1;
  if (a.def.kind === 'HI') { dmg *= 1 + .4 * k * bm; if (tag === 'auto' && ++a.hits % 4 === 0) { const prev = g.curTag; g.curTag = 'graft'; for (const o of g.enemies) { if (o === e || o.dead || o.faction !== 'enemy' || o._rt?.reveal > 0) continue; if (Math.hypot(o.x - e.x, o.y - e.y) < 1.8) g.hurtEnemy(o, 14 * k, e.x, e.y, 1.2); } g.curTag = prev; g.fx?.push({ kind: 'ring', x: e.x, y: e.y, r: 1.8, t: 0, life: .25, c: GRAFT_COL.HI }); } }
  else if (a.def.kind === 'PS') { dmg *= 1 + .25 * k * bm; g.hp = Math.min(g.maxHp, g.hp + dmg * .03 * k * bm); }
  return dmg;
}
/** incoming damage multiplier (MM plating; jams briefly ~every 9 s) */
export function graftIn(g: any, dmg: number, fromBoss: boolean): number {
  const a = (g._graft as GraftState | undefined)?.active; if (!a || a.def.kind !== 'MM') return dmg;
  if (a.jam > 0) return dmg; if (Math.random() < .08) { a.jam = 1.2; g.popup?.(g.px, g.py - 1, 'JAMMED', '#b0a070'); return dmg; }
  return dmg * (1 - .25 * graftStr(g) * (fromBoss ? .6 : 1));
}
