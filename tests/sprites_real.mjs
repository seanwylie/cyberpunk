// Checks the REAL atlas in public/sprites: frame counts, hitFrame sync, blending and turn smoothness; captures in-game frames to docs/art/anim/game_*.png
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
fs.mkdirSync('docs/art/anim',{recursive:true});
const { browser, page, errors } = await launch({ viewport:{width:1280,height:720}, dpr:2 });
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
await page.evaluate(()=>{ window.__ui.kit('A',true); window.__game.startRun(); window.__game.dbg.god=true; }); await sleep(800);
const info=await page.evaluate(async()=>{ const { PlayerAnimator }=await import('/src/sprites.ts'); const R=window.__rend; const L=R.anim.loaded; const A=new PlayerAnimator(L); const base={hp:100,downed:false,moving:false,dodgeT:0,cast:null,atkCd:0,abCd:[0,0,0],face:0,inputMove:{x:0,y:0},dodgeDx:1,dodgeDy:0}; const st={...base}; const step=(dt=1/60)=>A.update(st,dt); const o={};
  o.frames=Object.fromEntries(Object.entries(L.atlas.anims).map(([n,a])=>[n,[a.frames,a.fps,a.hitFrame??null,!!a.blend]]));
  for(let i=0;i<5;i++) step(); st.atkCd=.5; step(); o.atk={f:A.frame,h:A.hitFrame,n:A.impacts};
  for(let i=0;i<60;i++){ st.atkCd=Math.max(0,st.atkCd-1/60); step(); }
  st.cast={t:0,ab:{windup:.3}}; for(let t=0;t<.3;t+=1/60){ st.cast.t=t; step(); } st.cast=null; st.abCd=[5,0,0]; step(); o.cast={f:A.frame,h:A.hitFrame,n:A.impacts};
  // run motion: sample displayed frame positions for 1 s while running east, then reverse
  for(let i=0;i<90;i++){ st.abCd=[0,0,0]; step(); } st.moving=true; st.inputMove={x:1,y:0}; const seq=[]; for(let i=0;i<60;i++){ step(); seq.push(+(A.frame+A.frac).toFixed(2)); } o.runSeq=seq.slice(0,24);
  st.inputMove={x:-1,y:0}; const dirs=[]; for(let i=0;i<40;i++){ step(); dirs.push(A.dir); } o.turnDirs=dirs.filter((d,i)=>i===0||d!==dirs[i-1]);
  return o; });
console.log(JSON.stringify(info));
ok(info.frames.run[0]===16&&info.frames.idle[0]===12&&info.frames.attack[0]===12&&info.frames.dodge[0]===10,'new frame counts loaded');
ok(info.atk.f===5&&info.atk.h===5&&info.atk.n===1,'attack impact lands on hitFrame 5 of 12'); ok(info.cast.f===5&&info.cast.h===5,'cast release lands on hitFrame 5 of 12');
const mono=info.runSeq.every((v,i,a)=>i===0||v>a[i-1]-.001||v<2); ok(info.runSeq.filter((v,i,a)=>i&&v-a[i-1]>1.3).length===0,'run advances <1.3 frames per 60Hz tick (continuous sub-frame playback)');
ok(info.turnDirs.length>=4,'reverse turn passes through intermediate directions: '+info.turnDirs.join('>'));
// in-game captures: idle, run (east + se), attack hit frame, cast
const shot=async(n)=>{ await page.screenshot({path:`docs/art/anim/game_${n}.png`,clip:{x:440,y:200,width:400,height:300}}); };
await shot('idle'); await page.keyboard.down('d'); await sleep(500); await shot('run_e'); await page.keyboard.down('s'); await sleep(500); await shot('run_se'); await page.keyboard.up('d'); await page.keyboard.up('s'); await sleep(300);
await page.mouse.move(900,360); await page.mouse.down(); await sleep(150); await shot('attack'); await page.mouse.up(); await sleep(300); await page.keyboard.press('1'); await sleep(120); await shot('cast'); await sleep(400);
await page.keyboard.press('Space'); await sleep(60); await shot('dodge');
console.log('errors:',errors); ok(errors.length===0,'no page errors'); await browser.close(); process.exit(fails?1:0);
