// Nemesis bosses (docs/NEMESIS.md). PURE per-character save logic: no DOM, no sim imports, deterministic given a seed.
// AI may only supply WORDS (name / title / taunt) through applyWords(), which validates and otherwise keeps the canned words.
// Every gameplay number comes from NEM_CFG and is clamped by nemStats(); tests/nemesis.mjs + tests/balance_nemesis.mjs pin the caps.
export const NEM_CFG = {
  /** chance a killing boss / elite becomes a nemesis (rolled from the run seed + death count, so it is reproducible) */ chanceBoss: 1, chanceElite: .5,
  maxActive: 3, maxRank: 5, maxRecruits: 2,
  /** chance an active nemesis shows up in a run (one per run at most) */ spawnChance: .6,
  hpStep: .1, hpCap: 1.5, dmgStep: .05, dmgCap: 1.25,
  resistStep: .06, resistCap: .3,
  shieldPct: .2, shieldCap: .3,
  /** counter-intrusion: hack / control / stun durations on it are multiplied by this */ ciMul: .5,
  gapCd: 7, gapMinDist: 6, gapRange: 5,
  /** modules active per rank (rank 1..5) */ modulesByRank: [1, 1, 2, 2, 3],
  /** kills needed for each tier */ tiers: [{ id: 'stalker', kills: 1 }, { id: 'captain', kills: 3 }, { id: 'warlord', kills: 5 }] as const,
  /** a nemesis never out-scales the regular boss of its dungeon: effective hp (shield + resist included) is capped at this fraction of that boss's hp */ hpVsBossCap: .6,
  /** scars a nemesis can carry (cosmetic + words only) */ maxScars: 3,
  /** first-session guarantee: the first elite that kills or chases you off becomes a nemesis, and a fresh nemesis always shows up in your next run, so the system is seen in the first 30 minutes */ firstAlways: true,
} as const;
export type Scar = 'kinetic' | 'blade' | 'arc' | 'tech';
export const SCARS: Record<Scar, { name: string; tip: string }> = {
  kinetic: { name: 'Bullet-pocked', tip: 'Your rounds are still in it. Patched, not removed.' }, blade: { name: 'Stitched', tip: 'A long blade scar from your last fight, stapled shut.' },
  arc: { name: 'Arc-burned', tip: 'Burn scars where your arc fire caught it.' }, tech: { name: 'Scorched port', tip: 'Its neural port is blackened from your hacks.' } };
export type Tier = 'stalker' | 'captain' | 'warlord';
export type Module = 'counter_intrusion' | 'shield' | 'gap_closer' | 'resist';
export const MODULES: Record<Module, { name: string; tip: string }> = {
  counter_intrusion: { name: 'Counter-ICE', tip: 'Hacks, stuns and control last half as long on it.' },
  shield: { name: 'Burst Plating', tip: 'Starts behind a shield that soaks your opening burst.' },
  gap_closer: { name: 'Gap Closer', tip: 'Dashes at you when you keep your distance.' },
  resist: { name: 'Adapted Hide', tip: 'Takes less damage from your main damage type.' },
};
export const DMG_TYPES = ['kinetic', 'blade', 'arc', 'tech'] as const; export type DmgType = typeof DMG_TYPES[number];
export interface Profile { hack: number; burst: number; kite: number; main: DmgType }
export interface Trophy { def: string; name: string; rarity: string; slot: string }
export interface NemRec { id: string; src: string; body: string; mfr: string; name: string; title: string; rank: number; kills: number; encounters: number; status: 'active' | 'dead'; tier: Tier;
  modules: Module[]; resist: DmgType; trophy: Trophy | null; method: string; cat: MethodCat; dungeon: string; born: number; lastSeen: number; taunt: string; tauntKey: string; words: 'canned' | 'ai'; recruits: number; owner: string; parent?: string;
  /** visible damage the player left on it (max NEM_CFG.maxScars), from the player's main damage type */ scars?: Scar[]; /** what it read about the player last time: build_* / limb_* taunt key (the city-memory hook) */ read?: string }
