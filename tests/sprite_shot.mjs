// Game screenshots with the real layered player sprites (run + idle, several directions). Output: docs/art/
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
fs.mkdirSync('docs/art',{recursive:true});
const { browser, page, errors } = await launch({ viewport:{width:1280,height:720}, dpr:2 });
await page.evaluate(()=>{ window.__ui.kit('A',true); window.__game.startRun(); window.__game.dbg.god=true; }); await sleep(600);
console.log('animator active:', await page.evaluate(()=>!!window.__rend.anim));
await page.screenshot({path:'docs/art/game_idle.png'});
for (const [k,n] of [['d','run_e'],['s','run_s'],['a','run_w'],['w','run_n']]) { await page.keyboard.down(k); await sleep(700); await page.screenshot({path:`docs/art/game_${n}.png`}); await page.keyboard.up(k); await sleep(200); }
await page.keyboard.down('d'); await page.keyboard.down('s'); await sleep(700); await page.screenshot({path:'docs/art/game_run_se.png'}); await page.keyboard.up('d'); await page.keyboard.up('s');
console.log('errors:',errors); await browser.close();
