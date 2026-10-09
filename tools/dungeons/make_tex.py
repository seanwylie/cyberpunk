# Cuts detail swatches from the environment concept sheets -> seamless 128px tiles in public/dungeons/tex (used as grit/detail overlays by src/dungeon_env.ts).
# slag.png: molten trough surface (foundry panel 1); tile.png: dirty ivory floor tile (clinic panel 1); conc.png: dock concrete (warehouse panel 1).
import numpy as np
from PIL import Image, ImageFilter
def seamless(im,n=128):
    im=im.resize((n,n),Image.LANCZOS); a=np.array(im).astype(float)
    # mirror-quilt blend: cross-fade with half-shifted copy so edges match
    sh=np.roll(np.roll(a,n//2,0),n//2,1); y,x=np.mgrid[0:n,0:n]; wx=np.minimum(x,n-1-x)/(n/2); wy=np.minimum(y,n-1-y)/(n/2); w=np.clip(np.minimum(wx,wy)*2,0,1)[...,None]
    out=a*w+sh*(1-w); return Image.fromarray(out.clip(0,255).astype(np.uint8))
C={'slag':('foundry',(272,160,302,182)),'tile':('clinic',(300,262,350,300)),'conc':('warehouse',(842,588,882,608))}
for k,(sh,box) in C.items():
    im=Image.open(f'public/dungeons/source/{sh}.jpg').convert('RGB').crop(box); seamless(im).save(f'public/dungeons/tex/{k}.png'); print(k)
