import { launch, sleep } from './lib.mjs';
import fs from 'fs';
const out = new URL('../shots/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const SHOT = async (page, name) => { await page.screenshot({ path: out + name + '.png' }); console.log('shot', name); };

// ---------- desktop ----------
{
  const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
  const ev = (f, a) => page.evaluate(f, a);
  await sleep(500); await SHOT(page, '01-town');
  await ev(() => { window.__ui.kit('A', true); window.__ui.open('locker'); }); await sleep(200); await SHOT(page, '02-locker-workspace');
  await ev(() => { const u = window.__ui; u.draft.torso.chips.push('power'); u.draft.armR.chips.push('speed'); u.render(); }); await sleep(100); await SHOT(page, '03-locker-staged-draft');
  await ev(() => { window.__ui.close(); window.__ui.kit('A', true); window.__game.startRun(); window.__game.dbg.god = true; }); await sleep(300);
  // real-time play: walk through the yard and fight
  await page.keyboard.down('d'); await sleep(2200); await page.keyboard.up('d'); await sleep(300);
  await ev(() => { const g = window.__game; g.px = 18; g.py = 19; }); await sleep(1700);
  await page.keyboard.down('q'); await page.mouse.move(900, 300); await sleep(250); await SHOT(page, '04-yard-combat-aiming');
  await page.keyboard.up('q'); await sleep(300);
  // processing floor elite telegraph
  await ev(() => { const g = window.__game; g.dbg.god = true; g.inst.flags.gate1 = true; g.openDoor('gate1'); g.px = 36; g.py = 19.5; }); await sleep(2500); await SHOT(page, '05-processing-floor-elite');
  // junction with terminal prompt
  await ev(() => { const g = window.__game; g.enemies.forEach(e => { if (!e.dead && e.faction === 'enemy' && !/overseer|enforcer|warden/.test(e.type)) g.killEnemy(e); }); g.inst.flags.lock2 = true; g.openDoor('lock2'); g.px = 56.4; g.py = 12; g.update(0.016); }); await sleep(600); await SHOT(page, '06-junction-terminal');
  // boss reveal
  await ev(() => { const g = window.__game; g.inst.flags.controller = true; g.openDoor('boss'); g.px = 67.5; g.py = 19.5; }); await sleep(4500); await SHOT(page, '07-boss-reveal');
  await sleep(6500); await ev(() => { const g = window.__game; const b = g.enemies.find(e => /overseer|enforcer|warden/.test(e.type) && !e.dead); g.px = b.x - 4; g.py = b.y + 0.5; }); await sleep(1800); await SHOT(page, '08-boss-fight-telegraph');
  await ev(() => { window.__game.dbg.oneShot = true; }); await sleep(6000); await SHOT(page, '09-after-boss');
  await ev(() => { window.__ui.toggleLive(); }); await sleep(300); await SHOT(page, '10-live-pack-compare');
  console.log('desktop errors', errors); await browser.close();
}
// ---------- mobile landscape (touch) ----------
{
  const { browser, page, errors, ctx } = await launch({ viewport: { width: 844, height: 390 }, touch: true, dpr: 2, query: '?touch=1' });
  const ev = (f, a) => page.evaluate(f, a); const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i })) });
  await ev(() => { window.__ui.kit('B', true); window.__game.startRun(); window.__game.dbg.god = true; window.__game.px = 10; window.__game.py = 19; }); await sleep(500);
  // floating joystick: press on left, drag right-up
  await touch('touchStart', [[120, 280, 1]]); await touch('touchMove', [[170, 250, 1]]); await sleep(1800); await SHOT(page, '11-mobile-landscape-joystick');
  const mv = await ev(() => ({ x: window.__game.px, y: window.__game.py, joy: document.getElementById('joy').style.display })); console.log('mobile move', mv);
  await touch('touchEnd', []);
  // aim an ability by dragging from its button, then release (cast) with the other thumb free
  const b = await ev(() => { const r = document.querySelectorAll('.abtn')[0].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await ev(() => { const g = window.__game; g.px = 18; g.py = 19; }); await sleep(1200);
  await touch('touchStart', [[b[0], b[1], 5]]); await touch('touchMove', [[b[0] - 60, b[1] - 20, 5]]); await sleep(200); await SHOT(page, '12-mobile-drag-aim');
  const heat0 = await ev(() => window.__game.heat); await touch('touchEnd', []); await sleep(500);
  const heat1 = await ev(() => window.__game.heat); console.log('mobile cast heat', heat0, '->', heat1);
  // tap dodge
  const d = await ev(() => { const r = document.getElementById('dodge').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await touch('touchStart', [[d[0], d[1], 7]]); await touch('touchEnd', []); await sleep(100); console.log('dodging', await ev(() => window.__game.dodgeT > 0 || window.__game.dodgeCd > 0));
  console.log('mobile errors', errors); await browser.close();
}
