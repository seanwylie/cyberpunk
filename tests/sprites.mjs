// Loader test: temporarily drops a synthetic atlas into public/sprites, checks it is used, then removes it and checks fallback.
import { execSync } from 'node:child_process'; import fs from 'node:fs';
import { launch, sleep } from './lib.mjs';
const dir = 'public/sprites'; fs.mkdirSync(dir, { recursive: true });
// preserve any real art: move it aside, restore at the end
const bak = '.sprites_backup'; fs.rmSync(bak,{recursive:true,force:true}); fs.cpSync(dir,bak,{recursive:true}); const clear=()=>{ for(const f of fs.readdirSync(dir)) fs.rmSync(dir+'/'+f,{recursive:true,force:true}); }; clear();
const anims = { idle:[4,8,12,true], run:[8,8,16,true], dodge:[6,5,16,false], attack:[6,5,16,false], cast:[8,5,14,false], hit:[3,5,12,false], down:[6,5,10,false] };
execSync(`python3 - <<'P'
from PIL import Image, ImageDraw
A=${JSON.stringify(anims).replace(/true/g,"True").replace(/false/g,"False")}
for n,(f,d,fps,l) in A.items():
    im=Image.new('RGBA',(64*f,64*d),(0,0,0,0)); dr=ImageDraw.Draw(im)
    for r in range(d):
        for c in range(f): dr.rectangle([c*64+20,r*64+10,c*64+44,r*64+58],fill=(255,0,255,255))
    im.save('${dir}/'+n+'.png')
P`);
const atlas = { version:1, frame:{w:64,h:64}, anchor:{x:32,y:58}, scale:1, anims:Object.fromEntries(Object.entries(anims).map(([n,[f,d,fps,l]])=>[n,{image:n+'.png',frames:f,fps,loop:l,dirs:d,...(n==='attack'?{hitFrame:2}:n==='cast'?{hitFrame:3}:{}),...(n==='idle'||n==='run'?{blend:true}:{})}])) };
fs.writeFileSync(dir+'/player.json', JSON.stringify(atlas));
await new Promise(r=>setTimeout(r,2500)); // let vite's dev watcher notice the new public files
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
try {
  let { browser, page } = await launch(); await sleep(2500);
  ok(await page.evaluate(()=>!!window.__rend&&true) !== false, 'page boots with atlas');
  const used = await page.evaluate(()=>{ const r=window.__rend; return r? !!r.anim : 'noexpose'; });
  console.log('anim loaded:', used); if(used!=='noexpose') ok(used===true,'atlas loaded and animator active');
  // ---- animation/combat sync (sim timing untouched; playback is aligned/scaled to it) ----
  const sync = await page.evaluate(async()=>{
    const { PlayerAnimator } = await import('/src/sprites.ts'); const R=window.__rend; const A=new PlayerAnimator(R.anim.loaded); const out={};
    const base={hp:100,downed:false,moving:false,dodgeT:0,cast:null,atkCd:0,abCd:[0,0,0],face:0,inputMove:{x:0,y:0},dodgeDx:1,dodgeDy:0};
    const st={...base}; const step=(dt=1/60)=>A.update(st,dt);
    for(let i=0;i<5;i++) step();
    // auto-attack: hit frame shown on the very tick atkCd is set
    st.atkCd=.5; step(); out.atk={anim:A.anim,frame:A.frame,hit:A.hitFrame,li:A.lastImpact&&A.lastImpact.kind,n:A.impacts};
    for(let i=0;i<60;i++){ st.atkCd=Math.max(0,st.atkCd-1/60); step(); } out.atkEnd=A.anim;
    // cast: windup .25s scaled so hitFrame(3) lands exactly at windup end, then follow-through
    st.cast={t:0,ab:{windup:.25}}; const frames=[]; let t=0; for(;t<.25-1e-9;t+=1/60){ st.cast.t=t; step(); frames.push(A.frame); } out.castPre=frames; out.castPreMax=Math.max(...frames);
    st.cast=null; st.abCd=[5,0,0]; step(); out.cast={anim:A.anim,frame:A.frame,hit:A.hitFrame,li:A.lastImpact&&A.lastImpact.kind,n:A.impacts};
    for(let i=0;i<5;i++){ st.abCd=[5,0,0]; step(); } out.castFollow=A.anim;
    // cancelled cast (no cooldown commit) must not fire an impact
    for(let i=0;i<60;i++){ st.abCd=[0,0,0]; step(); } const n0=A.impacts; st.cast={t:0,ab:{windup:.3}}; step(); st.cast=null; step(); out.cancelN=A.impacts-n0;
    for(let i=0;i<60;i++) step();
    // dodge: spans exactly COMBAT.dodge.time (.22s) -> first frame at start, last frame just before end
    const D=.22; st.dodgeT=D; const df=[]; for(let tt=D;tt>0;tt-=1/60){ st.dodgeT=tt; step(); df.push(A.frame); } out.dodgeFrames=df; out.dodgeAnim=A.anim; st.dodgeT=0; step(); out.afterDodge=A.anim;
    // hit then down
    for(let i=0;i<30;i++) step(); st.hp=90; step(); out.hit=A.anim; for(let i=0;i<30;i++) step(); st.hp=0; st.downed=true; step(); out.down=A.anim; for(let i=0;i<120;i++) step(); out.downFrame=A.frame;
    // smoothness: sub-frame blending + stepped turning
    st.hp=100; st.downed=false; st.hp=100; A.update({...base,hp:100},.01); const fr=new Set(); for(let i=0;i<40;i++){ A.update({...base},1/60); fr.add(A.frac.toFixed(2)); } out.fracVariety=fr.size; out.fracOk=[...fr].every(v=>+v>=0&&+v<1);
    const B=new PlayerAnimator(R.anim.loaded); const gs={...base,moving:true,inputMove:{x:1,y:0}}; for(let i=0;i<20;i++) B.update(gs,1/60); const d0=B.dir; gs.inputMove={x:-1,y:0}; const seen=[d0]; for(let i=0;i<40;i++){ B.update(gs,1/60); if(B.dir!==seen[seen.length-1]) seen.push(B.dir); } out.turn=seen;
    return out; });
  console.log(JSON.stringify(sync));
  ok(sync.atk.anim==='attack'&&sync.atk.frame===sync.atk.hit&&sync.atk.hit===2&&sync.atk.li==='attack'&&sync.atk.n===1,'auto-attack: anim hitFrame (2) shown on the tick the sim hits');
  ok(sync.atkEnd==='idle','attack anim returns to idle');
  ok(sync.castPreMax<3||sync.castPre[sync.castPre.length-1]<=3,'cast: hitFrame not passed before windup ends'); ok(sync.cast.anim==='cast'&&sync.cast.frame===3&&sync.cast.li==='cast','cast: hitFrame (3) shown exactly when ability executes'); ok(sync.castFollow==='cast','cast: follow-through plays after hit');
  ok(sync.cancelN===0,'cancelled cast fires no impact');
  ok(sync.dodgeAnim==='dodge'&&sync.dodgeFrames[0]===0&&sync.dodgeFrames[sync.dodgeFrames.length-1]===anims.dodge[0]-1&&sync.dodgeFrames.every((v,i,a)=>i===0||v>=a[i-1]),'dodge: all frames span the 0.22s dodge, monotonic'); ok(sync.afterDodge!=='dodge','dodge anim ends with dodge');
  ok(sync.hit==='hit','hit anim triggers on damage'); ok(sync.down==='down'&&sync.downFrame===anims.down[0]-1,'down anim triggers and holds last frame');
  ok(sync.fracOk&&sync.fracVariety>3,'idle/run blend: sub-frame fractions in [0,1) advance smoothly'); ok(sync.turn.length>=4&&sync.turn.length<=6,'180deg turn walks the ring one notch at a time (no pop): '+sync.turn.join('>'));
  await browser.close();
  clear();
  ({ browser, page } = await launch()); await sleep(800);
  const u2 = await page.evaluate(()=>{ const r=window.__rend; return r? !!r.anim : 'noexpose'; });
  if(u2!=='noexpose') ok(u2===false,'no atlas => procedural fallback'); await browser.close();
} finally { clear(); fs.cpSync(bak,dir,{recursive:true}); fs.rmSync(bak,{recursive:true,force:true}); }
process.exit(fails?1:0);
