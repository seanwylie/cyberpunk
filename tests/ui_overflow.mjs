// UI text principle (docs/UI.md): no clipped text. Opens the dense panels (story, locker, store, vendor, bank, wardrobe, fixer, guild, travel) and the HUD
// at desktop and phone sizes with long-name gear, and flags any text element whose content overflows its box (scrollWidth > clientWidth) and is cut
// off without an ellipsis + full text in a tooltip (data-tip / title / aria-label). Also: old saved story entries show the renamed zones. Writes shots/ui_overflow/*.png
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync('shots/ui_overflow', { recursive: true });
const VPS = [[1280, 720, 'desktop', false], [844, 390, 'phone', true]];
const PANELS = (process.env.PANELS || 'story,locker,store,vendor,bank,wardrobe,fixer,guild,travel,chars').split(',');
for (const [w, h, tag, touch] of VPS) {
  const { browser, page, errors } = await launch({ viewport: { width: w, height: h }, touch, query: '?splash=hold' });
  await page.route('**/api/story-beat', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, text: 'Fresh line.' }) }));
  await page.evaluate(async () => { document.getElementById('splash')?.remove(); const g = window.__game, s = g.save; g.cheatIdkfa?.();
    const C = await import('/src/config.ts'); const longest = [...C.ITEMS].sort((a, b) => b.name.length - a.name.length).slice(0, 4).map(i => i.id);
    s.journal = [{ t: Date.now() - 1e6, trigger: 'return_town', town: 'rustline', text: 'Basin Coke Ovens chewed you up. The Apothecary still waits in the Pharmacy Vault.', src: 'ai', parts: ['Flashbang Duo Optic Suite'], partDefs: longest, dungeon: 'coke_ovens', result: 'Retreated from Basin Coke Ovens', level: 30, read: true }]; delete s._jrMig;
    g.enterTown(true); });
  await sleep(400);
  for (const p of PANELS) {
    const r = await page.evaluate(async (p) => { const ui = window.__ui; try { if (p === 'story') ui.openStory(); else ui.open(p); } catch (e) { return { err: String(e) }; } await new Promise(r => setTimeout(r, 350));
      const root = document.getElementById('modal'); if (!root || getComputedStyle(root).display === 'none') return { skip: true };
      const bad = []; for (const el of root.querySelectorAll('*')) { if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const over = (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) || (el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0 && cs.overflowY !== "auto" && cs.overflowY !== "scroll"); if (!over) continue; const clips = cs.overflowX !== 'visible' || cs.overflow !== 'visible'; if (!clips) continue;
        const tipped = (cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) && !!el.closest('[data-tip],[title],[aria-label]'); if (!tipped) bad.push((el.className || el.tagName) + ': ' + el.textContent.trim().slice(0, 40)); }
      return { bad: bad.slice(0, 8), n: bad.length, txt: root.textContent }; }, p);
    if (r.skip || r.err) { console.log(`skip ${tag} ${p} ${r.err || ''}`); continue; }
    await page.screenshot({ path: `shots/ui_overflow/${p}_${tag}.png` });
    ok(r.n === 0, `${tag} ${p}: no clipped text ${r.n ? JSON.stringify(r.bad) : ''}`);
    if (p === 'story') { const t = await page.evaluate(() => [...document.querySelectorAll('.stparts .tile.stp')].map(b => ({ txt: b.textContent.replace(/[◆◇●○•\s]/g, ''), tip: b.dataset.tip || '', w: b.getBoundingClientRect().width }))); ok(t.length > 0 && t.every(x => x.txt === '' && /<b /.test(x.tip) && x.w >= 44), `${tag} story: part tiles are icon-only (no names), >=44px, full name/mods/stats in the tooltip`);
      ok(await page.evaluate(() => { const b = document.getElementById('storyregen'); return b && b.classList.contains('ghost') && b.textContent.trim() === '↻' && !!b.dataset.tip; }), `${tag} story: rewrite is a ghost ↻ icon button with a tooltip`); }
    if (p === 'story') ok(!/Coke|Pharmacy|Apothecary/.test(r.txt) && /Slag Ovens/.test(r.txt), `${tag} story: old saved entry shows the renamed zones (no Coke/Pharmacy/Apothecary)`);
    await page.evaluate(() => window.__ui.close()); await sleep(150); }
  // HUD ability bar / labels
  const hud = await page.evaluate(() => { const bad = []; for (const el of document.querySelectorAll('#hud *, #abar *, .abtn *')) { const cs = getComputedStyle(el); if (cs.display === 'none') continue; if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && cs.overflowX !== 'visible' && !(cs.textOverflow === 'ellipsis' && el.closest('[data-tip],[title],[aria-label]')) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) bad.push((el.className || el.tagName) + ': ' + el.textContent.trim().slice(0, 30)); } return bad; });
  await page.screenshot({ path: `shots/ui_overflow/hud_${tag}.png` }); ok(hud.length === 0, `${tag} HUD: no clipped text ${JSON.stringify(hud.slice(0, 6))}`);
  ok(errors.length === 0, `${tag}: no page errors ${errors.slice(0, 2).join('|')}`); await browser.close(); }
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
