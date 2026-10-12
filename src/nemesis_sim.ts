// Sim glue for nemesis bosses (docs/NEMESIS.md). Kept out of sim.ts so the hooks there are one-liners.
// Nothing here allocates per frame: nemTick only walks the cached g._nems list (0-3 enemies).
import { ENEMIES, ITEM_BY_ID, SLOTS } from './config';
import { MELEE_WEAPONS } from './traits';
import { scores } from './traitstate';
import { feature } from './features';
import { NEM_CFG, nemOf, onPlayerKilled, pickForRun, nemStats, noteEncounter, onNemesisKilled, MODULES, TAUNTS, type Profile, type Trophy, type NemRec, type DmgType } from './nemesis';

const STAND_IN = ['foreman', 'sawhand'];
/** The body a nemesis wears in later runs: the killer itself when it is a plain elite, otherwise an elite stand-in of the same maker (bosses never respawn mid-dungeon: their death completes the run). */
export function bodyFor(type: string, avoid: string[] = []): string { const d = ENEMIES[type]; if (d && d.elite && !d.boss && !avoid.includes(type)) return type;
  const same = Object.values(ENEMIES).filter(x => x.elite && !x.boss && x.mfr === d?.mfr && !avoid.includes(x.id) && !x.static && x.attacks?.length).sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id)).map(x => x.id); // weakest eligible elite: the nemesis' strength comes from bounded rank steps, not from its body
  return same[0] || STAND_IN.find(x => !avoid.includes(x)) || 'foreman'; }
const typeOfTag = (tag: string, weapon: string): DmgType => tag === 'auto' ? (MELEE_WEAPONS.has(weapon) ? 'blade' : weapon === 'arc' ? 'arc' : 'kinetic') : /pulse|control|hack|arc/.test(tag) ? 'tech' : MELEE_WEAPONS.has(weapon) ? 'blade' : 'kinetic';
export function playerProfile(g: any): Profile { const sc = scores(g.save); const tot = sc.total || 1; const dealt: Record<string, number> = g.dealt || {}; const wk = g.build?.weapon?.kind || 'pistol';
  let all = 0, ab = 0; const byType: Record<string, number> = {}; for (const [k, v] of Object.entries(dealt)) { all += v; if (k !== 'auto') ab += v; const t = typeOfTag(k, wk); byType[t] = (byType[t] || 0) + v; }
  const main = (Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] as DmgType) || typeOfTag('auto', wk);
  const ranged = !MELEE_WEAPONS.has(wk); return { hack: (sc.sig.hack || 0) / tot, burst: all > 0 ? ab / all : .3, kite: (ranged ? .4 : 0) + .6 * ((sc.sig.ghost || 0) + (sc.sig.gun || 0)) / tot, main }; }
function trophyFrom(g: any, seed: number): Trophy | null { const s = g.save; const c = SLOTS.map(sl => ({ sl, it: s.items.find((i: any) => i.uid === s.installed[sl]) })).filter(x => x.it && !String(x.it.def).startsWith('stock_') && ITEM_BY_ID[x.it.def]);
  if (!c.length) return null; const x = c[seed % c.length]; const d = ITEM_BY_ID[x.it.def]; return { def: d.id, name: d.name, rarity: d.rarity, slot: x.sl }; }
export const ownerName = (g: any) => { try { return (g.save.charName || localStorage.getItem('wv_name') || 'Runner').slice(0, 24); } catch { return 'Runner'; } };

/** sim.playerDown hook. Returns the result so the UI / moments can react. */
export function nemOnDown(g: any) { if (!feature('nemesis', g.save.settings) || !g.inst || String(g.inst.id).startsWith('net-')) return null;
  const [type, attack = 'swing'] = String(g.dmgSrc || '').split(':'); const d = ENEMIES[type]; if (!d) return null;
  let near: any = null, bd = 1e9; for (const e of g.enemies) { if (e.dead || e.type !== type) continue; const dd = Math.hypot(e.x - g.px, e.y - g.py); if (dd < bd) { bd = dd; near = e; } }
  const seed = (g.inst.seed ^ (g.save.stats?.runs || 0) * 977) >>> 0; const dd = g.dd;
  const res = onPlayerKilled(g.save, { type, attack, boss: !!d.boss, elite: !!d.elite || !!near?.affix?.length, mfr: d.mfr, dungeon: g.inst.dungeon, nemId: near?.nem, name: d.name },
    { seed, profile: playerProfile(g), trophy: trophyFrom(g, seed), owner: ownerName(g), body: bodyFor(type, [dd?.gateGuard, dd?.lockElite].filter(Boolean)) });
  if (res.kind !== 'none') { const r = res.rec; g.emit('nemesis', { kind: res.kind, id: r.id, name: r.name, title: r.title, taunt: res.taunt, tauntKey: res.tauntKey, trophy: r.trophy?.name || null });
    g.toast(res.kind === 'created' ? `${r.name} marked you. A new nemesis.` : res.kind === 'promoted' ? `${r.name} climbs to ${r.title}.` : res.kind === 'recruited' ? `${r.name} recruits another hunter.` : `${r.name} grows stronger.`); }
  return res; }

