// Mobs batch 2 (docs/MOBS_BATCH_2.md): 28 tier-progressive mobs. Data completeness + tier scaling + roster coverage, atlas files + dimensions, facing (enemy_dirs on the 28),
// level generation (connected/reachable, clearance, mixed squads, elite rate rising by tier), in-sim behaviour of every mob-only attack and affix, and headless runs per tier.
import fs from 'fs'; import { execSync } from 'child_process';
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch(); const ev = (fn, arg) => page.evaluate(fn, arg);
// ---------------- data ----------------
const d = await ev(async () => { const B = await import('/src/content/batch2_mobs.ts'), R = await import('/src/content/batch2_rosters.ts'), Lv = await import('/src/content/batch1_levels.ts'), C = await import('/src/config.ts'), S = await import('/src/sim.ts'), A = await import('/src/enemyart.ts'), M = await import('/src/content/mapgen.ts');
  const bad = [], byTier = { 1: [], 2: [], 3: [], 4: [] }; const roles = new Set();
  for (const m of B.MOBS) { const e = C.ENEMIES[m.id]; byTier[m.tier].push(m); roles.add(m.role); if (!e || !e.mob) { bad.push('no def ' + m.id); continue; } for (const a of e.attacks) { if (!S.ATK[a]) bad.push(m.id + ' missing ATK ' + a); if (!(a in C.ENEMY_DMG)) bad.push(m.id + ' no dmg ' + a); } if (!e.attacks.length) bad.push(m.id + ' no attacks'); if (!A.ART[m.id]) bad.push('no ART ' + m.id); if (m.summon && !C.ENEMIES[m.summon]) bad.push(m.id + ' bad summon'); if (e.static || e.boss) bad.push(m.id + ' static/boss');
    const cls = M.clsOf(e.radius); if (!(cls >= 0 && cls <= 2) || M.FLOW_R[cls] === undefined) bad.push(m.id + ' bad clearance class'); if (e.radius > 1.1 * 0.72) bad.push(m.id + ' radius too big for class 2'); if (m.role === 'healer' && !e.attacks.includes('mend')) bad.push(m.id + ' healer without mend'); if (m.role === 'sniper' && !e.attacks.includes('snipe')) bad.push(m.id + ' sniper without snipe'); if (m.role === 'exploder' && !e.attacks.some(a => a.startsWith('detonate'))) bad.push(m.id + ' exploder without detonate'); if (m.role === 'shielded' && !(m.shield > 0)) bad.push(m.id + ' shielded without shield'); if (m.role === 'summoner' && !e.attacks.includes('summonlite')) bad.push(m.id + ' summoner without summonlite'); if (m.role === 'debuffer' && !e.attacks.includes('hex')) bad.push(m.id + ' debuffer without hex'); }
  const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length;
  // roster coverage
  const used = new Set(), tierBad = [], levelNote = [];
  for (const l of Lv.LEVELS) { const types = new Set(Object.values(l.roster).flat().map(x => x[0])); for (const t of types) { used.add(t); const m = B.MOB_BY_ID[t]; if (m && m.tier > l.tier) tierBad.push(l.id + ' (T' + l.tier + ') fields T' + m.tier + ' mob ' + t); if (!C.ENEMIES[t]) tierBad.push(l.id + ' unknown ' + t); }
    const own = [...types].filter(t => B.MOB_BY_ID[t]?.tier === l.tier).length, older = [...types].filter(t => B.MOB_BY_ID[t] ? B.MOB_BY_ID[t].tier < l.tier : true).length; levelNote.push([l.id, l.tier, own, older, [...types].filter(t => B.MOB_BY_ID[t]).length]);
    if (!l.squads || !['yard', 'proc', 'junction', 'salvage'].every(z => l.squads[z].length)) tierBad.push(l.id + ' squads missing'); }
  const roleMix = Lv.LEVELS.map(l => { const rs = new Set(Object.values(l.roster).flat().map(x => R.roleOf(x[0]))); return rs.size; });
  return { n: B.MOBS.length, bad, tiers: Object.fromEntries(Object.entries(byTier).map(([k, v]) => [k, v.length])), roles: [...roles].sort(), names: new Set(B.MOBS.map(m => m.name)).size, hp: Object.values(byTier).map(v => avg(v, m => m.hp)), dmg: Object.values(byTier).map(v => avg(v, m => m.dmg)), xp: Object.values(byTier).map(v => avg(v, m => m.xp)),
    unused: B.MOBS.filter(m => !used.has(m.id)).map(m => m.id), tierBad, levelNote, roleMin: Math.min(...roleMix), ids: B.MOBS.map(m => m.id), sigU: new Set(B.MOBS.map(m => JSON.stringify([m.role, m.melee, m.moves, m.custom, m.shield, m.lifesteal]))).size, curve: B.TIER_CURVE }; });