export interface TrophyItem { id: string; nem: string; name: string; title: string; kills: number; line: string; at: number; trophy: Trophy | null; owner: string }
export interface NemState { v: 1; list: NemRec[]; seq: number; deaths: number; flees?: number; trophies: TrophyItem[] }
export const nemOf = (s: any): NemState => { if (!s.nemesis || s.nemesis.v !== 1) s.nemesis = { v: 1, list: [], seq: 1, deaths: 0, trophies: [] }; return s.nemesis; };
export const activeNems = (s: any) => nemOf(s).list.filter(n => n.status === 'active');

// ---------- deterministic rng ----------
export function rng(seed: number) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T,>(r: () => number, a: readonly T[]) => a[Math.floor(r() * a.length) % a.length];

// ---------- words (canned; AI may replace through applyWords) ----------
export type MethodCat = 'melee' | 'ranged' | 'charge' | 'slam' | 'zone';
export function methodCat(attack: string): MethodCat { const a = (attack || '').toLowerCase();
  if (/charge|dash|lunge|leap|rush/.test(a)) return 'charge'; if (/slam|sweep|quake|stomp|smash/.test(a)) return 'slam';
  if (/zone|env|pool|field|burn|gas|mine|trap|pulse/.test(a)) return 'zone'; if (/shot|volley|proj|beam|bolt|snipe|turret|fire|laser/.test(a)) return 'ranged'; return 'melee'; }
