// Rarity FX (docs/RARITY_FX.md): every orange cosmetic has animated layers + a signature; orange is visibly above purple (pixels + particles);
// Reduced FX freezes it; perf within budget with many characters; tile styling; reveal/showcase in the dressing room; equip sounds.
// Media: shots/rarity_fx/*.png + *.gif/*.webm
import { launch, sleep } from './lib.mjs'; import fs from 'fs'; import { execFileSync } from 'child_process';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const D = 'shots/rarity_fx'; fs.mkdirSync(D + '/frames', { recursive: true });
const { browser, page, errors } = await launch({ query: '?splash=hold' });
const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove());
// 1) layers: per-item pixel/animation checks on an offscreen canvas (rarity layer + base style)
const R = await ev(async () => {
  const A = await import('/src/content/appearance.ts'), C = await import('/src/cosmetics.ts'), F = await import('/src/cosfx.ts'); F.setReducedFx(false); F.resetFx();
  const cv = document.createElement('canvas'); cv.width = 200; cv.height = 240; const c = cv.getContext('2d');
  const shot = (list, t, id, moving = false) => { c.clearRect(0, 0, 200, 240); const k = { c, x: 100, y: 210, u: 3.4, t, moving, face: 1, id }; C.drawCosmetics(k, list, 'back'); C.drawCosmetics(k, list, 'front'); return c.getImageData(0, 0, 200, 240).data; };
  const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 40) n++; return n; };
  const energy = d => { let e = 0, warm = 0, vio = 0; for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; e += (d[i] + d[i + 1] + d[i + 2]) * a; const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx > 170 && mx - mn > 90 && a > .5) warm++; if (d[i + 2] > 150 && d[i] > 120 && d[i + 1] < 160 && a > .3) vio++; } return { e, warm, vio }; };
  const run = (list, id, secs, moving) => { let d; for (let f = 0; f <= secs * 30; f++) d = shot(list, 10 + f / 30, id, moving); return d; };
  // guard: a long-running vite dev server with HMR history can hand this test a different cosfx.ts instance than cosmetics.ts uses (?t= imports),
  // so flourish()/liveParticles() would talk to a copy that never draws. Detect it and say so instead of reporting 14 bogus FX failures.
  { F.resetFx(); const f0 = F.stats.frames; const k = { c, x: 100, y: 210, u: 3.4, t: 1, moving: false, face: 1, id: 'dup' }; C.drawCosmetics(k, [A.COS_BY_ID.hair_flame], 'back'); if (F.stats.frames === f0) return { dup: true }; F.resetFx(); }
  const orange = A.COSMETICS.filter(d => d.rarity === 'orange' && !d.line && !d.id.startsWith('ex_') && !d.id.startsWith('col_') && !['bundled','pass','starter'].includes(d.src?.k)) /* premium line FX are owned by pmfx.ts, tested in monet.mjs */, purple = A.COSMETICS.filter(d => d.rarity === 'purple' && !d.line && !['shop','chroma','pass','collection','starter','exclusive','bundled'].includes(d.src?.k));
  const per = orange.map(d => { F.resetFx(); const a = shot([d], 5, 'o'), b = shot([d], 5.9, 'o'); run([d], 'o', 3); const idleParts = F.liveParticles('o');
    F.resetFx(); shot([d], 20, 'f'); const idle = shot([d], 20.26, 'f'); F.resetFx(); shot([d], 20, 'f'); F.flourish('f'); shot([d], 20, 'f'); const snap = shot([d], 20.26, 'f'); const after = shot([d], 21.6, 'f'); F.resetFx(); shot([d], 20, 'g'); const idle2 = shot([d], 21.6, 'g');
    return { id: d.id, sig: !!F.SIGNATURE[d.id], anim: diff(a, b), idleParts, flo: diff(idle, snap), settle: diff(after, idle2) }; });
  const curve = [0.06, 0.2, 0.26, 0.6, 1.2].map(e => F.flourishCurve(e));
  F.resetFx(); const full = run(orange, 'ring', 1); let feet = 0; for (let yy = 214; yy < 230; yy++) for (let xx = 40; xx < 160; xx++) if (full[(yy * 200 + xx) * 4 + 3] > 40) feet++;
  // fx layer alone (no base style) must animate too
  const fxOnly = orange.map(d => { const g = (t) => { c.clearRect(0, 0, 200, 240); const k = { c, x: 100, y: 210, u: 3.4, t, moving: false, face: 1, id: 'z' }; F.drawRarityFx(k, [d], 'back'); F.drawRarityFx(k, [d], 'front'); return c.getImageData(0, 0, 200, 240).data; }; return { id: d.id, d: diff(g(3), g(4.5)) }; });
  const purpAcc = purple.map(d => ({ id: d.id, acc: !!F.ACCESSORY[d.slot] }));
  // orange vs purple, same slot pairs and full sets
  F.resetFx(); const oe = energy(run(orange, 'O', 2)), op = F.liveParticles('O'); F.resetFx(); const pList = ['hair_frostlock', 'eyes_void', 'torso_core', 'back_disc', 'skin_circuit', 'aura_foundry'].map(i => A.COS_BY_ID[i]); const pe = energy(run(pList, 'P', 2)), pp = F.liveParticles('P');
  F.resetFx(); const pair = energy(run([A.COS_BY_ID.hair_flame], 'h1', 1)), pair2 = (F.resetFx(), energy(run([A.COS_BY_ID.hair_frostlock], 'h2', 1)));
  // moving trail: more particles while moving
  F.resetFx(); run([A.COS_BY_ID.torso_nova], 'm0', 1, false); const still = F.liveParticles(); F.resetFx(); run([A.COS_BY_ID.torso_nova], 'm1', 1, true); const mov = F.liveParticles();
  // reduced FX: frozen, no particles
  F.setReducedFx(true); F.resetFx(); const r1 = shot(orange, 3, 'r'), r2 = shot(orange, 4.3, 'r'); const fr = (() => { const g = (t) => { c.clearRect(0, 0, 200, 240); const k = { c, x: 100, y: 210, u: 3.4, t, moving: true, face: 1, id: 'rr' }; F.drawRarityFx(k, orange, 'back'); F.drawRarityFx(k, orange, 'front'); return c.getImageData(0, 0, 200, 240).data; }; let a; for (let i = 0; i < 60; i++) a = g(1 + i / 30); return { d: diff(a, g(9)), parts: F.liveParticles(), still: energy(a).e > 0 }; })(); F.setReducedFx(null);
  // perf: 12 characters (8 remote + me + more) all in orange for 300 frames, plus low-quality budget
  F.resetFx(); const worn = [...new Map(orange.map(d => [d.slot, d])).values()]; /* one orange per slot = the real worst case */ const big = document.createElement('canvas'); big.width = 1280; big.height = 720; const bc = big.getContext('2d'); const t0 = performance.now();
  for (let f = 0; f < 300; f++) { bc.clearRect(0, 0, 1280, 720); for (let i = 0; i < 12; i++) { const k = { c: bc, x: 100 + i * 90, y: 400, u: 1.4, t: f / 60, moving: i % 2 === 0, face: 1, id: 'net:' + i }; F.drawRarityFx(k, worn, 'back'); F.drawRarityFx(k, worn, 'front'); } }
  const ms = (performance.now() - t0) / 300, peak = F.liveParticles(), dropped = F.stats.dropped;
  const Q = (await import('/src/quality.ts')).Q; Q.setPref('low'); const lowB = F.budget(); Q.setPref('auto');
  return { curve, feet, per, fxOnly, purpAcc, oe, pe, op, pp, pair, pair2, still, mov, reduced: { d: diff(r1, r2), fx: fr }, ms, peak, dropped, max: F.POOL_MAX, lowB, nOrange: orange.length, nPurple: purple.length };
});
if (R.dup) { console.log('FAIL stale dev server: cosmetics.ts and this test see two different cosfx.ts module instances (HMR history). Restart vite / use a fresh URL and rerun.'); await browser.close(); process.exit(1); }
for (const p of R.per) ok(p.sig && p.anim > 10 && p.idleParts === 0, `orange ${p.id}: themed signature, gentle idle motion (${p.anim} px over 0.9 s), no idle particle spam (${p.idleParts})`);
for (const p of R.per) ok(p.flo > 30 && p.settle < 40, `orange ${p.id}: flourish on trigger (${p.flo} px at the snap) and settles back to idle (${p.settle} px)`);
ok(R.curve[0].k < .3 && R.curve[0].s < 0 && R.curve[2].k > .9 && R.curve[4].k === 0, 'flourish timing: anticipation (pull back) -> snap -> settle ' + JSON.stringify(R.curve.map(c => [c.k.toFixed(2), c.s.toFixed(2)])));
ok(R.feet < 400, `only a subtle painted ground mark under the feet, no generic floor ring / pillar (${R.feet} px of 1920 in the foot band, limit 400)`); // Sean asked for a subtle rarity ground mark (two brush strokes); a full ring/pillar would fill most of the band
for (const p of R.fxOnly) ok(p.d > 10, `orange ${p.id}: rarity FX layer alone animates gently (${p.d} px over 1.5 s)`);
ok(R.purpAcc.every(x => x.acc), `every purple skin (${R.nPurple}) has an accessory silhouette`);
ok(R.oe.warm > 1.5 * R.pe.warm && R.oe.e > 1.3 * R.pe.e, `orange set clearly above purple: energy ${(R.oe.e / 1e6).toFixed(1)}M vs ${(R.pe.e / 1e6).toFixed(1)}M, vivid px ${R.oe.warm} vs ${R.pe.warm}`);
ok(R.pair.warm > 1.3 * R.pair2.warm, `same slot: Foundry-Fire Mane (orange) reads above Archive Frostlock (purple): vivid px ${R.pair.warm} vs ${R.pair2.warm}`);
ok(R.pe.vio > 20, `purple reads as purple (${R.pe.vio} violet px)`);
ok(R.mov >= 3 && R.mov > R.still, `painterly smear trail only while moving: ${R.mov} strokes moving vs ${R.still} idle`);
ok(R.reduced.fx.d === 0 && R.reduced.fx.parts === 0 && R.reduced.fx.still, `Reduced FX: rarity layer frozen (0 px change), no particles, static glow kept`);
ok(R.ms < 4 && R.peak <= R.max, `perf: 12 orange characters ${R.ms.toFixed(2)} ms/frame (budget 4), pool peak ${R.peak}/${R.max} (${R.dropped} spawns dropped at cap)`);
ok(R.lowB <= .3, `low quality scales particles to ${R.lowB}`);
// 2) world: orange set vs purple set on the character in town (+ GIF)
const world = async (ids, tag) => { await ev(async (ids) => { const A = await import('/src/content/appearance.ts'); const g = window.__game, s = g.save; s.cosmetics = A.newCos(); for (const id of ids) { A.grantCos(s, id); A.equipCos(s, id); } g.enterTown(true); window.__ui.close?.(); }, ids); await sleep(1500);
  await page.screenshot({ path: `${D}/world_${tag}.png` }); };
