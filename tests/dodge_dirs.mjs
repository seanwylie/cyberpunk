// Dodging with each of the 8 screen-space input directions must move the player in that direction ON SCREEN (inverse iso projection).
import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ viewport:{width:1280,height:720}, dpr:1 });
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
await page.evaluate(()=>{ window.__ui.kit('A',true); window.__game.startRun(); window.__game.dbg.god=true; }); await sleep(1000);
const dirs=[['N',0,-1],['S',0,1],['W',-1,0],['E',1,0],['NE',1,-1],['NW',-1,-1],['SE',1,1],['SW',-1,1]];
for(const [n,ix,iy] of dirs){
  const r=await page.evaluate(([ix,iy])=>{ const g=window.__game; g.revealing=false; g.dodgeCd=0; g.dodgeT=0; g.setMove(0,0); g.face=0;
    const s={x:g.px,y:g.py}; g.setMove(ix,iy); g.dodge(); const ddx=g.dodgeDx, ddy=g.dodgeDy; for(let i=0;i<5;i++) g.updatePlayer(.02); g.setMove(0,0);
    const wx=g.px-s.x, wy=g.py-s.y; g.px=s.x; g.py=s.y; g.dodgeT=0; g.dodgeCd=0;
    return { sx:(wx-wy), sy:(wx+wy)/2, ddx, ddy }; },[ix,iy]);
  const l=Math.hypot(r.sx,r.sy), moved=l>.3; const ux=r.sx/l, uy=r.sy/(l||1);
  // expected screen dir (ix, iy) normalised in screen px space
  const ex=ix/Math.hypot(ix,iy), ey=iy/Math.hypot(ix,iy);
  // renderer screen: x=(wx-wy)*tw/2, y=(wx+wy)*tw/4 -> compare direction in px
  const px=r.sx, py=r.sy*1; const pl=Math.hypot(px,py); const cos=(px*ex+py*ey)/pl;
  ok(moved&&cos>.99,`dodge ${n}: screen dir cos=${cos.toFixed(3)} dist=${l.toFixed(2)}`);
}
ok(errors.length===0,'no page errors '+errors.join('|')); await browser.close(); process.exit(fails?1:0);
