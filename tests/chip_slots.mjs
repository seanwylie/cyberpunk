// Chip/body-part compatibility: rules, filtered tray, click + drag socketing, best-fit, migration.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({ viewport: { width: 1600, height: 900 } }); const ev = (f, a) => page.evaluate(f, a);
// rules
const rules = await ev(async () => { const c = await import('/src/config.ts'); const ids = Object.keys(c.CHIPS); const groups = new Set(Object.values(c.SLOT_GROUP));
  return { all: ids.every(i => (c.CHIP_FITS[i] || []).length >= 2), each: [...groups].every(g => ids.filter(i => c.CHIP_FITS[i].includes(g)).length >= 2),
    bad: c.chipFits('power', 'torso') || c.chipFits('coolant', 'handR') || c.chipFits('magnet', 'brain'), good: c.chipFits('power', 'handR') && c.chipFits('coolant', 'torso') && c.chipFits('stride', 'footL') }; });
ok(rules.all, 'every chip declares >=2 body groups'); ok(rules.each, 'every body group has >=2 chip options'); ok(!rules.bad && rules.good, 'fit checks');
// idkfa set is all compatible
ok(await ev(async () => { const c = await import('/src/config.ts'); const i = await import('/src/content/idkfa.ts'); return c.SLOTS.every(sl => i.IDKFA_CHIPS[sl].every(ch => c.chipFits(ch, sl))); }), 'idkfa chips all fit');
// migration
const mig = await ev(async () => { const m = await import('/src/state.ts'); const s = m.newSave(); const t = s.items.find(i => s.installed.handR === i.uid); t.chips = ['power', 'coolant']; const b = s.items.find(i => s.installed.brain === i.uid); b.chips = ['coolant', 'power'];
  const before = s.lockerChips.coolant || 0; const n = m.sanitizeChips(s); return { n, hand: t.chips, brain: b.chips, cool: s.lockerChips.coolant - before, pw: s.lockerChips.power }; });
ok(mig.n === 2 && mig.hand.join() === 'power' && mig.brain.join() === 'coolant' && mig.cool === 1, 'migration unsockets misfit chips to stock ' + JSON.stringify(mig));
// build ignores misfit
ok(await ev(async () => { const b = await import('/src/build.ts'); const l = { handR: { uid: 'x', def: 'stock_handR', chips: ['coolant'] } }; const a = b.computeBuild(l, 1, { HI: 0, PS: 0, MM: 0 }), z = b.computeBuild({ handR: { uid: 'x', def: 'stock_handR', chips: [] } }, 1, { HI: 0, PS: 0, MM: 0 }); return a.stats.cooling === z.stats.cooling; }), 'computeBuild ignores incompatible chip');
// UI
await ev(async () => { const s = window.__game.save; s.lockerChips = { speed: 2, power: 1, coolant: 2, sustain: 2, magnet: 1, stride: 2 }; window.__ui.open('locker'); window.__ui.sel = 'handR'; window.__ui.render(); }); await sleep(300);
const tray = () => ev(() => [...document.querySelectorAll('.ctile')].map(e => e.dataset.chip + (e.classList.contains('dim') ? '!' : '')));
let t = await tray(); ok(t.sort().join() === 'power,speed', 'hand tray shows only fitting chips: ' + t);
ok(await ev(() => document.querySelectorAll('.stag').length > 0), 'slot tags on chip tiles');
await page.click('[data-act=chipshowall]'); await sleep(150); t = await tray(); ok(t.includes('coolant!') && t.includes('speed'), 'show all dims misfits: ' + t);
const tip = await ev(() => document.querySelector('.ctile.dim').dataset.tip); ok(/fits/.test(tip), 'dim tile tooltip has reason');
await page.click('[data-act=chipshowall]'); await sleep(100);
// hover delta
await page.hover('.ctile[data-chip=speed]'); await sleep(150); ok(await ev(() => /ATK/.test(document.getElementById('hoverdelta').textContent)), 'hover shows live stat delta');
// click chip then socket
await page.click('.ctile[data-chip=speed]'); await sleep(100); await page.click('.sock.empty'); await sleep(150);
ok(await ev(() => window.__ui.draft.handR.chips.join() === 'speed'), 'click chip then socket');
// drag and drop
await page.dragAndDrop('.ctile[data-chip=power]', '.sock.empty'); await sleep(200);
ok(await ev(() => window.__ui.draft.handR.chips.join() === 'speed,power'), 'drag and drop chip into socket: ' + await ev(() => window.__ui.draft.handR.chips.join()));
ok(await ev(() => document.querySelector('.slot.tile.sel .sc').textContent === '2/2'), 'body tile shows socket count');
// one click remove
await page.click('.sock.full'); await sleep(150); ok(await ev(() => window.__ui.draft.handR.chips.length === 1), 'one click removes');
// ui refuses misfit
ok(await ev(() => window.__ui.socketChip('coolant') === false && window.__ui.draft.handR.chips.length === 1), 'socketChip rejects incompatible');
await ev(() => { window.__ui.draft.handR.chips.push('coolant'); window.__ui.applyDraft(); }); await sleep(100);
ok(await ev(() => !window.__game.save.items.some(i => i.chips.includes('coolant'))), 'applyDraft rejects incompatible chip');
await ev(() => { window.__ui.draft.handR.chips = ['speed']; window.__ui.render(); });
// best fit on torso, clear
await ev(() => { window.__ui.sel = 'torso'; window.__ui.render(); }); await sleep(100); t = await tray(); ok(!t.includes('power') && !t.includes('magnet') && t.includes('coolant'), 'torso tray: ' + t);
await page.click('[data-act=bestfit]'); await sleep(200);
ok(await ev(() => { const c = window.__ui.draft.torso.chips; return c.length === 4 && c.every(x => ['coolant', 'sustain'].includes(x)); }), 'best fit fills with compatible chips');
await page.screenshot({ path: 'shots/chip_tray.png' });
await page.click('[data-act=apply]'); await sleep(200);
ok(await ev(() => window.__game.save.items.find(i => i.uid === window.__game.save.installed.torso).chips.length === 4), 'apply commits');
// empty state
await ev(() => { window.__game.save.lockerChips = {}; window.__ui.sel = 'face'; window.__ui.resetDraft(); window.__ui.render(); }); await sleep(100);
ok(await ev(() => /No compatible chips in stock/.test(document.querySelector('#modal').textContent)), 'empty state');
const fs = await ev(() => Math.min(...[...document.querySelectorAll('.ctile b,.sock b,.trayhead .btn')].map(b => parseFloat(getComputedStyle(b).fontSize)))); ok(fs >= 11, 'tray fonts readable: ' + fs);
ok(errors.length === 0, 'no console errors ' + errors.join(';'));
await browser.close(); process.exit(fails ? 1 : 0);
