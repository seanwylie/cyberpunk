// IDKFA toggle: ON -> OFF restores the real loadout exactly (slots, chips, picks, level, locker chips), cheat items are stripped from inventory,
// bank and build exports; the snapshot survives a reload; real loot picked up while ON is kept; mid-dungeon toggle and death are handled.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({}); const ev = (f, a) => page.evaluate(f, a);
await ev(() => document.getElementById('splash')?.remove());
// a real loadout: a blue arm with chips, picks, locker chips, some credits
const before = await ev(async () => { const St = await import('/src/state.ts'), C = await import('/src/config.ts'), T = await import('/src/idkfa_toggle.ts'); const g = window.__game, s = g.save; if (g.mode === 'run') g.enterTown(true);
  const arm = C.ITEMS.find(i => i.slot === 'armR' && i.rarity === 'blue' && i.abilities?.length); const it = St.mkInst(s, arm.id); it.chips = ['power']; s.items.push(it); s.installed.armR = it.uid;
  s.lockerChips = { speed: 2, plating: 1 }; s.credits = 1234; s.stims = 3; s.level = 12; g.recompute(); s.abPick = [g.build.granted[0] || null, null, null]; g.saveNow(); window.__T = T;
  return { key: T.loadoutKey(s), items: s.items.map(i => i.uid).sort(), credits: s.credits, hp: g.hp, codex: Object.keys(s.codex || {}).sort() }; });
await page.keyboard.type('idkfa'); await sleep(200);
const on = await ev(async () => { const g = window.__game, s = g.save, C = await import('/src/config.ts'); return { on: s.idkfa?.on, orange: Object.values(s.installed).every(u => C.ITEM_BY_ID[s.items.find(i => i.uid === u).def].rarity === 'orange'), badge: getComputedStyle(document.getElementById('idkfabadge')).display, toasts: document.getElementById('toasts')?.textContent || '', snap: !!s.idkfa.snap, persisted: !!JSON.parse(localStorage.getItem('arpg-proto-save-v1')).idkfa?.snap }; });
ok(on.on && on.orange && on.snap && on.persisted, 'ON: overpowered set equipped, snapshot stored and persisted');
ok(on.badge !== 'none' && /IDKFA ON/.test(on.toasts), 'ON: HUD badge visible and "IDKFA ON" toast');
const ex = await ev(() => window.wvBuild.export()); ok(ex.cheat === true && /IDKFA CHEAT/.test(await ev(() => window.wvBuild.text())), 'build export while ON is flagged cheat (JSON/code and text)');
// reload while ON
await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__game); await ev(() => document.getElementById('splash')?.remove()); await sleep(600);
ok(await ev(() => window.__game.save.idkfa?.on === true && !!window.__game.save.idkfa.snap), 'reload while ON: still ON with the snapshot');
// real loot while ON: an item, a chip and credits
const loot = await ev(async () => { const St = await import('/src/state.ts'), C = await import('/src/config.ts'); const s = window.__game.save; const d = C.ITEMS.find(i => i.slot === 'legL' && i.rarity === 'green' && !i.id.startsWith('stock_')); const it = St.mkInst(s, d.id); s.items.push(it); s.lockerChips.servo = (s.lockerChips.servo || 0) + 1; s.credits += 50;
  // also park a cheat item in the bank to check it gets stripped
  const g0 = s.idkfa.granted.find(u => !Object.values(s.installed).includes(u)); if (s.bank && g0) { const gi = s.items.find(i => i.uid === g0); s.items = s.items.filter(i => i !== gi); s.bank.entries.push({ id: 'tb', tab: 0, item: gi }); }
  window.__game.saveNow(); return { uid: it.uid, bank: !!s.bank }; });
await page.keyboard.type('idkfa'); await sleep(200);
const off = await ev(() => { const g = window.__game, s = g.save, T = window.__T || null; return { on: s.idkfa?.on, items: s.items.map(i => i.uid), credits: s.credits, servo: s.lockerChips.servo || 0, speed: s.lockerChips.speed, plating: s.lockerChips.plating, badge: getComputedStyle(document.getElementById('idkfabadge')).display, toasts: document.getElementById('toasts')?.textContent || '', hasIdkfa: s.items.some(i => i.def.startsWith('idkfa_') || i.def.startsWith('sig_')), bankCheat: (s.bank?.entries || []).some(e => e.item && (e.item.def.startsWith('idkfa_') || e.item.def.startsWith('sig_'))), expCheat: window.wvBuild.export().cheat }; });
const keyAfter = await ev(async () => (await import('/src/idkfa_toggle.ts')).loadoutKey(window.__game.save));
const realBefore = JSON.parse(before.key), realAfter = JSON.parse(keyAfter);
ok(!off.on && JSON.stringify(realAfter.slots) === JSON.stringify(realBefore.slots) && JSON.stringify(realAfter.pick) === JSON.stringify(realBefore.pick) && realAfter.level === realBefore.level, 'OFF: real loadout restored exactly (slots, uids, chips, ability picks, level)');
ok(!off.hasIdkfa && !off.bankCheat && before.items.every(u => off.items.includes(u)), 'OFF: cheat items stripped from inventory and bank; all pre-cheat items still there');
ok(off.items.includes(loot.uid) && off.servo === 1 && off.speed === 2 && off.plating === 1 && off.credits === before.credits + 50, 'OFF: real loot picked up while ON is kept (item, chip, +50 credits); locker chips otherwise exact');
ok(off.badge === 'none' && /IDKFA OFF/.test(off.toasts) && !off.expCheat, 'OFF: badge hidden, "IDKFA OFF" toast, exports no longer flagged');
// mid-dungeon toggle + death
await ev(() => { const g = window.__game; g.startRun(); g.revealing = false; g.hp = Math.round(g.maxHp * .5); });
const hpRun = await ev(() => window.__game.hp);
await page.keyboard.type('idkfa'); await sleep(150); ok(await ev(() => window.__game.save.idkfa.on && window.__game.hp === window.__game.maxHp), 'mid-dungeon ON: full heal');
await page.keyboard.type('idkfa'); await sleep(150);
const r2 = await ev(() => ({ on: window.__game.save.idkfa.on, hp: window.__game.hp, max: window.__game.maxHp, mode: window.__game.mode }));
ok(!r2.on && r2.mode === 'run' && r2.hp === Math.min(hpRun, r2.max), `mid-dungeon OFF: still in the run, HP back to the pre-cheat ${hpRun}`);
await page.keyboard.type('idkfa'); await sleep(150); await ev(() => { const g = window.__game; g.downed = true; g.hp = 0; });
await page.keyboard.type('idkfa'); await sleep(150);
ok(await ev(async () => { const T = await import('/src/idkfa_toggle.ts'); return !window.__game.save.idkfa.on && window.__game.downed === true && JSON.stringify(JSON.parse(T.loadoutKey(window.__game.save)).slots) === JSON.stringify(JSON.parse(T.loadoutKey(window.__game.save)).slots) && !window.__game.save.items.some(i => i.def.startsWith('idkfa_')); }), 'death while ON then OFF: stays downed (no free revive), cheat gear gone');
ok(await ev(() => window.__game.save.cheated === true), 'save stays flagged cheated after OFF (history)');
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|')); await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
