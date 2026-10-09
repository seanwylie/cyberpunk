// Body variants: equipping non-stock hardware swaps that slot's layers (per manufacturer); mixed builds mix bodies; sheets lazy-load only when needed.
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const { browser, page, errors } = await launch({ viewport:{width:1280,height:720}, dpr:2 });
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const reqs=[]; page.on('request',r=>{ if(r.url().includes('/sprites/v/')) reqs.push(r.url()); });
await page.evaluate(()=>{ window.__game.startRun(); window.__game.dbg.god=true; }); await sleep(1500);
const sig=()=>page.evaluate(()=>window.__rend.anim.bodyKey);
const equip=(defs)=>page.evaluate(async(defs)=>{ const { mkInst }=await import('/src/state.ts'); const { ITEM_BY_ID }=await import('/src/config.ts'); const g=window.__game,s=g.save;
  for(const sl of ['face','torso','armL','handL','armR','handR','legL','footL','legR','footR']){ const st=s.items.find(i=>i.def==='stock_'+sl); if(st) s.installed[sl]=st.uid; }
  for(const d of defs){ const it=mkInst(s,d); s.items.push(it); s.installed[ITEM_BY_ID[d].slot]=it.uid; } g.recompute(); },defs);
await equip([]); await sleep(300);
ok((await sig())==='base,base,base,base,base,base,base,base,base,base','stock hardware => all base layers'); ok(reqs.length===0,'no variant sheets fetched while stock-equipped (lazy)');
const shot=async(n)=>page.screenshot({path:`docs/art/body/${n}.png`,clip:{x:490,y:230,width:300,height:260}}); fs.mkdirSync('docs/art/body',{recursive:true});
await shot('game_base');
await equip(['hi_ripper_arm','hi_cutting_head','hi_clamp','hi_legs_l','hi_legs_r','hi_torso_green']); await sleep(2500);
console.log(await sig());
ok((await sig()).includes('heavy')&&(await sig()).split(',')[1]==='heavy','HI torso/arm/leg => heavy layers'); ok(reqs.length>0,'variant sheets fetched on demand ('+reqs.length+')'); await shot('game_heavy_partial');
await equip(['ps_face','ps_veil_torso','ps_blade_arm','ps_blade_hand_r','ps_blade_hand_l','ps_legs_l','ps_legs_r','hi_ripper_arm']); await sleep(2500);
const s2=await sig(); console.log(s2); ok(s2.includes('surgical')&&s2.includes('heavy'),'mixed-brand build => mixed-brand body'); await shot('game_mixed');
const st=await page.evaluate(()=>window.__rend.anim.bodyStats); console.log(JSON.stringify(st)); ok(st.composites>=3,'composited sheets built');
ok(errors.length===0,'no page errors '+errors.join('|')); await browser.close(); process.exit(fails?1:0);
