// Test helpers for the shared combat core (node tests only).
import { ABILITIES, ITEM_BY_ID, ENEMIES } from '../config';
import { ABILITY_BY_ID } from '../abilities/registry';
import { Game } from '../sim';
import { newSave } from '../state';
import { dungeonOf } from '../content/dungeons';

/** [abilityId, itemDefId] for every ability that some item grants */
export function abilityItems(): [string, string][] { const out: [string, string][] = []; const seen = new Set<string>(); for (const d of Object.values(ITEM_BY_ID)) for (const a of d.abilities || []) { if (seen.has(a) || ABILITIES[a]?.id === 'defib') continue; seen.add(a); out.push([a, d.id]); } return out; }
export function hasAbility(def: string) { return !!ITEM_BY_ID[def]?.abilities?.length; }
export function eliteKit() { const t = Object.keys(ENEMIES).find(k => ENEMIES[k].elite && !ENEMIES[k].boss && !ENEMIES[k].static)!; return { elite: t, xp: ENEMIES[t].xp, mfr: ENEMIES[t].mfr }; }
/** same seeded sweep on the same target: solo Game vs a 1-player PartyWorld */
export function soloVsParty(P: any) {
  const prep = (g: Game, x: number, y: number) => { for (const e of g.enemies) e.dead = true; g.px = x; g.py = y; g.heat = 0; const e = g.spawnEnemy('worker', x + 2, y); e._rt.reveal = 0; e.hp = e.maxHp = 1e6; return e; };
  const cast = (g: Game, e: any) => { g.beginAim(0); g.updateAim(e.x, e.y, true); g.releaseAim(); for (let i = 0; i < 30; i++) g.update(1 / 20); };
  const rnd = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const o = Math.random; Math.random = rnd(1);
  let solo = 0; try { const g = new Game(newSave(), () => { }); g.startRun('annex'); const sp = g.level.spawn; const e = prep(g, sp.x, sp.y); g.enemies = [...new Set(g.enemies)]; /* solo quirk: saveNow aliases inst.enemies, so a later spawnEnemy lists the enemy twice */ cast(g, e); solo = (g as any).dealt.sweep || 0;  } finally { Math.random = o; }
  const w = new P.PartyWorld('annex', 3, [{ id: 'a', name: 'A', lvl: 12, profile: { level: 12, rep: { HI: 0, PS: 0, MM: 0 }, items: [] } }]); const h = w.hosts.get('a'); const g = h.g;
  const sp = w.level.spawn; const e = w.run(h, () => prep(g, sp.x, sp.y)); w.enemies = g.enemies; for (let i = 0; i < 3; i++) { w.step(); }
  w.run(h, () => { g.beginAim(0); g.updateAim(e.x, e.y, true); g.releaseAim(); }); for (let i = 0; i < 30; i++) w.step();
  return { solo, party: (g as any).dealt.sweep || 0 };
}
void dungeonOf; void ABILITY_BY_ID;
