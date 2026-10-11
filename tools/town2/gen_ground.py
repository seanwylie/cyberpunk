#!/usr/bin/env python3
"""Harrow Reach ground set (procedural, seamless where tiled): slag, deck, grate (512 tiles) + plaza (512, non-tiling centrepiece).
usage: python3 tools/town2/gen_ground.py   -> public/town2/ground/*.jpg
Drop-in replaceable: any AI-generated JPG with the same name overrides these (same contract as tools/town/ground.py)."""
import numpy as np, os
from PIL import Image, ImageFilter, ImageDraw
OUT='public/town2/ground'; os.makedirs(OUT,exist_ok=True); N=512
rs=np.random.RandomState(7)
def pnoise(size=N, beta=2.0, seed=0):
    """periodic (seamless) 1/f^beta noise in [0,1]"""
    r=np.random.RandomState(seed); f=np.fft.fftfreq(size)[:,None]**2+np.fft.fftfreq(size)[None,:]**2; f[0,0]=1
    spec=(r.randn(size,size)+1j*r.randn(size,size))/(f**(beta/2)); spec[0,0]=0
    a=np.real(np.fft.ifft2(spec)); a=(a-a.min())/(a.max()-a.min()); return a
def fbm(seed,bs=(1.6,2.0,2.4)):
    return sum(pnoise(N,b,seed+i)*w for i,(b,w) in enumerate(zip(bs,(.55,.3,.15))))
def save(a,name): Image.fromarray(np.clip(a,0,255).astype(np.uint8)).save(f'{OUT}/{name}.jpg',quality=88); print(name)
def tile_lines(a,step,w,col,amt):
    # darken seams of a regular plate grid (periodic since step divides N)
    for k in range(0,N,step):
        for d in range(w):
            a[(k+d)%N,:,:]*=amt; a[:,(k+d)%N,:]*=amt
    return a
# ---- slag: cooled basalt with ember cracks ----
n1=fbm(1); n2=pnoise(N,1.2,5); base=np.stack([30+40*n1,26+32*n1,26+30*n1],-1)
base*= (0.8+0.4*pnoise(N,2.8,9))[...,None]
ridge=1-np.abs(2*pnoise(N,1.8,11)-1); crack=np.clip((ridge-.93)/.07,0,1)**1.5; crack*=np.clip(pnoise(N,2.2,13)*1.8-.45,0,1)
glow=np.stack([255*crack,110*crack,28*crack],-1); halo=np.array(Image.fromarray((crack*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))).astype(float)/255
base+= np.stack([95*halo,28*halo,6*halo],-1)*.8; base+=glow*.9
base[...,0]+=14*pnoise(N,2.5,3)  # rust warmth
save(base,'slag')
# ---- deck: riveted gunmetal plates ----
step=128; pl=fbm(21,(2.2,2.6,3.0)); a=np.stack([62+34*pl,60+32*pl,58+30*pl],-1)
rust=np.clip(pnoise(N,2.0,23)*1.7-.7,0,1)[...,None]*np.array([70,30,10])*1.0; a+=rust
for k in range(0,N,step): a[k:k+2,:,:]*=.45; a[:,k:k+2,:]*=.45; a[k+2:k+4,:,:]*=1.18; a[:,k+2:k+4,:]*=1.18
im=Image.fromarray(np.clip(a,0,255).astype(np.uint8)); d=ImageDraw.Draw(im)
for gx in range(0,N,step):
    for gy in range(0,N,step):
        for (ox,oy) in ((14,14),(step-14,14),(14,step-14),(step-14,step-14)):
            x,y=gx+ox,gy+oy; d.ellipse([x-4,y-4,x+4,y+4],fill=(40,38,36)); d.ellipse([x-3,y-4,x+2,y+1],fill=(120,116,108))
a=np.array(im).astype(float)
sc=pnoise(N,1.0,31); a*= (0.88+0.24*sc)[...,None]
save(a,'deck')
# ---- grate: dark floor with glowing slots (heat from below) ----
a=np.zeros((N,N,3))+np.array([24,24,26]); pit=24
yy,xx=np.mgrid[0:N,0:N]
slot=((xx%pit)<16)&((yy%pit)<5); bar=((xx%pit)>=16)|((yy%pit)>=5)
heat=np.clip(pnoise(N,2.2,41)*1.6-.2,0,1)
a[slot]=np.stack([40+215*heat[slot],18+80*heat[slot],8+16*heat[slot]],-1)
a[bar]=np.array([48,48,50])*(0.8+0.4*pnoise(N,2.6,43)[bar][:,None])
a=np.array(Image.fromarray(np.clip(a,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.6))).astype(float)
save(a,'grate')
# ---- plaza: foundry-floor medallion (non-tiling) ----
c=np.array([N/2,N/2]); r=np.hypot(xx-c[1]+.5,yy-c[0]+.5)/ (N/2)
a=np.stack([58+30*fbm(51)]*3,-1)*np.array([1.0,.97,.95]); a+=np.clip(pnoise(N,2.0,53)*1.6-.7,0,1)[...,None]*np.array([60,24,8])
im=Image.fromarray(np.clip(a,0,255).astype(np.uint8)).convert('RGB'); d=ImageDraw.Draw(im)
def ring(R,w,col): d.ellipse([N/2-R,N/2-R,N/2+R,N/2+R],outline=col,width=w)
ring(236,6,(30,28,26)); ring(228,3,(160,128,58)); ring(150,10,(34,32,30)); ring(150,3,(150,120,56)); ring(96,4,(150,120,56))
# hazard chevron band
for i in range(48):
    ang=i*2*np.pi/48
    for rr in range(176,206,2):
        x=N/2+rr*np.cos(ang); y=N/2+rr*np.sin(ang)
        if i%2==0: d.ellipse([x-5,y-5,x+5,y+5],fill=(120,98,34))
# central furnace grate with ember glow
g=Image.new('RGB',(N,N),(10,10,12)); gd=ImageDraw.Draw(g); gd.ellipse([N/2-84,N/2-84,N/2+84,N/2+84],fill=(210,86,24))
for k in range(-84,85,16): gd.line([N/2+k,N/2-84,N/2+k,N/2+84],fill=(22,20,20),width=7); gd.line([N/2-84,N/2+k,N/2+84,N/2+k],fill=(22,20,20),width=7)
m=Image.new('L',(N,N),0); ImageDraw.Draw(m).ellipse([N/2-84,N/2-84,N/2+84,N/2+84],fill=255); im.paste(g,(0,0),m)
glow=Image.new('L',(N,N),0); ImageDraw.Draw(glow).ellipse([N/2-100,N/2-100,N/2+100,N/2+100],fill=150); glow=glow.filter(ImageFilter.GaussianBlur(26))
arr=np.array(im).astype(float); gl=np.array(glow).astype(float)/255; arr+=np.stack([190*gl,64*gl,10*gl],-1)*.55
save(arr,'plaza')
