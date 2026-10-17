// Field grafts (docs/GRAFT.md): elite kills drop a part, Graft installs a decaying temporary power, run-scoped humanity cost,
// pooled/capped floor parts, boss bonus halved, idle players still die to mobs while grafted. Shots -> shots/graft/.
import fs from 'fs'; import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const SHOTS = process.env.SHOTS === '1'; if (SHOTS) fs.mkdirSync('shots/graft', { recursive: true });
const touch = process.env.TOUCH === '1';
const { browser, page, errors } = await launch(SHOTS ? (touch ? { viewport: { width: 844, height: 390 }, touch: true, dpr: 2, query: '?touch=1' } : { viewport: { width: 1280, height: 720 } }) : { query: '?splash=hold' });
if (SHOTS) await sleep(4000);
const ev = (f, a) => page.evaluate(f, a);
await ev(() => { const g = window.__game; g.enterTown(true); g.startRun('annex'); g.revealing = false; g.dbg.god = false; g.dbg.oneShot = false; });
const R = await ev(async () => {
  const G = await import('/src/graft.ts'); const A = await import('/src/altsim.ts'); const C = await import('/src/config.ts'); const g = window.__game; const r = {};
  const step = n => { for (let i = 0; i < n; i++) g.update(1 / 30); };
  const clear = () => { for (const e of g.enemies) e.dead = true; };
  const elite = Object.keys(C.ENEMIES).find(k => C.ENEMIES[k].elite && !C.ENEMIES[k].boss && !C.ENEMIES[k].static && C.ENEMIES[k].mfr === 'HI');
  clear(); g.hp = g.maxHp; const h0 = A.humanity(g);
  const e = g.spawnEnemy(elite, g.px + 1, g.py); e._rt.reveal = 0; g.killEnemy(e);
  r.partOn = g._graft.parts.filter(p => p.on).length; g.updatePrompt(); r.prompt = g.prompt?.id; r.tip = A.promptTip(g, g.prompt);
  g.interact(); r.active = g._graft.active?.def; r.hum = h0 - A.humanity(g);
  // damage: worker vs boss bonus
  const w = g.spawnEnemy('worker', g.px + 1, g.py); w._rt.reveal = 0; w.hp = w.maxHp = 1e6; g.curTag = 'ability'; g.hurtEnemy(w, 10, g.px, g.py, 0); r.dmgMob = 1e6 - w.hp;
  g._graft.active = null; w.hp = 1e6; g.hurtEnemy(w, 10, g.px, g.py, 0); r.dmgBase = 1e6 - w.hp; g.curTag = 'auto';
  r.bossMul = G.GRAFT.bossMul;
  // decay + expiry
  G.graftTake(g, Object.assign(g._graft.parts[0], { on: true, x: g.px, y: g.py, t: 0, type: elite })); r.s0 = G.graftStr(g); g._graft.active.t = G.GRAFT.dur * .5; r.sHalf = G.graftStr(g); g._graft.active.t = G.GRAFT.dur - .01; step(2); r.spent = g._graft.active === null;
  r.humCapped = A.humanity(g) >= h0 - G.GRAFT.humCap;
  // pooled cap + part expiry
  clear(); for (let i = 0; i < 8; i++) { const x = g.spawnEnemy(elite, g.px + 3, g.py); x._rt.reveal = 0; g.killEnemy(x); } r.poolLen = g._graft.parts.length; r.onCap = g._graft.parts.filter(p => p.on).length;
  step(Math.ceil(G.GRAFT.life * 30) + 5); r.expired = g._graft.parts.every(p => !p.on);
  // idle player still dies to mobs with the defensive graft on
  clear(); g.hp = g.maxHp; g.iframes = 0; G.graftTake(g, Object.assign(g._graft.parts[0], { on: true, x: g.px, y: g.py, t: 0, type: 'foreman' })); r.mmKind = g._graft.active?.def.kind;
  for (let i = 0; i < 4; i++) { const m = g.spawnEnemy('worker', g.px + 1.2 + i * .3, g.py + (i % 2 ? .6 : -.6)); m._rt.reveal = 0; m.alert = true; }
  let t = 0; while (t < 90 && !g.downed) { g.inputMove = { x: 0, y: 0 }; g.atkCd = 99; step(30); t++; } r.idleDown = g.downed; r.idleT = t;
  // run reset
  g.enterTown(); r.resetHum = G.graftHum(g); return r; });
ok(R.partOn === 1, 'elite kill drops one salvageable part');
ok(R.prompt === 'graft' && /humanity/.test(R.tip || ''), `prompt "Graft" with tooltip: ${R.tip}`);
ok(R.active && R.active.kind === 'HI', `grafted ${R.active?.name} (${R.active?.kind})`);
ok(R.hum === 2, `costs ${R.hum} humanity this run`);
ok(R.dmgMob > R.dmgBase * 1.3 && R.dmgMob < R.dmgBase * 1.5, `HI graft hit ${R.dmgMob.toFixed(1)} vs ${R.dmgBase.toFixed(1)} base`);
ok(R.bossMul <= .5, `boss bonus scaled by ${R.bossMul}`);
ok(R.s0 === 1 && R.sHalf < .7 && R.sHalf > .5 && R.spent, `degrades: ${R.s0} -> ${R.sHalf.toFixed(2)} -> spent`);
ok(R.humCapped, 'humanity cost is capped per run');
ok(R.poolLen === 3 && R.onCap <= 3 && R.expired, `pool ${R.poolLen}, on floor ${R.onCap}, all expired after ${'life'}`);
ok(R.mmKind === 'MM' && R.idleDown, `idle player with Mass-Market plating still downed by mobs in ${R.idleT}s`);
ok(R.resetHum === 0, 'graft humanity resets on town return');
if (SHOTS) {
  const sfx = touch ? '_mobile' : '';
  await ev(() => { const g = window.__game; g.startRun('annex'); g._graft.active = null; g.revealing = false; g.dbg.god = true; for (const e of g.enemies) e.dead = true; g.inst.drops.length = 0;
    const W = (x, y) => { const L = g.level; const i = Math.floor(y) * L.w + Math.floor(x); return !L.solid[i]; };
    const cand = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].filter(([dx, dy]) => W(g.px + dx * 1.3, g.py + dy * 1.3) && W(g.px + dx * 2.6, g.py + dy * 2.6));
    ['sawhand', 'foreman', 'sawhand'].forEach((k, i) => { const [dx, dy] = cand[i % cand.length] || [1, 0]; const e = g.spawnEnemy(k, g.px + dx * (i ? 2.4 : 1.1), g.py + dy * (i ? 2.4 : 1.1)); e._rt.reveal = 0; g.killEnemy(e); });
    g.inst.drops.length = 0; g.dbg.noDrops = true; });
  await sleep(4500); await ev(() => { const g = window.__game; g.inst.drops.length = 0; g._graft.parts.forEach(p => p.t = .6); g.updatePrompt(); });
  await sleep(250); await page.screenshot({ path: `shots/graft/floor_parts${sfx}.png` });
  await ev(() => { const g = window.__game; g.interact(); g._graft.parts.forEach(p => p.t = .6); }); await sleep(350); await page.screenshot({ path: `shots/graft/grafted${sfx}.png` });
}
ok(!errors.length, 'no page errors ' + errors.slice(0, 2).join(' | '));
await browser.close(); process.exit(fails ? 1 : 0);