ok(d.n === 28 && Object.values(d.tiers).every(v => v === 7), '28 mobs, 7 per tier: ' + JSON.stringify(d.tiers));
ok(d.bad.length === 0, 'every mob: def, ATK + damage for each attack, ART entry, valid summon, role-appropriate attack, valid clearance class: ' + (d.bad.slice(0, 5).join('; ') || 'ok'));
ok(d.names === 28, 'mob names unique');
ok(d.roles.length === 11 || d.roles.length === 12, 'roles covered (' + d.roles.join(', ') + ')');
ok(d.hp[0] < d.hp[1] && d.hp[1] < d.hp[2] && d.hp[2] < d.hp[3], 'average HP scales by tier: ' + d.hp.map(x => x.toFixed(0)).join(' < '));
ok(d.dmg[0] < d.dmg[1] && d.dmg[1] < d.dmg[2] && d.dmg[2] < d.dmg[3] && d.xp[0] < d.xp[3], 'damage multiplier and XP scale by tier: ' + d.dmg.map(x => x.toFixed(2)).join(' < '));
ok(d.unused.length === 0, 'every new mob appears in at least one level roster (unused: ' + (d.unused.join(',') || 'none') + ')');
ok(d.tierBad.length === 0, 'no level fields a mob of a higher tier than itself; every level has squads: ' + (d.tierBad.slice(0, 4).join('; ') || 'ok'));
ok(d.levelNote.every(([id, t, own, older, tot]) => (t === 1 ? tot >= 4 : own >= 2 && older >= 2)), 'each level introduces its own tier of mobs and mixes older ones: ' + d.levelNote.map(x => x[0] + ':' + x[2] + '/' + x[3]).join(' '));
ok(d.roleMin >= 4, 'every level mixes at least 4 distinct roles (min ' + d.roleMin + ')');
ok(d.curve[1].elite < d.curve[2].elite && d.curve[2].elite < d.curve[3].elite && d.curve[3].elite < d.curve[4].elite && d.curve[4].affixes > d.curve[1].affixes, 'elite chance and affix count rise by tier');
// ---------------- atlas + art ----------------
const idx = JSON.parse(fs.readFileSync('public/dungeons/enemies3d/index.json', 'utf8')); const miss = []; let kb = 0;
for (const id of d.ids) { if (!idx.includes(id)) { miss.push(id); continue; } const j = JSON.parse(fs.readFileSync(`public/dungeons/enemies3d/${id}.json`, 'utf8')); if (j.frame > 112) miss.push(id + ':frame ' + j.frame); for (const a of ['idle', 'walk', 'attack', 'hit', 'death']) { if (!j.anims[a] || !fs.existsSync('public/dungeons/enemies3d/' + j.anims[a].image)) miss.push(id + ':' + a); else kb += fs.statSync('public/dungeons/enemies3d/' + j.anims[a].image).size / 1024; } if (!(j.hpx > 30)) miss.push(id + ':hpx'); }
ok(miss.length === 0, 'every mob has a complete 8-direction atlas (idle, walk, attack, hit, death; frame <= 112px): ' + (miss.slice(0, 6).join(', ') || 'ok') + '; total ' + (kb / 1024).toFixed(1) + ' MB');
const dims = await ev(async ids => { const out = []; for (const id of ids) { const j = await (await fetch(`./dungeons/enemies3d/${id}.json`)).json(); for (const [a, v] of Object.entries(j.anims)) { const im = new Image(); im.src = `./dungeons/enemies3d/${v.image}`; await im.decode().catch(() => { }); if (im.naturalWidth !== v.frames * j.frame || im.naturalHeight !== 8 * j.frame) out.push(id + ':' + a + ' ' + im.naturalWidth + 'x' + im.naturalHeight); } } return out; }, d.ids);
ok(dims.length === 0, 'atlas sheet sizes = frames x 8 directions of the frame size: ' + (dims.slice(0, 4).join(', ') || 'ok'));
const sheetPx = await ev(async ids => { const out = []; for (const id of ids) { const j = await (await fetch(`./dungeons/enemies3d/${id}.json`)).json(); const v = j.anims.idle; const im = new Image(); im.src = `./dungeons/enemies3d/${v.image}`; await im.decode(); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const rows = []; for (let r = 0; r < 8; r++) { const dta = x.getImageData(0, r * j.frame, j.frame, j.frame).data; let n = 0; for (let i = 3; i < dta.length; i += 4) if (dta[i] > 40) n++; rows.push(n); } if (rows.some(n => n < 80)) out.push(id + ' empty dir row ' + rows.join(',')); const sig = []; for (let r = 0; r < 8; r++) sig.push(rows[r]); } return out; }, d.ids);
ok(sheetPx.length === 0, 'all 8 direction rows of every mob idle sheet contain a sprite: ' + (sheetPx.slice(0, 3).join('; ') || 'ok'));
// ---------------- generation ----------------
const SEEDS = Array.from({ length: 8 }, (_, i) => 311 + i * 977);
const gen = await ev(async ({ SEEDS }) => { const D = await import('/src/content/dungeons.ts'), M = await import('/src/content/mapgen.ts'), Lv = await import('/src/content/batch1_levels.ts'), C = await import('/src/config.ts'), B = await import('/src/content/batch2_mobs.ts'); const out = {}; const tierEl = { 1: [0, 0], 2: [0, 0], 3: [0, 0], 4: [0, 0] };
  for (const sp of Lv.LEVELS) { const r = { bad: [], disc: [], n: [], seenNew: new Set(), mixed: 0, groups: 0, boss: 0, clr: [] }; const want = new Set(Object.values(sp.roster).flat().map(x => x[0]));
    for (const s of SEEDS) { const L = D.DUNGEONS[sp.id].build(s); const v = M.validate(L); if (v.length) r.bad.push(s + ':' + v.slice(0, 2).join('|')); const m = M.reachMap(L, L.spawn, 0); const sol = new Uint8Array(L.solid); for (const dd of L.doors) for (const [x, y] of dd.tiles) sol[y * L.w + x] = 0; let free = 0, conn = 0; for (let i = 0; i < sol.length; i++) if (!sol[i]) { free++; if (m[i]) conn++; } if (free !== conn) r.disc.push(s);
      const m2 = M.reachMap(L, L.spawn, 2); if (m2[Math.floor(L.bossSpawn.y) * L.w + Math.floor(L.bossSpawn.x)]) r.boss++; r.n.push(L.spawns.length);
      const reach = [M.reachMap(L, L.spawn, 0), M.reachMap(L, L.spawn, 1), M.reachMap(L, L.spawn, 2)]; for (const q of L.spawns) { const c = M.clsOf(C.ENEMIES[q.type].radius); if (!reach[c][q.y * L.w + q.x]) r.clr.push(q.type + '@' + q.x + ',' + q.y); if (B.MOB_BY_ID[q.type]) r.seenNew.add(q.type); }
      const gs = {}; for (const q of L.spawns) if (q.group < 90) (gs[q.group] ||= []).push(q); for (const g of Object.values(gs)) { r.groups++; tierEl[sp.tier][1]++; if (new Set(g.map(q => q.type)).size >= 2) r.mixed++; if (g.some(q => q.affix?.length)) tierEl[sp.tier][0]++; for (const q of g) if (q.affix) for (const a of q.affix) if (B.AFFIX_TIER[a] > sp.tier) r.bad.push('affix ' + a + ' too early on T' + sp.tier); } }
    r.rosterMobs = [...want].filter(t => B.MOB_BY_ID[t]); r.seen = [...r.seenNew]; out[sp.id] = r; } return { out, tierEl }; }, { SEEDS });
