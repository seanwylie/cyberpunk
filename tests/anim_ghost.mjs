// Regression: no "ghost" (a faded copy of the previous clip/facing) when starting to move from idle.
// Drives the real PlayerAnimator at 60 Hz and checks the outgoing sprite is never a different facing for more than the short idle->run fade.
import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ viewport:{width:1280,height:720}, dpr:1 });
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
await page.evaluate(()=>{ window.__ui.kit('A',true); window.__game.startRun(); }); await sleep(1500);
const res=await page.evaluate(async()=>{
  const { PlayerAnimator }=await import('/src/sprites.ts'); const A=new PlayerAnimator(window.__rend.anim.loaded);
  const st={hp:100,downed:false,moving:false,dodgeT:0,cast:null,atkCd:0,abCd:[0,0,0],face:Math.PI/2*0+Math.atan2(1,1),inputMove:{x:0,y:0},dodgeDx:0,dodgeDy:0};
  const out={};
  for(const [name,mv] of [['E',{x:1,y:0}],['N',{x:0,y:-1}],['SW',{x:-1,y:1}]]){
    for(let i=0;i<90;i++) A.update(st,1/60);               // settle in idle
    st.moving=true; st.inputMove=mv; const seq=[]; for(let i=0;i<30;i++){ A.update(st,1/60); seq.push({dir:A.dir,anim:A.anim,fading:A.fade<1,prevDir:A.prev?A.prev.dir:null,prevAnim:A.prev?A.prev.anim:null}); }
    st.moving=false; st.inputMove={x:0,y:0}; for(let i=0;i<60;i++) A.update(st,1/60);
    out[name]={ first:seq[0], fadeFrames:seq.filter(f=>f.fading).length, ghostDirFrames:seq.filter(f=>f.fading&&f.prevDir!==null&&f.prevDir!==f.dir).length, dirs:[...new Set(seq.map(f=>f.dir))] };
  }
  return out; });
console.log(JSON.stringify(res));
for(const [n,r] of Object.entries(res)){ ok(r.fadeFrames<=6,`${n}: idle->run cross-fade lasts <=6 frames (${r.fadeFrames})`); ok(r.dirs.length===1,`${n}: facing snaps straight to the move direction, no stepping through intermediate facings (${r.dirs})`); ok(r.first.anim==='run','run starts on the first tick'); }
ok(errors.length===0,'no page errors'); await browser.close(); process.exit(fails?1:0);