const FIRST = ['Vesk', 'Harrow', 'Kade', 'Morrow', 'Sixer', 'Grail', 'Tallis', 'Rue', 'Corvin', 'Ash', 'Brand', 'Quill', 'Dresner', 'Mako', 'Siren', 'Lark', 'Voss', 'Crane'] as const;
const EPI: Record<MethodCat, readonly string[]> = { melee: ['the Butcher', 'Cold Hands', 'the Tailor'], ranged: ['Long Eye', 'the Patient', 'Deadline'], charge: ['the Battering Ram', 'Freight', 'No Brakes'], slam: ['the Hammer', 'Groundbreaker', 'the Anvil'], zone: ['the Furnace', 'Slow Burn', 'the Quiet Room'] };
const TITLE: Record<Tier, string> = { stalker: 'Stalker', captain: 'Captain', warlord: 'Warlord' };
/** Voiced, variable-free taunt templates. The key is what tools/gen_nemesis_voice.mjs voices and caches (public/audio/nemesis/<key>.mp3). */
export const TAUNTS: Record<string, string> = {
  melee_1: 'Up close you just fold. Come back and fold again.', melee_2: 'I felt your chrome crack. I kept a piece of it.', melee_3: 'You fought like you had somewhere to be. Now you do not.',
  ranged_1: 'One clean shot. You never even saw the angle.', ranged_2: 'Keep running. I like a moving target.', ranged_3: 'I had you in my sights the whole way in.',
  charge_1: 'You heard me coming. It did not help.', charge_2: 'Stand still next time. It hurts less.', charge_3: 'I went straight through you, runner.',
  slam_1: 'The floor shook and you went down with it.', slam_2: 'Bones and chrome sound the same when they break.', slam_3: 'Get up. I want to do that again.',
  zone_1: 'You walked right into it. Every time.', zone_2: 'Fire does the work. I just watch.', zone_3: 'Wrong room, runner. It is always the wrong room.',
  promote_1: 'They gave me a crew for what I did to you.', promote_2: 'Every time you die, I climb.',
  recruit_1: 'I found someone else who wants a piece of you.',
  death_1: 'Keep the trophy. They will remember who earned it.', death_2: 'Took you long enough.',
  return_1: 'Back again? I kept your seat warm.', return_2: 'I have been learning how you fight.',
  build_hack: 'Your hacks bounce off me now. I paid for new ICE.', build_burst: 'You open loud. I wear plating for that now.', build_kite: 'You keep your distance. I learned to close it.',
  build_blade: 'You cut the same way every time. I stitched over it.', build_kinetic: 'I dug your rounds out myself. Bring more.', build_arc: 'Your arc fire left marks. I kept every one.', build_tech: 'I know what your tech does now. It tickles.',
  limb_arm: 'Down an arm since last time? I remember which one.', limb_leg: 'Limping now. I will hear you coming.',
  fled_1: 'You ran. Everyone saw you run.', fled_2: 'Ran last time. Run again, I am faster now.',
};
export const tauntKeys = (prefix: string) => Object.keys(TAUNTS).filter(k => k.startsWith(prefix + '_'));
export function cannedWords(r: () => number, cat: MethodCat, tier: Tier) { const first = pick(r, FIRST); return { name: first + ' ' + pick(r, EPI[cat]), title: TITLE[tier], tauntKey: pick(r, tauntKeys(cat)) }; }
const BANNED = /\b(drug|drugs|dope|meth|cocaine|coke|heroin|crack|pill|pills|stim|stims|high|junkie|dealer|dose|overdose|weed|smack)\b/i;
/** Validate AI words. Returns the accepted fields only; anything failing is left canned. */
export function applyWords(rec: NemRec, w: any): boolean { if (!w || typeof w !== 'object') return false; let any = false;
  const okS = (v: any, max: number, re: RegExp) => typeof v === 'string' && v.trim().length >= 2 && v.length <= max && re.test(v) && !BANNED.test(v) && !/\d/.test(v);
  const nOk = okS(w.name, 28, /^[A-Za-z][A-Za-z' .-]+$/), tOk = okS(w.taunt, 140, /^[^<>{}\[\]`]+$/);
  if ((w.name != null && !nOk) || (w.taunt != null && !tOk) || (!nOk && !tOk)) return false; // all or nothing: one bad field rejects the reply
  if (nOk) rec.name = w.name.trim(); if (tOk) { rec.taunt = w.taunt.trim(); rec.tauntKey = ''; } // custom text: no cached voice, text fallback
  rec.words = 'ai'; void any; return true; }

// ---------- reading the player (deterministic; words + scars only) ----------
/** Taunt key for what this nemesis noticed about you. Limb losses win (read from the save; any limb system can fill s.limbs.lost = ['armL', ...]), then the strongest profile signal, then damage type. */
export function readKey(p: Profile, lost: string[] = []): string { const l = lost.find(x => /arm|leg/i.test(x)); if (l) return /arm/i.test(l) ? 'limb_arm' : 'limb_leg';
  if (p.hack >= .3) return 'build_hack'; if (p.burst >= .5) return 'build_burst'; if (p.kite >= .5) return 'build_kite'; return 'build_' + (DMG_TYPES.includes(p.main) ? p.main : 'kinetic'); }
export const lostLimbs = (s: any): string[] => { const L = s?.limbs?.lost ?? s?.lostLimbs; return Array.isArray(L) ? L.filter((x: any) => typeof x === 'string').slice(0, 4) : []; };
export function addScar(n: NemRec, t: DmgType) { const sc = (n.scars ||= []); if (!sc.includes(t) && sc.length < NEM_CFG.maxScars) sc.push(t); }
export const scarText = (n: NemRec) => (n.scars || []).filter(x => x in SCARS).map(x => SCARS[x].name).join(', ');
/** The line it says when it finds you again: what it read about you, else the generic return lines. */
export function returnLine(n: NemRec): { key: string; text: string } { if ((n as any).fled && n.encounters <= 1) { const k = 'fled_' + (1 + (n.encounters % 2)); return { key: k, text: TAUNTS[k] }; }
  if (n.read && TAUNTS[n.read] && n.encounters % 2 === 1) return { key: n.read, text: TAUNTS[n.read] }; const k = 'return_' + (1 + (n.encounters % 2)); return { key: k, text: TAUNTS[k] }; }

// ---------- adaptation ----------
/** Counter-modules from the player's recent profile. Deterministic; ordered by how strongly the profile asks for each. */
export function adapt(p: Profile, rank: number): { modules: Module[]; resist: DmgType } {
  const sc: [Module, number][] = [['counter_intrusion', p.hack >= .2 ? p.hack + .1 : 0], ['shield', p.burst >= .35 ? p.burst : 0], ['gap_closer', p.kite >= .35 ? p.kite : 0], ['resist', .3]];
  sc.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); const n = NEM_CFG.modulesByRank[Math.max(0, Math.min(NEM_CFG.maxRank, rank) - 1)];
  return { modules: sc.filter(x => x[1] > 0).slice(0, n).map(x => x[0]), resist: DMG_TYPES.includes(p.main) ? p.main : 'kinetic' }; }
export const tierFor = (kills: number): Tier => { let t: Tier = 'stalker'; for (const x of NEM_CFG.tiers) if (kills >= x.kills) t = x.id; return t; };

// ---------- lifecycle ----------
export interface Killer { type: string; attack: string; boss: boolean; elite: boolean; mfr: string; dungeon: string; nemId?: string; name: string }
export interface DeathCtx { seed: number; profile: Profile; trophy: Trophy | null; owner: string; body: string; now?: number; /** lost limbs at death (any limb system), for taunts */ lost?: string[]; /** fraction of its hp the player took off (0..1); >= .25 leaves a scar */ hurt?: number }
export type DeathResult = { kind: 'created' | 'promoted' | 'ranked' | 'recruited'; rec: NemRec; taunt: string; tauntKey: string } | { kind: 'none' };
/** fled = the player left the run while this boss/elite was on them. Fleeing never ranks up an existing nemesis (so avoiding is always safe); it can only mark a new one, with the same caps. */
export function onPlayerKilled(s: any, k: Killer, c: DeathCtx, fled = false): DeathResult {
  const N = nemOf(s); const now = c.now ?? Date.now(); if (fled) N.flees = (N.flees || 0) + 1; else N.deaths++; const r = rng((c.seed ^ Math.imul(N.deaths + (N.flees || 0) * 7919, 2654435761)) >>> 0);
  if (k.nemId && fled) return { kind: 'none' };
  if (k.nemId) { const n = N.list.find(x => x.id === k.nemId); if (!n || n.status !== 'active') return { kind: 'none' };
    n.kills++; n.rank = Math.min(NEM_CFG.maxRank, n.rank + 1); n.lastSeen = now; const t0 = n.tier; n.tier = tierFor(n.kills); n.title = TITLE[n.tier];
    const a = adapt(c.profile, n.rank); n.modules = a.modules; n.resist = a.resist; n.method = k.attack; n.cat = methodCat(k.attack);
    n.read = readKey(c.profile, c.lost); if ((c.hurt ?? 1) >= .25) addScar(n, n.resist);
    const promoted = n.tier !== t0; n.tauntKey = promoted ? pick(r, tauntKeys('promote')) : (n.kills % 2 === 0 ? n.read : pick(r, tauntKeys(n.cat))); if (n.words !== 'ai' || promoted) n.taunt = TAUNTS[n.tauntKey];
    return { kind: promoted ? 'promoted' : 'ranked', rec: n, taunt: n.taunt, tauntKey: n.tauntKey }; }
  if (!k.boss && !k.elite) return { kind: 'none' };
  const first = NEM_CFG.firstAlways && N.list.length === 0; if (!first && r() >= (k.boss ? NEM_CFG.chanceBoss : NEM_CFG.chanceElite)) return { kind: 'none' };
  const act = N.list.filter(x => x.status === 'active');
  if (act.length >= NEM_CFG.maxActive) { // hierarchy full: the strongest nemesis recruits this killer as an escort instead
    const top = [...act].sort((a, b) => b.rank - a.rank || b.kills - a.kills)[0]; if (top.recruits >= NEM_CFG.maxRecruits) return { kind: 'none' };
    top.recruits++; top.tauntKey = 'recruit_1'; top.taunt = TAUNTS.recruit_1; return { kind: 'recruited', rec: top, taunt: top.taunt, tauntKey: top.tauntKey }; }
  const cat = methodCat(k.attack); const w = cannedWords(r, cat, 'stalker'); const a = adapt(c.profile, 1);
  const rec: NemRec = { id: 'n' + (N.seq++), src: k.type, body: c.body, mfr: k.mfr, name: w.name, title: TITLE.stalker, rank: 1, kills: 1, encounters: 0, status: 'active', tier: 'stalker', modules: a.modules, resist: a.resist,
    trophy: c.trophy, method: k.attack, cat, dungeon: k.dungeon, scars: (c.hurt ?? 0) >= .25 ? [a.resist] : [], read: readKey(c.profile, c.lost), born: now, lastSeen: now, taunt: TAUNTS[w.tauntKey], tauntKey: w.tauntKey, words: 'canned', recruits: 0, ...(fled ? { fled: true } : {}), owner: String(c.owner || 'Runner').slice(0, 24) };
  N.list.push(rec); return { kind: 'created', rec, taunt: rec.taunt, tauntKey: rec.tauntKey }; }
/** Choose at most one active nemesis for a new run (seeded). Dead nemeses are never chosen. */
export function pickForRun(s: any, seed: number): NemRec | null { const act = activeNems(s); if (!act.length) return null; const r = rng(seed ^ 0x9e3779b9);
  const fresh = NEM_CFG.firstAlways ? act.find(n => n.encounters === 0) : undefined; if (fresh) return fresh; if (r() >= NEM_CFG.spawnChance) return null; const w = act.map(n => 1 + n.rank + n.kills); let t = r() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < act.length; i++) { t -= w[i]; if (t <= 0) return act[i]; } return act[act.length - 1]; }