/** sim.startRun hook: add at most one nemesis (plus bounded escorts) to a fresh instance roster. */
export function nemOnRunStart(g: any, inst: any) { if (!feature('nemesis', g.save.settings) || String(inst.id).startsWith('net-')) return null; const n = pickForRun(g.save, inst.seed); if (!n) return null;
  const dd = g.dd; const avoid = [dd.gateGuard, dd.lockElite]; const pool = inst.enemies.filter((e: any) => !ENEMIES[e.type]?.boss && !avoid.includes(e.type)); if (!pool.length) return null;
  const at = pool[Math.floor(pool.length * .55)]; const body = ENEMIES[n.body] && !avoid.includes(n.body) ? n.body : bodyFor(n.src, avoid); const mul = g.hpMul();
  const bossHp = (ENEMIES[dd.defaultBoss]?.hp || ENEMIES[body].hp * 4) * mul; const st = nemStats(n, ENEMIES[body].hp * mul, bossHp);
  const mk = (type: string, hp: number, dx: number, dy: number, extra: any) => { const e = { id: inst.nextId++, type, x: at.x + dx, y: at.y + dy, hp, maxHp: hp, alert: false, dead: false, home: { x: at.x + dx, y: at.y + dy }, group: 97, faction: 'enemy', ctrlT: 0, stunT: 0, ...extra }; inst.enemies.push(e); return e; };
  const boss = mk(body, st.hp, .6, .3, { nem: n.id, name: n.name, nemOwner: n.owner });
  const esc = pool.find((e: any) => !ENEMIES[e.type].elite)?.type; if (esc) for (let i = 0; i < st.escorts; i++) mk(esc, ENEMIES[esc].hp * mul, -.7 + i * 1.4, -.8, { nemEscort: n.id });
  noteEncounter(g.save, n.id); return boss; }

/** Per-frame: only the cached nemesis enemies (<= 1 + escorts). Applies modules that are not plain numbers. */
export function nemTick(g: any, dt: number) { const L = g._nems as any[] | undefined; if (!L || !L.length) return;
  for (const e of L) { if (e.dead) continue; const rt = e._rt; const n: NemRec | undefined = nemOf(g.save).list.find(x => x.id === e.nem); if (!n) continue;
    if (!rt.nemInit) { rt.nemInit = 1; const st = nemStats(n, e.maxHp, e.maxHp); rt.nemSt = st; rt.hardDmg = (rt.hardDmg || 1) * st.dmgMul; if (st.shield > 0 && !e.nemShieldUsed) { rt.shield = { hp: e.maxHp * st.shield, max: e.maxHp * st.shield, t: 999 }; e.nemShieldUsed = true; } rt.pCtrl = e.ctrlT; rt.pStun = e.stunT; rt.pHack = rt.hack || 0; rt.gapCd = NEM_CFG.gapCd * .5; }
    if (!rt.nemSeen && e.alert) { rt.nemSeen = 1; const k = 'return_' + (1 + (n.encounters % 2)); g.emit('nemesis', { kind: 'return', id: n.id, name: n.name, taunt: TAUNTS[k], tauntKey: k }); }
    const st = rt.nemSt; if (st.ciMul < 1) { if (e.ctrlT > rt.pCtrl) e.ctrlT = rt.pCtrl + (e.ctrlT - rt.pCtrl) * st.ciMul; if (e.stunT > rt.pStun) e.stunT = rt.pStun + (e.stunT - rt.pStun) * st.ciMul; if ((rt.hack || 0) > rt.pHack) rt.hack = rt.pHack + (rt.hack - rt.pHack) * st.ciMul; }
    rt.pCtrl = e.ctrlT; rt.pStun = e.stunT; rt.pHack = rt.hack || 0;
    if (st.gap && e.alert && !g.downed) { rt.gapCd -= dt; const d = Math.hypot(g.px - e.x, g.py - e.y); if (rt.gapCd <= 0 && d > NEM_CFG.gapMinDist && d < 22 && e.stunT <= 0 && e.ctrlT <= 0) { rt.gapCd = NEM_CFG.gapCd; const k = Math.min(NEM_CFG.gapRange, d - 1.5) / d; const p = g.moveCircle(e.x, e.y, (g.px - e.x) * k, (g.py - e.y) * k, ENEMIES[e.type].radius); g.fx.push({ kind: 'ring', x: e.x, y: e.y, r: 1, t: 0, life: .35, c: '#c9a46a' }); e.x = p.x; e.y = p.y; } } } }
export const nemCache = (g: any) => { g._nemSelf = ownerName(g); g._nems = (g.enemies || []).filter((e: any) => e.nem); };
/** hurtEnemy hook: resistance to the player's main damage type. */
export function nemIncoming(g: any, e: any, dmg: number, tag: string): number { const st = e._rt?.nemSt; if (!st || !st.resist) return dmg; return typeOfTag(tag, g.build?.weapon?.kind || 'pistol') === st.resistType ? dmg * (1 - st.resist) : dmg; }
/** killEnemy hook: permanent kill + provenance trophy. */
export function nemOnKill(g: any, e: any) { if (!e.nem) return null; const t = onNemesisKilled(g.save, e.nem); if (!t) return null; g.emit('nemesis', { kind: 'killed', id: e.nem, name: t.name, line: t.line, tauntKey: 'death_' + (1 + (t.kills % 2)) }); g.toast(t.line + '. Trophy: ' + t.name); g.emit('moment', { kind: 'nemesis_kill', title: t.line, sub: t.name }); return t; }
export const moduleList = (n: NemRec) => n.modules.map(m => MODULES[m].name);