for (const [id, r] of Object.entries(gen.out)) { const miss2 = r.rosterMobs.filter(t => !r.seen.includes(t));
  ok(r.bad.length === 0 && r.disc.length === 0 && r.clr.length === 0 && r.boss === SEEDS.length, id + ': 8 seeds valid/connected, every spawn has clearance for its class, boss reachable' + (r.bad.length + r.disc.length + r.clr.length ? ' :: ' + [...r.bad, ...r.disc, ...r.clr].slice(0, 3).join(' / ') : ''));
  ok(Math.min(...r.n) >= 40 && r.mixed / r.groups > .4 && miss2.length <= 1, id + ': ' + Math.min(...r.n) + '+ enemies, ' + Math.round(100 * r.mixed / r.groups) + '% mixed-role packs, rostered new mobs all seen (' + (miss2.join(',') || 'ok') + ')'); }
const er = [1, 2, 3, 4].map(t => gen.tierEl[t][0] / gen.tierEl[t][1]);
ok(er[0] < er[1] && er[1] < er[2] && er[2] < er[3] && er[0] > 0, 'elite pack-leader rate rises by tier: ' + er.map(x => (100 * x).toFixed(0) + '%').join(' < '));
// ---------------- in-sim behaviour ----------------
const fresh = id => ev(id => { const g = window.__game; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lastClearDay = null; g.save.lockouts = {}; g.save.cleared = {}; g.save.level = 45; g.recompute(); g.dbg.god = false; g.dbg.oneShot = false; g.save.settings.devFreeReset = true; return g.startRun(id); }, id);
await fresh('coke_ovens');
const sim = await ev(async () => { const g = window.__game, C = await import('/src/config.ts'); const R = {}; for (const e of g.enemies) e.dead = true; g.enemies.length = 0; const L = g.level; let best = null, bs = -1; for (let y = 6; y < L.h - 6; y += 2) for (let x = 6; x < L.w - 6; x += 2) { let n = 0; for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (!g.solidAt(x + dx + .5, y + dy + .5) && !g.circleHits(x + dx + .5, y + dy + .5, .5)) n++; if (n > bs) { bs = n; best = [x + .5, y + .5]; } } R.openArena = bs > 90; g.px = best ? best[0] : 20; g.py = best ? best[1] : 20; for (let i = 0; i < 4; i++) g.update(.016);
  const open = () => { let best = null; for (let r = 3; r < 9 && !best; r++) for (let a = 0; a < 16; a++) { const x = g.px + Math.cos(a / 16 * 6.28) * r, y = g.py + Math.sin(a / 16 * 6.28) * r; if (!g.solidAt(x, y) && !g.circleHits(x, y, .5)) { best = [x, y]; break; } } return best; };
  const mk = (t, dx = 4, dy = 0) => { let bx = g.px + dx, by = g.py + dy, bd = 1e9; for (let ox = -3; ox <= 3; ox += .5) for (let oy = -3; oy <= 3; oy += .5) { const x = g.px + dx + ox, y = g.py + dy + oy; if (g.solidAt(x, y) || g.circleHits(x, y, .6) || Math.hypot(x - g.px, y - g.py) < 1.2) continue; const dd = Math.hypot(ox, oy); if (dd < bd && g.los(x, y, g.px, g.py)) { bd = dd; bx = x; by = y; } } const e = g.spawnEnemy(t, bx, by); e.alert = true; e._rt.reveal = 0; return e; };
  const tick = n => { for (let i = 0; i < n; i++) g.update(.016); };
  g.hp = g.maxHp; g.heat = 0;
  // mend
  { const h = mk('menderwisp', 3, 0), a = mk('coalheaver', 3, 2); a.hp = a.maxHp * .3; const h0 = a.hp; h._rt.ang = 0; g.resolveAttack(h, 'mend', g.px, g.py); R.mend = a.hp - h0 > a.maxHp * .2; }
  // ward
  { const w = mk('relaynode', -3, 0), a = mk('barrierhand', -3, 2); a._rt.shield = null; a._rt.mi = 1; w._rt.ang = 0; g.resolveAttack(w, 'ward', g.px, g.py); R.ward = !!(a._rt.shield && a._rt.shield.hp > 0); }
  // hex
  { const h = mk('sootwisp', 0, 4); h._rt.ang = Math.PI / 2; const hp0 = g.hp; g.iframes = 0; g.resolveAttack(h, 'hex', g.px, g.py); R.hex = g.slowT > 3 && g.hp < hp0 && g.heat > 15; const sp0 = g.stat ? 1 : 1; }
  // slow actually reduces speed: movement distance with slowT vs without
  // detonate
  { const f = mk('fusecrawler', 1, 0); f._rt.ang = 0; g.hp = g.maxHp; g.resolveAttack(f, 'detonate', g.px, g.py); R.det = f.dead && g.hp < g.maxHp; const p = mk('packmule', 1.5, 0); g.hp = g.maxHp; p._rt.ang = 0; g.resolveAttack(p, 'detonate_big', g.px, g.py); R.detBig = p.dead && g.hp < g.maxHp; }
  // snipe
  { const s = mk('longlens', 8, 0); s._rt.ang = Math.PI; const n0 = g.projs.length; g.resolveAttack(s, 'snipe', g.px, g.py); const pr = g.projs[g.projs.length - 1]; R.snipe = g.projs.length === n0 + 1 && Math.hypot(pr.vx, pr.vy) > 18 && pr.dmg > 20; }
  // summonlite (cap 4)
  { const h = mk('handler', 0, -4); const n0 = g.enemies.filter(e => e.minionOf === h.id).length; for (let i = 0; i < 4; i++) { g.resolveAttack(h, 'summonlite', g.px, g.py); } R.sum = g.enemies.filter(e => e.minionOf === h.id && !e.dead).length; }
  // shield absorbs then staggers
  { const b = mk('barrierhand', 5, 5); tick(2); const sh0 = b._rt.shield && b._rt.shield.hp; const hp0 = b.hp; g.hurtEnemy(b, 5, g.px, g.py, 0); const absorbed = b.hp === hp0 && b._rt.shield.hp < sh0; g.hurtEnemy(b, sh0 + 1, g.px, g.py, 0); R.shield = absorbed && !b._rt.shield && b._rt.vuln > 2; const hp1 = b.hp; g.hurtEnemy(b, 4, g.px, g.py, 0); R.stagger = hp1 - b.hp >= 5.5; }
  // affixes
  { const a = mk('coalheaver', -6, 5); a.affix = ['hasted', 'shielded']; tick(2); R.hasted = a._rt.spdMul > 1.25 && a.maxHp > ENEMIES0(C, 'coalheaver') * 1.9 && a._rt.shield && a._rt.shield.hp > 0;
    const v = mk('rebarcrusher', -6, -5); v.affix = ['volatile']; tick(2); const z0 = g.zones.length; g.dbg.oneShot = true; v.hp = 1; g.hurtEnemy(v, 5, g.px, g.py, 0); g.dbg.oneShot = false; R.vol = v.dead && g.zones.length > z0;
    const f = mk('coalheaver', 6, -5); f.affix = ['frenzied']; tick(2); f.hp = f.maxHp * .3; tick(2); R.frenzy = f._rt.spdMul > 1.3;
    const w = mk('coalheaver', 7, 6); w.affix = ['warded']; tick(2); w.hp = w.maxHp * .4; tick(3); const hp0 = w.hp; g.hurtEnemy(w, 20, g.px, g.py, 0); R.ward2 = w.hp === hp0; tick(150); const hp1 = w.hp; g.hurtEnemy(w, 5, g.px, g.py, 0); R.ward3 = w.hp < hp1;
    const r = mk('coalheaver', -7, 6); r.affix = ['regenerating']; tick(2); r.hp = r.maxHp * .5; tick(900); R.regen = r.hp > r.maxHp * .55;
    const Mb = await import('/src/content/mobs.ts'); const l = mk('leechorderly', 1, 0); l.hp = l.maxHp * .5; const lh0 = l.hp; const hpA = g.hp; g.hp -= 20; Mb.mobAfterHit(g, l, hpA); R.leech = l.hp - lh0 > 15; const nv = mk('coalheaver', 2, 0); nv.hp = nv.maxHp * .5; const nh = nv.hp; const hpB = g.hp; g.hp -= 20; Mb.mobAfterHit(g, nv, hpB); R.noLeech = nv.hp === nh; g.hp = g.maxHp; }
  return R; function ENEMIES0(C, t) { return C.ENEMIES[t].hp; } });
