# Crops the 2x2 ground sheet into seamless 512px tiles (offset cosine blend) + a non-tiling plaza centre.
import numpy as np
from PIL import Image
src=Image.open('public/town/source/town_ground_tiles.jpg').convert('RGB')
def seamless(im,n=512):
    a=np.array(im.resize((n,n),Image.LANCZOS)).astype(float)
    u=np.linspace(0,1,n); w1=np.sin(np.pi*u)**2  # 0 at edges, 1 mid
    W=np.outer(w1,w1)[...,None]
    b=np.roll(np.roll(a,n//2,0),n//2,1)
    # a is valid mid, b is valid at edges (it's a shifted copy so its seams are interior)
    out=a*W+b*(1-W)
    return Image.fromarray(out.clip(0,255).astype(np.uint8))
q={'cobble':(150,0,490,340),'planks':(640+130,0,640+470,340),'debris':(150,372,490,712)}
for k,b in q.items(): seamless(src.crop(b)).save(f'public/town/ground/{k}.jpg',quality=88)
src.crop((640,360,1280,720)).resize((512,512),Image.LANCZOS).save('public/town/ground/plaza.jpg',quality=88)
