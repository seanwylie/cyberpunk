// Party panel UI + end-to-end browser flow: two real game pages, one server. Needs vite dev (URL env); the hub is started here.
import { load, sleep, until, mkTest } from './net_lib.mjs'; import { launch } from './lib.mjs';
const { ok, done } = mkTest(); const { startHub } = await load('server/hub.ts', 'hub');
const hub = startHub({ port: 0, dev: true, host: '127.0.0.1' }) /* dev: lets the test teleport (tp flag) to the boss */; await hub.ready; const WS = 'ws://127.0.0.1:' + hub.port();
const clean = p => p.evaluate(() => { document.getElementById('splash')?.remove(); document.getElementById('rotate')?.remove(); });
const text = (p, sel) => p.evaluate(s => document.querySelector(s)?.innerText || '', sel);
const click = (p, sel) => p.evaluate(s => document.querySelector(s)?.click(), sel);
// 1) solo default: no connection attempted, panel offline, game fully playable
const A = await launch({ query: '?splash=hold' }); await clean(A.page); await sleep(500);
ok(await A.page.evaluate(() => !!document.getElementById('btn-party')), 'Party button is in the top-right tray');
ok(await A.page.evaluate(() => { const t = document.getElementById('topright').getBoundingClientRect(), b = document.getElementById('btn-party').getBoundingClientRect(); return b.width > 20 && b.top >= t.top - 2 && b.bottom <= t.bottom + 2 && b.right <= t.right + 2; }), 'Party button sits inside the tray bounds');
await click(A.page, '#btn-party'); await sleep(200); ok(await A.page.evaluate(() => document.getElementById('partypanel').classList.contains('open')), 'click opens the panel'); ok(/offline/i.test(await text(A.page, '#partypanel')) && /Solo play is unaffected/i.test(await text(A.page, '#partypanel')), 'panel explains offline/solo mode');
ok(await A.page.evaluate(() => !window.__net.client), 'no network client created until Connect is pressed (offline default)');
await A.page.evaluate(() => { document.getElementById('pp-url').value = 'ws://127.0.0.1:1'; }); await click(A.page, '[data-a=connect]'); await sleep(900); ok(await A.page.evaluate(() => window.__game.mode === 'town' && !window.__net.client?.inst), 'unreachable server: game keeps running in town'); await A.page.evaluate(() => window.__net.ui.forget());
// 2) connect two pages
await A.page.evaluate(() => { localStorage.setItem('wv_name', 'Alice'); window.__net.ui.render(); }); await A.page.evaluate(u => { document.getElementById('pp-url').value = u; document.querySelector('[data-a=connect]').click(); }, WS);
ok(await until(() => A.page.evaluate(() => window.__net.client?.state === 'online')), 'Connect -> online'); await sleep(200); ok(await A.page.evaluate(() => document.getElementById('btn-party').classList.contains('on')), 'tray button shows online dot');
await click(A.page, '[data-a=create]'); ok(await until(() => A.page.evaluate(() => /^[A-Z0-9]{5}$/.test(document.getElementById('pp-code-show')?.innerText || ''))), 'panel shows 5-char party code'); const code = await text(A.page, '#pp-code-show');
const B = await launch({ query: `?splash=hold&server=${encodeURIComponent(WS)}&party=${code}`, init: () => localStorage.setItem('wv_name', 'Bob') }); await clean(B.page);
ok(await until(() => A.page.evaluate(() => window.__net.client.party?.members.length === 2)), 'invite link (?party=CODE) auto-joins the party'); await sleep(200);
await click(A.page, '[data-a=copy]'); ok(/Bob/.test(await text(A.page, '#partypanel')), 'leader panel lists the joined member by name');
await A.page.evaluate(() => { document.getElementById('pp-dun').value = 'annex'; window.__net.client.setDungeon('annex'); }); await sleep(400);
await click(B.page, '#btn-party'); await sleep(200); await click(B.page, '[data-a=ready]'); ok(await until(() => A.page.evaluate(() => window.__net.client.party.members.every(m => m.ready))), 'ready check from member reaches leader');
ok(/HP ×1\.65/.test(await text(A.page, '#partypanel')), 'panel shows party scaling for 2 players');
ok(await until(() => A.page.evaluate(() => window.__net.client.townPlayers.sample(performance.now()).length === 1), 8000), 'town presence: other player visible in town');
await A.page.evaluate(() => { const i = document.getElementById('pp-chat'); i.value = 'hello team'; document.querySelector('[data-a=chat]').click(); }); ok(await until(() => B.page.evaluate(() => /hello team/.test(document.getElementById('netchat').innerText))), 'chat appears for the other player (overlay)');
// 3) start the dungeon
await click(A.page, '[data-a=start]');
ok(await until(() => Promise.all([A, B].map(c => c.page.evaluate(() => window.__game.mode === 'run' && window.__game.inst?.id.startsWith('net-')))).then(r => r.every(Boolean)), 10000), 'both game pages enter the same networked dungeon (mode run)');
await sleep(1500); const info = p => p.page.evaluate(() => { const g = window.__game, s = window.__net.session; return { px: g.px, py: g.py, enemies: g.enemies.length, remotes: s.ic.players.sample(performance.now()).length, saveInst: !!g.save.instance, hp: g.hp }; });
{ const a = await info(A), b = await info(B); ok(a.remotes === 1 && b.remotes === 1, 'each client sees the other party member'); ok(a.enemies > 20 && b.enemies > 20, 'each client runs its own local enemies from the shared seed (' + a.enemies + '/' + b.enemies + ')'); ok(!a.saveInst, 'solo save instance untouched by party run'); }
// client-authoritative: the game loop is the normal one (not replaced by a server view); the local sim answers input in the same frame
ok(await A.page.evaluate(() => { const g = window.__game; return g.mode === 'run' && !!g.enemies.length && typeof g.update === 'function' && !window.__net.session.ic.pending; }), 'local Game simulates the dungeon itself (no server-driven view)');
const a0 = await info(A); await A.page.keyboard.down('d'); await sleep(1500); await A.page.keyboard.up('d'); await sleep(500); const a1 = await info(A); ok(Math.hypot(a1.px - a0.px, a1.py - a0.py) > 2, 'WASD moves the player locally (' + Math.hypot(a1.px - a0.px, a1.py - a0.py).toFixed(1) + ' tiles)');
const room = [...hub.rooms.values()][0];
ok(await until(async () => { const me = await A.page.evaluate(() => window.__net.client.id); const p = room.players.get(me); const g = await info(A); return Math.hypot(p.x - g.px, p.y - g.py) < .8; }), 'relayed (display) position matches the local game within 0.8 tiles');
ok(await until(async () => (await info(B)).remotes === 1 && await B.page.evaluate(() => { const o = window.__net.session.ic.players.sample(performance.now())[0]; const a = window.__net.client.inst; return !!o; })), 'B renders A from the 8 Hz relay');
await A.page.screenshot({ path: '/tmp/net_party_A.png' });
// boss through real clients: A solves the doors, walks to the reveal point and one-shots the boss; B never goes there but gets the kill event, the completed state and its own rewards if it took part
const credBefore = await A.page.evaluate(() => window.__game.save.credits);
await A.page.evaluate(() => { const g = window.__game; g.dbg.god = true; g.dbg.oneShot = true; const f = g.inst.flags; f.gate1 = f.lock2 = f.controller = true; g.applyDoors(); const p = g.revealPoint(); g.px = p.x; g.py = p.y; });
ok(await until(() => room.flags.gate1 && room.flags.controller, 5000), 'door/objective flags reach the server and are relayed');
ok(await until(() => B.page.evaluate(() => window.__game.inst.flags.gate1 && window.__game.inst.flags.controller), 5000), 'B\'s doors open when A completes the objectives');
ok(await until(() => room.flags.bossSpawned, 15000), 'boss reveal reported to the server'); ok(await until(() => room.bossDead, 60000), 'A kills the boss (claim accepted by the server)'); await sleep(1500);
ok(await B.page.evaluate(() => window.__game.inst.flags.bossDead), 'B sees the boss dead via the server event');
ok(await A.page.evaluate(() => window.__game.inst.flags.completed && window.__game.inst.flags.rewardsGranted), 'A has instance-complete state and its clear rewards');
await sleep(500); for (const c of [A.page]) { const ds = await c.evaluate(() => window.__game.inst.drops.map(d => [d.x, d.y])); for (const [x, y] of ds) { await c.evaluate(([x, y]) => { window.__game.px = x; window.__game.py = y; }, [x, y]); await sleep(200); } } await sleep(800);
ok(await A.page.evaluate(([b]) => window.__game.inst.carried.credits > 0 || window.__game.save.credits > b, [credBefore]), 'personal loot rolled locally from the confirmed kill (carried credits)');
await click(A.page, '[data-a=leaveinst]'); ok(await until(() => A.page.evaluate(() => window.__game.mode === 'town' && !window.__game.inst)), 'Leave dungeon returns to town without solo penalties'); ok(await A.page.evaluate(() => !window.__game.save.instance && window.__game.save.repairBill === 0), 'no repair bill or abandoned instance created');
const errs = [...A.errors, ...B.errors].filter(e => !/ERR_UNSAFE_PORT|127\.0\.0\.1:1\//.test(e)); ok(errs.length === 0, 'no page errors (expected unreachable-server log ignored) ' + errs.slice(0, 3).join(' | '));
await A.browser.close(); await B.browser.close(); await hub.close(); done();
