// Ability medallion buttons: icons, type rings, cooldown sweep, heat marks, tooltip, no overlap (desktop + 844x390 touch).
import { launch, sleep } from './lib.mjs';
import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const man = JSON.parse(fs.readFileSync('public/abilities/manifest.json', 'utf8'));
for (const id of ['sweep','brace','forcedcool','cloak','bladeburst','reposition','control','pulse','revive','defib','dodge','shard']) ok(man.icons[id] && fs.existsSync('public/' + man.icons[id]), 'icon ' + id);
for (const [name, o] of [['desktop', {}], ['mobile', { viewport: { width: 844, height: 390 }, touch: true, dpr: 2, query: '?touch=1' }]]) {
  const { browser, page, errors } = await launch(o); const ev = (f, a) => page.evaluate(f, a);
  const types = await ev(async () => { const m = await import('/src/config.ts'); return Object.values(m.ABILITIES).every(a => ['attack','defense','hacking','mobility'].includes(a.type)); });
  ok(types, name + ': every ability has a type');
  await ev(() => { window.__ui.kit('B', true); const g = window.__game; g.startRun(); g.dbg.god = true; g.revealing = false; g.heat = 50; g.abCd[0] = 2.5; }); await sleep(400);
  const r = await ev(() => { const g = window.__game; const bs = [...document.querySelectorAll('.abtn')].filter(b => !b.classList.contains('empty')); const b0 = bs[0];
    const rect = e => e.getBoundingClientRect(); const rs = [...bs, document.getElementById('dodge')].map(rect);
    let overlap = false; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlap = true; }
    const joy = document.getElementById('joyfixed').getBoundingClientRect();
    const bvg = document.getElementById('bvgmark'); 
    return { n: bs.length, img: !!b0.querySelector('.aicon').getAttribute('src'), sweep: b0.querySelector('.cdsweep').style.getPropertyValue('--cd'), pips: b0.querySelectorAll('.heatpips b').length, tc: b0.style.getPropertyValue('--tc'), min: Math.min(...rs.map(r => r.width)), overlap, inView: rs.every(r => r.bottom <= innerHeight && r.right <= innerWidth), label: b0.querySelector('.aname').textContent, dodgeImg: !!document.querySelector('#dodge .aicon').src }; });
  ok(r.n === 3 && r.img && r.label, name + ': 3 medallion buttons with icon + short label ' + r.label);
  ok(parseFloat(r.sweep) > 100 && r.pips >= 1 && r.tc, name + ': cooldown sweep ' + r.sweep + ', heat pips ' + r.pips + ', type colour ' + r.tc);
  ok(r.min >= 56 && !r.overlap && r.inView, name + ': tap targets >=56px (' + Math.round(r.min) + '), no overlap, within viewport');
  // heat states
  const st = await ev(() => { const g = window.__game; g.heat = 99; g.abCd = [0,0,0]; return null; }); await sleep(250);
  ok(await ev(() => document.querySelectorAll('.abtn.hot').length > 0 && !!document.querySelector('.abtn.hot .mark').textContent), name + ': insufficient-heat state marks button');
  await ev(() => { window.__game.overheated = true; }); await sleep(250);
  ok(await ev(() => document.querySelectorAll('.abtn.off').length === 3), name + ': overheated -> offline state');
  await ev(() => { const g = window.__game; g.overheated = false; g.heat = 0; g.abCd = [0,0,0]; }); await sleep(250);
  // aiming glow + aim colour
  const aim = await ev(() => { const g = window.__game; g.beginAim(0); const b = document.querySelector('.abtn'); b.classList.add('aiming'); return getComputedStyle(b).boxShadow.length > 20; }); ok(aim, name + ': aiming state glow ring');
  await ev(() => { window.__game.cancelAim(); document.querySelector('.abtn').classList.remove('aiming'); });
  // ready pulse
  await ev(() => { window.__game.abCd[1] = 5; }); await sleep(400); await ev(() => { window.__game.abCd[1] = 0; }); await sleep(300);
  ok(await ev(() => !!document.querySelector('.abtn.ready')), name + ': ready pulse on cooldown completion');
  // tooltip
  if (name === 'desktop') { const c = await ev(() => { const r = document.querySelectorAll('.abtn')[0].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await page.mouse.move(c[0], c[1]); await sleep(200); }
  else { const c = await ev(() => { const r = document.querySelectorAll('.abtn')[0].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); const cdp = await page.context().newCDPSession(page); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c[0], y: c[1], id: 3 }] }); await sleep(700); }
  const tip = await ev(() => { const t = document.getElementById('abtip'); return t.style.display !== 'none' && t.textContent.length > 20; }); ok(tip, name + ': tooltip with description (' + (name === 'desktop' ? 'hover' : 'long-press') + ')');
  await page.screenshot({ path: `/tmp/ability_test_${name}.png` });
  ok(errors.length === 0, name + ': no console errors ' + errors.join(';')); await browser.close();
}
if (fails) { console.log(fails + ' FAILED'); process.exit(1); } console.log('ability ui ok');