export interface NemStats { hp: number; dmgMul: number; shield: number; resist: number; resistType: DmgType; ciMul: number; gap: boolean; escorts: number }
/** All runtime numbers for one nemesis, clamped. baseHp = body hp after dungeon tier scaling; bossHp = this dungeon's boss hp (same scaling). */
export function nemStats(n: NemRec, baseHp: number, bossHp: number): NemStats { const C = NEM_CFG; const rank = Math.max(1, Math.min(C.maxRank, n.rank | 0));
  const mods = new Set(n.modules.filter(m => m in MODULES).slice(0, C.modulesByRank[rank - 1]));
  const shield = mods.has('shield') ? Math.min(C.shieldCap, C.shieldPct + .02 * (rank - 1)) : 0, resist = mods.has('resist') ? Math.min(C.resistCap, C.resistStep * rank) : 0;
  // effective hp (hp + shield, through resistance) never passes hpVsBossCap of the dungeon boss, unless the bare body already does
  const effCap = bossHp * C.hpVsBossCap * (1 - resist) / (1 + shield); const hp = Math.min(baseHp * Math.min(C.hpCap, 1 + C.hpStep * rank), Math.max(baseHp, effCap));
  return { hp, dmgMul: Math.min(C.dmgCap, 1 + C.dmgStep * rank), shield, resist, resistType: n.resist, ciMul: mods.has('counter_intrusion') ? C.ciMul : 1, gap: mods.has('gap_closer'), escorts: Math.min(C.maxRecruits, n.recruits | 0) }; }
