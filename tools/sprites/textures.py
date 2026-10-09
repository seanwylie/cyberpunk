# Procedural painted-look textures (numpy+PIL). Muted palette only: concrete grey, soot, dirty bone, oxidised metal, olive, ivory.
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import os, sys
S=512
rng=np.random.default_rng(7)
def noise(scale,oct=4,seed=0):
    r=np.random.default_rng(seed); out=np.zeros((S,S)); amp=1; tot=0
    for o in range(oct):
        n=max(2,scale*2**o); a=r.random((n,n)).astype('float32')
        im=Image.fromarray((a*255).astype('uint8')).resize((S,S),Image.BICUBIC)
        out+=amp*np.asarray(im)/255; tot+=amp; amp*=0.5
    return out/tot
def hexc(h): return np.array([int(h[i:i+2],16) for i in (1,3,5)],dtype='float32')/255
def base(col,var=0.18,seed=1,grain=0.06):
    n=noise(6,5,seed)-0.5; g=(rng.random((S,S))-0.5)
    img=np.ones((S,S,3))*hexc(col)
    img=img*(1+var*2*n[...,None]+grain*g[...,None])
    return img
def streaks(img,seed,strength=0.15,vertical=True):
    r=np.random.default_rng(seed); n=r.random((1,S)) if vertical else r.random((S,1))
    n=np.asarray(Image.fromarray((np.repeat(n,S,0 if vertical else 1)*255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.2)))/255.
    if not vertical: pass
    return img*(1-strength+strength*2*(n[...,None]-0.5)+strength*0.5)
def save(img,name):
    Image.fromarray((np.clip(img,0,1)*255).astype('uint8')).save(name)
def draw_lines(img,fn):
    im=Image.fromarray((np.clip(img,0,1)*255).astype('uint8')); d=ImageDraw.Draw(im); fn(d); return np.asarray(im).astype('float32')/255
out=sys.argv[1]; os.makedirs(out,exist_ok=True)
# jacket: faded concrete-grey canvas with weave + wear
j=base('#85867f',0.25,2); w=(np.sin(np.arange(S)*1.6)[None,:]*np.sin(np.arange(S)*1.6)[:,None])*0.03
j=j*(1+w[...,None]); j=j*(0.8+0.4*noise(14,3,9)[...,None]**2); save(j,out+'/jacket.png')
# pants: soot black
save(base('#2b2c2b',0.35,3,0.08)*(0.9+0.2*noise(20,3,4)[...,None]),out+'/pants.png')
# olive stamped panels with rivets/seams/chips
o=base('#5d6238',0.2,4)
def pan(d):
    for gx in range(0,S,128):
        d.line([(gx,0),(gx,S)],fill=(30,34,20),width=4); d.line([(0,gx),(S,gx)],fill=(30,34,20),width=4)
        d.line([(gx+5,0),(gx+5,S)],fill=(120,126,84),width=2)
    for gx in range(0,S,128):
        for gy in range(0,S,128):
            for dx,dy in ((16,16),(112,16),(16,112),(112,112)): d.ellipse([gx+dx-5,gy+dy-5,gx+dx+5,gy+dy+5],fill=(47,50,32),outline=(130,134,96))
            d.rectangle([gx+30,gy+54,gx+98,gy+74],outline=(40,44,28),width=3)
o=draw_lines(o,pan); chips=(noise(40,2,5)>0.78)[...,None]; o=np.where(chips,hexc('#7d8068'),o)
o=o*(0.85+0.3*noise(8,4,6)[...,None]); save(o,out+'/olive.png')
# ivory ceramic with slate-blue marks
iv=base('#cfc7b2',0.08,5,0.025); iv=iv*(0.93+0.14*noise(10,3,7)[...,None])
def mk(d):
    for y in range(40,S,170):
        d.rectangle([0,y,S,y+26],fill=(78,94,114)); d.rectangle([0,y+34,S,y+40],fill=(78,94,114))
    for x in range(30,S,140): d.line([(x,0),(x,S)],fill=(190,182,160),width=2)
iv=draw_lines(iv,mk); iv=iv*(0.9+0.1*noise(30,2,8)[...,None]); save(iv,out+'/ivory.png')
save(base('#8d6c54',0.12,6,0.03),out+'/skin.png')
save(base('#24211e',0.3,7,0.06)*(0.9+0.2*noise(12,3,3)[...,None]),out+'/boot.png')
c=base('#3d3a32',0.3,8,0.07); c=c*(1+0.04*np.sin(np.arange(S)*1.4)[None,:,None]); save(c,out+'/canvas.png')
m=base('#5a5d5b',0.3,9,0.08); m=np.where((noise(30,3,12)>0.62)[...,None],hexc('#6b4a33'),m); save(m,out+'/metal.png')
save(base('#1d1d1c',0.2,10),out+'/cloth.png')
save(base('#22282a',0.1,11),out+'/glass.png')
