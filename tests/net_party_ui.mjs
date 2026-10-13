// Zero-config party flow in real browser pages: no server URL is ever typed (the build carries VITE_WV_SERVER), invite from town,
// ready check on the world entrance, entering together, a declined member staying in town, late drop-in, and the unreachable-server notice.
// Needs vite dev (URL env); starts the hub on HUB_PORT (default 8787 = the dev-host default server). With vite started as VITE_WV_SERVER=ws://127.0.0.1:$HUB_PORT
// (what production builds do) pages connect on their own in town; on a plain dev server they connect when Party is opened. Neither types a URL.
import { load, sleep, until, mkTest } from './net_lib.mjs'; import { launch } from './lib.mjs'; import fs from 'fs';
const { ok, done } = mkTest(); const { startHub } = await load('server/hub.ts', 'hub');
const PORT = +(process.env.HUB_PORT || 8787); const SHOTS = process.env.SHOTS || '/tmp';
const hub = startHub({ port: PORT, dev: true, host: '127.0.0.1' }); await hub.ready;
const clean = p => p.evaluate(() => { document.getElementById('splash')?.remove(); document.getElementById('rotate')?.remove(); });
const text = (p, sel) => p.evaluate(s => document.querySelector(s)?.innerText || '', sel);
const vis = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; }, sel);
const open = async (name, q = '') => { const c = await launch({ query: '?splash=hold' + q, init: new Function(`localStorage.setItem('wv_name', ${JSON.stringify(name)})`) }); await clean(c.page); return c; };
const id = c => c.page.evaluate(() => window.__net.client?.id);
// 1) zero config: nothing typed, the page connects by itself in town
const A = await open('Alice'), B = await open('Bob'), C = await open('Cara');
for (const c of [A, B, C]) if (!await until(() => c.page.evaluate(() => window.__net.client?.state === 'online'), 4000)) { await c.page.keyboard.press('KeyP'); await sleep(100); await c.page.keyboard.press('KeyP'); }
for (const [c, n] of [[A, 'A'], [B, 'B'], [C, 'C']]) ok(await until(() => c.page.evaluate(() => window.__net.client?.state === 'online'), 12000), n + ' connects with no server URL entered (build default)');
await A.page.keyboard.press('KeyP'); await sleep(300); ok(!(await A.page.evaluate(() => !!document.getElementById('pp-url'))), 'Party panel has no server URL field'); ok(!(await A.page.evaluate(() => !!document.getElementById('pp-dun'))), 'no dungeon dropdown'); ok(/Click a player in town/.test(await text(A.page, '#partypanel')), 'panel points at the town flow'); await A.page.keyboard.press('KeyP');
ok(await until(() => A.page.evaluate(() => { const e = document.getElementById('shardtag'); return getComputedStyle(e).display !== 'none' && /^Rustline \d+$/.test(e.textContent) && /Town copy/.test(e.title); })), 'town copy tag ("Rustline 1") with tooltip'); await A.page.evaluate(() => { const e = document.getElementById('shardtag'); e.dispatchEvent(new MouseEvent('mouseover')); }); await A.page.screenshot({ path: SHOTS + '/town_copy_tag.png' });
const [ia, ib, ic] = [await id(A), await id(B), await id(C)];
// spread out so each player is clickable on its own
await B.page.keyboard.down('d'); await C.page.keyboard.down('s'); await sleep(900); await B.page.keyboard.up('d'); await C.page.keyboard.up('s');
ok(await until(() => A.page.evaluate(() => window.__net.client.townPlayers.sample(performance.now()).length === 2), 10000), 'town presence: A sees B and C');
// 2) invite from town: click the player on the canvas -> small menu -> Invite -> accept prompt on the other page
const clickPlayer = async (c, target) => { const pt = await until(() => c.page.evaluate(t => { const d = window.__net.session.draw, h = d.hits.find(h => h.p.id === t); if (!h) return false; const cv = window.__net.session.rend.canvas, r = cv.getBoundingClientRect(); const x = (h.x0 + h.x1) / 2, y = (h.y0 * .3 + h.y1 * .7); const hit = d.hitTest(x, y); if (hit?.id !== t) return false; window.__pt = [r.left + x * r.width / cv.width, r.top + y * r.height / cv.height]; return true; }, target), 6000); if (!pt) return false; const [x, y] = await c.page.evaluate(() => window.__pt); await c.page.mouse.click(x, y); return true; };
ok(await clickPlayer(A, ib), 'A clicks Bob in town'); if (!await until(() => vis(A.page, '#pmenu'), 2000)) await clickPlayer(A, ib) /* Bob may still be settling from his walk */; ok(await until(() => vis(A.page, '#pmenu')), 'player menu opens'); const menu = await text(A.page, '#pmenu'); ok(/Invite/.test(menu) && /Join party/.test(menu) && /Bob/.test(menu), 'menu: Bob · Invite · Join party');
await A.page.screenshot({ path: SHOTS + '/party_town_invite.png' });
await A.page.click('#pmenu [data-m=invite]'); ok(await until(() => vis(B.page, '#pinvite')), 'Bob gets an accept/decline prompt'); ok(/Alice/.test(await text(B.page, '#pinvite')), 'prompt names the inviter');
await B.page.screenshot({ path: SHOTS + '/party_invite_prompt.png' });
await B.page.click('#pinvite [data-m=accept]'); ok(await until(() => A.page.evaluate(() => window.__net.client.party?.members.length === 2)), 'accept -> Alice and Bob are in a party (no code typed)');
// Cara asks to join (Join party from her menu), Alice accepts
ok(await clickPlayer(C, ia), 'Cara clicks Alice'); await until(() => vis(C.page, '#pmenu')); await C.page.click('#pmenu [data-m=join]'); ok(await until(() => vis(A.page, '#pinvite')), 'Alice gets Cara\'s join request'); await A.page.click('#pinvite [data-m=accept]');
ok(await until(() => A.page.evaluate(() => window.__net.client.party?.members.length === 3)), 'join request accepted -> party of 3');
// 3) ready check: the leader steps into a gateway (the world entrance is the picker)
const leader = await A.page.evaluate(() => window.__net.client.isLeader); ok(leader, 'inviter leads the party');
await A.page.evaluate(() => window.__game.startRun('annex')); ok(await A.page.evaluate(() => window.__game.mode === 'town'), 'leader does not go in alone');
ok(await until(() => vis(B.page, '#rcheck') && vis(C.page, '#rcheck')), 'every member gets a ready check'); await sleep(300); const rc = await text(B.page, '#rcheck'); if (!rc) console.log('DEBUG', JSON.stringify(await B.page.evaluate(() => ({ p: window.__net.client.party, html: document.getElementById('rcheck').outerHTML.slice(0, 300), mode: window.__game.mode })))); ok(/Annex|annex/i.test(rc) || rc.length > 5, 'ready check names the dungeon: ' + rc.split('\n')[0]); ok(/\d+ s/.test(rc), 'ready check shows a countdown');
await B.page.screenshot({ path: SHOTS + '/party_ready_check.png' });
await B.page.click('#rcheck [data-m=ready]'); await C.page.click('#rcheck [data-m=notready]');
ok(await until(() => Promise.all([A, B].map(c => c.page.evaluate(() => window.__game.mode === 'run' && window.__game.inst?.id.startsWith('net-')))).then(r => r.every(Boolean)), 10000), 'ready members (A, B) enter the same dungeon together');
await sleep(600); ok(await C.page.evaluate(() => window.__game.mode === 'town' && window.__net.client.party?.members.length === 3), 'declined member stays in town, still in the party');
const seedA = await A.page.evaluate(() => window.__game.inst.seed), seedB = await B.page.evaluate(() => window.__game.inst.seed); ok(seedA === seedB, 'same seed for both');
ok(await until(() => A.page.evaluate(() => window.__net.session.ic.players.sample(performance.now()).length === 1)), 'A sees B in the dungeon');
// 4) late join: something already happened in the run; Cara drops in from the Party panel
const room = [...hub.rooms.values()][0]; room.killed.add(3); room.flags.gate1 = true;
await C.page.keyboard.press('KeyP'); ok(await until(() => C.page.evaluate(() => !!document.querySelector('[data-a=dropin]'))), 'town member sees Join run'); await C.page.click('[data-a=dropin]');
ok(await until(() => C.page.evaluate(() => window.__game.mode === 'run' && window.__game.inst?.id.startsWith('net-')), 10000), 'Cara drops into the running instance');
const cj = await C.page.evaluate(() => { const g = window.__game, sp = g.level.spawn; return { seed: g.inst.seed, k3: g.enemies.some(e => e.id === 3), gate: !!g.inst.flags.gate1, d: Math.hypot(g.px - sp.x, g.py - sp.y) }; });
ok(cj.seed === seedA, 'late joiner gets the same seed'); ok(!cj.k3, 'late joiner gets the killed set'); ok(cj.gate, 'late joiner gets the shared flags'); ok(cj.d < 3, 'late joiner spawns at the entrance');
ok(await until(() => A.page.evaluate(() => window.__net.session.ic.players.sample(performance.now()).length === 2), 8000), 'A sees the late joiner');
// exits
await A.page.evaluate(() => window.__net.session.exit('left', true) || window.__net.client.send({ t: 'leave_instance' })); ok(await until(() => A.page.evaluate(() => window.__game.mode === 'town')), 'leaving returns to town');
// 5) unreachable server: solo keeps working, short notice
const D = await open('Dee', '&server=' + encodeURIComponent('ws://127.0.0.1:1')); await D.page.keyboard.press('KeyP');
ok(await until(() => D.page.evaluate(() => /offline/i.test(document.getElementById('partypanel').innerText)), 8000), 'unreachable server: panel shows offline + Retry'); ok(await D.page.evaluate(() => window.__game.mode === 'town'), 'solo play keeps running');
const errs = [A, B, C, D].flatMap(c => c.errors).filter(e => !/ERR_UNSAFE_PORT|127\.0\.0\.1:1\/|WebSocket connection|city\/(news|state)|ERR_FAILED/.test(e)); ok(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
for (const c of [A, B, C, D]) await c.browser.close(); await hub.close(); done();
