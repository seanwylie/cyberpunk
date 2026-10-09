// WASD must face/run straight on screen: W->N(4) S->S(0) A->W(2) D->E(6); diagonals combine. Captures a before/after strip when OUT is set.
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const { browser, page, errors } = await launch({ viewport:{width:1280,height:720}, dpr:1, query:process.env.Q||'' });
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
await page.evaluate(()=>{ window.__ui.kit('A',true); window.__game.startRun(); window.__game.dbg.god=true; }); await sleep(1200);
const NAMES=['S','SW','W','NW','N','NE','E','SE']; const res={};
const cases=[['w',[ 'w' ],'N'],['s',['s'],'S'],['a',['a'],'W'],['d',['d'],'E'],['wd',['w','d'],'NE'],['wa',['w','a'],'NW'],['sd',['s','d'],'SE'],['sa',['s','a'],'SW']];
fs.mkdirSync('docs/art/dirs',{recursive:true});
for(const [n,keys,want] of cases){
  for(const k of keys) await page.keyboard.down(k); await sleep(700);
  const d=await page.evaluate(()=>window.__rend.anim.dir); res[n]=NAMES[d];
  if(process.env.OUT) await page.screenshot({path:`docs/art/dirs/${process.env.OUT}_${n}.png`,clip:{x:540,y:260,width:200,height:200}});
  for(const k of keys) await page.keyboard.up(k); await sleep(300);
  ok(NAMES[d]===want,`key(s) ${keys.join('+')} -> ${NAMES[d]} (want ${want})`);
}
console.log(JSON.stringify(res)); ok(errors.length===0,'no page errors '+errors.join('|')); await browser.close(); process.exit(fails?1:0);
