# Cuts props out of an AI-generated sheet on flat ~#7b7b7b background -> public/town/props/<name>.png (RGBA, soft cast shadows kept as translucent black).
# usage: python3 tools/town/cut.py <sheet-basename> name1,name2,... (names in reading order: row-major, rows split at y=250/440 of a 1280x720 sheet)
import numpy as np, json, sys
from PIL import Image
from scipy import ndimage as nd
SHEET=sys.argv[1]; NAMES=sys.argv[2].split(',')
src=Image.open(f'public/town/source/{SHEET}.jpg').convert('RGB'); rgb0=np.array(src); im=rgb0.astype(float)
lum=im.mean(2); chroma=im.max(2)-im.min(2)
loc=np.sqrt(np.maximum(nd.uniform_filter(lum**2,5)-nd.uniform_filter(lum,5)**2,0))
bgl=(np.abs(lum-123)<9)&(chroma<9)&(loc<3.5)
shl=(~bgl)&(chroma<11)&(lum<121)&(lum>58)&(loc<4.5)
solid=~(bgl|shl)
solid=nd.binary_opening(solid,iterations=1)
import os
for c in os.environ.get("CUTX","").split(","):
    if c: solid[:250,int(c)-4:int(c)+4]=False
obj=nd.binary_closing(solid,iterations=4)
lab,n=nd.label(obj); sizes=nd.sum(obj,lab,range(1,n+1)); objs=nd.find_objects(lab)
items=[(i+1,objs[i]) for i in range(n) if sizes[i]>1500]
items.sort(key=lambda t:(((t[1][0].start+t[1][0].stop)/2>250)+((t[1][0].start+t[1][0].stop)/2>440),(t[1][1].start+t[1][1].stop)/2))
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
    a=np.where(sh,np.maximum(a,np.clip((123-lum)/123*1.15,0,.6)),a)
    out=rgb0.copy(); out[sh]=(8,8,10)
    # de-fringe: partially transparent edge pixels pick up the grey backdrop, so darken them toward the interior tone
    edge=(a>.02)&(a<.98)&~sh; out[edge]=(out[edge]*.55).astype(np.uint8)
    ys,xs=np.where(a>.02); y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
    img=np.dstack([out,(a*255).astype(np.uint8)])[y0:y1,x0:x1]
    Image.fromarray(img,'RGBA').save(f'public/town/props/{nm}.png')
    man[nm]={'w':int(x1-x0),'h':int(y1-y0)}
json.dump(man,open(f'public/town/props/cutouts_{SHEET}.json','w'),indent=1); print(man)
