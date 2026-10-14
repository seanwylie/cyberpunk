// Tutorial "Patch: T" step (Sean: T does nothing in the tutorial). Pressing T (desktop) / tapping the patch button (touch) must tick the step even
// at full HP, and every no-op press must say why (Full health / No patches / Patch recharging); a hurt player with a patch heals and the badge counts down.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
for (const touch of [false, true]) {
  const tag = touch ? 'touch' : 'desktop';
  const { browser, page, errors } = await launch({ viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 720 }, touch, tutorial: true, query: '?tutorial=on&splash=hold' });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => document.getElementById('splash')?.remove()); await page.waitForFunction(() => window.__rend?.town?.ready, null, { timeout: 60000 });
  await ev(() => { const g = window.__game; g.save.stims = Math.max(2, g.save.stims); g.startRun('annex'); }); await sleep(2500);
  await ev(() => { const g = window.__game; g.enemies.forEach(e => e.dead = true); g.enemies = []; g.grace = null; g.hp = g.maxHp; g.stimCd = 0; });
  const press = async () => { if (touch) await page.tap('#btn-stim'); else await page.keyboard.press('t'); await sleep(400); };
  const lastText = () => ev(() => window.__game.fx.filter(f => f.kind === 'text').map(f => f.text).pop() || null);
  await sleep(300); ok(!(await ev(() => !!window.__tut.flags?.stim)), `${tag}: patch step not done before pressing`);
  await press();
  ok(await ev(() => !!window.__tut.flags?.stim), `${tag}: pressing patch at full HP ticks the tutorial step`);
  ok((await lastText()) === 'Full health', `${tag}: full-HP press says "Full health" (${await lastText()})`);
  const n0 = await ev(() => window.__game.inst.carried.stims);
  await sleep(1000); await ev(() => { window.__game.hp = window.__game.maxHp * .5; }); await press();
  const r = await ev(() => ({ hp: window.__game.hp / window.__game.maxHp, n: window.__game.inst.carried.stims, badge: document.getElementById('stimn').textContent, title: document.getElementById('btn-stim').title }));
  ok(r.hp > .5 && r.n === n0 - 1, `${tag}: hurt + patch heals and uses one (hp ${r.hp.toFixed(2)}, ${n0}->${r.n})`);
  ok(r.badge === String(r.n) && /Patch/.test(r.title), `${tag}: button badge ${r.badge}, tooltip "${r.title}"`);
  await sleep(1300); await press(); ok((await lastText()) === 'Patch recharging', `${tag}: press on cooldown says "Patch recharging" (${await lastText()})`);
  await ev(() => { const g = window.__game; g.stimCd = 0; g.inst.carried.stims = 0; }); await sleep(1300); await press();
  ok((await lastText()) === 'No patches', `${tag}: press with none says "No patches" (${await lastText()})`);
  const cnt = await ev(async () => { const g = window.__game; g.stimMsgT = -1e9; const c0 = g.fx.length; for (let i = 0; i < 6; i++) g.useStim(); return g.fx.length - c0; });
  ok(cnt === 1, `${tag}: mashing is rate-limited (${cnt} message for 6 presses)`);
  ok(errors.length === 0, `${tag}: no page errors ${errors[0] || ''}`); await browser.close();
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