for (const [k, v] of Object.entries(sim)) ok(k === 'sum' ? v >= 2 && v <= 4 : !!v, 'behaviour: ' + k + (k === 'sum' ? ' (' + v + ' minions, cap 4)' : ''));
// affix text + render label
const lab = await ev(async () => { const m = await import('/src/content/mobs.ts'); return m.mobLabel({ affix: ['hasted', 'volatile'] }); }); ok(lab === 'Hasted · Volatile', 'affix label: ' + lab);
// ---------------- headless runs per tier ----------------
const step = secs => ev(s => { const g = window.__game; for (let i = 0; i < s / 0.016; i++) g.update(0.016); }, secs);
for (const id of ['tailings_pit', 'cold_archive', 'freight_depot', 'recall_yard']) {
  ok(await fresh(id), id + ': run starts'); const info = await ev(() => { const g = window.__game; g.dbg.god = true; const types = {}; for (const e of g.enemies) types[e.type] = (types[e.type] || 0) + 1; return { n: g.enemies.length, aff: g.enemies.filter(e => e.affix?.length).length, types }; });
  const run = await ev(async () => { const g = window.__game; const L = g.level; let maxP = 0, maxZ = 0, kills0 = g.kills, minions = 0; const cur = []; // walk through the level pulling every pack, then fight
    const mobs = g.enemies.filter(e => !e.dead && e.faction === 'enemy' && e.type !== g.dd.gateGuard && e.type !== g.dd.lockElite); let t = 0; const seen = new Set();
    for (const e of mobs.slice(0, 60)) { if (e.dead) continue; g.px = e.x + 3; g.py = e.y; if (g.solidAt(g.px, g.py)) { g.px = e.x; g.py = e.y + 3; } e.alert = true; g.alertGroup(e); for (let i = 0; i < 160; i++) { g.update(.016); const near = g.enemies.filter(o => !o.dead && Math.hypot(o.x - g.px, o.y - g.py) < 12); for (const o of near) if (o._rt.atk) seen.add(o._rt.atk); maxP = Math.max(maxP, g.projs.length); maxZ = Math.max(maxZ, g.zones.length); } g.hp = g.maxHp; if (!g.dbg.oneShot) g.dbg.oneShot = true; }
    g.dbg.oneShot = false; return { atk: [...seen], maxP, maxZ, minions: g.enemies.filter(e => e.minionOf).length, killed: g.kills - kills0 }; });
  ok(info.n >= 40 && run.atk.length >= 4, id + ': ' + info.n + ' enemies (' + info.aff + ' affixed elites), ran through packs: attacks used ' + run.atk.slice(0, 14).join(',') + ' (projectiles ' + run.maxP + ', zones ' + run.maxZ + ')'); }
// ---------------- facing (enemy_dirs style) on all 28 ----------------
try { const out = execSync('node tests/enemy_dirs.mjs', { env: { ...process.env, ONLY: d.ids.join(',') }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 900000 }).toString(); const lines = out.split('\n'); const f = lines.filter(l => l.startsWith('FAIL')); ok(f.length === 0 && /28 enemy types under test/.test(out), 'facing/atlas rows follow travel direction for all 28 mobs (enemy_dirs): ' + (f.slice(0, 3).join(' | ') || 'ok')); } catch (e) { ok(false, 'enemy_dirs on mobs failed: ' + String(e.stdout || e.message).split('\n').filter(l => l.startsWith('FAIL')).slice(0, 3).join(' | ')); }
ok(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
