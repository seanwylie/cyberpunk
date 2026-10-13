// Multiplayer conspicuousness: B (another client) sees A's exclusive render, A's arrival flair, and can open A's inspect card. Needs vite dev (URL env); hub started here.
import { load, sleep, until, mkTest } from './net_lib.mjs'; import { launch } from './lib.mjs';
const { ok, done } = mkTest(); const { startHub } = await load('server/hub.ts', 'hub');
const hub = startHub({ port: 0, dev: true, host: '127.0.0.1' }); await hub.ready; const WS = 'ws://127.0.0.1:' + hub.port();
const clean = p => p.evaluate(() => { document.getElementById('splash')?.remove(); document.getElementById('rotate')?.remove(); });
// A owns an earn-only exclusive (launch week, window open on 2026-10-12) + the Founder skin, shows them off
const A = await launch({ query: `?splash=hold&server=${encodeURIComponent(WS)}`, init: () => localStorage.setItem('wv_name', 'Alice') }); await clean(A.page); await sleep(400);
const prep = await A.page.evaluate(async () => { const R = await import('/src/retire.ts'), M = await import('/src/monet.ts'), P = await import('/src/content/appearance.ts'); R.setClock(Date.parse('2026-10-12T16:00:00Z')); const s = window.__game.save;
  const got = M.earnExclusive(s, 'launch_week_clear'); P.grantCos(s, 'pm_founder_mark'); P.equipCos(s, 'ex_launch_week_halo'); P.equipCos(s, 'pm_founder_mark'); M.setShowcase(s, 'ex_launch_week_halo'); return { got, eq: P.equippedCos(s).map(d => d.id) }; });
ok(prep.got === 'ex_launch_week_halo' && prep.eq.includes('ex_launch_week_halo') && prep.eq.includes('pm_founder_mark'), 'A earned and equipped the launch-week exclusive ' + JSON.stringify(prep));
await A.page.evaluate(() => document.getElementById('btn-party').click()); // zero-config: opening Party connects
ok(await until(() => A.page.evaluate(() => window.__net.client?.state === 'online')), 'A online');
await A.page.evaluate(() => window.__net.client.createParty()); await until(() => A.page.evaluate(() => /^[A-Z0-9]{5}$/.test(window.__net.client.party?.code || '')));
const code = await A.page.evaluate(() => window.__net.client.party.code); await A.page.evaluate(() => window.__net.session.sendProfile());
const B = await launch({ query: `?splash=hold&server=${encodeURIComponent(WS)}&party=${code}`, init: () => localStorage.setItem('wv_name', 'Bob') }); await clean(B.page);
ok(await until(() => B.page.evaluate(() => window.__net.client?.townPlayers.sample(performance.now()).length === 1), 10000), 'B sees A in the hub');
await A.page.evaluate(() => window.__net.session.sendProfile());
const look = await B.page.evaluate(async () => { const t0 = performance.now(); while (performance.now() - t0 < 6000) { const p = window.__net.client.townPlayers.sample(performance.now())[0]; if (p?.look?.ex?.length) return p.look; await new Promise(r => setTimeout(r, 50)); } return null; });
ok(look && look.ex.some(e => e[0] === 'ex_launch_week_halo' && e[1] > 0) && look.sc === 'ex_launch_week_halo' && look.cos.includes('ex_launch_week_halo'), 'B receives A\'s exclusives (id + acquired date), showcase and equipped look');
// arrival flair: nameplate shows the ◆ flair right after A appears
const fl = await B.page.evaluate(async () => { let mx = 0; const t0 = performance.now(); while (performance.now() - t0 < 2000) { const p = window.__net.client.townPlayers.sample(performance.now())[0]; mx = Math.max(mx, (p && window.__net.session.draw.flair.get(p.id)) || 0); await new Promise(r => requestAnimationFrame(r)); } return mx; });
ok(fl > 0.2, 'B shows the arrival nameplate flair for an exclusive owner (alpha ' + fl.toFixed(2) + ')');
// exclusive renders distinctly on the remote: the exclusive signature adds pixels over the same look without it
const px = await B.page.evaluate(async lk => { const C = await import('/src/cosmetics.ts'), P = await import('/src/content/appearance.ts'); const cv = document.createElement('canvas'); cv.width = 200; cv.height = 240; const c = cv.getContext('2d');
  const shot = ids => { c.clearRect(0, 0, 200, 240); const k = { c, x: 100, y: 210, u: 3.4, t: 2.2, moving: false, face: 1, id: 'net:x' }; const L = ids.map(i => P.COS_BY_ID[i]).filter(Boolean); C.drawCosmetics(k, L, 'back'); C.drawCosmetics(k, L, 'front'); return c.getImageData(0, 0, 200, 240).data; };
  const a = shot(lk.cos), b = shot(lk.cos.filter(i => !i.startsWith('ex_'))); let n = 0; for (let i = 3; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 30) n++; return n; }, look);
ok(px > 200, 'remote render of A differs visibly with the exclusive (' + px + ' px)');
await sleep(300); await B.page.screenshot({ path: '/tmp/net_exclusive_B.png' });
// inspect card: click A on B's canvas
const hit = await B.page.evaluate(() => { const h = window.__net.session.draw.hits?.[0] || window.__net.session.draw['hits']?.[0]; if (!h) return null; const cv = document.querySelector('canvas'); const r = cv.getBoundingClientRect(); return { x: r.left + ((h.x0 + h.x1) / 2) * r.width / cv.width, y: r.top + ((h.y0 + h.y1) / 2) * r.height / cv.height }; });
ok(!!hit, 'B has a hit box for A');
if (hit) await B.page.mouse.click(hit.x, hit.y); await sleep(300);
ok(await B.page.evaluate(() => getComputedStyle(document.getElementById('pmenu')).display !== 'none'), 'clicking A in town opens the player menu'); await B.page.click('#pmenu [data-m=inspect]'); await sleep(400); // town click: Invite / Join party / Inspect
const card = await B.page.evaluate(() => { const el = document.getElementById('xinspect'); if (!el) return null; const r = el.getBoundingClientRect(); return { vis: getComputedStyle(el).display !== 'none', txt: el.innerText, tips: el.querySelectorAll('[data-tip]').length, inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, over: [...el.querySelectorAll('*')].some(n => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).textOverflow !== 'ellipsis' && getComputedStyle(n).overflow === 'visible') }; });
ok(card?.vis && /Alice/.test(card.txt) && /Launch Week Halo/.test(card.txt), 'clicking A opens the inspect card on B with A\'s exclusive');
ok(card && /Acquired/.test(card.txt) && /1 of [\d,]+ owners/.test(card.txt) && card.tips > 0, 'inspect card shows acquired date, "1 of N owners", badge tooltip');
ok(card && card.inView && !card.over, 'inspect card fits the viewport without overflow');
await B.page.screenshot({ path: '/tmp/net_exclusive_inspect.png' });
const errs = [...A.errors, ...B.errors]; ok(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
await A.browser.close(); await B.browser.close(); await hub.close(); done();
