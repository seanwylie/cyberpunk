// Dressing room (docs/DRESSING_ROOM.md): preview never changes the equipped look until Apply; rotation (buttons, drag, keys) snaps through the
// 8 baked directions; Buy goes through the simulated store (wvStore funnel); Revert restores; sets, saved outfits, analytics. Desktop + phone.
// Shots: shots/dressing_room/*.png
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync('shots/dressing_room', { recursive: true });
for (const [w, h, tag, touch] of [[1280, 720, 'desktop', false], [844, 390, 'phone', true]]) {
  const { browser, page, errors } = await launch({ viewport: { width: w, height: h }, touch, query: '?splash=hold' });
  const ev = (f, a) => page.evaluate(f, a); const clk = sel => ev(s => { const e = document.querySelector('#modal ' + s); if (!e) return false; e.click(); return true; }, sel);
  await ev(async () => { document.getElementById('splash')?.remove(); const A = await import('/src/content/appearance.ts'); const S = await import('/src/store.ts'); const N = await import('/src/analytics.ts'); N.resetAnalytics(); S.resetOrders(); S.configureMock({ delayMs: 400, failureRate: 0 });
    const g = window.__game, s = g.save; s.cosmetics = A.newCos(); for (const id of ['hair_buzz', 'hair_mohawk', 'head_visor', 'back_cape', 'torso_ps']) A.grantCos(s, id); A.equipCos(s, 'hair_buzz'); s.cosmetics.owned.hair_mohawk = Date.now(); s.credits = 5000; g.enterTown(true); window.__ui.open('wardrobe'); });
  await sleep(500);
  ok(await ev(() => !!document.querySelector('#modal [data-dressing] #wdprev')), `${tag}: dressing room opens with the stage canvas`);
  const eq0 = await ev(() => JSON.stringify(window.__game.save.cosmetics.equipped));
  // 1) preview does not commit
  await clk('[data-act=wd-sel][data-id=hair_mohawk]'); await clk('[data-act=wd-sel][data-id=torso_ps]'); await sleep(200);
  let r = await ev(() => ({ eq: JSON.stringify(window.__game.save.cosmetics.equipped), look: window.__dr.previewLook(), diff: window.__dr.diff().length, chips: document.querySelectorAll('#modal .drdiff').length, applyOn: !document.querySelector('#modal [data-act=wd-apply]').disabled }));
  ok(r.eq === eq0 && r.look.hair === 'hair_mohawk' && r.look.torso === 'torso_ps', `${tag}: selecting previews (hair+torso on the model) while equipped stays ${eq0}`);
  ok(r.diff === 2 && r.chips === 2 && r.applyOn, `${tag}: visible diff vs current look (2 chips) and Apply enabled`);
  await page.screenshot({ path: `shots/dressing_room/preview_${tag}.png` });
  // 2) revert
  await clk('[data-act=wd-revert]'); await sleep(100);
  r = await ev(() => ({ eq: JSON.stringify(window.__game.save.cosmetics.equipped), diff: window.__dr.diff().length }));
  ok(r.eq === eq0 && r.diff === 0, `${tag}: Revert clears the preview, equipped unchanged`);
  // 3) apply commits
  await clk('[data-act=wd-sel][data-id=hair_mohawk]'); await clk('[data-act=wd-apply]'); await sleep(100);
  ok(await ev(() => window.__game.save.cosmetics.equipped.hair === 'hair_mohawk' && window.__dr.diff().length === 0), `${tag}: Apply commits the previewed look`);
  // 4) rotation: buttons, keys, drag; snaps to 8 directions
  const dirs = [];
  for (let i = 0; i < 8; i++) { await clk('[data-act=wd-rot][data-d="1"]'); await sleep(60); dirs.push(await ev(() => window.__dr.WD.dir)); }
  ok(new Set(dirs).size === 8 && dirs[7] === dirs[7] % 8, `${tag}: rotate right walks all 8 directions ${dirs.join(',')}`);
  const before = await ev(() => document.getElementById('wdprev').toDataURL());
  await clk('[data-act=wd-rot][data-d="1"]'); await clk('[data-act=wd-rot][data-d="1"]'); await sleep(500);
  const snapped = await ev(() => ({ f: window.__dr.WD.dirF, d: window.__dr.WD.dir, url: document.getElementById('wdprev').toDataURL() }));
  ok(Math.abs(snapped.f - snapped.d) < .03 && snapped.url !== before, `${tag}: model snaps smoothly to the new direction (dirF ${snapped.f.toFixed(2)} → ${snapped.d}) and the render changes`);
  await clk('[data-act=wd-rot][data-d="-1"]'); await sleep(60); ok(await ev(() => window.__dr.WD.dir) === (snapped.d + 7) % 8, `${tag}: rotate left`);
  const box = await page.locator('#wdprev').boundingBox(); const d0 = await ev(() => window.__dr.WD.dir);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 8 }); await page.mouse.up(); await sleep(400);
  ok(await ev(() => window.__dr.WD.dir) === (d0 + 2) % 8, `${tag}: drag 90px rotates two notches`);
  await page.screenshot({ path: `shots/dressing_room/rotated_${tag}.png` });
  // 5) store skin: try on, Buy through the sim store, still preview until Apply
  await clk('[data-act=wd-show][data-show=store]'); await sleep(80);
  ok(await ev(() => [...document.querySelectorAll('#modal .wdgrid .tile')].every(t => !t.classList.contains('own'))), `${tag}: Store filter lists only buyable items`);
  await clk('[data-act=wd-sel][data-id=pm_aura_brine]'); await sleep(100);
  ok(await ev(() => window.__dr.previewLook().aura === 'pm_aura_brine' && !window.__game.save.cosmetics.equipped.aura && !!document.querySelector('#modal [data-act=wd-buy][data-sku=skin_pm_aura_brine]')), `${tag}: store skin tried on (not equipped) with a Buy button`);
  await page.screenshot({ path: `shots/dressing_room/tryon_store_${tag}.png` });
  await clk('[data-act=wd-buy]'); await sleep(80);
  ok(await ev(() => !!document.querySelector('#modal [data-act=wd-confirm]') && /SIMULATED/.test(document.querySelector('#modal .drbar').textContent)), `${tag}: Buy opens a confirm step (SIMULATED)`);
  await clk('[data-act=wd-confirm]'); await page.waitForFunction(() => window.__game.save.cosmetics.owned.pm_aura_brine, null, { timeout: 4000 }).catch(() => {}); await sleep(150);
  r = await ev(() => { const f = window.wvStore.funnel(), e = window.wvStore.events().map(x => x.name); return { own: !!window.__game.save.cosmetics.owned.pm_aura_brine, eqA: window.__game.save.cosmetics.equipped.aura || null, rc: Object.keys(window.__game.save.store.receipts).length, succ: f.successes, e }; });
  ok(r.own && r.rc === 1 && r.succ === 1 && r.e.includes('purchase_start') && r.e.includes('purchase_confirm'), `${tag}: purchase went through the sim store (receipt, funnel success)`);
  ok(r.eqA === null, `${tag}: bought skin is still only a preview until Apply`);
  ok(['dr_preview', 'dr_rotate', 'dr_buy_intent', 'dr_apply', 'dr_revert'].every(n => r.e.includes(n)), `${tag}: analytics events preview/rotate/buy_intent/apply/revert logged`);
  await clk('[data-act=wd-apply]'); await sleep(80); ok(await ev(() => window.__game.save.cosmetics.equipped.aura === 'pm_aura_brine'), `${tag}: Apply wears the purchased skin`);
  // 6) cancel path charges nothing
  await clk('[data-act=wd-sel][data-id=pm_trail_sodium]'); await clk('[data-act=wd-buy]'); await clk('[data-act=wd-cancel]'); await sleep(80);
  ok(await ev(() => !window.__game.save.cosmetics.owned.pm_trail_sodium && !window.__dr.activeOrder()), `${tag}: cancel grants and charges nothing`);
  await clk('[data-act=wd-revert]');
  // 7) sets: combined price, try the set on
  await clk('[data-act=wd-tab][data-tab=sets]'); await sleep(80); await clk('[data-act=wd-set][data-id=bundle_signal]'); await sleep(150);
  r = await ev(() => ({ look: window.__dr.previewLook(), buy: document.querySelector('#modal [data-act=wd-buy]')?.dataset.sku, price: document.querySelector('#modal [data-act=wd-buy]')?.textContent }));
  ok(r.look.skin === 'pm_skin_cobalt' && r.look.hair === 'pm_hair_signal' && r.buy === 'bundle_signal' && /4\.49/.test(r.price), `${tag}: set tried on whole; Buy targets the bundle at its combined price (${r.price})`);
  await page.screenshot({ path: `shots/dressing_room/set_${tag}.png` });
  await clk('[data-act=wd-revert]');
  // 8) saved outfits
  await clk('[data-act=wd-tab][data-tab=all]'); await clk('[data-act=wd-show][data-show=all]'); await clk('[data-act=wd-sel][data-id=head_visor]'); await clk('[data-act=wd-save]'); await clk('[data-act=wd-revert]'); await sleep(60);
  ok(await ev(() => window.__game.save.cosmetics.outfits?.[0]?.eq.head === 'head_visor' && !window.__game.save.cosmetics.equipped.head), `${tag}: Save stores the previewed outfit without equipping it`);
  await clk('[data-act=wd-load][data-i="0"]'); await sleep(60); ok(await ev(() => window.__dr.previewLook().head === 'head_visor' && !window.__game.save.cosmetics.equipped.head), `${tag}: loading an outfit previews it`);
  await clk('[data-act=wd-revert]');
  // 9) badges + owned styling
  ok(await ev(() => !!document.querySelector('#modal .tile[data-id=pm_skin_jade] .drb.feat') && !!document.querySelector('#modal .tile[data-id=hair_buzz] .drb.own')), `${tag}: featured badge on set pieces, owned check on owned items`);
  ok(errors.length === 0, `${tag}: no page errors ${errors.slice(0, 2).join('|')}`);
  await browser.close(); }
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
