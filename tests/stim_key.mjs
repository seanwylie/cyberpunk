// Pressing T uses a stim (and B, not T, starts town return).
import { launch, sleep } from './lib.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const { browser, page } = await launch({}); const ev = (f, a) => page.evaluate(f, a);
await ev(() => { const g = window.__game; if (g.mode === 'run') g.enterTown(true); g.startRun(); g.revealing = false; g.inst.carried.stims = 2; g.hp = 1; });
await sleep(200);
await page.keyboard.press('h'); await sleep(100);
ok(await ev(() => window.__game.inst.carried.stims) === 2, 'H no longer uses a stim');
await page.keyboard.press('t'); await sleep(100);
ok(await ev(() => window.__game.inst.carried.stims) === 1 && await ev(() => window.__game.hp) > 1, 'T uses a stim and heals');
ok(await ev(() => !window.__game.channel), 'T does not start town return');
await page.keyboard.press('b'); await sleep(100);
ok(await ev(() => window.__game.channel?.kind === 'town'), 'B starts town return');
ok((await ev(() => document.getElementById('btn-stim').title)).includes('(T)'), 'stim button hint says T');
await browser.close(); process.exit(fails ? 1 : 0);
