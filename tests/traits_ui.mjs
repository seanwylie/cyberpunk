// Trait UI (docs/TRAITS.md): recognition hints without a meter before unlock; Specialize in the Fixer panel; selection modal explains
// effects and permanence with a confirm step; Decide later keeps the choice open; commit locks it; L20 locked until L10; checkpoint barks.
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync('shots/traits', { recursive: true });
for (const [w, h, tag, touch] of [[1280, 720, 'desktop', false], [844, 390, 'phone', true]]) {
const { browser, page, errors } = await launch({ viewport: { width: w, height: h }, touch, query: '?splash=hold' }); const ev = (f, a) => page.evaluate(f, a);
const shot = async n => { await sleep(150); await page.screenshot({ path: `shots/traits/${n}_${tag}.png` }); };
await ev(async () => { document.getElementById('splash')?.remove(); const S = await import('/src/traitstate.ts'); const g = window.__game, s = g.save; g.enterTown(true); s.level = 8; for (let i = 0; i < 30; i++) { S.addSig(s, { hack: 1 }, 3); if (i % 5 === 4) S.closeRun(s); } S.closeRun(s); g.recompute(); window.__S = S; });
await ev(() => window.__ui.open('fixer')); await sleep(200);
const pre = await ev(() => { const b = document.querySelector('#modal .trfix'); return { txt: b?.textContent || '', btn: !!document.querySelector('[data-act="tr-open"]') }; });
ok(pre.txt.length > 20 && !pre.btn && !/\d+\s*%|\d+\s*\/\s*\d+|progress/i.test(pre.txt), `${tag} before unlock: recognition line only, no meter/numbers ("${pre.txt.slice(0, 60)}")`);
await shot('fixer_hint');
await ev(() => { window.__ui.close(); window.__game.save.level = 12; window.__ui.open('fixer'); }); await sleep(150);
ok(await ev(() => !!document.querySelector('[data-act="tr-open"]')), `${tag} level 12: Specialize offered by the Fixer`);
await page.click('[data-act="tr-open"]'); await sleep(200); await shot('select');
const m = await ev(() => ({ cards: [...document.querySelectorAll('#modal .trgrid .trcard')].map(c => ({ n: c.querySelector('.trn').textContent, fx: c.querySelectorAll('li').length })), txt: document.querySelector('#modal').textContent }));
ok(m.cards.length === 3 && m.cards.every(c => c.fx >= 1) && m.cards[0].n === 'Netrunner', `${tag} modal: 3 hacking-leaning options with effects listed (${m.cards.map(c => c.n)})`);
ok(/wait/i.test(m.txt) && !/progress|meter/i.test(m.txt), `${tag} modal: says the choice can wait; no meter`);
await page.click('#modal .trgrid .trcard [data-act="tr-pick"]'); await sleep(120); await shot('confirm');
ok(await ev(() => /Permanent/.test(document.querySelector('.trwarn')?.textContent || '') && /new character/.test(document.querySelector('.trwarn').textContent) && window.__game.save.traits.l10 === null), `${tag} Choose shows a permanent-commit warning (no respec, new character) and does not commit yet`);
await page.click('[data-act="tr-back"]'); await sleep(80); await page.click('[data-act="close"].btn.ghost'); await sleep(100);
ok(await ev(() => window.__ui.modal === null && window.__game.save.traits.l10 === null), `${tag} Decide later: closes, nothing committed`);
await ev(() => window.__ui.open('traits')); await sleep(120); await page.click('#modal .trgrid .trcard [data-act="tr-pick"]'); await sleep(80); await page.click('[data-act="tr-commit"]'); await sleep(200);
const c = await ev(() => ({ l10: window.__game.save.traits.l10?.id, txt: document.querySelector('#modal')?.textContent || '', toast: document.getElementById('toasts')?.textContent || '', roster: JSON.parse(localStorage.getItem('wv_roster_v1')).chars[0].trait1 }));
ok(c.l10 === 'netrunner' && /permanent/.test(c.txt) && /Trait committed/.test(c.toast) && c.roster === 'netrunner', `${tag} commit: trait set, shown as permanent, saved to the roster`);
ok(await ev(() => !document.querySelector('[data-act="tr-pick"]') && /level 20/.test(document.querySelector('#modal').textContent)), `${tag} L20 locked until level 20 after the L10 pick`);
await shot('committed');
await ev(() => { const s = window.__game.save; s.level = 20; window.__ui.close(); window.__ui.open('traits'); }); await sleep(200);
const l2 = await ev(() => [...document.querySelectorAll('#modal .trgrid .trcard .trn')].map(x => x.textContent));
ok(l2.length >= 2 && l2.includes('Rootkit') && !l2.includes('Juggernaut'), `${tag} level 20: Specialize II offers Netrunner follow-ups only (${l2})`); await shot('l20');
// checkpoint bark: a fresh unlocked tier nudges once via toast
await ev(() => { const s = window.__game.save; window.__ui.close(); s.traits.seenUnlock = {}; document.getElementById('toasts').innerHTML = ''; window.__ui.handle('traitcheck', 'town'); }); await sleep(1800);
ok(await ev(() => /Odalys/.test(document.getElementById('toasts')?.textContent || '')), `${tag} checkpoint: Odalys nudges when a pick becomes available`);
ok(errors.length === 0, `${tag} no page errors ` + errors.slice(0, 2).join('|')); await browser.close(); }
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