export function noteEncounter(s: any, id: string, now = Date.now()) { const n = nemOf(s).list.find(x => x.id === id); if (n) { n.encounters++; n.lastSeen = now; } return n; }
/** Permanent kill: the nemesis is gone for good and the player gets a unique provenance trophy. Idempotent. */
export function onNemesisKilled(s: any, id: string, now = Date.now()): TrophyItem | null { const N = nemOf(s); const n = N.list.find(x => x.id === id); if (!n || n.status !== 'active') return null;
  n.status = 'dead'; n.lastSeen = now; const line = `Killed ${n.name}, who killed you ${n.kills} time${n.kills === 1 ? '' : 's'}`;
  const t: TrophyItem = { id: 'trophy_' + n.id, nem: n.id, name: n.name + "'s Mark", title: n.title, kills: n.kills, line, at: now, trophy: n.trophy, owner: n.owner }; N.trophies.push(t);
  for (const o of N.list) if (o.parent === n.id) delete o.parent; return t; }
/** Public, tamper-checked subset shown to other players (inspect card / build export). */
export function publicTrophies(s: any): { name: string; line: string; at: number }[] { return nemOf(s).trophies.filter(t => t && typeof t.line === 'string').slice(-6).map(t => ({ name: String(t.name).slice(0, 40), line: String(t.line).slice(0, 90), at: +t.at || 0 })); }
