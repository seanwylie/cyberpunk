# Cuts enemy/boss figures out of the AI concept sheets (flat grey backdrop) -> public/dungeons/enemies/<id>.png (RGBA) + manifest.json.
# Boxes are hand-set per figure in 1024x576 preview coordinates (the sheets are 1280x720; x1.25). Same bg-fit approach as tools/town/cut.py.
# usage: python3 tools/dungeons/cut_enemies.py   (idempotent)
import numpy as np, json, os
from PIL import Image
from scipy import ndimage as nd
K=1.25
SHEETS={
 'enemies_foundry':{'teague':[95,15,335,280],'brannoch':[335,25,665,285],'ore9':[705,5,1010,285],'slaghauler':[5,315,190,535],'ladlecrew':[200,325,380,535],'cinderhound':[395,350,630,545],'slagcannon':[630,360,825,530],'quenchpriest':[810,320,1010,555]},
 'enemies_clinic':{'surgeon':[35,5,295,270],'autosurgeon':[360,0,670,270],'recovered':[700,5,925,275],'orderly':[35,315,170,500],'nursebot':[225,315,355,500],'gurneyrunner':[405,340,565,495],'sentry':[630,330,760,505],'matron':[775,310,975,520]},
 'enemies_warehouse':{'stockmgr':[125,60,265,285],'retrieval':[370,50,650,305],'reclaimer':[775,55,905,290],'picker':[45,355,150,500],'loader':[195,335,330,500],'forkbot':[380,330,500,510],'scanner':[545,340,640,510],'camgun':[690,375,810,500],'shiftlead':[860,325,1010,510]},
}
man={}
for sh,boxes in SHEETS.items():
    rgb0=np.array(Image.open(f'public/dungeons/source/{sh}.jpg').convert('RGB')); im=rgb0.astype(float); lum=im.mean(2); chroma=im.max(2)-im.min(2)
    loc=np.sqrt(np.maximum(nd.uniform_filter(lum**2,5)-nd.uniform_filter(lum,5)**2,0))
    H,W=lum.shape; yy,xx=np.mgrid[0:H,0:W]; F=lambda x,y:np.stack([np.ones_like(x),x,y,x*x,x*y,y*y],-1).astype(float)
    cand=(loc<2.2)&(chroma<9)&(lum>95)&(lum<160)
    for it in range(3):
        cf=np.linalg.lstsq(F(xx[cand]/W,yy[cand]/H),lum[cand],rcond=None)[0]; BGS=F(xx/W,yy/H)@cf
        cand=(np.abs(lum-BGS)<7)&(loc<2.6)&(chroma<9)
    bgl=(np.abs(lum-BGS)<10)&(chroma<10)&(loc<4)
    shl=(~bgl)&(chroma<12)&(lum<BGS-2)&(lum>BGS-70)&(loc<4.2)
    # shadow = smooth dark-grey regions that TOUCH the backdrop (interior dark plates are surrounded by figure, so they stay)
    sl,sn=nd.label(shl); shadow=np.zeros_like(shl); bgd=nd.binary_dilation(bgl,iterations=1)
    for i in range(1,sn+1):
        c=sl==i
        if c.sum()>=40 and (nd.binary_dilation(c,iterations=3)&bgl).sum()>=30: shadow|=c
    shadow=nd.binary_dilation(shadow,iterations=1)&~bgl
    solid=~(bgl|shadow); solid=nd.binary_opening(solid,iterations=1)
    for nm,b in boxes.items():
        x0,y0,x1,y1=[int(v*K) for v in b]; box=np.zeros_like(solid); box[y0:y1,x0:x1]=True
        m=solid&box; obj=nd.binary_closing(m,iterations=3); lab,n=nd.label(obj)
        if n==0: print('EMPTY',nm); continue
        sizes=nd.sum(obj,lab,range(1,n+1)); big=sizes.max(); keep=np.zeros_like(obj)
        for i in range(n):
            c=(lab==i+1); sy_,sx_=nd.find_objects(c.astype(int))[0]; fill=sizes[i]/((sy_.stop-sy_.start)*(sx_.stop-sx_.start))
            if sizes[i]>=big*.12 and (sizes[i]==big or fill>.3): keep|=c
        keep=nd.binary_fill_holes(keep)&~shadow
        keep=nd.binary_opening(keep,iterations=1)
        a=nd.gaussian_filter(keep.astype(float),.8); a=np.clip((a-.4)*2,0,1)
        # de-fringe: edge pixels pick up the grey backdrop -> darken toward interior
        out=rgb0.copy(); edge=(a>.02)&(a<.98); out[edge]=(out[edge]*.6).astype(np.uint8)
        ys,xs=np.where(a>.02); ya,yb,xa,xb=ys.min(),ys.max()+1,xs.min(),xs.max()+1
        img=np.dstack([out,(a*255).astype(np.uint8)])[ya:yb,xa:xb]
        Image.fromarray(img,'RGBA').save(f'public/dungeons/enemies/{nm}.png'); man[nm]={'w':int(xb-xa),'h':int(yb-ya)}
        print(nm,man[nm])
json.dump(man,open('public/dungeons/enemies/manifest.json','w'),indent=1)
