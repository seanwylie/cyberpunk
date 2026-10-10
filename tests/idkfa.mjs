// Typing i-d-k-f-a equips orange gear in all 11 slots, fully socketed, flags the save as cheated.
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page, errors } = await launch({}); const ev = (f, a) => page.evaluate(f, a);
await ev(() => { const g = window.__game; if (g.mode === 'run') g.enterTown(true); });
await page.keyboard.type('idkf'); await sleep(100);
ok(await ev(() => !window.__game.save.cheated), 'partial sequence does nothing');
await page.keyboard.press('a'); await sleep(200);
const r = await ev(() => { const g = window.__game, s = g.save; const SL = ['face','brain','armL','torso','armR','handL','legL','handR','footL','legR','footR'];
  const sock = { handL:2,handR:2,armL:3,armR:3,footL:1,footR:1,legL:3,legR:3,torso:8,face:2,brain:4 };
  const rows = SL.map(sl => { const it = s.items.find(i => i.uid === s.installed[sl]); const d = window.__defs?.[it.def]; return { sl, def: it.def, n: it.chips.length, want: sock[sl] }; });
  return { rows, cheated: s.cheated, conflicts: g.build.conflicts, hp: g.hp, max: g.maxHp, items: s.items.length, credits: s.credits, stims: s.stims }; });
const orange = await ev(async () => { const m = await import('/src/config.ts'); const s = window.__game.save; return ['face','brain','armL','torso','armR','handL','legL','handR','footL','legR','footR'].every(sl => m.ITEM_BY_ID[s.items.find(i => i.uid === s.installed[sl]).def].rarity === 'orange'); });
ok(orange, 'all 11 slots orange');
ok(r.rows.every(x => x.n === x.want), 'all slots fully socketed');
ok(r.cheated === true, 'save flagged cheated');
ok(r.conflicts.length === 0, 'no hard conflicts');
ok(r.hp === r.max && r.max > 150, 'fully healed, hp ' + r.hp);
ok(r.items >= 22, 'old gear kept in storage (' + r.items + ' items)');
ok(r.credits >= 99999 && r.stims >= 20, 'credits and stims topped up');
// ignored in text inputs
await ev(() => { window.__game.save.cheated = false; const i = document.createElement('input'); i.id = 'tmpin'; document.body.appendChild(i); i.focus(); });
await page.keyboard.type('idkfa'); await sleep(100);
ok(await ev(() => !window.__game.save.cheated), 'ignored while typing in a text input');
await ev(() => document.getElementById('tmpin').remove());
// works in a run
await ev(() => { const g = window.__game; g.startRun(); g.revealing = false; });
await page.keyboard.type('idkfa'); await sleep(100);
ok(await ev(() => window.__game.save.cheated === true && window.__game.hp === window.__game.maxHp), 'works in a run');
ok(errors.length === 0, 'no page errors ' + errors.join('|'));
await browser.close(); process.exit(fails ? 1 : 0);
