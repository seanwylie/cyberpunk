# Cuts props out of an AI-generated sheet on flat ~#7b7b7b background -> public/town/props/<name>.png (RGBA, soft cast shadows kept as translucent black).
# usage: python3 tools/town/cut.py <sheet-basename> name1,name2,... (names in reading order: row-major, rows split at y=250/440 of a 1280x720 sheet)
import numpy as np, json, sys, os
from PIL import Image
from scipy import ndimage as nd
SHEET=sys.argv[1]; NAMES=sys.argv[2].split(',') if not sys.argv[2].startswith('auto:') else None; PREFIX=sys.argv[2][5:]
BG=float(os.environ.get('BG','123')); ROWS=[float(v) for v in os.environ.get('ROWS','250,440').split(',')]; OPEN=int(os.environ.get('OPEN','1')); MINSZ=int(os.environ.get('MINSZ','1500'))
src=Image.open(f'public/town/source/{SHEET}.jpg').convert('RGB'); rgb0=np.array(src); im=rgb0.astype(float)
lum=im.mean(2); chroma=im.max(2)-im.min(2)
loc=np.sqrt(np.maximum(nd.uniform_filter(lum**2,5)-nd.uniform_filter(lum,5)**2,0))
# backgrounds are slight gradients: fit a quadratic surface to the outer border luminance and use it as the local background level
Hh,Ww=lum.shape; yy,xx=np.mgrid[0:Hh,0:Ww]; bm=np.zeros(lum.shape,bool); bm[:14]=bm[-14:]=True; bm[:,:14]=bm[:,-14:]=True
F=lambda x,y:np.stack([np.ones_like(x),x,y,x*x,x*y,y*y],-1).astype(float)
cf=np.linalg.lstsq(F(xx[bm]/Ww,yy[bm]/Hh),lum[bm],rcond=None)[0]; BGS=F(xx/Ww,yy/Hh)@cf
bgl=(np.abs(lum-BGS)<9)&(chroma<9)&(loc<3.5)
shl=(~bgl)&(chroma<11)&(lum<BGS-2)&(lum>BGS-65)&(loc<4.5)
solid=~(bgl|shl)
solid=nd.binary_opening(solid,iterations=1) if OPEN else solid
import os
for c in os.environ.get("CUTX","").split(","):
    if c: solid[:250,int(c)-10:int(c)+10]=False
obj=nd.binary_closing(solid,iterations=4)
lab,n=nd.label(obj); sizes=nd.sum(obj,lab,range(1,n+1)); objs=nd.find_objects(lab)
items=[(i+1,objs[i]) for i in range(n) if sizes[i]>MINSZ]
cy=lambda t:(t[1][0].start+t[1][0].stop)/2
items.sort(key=lambda t:(sum(cy(t)>r for r in ROWS),(t[1][1].start+t[1][1].stop)/2))
if NAMES is None: NAMES=[f'{PREFIX}{i:02d}' for i in range(len(items))]
print([(t[1][0].start,t[1][1].start,t[1][1].stop) for t in items])
assert len(items)==len(NAMES),(len(items),len(NAMES))
man={}
for (l,sl),nm in zip(items,NAMES):
    comp=(lab==l); near=nd.binary_dilation(comp,iterations=22)
    a=np.zeros(lum.shape)
    a[nd.binary_erosion(solid,iterations=1)&nd.binary_dilation(comp,iterations=2)]=1
    # drop stray solid pixels not in this component
    a=nd.gaussian_filter(a,.7); a=np.clip((a-.35)*1.8,0,1)
    sh=shl&near&~(a>.5)
    a=np.where(sh,np.maximum(a,np.clip((BGS-lum)/BGS*1.15,0,.6)),a)
    out=rgb0.copy(); out[sh]=(8,8,10)
    # de-fringe: partially transparent edge pixels pick up the grey backdrop, so darken them toward the interior tone
    edge=(a>.02)&(a<.98)&~sh; out[edge]=(out[edge]*.55).astype(np.uint8)
    ys,xs=np.where(a>.02); y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
    img=np.dstack([out,(a*255).astype(np.uint8)])[y0:y1,x0:x1]
    Image.fromarray(img,'RGBA').save(f'public/town/props/{nm}.png')
    man[nm]={'w':int(x1-x0),'h':int(y1-y0)}
json.dump(man,open(f'public/town/props/cutouts_{SHEET}.json','w'),indent=1); print(man)
