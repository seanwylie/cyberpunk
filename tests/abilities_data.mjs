// Static + light-runtime checks on the augment ability portfolio: definitions, uniqueness, gating, icons, VFX fallbacks, hardware wiring, balance bounds, chips, UI slots, codex.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors, ctx } = await launch(); const ev = (f, a) => page.evaluate(f, a);
const D = await ev(async () => {
  const reg = await import('/src/abilities/registry.ts'); const cfg = await import('/src/config.ts'); const hw = await import('/src/abilities/hw.ts'); const vfx = await import('/src/abilities/vfx.ts');
  const data = reg.ABILITY_DATA; const out = { n: data.length, bad: [], dup: [], noItem: [], itemBad: [], noIcon: [], noFx: [], bound: [], chipless: [], nodesc: [], tags: {}, items: hw.ABILITY_ITEMS.length };
  const ids = new Set(), names = new Set(); const GRP = cfg.SLOT_GROUP;
  const sumK = (ps) => ps.reduce((a, p) => a + (['damage', 'cone', 'line', 'circle', 'chain', 'shoot'].includes(p.p) ? (p.k || 0) : p.p === 'dash' ? (p.k || 0) : 0) + (p.then ? sumK(p.then) : 0) + (p.tick ? sumK(p.tick) * 3 : 0) + (p.p === 'summon' ? 0 : 0), 0);
  const gives = new Set(), uses = new Set(); const builtin = new Set(['Overheated']);
  const rar = { grey: 0, green: 1, blue: 2, purple: 3, orange: 4 };
  for (const a of data) {
    if (ids.has(a.id)) out.dup.push(a.id); ids.add(a.id); if (names.has(a.name)) out.dup.push(a.name); names.add(a.name);
    const d = cfg.ABILITIES[a.id]; if (!d || !d.ext || d.heat !== a.heat || d.cd !== a.cd) out.bad.push(a.id + ': not registered'); if (!d?.desc || d.desc.length < 12) out.nodesc.push(a.id);
    if (!['self', 'direction', 'ground', 'target'].includes(d?.aim)) out.bad.push(a.id + ': aim');
    if (a.shape === 'lockon' && d.aim !== 'target' || a.shape === 'ground' && d.aim !== 'ground' || (a.shape === 'cone' || a.shape === 'line') && d.aim !== 'direction') out.bad.push(a.id + ': shape/aim mismatch');
    if (!a.flavor || !a.slots.length || !a.steps.length && !a.toggle) out.bad.push(a.id + ': incomplete');
    // heat/cooldown/damage bounds
    const k = sumK(a.steps); const dps = k / a.cd; const heatRate = a.heat / a.cd;
    if (a.heat > 46 || a.cd < 2 || a.cd > 60) out.bad.push(`${a.id}: heat ${a.heat}/cd ${a.cd} out of bounds`);
    if (a.role !== 'ultimate' && a.rarity !== 'orange' && k / a.cd > 1.1) out.bad.push(`${a.id}: damage coefficient/s ${(k / a.cd).toFixed(2)} too high`);
    if (a.rarity === 'orange' && (a.role !== 'ultimate' || a.cd < 30)) out.bad.push(a.id + ': orange abilities must be ultimate-style with cd >= 30');
    if (heatRate > 6 && !a.toggle) out.bad.push(`${a.id}: heat per second ${heatRate.toFixed(1)} too high`);
    if (a.toggle && (a.toggle.heat - (a.toggle.vent || 0)) > 8) out.bad.push(a.id + ': toggle drain');
    for (const g of a.gives) gives.add(g); for (const u of a.uses) uses.add(u); for (const b of a.bonus || []) uses.add(b.w);
    // hardware
    const items = hw.ABILITY_ITEMS.filter(i => i.abilities.includes(a.id)); if (!items.length) out.noItem.push(a.id);
    for (const i of items) { if (!a.slots.includes(GRP[i.slot])) out.itemBad.push(`${i.id}: slot ${i.slot} not in ${a.slots}`); if (rar[i.rarity] < rar[a.rarity]) out.itemBad.push(`${i.id}: rarity ${i.rarity} < ${a.rarity}`); if (i.mfr !== a.mfr) out.itemBad.push(`${i.id}: mfr ${i.mfr} != ${a.mfr}`); if (i.abilities.length > 2) out.itemBad.push(i.id + ' >2 abilities'); if (i.rarity === 'orange' && i.lvl < 24 && !i.authoredException) out.itemBad.push(i.id + ' orange lvl'); }
    if (hw.chipsFor(a).length < 5 && a.role !== 'heat' || hw.chipsFor(a).filter(c => !['speed', 'fineedge', 'coolant', 'quench'].includes(c)).length < 1 && a.role !== 'heat') out.chipless.push(a.id);
    // vfx fallback: fxCastBase must emit at least one visible effect
    const g = { px: 5, py: 5, fx: [], save: { settings: { reducedFx: false } } }; vfx.fxCastBase(g, a); for (const s of a.steps) vfx.fxPrim(g, { x: 5, y: 5, ang: 0, tx: 7, ty: 5, ab: a }, s); if (!g.fx.length || g.fx.some(f => !f.c)) out.noFx.push(a.id);
  }
  { const mean = m => { const L = data.filter(a => a.mfr === m && a.role !== 'ultimate' && !a.toggle && a.heat > 0); return L.reduce((x, a) => x + a.heat / a.cd, 0) / L.length; }; out.heatMean = { HI: mean('HI'), PS: mean('PS'), MM: mean('MM') }; }
  out.tagsUsedNoSource = [...uses].filter(u => !gives.has(u) && !builtin.has(u)); out.gives = [...gives]; out.uses = [...uses];
  out.rar = {}; out.role = {}; out.mfr = {}; out.grp = {}; for (const a of data) { out.rar[a.rarity] = (out.rar[a.rarity] || 0) + 1; out.role[a.role] = (out.role[a.role] || 0) + 1; out.mfr[a.mfr] = (out.mfr[a.mfr] || 0) + 1; out.grp[a.slots[0]] = (out.grp[a.slots[0]] || 0) + 1; }
  // items: every ability item registered, unique ids, in ITEM_BY_ID, stats sane
  out.itemMissing = hw.ABILITY_ITEMS.filter(i => !cfg.ITEM_BY_ID[i.id]).map(i => i.id); out.itemDup = hw.ABILITY_ITEMS.length - new Set(hw.ABILITY_ITEMS.map(i => i.id)).size;
  out.itemsPerSlot = {}; for (const i of hw.ABILITY_ITEMS) out.itemsPerSlot[i.slot] = (out.itemsPerSlot[i.slot] || 0) + 1;
  // power rises with rarity: mean damage coefficient + utility count per rarity strictly increases
  const power = a => { const w = (ps) => ps.reduce((t, p) => t + (['damage', 'cone', 'line', 'circle', 'chain', 'shoot'].includes(p.p) ? (p.k || 0) : 0) + (p.p === 'dash' ? (p.k || 0) : 0) + ({ stun: .15 * (p.t || 0), root: .2 * (p.t || 0), slow: .08 * (p.t || 0), mark: .3, expose: .35, burn: (p.k || 0) * (p.t || 0) * .8, tether: .4, control: .9, strip: .3, lose: .3, shield: (p.f || 0) * 3, heal: (p.f || 0) * 3.5, mitigate: (1 - (p.m || 1)) * (p.t || 0) * .5, reflect: .4, cloak: (p.t || 0) * .15, vent: (p.n || 0) * .02, cdr: (p.t || 0) * .1, buff: (p.m > 1 ? (p.m - 1) * (p.t || 0) * 1.2 : (p.m || 0) * (p.t || 0)), invuln: (p.t || 0) * .5, summon: p.life * .22, aura: p.life * .25, trap: .8, delayed: .3, teleport: .5, pull: .3, push: .3, dash: .3, ventHit: .3, projectile: .2 }[p.p] || 0) + (p.then ? w(p.then) : 0) + (p.tick ? w(p.tick) * Math.max(1, (p.life || 0) / (p.every || 1)) * .35 : 0), 0); return w(a.steps) + (a.bonus?.length || 0) * .6 + (a.exec ? 1 : 0) + (a.toggle ? 1.5 : 0); };
  const avg = {}; for (const r of ['grey', 'green', 'blue', 'purple', 'orange']) { const L = data.filter(a => a.rarity === r); avg[r] = L.reduce((t, a) => t + power(a), 0) / L.length; } out.power = avg;
  out.loot = { pools: Object.keys(cfg.LOOT), vendor: cfg.ITEMS.filter(i => i.abilities?.length && ['grey', 'green', 'blue'].includes(i.rarity) && i.id.startsWith('ab_')).length, price: ['grey', 'green', 'blue'] };
  return out; });
