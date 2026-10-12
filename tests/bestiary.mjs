// Bestiary batch 1 (docs/BESTIARY.md): 14 non-robot mobs. Data, bodies, rosters, tiers, atlas files (full + half-res, 8 rows, frame counts), memory budget of the added atlases,
// facing (enemy_dirs on the new ids), live spawn + snapshot sheet (shots/bestiary/).
import fs from 'fs'; import { execSync } from 'child_process';
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }); const ev = (f, a) => page.evaluate(f, a); fs.mkdirSync('shots/bestiary', { recursive: true });
const d = await ev(async () => { const Z = await import('/src/content/bestiary_mobs.ts'), B = await import('/src/content/batch2_mobs.ts'), C = await import('/src/config.ts'), S = await import('/src/sim.ts'), R = await import('/src/content/batch2_rosters.ts'), Lv = await import('/src/content/batch1_levels.ts');
  const bad = []; for (const m of Z.BESTIARY_MOBS) { const e = C.ENEMIES[m.id]; if (!e || !e.mob) { bad.push('no def ' + m.id); continue; } for (const a of e.attacks) if (!S.ATK[a]) bad.push(m.id + ' missing ATK ' + a); if (!Z.BODY[m.id]) bad.push(m.id + ' no body'); if (m.summon && !C.ENEMIES[m.summon]) bad.push(m.id + ' bad summon'); }
  const used = new Set(); const tierBad = []; for (const l of Lv.LEVELS) for (const t of new Set(Object.values(l.roster).flat().map(x => x[0]))) { used.add(t); const m = Z.BESTIARY_MOBS.find(x => x.id === t); if (m && m.tier > l.tier) tierBad.push(l.id + ':' + t); }
  const bodies = Object.values(Z.BODY); return { n: Z.BESTIARY_MOBS.length, ids: Z.BESTIARY_MOBS.map(m => m.id), names: new Set(Z.BESTIARY_MOBS.map(m => m.name)).size, bad, unused: Z.BESTIARY_MOBS.filter(m => !used.has(m.id)).map(m => m.id), tierBad, roles: [...new Set(Z.BESTIARY_MOBS.map(m => m.role))].length, organic: bodies.filter(b => b !== 'machine').length, tiers: [1, 2, 3].map(t => Z.BESTIARY_MOBS.filter(m => m.tier === t).length), inMobs: Z.BESTIARY_MOBS.every(m => B.MOB_BY_ID[m.id]?.id === m.id) }; });
ok(d.n === 14 && d.names === 14, `14 bestiary mobs, unique names (${d.n}/${d.names})`);
ok(d.bad.length === 0, 'every mob: def, attacks defined, body, summon valid ' + (d.bad.join('; ') || 'ok'));
ok(d.inMobs, 'merged into MOBS / MOB_BY_ID');
ok(d.unused.length === 0 && d.tierBad.length === 0, `every mob is fielded by at least one dungeon and never above its tier (unused: ${d.unused}; bad: ${d.tierBad})`);
ok(d.organic >= 10 && d.roles >= 7, `>= 10 non-robot bodies, ${d.roles} roles (${d.organic} non-machine)`);
// ---- atlas files
const idx = JSON.parse(fs.readFileSync('public/dungeons/enemies3d/index.json', 'utf8')); let kb = 0, kbh = 0; const bad = [];
for (const id of d.ids) { if (!idx.includes(id)) { bad.push('not in index ' + id); continue; } const m = JSON.parse(fs.readFileSync(`public/dungeons/enemies3d/${id}.json`, 'utf8'));
  for (const an of ['idle', 'walk', 'attack', 'hit', 'death']) { const A = m.anims[an]; if (!A) { bad.push(`${id}/${an} missing`); continue; } const f = 'public/dungeons/enemies3d/' + A.image, h = f.replace('.webp', '_h.webp'); if (!fs.existsSync(f) || !fs.existsSync(h)) { bad.push(`${id}/${an} file`); continue; } kb += fs.statSync(f).size / 1024; kbh += fs.statSync(h).size / 1024; if (!(A.frames >= 2)) bad.push(`${id}/${an} frames`); }
  if (!(m.hpx > 20)) bad.push(id + ' hpx'); }
ok(bad.length === 0, 'atlases: 5 anims each, full + half-res, frames, size ' + (bad.slice(0, 4).join('; ') || 'ok'));
ok(kb < 14 * 1400 && kbh < kb * .6, `atlas budget: full ${(kb / 1024).toFixed(1)} MB (< ${(14 * 1.4).toFixed(0)}), half-res ${(kbh / 1024).toFixed(1)} MB (< 60% of full); lazy loaded (see atlas_half / memory tests)`);
// ---- facing on the new ids
try { const out = execSync('node tests/enemy_dirs.mjs', { env: { ...process.env, ONLY: d.ids.join(',') }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 900000 }).toString(); const f = out.split('\n').filter(l => l.startsWith('FAIL')); ok(f.length === 0, 'enemy_dirs on the 14 new ids ' + (f[0] || 'ok')); } catch (e) { ok(false, 'enemy_dirs failed: ' + String(e.stdout || e).slice(0, 300)); }
// ---- live: spawn each, they move and attack without errors; snapshot sheet
await sleep(500); await ev(() => { const g = window.__game; g.save.level = 34; g.dbg.god = true; g.enterTown(); g.save.instance = null; g.inst = null; g.save.lockouts = {}; g.startRun('annex'); g.inst.flags.bossSpawned = true; g.enemies.splice(0); }); await sleep(800);
const live = await ev(async (ids) => { const g = window.__game, out = []; g.enemies.splice(0); ids.forEach((id, i) => { const a = i / ids.length * 6.283; const e = g.spawnEnemy(id, g.px + Math.cos(a) * 4.2, g.py + Math.sin(a) * 2.8 + 2); e._rt.reveal = 0; e.alert = true; out.push(id); }); return out.length; }, d.ids);
await sleep(2500); await page.screenshot({ path: 'shots/bestiary/arena.png' });
const st = await ev(() => { const g = window.__game; return { n: g.enemies.filter(e => !e.dead).length, art: window.__rend.eart ? 1 : 0, hp: g.hp }; });
ok(live === 14 && st.n >= 12, `14 bestiary mobs spawn and live in a run (${st.n} alive)`);
ok(errors.length === 0, 'no page errors ' + errors.join('|')); await browser.close(); process.exit(fails ? 1 : 0);