const OR = ['hair_flame', 'head_cowl', 'eyes_sun', 'torso_nova', 'back_wings', 'skin_holo', 'aura_nova'], PU = ['hair_frostlock', 'eyes_void', 'torso_core', 'back_disc', 'skin_circuit', 'aura_foundry'];
await world(PU, 'purple'); await world(OR, 'orange');
const clip = async (sel, name, n = 36, step = 70, box) => { fs.rmSync(D + '/frames', { recursive: true, force: true }); fs.mkdirSync(D + '/frames'); const b = box || await page.locator(sel).boundingBox(); for (let i = 0; i < n; i++) { await page.screenshot({ path: `${D}/frames/f${String(i).padStart(3, '0')}.png`, clip: b }); await sleep(step); }
  try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(Math.round(1000 / step)), '-i', `${D}/frames/f%03d.png`, '-vf', 'scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse', `${D}/${name}.gif`]); execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(Math.round(1000 / step)), '-i', `${D}/frames/f%03d.png`, '-c:v', 'libvpx-vp9', '-b:v', '600k', `${D}/${name}.webm`]); return true; } catch (e) { console.log('clip encode failed', String(e).slice(0, 120)); return false; } };
const vp = page.viewportSize(); const mid = { x: vp.width / 2 - 180, y: vp.height / 2 - 220, width: 360, height: 360 };
await clip(null, 'world_orange_idle', 40, 80, mid);
await ev(() => { const g = window.__game; g.moving = true; }); 
// 3) dressing room: reveal (orange vs purple), showcase loop, tile styling, equip sound
await ev(async () => { const A = await import('/src/content/appearance.ts'); const s = window.__game.save; s.cosmetics = A.newCos(); for (const id of [...['hair_flame', 'eyes_sun', 'torso_nova', 'back_wings', 'skin_holo', 'aura_nova'], 'hair_frostlock', 'torso_core', 'back_disc']) A.grantCos(s, id); window.__ui.open('wardrobe'); });
await sleep(400);
const clk = sel => ev(s => document.querySelector('#modal ' + s)?.click(), sel);
await clk('[data-act=wd-sel][data-id=torso_core]'); await sleep(250); await page.screenshot({ path: `${D}/reveal_purple.png` }); const rvP = await ev(() => window.__drReveal);
await clk('[data-act=wd-revert]'); await clk('[data-act=wd-sel][data-id=torso_nova]'); await sleep(250); await page.screenshot({ path: `${D}/reveal_orange.png` }); const rvO = await ev(() => window.__drReveal);
ok(rvP.tier === 'purple' && rvO.tier === 'orange', `dressing room: rarity reveal plays (${rvP.tier} / ${rvO.tier})`);
await clk('[data-act=wd-revert]'); await clk('[data-act=wd-tab][data-tab=all]'); for (const id of ['hair_flame', 'eyes_sun', 'back_wings', 'skin_holo', 'aura_nova', 'torso_nova']) await clk(`[data-act=wd-sel][data-id=${id}]`);
await clk('[data-act=wd-showcase]'); await sleep(300);
await clip('#wdprev', 'showcase_orange', 50, 90);
await page.screenshot({ path: `${D}/dressing_orange_showcase.png` });
const tiles = await ev(() => { const o = document.querySelector('#modal .tile.r-orange'), p = document.querySelector('#modal .tile.r-purple'); return { oa: o && getComputedStyle(o).animationName, pa: p && getComputedStyle(p, '::after').animationName, osh: o && getComputedStyle(o).boxShadow }; });
ok(/rfspin/.test(tiles.oa) && /rfsweep/.test(tiles.pa), `tiles: orange has the spinning border (${tiles.oa}), purple the sheen (${tiles.pa})`);
await ev(() => document.querySelector('#modal [data-act=wd-apply]')?.click()); await sleep(150);
const snd = await ev(async () => ({ log: window.__cosfx.fxSoundLog.slice(), files: await Promise.all(['cos_equip_orange', 'cos_equip_purple', 'cos_flourish_orange'].map(n => fetch('audio/sfx/' + n + '.mp3').then(r => r.ok))) }));
ok(snd.log.includes('cos_equip_orange') && snd.files.every(Boolean), `equip/flourish sounds: ${[...new Set(snd.log)].join(',')}; files present`);
await ev(() => { window.__game.save.settings.reducedFx = true; document.body.classList.add('reducefx'); }); await sleep(100);
ok(await ev(() => getComputedStyle(document.querySelector('#modal .tile.r-orange')).animationName === 'none'), 'Reduced FX stops the tile animations');
await ev(() => { window.__game.save.settings.reducedFx = false; document.body.classList.remove('reducefx'); });
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close(); fs.rmSync(D + '/frames', { recursive: true, force: true });
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
