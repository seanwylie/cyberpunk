// Leaving an instance always works: B (soft channel, then uninterruptible emergency exit), Abandon (instant), while downed, mid-boss, enemies adjacent, panel open.
import { launch } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch(); const ev = (f, a) => page.evaluate(f, a);
const setup = (id) => ev(async id => { const g = window.__game; g.enterTown(true); g.save.level = 1; g.save.instance = null; g.save.lockouts = {}; g.save.lastClearDay = null; g.save.settings.devFreeReset = true; g.dbg ??= {}; g.toastLog = []; const ot = g.toast.bind(g); g.toast = m => { g.toastLog.push(m); return ot(m); };
  const ok = g.startRun(id); g.revealing = false; return { ok, mode: g.mode, warn: g.toastLog.some(m => /recommended for Lv/.test(m)) }; }, id);
const surround = () => ev(() => { const g = window.__game; for (const e of g.enemies) if (!e.dead && e.faction === 'enemy') { e.x = g.px + .8; e.y = g.py; e.alert = true; } });
// 1. warning on a far-too-hard dungeon (non-blocking)
let r = await setup('foundry'); ok(r.ok && r.mode === 'run', 'can enter a dungeon far above level (non-blocking): ' + JSON.stringify(r)); ok(r.warn, 'warning toast shown for an over-level dungeon');
// 2. soft channel interrupted by damage -> hint -> emergency exit completes despite damage and movement
const A = await ev(async () => { const g = window.__game; g.dbg.god = false; const out = {}; g.townReturn(); out.soft = g.channel && !g.channel.hard; for (let i = 0; i < 10; i++) g.update(1 / 30); g.hp = g.maxHp; g.hurtPlayer(1, g.px + 1, g.py); out.interrupted = !g.channel; out.fails = g.townFails; out.hint = g.toastLog.some(m => /emergency exit/i.test(m));
  g.townReturn(); out.hard = !!(g.channel && g.channel.hard); out.dur = g.channel?.dur; for (let i = 0; i < 8 * 30 - 5; i++) { g.hp = g.maxHp; g.inputMove = { x: 1, y: 0 }; if (i % 20 === 0) g.hurtPlayer(1, g.px + 1, g.py); g.update(1 / 30); } out.still = g.mode === 'run' && !!g.channel; g.inputMove = { x: 0, y: 0 }; for (let i = 0; i < 20; i++) g.update(1 / 30); out.town = g.mode === 'town'; return out; });
ok(A.soft && A.interrupted && A.fails === 1 && A.hint, 'B starts a soft channel; damage interrupts it and a hint explains the emergency exit: ' + JSON.stringify(A));
ok(A.hard && A.dur === 8 && A.still && A.town, 'second B = 8 s emergency exit; damage/movement do not cancel it and it lands in town');
// 3. downed: B works
await setup('foundry'); const D = await ev(() => { const g = window.__game; g.playerDown(); const o = { downed: g.downed }; g.townReturn(); o.hard = !!g.channel?.hard; for (let i = 0; i < 8 * 30 + 10; i++) g.update(1 / 30); o.town = g.mode === 'town'; o.clean = !g.downed; return o; });
ok(D.downed && D.hard && D.town && D.clean, 'while downed: B starts the uninterruptible exit and returns to town: ' + JSON.stringify(D));
// 4. instant abandon mid-fight with enemies adjacent
await setup('foundry'); await surround(); const I = await ev(() => { const g = window.__game; g.update(1 / 30); const had = !!g.save.instance; const okk = g.leaveInstance(); return { had, okk, mode: g.mode, inst: g.save.instance, ch: g.channel }; });
ok(I.had && I.okk && I.mode === 'town' && !I.inst && !I.ch, 'leaveInstance(): instant return to town with enemies adjacent, instance abandoned');
// 5. abandonInstance() from inside a run goes to town (also mid boss fight); downed panel button exists
await setup('warehouse'); const Bf = await ev(async () => { const g = window.__game; const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; { const rp = g.revealPoint(); g.px = rp.x; g.py = rp.y; } for (let i = 0; i < 400; i++) g.update(1 / 30); const boss = g.enemies.some(e => !e.dead && window.__enemies?.[e.type]?.boss); g.abandonInstance(); return { boss, mode: g.mode, inst: !!g.save.instance }; });
ok(Bf.boss && Bf.mode === 'town' && !Bf.inst, 'mid boss fight: abandon returns to town: ' + JSON.stringify(Bf));
await setup('foundry');
const hasBtn = await ev(async () => { const g = window.__game; g.playerDown(); await new Promise(r => setTimeout(r, 50)); return { down: !!document.querySelector('#downpanel [data-act="leave"]') }; }); ok(hasBtn.down, 'down panel offers "Abandon instance and return to town now"');
await ev(() => { const g = window.__game; g.enterTown(true); });
// 6. B with a panel open (key handler), and with the tutorial left on
await setup('foundry'); await ev(() => { window.__ui.toggleLive?.(); }); await page.keyboard.press('b'); const P = await ev(() => ({ ch: !!window.__game.channel })); ok(P.ch, 'B works with the pack panel open (key handler)');
ok(errors.length === 0, 'no page errors ' + errors.slice(0, 2).join('|'));
await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
