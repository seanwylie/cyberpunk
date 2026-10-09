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
 'enemies_annex':{'worker':[100,0,260,185],'shooter':[420,0,570,190],'turret':[680,5,915,175],'sawhand':[40,175,330,375],'foreman':[390,185,590,380],'overseer':[690,180,910,385],'warden':[55,360,265,555],'enforcer':[335,365,610,570],'drone':[705,395,895,535]},
 # SKIPPED (back art is a different design than the front): ore9, slagcannon, cinderhound, forkbot, scanner.
 # BACK VIEWS (same figures seen from behind; 1024-space boxes). Heights are normalised to the matching front sprite after the cut so the renderer's height-fit keeps scale/anchor.
 'enemies_foundry_back':{'teague_back':[70,15,235,255],'brannoch_back':[270,15,460,245],'slaghauler_back':[740,40,965,250],'ladlecrew_back':[55,310,225,525],'quenchpriest_back':[770,285,910,530]},
 'enemies_clinic_back':{'surgeon_back':[25,10,245,250],'autosurgeon_back':[255,5,530,235],'nursebot_back':[555,10,740,265],'recovered_back':[785,5,955,270],'orderly_back':[55,270,205,510],'gurneyrunner_back':[255,290,515,500],'sentry_back':[525,285,760,520],'matron_back':[785,265,955,550]},
 'enemies_warehouse_back':{'stockmgr_back':[110,5,255,200],'retrieval_back':[385,5,610,200],'reclaimer_back':[700,5,880,200],'loader_back':[380,195,590,385],'picker_back':[105,195,285,360],'camgun_back':[390,380,545,540],'shiftlead_back':[760,355,900,560]},
 'enemies_annex_back':{'worker_back':[125,0,285,190],'shooter_back':[405,0,545,195],'turret_back':[685,5,920,165],'sawhand_back':[90,185,330,375],'foreman_back':[400,185,605,385],'overseer_back':[695,185,905,385],'warden_back':[60,365,270,560],'enforcer_back':[400,370,630,570],'drone_back':[705,395,895,545]},
}
EX={'teague':[[0,55,140,110]],'brannoch':[[330,55,452,112]],'slaghauler':[[0,300,110,338]],'ladlecrew':[[195,305,300,335]],'quenchpriest':[[880,300,1010,330]],'matron':[[740,318,870,334]],'forkbot':[[380,330,428,382]],'scanner':[[545,340,578,382]],'camgun':[[775,375,812,402]]}
man={}
for sh,boxes in SHEETS.items():
    rgb0=np.array(Image.open(f'public/dungeons/source/{sh}.jpg').convert('RGB')); im=rgb0.astype(float); lum=im.mean(2); chroma=im.max(2)-im.min(2)
    loc=np.sqrt(np.maximum(nd.uniform_filter(lum**2,5)-nd.uniform_filter(lum,5)**2,0))
    H,W=lum.shape; yy,xx=np.mgrid[0:H,0:W]; F=lambda x,y:np.stack([np.ones_like(x),x,y,x*x,x*y,y*y],-1).astype(float)
    cand=(loc<2.2)&(chroma<9)&(lum>(55 if sh=='enemies_foundry_back' else 95))&(lum<160)
    for it in range(3):
        cf=np.linalg.lstsq(F(xx[cand]/W,yy[cand]/H),lum[cand],rcond=None)[0]; BGS=F(xx/W,yy/H)@cf
        cand=(np.abs(lum-BGS)<7)&(loc<2.6)&(chroma<9)
    bgl=(np.abs(lum-BGS)<10)&(chroma<10)&(loc<4)
    shl=(~bgl)&(chroma<12)&(lum<BGS-2)&(lum>BGS-70)&(loc<4.2)
    # shadow = smooth dark-grey regions that TOUCH the backdrop (interior dark plates are surrounded by figure, so they stay)
    sm=nd.gaussian_filter(lum,1.5); loc9=np.sqrt(np.maximum(nd.uniform_filter(lum**2,9)-nd.uniform_filter(lum,9)**2,0))
    shl=(~bgl)&(nd.gaussian_filter(chroma.astype(float),1.5)<7)&(sm<BGS-3)&(sm>BGS-60)&(loc<9)&(loc9<14)
    cs=nd.gaussian_filter(chroma.astype(float),1.5); soft=(~bgl)&(cs<8)&(sm<BGS-8)&(sm>BGS-62)&(nd.gaussian_filter(loc,1.5)<9)
    halo=soft&nd.binary_dilation(bgl,iterations=5); shl=shl|halo
    sl,sn=nd.label(shl); shadow=np.zeros_like(shl); bgd=nd.binary_dilation(bgl,iterations=1)
    for i in range(1,sn+1):
        c=sl==i
        if c.sum()>=40 and (nd.binary_dilation(c,iterations=3)&bgl).sum()>=30: shadow|=c
    shadow=nd.binary_dilation(shadow,iterations=1)&~bgl
    solid=~(bgl|shadow); solid=nd.binary_opening(solid,iterations=1)
    for nm,b in boxes.items():
        x0,y0,x1,y1=[int(v*K) for v in b]; box=np.zeros_like(solid); box[y0:y1,x0:x1]=True
        for e in EX.get(nm,[]): box[int(e[1]*K):int(e[3]*K),int(e[0]*K):int(e[2]*K)]=False
        m=solid&box
        if not sh.startswith('enemies_clinic'):  # strip leftover neutral-grey ground shadow in the lower 45% (connected to the backdrop)
            ys_=np.where(m.any(1))[0]
            if len(ys_):
                lo=np.zeros_like(m); lo[ys_.min()+int((ys_.max()-ys_.min())*.55):]=True
                gs=(cs<7)&(sm>(30 if sh=='enemies_foundry_back' else 70))&(sm<BGS-8)&lo&box&m; gl,gn=nd.label(gs)
                for i in range(1,gn+1):
                    cc=gl==i
                    if cc.sum()>=25 and (nd.binary_dilation(cc,iterations=3)&bgl).sum()>=8: m&=~nd.binary_dilation(cc,iterations=1)
        _ys=np.where(m.any(1))[0]; yb0=_ys.min()+int((_ys.max()-_ys.min())*.68) if len(_ys) else 0
        low=np.zeros_like(m); low[yb0:]=True; m&=~(soft&low&box)
        if not sh.startswith('enemies_clinic'):
            core=nd.binary_opening(m,iterations=3); lc,nc=nd.label(core)
            if nc: sz=nd.sum(core,lc,range(1,nc+1)); core=np.isin(lc,[i+1 for i in range(nc) if sz[i]>=sz.max()*.25]); m=nd.binary_dilation(core,iterations=5)&m
        obj=nd.binary_closing(m,iterations=2); lab,n=nd.label(obj)
        if n==0: print('EMPTY',nm); continue
        sizes=nd.sum(obj,lab,range(1,n+1)); big=sizes.max(); keep=np.zeros_like(obj)
        for i in range(n):
            c=(lab==i+1); sy_,sx_=nd.find_objects(c.astype(int))[0]; fill=sizes[i]/((sy_.stop-sy_.start)*(sx_.stop-sx_.start))
            if sizes[i]>=big*.25 and (sizes[i]==big or fill>.3): keep|=c
        keep=nd.binary_fill_holes(keep)&~shadow
        keep=nd.binary_opening(keep,iterations=1)
        keep=nd.binary_erosion(keep,iterations=1); a=nd.gaussian_filter(keep.astype(float),.8); a=np.clip((a-.4)*2,0,1)
        # de-fringe: edge pixels pick up the grey backdrop -> darken toward interior
        out=rgb0.copy(); edge=(a>.02)&(a<.98); out[edge]=(out[edge]*.6).astype(np.uint8)
        ys,xs=np.where(a>.02); ya,yb,xa,xb=ys.min(),ys.max()+1,xs.min(),xs.max()+1
        img=np.dstack([out,(a*255).astype(np.uint8)])[ya:yb,xa:xb]
        pim=Image.fromarray(img,'RGBA')
        if nm.endswith('_back') and os.path.exists(f'public/dungeons/enemies/{nm[:-5]}.png'):
            fw,fh=Image.open(f'public/dungeons/enemies/{nm[:-5]}.png').size; k=fh/pim.height; pim=pim.resize((max(1,round(pim.width*k)),fh),Image.LANCZOS); print('  front',(fw,fh),'back w ratio %.2f'%(pim.width/fw))
        pim.save(f'public/dungeons/enemies/{nm}.png'); man[nm]={'w':pim.width,'h':pim.height}
        print(nm,man[nm])
json.dump(man,open('public/dungeons/enemies/manifest.json','w'),indent=1)