console.log(JSON.stringify({ n: D.n, rar: D.rar, role: D.role, mfr: D.mfr, items: D.items, power: D.power, itemsPerSlot: D.itemsPerSlot }));
ok(D.n >= 60, `${D.n} abilities defined (>= 60 target, >= 50 required)`);
ok(D.heatMean.HI > D.heatMean.MM * 1.15 && D.heatMean.HI > D.heatMean.PS * 1.15, 'manufacturer identity in heat: Heavy Industrial is the most heat-hungry: ' + JSON.stringify(Object.fromEntries(Object.entries(D.heatMean).map(([k, v]) => [k, +v.toFixed(2)]))));
ok(!D.dup.length, 'no duplicate ids or names ' + D.dup.join()); ok(!D.bad.length, 'definitions valid + balance bounds: ' + D.bad.join(' | ')); ok(!D.nodesc.length, 'every ability has a generated description ' + D.nodesc.join());
ok(Object.keys(D.role).length === 13, 'all 13 roles covered: ' + Object.keys(D.role).join()); ok(['HI', 'PS', 'MM'].every(m => D.mfr[m] >= 15), 'each manufacturer has >= 15 abilities: ' + JSON.stringify(D.mfr));
ok(['hand', 'arm', 'leg', 'foot', 'torso', 'face', 'brain'].every(g => D.grp[g] >= 1), 'every body-slot group is the home of at least one ability: ' + JSON.stringify(D.grp));
const common = (D.rar.grey + D.rar.green) / D.n; ok(common >= .35 && common <= .45, `common (grey+green) share ${(common * 100).toFixed(0)}% ~ 40%`); ok(D.rar.purple >= 6 && D.rar.orange >= 4 && D.rar.orange <= 8, 'rare tiers exist but are few: ' + JSON.stringify(D.rar));
ok(D.power.grey < D.power.green && D.power.green < D.power.blue && D.power.blue < D.power.purple && D.power.purple < D.power.orange, 'ability power rises with rarity ' + JSON.stringify(Object.fromEntries(Object.entries(D.power).map(([k, v]) => [k, +v.toFixed(2)]))));
ok(!D.noItem.length, 'every ability is granted by at least one augment ' + D.noItem.join()); ok(!D.itemBad.length, 'hardware slot/rarity/manufacturer gating valid ' + D.itemBad.slice(0, 5).join(' | ')); ok(!D.itemMissing.length && D.itemDup === 0, 'augments registered in ITEM_BY_ID with unique ids');
ok(!D.noFx.length, 'every ability has a visible colour-coded VFX fallback ' + D.noFx.join()); ok(!D.chipless.length, 'every ability is modified by chips (>= 1 specific chip family, or heat abilities via cooling chips) ' + D.chipless.join());
ok(!D.tagsUsedNoSource.length, 'every synergy tag an ability uses can be produced by another ability: ' + D.tagsUsedNoSource.join());
// icons: every ability has a served icon file, listed in the manifest
const ids = await ev(async () => (await import('/src/abilities/registry.ts')).ABILITY_DATA.map(a => a.id)); const man = await (await ctx.request.get(page.url().replace(/\/?$/, '/') + 'abilities/manifest.json')).json();
let miss = []; for (const id of ids) { const r = await ctx.request.get(page.url().replace(/\/?$/, '/') + 'abilities/' + id + '.webp'); if (!r.ok() || (await r.body()).length < 800 || !man.icons[id]) miss.push(id); } ok(!miss.length, 'every ability has an icon in public/abilities and the manifest ' + miss.join());
// UI: locker shows ability slots with cycling; codex lists discovered / undiscovered; swapping rebinds buttons; quick swap
const U = await ev(async () => { const g = window.__game, ui = window.__ui, cfg = await import('/src/config.ts'), hw = await import('/src/abilities/hw.ts'); const out = {};
  g.enterTown(true); const s = g.save; const pick = ids => ids.map(id => hw.ABILITY_ITEMS.find(i => i.id === id)).filter(Boolean);
  const defs = hw.ABILITY_ITEMS.filter(i => i.slot === 'armR' || i.slot === 'handR' || i.slot === 'torso').sort((a, b) => b.abilities.length - a.abilities.length);
  for (const d of defs) { const it = { uid: 'u' + (s.uidN++), def: d.id, chips: [] }; s.items.push(it); } s.level = 40;
  for (const sl of ['armR', 'handR', 'torso']) { const d = defs.find(x => x.slot === sl); const it = s.items.find(i => i.def === d.id); s.installed[sl] = it.uid; } g.recompute(); out.granted = g.build.granted.length; out.before = [...g.build.abilities];
  ui.open('locker'); out.hasSlots = !!document.querySelector('#modal .abslots'); out.cycleBtns = document.querySelectorAll('#modal [data-act="abcycle"]').length; out.slotImgs = document.querySelectorAll('#modal .abslot img').length;
  document.querySelector('#modal [data-act="abcycle"][data-i="0"][data-d="1"]')?.click(); out.after = [...g.build.abilities]; out.picked = JSON.stringify(s.abPick);
  const ok1 = g.setAbilityPick(2, g.build.granted[0]); out.swapOk = ok1 && g.build.abilities[2] === g.build.granted[0] && new Set(g.build.abilities).size === g.build.abilities.length; out.noDupes = new Set(g.build.abilities).size === g.build.abilities.length;
  out.badPick = g.setAbilityPick(0, 'sweep_not_granted'); const b4 = [...g.build.abilities]; g.cycleAbility(1, 1); out.cycled = g.build.abilities[1] !== b4[1]; out.cap = g.build.abilities.length <= 3;
  s.codex = { sweep: 0 }; ui.open('codex'); out.cdxFound = document.querySelectorAll('#modal .cdx.found').length; out.cdxLost = document.querySelectorAll('#modal .cdx.lost').length; out.cdxTitle = document.querySelector('#modal h3')?.textContent;
  ui.close(); out.hudIcons = [...document.querySelectorAll('.abtn .aicon')].map(i => i.getAttribute('src')); return out; });
console.log(JSON.stringify(U));
ok(U.granted >= 4 && U.hasSlots && U.cycleBtns >= 6 && U.slotImgs >= 3, `locker lists Q/E/R ability slots with cycle buttons (${U.cycleBtns}) and ${U.granted} granted abilities`);
ok(U.after[0] !== U.before[0], 'cycling slot Q rebinds it: ' + U.before[0] + ' -> ' + U.after[0]); ok(U.swapOk && U.noDupes && U.cap, 'assigning an ability to R swaps with the old holder, no duplicates, max 3 bound'); ok(!U.badPick, 'cannot bind an ability that no installed hardware grants'); ok(U.cycled, 'quick-swap cycleAbility changes the bound ability');
ok(U.cdxFound >= 1 && U.cdxLost >= 50 && /discovered/.test(U.cdxTitle), `codex lists discovered (${U.cdxFound}) and undiscovered (${U.cdxLost}) abilities: ${U.cdxTitle}`);
ok(errors.length === 0, 'no console errors ' + errors.join(';'));
await browser.close(); if (fails) { console.log(fails + ' FAILED'); process.exit(1); } console.log('abilities data ok');
