// Loader test: temporarily drops a synthetic atlas into public/sprites, checks it is used, then removes it and checks fallback.
import { execSync } from 'node:child_process'; import fs from 'node:fs';
import { launch, sleep } from './lib.mjs';
const dir = 'public/sprites'; fs.mkdirSync(dir, { recursive: true });
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
const atlas = { version:1, frame:{w:64,h:64}, anchor:{x:32,y:58}, scale:1, anims:Object.fromEntries(Object.entries(anims).map(([n,[f,d,fps,l]])=>[n,{image:n+'.png',frames:f,fps,loop:l,dirs:d}])) };
fs.writeFileSync(dir+'/player.json', JSON.stringify(atlas));
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
try {
  let { browser, page } = await launch(); await sleep(800);
  ok(await page.evaluate(()=>!!window.__rend&&true) !== false, 'page boots with atlas');
  const used = await page.evaluate(()=>{ const r=window.__rend; return r? !!r.anim : 'noexpose'; });
  console.log('anim loaded:', used); if(used!=='noexpose') ok(used===true,'atlas loaded and animator active');
  await browser.close();
  fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
  ({ browser, page } = await launch()); await sleep(800);
  const u2 = await page.evaluate(()=>{ const r=window.__rend; return r? !!r.anim : 'noexpose'; });
  if(u2!=='noexpose') ok(u2===false,'no atlas => procedural fallback'); await browser.close();
} finally { fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true}); }
process.exit(fails?1:0);
